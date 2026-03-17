import { Chess, PieceSymbol, Square } from "chess.js";
import { io } from "socket.io-client";

import { BoardOrientation, SquareName, buildSquareList, isLightSquare } from "../../engine";
import "./styles.css";

type PlayerRole = "w" | "b";
type RoomRole = PlayerRole | "spectator";
type PromotionPiece = "q" | "r" | "b" | "n";

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
};

type PendingPromotion = {
  from: Square;
  to: Square;
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
  autoJoinCode: string | null;
  suppressClickOnce: boolean;
};

const PIECES: Record<`${PlayerRole}${PieceSymbol}`, string> = {
  wp: "♟",
  wn: "♞",
  wb: "♝",
  wr: "♜",
  wq: "♛",
  wk: "♚",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

const chess = new Chess();
const socket = io();
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

const initialRoomCode = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() ?? null;

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
  autoJoinCode: initialRoomCode,
  suppressClickOnce: false,
};

app.innerHTML = `
  <div class="app-shell">
    <header class="hero">
      <section class="hero-card hero-copy">
        <p class="eyebrow">Realtime Chess Arena</p>
        <h1>One room. Two devices. One authoritative board.</h1>
        <p>
          Create a match, share the code or link, and let desktop and mobile players join the same game.
          The server validates every move so both screens stay in sync.
        </p>
        <a href="/analyze" style="display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:12px 22px;background:var(--accent-strong);color:#fffdf8;border-radius:999px;font-weight:700;text-decoration:none;box-shadow:0 10px 24px rgba(25,63,48,0.18);transition:transform 150ms ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">♟ Open Analysis Board</a>
      </section>
      <aside class="hero-card status-card">
        <div class="status-pill">
          <span class="status-dot" id="connectionDot"></span>
          <span id="connectionText">Connecting…</span>
        </div>
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
          <button class="action" id="createRoomButton" type="button">Create room</button>
          <button class="ghost" id="rematchButton" type="button">Request rematch</button>
          <button class="ghost" id="flipBoardButton" type="button">Flip board</button>
        </div>
        <div class="board-wrap">
          <div class="board" id="board"></div>
        </div>
        <div class="board-caption" id="boardCaption">
          Tap or click one of your pieces, then choose a legal destination.
        </div>
      </section>

      <aside class="panel side-panel">
        <section class="control-card">
          <h2 class="card-title">Invite or join</h2>
          <div class="control-row">
            <button class="chip" id="copyLinkButton" type="button">Copy invite link</button>
            <button class="chip" id="leaveRoomButton" type="button">Leave room</button>
          </div>
          <div class="join-grid">
            <input class="join-input" id="roomInput" maxlength="6" placeholder="Room code" />
            <button class="action" id="joinRoomButton" type="button">Join</button>
          </div>
          <div class="link-row">
            <span class="muted">Share URL</span>
            <span class="room-link" id="shareLink">Create or join a room to get a live invite link.</span>
          </div>
        </section>

        <section class="seat-card">
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

        <section class="summary-card">
          <h2 class="card-title">Game summary</h2>
          <p class="muted" id="summaryText">The server will keep this board authoritative for every device in the room.</p>
        </section>

        <section class="moves-card">
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
const roomInput = must<HTMLInputElement>("#roomInput");
const connectionDot = must<HTMLSpanElement>("#connectionDot");
const connectionText = must<HTMLSpanElement>("#connectionText");
const roomBadge = must<HTMLDivElement>("#roomBadge");
const roleBadge = must<HTMLDivElement>("#roleBadge");
const matchStatus = must<HTMLDivElement>("#matchStatus");
const boardCaption = must<HTMLDivElement>("#boardCaption");
const shareLink = must<HTMLSpanElement>("#shareLink");
const whiteSeat = must<HTMLSpanElement>("#whiteSeat");
const blackSeat = must<HTMLSpanElement>("#blackSeat");
const turnMeta = must<HTMLSpanElement>("#turnMeta");
const movesMeta = must<HTMLSpanElement>("#movesMeta");
const spectatorMeta = must<HTMLSpanElement>("#spectatorMeta");
const summaryText = must<HTMLParagraphElement>("#summaryText");
const moveList = must<HTMLDivElement>("#moveList");
const toast = must<HTMLDivElement>("#toast");
const promotionDialog = must<HTMLDivElement>("#promotionDialog");
const createRoomButton = must<HTMLButtonElement>("#createRoomButton");
const joinRoomButton = must<HTMLButtonElement>("#joinRoomButton");
const copyLinkButton = must<HTMLButtonElement>("#copyLinkButton");
const leaveRoomButton = must<HTMLButtonElement>("#leaveRoomButton");
const flipBoardButton = must<HTMLButtonElement>("#flipBoardButton");
const rematchButton = must<HTMLButtonElement>("#rematchButton");

createRoomButton.addEventListener("click", () => {
  socket.emit("room:create");
});

joinRoomButton.addEventListener("click", () => {
  const code = roomInput.value.trim().toUpperCase();
  if (!code) {
    showToast("Enter a room code first.");
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
  renderBoard();
  updateCaption();
});

rematchButton.addEventListener("click", () => {
  if (!state.roomId) {
    showToast("Join a room first.");
    return;
  }

  socket.emit("game:rematch");
});

board.addEventListener("click", (event) => {
  if (state.suppressClickOnce) {
    state.suppressClickOnce = false;
    return;
  }

  const squareButton = (event.target as HTMLElement).closest<HTMLButtonElement>(".square");
  const square = squareButton?.dataset.square as Square | undefined;
  if (!square) {
    return;
  }

  onSquarePressed(square);
});

// ── Pointer drag ───────────────────────────────────────────────────────────────
let ptrDragFrom: Square | null = null;
let ptrDragNode: HTMLElement | null = null;
let ptrDragMoved = false;
let ptrStartX = 0;
let ptrStartY = 0;

board.addEventListener("pointerdown", (event) => {
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
  board.querySelector<HTMLElement>(".square.dragging")?.classList.remove("dragging");

  if (!wasDrag) return;

  state.suppressClickOnce = true;

  if (commit) {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const squareButton = el?.closest<HTMLButtonElement>(".square");
    const targetSquare = squareButton?.dataset.square as Square | undefined;
    if (targetSquare && targetSquare !== fromSquare) {
      tryMoveFromTo(fromSquare, targetSquare);
    }
  }

  clearSelection();
  renderBoard();
  updateCaption();
}

board.addEventListener("pointerup", (event) => endPointerDrag(event, true));
board.addEventListener("pointercancel", (event) => endPointerDrag(event, false));

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
  state.pendingPromotion = null;
  promotionDialog.hidden = true;
});

socket.on("connect", () => {
  state.connected = true;
  renderConnection();

  if (state.autoJoinCode) {
    socket.emit("room:join", { roomId: state.autoJoinCode });
    state.autoJoinCode = null;
  }
});

socket.on("disconnect", () => {
  state.connected = false;
  renderConnection();
});

socket.on("connection:status", () => {
  state.connected = true;
  renderConnection();
});

socket.on("session:joined", (payload: { roomId: string; role: RoomRole; shareUrl: string }) => {
  state.roomId = payload.roomId;
  state.role = payload.role;
  state.shareUrl = payload.shareUrl || `${window.location.origin}/?room=${payload.roomId}`;
  roomInput.value = payload.roomId;

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
  state.snapshot = snapshot;
  chess.load(snapshot.fen);

  if (state.selectedSquare) {
    const currentPiece = chess.get(state.selectedSquare);
    if (!currentPiece || !isOwnPiece(currentPiece.color)) {
      clearSelection();
    } else {
      state.legalTargets = legalTargetsFor(state.selectedSquare);
    }
  }

  render();
});

socket.on("room:error", (payload: { message: string }) => {
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
  renderConnection();
  renderBoard();
  renderSession();
  renderMoves();
  updateCaption();
}

function renderConnection(): void {
  connectionDot.classList.toggle("live", state.connected);
  connectionText.textContent = state.connected ? "Socket connected" : "Disconnected";
}

function renderSession(): void {
  const snapshot = state.snapshot;

  roomBadge.textContent = state.roomId ? `Room ${state.roomId}` : "No active room";
  roleBadge.textContent = humanRole(state.role);
  shareLink.textContent = state.shareUrl || "Create or join a room to get a live invite link.";

  if (!snapshot) {
    matchStatus.textContent = "Create a room to start.";
    whiteSeat.textContent = "Waiting for player";
    blackSeat.textContent = "Waiting for player";
    turnMeta.textContent = "White";
    movesMeta.textContent = "0";
    spectatorMeta.textContent = "0";
    summaryText.textContent = "The server will keep this board authoritative for every device in the room.";
    return;
  }

  matchStatus.textContent = snapshot.status;
  whiteSeat.textContent = snapshot.players.whiteConnected ? seatLabel("w") : "Waiting for player";
  blackSeat.textContent = snapshot.players.blackConnected ? seatLabel("b") : "Waiting for player";
  turnMeta.textContent = snapshot.turn === "w" ? "White" : "Black";
  movesMeta.textContent = String(snapshot.moveCount);
  spectatorMeta.textContent = String(snapshot.players.spectatorCount);

  const roleDescription = state.role === "spectator"
    ? "You are watching live and can still flip the board orientation."
    : state.role
      ? `You are playing ${state.role === "w" ? "White" : "Black"}.`
      : "You are not seated in this room yet.";
  const lastMoveDescription = snapshot.lastMove
    ? ` Last move: ${snapshot.lastMove.san} (${snapshot.lastMove.from} to ${snapshot.lastMove.to}).`
    : "";
  const rematchDescription = snapshot.rematchVotes > 0 ? ` Rematch votes: ${snapshot.rematchVotes}/2.` : "";

  summaryText.textContent = `${roleDescription} ${snapshot.status}${lastMoveDescription}${rematchDescription}`.trim();
}

function renderBoard(): void {
  const fragment = document.createDocumentFragment();
  const squares = buildSquareList(state.orientation);
  const lastMoveSquares = new Set<string>();

  if (state.snapshot?.lastMove) {
    lastMoveSquares.add(state.snapshot.lastMove.from);
    lastMoveSquares.add(state.snapshot.lastMove.to);
  }

  for (const squareName of squares) {
    const square = squareName as Square;
    const piece = chess.get(square);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `square ${isLightSquare(squareName) ? "light" : "dark"}`;
    button.dataset.square = squareName;
    button.setAttribute("aria-label", squareName);

    if (state.selectedSquare === square) {
      button.classList.add("selected");
    }

    if (state.legalTargets.includes(square)) {
      button.classList.add("legal");
    }

    if (lastMoveSquares.has(squareName)) {
      button.classList.add("last-move");
    }

    if (piece) {
      const glyph = PIECES[`${piece.color}${piece.type}`];
      const pieceElement = document.createElement("span");
      pieceElement.className = `piece ${piece.color === "w" ? "white" : "black"}`;
      pieceElement.textContent = glyph;

      button.append(pieceElement);
    }

    fragment.append(button);
  }

  board.replaceChildren(fragment);
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
    const moveNumber = Math.floor(index / 2) + 1;

    rows.push(`
      <div class="move-row">
        <strong>${moveNumber}.</strong>
        <span>${whiteMove ? whiteMove.san : ""}</span>
        <span>${blackMove ? blackMove.san : ""}</span>
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
    boardCaption.textContent = `Waiting for ${state.snapshot.turn === "w" ? "White" : "Black"} to move.`;
    return;
  }

  boardCaption.textContent = state.selectedSquare
    ? `Selected ${state.selectedSquare}. Choose one of the highlighted targets.`
    : `Your move as ${state.role === "w" ? "White" : "Black"}.`;
}

function onSquarePressed(square: Square): void {
  if (!state.snapshot || !state.role || state.role === "spectator") {
    return;
  }

  if (state.snapshot.turn !== state.role) {
    showToast("Wait for your turn.");
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
    renderBoard();
    updateCaption();
    return;
  }

  if (state.legalTargets.includes(square)) {
    tryMoveFromTo(state.selectedSquare, square);
    clearSelection();
    renderBoard();
    updateCaption();
    return;
  }

  if (clickedPiece && isOwnPiece(clickedPiece.color)) {
    selectSquare(square);
    return;
  }

  clearSelection();
  renderBoard();
  updateCaption();
}

function selectSquare(square: Square): void {
  state.selectedSquare = square;
  state.legalTargets = legalTargetsFor(square);
  renderBoard();
  updateCaption();
}

function clearSelection(): void {
  state.selectedSquare = null;
  state.legalTargets = [];
}

function legalTargetsFor(square: Square): Square[] {
  return chess.moves({ square, verbose: true }).map((move) => move.to);
}

function canStartMoveFrom(square: Square): boolean {
  if (!state.snapshot || !state.role || state.role === "spectator") {
    return false;
  }

  if (state.snapshot.turn !== state.role) {
    return false;
  }

  const piece = chess.get(square);
  return Boolean(piece && isOwnPiece(piece.color));
}

function tryMoveFromTo(from: Square, to: Square): void {
  if (!state.role || state.role === "spectator") {
    return;
  }

  const selectedPiece = chess.get(from);
  if (selectedPiece?.type === "p" && reachesPromotionRank(to, state.role)) {
    state.pendingPromotion = { from, to };
    promotionDialog.hidden = false;
    return;
  }

  socket.emit("game:move", { from, to });
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
  clearSelection();
  chess.reset();
  syncUrl(null);
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