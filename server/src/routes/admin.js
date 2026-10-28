import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { HttpError, asyncHandler } from '../lib/errors.js';
import { toFullQuestion } from '../lib/questions.js';

const router = Router();

const optionSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });

const questionInput = z.object({
  slug: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'slug 只能包含字母、数字、下划线和短横线'),
  chapter: z.number().int().min(1).max(10),
  type: z.enum(['single', 'multiple', 'output', 'code']),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  stem: z.string().min(1),
  options: z.array(optionSchema).nullable().optional(),
  answer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string().min(1),
  hints: z.array(z.string()).nullable().optional(),
  referenceSolution: z.string().nullable().optional(),
  orderIndex: z.number().int().min(0).default(0),
});

function toColumns(input) {
  return {
    slug: input.slug,
    chapter: input.chapter,
    type: input.type,
    difficulty: input.difficulty,
    stem: input.stem,
    options: input.options ? JSON.stringify(input.options) : null,
    answer: JSON.stringify(input.answer),
    explanation: input.explanation,
    hints: input.hints ? JSON.stringify(input.hints) : null,
    reference_solution: input.referenceSolution ?? null,
    order_index: input.orderIndex,
  };
}

function findByIdOrThrow(id) {
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'QUESTION_NOT_FOUND', '题目不存在');
  return row;
}

router.get('/', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM questions ORDER BY chapter ASC, order_index ASC, id ASC')
    .all();
  res.json({ questions: rows.map(toFullQuestion) });
});

router.get('/:id', (req, res) => {
  const row = findByIdOrThrow(Number(req.params.id));
  res.json(toFullQuestion(row));
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = questionInput.parse(req.body);
    const exists = db.prepare('SELECT id FROM questions WHERE slug = ?').get(input.slug);
    if (exists) throw new HttpError(409, 'SLUG_TAKEN', '该 slug 已存在');

    const cols = toColumns(input);
    const info = db
      .prepare(
        `INSERT INTO questions (slug, chapter, type, difficulty, stem, options, answer, explanation, hints, reference_solution, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        cols.slug,
        cols.chapter,
        cols.type,
        cols.difficulty,
        cols.stem,
        cols.options,
        cols.answer,
        cols.explanation,
        cols.hints,
        cols.reference_solution,
        cols.order_index
      );

    const row = findByIdOrThrow(Number(info.lastInsertRowid));
    res.status(201).json(toFullQuestion(row));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    findByIdOrThrow(id);
    const input = questionInput.parse(req.body);

    const conflict = db.prepare('SELECT id FROM questions WHERE slug = ? AND id <> ?').get(input.slug, id);
    if (conflict) throw new HttpError(409, 'SLUG_TAKEN', '该 slug 已被其他题目使用');

    const cols = toColumns(input);
    db.prepare(
      `UPDATE questions SET slug = ?, chapter = ?, type = ?, difficulty = ?, stem = ?, options = ?,
        answer = ?, explanation = ?, hints = ?, reference_solution = ?, order_index = ?,
        updated_at = datetime('now', 'localtime')
       WHERE id = ?`
    ).run(
      cols.slug,
      cols.chapter,
      cols.type,
      cols.difficulty,
      cols.stem,
      cols.options,
      cols.answer,
      cols.explanation,
      cols.hints,
      cols.reference_solution,
      cols.order_index,
      id
    );

    res.json(toFullQuestion(findByIdOrThrow(id)));
  })
);

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  findByIdOrThrow(id);
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.post(
  '/import',
  asyncHandler(async (req, res) => {
    const raw = Array.isArray(req.body) ? req.body : null;
    if (!raw) throw new HttpError(400, 'INVALID_IMPORT', '导入内容必须是 JSON 数组');

    // 兼容题库文件的 snake_case 写法
    const normalized = raw.map((item) => ({
      ...item,
      referenceSolution: item.referenceSolution ?? item.reference_solution ?? null,
      orderIndex: item.orderIndex ?? item.order_index ?? 0,
    }));

    const items = z.array(questionInput).min(1, '至少导入一道题目').parse(normalized);
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
        const cols = toColumns(item);
        upsert.run(
          cols.slug,
          cols.chapter,
          cols.type,
          cols.difficulty,
          cols.stem,
          cols.options,
          cols.answer,
          cols.explanation,
          cols.hints,
          cols.reference_solution,
          cols.order_index
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    res.json({ imported: items.length });
  })
);

export default router;
