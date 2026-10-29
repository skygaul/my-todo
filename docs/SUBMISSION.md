# 과제 제출 안내 — 내 Todo 앱과 PRD

길 A(로컬 SQLite)를 완료한 뒤 길 B(Supabase)로 전환한 Todo 앱입니다.

## 평가 기준별로 어디에 있나

| 기준 | 위치 |
|---|---|
| PRD 한 장 | [PRD.md](../PRD.md) — 기능, 조건, 데이터 모델, 완료 기준, 확인 기록 |
| 데이터가 남는 Todo 앱 | 이 저장소의 코드 + 아래 "시연 자료" |
| 로컬·클라우드 저장과 보안 확인 | PRD의 "확인 기록", 아래 "확인 기록 요약", 시연 자료 |

## 확인 기록 요약

- **클라우드 전환:** 저장소를 SQLite에서 Supabase(Postgres)로 바꾸고, Supabase Auth 로그인과 `user_id`별 RLS를 적용했습니다. (2026-10-29)
- **RLS 확인:** 두 계정(A, B)으로 [`scripts/verify-rls.js`](../scripts/verify-rls.js)를 실행해 13개 항목이 모두 통과했습니다. B는 A의 할 일·카테고리를 조회할 수 없고, 수정·삭제는 0건이며, 소유자를 속이거나 A의 카테고리에 연결한 추가는 거절되고, 로그인 없이는 조회가 거절됩니다. (2026-10-29)
- **로컬(SQLite) 저장:** 할 일을 추가하고 새로고침·서버 재시작 후에도 남는 것을 확인했습니다. 완료·삭제도 동작합니다. (2026-10-29)
- **Supabase 저장:** 같은 확인을 했고, Table Editor의 `todos`에 `user_id`와 함께 행이 저장된 것을 확인했습니다. (2026-10-29)

## 시연 자료

> 아래 칸을 채워 주세요. 영상이나 캡처에는 이메일 주소, `user_id`, `.env` 내용, 비밀번호가 보이지 않게 합니다.

- 3분 시연 영상: [ ] (링크를 여기에 적기. Drive라면 "링크가 있는 사용자 보기"로 공유)
- 로컬(SQLite) 장면: [ ] 추가 → 새로고침 → 서버 재시작 후 유지 → 완료·삭제 → DB 뷰어에서 `todos` 표
- Supabase 장면: [ ] 추가 → 새로고침 → 서버 재시작 후 유지 → 완료·삭제 → Table Editor의 `todos`
- RLS 장면: [ ] 두 계정 분리, `verify-rls` 13개 `PASS`

## 실행 방법

### Supabase 버전 (현재 `main`)
[README.md](../README.md)를 따릅니다. Supabase 프로젝트, `supabase/schema.sql` 실행, `.env`(`SUPABASE_URL`, `SUPABASE_ANON_KEY`)가 필요합니다.

```bash
npm install
npm start
```
http://localhost:3000

### 로컬 SQLite 버전 (Git 태그 `local-sqlite`)
별도 폴더로 꺼내 실행하면 현재 코드와 섞이지 않습니다.

```bash
git worktree add local-demo local-sqlite
cd local-demo
npm install
```
`local-demo`에서 `.env.example`을 `.env`로 복사하고(`PORT`를 `3001`로 바꾸면 Supabase 버전과 동시에 실행할 수 있음) 실행합니다.

```bash
npm start
```
데이터는 `local-demo/todo.db` 한 파일에 저장됩니다. 되돌리려면 `git worktree remove local-demo`.

## 함께 보면 좋은 문서
- [docs/DEPLOY_NOTES.md](DEPLOY_NOTES.md) — 클라우드에 올릴 때 필요한 준비물 (이번에는 배포하지 않음)
- [docs/REFLECTION.md](REFLECTION.md) — 오늘의 회고
