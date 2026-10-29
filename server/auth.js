const { authClient, userClient } = require('./supabase');

const ACCESS = 'sb_access';
const REFRESH = 'sb_refresh';

function cookieOptions(maxAgeSec) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSec * 1000,
  };
}

function setSession(res, session) {
  res.cookie(ACCESS, session.access_token, cookieOptions(session.expires_in || 3600));
  res.cookie(REFRESH, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
}

function clearSession(res) {
  res.clearCookie(ACCESS, { path: '/' });
  res.clearCookie(REFRESH, { path: '/' });
}

// Verifies the access token with Supabase; falls back to the refresh token.
async function resolveSession(req, res) {
  const access = req.cookies[ACCESS];
  const refresh = req.cookies[REFRESH];

  if (access) {
    const { data, error } = await authClient().auth.getUser(access);
    if (!error && data.user) return { user: data.user, accessToken: access };
  }
  if (refresh) {
    const { data, error } = await authClient().auth.refreshSession({ refresh_token: refresh });
    if (!error && data.session && data.user) {
      setSession(res, data.session);
      return { user: data.user, accessToken: data.session.access_token };
    }
  }
  return null;
}

async function requireUser(req, res, next) {
  const session = await resolveSession(req, res);
  if (!session) {
    clearSession(res);
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  req.user = session.user;
  req.db = userClient(session.accessToken);
  next();
}

module.exports = { requireUser, resolveSession, setSession, clearSession };
