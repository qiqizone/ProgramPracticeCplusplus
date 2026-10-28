import db from '../db/index.js';

export function getState(userId, questionId) {
  return (
    db
      .prepare('SELECT * FROM question_states WHERE user_id = ? AND question_id = ?')
      .get(userId, questionId) || null
  );
}

function saveState(userId, questionId, state) {
  db.prepare(
    `INSERT INTO question_states (user_id, question_id, status, wrong_count, correct_streak, starred, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(user_id, question_id) DO UPDATE SET
       status = excluded.status,
       wrong_count = excluded.wrong_count,
       correct_streak = excluded.correct_streak,
       starred = excluded.starred,
       updated_at = datetime('now', 'localtime')`
  ).run(
    userId,
    questionId,
    state.status,
    state.wrong_count,
    state.correct_streak,
    state.starred
  );
}

export function applyAttempt(userId, questionId, isCorrect) {
  const current = getState(userId, questionId);
  const prev = current
    ? {
        status: current.status,
        wrong_count: current.wrong_count,
        correct_streak: current.correct_streak,
        starred: current.starred,
      }
    : { status: 'unseen', wrong_count: 0, correct_streak: 0, starred: 0 };

  let next;
  if (isCorrect) {
    const correctStreak = prev.correct_streak + 1;
    // 错题连续答对 2 次才移出错题本；非错答状态的题答对即记为正确
    const status = prev.status === 'wrong' && correctStreak < 2 ? 'wrong' : 'correct';
    next = {
      status,
      wrong_count: prev.wrong_count,
      correct_streak: correctStreak,
      starred: prev.starred,
    };
  } else {
    next = {
      status: 'wrong',
      wrong_count: prev.wrong_count + 1,
      correct_streak: 0,
      starred: prev.starred,
    };
  }

  saveState(userId, questionId, next);
  return next;
}

export function applyExerciseAttempt(userId, exerciseId, isCorrect) {
  const current = db
    .prepare('SELECT * FROM knowledge_exercise_states WHERE user_id = ? AND exercise_id = ?')
    .get(userId, exerciseId);
  const prev = current
    ? {
        status: current.status,
        wrong_count: current.wrong_count,
        correct_streak: current.correct_streak,
      }
    : { status: 'unseen', wrong_count: 0, correct_streak: 0 };

  let next;
  if (isCorrect) {
    const correctStreak = prev.correct_streak + 1;
    const status = prev.status === 'wrong' && correctStreak < 2 ? 'wrong' : 'correct';
    next = { status, wrong_count: prev.wrong_count, correct_streak: correctStreak };
  } else {
    next = { status: 'wrong', wrong_count: prev.wrong_count + 1, correct_streak: 0 };
  }

  db.prepare(
    `INSERT INTO knowledge_exercise_states (user_id, exercise_id, status, wrong_count, correct_streak, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT(user_id, exercise_id) DO UPDATE SET
       status = excluded.status,
       wrong_count = excluded.wrong_count,
       correct_streak = excluded.correct_streak,
       updated_at = datetime('now', 'localtime')`
  ).run(userId, exerciseId, next.status, next.wrong_count, next.correct_streak);

  return next;
}

export function markDone(userId, questionId) {
  const current = getState(userId, questionId);
  const next = {
    status: 'done',
    wrong_count: current?.wrong_count ?? 0,
    correct_streak: 0,
    starred: current?.starred ?? 0,
  };
  saveState(userId, questionId, next);
  return next;
}

export function toggleStar(userId, questionId) {
  const current = getState(userId, questionId);
  const next = {
    status: current?.status ?? 'unseen',
    wrong_count: current?.wrong_count ?? 0,
    correct_streak: current?.correct_streak ?? 0,
    starred: current?.starred ? 0 : 1,
  };
  saveState(userId, questionId, next);
  return next;
}
