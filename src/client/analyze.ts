import { Chess, Square, Move } from "chess.js";
import { buildSquareList, isLightSquare, SquareName, BoardOrientation } from "../../engine";
import "./analyze.css";

type PromotionPiece = "q" | "r" | "b" | "n";

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
const arrowLayer = q<SVGSVGElement>("#arrowLayer");
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
  const move = chess.move({ from, to, promotion });
  if (!move) return;
  // Truncate any "future" history if we somehow branched (guard, normally not needed)
  fenHistory = fenHistory.slice(0, cursor + 1);
  moveHistory = moveHistory.slice(0, cursor);
  moveHistory.push(move);
  fenHistory.push(chess.fen());
  cursor = fenHistory.length - 1;
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
    }
  });

  animation.addEventListener("cancel", () => {
    ghostPiece.remove();
    destinationPiece.style.visibility = "";
    if (activeGhostAnimation === animation) {
      activeGhostAnimation = null;
      activeGhostNode = null;
      activeGhostDestinationPiece = null;
    }
  });
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
  const defs = `
    <defs>
      <marker id="arrow-head-red" viewBox="0 0 10 10" refX="8.2" refY="5" markerWidth="6.35" markerHeight="6.35" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 L 2.4 5 Z" fill="#db3434"></path>
      </marker>
    </defs>
  `;

  const arrows = [...arrowAnnotations]
    .map((entry) => {
      const [from, to] = entry.split("-") as [Square, Square];
      const start = squareCenter(from);
      const end = squareCenter(to);
      return `<line class="analyze-arrow" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#db3434" stroke-width="12" stroke-linecap="round" marker-end="url(#arrow-head-red)"/>`;
    })
    .join("");

  const previewArrow = arrowDragFrom && arrowDragPointer
    ? (() => {
        const start = squareCenter(arrowDragFrom);
        const end = arrowDragPointer;
        return `<line class="analyze-arrow analyze-arrow-preview" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#eb4c4c" stroke-width="12" stroke-linecap="round" marker-end="url(#arrow-head-red)"/>`;
      })()
    : "";

  arrowLayer.innerHTML = `${defs}${arrows}${previewArrow}`;
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
