import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { parseJson } from '../lib/questions.js';
import { applyExerciseAttempt } from '../services/progress.js';

const router = Router();

const POINT_SELECT = `SELECT k.id, k.slug, k.chapter, k.title, k.summary, k.reference_url, k.order_index
                      FROM knowledge_points k`;

const EXERCISE_SELECT = `SELECT e.id, e.slug, e.knowledge_id, e.stem, e.options, e.order_index,
                                COALESCE(s.status, 'unseen') AS status,
                                COALESCE(s.wrong_count, 0) AS wrong_count,
                                COALESCE(s.correct_streak, 0) AS correct_streak
                         FROM knowledge_exercises e
                         LEFT JOIN knowledge_exercise_states s ON s.exercise_id = e.id AND s.user_id = ?
                         WHERE e.knowledge_id = ?
                         ORDER BY e.order_index`;

function attachExercises(points, userId) {
  const statement = db.prepare(EXERCISE_SELECT);
  return points.map((point) => ({
    ...point,
    exercises: statement.all(userId, point.id).map((exercise) => ({
      ...exercise,
      options: parseJson(exercise.options),
    })),
  }));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const chapterRaw = req.query.chapter;
    if (chapterRaw === undefined) {
      const points = db.prepare(`${POINT_SELECT} ORDER BY k.chapter, k.order_index`).all();
      return res.json({ points: attachExercises(points, req.user.id) });
    }

    const chapter = Number(chapterRaw);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 10) {
      throw new HttpError(400, 'INVALID_CHAPTER', '章节参数不合法');
    }

    const points = db
      .prepare(`${POINT_SELECT} WHERE k.chapter = ? ORDER BY k.order_index`)
      .all(chapter);
    res.json({ points: attachExercises(points, req.user.id) });
  })
);

const checkBody = z.object({ answer: z.string().min(1) });

router.get('/wrong', (req, res) => {
  const exercises = db
    .prepare(
      `SELECT e.id, e.slug, e.stem, e.options, e.order_index,
              k.slug AS point_slug, k.title AS point_title, k.chapter,
              s.wrong_count, s.correct_streak
       FROM knowledge_exercise_states s
       JOIN knowledge_exercises e ON e.id = s.exercise_id
       JOIN knowledge_points k ON k.id = e.knowledge_id
       WHERE s.user_id = ? AND s.status = 'wrong'
       ORDER BY s.updated_at DESC, e.id`
    )
    .all(req.user.id)
    .map((exercise) => ({ ...exercise, options: parseJson(exercise.options) }));

  res.json({ exercises });
});

router.post(
  '/exercises/:id/check',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'INVALID_EXERCISE', '练习参数不合法');
    }

    const { answer } = checkBody.parse(req.body);
    const exercise = db.prepare('SELECT * FROM knowledge_exercises WHERE id = ?').get(id);
    if (!exercise) throw new HttpError(404, 'EXERCISE_NOT_FOUND', '练习不存在');

    const isCorrect = answer.trim() === exercise.answer;
    const state = applyExerciseAttempt(req.user.id, id, isCorrect);

    res.json({
      isCorrect,
      answer: exercise.answer,
      explanation: exercise.explanation,
      state,
    });
  })
);

export default router;
