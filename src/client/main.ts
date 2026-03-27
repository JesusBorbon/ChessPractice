import { Chess, Move, PieceSymbol, Square } from "chess.js";
import { io } from "socket.io-client";

import { BoardOrientation, SquareName, buildSquareList, isLightSquare } from "../../engine";
import "./styles.css";
import { mountThemeSwitcher } from "./theme";
import { request } from "node:http";

type PlayerRole = "w" | "b";
type RoomRole = PlayerRole | "spectator";
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

type RoomSnapshot = {
  roomId: string;
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
  };
  rematchVotes: number;
  analysis: {
    enabled: boolean;
    votes: number;
  };
  isStarted: boolean;
  pregame: {
    p1Choice: "w" | "b" | null;
    p2Choice: "w" | "b" | null;
    p1Ready: boolean;
    p2Ready: boolean;
  };
};


type PendingPromotion = {
  from: Square;
  to: Square;
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
  viewCursor: number | null;
  trailFxEnabled: boolean; 
  legalMovesEnabled: boolean;
};

type EngineEval = {
  cp: number;
  mate: number | null;
  bestMove: string;
  pv: string;
};

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
  viewCursor: null,
  trailFxEnabled: localStorage.getItem("chess-trail-fx") === "on",
  legalMovesEnabled: localStorage.getItem("chess-legal-moves") !== "off",
};

(window as any).state = state;

let lastAnimatedMoveKey: string | null = null;
let suppressAnimationForMove: { from: Square; to: Square } | null = null;
let activeGhostAnimation: Animation | null = null;
let activeGhostNode: HTMLElement | null = null;
let activeGhostDestinationPiece: HTMLElement | null = null;
let pendingBoardRefresh = false;
let focusTimerStartMs: number | null = null;
let liveAnalyzer: StockfishBridge | null = null;
let liveAnalysisToken = 0;
let currentModalAction: "leave" | "resign" | "bot" | null = null;
let animationFinished = true; 
let animatingToSquare: Square | null = null;


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
const ROOM_CODE_LENGTH = 4;
const ROOM_ID_PATTERN = new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`);

class StockfishBridge {
  private readonly worker: Worker;
  private ready = false;
  private initResolve!: () => void;
  private initReject!: (error: Error) => void;
  private readonly initPromise: Promise<void>;
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
    
    // Set engine strength to approximately 800 ELO
    this.send("setoption name UCI_LimitStrength value true");
    this.send("setoption name UCI_Elo value 800"); 

    this.send("isready");
  }

  /** Gets the best move from the engine for the Bot player */
  async getBotMove(fen: string, timeLimitMs = 1000): Promise<string> {
    await this.initPromise;
    const botPromise = this.queue.then(() => {
      return new Promise<string>((resolve, reject) => {
        this.activeEval = {
          resolve: (res) => resolve(res.bestMove),
          reject,
          lastCp: 0, mate: null, pv: "", bestMove: "",
        };
        this.send(`position fen ${fen}`);
        this.send(`go movetime ${timeLimitMs}`);
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
    if (line === "readyok" && !this.ready) {
      this.ready = true;
      this.initResolve();
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

  private send(cmd: string): void { this.worker.postMessage(cmd); }
  terminate(): void { this.worker.terminate(); }
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

// main.ts
// main.ts
function playSoundForSnapshot(snapshot: RoomSnapshot): void {
  const last = snapshot.lastMove;
  if (!last) return;

  // Seguimos usando sonidos especiales para eventos críticos
  if (snapshot.checkmate || snapshot.draw) {
    playSound("gameEndOrCheckmate");
  } else if (snapshot.check) {
    playSound("checkMove");
  } else if (last.san.startsWith("O-O")) {
    playSound("castle");
  } else if (last.san.includes("x")) {
    playSound("capture");
  } else {
    // FIX: Como no tienes move-opponent, usamos move-self para TODOS los movimientos
    playSound("move-self");
  }
}
app.innerHTML = `
  <div class="app-shell">
    <nav class="game-nav" id="gameNav" hidden>
      <button class="nav-back-link" id="backToMenuButton" type="button">← Back to menu</button>
    </nav>

    <header class="hero">
      <section class="hero-card hero-copy">
        <h1>Multiplayer Chess</h1>
        <p>Create a room or join one with code.</p>
        <a class="analysis-board-link cta-rainbow" href="/analyze">♟ Open Analysis Board</a>
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
          <button class="action cta-rainbow" id="playBotButton" type="button">Play vs Bot (800 ELO)</button>
          <button class="ghost" id="rematchButton" type="button" hidden>Request rematch</button>
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

        <div class="focus-hud" id="focusHud" hidden>
            <span class="focus-chip" id="focusTimer">00:00</span>

          <div id="focusMaterialHud" class="focus-material-hud" hidden>
            <span class="focus-chip" id="focusMaterialScore"></span>
            <span class="focus-chip" id="focusMaterialIcons"></span>
          </div>
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
            </article>
            <article class="seat">
              <strong>Black</strong>
              <span class="muted" id="blackSeat">Waiting for player</span>
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
  <div class="toast" id="toast"></div>
`;



const board = must<HTMLDivElement>("#board");
const pregamePlaceholder = must<HTMLDivElement>("#pregamePlaceholder");
const inviteJoinCard = must<HTMLElement>("#inviteJoinCard");
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
const summaryText = must<HTMLParagraphElement>("#summaryText");
const liveAnalysisText = must<HTMLParagraphElement>("#liveAnalysisText");
const moveList = must<HTMLDivElement>("#moveList");
const toast = must<HTMLDivElement>("#toast");
const promotionDialog = must<HTMLDivElement>("#promotionDialog");
const createRoomButton = must<HTMLButtonElement>("#createRoomButton");
const backToMenuButton = must<HTMLButtonElement>("#backToMenuButton");
const focusHud = must<HTMLDivElement>("#focusHud");
const focusTimer = must<HTMLSpanElement>("#focusTimer");
const focusModeButton = must<HTMLButtonElement>("#focusModeBtn");
const focusMaterialHud = must<HTMLDivElement>("#focusMaterialHud");
const focusMaterialScore = must<HTMLSpanElement>("#focusMaterialScore");
const focusMaterialIcons = must<HTMLSpanElement>("#focusMaterialIcons");
const playBotButton = must<HTMLButtonElement>("#playBotButton");
const confirmDialog = must<HTMLElement>("#confirmDialog");
const confirmYesBtn = must<HTMLButtonElement>("#confirmYesBtn");
const confirmNoBtn = must<HTMLButtonElement>("#confirmNoBtn");
const modalTitle = must<HTMLElement>("#modalTitle");
const modalDescription = must<HTMLElement>("#modalDescription");
const gameNav = must<HTMLElement>("#gameNav");

const pregameWaiting = must<HTMLDivElement>("#pregameWaiting");
const pregameSelection = must<HTMLDivElement>("#pregameSelection");
const myPickWhite = must<HTMLButtonElement>("#myPickWhite");
const myPickBlack = must<HTMLButtonElement>("#myPickBlack");
const opPickWhite = must<HTMLButtonElement>("#opPickWhite");
const opPickBlack = must<HTMLButtonElement>("#opPickBlack");
const myReadyBadge = must<HTMLDivElement>("#myReadyBadge");
const opReadyBadge = must<HTMLDivElement>("#opReadyBadge");
const pregameReadyBtn = must<HTMLButtonElement>("#pregameReadyBtn");
const pregameConflictWarning = must<HTMLDivElement>("#pregameConflictWarning");

myPickWhite.addEventListener("click", () => socket.emit("pregame:select", { color: "w" }));
myPickBlack.addEventListener("click", () => socket.emit("pregame:select", { color: "b" }));
pregameReadyBtn.addEventListener("click", () => socket.emit("pregame:ready"));

mountThemeSwitcher();

window.addEventListener("animationchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ style: "smooth" | "epic" }>;
  state.animationStyle = customEvent.detail.style;
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
const copyLinkButton = must<HTMLButtonElement>("#copyLinkButton");
const leaveRoomButton = must<HTMLButtonElement>("#leaveRoomButton");
const flipBoardButton = must<HTMLButtonElement>("#flipBoardButton");
const rematchButton = must<HTMLButtonElement>("#rematchButton");
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


playBotButton.addEventListener("click", () => {
  if (state.roomId && state.gameMode === "multiplayer") {
    toggleConfirmModal(true, "bot");
  } else {
    startBotGame();
  }
});

createRoomButton.addEventListener("click", () => {
  state.gameMode = "multiplayer"; // forcing the mode to multiplayer to avoid "ghost bot" bugs when switching from bot games
  socket.emit("room:create");
  scrollToInviteJoinCardOnMobile();
});

joinRoomButton.addEventListener("click", () => {
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
  if (!state.snapshot || state.snapshot.moves.length === 0) return;
  state.viewCursor = 0;
  render();
});

liveNavPrev.addEventListener("click", () => {
  if (!state.snapshot || state.snapshot.moves.length === 0) return;
  const currentPos = state.viewCursor !== null ? state.viewCursor : state.snapshot.moves.length;
  if (currentPos > 0) {
    state.viewCursor = currentPos - 1;
    render();
  }
});

liveNavNext.addEventListener("click", () => {
  if (!state.snapshot || state.snapshot.moves.length === 0) return;
  const maxMoves = state.snapshot.moves.length;
  const currentPos = state.viewCursor !== null ? state.viewCursor : maxMoves;
  if (currentPos < maxMoves) {
    state.viewCursor = currentPos + 1;
    if (state.viewCursor === maxMoves) state.viewCursor = null;
    render();
  }
});

liveNavLast.addEventListener("click", () => {
  if (!state.snapshot || state.snapshot.moves.length === 0) return;
  state.viewCursor = null;
  render();
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

// Ensure we also clear the lock when the user actually leaves
// main.ts

confirmYesBtn.addEventListener("click", () => {
  const action = currentModalAction;
  document.body.classList.remove("modal-open");
  toggleConfirmModal(false);

  if (action === "bot") {
    // Leave the multiplayer room correctly
    socket.emit("room:leave");
    
    // We don't call clearLocalRoomState here because startBotGame 
    // will set up its own local state snapshots.
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

// Modal button listeners
confirmNoBtn.addEventListener("click", () => toggleConfirmModal(false));

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
    // ... existing resign logic ...
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
      state.viewCursor = currentPos - 1;
      render();
    }
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (currentPos < maxMoves) {
      state.viewCursor = currentPos + 1;
      // If we reach the end of the history, snap back into live mode
      if (state.viewCursor === maxMoves) {
        state.viewCursor = null;
      }
      render();
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
      // Clean drop-shadow for picking up pieces
      Object.assign(ptrDragNode.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "9999",
        width: `${btn.offsetWidth}px`, 
        height: `${btn.offsetHeight}px`,
        transform: "translate(-50%, -50%) scale(1.18)", 
        filter: "drop-shadow(0 12px 20px rgba(0, 0, 0, 0.4))", 
        transition: "transform 0.05s ease-out", 
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

async function triggerBotResponse() {
  if (!liveAnalyzer) liveAnalyzer = new StockfishBridge();
  
  const botMoveUci = await liveAnalyzer.getBotMove(chess.fen());
  const bFrom = botMoveUci.substring(0, 2) as Square;
  const bTo = botMoveUci.substring(2, 4) as Square;
  const bPromo = botMoveUci.length === 5 ? botMoveUci[4] as any : "q";

  const bMove = chess.move({ from: bFrom, to: bTo, promotion: bPromo });
  
  if (bMove && state.snapshot) {
    updateManualSnapshot(bMove);
    playSoundForSnapshot(state.snapshot);

    if (state.premoves.length > 0) {
      checkAndExecutePremove(); 
    }

    requestBoardRefresh(true); 

    if (state.snapshot.analysis.enabled) {
      void maybeRunLiveAnalysis(state.snapshot);
    }
  }
}
promotionDialog.addEventListener("click", (event) => {
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
        triggerBotResponse(); 
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

// --- SOCKET.IO LISTENERS ---

function onSocketConnect() {
  state.connected = true;
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

socket.on("session:joined", (payload: { roomId: string; role: RoomRole; shareUrl: string }) => {
  state.roomId = payload.roomId;
  state.role = payload.role;
  state.shareUrl = payload.shareUrl || `${window.location.origin}/?room=${payload.roomId}`;
  roomInput.value = payload.roomId;

  localStorage.setItem("chess_roomId", payload.roomId);

  if (payload.role === "w" || payload.role === "b") {
    state.orientation = payload.role;
  }

  syncUrl(payload.roomId);
  render();
});

socket.on("session:left", () => {
  if (state.gameMode === "bot") return;

  clearLocalRoomState();
  render();
});

socket.on("room:state", (snapshot: RoomSnapshot) => {
  const previousMoveCount = state.snapshot?.moveCount ?? 0;
  const previousFen = chess.fen();
  
  const isNewMove = snapshot.moveCount > previousMoveCount;
  if (isNewMove && activeGhostAnimation) {
    requestBoardRefresh(true); 
  }

  state.snapshot = snapshot;
  
  if (!focusTimerStartMs || snapshot.moveCount < previousMoveCount) {
    focusTimerStartMs = Date.now();
  }
  
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
    clearArrows();
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
    state.lastAnalyzedMoveKey = null;
    state.liveMoveGrades = {};
    liveAnalysisToken += 1;
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

  // 2. THE FIX: Always force a refresh (true) when receiving room state.
  // This kills any "ghost" hidden states from fast play or rejected moves.
  requestBoardRefresh(true); 

  renderSession();
  renderMoves();
  updateCaption();
  updateFocusHud();

  void maybeRunLiveAnalysis(snapshot);
});

socket.on("room:error", (payload: { message: string }) => {
  suppressAnimationForMove = null;
  if (state.autoJoinCode) {
    state.autoJoinCode = null;
    syncUrl(null);
    return;
  }
  showToast(payload.message);
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
  
  // 1. Core State Calculations (Calculated FIRST so we can use them to toggle UI)
  const isMultiplayerReady = Boolean(snapshot?.players.whiteConnected && snapshot?.players.blackConnected);
  const isGameActive = Boolean(
    (state.gameMode === "multiplayer" && isMultiplayerReady && snapshot?.isStarted) || 
    (state.gameMode === "bot" && snapshot !== null)
  );
  
  const canVote = state.role === "w" || state.role === "b";
  const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));
  const maxMoves = snapshot?.moves.length ?? 0;

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

  leaveRoomButton.hidden = !hasRoom;
  copyLinkButton.hidden = !state.shareUrl || isGameActive;
  flipBoardButton.hidden = !isGameActive;
  focusModeButton.hidden = !isGameActive;
  gameNav.hidden = !isGameActive;
  
  seatCard.hidden = !hasRoom;
  summaryCard.hidden = !isGameActive;
  movesCard.hidden = !isGameActive;

  liveAnalysisButton.hidden = !isGameActive || !canVote;
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
    summaryText.textContent = "Ready to play.";
    liveAnalysisText.textContent = "Live analysis disabled.";
    updateFocusHud();
    return;
  }
  
  // 4. Pregame Selection Menu Logic
  pregamePlaceholder.hidden = isGameActive;

  if (state.gameMode === "multiplayer" && !snapshot.isStarted) {
    if (isMultiplayerReady) {
       pregameWaiting.hidden = true;
       pregameSelection.hidden = false;

       const isP1 = state.role === "w";
       const myChoice = isP1 ? snapshot.pregame.p1Choice : snapshot.pregame.p2Choice;
       const opChoice = isP1 ? snapshot.pregame.p2Choice : snapshot.pregame.p1Choice;
       const myReady = isP1 ? snapshot.pregame.p1Ready : snapshot.pregame.p2Ready;
       const opReady = isP1 ? snapshot.pregame.p2Ready : snapshot.pregame.p1Ready;

       myPickWhite.classList.toggle("selected", myChoice === "w");
       myPickBlack.classList.toggle("selected", myChoice === "b");
       opPickWhite.classList.toggle("selected", opChoice === "w");
       opPickBlack.classList.toggle("selected", opChoice === "b");

       myReadyBadge.classList.toggle("is-ready", myReady);
       opReadyBadge.classList.toggle("is-ready", opReady);

       const hasConflict = myChoice !== null && myChoice === opChoice;
       pregameConflictWarning.hidden = !hasConflict;

       pregameReadyBtn.disabled = myChoice === null || hasConflict || myReady;
       pregameReadyBtn.textContent = myReady ? "Waiting for Opponent..." : "Ready to Play";
       
       if (state.role === "spectator") pregameReadyBtn.hidden = true;
    } else {
       pregameWaiting.hidden = false;
       pregameSelection.hidden = true;
    }
  }

  // 5. Live Game Data
  matchStatus.textContent = snapshot.status;
  whiteSeat.textContent = snapshot.players.whiteConnected ? seatLabel("w") : "Waiting for player";
  blackSeat.textContent = snapshot.players.blackConnected ? seatLabel("b") : "Waiting for player";
  turnMeta.textContent = snapshot.turn === "w" ? "White" : "Black";
  movesMeta.textContent = String(snapshot.moveCount);
  spectatorMeta.textContent = String(snapshot.players.spectatorCount);

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

  summaryText.textContent = `${roleDescription} ${snapshot.status}${lastMoveDescription}${rematchDescription}`.trim();

  // 7. Analysis Button State
  if (state.gameMode === "bot") {
    liveAnalysisButton.disabled = false;
    liveAnalysisButton.textContent = snapshot.analysis.enabled ? "Disable analysis" : "Enable analysis";
  } else {
    const seatedPlayers = Number(snapshot.players.whiteConnected) + Number(snapshot.players.blackConnected);
    liveAnalysisButton.disabled = seatedPlayers < 2 || !canVote;
    liveAnalysisButton.textContent = snapshot.analysis.enabled ? "Disable analysis" : `Enable analysis (${snapshot.analysis.votes}/2)`;
  }

  rematchButton.disabled = !gameEnded;

  // 8. Live Analysis Text
  if (snapshot.analysis.enabled) {
    liveAnalysisText.textContent = state.liveAnalysisSummary;
  } else if (state.gameMode === "multiplayer" && snapshot.analysis.votes > 0) {
    liveAnalysisText.textContent = `Waiting for both players: ${snapshot.analysis.votes}/2 ready.`;
  } else {
    liveAnalysisText.textContent = "Live analysis disabled.";
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

  const liveGrade = state.snapshot?.analysis.enabled && state.snapshot.lastMove
    ? state.liveMoveGrades[state.snapshot.moveCount]
    : undefined;
    
  const liveMarkerSquare = (!isHistoryView && liveGrade && state.snapshot?.lastMove) 
    ? state.snapshot.lastMove.to 
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

      // FIX: Only hide the piece if there is an ACTUAL active ghost node existing.
      // If the animation was force-cancelled, activeGhostNode is null, so we show the piece.
      const shouldHide = (isTargetOfActiveAnimation && activeGhostNode) || isBeingDragged;

      if (shouldHide && !isMyPremove && !isHistoryView) {
        pieceElement.style.opacity = "0";
        pieceElement.style.visibility = "hidden";
        pieceElement.style.pointerEvents = "none";
      } else {
        // Explicitly force visibility back to normal
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
        marker.textContent = symbolForLiveCategory(liveGrade.category);
        button.append(marker);
      }
    }

    fragment.append(button);
  }

  board.replaceChildren(fragment);

  // --- 3. ANIMATION SCHEDULING ---
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
    const title = document.createElement("h2");
    title.className = "game-over-title";
    
    if (snapshot.checkmate) title.textContent = snapshot.winner === "w" ? "White Wins!" : "Black Wins!";
    else if (snapshot.draw) title.textContent = "Draw";
    else if (snapshot.winner) title.textContent = snapshot.winner === "w" ? "White Wins (Resignation)" : "Black Wins (Resignation)";

    const reason = document.createElement("p");
    reason.className = "game-over-reason";
    reason.textContent = snapshot.status;

    const overlayRematchBtn = document.createElement("button");
    overlayRematchBtn.className = "action cta-turquoise";
    overlayRematchBtn.style.marginTop = "20px";
    overlayRematchBtn.textContent = state.gameMode === "bot" ? "Play Again" : "Request Rematch";
    
    overlayRematchBtn.onclick = () => {
      if (state.gameMode === "bot") startBotGame();
      else socket.emit("game:rematch");
    };

    const overlayAnalyzeBtn = document.createElement("a");
    overlayAnalyzeBtn.className = "action cta-rainbow";
    overlayAnalyzeBtn.style.marginTop = "10px";
    overlayAnalyzeBtn.style.textDecoration = "none";
    overlayAnalyzeBtn.onclick = () => {
      localStorage.setItem("postGameMoves", JSON.stringify(snapshot.moves.map(m => m.san)));
      window.location.href = "/analyze";
    };
    overlayAnalyzeBtn.textContent = "Analyze Game";

    overlay.append(title, reason, overlayRematchBtn, overlayAnalyzeBtn);
    board.append(overlay);
  }
}

function buildArrowPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  shaftWidth = 10,
  headLength = 46,
  headWidth = 38,
): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return "";
  }

  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;

  const safeHeadLength = Math.min(headLength, Math.max(18, length * 0.45));
  const shaftHalf = shaftWidth / 2;
  const headHalf = headWidth / 2;

  const baseX = end.x - ux * safeHeadLength;
  const baseY = end.y - uy * safeHeadLength;

  const tailLeftX = start.x + px * shaftHalf;
  const tailLeftY = start.y + py * shaftHalf;
  const tailRightX = start.x - px * shaftHalf;
  const tailRightY = start.y - py * shaftHalf;

  const baseLeftX = baseX + px * shaftHalf;
  const baseLeftY = baseY + py * shaftHalf;
  const baseRightX = baseX - px * shaftHalf;
  const baseRightY = baseY - py * shaftHalf;

  const wingLeftX = baseX + px * headHalf;
  const wingLeftY = baseY + py * headHalf;
  const wingRightX = baseX - px * headHalf;
  const wingRightY = baseY - py * headHalf;

  return [
    `M ${tailLeftX.toFixed(2)} ${tailLeftY.toFixed(2)}`,
    `L ${baseLeftX.toFixed(2)} ${baseLeftY.toFixed(2)}`,
    `L ${wingLeftX.toFixed(2)} ${wingLeftY.toFixed(2)}`,
    `L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    `L ${wingRightX.toFixed(2)} ${wingRightY.toFixed(2)}`,
    `L ${baseRightX.toFixed(2)} ${baseRightY.toFixed(2)}`,
    `L ${tailRightX.toFixed(2)} ${tailRightY.toFixed(2)}`,
    `A ${shaftHalf.toFixed(2)} ${shaftHalf.toFixed(2)} 0 0 0 ${tailLeftX.toFixed(2)} ${tailLeftY.toFixed(2)}`,
    "Z",
  ].join(" ");
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

  // OPTIMIZATION 1: Drastically reduce maximum drops (from ~60 down to ~4-10)
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
  
  // OPTIMIZATION 2: Use setTimeout instead of animationend to prevent layout thrashing
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

function clearArrows(): void {
  if (arrowAnnotations.size === 0 && squareAnnotations.size === 0) {
    return;
  }

  arrowAnnotations.clear();
  squareAnnotations.clear();
  renderArrows();
  requestBoardRefresh(true);
}

function renderArrows(): void {
  const arrows = [...arrowAnnotations]
    .map((entry) => {
      const [from, to] = entry.split("-") as [Square, Square];
      const start = squareCenter(from);
      const end = squareCenter(to);
      const pathData = buildArrowPath(start, end, 10, 46, 38);
      if (!pathData) {
        return "";
      }
      return `<path class="board-arrow" d="${pathData}" fill="rgba(219, 52, 52, 0.88)"/>`;
    })
    .join("");

  const previewArrow = arrowDragFrom && arrowDragPointer
    ? (() => {
        const start = squareCenter(arrowDragFrom);
        const end = arrowDragPointer;
        const pathData = buildArrowPath(start, end, 10, 46, 38);
        if (!pathData) {
          return "";
        }
        return `<path class="board-arrow board-arrow-preview" d="${pathData}" fill="rgba(219, 52, 52, 0.88)"/>`;
      })()
    : "";

  arrowLayer.innerHTML = `${arrows}${previewArrow}`;
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
  
  // If they click the very last move in the game, snap back to live viewing mode
  if (index === state.snapshot.moves.length) {
    state.viewCursor = null;
  } else {
    // Otherwise, set the cursor to the clicked move
    state.viewCursor = index;
  }
  
  render();
});

function updateCaption(): void {
  const snapshot = state.snapshot;
  
  if (!snapshot || !state.role || state.role === "spectator") {
    boardCaption.textContent = snapshot ? `Spectating room ${snapshot.roomId}` : "";
    return;
  }

  // Aseguramos que fen existe
  const fen = snapshot.fen || ""; 
  const myColor = state.role as PlayerRole;
  
  const rawValue = materialFromPerspective(fen, myColor);
  const netValue = Math.floor(rawValue / 100);

  // CORRECCIÓN 1: Añadimos || "" para evitar el undefined
  const boardFen = fen.split(" ")[0] || ""; 
  
  const counts: Record<string, number> = {};
  for (const char of boardFen) {
    if (/[prnbqkPRNBQK]/.test(char)) {
      counts[char] = (counts[char] || 0) + 1;
    }
  }

  let advantageIcons = "";
  // CORRECCIÓN 2: Tipamos explícitamente las piezas permitidas
  const types: (keyof typeof PIECE_SYMBOLS_MAP)[] = ["q", "r", "b", "n", "p"];
  
  types.forEach(type => {
    const whiteKey = type.toUpperCase();
    const blackKey = type.toLowerCase();
    
    const myCount = myColor === "w" ? (counts[whiteKey] || 0) : (counts[blackKey] || 0);
    const opCount = myColor === "w" ? (counts[blackKey] || 0) : (counts[whiteKey] || 0);
    
    const diff = myCount - opCount;
    if (diff > 0) {
      // Ahora TS sabe que PIECE_SYMBOLS_MAP[type] siempre existirá
      advantageIcons += PIECE_SYMBOLS_MAP[type].repeat(diff) + " ";
    }
  });

  if (netValue > 0) {
    boardCaption.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
        <span style="font-size: 1.3rem; letter-spacing: 2px;">${advantageIcons.trim()}</span>
        <strong style="color: var(--accent); font-size: 1.1rem;">+${netValue}</strong>
      </div>
    `;
  } else if (netValue < 0) {
    boardCaption.innerHTML = `<span style="opacity: 0.6;">Material: <b>${netValue}</b></span>`;
  } else {
    boardCaption.textContent = "Material: Even";
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
}): QualityResult {
  const {
    cpl,
    matchesBestMove,
    materialDelta,
    evalGain,
    isCapture,
    previousOpponentCategory,
  } = input;

  const opponentBlundered = previousOpponentCategory === "mistake" || previousOpponentCategory === "blunder";
  const isSacrifice = materialDelta <= -100;
  const brilliantSacrifice = isSacrifice && evalGain >= 80 && cpl <= 35;
  const greatPunish = matchesBestMove
    && cpl <= 22
    && opponentBlundered
    && (isCapture || materialDelta >= 100 || evalGain >= 110);

  if (brilliantSacrifice) {
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

function symbolForLiveCategory(category: "brilliant" | "great" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder"): string {
  if (category === "brilliant") return "!!";
  if (category === "great") return "!";
  if (category === "excellent") return "★";
  if (category === "good") return "✓";
  if (category === "inaccuracy") return "?!";
  if (category === "mistake") return "x";
  return "??";
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
  if (!snapshot.analysis.enabled || !snapshot.lastMove || snapshot.moves.length === 0) {
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
  state.liveAnalysisSummary = "Analyzing last move...";
  renderSession();

  try {
    if (!liveAnalyzer) {
      liveAnalyzer = new StockfishBridge();
    }

    const [before, after] = await Promise.all([
      liveAnalyzer.evaluateFen(fenPair.beforeFen, 10),
      liveAnalyzer.evaluateFen(fenPair.afterFen, 10),
    ]);

    if (token !== liveAnalysisToken || !state.snapshot?.analysis.enabled) {
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
    const quality = classifyLiveMoveQuality({
      cpl,
      matchesBestMove,
      materialDelta,
      evalGain,
      isCapture: snapshot.lastMove.san.includes("x"),
      previousOpponentCategory,
    });

    const label = quality.label;
    const category = quality.category;
    state.liveAnalysisSummary = summarizeLiveMove(label, cpl, snapshot.lastMove.san);
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
    const quality = classifyLiveMoveQuality({
      cpl,
      matchesBestMove,
      materialDelta,
      evalGain,
      isCapture: Boolean(moveResult.captured),
      previousOpponentCategory,
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
  
  if (!fromSquareButton || !toSquareButton || !destinationPiece) return;

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
    { duration: 700, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }
  );

  activeGhostAnimation = animation;

  const onEnd = () => {
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
  if (!fromSquareButton || !toSquareButton || !destinationPiece) return;

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
  let duration = 600; // Base duration

  if (profile === "smash") {
    // 1. THE SMASH (Massive Jump & Scale)
    duration = 800 + Math.random() * 100;
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
    duration = 650 + Math.random() * 100;
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
    duration = 450 + Math.random() * 80; // Much faster
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

 const onEnd = () => {
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
      setTimeout(() => triggerBotResponse(), 600);
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
  state.gameMode = "bot";
  state.role = "w"; // Player is White
  state.roomId = "LOCAL_BOT";
  
  chess.reset();
  
  // Initialize snapshot manually to bypass server socket
 state.snapshot = {
    roomId: "LOCAL",
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
    players: { whiteConnected: true, blackConnected: true, spectatorCount: 0 },
    rematchVotes: 0,
    analysis: { enabled: false, votes: 0 },
    isStarted: true,
    pregame: { p1Choice: "w", p2Choice: "b", p1Ready: true, p2Ready: true }
  };

  showToast("Bot mode active. You are White!");
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

function seatLabel(role: PlayerRole): string {
  if (state.role === role) {
    return `You (${role === "w" ? "White" : "Black"})`;
  }

  return `${role === "w" ? "White" : "Black"} player connected`;
}

function humanRole(role: RoomRole | null): string {
  if (role === "w") {
    return "White";
  }

  if (role === "b") {
    return "Black";
  }

  if (role === "spectator") {
    return "Spectator";
  }

  return "Not seated";
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
  state.roomId = null;
  state.role = null;
  state.shareUrl = "";
  state.snapshot = null;
  state.pendingPromotion = null;
  state.premoves = [];

  state.gameMode = "multiplayer"; 

  focusTimerStartMs = null;
  state.liveAnalysisSummary = "Live analysis disabled.";
  state.lastAnalyzedMoveKey = null;
  state.liveMoveGrades = {};
  liveAnalysisToken += 1;
  
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

function formatElapsed(secondsTotal: number): string {
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateFocusHud(): void {
  // Ocultamos ambos HUDs si no estamos en modo focus
  if (!state.focusMode) {
    focusHud.hidden = true;
    focusMaterialHud.hidden = true; // Ocultamos el nuevo HUD también
    return;
  }

  // 1. Lógica del Cronómetro (Tu lógica original)
  const elapsedSeconds = focusTimerStartMs
    ? Math.max(0, Math.floor((Date.now() - focusTimerStartMs) / 1000))
    : 0;
  focusTimer.textContent = formatElapsed(elapsedSeconds);

  // 2. Lógica de Material para el HUD (Reparada)
  const snapshot = state.snapshot;
  if (snapshot && state.role && state.role !== "spectator") {
    const fen = snapshot.fen || "";
    const myColor = state.role as PlayerRole;
    
    // Calculamos el valor neto
    const rawValue = materialFromPerspective(fen, myColor);
    const netValue = Math.floor(rawValue / 100);

    // Contamos piezas para los iconos
    const boardFen = fen.split(" ")[0] || "";
    const counts: Record<string, number> = {};
    for (const char of boardFen) {
      if (/[prnbqkPRNBQK]/.test(char)) {
        counts[char] = (counts[char] || 0) + 1;
      }
    }

    let advantageIcons = "";
    // Aseguramos que PIECE_SYMBOLS_MAP está definida con 'as const' para TypeScript
    const types: (keyof typeof PIECE_SYMBOLS_MAP)[] = ["q", "r", "b", "n", "p"];
    
    types.forEach(type => {
      const myCount = myColor === "w" ? (counts[type.toUpperCase()] || 0) : (counts[type.toLowerCase()] || 0);
      const opCount = myColor === "w" ? (counts[type.toLowerCase()] || 0) : (counts[type.toUpperCase()] || 0);
      const diff = myCount - opCount;
      if (diff > 0) advantageIcons += PIECE_SYMBOLS_MAP[type].repeat(diff);
    });

    // Mostramos u ocultamos según el balance
    if (netValue > 0) {
      // Ventaja: Mostramos puntos e iconos (apilados por el CSS)
      focusMaterialScore.textContent = `+${netValue}`;
      focusMaterialIcons.textContent = advantageIcons;
      focusMaterialScore.style.display = "block";
      focusMaterialIcons.style.display = "block";
      focusMaterialHud.hidden = false;
    } else if (netValue < 0) {
      // Desventaja: Solo mostramos el número
      focusMaterialScore.textContent = `${netValue}`;
      focusMaterialScore.style.display = "block";
      focusMaterialIcons.style.display = "none";
      focusMaterialHud.hidden = false;
    } else {
      // Igualdad: Ocultamos el HUD para limpiar la pantalla
      focusMaterialHud.hidden = true;
    }
  } else {
    // Si no hay partida o somos espectadores, ocultamos el material
    focusMaterialHud.hidden = true;
  }

  // Mostramos el timer (siempre visible en focus)
  focusHud.hidden = false;
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

window.addEventListener("beforeunload", () => {
  liveAnalyzer?.terminate();
});
