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
- 로컬 무료 DB인 SQLite 파일 하나(`todo.db`)에 저장한다.
- 서버를 껐다 켜거나 새로고침해도 데이터가 남는다.

## [내가 넣고 싶은 기능]
1. **마감일 표시**: 마감일은 선택 입력이다. 기한이 지난 미완료 항목은 빨간색으로 표시한다.
2. **카테고리**: 할 일 하나에 카테고리 하나(선택)를 붙인다. 카테고리 추가/삭제가 가능하고, 사이드바에서 카테고리별로 걸러 본다. 카테고리를 삭제하면 그 할 일은 "미분류"로 남는다.
3. **오늘 할 일만 보기**: 마감일이 오늘이고 아직 끝나지 않은 항목만 보여 주는 토글.

## [규칙]
- 무료 도구만 쓴다: Node.js, Express, SQLite(`node:sqlite`), dotenv.
- 비밀값과 설정은 `.env`에 둔다. `.env`와 `todo.db`는 `.gitignore`에 넣는다.
- DB 접근 코드는 백엔드(`server/`)에만 둔다. 화면(`public/`)은 백엔드 API(`/api/...`)에만 요청한다.
- 로그인은 직접 만들지 않는다. 필요해지면 검증된 인증 서비스(Supabase Auth)를 쓴다.
- SQL은 파라미터 바인딩으로만 실행한다.

## 데이터 모델 (SQLite)
| 표 | 열 |
|---|---|
| `categories` | `id` PK, `name` 필수·중복 불가, `color`, `created_at` |
| `todos` | `id` PK, `title` 필수, `is_done` 0/1, `due_date` (YYYY-MM-DD), `category_id` FK→categories (`ON DELETE SET NULL`), `created_at`, `completed_at` |

관계: 카테고리 1 : 할 일 N. `due_date`와 `category_id`에 인덱스를 둔다.

## API
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/todos?today=1&category_id=N` | 목록 (`none` = 미분류) |
| POST | `/api/todos` | 추가 |
| PATCH | `/api/todos/:id` | 수정, 완료 표시 |
| DELETE | `/api/todos/:id` | 삭제 |
| GET/POST | `/api/categories` | 카테고리 목록/추가 |
| DELETE | `/api/categories/:id` | 카테고리 삭제 |

## 완료 기준
- [ ] 할 일을 추가하면 목록에 뜨고, 새로고침·서버 재시작 후에도 남는다.
- [ ] 완료 표시와 삭제가 동작한다.
- [ ] 마감일이 지난 미완료 항목이 빨간색으로 보인다.
- [ ] 카테고리 필터와 "오늘 할 일만 보기"가 동작한다.
- [ ] 카테고리를 지워도 할 일은 남고 "미분류"가 된다.
- [ ] `public/`에 DB 접근 코드가 없다.
- [ ] `.env`, `todo.db`가 Git에 올라가지 않는다.

## 이번 범위가 아닌 것 (Non-goals)
검색, 알림, 반복 일정, 한 할 일에 태그 여러 개(다대다), 로그인(길 A 단계).

## 다음 단계 (길 B)
- 저장소를 SQLite에서 Supabase(Postgres)로 전환한다.
- Supabase Auth로 로그인하고, `todos`에 소유 사용자(`user_id`)를 기록한다.
- RLS 정책으로 로그인한 사용자가 자기 할 일만 조회·추가·수정·삭제하게 한다.
- 접속 키는 `.env`에만 두고 백엔드에서만 사용한다.
- 백엔드를 Render 같은 클라우드에 올릴 때 필요한 준비물을 정리한다. (실제 배포는 선택)
