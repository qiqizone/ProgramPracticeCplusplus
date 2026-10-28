import { Router } from 'express';
import db from '../db/index.js';
import { HttpError } from '../lib/errors.js';
import { toPublicQuestion } from '../lib/questions.js';
import { authenticate } from '../middleware/auth.js';
import { toggleStar } from '../services/progress.js';

const router = Router();

const MODES = ['chapter', 'random', 'wrong', 'starred'];

const BASE_SELECT = `SELECT q.id, q.slug, q.chapter, q.type, q.difficulty, q.stem, q.options, q.hints,
                            q.order_index, COALESCE(s.status, 'unseen') AS status, COALESCE(s.starred, 0) AS starred,
                            COALESCE(s.wrong_count, 0) AS wrong_count
                     FROM questions q
                     LEFT JOIN question_states s ON s.question_id = q.id AND s.user_id = ?`;

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

router.get('/', authenticate, (req, res) => {
  const mode = MODES.includes(req.query.mode) ? req.query.mode : 'chapter';
  const userId = req.user.id;
  let rows;

  if (mode === 'chapter') {
    const chapter = Number(req.query.chapter);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 10) {
      throw new HttpError(400, 'INVALID_CHAPTER', '章节参数不合法');
    }
    rows = db
      .prepare(`${BASE_SELECT} WHERE q.chapter = ? ORDER BY q.order_index ASC, q.id ASC`)
      .all(userId, chapter);
  } else if (mode === 'wrong') {
    rows = db
      .prepare(`${BASE_SELECT} WHERE s.status = 'wrong' ORDER BY s.updated_at DESC`)
      .all(userId);
  } else if (mode === 'starred') {
    rows = db
      .prepare(`${BASE_SELECT} WHERE s.starred = 1 ORDER BY s.updated_at DESC`)
      .all(userId);
  } else {
    const all = db.prepare(`${BASE_SELECT}`).all(userId);
    const unseen = shuffle(all.filter((row) => row.status === 'unseen'));
    const seen = shuffle(all.filter((row) => row.status !== 'unseen'));
    rows = [...unseen, ...seen].slice(0, 20);
  }

  res.json({ mode, questions: rows.map(toPublicQuestion) });
});

router.post('/:id/star', authenticate, (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM questions WHERE id = ?').get(id);
  if (!exists) throw new HttpError(404, 'QUESTION_NOT_FOUND', '题目不存在');

  const state = toggleStar(req.user.id, id);
  res.json({ starred: Boolean(state.starred) });
});

export default router;
