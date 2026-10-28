import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './index.js';

const seedFile = fileURLToPath(new URL('../../../data/questions.seed.json', import.meta.url));
const knowledgeFile = fileURLToPath(new URL('../../../data/knowledge.seed.json', import.meta.url));

const CHOICE_TYPES = new Set(['single', 'multiple', 'output']);
const ALL_TYPES = new Set(['single', 'multiple', 'output', 'code']);

function validate(item, index) {
  const where = `第 ${index + 1} 条（${item?.slug ?? '无 slug'}）`;
  if (!item || typeof item !== 'object') throw new Error(`${where} 不是对象`);
  for (const field of ['slug', 'chapter', 'type', 'stem', 'answer', 'explanation']) {
    if (item[field] === undefined || item[field] === null) {
      throw new Error(`${where} 缺少字段 ${field}`);
    }
  }
  if (!ALL_TYPES.has(item.type)) throw new Error(`${where} 的 type 不合法`);
  if (item.chapter < 1 || item.chapter > 10) throw new Error(`${where} 的 chapter 不合法`);
  if (item.type === 'single' || item.type === 'multiple') {
    if (!Array.isArray(item.options) || item.options.length !== 4) {
      throw new Error(`${where} 需要 4 个选项`);
    }
  }
  if (CHOICE_TYPES.has(item.type) && !item.explanation) {
    throw new Error(`${where} 缺少解析`);
  }
  if (item.type === 'code' && !item.reference_solution) {
    throw new Error(`${where} 是编程题但缺少参考代码`);
  }
  if (item.answer !== 'SELF' && typeof item.answer !== 'string' && !Array.isArray(item.answer)) {
    throw new Error(`${where} 的 answer 格式不合法`);
  }
}

if (!fs.existsSync(seedFile)) {
  console.error(`找不到题库文件：${seedFile}`);
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
if (!Array.isArray(items)) {
  console.error('题库文件必须是 JSON 数组');
  process.exit(1);
}
items.forEach(validate);

const upsert = db.prepare(
  `INSERT INTO questions (slug, chapter, type, difficulty, stem, options, answer, explanation, hints, reference_solution, order_index)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(slug) DO UPDATE SET
     chapter = excluded.chapter,
     type = excluded.type,
     difficulty = excluded.difficulty,
     stem = excluded.stem,
     options = excluded.options,
     answer = excluded.answer,
     explanation = excluded.explanation,
     hints = excluded.hints,
     reference_solution = excluded.reference_solution,
     order_index = excluded.order_index,
     updated_at = datetime('now', 'localtime')`
);

db.exec('BEGIN');
try {
  for (const item of items) {
    upsert.run(
      item.slug,
      item.chapter,
      item.type,
      item.difficulty || 'medium',
      item.stem,
      item.options ? JSON.stringify(item.options) : null,
      JSON.stringify(item.answer),
      item.explanation,
      item.hints ? JSON.stringify(item.hints) : null,
      item.reference_solution ?? null,
      item.order_index ?? 0
    );
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

if (!fs.existsSync(knowledgeFile)) {
  console.error(`找不到知识点文件：${knowledgeFile}`);
  process.exit(1);
}

const points = JSON.parse(fs.readFileSync(knowledgeFile, 'utf8'));
if (!Array.isArray(points)) {
  console.error('知识点文件必须是 JSON 数组');
  process.exit(1);
}

const upsertPoint = db.prepare(
  `INSERT INTO knowledge_points (slug, chapter, title, summary, reference_url, order_index)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(slug) DO UPDATE SET
     chapter = excluded.chapter,
     title = excluded.title,
     summary = excluded.summary,
     reference_url = excluded.reference_url,
     order_index = excluded.order_index,
     updated_at = datetime('now', 'localtime')`
);

const upsertExercise = db.prepare(
  `INSERT INTO knowledge_exercises (slug, knowledge_id, stem, options, answer, explanation, order_index)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(slug) DO UPDATE SET
     knowledge_id = excluded.knowledge_id,
     stem = excluded.stem,
     options = excluded.options,
     answer = excluded.answer,
     explanation = excluded.explanation,
     order_index = excluded.order_index,
     updated_at = datetime('now', 'localtime')`
);

const findPointId = db.prepare('SELECT id FROM knowledge_points WHERE slug = ?');

db.exec('BEGIN');
try {
  for (const point of points) {
    if (!point?.slug || !point?.chapter || !point?.title || !point?.summary) {
      throw new Error(`知识点 ${point?.slug ?? '（无 slug）'} 缺少必要字段`);
    }
    if (point.chapter < 1 || point.chapter > 10) {
      throw new Error(`知识点 ${point.slug} 的 chapter 不合法`);
    }
    upsertPoint.run(
      point.slug,
      point.chapter,
      point.title,
      point.summary,
      point.reference_url ?? null,
      point.order_index ?? 0
    );

    const pointId = findPointId.get(point.slug).id;
    const exercises = point.exercises ?? [];
    exercises.forEach((exercise, index) => {
      if (!exercise?.slug || !exercise?.stem || !exercise?.explanation) {
        throw new Error(`练习 ${exercise?.slug ?? point.slug} 缺少必要字段`);
      }
      if (!Array.isArray(exercise.options) || exercise.options.length !== 4) {
        throw new Error(`练习 ${exercise.slug} 需要 4 个选项`);
      }
      if (typeof exercise.answer !== 'string') {
        throw new Error(`练习 ${exercise.slug} 的 answer 必须是字符串`);
      }
      upsertExercise.run(
        exercise.slug,
        pointId,
        exercise.stem,
        JSON.stringify(exercise.options),
        exercise.answer,
        exercise.explanation,
        index + 1
      );
    });
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

const summary = db
  .prepare('SELECT chapter, COUNT(*) AS total FROM questions GROUP BY chapter ORDER BY chapter')
  .all();
const knowledgeSummary = db
  .prepare('SELECT chapter, COUNT(*) AS total FROM knowledge_points GROUP BY chapter ORDER BY chapter')
  .all();
const exerciseCount = db.prepare('SELECT COUNT(*) AS total FROM knowledge_exercises').get().total;
console.log(`题库导入完成，共 ${items.length} 题`);
console.table(summary);
console.log(`知识点导入完成，共 ${points.length} 条，随堂练习 ${exerciseCount} 道`);
console.table(knowledgeSummary);
