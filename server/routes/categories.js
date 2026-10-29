const express = require('express');

const router = express.Router();

router.get('/', async (req, res) => {
  const { data, error } = await req.db.from('categories').select('id, name, color').order('name');
  if (error) throw error;
  res.json(data);
});

router.post('/', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const color = typeof req.body.color === 'string' && req.body.color.trim() ? req.body.color.trim() : null;
  if (!name) return res.status(400).json({ error: '카테고리 이름이 필요합니다.' });
  if (name.length > 30) return res.status(400).json({ error: '카테고리 이름은 30자 이하여야 합니다.' });

  const { data, error } = await req.db.from('categories').insert({ name, color }).select('id, name, color').single();
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: '이미 있는 카테고리입니다.' });
    throw error;
  }
  res.status(201).json(data);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id가 올바르지 않습니다.' });

  const { data, error } = await req.db.from('categories').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
  res.status(204).end();
});

module.exports = router;
