require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

require('./supabase');
const { requireUser } = require('./auth');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// Local default keeps the server private to this PC; a host like Render sets HOST=0.0.0.0.
const HOST = process.env.HOST || '127.0.0.1';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/todos', requireUser, require('./routes/todos'));
app.use('/api/categories', requireUser, require('./routes/categories'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, HOST, () => {
  console.log(`Todo app running at http://localhost:${PORT} (listening on ${HOST})`);
});
