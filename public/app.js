const $ = (id) => document.getElementById(id);

const listEl = $('list');
const emptyEl = $('empty');
const msgEl = $('msg');
const noteEl = $('filter-note');

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth/')) showLogin();
  if (!res.ok) throw new Error(data.error || '요청에 실패했습니다.');
  return data;
}

function showLogin() {
  $('app').hidden = true;
  $('auth').hidden = false;
}

function showApp(email) {
  $('auth').hidden = true;
  $('app').hidden = false;
  $('user-email').textContent = email;
}

function authMsg(text, ok = false) {
  const el = $('auth-msg');
  el.textContent = text;
  el.className = ok ? 'ok' : '';
}

function showMsg(text, ok = false) {
  msgEl.textContent = text;
  msgEl.className = ok ? 'ok' : '';
  setTimeout(() => { if (msgEl.textContent === text) msgEl.textContent = ''; }, 4000);
}

function showError(e) {
  const offline = e instanceof TypeError;
  showMsg(offline ? '서버에 연결할 수 없습니다. 터미널에서 npm start 로 서버를 켰는지 확인하세요.' : e.message);
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let categories = [];
let filterCat = '';

function fillCategorySelect() {
  const sel = $('cat');
  const prev = sel.value;
  sel.innerHTML = '<option value="">미분류</option>';
  for (const c of categories) sel.append(new Option(c.name, c.id));
  sel.value = categories.some((c) => String(c.id) === prev) ? prev : '';
}

function renderCategoryList() {
  const ul = $('cat-list');
  ul.replaceChildren();

  const entries = [
    { key: '', label: '전체' },
    { key: 'none', label: '미분류' },
    ...categories.map((c) => ({ key: String(c.id), label: c.name, category: c })),
  ];

  for (const e of entries) {
    const li = document.createElement('li');
    li.className = 'cat-item' + (filterCat === e.key ? ' active' : '');

    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'name';
    name.textContent = e.label;
    name.addEventListener('click', () => {
      filterCat = e.key;
      renderCategoryList();
      loadTodos().catch(showError);
    });
    li.append(name);

    if (e.category) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'remove';
      del.textContent = '×';
      del.setAttribute('aria-label', `${e.category.name} 카테고리 삭제`);
      del.addEventListener('click', () => removeCategory(e.category));
      li.append(del);
    }
    ul.append(li);
  }
}

async function loadCategories() {
  categories = await api('/categories');
  if (filterCat && filterCat !== 'none' && !categories.some((c) => String(c.id) === filterCat)) {
    filterCat = '';
  }
  fillCategorySelect();
  renderCategoryList();
}

async function removeCategory(c) {
  if (!confirm(`'${c.name}' 카테고리를 삭제할까요?\n이 카테고리의 할 일은 "미분류"로 남습니다.`)) return;
  try {
    await api(`/categories/${c.id}`, { method: 'DELETE' });
    await loadCategories();
    await loadTodos();
    showMsg(`'${c.name}' 카테고리를 삭제했습니다.`, true);
  } catch (e) { showError(e); }
}

async function loadTodos() {
  const q = new URLSearchParams();
  if ($('today').checked) q.set('today', '1');
  if (filterCat) q.set('category_id', filterCat);
  const todos = await api(`/todos${q.size ? '?' + q : ''}`);
  render(todos);
}

function filterLabel() {
  const parts = [];
  if ($('today').checked) parts.push('오늘 할 일');
  if (filterCat === 'none') parts.push('미분류');
  else if (filterCat) parts.push(categories.find((c) => String(c.id) === filterCat)?.name ?? '');
  return parts.filter(Boolean).join(' · ');
}

function render(todos) {
  listEl.replaceChildren();
  emptyEl.hidden = todos.length > 0;
  const label = filterLabel();
  noteEl.hidden = !label;
  noteEl.textContent = label ? `보기: ${label}` : '';
  const today = todayStr();

  for (const t of todos) {
    const li = document.createElement('li');
    li.className = 'item' + (t.is_done ? ' done' : '');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = !!t.is_done;
    check.setAttribute('aria-label', '완료 표시');
    check.addEventListener('change', () => update(t.id, { is_done: check.checked }));

    const body = document.createElement('div');
    body.className = 'body';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = t.title;
    body.append(title);

    if (t.category_name) {
      const tag = document.createElement('div');
      tag.className = 'cat-tag';
      tag.textContent = `# ${t.category_name}`;
      body.append(tag);
    }

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.setAttribute('aria-label', '삭제');
    del.addEventListener('click', () => remove(t.id));

    li.append(check, body);
    if (t.due_date) {
      const due = document.createElement('span');
      const overdue = !t.is_done && t.due_date < today;
      due.className = 'due' + (overdue ? ' overdue' : '');
      due.textContent = `마감 ${t.due_date}`;
      if (overdue) due.title = '마감일이 지났습니다';
      li.append(due);
    }
    li.append(del);
    listEl.append(li);
  }
}

async function update(id, patch) {
  try { await api(`/todos/${id}`, { method: 'PATCH', body: patch }); } catch (e) { showError(e); }
  loadTodos().catch(showError);
}

async function remove(id) {
  try { await api(`/todos/${id}`, { method: 'DELETE' }); } catch (e) { showError(e); }
  loadTodos().catch(showError);
}

$('add-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    await api('/todos', {
      method: 'POST',
      body: { title: $('title').value, due_date: $('due').value || null, category_id: $('cat').value || null },
    });
    $('title').value = '';
    $('due').value = '';
    await loadTodos();
  } catch (e) { showError(e); }
});

$('cat-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = $('cat-name').value;
  if (!name.trim()) return;
  try {
    const created = await api('/categories', { method: 'POST', body: { name } });
    $('cat-name').value = '';
    await loadCategories();
    showMsg(`'${created.name}' 카테고리를 추가했습니다.`, true);
  } catch (e) { showError(e); }
});

$('today').addEventListener('change', () => loadTodos().catch(showError));

async function enterApp(email) {
  filterCat = '';
  $('today').checked = false;
  showApp(email);
  try {
    await loadCategories();
    await loadTodos();
  } catch (e) { showError(e); }
}

async function submitAuth(kind) {
  const form = $('auth-form');
  if (!form.reportValidity()) return;
  authMsg('');
  try {
    const result = await api(`/auth/${kind}`, {
      method: 'POST',
      body: { email: $('auth-email').value, password: $('auth-password').value },
    });
    if (result.needsConfirm) return authMsg(result.message, true);
    $('auth-password').value = '';
    await enterApp(result.email);
  } catch (e) {
    authMsg(e instanceof TypeError ? '서버에 연결할 수 없습니다. 터미널에서 npm start 로 서버를 켰는지 확인하세요.' : e.message);
  }
}

$('auth-form').addEventListener('submit', (ev) => { ev.preventDefault(); submitAuth('login'); });
$('signup-btn').addEventListener('click', () => submitAuth('signup'));

$('logout').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch (e) { showError(e); }
  listEl.replaceChildren();
  showLogin();
});

(async () => {
  try {
    const me = await api('/auth/me');
    await enterApp(me.email);
  } catch (e) {
    showLogin();
    if (e instanceof TypeError) authMsg('서버에 연결할 수 없습니다. 터미널에서 npm start 로 서버를 켰는지 확인하세요.');
  }
})();
