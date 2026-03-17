import { Chess, Square, Move } from "chess.js";
import { buildSquareList, isLightSquare, SquareName, BoardOrientation } from "../../engine";
import "./analyze.css";
import { mountThemeSwitcher } from "./theme";

type PromotionPiece = "q" | "r" | "b" | "n";
type MoveCategory = "brilliant" | "great" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

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
  brilliant: "Brillante",
  great: "Genial",
  excellent: "Excelente",
  good: "Bueno",
  inaccuracy: "Inexactitud",
  mistake: "Error",
  blunder: "Blunder",
};

const CATEGORY_SYMBOLS: Record<MoveCategory, string> = {
  brilliant: "!!",
  great: "!",
  excellent: "★",
  good: "✓",
  inaccuracy: "?!",
  mistake: "x",
  blunder: "??",
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
  wp: "♟", wn: "♞", wb: "♝", wr: "♜", wq: "♛", wk: "♚",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
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
        <button class="btn-ghost"   id="undoBtn">Undo move</button>
        <button class="btn-ghost"   id="copyFenBtn">Copy FEN</button>
        <button class="btn-ghost"   id="loadFenBtn">Load FEN</button>
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
    </section>

    <aside class="analyze-side">
      <div class="info-card">
        <h2>Turn</h2>
        <div class="turn-indicator">
          <div class="turn-dot" id="turnDot"></div>
          <span id="turnLabel">White</span>
        </div>
      </div>

      <div class="info-card">
        <h2>FEN</h2>
        <textarea class="fen-input" id="fenDisplay" rows="3" readonly></textarea>
      </div>

      <div class="info-card">
        <h2>Moves</h2>
        <div class="analyze-move-list" id="moveList"></div>
      </div>

      <div class="info-card">
        <h2>Engine feedback</h2>
        <div class="engine-feedback" id="engineFeedback">Run analysis to get move quality feedback.</div>
      </div>

      <div class="info-card">
        <h2>PGN export</h2>
        <textarea class="pgn-export" id="pgnDisplay" rows="4" readonly></textarea>
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
`;

// ── Element refs ───────────────────────────────────────────────────────────────
mountThemeSwitcher();

// ── Element refs ───────────────────────────────────────────────────────────────
const arrowLayer = q<SVGSVGElement>("#arrowLayer");
const boardEl    = q<HTMLDivElement>("#board");
const statusBar  = q<HTMLDivElement>("#statusBar");
const fenDisplay = q<HTMLTextAreaElement>("#fenDisplay");
const pgnDisplay = q<HTMLTextAreaElement>("#pgnDisplay");
const moveList   = q<HTMLDivElement>("#moveList");
const engineFeedback = q<HTMLDivElement>("#engineFeedback");
const turnDot    = q<HTMLDivElement>("#turnDot");
const turnLabel  = q<HTMLSpanElement>("#turnLabel");
const promoDialog= q<HTMLDivElement>("#promoDialog");
const toast      = q<HTMLDivElement>("#toast");
const navFirst   = q<HTMLButtonElement>("#navFirst");
const navPrev    = q<HTMLButtonElement>("#navPrev");
const navNext    = q<HTMLButtonElement>("#navNext");
const navLast    = q<HTMLButtonElement>("#navLast");
const analyzeBtn = q<HTMLButtonElement>("#analyzeBtn");
const stopAnalyzeBtn = q<HTMLButtonElement>("#stopAnalyzeBtn");

// ── Button wiring ──────────────────────────────────────────────────────────────
q<HTMLButtonElement>("#resetBtn").addEventListener("click", () => {
  cancelAnalysis();
  chess.reset();
  fenHistory = [chess.fen()];
  moveHistory = [];
  cursor = 0;
  analysisByPly = [];
  clearSelection();
  render();
});

q<HTMLButtonElement>("#flipBtn").addEventListener("click", () => {
  orientation = orientation === "w" ? "b" : "w";
  renderBoard();
  renderArrows();
});

q<HTMLButtonElement>("#undoBtn").addEventListener("click", () => {
  // Only allowed when we are at the live end of history
  if (cursor < fenHistory.length - 1) {
    showToast("Navigate to the last move before undoing.");
    return;
  }
  if (fenHistory.length <= 1) return;
  fenHistory.pop();
  moveHistory.pop();
  cursor = fenHistory.length - 1;
  chess.load(fenHistory[cursor]!);
  analysisByPly = analysisByPly.slice(0, moveHistory.length + 1);
  clearSelection();
  render();
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
    cancelAnalysis();
    chess.load(raw.trim());
    fenHistory = [chess.fen()];
    moveHistory = [];
    cursor = 0;
    analysisByPly = [];
    clearSelection();
    render();
    showToast("Position loaded.");
  } catch {
    showToast("Invalid FEN — position was not changed.");
  }
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

// Navigation
navFirst.addEventListener("click", () => goTo(0));
navPrev.addEventListener("click",  () => goTo(cursor - 1));
navNext.addEventListener("click",  () => goTo(cursor + 1));
navLast.addEventListener("click",  () => goTo(fenHistory.length - 1));

function goTo(index: number): void {
  const clamped = Math.max(0, Math.min(fenHistory.length - 1, index));
  if (clamped === cursor) return;
  cursor = clamped;
  chess.load(fenHistory[cursor]!);
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
      const cs = window.getComputedStyle(piece);
      ptrDragNode = piece.cloneNode(true) as HTMLElement;
      Object.assign(ptrDragNode.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "9999",
        margin: "0",
        lineHeight: "1",
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
        color: cs.color,
        textShadow: cs.textShadow,
        filter: cs.filter,
        transform: "scale(1.5)",
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
  if (!targetSquare || !arrowDragMoved || targetSquare === fromSquare) {
    arrowDragMoved = false;
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
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-p]");
  if (!btn || !pendingPromotion) return;
  commitMove(pendingPromotion.from, pendingPromotion.to, btn.dataset.p as PromotionPiece);
  pendingPromotion = null;
  promoDialog.hidden = true;
});

// Move-list click (navigate to that half-move)
moveList.addEventListener("click", (e) => {
  const span = (e.target as HTMLElement).closest<HTMLSpanElement>("span[data-idx]");
  if (!span) return;
  const idx = Number(span.dataset.idx);
  goTo(idx);
});

// ── Core move logic ────────────────────────────────────────────────────────────
function onSquareClick(square: Square): void {
  // In navigation mode (not at the live end), moves are not allowed
  if (cursor < fenHistory.length - 1) {
    // Allow selecting for visual feedback but not moving
    showToast("Navigate to the last move to continue playing.");
    return;
  }

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
  // Truncate any "future" history if we somehow branched (guard, normally not needed)
  fenHistory = fenHistory.slice(0, cursor + 1);
  moveHistory = moveHistory.slice(0, cursor);
  moveHistory.push(move);
  fenHistory.push(chess.fen());
  analysisByPly = analysisByPly.slice(0, moveHistory.length);
  cursor = fenHistory.length - 1;
  clearArrows();
  clearSelection();
  // Play sound based on outcome
  if (chess.isCheckmate() || chess.isStalemate() || chess.isDraw()) {
    playSound("gameEndOrCheckmate");
  } else if (chess.isCheck()) {
    playSound("checkMove");
  } else if (move.flags.includes("k") || move.flags.includes("q")) {
    playSound("castle");
  } else if (move.captured) {
    playSound("capture");
  } else {
    playSound("move-self");
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
  if (cursor < fenHistory.length - 1 || chess.isGameOver()) {
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
    btn.className = `square ${isLightSquare(squareName as SquareName) ? "light" : "dark"}`;
    btn.dataset.square = sq;
    btn.setAttribute("aria-label", sq);

    if (selectedSquare === sq)       btn.classList.add("selected");
    if (legalTargets.includes(sq))   btn.classList.add("legal");
    if (lastMoveSquares.has(sq))     btn.classList.add("last-move");
    if (checkedKingSquare === sq)    btn.classList.add("in-check");

    if (piece) {
      const span = document.createElement("span");
      span.className = `piece ${piece.color === "w" ? "white" : "black"}`;
      span.textContent = PIECES[`${piece.color}${piece.type}`] ?? "";

      btn.append(span);

      if (selectedMoveEval && selectedMoveTo === sq) {
        const marker = document.createElement("span");
        marker.className = `piece-quality-marker ${selectedMoveEval.category}`;
        marker.textContent = CATEGORY_SYMBOLS[selectedMoveEval.category];
        marker.title = `${selectedMoveEval.label} (${selectedMoveEval.cpl} CPL)`;
        btn.append(marker);
      }
    }

    fragment.append(btn);
  }

  boardEl.replaceChildren(fragment);
  animateLastMove(lastMove);
  renderArrows();
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
  } else {
    text = `${chess.turn() === "w" ? "White" : "Black"} to move.`;
  }

  statusBar.textContent = cursor < fenHistory.length - 1
    ? `[Move ${cursor} of ${fenHistory.length - 1}] ${text}`
    : text;
}

function renderSide(): void {
  const isWhite = chess.turn() === "w";
  turnDot.className = `turn-dot ${isWhite ? "white" : "black"}`;
  turnLabel.textContent = isWhite ? "White" : "Black";
  fenDisplay.value = chess.fen();
  pgnDisplay.value = chess.pgn({ maxWidth: 60, newline: "\n" });
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
  // Scroll active row into view
  moveList.querySelector(".active-half")?.scrollIntoView({ block: "nearest" });
}

function renderNav(): void {
  navFirst.disabled = cursor === 0;
  navPrev.disabled  = cursor === 0;
  navNext.disabled  = cursor === fenHistory.length - 1;
  navLast.disabled  = cursor === fenHistory.length - 1;
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
  if (!lastMove || cursor === 0) {
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

  const fromRect = fromSquareButton.getBoundingClientRect();
  const toRect = toSquareButton.getBoundingClientRect();
  const startX = fromRect.left + fromRect.width / 2;
  const startY = fromRect.top + fromRect.height / 2;
  const endX = toRect.left + toRect.width / 2;
  const endY = toRect.top + toRect.height / 2;
  const pageX = window.scrollX;
  const pageY = window.scrollY;
  const deltaX = startX - endX;
  const deltaY = startY - endY;

  const computed = window.getComputedStyle(destinationPiece);
  const ghostPiece = destinationPiece.cloneNode(true) as HTMLElement;
  Object.assign(ghostPiece.style, {
    position: "absolute",
    left: `${endX + pageX}px`,
    top: `${endY + pageY}px`,
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
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0)`, offset: 0 },
      { transform: "translate3d(-50%, -50%, 0)", offset: 1 },
    ],
    {
      duration: 900,
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

function buildArrowPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  shaftWidth = 10,
  headLength = 46,
  headWidth = 34,
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
      return `<path class="analyze-arrow" d="${pathData}" fill="rgba(219, 52, 52, 0.72)"/>`;
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
        return `<path class="analyze-arrow analyze-arrow-preview" d="${pathData}" fill="rgba(219, 52, 52, 0.72)"/>`;
      })()
    : "";

  arrowLayer.innerHTML = `${arrows}${previewArrow}`;
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
  renderSide();

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

      analysisByPly[ply] = classifyMove(ply, move, before, after, beforeFen, afterFen);
      if (cursor === ply) {
        requestBoardRefresh();
      }
      renderSide();
    }

    showToast("Analysis complete.");
  } catch {
    showToast("Engine failed to analyze this game.");
  } finally {
    if (runId === analysisRunId) {
      analysisInProgress = false;
      fullAnalysisInProgress = false;
      renderSide();
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

    analysisByPly[ply] = classifyMove(ply, move, before, after, beforeFen, afterFen);
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
}

function classifyMove(
  ply: number,
  move: Move,
  before: EngineEval,
  after: EngineEval,
  beforeFen: string,
  afterFen: string,
): MoveAnalysis {
  const playedMove = toUci(move);
  const beforeMoverCp = before.cp;
  const afterMoverCp = -after.cp;
  const cpl = Math.max(0, Math.round(beforeMoverCp - afterMoverCp));
  const matchesBest = before.bestMove === playedMove;
  const materialDrop = materialFromPerspective(afterFen, move.color) - materialFromPerspective(beforeFen, move.color);
  const sacrificed = materialDrop <= -200;

  let category: MoveCategory;
  if (matchesBest && sacrificed && cpl <= 30) {
    category = "brilliant";
  } else if (matchesBest && cpl <= 20 && (move.captured || move.san.includes("+") || move.promotion)) {
    category = "great";
  } else if (cpl <= 20) {
    category = "excellent";
  } else if (cpl <= 70) {
    category = "good";
  } else if (cpl <= 140) {
    category = "inaccuracy";
  } else if (cpl <= 260) {
    category = "mistake";
  } else {
    category = "blunder";
  }

  const note = buildMoveNote(category, cpl, before, playedMove, move);

  return {
    ply,
    label: CATEGORY_LABELS[category],
    category,
    cpl,
    playedMove,
    bestMove: before.bestMove,
    note,
    beforeCp: Math.round(beforeMoverCp),
    afterCp: Math.round(afterMoverCp),
  };
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

function buildMoveNote(category: MoveCategory, cpl: number, before: EngineEval, playedMove: string, move: Move): string {
  if (category === "brilliant") {
    return `Sacrifice-based top engine move (${playedMove}).`;
  }

  if (category === "great") {
    return `Strong tactical best move by engine (${playedMove}).`;
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
    const avgCpl = all.length > 0 ? Math.round(all.reduce((sum, item) => sum + item.cpl, 0) / all.length) : 0;
    const blunders = all.filter((item) => item.category === "blunder").length;
    const brilliants = all.filter((item) => item.category === "brilliant").length;
    engineFeedback.innerHTML = `
      <p class="engine-inline"><strong>Game summary</strong></p>
      <p class="engine-inline">Average CPL: <strong>${avgCpl}</strong></p>
      <p class="engine-inline">Brilliants: <strong>${brilliants}</strong> · Blunders: <strong>${blunders}</strong></p>
      <p class="engine-inline">Select a move in the list to see detailed feedback.</p>
    `;
    return;
  }

  const details = analysisByPly[cursor];
  if (!details) {
    engineFeedback.innerHTML = "This move has no analysis yet.";
    return;
  }

  engineFeedback.innerHTML = `
    <p class="engine-inline"><strong>${details.label}</strong> · Move ${details.ply}</p>
    <p class="engine-inline">Played: <strong>${details.playedMove}</strong> · Best: <strong>${details.bestMove || "(none)"}</strong></p>
    <p class="engine-inline">Eval: <strong>${formatCp(details.beforeCp)}</strong> → <strong>${formatCp(details.afterCp)}</strong> (${details.cpl} CPL)</p>
    <p class="engine-inline">${details.note}</p>
  `;
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

window.addEventListener("beforeunload", () => {
  stockfish?.terminate();
});

// ── Init ───────────────────────────────────────────────────────────────────────
render();
