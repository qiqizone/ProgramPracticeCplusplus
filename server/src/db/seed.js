import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './index.js';

const seedFile = fileURLToPath(new URL('../../../data/questions.seed.json', import.meta.url));

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
  if (item.chapter < 1 || item.chapter > 6) throw new Error(`${where} 的 chapter 不合法`);
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

const summary = db
  .prepare('SELECT chapter, COUNT(*) AS total FROM questions GROUP BY chapter ORDER BY chapter')
  .all();
console.log(`题库导入完成，共 ${items.length} 题`);
console.table(summary);
