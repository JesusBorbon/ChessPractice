import { Chess, Square, Move } from "chess.js";
import { buildSquareList, isLightSquare, SquareName, BoardOrientation } from "../../engine";
import "./analyze.css";

type PromotionPiece = "q" | "r" | "b" | "n";

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
      </div>

      <div class="board" id="board"></div>

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
const boardEl    = q<HTMLDivElement>("#board");
const statusBar  = q<HTMLDivElement>("#statusBar");
const fenDisplay = q<HTMLTextAreaElement>("#fenDisplay");
const pgnDisplay = q<HTMLTextAreaElement>("#pgnDisplay");
const moveList   = q<HTMLDivElement>("#moveList");
const turnDot    = q<HTMLDivElement>("#turnDot");
const turnLabel  = q<HTMLSpanElement>("#turnLabel");
const promoDialog= q<HTMLDivElement>("#promoDialog");
const toast      = q<HTMLDivElement>("#toast");
const navFirst   = q<HTMLButtonElement>("#navFirst");
const navPrev    = q<HTMLButtonElement>("#navPrev");
const navNext    = q<HTMLButtonElement>("#navNext");
const navLast    = q<HTMLButtonElement>("#navLast");

// ── Button wiring ──────────────────────────────────────────────────────────────
q<HTMLButtonElement>("#resetBtn").addEventListener("click", () => {
  chess.reset();
  fenHistory = [chess.fen()];
  moveHistory = [];
  cursor = 0;
  clearSelection();
  render();
});

q<HTMLButtonElement>("#flipBtn").addEventListener("click", () => {
  orientation = orientation === "w" ? "b" : "w";
  renderBoard();
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
    chess.load(raw.trim());
    fenHistory = [chess.fen()];
    moveHistory = [];
    cursor = 0;
    clearSelection();
    render();
    showToast("Position loaded.");
  } catch {
    showToast("Invalid FEN — position was not changed.");
  }
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
  if (sq) onSquareClick(sq);
});

// ── Pointer drag ───────────────────────────────────────────────────────────────
let ptrDragFrom: Square | null = null;
let ptrDragNode: HTMLElement | null = null;
let ptrDragMoved = false;
let ptrStartX = 0;
let ptrStartY = 0;

boardEl.addEventListener("pointerdown", (event) => {
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
    onSquareClick(targetSquare);
    return;
  }

  if (targetSquare) {
    suppressClickSquare = targetSquare;
    suppressClickUntil = performance.now() + 250;
    onSquareClick(targetSquare);
  }

  clearSelection();
  renderBoard();
}

boardEl.addEventListener("pointerup", (event) => endPointerDrag(event, true));
boardEl.addEventListener("pointercancel", (event) => endPointerDrag(event, false));

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
    clearSelection();
    renderBoard();
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
  const move = chess.move({ from, to, promotion });
  if (!move) return;
  // Truncate any "future" history if we somehow branched (guard, normally not needed)
  fenHistory = fenHistory.slice(0, cursor + 1);
  moveHistory = moveHistory.slice(0, cursor);
  moveHistory.push(move);
  fenHistory.push(chess.fen());
  cursor = fenHistory.length - 1;
  render();
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
  const lastMoveSquares = new Set([lastMove?.from, lastMove?.to].filter(Boolean) as string[]);
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

    if (piece) {
      const span = document.createElement("span");
      span.className = `piece ${piece.color === "w" ? "white" : "black"}`;
      span.textContent = PIECES[`${piece.color}${piece.type}`] ?? "";

      btn.append(span);
    }

    fragment.append(btn);
  }

  boardEl.replaceChildren(fragment);
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
    rows.push(`
      <div class="analyze-move-row">
        <strong>${num}.</strong>
        <span class="${wActive}" data-idx="${wIdx}">${sans[i]}</span>
        <span class="${bActive}" data-idx="${bIdx}">${bSan}</span>
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

// ── Init ───────────────────────────────────────────────────────────────────────
render();
