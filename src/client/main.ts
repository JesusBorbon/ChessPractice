import { Chess, PieceSymbol, Square } from "chess.js";
import { io } from "socket.io-client";

import { BoardOrientation, SquareName, buildSquareList, isLightSquare } from "../../engine";
import "./styles.css";
import { mountThemeSwitcher } from "./theme";

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
  premove: Premove | null;
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
  premove: null,
  autoJoinCode: initialRoomCode,
  suppressClickOnce: false,
};

let lastAnimatedMoveKey: string | null = null;
let suppressAnimationForMove: { from: Square; to: Square } | null = null;
let activeGhostAnimation: Animation | null = null;
let activeGhostNode: HTMLElement | null = null;
let activeGhostDestinationPiece: HTMLElement | null = null;

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
        <a href="/analyze" style="display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:12px 22px;background:var(--accent-strong);color:#fffdf8;border-radius:999px;font-weight:700;text-decoration:none;box-shadow:0 10px 24px rgba(25,63,48,0.18);transition:transform 150ms ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">♟ Open Analysis Board</a>
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
          <button class="action" id="createRoomButton" type="button">Create room</button>
          <button class="ghost" id="rematchButton" type="button">Request rematch</button>
          <button class="ghost" id="flipBoardButton" type="button">Flip board</button>
        </div>
        <div class="board-wrap">
          <div class="board" id="board"></div>
          <svg class="board-arrows" id="arrowLayer" viewBox="0 0 800 800" aria-hidden="true"></svg>
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

mountThemeSwitcher();

const joinRoomButton = must<HTMLButtonElement>("#joinRoomButton");
const copyLinkButton = must<HTMLButtonElement>("#copyLinkButton");
const leaveRoomButton = must<HTMLButtonElement>("#leaveRoomButton");
const flipBoardButton = must<HTMLButtonElement>("#flipBoardButton");
const rematchButton = must<HTMLButtonElement>("#rematchButton");
const arrowLayer = must<SVGSVGElement>("#arrowLayer");
const arrowAnnotations = new Set<string>();

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

  clearArrows();
  onSquarePressed(square);
});

board.addEventListener("contextmenu", (event) => {
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
      suppressAnimationForMove = { from: fromSquare, to: targetSquare };
      tryMoveFromTo(fromSquare, targetSquare);
    }
  }

  clearSelection();
  renderBoard();
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
  state.pendingPromotion = null;
  promotionDialog.hidden = true;
});

socket.on("connect", () => {
  state.connected = true;

  if (state.autoJoinCode) {
    socket.emit("room:join", { roomId: state.autoJoinCode });
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
  state.snapshot = snapshot;
  chess.load(snapshot.fen);

  const isNewMove = _lastPlayedMoveCount !== -1 && snapshot.moveCount > _lastPlayedMoveCount;
  _lastPlayedMoveCount = snapshot.moveCount;
  if (isNewMove) playSoundForSnapshot(snapshot);

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

  if (state.role && state.role !== "spectator" && snapshot.turn === state.role && state.premove) {
    const queued = state.premove;
    state.premove = null;

    const stillLegal = legalTargetsForRole(queued.from, state.role).includes(queued.to);
    if (stillLegal && !snapshot.checkmate && !snapshot.draw) {
      socket.emit("game:move", queued.promotion ? queued : { from: queued.from, to: queued.to });
      showToast(`Premove played: ${queued.from} -> ${queued.to}`);
    } else {
      showToast("Premove canceled (position changed).");
    }
  }

  render();
});

socket.on("room:error", (payload: { message: string }) => {
  suppressAnimationForMove = null;
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
  renderBoard();
  renderSession();
  renderMoves();
  updateCaption();
  requestAnimationFrame(() => {
    if (window.scrollY !== savedScroll) {
      window.scrollTo({ top: savedScroll, behavior: "instant" });
    }
  });
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
    summaryText.textContent = "Ready to play.";
    return;
  }

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
}

function renderBoard(): void {
  const fragment = document.createDocumentFragment();
  const squares = buildSquareList(state.orientation);
  const lastMoveSquares = new Set<string>();
  const checkedKingSquare = getCheckedKingSquare();
  const lastMove = state.snapshot?.lastMove ?? null;
  const premove = state.premove;

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

    if (state.selectedSquare === square) {
      button.classList.add("selected");
    }

    if (state.legalTargets.includes(square)) {
      button.classList.add("legal");
    }

    if (lastMoveSquares.has(squareName)) {
      button.classList.add("last-move");
    }

    if (checkedKingSquare === squareName) {
      button.classList.add("in-check");
    }

    if (premove && premove.from === square) {
      button.classList.add("premove-from");
    }

    if (premove && premove.to === square) {
      button.classList.add("premove-to");
    }

    if (piece) {
      const glyph = PIECES[`${piece.color}${piece.type}`];
      const pieceElement = document.createElement("span");
      pieceElement.className = `piece piece-${piece.type} ${piece.color === "w" ? "white" : "black"}`;
      pieceElement.textContent = glyph;

      button.append(pieceElement);
    }

    fragment.append(button);
  }

  board.replaceChildren(fragment);
  animateLastMove(lastMove);
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
    boardCaption.textContent = state.premove
      ? `Premove queued: ${state.premove.from} -> ${state.premove.to}.`
      : `Waiting for ${state.snapshot.turn === "w" ? "White" : "Black"} to move. You can set one premove.`;
    return;
  }

  boardCaption.textContent = state.selectedSquare
    ? `Selected ${state.selectedSquare}. Choose one of the highlighted targets.`
    : `Your move as ${state.role === "w" ? "White" : "Black"}.`;
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

  const fromSquareButton = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.from}"]`);
  const toSquareButton = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.to}"]`);
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
    position: "fixed",
    left: `${endX}px`,
    top: `${endY}px`,
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
}

function queuePremove(from: Square, to: Square): void {
  if (!state.role || state.role === "spectator") {
    return;
  }

  const legalTargets = legalTargetsForRole(from, state.role);
  if (!legalTargets.includes(to)) {
    showToast("Invalid premove.");
    return;
  }

  const promotion = (() => {
    const selectedPiece = chess.get(from);
    if (selectedPiece?.type !== "p") {
      return undefined;
    }

    return reachesPromotionRank(to, state.role) ? "q" : undefined;
  })();

  if (state.premove && state.premove.from === from && state.premove.to === to) {
    state.premove = null;
    showToast("Premove cleared.");
  } else {
    state.premove = promotion ? { from, to, promotion } : { from, to };
    showToast(`Premove set: ${from} -> ${to}`);
  }

  clearSelection();
  renderBoard();
  updateCaption();
}

function onPremoveSquarePressed(square: Square): void {
  if (!state.role || state.role === "spectator") {
    return;
  }

  const clickedPiece = chess.get(square);
  if (!state.selectedSquare) {
    if (clickedPiece && clickedPiece.color === state.role) {
      state.selectedSquare = square;
      state.legalTargets = legalTargetsForRole(square, state.role);
      renderBoard();
      updateCaption();
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
    queuePremove(state.selectedSquare, square);
    return;
  }

  if (clickedPiece && clickedPiece.color === state.role) {
    state.selectedSquare = square;
    state.legalTargets = legalTargetsForRole(square, state.role);
    renderBoard();
    updateCaption();
    return;
  }

  clearSelection();
  renderBoard();
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
  state.premove = null;
  clearArrows();
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