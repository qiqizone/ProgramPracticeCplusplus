import { Router } from 'express';
import db from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function last7Days(rows) {
  const counts = new Map(rows.map((row) => [row.day, row.count]));
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    days.push({ date, count: counts.get(date) ?? 0 });
  }
  return days;
}

router.get('/', authenticate, (req, res) => {
  const userId = req.user.id;

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS attempts,
              COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct,
              COALESCE(SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END), 0) AS wrong,
              COALESCE(SUM(CASE WHEN is_correct IS NULL THEN 1 ELSE 0 END), 0) AS codeDone
       FROM attempts WHERE user_id = ?`
    )
    .get(userId);

  const states = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status = 'wrong' THEN 1 ELSE 0 END), 0) AS wrong,
              COALESCE(SUM(CASE WHEN starred = 1 THEN 1 ELSE 0 END), 0) AS starred
       FROM question_states WHERE user_id = ?`
    )
    .get(userId);

  const chapterRows = db
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
    .all(userId);

  const byChapter = new Map(chapterRows.map((row) => [row.chapter, row]));
  const chapters = Array.from({ length: 10 }, (_, i) => {
    const chapter = i + 1;
    const row = byChapter.get(chapter);
    const total = row?.total ?? 0;
    return {
      chapter,
      total,
      correct: row?.correct ?? 0,
      done: row?.done ?? 0,
      wrong: row?.wrong ?? 0,
      mastery: total ? Math.round((((row?.correct ?? 0) + (row?.done ?? 0)) / total) * 100) : 0,
    };
  });

  const dailyRows = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS count
       FROM attempts
       WHERE user_id = ? AND date(created_at) >= date('now', 'localtime', '-6 days')
       GROUP BY day`
    )
    .all(userId);

  const choiceAttempts = totals.correct + totals.wrong;
  const accuracy = choiceAttempts ? Math.round((totals.correct / choiceAttempts) * 100) : 0;

  res.json({
    totals: {
      attempts: totals.attempts,
      choiceAttempts,
      correct: totals.correct,
      wrong: totals.wrong,
      codeDone: totals.codeDone,
      accuracy,
    },
    wrongCount: states.wrong,
    starredCount: states.starred,
    chapters,
    daily: last7Days(dailyRows),
  });
});

export default router;
