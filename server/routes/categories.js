const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT id, name, color FROM categories ORDER BY name').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const color = typeof req.body.color === 'string' && req.body.color.trim() ? req.body.color.trim() : null;
  if (!name) return res.status(400).json({ error: '카테고리 이름이 필요합니다.' });
  if (name.length > 30) return res.status(400).json({ error: '카테고리 이름은 30자 이하여야 합니다.' });

  try {
    const info = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name, color);
    res.status(201).json({ id: Number(info.lastInsertRowid), name, color });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: '이미 있는 카테고리입니다.' });
    }
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
  res.status(204).end();
});

module.exports = router;
