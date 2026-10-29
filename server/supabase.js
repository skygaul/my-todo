const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

function jwtRole(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role ?? null;
  } catch {
    return null;
  }
}

if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)) {
  throw new Error('SUPABASE_URL이 비어 있거나 https://<프로젝트>.supabase.co 형식이 아닙니다. .env를 확인하세요.');
}
if (!key) {
  throw new Error('SUPABASE_ANON_KEY가 비어 있습니다. .env를 확인하세요.');
}
if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
  throw new Error(
    'SUPABASE_ANON_KEY에 secret/service_role 키가 들어 있습니다. 이 키는 RLS를 우회하므로 사용할 수 없습니다. ' +
    '공개용(anon/publishable) 키로 바꾸세요.'
  );
}

const plain = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// Client for sign-up / sign-in / token refresh (no user attached).
function authClient() {
  return createClient(url, key, { auth: plain });
}

// Client that talks to the database AS the logged-in user, so RLS applies.
function userClient(accessToken) {
  return createClient(url, key, {
    auth: plain,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

module.exports = { authClient, userClient };
