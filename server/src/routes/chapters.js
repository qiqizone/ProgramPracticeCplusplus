import { Router } from 'express';
import db from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const CHAPTER_TOTAL = 6;

router.get('/', authenticate, (req, res) => {
  const rows = db
    .prepare(
      `SELECT q.chapter,
              COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN s.status = 'correct' THEN 1 ELSE 0 END), 0) AS correct,
              COALESCE(SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END), 0) AS done,
              COALESCE(SUM(CASE WHEN s.status = 'wrong' THEN 1 ELSE 0 END), 0) AS wrong
       FROM questions q
       LEFT JOIN question_states s ON s.question_id = q.id AND s.user_id = ?
       GROUP BY q.chapter`
    )
    .all(req.user.id);

  const byChapter = new Map(rows.map((row) => [row.chapter, row]));
  const chapters = Array.from({ length: CHAPTER_TOTAL }, (_, i) => {
    const chapter = i + 1;
    const row = byChapter.get(chapter);
    return {
      chapter,
      total: row?.total ?? 0,
      correct: row?.correct ?? 0,
      done: row?.done ?? 0,
      wrong: row?.wrong ?? 0,
    };
  });

  res.json({ chapters });
});

export default router;
