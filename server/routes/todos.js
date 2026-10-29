const express = require('express');
const db = require('../db');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && formatLocal(d) === s;
}

function formatLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SELECT = `
  SELECT t.id, t.title, t.is_done, t.due_date, t.category_id,
         c.name AS category_name, c.color AS category_color,
         t.created_at, t.completed_at
  FROM todos t
  LEFT JOIN categories c ON c.id = t.category_id
`;

function getOne(id) {
  return db.prepare(`${SELECT} WHERE t.id = ?`).get(id);
}

function categoryExists(id) {
  return !!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id);
}

router.get('/', (req, res) => {
  const where = [];
  const params = [];

  if (req.query.today === '1') {
    where.push("t.due_date = date('now', 'localtime') AND t.is_done = 0");
  }
  if (req.query.category_id !== undefined && req.query.category_id !== '') {
    if (req.query.category_id === 'none') {
      where.push('t.category_id IS NULL');
    } else {
      const cid = Number(req.query.category_id);
      if (!Number.isInteger(cid)) return res.status(400).json({ error: 'category_id가 올바르지 않습니다.' });
      where.push('t.category_id = ?');
      params.push(cid);
    }
  }

  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.is_done ASC, (t.due_date IS NULL) ASC, t.due_date ASC, t.id DESC`;
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: '제목이 필요합니다.' });
  if (title.length > 200) return res.status(400).json({ error: '제목은 200자 이하여야 합니다.' });

  let due = req.body.due_date || null;
  if (due !== null && !validDate(due)) return res.status(400).json({ error: '마감일 형식은 YYYY-MM-DD 입니다.' });

  let cid = req.body.category_id ?? null;
  if (cid === '') cid = null;
  if (cid !== null) {
    cid = Number(cid);
    if (!Number.isInteger(cid) || !categoryExists(cid)) {
      return res.status(400).json({ error: '존재하지 않는 카테고리입니다.' });
    }
  }

  const info = db.prepare('INSERT INTO todos (title, due_date, category_id) VALUES (?, ?, ?)').run(title, due, cid);
  res.status(201).json(getOne(Number(info.lastInsertRowid)));
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = getOne(id);
  if (!current) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });

  const sets = [];
  const params = [];
  const b = req.body;

  if (b.title !== undefined) {
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    if (!title || title.length > 200) return res.status(400).json({ error: '제목이 올바르지 않습니다.' });
    sets.push('title = ?'); params.push(title);
  }
  if (b.is_done !== undefined) {
    const done = b.is_done === true || b.is_done === 1 ? 1 : b.is_done === false || b.is_done === 0 ? 0 : null;
    if (done === null) return res.status(400).json({ error: 'is_done은 true/false 여야 합니다.' });
    sets.push('is_done = ?'); params.push(done);
    sets.push(done ? "completed_at = datetime('now', 'localtime')" : 'completed_at = NULL');
  }
  if (b.due_date !== undefined) {
    const due = b.due_date || null;
    if (due !== null && !validDate(due)) return res.status(400).json({ error: '마감일 형식은 YYYY-MM-DD 입니다.' });
    sets.push('due_date = ?'); params.push(due);
  }
  if (b.category_id !== undefined) {
    let cid = b.category_id === '' ? null : b.category_id;
    if (cid !== null) {
      cid = Number(cid);
      if (!Number.isInteger(cid) || !categoryExists(cid)) {
        return res.status(400).json({ error: '존재하지 않는 카테고리입니다.' });
      }
    }
    sets.push('category_id = ?'); params.push(cid);
  }

  if (!sets.length) return res.status(400).json({ error: '변경할 값이 없습니다.' });

  db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  res.json(getOne(id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM todos WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.status(204).end();
});

module.exports = router;
