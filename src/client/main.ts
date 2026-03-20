import { Chess, Move, PieceSymbol, Square } from "chess.js";
import { io } from "socket.io-client";

import { BoardOrientation, SquareName, buildSquareList, isLightSquare } from "../../engine";
import "./styles.css";
import { mountThemeSwitcher } from "./theme";

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
};

let lastAnimatedMoveKey: string | null = null;
let suppressAnimationForMove: { from: Square; to: Square } | null = null;
let activeGhostAnimation: Animation | null = null;
let activeGhostNode: HTMLElement | null = null;
let activeGhostDestinationPiece: HTMLElement | null = null;
let pendingBoardRefresh = false;
let focusTimerStartMs: number | null = null;
let liveAnalyzer: StockfishBridge | null = null;
let liveAnalysisToken = 0;

const LIVE_MATE_CP = 100000;
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};
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
      if (!this.ready) {
        this.initReject(new Error("Could not initialize Stockfish."));
      }
      this.activeEval?.reject(new Error("Stockfish worker error."));
      this.activeEval = null;
    };
    this.send("uci");
    this.send("isready");
  }

  async evaluateFen(fen: string, depth: number): Promise<EngineEval> {
    await this.initPromise;
    const evalPromise = this.queue.then(() => {
      return new Promise<EngineEval>((resolve, reject) => {
        this.activeEval = {
          resolve,
          reject,
          lastCp: 0,
          mate: null,
          pv: "",
          bestMove: "",
        };
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);
      });
    });

    this.queue = evalPromise.then(() => undefined).catch(() => undefined);
    return evalPromise;
  }

  terminate(): void {
    this.worker.terminate();
  }

  private onMessage(line: string): void {
    if (!line) return;

    if (line === "readyok" && !this.ready) {
      this.ready = true;
      this.initResolve();
      return;
    }

    if (!this.activeEval) {
      return;
    }

    if (line.startsWith("info ")) {
      const parsed = parseInfoLine(line);
      if (parsed) {
        this.activeEval.lastCp = parsed.cp;
        this.activeEval.mate = parsed.mate;
        this.activeEval.pv = parsed.pv;
      }
      return;
    }

    if (line.startsWith("bestmove ")) {
      const bestMove = line.split(" ")[1] ?? "";
      this.activeEval.bestMove = bestMove;
      this.activeEval.resolve({
        cp: this.activeEval.lastCp,
        mate: this.activeEval.mate,
        bestMove: this.activeEval.bestMove,
        pv: this.activeEval.pv,
      });
      this.activeEval = null;
    }
  }

  private send(command: string): void {
    this.worker.postMessage(command);
  }
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
function playSoundForSnapshot(snapshot: RoomSnapshot): void {
  const last = snapshot.lastMove;
  if (!last) return;
  if (snapshot.checkmate || snapshot.draw) {
    playSound("gameEndOrCheckmate");
  } else if (snapshot.check) {
    playSound("checkMove");
  } else if (last.san.startsWith("O-O")) {
    playSound("castle");
  } else if (last.san.includes("x")) {
    playSound("capture");
  } else {
    playSound("move-self");
  }
}

app.innerHTML = `
  <div class="app-shell">
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
          <button class="ghost" id="rematchButton" type="button" hidden>Request rematch</button>
          <button class="ghost" id="flipBoardButton" type="button" hidden>Flip board</button>
          <button class="ghost" id="liveAnalysisButton" type="button" hidden>Live analysis</button>
        </div>
        <div class="pregame-placeholder" id="pregamePlaceholder">
          <h2>Waiting for match start</h2>
          <p>Create or join a room. The board appears automatically once both players are connected.</p>
        </div>
        <div class="board-wrap">
          <div class="board" id="board"></div>
          <svg class="board-arrows" id="arrowLayer" viewBox="0 0 800 800" aria-hidden="true"></svg>
        </div>
        <div class="board-caption" id="boardCaption">
          Tap or click one of your pieces, then choose a legal destination.
        </div>
        <div class="focus-hud" id="focusHud" hidden>
          <span class="focus-chip" id="focusTimer">00:00</span>
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
const focusHud = must<HTMLDivElement>("#focusHud");
const focusTimer = must<HTMLSpanElement>("#focusTimer");
const focusModeButton = must<HTMLButtonElement>("#focusModeBtn");

mountThemeSwitcher();

window.addEventListener("animationchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ style: "smooth" | "epic" }>;
  state.animationStyle = customEvent.detail.style;
});

window.addEventListener("bloodfxchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ enabled: boolean }>;
  state.bloodFxEnabled = customEvent.detail.enabled;
});

const joinRoomButton = must<HTMLButtonElement>("#joinRoomButton");
const copyLinkButton = must<HTMLButtonElement>("#copyLinkButton");
const leaveRoomButton = must<HTMLButtonElement>("#leaveRoomButton");
const flipBoardButton = must<HTMLButtonElement>("#flipBoardButton");
const rematchButton = must<HTMLButtonElement>("#rematchButton");
const liveAnalysisButton = must<HTMLButtonElement>("#liveAnalysisButton");
const arrowLayer = must<SVGSVGElement>("#arrowLayer");
const arrowAnnotations = new Set<string>();

createRoomButton.addEventListener("click", () => {
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

leaveRoomButton.addEventListener("click", () => {
  if (!state.roomId) {
    showToast("You are not in a room.");
    return;
  }

  socket.emit("room:leave");
  clearLocalRoomState();
  render();
});

flipBoardButton.addEventListener("click", () => {
  state.orientation = state.orientation === "w" ? "b" : "w";
  requestBoardRefresh();
  updateCaption();
});

rematchButton.addEventListener("click", () => {
  if (!state.roomId) {
    showToast("Join a room first.");
    return;
  }

  socket.emit("game:rematch");
});

liveAnalysisButton.addEventListener("click", () => {
  socket.emit("analysis:toggle");
});

focusModeButton.addEventListener("click", () => {
  void toggleFocusMode();
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
    showToast("Premoves canceled.");
    requestBoardRefresh();
    updateCaption();
  }
});


// ── Pointer drag ───────────────────────────────────────────────────────────────
let ptrDragFrom: Square | null = null;
let ptrDragNode: HTMLElement | null = null;
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
    state.legalTargets = legalTargetsFor(ptrDragFrom);
    syncBoardInteractionState();
    updateCaption();

    const btn = board.querySelector<HTMLButtonElement>(`[data-square="${ptrDragFrom}"]`);
    const piece = btn?.querySelector<HTMLElement>(".piece");
    if (piece && btn) {
      const cs = window.getComputedStyle(piece);
      const pieceRect = piece.getBoundingClientRect();
      ptrDragNode = piece.cloneNode(true) as HTMLElement;
      Object.assign(ptrDragNode.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "9999",
        width: `${pieceRect.width}px`,
        height: `${pieceRect.height}px`,
        margin: "0",
        lineHeight: "1",
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        color: cs.color,
        textShadow: cs.textShadow,
        filter: cs.filter,
        transformOrigin: "center center",
        transition: "none",
      });
      document.body.append(ptrDragNode);
      btn.classList.add("dragging");
    }
  }

  if (ptrDragNode) {
    ptrDragNode.style.left = `${event.clientX - ptrDragNode.offsetWidth / 2}px`;
    ptrDragNode.style.top  = `${event.clientY - ptrDragNode.offsetHeight / 2}px`;
  }
});

function endPointerDrag(event: PointerEvent, commit: boolean): void {
  if (!ptrDragFrom) return;
  const fromSquare = ptrDragFrom;
  const wasDrag = ptrDragMoved;
  ptrDragFrom = null;
  ptrDragMoved = false;
  ptrDragNode?.remove();
  ptrDragNode = null;
  board.querySelector<HTMLElement>(".square.dragging")?.classList.remove("dragging");

  if (!wasDrag) {
    if (commit) {
      lastPointerTapSquare = fromSquare;
      lastPointerTapAtMs = performance.now();
      clearArrows();
      onSquarePressed(fromSquare);
    }
    return;
  }

  if (commit) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const squareButton = el?.closest<HTMLButtonElement>(".square");
    const targetSquare = squareButton?.dataset.square as Square | undefined;
    if (targetSquare && targetSquare !== fromSquare) {
      lastDragCommitSquare = targetSquare;
      lastDragCommitAtMs = performance.now();
      suppressAnimationForMove = { from: fromSquare, to: targetSquare };
      tryMoveFromTo(fromSquare, targetSquare);
    }
  }

  clearSelection();
  requestBoardRefresh();
  updateCaption();
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
  if (!targetSquare || !arrowDragMoved || targetSquare === fromSquare) {
    arrowDragMoved = false;
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

promotionDialog.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-promotion]");
  if (!button) {
    return;
  }

  const promotion = button.dataset.promotion as PromotionPiece;
  if (!state.pendingPromotion) {
    return;
  }

  socket.emit("game:move", { ...state.pendingPromotion, promotion });
  
  // Run live analysis immediately for this promotion (optimistic)
  if (state.snapshot?.analysis.enabled) {
    state.liveAnalysisSummary = "Analyzing your move...";
    renderSession();
    
    const tempChess = new Chess(state.snapshot.fen);
    const moveResult = tempChess.move({ from: state.pendingPromotion.from, to: state.pendingPromotion.to, promotion });
    if (moveResult) {
      const moveKey = `${state.snapshot.moveCount + 1}:${state.pendingPromotion.from}:${state.pendingPromotion.to}:${moveResult.san}`;
      void maybeRunLiveAnalysisForMove(state.snapshot.moves, moveResult, state.snapshot.moveCount + 1, moveKey);
    }
  }
  
  state.pendingPromotion = null;
  promotionDialog.hidden = true;
});

socket.on("connect", () => {
  state.connected = true;

  if (state.autoJoinCode) {
    if (ROOM_ID_PATTERN.test(state.autoJoinCode)) {
      socket.emit("room:join", { roomId: state.autoJoinCode });
    }
    state.autoJoinCode = null;
  }
});

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

  // Guardar roomId en localStorage para reconexión automática
  localStorage.setItem("chess_roomId", payload.roomId);

  if (payload.role === "w" || payload.role === "b") {
    state.orientation = payload.role;
  }

  syncUrl(payload.roomId);
  render();
});

socket.on("session:left", () => {
  clearLocalRoomState();
  render();
});

socket.on("room:state", (snapshot: RoomSnapshot) => {
  const previousMoveCount = state.snapshot?.moveCount ?? 0;
  const previousFen = chess.fen();
  state.snapshot = snapshot;
  if (!focusTimerStartMs || snapshot.moveCount < previousMoveCount) {
    focusTimerStartMs = Date.now();
  }
  chess.load(snapshot.fen);

  const isNewMove = _lastPlayedMoveCount !== -1 && snapshot.moveCount > _lastPlayedMoveCount;
  _lastPlayedMoveCount = snapshot.moveCount;
  if (isNewMove) playSoundForSnapshot(snapshot);

  if (snapshot.check && isNewMove) {
    triggerCheckFlash();
  }

  const capturedByCount = countFenPieces(snapshot.fen) < countFenPieces(previousFen);
  if (state.bloodFxEnabled && isNewMove && capturedByCount && snapshot.lastMove) {
    const capturedPiece = detectCapturedPiece(previousFen, snapshot.lastMove);
    spawnBloodSplatter(snapshot.lastMove.to, capturedPiece ?? "p");
  }

  if (snapshot.moveCount > previousMoveCount) {
    clearArrows();
  }

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


if (state.role && state.role !== "spectator" && snapshot.turn === state.role && state.premoves.length > 0) {
  const nextMove = state.premoves.shift();
  if (nextMove) {
    const isLegal = chess.moves({ verbose: true }).some(m => m.from === nextMove.from && m.to === nextMove.to);
    
    if (isLegal && !snapshot.checkmate && !snapshot.draw) {
   
      suppressAnimationForMove = { from: nextMove.from, to: nextMove.to };

    
      socket.emit("game:move", nextMove.promotion ? nextMove : { from: nextMove.from, to: nextMove.to });
      showToast(`Premove played: ${nextMove.from} -> ${nextMove.to}`);
  
      void maybeRunLiveAnalysis(snapshot);
      return; 
    } else {
      state.premoves = [];
      showToast("Premoves canceled (illegal move or check).");
    }
  }
}


render();
void maybeRunLiveAnalysis(snapshot);
});

socket.on("room:error", (payload: { message: string }) => {
  suppressAnimationForMove = null;
  // If this was an auto-join attempt, clear the URL and don't show error
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

function render(): void {
  const savedScroll = window.scrollY;
  requestBoardRefresh();
  renderSession();
  renderMoves();
  updateCaption();
  updateFocusHud();
  requestAnimationFrame(() => {
    if (window.scrollY !== savedScroll) {
      window.scrollTo({ top: savedScroll, behavior: "instant" });
    }
  });
}

function renderSession(): void {
  const snapshot = state.snapshot;
  const hasRoom = Boolean(state.roomId);
  const isMatchReady = Boolean(snapshot?.players.whiteConnected && snapshot?.players.blackConnected);
  const canVote = state.role === "w" || state.role === "b";
  const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));

  roomBadge.textContent = state.roomId ? `Room ${state.roomId}` : "No active room";
  roleBadge.textContent = humanRole(state.role);
  shareLink.textContent = state.shareUrl || "Create or join a room to get a live invite link.";

  // Show controls only when they are actionable for the current session stage.
  leaveRoomButton.hidden = !hasRoom;
  copyLinkButton.hidden = !state.shareUrl;
  flipBoardButton.hidden = !isMatchReady;
  liveAnalysisButton.hidden = !isMatchReady || !canVote;
  rematchButton.hidden = !gameEnded || !canVote;
  focusModeButton.hidden = !isMatchReady;
  seatCard.hidden = !hasRoom;
  summaryCard.hidden = !isMatchReady;
  movesCard.hidden = !isMatchReady;

  if (!isMatchReady && state.focusMode) {
    state.focusMode = false;
    applyFocusMode();
  }
  
  if (!snapshot) {
    pregamePlaceholder.hidden = false;
    matchStatus.textContent = "Create a room to start.";
    whiteSeat.textContent = "Waiting for player";
    blackSeat.textContent = "Waiting for player";
    turnMeta.textContent = "White";
    movesMeta.textContent = "0";
    spectatorMeta.textContent = "0";
    summaryText.textContent = "Ready to play.";
    liveAnalysisText.textContent = "Live analysis disabled.";
    return;
  }

  pregamePlaceholder.hidden = isMatchReady;

  matchStatus.textContent = snapshot.status;
  whiteSeat.textContent = snapshot.players.whiteConnected ? seatLabel("w") : "Waiting for player";
  blackSeat.textContent = snapshot.players.blackConnected ? seatLabel("b") : "Waiting for player";
  turnMeta.textContent = snapshot.turn === "w" ? "White" : "Black";
  movesMeta.textContent = String(snapshot.moveCount);
  spectatorMeta.textContent = String(snapshot.players.spectatorCount);

  const roleDescription = state.role === "spectator"
    ? "Spectating."
    : state.role
      ? `Playing ${state.role === "w" ? "White" : "Black"}.`
      : "Not seated.";
  const lastMoveDescription = snapshot.lastMove
    ? ` Last move: ${snapshot.lastMove.san} (${snapshot.lastMove.from} to ${snapshot.lastMove.to}).`
    : "";
  const rematchDescription = snapshot.rematchVotes > 0 ? ` Rematch votes: ${snapshot.rematchVotes}/2.` : "";

  summaryText.textContent = `${roleDescription} ${snapshot.status}${lastMoveDescription}${rematchDescription}`.trim();
  const seatedPlayers = Number(snapshot.players.whiteConnected) + Number(snapshot.players.blackConnected);
  liveAnalysisButton.disabled = seatedPlayers < 2 || !canVote;
  liveAnalysisButton.textContent = snapshot.analysis.enabled
    ? "Disable analysis"
    : `Enable analysis (${snapshot.analysis.votes}/2)`;

  // Enable rematch button only if game has ended
  rematchButton.disabled = !gameEnded;

  if (snapshot.analysis.enabled) {
    liveAnalysisText.textContent = state.liveAnalysisSummary;
  } else if (snapshot.analysis.votes > 0) {
    liveAnalysisText.textContent = `Waiting for both players: ${snapshot.analysis.votes}/2 ready.`;
  } else {
    liveAnalysisText.textContent = "Live analysis disabled.";
  }
  updateFocusHud();
}

function renderBoard(): void {
  const fragment = document.createDocumentFragment();
  const squares = buildSquareList(state.orientation);
  const lastMoveSquares = new Set<string>();
  const checkedKingSquare = getCheckedKingSquare();
  const lastMove = state.snapshot?.lastMove ?? null;
  
  const liveGrade = state.snapshot?.analysis.enabled && state.snapshot.lastMove
    ? state.liveMoveGrades[state.snapshot.moveCount]
    : undefined;
  const liveMarkerSquare = liveGrade && state.snapshot?.lastMove ? state.snapshot.lastMove.to : null;

  if (lastMove) {
    lastMoveSquares.add(lastMove.from);
    lastMoveSquares.add(lastMove.to);
  }

  for (const squareName of squares) {
    const square = squareName as Square;
    const piece = chess.get(square);
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.className = `square ${isLightSquare(squareName) ? "light" : "dark"}`;
    button.dataset.square = squareName;
    button.setAttribute("aria-label", squareName);

    if (state.selectedSquare === square) button.classList.add("selected");
    if (state.legalTargets.includes(square)) button.classList.add("legal");
    if (lastMoveSquares.has(squareName)) button.classList.add("last-move");
    if (checkedKingSquare === squareName) button.classList.add("in-check");

    state.premoves.forEach((p) => {
      if (p.from === square) button.classList.add("premove-from");
      if (p.to === square) button.classList.add("premove-to");
    });

    if (piece) {
      const spritePath = PIECES[`${piece.color}${piece.type}`];
      const pieceElement = document.createElement("span");
      pieceElement.className = `piece piece-${piece.type} ${piece.color === "w" ? "white" : "black"}`;
      
      // Aplicar 0ms en CSS si es el destino del premove actual
      if (suppressAnimationForMove && square === suppressAnimationForMove.to) {
        pieceElement.style.transition = "none";
      }

      const pieceImage = document.createElement("img");
      pieceImage.className = "piece-image";
      pieceImage.src = spritePath;
      pieceImage.alt = `${piece.color === "w" ? "White" : "Black"} ${piece.type}`;
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

  // --- LÓGICA DE SUPRESIÓN DE ANIMACIÓN MEJORADA ---
  const isPremoveExecution = suppressAnimationForMove && 
                             lastMove && 
                             lastMove.from === suppressAnimationForMove.from && 
                             lastMove.to === suppressAnimationForMove.to;

  if (isPremoveExecution) {
    // Marcamos el movimiento como "ya procesado" para que el motor de animación no lo intente después
    lastAnimatedMoveKey = `${state.snapshot!.moveCount}:${lastMove!.from}:${lastMove!.to}:${lastMove!.san}`;
    // LIMPIEZA SEGURA: Solo lo ponemos a null si ya se ejecutó
    suppressAnimationForMove = null; 
  } else {
    // Si no es la ejecución del premove, animamos según el estilo elegido
    if (state.animationStyle === "epic") {
      animateLastMoveEpic(lastMove);
    } else {
      animateLastMove(lastMove);
    }
  }

  renderArrows();
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
    move = replay.move({
      from: lastMove.from,
      to: lastMove.to,
      promotion: promotion as "q" | "r" | "b" | "n" | undefined,
    });
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
  if (!boardWrap) {
    return;
  }

  const intensityByPiece: Record<PieceSymbol, number> = {
    p: 1,
    n: 1.28,
    b: 1.32,
    r: 1.5,
    q: 2.05,
    k: 1.75,
  };
  const intensity = intensityByPiece[capturedPiece] ?? 1;

  const center = squareCenter(square);
  const splatter = document.createElement("div");
  splatter.className = "capture-splatter";
  splatter.style.left = `${(center.x / 800) * 100}%`;
  splatter.style.top = `${(center.y / 800) * 100}%`;
  splatter.style.setProperty("--intensity", String(intensity));

  const dropCount = Math.max(14, Math.floor((16 + Math.random() * 12) * intensity));
  for (let index = 0; index < dropCount; index += 1) {
    const drop = document.createElement("span");
    drop.className = "capture-drop";
    const angle = Math.random() * Math.PI * 2;
    const distance = (24 + Math.random() * 58) * (0.88 + intensity * 0.28);
    const size = (5.8 + Math.random() * 10.8) * (0.84 + intensity * 0.18);
    const smear = 0.68 + Math.random() * (0.95 + intensity * 0.28);
    const stretch = 0.68 + Math.random() * 1.4;
    drop.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    drop.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    drop.style.setProperty("--size", `${size}px`);
    drop.style.setProperty("--delay", `${Math.random() * 120}ms`);
    drop.style.setProperty("--smear", `${smear}`);
    drop.style.setProperty("--stretch", `${stretch}`);
    splatter.append(drop);
  }

  boardWrap.append(splatter);
  splatter.addEventListener("animationend", () => splatter.remove(), { once: true });
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
  if (arrowAnnotations.size === 0) {
    return;
  }

  arrowAnnotations.clear();
  renderArrows();
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
    squareButton.classList.toggle("legal", state.legalTargets.includes(square));
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
    const whiteMove = snapshot.moves[index];
    const blackMove = snapshot.moves[index + 1];
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

    rows.push(`
      <div class="move-row">
        <strong>${moveNumber}.</strong>
        <span>${whiteMove ? whiteMove.san : ""}${whiteBadge}</span>
        <span>${blackMove ? blackMove.san : ""}${blackBadge}</span>
      </div>
    `);
  }

  moveList.innerHTML = rows.join("");
}

function updateCaption(): void {
  if (!state.snapshot) {
    boardCaption.textContent = "Tap or click one of your pieces, then choose a legal destination.";
    return;
  }

  if (state.role === "spectator") {
    boardCaption.textContent = `Spectating room ${state.snapshot.roomId}. Flip the board if you want the black perspective.`;
    return;
  }

  if (!state.role) {
    boardCaption.textContent = "Join a room to claim an open seat or watch as a spectator.";
    return;
  }

if (state.snapshot.turn !== state.role) {
    const first = state.premoves[0]; // Intentamos obtener el primero de la cola
    if (first) {
      const count = state.premoves.length;
      boardCaption.textContent = count === 1 
        ? `Premove queued: ${first.from} -> ${first.to}.`
        : `Premoves queued: ${count} (${first.from} -> ${first.to}, ...)`;
    } else {
      boardCaption.textContent = `Waiting for ${state.snapshot.turn === "w" ? "White" : "Black"} to move. You can set up to 10 premoves.`;
    }
    return;
  }

  boardCaption.textContent = state.selectedSquare
    ? `Selected ${state.selectedSquare}. Choose one of the highlighted targets.`
    : `Your move as ${state.role === "w" ? "White" : "Black"}.`;
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

  if (lastAnimatedMoveKey === moveKey) {
    return;
  }

  lastAnimatedMoveKey = moveKey;

  if (suppressAnimationForMove) {
    const matchesSuppressedDrag =
      suppressAnimationForMove.from === lastMove.from &&
      suppressAnimationForMove.to === lastMove.to;
    suppressAnimationForMove = null;
    if (matchesSuppressedDrag) {
      return;
    }
  }

  // Cancel any in-flight ghost first.
  if (activeGhostAnimation) {
    activeGhostAnimation.cancel();
  }
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

  const computed = window.getComputedStyle(destinationPiece);
  const pieceRect = destinationPiece.getBoundingClientRect();
  const ghostPiece = destinationPiece.cloneNode(true) as HTMLElement;
  Object.assign(ghostPiece.style, {
    position: "absolute",
    left: `${endX}px`,
    top: `${endY}px`,
    width: `${pieceRect.width}px`,
    height: `${pieceRect.height}px`,
    transform: "translate3d(-50%, -50%, 0)",
    margin: "0",
    zIndex: "9999",
    pointerEvents: "none",
    fontSize: computed.fontSize,
    fontFamily: computed.fontFamily,
    color: computed.color,
    filter: computed.filter,
    textShadow: computed.textShadow,
    lineHeight: "1",
    animation: "none",
    opacity: "1",
    willChange: "transform",
  });

  destinationPiece.style.visibility = "hidden";
  activeGhostNode = ghostPiece;
  activeGhostDestinationPiece = destinationPiece;
  document.body.append(ghostPiece);

  const animation = ghostPiece.animate(
    [
      {
        transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0)`,
        offset: 0,
      },
      {
        transform: "translate3d(-50%, -50%, 0)",
        offset: 1,
      },
    ],
    {
      duration: 700,
      easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
    },
  );

  activeGhostAnimation = animation;

  animation.addEventListener("finish", () => {
    ghostPiece.remove();
    destinationPiece.style.visibility = "";
    if (activeGhostAnimation === animation) {
      activeGhostAnimation = null;
      activeGhostNode = null;
      activeGhostDestinationPiece = null;
      if (pendingBoardRefresh) {
        pendingBoardRefresh = false;
        renderBoard();
      }
    }
  });

  animation.addEventListener("cancel", () => {
    ghostPiece.remove();
    destinationPiece.style.visibility = "";
    if (activeGhostAnimation === animation) {
      activeGhostAnimation = null;
      activeGhostNode = null;
      activeGhostDestinationPiece = null;
      if (pendingBoardRefresh) {
        pendingBoardRefresh = false;
        renderBoard();
      }
    }
  });
}

function requestBoardRefresh(): void {
  if (activeGhostAnimation) {
    pendingBoardRefresh = true;
    return;
  }

  renderBoard();
}

function animateLastMoveEpic(lastMove: MoveSummary | null): void {
  if (!state.snapshot || !lastMove) {
    lastAnimatedMoveKey = null;
    return;
  }

  const moveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;

  if (lastAnimatedMoveKey === moveKey) {
    return;
  }

  lastAnimatedMoveKey = moveKey;

  if (suppressAnimationForMove) {
    const matchesSuppressedDrag =
      suppressAnimationForMove.from === lastMove.from &&
      suppressAnimationForMove.to === lastMove.to;
    suppressAnimationForMove = null;
    if (matchesSuppressedDrag) {
      return;
    }
  }

  // Cancel any in-flight ghost first.
  if (activeGhostAnimation) {
    activeGhostAnimation.cancel();
  }
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

  const computed = window.getComputedStyle(destinationPiece);
  const pieceRect = destinationPiece.getBoundingClientRect();
  const ghostPiece = destinationPiece.cloneNode(true) as HTMLElement;
  
  // Perfiles épicos: no siempre gira fuerte; a veces se mueve por inercia o con tilt corto.
  const randomRotation = Math.random() * 300 + 220;
  const randomScale = Math.random() * 0.4 + 0.8;
  const spinDirection = Math.random() > 0.5 ? 1 : -1;
  const settleWobble = Math.random() * 14 + 8;
  const profileRoll = Math.random();
  const motionProfile = profileRoll < 0.38 ? "spin" : profileRoll < 0.76 ? "inertia" : "tilt";
  const hasFlip = motionProfile === "spin" ? Math.random() > 0.45 : motionProfile === "inertia" ? Math.random() > 0.92 : false;

  const spinStart = motionProfile === "spin"
    ? randomRotation * 0.22 * spinDirection
    : motionProfile === "inertia"
      ? settleWobble * 1.25 * spinDirection
      : settleWobble * 0.85 * spinDirection;
  const spinMid = motionProfile === "spin"
    ? randomRotation * 0.46 * spinDirection
    : motionProfile === "inertia"
      ? settleWobble * 0.72 * spinDirection
      : -settleWobble * 0.92 * spinDirection;
  const spinPeak = motionProfile === "spin"
    ? randomRotation * 0.68 * spinDirection
    : motionProfile === "inertia"
      ? settleWobble * 1.05 * spinDirection
      : settleWobble * 0.55 * spinDirection;

  const pullX = motionProfile === "inertia"
    ? deltaX * (0.14 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1)
    : deltaX * (0.02 + Math.random() * 0.05) * (Math.random() > 0.5 ? 1 : -1);
  const pullY = motionProfile === "inertia"
    ? 20 + Math.random() * 22
    : 8 + Math.random() * 12;
  const jumpA = motionProfile === "inertia" ? 62 + Math.random() * 36 : 74 + Math.random() * 44;
  const jumpB = motionProfile === "spin" ? 100 + Math.random() * 32 : 84 + Math.random() * 28;
  const duration = 900 + Math.floor(Math.random() * 170);
  
  Object.assign(ghostPiece.style, {
    position: "absolute",
    left: `${endX}px`,
    top: `${endY}px`,
    width: `${pieceRect.width}px`,
    height: `${pieceRect.height}px`,
    transform: "translate3d(-50%, -50%, 0)",
    margin: "0",
    zIndex: "9999",
    pointerEvents: "none",
    fontSize: computed.fontSize,
    fontFamily: computed.fontFamily,
    color: computed.color,
    filter: computed.filter,
    textShadow: computed.textShadow,
    lineHeight: "1",
    animation: "none",
    opacity: "1",
    willChange: "transform",
    perspective: "1000px",
  });

  destinationPiece.style.visibility = "hidden";
  activeGhostNode = ghostPiece;
  activeGhostDestinationPiece = destinationPiece;
  document.body.append(ghostPiece);

  // Keyframes épicas con saltos, rotaciones y efectos
  const keyframes = [
    {
      transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) rotateX(0deg) scale(1)`,
      filter: "brightness(1)",
      offset: 0,
    },
    {
      transform: `translate3d(calc(-50% + ${deltaX * 0.58 + pullX}px), calc(-50% + ${deltaY * 0.58 - jumpA}px), 0) rotateZ(${spinStart}deg) rotateX(${hasFlip ? 180 : 0}deg) scale(${Math.max(0.88, randomScale)})`,
      filter: "brightness(1.1)",
      offset: 0.4,
    },
    {
      transform: `translate3d(calc(-50% + ${deltaX * 0.84 - pullX * 0.35}px), calc(-50% + ${deltaY * 0.84 - jumpB + pullY * 0.2}px), 0) rotateZ(${spinMid}deg) rotateX(${hasFlip ? 360 : 0}deg) scale(${Math.max(0.82, randomScale - 0.12)})`,
      filter: "brightness(1.2)",
      offset: 0.65,
    },
    {
      transform: `translate3d(calc(-50% + ${pullX * 0.22}px), calc(-50% + ${6 + pullY * 0.15}px), 0) rotateZ(${spinPeak}deg) rotateX(${hasFlip ? 12 : 0}deg) scale(1.04)`,
      filter: "brightness(1.06)",
      offset: 0.86,
    },
    {
      transform: `translate3d(-50%, calc(-50% - 2px), 0) rotateZ(${-(settleWobble * 0.55) * spinDirection}deg) rotateX(${hasFlip ? -6 : 0}deg) scale(0.985)`,
      filter: "brightness(1.02)",
      offset: 0.94,
    },
    {
      transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) rotateX(0deg) scale(1)",
      filter: "brightness(1)",
      offset: 1,
    },
  ];

  const animation = ghostPiece.animate(keyframes, {
    duration,
    easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  });

  activeGhostAnimation = animation;

  animation.addEventListener("finish", () => {
    ghostPiece.remove();
    destinationPiece.style.visibility = "";
    if (activeGhostAnimation === animation) {
      activeGhostAnimation = null;
      activeGhostNode = null;
      activeGhostDestinationPiece = null;
      if (pendingBoardRefresh) {
        pendingBoardRefresh = false;
        renderBoard();
      }
    }
  });

  animation.addEventListener("cancel", () => {
    ghostPiece.remove();
    destinationPiece.style.visibility = "";
    if (activeGhostAnimation === animation) {
      activeGhostAnimation = null;
      activeGhostNode = null;
      activeGhostDestinationPiece = null;
      if (pendingBoardRefresh) {
        pendingBoardRefresh = false;
        renderBoard();
      }
    }
  });
}

function onSquarePressed(square: Square): void {
  if (!state.snapshot || !state.role || state.role === "spectator") {
    return;
  }

  if (state.snapshot.turn !== state.role) {
    onPremoveSquarePressed(square);
    return;
  }

  const clickedPiece = chess.get(square);
  if (!state.selectedSquare) {
    if (clickedPiece && isOwnPiece(clickedPiece.color)) {
      selectSquare(square);
    }
    return;
  }

  if (square === state.selectedSquare) {
    clearSelection();
    requestBoardRefresh();
    updateCaption();
    return;
  }

  if (state.legalTargets.includes(square)) {
    tryMoveFromTo(state.selectedSquare, square);
    clearSelection();
    requestBoardRefresh();
    updateCaption();
    return;
  }

  if (clickedPiece && isOwnPiece(clickedPiece.color)) {
    selectSquare(square);
    return;
  }

  clearSelection();
  requestBoardRefresh();
  updateCaption();
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
  if (!state.snapshot || !state.role || state.role === "spectator") {
    return false;
  }

  const piece = chess.get(square);
  if (!piece || !isOwnPiece(piece.color)) {
    return false;
  }

  if (state.snapshot.turn === state.role) {
    return true;
  }

  return legalTargetsForRole(square, state.role).length > 0;
}

function tryMoveFromTo(from: Square, to: Square): void {
  if (!state.snapshot || !state.role || state.role === "spectator") {
    return;
  }

  if (state.snapshot.turn !== state.role) {
    queuePremove(from, to);
    return;
  }

  const selectedPiece = chess.get(from);
  if (selectedPiece?.type === "p" && reachesPromotionRank(to, state.role)) {
    state.pendingPromotion = { from, to };
    promotionDialog.hidden = false;
    return;
  }

  socket.emit("game:move", { from, to });

  // Run live analysis immediately for this move (optimistic)
  if (state.snapshot?.analysis.enabled) {
    state.liveAnalysisSummary = "Analyzing your move...";
    renderSession();
    
    const tempChess = new Chess(state.snapshot.fen);
    const moveResult = tempChess.move({ from, to });
    if (moveResult) {
      const moveKey = `${state.snapshot.moveCount + 1}:${from}:${to}:${moveResult.san}`;
      void maybeRunLiveAnalysisForMove(state.snapshot.moves, moveResult, state.snapshot.moveCount + 1, moveKey);
    }
  }
}

function isTheoreticallyPossible(from: Square, to: Square, piece: PieceSymbol, color: string): boolean {
  const fromFile = from.charCodeAt(0) - 97; // a=0, b=1...
  const fromRank = parseInt(from[1]);
  const toFile = to.charCodeAt(0) - 97;
  const toRank = parseInt(to[1]);
  
  const dx = Math.abs(toFile - fromFile);
  const dy = Math.abs(toRank - fromRank);

  // No tiene sentido un movimiento a la misma casilla
  if (dx === 0 && dy === 0) return false;

  switch (piece) {
    case 'p': // Peón
      const forward = (color === 'w') ? (toRank - fromRank) : (fromRank - toRank);
      const isStartRank = (color === 'w' && fromRank === 2) || (color === 'b' && fromRank === 7);
      // Avance recto (1 o 2) o captura diagonal (1)
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

function queuePremove(from: Square, to: Square): void {
  if (!state.role || state.role === "spectator") return;

  const piece = chess.get(from);
  if (!piece || piece.color !== state.role) return;

  // --- EL NUEVO FILTRO ---
  if (!isTheoreticallyPossible(from, to, piece.type, piece.color)) {
    // Si es un movimiento imposible, ignoramos y no mostramos error (así no "raya")
    return; 
  }

  // Lógica de "Toggle" y guardado que ya tenías
  const existingIndex = state.premoves.findIndex(p => p.from === from && p.to === to);
  if (existingIndex !== -1) {
    state.premoves.splice(existingIndex, 1);
    showToast("Premove cleared.");
  } else {
    if (state.premoves.length >= 10) {
      showToast("Max premoves reached (10).");
      return;
    }

    const promotion = (piece.type === "p" && reachesPromotionRank(to, state.role)) ? "q" : undefined;
    state.premoves.push(promotion ? { from, to, promotion } : { from, to });
    showToast(`Premove set: ${from} -> ${to}`);
  }

  clearSelection();
  requestBoardRefresh();
  updateCaption();
}

function onPremoveSquarePressed(square: Square): void {
  if (!state.role || state.role === "spectator") return;

  const clickedPiece = chess.get(square);

  // 1. Si no hay nada seleccionado aún
  if (!state.selectedSquare) {
    if (clickedPiece && clickedPiece.color === state.role) {
      // Seleccionamos tu pieza para empezar un premove
      state.selectedSquare = square;
      state.legalTargets = legalTargetsForRole(square, state.role);
      requestBoardRefresh();
      updateCaption();
    } else {
      // CLICK EN CUALQUIER OTRO LUGAR -> Cancelar todos los premoves
      if (state.premoves.length > 0) {
        state.premoves = [];
        showToast("Premoves canceled.");
        requestBoardRefresh();
        updateCaption();
      }
    }
    return;
  }

  // 2. Si ya hay una pieza seleccionada y clickeas la misma -> Deseleccionar
  if (square === state.selectedSquare) {
    clearSelection();
    requestBoardRefresh();
    updateCaption();
    return;
  }

  // 3. Intentar crear el premove
  const piece = chess.get(state.selectedSquare);
  // Usamos el filtro de "Teóricamente posible" que pusimos antes
  if (piece && isTheoreticallyPossible(state.selectedSquare, square, piece.type, piece.color)) {
    queuePremove(state.selectedSquare, square);
  } else {
    // CLICK EN DESTINO IMPOSIBLE -> Cancelar todos los premoves
    state.premoves = [];
    showToast("Premoves canceled.");
  }

  clearSelection();
  requestBoardRefresh();
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
  focusTimerStartMs = null;
  state.liveAnalysisSummary = "Live analysis disabled.";
  state.lastAnalyzedMoveKey = null;
  state.liveMoveGrades = {};
  liveAnalysisToken += 1;
  
  // Limpiar localStorage cuando se abandona la sala
  localStorage.removeItem("chess_roomId");
  
  clearArrows();
  clearSelection();
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
  if (!state.focusMode) {
    focusHud.hidden = true;
    return;
  }

  const elapsedSeconds = focusTimerStartMs
    ? Math.max(0, Math.floor((Date.now() - focusTimerStartMs) / 1000))
    : 0;
  focusTimer.textContent = formatElapsed(elapsedSeconds);
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
