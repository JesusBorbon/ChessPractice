import { Chess, Square, Move, PieceSymbol } from "chess.js";
import { buildSquareList, isLightSquare, SquareName, BoardOrientation } from "../../engine";
import "./analyze.css";
import "./arrows.css";
import "./badge-icon-colors.css";
import { buildArrowLayerMarkup } from "./arrow-render";
import { BestMoveArrow, parseBestMoveArrow } from "./best-move-arrow";
import { mountThemeSwitcher } from "./theme";

type PromotionPiece = "q" | "r" | "b" | "n";
type MoveCategory = "brilliant" | "great" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
type QualityResult = {
  category: MoveCategory;
  label: string;
};

type EngineEval = {
  cp: number;
  mate: number | null;
  bestMove: string;
  pv: string;
};

type MoveAnalysis = {
  ply: number;
  label: string;
  category: MoveCategory;
  cpl: number;
  playedMove: string;
  bestMove: string;
  note: string;
  beforeCp: number;
  afterCp: number;
};

const CATEGORY_LABELS: Record<MoveCategory, string> = {
  brilliant: "Brilliant",
  great: "Great",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};

const CATEGORY_TEXT_SYMBOLS: Record<MoveCategory, string> = {
  brilliant: "!!",
  great: "!",
  excellent: "👍",
  good: "✓",
  inaccuracy: "?!",
  mistake: "x",
  blunder: "??",
};

const CATEGORY_BADGE_ICON_PATHS: Partial<Record<MoveCategory, string>> = {
  excellent: "/assets/labelBadges/excellent.svg",
  good: "/assets/labelBadges/good.svg",
  mistake: "/assets/labelBadges/mistake.svg",
};

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const MATE_CP = 100000;
const BRILLIANT_VERIFICATION_DEPTH = 16;

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
        this.initReject(new Error("No se pudo iniciar Stockfish."));
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
    const cp = value > 0 ? MATE_CP - Math.min(Math.abs(value), 99) * 100 : -MATE_CP + Math.min(Math.abs(value), 99) * 100;
    return { cp, mate: value, pv };
  }

  return { cp: value, mate: null, pv };
}

function appendCategoryMarkerContent(marker: HTMLElement, category: MoveCategory): void {
  const iconPath = CATEGORY_BADGE_ICON_PATHS[category];
  if (iconPath) {
    const icon = document.createElement("img");
    icon.className = "piece-quality-marker-icon";
    icon.src = iconPath;
    icon.alt = `${CATEGORY_LABELS[category]} move`;
    icon.draggable = false;
    marker.append(icon);
    return;
  }

  marker.textContent = CATEGORY_TEXT_SYMBOLS[category];
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

const PIECES: Record<string, string> = {
  wp: "/pieces/wP.svg", wn: "/pieces/wN.svg", wb: "/pieces/wB.svg", wr: "/pieces/wR.svg", wq: "/pieces/wQ.svg", wk: "/pieces/wK.svg",
  bp: "/pieces/bP.svg", bn: "/pieces/bN.svg", bb: "/pieces/bB.svg", br: "/pieces/bR.svg", bq: "/pieces/bQ.svg", bk: "/pieces/bK.svg",
};

// ── State ──────────────────────────────────────────────────────────────────────
// We store the full history as a list of FENs so we can navigate
const chess = new Chess();
let orientation: BoardOrientation = "w";
let selectedSquare: Square | null = null;
let legalTargets: Square[] = [];
let pendingPromotion: { from: Square; to: Square } | null = null;
let suppressClickSquare: Square | null = null;
let suppressClickUntil = 0;
// navigation: history[0] = starting FEN, history[i] = FEN after move i
let fenHistory: string[] = [chess.fen()];
let moveHistory: Move[] = [];
let cursor = 0; // which FEN we're currently viewing
const arrowAnnotations = new Set<string>();
const squareAnnotations = new Set<string>();
let lastAnimatedMoveKey: string | null = null;
let suppressAnimationForMove: { from: Square; to: Square } | null = null;
let activeGhostAnimation: Animation | null = null;
let activeGhostNode: HTMLElement | null = null;
let activeGhostDestinationPiece: HTMLElement | null = null;
let pendingBoardRefresh = false;
let stockfish: StockfishBridge | null = null;
let analysisDepth = 12;
let analysisByPly: Array<MoveAnalysis | undefined> = [];
let analysisRunId = 0;
let analysisInProgress = false;
let fullAnalysisInProgress = false;
let bestMovesEnabled = localStorage.getItem("chess-analyze-best-moves") !== "off";
let liveBestMoveArrow: BestMoveArrow | null = null;
let liveBestMoveArrowFen: string | null = null;
let liveBestMoveRequestFen: string | null = null;
let bestMoveArrowToken = 0;
let gameLineFenHistory: string[] = [...fenHistory];
let gameLineMoveHistory: Move[] = [...moveHistory];
let gameLineAnalysisByPly: Array<MoveAnalysis | undefined> = [];
let gameLineLocked = false;
let isVariationMode = false;
let variationBranchPly: number | null = null;
let variationReturnCursor = 0;
let analysisProgressCompleted = 0;
let analysisProgressTotal = 0;
let lastQualityCalloutCursor = -1;
let activeQualityCallout: HTMLDivElement | null = null;
let focusMode = false;
let legalMovesEnabled = localStorage.getItem("chess-legal-moves") !== "off";
let animationStyle: "smooth" | "epic" = (localStorage.getItem("chess-animation-style") as "smooth" | "epic") || "smooth";
let bloodFxEnabled = localStorage.getItem("chess-blood-fx") === "on";
let lastCheckFlashKey: string | null = null;

const SMOOTH_MOVE_DURATION_MS = 620;
const EPIC_MOVE_DURATION_MS = {
  smash: 860,
  spin: 760,
  slide: 620,
} as const;

const POST_GAME_MOVES_STORAGE_KEY = "postGameMoves";
const POST_GAME_PGN_STORAGE_KEY = "postGamePgn";


// ── Mount ──────────────────────────────────────────────────────────────────────
const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
<div class="analyze-shell">
  <div class="analyze-topbar">
    <a href="/">← Back to multiplayer</a>
    <h1>Analysis Board</h1>
  </div>

  <div class="analyze-layout">
    <section class="panel analyze-board-panel">
      <div class="analyze-toolbar">
        <button class="btn-primary" id="resetBtn">Reset board</button>
        <button class="btn-ghost"   id="flipBtn">Flip board</button>
        <button class="btn-ghost"   id="copyFenBtn">Copy FEN</button>
        <button class="btn-ghost"   id="loadFenBtn">Load FEN</button>
        <button class="btn-ghost"   id="bestMovesToggleBtn">Best Moves: On</button>
        <button class="btn-primary" id="returnGameLineBtn" disabled>Return to Game Line</button>
        <button class="btn-primary" id="analyzeBtn">Analyze game</button>
        <button class="btn-ghost"   id="stopAnalyzeBtn">Stop</button>
      </div>

      <div class="board-wrap">
        <div class="board" id="board"></div>
        <svg class="analyze-arrows" id="arrowLayer" viewBox="0 0 800 800" aria-hidden="true"></svg>
      </div>

      <div class="nav-row">
        <button id="navFirst" title="Go to start">⏮</button>
        <button id="navPrev"  title="Previous move">◀</button>
        <button id="navNext"  title="Next move">▶</button>
        <button id="navLast"  title="Go to end">⏭</button>
      </div>

      <div class="analyze-status" id="statusBar">White to move.</div>
      <button class="focus-toggle-btn" id="focusModeBtn" type="button" aria-pressed="false">Focus</button>
    </section>

    <aside class="analyze-side">
      <div class="info-card turn-card">
        <h2>Turn</h2>
        <div class="turn-indicator">
          <div class="turn-dot" id="turnDot"></div>
          <span id="turnLabel">White</span>
        </div>
      </div>

      <div class="info-card fen-card">
        <h2>FEN</h2>
        <textarea class="fen-input" id="fenDisplay" rows="3" readonly></textarea>
      </div>

      <div class="info-card moves-card">
        <h2>Moves</h2>
        <div class="analyze-move-list" id="moveList"></div>
      </div>

      <div class="info-card feedback-card">
        <h2>Engine feedback</h2>
        <div class="engine-feedback" id="engineFeedback">Run analysis to get move quality feedback.</div>
      </div>
    </aside>
  </div>
</div>

<div class="promotion-dialog" id="promoDialog" hidden>
  <div class="promotion-card">
    <h2 class="card-title">Promote pawn to…</h2>
    <div class="promotion-grid">
      <button class="promotion-button" data-p="q">♛ Queen</button>
      <button class="promotion-button" data-p="r">♜ Rook</button>
      <button class="promotion-button" data-p="b">♝ Bishop</button>
      <button class="promotion-button" data-p="n">♞ Knight</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<div class="analysis-loading-overlay" id="analysisLoadingOverlay" hidden>
  <div class="analysis-loading-card" role="status" aria-live="polite" aria-atomic="true">
    <h2>Analyzing game...</h2>
    <p class="analysis-loading-status" id="analysisLoadingStatus">0 / 0 moves analyzed</p>
    <div class="analysis-loading-track" aria-hidden="true">
      <div class="analysis-loading-fill" id="analysisLoadingFill"></div>
    </div>
    <p class="analysis-loading-note">Navigation is disabled until analysis is complete.</p>
  </div>
</div>
`;

// ── Element refs ───────────────────────────────────────────────────────────────
mountThemeSwitcher();

window.addEventListener("animationchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ style: "smooth" | "epic" }>;
  animationStyle = customEvent.detail.style;
});

window.addEventListener("bloodfxchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ enabled: boolean }>;
  bloodFxEnabled = customEvent.detail.enabled;
});

window.addEventListener("legalmoveschange", (event: Event) => {
  const customEvent = event as CustomEvent<{ enabled: boolean }>;
  legalMovesEnabled = customEvent.detail.enabled;
  renderBoard();
});

// ── Element refs ───────────────────────────────────────────────────────────────
const arrowLayer = q<SVGSVGElement>("#arrowLayer");
const boardEl    = q<HTMLDivElement>("#board");
const boardWrap  = q<HTMLDivElement>(".board-wrap");
const statusBar  = q<HTMLDivElement>("#statusBar");
const fenDisplay = q<HTMLTextAreaElement>("#fenDisplay");
const moveList   = q<HTMLDivElement>("#moveList");
const engineFeedback = q<HTMLDivElement>("#engineFeedback");
const turnDot    = q<HTMLDivElement>("#turnDot");
const turnLabel  = q<HTMLSpanElement>("#turnLabel");
const promoDialog= q<HTMLDivElement>("#promoDialog");
const toast      = q<HTMLDivElement>("#toast");
const analysisLoadingOverlay = q<HTMLDivElement>("#analysisLoadingOverlay");
const analysisLoadingStatus = q<HTMLParagraphElement>("#analysisLoadingStatus");
const analysisLoadingFill = q<HTMLDivElement>("#analysisLoadingFill");
const navFirst   = q<HTMLButtonElement>("#navFirst");
const navPrev    = q<HTMLButtonElement>("#navPrev");
const navNext    = q<HTMLButtonElement>("#navNext");
const navLast    = q<HTMLButtonElement>("#navLast");
const analyzeBtn = q<HTMLButtonElement>("#analyzeBtn");
const stopAnalyzeBtn = q<HTMLButtonElement>("#stopAnalyzeBtn");
const bestMovesToggleButton = q<HTMLButtonElement>("#bestMovesToggleBtn");
const returnGameLineButton = q<HTMLButtonElement>("#returnGameLineBtn");
const focusModeButton = q<HTMLButtonElement>("#focusModeBtn");

analysisLoadingOverlay.addEventListener("wheel", (event) => {
  event.preventDefault();
}, { passive: false });

analysisLoadingOverlay.addEventListener("touchmove", (event) => {
  event.preventDefault();
}, { passive: false });


// ── Button wiring ──────────────────────────────────────────────────────────────
function resetBoardStateToStart(): void {
  cancelAnalysis();
  chess.reset();
  fenHistory = [chess.fen()];
  moveHistory = [];
  cursor = 0;
  analysisByPly = [];
  clearVariationMode();
  gameLineLocked = false;
  syncGameLineFromCurrent();
  clearSelection();
}

q<HTMLButtonElement>("#resetBtn").addEventListener("click", () => {
  resetBoardStateToStart();
  render();
});

q<HTMLButtonElement>("#flipBtn").addEventListener("click", () => {
  orientation = orientation === "w" ? "b" : "w";
  renderBoard();
  renderArrows();
});

q<HTMLButtonElement>("#copyFenBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(chess.fen());
    showToast("FEN copied.");
  } catch {
    showToast("Copy failed — select the FEN text manually.");
  }
});

q<HTMLButtonElement>("#loadFenBtn").addEventListener("click", () => {
  const raw = prompt("Paste a FEN string:");
  if (!raw) return;
  try {
    resetBoardStateToStart();
    chess.load(raw.trim());
    fenHistory = [chess.fen()];
    moveHistory = [];
    cursor = 0;
    analysisByPly = [];
    clearVariationMode();
    syncGameLineFromCurrent();
    clearSelection();
    render();
    showToast("Position loaded.");
  } catch {
    showToast("Invalid FEN — position was not changed.");
  }
});

bestMovesToggleButton.addEventListener("click", () => {
  bestMovesEnabled = !bestMovesEnabled;
  localStorage.setItem("chess-analyze-best-moves", bestMovesEnabled ? "on" : "off");

  if (!bestMovesEnabled) {
    clearLiveBestMoveArrow();
  }

  updateBestMovesToggleButton();
  void maybeUpdateLiveBestMoveArrow(true);
  renderArrows();
});

returnGameLineButton.addEventListener("click", () => {
  returnToGameLine();
});

analyzeBtn.addEventListener("click", () => {
  void runGameAnalysis();
});

stopAnalyzeBtn.addEventListener("click", () => {
  if (!fullAnalysisInProgress) return;
  cancelAnalysis();
  showToast("Analysis stopped.");
  renderSide();
});

focusModeButton.addEventListener("click", () => {
  void toggleFocusMode();
});

window.addEventListener("keydown", (event) => {
  if (isTypingTarget(event.target)) return;

  if (event.key === "ArrowLeft") {
    if (fullAnalysisInProgress) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    goTo(cursor - 1);
  } else if (event.key === "ArrowRight") {
    if (fullAnalysisInProgress) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    goTo(cursor + 1);
  } else if (event.key.toLowerCase() === "z") {
    event.preventDefault();
    void toggleFocusMode();
  }
});

// Navigation
navFirst.addEventListener("click", () => goTo(0));
navPrev.addEventListener("click",  () => goTo(cursor - 1));
navNext.addEventListener("click",  () => goTo(cursor + 1));
navLast.addEventListener("click",  () => goTo(fenHistory.length - 1));

function goTo(index: number): void {
  if (fullAnalysisInProgress) {
    return;
  }

  const previousCursor = cursor;
  const clamped = Math.max(0, Math.min(fenHistory.length - 1, index));
  if (clamped === cursor) return;
  cursor = clamped;
  chess.load(fenHistory[cursor]!);

  const traversedMove =
    cursor > previousCursor
      ? moveHistory[cursor - 1]
      : moveHistory[previousCursor - 1];

  if (chess.isCheckmate() || chess.isStalemate() || chess.isDraw()) {
    playSound("gameEndOrCheckmate");
  } else {
    let specialSoundPlayed = false;

    if (chess.isCheck()) {
      playSound("checkMove");
      specialSoundPlayed = true;
    }

    if (traversedMove?.captured) {
      playSound("capture");
      specialSoundPlayed = true;
    }

    if ((traversedMove?.flags.includes("k") || traversedMove?.flags.includes("q")) && !specialSoundPlayed) {
      playSound("castle");
      specialSoundPlayed = true;
    }

    if (!specialSoundPlayed) {
      playSound("move-self");
    }
  }

  clearSelection();
  render();
}

// Board clicks
boardEl.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".square");
  const sq  = btn?.dataset.square as Square | undefined;
  if (
    sq &&
    suppressClickSquare === sq &&
    performance.now() <= suppressClickUntil
  ) {
    suppressClickSquare = null;
    suppressClickUntil = 0;
    return;
  }

  suppressClickSquare = null;
  suppressClickUntil = 0;
  if (sq) {
    clearArrows();
    onSquareClick(sq);
  }
});

boardEl.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

// ── Pointer drag ───────────────────────────────────────────────────────────────
let ptrDragFrom: Square | null = null;
let ptrDragNode: HTMLElement | null = null;
let ptrDragMoved = false;
let ptrStartX = 0;
let ptrStartY = 0;
let arrowDragFrom: Square | null = null;
let arrowDragTo: Square | null = null;
let arrowDragPointer: { x: number; y: number } | null = null;
let arrowDragMoved = false;

boardEl.addEventListener("pointerdown", (event) => {

  if (event.button === 0 && (arrowAnnotations.size > 0 || squareAnnotations.size > 0)) {
    clearArrows();
  }
  
  if (event.button === 2) {
    const square = getSquareFromPoint(event.clientX, event.clientY);
    if (!square) return;

    arrowDragFrom = square;
    arrowDragTo = null;
    arrowDragPointer = squareCenter(square);
    arrowDragMoved = false;
    ptrStartX = event.clientX;
    ptrStartY = event.clientY;
    boardEl.setPointerCapture(event.pointerId);
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
  boardEl.setPointerCapture(event.pointerId);
});

boardEl.addEventListener("pointermove", (event) => {
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
    selectedSquare = ptrDragFrom;
    legalTargets = chess.moves({ square: ptrDragFrom, verbose: true }).map((m) => m.to);
    syncBoardInteractionState();

    const btn = boardEl.querySelector<HTMLButtonElement>(`[data-square="${ptrDragFrom}"]`);
    const piece = btn?.querySelector<HTMLElement>(".piece");
    if (piece && btn) {
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
  boardEl.querySelector<HTMLElement>(".square.dragging")?.classList.remove("dragging");

  if (!commit) return;

  const el = document.elementFromPoint(event.clientX, event.clientY);
  const squareButton = el?.closest<HTMLButtonElement>(".square");
  const targetSquare = squareButton?.dataset.square as Square | undefined;

  if (!wasDrag) {
    if (!targetSquare) return;
    // Handle tap/click here because pointer capture can swallow the native click target.
    suppressClickSquare = targetSquare;
    suppressClickUntil = performance.now() + 250;
    clearArrows();
    onSquareClick(targetSquare);
    return;
  }

  if (targetSquare) {
    suppressClickSquare = targetSquare;
    suppressClickUntil = performance.now() + 250;
    suppressAnimationForMove = { from: fromSquare, to: targetSquare };
    onSquareClick(targetSquare);
  }

  clearSelection();
  renderBoard();
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

  // NEW: Right-Click Highlight
  if (!arrowDragMoved || targetSquare === fromSquare) {
    if (squareAnnotations.has(fromSquare)) {
      squareAnnotations.delete(fromSquare);
    } else {
      squareAnnotations.add(fromSquare);
    }
    arrowDragMoved = false;
    renderBoard();
    return;
  }

  toggleArrow(fromSquare, targetSquare);
  arrowDragMoved = false;
  renderArrows();
}

boardEl.addEventListener("pointerup", (event) => {
  if (event.button === 2 || arrowDragFrom) {
    endArrowDrag(event, true);
    return;
  }

  endPointerDrag(event, true);
});

boardEl.addEventListener("pointercancel", (event) => {
  endArrowDrag(event, false);
  endPointerDrag(event, false);
});

// Promotion choice
promoDialog.addEventListener("click", (e) => {
  const clickedElement = e.target as HTMLElement;
  const clickedInsideCard = Boolean(clickedElement.closest(".promotion-card"));
  if (!clickedInsideCard) {
    pendingPromotion = null;
    promoDialog.hidden = true;
    clearSelection();
    renderBoard();
    return;
  }

  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-p]");
  if (!btn || !pendingPromotion) return;
  commitMove(pendingPromotion.from, pendingPromotion.to, btn.dataset.p as PromotionPiece);
  pendingPromotion = null;
  promoDialog.hidden = true;
});

// Move-list click (navigate to that half-move)
moveList.addEventListener("click", (e) => {
  if (fullAnalysisInProgress) {
    return;
  }

  const span = (e.target as HTMLElement).closest<HTMLSpanElement>("span[data-idx]");
  if (!span) return;
  const idx = Number(span.dataset.idx);
  goTo(idx);
});

// ── Core move logic ────────────────────────────────────────────────────────────
function onSquareClick(square: Square): void {
  if (chess.isGameOver()) return;

  const piece = chess.get(square);

  // Nothing selected yet
  if (!selectedSquare) {
    if (piece && piece.color === chess.turn()) {
      selectSquare(square);
    }
    return;
  }

  // Clicked the already-selected square → deselect
  if (square === selectedSquare) {
    clearSelection();
    renderBoard();
    return;
  }

  // Clicked a legal target → move
  if (legalTargets.includes(square)) {
    tryMoveFromTo(selectedSquare, square);
    return;
  }

  // Clicked another own piece → switch selection
  if (piece && piece.color === chess.turn()) {
    selectSquare(square);
    return;
  }

  clearSelection();
  renderBoard();
}

function commitMove(from: Square, to: Square, promotion: PromotionPiece): void {
  cancelAnalysis();
  const move = chess.move({ from, to, promotion });
  if (!move) return;

  const shouldBranchFromEarlierMove = cursor < fenHistory.length - 1;
  const shouldBranchPastGameEnd = gameLineLocked && !isVariationMode && cursor >= gameLineFenHistory.length - 1;
  
  if (shouldBranchFromEarlierMove || shouldBranchPastGameEnd) {
    const branchPly = shouldBranchFromEarlierMove
      ? cursor
      : Math.max(0, gameLineFenHistory.length - 2);
    enterVariationMode(branchPly);
  }

  // Truncate any "future" history if we somehow branched (guard, normally not needed)
  fenHistory = fenHistory.slice(0, cursor + 1);
  moveHistory = moveHistory.slice(0, cursor);
  
  moveHistory.push(move);
  fenHistory.push(chess.fen());
  
  analysisByPly = analysisByPly.slice(0, moveHistory.length);
  cursor = fenHistory.length - 1;
  
  if (!isVariationMode) {
    syncGameLineFromCurrent();
  }
  
  clearArrows();
  clearSelection();

  // Play sound based on outcome
  if (chess.isCheckmate() || chess.isStalemate() || chess.isDraw()) {
    playSound("gameEndOrCheckmate");
  } else if (chess.isCheck()) {
    playSound("checkMove");
    lastCheckFlashKey = `${cursor}:${chess.fen()}`;
    triggerCheckFlash();
    
    if (move.captured) {
      playSound("capture");
    }
  } else if (move.flags.includes("k") || move.flags.includes("q")) {
    playSound("castle");
  } else if (move.captured) {
    playSound("capture");
  } else {
    playSound("move-self");
  }

  if (bloodFxEnabled && move.captured) {
    spawnBloodSplatter(to, move.captured as PieceSymbol);
  }
  
  render();
  void analyzeLatestMove();
}

function tryMoveFromTo(from: Square, to: Square): void {
  const movingPiece = chess.get(from);
  if (movingPiece?.type === "p" && isPromotionRank(to, chess.turn())) {
    pendingPromotion = { from, to };
    promoDialog.hidden = false;
    return;
  }

  commitMove(from, to, "q");
}

function canStartMoveFrom(square: Square): boolean {
  if (chess.isGameOver()) {
    return false;
  }

  const piece = chess.get(square);
  return Boolean(piece && piece.color === chess.turn());
}

// ── Selection helpers ──────────────────────────────────────────────────────────
function selectSquare(square: Square): void {
  selectedSquare = square;
  legalTargets = chess.moves({ square, verbose: true }).map((m) => m.to);
  renderBoard();
}

function clearSelection(): void {
  selectedSquare = null;
  legalTargets = [];
}

function isPromotionRank(square: Square, color: "w" | "b"): boolean {
  return color === "w" ? square[1] === "8" : square[1] === "1";
}

// ── Render ─────────────────────────────────────────────────────────────────────
function render(): void {
  renderBoard();
  renderStatus();
  renderSide();
  renderNav();
  updateBestMovesToggleButton();
  updateVariationToolbar();
  void maybeUpdateLiveBestMoveArrow();
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("input, textarea, [contenteditable='true']"));
}

function applyFocusMode(): void {
  document.body.classList.toggle("focus-mode", focusMode);
  document.body.classList.toggle("focus-analyze", focusMode);
  focusModeButton.setAttribute("aria-pressed", String(focusMode));
  focusModeButton.textContent = focusMode ? "Exit" : "Focus";
}

async function toggleFocusMode(force?: boolean): Promise<void> {
  const nextMode = force ?? !focusMode;
  if (nextMode === focusMode) {
    return;
  }

  focusMode = nextMode;
  applyFocusMode();
}

function renderBoard(): void {
  const squares = buildSquareList(orientation);
  const lastMove = getLastMove();
  const selectedMoveEval = cursor > 0 ? analysisByPly[cursor] : undefined;
  const selectedMoveTo = moveHistory[cursor - 1]?.to;
  const lastMoveSquares = new Set([lastMove?.from, lastMove?.to].filter(Boolean) as string[]);
  const checkedKingSquare = getCheckedKingSquare();
  const fragment = document.createDocumentFragment();

  for (const squareName of squares) {
    const sq    = squareName as Square;
    const piece = chess.get(sq);
    const btn   = document.createElement("button");
    btn.type = "button";
    btn.tabIndex = -1;
    btn.className = `square ${isLightSquare(squareName as SquareName) ? "light" : "dark"}`;
    btn.dataset.square = sq;
    btn.setAttribute("aria-label", sq);

    if (selectedSquare === sq)       btn.classList.add("selected");
    if (legalMovesEnabled && legalTargets.includes(sq))   btn.classList.add("legal");
    if (lastMoveSquares.has(sq))     btn.classList.add("last-move");
    if (checkedKingSquare === sq)    btn.classList.add("in-check");
    if (squareAnnotations.has(sq))   btn.classList.add("highlight-red");
    if (selectedMoveEval?.category === "great" && selectedMoveTo === sq) btn.classList.add("great-move-highlight");
    if (selectedMoveEval?.category === "brilliant" && selectedMoveTo === sq) btn.classList.add("brilliant-move-highlight");

    if (piece) {
      const span = document.createElement("span");
      span.className = `piece piece-${piece.type} ${piece.color === "w" ? "white" : "black"}`;
      const pieceImage = document.createElement("img");
      pieceImage.className = "piece-image";
      pieceImage.src = PIECES[`${piece.color}${piece.type}`] ?? "";
      pieceImage.alt = `${piece.color === "w" ? "White" : "Black"} ${piece.type}`;
      pieceImage.draggable = false;
      span.append(pieceImage);

      btn.append(span);

      if (selectedMoveEval && selectedMoveTo === sq) {
        const marker = document.createElement("span");
        marker.className = `piece-quality-marker ${selectedMoveEval.category}`;
        appendCategoryMarkerContent(marker, selectedMoveEval.category);
        marker.title = `${selectedMoveEval.label} (${selectedMoveEval.cpl} CPL)`;
        btn.append(marker);
      }
    }

    fragment.append(btn);
  }

  boardEl.replaceChildren(fragment);
  if (animationStyle === "epic") {
    animateLastMoveEpic(lastMove);
  } else {
    animateLastMove(lastMove);
  }

  if (
    selectedMoveEval &&
    selectedMoveTo &&
    (selectedMoveEval.category === "great" || selectedMoveEval.category === "brilliant") &&
    lastQualityCalloutCursor !== cursor
  ) {
    lastQualityCalloutCursor = cursor;
    showQualityMoveCallout(selectedMoveEval.category, selectedMoveTo);
  }

  
  renderArrows();
}

function showQualityMoveCallout(category: MoveCategory, square: Square): void {
  activeQualityCallout?.remove();
  activeQualityCallout = null;

  const center = squareCenter(square);
  const label = category === "great" ? "Great Move" : "Brilliant Move";
  const callout = document.createElement("div");
  callout.className = `move-quality-callout move-quality-callout--${category}`;
  callout.textContent = label;
  callout.style.left = `${(center.x / 800) * 100}%`;
  callout.style.top = `${(center.y / 800) * 100}%`;

  boardWrap.append(callout);
  activeQualityCallout = callout;

  const clearCallout = () => {
    if (activeQualityCallout === callout) {
      activeQualityCallout = null;
    }
    callout.remove();
  };

  callout.addEventListener("animationend", clearCallout, { once: true });
  window.setTimeout(clearCallout, 2000);
}

function syncBoardInteractionState(): void {
  for (const squareButton of boardEl.querySelectorAll<HTMLButtonElement>(".square")) {
    const square = squareButton.dataset.square as Square | undefined;
    if (!square) {
      continue;
    }

    squareButton.classList.toggle("selected", selectedSquare === square);
    squareButton.classList.toggle("legal", legalTargets.includes(square));
  }
}

function renderStatus(): void {
  let text: string;
  statusBar.className = "analyze-status";

  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "Black" : "White";
    text = `Checkmate — ${winner} wins!`;
    statusBar.classList.add("gameover");
  } else if (chess.isStalemate()) {
    text = "Stalemate — draw.";
    statusBar.classList.add("gameover");
  } else if (chess.isDraw()) {
    text = "Draw.";
    statusBar.classList.add("gameover");
  } else if (chess.isCheck()) {
    text = `${chess.turn() === "w" ? "White" : "Black"} is in check!`;
    statusBar.classList.add("check");
    const checkKey = `${cursor}:${chess.fen()}`;
    if (lastCheckFlashKey !== checkKey) {
      lastCheckFlashKey = checkKey;
      triggerCheckFlash();
    }
  } else {
    text = `${chess.turn() === "w" ? "White" : "Black"} to move.`;
    lastCheckFlashKey = null;
  }

  const withMoveCursor = cursor < fenHistory.length - 1
    ? `[Move ${cursor} of ${fenHistory.length - 1}] ${text}`
    : text;

  statusBar.textContent = isVariationMode ? `Variation — ${withMoveCursor}` : withMoveCursor;
}

function renderSide(): void {
  const isWhite = chess.turn() === "w";
  turnDot.className = `turn-dot ${isWhite ? "white" : "black"}`;
  turnLabel.textContent = isWhite ? "White" : "Black";
  fenDisplay.value = chess.fen();
  renderMoveList();
  renderEngineFeedback();
}

function renderMoveList(): void {
  const sans = moveHistory.map((move) => move.san ?? "—");

  if (sans.length === 0) {
    moveList.innerHTML = '<div class="empty-state">No moves yet.</div>';
    return;
  }

  const rows: string[] = [];
  for (let i = 0; i < sans.length; i += 2) {
    const num       = Math.floor(i / 2) + 1;
    const wIdx      = i + 1;       // fenHistory index after white's move
    const bIdx      = i + 2;       // fenHistory index after black's move
    const wActive   = cursor === wIdx ? " active-half" : "";
    const bActive   = cursor === bIdx ? " active-half" : "";
    const bSan      = sans[i + 1] ?? "";
    const whiteEval = analysisByPly[wIdx];
    const blackEval = analysisByPly[bIdx];
    const whiteBadge = whiteEval
      ? `<span class="move-quality-badge ${whiteEval.category}">${whiteEval.label}</span>`
      : "";
    const blackBadge = blackEval
      ? `<span class="move-quality-badge ${blackEval.category}">${blackEval.label}</span>`
      : "";

    rows.push(`
      <div class="analyze-move-row">
        <strong>${num}.</strong>
        <span class="${wActive}" data-idx="${wIdx}">${sans[i]}${whiteBadge}</span>
        <span class="${bActive}" data-idx="${bIdx}">${bSan}${blackBadge}</span>
      </div>`);
  }

  moveList.innerHTML = rows.join("");
  // Scroll active row into view within the container only
  const activeEl = moveList.querySelector<HTMLElement>(".active-half");
  if (activeEl) {
    const containerRect = moveList.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const relTop = elRect.top - containerRect.top + moveList.scrollTop;
    const relBottom = relTop + elRect.height;
    if (relBottom > moveList.scrollTop + moveList.clientHeight) {
      moveList.scrollTop = relBottom - moveList.clientHeight;
    } else if (relTop < moveList.scrollTop) {
      moveList.scrollTop = relTop;
    }
  }
}

function renderNav(): void {
  if (fullAnalysisInProgress) {
    navFirst.disabled = true;
    navPrev.disabled = true;
    navNext.disabled = true;
    navLast.disabled = true;
    return;
  }

  navFirst.disabled = cursor === 0;
  navPrev.disabled  = cursor === 0;
  navNext.disabled  = cursor === fenHistory.length - 1;
  navLast.disabled  = cursor === fenHistory.length - 1;
}

function updateAnalysisLoadingOverlay(): void {
  const total = Math.max(analysisProgressTotal, 0);
  const completed = Math.max(0, Math.min(analysisProgressCompleted, total || analysisProgressCompleted));
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  if (fullAnalysisInProgress) {
    stopActiveMoveAnimation();
  }

  analysisLoadingStatus.textContent = `${completed} / ${total} moves analyzed (${percent}%)`;
  analysisLoadingFill.style.width = `${percent}%`;
  analysisLoadingOverlay.hidden = !fullAnalysisInProgress;
  document.body.classList.toggle("analysis-loading-active", fullAnalysisInProgress);
}

function stopActiveMoveAnimation(): void {
  if (activeGhostAnimation) {
    activeGhostAnimation.cancel();
    activeGhostAnimation = null;
  }

  if (activeGhostNode) {
    activeGhostNode.remove();
    activeGhostNode = null;
  }

  if (activeGhostDestinationPiece) {
    activeGhostDestinationPiece.style.visibility = "";
    activeGhostDestinationPiece = null;
  }

  pendingBoardRefresh = false;
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

function animateLastMove(lastMove: Move | undefined): void {
  if (!lastMove || cursor === 0 || fullAnalysisInProgress) {
    lastAnimatedMoveKey = null;
    return;
  }

  const moveKey = `${cursor}:${lastMove.from}:${lastMove.to}:${lastMove.san ?? ""}`;
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

  const fromSquareButton = boardEl.querySelector<HTMLButtonElement>(`[data-square="${lastMove.from}"]`);
  const toSquareButton = boardEl.querySelector<HTMLButtonElement>(`[data-square="${lastMove.to}"]`);
  const destinationPiece = toSquareButton?.querySelector<HTMLElement>(".piece");
  if (!fromSquareButton || !toSquareButton || !destinationPiece) {
    return;
  }

  stopActiveMoveAnimation();

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
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0)` },
      { transform: "translate3d(-50%, -50%, 0)" },
    ],
    { duration: SMOOTH_MOVE_DURATION_MS, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
  );

  activeGhostAnimation = animation;

  let finalized = false;
  const onEnd = () => {
    if (finalized) return;
    finalized = true;
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
  };

  animation.addEventListener("finish", onEnd);
  animation.addEventListener("cancel", onEnd);
}

function animateLastMoveEpic(lastMove: Move | undefined): void {
  if (!lastMove || cursor === 0 || fullAnalysisInProgress) {
    lastAnimatedMoveKey = null;
    return;
  }

  const moveKey = `${cursor}:${lastMove.from}:${lastMove.to}:${lastMove.san ?? ""}`;
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

  const fromSquareButton = boardEl.querySelector<HTMLButtonElement>(`[data-square="${lastMove.from}"]`);
  const toSquareButton = boardEl.querySelector<HTMLButtonElement>(`[data-square="${lastMove.to}"]`);
  const destinationPiece = toSquareButton?.querySelector<HTMLElement>(".piece");
  if (!fromSquareButton || !toSquareButton || !destinationPiece) {
    return;
  }

  stopActiveMoveAnimation();

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
    perspective: "1000px",
  });

  destinationPiece.style.visibility = "hidden";
  activeGhostNode = ghostPiece;
  activeGhostDestinationPiece = destinationPiece;
  document.body.append(ghostPiece);

  const aura = "";

  const roll = Math.random();
  let profile = "slide";
  if (roll < 0.3) profile = "smash";
  else if (roll < 0.6) profile = "spin";

  let keyframes: Keyframe[] = [];
  let duration: number = EPIC_MOVE_DURATION_MS.spin;

  if (profile === "smash") {
    duration = EPIC_MOVE_DURATION_MS.smash;
    const jump = 90 + Math.random() * 40;
    const scale = 1.25 + Math.random() * 0.15;
    const spin = (Math.random() * 15 + 10) * (Math.random() > 0.5 ? 1 : -1);

    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) scale(1)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.15}px), calc(-50% + ${-jump}px), 0) rotateZ(${spin}deg) scale(${scale})`, filter: `brightness(1.4) drop-shadow(0 40px 25px rgba(0,0,0,0.45)) ${aura}`, offset: 0.65 },
      { transform: `translate3d(-50%, calc(-50% + 8px), 0) rotateZ(${-(spin * 0.5)}deg) scale(0.92)`, filter: `brightness(1.05) drop-shadow(0 2px 4px rgba(0,0,0,0.7)) ${aura}`, offset: 0.92 },
      { transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) scale(1)", filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 1 },
    ];
  }
  else if (profile === "spin") {
    duration = EPIC_MOVE_DURATION_MS.spin;
    const jump = 40 + Math.random() * 20;
    const spinDir = Math.random() > 0.5 ? 360 : -360;

    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${-jump}px), 0) rotateZ(${spinDir * 0.6}deg)`, filter: `brightness(1.2) drop-shadow(0 15px 15px rgba(0,0,0,0.3)) ${aura}`, offset: 0.5 },
      { transform: `translate3d(-50%, -50%, 0) rotateZ(${spinDir}deg)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 1 },
    ];
  }
  else {
    duration = EPIC_MOVE_DURATION_MS.slide;
    const tilt = deltaX < 0 ? 18 : (deltaX > 0 ? -18 : 0);

    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) scale(1)`, filter: `brightness(1) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${deltaY * 0.4 - 10}px), 0) rotateZ(${tilt}deg) scale(1.05)`, filter: `brightness(1.1) drop-shadow(0 8px 10px rgba(0,0,0,0.25)) ${aura}`, offset: 0.4 },
      { transform: `translate3d(-50%, calc(-50% + 4px), 0) rotateZ(${-(tilt * 0.3)}deg) scale(0.95)`, filter: `brightness(1) drop-shadow(0 2px 2px rgba(0,0,0,0.5)) ${aura}`, offset: 0.9 },
      { transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) scale(1)", filter: `brightness(1) ${aura}`, offset: 1 },
    ];
  }

  const animation = ghostPiece.animate(keyframes, {
    duration,
    easing: profile === "slide" ? "cubic-bezier(0.1, 0.9, 0.2, 1)" : "cubic-bezier(0.22, 0.61, 0.36, 1)",
  });

  activeGhostAnimation = animation;

  let finalized = false;
  const onEnd = () => {
    if (finalized) return;
    finalized = true;
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
  };

  animation.addEventListener("finish", onEnd);
  animation.addEventListener("cancel", onEnd);
}

function requestBoardRefresh(): void {
  if (activeGhostAnimation) {
    pendingBoardRefresh = true;
    return;
  }

  renderBoard();
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
  renderBoard(); // Forces the board to clear the red backgrounds
}

function clearLiveBestMoveArrow(): void {
  bestMoveArrowToken += 1;
  liveBestMoveArrow = null;
  liveBestMoveArrowFen = null;
  liveBestMoveRequestFen = null;
}

async function maybeUpdateLiveBestMoveArrow(force = false): Promise<void> {
  if (!bestMovesEnabled) {
    return;
  }

  const currentFen = chess.fen();
  if (!force && liveBestMoveArrowFen === currentFen && liveBestMoveArrow) {
    return;
  }

  if (liveBestMoveRequestFen === currentFen) {
    return;
  }

  liveBestMoveRequestFen = currentFen;
  const token = ++bestMoveArrowToken;

  try {
    const evaluation = await ensureStockfish().evaluateFen(currentFen, Math.max(8, analysisDepth));
    if (token !== bestMoveArrowToken) {
      return;
    }

    liveBestMoveArrow = parseBestMoveArrow(evaluation.bestMove);
    liveBestMoveArrowFen = currentFen;
  } catch {
    if (token !== bestMoveArrowToken) {
      return;
    }

    liveBestMoveArrow = null;
    liveBestMoveArrowFen = currentFen;
  } finally {
    if (token === bestMoveArrowToken) {
      liveBestMoveRequestFen = null;
      renderArrows();
    }
  }
}

function getSquareFromPoint(clientX: number, clientY: number): Square | null {
  const node = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const squareButton = node?.closest<HTMLButtonElement>(".square");
  return (squareButton?.dataset.square as Square | undefined) ?? null;
}

function squareCenter(square: Square): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === "w" ? file : 7 - file;
  const row = orientation === "w" ? 7 - rank : rank;

  return {
    x: col * 100 + 50,
    y: row * 100 + 50,
  };
}

function triggerCheckFlash(): void {
  const flash = document.createElement("div");
  flash.className = "check-flash-overlay";
  document.body.append(flash);
  flash.addEventListener("animationend", () => flash.remove(), { once: true });
}

function spawnBloodSplatter(square: Square, capturedPiece: PieceSymbol): void {
  const boardWrap = boardEl.parentElement as HTMLElement | null;
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

  // Reduce drop count for performance, scale with intensity but cap
  const dropCount = Math.max(8, Math.floor((10 + Math.random() * 8) * Math.min(intensity, 1.5)));
  for (let index = 0; index < dropCount; index += 1) {
    const drop = document.createElement("span");
    drop.className = "capture-drop";
    // Randomize color for terror effect
    const red = 110 + Math.floor(Math.random() * 145);
    const green = 0 + Math.floor(Math.random() * 32);
    const blue = 0 + Math.floor(Math.random() * 18);
    const opacity = 0.82 + Math.random() * 0.18;
    const angle = Math.random() * Math.PI * 2;
    const distance = (24 + Math.random() * 48) * (0.92 + intensity * 0.22);
    const size = (6.8 + Math.random() * 12.8) * (0.92 + intensity * 0.18);
    const smear = 0.88 + Math.random() * (0.85 + intensity * 0.18);
    const stretch = 0.88 + Math.random() * 1.2;
    const trail = 0.92 + Math.random() * 1.2;
    drop.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    drop.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    drop.style.setProperty("--size", `${size}px`);
    drop.style.setProperty("--delay", `${Math.random() * 120}ms`);
    drop.style.setProperty("--smear", `${smear}`);
    drop.style.setProperty("--stretch", `${stretch}`);
    drop.style.setProperty("--trail", `${trail}`);
    drop.style.setProperty("--blood-color", `rgba(${red},${green},${blue},${opacity})`);
    splatter.append(drop);
  }

  boardWrap.append(splatter);
  // Add a blood pool effect at the capture location
  // Limit simultaneous pools for performance
  if (Math.random() > 0.52 && document.querySelectorAll('.capture-blood-pool').length < 3) {
    const pool = document.createElement("div");
    pool.className = "capture-blood-pool";
    pool.style.left = splatter.style.left;
    pool.style.top = splatter.style.top;
    const poolSize = (32 + Math.random() * 32) * (1.1 + intensity * 0.18);
    pool.style.width = `${poolSize}px`;
    pool.style.height = `${poolSize * (0.82 + Math.random() * 0.18)}px`;
    pool.style.setProperty("--pool-color", `rgba(${110 + Math.floor(Math.random() * 145)},0,0,${0.22 + Math.random() * 0.18})`);
    pool.style.setProperty("--pool-blur", `${1.8 + Math.random() * 1.8}px`);
    pool.style.setProperty("--pool-rotate", `${Math.random() * 360}deg`);
    pool.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 360}deg)`;
    boardWrap.append(pool);
    setTimeout(() => {
      pool.classList.add("capture-blood-pool-fade");
      setTimeout(() => pool.remove(), 2200 + Math.random() * 1200);
    }, 2200 + Math.random() * 1200);
  }
  // Make splatter last longer
  setTimeout(() => {
    splatter.classList.add("capture-splatter-fade");
    setTimeout(() => splatter.remove(), 3200 + Math.random() * 1800);
  }, 3200 + Math.random() * 1800);
}

function boardPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
  const rect = boardEl.getBoundingClientRect();
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

function currentBestMoveArrow(): BestMoveArrow | null {
  if (!bestMovesEnabled || liveBestMoveArrowFen !== chess.fen()) {
    return null;
  }

  return liveBestMoveArrow;
}

function updateBestMovesToggleButton(): void {
  bestMovesToggleButton.textContent = bestMovesEnabled ? "Best Moves: On" : "Best Moves: Off";
  bestMovesToggleButton.classList.toggle("best-moves-enabled", bestMovesEnabled);
}

function updateVariationToolbar(): void {
  returnGameLineButton.disabled = !isVariationMode;
}

function enterVariationMode(branchPly: number): void {
  if (!isVariationMode) {
    gameLineFenHistory = [...fenHistory];
    gameLineMoveHistory = [...moveHistory];
    gameLineAnalysisByPly = [...analysisByPly];
  }

  isVariationMode = true;
  variationBranchPly = branchPly;
  variationReturnCursor = Math.min(gameLineFenHistory.length - 1, branchPly + 1);
}

function clearVariationMode(): void {
  isVariationMode = false;
  variationBranchPly = null;
  variationReturnCursor = 0;
}

function syncGameLineFromCurrent(): void {
  if (isVariationMode) {
    return;
  }

  gameLineFenHistory = [...fenHistory];
  gameLineMoveHistory = [...moveHistory];
  gameLineAnalysisByPly = [...analysisByPly];
}

function returnToGameLine(): void {
  if (!isVariationMode) {
    return;
  }

  const returnMoveNo = Math.max(0, Math.min(variationReturnCursor, gameLineFenHistory.length - 1));
  fenHistory = [...gameLineFenHistory];
  moveHistory = [...gameLineMoveHistory];
  analysisByPly = [...gameLineAnalysisByPly];
  cursor = Math.max(0, Math.min(variationReturnCursor, fenHistory.length - 1));
  chess.load(fenHistory[cursor]!);
  clearVariationMode();
  clearSelection();
  clearArrows();
  render();
  showToast(`Returned to game line (move ${returnMoveNo}).`);
}

function renderArrows(): void {
  arrowLayer.innerHTML = buildArrowLayerMarkup({
    variant: "analyze",
    annotations: arrowAnnotations,
    preview: arrowDragFrom && arrowDragPointer
      ? { from: arrowDragFrom, pointer: arrowDragPointer }
      : null,
    bestMove: currentBestMoveArrow(),
    squareCenter,
  });
}

async function runGameAnalysis(): Promise<void> {
  if (analysisInProgress) {
    showToast("Analysis is already running.");
    return;
  }

  if (moveHistory.length === 0) {
    showToast("Play or load moves first.");
    return;
  }

  analysisRunId += 1;
  const runId = analysisRunId;
  analysisInProgress = true;
  fullAnalysisInProgress = true;
  stopActiveMoveAnimation();
  analysisProgressCompleted = 0;
  analysisProgressTotal = moveHistory.length;
  updateAnalysisLoadingOverlay();
  renderSide();
  renderNav();

  try {
    const engine = ensureStockfish();

    for (let ply = 1; ply <= moveHistory.length; ply += 1) {
      if (runId !== analysisRunId) {
        return;
      }

      const beforeFen = fenHistory[ply - 1]!;
      const afterFen = fenHistory[ply]!;
      const move = moveHistory[ply - 1]!;

      const before = await engine.evaluateFen(beforeFen, analysisDepth);
      if (runId !== analysisRunId) {
        return;
      }

      const after = await engine.evaluateFen(afterFen, analysisDepth);
      if (runId !== analysisRunId) {
        return;
      }

      analysisByPly[ply] = await classifyMove(ply, move, before, after, beforeFen, afterFen, engine);
      analysisProgressCompleted = ply;
      updateAnalysisLoadingOverlay();
      if (cursor === ply) {
        requestBoardRefresh();
      }
      renderSide();
    }

    showToast("Analysis complete.");
    if (!isVariationMode) {
      syncGameLineFromCurrent();
    }
  } catch {
    showToast("Engine failed to analyze this game.");
  } finally {
    if (runId === analysisRunId) {
      analysisInProgress = false;
      fullAnalysisInProgress = false;
      updateAnalysisLoadingOverlay();
      renderSide();
      renderNav();
    }
  }
}

async function analyzeLatestMove(): Promise<void> {
  const ply = moveHistory.length;
  if (ply <= 0) {
    return;
  }

  if (analysisByPly[ply]) {
    return;
  }

  analysisRunId += 1;
  const runId = analysisRunId;
  analysisInProgress = true;
  renderSide();

  try {
    const engine = ensureStockfish();
    const beforeFen = fenHistory[ply - 1]!;
    const afterFen = fenHistory[ply]!;
    const move = moveHistory[ply - 1]!;

    const before = await engine.evaluateFen(beforeFen, analysisDepth);
    if (runId !== analysisRunId) {
      return;
    }

    const after = await engine.evaluateFen(afterFen, analysisDepth);
    if (runId !== analysisRunId) {
      return;
    }

    analysisByPly[ply] = await classifyMove(ply, move, before, after, beforeFen, afterFen, engine);
    if (!isVariationMode) {
      syncGameLineFromCurrent();
    }
    if (cursor === ply) {
      requestBoardRefresh();
    }
  } catch {
    // Keep auto-analysis silent to avoid interrupting play.
  } finally {
    if (runId === analysisRunId) {
      analysisInProgress = false;
      renderSide();
    }
  }
}

function ensureStockfish(): StockfishBridge {
  if (!stockfish) {
    stockfish = new StockfishBridge();
  }

  return stockfish;
}

function cancelAnalysis(): void {
  analysisRunId += 1;
  analysisInProgress = false;
  fullAnalysisInProgress = false;
  analysisProgressCompleted = 0;
  analysisProgressTotal = 0;
  updateAnalysisLoadingOverlay();
  renderNav();
}

async function classifyMove(
  ply: number,
  move: Move,
  before: EngineEval,
  after: EngineEval,
  beforeFen: string,
  afterFen: string,
  engine: StockfishBridge,
): Promise<MoveAnalysis> {
  const playedMove = toUci(move);
  const beforeMoverCp = before.cp;
  const afterMoverCp = -after.cp;
  const cpl = Math.max(0, Math.round(beforeMoverCp - afterMoverCp));
  const matchesBest = before.bestMove.startsWith(playedMove);
  const moverColor = (beforeFen.split(" ")[1] as "w" | "b") || "w";
  const materialBefore = materialFromPerspective(beforeFen, moverColor);
  const materialAfter = materialFromPerspective(afterFen, moverColor);
  const materialDelta = materialAfter - materialBefore;
  const evalGain = Math.round(afterMoverCp - beforeMoverCp);
  const previousOpponentCategory = ply > 1 ? analysisByPly[ply - 1]?.category : undefined;
  const brilliantOffer = await verifyBrilliantOffer({
    engine,
    move,
    beforeFen,
    afterFen,
    beforeMoverCp,
    afterMoverCp,
    cpl,
    matchesBest,
    materialDelta,
  });

  const quality = classifyMoveQuality({
    cpl,
    matchesBest,
    materialDelta,
    evalGain,
    isCapture: Boolean(move.captured),
    previousOpponentCategory,
    brilliantOffer: brilliantOffer.brilliantOffer,
  });

  const note = buildMoveNote(quality.category, cpl, before, playedMove, move, materialDelta, evalGain, brilliantOffer.note);

  return {
    ply,
    label: quality.label,
    category: quality.category,
    cpl,
    playedMove,
    bestMove: before.bestMove,
    note,
    beforeCp: Math.round(beforeMoverCp),
    afterCp: Math.round(afterMoverCp),
  };
}

function classifyMoveQuality(input: {
  cpl: number;
  matchesBest: boolean;
  materialDelta: number;
  evalGain: number;
  isCapture: boolean;
  previousOpponentCategory: MoveCategory | undefined;
  brilliantOffer: boolean;
}): QualityResult {
  const {
    cpl,
    matchesBest,
    materialDelta,
    evalGain,
    isCapture,
    previousOpponentCategory,
    brilliantOffer,
  } = input;

  const opponentBlundered = previousOpponentCategory === "mistake" || previousOpponentCategory === "blunder";
  const isSacrifice = materialDelta <= -100;
  const brilliantSacrifice = isSacrifice && evalGain >= 80 && cpl <= 35;
  const greatPunish = matchesBest
    && cpl <= 22
    && opponentBlundered
    && (isCapture || materialDelta >= 100 || evalGain >= 110);

  if (brilliantSacrifice || brilliantOffer) {
    return { category: "brilliant", label: CATEGORY_LABELS.brilliant };
  }

  if (greatPunish) {
    return { category: "great", label: CATEGORY_LABELS.great };
  }

  if (cpl <= 45) {
    return { category: "excellent", label: CATEGORY_LABELS.excellent };
  }

  if (cpl <= 90) {
    return { category: "good", label: CATEGORY_LABELS.good };
  }

  if (cpl <= 160) {
    return { category: "inaccuracy", label: CATEGORY_LABELS.inaccuracy };
  }

  if (cpl <= 280) {
    return { category: "mistake", label: CATEGORY_LABELS.mistake };
  }

  return { category: "blunder", label: CATEGORY_LABELS.blunder };
}

function toUci(move: Move): string {
  const promotion = move.promotion ?? "";
  return `${move.from}${move.to}${promotion}`;
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

function formatCp(cp: number): string {
  if (cp >= MATE_CP - 10000) {
    return "+M";
  }

  if (cp <= -MATE_CP + 10000) {
    return "-M";
  }

  const pawns = cp / 100;
  const signed = pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
  return signed;
}

function buildMoveNote(
  category: MoveCategory,
  cpl: number,
  before: EngineEval,
  playedMove: string,
  move: Move,
  materialDelta: number,
  evalGain: number,
  brilliantOfferNote?: string,
): string {
  if (category === "brilliant") {
    if (brilliantOfferNote) {
      return brilliantOfferNote;
    }
    return `Intentional sacrifice (${materialDelta}) with strong compensation (+${Math.max(0, evalGain)} cp).`;
  }

  if (category === "great") {
    return `Best practical punishment after opponent error (${cpl} CPL).`;
  }

  if (category === "blunder") {
    return `Large drop (${cpl} CPL). Engine preferred ${before.bestMove || "another move"}.`;
  }

  if (category === "mistake") {
    return `Significant accuracy loss (${cpl} CPL). Better: ${before.bestMove || "engine alternative"}.`;
  }

  if (category === "inaccuracy") {
    return `Minor loss (${cpl} CPL). Better was ${before.bestMove || "engine line"}.`;
  }

  if (move.san.includes("+") || move.captured) {
    return "Active move that keeps practical pressure.";
  }

  return `Stable move (${cpl} CPL).`;
}

async function verifyBrilliantOffer(input: {
  engine: StockfishBridge;
  move: Move;
  beforeFen: string;
  afterFen: string;
  beforeMoverCp: number;
  afterMoverCp: number;
  cpl: number;
  matchesBest: boolean;
  materialDelta: number;
}): Promise<{ brilliantOffer: boolean; note?: string }> {
  const {
    engine,
    move,
    beforeFen,
    afterFen,
    beforeMoverCp,
    afterMoverCp,
    cpl,
    matchesBest,
    materialDelta,
  } = input;

  if (materialDelta < 0 || cpl > 35 || (!matchesBest && afterMoverCp < beforeMoverCp - 40)) {
    return { brilliantOffer: false };
  }

  const movedPieceValue = PIECE_VALUES[move.piece] ?? 0;
  if (movedPieceValue < 330) {
    return { brilliantOffer: false };
  }

  const board = new Chess(afterFen);
  const captureReplies = board.moves({ verbose: true }).filter((reply) => {
    if (reply.to !== move.to || !reply.captured) {
      return false;
    }

    const capturerValue = PIECE_VALUES[reply.piece] ?? 0;
    return capturerValue <= movedPieceValue;
  });

  if (captureReplies.length === 0) {
    return { brilliantOffer: false };
  }

  let worstReplyScore = Number.POSITIVE_INFINITY;
  const examinedReplies = captureReplies.slice(0, 3);
  for (const reply of examinedReplies) {
    const replyBoard = new Chess(afterFen);
    replyBoard.move(reply);
    const replyEval = await engine.evaluateFen(replyBoard.fen(), Math.max(BRILLIANT_VERIFICATION_DEPTH, analysisDepth + 2));
    worstReplyScore = Math.min(worstReplyScore, replyEval.cp);
  }

  const keepsAdvantage = worstReplyScore >= Math.max(150, beforeMoverCp - 90);
  if (!keepsAdvantage) {
    return { brilliantOffer: false };
  }

  const replySans = examinedReplies.map((reply) => reply.san).join(", ");
  return {
    brilliantOffer: true,
    note: `Brilliant piece offer: ${move.san} invites ${replySans}, but the deeper line still keeps a winning evaluation.`,
  };
}

function renderEngineFeedback(): void {
  stopAnalyzeBtn.hidden = !fullAnalysisInProgress;
  stopAnalyzeBtn.disabled = !fullAnalysisInProgress;
  analyzeBtn.disabled = analysisInProgress;

  if (analysisInProgress) {
    engineFeedback.innerHTML = `<p class="engine-inline">Analyzing... ${analysisByPly.filter(Boolean).length}/${moveHistory.length} moves complete.</p>`;
    return;
  }

  if (analysisByPly.filter(Boolean).length === 0) {
    engineFeedback.innerHTML = "Run analysis to get move quality feedback.";
    return;
  }

  if (cursor === 0) {
    const all = analysisByPly.filter((entry): entry is MoveAnalysis => Boolean(entry));
    
    // Separate moves by color
    const whiteMoves = all.filter(m => m.ply % 2 !== 0);
    const blackMoves = all.filter(m => m.ply % 2 === 0);

    // Accuracy Calculation Formula
   const calculateAccuracy = (moves: MoveAnalysis[]) => {
      if (moves.length === 0) return 100;
      
      const winProbability = (cp: number) => {
        // Clamp CP to prevent extreme Math.exp values
        const clampedCp = Math.max(-4000, Math.min(4000, cp));
        return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clampedCp)) - 1);
      };

      let totalAccuracy = 0;
      for (const m of moves) {
        const wpBefore = winProbability(m.beforeCp);
        const wpAfter = winProbability(m.afterCp);
        const loss = Math.max(0, wpBefore - wpAfter); // Never negative
        
        // Convert WP loss to move accuracy (Exponential curve)
        const moveAcc = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
        
        // Clamp move accuracy between 0 and 100 and add to total
        totalAccuracy += Math.max(0, Math.min(100, moveAcc));
      }
      
      return Math.round(totalAccuracy / moves.length);
    };

    const whiteAcc = calculateAccuracy(whiteMoves);
    const blackAcc = calculateAccuracy(blackMoves);

    const blunders = all.filter((item) => item.category === "blunder").length;
    const brilliants = all.filter((item) => item.category === "brilliant").length;

    engineFeedback.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(0,0,0,0.1);">
        <div style="text-align: center;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--ink);">${whiteAcc}%</div>
          <div style="font-size: 0.8rem; color: var(--muted); text-transform: uppercase;">White Accuracy</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--ink);">${blackAcc}%</div>
          <div style="font-size: 0.8rem; color: var(--muted); text-transform: uppercase;">Black Accuracy</div>
        </div>
      </div>
      <p class="engine-inline">Brilliants: <strong>${brilliants}</strong> · Blunders: <strong>${blunders}</strong></p>
      <p class="engine-inline" style="margin-top: 10px;">Select a move in the list to see detailed feedback.</p>
    `;
    return;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getLastMove(): Move | undefined {
  if (cursor === 0) return undefined;
  return moveHistory[cursor - 1];
}

function q<T extends Element>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing: ${sel}`);
  return el;
}

let toastTimer = 0;
function showToast(msg: string): void {
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function loadMovesIntoBoard(sans: string[]): boolean {
  resetBoardStateToStart();

  for (const san of sans) {
    const move = chess.move(san);
    if (!move) {
      return false;
    }

    moveHistory.push(move);
    fenHistory.push(chess.fen());
  }

  cursor = Math.max(0, fenHistory.length - 1);
  syncGameLineFromCurrent();
  gameLineLocked = true;
  return true;
}

function loadPgnIntoBoard(pgn: string): boolean {
  const normalizedPgn = pgn.trim();
  if (!normalizedPgn) {
    return false;
  }

  const replay = new Chess();
  try {
    replay.loadPgn(normalizedPgn, { strict: false });
  } catch {
    return false;
  }

  const sans = replay.history();
  if (sans.length === 0) {
    return false;
  }

  return loadMovesIntoBoard(sans);
}

window.addEventListener("beforeunload", () => {
  stockfish?.terminate();
});

// ── Init ───────────────────────────────────────────────────────────────────────
let shouldAutoAnalyzeOnInit = false;

const postGamePgn = localStorage.getItem(POST_GAME_PGN_STORAGE_KEY);
if (postGamePgn) {
  try {
    localStorage.removeItem(POST_GAME_PGN_STORAGE_KEY);
    localStorage.removeItem(POST_GAME_MOVES_STORAGE_KEY);
    shouldAutoAnalyzeOnInit = loadPgnIntoBoard(postGamePgn);
    if (!shouldAutoAnalyzeOnInit) {
      console.error("Failed to parse postGamePgn into move history");
    }
  } catch (e) {
    console.error("Failed to parse postGamePgn", e);
  }
} else {
  const postGameMovesStr = localStorage.getItem(POST_GAME_MOVES_STORAGE_KEY);
  if (postGameMovesStr) {
    try {
      const movesToLoad = JSON.parse(postGameMovesStr) as string[];
      localStorage.removeItem(POST_GAME_MOVES_STORAGE_KEY);
      shouldAutoAnalyzeOnInit = Array.isArray(movesToLoad)
        && movesToLoad.length > 0
        && loadMovesIntoBoard(movesToLoad);

      if (!shouldAutoAnalyzeOnInit) {
        console.error("Failed to parse postGameMoves into move history");
      }
    } catch (e) {
      console.error("Failed to parse postGameMoves", e);
    }
  }
}

syncGameLineFromCurrent();
render();
updateAnalysisLoadingOverlay();

if (shouldAutoAnalyzeOnInit) {
  setTimeout(() => {
    void runGameAnalysis();
  }, 100);
}
