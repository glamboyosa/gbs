import { Chess, type Square } from "chess.js";
import type { Lesson, Progress } from "../../types/chess";

export const lessons: Lesson[] = [
  {
    title: "Meet the rook",
    subtitle: "Straight lines. Big possibilities.",
    concept:
      "The rook moves any number of clear squares in a straight line: up, down, left, or right. It cannot jump over pieces.",
    task: "Tap the rook on d4, then move it to d7.",
    fen: "7k/8/8/8/3R4/8/8/K7 w - - 0 1",
    from: "d4",
    to: "d7",
    why: "Three squares up, one straight line. That is a rook move.",
  },
  {
    title: "The bishop’s diagonal",
    subtitle: "Pick a colour. Stay with it.",
    concept:
      "Bishops slide diagonally as far as the path is clear. A bishop always stays on the same colour square.",
    task: "Move the bishop from c3 to f6.",
    fen: "k7/8/8/8/8/2B5/8/K7 w - - 0 1",
    from: "c3",
    to: "f6",
    why: "Up three and right three. Every square on that diagonal has the same colour.",
  },
  {
    title: "A little knight magic",
    subtitle: "The only piece that can jump.",
    concept:
      "Knights move in an L: two squares in one direction, then one sideways. They can jump over other pieces.",
    task: "Jump the knight from d4 to e6.",
    fen: "7k/8/8/3PPP2/3N4/8/8/K7 w - - 0 1",
    from: "d4",
    to: "e6",
    why: "Two up, one right. The pawns could not block your knight.",
  },
  {
    title: "The queen’s superpower",
    subtitle: "Rook + bishop = queen.",
    concept:
      "The queen combines rook and bishop moves. She can slide straight or diagonally, but cannot jump.",
    task: "Slide the queen from d4 to g7.",
    fen: "k7/8/8/8/3Q4/8/8/K7 w - - 0 1",
    from: "d4",
    to: "g7",
    why: "A diagonal move. Your queen can use straight lines too.",
  },
  {
    title: "One royal step",
    subtitle: "Keep your king safe.",
    concept:
      "The king moves one square in any direction. You can never move your king onto a square an enemy attacks.",
    task: "Move your king from e2 to e3.",
    fen: "7k/8/8/8/8/8/4K3/8 w - - 0 1",
    from: "e2",
    to: "e3",
    why: "One safe step forward. Your king’s safety is the heart of chess.",
  },
  {
    title: "Small pawn, big dreams",
    subtitle: "Forward, always forward.",
    concept:
      "White pawns move toward the top of this board. They move one square forward, or one or two on their first move if the way is clear. They never move backward.",
    task: "Give the pawn on e2 its first move: go to e4.",
    fen: "7k/8/8/8/8/8/4P3/K7 w - - 0 1",
    from: "e2",
    to: "e4",
    why: "Two squares on the first move. That option disappears after a pawn has moved.",
  },
  {
    title: "The sideways surprise",
    subtitle: "Pawns capture differently.",
    concept:
      "Pawns move straight forward but capture one square diagonally forward. Capturing removes the enemy piece from the board.",
    task: "Use the pawn on e4 to capture the black pawn on d5.",
    fen: "7k/8/8/3p4/4P3/8/8/K7 w - - 0 1",
    from: "e4",
    to: "d5",
    why: "A diagonal capture! A pawn cannot capture the piece directly in front of it.",
  },
  {
    title: "Get out of check",
    subtitle: "A warning, not the end.",
    concept:
      "“Check” means your king is under attack. You must escape immediately by moving the king, blocking the attack, or capturing the attacker.",
    task: "The rook attacks your king along the e-file. Escape from e1 to d1.",
    fen: "4r2k/8/8/8/8/8/8/4K3 w - - 0 1",
    from: "e1",
    to: "d1",
    why: "Your king is off the attacked line. You may never ignore check.",
  },
  {
    title: "Castle into safety",
    subtitle: "A special move for two pieces.",
    concept:
      "Castling moves the king two squares toward a rook, and that rook hops beside it. Neither may have moved, the path must be clear, and the king cannot be in check or cross an attacked square.",
    task: "Castle by moving the king from e1 to g1. Watch the rook follow.",
    fen: "4k3/8/8/8/8/8/8/4K2R w K - 0 1",
    from: "e1",
    to: "g1",
    why: "Two pieces moved in one turn. Your rook is now on f1, beside your king.",
  },
  {
    title: "A pawn grows up",
    subtitle: "Reach the end. Become more.",
    concept:
      "When a pawn reaches the farthest rank, it must become a queen, rook, bishop, or knight. Usually a queen is the strongest choice.",
    task: "Move the pawn from e7 to e8 and choose a queen.",
    fen: "7k/4P3/8/8/8/8/8/K7 w - - 0 1",
    from: "e7",
    to: "e8",
    why: "Your pawn became a queen! Promotion is why even a tiny pawn matters.",
  },
  {
    title: "The sneaky pawn rule",
    subtitle: "Meet en passant.",
    concept:
      "If an enemy pawn moves two squares and lands beside your pawn, you can capture it as if it moved only one. This special capture, en passant, must happen immediately on your next turn.",
    task: "Black just moved d7 to d5. Capture from e5 to d6.",
    fen: "7k/8/8/3pP3/8/8/8/K7 w - d6 0 2",
    from: "e5",
    to: "d6",
    why: "Your pawn landed on d6 and removed the pawn on d5. That is en passant.",
  },
  {
    title: "Your first checkmate",
    subtitle: "The aim of the game.",
    concept:
      "Checkmate means the king is in check with no legal escape. You win without capturing the king. If a player has no legal move but is NOT in check, that is stalemate: a draw.",
    task: "Move your queen from g6 to g7 to deliver checkmate.",
    fen: "7k/8/5KQ1/8/8/8/8/8 w - - 0 1",
    from: "g6",
    to: "g7",
    why: "Checkmate! Your queen checks the king and your king protects her. There is no escape.",
  },
];

export const pieceNames: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
export const values: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};
export const emptyProgress = (): Progress => ({
  completed: [],
  days: [],
  daily: [],
  games: 0,
  xp: 0,
});
export const dayKey = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const parseProgress = (raw: string | null): Progress => {
  try {
    const p = JSON.parse(raw ?? "null");
    if (
      !p ||
      !Array.isArray(p.completed) ||
      !Array.isArray(p.days) ||
      !Array.isArray(p.daily) ||
      !Number.isSafeInteger(p.games) ||
      p.games < 0 ||
      !Number.isSafeInteger(p.xp) ||
      p.xp < 0
    )
      return emptyProgress();
    return {
      completed: [
        ...new Set<number>(
          p.completed.filter(
            (n: unknown) =>
              typeof n === "number" &&
              Number.isInteger(n) &&
              n >= 0 &&
              n < lessons.length,
          ),
        ),
      ],
      days: [...new Set<string>(p.days.filter(validDay))],
      daily: [...new Set<string>(p.daily.filter(validDay))],
      games: p.games,
      xp: p.xp,
    };
  } catch {
    return emptyProgress();
  }
};
const validDay = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  dayKey(new Date(`${value}T12:00:00`)) === value;
export const streak = (days: string[], now = new Date()): number => {
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!days.includes(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.includes(dayKey(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
};
export const dailyLesson = (date = new Date()): Lesson =>
  lessons[
    [0, 2, 6, 7, 8, 10, 11][
      Math.floor(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
          86400000,
      ) % 7
    ]
  ];

/** Search from the side to move; mate outweighs material and closer mates score higher. */
const evaluate = (chess: Chess, depth: number): number => {
  if (chess.isCheckmate()) return -100000 - depth;
  if (chess.isDraw()) return 0;
  let score = 0;
  for (const row of chess.board())
    for (const piece of row)
      if (piece)
        score += values[piece.type] * (piece.color === chess.turn() ? 1 : -1);
  return score;
};
const search = (
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
): number => {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess, depth);
  let best = -Infinity;
  const moves = chess
    .moves({ verbose: true })
    .sort((a, b) => values[b.captured ?? "k"] - values[a.captured ?? "k"]);
  for (const move of moves) {
    chess.move(move);
    const score = -search(chess, depth - 1, -beta, -alpha);
    chess.undo();
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
};
export const chooseMove = (
  fen: string,
  level: number,
): { from: Square; to: Square; promotion?: string } | null => {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (chess.isGameOver() || !moves.length) return null;
  if (level === 0) return moves[Math.floor(Math.random() * moves.length)];
  let best = -Infinity;
  let chosen = moves[0];
  for (const move of moves.sort(() => Math.random() - 0.5)) {
    chess.move(move);
    const score = -search(chess, level === 1 ? 0 : 1, -Infinity, Infinity);
    chess.undo();
    if (score > best) {
      best = score;
      chosen = move;
    }
  }
  return { from: chosen.from, to: chosen.to, promotion: chosen.promotion };
};
