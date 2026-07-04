# 매일 조금씩 — 습관 트래커

파스텔 색상으로 습관/할일을 관리하고, 이번 달 달성률(%)과 완료 횟수를 보여주는 개인용 웹앱이에요.
각 습관마다 운동 루틴이나 학습 자료를 마크다운으로 정리할 수 있는 메모 탭도 있어요.

---

## 1. Supabase 프로젝트 만들기 (5분)

1. https://supabase.com 접속 → GitHub 계정으로 가입/로그인
2. **New Project** 클릭
   - 이름: 아무거나 (예: habit-tracker)
   - 비밀번호: DB 관리자 비밀번호 (아무거나 안전하게, 나중에 안 씀)
   - 리전: Northeast Asia (Seoul) 추천
3. 프로젝트가 생성될 때까지 1~2분 대기

## 2. 데이터베이스 테이블 만들기

1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. **New query** 클릭
3. 이 프로젝트의 `supabase/schema.sql` 파일 내용을 전부 복사해서 붙여넣기
4. 오른쪽 아래 **Run** 클릭 → 성공 메시지 확인

이러면 `habits`(할일), `habit_logs`(완료 기록), `habit_notes`(메모) 테이블이 생기고,
로그인한 본인 데이터만 볼 수 있도록 보안(RLS)도 자동 설정돼요.

## 3. 계정(로그인) 만들기 — 나 & 언니용

1. 왼쪽 메뉴 **Authentication** → **Users** 탭
2. **Add user** → **Create new user** 클릭
3. 이메일 / 비밀번호 입력 (본인 것)
4. 같은 방법으로 언니 계정도 하나 더 추가
   - ⚠️ 회원가입 화면은 따로 없어요. 계정 추가는 항상 이 화면에서, 나중에 필요할 때마다 하시면 돼요.

## 4. API 키 확인하기

1. 왼쪽 메뉴 **Project Settings** (톱니바퀴) → **API**
2. 아래 두 값을 복사해두세요:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** key (긴 문자열)

이 두 값은 `.env.example` 파일 형식으로 `.env` 파일에 넣으면 돼요. (anon key는 공개돼도 안전한 키예요 — RLS가 실제 데이터를 보호해줘요.)

---

## 5. 로컬에서 실행해보기 (선택)

```bash
npm install
cp .env.example .env
# .env 파일 열어서 Supabase URL / anon key 입력
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 6. GitHub에 올리기

1. https://github.com 에서 새 저장소(repository) 생성 (Private 추천 — 개인 습관 기록이니까요)
2. 이 폴더에서:

```bash
git init
git add .
git commit -m "habit tracker 초기 버전"
git branch -M main
git remote add origin https://github.com/내계정/저장소이름.git
git push -u origin main
```

## 7. Vercel로 배포하기 (무료)

1. https://vercel.com 접속 → **GitHub 계정으로 가입/로그인**
2. **Add New → Project** 클릭
3. 방금 만든 GitHub 저장소 선택 → **Import**
4. **Environment Variables** 섹션에 아래 두 개 추가:
   - `VITE_SUPABASE_URL` = Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase anon public key
5. **Deploy** 클릭 → 1~2분 후 배포 완료, `xxxx.vercel.app` 주소 생성

이후로는 GitHub에 `git push`만 하면 Vercel이 자동으로 재배포해줘요.
(핸드폰 홈 화면에 "바로가기"로 추가하면 앱처럼 쓸 수 있어요 — 브라우저 공유 메뉴 → "홈 화면에 추가")

---

## 사용법 요약

- **홈 탭**: 오른쪽 위 `+`로 할일 추가, 색상 10가지 중 선택. 달력 칸을 눌러 완료 체크. 상단 화살표로 월 이동.
  - 상단에 **이번 달 요약 카드 3개**: 전체 평균 달성률 / 이번 달 최고 연속 기록 / 가장 꾸준한 습관.
  - 각 습관 카드의 **자물쇠 아이콘**을 누르면 "친구에게 공개"로 바뀌어요 (잠긴 자물쇠 = 비공개, 열린 자물쇠 = 친구에게 공개). 기본은 항상 비공개예요.
  - 습관을 추가한 달 이전에는 표시되지 않아요 (예: 7월에 추가하면 6월 화면엔 안 나와요).
  - 달력 칸을 누르면 **빈칸 → 완료 → 쉬어가기 → 빈칸** 순서로 순환해요. "쉬어가기"(💤)는 아파서 못 했거나 여행 등으로 예외적으로 못 한 날을 표시하는 용도예요. 달성률 계산에서 완전히 빠지고(성공도 실패도 아님), 연속 기록도 끊기지 않아요. **습관 하나당 한 달에 5번까지만** 쓸 수 있어요.
  - 2일 이상 연속으로 완료하면 🔥 며칠 연속인지 표시돼요.
- **메모 탭**: 각 습관을 눌러 마크다운 메모 작성 (자동 저장). 운동 루틴, 학습 자료 등 정리하기 좋아요. **메모는 공개 설정과 무관하게 항상 나만 볼 수 있어요.**
- **친구 탭**:
  - 상단에 내 고유 코드(예: `7K3M9`)가 있어요. 이 코드를 친구에게 알려주세요.
  - 친구의 코드를 입력하고 "추가"를 누르면 친구 요청이 가요. 상대가 "받은 요청"에서 수락하면 친구가 돼요.
  - **친구 목록**에서 이름을 누르면 그 친구의 공개 습관을 간소화된 형태(막대바)로 볼 수 있어요. 친구가 이번 달 2일 이상 연속 기록 중이면 목록에 🔥 표시가 떠요.
  - 친구 상세 화면 맨 아래에 **메시지 창**이 있어서 짧은 응원 메시지를 주고받을 수 있어요.
  - 각 친구 습관 아래 👏🔥🎉 버튼으로 **가볍게 응원 반응**을 남길 수 있어요 (한 달에 습관 하나당 하나씩). 반응을 받으면 습관을 만든 사람 화면에도 표시돼요.
  - 친구 상세 화면에서 **"🤝 챌린지 만들기"**로 같은 목표를 친구에게 제안할 수 있어요. 상대가 수락하면, 서로의 홈 화면에 그 습관이 생기고 "이번 달 같이 한 날" 겹친 횟수가 표시돼요.
- **설정 탭**:
  - **이름수정**: 습관 이름이 마음에 안 들면 언제든 바꿀 수 있어요.
  - **순서 변경**: 각 할일 왼쪽의 위/아래 화살표로 순서를 바꿀 수 있어요. 홈 화면에도 그 순서 그대로 반영돼요.
  - **보관**: 이 습관을 이번 달까지만 하고 그만두고 싶을 때 눌러요. 보관한 달까지의 기록(체크, 달성률)은 그대로 남고, 다음 달부터는 홈 화면에 안 보여요. 나중에 "복원"하면 다시 이어서 쓸 수 있어요.
  - **삭제**: 기록과 메모까지 영구히 지워요. 되돌릴 수 없으니 정말 필요 없는 습관에만 쓰세요.
  - 로그아웃.

친구의 습관 목록에서, 그 습관이 챌린지로 진행 중이면 🤝 표시가 뜨지만 **누구와 함께하는지는 표시되지 않아요**.

## 이번 업데이트에 추가된 기능

- **친구 끊기**: 친구 상세 화면 맨 아래 "친구 끊기" 버튼. 서로의 습관이 안 보이게 되고 메시지도 삭제돼요. 챌린지 습관과 기록은 각자에게 남아요.
- **챌린지 거절/종료 알림**: 상대가 초대를 거절하거나 챌린지를 그만두면, 내 습관 카드에 그 사실이 표시되고 "일반 습관으로 계속하기" 버튼으로 전환할 수 있어요.
- **챌린지 그만하기**: 진행 중인 챌린지 카드에서 "챌린지 그만하기"를 누르면 함께 보기만 종료돼요 (습관·기록은 유지, 상대에게도 종료 안내 표시).
- **새 메시지 표시**: 안 읽은 메시지가 있으면 하단 친구 탭에 빨간 점, 친구 목록에 숫자 뱃지가 떠요.
- **읽음 표시**: 내가 보낸 메시지를 상대가 읽으면 마지막 읽은 메시지 아래 "읽음"이 표시돼요.
- **장기 휴식(🌙)**: 설정에서 습관별 "휴식" 버튼. 아프거나 여행 등으로 오래 쉴 때 사용해요. 휴식 기간의 날들은 성공/실패 계산에서 완전히 빠지고 연속 기록도 안 끊겨요. "휴식끝"을 누르면 그날부터 다시 시작돼요. (쉬어가기 💤와 달리 횟수 제한이 없고, 기간 단위로 동작해요)
- **완주 축하**: 이번 달을 100%로 채우면 색종이 효과와 함께 🏆 완주 배너가 떠요. 친구 화면에서도 완주한 습관에 "🎉 축하하기" 버튼이 나타나 한 번에 축하를 보낼 수 있어요.
- **📅 연간 보기**: 홈 화면 오른쪽 위 "연간" 버튼을 누르면, 습관별로 1년 전체가 히트맵(잔디밭)으로 보여요. 완료한 날은 색으로, 쉬어가기/휴식은 다르게 표시되고, 보관한 습관의 기록도 함께 나와요. 연도 이동도 가능해요.

## 이미 배포한 앱에 이번 업데이트 반영하기

1. **Supabase SQL Editor**에서 아래 SQL 실행:

```sql
-- 메시지 읽음 처리
alter table friend_messages add column if not exists read_at timestamptz;

create policy "friend_messages: participants can update" on friend_messages
  for update using (
    exists (
      select 1 from friendships f
      where f.id = friend_messages.friendship_id
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  ) with check (
    exists (
      select 1 from friendships f
      where f.id = friend_messages.friendship_id
        and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
    )
  );

-- 챌린지 종료 상태 허용
alter table challenges drop constraint if exists challenges_status_check;
alter table challenges add constraint challenges_status_check
  check (status in ('pending', 'accepted', 'declined', 'ended'));

-- 장기 휴식
create table if not exists habit_pauses (
  id uuid primary key default uuid_generate_v4(),
  habit_id uuid references habits(id) on delete cascade not null,
  start_date date not null,
  end_date date,
  created_at timestamptz default now()
);

alter table habit_pauses enable row level security;

create policy "habit_pauses: owner full access" on habit_pauses
  for all using (
    exists (select 1 from habits where habits.id = habit_pauses.habit_id and habits.user_id = auth.uid())
  ) with check (
    exists (select 1 from habits where habits.id = habit_pauses.habit_id and habits.user_id = auth.uid())
  );

create policy "habit_pauses: friends can view shared" on habit_pauses
  for select using (
    exists (
      select 1 from habits h
      where h.id = habit_pauses.habit_id
        and h.visibility = 'friends'
        and is_friend(auth.uid(), h.user_id)
    )
  );
```

2. 이번엔 **`package.json`도 바뀌었어요** (색종이 효과 라이브러리 추가). GitHub에서:
   - 기존 `src` 폴더 통째로 삭제 → 이 zip의 `src` 폴더 새로 업로드
   - 루트의 `package.json` 파일도 이 zip의 것으로 교체 (파일 열어서 연필 아이콘 → 전체 삭제 → 새 내용 붙여넣기, 또는 Upload files로 덮어쓰기)
3. Commit 하면 Vercel이 자동으로 재배포해요.



## 친구 공개 기능 설계 메모 (나중에 참고용)

- 습관 하나하나 "누구에게 공개할지" 고르는 대신, **친구 관계를 한 번 맺으면 그 친구에게는 "친구공개"로 설정한 모든 습관이 보이는 방식**이에요. 매번 대상 고르는 번거로움 없이 쓸 수 있게 한 선택이에요.
- 친구 코드는 랜덤 5자리(예: `7K3M9`)라 유추가 어렵고, 코드를 안다고 바로 아무나 볼 수 있는 게 아니라 상대가 **수락해야만** 성립돼요.
- 메모는 습관 공개 여부와 무관하게 항상 본인만 볼 수 있도록 설계했어요. 나중에 메모도 공유하고 싶어지면 말씀해주세요, `habit_notes` 테이블에 정책 하나만 추가하면 돼요.
- 새 계정을 Supabase에서 추가해도 코드는 자동으로 생기고(DB 트리거), 코드를 다시 손댈 필요 없어요.

## 자주 하는 실수 (미리 알아두면 편해요)

- **환경변수 Key/Value를 헷갈리기 쉬워요.** Vercel이든 어디든 환경변수 입력할 때, **Key 칸엔 `VITE_SUPABASE_URL` 같은 "이름"만**, **Value 칸엔 실제 주소/키 값만** 들어가야 해요. 서로 바뀌어 들어가면 빌드가 "invalid" 에러를 내요.
- **Vercel Settings → Deployment Protection에서 "Vercel Authentication(Require Log In)"은 꼭 꺼주세요.** 안 끄면 방문자가 Vercel 계정으로 로그인해야만 사이트가 열려요 (우리 앱은 자체 로그인이 있으니 이건 필요 없어요).
- **GitHub에 파일 올릴 때 폴더를 한꺼번에 여러 개 드래그하면 구조가 깨질 때가 있어요.** `src`, `supabase` 등 폴더는 하나씩 나눠서 업로드하는 게 안전해요. 다 올리고 나서 `package.json` 파일이 저장소 루트에 실제로 보이는지 꼭 확인하세요 (이게 없으면 `vite: command not found` 에러가 나요).
- **Supabase에서 새 계정 만들 때 "Auto Confirm User" 체크 꼭 하기.** 안 하면 이메일 인증 절차가 필요해져서 로그인이 안 돼요.
- 계정 생성 시 "Database error creating new user" 에러가 나면, `supabase/schema.sql`을 이미 최신 버전(이 zip에 포함된 버전)으로 실행했는지 확인하세요. 오래된 버전엔 이 오류를 일으키는 버그가 있었어요.

## 나중에 더 추가하고 싶다면



- 메모에 이미지/PDF 첨부 (Supabase Storage 사용)
- 습관별 순서 변경(드래그)
- 주간/연간 통계 그래프
- 알림/리마인더

필요하면 언제든 말씀해주세요, 이 코드 기반으로 이어서 만들어드릴게요.
