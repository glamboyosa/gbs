import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Chess, type Move, type Square } from "chess.js";
import {
  dailyLesson,
  dayKey,
  lessons,
  parseProgress,
  pieceNames,
  streak,
} from "./model";
import { Piece } from "./Piece";
import type { Progress } from "../../types/chess";
import "./chess.css";

type View = "learn" | "play" | "journey";
type Activity = "lesson" | "daily";
type Drag = {
  from: Square;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
};
const storageKey = "gbs-little-chess-v1";
const files = "abcdefgh";
const squares = Array.from(
  { length: 64 },
  (_, i) => `${files[i % 8]}${8 - Math.floor(i / 8)}` as Square,
);
const identityMap = (game: Chess) =>
  Object.fromEntries(
    game
      .board()
      .flat()
      .filter(Boolean)
      .map((p) => [p!.square, `${p!.color}-${p!.type}-${p!.square}`]),
  );
const gameStatus = (game: Chess) => {
  if (game.isCheckmate())
    return game.turn() === "b"
      ? "Checkmate. You won! Beautifully played."
      : "Checkmate. Pip wins this one. Every game teaches you something.";
  if (game.isStalemate())
    return "Stalemate. No legal moves, but no check. The game is a draw.";
  if (game.isThreefoldRepetition())
    return "A draw: this position has appeared three times.";
  if (game.isInsufficientMaterial())
    return "A draw: neither side has enough pieces to deliver checkmate.";
  if (game.isDrawByFiftyMoves())
    return "A draw: 50 moves each without a pawn move or capture.";
  if (game.isCheck())
    return game.turn() === "w"
      ? "You’re in check. Move your king, block, or capture the attacker."
      : "Pip is in check!";
  return game.turn() === "w"
    ? "Your turn. Take your time."
    : "Pip is thinking…";
};

const ChessClub = () => {
  const [view, setView] = useState<View>("learn");
  const [activity, setActivity] = useState<Activity>("lesson");
  const [progress, setProgress] = useState<Progress>(() =>
    parseProgress(localStorageSafeRead()),
  );
  const [lessonIndex, setLessonIndex] = useState(() =>
    Math.max(
      0,
      lessons.findIndex((_, i) => !progress.completed.includes(i)),
    ),
  );
  const [daily, setDaily] = useState(dailyLesson);
  const [game, setGame] = useState(() => new Chess(lessons[lessonIndex].fen));
  const [fen, setFen] = useState(game.fen());
  const ids = useRef(identityMap(game));
  const [selected, setSelected] = useState<Square | null>(null);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState(false);
  const [hint, setHint] = useState(false);
  const [level, setLevel] = useState(0);
  const [showMoves, setShowMoves] = useState(true);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [engineError, setEngineError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reward, setReward] = useState("");
  const gameRewarded = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const promotionDialog = useRef<HTMLDialogElement>(null);
  const reducedMotion = useReducedMotion();
  const lesson = activity === "daily" ? daily : lessons[lessonIndex];

  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      setStorageWarning(
        "Progress cannot be saved in this browser. You can still play and learn.",
      );
    }
  }, [progress, ready]);
  useEffect(() => {
    if (!promotion) return;
    promotionDialog.current?.showModal();
    return () => promotionDialog.current?.close();
  }, [promotion]);
  useEffect(() => {
    if (!reward) return;
    const timer = window.setTimeout(() => setReward(""), 4500);
    return () => window.clearTimeout(timer);
  }, [reward]);

  const award = (kind: "lesson" | "daily" | "game") => {
    const today = dayKey();
    setProgress((previous) => {
      const exists =
        kind === "lesson"
          ? previous.completed.includes(lessonIndex)
          : kind === "daily"
            ? previous.daily.includes(today)
            : false;
      if (exists) return previous;
      const xp = kind === "lesson" ? 25 : kind === "daily" ? 35 : 15;
      return {
        ...previous,
        xp: previous.xp + xp,
        days: [...new Set([...previous.days, today])],
        completed:
          kind === "lesson"
            ? [...previous.completed, lessonIndex]
            : previous.completed,
        daily: kind === "daily" ? [...previous.daily, today] : previous.daily,
        games: previous.games + (kind === "game" ? 1 : 0),
      };
    });
  };
  const sync = () => {
    setFen(game.fen());
    setSelected(null);
    setDrag(null);
  };
  const apply = (move: Move) => {
    const moved = game.move(move);
    const next = { ...ids.current };
    next[move.to] = next[move.from];
    delete next[move.from];
    if (moved.isEnPassant()) delete next[`${move.to[0]}${move.from[1]}`];
    if (moved.isKingsideCastle() || moved.isQueensideCastle()) {
      const rank = move.from[1];
      const rookFrom = `${moved.isKingsideCastle() ? "h" : "a"}${rank}`;
      const rookTo = `${moved.isKingsideCastle() ? "f" : "d"}${rank}`;
      next[rookTo] = next[rookFrom];
      delete next[rookFrom];
    }
    ids.current = next;
    sync();
    return moved;
  };
  const finishGame = () => {
    if (game.isGameOver() && !gameRewarded.current) {
      award("game");
      gameRewarded.current = true;
      setReward("+15 XP · A game played is a lesson learned.");
    }
  };

  useEffect(() => {
    if (view !== "play" || game.turn() !== "b" || game.isGameOver()) return;
    let worker: Worker | undefined;
    const timer = window.setTimeout(() => {
      try {
        worker = new Worker(new URL("./opponent.worker.ts", import.meta.url), {
          type: "module",
        });
        worker.onerror = () => {
          setEngineError(true);
          worker?.terminate();
        };
        worker.onmessage = (
          event: MessageEvent<{
            from: Square;
            to: Square;
            promotion?: string;
          } | null>,
        ) => {
          if (!event.data) {
            setEngineError(true);
            return;
          }
          const move = game
            .moves({ verbose: true })
            .find(
              (m) =>
                m.from === event.data!.from &&
                m.to === event.data!.to &&
                m.promotion === event.data!.promotion,
            );
          if (!move) {
            setEngineError(true);
            return;
          }
          apply(move);
          setFeedback(
            `Pip moved the ${pieceNames[move.piece]} from ${move.from} to ${move.to}.${move.captured ? ` Your ${pieceNames[move.captured]} was captured.` : ""}`,
          );
          finishGame();
          worker?.terminate();
        };
        worker.postMessage({ fen, level });
      } catch {
        setEngineError(true);
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [fen, view, level, retry]);

  const resetBoard = (next: Chess) => {
    setGame(next);
    setFen(next.fen());
    ids.current = identityMap(next);
    setSelected(null);
    setDrag(null);
    setPromotion(null);
    setComplete(false);
    setFeedback("");
    setHint(false);
    setEngineError(false);
    setReward("");
  };
  const openLesson = (index: number) => {
    setView("learn");
    setActivity("lesson");
    setLessonIndex(index);
    resetBoard(new Chess(lessons[index].fen));
  };
  const openDaily = () => {
    const next = dailyLesson();
    setDaily(next);
    setView("learn");
    setActivity("daily");
    resetBoard(new Chess(next.fen));
  };
  const newGame = () => {
    setView("play");
    gameRewarded.current = false;
    resetBoard(new Chess());
  };
  const switchView = (next: View) => {
    if (next === view) return;
    if (next === "play") newGame();
    else if (next === "learn") {
      const nextLesson = lessons.findIndex(
        (_, i) => !progress.completed.includes(i),
      );
      openLesson(nextLesson < 0 ? 0 : nextLesson);
    } else {
      setView("journey");
      setPromotion(null);
    }
  };
  const tryMove = (from: Square, to: Square, promote?: string) => {
    if (
      complete ||
      game.turn() !== "w" ||
      (view === "play" && game.isGameOver())
    )
      return;
    const possible = game
      .moves({ square: from, verbose: true })
      .filter((m) => m.to === to);
    if (!possible.length) {
      setFeedback(
        "That move isn’t legal. Tap a piece to explore its available moves.",
      );
      return;
    }
    if (view === "learn" && (from !== lesson.from || to !== lesson.to)) {
      setFeedback(
        `A legal move! For this exercise, ${lesson.task.charAt(0).toLowerCase()}${lesson.task.slice(1)}`,
      );
      return;
    }
    if (possible.some((m) => m.promotion) && !promote) {
      setPromotion({ from, to });
      return;
    }
    const move = possible.find((m) => m.promotion === promote);
    if (!move) return;
    if (
      view === "learn" &&
      lessonIndex === 9 &&
      activity === "lesson" &&
      promote !== "q"
    ) {
      setFeedback(
        "That promotion is legal. Try choosing a queen for this exercise.",
      );
      setPromotion(null);
      return;
    }
    apply(move);
    setPromotion(null);
    if (view === "learn") {
      setComplete(true);
      setFeedback(lesson.why);
      award(activity);
      const already =
        activity === "daily"
          ? progress.daily.includes(dayKey())
          : progress.completed.includes(lessonIndex);
      setReward(
        already
          ? "Nicely done. Practice makes it stick."
          : `+${activity === "daily" ? 35 : 25} XP · Look at you go!`,
      );
    } else {
      setFeedback(
        `You moved your ${pieceNames[move.piece]} to ${to}.${move.captured ? ` You captured a ${pieceNames[move.captured]}.` : ""}`,
      );
      finishGame();
    }
  };
  const tap = (square: Square) => {
    if (game.get(square)?.color === "w") {
      setSelected(selected === square ? null : square);
      setFeedback("");
    } else if (selected) tryMove(selected, square);
  };
  const undo = () => {
    if (!game.history().length) return;
    game.undo();
    if (game.turn() === "b") game.undo();
    ids.current = identityMap(game);
    sync();
    setFeedback("Rewound to your turn. Try another idea.");
    setEngineError(false);
  };
  const hintMove = () => {
    setHint(true);
    if (view === "learn") {
      setSelected(lesson.from);
      setFeedback(`Look for ${lesson.from}, then ${lesson.to}. ${lesson.task}`);
    } else {
      const captures = game.moves({ verbose: true }).filter((m) => m.captured);
      const move =
        captures[0] ??
        game
          .moves({ verbose: true })
          .find((m) => m.to === "e4" || m.to === "d4") ??
        game.moves({ verbose: true })[0];
      if (move) {
        setSelected(move.from);
        setFeedback(
          `One legal idea: move your ${pieceNames[move.piece]} from ${move.from} to ${move.to}${move.captured ? ` to capture a ${pieceNames[move.captured]}` : ""}. Before you do, check which enemy pieces attack that square. This is a suggestion, not necessarily the best move.`,
        );
      }
    }
  };
  const legal =
    selected && !complete && game.turn() === "w" && !game.isGameOver()
      ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
      : [];
  // Exercises can intentionally use positions where neither side can force mate.
  const lessonLegal =
    selected && view === "learn" && !complete
      ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
      : legal;
  const history = game.history();
  const lastMove = game.history({ verbose: true }).at(-1);
  const levelName = Math.floor(progress.xp / 100) + 1;
  const currentStreak = streak(progress.days);
  const checkSquare = game.isCheck()
    ? game
        .board()
        .flat()
        .find((p) => p?.type === "k" && p.color === game.turn())?.square
    : null;
  const frozen =
    complete || (view === "play" && (game.turn() !== "w" || game.isGameOver()));

  return (
    <div className="chess-app">
      <header className="club-header">
        <a className="club-wordmark" href="/chess">
          <span className="brand-mark">♞</span>
          <span>
            little chess club<span className="wordmark-dot">.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {(["learn", "play", "journey"] as View[]).map((item) => (
            <button
              key={item}
              className={view === item ? "nav-active" : ""}
              aria-current={view === item ? "page" : undefined}
              onClick={() => switchView(item)}
            >
              <span aria-hidden="true">
                {item === "learn" ? "✦" : item === "play" ? "♟" : "↗"}
              </span>{" "}
              {item === "journey"
                ? "Your journey"
                : item === "learn"
                  ? "Learn"
                  : "Play"}
            </button>
          ))}
        </nav>
        <a href="/" className="back-gbs">
          a little corner of GBS ↗
        </a>
      </header>
      <main>
        <section className="welcome">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> A LITTLE BETTER, ONE MOVE AT A TIME
            </div>
            <h1>
              {view === "journey" ? (
                "Look how far you’ve come."
              ) : view === "play" ? (
                "Make a little room for play."
              ) : (
                <>
                  Big brain energy.
                  <br />
                  <em>Small, happy steps.</em>
                </>
              )}
            </h1>
            <p>
              {view === "journey"
                ? "Every tiny discovery counts. This is your corner of the board."
                : view === "play"
                  ? "No clock. No ratings. Just you, a friendly opponent, and the next move."
                  : "You don’t have to be a prodigy. Just curious. Let’s learn chess, together."}
            </p>
          </div>
          <div
            className="progress-pill"
            aria-label={`${currentStreak} day streak, ${progress.xp} experience points`}
          >
            <span className="streak-icon">✹</span>
            <div>
              <b>
                {currentStreak} day{currentStreak === 1 ? "" : "s"} of curiosity
              </b>
              <span>
                Level {levelName} · {progress.xp} XP
              </span>
            </div>
            <div className="tiny-progress">
              <span style={{ width: `${progress.xp % 100}%` }} />
            </div>
          </div>
        </section>
        {storageWarning && (
          <p className="storage-warning" role="status">
            {storageWarning}
          </p>
        )}
        {view !== "journey" ? (
          <>
            <div className="workbench">
              <section
                className="board-card"
                aria-label="Interactive chess board"
              >
                <div className="board-top">
                  <div className="opponent-avatar">
                    {view === "play" ? "♞" : "✧"}
                  </div>
                  <div>
                    <b>
                      {view === "play"
                        ? "Pip, your practice pal"
                        : activity === "daily"
                          ? "Today’s little challenge"
                          : "Your practice playground"}
                    </b>
                    <span>
                      {view === "play"
                        ? [
                            "Just learning · makes random legal moves",
                            "Getting curious · looks for captures",
                            "A little challenge · looks one reply ahead",
                          ][level]
                        : "A safe place to try things"}
                    </span>
                  </div>
                  <span className="board-tag">
                    {view === "play" ? "COMPUTER" : "GUIDED"}
                  </span>
                </div>
                <div className="mobile-mission" aria-hidden="true">
                  <b>
                    {view === "play"
                      ? gameStatus(game)
                      : complete
                        ? "You’ve got it!"
                        : lesson.title}
                  </b>
                  {view === "learn" && (
                    <p>{complete ? lesson.why : lesson.task}</p>
                  )}
                </div>
                <div className="board-frame">
                  <div className="rank-labels" aria-hidden="true">
                    {[8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                  <div
                    ref={board}
                    className={`chess-board ${drag && Math.hypot(drag.dx, drag.dy) > 6 ? "is-dragging" : ""}`}
                    role="group"
                    aria-label="Chessboard. White moves toward rank eight. Tap a piece, then a destination, or drag a piece."
                    onPointerDown={(e) => {
                      if (frozen || e.button !== 0) return;
                      const square = (
                        e.target as HTMLElement
                      ).closest<HTMLButtonElement>("[data-square]")?.dataset
                        .square as Square | undefined;
                      if (!square || game.get(square)?.color !== "w") return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDrag({
                        from: square,
                        startX: e.clientX,
                        startY: e.clientY,
                        dx: 0,
                        dy: 0,
                      });
                    }}
                    onPointerMove={(e) => {
                      if (drag)
                        setDrag({
                          ...drag,
                          dx: e.clientX - drag.startX,
                          dy: e.clientY - drag.startY,
                        });
                    }}
                    onPointerCancel={() => setDrag(null)}
                    onPointerUp={(e) => {
                      if (!drag) return;
                      if (Math.hypot(drag.dx, drag.dy) > 6) {
                        const bounds = e.currentTarget.getBoundingClientRect();
                        const x = Math.floor(
                          (e.clientX - bounds.left) / (bounds.width / 8),
                        );
                        const y = Math.floor(
                          (e.clientY - bounds.top) / (bounds.height / 8),
                        );
                        if (x >= 0 && x < 8 && y >= 0 && y < 8)
                          tryMove(drag.from, `${files[x]}${8 - y}` as Square);
                      } else {
                        tap(drag.from);
                      }
                      setDrag(null);
                    }}
                  >
                    {squares.map((square, i) => {
                      const p = game.get(square);
                      const last = lastMove;
                      const available = lessonLegal.includes(square);
                      return (
                        <button
                          key={square}
                          data-square={square}
                          className={`square ${(Math.floor(i / 8) + (i % 8)) % 2 ? "dark-square" : "light-square"} ${selected === square ? "selected-square" : ""} ${last && (last.from === square || last.to === square) ? "last-square" : ""} ${checkSquare === square ? "check-square" : ""} ${hint && view === "learn" && square === lesson.to ? "hint-square" : ""}`}
                          aria-label={`${square}${p ? `, ${p.color === "w" ? "white" : "black"} ${pieceNames[p.type]}` : ", empty"}${available && showMoves ? ", legal destination" : ""}`}
                          aria-pressed={selected === square}
                          disabled={frozen}
                          onClick={(e) => {
                            if (
                              e.detail === 0 ||
                              game.get(square)?.color !== "w"
                            )
                              tap(square);
                          }}
                        >
                          {available && showMoves && (
                            <span className={p ? "capture-ring" : "move-dot"} />
                          )}
                        </button>
                      );
                    })}
                    {game
                      .board()
                      .flat()
                      .filter(Boolean)
                      .map((p) => (
                        <motion.div
                          key={ids.current[p!.square] ?? p!.square}
                          layout={!drag && !reducedMotion}
                          initial={false}
                          transition={{
                            layout: {
                              duration: reducedMotion ? 0 : 0.2,
                              ease: [0.32, 0.72, 0, 1],
                            },
                            x: { duration: 0 },
                            y: { duration: 0 },
                          }}
                          animate={{
                            x: drag?.from === p!.square ? drag.dx : 0,
                            y: drag?.from === p!.square ? drag.dy : 0,
                          }}
                          className={`board-piece ${p!.color === "w" ? "white-piece" : "black-piece"}`}
                          style={{
                            left: `${files.indexOf(p!.square[0]) * 12.5}%`,
                            top: `${(8 - Number(p!.square[1])) * 12.5}%`,
                            zIndex:
                              drag?.from === p!.square
                                ? "var(--z-drag)"
                                : "var(--z-piece)",
                          }}
                        >
                          <Piece type={p!.type} color={p!.color} />
                        </motion.div>
                      ))}
                  </div>
                  <div className="file-labels" aria-hidden="true">
                    {files.split("").map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                </div>
                <div className="board-bottom">
                  <span>
                    <span className="white-dot" /> You’re playing white
                  </span>
                  <span>Tap or drag to move</span>
                </div>
                <div className="board-tools">
                  <button onClick={hintMove} disabled={frozen}>
                    ✧ Give me a hint
                  </button>
                  {view === "play" ? (
                    <button onClick={undo} disabled={!history.length}>
                      ↶ Undo turn
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        activity === "daily"
                          ? openDaily()
                          : openLesson(lessonIndex)
                      }
                    >
                      ↶ Try again
                    </button>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={showMoves}
                      onChange={(e) => setShowMoves(e.target.checked)}
                    />{" "}
                    Show legal moves
                  </label>
                </div>
              </section>
              <aside className="coach-panel">
                <div className="eyebrow">
                  {view === "play"
                    ? "A FRIENDLY MATCH"
                    : activity === "daily"
                      ? "YOUR DAILY MOMENT · +35 XP"
                      : `THE BASICS · LESSON ${String(lessonIndex + 1).padStart(2, "0")} OF ${lessons.length}`}
                </div>
                <h2>{view === "play" ? "Meet Pip." : lesson.title}</h2>
                <p className="coach-subtitle">
                  {view === "play"
                    ? "A practice pal, not a grandmaster."
                    : lesson.subtitle}
                </p>
                {view === "play" ? (
                  <>
                    <p>
                      Pip is here to help you get comfortable. Start gently,
                      take back a move, and try things. There’s no rush.
                    </p>
                    <label className="difficulty-label" htmlFor="difficulty">
                      How shall we play?
                    </label>
                    <select
                      id="difficulty"
                      value={level}
                      onChange={(e) => {
                        setLevel(Number(e.target.value));
                        setEngineError(false);
                      }}
                    >
                      <option value="0">Just learning · very gentle</option>
                      <option value="1">Getting curious · gentle</option>
                      <option value="2">A little challenge</option>
                    </select>
                    <div
                      className={`mission ${game.isGameOver() ? "mission-done" : ""}`}
                    >
                      <span className="mission-icon">
                        {game.isGameOver() ? "✦" : "♙"}
                      </span>
                      <div>
                        <b>
                          {game.isGameOver()
                            ? "A little wiser."
                            : game.turn() === "w"
                              ? "Your move"
                              : "Pip’s move"}
                        </b>
                        <p role="status">{gameStatus(game)}</p>
                      </div>
                    </div>
                    <button className="primary-button" onClick={newGame}>
                      {game.isGameOver()
                        ? "Play another game"
                        : "Start a fresh game"}{" "}
                      <span>↗</span>
                    </button>
                  </>
                ) : (
                  <>
                    <p>{lesson.concept}</p>
                    <div
                      className={`mission ${complete ? "mission-done" : ""}`}
                    >
                      <span className="mission-icon">
                        {complete ? "✓" : "↗"}
                      </span>
                      <div>
                        <b>
                          {complete ? "You’ve got it!" : "Your little mission"}
                        </b>
                        <p>{complete ? lesson.why : lesson.task}</p>
                      </div>
                    </div>
                    {complete ? (
                      <button
                        className="primary-button"
                        onClick={() =>
                          activity === "daily"
                            ? openLesson(
                                Math.min(
                                  progress.completed.length,
                                  lessons.length - 1,
                                ),
                              )
                            : lessonIndex < lessons.length - 1
                              ? openLesson(lessonIndex + 1)
                              : newGame()
                        }
                      >
                        {activity === "daily"
                          ? "Keep exploring"
                          : lessonIndex < lessons.length - 1
                            ? "Next little lesson"
                            : "Let’s play a game"}{" "}
                        <span>→</span>
                      </button>
                    ) : (
                      <div className="gentle-note">
                        <span>♡</span> No wrong answers here. Just things to
                        discover.
                      </div>
                    )}
                  </>
                )}
                <div
                  className="coach-feedback"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {feedback ||
                    (view === "learn"
                      ? "Tip: tap a white piece. The dots show where it can go."
                      : "Tip: bring your knights and bishops out, aim for the centre, and keep your king safe.")}
                </div>
                {engineError && (
                  <div role="alert" className="engine-error">
                    Pip couldn’t choose a move.{" "}
                    <button
                      onClick={() => {
                        setEngineError(false);
                        setRetry(retry + 1);
                      }}
                    >
                      Try again
                    </button>{" "}
                    or undo your turn.
                  </div>
                )}
                {view === "play" && (
                  <div className="move-history">
                    <h3>Your game, move by move</h3>
                    {history.length ? (
                      <ol>
                        {Array.from(
                          { length: Math.ceil(history.length / 2) },
                          (_, i) => (
                            <li key={i}>
                              <span>{history[i * 2]}</span>
                              <span>{history[i * 2 + 1] ?? "…"}</span>
                            </li>
                          ),
                        )}
                      </ol>
                    ) : (
                      <p>Your story starts with the first move.</p>
                    )}
                    <details>
                      <summary>What do these letters mean?</summary>
                      <p>
                        K = king, Q = queen, R = rook, B = bishop, N = knight. A
                        pawn move has no letter. “x” is a capture, “+” is check,
                        “#” is checkmate, and O-O means castling.
                      </p>
                    </details>
                  </div>
                )}
                {view === "learn" && (
                  <div className="lesson-progress">
                    <div>
                      <span>Your foundations</span>
                      <b>
                        {progress.completed.length}/{lessons.length}
                      </b>
                    </div>
                    <div className="progress-track">
                      <span
                        style={{
                          width: `${(progress.completed.length / lessons.length) * 100}%`,
                        }}
                      />
                    </div>
                    <small>Little by little is a lovely way to learn.</small>
                  </div>
                )}
              </aside>
            </div>
            {view === "learn" && (
              <section className="learning-section">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">START HERE. GO ANYWHERE.</div>
                    <h2>Your first moves.</h2>
                  </div>
                  <span>All lessons unlocked. Always.</span>
                </div>
                <div className="lesson-grid">
                  {lessons.map((item, i) => (
                    <button
                      key={item.title}
                      className={`lesson-card ${activity === "lesson" && lessonIndex === i ? "current-lesson" : ""}`}
                      onClick={() => {
                        openLesson(i);
                        board.current?.scrollIntoView({
                          behavior: reducedMotion ? "instant" : "smooth",
                          block: "center",
                        });
                      }}
                    >
                      <span className="lesson-number">
                        {progress.completed.includes(i)
                          ? "✓"
                          : String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <b>{item.title}</b>
                        <span>{item.subtitle}</span>
                      </div>
                      <span className="lesson-arrow">↗</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section className="daily-banner">
              <div className="daily-art" aria-hidden="true">
                ✹
              </div>
              <div>
                <div className="eyebrow">A TINY DAILY RITUAL</div>
                <h2>
                  {progress.daily.includes(dayKey())
                    ? "Today’s little win: collected."
                    : "Five minutes. One small win."}
                </h2>
                <p>
                  {progress.daily.includes(dayKey())
                    ? "Come back tomorrow for a different challenge. Or play again for the joy of it."
                    : "A rotating challenge to keep the good moves growing. No streak guilt, we promise."}
                </p>
              </div>
              <button onClick={openDaily}>
                {progress.daily.includes(dayKey())
                  ? "Play it again"
                  : "Try today’s challenge"}{" "}
                <span>↗</span>
              </button>
            </section>
          </>
        ) : (
          <section className="journey">
            <div className="journey-stats">
              <article>
                <span>✦</span>
                <b>{progress.xp}</b>
                <p>curiosity points</p>
              </article>
              <article>
                <span>✓</span>
                <b>
                  {progress.completed.length}
                  <small> / {lessons.length}</small>
                </b>
                <p>lessons discovered</p>
              </article>
              <article>
                <span>♟</span>
                <b>{progress.games}</b>
                <p>games played</p>
              </article>
              <article>
                <span>✹</span>
                <b>{currentStreak}</b>
                <p>day{currentStreak === 1 ? "" : "s"} of curiosity</p>
              </article>
            </div>
            <h2>Little milestones, big smiles.</h2>
            <p>
              Finish lessons for 25 XP, daily challenges for 35 XP, and games
              for 15 XP. Replaying lessons is always welcome; XP is awarded once
              per lesson and once per daily challenge.
            </p>
            <div className="badge-grid">
              {[
                {
                  icon: "♙",
                  name: "First little step",
                  text: "Complete your first lesson",
                  earned: progress.completed.length > 0,
                },
                {
                  icon: "♛",
                  name: "Foundations found",
                  text: "Discover all 12 lessons",
                  earned: progress.completed.length === lessons.length,
                },
                {
                  icon: "♞",
                  name: "Here to play",
                  text: "Finish a game with Pip",
                  earned: progress.games > 0,
                },
                {
                  icon: "✹",
                  name: "A lovely little habit",
                  text: "Learn on three days in a row",
                  earned: currentStreak >= 3,
                },
              ].map((badge) => (
                <article
                  key={badge.name}
                  className={`badge ${badge.earned ? "earned" : ""}`}
                >
                  <span>{badge.icon}</span>
                  <b>{badge.name}</b>
                  <p>{badge.text}</p>
                  <small>
                    {badge.earned ? "DISCOVERED ✓" : "WAITING FOR YOU"}
                  </small>
                </article>
              ))}
            </div>
            <div className="journey-bottom">
              <p>
                Progress lives in this browser, on this device. No account, no
                leaderboard, no catching up.
              </p>
              <button
                className="primary-button"
                onClick={() =>
                  openLesson(
                    lessons.findIndex(
                      (_, i) => !progress.completed.includes(i),
                    ) < 0
                      ? 0
                      : lessons.findIndex(
                          (_, i) => !progress.completed.includes(i),
                        ),
                  )
                }
              >
                Back to the board →
              </button>
            </div>
          </section>
        )}
      </main>
      <footer>
        <span>
          Made for the love of learning.{" "}
          <span className="footer-flower">✳</span>
        </span>
        <a href="/">GBS ↗</a>
        <span>One move is enough for today.</span>
      </footer>
      {reward && (
        <div className="reward-toast" role="status">
          <span>✦</span> {reward}
        </div>
      )}
      {promotion && (
        <dialog
          ref={promotionDialog}
          className="promotion-dialog"
          onCancel={() => setPromotion(null)}
        >
          <h2>A little glow-up.</h2>
          <p>Choose what your pawn becomes.</p>
          <div>
            {["q", "r", "b", "n"].map((type) => (
              <button
                key={type}
                onClick={() => tryMove(promotion.from, promotion.to, type)}
              >
                <Piece type={type} color="w" />
                <span>{pieceNames[type]}</span>
              </button>
            ))}
          </div>
          <button className="text-button" onClick={() => setPromotion(null)}>
            Cancel
          </button>
        </dialog>
      )}
    </div>
  );
};

export default ChessClub;

const localStorageSafeRead = () => {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
};
