# My Todo — PRD

## [무엇]
내 컴퓨터에서 도는 Todo(할 일) 앱.
브라우저에서 `http://localhost:3000`으로 열고, 데이터는 껐다 켜도 남는다.

## [기본 기능(CRUD)]
- 할 일 추가 (제목 필수, 200자 이하)
- 목록 보기 (미완료 먼저, 마감일 빠른 순, 마감일 없는 항목은 맨 뒤)
- 완료 표시 / 완료 취소 (완료 시각 기록)
- 삭제

## [저장]
- **길 A (완료, Git 태그 `local-sqlite`):** 로컬 무료 DB인 SQLite 파일 하나(`todo.db`)에 저장.
- **길 B (현재):** Supabase(무료 클라우드 Postgres)에 저장. 화면과 백엔드는 계속 내 컴퓨터에서 실행한다.
- 서버를 껐다 켜거나 새로고침해도 데이터가 남는다.

## [내가 넣고 싶은 기능]
1. **마감일 표시**: 마감일은 선택 입력이다. 기한이 지난 미완료 항목은 빨간색으로 표시한다.
2. **카테고리**: 할 일 하나에 카테고리 하나(선택)를 붙인다. 카테고리 추가/삭제가 가능하고, 사이드바에서 카테고리별로 걸러 본다. 카테고리를 삭제하면 그 할 일은 "미분류"로 남는다.
3. **오늘 할 일만 보기**: 마감일이 오늘이고 아직 끝나지 않은 항목만 보여 주는 토글.

## [규칙]
- 무료 도구만 쓴다: Node.js, Express, Supabase 무료 플랜, dotenv.
- 비밀값과 설정은 `.env`에 둔다. `.env`는 `.gitignore`에 넣는다.
- DB 접근 코드는 백엔드(`server/`)에만 둔다. 화면(`public/`)은 백엔드 API(`/api/...`)에만 요청하고 Supabase 주소·키를 모른다.
- 로그인은 직접 만들지 않는다. 검증된 인증 서비스(Supabase Auth)를 쓴다. 비밀번호는 우리 코드나 DB 표에 저장하지 않는다.
- 백엔드는 공개용(anon/publishable) 키와 **로그인한 사용자의 토큰**으로 DB를 호출해 RLS가 적용되게 한다. `service_role`(secret) 키는 쓰지 않는다.
- 입력값은 서버에서 검증하고, DB 호출은 라이브러리의 파라미터 바인딩으로만 한다.

## 데이터 모델 (Supabase / Postgres)
| 표 | 열 |
|---|---|
| `categories` | `id` PK, `user_id` (기본값 `auth.uid()`), `name` 필수(1~30자)·사용자별 중복 불가, `color`, `created_at` |
| `todos` | `id` PK, `user_id` (기본값 `auth.uid()`), `title` 필수(1~200자), `is_done` boolean, `due_date` date, `category_id` FK, `created_at`, `completed_at` |

- 관계: 카테고리 1 : 할 일 N. `(category_id, user_id)` 복합 외래키로 **자기 카테고리에만** 연결할 수 있고, 카테고리를 지우면 `category_id`만 비워진다(`ON DELETE SET NULL (category_id)`).
- **RLS:** 두 표 모두 켜 두고, `authenticated` 역할만 접근한다. 정책은 `user_id = auth.uid()`인 행에 대해서만 조회·추가·수정·삭제를 허용한다. `anon`(로그인 안 한 방문자)은 권한이 없다.
- 전체 정의: `supabase/schema.sql`

## API
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/signup`, `/login`, `/logout` | 가입, 로그인, 로그아웃 (토큰은 `httpOnly` 쿠키) |
| GET | `/api/auth/me` | 로그인 상태 |
| GET | `/api/todos?today=1&category_id=N` | 목록 (`none` = 미분류) |
| POST | `/api/todos` | 추가 |
| PATCH | `/api/todos/:id` | 수정, 완료 표시 |
| DELETE | `/api/todos/:id` | 삭제 |
| GET/POST | `/api/categories` | 카테고리 목록/추가 |
| DELETE | `/api/categories/:id` | 카테고리 삭제 |

`/api/todos`, `/api/categories`는 로그인하지 않으면 401을 돌려준다.

## 완료 기준
- [x] 할 일을 추가하면 목록에 뜨고, 새로고침·서버 재시작 후에도 남는다. (로컬 SQLite와 Supabase 모두 확인, 2026-10-29)
- [x] 완료 표시와 삭제가 동작한다.
- [x] 마감일이 지난 미완료 항목이 빨간색으로 보인다.
- [x] 카테고리 필터와 "오늘 할 일만 보기"가 동작한다.
- [x] 카테고리를 지워도 할 일은 남고 "미분류"가 된다.
- [x] 로그인하지 않으면 할 일 API가 401로 거절된다.
- [x] 다른 계정의 할 일은 보이지 않고, 수정·삭제 요청은 아무 행도 바꾸지 못한다.
- [x] `public/`에 DB 접근 코드와 Supabase 키가 없다.
- [x] `.env`, `todo.db`가 Git에 올라가지 않는다.

## 확인 기록
- **클라우드 전환:** 저장소를 SQLite에서 Supabase(Postgres)로 바꾸고, Supabase Auth 로그인과 `user_id`별 RLS를 적용했다. (2026-10-29)
- **RLS 확인:** 두 계정(A, B)으로 `scripts/verify-rls.js`를 실행해 13개 항목이 모두 통과했다. B는 A의 할 일·카테고리를 조회할 수 없고, 수정·삭제는 0건이며, 소유자를 속이거나 A의 카테고리에 연결한 추가는 거절되고, 로그인 없이는 조회가 거절된다. (2026-10-29)

- **배포(선택 과제):** 백엔드를 Render에 올려 인터넷에서 접속할 수 있다: https://my-todo-tehj.onrender.com — 로그인 후 할 일을 추가하고 새로고침해도 남는 것을 확인했다. 준비물과 설정은 `docs/DEPLOY_NOTES.md`, `render.yaml`. (2026-10-29)

## 이번 범위가 아닌 것 (Non-goals)
검색, 알림, 반복 일정, 한 할 일에 태그 여러 개(다대다), 비밀번호 재설정 화면.
