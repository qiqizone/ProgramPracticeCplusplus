import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { HttpError, asyncHandler } from '../lib/errors.js';
import { parseJson } from '../lib/questions.js';
import { authenticate } from '../middleware/auth.js';
import { applyAttempt, markDone } from '../services/progress.js';
import { judge } from '../services/judge.js';

const router = Router();

const attemptBody = z.object({
  questionId: z.number().int().positive(),
  answer: z.union([z.string(), z.array(z.string())]).optional(),
  completed: z.boolean().optional(),
});

router.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { questionId, answer, completed } = attemptBody.parse(req.body);
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
    if (!question) throw new HttpError(404, 'QUESTION_NOT_FOUND', '题目不存在');

    if (question.type === 'code') {
      if (completed !== true) {
        throw new HttpError(400, 'INVALID_ATTEMPT', '编程题请提交完成标记');
      }
      db.prepare(
        'INSERT INTO attempts (user_id, question_id, answer, is_correct) VALUES (?, ?, ?, NULL)'
      ).run(req.user.id, questionId, JSON.stringify({ completed: true }));

      return res.json({
        isCorrect: null,
        answer: parseJson(question.answer),
        explanation: question.explanation,
        referenceSolution: question.reference_solution,
        state: markDone(req.user.id, questionId),
      });
    }

    if (answer === undefined) {
      throw new HttpError(400, 'INVALID_ATTEMPT', '请提交答案');
    }

    const isCorrect = judge(question, answer);
    db.prepare('INSERT INTO attempts (user_id, question_id, answer, is_correct) VALUES (?, ?, ?, ?)').run(
      req.user.id,
      questionId,
      JSON.stringify(answer),
      isCorrect ? 1 : 0
    );

    res.json({
      isCorrect,
      answer: parseJson(question.answer),
      explanation: question.explanation,
      referenceSolution: null,
      state: applyAttempt(req.user.id, questionId, isCorrect),
    });
  })
);

export default router;
