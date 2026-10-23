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
