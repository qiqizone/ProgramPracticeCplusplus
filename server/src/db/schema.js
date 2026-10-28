export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS questions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  slug               TEXT NOT NULL UNIQUE,
  chapter            INTEGER NOT NULL,
  type               TEXT NOT NULL,
  difficulty         TEXT NOT NULL DEFAULT 'medium',
  stem               TEXT NOT NULL,
  options            TEXT,
  answer             TEXT NOT NULL,
  explanation        TEXT NOT NULL,
  hints              TEXT,
  reference_solution TEXT,
  order_index        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer      TEXT NOT NULL,
  is_correct  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS question_states (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id    INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  status         TEXT NOT NULL,
  wrong_count    INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  starred        INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS knowledge_points (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  chapter       INTEGER NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  reference_url TEXT,
  order_index   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS knowledge_exercises (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  stem         TEXT NOT NULL,
  options      TEXT NOT NULL,
  answer       TEXT NOT NULL,
  explanation  TEXT NOT NULL,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS knowledge_exercise_states (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id    INTEGER NOT NULL REFERENCES knowledge_exercises(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'wrong',
  wrong_count    INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chapter ON knowledge_points(chapter, order_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_exercises_kp ON knowledge_exercises(knowledge_id, order_index);
CREATE INDEX IF NOT EXISTS idx_knowledge_exercise_states_user ON knowledge_exercise_states(user_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter, order_index);
CREATE INDEX IF NOT EXISTS idx_attempts_user_time  ON attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_states_user_status ON question_states(user_id, status);
`;
