import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import {
  lessons,
  chooseMove,
  dayKey,
  dailyLesson,
  emptyProgress,
  parseProgress,
  streak,
} from "./model.ts";

test("every beginner mission starts with a legal move and reaches its stated position", () => {
  for (const lesson of lessons) {
    const game = new Chess(lesson.fen);
    const move = game.move({
      from: lesson.from,
      to: lesson.to,
      promotion: "q",
    });
    assert.equal(move.to, lesson.to, lesson.title);
    assert.ok(game.get(lesson.to), lesson.title);
  }
});
test("lessons never offer a king capture or start with the other king in check", () => {
  for (const lesson of lessons) {
    const game = new Chess(lesson.fen);
    const otherKing = game
      .board()
      .flat()
      .find((piece) => piece?.type === "k" && piece.color !== game.turn());
    assert.ok(otherKing, lesson.title);
    assert.equal(
      game.isAttacked(otherKing.square, game.turn()),
      false,
      lesson.title,
    );
    assert.equal(
      game.moves({ verbose: true }).some((move) => move.captured === "k"),
      false,
      lesson.title,
    );
  }
});

test("special lessons teach real castling, en passant, promotion, and checkmate", () => {
  const castle = new Chess(lessons[8].fen);
  castle.move({ from: "e1", to: "g1" });
  assert.equal(castle.get("f1")?.type, "r");
  assert.equal(castle.get("h1"), undefined);
  const promotion = new Chess(lessons[9].fen);
  promotion.move({ from: "e7", to: "e8", promotion: "q" });
  assert.equal(promotion.get("e8")?.type, "q");
  const ep = new Chess(lessons[10].fen);
  ep.move({ from: "e5", to: "d6" });
  assert.equal(ep.get("d5"), undefined);
  const mate = new Chess(lessons[11].fen);
  mate.move({ from: "g6", to: "g7" });
  assert.equal(mate.isCheckmate(), true);
});
test("rules reject ignoring check and castling through check", () => {
  const checked = new Chess("4r2k/8/8/8/8/8/P7/4K3 w - - 0 1");
  assert.throws(() => checked.move("a3"));
  const castle = new Chess("5r1k/8/8/8/8/8/8/4K2R w K - 0 1");
  assert.equal(castle.moves().includes("O-O"), false);
});
test("all computer levels return legal moves, without changing the input position", () => {
  const game = new Chess();
  game.move("e4");
  const fen = game.fen();
  for (const level of [0, 1, 2]) {
    const move = chooseMove(fen, level);
    assert.ok(move);
    const replay = new Chess(fen);
    assert.doesNotThrow(() => replay.move(move));
    assert.equal(game.fen(), fen);
  }
});
test("computer recognises mate and does not move in a finished game", () => {
  const game = new Chess(lessons[11].fen);
  const move = chooseMove(game.fen(), 2);
  assert.ok(move);
  game.move(move);
  assert.equal(game.isCheckmate(), true);
  assert.equal(chooseMove(game.fen(), 2), null);
  assert.equal(chooseMove("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", 1), null);
});
test("progress survives a round trip and rejects malformed browser data", () => {
  const progress = {
    completed: [0, 3],
    days: ["2026-10-18"],
    daily: ["2026-10-18"],
    games: 2,
    xp: 115,
  };
  assert.deepEqual(parseProgress(JSON.stringify(progress)), progress);
  for (const raw of [
    null,
    "bad json",
    "{}",
    '{"completed":{}}',
    JSON.stringify({ ...progress, xp: "115" }),
    JSON.stringify({ ...progress, games: -1 }),
  ])
    assert.deepEqual(parseProgress(raw), emptyProgress());
  assert.deepEqual(
    parseProgress(
      JSON.stringify({
        ...progress,
        completed: [0, 0, -1, 99, "2", 3],
        days: ["no", "2026-02-30", "2026-10-18"],
      }),
    ).completed,
    [0, 3],
  );
  assert.deepEqual(
    parseProgress(
      JSON.stringify({ ...progress, days: ["2026-02-30", "2026-10-18"] }),
    ).days,
    ["2026-10-18"],
  );
});
test("streak gives yesterday a grace period and handles month boundaries", () => {
  const now = new Date(2026, 9, 1, 9);
  assert.equal(streak(["2026-09-29", "2026-09-30"], now), 2);
  assert.equal(streak(["2026-09-29", "2026-09-30", "2026-10-01"], now), 3);
  assert.equal(streak(["2026-09-29"], now), 0);
  assert.equal(dayKey(now), "2026-10-01");
});
test("daily missions are stable within a local calendar day and rotate over a week", () => {
  assert.equal(
    dailyLesson(new Date(2026, 9, 18, 1)),
    dailyLesson(new Date(2026, 9, 18, 23)),
  );
  assert.equal(
    new Set(
      Array.from(
        { length: 7 },
        (_, i) => dailyLesson(new Date(2026, 9, 18 + i)).title,
      ),
    ).size,
    7,
  );
});
