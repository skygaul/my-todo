# My Todo

로그인하고 내 할 일을 관리하는 Todo 앱. Express 백엔드 + Supabase(Postgres, Auth).
화면은 백엔드 API(`/api/...`)에만 요청하고, DB 접근은 백엔드 코드에만 있습니다.

> 로컬 SQLite 버전(길 A)은 Git 태그 `local-sqlite`로 남아 있습니다: `git checkout local-sqlite`

배포 주소: https://my-todo-tehj.onrender.com (Render 무료 서비스: 한동안 접속이 없으면 첫 로딩이 50초 이상 걸릴 수 있음. 설정은 [render.yaml](render.yaml), 준비물은 [docs/DEPLOY_NOTES.md](docs/DEPLOY_NOTES.md))

## 실행

1. Supabase 프로젝트를 만들고 `supabase/schema.sql`을 SQL Editor에서 실행합니다.
2. `.env.example`을 `.env`로 복사하고 값을 채웁니다. (`.env`는 Git에 올라가지 않습니다)
3. 실행합니다. (Node 20 이상)

```bash
npm install
npm start
```

브라우저에서 http://localhost:3000 을 열고 가입 후 로그인합니다.

## 설정 (.env)

| 키 | 설명 |
|---|---|
| `PORT` | 서버 포트 (기본 3000) |
| `HOST` | 기본 `127.0.0.1`(내 PC만). 클라우드에서는 `0.0.0.0` |
| `SUPABASE_URL` | 프로젝트 URL (`https://<ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | **공개용**(publishable/anon) 키 |

`secret` / `service_role` 키는 RLS를 우회하므로 쓰지 않습니다. 그런 키가 들어 있으면 서버가 시작을 거부합니다.

## 구조

- `server/` 백엔드. DB 접근(`supabase.js`, `routes/`)은 여기에만 있습니다.
  - 로그인한 사용자의 토큰으로 DB를 호출하므로 RLS가 적용됩니다.
  - 토큰은 `httpOnly` 쿠키에 담겨 화면의 JS가 읽을 수 없습니다.
- `public/` 화면. Supabase 주소나 키가 없고 `/api`만 호출합니다.
- `supabase/schema.sql` 표, RLS 정책, 권한.
- `scripts/verify-rls.js` 두 계정으로 RLS를 확인하는 스크립트.
- `docs/` 배포 준비물 노트, 회고 초안.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout` | 가입, 로그인, 로그아웃 |
| GET | `/api/auth/me` | 로그인 상태 |
| GET | `/api/todos?today=1&category_id=N` | 목록 (`none` = 미분류) |
| POST / PATCH / DELETE | `/api/todos[/:id]` | 추가 / 수정·완료 / 삭제 |
| GET / POST / DELETE | `/api/categories[/:id]` | 카테고리 |

`/api/todos`, `/api/categories`는 로그인하지 않으면 401입니다.

## 데이터와 접근 제한

- `categories(id, user_id, name, color, created_at)`
- `todos(id, user_id, title, is_done, due_date, category_id, created_at, completed_at)`
- `user_id`는 DB가 `auth.uid()`로 채웁니다. 요청에서 받지 않습니다.
- RLS 정책: 로그인한 사용자는 `user_id`가 자기 것인 행만 조회·추가·수정·삭제할 수 있습니다. 로그인하지 않은 방문자는 권한이 없습니다.
- 다른 사람의 카테고리에는 연결할 수 없습니다. (복합 외래키)

## RLS 확인

두 계정(A, B)을 가입한 뒤 실행합니다. 비밀번호는 이 PowerShell 창에만 있고 파일에 저장되지 않습니다.

```powershell
function Ask-Secret($p) { $s = Read-Host $p -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
$env:RLS_A_EMAIL = Read-Host "A email"
$env:RLS_A_PASSWORD = Ask-Secret "A password"
$env:RLS_B_EMAIL = Read-Host "B email"
$env:RLS_B_PASSWORD = Ask-Secret "B password"
node scripts/verify-rls.js
Remove-Item Env:RLS_A_EMAIL, Env:RLS_A_PASSWORD, Env:RLS_B_EMAIL, Env:RLS_B_PASSWORD
```

B가 A의 데이터를 조회·수정·삭제할 수 없고, 소유자를 속인 추가가 거절되는지 13개 항목을 확인합니다.
