const express = require('express');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLUMNS = 'id, title, is_done, due_date, category_id, created_at, completed_at';

function formatLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function validDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && formatLocal(d) === s;
}

// The database only stores category_id; attach the name/color for the screen.
async function withCategories(db, rows) {
  const { data, error } = await db.from('categories').select('id, name, color');
  if (error) throw error;
  const byId = new Map(data.map((c) => [c.id, c]));
  return rows.map((t) => ({
    ...t,
    category_name: byId.get(t.category_id)?.name ?? null,
    category_color: byId.get(t.category_id)?.color ?? null,
  }));
}

function parseCategoryId(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  const n = Number(value);
  return Number.isInteger(n) ? { value: n } : { error: true };
}

router.get('/', async (req, res) => {
  let q = req.db.from('todos').select(COLUMNS)
    .order('is_done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false });

  if (req.query.today === '1') q = q.eq('due_date', formatLocal(new Date())).eq('is_done', false);

  const cat = req.query.category_id;
  if (cat !== undefined && cat !== '') {
    if (cat === 'none') {
      q = q.is('category_id', null);
    } else {
      const cid = Number(cat);
      if (!Number.isInteger(cid)) return res.status(400).json({ error: 'category_id가 올바르지 않습니다.' });
      q = q.eq('category_id', cid);
    }
  }

  const { data, error } = await q;
  if (error) throw error;
  res.json(await withCategories(req.db, data));
});

router.post('/', async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: '제목이 필요합니다.' });
  if (title.length > 200) return res.status(400).json({ error: '제목은 200자 이하여야 합니다.' });

  const due = req.body.due_date || null;
  if (due !== null && !validDate(due)) return res.status(400).json({ error: '마감일 형식은 YYYY-MM-DD 입니다.' });

  const cid = parseCategoryId(req.body.category_id);
  if (cid.error) return res.status(400).json({ error: '존재하지 않는 카테고리입니다.' });

  // user_id is filled by the database (auth.uid()); never taken from the request.
  const { data, error } = await req.db.from('todos')
    .insert({ title, due_date: due, category_id: cid.value }).select(COLUMNS).single();
  if (error) {
    if (error.code === '23503') return res.status(400).json({ error: '존재하지 않는 카테고리입니다.' });
    throw error;
  }
  res.status(201).json((await withCategories(req.db, [data]))[0]);
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id가 올바르지 않습니다.' });

  const b = req.body;
  const patch = {};

  if (b.title !== undefined) {
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    if (!title || title.length > 200) return res.status(400).json({ error: '제목이 올바르지 않습니다.' });
    patch.title = title;
  }
  if (b.is_done !== undefined) {
    const done = b.is_done === true || b.is_done === 1 ? true : b.is_done === false || b.is_done === 0 ? false : null;
    if (done === null) return res.status(400).json({ error: 'is_done은 true/false 여야 합니다.' });
    patch.is_done = done;
    patch.completed_at = done ? new Date().toISOString() : null;
  }
  if (b.due_date !== undefined) {
    const due = b.due_date || null;
    if (due !== null && !validDate(due)) return res.status(400).json({ error: '마감일 형식은 YYYY-MM-DD 입니다.' });
    patch.due_date = due;
  }
  if (b.category_id !== undefined) {
    const cid = parseCategoryId(b.category_id);
    if (cid.error) return res.status(400).json({ error: '존재하지 않는 카테고리입니다.' });
    patch.category_id = cid.value;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: '변경할 값이 없습니다.' });

  const { data, error } = await req.db.from('todos').update(patch).eq('id', id).select(COLUMNS);
  if (error) {
    if (error.code === '23503') return res.status(400).json({ error: '존재하지 않는 카테고리입니다.' });
    throw error;
  }
  // RLS hides other users' rows, so "not yours" and "not found" look the same.
  if (!data.length) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.json((await withCategories(req.db, data))[0]);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id가 올바르지 않습니다.' });

  const { data, error } = await req.db.from('todos').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.status(204).end();
});

module.exports = router;
