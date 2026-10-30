# 깃헙주소를 동료그루들과 공유하여 서로 fork- pull request 해봅시다.

## [준비사항]

- fork 할 샘플 레포지토리를 생성(**README.md 포함**)
- 레포지토리 주소 공유(그루 깃헙 주소 공유 시트 출석부 반영하여 추가)

---

## 코드 리뷰 (2026-10-30)

대상: `server/`, `public/`, `supabase/schema.sql`, `render.yaml` (커밋 `a081032` 기준)

### 잘된 점

- **권한 설계가 탄탄함**: 사용자 토큰 + anon 키로 DB를 호출해 RLS가 항상 적용되고, `service_role` 키가 들어오면 서버가 시작을 거부한다 (`server/supabase.js`).
- **복합 외래키** `(category_id, user_id)`로 남의 카테고리에 연결하는 것을 DB 단에서 막았다. `ON DELETE SET NULL (category_id)`로 "미분류" 요구사항도 깔끔하게 처리.
- 토큰을 `httpOnly` + `SameSite=Lax` 쿠키에 보관하고, 화면은 Supabase 주소·키를 모른다.
- PATCH에서 바꿀 수 있는 필드를 화이트리스트로 제한하고 `user_id`는 요청에서 받지 않는다.
- 화면 렌더링이 전부 `textContent` / `new Option()`이라 XSS 걱정이 없다.
- `scripts/verify-rls.js`로 RLS를 13개 항목으로 자동 검증하는 점이 좋다.

### 발견 사항

| # | 심각도 | 위치 | 내용 |
|---|---|---|---|
| 1 | 높음 | `server/routes/*.js` 전체 | JSON이 아닌 요청이 오면 500 에러 |
| 2 | 중간 | `server/routes/todos.js` L43 | 배포 서버(UTC)에서 "오늘 할 일" 날짜가 하루 어긋남 |
| 3 | 중간 | `server/auth.js` L27-49 | Supabase 일시 장애 때 사용자가 강제 로그아웃됨 |
| 4 | 낮음 | `server/routes/auth.js` L46 | 로그아웃해도 refresh token이 살아 있음 |
| 5 | 낮음 | `public/app.js` L127 | 구형 브라우저에서 필터가 조용히 무시됨 |
| 6 | 낮음 | `server/auth.js`, `server/routes/todos.js` | 요청마다 Supabase 왕복이 2~3번 |
| 7 | 참고 | `server/routes/*.js` | 기타 작은 개선점 |

#### 1. [높음] JSON이 아닌 요청이 오면 500 에러

Express 5부터는 body를 파싱하지 않으면 `req.body`가 `{}`가 아니라 `undefined`다. 그래서 `Content-Type: application/json`이 없는 요청이 오면 `readCredentials(req.body)`의 `body.email`, `req.body.title`, `b.title` 등에서 `TypeError`가 나 500이 된다.

직접 확인한 결과:

```
POST /api/auth/login  (Content-Type: text/plain)  → 500 {"error":"서버 오류가 발생했습니다."}
POST /api/auth/signup (body 없음)                  → 500
서버 로그: TypeError: Cannot read properties of undefined (reading 'email')
```

정상 화면에서는 문제가 없지만, 잘못된 입력은 400이어야 하고 500은 로그·모니터링을 오염시킨다.

**제안**: `server/index.js`에서 `express.json()` 바로 뒤에 한 줄 추가.

```js
app.use((req, res, next) => { req.body ??= {}; next(); });
```

#### 2. [중간] 배포 서버(UTC)에서 "오늘 할 일" 날짜가 하루 어긋남

`?today=1`의 "오늘"을 서버 시계(`formatLocal(new Date())`)로 계산한다. Render 서버는 UTC이므로 한국 시간 00:00~09:00 사이에는 서버가 **어제** 날짜로 거른다. 반면 마감 지남(빨간색) 판단은 브라우저 날짜(`todayStr()`)를 써서 두 기준이 서로 다르다.

```
2026-10-30 08:00 KST 기준 서버의 "오늘"
TZ=UTC        → 2026-10-29   (틀림)
TZ=Asia/Seoul → 2026-10-30
```

**제안**: 화면이 자기 날짜를 보내게 한다 (`?today=2026-10-30`, 서버는 `validDate`로 검증). 빠른 임시 조치로는 `render.yaml`에 `TZ=Asia/Seoul`을 추가해도 된다(단, 한국 사용자만 맞음).

#### 3. [중간] Supabase 일시 장애 때 사용자가 강제 로그아웃됨

`resolveSession()`은 `getUser()` / `refreshSession()`의 **모든** 오류를 "로그인 안 됨"으로 취급하고, `requireUser()`는 그때 쿠키를 지운다. 그래서 네트워크 끊김이나 Supabase 5xx 같은 일시 오류에도 유효한 refresh token까지 삭제되어 다시 로그인해야 한다.

```
Supabase에 연결할 수 없는 상태에서 GET /api/todos (쿠키 있음)
→ 401 + Set-Cookie: sb_access=; sb_refresh=; (둘 다 삭제)
```

**제안**: 재시도 가능한 오류는 구분해서 쿠키를 지우지 말고 503을 돌려준다.

```js
const { isAuthRetryableFetchError } = require('@supabase/supabase-js');
// getUser / refreshSession 결과에서
if (error && (isAuthRetryableFetchError(error) || (error.status ?? 500) >= 500)) {
  throw error; // 에러 핸들러가 5xx로 응답, 쿠키는 유지
}
```

#### 4. [낮음] 로그아웃해도 refresh token이 살아 있음

`/logout`은 브라우저 쿠키만 지우고 Supabase 세션은 그대로 둔다. refresh token이 유출되었다면 로그아웃 뒤에도 최대 30일 동안 새 토큰을 발급받을 수 있다. 로그아웃 때 Supabase의 `signOut`(세션 폐기)도 함께 호출하는 것을 권장한다.

#### 5. [낮음] 구형 브라우저에서 필터가 조용히 무시됨

```js
const todos = await api(`/todos${q.size ? '?' + q : ''}`);
```

`URLSearchParams.size`는 비교적 최근 기능이다(Safari 17, Chrome 113 이상). 지원하지 않는 브라우저(iOS 16 등)에서는 `undefined`라서 쿼리스트링이 아예 붙지 않는다. 이 경우 "오늘 할 일"과 카테고리 필터가 오류 없이 동작하지 않는다.

**제안**:

```js
const qs = q.toString();
const todos = await api(`/todos${qs ? '?' + qs : ''}`);
```

#### 6. [낮음] 요청마다 Supabase 왕복이 2~3번

- `requireUser`가 모든 API 요청에서 `auth.getUser()`로 Supabase Auth를 호출한다.
- `withCategories()`가 목록 조회·추가·수정 때마다 카테고리 전체를 한 번 더 읽는다.

Render 무료 플랜 + 해외 Supabase 리전에서는 체감 지연이 커질 수 있다. 카테고리는 PostgREST 임베드로 한 번에 가져올 수 있다: `select('..., categories(name, color)')`. 토큰 검증은 JWT 서명 키(비대칭 키 사용 시 `auth.getClaims()`)로 로컬 검증하는 방법을 검토할 만하다.

#### 7. [참고] 기타 작은 개선점

- **가입 오류 메시지**: `error.message`를 그대로 내려준다. 이메일 확인이 꺼져 있으면 "User already registered"로 가입 여부가 노출되므로, 로그인처럼 일반화된 문구를 쓰는 것을 권장한다.
- **요청 수 제한 없음**: 로그인·가입에 앱 자체 rate limit이 없다. 모든 인증 요청이 서버 IP 하나로 Supabase에 가므로, Supabase Auth의 IP 기준 제한을 전체 사용자가 함께 쓰게 된다. `express-rate-limit` 등으로 `/api/auth`를 보호하는 것을 고려.
- **`color` 검증 없음**: 카테고리 `color`는 길이나 형식 검증 없이 저장된다(현재 화면에서는 쓰지 않음). `#RRGGBB` 형식 검증이나 DB `check` 제약 추가 권장.
- **목록 응답 순서 경합**: 필터를 빠르게 바꾸면 늦게 도착한 이전 응답이 최신 목록을 덮어쓸 수 있다(`AbortController`로 이전 요청 취소).
- **보안 헤더**: `helmet` 등으로 CSP, `X-Content-Type-Options` 같은 기본 보안 헤더를 추가하면 좋다.

### 총평

RLS·복합 외래키·httpOnly 쿠키 등 **데이터 분리와 보안의 핵심 설계는 잘 되어 있다.** 1번(500 에러)은 한 줄로 고칠 수 있으니 바로 반영을 권장하고, 2번(시간대)과 3번(강제 로그아웃)은 실제 배포 환경에서 사용자가 겪을 수 있는 문제라 다음 작업으로 우선 처리하면 좋겠다.
