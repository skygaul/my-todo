// Checks that Row Level Security really separates two users.
// Run:  npm run verify:rls   (needs two accounts that already exist, e.g. signed up in the app)
// Passwords are typed into this terminal only; nothing is saved to disk.
require('dotenv').config();
const readline = require('readline');
const { authClient, userClient } = require('../server/supabase');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Reads a password without showing it: prints one * per character.
function askHidden(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) return resolve(ask(question));
    process.stdout.write(question);
    let value = '';
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('keypress', onKey);
    };
    function onKey(str, key) {
      if (key && key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('\n');
        process.exit(130);
      }
      if (key && (key.name === 'return' || key.name === 'enter')) {
        cleanup();
        process.stdout.write('\n');
        return resolve(value);
      }
      if (key && key.name === 'backspace') {
        if (value) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      if (str && !(key && (key.ctrl || key.meta)) && str >= ' ') {
        value += str;
        process.stdout.write('*');
      }
    }
    process.stdin.on('keypress', onKey);
  });
}

let failed = 0;
function check(name, ok, detail = '') {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function login(label) {
  // Preferred: the values arrive as environment variables of this one process
  // (see README). Otherwise fall back to typing them here.
  const email = process.env[`RLS_${label}_EMAIL`] || (await ask(`계정 ${label} 이메일: `));
  const password = process.env[`RLS_${label}_PASSWORD`] || (await askHidden(`계정 ${label} 비밀번호: `));
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`계정 ${label} 로그인 실패: ${error?.message ?? 'no session'}`);
  return { user: data.user, db: userClient(data.session.access_token) };
}

(async () => {
  console.log('두 계정(A, B)으로 RLS를 확인합니다. 서로 다른 이메일이어야 합니다.\n');
  const A = await login('A');
  const B = await login('B');
  if (A.user.id === B.user.id) throw new Error('A와 B가 같은 계정입니다. 서로 다른 계정을 쓰세요.');

  const tag = `rls-test-${Date.now()}`;
  let catA;
  let todoA;
  try {
    // A creates a category and a todo.
    const c = await A.db.from('categories').insert({ name: tag }).select('id').single();
    check('A: 카테고리 만들기', !c.error, c.error?.message);
    catA = c.data?.id;
    const t = await A.db.from('todos').insert({ title: `${tag}-A`, category_id: catA }).select('id, user_id').single();
    check('A: 할 일 만들기', !t.error, t.error?.message);
    todoA = t.data?.id;
    check('A: user_id가 DB에서 자동으로 A의 id로 채워짐', t.data?.user_id === A.user.id);

    // B tries to read.
    const bTodos = await B.db.from('todos').select('id').eq('id', todoA);
    check('B: A의 할 일 조회 → 0건', !bTodos.error && bTodos.data.length === 0, bTodos.error?.message);
    const bAll = await B.db.from('todos').select('id, title');
    check('B: 전체 목록에 A의 할 일 없음', !bAll.error && !bAll.data.some((x) => x.title.startsWith(tag)));
    const bCats = await B.db.from('categories').select('id, name');
    check('B: 전체 카테고리에 A의 카테고리 없음', !bCats.error && !bCats.data.some((x) => x.name === tag));

    // B tries to change / delete.
    const upd = await B.db.from('todos').update({ title: 'HACKED' }).eq('id', todoA).select('id');
    check('B: A의 할 일 수정 → 반영 0건', !upd.error && upd.data.length === 0, upd.error?.message);
    const del = await B.db.from('todos').delete().eq('id', todoA).select('id');
    check('B: A의 할 일 삭제 → 삭제 0건', !del.error && del.data.length === 0, del.error?.message);
    const delCat = await B.db.from('categories').delete().eq('id', catA).select('id');
    check('B: A의 카테고리 삭제 → 삭제 0건', !delCat.error && delCat.data.length === 0, delCat.error?.message);

    // A's data is untouched.
    const still = await A.db.from('todos').select('id, title').eq('id', todoA);
    check('A: 원래 할 일이 그대로 남아 있음', !still.error && still.data.length === 1 && still.data[0].title === `${tag}-A`);

    // B tries to forge ownership.
    const forged = await B.db.from('todos').insert({ title: `${tag}-forged`, user_id: A.user.id }).select('id');
    check('B: user_id를 A로 속여 추가 → 거절', !!forged.error, forged.error?.code);
    const crossCat = await B.db.from('todos').insert({ title: `${tag}-cross`, category_id: catA }).select('id');
    check('B: A의 카테고리에 연결해 추가 → 거절', !!crossCat.error, crossCat.error?.code);

    // Not logged in at all.
    const anon = await authClient().from('todos').select('id');
    check('로그인 안 함: 목록 조회 → 거절 또는 0건', !!anon.error || anon.data.length === 0, anon.error?.code);
  } finally {
    if (todoA) await A.db.from('todos').delete().eq('id', todoA);
    if (catA) await A.db.from('categories').delete().eq('id', catA);
    console.log('\n(테스트로 만든 데이터는 정리했습니다.)');
  }

  console.log(failed ? `\n실패 ${failed}건 — RLS 설정을 다시 확인하세요.` : '\n모두 통과: 계정 사이 데이터가 분리됩니다.');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(`\n오류: ${e.message}`);
  process.exit(1);
});
