const express = require('express');
const { authClient } = require('../supabase');
const { resolveSession, setSession, clearSession } = require('../auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body) {
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email)) return { error: '이메일 형식이 올바르지 않습니다.' };
  if (password.length < 8) return { error: '비밀번호는 8자 이상이어야 합니다.' };
  if (password.length > 72) return { error: '비밀번호는 72자 이하여야 합니다.' };
  return { email, password };
}

router.post('/signup', async (req, res) => {
  const c = readCredentials(req.body);
  if (c.error) return res.status(400).json({ error: c.error });

  const { data, error } = await authClient().auth.signUp({ email: c.email, password: c.password });
  if (error) {
    const status = error.status && error.status < 500 ? error.status : 400;
    return res.status(status).json({ error: error.message });
  }
  if (!data.session) {
    return res.status(202).json({ needsConfirm: true, message: '확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요.' });
  }
  setSession(res, data.session);
  res.status(201).json({ email: data.user.email });
});

router.post('/login', async (req, res) => {
  const c = readCredentials(req.body);
  if (c.error) return res.status(400).json({ error: c.error });

  const { data, error } = await authClient().auth.signInWithPassword({ email: c.email, password: c.password });
  if (error || !data.session) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }
  setSession(res, data.session);
  res.json({ email: data.user.email });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.status(204).end();
});

router.get('/me', async (req, res) => {
  const session = await resolveSession(req, res);
  if (!session) return res.status(401).json({ error: '로그인이 필요합니다.' });
  res.json({ email: session.user.email });
});

module.exports = router;
