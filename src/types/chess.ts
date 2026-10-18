import type { Square } from "chess.js";

export type Lesson = {
  title: string;
  subtitle: string;
  concept: string;
  task: string;
  fen: string;
  from: Square;
  to: Square;
  why: string;
};
export type Progress = {
  completed: number[];
  days: string[];
  daily: string[];
  games: number;
  xp: number;
};
