export type Role = 'user' | 'admin';

export interface User {
  id: number;
  username: string;
  role: Role;
}

export interface ChapterStat {
  chapter: number;
  total: number;
  correct: number;
  done: number;
  wrong: number;
  mastery?: number;
}

export type QuestionType = 'single' | 'multiple' | 'output' | 'code';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: number;
  slug: string;
  chapter: number;
  type: QuestionType;
  difficulty: Difficulty;
  stem: string;
  options: Option[] | null;
  hints: string[] | null;
  orderIndex: number;
  status: string;
  starred: boolean;
  wrongCount: number;
}

export interface AttemptState {
  status: string;
  wrong_count: number;
  correct_streak: number;
  starred: number;
}

export interface AttemptResult {
  isCorrect: boolean | null;
  answer: string | string[] | null;
  explanation: string;
  referenceSolution: string | null;
  state: AttemptState;
}

export interface AdminQuestion extends Question {
  answer: string | string[] | null;
  explanation: string;
  referenceSolution: string | null;
}

export interface StatsData {
  totals: {
    attempts: number;
    choiceAttempts: number;
    correct: number;
    wrong: number;
    codeDone: number;
    accuracy: number;
  };
  wrongCount: number;
  starredCount: number;
  chapters: ChapterStat[];
  daily: { date: string; count: number }[];
}

export interface KnowledgeExercise {
  id: number;
  slug: string;
  knowledge_id: number;
  stem: string;
  options: Option[];
  order_index: number;
  status?: 'unseen' | 'wrong' | 'correct';
  wrong_count?: number;
  correct_streak?: number;
}

export interface KnowledgePoint {
  id: number;
  slug: string;
  chapter: number;
  title: string;
  summary: string;
  reference_url: string | null;
  order_index: number;
  exercises: KnowledgeExercise[];
}

export interface KnowledgeExerciseResult {
  isCorrect: boolean;
  answer: string;
  explanation: string;
  state: {
    status: 'wrong' | 'correct';
    wrong_count: number;
    correct_streak: number;
  };
}

export interface KnowledgeWrongExercise {
  id: number;
  slug: string;
  stem: string;
  options: Option[];
  order_index: number;
  point_slug: string;
  point_title: string;
  chapter: number;
  wrong_count: number;
  correct_streak: number;
}
