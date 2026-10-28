import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import db from '../src/db/index.js';

const app = createApp();

let slugSeq = 0;

function insertQuestion(overrides = {}) {
  slugSeq += 1;
  const q = {
    slug: `t-q${slugSeq}`,
    chapter: 1,
    type: 'single',
    difficulty: 'easy',
    stem: '测试题',
    options: [
      { id: 'A', text: '1' },
      { id: 'B', text: '2' },
      { id: 'C', text: '3' },
      { id: 'D', text: '4' },
    ],
    answer: 'B',
    explanation: '因为 B 正确',
    hints: null,
    reference_solution: null,
    order_index: 0,
    ...overrides,
  };

  const info = db
    .prepare(
      `INSERT INTO questions (slug, chapter, type, difficulty, stem, options, answer, explanation, hints, reference_solution, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      q.slug,
      q.chapter,
      q.type,
      q.difficulty,
      q.stem,
      q.options ? JSON.stringify(q.options) : null,
      JSON.stringify(q.answer),
      q.explanation,
      q.hints ? JSON.stringify(q.hints) : null,
      q.reference_solution,
      q.order_index
    );

  return Number(info.lastInsertRowid);
}

async function registerUser(username) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'password123' });
  return { token: res.body.token, user: res.body.user, res };
}

describe('认证', () => {
  it('第一个注册用户自动成为管理员，第二个为普通用户', async () => {
    const first = await registerUser('alice');
    expect(first.res.status).toBe(201);
    expect(first.user.role).toBe('admin');

    const second = await registerUser('bob');
    expect(second.user.role).toBe('user');
  });

  it('用户名重复返回 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('密码错误返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('缺少 token 访问受保护接口返回 401', async () => {
    const res = await request(app).get('/api/chapters');
    expect(res.status).toBe(401);
  });

  it('正确登录后 /auth/me 返回用户信息', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('alice');
  });

  it('用户被删除后旧 token 返回 401 而不是 500', async () => {
    const charlie = await registerUser('charlie');
    db.prepare('DELETE FROM users WHERE username = ?').run('charlie');

    const res = await request(app)
      .get('/api/chapters')
      .set('Authorization', `Bearer ${charlie.token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('题目与判分', () => {
  let aliceToken;

  it('获取 token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    aliceToken = login.body.token;
    expect(aliceToken).toBeTruthy();
  });

  it('取题接口不返回答案、解析与参考代码', async () => {
    insertQuestion({ chapter: 2, order_index: 1 });
    const res = await request(app)
      .get('/api/questions?mode=chapter&chapter=2')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBeGreaterThan(0);
    const q = res.body.questions[0];
    expect(q.answer).toBeUndefined();
    expect(q.explanation).toBeUndefined();
    expect(q.referenceSolution).toBeUndefined();
    expect(q.stem).toBe('测试题');
  });

  it('单选题答对返回正确与解析', async () => {
    const id = insertQuestion({ chapter: 3 });
    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, answer: 'B' });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body.answer).toBe('B');
    expect(res.body.explanation).toContain('B');
    expect(res.body.state.status).toBe('correct');
  });

  it('多选题少选判错', async () => {
    const id = insertQuestion({ chapter: 3, type: 'multiple', answer: ['A', 'C'] });
    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, answer: ['A'] });

    expect(res.body.isCorrect).toBe(false);
    expect(res.body.state.status).toBe('wrong');
  });

  it('多选题完全一致判对（顺序无关）', async () => {
    const id = insertQuestion({ chapter: 3, type: 'multiple', answer: ['A', 'C'] });
    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, answer: ['C', 'A'] });

    expect(res.body.isCorrect).toBe(true);
  });

  it('读代码题忽略首尾空白', async () => {
    const id = insertQuestion({ chapter: 3, type: 'output', answer: ['6'] });
    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, answer: '  6\n' });

    expect(res.body.isCorrect).toBe(true);
  });

  it('读代码题大小写敏感', async () => {
    const id = insertQuestion({ chapter: 3, type: 'output', answer: ['True'] });
    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, answer: 'true' });

    expect(res.body.isCorrect).toBe(false);
  });

  it('错题连续答对 2 次后移出错题本', async () => {
    const id = insertQuestion({ chapter: 4 });

    const wrong = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, answer: 'A' });
    expect(wrong.body.state.status).toBe('wrong');

    let list = await request(app)
      .get('/api/questions?mode=wrong')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(list.body.questions.some((q) => q.id === id)).toBe(true);

    const firstCorrect = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, answer: 'B' });
    expect(firstCorrect.body.state.status).toBe('wrong');
    expect(firstCorrect.body.state.correct_streak).toBe(1);

    list = await request(app)
      .get('/api/questions?mode=wrong')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(list.body.questions.some((q) => q.id === id)).toBe(true);

    const secondCorrect = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, answer: 'B' });
    expect(secondCorrect.body.state.status).toBe('correct');

    list = await request(app)
      .get('/api/questions?mode=wrong')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(list.body.questions.some((q) => q.id === id)).toBe(false);
  });

  it('编程题标记完成后返回参考代码', async () => {
    const id = insertQuestion({
      chapter: 5,
      type: 'code',
      options: null,
      answer: 'SELF',
      reference_solution: '```cpp\nint main(){return 0;}\n```',
    });

    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ questionId: id, completed: true });

    expect(res.body.isCorrect).toBeNull();
    expect(res.body.referenceSolution).toContain('int main');
    expect(res.body.state.status).toBe('done');
  });

  it('收藏与取消收藏', async () => {
    const id = insertQuestion({ chapter: 6 });
    const first = await request(app)
      .post(`/api/questions/${id}/star`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(first.body.starred).toBe(true);

    const second = await request(app)
      .post(`/api/questions/${id}/star`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(second.body.starred).toBe(false);
  });
});

describe('权限', () => {
  it('普通用户访问管理接口返回 403', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'password123' });

    const res = await request(app)
      .get('/api/admin/questions')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });

  it('管理员可以访问管理接口', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });

    const res = await request(app)
      .get('/api/admin/questions')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
  });
});

describe('知识点', () => {
  let token;
  let exerciseId;

  it('按章节返回知识点，按 order_index 排序', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    token = login.body.token;

    db.prepare(
      `INSERT INTO knowledge_points (slug, chapter, title, summary, reference_url, order_index)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('t-kp2', 3, '第二个知识点', '总结二', 'https://zh.cppreference.com/w/cpp/language/pointer', 2);
    const info = db
      .prepare(
        `INSERT INTO knowledge_points (slug, chapter, title, summary, reference_url, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('t-kp1', 3, '第一个知识点', '总结一', 'https://zh.cppreference.com/w/cpp/language/reference', 1);
    const pointId = Number(info.lastInsertRowid);

    const ex = db
      .prepare(
        `INSERT INTO knowledge_exercises (slug, knowledge_id, stem, options, answer, explanation, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        't-kp1-ex1',
        pointId,
        '哪个是引用？',
        JSON.stringify([
          { id: 'A', text: 'int a;' },
          { id: 'B', text: 'int& r = a;' },
          { id: 'C', text: 'int* p = &a;' },
          { id: 'D', text: 'int arr[2];' },
        ]),
        'B',
        '引用是别名，用 & 声明',
        1
      );
    exerciseId = Number(ex.lastInsertRowid);

    const res = await request(app)
      .get('/api/knowledge?chapter=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.points.map((p) => p.slug)).toEqual(['t-kp1', 't-kp2']);
    expect(res.body.points[0]).toMatchObject({
      chapter: 3,
      title: '第一个知识点',
      summary: '总结一',
      reference_url: 'https://zh.cppreference.com/w/cpp/language/reference',
    });
    expect(res.body.points[0].exercises).toHaveLength(1);
    expect(res.body.points[0].exercises[0]).toMatchObject({
      id: exerciseId,
      stem: '哪个是引用？',
    });
    expect(res.body.points[0].exercises[0].options).toHaveLength(4);
    expect(res.body.points[0].exercises[0].answer).toBeUndefined();
    expect(res.body.points[0].exercises[0].explanation).toBeUndefined();
  });

  it('随堂练习判题：正确与错误都返回解析', async () => {
    const correct = await request(app)
      .post(`/api/knowledge/exercises/${exerciseId}/check`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: 'B' });
    expect(correct.status).toBe(200);
    expect(correct.body).toMatchObject({
      isCorrect: true,
      answer: 'B',
      explanation: '引用是别名，用 & 声明',
    });

    const wrong = await request(app)
      .post(`/api/knowledge/exercises/${exerciseId}/check`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: 'A' });
    expect(wrong.body.isCorrect).toBe(false);
    expect(wrong.body.answer).toBe('B');
  });

  it('随堂练习答错进入错题本，连续答对 2 次后移出', async () => {
    const auth = { Authorization: `Bearer ${token}` };

    const before = await request(app).get('/api/knowledge/wrong').set(auth);
    expect(before.status).toBe(200);
    expect(before.body.exercises.map((item) => item.id)).toContain(exerciseId);
    expect(before.body.exercises[0].point_title).toBe('第一个知识点');
    expect(before.body.exercises[0].answer).toBeUndefined();

    const first = await request(app)
      .post(`/api/knowledge/exercises/${exerciseId}/check`)
      .set(auth)
      .send({ answer: 'B' });
    expect(first.body.state).toMatchObject({ status: 'wrong', correct_streak: 1 });

    const stillWrong = await request(app).get('/api/knowledge/wrong').set(auth);
    expect(stillWrong.body.exercises.map((item) => item.id)).toContain(exerciseId);

    const second = await request(app)
      .post(`/api/knowledge/exercises/${exerciseId}/check`)
      .set(auth)
      .send({ answer: 'B' });
    expect(second.body.state).toMatchObject({ status: 'correct', correct_streak: 2 });

    const cleared = await request(app).get('/api/knowledge/wrong').set(auth);
    expect(cleared.body.exercises.map((item) => item.id)).not.toContain(exerciseId);
  });

  it('再次获取知识点会返回随堂练习的作答状态', async () => {
    const res = await request(app)
      .get('/api/knowledge?chapter=3')
      .set('Authorization', `Bearer ${token}`);

    const point = res.body.points.find((item) => item.slug === 't-kp1');
    expect(point.exercises[0]).toMatchObject({
      status: 'correct',
      correct_streak: 2,
      wrong_count: 1,
    });
  });

  it('练习不存在返回 404', async () => {
    const res = await request(app)
      .post('/api/knowledge/exercises/999999/check')
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: 'A' });
    expect(res.status).toBe(404);
  });

  it('章节参数不合法返回 400', async () => {
    const res = await request(app)
      .get('/api/knowledge?chapter=11')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
