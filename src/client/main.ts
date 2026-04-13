import { Chess, Move, PieceSymbol, Square } from "chess.js";
import { io } from "socket.io-client";

import { BoardOrientation, SquareName, buildSquareList, isLightSquare } from "../../engine";
import "./theme-palette.css";
import "./button-animations.css";
import "./arrows.css";
import "./styles.css";
import "./account-sidebar.css";
import "./account-sidebar-import.css";
import "./badge-icon-colors.css";
import { buildArrowLayerMarkup } from "./arrow-render";
import { BestMoveArrow, canShowBestMoveArrow, parseBestMoveArrow } from "./best-move-arrow";
import { createAccountSidebarController } from "./account-sidebar";
import { createVoiceChatController } from "./live-chat";
import { mountThemeSwitcher } from "./theme";

type PlayerRole = "w" | "b";
type RoomRole = PlayerRole | "spectator";
type TimeControlPresetId = "blitz3" | "rapid10" | "blitz3p2";
type TimeControlPreset = {
  id: TimeControlPresetId;
  label: string;
  initialMs: number;
  incrementMs: number;
};
type PromotionPiece = "q" | "r" | "b" | "n";
type MoveCategory = "brilliant" | "great" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
type QualityResult = {
  category: MoveCategory;
  label: string;
};

type MoveSummary = {
  color: PlayerRole;
  from: Square;
  to: Square;
  san: string;
  piece: string;
};

type PgnHeaderOptions = {
  whiteName?: string;
  blackName?: string;
  result?: "1-0" | "0-1" | "1/2-1/2" | "*";
};

type RoomSnapshot = {
  roomId: string;
  ownerId: string | null;
  fen: string;
  turn: PlayerRole;
  status: string;
  winner: PlayerRole | null;
  check: boolean;
  checkmate: boolean;
  draw: boolean;
  moveCount: number;
  moves: MoveSummary[];
  lastMove: MoveSummary | null;

  players: {
    whiteConnected: boolean;
    blackConnected: boolean;
    spectatorCount: number;
    whiteName: string;
    blackName: string;
    whiteUserId: string | null;
    blackUserId: string | null;
    whiteFriendId: string | null;
    blackFriendId: string | null;
  };
  rematchVotes: number;
  analysis: {
    enabled: boolean;
    votes: number;
    locked: boolean;
    labelsOnly: boolean;
    labelsVotes: number;
  };
  undo: {
    pending: boolean;
    requester: PlayerRole | null;
  };
  isStarted: boolean;
  pregame: {
    p1Choice: "w" | "b" | null;
    p2Choice: "w" | "b" | null;
    p1Ready: boolean;
    p2Ready: boolean;
  };
  timeControl: TimeControlPreset;
  clock: {
    whiteMs: number;
    blackMs: number;
    active: PlayerRole | null;
    running: boolean;
    lowTimeThresholdMs: number;
    serverNowMs: number;
  };
};


type PendingPromotion = {
  from: Square;
  to: Square;
};

type IncomingFriendInvite = {
  inviteId: string;
  fromUserId: string;
  fromName: string;
  roomId: string;
};

type IncomingInGameFriendRequest = {
  requestId: string;
  fromUserId: string;
  fromName: string;
  fromFriendId: string;
};

type Premove = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
};



type AppState = {
  connected: boolean;
  roomId: string | null;
  role: RoomRole | null;
  shareUrl: string;
  snapshot: RoomSnapshot | null;
  orientation: BoardOrientation;
  selectedSquare: Square | null;
  legalTargets: Square[];
  toastMessage: string;
  pendingPromotion: PendingPromotion | null;
  premoves: Premove[]; 
  autoJoinCode: string | null;
  focusMode: boolean;
  liveAnalysisSummary: string;
  lastAnalyzedMoveKey: string | null;
  liveMoveGrades: Record<number, { label: string; cpl: number; category: "brilliant" | "great" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder" }>;
  animationStyle: "smooth" | "epic";
  bloodFxEnabled: boolean;
  gameMode: "multiplayer" | "bot";
  botLevel: number;
  botPickerOpen: boolean;
  viewCursor: number | null;
  trailFxEnabled: boolean; 
  legalMovesEnabled: boolean;
  bestMoveArrow: BestMoveArrow | null;
  bestMoveArrowFen: string | null;
};

type EngineEval = {
  cp: number;
  mate: number | null;
  bestMove: string;
  pv: string;
};

type BotDifficultyPreset = {
  level: number;
  label: string;
  elo: number | null;
  skillLevel: number;
  moveTimeMs: number;
  fullStrength: boolean;
};

type BotTimingProfile = "premove" | "quick" | "standard" | "deep";

type BotResponseTiming = {
  profile: BotTimingProfile;
  preDelayMs: number;
  engineMoveTimeMs: number;
};

const BOT_DIFFICULTY_PRESETS: BotDifficultyPreset[] = [
  { level: 1, label: "Level 1 - 800 Elo", elo: 800, skillLevel: 0, moveTimeMs: 90, fullStrength: false },
  { level: 2, label: "Level 2 - 1000 Elo", elo: 1000, skillLevel: 2, moveTimeMs: 120, fullStrength: false },
  { level: 3, label: "Level 3 - 1200 Elo", elo: 1200, skillLevel: 4, moveTimeMs: 170, fullStrength: false },
  { level: 4, label: "Level 4 - 1400 Elo", elo: 1400, skillLevel: 6, moveTimeMs: 240, fullStrength: false },
  { level: 5, label: "Level 5 - 1600 Elo", elo: 1600, skillLevel: 8, moveTimeMs: 330, fullStrength: false },
  { level: 6, label: "Level 6 - 1800 Elo", elo: 1800, skillLevel: 10, moveTimeMs: 460, fullStrength: false },
  { level: 7, label: "Level 7 - 2000 Elo", elo: 2000, skillLevel: 12, moveTimeMs: 620, fullStrength: false },
  { level: 8, label: "Level 8 - 2200 Elo", elo: 2200, skillLevel: 14, moveTimeMs: 820, fullStrength: false },
  { level: 9, label: "Level 9 - 2400 Elo", elo: 2400, skillLevel: 17, moveTimeMs: 1100, fullStrength: false },
  { level: 10, label: "Level 10 - Full Strength", elo: null, skillLevel: 20, moveTimeMs: 2200, fullStrength: true },
];

function clampBotLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.min(10, Math.max(1, Math.round(level)));
}

function getBotDifficultyPreset(level: number): BotDifficultyPreset {
  const resolved = BOT_DIFFICULTY_PRESETS[clampBotLevel(level) - 1];
  return resolved ?? BOT_DIFFICULTY_PRESETS[0]!;
}

function botDifficultySummary(preset: BotDifficultyPreset): string {
  return preset.fullStrength
    ? `Level ${preset.level} Max`
    : `Level ${preset.level} ${preset.elo} Elo`;
}

function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function pickRandomMove(moves: Move[]): Move {
  return moves[Math.floor(Math.random() * moves.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampBotMoveTimeMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 60;
  }
  return Math.max(25, Math.min(4200, Math.round(value)));
}

function computeBotResponseTiming(preset: BotDifficultyPreset, playerMove: Move | null): BotResponseTiming {
  const legalReplies = chess.moves({ verbose: true }).length;
  const moveCount = state.snapshot?.moveCount ?? 0;
  const isOpening = moveCount <= 14;
  const playerCaptured = Boolean(playerMove?.captured);
  const playerGaveCheck = Boolean(playerMove?.san.includes("+"));
  const forcedReply = legalReplies <= 2;

  const roll = Math.random();
  let profile: BotTimingProfile = "standard";

  if (forcedReply || (playerCaptured && roll < 0.45) || (isOpening && roll < 0.22)) {
    profile = "premove";
  } else if (roll < 0.62) {
    profile = "quick";
  } else if (!playerGaveCheck && !forcedReply && roll > 0.9) {
    profile = "deep";
  }

  const levelMultiplier = 0.82 + preset.level * 0.045;
  const baseThink = preset.moveTimeMs;

  if (profile === "premove") {
    return {
      profile,
      preDelayMs: randomInt(16, 88),
      engineMoveTimeMs: clampBotMoveTimeMs(baseThink * (0.2 + Math.random() * 0.25)),
    };
  }

  if (profile === "quick") {
    return {
      profile,
      preDelayMs: randomInt(85, 250),
      engineMoveTimeMs: clampBotMoveTimeMs(baseThink * (0.48 + Math.random() * 0.36)),
    };
  }

  if (profile === "deep") {
    return {
      profile,
      preDelayMs: randomInt(340, 920),
      engineMoveTimeMs: clampBotMoveTimeMs(baseThink * levelMultiplier * (1.08 + Math.random() * 0.52)),
    };
  }

  return {
    profile,
    preDelayMs: randomInt(170, 460),
    engineMoveTimeMs: clampBotMoveTimeMs(baseThink * levelMultiplier * (0.8 + Math.random() * 0.44)),
  };
}

function scoreMoveForHumanizedBot(move: Move): number {
  const capturedValue = move.captured ? (PIECE_VALUES[move.captured] ?? 0) : 0;
  const moverValue = PIECE_VALUES[move.piece] ?? 0;
  const file = move.to.charCodeAt(0) - 97;
  const rank = Number(move.to[1]) - 1;
  const centrality = Math.max(0, 3.5 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5)) / 2);

  let score = 0;
  score += capturedValue - moverValue * 0.15;
  score += centrality * 12;
  if (move.promotion) score += 900;
  if (move.san.includes("+")) score += 85;
  if (move.flags.includes("k") || move.flags.includes("q")) score += 40;

  return score;
}

function chooseBotMoveByDifficulty(bestMoveUci: string, preset: BotDifficultyPreset): string {
  if (preset.fullStrength || preset.level >= 10) {
    return bestMoveUci;
  }

  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length <= 1) {
    return bestMoveUci;
  }

  const bestMove = bestMoveUci.trim();
  const alternatives = legalMoves.filter((move) => moveToUci(move) !== bestMove);
  if (alternatives.length === 0) {
    return bestMoveUci;
  }

  const levelGap = 10 - preset.level;
  const blunderChance = Math.max(0, (levelGap - 1) * 0.03);
  const inaccuracyChance = Math.max(0, levelGap * 0.045);
  const roll = Math.random();

  if (roll < blunderChance) {
    const sorted = [...alternatives].sort((a, b) => scoreMoveForHumanizedBot(a) - scoreMoveForHumanizedBot(b));
    const worstSlice = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 3)));
    return moveToUci(pickRandomMove(worstSlice));
  }

  if (roll < blunderChance + inaccuracyChance) {
    const sorted = [...alternatives].sort((a, b) => scoreMoveForHumanizedBot(a) - scoreMoveForHumanizedBot(b));
    const start = Math.floor(sorted.length * 0.2);
    const end = Math.max(start + 1, Math.floor(sorted.length * 0.7));
    const candidateSlice = sorted.slice(start, end);
    if (candidateSlice.length > 0) {
      return moveToUci(pickRandomMove(candidateSlice));
    }
  }

  return bestMoveUci;
}

const PIECES: Record<`${PlayerRole}${PieceSymbol}`, string> = {
  wp: "/pieces/wP.svg",
  wn: "/pieces/wN.svg",
  wb: "/pieces/wB.svg",
  wr: "/pieces/wR.svg",
  wq: "/pieces/wQ.svg",
  wk: "/pieces/wK.svg",
  bp: "/pieces/bP.svg",
  bn: "/pieces/bN.svg",
  bb: "/pieces/bB.svg",
  br: "/pieces/bR.svg",
  bq: "/pieces/bQ.svg",
  bk: "/pieces/bK.svg",
};

const chess = new Chess();
const socket = io();
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

const initialRoomCode = new URLSearchParams(window.location.search).get("room")?.trim() ?? null;

// Restaurar roomId guardada en localStorage si existe
const savedRoomId = localStorage.getItem("chess_roomId");
const autoJoinCode = initialRoomCode ?? (savedRoomId || null);
const savedBotLevel = clampBotLevel(Number(localStorage.getItem("chess-bot-level")) || 1);

const state: AppState = {
  connected: false,
  roomId: null,
  role: null,
  shareUrl: "",
  snapshot: null,
  orientation: "w",
  selectedSquare: null,
  legalTargets: [],
  toastMessage: "",
  pendingPromotion: null,
  premoves: [],
  autoJoinCode,
  focusMode: false,
  liveAnalysisSummary: "Live analysis disabled.",
  lastAnalyzedMoveKey: null,
  liveMoveGrades: {},
    animationStyle: (localStorage.getItem("chess-animation-style") as "smooth" | "epic") || "smooth",
  bloodFxEnabled: localStorage.getItem("chess-blood-fx") === "on",
  gameMode: "multiplayer",
  botLevel: savedBotLevel,
  botPickerOpen: false,
  viewCursor: null,
  trailFxEnabled: localStorage.getItem("chess-trail-fx") === "on",
  legalMovesEnabled: localStorage.getItem("chess-legal-moves") !== "off",
  bestMoveArrow: null,
  bestMoveArrowFen: null,
};

(window as any).state = state;

let lastAnimatedMoveKey: string | null = null;
let suppressAnimationForMove: { from: Square; to: Square } | null = null;
let activeGhostAnimation: Animation | null = null;
let activeGhostNode: HTMLElement | null = null;
let activeGhostDestinationPiece: HTMLElement | null = null;
let pendingBoardRefresh = false;
let liveAnalyzer: StockfishBridge | null = null;
let botAnalyzer: StockfishBridge | null = null;
let liveAnalysisToken = 0;
let bestMoveArrowToken = 0;
let currentModalAction: "leave" | "resign" | "bot" | null = null;
let animationFinished = true; 
let animatingToSquare: Square | null = null;
let lastRoomStateReceivedAtMs = Date.now();
let lastLiveQualityCalloutKey: string | null = null;
let activeLiveQualityCallout: HTMLDivElement | null = null;
let botPickerHideTimer: number | null = null;
let botPickerLockedScrollY: number | null = null;
let botResponseTimer: number | null = null;
let pendingFriendInvite: IncomingFriendInvite | null = null;
let pendingInGameFriendRequest: IncomingInGameFriendRequest | null = null;
let sendFriendRequestBusy = false;

const SMOOTH_MOVE_DURATION_MS = 620;
const EPIC_MOVE_DURATION_MS = {
  smash: 860,
  spin: 760,
  slide: 620,
} as const;


const LIVE_MATE_CP = 100000;
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const PIECE_SYMBOLS_MAP: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
} as const;
const LIVE_CATEGORY_LABELS: Record<MoveCategory, string> = {
  brilliant: "Brilliant",
  great: "Great",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

const LIVE_CATEGORY_TEXT_SYMBOLS: Record<MoveCategory, string> = {
  brilliant: "!!",
  great: "!",
  excellent: "★",
  good: "✓",
  inaccuracy: "?!",
  mistake: "x",
  blunder: "??",
};

const LIVE_CATEGORY_BADGE_ICON_PATHS: Partial<Record<MoveCategory, string>> = {
  excellent: "/assets/labelBadges/excellent.svg",
  good: "/assets/labelBadges/good.svg",
  mistake: "/assets/labelBadges/mistake.svg",
};
const LIVE_BRILLIANT_VERIFICATION_DEPTH = 16;
const ROOM_CODE_LENGTH = 4;
const ROOM_ID_PATTERN = new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`);

function applyAnimationTiming(style: "smooth" | "epic"): void {
  const cssDuration = style === "epic" ? 760 : SMOOTH_MOVE_DURATION_MS;
  document.documentElement.style.setProperty("--move-duration", `${cssDuration}ms`);
}

class StockfishBridge {
  private readonly worker: Worker;
  private ready = false;
  private initResolve!: () => void;
  private initReject!: (error: Error) => void;
  private readonly initPromise: Promise<void>;
  private readonly readyWaiters: Array<() => void> = [];
  private lastBotConfigKey: string | null = null;
  private activeEval: {
    resolve: (value: EngineEval) => void;
    reject: (reason?: unknown) => void;
    lastCp: number;
    mate: number | null;
    pv: string;
    bestMove: string;
  } | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(workerPath = "/stockfish/stockfish-18-lite-single.js") {
    this.worker = new Worker(workerPath);
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
    });

    this.worker.onmessage = (event) => this.onMessage(String(event.data ?? ""));
    this.worker.onerror = () => {
      if (!this.ready) this.initReject(new Error("Stockfish init failed."));
      this.activeEval?.reject(new Error("Worker error."));
      this.activeEval = null;
    };

    // --- INITIAL CONFIGURATION ---
    this.send("uci");
    this.send("isready");
  }

  /** Gets the best move from the engine for the Bot player */
  async getBotMove(fen: string, preset: BotDifficultyPreset, moveTimeOverrideMs?: number): Promise<string> {
    await this.initPromise;
    const botPromise = this.queue.then(async () => {
      await this.applyBotDifficulty(preset);
      const effectiveMoveTimeMs = clampBotMoveTimeMs(moveTimeOverrideMs ?? preset.moveTimeMs);
      return new Promise<string>((resolve, reject) => {
        this.activeEval = {
          resolve: (res) => resolve(res.bestMove),
          reject,
          lastCp: 0, mate: null, pv: "", bestMove: "",
        };
        this.send(`position fen ${fen}`);
        this.send(`go movetime ${effectiveMoveTimeMs}`);
      });
    });
    this.queue = botPromise.then(() => undefined).catch(() => undefined);
    return botPromise;
  }

  /** Standard analysis evaluation */
  async evaluateFen(fen: string, depth: number): Promise<EngineEval> {
    await this.initPromise;
    const evalPromise = this.queue.then(() => {
      return new Promise<EngineEval>((resolve, reject) => {
        this.activeEval = { resolve, reject, lastCp: 0, mate: null, pv: "", bestMove: "", };
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);
      });
    });
    this.queue = evalPromise.then(() => undefined).catch(() => undefined);
    return evalPromise;
  }

  private onMessage(line: string): void {
    if (line === "readyok") {
      if (!this.ready) {
        this.ready = true;
        this.initResolve();
      }
      const waiters = this.readyWaiters.splice(0);
      for (const waiter of waiters) {
        waiter();
      }
      return;
    }
    if (!this.activeEval) return;
    if (line.startsWith("info ")) {
      const parsed = parseInfoLine(line);
      if (parsed) {
        this.activeEval.lastCp = parsed.cp;
        this.activeEval.mate = parsed.mate;
        this.activeEval.pv = parsed.pv;
      }
    } else if (line.startsWith("bestmove ")) {
      this.activeEval.bestMove = line.split(" ")[1] ?? "";
      this.activeEval.resolve({
        cp: this.activeEval.lastCp,
        mate: this.activeEval.mate,
        bestMove: this.activeEval.bestMove,
        pv: this.activeEval.pv,
      });
      this.activeEval = null;
    }
  }

  private awaitReadyRoundTrip(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.readyWaiters.push(resolve);
      this.send("isready");
    });
  }

  private async applyBotDifficulty(preset: BotDifficultyPreset): Promise<void> {
    const configKey = `${preset.level}:${preset.elo ?? "max"}:${preset.skillLevel}:${preset.fullStrength}`;
    if (configKey === this.lastBotConfigKey) {
      return;
    }

    if (preset.fullStrength) {
      this.send("setoption name UCI_LimitStrength value false");
      this.send("setoption name Skill Level value 20");
    } else {
      this.send("setoption name UCI_LimitStrength value true");
      this.send(`setoption name UCI_Elo value ${preset.elo}`);
      this.send(`setoption name Skill Level value ${preset.skillLevel}`);
    }

    await this.awaitReadyRoundTrip();
    this.lastBotConfigKey = configKey;
  }

  private send(cmd: string): void { this.worker.postMessage(cmd); }
  terminate(): void { this.worker.terminate(); }
}


function triggerGameOverScreen(title: string, subtitle: string) {
  const boardWrap = board.parentElement;
  if (!boardWrap) return;

  // Prevent duplicate banners if the board refreshes
  if (boardWrap.querySelector('.endgame-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'endgame-overlay';
  overlay.innerHTML = `
    <div class="endgame-banner">
      <h1 class="endgame-title">${title}</h1>
      <div class="endgame-subtitle">${subtitle}</div>
    </div>
  `;
  
  // Ensure the wrapper is positioned relatively so the absolute overlay fits perfectly inside it
  boardWrap.style.position = "relative"; 
  boardWrap.appendChild(overlay);
}

function parseInfoLine(line: string): { cp: number; mate: number | null; pv: string } | null {
  const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
  if (!scoreMatch) {
    return null;
  }

  const kind = scoreMatch[1];
  const value = Number(scoreMatch[2]);
  const pvMatch = line.match(/\spv\s(.+)$/);
  const pv = pvMatch?.[1]?.trim() ?? "";
  if (kind === "mate") {
    const cp = value > 0 ? LIVE_MATE_CP - Math.min(Math.abs(value), 99) * 100 : -LIVE_MATE_CP + Math.min(Math.abs(value), 99) * 100;
    return { cp, mate: value, pv };
  }

  return { cp: value, mate: null, pv };
}

// ── Sound ────────────────────────────────────────────────────────────────────
const _audioCache: Record<string, HTMLAudioElement> = {};
function playSound(name: string): void {
  let audio = _audioCache[name];
  if (!audio) {
    audio = new Audio(`/sounds/${name}.mp3`);
    _audioCache[name] = audio;
  }
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
let _lastPlayedMoveCount = -1;

function playSoundForMoveTraversal(moveSan: string, isCheck: boolean, isGameEnd: boolean): void {
  if (isGameEnd) {
    playSound("gameEndOrCheckmate");
    return;
  }

  let specialSoundPlayed = false;

  if (isCheck) {
    playSound("checkMove");
    specialSoundPlayed = true;
  }

  if (moveSan.includes("x")) {
    playSound("capture");
    specialSoundPlayed = true;
  }

  if (moveSan.startsWith("O-O") && !specialSoundPlayed) {
    playSound("castle");
    specialSoundPlayed = true;
  }

  if (!specialSoundPlayed) {
    playSound("move-self");
  }
}

function buildHistoryBoardAtMove(snapshot: RoomSnapshot, moveCount: number): Chess {
  const historyBoard = new Chess();
  const clampedCount = Math.max(0, Math.min(moveCount, snapshot.moves.length));

  for (let i = 0; i < clampedCount; i += 1) {
    const move = snapshot.moves[i];
    if (move) {
      historyBoard.move(move.san);
    }
  }

  return historyBoard;
}

function playSoundForHistoryNavigation(snapshot: RoomSnapshot, previousPos: number, nextPos: number): void {
  if (previousPos === nextPos) {
    return;
  }

  const traversedMoveIndex = nextPos > previousPos ? nextPos - 1 : previousPos - 1;
  const traversedMove = snapshot.moves[traversedMoveIndex];
  if (!traversedMove) {
    return;
  }

  const boardAtNext = buildHistoryBoardAtMove(snapshot, nextPos);
  const isGameEnd = boardAtNext.isCheckmate() || boardAtNext.isDraw();
  const isCheck = boardAtNext.isCheck();
  playSoundForMoveTraversal(traversedMove.san, isCheck, isGameEnd);
}

function navigateToHistoryPosition(targetPos: number): void {
  const snapshot = state.snapshot;
  if (!snapshot || snapshot.moves.length === 0) {
    return;
  }

  const maxMoves = snapshot.moves.length;
  const previousPos = state.viewCursor !== null ? state.viewCursor : maxMoves;
  const clampedTarget = Math.max(0, Math.min(targetPos, maxMoves));
  if (clampedTarget === previousPos) {
    return;
  }

  state.viewCursor = clampedTarget === maxMoves ? null : clampedTarget;
  playSoundForHistoryNavigation(snapshot, previousPos, clampedTarget);
  render();
}

function playSoundForSnapshot(snapshot: RoomSnapshot): void {
  const last = snapshot.lastMove;
  if (!last) return;

  playSoundForMoveTraversal(last.san, snapshot.check, snapshot.checkmate || snapshot.draw);
}


app.innerHTML = `
  <div class="app-shell">
    <section class="top-utility">
      <p class="muted quick-identity" id="quickIdentity">Guest</p>
      <button class="chip account-menu-button" id="accountMenuButton" type="button" aria-haspopup="dialog" aria-expanded="false">
        Account Menu
      </button>
    </section>

    <div class="sidebar-backdrop" id="sidebarBackdrop" hidden></div>
    <aside class="account-sidebar" id="accountSidebar" aria-hidden="true">
      <header class="sidebar-header">
        <h2>Player Menu</h2>
        <button class="chip sidebar-close-button" id="sidebarCloseButton" type="button" aria-label="Close menu">Close</button>
      </header>

      <nav class="sidebar-nav" aria-label="Account sections">
        <button class="chip sidebar-tab active" id="sidebarProfileTab" type="button">Profile</button>
        <button class="chip sidebar-tab" id="sidebarHistoryTab" type="button">Saved Games</button>
      </nav>

      <section class="sidebar-panel" id="sidebarProfilePanel">
        <p class="muted" id="authStatus">Guest mode enabled.</p>
        <p class="muted" id="storedGamesMeta">Sign in/sign up to save up to 100 PGNs in cloud history.</p>
        <div class="sidebar-actions">
          <input class="auth-name-input" id="usernameInput" type="text" maxlength="24" placeholder="Custom username" hidden />
          <button class="chip" id="saveUsernameButton" type="button" hidden>Save username</button>
          <button class="chip" id="guestModeButton" type="button">Play as guest</button>
          <button class="action cta-rainbow" id="signInGoogleButton" type="button">Sign in / Sign up</button>
          <button class="chip" id="signOutButton" type="button" hidden>Sign out</button>
        </div>

        <section class="friends-section" aria-label="Friends section">
          <h3 class="friends-title">Friends</h3>
          <p class="muted friends-status" id="friendsStatus">Sign in to add friends by username or Friend ID.</p>
          <div class="friends-player-id-wrap">
            <span class="friends-player-id-label">Your Friend ID</span>
            <p class="friends-player-id" id="friendPlayerId">Sign in to reveal your Friend ID</p>
            <button class="chip" id="copyPlayerIdButton" type="button">Copy Friend ID</button>
          </div>
          <button class="friends-toggle" id="friendsToggleButton" type="button" aria-expanded="false">
            <div class="friends-toggle-copy">
              <p class="friends-toggle-title">Add and Invite Friends</p>
              <p class="friends-toggle-description">Tap to manage friends by username or Friend ID.</p>
            </div>
            <span class="friends-toggle-indicator" aria-hidden="true">Open</span>
          </button>
          <div class="friends-composer" id="friendsComposer">
            <div class="friends-add-row">
              <input class="auth-name-input" id="friendIdInput" type="text" placeholder="Username or 5-digit Friend ID" autocomplete="off" />
              <button class="chip" id="addFriendButton" type="button">Add</button>
            </div>
          </div>
          <div class="friends-list" id="friendsList"></div>
        </section>
      </section>

      <section class="sidebar-panel" id="sidebarHistoryPanel" hidden>
        <p class="muted" id="historyPanelStatus">Sign in to view your saved PGN history.</p>
        <div class="saved-games-list" id="savedGamesList"></div>
      </section>
    </aside>

    <nav class="game-nav" id="gameNav" hidden>
      <button class="nav-back-link" id="backToMenuButton" type="button">← Back to menu</button>
    </nav>

    <header class="hero">
      <section class="hero-card hero-copy">
        <h1>Multiplayer Chess</h1>
        <p>Create a room or join one with code.</p>
        <a class="analysis-board-link cta-rainbow" id="analysisBoardLink" href="/analyze">♟ Open Analysis Board</a>
      </section>
      <aside class="hero-card status-card">
        <div class="status-grid">
          <div>
            <strong>Room</strong>
            <div class="muted" id="roomBadge">No active room</div>
          </div>
          <div>
            <strong>Your seat</strong>
            <div class="muted" id="roleBadge">Not seated</div>
          </div>  
          <div>
            <strong>Match state</strong>
            <div class="muted" id="matchStatus">Create a room to start.</div>
          </div>
        </div>
      </aside>
    </header>

    <main class="layout">
      <section class="panel board-panel">
        <div class="board-toolbar">
          <button class="action cta-turquoise" id="createRoomButton" type="button">Create room</button>
          <button class="action cta-rainbow" id="playBotButton" type="button">Play vs Bot (${botDifficultySummary(getBotDifficultyPreset(savedBotLevel))})</button>
          <button class="ghost" id="rematchButton" type="button" hidden>Request rematch</button>
          <button class="ghost" id="undoRequestButton" type="button" hidden>Request undo</button>
          <button class="ghost" id="undoDeclineButton" type="button" hidden>Decline undo</button>
          <button class="ghost" id="labelsOnlyButton" type="button" hidden>Labels only: Off</button>
          <button class="ghost" id="flipBoardButton" type="button" hidden>Flip board</button>
          <button class="ghost" id="liveAnalysisButton" type="button" hidden>Live analysis</button>
          <button class="ghost" id="resignButton" type="button" hidden>Resign</button>
        </div>
       <div class="pregame-placeholder" id="pregamePlaceholder">
          <div id="pregameWaiting">
            <h2>Waiting for opponent</h2>
            <p>Create or join a room. The board appears automatically once both players are connected.</p>
          </div>
          <div id="pregameSelection" hidden>
            <h2>Choose Your Color</h2>
            <div class="mode-row">
              <strong>Game mode</strong>
              <div class="mode-options" id="modeOptions">
                <button class="mode-opt-btn" id="modeBlitz3" type="button">3-minute Blitz</button>
                <button class="mode-opt-btn" id="modeRapid10" type="button">10-minute Rapid</button>
                <button class="mode-opt-btn" id="modeBlitz3p2" type="button">3+2 Blitz</button>
              </div>
              <p class="muted" id="modeHint">Room creator selects the timer. Color choice and ready are still required.</p>
            </div>
            <div class="selection-grid">
              <div class="selection-col">
                <strong>You</strong>
                <div class="color-options">
                  <button class="color-opt-btn" id="myPickWhite">White</button>
                  <button class="color-opt-btn" id="myPickBlack">Black</button>
                </div>
                <div class="ready-badge" id="myReadyBadge">Ready!</div>
              </div>
              <div class="selection-col">
                <strong>Opponent</strong>
                <div class="color-options">
                  <button class="color-opt-btn disabled" id="opPickWhite">White</button>
                  <button class="color-opt-btn disabled" id="opPickBlack">Black</button>
                </div>
                <div class="ready-badge" id="opReadyBadge">Ready!</div>
              </div>
            </div>
            <div style="margin-top: 24px;">
              <button class="action" id="pregameReadyBtn">Ready to Play</button>
              <div id="pregameConflictWarning" hidden>Both players cannot select the same color.</div>
            </div>
          </div>
        </div>

        <div class="board-wrap">
          <div class="board" id="board"></div>
          <svg class="board-arrows" id="arrowLayer" viewBox="0 0 800 800" aria-hidden="true"></svg>
        </div>
        <div class="board-caption" id="boardCaption">
          Tap or click one of your pieces, then choose a legal destination.
        </div>

        <div class="nav-row" id="gameNavRow" hidden>
          <button id="liveNavFirst" title="Go to start">⏮</button>
          <button id="liveNavPrev"  title="Previous move">◀</button>
          <button id="liveNavNext"  title="Next move">▶</button>
          <button id="liveNavLast"  title="Go to live">⏭</button>
        </div>
        <button class="focus-toggle-btn" id="focusModeBtn" type="button" aria-pressed="false">Focus</button>
      </section>

      <aside class="panel side-panel">
        <section class="control-card" id="inviteJoinCard">
          <h2 class="card-title">Invite or join <span class="title-decor">!!</span></h2>
          <div class="control-row">
            <button class="chip" id="copyLinkButton" type="button" hidden>Copy invite link</button>
            <button class="chip" id="leaveRoomButton" type="button" hidden>Leave room</button>
          </div>
          <div class="join-grid">
            <input class="join-input" id="roomInput" maxlength="4" inputmode="numeric" pattern="\\d{4}" placeholder="4-digit code" />
            <button class="action" id="joinRoomButton" type="button">Join</button>
          </div>
          <div class="link-row">
            <span class="muted">Share URL</span>
            <span class="room-link" id="shareLink">Create or join a room to get a live invite link.</span>
          </div>
        </section>

        <section class="seat-card" id="seatCard" hidden>
          <h2 class="card-title">Seats</h2>
          <div class="seat-grid">
            <article class="seat">
              <strong>White</strong>
              <span class="muted" id="whiteSeat">Waiting for player</span>
              <span class="clock-pill" id="whiteClock">03:00</span>
            </article>
            <article class="seat">
              <strong>Black</strong>
              <span class="muted" id="blackSeat">Waiting for player</span>
              <span class="clock-pill" id="blackClock">03:00</span>
            </article>
          </div>
          <div class="meta-grid" style="margin-top: 14px;">
            <div>
              <span class="meta-label">Turn</span>
              <span class="muted" id="turnMeta">White</span>
            </div>
            <div>
              <span class="meta-label">Moves</span>
              <span class="muted" id="movesMeta">0</span>
            </div>
            <div>
              <span class="meta-label">Viewers</span>
              <span class="muted" id="spectatorMeta">0</span>
            </div>
          </div>
          <section class="in-game-friend-panel" id="inGameFriendPanel" hidden>
            <p class="muted in-game-friend-meta" id="inGameFriendMeta">Opponent info unavailable.</p>
            <button class="chip" id="sendFriendRequestButton" type="button">Send Friend Request</button>
          </section>
          <section class="in-game-friend-request" id="inGameFriendRequest" hidden>
            <p class="in-game-friend-request-text" id="inGameFriendRequestText">Friend request incoming.</p>
            <div class="in-game-friend-request-actions">
              <button class="chip" id="declineInGameFriendRequestButton" type="button">Decline</button>
              <button class="action" id="acceptInGameFriendRequestButton" type="button">Accept</button>
            </div>
          </section>
        </section>

        <section class="summary-card" id="summaryCard" hidden>
          <h2 class="card-title">Game summary</h2>
          <p class="muted" id="summaryText">The server will keep this board authoritative for every device in the room.</p>
          <p class="muted" id="liveAnalysisText">Live analysis disabled.</p>
        </section>

        <section class="moves-card" id="movesCard" hidden>
          <h2 class="card-title">Moves</h2>
          <div class="move-list" id="moveList">
            <div class="empty-state">No moves yet.</div>
          </div>
        </section>
      </aside>
    </main>
  </div>

  <div class="bot-difficulty-overlay" id="botDifficultyOverlay" aria-hidden="true" hidden>
    <div class="bot-difficulty-backdrop" id="botDifficultyBackdrop" aria-hidden="true"></div>
    <div class="bot-difficulty-picker" id="botDifficultyPicker" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="botDifficultyTitle">
      <h2 class="bot-difficulty-title" id="botDifficultyTitle">Choose Bot Strength</h2>
      <p class="bot-difficulty-subtitle">Pick a level and start your match with a single tap.</p>
      <label class="bot-difficulty-label" for="botDifficultySelect">Bot level</label>
      <div class="bot-difficulty-select-wrap">
        <select id="botDifficultySelect" class="bot-difficulty-select" aria-label="Choose bot difficulty">
          ${BOT_DIFFICULTY_PRESETS.map((preset) => `<option value="${preset.level}">${preset.label}</option>`).join("")}
        </select>
        <span class="bot-difficulty-select-chevron" aria-hidden="true">▾</span>
      </div>
      <button class="chip bot-difficulty-start" id="startBotGameButton" type="button">Start Match</button>
    </div>
  </div>

  <div class="focus-hud" id="focusHud" hidden>
    <span class="focus-chip" id="focusTimer">00:00</span>

    <div id="focusMaterialHud" class="focus-material-hud" hidden></div>
  </div>

  <div class="promotion-dialog" id="promotionDialog" hidden>
    <div class="promotion-card">
      <h2 class="card-title">Choose a promotion</h2>
      <p class="muted">Select the piece that your pawn should become.</p>
      <div class="promotion-grid">
        <button class="promotion-button" data-promotion="q" type="button">Queen</button>
        <button class="promotion-button" data-promotion="r" type="button">Rook</button>
        <button class="promotion-button" data-promotion="b" type="button">Bishop</button>
        <button class="promotion-button" data-promotion="n" type="button">Knight</button>
      </div>
    </div>
  </div>

 <div class="modal-overlay" id="confirmDialog" hidden>
  <div class="modal-card">
    <div class="modal-header">
      <h2 class="modal-title" id="modalTitle">Leave Match?</h2>
      <p class="modal-text" id="modalDescription">Your current game progress will be lost.</p>
    </div>
    <div class="modal-actions">
      <button class="modal-btn cancel" id="confirmNoBtn" type="button">Stay</button>
      <button class="modal-btn confirm" id="confirmYesBtn" type="button">Confirm</button>
    </div>
  </div>
</div>

  <button class="chat-fab" id="chatFabButton" type="button" aria-label="Open live chat" hidden>
    <span>Chat</span>
    <span class="chat-fab-badge" id="chatFabBadge" hidden></span>
  </button>

  <section class="live-chat-panel" id="chatPanel" hidden>
    <header class="live-chat-header">
      <h2>Live Chat</h2>
      <button class="chip" id="chatCloseButton" type="button">Close</button>
    </header>
    <p class="muted" id="chatStatusText">Live chat is available only for seated multiplayer players during active matches.</p>
    <div class="live-chat-actions">
      <button class="chip" id="chatConsentButton" type="button">Accept Communication</button>
      <button class="action cta-turquoise chat-voice-btn" id="chatVoiceButton" type="button">Hold to Talk</button>
    </div>
    <div class="live-chat-messages" id="chatMessages">
      <div class="empty-state">No messages yet.</div>
    </div>
    <div class="live-chat-compose">
      <input class="join-input live-chat-input" id="chatInput" maxlength="420" placeholder="Type a message..." />
      <button class="action" id="chatSendButton" type="button">Send</button>
    </div>
  </section>

  <div class="toast" id="toast"></div>

  <section class="friend-invite-prompt" id="friendInvitePrompt" hidden aria-live="polite">
    <p class="friend-invite-prompt-text" id="friendInvitePromptText">New invitation</p>
    <div class="friend-invite-prompt-actions">
      <button class="chip" id="friendInviteDeclineButton" type="button">Decline</button>
      <button class="action cta-turquoise" id="friendInviteAcceptButton" type="button">Accept</button>
    </div>
  </section>
`;



const board = must<HTMLDivElement>("#board");
const boardWrap = board.parentElement as HTMLDivElement | null;
const pregamePlaceholder = must<HTMLDivElement>("#pregamePlaceholder");
const inviteJoinCard = must<HTMLElement>("#inviteJoinCard");
const analysisBoardLink = must<HTMLAnchorElement>("#analysisBoardLink");
const quickIdentity = must<HTMLParagraphElement>("#quickIdentity");
const accountMenuButton = must<HTMLButtonElement>("#accountMenuButton");
const sidebarBackdrop = must<HTMLDivElement>("#sidebarBackdrop");
const accountSidebar = must<HTMLElement>("#accountSidebar");
const sidebarCloseButton = must<HTMLButtonElement>("#sidebarCloseButton");
const sidebarProfileTab = must<HTMLButtonElement>("#sidebarProfileTab");
const sidebarHistoryTab = must<HTMLButtonElement>("#sidebarHistoryTab");
const sidebarProfilePanel = must<HTMLElement>("#sidebarProfilePanel");
const sidebarHistoryPanel = must<HTMLElement>("#sidebarHistoryPanel");
const historyPanelStatus = must<HTMLParagraphElement>("#historyPanelStatus");
const savedGamesList = must<HTMLDivElement>("#savedGamesList");
const authStatus = must<HTMLParagraphElement>("#authStatus");
const storedGamesMeta = must<HTMLParagraphElement>("#storedGamesMeta");
const usernameInput = must<HTMLInputElement>("#usernameInput");
const saveUsernameButton = must<HTMLButtonElement>("#saveUsernameButton");
const friendsToggleButton = must<HTMLButtonElement>("#friendsToggleButton");
const friendsComposer = must<HTMLDivElement>("#friendsComposer");
const friendPlayerId = must<HTMLParagraphElement>("#friendPlayerId");
const copyPlayerIdButton = must<HTMLButtonElement>("#copyPlayerIdButton");
const friendIdInput = must<HTMLInputElement>("#friendIdInput");
const addFriendButton = must<HTMLButtonElement>("#addFriendButton");
const friendsStatus = must<HTMLParagraphElement>("#friendsStatus");
const friendsList = must<HTMLDivElement>("#friendsList");
const guestModeButton = must<HTMLButtonElement>("#guestModeButton");
const signInGoogleButton = must<HTMLButtonElement>("#signInGoogleButton");
const signOutButton = must<HTMLButtonElement>("#signOutButton");
const roomInput = must<HTMLInputElement>("#roomInput");
const roomBadge = must<HTMLDivElement>("#roomBadge");
const roleBadge = must<HTMLDivElement>("#roleBadge");
const matchStatus = must<HTMLDivElement>("#matchStatus");
const boardCaption = must<HTMLDivElement>("#boardCaption");
const shareLink = must<HTMLSpanElement>("#shareLink");
const seatCard = must<HTMLElement>("#seatCard");
const summaryCard = must<HTMLElement>("#summaryCard");
const movesCard = must<HTMLElement>("#movesCard");
const whiteSeat = must<HTMLSpanElement>("#whiteSeat");
const blackSeat = must<HTMLSpanElement>("#blackSeat");
const turnMeta = must<HTMLSpanElement>("#turnMeta");
const movesMeta = must<HTMLSpanElement>("#movesMeta");
const spectatorMeta = must<HTMLSpanElement>("#spectatorMeta");
const inGameFriendPanel = must<HTMLElement>("#inGameFriendPanel");
const inGameFriendMeta = must<HTMLParagraphElement>("#inGameFriendMeta");
const sendFriendRequestButton = must<HTMLButtonElement>("#sendFriendRequestButton");
const inGameFriendRequest = must<HTMLElement>("#inGameFriendRequest");
const inGameFriendRequestText = must<HTMLParagraphElement>("#inGameFriendRequestText");
const acceptInGameFriendRequestButton = must<HTMLButtonElement>("#acceptInGameFriendRequestButton");
const declineInGameFriendRequestButton = must<HTMLButtonElement>("#declineInGameFriendRequestButton");
const summaryText = must<HTMLParagraphElement>("#summaryText");
const liveAnalysisText = must<HTMLParagraphElement>("#liveAnalysisText");
const chatFabButton = must<HTMLButtonElement>("#chatFabButton");
const chatFabBadge = must<HTMLSpanElement>("#chatFabBadge");
const chatPanel = must<HTMLElement>("#chatPanel");
const chatCloseButton = must<HTMLButtonElement>("#chatCloseButton");
const chatStatusText = must<HTMLParagraphElement>("#chatStatusText");
const chatConsentButton = must<HTMLButtonElement>("#chatConsentButton");
const chatMessages = must<HTMLDivElement>("#chatMessages");
const chatInput = must<HTMLInputElement>("#chatInput");
const chatSendButton = must<HTMLButtonElement>("#chatSendButton");
const chatVoiceButton = must<HTMLButtonElement>("#chatVoiceButton");
const moveList = must<HTMLDivElement>("#moveList");
const toast = must<HTMLDivElement>("#toast");
const friendInvitePrompt = must<HTMLElement>("#friendInvitePrompt");
const friendInvitePromptText = must<HTMLParagraphElement>("#friendInvitePromptText");
const friendInviteDeclineButton = must<HTMLButtonElement>("#friendInviteDeclineButton");
const friendInviteAcceptButton = must<HTMLButtonElement>("#friendInviteAcceptButton");
const promotionDialog = must<HTMLDivElement>("#promotionDialog");
const createRoomButton = must<HTMLButtonElement>("#createRoomButton");
const backToMenuButton = must<HTMLButtonElement>("#backToMenuButton");
const focusHud = must<HTMLDivElement>("#focusHud");
const focusTimer = must<HTMLSpanElement>("#focusTimer");
const focusModeButton = must<HTMLButtonElement>("#focusModeBtn");
const focusMaterialHud = must<HTMLDivElement>("#focusMaterialHud");
const playBotButton = must<HTMLButtonElement>("#playBotButton");
const botDifficultyOverlay = must<HTMLDivElement>("#botDifficultyOverlay");
const botDifficultyPicker = must<HTMLDivElement>("#botDifficultyPicker");
const botDifficultyBackdrop = must<HTMLDivElement>("#botDifficultyBackdrop");
const botDifficultySelect = must<HTMLSelectElement>("#botDifficultySelect");
const startBotGameButton = must<HTMLButtonElement>("#startBotGameButton");
const confirmDialog = must<HTMLElement>("#confirmDialog");
const confirmYesBtn = must<HTMLButtonElement>("#confirmYesBtn");
const confirmNoBtn = must<HTMLButtonElement>("#confirmNoBtn");
const modalTitle = must<HTMLElement>("#modalTitle");
const modalDescription = must<HTMLElement>("#modalDescription");
const gameNav = must<HTMLElement>("#gameNav");

const pregameWaiting = must<HTMLDivElement>("#pregameWaiting");
const pregameSelection = must<HTMLDivElement>("#pregameSelection");
const modeBlitz3 = must<HTMLButtonElement>("#modeBlitz3");
const modeRapid10 = must<HTMLButtonElement>("#modeRapid10");
const modeBlitz3p2 = must<HTMLButtonElement>("#modeBlitz3p2");
const modeHint = must<HTMLParagraphElement>("#modeHint");
const myPickWhite = must<HTMLButtonElement>("#myPickWhite");
const myPickBlack = must<HTMLButtonElement>("#myPickBlack");
const opPickWhite = must<HTMLButtonElement>("#opPickWhite");
const opPickBlack = must<HTMLButtonElement>("#opPickBlack");
const myReadyBadge = must<HTMLDivElement>("#myReadyBadge");
const opReadyBadge = must<HTMLDivElement>("#opReadyBadge");
const pregameReadyBtn = must<HTMLButtonElement>("#pregameReadyBtn");
const pregameConflictWarning = must<HTMLDivElement>("#pregameConflictWarning");
const whiteClock = must<HTMLSpanElement>("#whiteClock");
const blackClock = must<HTMLSpanElement>("#blackClock");

modeBlitz3.addEventListener("click", () => socket.emit("pregame:mode", { mode: "blitz3" }));
modeRapid10.addEventListener("click", () => socket.emit("pregame:mode", { mode: "rapid10" }));
modeBlitz3p2.addEventListener("click", () => socket.emit("pregame:mode", { mode: "blitz3p2" }));

myPickWhite.addEventListener("click", () => socket.emit("pregame:select", { color: "w" }));
myPickBlack.addEventListener("click", () => socket.emit("pregame:select", { color: "b" }));
pregameReadyBtn.addEventListener("click", () => socket.emit("pregame:ready"));

mountThemeSwitcher();
applyAnimationTiming(state.animationStyle);

window.addEventListener("animationchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ style: "smooth" | "epic" }>;
  state.animationStyle = customEvent.detail.style;
  applyAnimationTiming(state.animationStyle);
});



window.addEventListener("bloodfxchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ enabled: boolean }>;
  state.bloodFxEnabled = customEvent.detail.enabled;
});

window.addEventListener("legalmoveschange" , (event: Event) => {
  const customEvent = event as CustomEvent<{ enabled: boolean }>;
  state.legalMovesEnabled = customEvent.detail.enabled;
  requestBoardRefresh(true);
});


const joinRoomButton = must<HTMLButtonElement>("#joinRoomButton");
const joinGrid = must<HTMLElement>(".join-grid");
const copyLinkButton = must<HTMLButtonElement>("#copyLinkButton");
const leaveRoomButton = must<HTMLButtonElement>("#leaveRoomButton");
const flipBoardButton = must<HTMLButtonElement>("#flipBoardButton");
const rematchButton = must<HTMLButtonElement>("#rematchButton");
const undoRequestButton = must<HTMLButtonElement>("#undoRequestButton");
const undoDeclineButton = must<HTMLButtonElement>("#undoDeclineButton");
const labelsOnlyButton = must<HTMLButtonElement>("#labelsOnlyButton");
const liveAnalysisButton = must<HTMLButtonElement>("#liveAnalysisButton");
const arrowLayer = must<SVGSVGElement>("#arrowLayer");
const resignButton = must<HTMLButtonElement>("#resignButton");

const liveNavFirst = must<HTMLButtonElement>("#liveNavFirst");
const liveNavPrev = must<HTMLButtonElement>("#liveNavPrev");
const liveNavNext = must<HTMLButtonElement>("#liveNavNext");
const liveNavLast = must<HTMLButtonElement>("#liveNavLast");
const gameNavRow = must<HTMLDivElement>("#gameNavRow");

const arrowAnnotations = new Set<string>();
const squareAnnotations = new Set<string>(); 

function buildPgnFromMoves(moves: MoveSummary[], headers?: PgnHeaderOptions): string | null {
  if (moves.length === 0) {
    return null;
  }

  const replay = new Chess();
  try {
    if (headers?.whiteName || headers?.blackName || headers?.result) {
      replay.header(
        "White", headers.whiteName?.trim() || "White",
        "Black", headers.blackName?.trim() || "Black",
        "Result", headers.result || "*",
      );
    }

    for (const move of moves) {
      const appliedMove = replay.move(move.san);
      if (!appliedMove) {
        return null;
      }
    }
    return replay.pgn();
  } catch {
    return null;
  }
}

function buildFinishedGameSignature(snapshot: RoomSnapshot): string {
  return [
    state.gameMode,
    snapshot.roomId,
    snapshot.moveCount,
    snapshot.status,
    snapshot.winner ?? "none",
    snapshot.lastMove?.san ?? "none",
  ].join(":");
}

const accountSidebarController = createAccountSidebarController({
  socket,
  refs: {
    quickIdentity,
    accountMenuButton,
    sidebarBackdrop,
    accountSidebar,
    sidebarCloseButton,
    sidebarProfileTab,
    sidebarHistoryTab,
    sidebarProfilePanel,
    sidebarHistoryPanel,
    historyPanelStatus,
    savedGamesList,
    authStatus,
    storedGamesMeta,
    usernameInput,
    saveUsernameButton,
    friendsToggleButton,
    friendsComposer,
    friendPlayerId,
    copyPlayerIdButton,
    friendIdInput,
    addFriendButton,
    friendsStatus,
    friendsList,
    guestModeButton,
    signInGoogleButton,
    signOutButton,
  },
  showToast,
  onIdentityUpdated: () => {
    render();
  },
  onOpenSavedGameForAnalysis: (pgn: string) => {
    localStorage.removeItem("postGameMoves");
    localStorage.removeItem("postGameMeta");
    localStorage.setItem("postGamePgn", pgn);
    window.location.assign("/analyze");
  },
});

const voiceChatController = createVoiceChatController({
  socket,
  refs: {
    chatFabButton,
    chatFabBadge,
    chatPanel,
    chatCloseButton,
    chatStatusText,
    chatConsentButton,
    chatMessages,
    chatInput,
    chatSendButton,
    chatVoiceButton,
  },
  showToast,
});

function normalizeUsername(value: string): string {
  return accountSidebarController.normalizeUsername(value);
}

function getCurrentPlayerName(): string {
  return accountSidebarController.getCurrentPlayerName();
}

function emitCurrentProfileName(): void {
  accountSidebarController.emitCurrentProfileName();
}

async function maybePersistFinishedGame(snapshot: RoomSnapshot | null): Promise<void> {
  if (!snapshot) {
    return;
  }

  const gameEnded = snapshot.checkmate || snapshot.draw || snapshot.winner !== null;
  if (!gameEnded || snapshot.moveCount === 0) {
    return;
  }

  const signature = buildFinishedGameSignature(snapshot);
  const result: "1-0" | "0-1" | "1/2-1/2" | "*" =
    snapshot.draw
      ? "1/2-1/2"
      : snapshot.winner === "w"
      ? "1-0"
      : snapshot.winner === "b"
      ? "0-1"
      : "*";
  const pgn = buildPgnFromMoves(snapshot.moves, {
    whiteName: snapshot.players.whiteName,
    blackName: snapshot.players.blackName,
    result,
  });
  await accountSidebarController.handleFinishedGamePersist({ signature, pgn });
}

void accountSidebarController.initialize();

window.addEventListener("beforeunload", () => {
  accountSidebarController.dispose();
  voiceChatController.dispose();
});

function refreshBotDifficultyUi(): void {
  const preset = getBotDifficultyPreset(state.botLevel);
  playBotButton.textContent = state.botPickerOpen
    ? "Choose Bot Strength"
    : `Play vs Bot (${botDifficultySummary(preset)})`;
  playBotButton.classList.toggle("is-active", state.botPickerOpen);
  botDifficultySelect.value = String(preset.level);

  if (state.botPickerOpen) {
    botDifficultyOverlay.hidden = false;
    if (botPickerHideTimer !== null) {
      window.clearTimeout(botPickerHideTimer);
      botPickerHideTimer = null;
    }
  } else if (botPickerHideTimer === null) {
    botPickerHideTimer = window.setTimeout(() => {
      if (!state.botPickerOpen) {
        botDifficultyOverlay.hidden = true;
      }
      botPickerHideTimer = null;
    }, 430);
  }

  botDifficultyOverlay.classList.toggle("is-open", state.botPickerOpen);
  botDifficultyOverlay.setAttribute("aria-hidden", String(!state.botPickerOpen));
  botDifficultyPicker.classList.toggle("is-open", state.botPickerOpen);
  botDifficultyPicker.setAttribute("aria-hidden", String(!state.botPickerOpen));
  botDifficultyBackdrop.classList.toggle("is-open", state.botPickerOpen);
  botDifficultyBackdrop.setAttribute("aria-hidden", String(!state.botPickerOpen));
  document.body.classList.toggle("bot-picker-open", state.botPickerOpen);
  syncBotPickerScrollLock(state.botPickerOpen);
}

function isBotPickerMobileViewport(): boolean {
  return window.matchMedia("(max-width: 900px)").matches;
}

function syncBotPickerScrollLock(shouldLock: boolean): void {
  if (shouldLock && isBotPickerMobileViewport()) {
    if (botPickerLockedScrollY !== null) {
      return;
    }

    botPickerLockedScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${botPickerLockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return;
  }

  if (botPickerLockedScrollY === null) {
    return;
  }

  const restoreY = botPickerLockedScrollY;
  botPickerLockedScrollY = null;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, restoreY);
}

function openBotDifficultyPicker(): void {
  botDifficultyOverlay.hidden = false;
  state.botPickerOpen = true;
  refreshBotDifficultyUi();
  window.requestAnimationFrame(() => botDifficultySelect.focus());
}

function closeBotDifficultyPicker(): void {
  if (!state.botPickerOpen) {
    return;
  }
  state.botPickerOpen = false;
  refreshBotDifficultyUi();
}

function startBotGameWithSelection(): void {
  closeBotDifficultyPicker();
  if (state.roomId && state.gameMode === "multiplayer") {
    toggleConfirmModal(true, "bot");
  } else {
    startBotGame();
  }
}

botDifficultySelect.addEventListener("change", () => {
  const nextLevel = clampBotLevel(Number(botDifficultySelect.value));
  state.botLevel = nextLevel;
  localStorage.setItem("chess-bot-level", String(nextLevel));
  refreshBotDifficultyUi();

  if (state.gameMode === "bot") {
    showToast(`Bot strength updated: ${botDifficultySummary(getBotDifficultyPreset(nextLevel))}.`);
  }
});

refreshBotDifficultyUi();

playBotButton.addEventListener("click", () => {
  if (state.botPickerOpen) {
    closeBotDifficultyPicker();
  } else {
    openBotDifficultyPicker();
  }
});

startBotGameButton.addEventListener("click", () => {
  startBotGameWithSelection();
});

window.addEventListener("pointerdown", (event) => {
  if (!state.botPickerOpen) {
    return;
  }

  const target = event.target as Node | null;
  if (target && (botDifficultyPicker.contains(target) || playBotButton.contains(target))) {
    return;
  }

  closeBotDifficultyPicker();
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.botPickerOpen) {
    return;
  }
  closeBotDifficultyPicker();
});

window.addEventListener("resize", () => {
  syncBotPickerScrollLock(state.botPickerOpen);
});

createRoomButton.addEventListener("click", () => {
  closeBotDifficultyPicker();
  state.gameMode = "multiplayer"; // forcing the mode to multiplayer to avoid "ghost bot" bugs when switching from bot games
  socket.emit("room:create");
  scrollToInviteJoinCardOnMobile();
});

joinRoomButton.addEventListener("click", () => {
  closeBotDifficultyPicker();
  const code = roomInput.value.trim();
  if (!code) {
    showToast("Enter a room code first.");
    return;
  }

  if (!ROOM_ID_PATTERN.test(code)) {
    showToast("Room code must be exactly 4 digits.");
    return;
  }

  socket.emit("room:join", { roomId: code });
});

copyLinkButton.addEventListener("click", async () => {
  if (!state.shareUrl) {
    showToast("Create or join a room before copying a link.");
    return;
  }

  try {
    await navigator.clipboard.writeText(state.shareUrl);
    showToast("Invite link copied.");
  } catch {
    showToast("Clipboard access failed. Copy the link manually.");
  }
});

liveNavFirst.addEventListener("click", () => {
  navigateToHistoryPosition(0);
});

liveNavPrev.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  const currentPos = state.viewCursor !== null ? state.viewCursor : snapshot.moves.length;
  navigateToHistoryPosition(currentPos - 1);
});

liveNavNext.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  const maxMoves = snapshot.moves.length;
  const currentPos = state.viewCursor !== null ? state.viewCursor : maxMoves;
  navigateToHistoryPosition(currentPos + 1);
});

liveNavLast.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  navigateToHistoryPosition(snapshot.moves.length);
});

leaveRoomButton.addEventListener("click", () => {
  if (!state.roomId) {
    showToast("You are not in a room.");
    return;
  }

  socket.emit("room:leave");
  clearLocalRoomState();
  render();
});

resignButton.addEventListener("click", () => {
  const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) return;
  
  toggleConfirmModal(true, "resign");
});

rematchButton.addEventListener("click", () => {
  if (state.gameMode === "multiplayer") {
    socket.emit("game:rematch");
  } else {
    startBotGame(); // Just restart the local game
  }
});

undoRequestButton.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot || state.gameMode !== "multiplayer") {
    return;
  }

  const canRespondToPendingUndo = snapshot.undo.pending && snapshot.undo.requester !== null && snapshot.undo.requester !== state.role;
  if (canRespondToPendingUndo) {
    socket.emit("game:undo:respond", { accept: true });
    return;
  }

  socket.emit("game:undo:request");
});

undoDeclineButton.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.undo.pending) {
    return;
  }

  socket.emit("game:undo:respond", { accept: false });
});

labelsOnlyButton.addEventListener("click", () => {
  if (state.gameMode === "bot" && state.snapshot) {
    state.snapshot.analysis.enabled = !state.snapshot.analysis.enabled;
    if (state.snapshot.analysis.enabled) {
      void maybeRunLiveAnalysis(state.snapshot);
    } else {
      state.lastAnalyzedMoveKey = null;
      state.liveMoveGrades = {};
      clearBestMoveArrow();
    }
    render();
    return;
  }

  if (state.gameMode !== "multiplayer") {
    return;
  }

  socket.emit("analysis:labels:toggle");
});

flipBoardButton.addEventListener("click", () => {
  state.orientation = state.orientation === "w" ? "b" : "w";
  requestBoardRefresh();
  updateCaption();
});




liveAnalysisButton.addEventListener("click", () => {
  if (state.gameMode === "bot" && state.snapshot) {
    // Toggle instantly for Bot mode
    state.snapshot.analysis.enabled = !state.snapshot.analysis.enabled;
    
    if (state.snapshot.analysis.enabled) {
      // showToast("Live analysis enabled");
      // Run analysis on the current position immediately
      void maybeRunLiveAnalysis(state.snapshot);
    }
    void maybeUpdateBestMoveArrow(state.snapshot);
    render();
  } else {
    // Standard multiplayer voting logic
    socket.emit("analysis:toggle");
  }
});

const toggleConfirmModal = (show: boolean, type?: "leave" | "resign" | "bot") => {
  if (show && type) {
    currentModalAction = type;
    document.body.classList.add("modal-open");
    
    // Set dynamic text for the Bot transition
    if (type === "bot") {
      modalTitle.textContent = "Switch to Bot?";
      modalDescription.textContent = "You are currently in a room. Do you want to leave and start a local game against the AI?";
    } else if (type === "resign") {
      modalTitle.textContent = "Resign Game?";
      modalDescription.textContent = "This will count as a loss. Are you sure you want to give up?";
    } else {
      modalTitle.textContent = "Leave Match?";
      modalDescription.textContent = "Your current game progress will be lost. Return to menu?";
    }
  } else {
    document.body.classList.remove("modal-open");
  }
  confirmDialog.hidden = !show;
};

backToMenuButton.addEventListener("click", () => {  
  const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) {
    socket.emit("room:leave");
    clearLocalRoomState();
    render();
  } else {
    toggleConfirmModal(true, "leave");
  }
});

confirmNoBtn.addEventListener("click", () => toggleConfirmModal(false));

// close the modal without confirming:
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !confirmDialog.hidden) {
    toggleConfirmModal(false);
  }
});

// confirm with "Enter" key when the modal is open:
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !confirmDialog.hidden) {
    confirmYesBtn.click();
  }
});

// main.ts - Update inside the confirmYesBtn listener
confirmYesBtn.addEventListener("click", () => {
  const action = currentModalAction;
  document.body.classList.remove("modal-open");
  toggleConfirmModal(false);

  if (action === "bot") {
    // 1. Tell server we are leaving
    socket.emit("room:leave");
    
    // 2. Clear the multiplayer UI/State locally right now
    clearLocalRoomState();  
    
    // 3. Start the bot game immediately (Direct transition)
    startBotGame();
  } else if (action === "resign") {
    if (state.gameMode === "multiplayer") {
      socket.emit("game:resign");
    } else if (state.snapshot) {
      state.snapshot.winner = (state.role === "w" ? "b" : "w") as any;
      state.snapshot.status = "Resigned";
      render();
    }
  } else if (action === "leave") {
    socket.emit("room:leave");
    clearLocalRoomState();
    render();
  }
});

focusModeButton.addEventListener("click", () => {
  void toggleFocusMode();
});



window.addEventListener("keydown", (e) => {
  if (isTypingTarget(e.target)) return;
  if (!state.snapshot || state.snapshot.moves.length === 0) return;

  const maxMoves = state.snapshot.moves.length;
  // If we aren't viewing history, our "current" position is the very end of the game
  let currentPos = state.viewCursor !== null ? state.viewCursor : maxMoves;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (currentPos > 0) {
      navigateToHistoryPosition(currentPos - 1);
    }
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (currentPos < maxMoves) {
      navigateToHistoryPosition(currentPos + 1);
    }
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "z" || isTypingTarget(event.target)) {
    return;
  }

  if (focusModeButton.hidden) {
    return;
  }

  event.preventDefault();
  void toggleFocusMode();
});

board.addEventListener("click", (event) => {
  const squareButton = (event.target as HTMLElement).closest<HTMLButtonElement>(".square");
  const square = squareButton?.dataset.square as Square | undefined;
  if (!square) {
    if (state.premoves.length > 0 || state.selectedSquare) {
      state.premoves = [];
      state.selectedSquare = null;
      state.legalTargets = [];
      requestBoardRefresh(true); // Force a refresh even if animating
      updateCaption();
    }
    return;
  }

  // Ignore duplicate synthetic click when pointerup already handled a tap.
  if (
    lastPointerTapSquare === square
    && performance.now() - lastPointerTapAtMs < 250
  ) {
    return;
  }

  // Ignore only the synthetic click generated right after a drag-drop move.
  if (
    lastDragCommitSquare === square
    && performance.now() - lastDragCommitAtMs < 250
  ) {
    return;
  }

  clearArrows();
  onSquarePressed(square);
});

board.addEventListener("contextmenu", (event) => {
  event.preventDefault(); 
  if (state.premoves.length > 0) {
    state.premoves = [];
    // showToast("Premoves canceled.");
    requestBoardRefresh();
    updateCaption();
  }
});



let ptrDragFrom: Square | null = null;
let ptrDragNode: HTMLImageElement | null = null;
let ptrDragMoved = false;
let ptrStartX = 0;
let ptrStartY = 0;
let lastDragCommitSquare: Square | null = null;
let lastDragCommitAtMs = 0;
let lastPointerTapSquare: Square | null = null;
let lastPointerTapAtMs = 0;
let arrowDragFrom: Square | null = null;
let arrowDragTo: Square | null = null;
let arrowDragPointer: { x: number; y: number } | null = null;
let arrowDragMoved = false;

board.addEventListener("pointerdown", (event) => {

if (event.button === 0 && (arrowAnnotations.size > 0 || squareAnnotations.size > 0)) {
    clearArrows();
  }
  const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) return;

  if (event.button === 2) {
    const square = getSquareFromPoint(event.clientX, event.clientY);
    if (!square) return;

    arrowDragFrom = square;
    arrowDragTo = null;
    arrowDragPointer = squareCenter(square);
    arrowDragMoved = false;
    ptrStartX = event.clientX;
    ptrStartY = event.clientY;
    board.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }

  if (event.button !== 0) return;
  const squareButton = (event.target as HTMLElement).closest<HTMLButtonElement>(".square");
  const square = squareButton?.dataset.square as Square | undefined;
  if (!square || !canStartMoveFrom(square)) return;

  ptrDragFrom = square;
  ptrDragMoved = false;
  ptrStartX = event.clientX;
  ptrStartY = event.clientY;
  board.setPointerCapture(event.pointerId);
});

board.addEventListener("pointermove", (event) => {
  if (arrowDragFrom) {
    const hoverSquare = getSquareFromPoint(event.clientX, event.clientY);
    arrowDragTo = hoverSquare && hoverSquare !== arrowDragFrom ? hoverSquare : null;
    arrowDragPointer = boardPointFromClient(event.clientX, event.clientY);
    renderArrows();
  }

  if (arrowDragFrom && !arrowDragMoved && Math.hypot(event.clientX - ptrStartX, event.clientY - ptrStartY) >= 5) {
    arrowDragMoved = true;
  }

  if (!ptrDragFrom) return;
  if (!ptrDragMoved && Math.hypot(event.clientX - ptrStartX, event.clientY - ptrStartY) < 5) return;

  if (!ptrDragMoved) {
    ptrDragMoved = true;
    state.selectedSquare = ptrDragFrom;
    
    const vBoard = getVirtualBoard();
    const virtualPiece = vBoard.get(ptrDragFrom);
    
    state.legalTargets = vBoard.moves({ square: ptrDragFrom, verbose: true }).map(m => m.to);
    syncBoardInteractionState();
    updateCaption();

    const btn = board.querySelector<HTMLButtonElement>(`[data-square="${ptrDragFrom}"]`);
    if (btn && virtualPiece) {
      const spritePath = PIECES[`${virtualPiece.color}${virtualPiece.type}`];
      
      ptrDragNode = document.createElement("img");
      ptrDragNode.src = spritePath;
      Object.assign(ptrDragNode.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "9999",
        width: `${btn.offsetWidth}px`, 
        height: `${btn.offsetHeight}px`,
        transform: "translate(-50%, -50%)",
        opacity: "1" 
      });
      
      document.body.append(ptrDragNode);
      btn.classList.add("dragging");
    }
  }

  if (ptrDragNode) {
    ptrDragNode.style.left = `${event.clientX}px`;
    ptrDragNode.style.top  = `${event.clientY}px`;
  
  }
});
function endPointerDrag(event: PointerEvent, commit: boolean): void {
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const squareButton = el?.closest<HTMLButtonElement>(".square");
  const targetSquare = squareButton?.dataset.square as Square | undefined;

  // SCENARIO 1: Tapping an empty square or opponent piece (no piece grabbed)
  if (!ptrDragFrom) {
    if (commit && targetSquare && !ptrDragMoved) {
      lastPointerTapSquare = targetSquare;
      lastPointerTapAtMs = performance.now();
      
      onSquarePressed(targetSquare);
    }
    return;
  }

  const fromSquare = ptrDragFrom;
  const wasDrag = ptrDragMoved;

  // Cleanup visual drag states
  ptrDragFrom = null;
  ptrDragMoved = false;
  if (ptrDragNode) { ptrDragNode.remove(); ptrDragNode = null; }
  board.querySelector<HTMLElement>(".square.dragging")?.classList.remove("dragging");

  // FIX: Force a sync right after dropping a piece. 
  // This clears the inline 'opacity: 0' applied during dragging to prevent flickering.
  requestBoardRefresh(true);

  // SCENARIO 2: Tapped a piece but didn't drag it
  if (!wasDrag) {
    if (commit && targetSquare) {
      lastPointerTapSquare = targetSquare;
      lastPointerTapAtMs = performance.now();

      onSquarePressed(targetSquare);
    }
    return;
  }

  // SCENARIO 3: Finished a real Drag-and-Drop
  if (commit && targetSquare && targetSquare !== fromSquare) {
    clearSelection();
    suppressAnimationForMove = { from: fromSquare, to: targetSquare };
    tryMoveFromTo(fromSquare, targetSquare);
  }
}
function endArrowDrag(event: PointerEvent, commit: boolean): void {
  if (!arrowDragFrom) return;

  const fromSquare = arrowDragFrom;
  const previewTo = arrowDragTo;
  arrowDragFrom = null;
  arrowDragTo = null;
  arrowDragPointer = null;
  renderArrows();

  if (!commit) {
    arrowDragMoved = false;
    return;
  }

  const targetSquare = previewTo ?? getSquareFromPoint(event.clientX, event.clientY);
  if (!targetSquare) {
    arrowDragMoved = false;
    return;
  }

  // NEW: Detect a static right click on a single square
  if (!arrowDragMoved || targetSquare === fromSquare) {
    if (squareAnnotations.has(fromSquare)) {
      squareAnnotations.delete(fromSquare);
    } else {
      squareAnnotations.add(fromSquare);
    }
    arrowDragMoved = false;
    requestBoardRefresh(true); // Forces board to re-render the squares
    return;
  }

  toggleArrow(fromSquare, targetSquare);
  arrowDragMoved = false;
  renderArrows();
}

board.addEventListener("pointerup", (event) => {
  if (event.button === 2 || arrowDragFrom) {
    endArrowDrag(event, true);
    return;
  }

  endPointerDrag(event, true);
});

board.addEventListener("pointercancel", (event) => {
  endArrowDrag(event, false);
  endPointerDrag(event, false);
});

function clearScheduledBotResponse(): void {
  if (botResponseTimer !== null) {
    window.clearTimeout(botResponseTimer);
    botResponseTimer = null;
  }
}

function scheduleBotResponse(playerMove: Move | null): void {
  clearScheduledBotResponse();

  if (!state.snapshot || state.gameMode !== "bot" || state.snapshot.checkmate || state.snapshot.draw) {
    return;
  }

  const botPreset = getBotDifficultyPreset(state.botLevel);
  const timing = computeBotResponseTiming(botPreset, playerMove);

  botResponseTimer = window.setTimeout(() => {
    botResponseTimer = null;
    void triggerBotResponse(timing.engineMoveTimeMs);
  }, timing.preDelayMs);
}

async function triggerBotResponse(engineMoveTimeMs?: number) {
  if (state.gameMode !== "bot" || !state.snapshot || state.snapshot.turn !== "b") {
    return;
  }

  if (!botAnalyzer) {
    botAnalyzer = new StockfishBridge();
  }

  const botPreset = getBotDifficultyPreset(state.botLevel);
  const bestMoveUci = await botAnalyzer.getBotMove(chess.fen(), botPreset, engineMoveTimeMs);

  if (state.gameMode !== "bot" || !state.snapshot || state.snapshot.turn !== "b") {
    return;
  }

  const selectedMoveUci = chooseBotMoveByDifficulty(bestMoveUci, botPreset);

  let bMove: Move | null = null;
  const attemptedMoves = selectedMoveUci === bestMoveUci
    ? [selectedMoveUci]
    : [selectedMoveUci, bestMoveUci];

  for (const moveUci of attemptedMoves) {
    const bFrom = moveUci.substring(0, 2) as Square;
    const bTo = moveUci.substring(2, 4) as Square;
    const bPromo = moveUci.length === 5 ? moveUci[4] as any : "q";

    try {
      bMove = chess.move({ from: bFrom, to: bTo, promotion: bPromo });
    } catch {
      bMove = null;
    }

    if (bMove) {
      break;
    }
  }
  
  if (bMove && state.snapshot) {
    updateManualSnapshot(bMove);
    playSoundForSnapshot(state.snapshot);

    if (state.premoves.length > 0) {
      checkAndExecutePremove(); 
    }

    // Keep board, moves, and material captures in sync on all devices.
    render(true);
  }
}
promotionDialog.addEventListener("click", (event) => {
  const clickedElement = event.target as HTMLElement;
  const clickedInsideCard = Boolean(clickedElement.closest(".promotion-card"));
  if (!clickedInsideCard) {
    state.pendingPromotion = null;
    promotionDialog.hidden = true;
    clearSelection();
    requestBoardRefresh(true);
    return;
  }

  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-promotion]");
  if (!button || !state.pendingPromotion) return;

  const promotion = button.dataset.promotion as PromotionPiece;
  const { from, to } = state.pendingPromotion;

  if (state.gameMode === "bot") {
    let moveResult: Move | null = null;
    try {
      moveResult = chess.move({ from, to, promotion });
    } catch (e) {
      console.warn("Invalid promotion move attempted");
    }
    state.pendingPromotion = null;
    promotionDialog.hidden = true;

    if (moveResult) {
      updateManualSnapshot(moveResult);
      suppressAnimationForMove = { from, to }; 
      render();
      playSoundForSnapshot(state.snapshot!);

      if (!state.snapshot!.checkmate && !state.snapshot!.draw) {
        scheduleBotResponse(moveResult);
      }
    } else {
      requestBoardRefresh(true);
    }
  } else {
    socket.emit("game:move", { from, to, promotion });
    state.pendingPromotion = null;
    promotionDialog.hidden = true;
  }
});

function hideFriendInvitePrompt(): void {
  pendingFriendInvite = null;
  friendInvitePrompt.hidden = true;
  friendInvitePrompt.classList.remove("is-visible");
}

function showFriendInvitePrompt(payload: IncomingFriendInvite): void {
  pendingFriendInvite = payload;
  friendInvitePromptText.textContent = `${payload.fromName} invited you to room ${payload.roomId}`;
  friendInvitePrompt.hidden = false;
  friendInvitePrompt.classList.remove("is-visible");
  requestAnimationFrame(() => {
    friendInvitePrompt.classList.add("is-visible");
  });
}

friendInviteAcceptButton.addEventListener("click", () => {
  if (!pendingFriendInvite) {
    return;
  }

  const invite = pendingFriendInvite;
  socket.emit("friends:invite:respond", {
    inviteId: invite.inviteId,
    fromUserId: invite.fromUserId,
    accepted: true,
  });
  hideFriendInvitePrompt();
  socket.emit("room:join", { roomId: invite.roomId });
  showToast(`Joining room ${invite.roomId}...`);
});

friendInviteDeclineButton.addEventListener("click", () => {
  if (!pendingFriendInvite) {
    hideFriendInvitePrompt();
    return;
  }

  const invite = pendingFriendInvite;
  socket.emit("friends:invite:respond", {
    inviteId: invite.inviteId,
    fromUserId: invite.fromUserId,
    accepted: false,
  });
  hideFriendInvitePrompt();
  showToast("Invitation declined.");
});

function setSendFriendRequestState(nextBusy: boolean): void {
  sendFriendRequestBusy = nextBusy;
  if (!sendFriendRequestButton.hidden) {
    sendFriendRequestButton.disabled = nextBusy;
    sendFriendRequestButton.textContent = nextBusy ? "Sending..." : "Send Friend Request";
  }
}

sendFriendRequestButton.addEventListener("click", () => {
  if (sendFriendRequestBusy || !state.snapshot) {
    return;
  }

  const opponentSeat = getOpponentSeatInfo(state.snapshot);
  if (!opponentSeat || !opponentSeat.userId || !opponentSeat.connected) {
    showToast("Opponent is unavailable for friend requests right now.");
    return;
  }

  setSendFriendRequestState(true);
  socket.emit("friends:request:send", { toUserId: opponentSeat.userId });
});

acceptInGameFriendRequestButton.addEventListener("click", async () => {
  if (!pendingInGameFriendRequest) {
    return;
  }

  const request = pendingInGameFriendRequest;
  pendingInGameFriendRequest = null;
  renderSession();

  await accountSidebarController.addFriendByLookup(request.fromFriendId);
  socket.emit("friends:request:respond", {
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    accepted: true,
  });
  showToast(`${request.fromName} added to your friends.`);
});

declineInGameFriendRequestButton.addEventListener("click", () => {
  if (!pendingInGameFriendRequest) {
    return;
  }

  const request = pendingInGameFriendRequest;
  pendingInGameFriendRequest = null;
  renderSession();

  socket.emit("friends:request:respond", {
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    accepted: false,
  });
  showToast("Friend request declined.");
});

// --- SOCKET.IO LISTENERS ---

function onSocketConnect() {
  state.connected = true;
  emitCurrentProfileName();

  if (state.autoJoinCode) {
    if (ROOM_ID_PATTERN.test(state.autoJoinCode)) {
      socket.emit("room:join", { roomId: state.autoJoinCode });
    }
    state.autoJoinCode = null;
  }
}
socket.on("connect", onSocketConnect);
if (socket.connected) onSocketConnect(); // Fires immediately if already connected

socket.on("disconnect", () => {
  state.connected = false;
});

socket.on("connection:status", () => {
  state.connected = true;
});

socket.on("friends:invite:incoming", (payload?: {
  inviteId?: string;
  fromUserId?: string;
  fromName?: string;
  roomId?: string;
}) => {
  const inviteId = typeof payload?.inviteId === "string" ? payload.inviteId : "";
  const fromUserId = typeof payload?.fromUserId === "string" ? payload.fromUserId : "";
  const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
  if (!inviteId || !fromUserId || !ROOM_ID_PATTERN.test(roomId)) {
    return;
  }

  const fromName = typeof payload?.fromName === "string" && payload.fromName.trim()
    ? payload.fromName.trim().slice(0, 24)
    : "A friend";

  showFriendInvitePrompt({ inviteId, fromUserId, fromName, roomId });
});

socket.on("friends:invite:response", (payload?: { accepted?: boolean; friendName?: string }) => {
  const accepted = Boolean(payload?.accepted);
  const friendName = typeof payload?.friendName === "string" && payload.friendName.trim()
    ? payload.friendName.trim().slice(0, 24)
    : "Friend";
  showToast(accepted ? `${friendName} accepted your invitation.` : `${friendName} declined your invitation.`);
});

socket.on("friends:request:incoming", (payload?: {
  requestId?: string;
  fromUserId?: string;
  fromName?: string;
  fromFriendId?: string;
}) => {
  const requestId = typeof payload?.requestId === "string" ? payload.requestId.trim() : "";
  const fromUserId = typeof payload?.fromUserId === "string" ? payload.fromUserId.trim() : "";
  const fromName = typeof payload?.fromName === "string" && payload.fromName.trim()
    ? payload.fromName.trim().slice(0, 24)
    : "Opponent";
  const fromFriendId = typeof payload?.fromFriendId === "string" ? payload.fromFriendId.trim() : "";

  if (!requestId || !fromUserId || !/^\d{5}$/.test(fromFriendId)) {
    return;
  }

  pendingInGameFriendRequest = { requestId, fromUserId, fromName, fromFriendId };
  renderSession();
  showToast(`${fromName} sent you a friend request.`);
});

socket.on("friends:request:sent", () => {
  setSendFriendRequestState(false);
  showToast("Friend request sent.");
});

socket.on("friends:request:response", (payload?: { accepted?: boolean; friendName?: string; friendId?: string | null }) => {
  setSendFriendRequestState(false);
  const accepted = Boolean(payload?.accepted);
  const friendName = typeof payload?.friendName === "string" && payload.friendName.trim()
    ? payload.friendName.trim().slice(0, 24)
    : "Opponent";
  const friendId = typeof payload?.friendId === "string" ? payload.friendId.trim() : "";

  if (accepted && /^\d{5}$/.test(friendId)) {
    void accountSidebarController.addFriendByLookup(friendId);
  }

  showToast(accepted ? `${friendName} accepted your friend request.` : `${friendName} declined your friend request.`);
});

socket.on("session:joined", (payload: { roomId: string; role: RoomRole; shareUrl: string }) => {
  state.roomId = payload.roomId;
  state.role = payload.role;
  state.shareUrl = payload.shareUrl || `${window.location.origin}/?room=${payload.roomId}`;
  roomInput.value = payload.roomId;

  localStorage.setItem("chess_roomId", payload.roomId);

  if (payload.role === "w" || payload.role === "b") {
    state.orientation = payload.role;
  }

  accountSidebarController.resetFinishedGameTracking();

  syncUrl(payload.roomId);
  emitCurrentProfileName();
  render();
});

socket.on("session:left", () => {
  if (state.gameMode === "bot") return;

  clearLocalRoomState();
  render();
});

socket.on("room:state", (snapshot: RoomSnapshot) => {
  if (!snapshot.checkmate && !snapshot.draw && snapshot.winner === null && snapshot.moveCount === 0) {
    accountSidebarController.resetFinishedGameTracking();
  }

  lastRoomStateReceivedAtMs = Date.now();
  const previousSnapshot = state.snapshot;
  const previousMoveCount = state.snapshot?.moveCount ?? 0;
  const previousTurn = state.snapshot?.turn ?? null;
  const previousStatus = state.snapshot?.status ?? "";
  const previousWinner = state.snapshot?.winner ?? null;
  const previousCheckmate = state.snapshot?.checkmate ?? false;
  const previousDraw = state.snapshot?.draw ?? false;
  const previousAnalysisEnabled = state.snapshot?.analysis.enabled ?? false;
  const previousSelectedSquare = state.selectedSquare;
  const previousLegalTargetsKey = state.legalTargets.join(",");
  const previousFen = chess.fen();
  let boardRefreshForcedByArrowClear = false;
  
  state.snapshot = snapshot;
  
  chess.load(snapshot.fen);

  // Sound & Visual Effects
  const isActuallyNewMove = _lastPlayedMoveCount !== -1 && snapshot.moveCount > _lastPlayedMoveCount;
  _lastPlayedMoveCount = snapshot.moveCount;
  
  if (isActuallyNewMove) {
    playSoundForSnapshot(snapshot);
    if (snapshot.check) triggerCheckFlash();
  }

  const capturedByCount = countFenPieces(snapshot.fen) < countFenPieces(previousFen);
  if (state.bloodFxEnabled && isActuallyNewMove && capturedByCount && snapshot.lastMove) {
    const capturedPiece = detectCapturedPiece(previousFen, snapshot.lastMove);
    spawnBloodSplatter(snapshot.lastMove.to, capturedPiece ?? "p");
  }

  if (snapshot.moveCount > previousMoveCount) {
    boardRefreshForcedByArrowClear = clearArrows();
  }

  // Sync selection
  if (state.selectedSquare) {
    const currentPiece = chess.get(state.selectedSquare);
    if (!currentPiece || !isOwnPiece(currentPiece.color)) {
      clearSelection();
    } else {
      state.legalTargets = snapshot.turn === state.role
        ? legalTargetsFor(state.selectedSquare)
        : legalTargetsForRole(state.selectedSquare, state.role as PlayerRole);
    }
  }

  if (!snapshot.analysis.enabled) {
    const labelsOnlyMode = snapshot.analysis.labelsOnly && isLiveAnalysisLocked(snapshot);
    if (!labelsOnlyMode) {
      state.lastAnalyzedMoveKey = null;
      state.liveMoveGrades = {};
      liveAnalysisToken += 1;
    }
  }

  // PREMOVE EXECUTION
  if (state.role && state.role !== "spectator" && snapshot.turn === state.role && state.premoves.length > 0) {
    const nextMove = state.premoves.shift();
    if (nextMove) {
      const isLegal = chess.moves({ verbose: true }).some(m => m.from === nextMove.from && m.to === nextMove.to);
      
      if (isLegal && !snapshot.checkmate && !snapshot.draw) {
        suppressAnimationForMove = { from: nextMove.from, to: nextMove.to };
        socket.emit("game:move", nextMove.promotion ? nextMove : { from: nextMove.from, to: nextMove.to });
        void maybeRunLiveAnalysis(snapshot);
        // Note: We return here because the server will send another state for this move.
        return; 
      } else {
        state.premoves = [];
      }
    }
  }

  const legalTargetsChanged = previousLegalTargetsKey !== state.legalTargets.join(",");
  const boardStateChanged =
    previousFen !== snapshot.fen ||
    previousMoveCount !== snapshot.moveCount ||
    previousTurn !== snapshot.turn ||
    previousStatus !== snapshot.status ||
    previousWinner !== snapshot.winner ||
    previousCheckmate !== snapshot.checkmate ||
    previousDraw !== snapshot.draw ||
    previousAnalysisEnabled !== snapshot.analysis.enabled ||
    previousSelectedSquare !== state.selectedSquare ||
    legalTargetsChanged ||
    previousSnapshot === null;

  // Keep board work limited to actual board-state changes.
  // This avoids iOS/Safari-class flicker when only clocks/session text update.
  if (!boardRefreshForcedByArrowClear && boardStateChanged) {
    // Never force-cancel active animations on routine room ticks.
    // If an animation is active, requestBoardRefresh() queues a safe render.
    requestBoardRefresh();
  }

  renderSession();
  renderMoves();
  updateCaption();
  updateFocusHud();

  void maybeRunLiveAnalysis(snapshot);
  void maybeUpdateBestMoveArrow(snapshot);
  void maybePersistFinishedGame(snapshot);
});

socket.on("room:error", (payload: { message: string }) => {
  setSendFriendRequestState(false);
  suppressAnimationForMove = null;
  if (state.autoJoinCode) {
    state.autoJoinCode = null;
    syncUrl(null);
    return;
  }
  showToast(payload.message);
});

socket.on("undo:requested", () => {
  showToast("Opponent requested an undo.");
});

socket.on("undo:accepted", () => {
  showToast("Undo request accepted.");
});

socket.on("undo:declined", () => {
  showToast("Undo request declined.");
});

function must<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

// main.ts - Update the render() function
function render(force = false): void {
  const savedScroll = window.scrollY;
  requestBoardRefresh(force);
  renderSession();
  renderMoves();
  updateCaption();
  updateFocusHud();
  void maybePersistFinishedGame(state.snapshot);

  // FIX: Ensure analysis runs for local bot moves
  if (state.snapshot?.analysis.enabled) {
    void maybeRunLiveAnalysis(state.snapshot);
  }

  requestAnimationFrame(() => {
    if (window.scrollY !== savedScroll) {
      window.scrollTo({ top: savedScroll, behavior: "instant" });
    }
  });
}

// --- ARCADE TRAIL ENGINE ---
let trailRafId: number | null = null;

function startTrailSpawning(): void {
  if (!state.trailFxEnabled) return;

  let lastSpawnTime = 0;
  const spawnRateMs = 12; 

  function spawn() {
    // FIX: Look for whichever piece is currently moving (Dragged OR Animating)
    const movingNode = activeGhostNode || ptrDragNode;

    if (!movingNode) {
      trailRafId = null;
      return;
    }

    const now = performance.now();
    if (now - lastSpawnTime > spawnRateMs) {
      createTrailParticle(movingNode);
      lastSpawnTime = now;
    }

    trailRafId = requestAnimationFrame(spawn);
  }

  if (trailRafId) cancelAnimationFrame(trailRafId);
  trailRafId = requestAnimationFrame(spawn);
}

function createTrailParticle(sourceNode: HTMLElement): void {
  const rect = sourceNode.getBoundingClientRect();
  
  const particle = document.createElement("div");
  particle.className = "piece-trail-particle";
  
  const img = sourceNode.querySelector("img");
  if (img) {
    const imgEl = document.createElement("img");
    imgEl.src = img.src;
    imgEl.className = "piece-image";
    particle.appendChild(imgEl);
  }

  particle.style.left = `${rect.left + window.scrollX}px`;
  particle.style.top = `${rect.top + window.scrollY}px`;
  particle.style.width = `${rect.width}px`;
  particle.style.height = `${rect.height}px`;

  document.body.appendChild(particle);
  
  // Clean up instantly when the subtle CSS fade finishes
  setTimeout(() => particle.remove(), 250); 
}

function renderSession(): void {
  const snapshot = state.snapshot;
  const hasRoom = Boolean(state.roomId);
  const isCreator = Boolean(snapshot?.ownerId && socket.id && snapshot.ownerId === socket.id);
  refreshBotDifficultyUi();
  
  // 1. Core State Calculations
  const isMultiplayer = state.gameMode === "multiplayer";
  const bothConnected = Boolean(snapshot?.players.whiteConnected && snapshot?.players.blackConnected);
  
  const isGameActive = Boolean(
    (isMultiplayer && bothConnected && snapshot?.isStarted) || 
    (state.gameMode === "bot" && snapshot !== null)
  );

  voiceChatController.syncSession({
    roomId: state.roomId,
    role: state.role,
    gameMode: state.gameMode,
    isGameActive,
  });

  if (isGameActive && state.botPickerOpen) {
    closeBotDifficultyPicker();
  }
  
  const canVote = state.role === "w" || state.role === "b";
  const isSeatedPlayer = state.role === "w" || state.role === "b";
  const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));
  const analysisLocked = Boolean(snapshot?.analysis.locked && state.gameMode === "multiplayer");
  const maxMoves = snapshot?.moves.length ?? 0;

  inGameFriendRequest.hidden = pendingInGameFriendRequest === null || !isGameActive || state.gameMode !== "multiplayer";
  if (pendingInGameFriendRequest) {
    inGameFriendRequestText.textContent = `${pendingInGameFriendRequest.fromName} sent you a friend request.`;
  }

  // 2. Setup UI & Action Visibility Toggles
  gameNavRow.hidden = !isGameActive || maxMoves === 0;

  roomBadge.textContent = state.roomId ? `Room ${state.roomId}` : "No active room";
  roleBadge.textContent = humanRole(state.role);
  shareLink.textContent = state.shareUrl || "Create or join a room to get a live invite link.";

  const heroCopy = document.querySelector<HTMLElement>(".hero-copy");
  if (heroCopy) heroCopy.hidden = isGameActive;

  inviteJoinCard.hidden = isGameActive;
  createRoomButton.hidden = isGameActive;
  playBotButton.hidden = isGameActive;
  botDifficultyOverlay.hidden = isGameActive;

  leaveRoomButton.hidden = !hasRoom;
  // Join controls are main-menu only to avoid room-switch conflicts while already in a room.
  joinGrid.hidden = hasRoom;
  copyLinkButton.hidden = !state.shareUrl || isGameActive;
  flipBoardButton.hidden = !isGameActive;
  focusModeButton.hidden = !isGameActive;
  gameNav.hidden = !isGameActive;
  
  seatCard.hidden = !hasRoom;
  summaryCard.hidden = !isGameActive;
  movesCard.hidden = !isGameActive;
  inGameFriendPanel.hidden = !isGameActive || state.gameMode !== "multiplayer" || !isSeatedPlayer;

  liveAnalysisButton.hidden = !isGameActive || !canVote || state.gameMode === "bot" || (state.gameMode === "multiplayer" && analysisLocked);
  labelsOnlyButton.hidden = !isGameActive || !canVote;
  undoRequestButton.hidden = !isGameActive || !canVote || state.gameMode !== "multiplayer";
  undoDeclineButton.hidden = true;
  rematchButton.hidden = !gameEnded || !canVote || !hasRoom;
  resignButton.hidden = !isGameActive || gameEnded || !canVote;

  if (!isGameActive && state.focusMode) {
    state.focusMode = false;
    applyFocusMode();
  }
  
  // 3. Early Exit if No Snapshot (Lobby State)
  if (!snapshot) {
    pregamePlaceholder.hidden = false;
    pregameWaiting.hidden = false;
    pregameSelection.hidden = true;
    matchStatus.textContent = "Create a room to start.";
    whiteSeat.textContent = "Waiting for player";
    blackSeat.textContent = "Waiting for player";
    turnMeta.textContent = "White";
    movesMeta.textContent = "0";
    spectatorMeta.textContent = "0";
    whiteClock.textContent = "03:00";
    blackClock.textContent = "03:00";
    whiteClock.classList.remove("is-low");
    blackClock.classList.remove("is-low");
    modeHint.textContent = "Room creator selects the timer. Color choice and ready are still required.";
    summaryText.textContent = "Ready to play.";
    liveAnalysisText.textContent = "Live analysis disabled.";
    inGameFriendPanel.hidden = true;
    inGameFriendMeta.textContent = "Opponent info unavailable.";
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
    updateFocusHud();
    return;
  }
  
  // 4. Pregame Selection Menu Logic (Consolidated!)
  pregamePlaceholder.hidden = isGameActive;

  if (isMultiplayer && !isGameActive) {
     const canConfigurePregame = state.role === "w" || state.role === "b";
     pregameSelection.hidden = !canConfigurePregame;
     pregameWaiting.hidden = canConfigurePregame;

     if (canConfigurePregame) {
       const isWhiteSeat = state.role === "w";
       const myChoice = isWhiteSeat ? snapshot.pregame.p1Choice : snapshot.pregame.p2Choice;
       const opChoice = isWhiteSeat ? snapshot.pregame.p2Choice : snapshot.pregame.p1Choice;
       const myReady = isWhiteSeat ? snapshot.pregame.p1Ready : snapshot.pregame.p2Ready;
       const opReady = isWhiteSeat ? snapshot.pregame.p2Ready : snapshot.pregame.p1Ready;
       const opponentConnected = isWhiteSeat ? snapshot.players.blackConnected : snapshot.players.whiteConnected;

       const selectedMode = snapshot.timeControl.id;
       modeBlitz3.classList.toggle("selected", selectedMode === "blitz3");
       modeRapid10.classList.toggle("selected", selectedMode === "rapid10");
       modeBlitz3p2.classList.toggle("selected", selectedMode === "blitz3p2");

       modeBlitz3.disabled = !isCreator;
       modeRapid10.disabled = !isCreator;
       modeBlitz3p2.disabled = !isCreator;

       if (isCreator) {
         modeHint.textContent = `You are the room creator. Current mode: ${snapshot.timeControl.label}.`;
       } else {
         modeHint.textContent = `Room creator controls mode. Current mode: ${snapshot.timeControl.label}.`;
       }

       myPickWhite.classList.toggle("selected", myChoice === "w");
       myPickBlack.classList.toggle("selected", myChoice === "b");
       opPickWhite.classList.toggle("selected", opChoice === "w");
       opPickBlack.classList.toggle("selected", opChoice === "b");
       opPickWhite.classList.toggle("disabled", !opponentConnected);
       opPickBlack.classList.toggle("disabled", !opponentConnected);

       myReadyBadge.classList.toggle("is-ready", myReady);
       opReadyBadge.classList.toggle("is-ready", opReady);

       const hasConflict = myChoice !== null && opChoice !== null && myChoice === opChoice;
       pregameConflictWarning.hidden = !hasConflict;

       pregameReadyBtn.hidden = false;
       pregameReadyBtn.disabled = !bothConnected || myChoice === null || hasConflict || myReady;
       if (!bothConnected || myReady) {
         pregameReadyBtn.textContent = "Waiting for Opponent...";
       } else {
         pregameReadyBtn.textContent = "Ready to Play";
       }

       if (!bothConnected) {
         pregameConflictWarning.hidden = true;
       }
    } else {
       pregameReadyBtn.hidden = true;
    }
  } else {
    modeBlitz3.disabled = true;
    modeRapid10.disabled = true;
    modeBlitz3p2.disabled = true;
    pregameReadyBtn.hidden = state.role === "spectator";
  }

  // 5. Live Game Data
  matchStatus.textContent = snapshot.status;
  whiteSeat.textContent = snapshot.players.whiteConnected
    ? seatLabel("w", snapshot.players.whiteName, snapshot.players.whiteFriendId, snapshot.players.whiteUserId)
    : "Waiting for player";
  blackSeat.textContent = snapshot.players.blackConnected
    ? seatLabel("b", snapshot.players.blackName, snapshot.players.blackFriendId, snapshot.players.blackUserId)
    : "Waiting for player";
  turnMeta.textContent = snapshot.turn === "w" ? "White" : "Black";
  movesMeta.textContent = String(snapshot.moveCount);
  spectatorMeta.textContent = String(snapshot.players.spectatorCount);

  const whiteMs = getDisplayClockMs(snapshot, "w");
  const blackMs = getDisplayClockMs(snapshot, "b");
  whiteClock.textContent = formatClockMs(whiteMs);
  blackClock.textContent = formatClockMs(blackMs);
  whiteClock.classList.toggle("is-low", snapshot.isStarted && whiteMs <= snapshot.clock.lowTimeThresholdMs);
  blackClock.classList.toggle("is-low", snapshot.isStarted && blackMs <= snapshot.clock.lowTimeThresholdMs);

  const opponentSeat = getOpponentSeatInfo(snapshot);
  if (inGameFriendPanel.hidden || !opponentSeat || !opponentSeat.connected) {
    inGameFriendMeta.textContent = "Waiting for opponent to connect.";
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
  } else if (!opponentSeat.userId || !opponentSeat.friendId) {
    inGameFriendMeta.textContent = `${opponentSeat.name} is playing as guest.`;
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
  } else {
    inGameFriendMeta.textContent = `Opponent: ${opponentSeat.name} (ID ${opponentSeat.friendId})`;
    sendFriendRequestButton.hidden = false;
    sendFriendRequestButton.disabled = sendFriendRequestBusy;
    sendFriendRequestButton.textContent = sendFriendRequestBusy ? "Sending..." : "Send Friend Request";
  }

  // 6. Text Summary
  const roleDescription = state.role === "spectator"
    ? "Spectating."
    : state.role ? `Playing ${state.role === "w" ? "White" : "Black"}.` : "Not seated.";
      
  const lastMoveDescription = snapshot.lastMove
    ? ` Last move: ${snapshot.lastMove.san} (${snapshot.lastMove.from} to ${snapshot.lastMove.to}).`
    : "";
    
  const rematchDescription = (state.gameMode === "multiplayer" && snapshot.rematchVotes > 0)
    ? ` Rematch votes: ${snapshot.rematchVotes}/2.` 
    : "";

  const undoDescription = snapshot.undo.pending
    ? ` Undo request pending (${snapshot.undo.requester === "w" ? "White" : snapshot.undo.requester === "b" ? "Black" : "Unknown"}).`
    : "";

  summaryText.textContent = `${roleDescription} ${snapshot.status}${lastMoveDescription}${rematchDescription}${undoDescription}`.trim();

  // 7. Analysis Button State
  if (state.gameMode === "bot") {
    labelsOnlyButton.textContent = snapshot.analysis.enabled ? "Move badges: On" : "Move badges: Off";
    labelsOnlyButton.disabled = false;
  } else {
    const seatedPlayers = Number(snapshot.players.whiteConnected) + Number(snapshot.players.blackConnected);
    liveAnalysisButton.disabled = seatedPlayers < 2 || !canVote;
    liveAnalysisButton.textContent = snapshot.analysis.enabled
      ? "Disable analysis"
      : `Enable analysis (${snapshot.analysis.votes}/2)`;

    if (snapshot.analysis.labelsOnly) {
      labelsOnlyButton.textContent = "Labels only: On";
      labelsOnlyButton.disabled = false;
    } else {
      labelsOnlyButton.textContent = `Show Badges (${snapshot.analysis.labelsVotes}/2)`;
      labelsOnlyButton.disabled = seatedPlayers < 2;
    }
  }

  if (!undoRequestButton.hidden) {
    const canRequestUndo = snapshot.moveCount > 0 && !gameEnded;
    const pendingUndo = snapshot.undo.pending;
    const requester = snapshot.undo.requester;

    if (!pendingUndo) {
      undoRequestButton.textContent = "Request undo";
      undoRequestButton.disabled = !canRequestUndo;
    } else if (requester && requester !== state.role) {
      undoRequestButton.textContent = "Accept undo";
      undoRequestButton.disabled = false;
      undoDeclineButton.hidden = false;
      undoDeclineButton.disabled = false;
    } else {
      undoRequestButton.textContent = "Undo requested...";
      undoRequestButton.disabled = true;
    }
  }

  rematchButton.disabled = !gameEnded;

  // 8. Live Analysis Text
  if (snapshot.analysis.enabled) {
    liveAnalysisText.textContent = state.liveAnalysisSummary;
  } else if (analysisLocked && snapshot.analysis.labelsOnly) {
    liveAnalysisText.textContent = state.liveAnalysisSummary || "Labels-only mode active. Best lines are hidden.";
  } else if (analysisLocked && state.gameMode === "multiplayer" && snapshot.analysis.labelsVotes > 0) {
    liveAnalysisText.textContent = `Labels-only vote pending: ${snapshot.analysis.labelsVotes}/2.`;
  } else if (analysisLocked) {
    liveAnalysisText.textContent = "Live analysis and best-move arrows are disabled during active multiplayer games.";
  } else if (state.gameMode === "multiplayer" && snapshot.analysis.votes > 0) {
    liveAnalysisText.textContent = `Waiting for both players: ${snapshot.analysis.votes}/2 ready.`;
  } else {
    liveAnalysisText.textContent = "Live analysis disabled.";
  }

  // 9. Wipe the old banner if the game restarts
  if (!gameEnded) {
    const existingOverlay = document.querySelector('.game-over-overlay');
    if (existingOverlay) existingOverlay.remove();
  }

  updateFocusHud();
}

/** * Cancels the current drag interaction and cleans up UI elements.
 * This ensures that if a piece is captured while being held, it disappears from the cursor.
 */
function cancelCurrentDrag(): void {
  if (ptrDragNode) {
    ptrDragNode.remove();
    ptrDragNode = null;
  }
  
  if (ptrDragFrom) {
    const draggedSquareEl = board.querySelector<HTMLElement>(`[data-square="${ptrDragFrom}"]`);
    draggedSquareEl?.classList.remove("dragging");
    ptrDragFrom = null;
  }
  
  ptrDragMoved = false;
  
  // Clear the internal selection state to prevent "ghost" highlight rings
  state.selectedSquare = null;
  state.legalTargets = [];
}

function getDisplayBoard(): Chess {
  if (state.viewCursor === null || !state.snapshot) {
    return state.premoves.length > 0 ? getVirtualBoard() : chess;
  }

  const historyBoard = new Chess();
  for (let i = 0; i < state.viewCursor; i++) {
    const move = state.snapshot.moves[i];
    if (move) historyBoard.move(move.san); // FIX: Safe check
  }
  return historyBoard;
}


function renderBoard(): void {
  if (ptrDragFrom) {
    const pieceAtSource = chess.get(ptrDragFrom);
    if (!pieceAtSource || pieceAtSource.color !== state.role) {
      cancelCurrentDrag();
    }
  }

  const fragment = document.createDocumentFragment();
  const squares = buildSquareList(state.orientation);
  
  const isHistoryView = state.viewCursor !== null;
  const displayBoard = getDisplayBoard();
  
  let lastMove = state.snapshot?.lastMove ?? null;
  if (isHistoryView && state.snapshot && state.viewCursor !== null && state.viewCursor > 0) {
    lastMove = state.snapshot.moves[state.viewCursor - 1] ?? null;
  } else if (isHistoryView && state.viewCursor === 0) {
    lastMove = null;
  }

  const lastMoveSquares = new Set<string>();
  if (lastMove) {
    lastMoveSquares.add(lastMove.from);
    lastMoveSquares.add(lastMove.to);
  }

  let checkedKingSquare: string | null = null;
  if (displayBoard.isCheck()) {
    const checkedColor = displayBoard.turn();
    for (const sqName of squares) {
      const p = displayBoard.get(sqName as Square);
      if (p?.type === "k" && p.color === checkedColor) {
        checkedKingSquare = sqName;
        break;
      }
    }
  }

  const liveGrade = state.snapshot
    && (state.snapshot.analysis.enabled || state.snapshot.analysis.labelsOnly)
    && state.snapshot.lastMove
    ? state.liveMoveGrades[state.snapshot.moveCount]
    : undefined;
    
  const liveMarkerSquare = (!isHistoryView && liveGrade && state.snapshot?.lastMove) 
    ? state.snapshot.lastMove.to 
    : null;
  const showQualityCallout = !isHistoryView && liveGrade && liveMarkerSquare
    && (liveGrade.category === "great" || liveGrade.category === "brilliant");
  const liveQualityCalloutKey = showQualityCallout
    ? `${state.snapshot?.moveCount ?? 0}:${liveGrade!.category}:${liveMarkerSquare}`
    : null;

  for (const squareName of squares) {
    const square = squareName as Square;
    const piece = displayBoard.get(square);
    
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.className = `square ${isLightSquare(squareName) ? "light" : "dark"}`;
    button.dataset.square = squareName;

  if (lastMoveSquares.has(squareName)) button.classList.add("last-move");
  if (checkedKingSquare === squareName) button.classList.add("in-check");
  if (squareAnnotations.has(squareName)) button.classList.add("highlight-red"); // NEW
  if (liveGrade?.category === "great" && liveMarkerSquare === squareName) button.classList.add("great-move-highlight");
  if (liveGrade?.category === "brilliant" && liveMarkerSquare === squareName) button.classList.add("brilliant-move-highlight");
  
  // Also inside renderBoard(), anywhere outside the loop:
  if (!gameNavRow.hidden) {
    const isHistoryView = state.viewCursor !== null;
    const maxMoves = state.snapshot?.moves.length ?? 0;
    const currentPos = isHistoryView ? state.viewCursor! : maxMoves;

    liveNavFirst.disabled = currentPos === 0;
    liveNavPrev.disabled = currentPos === 0;
    liveNavNext.disabled = currentPos === maxMoves;
    liveNavLast.disabled = currentPos === maxMoves;
  }

    if (!isHistoryView && state.selectedSquare === square) button.classList.add("selected");
    if (!isHistoryView && state.legalMovesEnabled && state.legalTargets.includes(square)) button.classList.add("legal");
    
    if (lastMoveSquares.has(squareName)) button.classList.add("last-move");
    if (checkedKingSquare === squareName) button.classList.add("in-check");

    if (square === ptrDragFrom) button.classList.add("dragging");

    // --- 1. PREMOVE & RED CAPTURE LOGIC ---
    if (!isHistoryView) {
      state.premoves.forEach((p) => {
        if (p.from === square) button.classList.add("premove-from");
        if (p.to === square) {
          button.classList.add("premove-to");
          if (piece) button.classList.add("premove-capture");
        }
      });
    }

    // --- 2. RENDER REAL PIECE (OPTIMIZED VISIBILITY) ---
    if (piece) {
      const spritePath = PIECES[`${piece.color}${piece.type}`];
      const pieceElement = document.createElement("span");
      pieceElement.className = `piece piece-${piece.type} ${piece.color === "w" ? "white" : "black"}`;
      
      const isMyPremove = suppressAnimationForMove && square === suppressAnimationForMove.to;
      const isTargetOfActiveAnimation = square === animatingToSquare && !animationFinished;
      const isBeingDragged = square === ptrDragFrom;

      const shouldHide = (isTargetOfActiveAnimation && activeGhostNode) || isBeingDragged;

      if (shouldHide && !isMyPremove && !isHistoryView) {
        pieceElement.style.opacity = "0";
        pieceElement.style.visibility = "hidden";
        pieceElement.style.pointerEvents = "none";
      } else {
      
        pieceElement.style.opacity = "1";
        pieceElement.style.visibility = "";
        pieceElement.style.pointerEvents = "";
      }

      if (isMyPremove) pieceElement.style.transition = "none";

      const pieceImage = document.createElement("img");
      pieceImage.className = "piece-image";
      pieceImage.src = spritePath;
      pieceImage.draggable = false;
      pieceElement.append(pieceImage);
      button.append(pieceElement);

      if (liveGrade && liveMarkerSquare === squareName) {
        const marker = document.createElement("span");
        marker.className = `piece-quality-marker ${liveGrade.category}`;
        appendLiveCategoryMarkerContent(marker, liveGrade.category);
        button.append(marker);
      }
    }

    fragment.append(button);
  }

  board.replaceChildren(fragment);

  if (showQualityCallout && liveQualityCalloutKey && lastLiveQualityCalloutKey !== liveQualityCalloutKey) {
    lastLiveQualityCalloutKey = liveQualityCalloutKey;
    showLiveQualityMoveCallout(liveGrade.category, liveMarkerSquare);
  }

  if (!isHistoryView) {
    const isPremoveExecution = suppressAnimationForMove && 
                               lastMove && 
                               lastMove.from === suppressAnimationForMove.from && 
                               lastMove.to === suppressAnimationForMove.to;

    if (isPremoveExecution) {
      lastAnimatedMoveKey = `${state.snapshot!.moveCount}:${lastMove!.from}:${lastMove!.to}:${lastMove!.san}`;
      suppressAnimationForMove = null; 
      animationFinished = true;
      requestAnimationFrame(() => renderBoard());
    } else if (lastMove) {
      const moveKey = `${state.snapshot!.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
      if (lastAnimatedMoveKey !== moveKey) {
        if (state.animationStyle === "epic") animateLastMoveEpic(lastMove);
        else animateLastMove(lastMove);
      }
    }
  } else {
    if (activeGhostAnimation) {
      const tempAnim = activeGhostAnimation;
      activeGhostAnimation = null; 
      tempAnim.cancel();
    }
  }

  renderArrows();

  const snapshot = state.snapshot;
  const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));

  if (gameEnded && snapshot && !isHistoryView) {
    const overlay = document.createElement("div");
    overlay.className = "game-over-overlay";

    // The new cinematic wrapper
    const banner = document.createElement("div");
    banner.className = "game-over-banner";

    const title = document.createElement("h2");
    title.className = "game-over-title";
    
    if (snapshot.checkmate) title.textContent = snapshot.winner === "w" ? "White Wins!" : "Black Wins!";
    else if (snapshot.draw) title.textContent = "Draw";
    else if (snapshot.winner) title.textContent = snapshot.winner === "w" ? "White Wins" : "Black Wins";

    const reason = document.createElement("p");
    reason.className = "game-over-reason";
    reason.textContent = snapshot.status;

    // A container to keep the buttons neatly side-by-side
    const actionContainer = document.createElement("div");
    actionContainer.className = "game-over-actions";

    const overlayRematchBtn = document.createElement("button");
    overlayRematchBtn.className = "action cta-turquoise";
    overlayRematchBtn.textContent = state.gameMode === "bot" ? "Play Again" : "Request Rematch";
    overlayRematchBtn.onclick = () => {
      if (state.gameMode === "bot") startBotGame();
      else socket.emit("game:rematch");
    };

    const overlayAnalyzeBtn = document.createElement("a");
    overlayAnalyzeBtn.className = "action cta-rainbow";
    overlayAnalyzeBtn.style.textDecoration = "none";
    overlayAnalyzeBtn.onclick = () => {
      localStorage.setItem("postGameMeta", JSON.stringify({
        whiteName: snapshot.players.whiteName,
        blackName: snapshot.players.blackName,
      }));
      localStorage.setItem("postGameMoves", JSON.stringify(snapshot.moves.map(m => m.san)));
      window.location.href = "/analyze";
    };
    overlayAnalyzeBtn.textContent = "Analyze Game";

    actionContainer.append(overlayRematchBtn, overlayAnalyzeBtn);
    banner.append(title, reason, actionContainer);
    overlay.append(banner);
    board.append(overlay);
  }
}

function getSquareFromPoint(clientX: number, clientY: number): Square | null {
  const node = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const squareButton = node?.closest<HTMLButtonElement>(".square");
  return (squareButton?.dataset.square as Square | undefined) ?? null;
}

function boardPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
  const rect = board.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 400, y: 400 };
  }

  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const clampedX = Math.max(0, Math.min(rect.width, localX));
  const clampedY = Math.max(0, Math.min(rect.height, localY));

  return {
    x: (clampedX / rect.width) * 800,
    y: (clampedY / rect.height) * 800,
  };
}

function squareCenter(square: Square): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = state.orientation === "w" ? file : 7 - file;
  const row = state.orientation === "w" ? 7 - rank : rank;

  return {
    x: col * 100 + 50,
    y: row * 100 + 50,
  };
}

function showLiveQualityMoveCallout(category: MoveCategory, square: Square): void {
  if (!boardWrap) {
    return;
  }

  activeLiveQualityCallout?.remove();
  activeLiveQualityCallout = null;

  const center = squareCenter(square);
  const callout = document.createElement("div");
  callout.className = `move-quality-callout move-quality-callout--${category}`;
  callout.textContent = category === "great" ? "Great Move" : "Brilliant Move";
  callout.style.left = `${(center.x / 800) * 100}%`;
  callout.style.top = `${(center.y / 800) * 100}%`;

  boardWrap.append(callout);
  activeLiveQualityCallout = callout;

  const clearCallout = () => {
    if (activeLiveQualityCallout === callout) {
      activeLiveQualityCallout = null;
    }
    callout.remove();
  };

  callout.addEventListener("animationend", clearCallout, { once: true });
  window.setTimeout(clearCallout, 2000);
}

function countFenPieces(fen: string): number {
  const boardFen = fen.split(" ")[0] ?? "";
  let count = 0;
  for (const ch of boardFen) {
    if (/[prnbqkPRNBQK]/.test(ch)) {
      count += 1;
    }
  }
  return count;
}

function detectCapturedPiece(previousFen: string, lastMove: MoveSummary): PieceSymbol | null {
  const replay = new Chess(previousFen);
  const promotionMatch = lastMove.san.match(/=([QRBN])/);
  const promotion = promotionMatch?.[1]?.toLowerCase() as PieceSymbol | undefined;

  let move: Move | null = null;
  try {
    move = replay.move(
      promotion 
        ? { from: lastMove.from, to: lastMove.to, promotion: promotion as "q" | "r" | "b" | "n" }
        : { from: lastMove.from, to: lastMove.to }
    );
  } catch {
    return null;
  }

  return move?.captured ?? null;
}

function triggerCheckFlash(): void {
  const flash = document.createElement("div");
  flash.className = "check-flash-overlay";
  document.body.append(flash);
  flash.addEventListener("animationend", () => flash.remove(), { once: true });
}

function spawnBloodSplatter(square: Square, capturedPiece: PieceSymbol): void {
  const boardWrap = board.parentElement as HTMLElement | null;
  if (!boardWrap) return;

  // Reduced intensity multipliers so queens don't crash the browser
  const intensityByPiece: Record<PieceSymbol, number> = {
    p: 0.6, n: 0.8, b: 0.8, r: 1.0, q: 1.4, k: 1.2,
  };
  const intensity = intensityByPiece[capturedPiece] ?? 0.8;

  const center = squareCenter(square);
  const splatter = document.createElement("div");
  splatter.className = "capture-splatter";
  splatter.style.left = `${(center.x / 800) * 100}%`;
  splatter.style.top = `${(center.y / 800) * 100}%`;
  splatter.style.setProperty("--intensity", String(intensity));

  const dropCount = Math.floor(4 + Math.random() * 6 * intensity);
  
  for (let index = 0; index < dropCount; index += 1) {
    const drop = document.createElement("span");
    drop.className = "capture-drop";
    const angle = Math.random() * Math.PI * 2;
    const distance = (20 + Math.random() * 40) * intensity;
    const size = (6 + Math.random() * 10) * intensity; // Slightly larger drops to compensate
    
    drop.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    drop.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    drop.style.setProperty("--size", `${size}px`);
    drop.style.setProperty("--delay", `${Math.random() * 50}ms`);
    splatter.append(drop);
  }

  boardWrap.append(splatter);
  
  setTimeout(() => splatter.remove(), 2500); 
}

function toggleArrow(from: Square, to: Square): void {
  const key = `${from}-${to}`;
  if (arrowAnnotations.has(key)) {
    arrowAnnotations.delete(key);
    return;
  }

  arrowAnnotations.add(key);
}

function clearArrows(): boolean {
  if (arrowAnnotations.size === 0 && squareAnnotations.size === 0) {
    return false;
  }

  arrowAnnotations.clear();
  squareAnnotations.clear();
  renderArrows();
  requestBoardRefresh(true);
  return true;
}

function isSnapshotGameOver(snapshot: RoomSnapshot): boolean {
  return snapshot.checkmate || snapshot.draw || snapshot.winner !== null;
}

function isLiveAnalysisLocked(snapshot: RoomSnapshot): boolean {
  return state.gameMode === "multiplayer" && snapshot.analysis.locked;
}

function isLabelsOnlyMode(snapshot: RoomSnapshot): boolean {
  return isLiveAnalysisLocked(snapshot) && snapshot.analysis.labelsOnly;
}

function isBotBadgesMode(snapshot: RoomSnapshot): boolean {
  return state.gameMode === "bot" && snapshot.analysis.enabled;
}

function clearBestMoveArrow(): void {
  if (!state.bestMoveArrow && !state.bestMoveArrowFen) {
    return;
  }

  bestMoveArrowToken += 1;
  state.bestMoveArrow = null;
  state.bestMoveArrowFen = null;
  renderArrows();
}

async function maybeUpdateBestMoveArrow(snapshot: RoomSnapshot | null): Promise<void> {
  if (!snapshot) {
    clearBestMoveArrow();
    return;
  }

  if (isLiveAnalysisLocked(snapshot) || isBotBadgesMode(snapshot)) {
    clearBestMoveArrow();
    return;
  }

  const shouldShow = canShowBestMoveArrow(snapshot.analysis.enabled, isSnapshotGameOver(snapshot));
  if (!shouldShow) {
    clearBestMoveArrow();
    return;
  }

  if (state.bestMoveArrowFen === snapshot.fen) {
    return;
  }

  const token = ++bestMoveArrowToken;

  try {
    if (!liveAnalyzer) {
      liveAnalyzer = new StockfishBridge();
    }

    const evaluation = await liveAnalyzer.evaluateFen(snapshot.fen, 10);
    if (token !== bestMoveArrowToken) {
      return;
    }

    state.bestMoveArrow = parseBestMoveArrow(evaluation.bestMove);
    state.bestMoveArrowFen = snapshot.fen;
  } catch {
    if (token !== bestMoveArrowToken) {
      return;
    }

    state.bestMoveArrow = null;
    state.bestMoveArrowFen = snapshot.fen;
  }

  renderArrows();
}

function renderArrows(): void {
  const snapshot = state.snapshot;
  const bestMove = snapshot
    && !isLiveAnalysisLocked(snapshot)
    && !isBotBadgesMode(snapshot)
    && canShowBestMoveArrow(snapshot.analysis.enabled, isSnapshotGameOver(snapshot))
    ? state.bestMoveArrow
    : null;

  arrowLayer.innerHTML = buildArrowLayerMarkup({
    variant: "board",
    annotations: arrowAnnotations,
    preview: arrowDragFrom && arrowDragPointer
      ? { from: arrowDragFrom, pointer: arrowDragPointer }
      : null,
    bestMove,
    squareCenter,
  });
}

function syncBoardInteractionState(): void {
  for (const squareButton of board.querySelectorAll<HTMLButtonElement>(".square")) {
    const square = squareButton.dataset.square as Square | undefined;
    if (!square) {
      continue;
    }

    squareButton.classList.toggle("selected", state.selectedSquare === square);
    squareButton.classList.toggle("legal", state.legalMovesEnabled && state.legalTargets.includes(square));    
    squareButton.classList.toggle("dragging", square === ptrDragFrom);
  }
}


// main.ts
function checkAndExecutePremove(): void {
  const snapshot = state.snapshot;
  if (!snapshot || !state.role || state.role === "spectator") return;

  if (snapshot.turn === state.role && state.premoves.length > 0) {
    const nextMove = state.premoves.shift();
    if (nextMove) {
      const isLegal = chess.moves({ verbose: true }).some(m => m.from === nextMove.from && m.to === nextMove.to);
      
      if (isLegal && !snapshot.checkmate && !snapshot.draw) {
        // Marcamos para que renderBoard sepa que este movimiento NO se anima
        suppressAnimationForMove = { from: nextMove.from, to: nextMove.to };
        animationFinished = true; 

        tryMoveFromTo(nextMove.from, nextMove.to);

        // Forzamos el refresco inmediato para limpiar las marcas rojas del premove
        requestBoardRefresh(true); 
      } else {
        state.premoves = [];
      }
    }
  }
}

function renderMoves(): void {
  const snapshot = state.snapshot;
  if (!snapshot || snapshot.moves.length === 0) {
    moveList.innerHTML = '<div class="empty-state">No moves yet.</div>';
    return;
  }

  const rows: string[] = [];
  for (let index = 0; index < snapshot.moves.length; index += 2) {
    const whiteMove = snapshot.moves[index] as MoveSummary | undefined;
    const blackMove = snapshot.moves[index + 1] as MoveSummary | undefined;
    
    const whitePly = index + 1;
    const blackPly = index + 2;
    
    const whiteGrade = state.liveMoveGrades[whitePly];
    const blackGrade = state.liveMoveGrades[blackPly];
    
    const whiteBadge = whiteMove && whiteGrade
      ? ` <span class="move-quality-tag ${whiteGrade.category}">${whiteGrade.label}</span>`
      : "";
    const blackBadge = blackMove && blackGrade
      ? ` <span class="move-quality-tag ${blackGrade.category}">${blackGrade.label}</span>`
      : "";
      
    const moveNumber = Math.floor(index / 2) + 1;

    // Apply a highlight if the user is currently viewing this specific move in history
    const wActiveStyle = state.viewCursor === whitePly ? "background: var(--accent); color: #fffdf8;" : "";
    const bActiveStyle = state.viewCursor === blackPly ? "background: var(--accent); color: #fffdf8;" : "";

    rows.push(`
      <div class="move-row">
        <strong>${moveNumber}.</strong>
        <span class="move-clickable" data-index="${whitePly}" style="cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s ease, color 0.2s ease; ${wActiveStyle}">
          ${whiteMove ? whiteMove.san : ""}${whiteBadge}
        </span>
        <span class="move-clickable" data-index="${blackPly}" style="cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s ease, color 0.2s ease; ${bActiveStyle}">
          ${blackMove ? blackMove.san : ""}${blackBadge}
        </span>
      </div>
    `);
  }

  moveList.innerHTML = rows.join("");
}

moveList.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLSpanElement>(".move-clickable");
  if (!target || !state.snapshot) return;
  
  const index = parseInt(target.dataset.index!, 10);
  navigateToHistoryPosition(index);
});
function updateCaption(): void {
  const snapshot = state.snapshot;
  
  if (!snapshot || !state.role || state.role === "spectator") {
    boardCaption.textContent = snapshot ? `Spectating room ${snapshot.roomId}` : "";
    return;
  }

  const myColor = state.role as PlayerRole;
  const opColor = myColor === "w" ? "b" : "w";
  
  // FIX: Replay the server's authoritative move list on a temporary board.
  // This completely sidesteps the "FEN wiping history" bug.
  const movesToReplay = state.viewCursor !== null 
    ? snapshot.moves.slice(0, state.viewCursor) 
    : snapshot.moves;

  const replayBoard = new Chess();
  const myCaptures: PieceSymbol[] = [];
  const opCaptures: PieceSymbol[] = [];

  for (const moveSummary of movesToReplay) {
    const moveResult = replayBoard.move(moveSummary.san);
    if (moveResult && moveResult.captured) {
      if (moveResult.color === myColor) {
        myCaptures.push(moveResult.captured); // We captured their piece
      } else {
        opCaptures.push(moveResult.captured); // They captured our piece
      }
    }
  }

  // Sort captures: Queens first, then Rooks, Bishops, Knights, Pawns
  const sortOrder: Record<PieceSymbol, number> = { q: 1, r: 2, b: 3, n: 4, p: 5, k: 6 };
  myCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
  opCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);

  let myCapturesHtml = "";
  myCaptures.forEach(piece => {
    myCapturesHtml += `<img src="${PIECES[`${opColor}${piece}` as keyof typeof PIECES]}" class="captured-icon" />`;
  });

  let opCapturesHtml = "";
  opCaptures.forEach(piece => {
    opCapturesHtml += `<img src="${PIECES[`${myColor}${piece}` as keyof typeof PIECES]}" class="captured-icon" />`;
  });

  const currentFen = replayBoard.fen();
  const rawValue = materialFromPerspective(currentFen, myColor);
  const netValue = Math.floor(rawValue / 100);

  if (!myCapturesHtml && !opCapturesHtml && netValue === 0) {
    boardCaption.innerHTML = `<span style="opacity: 0.6; font-weight: 500;">Material: Even</span>`;
  } else {
    boardCaption.innerHTML = `
      <div class="captures-wrapper">
        ${myCapturesHtml || netValue > 0 ? `
        <div class="captures-row">
          <div class="captures-icons">${myCapturesHtml}</div>
          ${netValue > 0 ? `<strong class="material-score plus">+${netValue}</strong>` : ""}
        </div>` : ""}
        
        ${opCapturesHtml || netValue < 0 ? `
        <div class="captures-row">
          <div class="captures-icons" style="opacity: 0.85;">${opCapturesHtml}</div>
          ${netValue < 0 ? `<strong class="material-score minus">${netValue}</strong>` : ""}
        </div>` : ""}
      </div>
    `;
  }
}

function materialFromPerspective(fen: string, color: "w" | "b"): number {
  const board = fen.split(" ")[0] ?? "";
  let white = 0;
  let black = 0;

  for (const ch of board) {
    if (ch === "/" || /\d/.test(ch)) {
      continue;
    }

    const value = PIECE_VALUES[ch.toLowerCase()] ?? 0;
    if (ch === ch.toUpperCase()) {
      white += value;
    } else {
      black += value;
    }
  }

  return color === "w" ? white - black : black - white;
}

function classifyLiveMoveQuality(input: {
  cpl: number;
  matchesBestMove: boolean;
  materialDelta: number;
  evalGain: number;
  isCapture: boolean;
  previousOpponentCategory: MoveCategory | undefined;
  brilliantOffer: boolean;
}): QualityResult {
  const {
    cpl,
    matchesBestMove,
    materialDelta,
    evalGain,
    isCapture,
    previousOpponentCategory,
    brilliantOffer,
  } = input;

  const opponentBlundered = previousOpponentCategory === "mistake" || previousOpponentCategory === "blunder";
  const isSacrifice = materialDelta <= -100;
  const brilliantSacrifice = isSacrifice && evalGain >= 80 && cpl <= 35;
  const greatPunish = matchesBestMove
    && cpl <= 22
    && opponentBlundered
    && (isCapture || materialDelta >= 100 || evalGain >= 110);

  if (brilliantSacrifice || brilliantOffer) {
    return { category: "brilliant", label: LIVE_CATEGORY_LABELS.brilliant };
  }

  if (greatPunish) {
    return { category: "great", label: LIVE_CATEGORY_LABELS.great };
  }

  if (cpl <= 45) {
    return { category: "excellent", label: LIVE_CATEGORY_LABELS.excellent };
  }

  if (cpl <= 90) {
    return { category: "good", label: LIVE_CATEGORY_LABELS.good };
  }

  if (cpl <= 160) {
    return { category: "inaccuracy", label: LIVE_CATEGORY_LABELS.inaccuracy };
  }

  if (cpl <= 280) {
    return { category: "mistake", label: LIVE_CATEGORY_LABELS.mistake };
  }

  return { category: "blunder", label: LIVE_CATEGORY_LABELS.blunder };
}

async function verifyLiveBrilliantOffer(input: {
  engine: StockfishBridge;
  move: { to: string; san: string; piece?: string };
  beforeFen: string;
  afterFen: string;
  beforeMoverCp: number;
  afterMoverCp: number;
  cpl: number;
  matchesBestMove: boolean;
  materialDelta: number;
}): Promise<boolean> {
  const {
    engine,
    move,
    beforeFen,
    afterFen,
    beforeMoverCp,
    afterMoverCp,
    cpl,
    matchesBestMove,
    materialDelta,
  } = input;

  if (materialDelta < 0 || cpl > 35 || (!matchesBestMove && afterMoverCp < beforeMoverCp - 40)) {
    return false;
  }

  const board = new Chess(afterFen);
  const movedPiece = board.get(move.to as Square)?.type ?? (move.piece as PieceSymbol | undefined);
  const movedPieceValue = movedPiece ? (PIECE_VALUES[movedPiece] ?? 0) : 0;
  if (movedPieceValue < 330) {
    return false;
  }

  const captureReplies = board.moves({ verbose: true }).filter((reply) => {
    if (reply.to !== move.to || !reply.captured) {
      return false;
    }

    const capturerValue = PIECE_VALUES[reply.piece] ?? 0;
    return capturerValue <= movedPieceValue;
  });

  if (captureReplies.length === 0) {
    return false;
  }

  let worstReplyScore = Number.POSITIVE_INFINITY;
  for (const reply of captureReplies.slice(0, 3)) {
    const replyBoard = new Chess(afterFen);
    replyBoard.move(reply);
    const replyEval = await engine.evaluateFen(replyBoard.fen(), LIVE_BRILLIANT_VERIFICATION_DEPTH);
    worstReplyScore = Math.min(worstReplyScore, replyEval.cp);
  }

  return worstReplyScore >= Math.max(150, beforeMoverCp - 90);
}

function symbolForLiveCategory(category: "brilliant" | "great" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder"): string {
  return LIVE_CATEGORY_TEXT_SYMBOLS[category];
}

function appendLiveCategoryMarkerContent(marker: HTMLElement, category: MoveCategory): void {
  const iconPath = LIVE_CATEGORY_BADGE_ICON_PATHS[category];
  if (iconPath) {
    const icon = document.createElement("img");
    icon.className = "piece-quality-marker-icon";
    icon.src = iconPath;
    icon.alt = `${LIVE_CATEGORY_LABELS[category]} move`;
    icon.draggable = false;
    marker.append(icon);
    return;
  }

  marker.textContent = symbolForLiveCategory(category);
}

function summarizeLiveMove(label: string, cpl: number, san: string): string {
  return `${label}: ${san} (${cpl} CPL)`;
}

function buildBeforeAfterFenFromMoves(moves: MoveSummary[]): { beforeFen: string; afterFen: string } | null {
  if (moves.length === 0) {
    return null;
  }

  const replay = new Chess();
  for (let index = 0; index < moves.length - 1; index += 1) {
    replay.move(moves[index]!.san);
  }

  const beforeFen = replay.fen();
  replay.move(moves[moves.length - 1]!.san);
  const afterFen = replay.fen();
  return { beforeFen, afterFen };
}

async function maybeRunLiveAnalysis(snapshot: RoomSnapshot): Promise<void> {
  const labelsOnlyMode = isLabelsOnlyMode(snapshot);
  if (isLiveAnalysisLocked(snapshot) && !labelsOnlyMode) {
    state.liveAnalysisSummary = "Live analysis disabled during active multiplayer games.";
    return;
  }

  if ((!snapshot.analysis.enabled && !labelsOnlyMode) || !snapshot.lastMove || snapshot.moves.length === 0) {
    return;
  }

  const moveKey = `${snapshot.moveCount}:${snapshot.lastMove.from}:${snapshot.lastMove.to}:${snapshot.lastMove.san}`;
  if (state.lastAnalyzedMoveKey === moveKey) {
    return;
  }

  const fenPair = buildBeforeAfterFenFromMoves(snapshot.moves);
  if (!fenPair) {
    return;
  }

  const token = ++liveAnalysisToken;
  state.liveAnalysisSummary = labelsOnlyMode ? "Classifying last move..." : "Analyzing last move...";
  renderSession();

  try {
    if (!liveAnalyzer) {
      liveAnalyzer = new StockfishBridge();
    }

    const [before, after] = await Promise.all([
      liveAnalyzer.evaluateFen(fenPair.beforeFen, 10),
      liveAnalyzer.evaluateFen(fenPair.afterFen, 10),
    ]);

    if (token !== liveAnalysisToken) {
      return;
    }

    if (!state.snapshot) {
      return;
    }

    const stillLabelsOnly = isLabelsOnlyMode(state.snapshot);
    if (!state.snapshot.analysis.enabled && !stillLabelsOnly) {
      return;
    }

    const moverBefore = before.cp;
    const moverAfter = -after.cp;
    const cpl = Math.max(0, Math.round(moverBefore - moverAfter));
    const playedUci = `${snapshot.lastMove.from}${snapshot.lastMove.to}`;
    const matchesBestMove = before.bestMove.startsWith(playedUci);
    const moverColor = (fenPair.beforeFen.split(" ")[1] as "w" | "b") || "w";
    const materialBefore = materialFromPerspective(fenPair.beforeFen, moverColor);
    const materialAfter = materialFromPerspective(fenPair.afterFen, moverColor);
    const materialDelta = materialAfter - materialBefore;
    const evalGain = Math.round(moverAfter - moverBefore);
    const previousOpponentCategory = state.liveMoveGrades[snapshot.moveCount - 1]?.category;
    const brilliantOffer = await verifyLiveBrilliantOffer({
      engine: liveAnalyzer,
      move: snapshot.lastMove,
      beforeFen: fenPair.beforeFen,
      afterFen: fenPair.afterFen,
      beforeMoverCp: moverBefore,
      afterMoverCp: moverAfter,
      cpl,
      matchesBestMove,
      materialDelta,
    });
    const quality = classifyLiveMoveQuality({
      cpl,
      matchesBestMove,
      materialDelta,
      evalGain,
      isCapture: snapshot.lastMove.san.includes("x"),
      previousOpponentCategory,
      brilliantOffer,
    });

    const label = quality.label;
    const category = quality.category;
    state.liveAnalysisSummary = labelsOnlyMode
      ? `${label}: ${snapshot.lastMove.san}`
      : summarizeLiveMove(label, cpl, snapshot.lastMove.san);
    state.liveMoveGrades[snapshot.moveCount] = { label, cpl, category };
    state.lastAnalyzedMoveKey = moveKey;
  } catch {
    if (token !== liveAnalysisToken) {
      return;
    }

    state.liveAnalysisSummary = "Live analysis temporarily unavailable.";
  }

  render();
}

async function maybeRunLiveAnalysisForMove(
  previousMoves: MoveSummary[],
  move: Move,
  _expectedMoveCount: number,
  _expectedMoveKey: string,
): Promise<void> {
  if (!liveAnalyzer) {
    try {
      liveAnalyzer = new StockfishBridge();
    } catch {
      return;
    }
  }

  try {
    // Build FEN before and after this move
    const recreatedChess = new Chess();
    for (const m of previousMoves) {
      recreatedChess.move(m.san);
    }

    const beforeFen = recreatedChess.fen();
    const moveResult = recreatedChess.move(move);
    if (!moveResult) {
      return;
    }
    const afterFen = recreatedChess.fen();

    const [before, after] = await Promise.all([
      liveAnalyzer.evaluateFen(beforeFen, 10),
      liveAnalyzer.evaluateFen(afterFen, 10),
    ]);

    const moverBefore = before.cp;
    const moverAfter = -after.cp;
    const cpl = Math.max(0, Math.round(moverBefore - moverAfter));
    const playedUci = `${moveResult.from}${moveResult.to}`;
    const matchesBestMove = before.bestMove.startsWith(playedUci);
    const moverColor = (beforeFen.split(" ")[1] as "w" | "b") || "w";
    const materialBefore = materialFromPerspective(beforeFen, moverColor);
    const materialAfter = materialFromPerspective(afterFen, moverColor);
    const materialDelta = materialAfter - materialBefore;
    const evalGain = Math.round(moverAfter - moverBefore);
    const previousOpponentCategory = state.liveMoveGrades[(state.snapshot?.moveCount ?? 0) - 1]?.category;
    const brilliantOffer = await verifyLiveBrilliantOffer({
      engine: liveAnalyzer,
      move: moveResult,
      beforeFen,
      afterFen,
      beforeMoverCp: moverBefore,
      afterMoverCp: moverAfter,
      cpl,
      matchesBestMove,
      materialDelta,
    });
    const quality = classifyLiveMoveQuality({
      cpl,
      matchesBestMove,
      materialDelta,
      evalGain,
      isCapture: Boolean(moveResult.captured),
      previousOpponentCategory,
      brilliantOffer,
    });
    const label = quality.label;

    // Keep optimistic feedback textual only; canonical room-state analysis writes final badge.
    state.liveAnalysisSummary = `You played: ${summarizeLiveMove(label, cpl, moveResult.san)}`;
    render();
  } catch (e) {
    console.error("Live analysis error:", e);
  }
}

function getCheckedKingSquare(): Square | null {
  if (!chess.isCheck()) {
    return null;
  }

  const checkedColor = chess.turn();
  for (const squareName of buildSquareList("w")) {
    const square = squareName as Square;
    const piece = chess.get(square);
    if (piece?.type === "k" && piece.color === checkedColor) {
      return square;
    }
  }

  return null;
}

function animateLastMove(lastMove: MoveSummary | null): void {
  if (!state.snapshot || !lastMove) {
    lastAnimatedMoveKey = null;
    return;
  }

  const moveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
  if (lastAnimatedMoveKey === moveKey) return;

  // 1. Reset all flags if a premove or manual drag is happening
  if (state.premoves.length > 0 || suppressAnimationForMove) {
    lastAnimatedMoveKey = moveKey;
    suppressAnimationForMove = null; 
    if (activeGhostAnimation) activeGhostAnimation.cancel();
    activeGhostAnimation = null;
    animationFinished = true;
    animatingToSquare = null;
    return; 
  }

  lastAnimatedMoveKey = moveKey;
  animationFinished = false;
  animatingToSquare = lastMove.to;

  // 2. Cleanup any previous ghost animations
  if (activeGhostAnimation) activeGhostAnimation.cancel();
  if (activeGhostNode) {
    activeGhostNode.remove();
    activeGhostNode = null;
  }
  if (activeGhostDestinationPiece) {
    activeGhostDestinationPiece.style.visibility = "";
    activeGhostDestinationPiece = null;
  }

  const fromSquareButton = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.from}"]`);
  const toSquareButton   = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.to}"]`);
  const destinationPiece = toSquareButton?.querySelector<HTMLElement>(".piece");
  
  if (!fromSquareButton || !toSquareButton || !destinationPiece) {
    animationFinished = true;
    animatingToSquare = null;
    return;
  }

  // 3. Calculate the distance (delta) for the animation
  const fromRect = fromSquareButton.getBoundingClientRect();
  const toRect = toSquareButton.getBoundingClientRect();
  const deltaX = (fromRect.left + fromRect.width / 2) - (toRect.left + toRect.width / 2);
  const deltaY = (fromRect.top + fromRect.height / 2) - (toRect.top + toRect.height / 2);

  // 4. Create the ghostPiece (the one that actually moves)
  const ghostPiece = destinationPiece.cloneNode(true) as HTMLElement;
  const pieceRect = destinationPiece.getBoundingClientRect();
  
  Object.assign(ghostPiece.style, {
    position: "absolute",
    left: `${toRect.left + toRect.width / 2 + window.scrollX}px`,
    top: `${toRect.top + toRect.height / 2 + window.scrollY}px`,
    width: `${pieceRect.width}px`,
    height: `${pieceRect.height}px`,
    transform: "translate3d(-50%, -50%, 0)",
    zIndex: "9999",
    pointerEvents: "none",
    // Notice: No filter here, so no blurry black shadows!
  });

  // Hide the real piece at the destination until the ghost arrives
  destinationPiece.style.visibility = "hidden";
  activeGhostNode = ghostPiece;
  activeGhostDestinationPiece = destinationPiece;
  document.body.append(ghostPiece);

  // 5. Trigger the smooth animation
  const animation = ghostPiece.animate(
    [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0)` },
      { transform: "translate3d(-50%, -50%, 0)" },
    ],
    { duration: SMOOTH_MOVE_DURATION_MS, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }
  );

  activeGhostAnimation = animation;

  let finalized = false;
  const onEnd = () => {
  if (finalized) return;
  finalized = true;
  ghostPiece.remove();
  destinationPiece.style.visibility = "";
  destinationPiece.style.opacity = "1";

  animationFinished = true;
  animatingToSquare = null;

  if (activeGhostAnimation === animation) {
    activeGhostAnimation = null;
    activeGhostNode = null;
    activeGhostDestinationPiece = null;
    
    // If a server update arrived while we were animating, 
    // run the render now that the path is clear.
    if (pendingBoardRefresh) {
      pendingBoardRefresh = false;
      renderBoard();
    }
  }
};

  animation.addEventListener("finish", onEnd);
  animation.addEventListener("cancel", onEnd);
}

function requestBoardRefresh(force = false): void {
  if (force && activeGhostAnimation) {
    const tempAnim = activeGhostAnimation;
    activeGhostAnimation = null; 

    // 1. Physical Cleanup: Remove the moving ghost image
    if (activeGhostNode) {
      activeGhostNode.remove();
      activeGhostNode = null;
    }

    // 2. Visibility Restore: Instantly show the "real" piece again
    if (activeGhostDestinationPiece) {
      activeGhostDestinationPiece.style.visibility = "";
      activeGhostDestinationPiece.style.opacity = "1"; 
      activeGhostDestinationPiece = null;
    }

    // 3. State Reset: Tell the renderer the animation is officially OVER
    animationFinished = true;
    animatingToSquare = null;
    
    // FIX: DO NOT clear lastAnimatedMoveKey here! 
    // Clearing it caused the renderer to think the move had never been animated, 
    // resulting in the piece "re-animating" if you clicked during the movement.

    tempAnim.cancel(); 
  }

  // If a move is still animating and we aren't forcing, queue it up
  if (!force && activeGhostAnimation) {
    pendingBoardRefresh = true;
    return;
  }

  pendingBoardRefresh = false;
  renderBoard();
}

function animateLastMoveEpic(lastMove: MoveSummary | null): void {
  if (!state.snapshot || !lastMove) {
    lastAnimatedMoveKey = null;
    return;
  }

  const moveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
  if (lastAnimatedMoveKey === moveKey) return;

  if (state.premoves.length > 0 || suppressAnimationForMove) {
    lastAnimatedMoveKey = moveKey;
    suppressAnimationForMove = null; 
    if (activeGhostAnimation) activeGhostAnimation.cancel();
    activeGhostAnimation = null;
    animationFinished = true;
    animatingToSquare = null;
    return; 
  }

  lastAnimatedMoveKey = moveKey;
  animationFinished = false;
  animatingToSquare = lastMove.to;

  if (activeGhostAnimation) activeGhostAnimation.cancel();
  if (activeGhostNode) {
    activeGhostNode.remove();
    activeGhostNode = null;
  }
  if (activeGhostDestinationPiece) {
    activeGhostDestinationPiece.style.visibility = "";
    activeGhostDestinationPiece = null;
  }

  const fromSquareButton = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.from}"]`);
  const toSquareButton   = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.to}"]`);
  const destinationPiece = toSquareButton?.querySelector<HTMLElement>(".piece");
  if (!fromSquareButton || !toSquareButton || !destinationPiece) {
    animationFinished = true;
    animatingToSquare = null;
    return;
  }

  const fromRect = fromSquareButton.getBoundingClientRect();
  const toRect = toSquareButton.getBoundingClientRect();
  const startX = fromRect.left + fromRect.width / 2 + window.scrollX;
  const startY = fromRect.top + fromRect.height / 2 + window.scrollY;
  const endX = toRect.left + toRect.width / 2 + window.scrollX;
  const endY = toRect.top + toRect.height / 2 + window.scrollY;
  const deltaX = startX - endX;
  const deltaY = startY - endY;

  const pieceRect = destinationPiece.getBoundingClientRect();
  const ghostPiece = destinationPiece.cloneNode(true) as HTMLElement;
  
  Object.assign(ghostPiece.style, {
    position: "absolute",
    left: `${endX}px`,
    top: `${endY}px`,
    width: `${pieceRect.width}px`,
    height: `${pieceRect.height}px`,
    transform: "translate3d(-50%, -50%, 0)",
    zIndex: "9999",
    pointerEvents: "none",
  });

  destinationPiece.style.visibility = "hidden";
  activeGhostNode = ghostPiece;
  activeGhostDestinationPiece = destinationPiece;
  document.body.append(ghostPiece);

  const aura = state.trailFxEnabled ? "drop-shadow(0 0 12px rgba(255,255,255,0.3))" : "";

  // --- RANDOMIZED PROFILE SYSTEM ---
  const roll = Math.random();
  let profile = "slide"; // 40% chance
  if (roll < 0.3) profile = "smash"; // 30% chance
  else if (roll < 0.6) profile = "spin"; // 30% chance

  let keyframes: Keyframe[] = [];
  let duration: number = EPIC_MOVE_DURATION_MS.spin;

  if (profile === "smash") {
    // 1. THE SMASH (Massive Jump & Scale)
    duration = EPIC_MOVE_DURATION_MS.smash;
    const jump = 90 + Math.random() * 40;
    const scale = 1.25 + Math.random() * 0.15;
    const spin = (Math.random() * 15 + 10) * (Math.random() > 0.5 ? 1 : -1);
    
    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) scale(1)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.15}px), calc(-50% + ${-jump}px), 0) rotateZ(${spin}deg) scale(${scale})`, filter: `brightness(1.4) drop-shadow(0 40px 25px rgba(0,0,0,0.45)) ${aura}`, offset: 0.65 },
      { transform: `translate3d(-50%, calc(-50% + 8px), 0) rotateZ(${-(spin * 0.5)}deg) scale(0.92)`, filter: `brightness(1.05) drop-shadow(0 2px 4px rgba(0,0,0,0.7)) ${aura}`, offset: 0.92 },
      { transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) scale(1)", filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 1 }
    ];
  } 
  else if (profile === "spin") {
    // 2. THE SPIN (360 Kickflip)
    duration = EPIC_MOVE_DURATION_MS.spin;
    const jump = 40 + Math.random() * 20;
    const spinDir = Math.random() > 0.5 ? 360 : -360;
    
    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${-jump}px), 0) rotateZ(${spinDir * 0.6}deg)`, filter: `brightness(1.2) drop-shadow(0 15px 15px rgba(0,0,0,0.3)) ${aura}`, offset: 0.5 },
      { transform: `translate3d(-50%, -50%, 0) rotateZ(${spinDir}deg)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 1 }
    ];
  } 
  else {
    // 3. THE SLIDE (Fast, Low, Aggressive Tilt)
    duration = EPIC_MOVE_DURATION_MS.slide;
    // Calculate tilt direction based on movement (deltaX is inverted: negative means moving right)
    const tilt = deltaX < 0 ? 18 : (deltaX > 0 ? -18 : 0); 
    
    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) scale(1)`, filter: `brightness(1) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${deltaY * 0.4 - 10}px), 0) rotateZ(${tilt}deg) scale(1.05)`, filter: `brightness(1.1) drop-shadow(0 8px 10px rgba(0,0,0,0.25)) ${aura}`, offset: 0.4 },
      { transform: `translate3d(-50%, calc(-50% + 4px), 0) rotateZ(${-(tilt * 0.3)}deg) scale(0.95)`, filter: `brightness(1) drop-shadow(0 2px 2px rgba(0,0,0,0.5)) ${aura}`, offset: 0.9 },
      { transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) scale(1)", filter: `brightness(1) ${aura}`, offset: 1 }
    ];
  }

  const animation = ghostPiece.animate(keyframes, {
    duration,
    easing: profile === "slide" ? "cubic-bezier(0.1, 0.9, 0.2, 1)" : "cubic-bezier(0.22, 0.61, 0.36, 1)", // Slide gets a punchier easing
  });

  activeGhostAnimation = animation;
  
  startTrailSpawning();

 let finalized = false;
 const onEnd = () => {
  if (finalized) return;
  finalized = true;
  ghostPiece.remove();
  destinationPiece.style.visibility = "";
  destinationPiece.style.opacity = "1";

  animationFinished = true;
  animatingToSquare = null;

  if (activeGhostAnimation === animation) {
    activeGhostAnimation = null;
    activeGhostNode = null;
    activeGhostDestinationPiece = null;
    
    // If a server update arrived while we were animating, 
    // run the render now that the path is clear.
    if (pendingBoardRefresh) {
      pendingBoardRefresh = false;
      renderBoard();
    }
  }
};

  animation.addEventListener("finish", onEnd);
  animation.addEventListener("cancel", onEnd);
}

function onSquarePressed(square: Square): void {
  if (state.viewCursor !== null) {
    state.viewCursor = null;
    render();
    return;
  }
  
  const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) return;

  if (!state.snapshot || !state.role || state.role === "spectator") return;

  if (state.snapshot.turn !== state.role) {
    onPremoveSquarePressed(square);
    return;
  }

  if (square === state.selectedSquare) {
    clearSelection();
    requestBoardRefresh(true);
    updateCaption();
    return;
  }

  if (state.legalTargets.includes(square)) {
    const from = state.selectedSquare;
    clearSelection();
    requestBoardRefresh(true);
    
    if (from) {
      suppressAnimationForMove = null; 
      tryMoveFromTo(from, square);
    }
    
    updateCaption();
    return;
  }

  const clickedPiece = chess.get(square);
  if (clickedPiece && isOwnPiece(clickedPiece.color)) {
    selectSquare(square); 
    return;
  }

  // FIX: Only force refresh if there was actually a selection to clear.
  // This prevents random clicks on empty squares from resetting/flickering the board.
  if (state.selectedSquare) {
    clearSelection();
    requestBoardRefresh(true);
    updateCaption();
  }
}
function selectSquare(square: Square): void {
  state.selectedSquare = square;
  state.legalTargets = legalTargetsFor(square);
  requestBoardRefresh();
  updateCaption();
}

function clearSelection(): void {
  state.selectedSquare = null;
  state.legalTargets = [];
}

function legalTargetsFor(square: Square): Square[] {
  return chess.moves({ square, verbose: true }).map((move) => move.to);
}

function legalTargetsForRole(square: Square, role: PlayerRole): Square[] {
  const fenParts = chess.fen().split(" ");
  fenParts[1] = role;
  const roleChess = new Chess(fenParts.join(" "));
  return roleChess.moves({ square, verbose: true }).map((move) => move.to);
}

function canStartMoveFrom(square: Square): boolean {
  if (state.viewCursor !== null) return false;

  if (!state.snapshot || !state.role || state.role === "spectator") return false;

  // Miramos el tablero virtual para permitir arrastrar "fantasmas"
  const vBoard = getVirtualBoard();
  const piece = vBoard.get(square);

  if (!piece || piece.color !== state.role) return false;

  // Si es tu turno real o si la pieza tiene movimientos teóricos/legales
  return true; 
}

function tryMoveFromTo(from: Square, to: Square): void {
 const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) return;

  if (!state.snapshot || !state.role || state.role === "spectator") return;

  // Handle Premoves
  if (state.snapshot.turn !== state.role) {
    queuePremove(from, to);
    return;
  }

  // Handle Promotion Branch
  const selectedPiece = chess.get(from);
  if (selectedPiece?.type === "p" && reachesPromotionRank(to, state.role)) {
    // FIX: Verify the promotion move is actually legal before showing the dialog
    const isLegal = chess.moves({ verbose: true }).some(m => m.from === from && m.to === to);
    if (!isLegal) return; 

    state.pendingPromotion = { from, to };
    promotionDialog.hidden = false;
    return;
  }

  let playerMoveResult: Move | null = null;

  if (state.gameMode === "multiplayer") {
    // Standard Multiplayer Logic
    socket.emit("game:move", { from, to });
    const temp = new Chess(chess.fen());
    playerMoveResult = temp.move({ from, to, promotion: "q" });
  } else {
    // BOT MODE: Process player move locally
    playerMoveResult = chess.move({ from, to, promotion: "q" });
    if (!playerMoveResult) return;

    updateManualSnapshot(playerMoveResult);
   
    render(true); 
    playSoundForSnapshot(state.snapshot);

    // Trigger Bot Response after a short delay
    if (!state.snapshot.checkmate && !state.snapshot.draw) {
      scheduleBotResponse(playerMoveResult);
    }
  }

  // Live Analysis logic for the move you just played
  if (state.snapshot?.analysis.enabled && playerMoveResult) {
    state.liveAnalysisSummary = "Analyzing move...";
    renderSession();
    
    const moveKey = `${state.snapshot.moveCount}:${from}:${to}:${playerMoveResult.san}`;
    void maybeRunLiveAnalysisForMove(
      state.snapshot.moves.slice(0, -1), 
      playerMoveResult, 
      state.snapshot.moveCount, 
      moveKey
    );
  }
}

/** Starts a local game against the AI */
function startBotGame() {
  clearScheduledBotResponse();
  accountSidebarController.resetFinishedGameTracking();

  const botPreset = getBotDifficultyPreset(state.botLevel);

  state.gameMode = "bot";
  state.role = "w"; // Player is White
  state.roomId = "BOT";
  
  chess.reset();
  
  // Initialize snapshot manually to bypass server socket
 state.snapshot = {
    roomId: "LOCAL",
   ownerId: null,
    fen: chess.fen(),
    turn: chess.turn(),
    status: "Active",
    winner: null,
    check: false,
    checkmate: false,
    draw: false,
    moveCount: 0,
    moves: [],
    lastMove: null,
    players: {
      whiteConnected: true,
      blackConnected: true,
      spectatorCount: 0,
      whiteName: getCurrentPlayerName(),
      blackName: `Bot (${botDifficultySummary(botPreset)})`,
      whiteUserId: null,
      blackUserId: null,
      whiteFriendId: null,
      blackFriendId: null,
    },
    rematchVotes: 0,
    analysis: { enabled: false, votes: 0, locked: false, labelsOnly: false, labelsVotes: 0 },
    undo: { pending: false, requester: null },
    isStarted: true,
    pregame: { p1Choice: "w", p2Choice: "b", p1Ready: true, p2Ready: true },
    timeControl: {
      id: "blitz3",
      label: "3-minute Blitz",
      initialMs: 180_000,
      incrementMs: 0,
    },
    clock: {
      whiteMs: 180_000,
      blackMs: 180_000,
      active: null,
      running: false,
      lowTimeThresholdMs: 20_000,
      serverNowMs: Date.now(),
    },
  };

  showToast(`Bot mode active. You are White. ${botDifficultySummary(botPreset)}.`);
  render();
}

/** Updates the snapshot locally after a move in Bot mode */
// main.ts - Actualiza updateManualSnapshot
function updateManualSnapshot(move: Move): void {
  if (!state.snapshot) return;

  // Contamos piezas antes del movimiento
  const countPieces = (f: string) => (f.split(" ")[0] || "").replace(/[^a-zA-Z]/g, "").length;
  const previousPieceCount = countPieces(state.snapshot.fen);

  const newSummary: MoveSummary = {
    color: move.color as PlayerRole,
    from: move.from,
    to: move.to,
    san: move.san,
    piece: move.piece
  };

  state.snapshot.fen = chess.fen();
  state.snapshot.turn = chess.turn() as PlayerRole;
  state.snapshot.moveCount++;
  state.snapshot.lastMove = newSummary;
  state.snapshot.moves.push(newSummary);

  clearArrows();
  
  // blood logic
  const currentPieceCount = countPieces(state.snapshot.fen);
  if (state.bloodFxEnabled && currentPieceCount < previousPieceCount) {
    spawnBloodSplatter(move.to, (move.captured as PieceSymbol) || "p");
  }

  state.snapshot.check = chess.inCheck();
  state.snapshot.checkmate = chess.isCheckmate();
  state.snapshot.draw = chess.isDraw();
  
  if (state.snapshot.checkmate) {
    state.snapshot.winner = move.color as PlayerRole;
  }
}
function isTheoreticallyPossible(from: Square, to: Square, piece: PieceSymbol, color: string): boolean {
 const fromFile = from.charCodeAt(0) - 97; 
  const fromRank = parseInt(from[1]!); 
  const toFile = to.charCodeAt(0) - 97;
  const toRank = parseInt(to[1]!);
  
  const dx = Math.abs(toFile - fromFile);
  const dy = Math.abs(toRank - fromRank);

  // a movement with no distance is not possible
  if (dx === 0 && dy === 0) return false;

  switch (piece) {
    case 'p': 
      const forward = (color === 'w') ? (toRank - fromRank) : (fromRank - toRank);
      const isStartRank = (color === 'w' && fromRank === 2) || (color === 'b' && fromRank === 7);
     
      if (dx === 0) return forward === 1 || (isStartRank && forward === 2);
      if (dx === 1) return forward === 1;
      return false;
    case 'n': // Caballo
      return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    case 'b': // Alfil
      return dx === dy;
    case 'r': // Torre
      return dx === 0 || dy === 0;
    case 'q': // Dama
      return dx === dy || dx === 0 || dy === 0;
    case 'k': // Rey
      // 1 casilla en cualquier dirección o enroque (distancia de 2)
      return (dx <= 1 && dy <= 1) || (dx === 2 && dy === 0);
    default:
      return false;
  }
}



function getVirtualBoard(): Chess {
  const vBoard = new Chess(chess.fen());
  
  for (const p of state.premoves) {
    const piece = vBoard.get(p.from);
    if (piece) {
      vBoard.remove(p.from);
      if (p.promotion) piece.type = p.promotion as PieceSymbol; // Fixed strict type
      vBoard.put(piece, p.to);
    }
  }

  const fenParts = vBoard.fen().split(" "); 
  fenParts[1] = state.role as string; 
  fenParts[3] = "-"; // clear en passant
  vBoard.load(fenParts.join(" "));

  return vBoard;
}

function queuePremove(from: Square, to: Square): void {
  if (!state.role || state.role === "spectator") return;

  // Miramos el tablero virtual para saber qué pieza estamos moviendo realmente
  const vBoard = getVirtualBoard();
  const piece = vBoard.get(from);

  if (!piece || piece.color !== state.role) return;

  if (!isTheoreticallyPossible(from, to, piece.type, piece.color)) return;

  const existingIndex = state.premoves.findIndex(p => p.from === from && p.to === to);
  if (existingIndex !== -1) {
    state.premoves.splice(existingIndex, 1);
  } else {
    if (state.premoves.length >= 10) return;
    const promotion = (piece.type === "p" && reachesPromotionRank(to, state.role)) ? "q" : undefined;
    state.premoves.push(promotion ? { from, to, promotion } : { from, to });
  }

  clearSelection();
  requestBoardRefresh();
  updateCaption();
}

// main.ts - Update the logic inside onPremoveSquarePressed
function onPremoveSquarePressed(square: Square): void {
  if (!state.role || state.role === "spectator") return;

  const vBoard = getVirtualBoard(); 
  const clickedPiece = vBoard.get(square);

  if (!state.selectedSquare) {
    // If clicking own piece, select it
    if (clickedPiece && clickedPiece.color === state.role) {
      state.selectedSquare = square;
      state.legalTargets = vBoard.moves({ square, verbose: true }).map(m => m.to);
      requestBoardRefresh(true); // Force refresh to show selection
      updateCaption();
    } else {
      // FIX: Clicking empty or opponent piece cancels all premoves ONLY if you have them.
      if (state.premoves.length > 0) {
        state.premoves = [];
        requestBoardRefresh(true);
        updateCaption();
      }
    }
    return;
  }

  if (square === state.selectedSquare) {
    clearSelection();
    requestBoardRefresh(true);
    updateCaption();
    return;
  }

  const pieceToMove = vBoard.get(state.selectedSquare);
  if (pieceToMove && isTheoreticallyPossible(state.selectedSquare, square, pieceToMove.type, pieceToMove.color)) {
    queuePremove(state.selectedSquare, square);
  } else {
    // Clicking a random area while a piece is selected now clears everything
    state.premoves = [];
    clearSelection();
    requestBoardRefresh(true);
  }

  updateCaption();
}

function isOwnPiece(color: PlayerRole): boolean {
  return state.role === color;
}

function reachesPromotionRank(square: Square, role: PlayerRole): boolean {
  return role === "w" ? square.endsWith("8") : square.endsWith("1");
}

function getOpponentSeatInfo(snapshot: RoomSnapshot): {
  connected: boolean;
  role: PlayerRole;
  name: string;
  userId: string | null;
  friendId: string | null;
} | null {
  if (state.role === "w") {
    return {
      connected: snapshot.players.blackConnected,
      role: "b",
      name: normalizeUsername(snapshot.players.blackName) || "Guest",
      userId: snapshot.players.blackUserId,
      friendId: snapshot.players.blackFriendId,
    };
  }

  if (state.role === "b") {
    return {
      connected: snapshot.players.whiteConnected,
      role: "w",
      name: normalizeUsername(snapshot.players.whiteName) || "Guest",
      userId: snapshot.players.whiteUserId,
      friendId: snapshot.players.whiteFriendId,
    };
  }

  return null;
}

function seatLabel(role: PlayerRole, playerName: string, friendId: string | null, userId: string | null): string {
  const safeName = normalizeUsername(playerName) || "Guest";
  const colorLabel = role === "w" ? "White" : "Black";

  if (state.role === role) {
    return `You (${getCurrentPlayerName()})`;
  }

  if (userId && friendId) {
    return `${safeName} (${colorLabel} - ID ${friendId})`;
  }

  return `${safeName} (${colorLabel} - Guest)`;
}

function humanRole(role: RoomRole | null): string {
  const name = getCurrentPlayerName();

  if (role === "w") {
    return `${name} (White)`;
  }

  if (role === "b") {
    return `${name} (Black)`;
  }

  if (role === "spectator") {
    return `${name} (Spectator)`;
  }

  return `${name} (Not seated)`;
}

function syncUrl(roomId: string | null): void {
  const url = new URL(window.location.href);
  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }

  window.history.replaceState({}, "", url);
}

function clearLocalRoomState(): void {  
  clearScheduledBotResponse();
  pendingInGameFriendRequest = null;
  setSendFriendRequestState(false);
  voiceChatController.syncSession({
    roomId: null,
    role: null,
    gameMode: "multiplayer",
    isGameActive: false,
  });

  if (botAnalyzer) {
    botAnalyzer.terminate();
    botAnalyzer = null;
  }

  if (activeGhostAnimation) {
    const animation = activeGhostAnimation;
    activeGhostAnimation = null;
    animation.cancel();
  }

  if (activeGhostNode) {
    activeGhostNode.remove();
    activeGhostNode = null;
  }

  if (activeGhostDestinationPiece) {
    activeGhostDestinationPiece.style.visibility = "";
    activeGhostDestinationPiece.style.opacity = "1";
    activeGhostDestinationPiece = null;
  }

  if (trailRafId !== null) {
    cancelAnimationFrame(trailRafId);
    trailRafId = null;
  }

  state.roomId = null;
  state.role = null;
  state.shareUrl = "";
  state.snapshot = null;
  state.pendingPromotion = null;
  state.premoves = [];
  state.selectedSquare = null;
  state.legalTargets = [];
  state.viewCursor = null;
  state.focusMode = false;

  state.gameMode = "multiplayer"; 

  state.liveAnalysisSummary = "Live analysis disabled.";
  state.lastAnalyzedMoveKey = null;
  state.liveMoveGrades = {};
  currentModalAction = null;
  suppressAnimationForMove = null;
  lastAnimatedMoveKey = null;
  pendingBoardRefresh = false;
  animationFinished = true;
  animatingToSquare = null;
  _lastPlayedMoveCount = -1;
  roomInput.value = "";

  for (const audio of Object.values(_audioCache)) {
    audio.pause();
    audio.currentTime = 0;
  }

  liveAnalysisToken += 1;
  lastRoomStateReceivedAtMs = Date.now();
  
  localStorage.removeItem("chess_roomId");
  
  // NEW: Ensure any active drag is killed when leaving or resetting
  cancelCurrentDrag();
  
  clearArrows();
  chess.reset();
  syncUrl(null);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("input, textarea, [contenteditable='true']"));
}

function shouldAutoScrollInviteJoin(): boolean {
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const isSmallViewport = window.matchMedia("(max-width: 1100px)").matches;
  return isCoarsePointer || isSmallViewport;
}

function isElementMostlyVisible(element: HTMLElement, minVisibleRatio = 0.68): boolean {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

  const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = Math.max(1, rect.width * rect.height);
  return visibleArea / totalArea >= minVisibleRatio;
}

function scrollToInviteJoinCardOnMobile(): void {
  const needsForcedReveal = !isElementMostlyVisible(inviteJoinCard);
  if (!shouldAutoScrollInviteJoin() && !needsForcedReveal) {
    return;
  }

  window.requestAnimationFrame(() => {
    inviteJoinCard.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  });
}

function formatClockMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getDisplayClockMs(snapshot: RoomSnapshot, color: PlayerRole): number {
  const baseMs = color === "w" ? snapshot.clock.whiteMs : snapshot.clock.blackMs;
  if (!snapshot.clock.running || snapshot.clock.active !== color) {
    return baseMs;
  }

  const elapsed = Math.max(0, Date.now() - lastRoomStateReceivedAtMs);
  return Math.max(0, baseMs - elapsed);
}

function getFocusTimerText(): string {
  const snapshot = state.snapshot;
  if (!snapshot) {
    return "W 00:00 | B 00:00";
  }

  const whiteText = formatClockMs(getDisplayClockMs(snapshot, "w"));
  const blackText = formatClockMs(getDisplayClockMs(snapshot, "b"));

  if (state.role === "w") {
    return `${whiteText} | Opp ${blackText}`;
  }

  if (state.role === "b") {
    return `${blackText} | Opp ${whiteText}`;
  }

  return `W ${whiteText} | B ${blackText}`;
}

let lastFocusMaterialKey: string | null = null;
let focusMaterialWasVisible = false;

function setFocusMaterialVisibility(visible: boolean): void {
  if (!visible) {
    focusMaterialHud.classList.remove("focus-material-appear");
    focusMaterialHud.hidden = true;
    focusMaterialWasVisible = false;
    return;
  }

  focusMaterialHud.hidden = false;
  if (!focusMaterialWasVisible) {
    focusMaterialHud.classList.remove("focus-material-appear");
    void focusMaterialHud.offsetWidth;
    focusMaterialHud.classList.add("focus-material-appear");
  }
  focusMaterialWasVisible = true;
}

function updateFocusHud(): void {
  if (!state.focusMode) {
    focusHud.hidden = true;
    focusMaterialHud.innerHTML = "";
    lastFocusMaterialKey = null;
    setFocusMaterialVisibility(false);
    return;
  }

  // Reveal container first to avoid stale first-frame text after toggling focus mode.
  focusHud.hidden = false;
  focusTimer.textContent = getFocusTimerText();

  const snapshot = state.snapshot;
  if (snapshot && state.role && state.role !== "spectator") {
    const myColor = state.role as PlayerRole;
    const opColor = myColor === "w" ? "b" : "w";
    
    // FIX: Apply the same robust replay logic to the Focus HUD
    const movesToReplay = state.viewCursor !== null 
      ? snapshot.moves.slice(0, state.viewCursor) 
      : snapshot.moves;

    const replayBoard = new Chess();
    const myCaptures: PieceSymbol[] = [];
    const opCaptures: PieceSymbol[] = [];

    for (const moveSummary of movesToReplay) {
      const moveResult = replayBoard.move(moveSummary.san);
      if (moveResult && moveResult.captured) {
        if (moveResult.color === myColor) {
          myCaptures.push(moveResult.captured);
        } else {
          opCaptures.push(moveResult.captured);
        }
      }
    }

    const sortOrder: Record<PieceSymbol, number> = { q: 1, r: 2, b: 3, n: 4, p: 5, k: 6 };
    myCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
    opCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);

    let myCapturesHtml = "";
    myCaptures.forEach(piece => {
      myCapturesHtml += `<img src="${PIECES[`${opColor}${piece}` as keyof typeof PIECES]}" class="captured-icon" />`;
    });

    let opCapturesHtml = "";
    opCaptures.forEach(piece => {
      opCapturesHtml += `<img src="${PIECES[`${myColor}${piece}` as keyof typeof PIECES]}" class="captured-icon" />`;
    });

    const currentFen = replayBoard.fen();
    const rawValue = materialFromPerspective(currentFen, myColor);
    const netValue = Math.floor(rawValue / 100);
    const hasMovesPlayed = movesToReplay.length > 0;
    const hasMaterialData = Boolean(myCapturesHtml || opCapturesHtml || netValue !== 0);
    const shouldShowMaterialHud = hasMovesPlayed && hasMaterialData;

    if (shouldShowMaterialHud) {
      const markup = `
        ${myCapturesHtml || netValue > 0 ? `
        <div class="focus-capture-row">
           <div class="focus-icons">${myCapturesHtml}</div>
           ${netValue > 0 ? `<span class="focus-score plus">+${netValue}</span>` : ""}
        </div>` : ""}
        
        ${opCapturesHtml || netValue < 0 ? `
        <div class="focus-capture-row">
           <div class="focus-icons" style="opacity: 0.85;">${opCapturesHtml}</div>
           ${netValue < 0 ? `<span class="focus-score minus">${netValue}</span>` : ""}
        </div>` : ""}
      `;
      const materialKey = `${movesToReplay.length}:${myCaptures.join("")}:${opCaptures.join("")}:${netValue}`;
      if (materialKey !== lastFocusMaterialKey) {
        focusMaterialHud.innerHTML = markup;
        lastFocusMaterialKey = materialKey;
      }
      setFocusMaterialVisibility(true);
    } else {
      focusMaterialHud.innerHTML = "";
      lastFocusMaterialKey = null;
      setFocusMaterialVisibility(false);
    }
  } else {
    focusMaterialHud.innerHTML = "";
    lastFocusMaterialKey = null;
    setFocusMaterialVisibility(false);
  }
}
function applyFocusMode(): void {
  document.body.classList.toggle("focus-mode", state.focusMode);
  document.body.classList.toggle("focus-multiplayer", state.focusMode);
  focusModeButton.setAttribute("aria-pressed", String(state.focusMode));
  focusModeButton.textContent = state.focusMode ? "Exit" : "Focus";
  updateFocusHud();
}

async function toggleFocusMode(force?: boolean): Promise<void> {
  const nextMode = force ?? !state.focusMode;
  if (nextMode === state.focusMode) {
    return;
  }

  state.focusMode = nextMode;
  applyFocusMode();
}

let toastTimer = 0;

function showToast(message: string): void {
  state.toastMessage = message;
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}

render();
window.setInterval(updateFocusHud, 1000);
window.setInterval(() => {
  if (state.gameMode !== "multiplayer" || !state.snapshot || !state.snapshot.clock.running) {
    return;
  }

  renderSession();
}, 250);

window.addEventListener("beforeunload", () => {
  liveAnalyzer?.terminate();
  botAnalyzer?.terminate();
});
