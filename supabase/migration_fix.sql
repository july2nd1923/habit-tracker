-- ============================================
-- 완전판 복구 마이그레이션 (2026-07)
-- ★ DB가 어떤 상태든(테이블이 있든 없든) 에러 없이 끝까지 실행돼요
-- ★ 몇 번을 다시 실행해도 안전해요
-- ============================================

create extension if not exists "uuid-ossp";

-- ── 1. [핵심 버그 수정] habit_logs.status ──
alter table habit_logs add column if not exists status text not null default 'done';
do $$ begin
  alter table habit_logs add constraint habit_logs_status_check check (status in ('done', 'rest'));
exception when duplicate_object then null; end $$;

-- ── 2. habits 누락 컬럼들 ──
alter table habits add column if not exists archived_at date;

-- ── 3. 챌린지 ──
create table if not exists challenges (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  color text not null default '#A8CDE8',
  creator_id uuid references profiles(id) on delete cascade not null,
  partner_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'pending',
  creator_habit_id uuid,
  partner_habit_id uuid,
  created_at timestamptz default now()
);

alter table challenges drop constraint if exists challenges_status_check;
alter table challenges add constraint challenges_status_check
  check (status in ('pending', 'accepted', 'declined', 'ended'));

alter table challenges enable row level security;

drop policy if exists "challenges: involved can select" on challenges;
create policy "challenges: involved can select" on challenges
  for select using (auth.uid() = creator_id or auth.uid() = partner_id);

drop policy if exists "challenges: creator can insert" on challenges;
create policy "challenges: creator can insert" on challenges
  for insert with check (auth.uid() = creator_id);

drop policy if exists "challenges: involved can update" on challenges;
create policy "challenges: involved can update" on challenges
  for update using (auth.uid() = creator_id or auth.uid() = partner_id)
  with check (auth.uid() = creator_id or auth.uid() = partner_id);

alter table habits add column if not exists challenge_id uuid references challenges(id) on delete set null;

do $$ begin
  alter table challenges add constraint challenges_creator_habit_fk
    foreign key (creator_habit_id) references habits(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table challenges add constraint challenges_partner_habit_fk
    foreign key (partner_habit_id) references habits(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ── 4. 응원 반응 ──
create table if not exists habit_reactions (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null,
  year_month text not null,
  reactor_id uuid references profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique (habit_id, year_month, reactor_id)
);

alter table habit_reactions enable row level security;

drop policy if exists "habit_reactions: owner or friend can select" on habit_reactions;
create policy "habit_reactions: owner or friend can select" on habit_reactions
  for select using (
    exists (
      select 1 from habits h
      where h.id = habit_reactions.habit_id
        and (h.user_id = auth.uid() or (h.visibility = 'friends' and is_friend(auth.uid(), h.user_id)))
    )
  );

drop policy if exists "habit_reactions: friend can react" on habit_reactions;
create policy "habit_reactions: friend can react" on habit_reactions
  for insert with check (
    reactor_id = auth.uid()
    and exists (
      select 1 from habits h
      where h.id = habit_reactions.habit_id
        and h.visibility = 'friends'
        and is_friend(auth.uid(), h.user_id)
    )
  );

drop policy if exists "habit_reactions: reactor can update own" on habit_reactions;
create policy "habit_reactions: reactor can update own" on habit_reactions
  for update using (reactor_id = auth.uid()) with check (reactor_id = auth.uid());

drop policy if exists "habit_reactions: reactor can delete own" on habit_reactions;
create policy "habit_reactions: reactor can delete own" on habit_reactions
  for delete using (reactor_id = auth.uid());

-- ── 5. 장기 휴식 ──
create table if not exists habit_pauses (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null,
  start_date date not null,
  end_date date,
  created_at timestamptz default now()
);

alter table habit_pauses enable row level security;

drop policy if exists "habit_pauses: owner full access" on habit_pauses;
create policy "habit_pauses: owner full access" on habit_pauses
  for all using (
    exists (select 1 from habits where habits.id = habit_pauses.habit_id and habits.user_id = auth.uid())
  ) with check (
    exists (select 1 from habits where habits.id = habit_pauses.habit_id and habits.user_id = auth.uid())
  );

drop policy if exists "habit_pauses: friends can view shared" on habit_pauses;
create policy "habit_pauses: friends can view shared" on habit_pauses
  for select using (
    exists (
      select 1 from habits h
      where h.id = habit_pauses.habit_id
        and h.visibility = 'friends'
        and is_friend(auth.uid(), h.user_id)
    )
  );

-- ── 6. 습관 댓글 ──
create table if not exists habit_comments (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null,
  year_month text not null,
  author_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table habit_comments enable row level security;

drop policy if exists "habit_comments: habit viewers can read" on habit_comments;
create policy "habit_comments: habit viewers can read" on habit_comments
  for select using (
    exists (
      select 1 from habits h
      where h.id = habit_comments.habit_id
        and (h.user_id = auth.uid() or (h.visibility = 'friends' and is_friend(auth.uid(), h.user_id)))
    )
  );

drop policy if exists "habit_comments: owner or friends can write" on habit_comments;
create policy "habit_comments: owner or friends can write" on habit_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from habits h
      where h.id = habit_comments.habit_id
        and (h.user_id = auth.uid() or (h.visibility = 'friends' and is_friend(auth.uid(), h.user_id)))
    )
  );

drop policy if exists "habit_comments: author can delete own" on habit_comments;
create policy "habit_comments: author can delete own" on habit_comments
  for delete using (author_id = auth.uid());

-- ── 7. 메시지 기능 제거 ──
drop table if exists friend_messages cascade;

-- ============================================
-- 완료! 마지막 줄까지 실행되고 "Success"가 뜨면 성공이에요.
-- ============================================
