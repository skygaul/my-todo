# My Todo

내 컴퓨터에서만 도는 Todo 앱. Express + SQLite(`todo.db` 파일 하나).

## 실행

```bash
npm install
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
npm start
```

브라우저에서 http://localhost:3000 을 엽니다. (Node 22.5 이상 필요: 내장 `node:sqlite` 사용)

## 설정 (.env)

| 키 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3000` | 서버 포트 |
| `DB_PATH` | `./todo.db` | SQLite 파일 경로 |

`.env`와 `todo.db`는 git에 올라가지 않습니다.

## 구조

- `server/` : 백엔드. DB 접근 코드는 여기에만 있습니다 (`db.js`).
- `public/` : 화면. `fetch('/api/...')`로 백엔드 API에만 요청합니다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/todos?today=1&category_id=N` | 목록 (`today=1`: 오늘 마감 + 미완료, `category_id=none`: 미분류) |
| POST | `/api/todos` | 추가 `{title, due_date?, category_id?}` |
| PATCH | `/api/todos/:id` | 수정 `{title?, is_done?, due_date?, category_id?}` |
| DELETE | `/api/todos/:id` | 삭제 |
| GET/POST | `/api/categories` | 카테고리 목록 / 추가 `{name, color?}` |
| DELETE | `/api/categories/:id` | 카테고리 삭제 (할 일은 "미분류"로 남음) |

## DB 구조

- `categories(id, name UNIQUE, color, created_at)`
- `todos(id, title, is_done 0/1, due_date YYYY-MM-DD, category_id → categories ON DELETE SET NULL, created_at, completed_at)`
