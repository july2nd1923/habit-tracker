-- ============================================
-- 습관 트래커 DB 스키마 (친구 공유 기능 포함)
-- Supabase 대시보드 > SQL Editor 에서 전체 실행하세요
-- ※ 이전에 schema.sql을 이미 실행한 적이 있다면, 아래 "기존 테이블 삭제"
--    섹션의 주석(--)을 지우고 먼저 실행한 뒤, 나머지를 실행하세요.
-- ============================================

create extension if not exists "uuid-ossp";

-- ── (선택) 기존 테이블을 지우고 새로 시작하고 싶다면 아래 주석 해제 ──
-- drop table if exists habit_notes cascade;
-- drop table if exists habit_logs cascade;
-- drop table if exists habits cascade;
-- drop table if exists friendships cascade;
-- drop table if exists profiles cascade;
-- drop function if exists is_friend cascade;
-- drop function if exists generate_friend_code cascade;
-- drop function if exists handle_new_user cascade;

-- ============================================
-- 1. profiles: 유저별 공개 프로필 (친구 코드 포함)
-- ============================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  friend_code text unique not null,
  display_name text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles: logged-in users can read all" on profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles: update own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 친구 코드 자동 생성 함수 (헷갈리는 0/O/1/I/L 제외, 5자리)
create or replace function generate_friend_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  code_exists boolean;
begin
  loop
    code := '';
    for i in 1..5 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from profiles where friend_code = code) into code_exists;
    exit when not code_exists;
  end loop;
  return code;
end;
$$ language plpgsql;

-- 새 유저(auth.users)가 생기면 자동으로 profiles row 생성
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, friend_code, display_name)
  values (new.id, generate_friend_code(), split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- 2. friendships: 친구 관계 (요청 → 수락)
-- ============================================
create table if not exists friendships (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table friendships enable row level security;

create policy "friendships: select involved" on friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships: insert as requester" on friendships
  for insert with check (auth.uid() = requester_id);

create policy "friendships: update involved" on friendships
  for update using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships: delete involved" on friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- 두 유저가 서로 수락된 친구 사이인지 확인하는 함수
create or replace function is_friend(a uuid, b uuid) returns boolean as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$ language sql stable;

-- ============================================
-- 3. habits (공개 범위: private / friends)
-- ============================================
create table if not exists habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  color text not null default '#A8CDE8',
  visibility text not null default 'private' check (visibility in ('private', 'friends')),
  sort_order int default 0,
  archived boolean default false,
  created_at timestamptz default now()
);

alter table habits enable row level security;

create policy "habits: owner full access" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "habits: friends can view shared" on habits
  for select using (visibility = 'friends' and is_friend(auth.uid(), user_id));

-- ============================================
-- 4. habit_logs
-- ============================================
create table if not exists habit_logs (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null,
  log_date date not null,
  created_at timestamptz default now(),
  unique (habit_id, log_date)
);

alter table habit_logs enable row level security;

create policy "habit_logs: owner full access" on habit_logs
  for all using (
    exists (select 1 from habits where habits.id = habit_logs.habit_id and habits.user_id = auth.uid())
  ) with check (
    exists (select 1 from habits where habits.id = habit_logs.habit_id and habits.user_id = auth.uid())
  );

create policy "habit_logs: friends can view shared" on habit_logs
  for select using (
    exists (
      select 1 from habits h
      where h.id = habit_logs.habit_id
        and h.visibility = 'friends'
        and is_friend(auth.uid(), h.user_id)
    )
  );

-- ============================================
-- 5. habit_notes (항상 본인만 볼 수 있음 — 친구에게 공개 안 됨)
-- ============================================
create table if not exists habit_notes (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null unique,
  content text default '',
  updated_at timestamptz default now()
);

alter table habit_notes enable row level security;

create policy "habit_notes: owner only" on habit_notes
  for all using (
    exists (select 1 from habits where habits.id = habit_notes.habit_id and habits.user_id = auth.uid())
  ) with check (
    exists (select 1 from habits where habits.id = habit_notes.habit_id and habits.user_id = auth.uid())
  );
