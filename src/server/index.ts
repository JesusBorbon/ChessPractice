import path from "node:path";
import { createServer } from "node:http";

import express from "express";
import { Chess, Move, Square } from "chess.js";
import { Server } from "socket.io";

type PlayerRole = "w" | "b";
type RoomRole = PlayerRole | "spectator";
type TimeControlPresetId = "blitz3" | "rapid10" | "blitz3p2";

type TimeControlPreset = {
  id: TimeControlPresetId;
  label: string;
  initialMs: number;
  incrementMs: number;
};

type ClientState = {
  roomId?: string;
  role?: RoomRole;
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

type GameRoom = {
  id: string;
  chess: Chess;
  white?: string;
  black?: string;
  ownerId?: string;
  ownerDisconnectedAt?: number;
  spectators: Set<string>;
  winner?: PlayerRole | null;      
  statusOverride?: string;
  whiteDisconnectedAt?: number;
  blackDisconnectedAt?: number;
  rematchVotes: Set<string>;
  analysisVotes: Set<string>;
  labelsVotes: Set<string>;
  analysisEnabled: boolean;
  analysisLabelsOnlyEnabled: boolean;
  pendingUndoRequester?: string;
  updatedAt: number;

  isStarted: boolean;
  colorChoices: Map<string, "w" | "b">;
  readyPlayers: Set<string>;
  timeControl: TimeControlPresetId;
  clockWhiteMs: number;
  clockBlackMs: number;
  clockActive: PlayerRole | null;
  clockRunning: boolean;
  clockLastUpdatedAt: number;
};

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  // Aumentar timeouts para mantener conexiones más tiempo
  pingInterval: 25000, // Enviar ping cada 25 segundos
  pingTimeout: 60000,  // Esperar 60 segundos por pong antes de cerrar
});

const rooms = new Map<string, GameRoom>();
const ROOM_ALPHABET = "0123456789";
const ROOM_CODE_LENGTH = 4;
const ROOM_ID_PATTERN = new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`);
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;
const PLAYER_DISCONNECT_GRACE_MS = 1000 * 60 * 3; // 3 minutos para reconectarse
const LOW_TIME_THRESHOLD_MS = 20_000;

const TIME_CONTROL_PRESETS: Record<TimeControlPresetId, TimeControlPreset> = {
  blitz3: { id: "blitz3", label: "3-minute Blitz", initialMs: 3 * 60_000, incrementMs: 0 },
  rapid10: { id: "rapid10", label: "10-minute Rapid", initialMs: 10 * 60_000, incrementMs: 0 },
  blitz3p2: { id: "blitz3p2", label: "3+2 Blitz", initialMs: 3 * 60_000, incrementMs: 2_000 },
};

const projectRoot = process.cwd();
const publicDir =
  process.env.NODE_ENV === "production"
    ? path.join(projectRoot, "dist", "public")
    : path.join(projectRoot, "public");

app.use(express.static(publicDir));
app.use("/stockfish", express.static(path.join(projectRoot, "node_modules", "stockfish", "bin")));
app.get("/analyze", (_request, response) => {
  response.sendFile(path.join(publicDir, "analyze.html"));
});

app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

function createRoomCode(): string {
  let code = "";

  while (code === "" || rooms.has(code)) {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () => {
      const index = Math.floor(Math.random() * ROOM_ALPHABET.length);
      return ROOM_ALPHABET[index];
    }).join("");
  }

  return code;
}

function buildShareUrl(socketId: string, roomId: string): string {
  const socket = io.sockets.sockets.get(socketId);
  const host = socket?.handshake.headers.host;
  const forwardedProto = socket?.handshake.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto ?? (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    return `/?room=${roomId}`;
  }

  return `${protocol}://${host}/?room=${roomId}`;
}

function getSpectatorCount(roomId: string, room: GameRoom): number {
  return room.spectators.size;
}

function getTimeControlPreset(id: TimeControlPresetId): TimeControlPreset {
  return TIME_CONTROL_PRESETS[id];
}

function isTimeControlPresetId(value: unknown): value is TimeControlPresetId {
  return typeof value === "string" && value in TIME_CONTROL_PRESETS;
}

function syncActiveClock(room: GameRoom, now = Date.now()): void {
  if (!room.clockRunning || !room.clockActive || room.winner || room.chess.isGameOver()) {
    room.clockLastUpdatedAt = now;
    return;
  }

  const elapsed = Math.max(0, now - room.clockLastUpdatedAt);
  room.clockLastUpdatedAt = now;
  if (elapsed === 0) {
    return;
  }

  if (room.clockActive === "w") {
    room.clockWhiteMs = Math.max(0, room.clockWhiteMs - elapsed);
    if (room.clockWhiteMs === 0) {
      room.winner = "b";
      room.statusOverride = "White loses on time.";
      room.clockRunning = false;
      room.clockActive = null;
    }
    return;
  }

  room.clockBlackMs = Math.max(0, room.clockBlackMs - elapsed);
  if (room.clockBlackMs === 0) {
    room.winner = "w";
    room.statusOverride = "Black loses on time.";
    room.clockRunning = false;
    room.clockActive = null;
  }
}

function pauseClock(room: GameRoom, now = Date.now()): void {
  syncActiveClock(room, now);
  room.clockRunning = false;
  room.clockActive = null;
}

function startClock(room: GameRoom, now = Date.now()): void {
  if (room.winner || room.chess.isGameOver() || !room.isStarted || !room.white || !room.black) {
    room.clockRunning = false;
    room.clockActive = null;
    room.clockLastUpdatedAt = now;
    return;
  }

  room.clockRunning = true;
  room.clockActive = room.chess.turn();
  room.clockLastUpdatedAt = now;
}

function resetRoomClock(room: GameRoom): void {
  const preset = getTimeControlPreset(room.timeControl);
  room.clockWhiteMs = preset.initialMs;
  room.clockBlackMs = preset.initialMs;
  room.clockActive = null;
  room.clockRunning = false;
  room.clockLastUpdatedAt = Date.now();
}

function applyMoveIncrement(room: GameRoom, mover: PlayerRole): void {
  const incrementMs = getTimeControlPreset(room.timeControl).incrementMs;
  if (incrementMs <= 0) {
    return;
  }

  if (mover === "w") {
    room.clockWhiteMs += incrementMs;
    return;
  }

  room.clockBlackMs += incrementMs;
}

function buildStatus(chess: Chess): { status: string; winner: PlayerRole | null } {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "b" : "w";
    return {
      status: `${winner === "w" ? "White" : "Black"} wins by checkmate.`,
      winner,
    };
  }

  if (chess.isDraw()) {
    if (chess.isStalemate()) {
      return { status: "Draw by stalemate.", winner: null };
    }

    if (chess.isInsufficientMaterial()) {
      return { status: "Draw by insufficient material.", winner: null };
    }

    if (chess.isThreefoldRepetition()) {
      return { status: "Draw by repetition.", winner: null };
    }

    return { status: "Draw by the fifty-move rule.", winner: null };
  }

  const activeColor = chess.turn() === "w" ? "White" : "Black";
  const suffix = chess.isCheck() ? " in check." : " to move.";
  return { status: `${activeColor}${suffix}`, winner: null };
}

function toMoveSummary(move: Move): MoveSummary {
  return {
    color: move.color,
    from: move.from,
    to: move.to,
    san: move.san,
    piece: move.piece,
  };
}

function buildSnapshot(room: GameRoom): RoomSnapshot {
  const verboseHistory = room.chess.history({ verbose: true }).map(toMoveSummary);
  const now = Date.now();
  const preset = getTimeControlPreset(room.timeControl);
  const analysisLocked = isLiveCompetitiveMatch(room);
  const undoRequesterRole = room.pendingUndoRequester === room.white
    ? "w"
    : room.pendingUndoRequester === room.black
      ? "b"
      : null;
  
  let { status, winner } = buildStatus(room.chess);

  if (room.winner) {
    winner = room.winner;
    status = room.statusOverride || status;
  }

return {
    roomId: room.id,
  ownerId: room.ownerId ?? null,
    fen: room.chess.fen(),
    turn: room.chess.turn(),
    status,
    winner,
    check: room.chess.isCheck(),
    checkmate: room.chess.isCheckmate(),
    draw: room.chess.isDraw(),
    moveCount: verboseHistory.length,
    moves: verboseHistory,
    lastMove: verboseHistory.at(-1) ?? null,
    players: {
      whiteConnected: Boolean(room.white),
      blackConnected: Boolean(room.black),
      spectatorCount: getSpectatorCount(room.id, room),
    },
    rematchVotes: room.rematchVotes.size,
    analysis: {
      enabled: room.analysisEnabled,
      votes: room.analysisVotes.size,
      locked: analysisLocked,
      labelsOnly: room.analysisLabelsOnlyEnabled,
      labelsVotes: room.labelsVotes.size,
    },
    undo: {
      pending: Boolean(room.pendingUndoRequester),
      requester: undoRequesterRole,
    },
    isStarted: room.isStarted,
    pregame: {
      p1Choice: room.white ? (room.colorChoices.get(room.white) || null) : null,
      p2Choice: room.black ? (room.colorChoices.get(room.black) || null) : null,
      p1Ready: room.white ? room.readyPlayers.has(room.white) : false,
      p2Ready: room.black ? room.readyPlayers.has(room.black) : false,
    },
    timeControl: preset,
    clock: {
      whiteMs: room.clockWhiteMs,
      blackMs: room.clockBlackMs,
      active: room.clockActive,
      running: room.clockRunning,
      lowTimeThresholdMs: LOW_TIME_THRESHOLD_MS,
      serverNowMs: now,
    },
  };
}

function isLiveCompetitiveMatch(room: GameRoom): boolean {
  return room.isStarted && Boolean(room.white && room.black) && !room.winner && !room.chess.isGameOver();
}

function getOpponentSocketId(room: GameRoom, socketId: string): string | null {
  if (room.white === socketId) {
    return room.black ?? null;
  }

  if (room.black === socketId) {
    return room.white ?? null;
  }

  return null;
}

function emitRoomState(room: GameRoom): void {
  syncActiveClock(room);

  if (isLiveCompetitiveMatch(room) && (room.analysisEnabled || room.analysisVotes.size > 0)) {
    room.analysisEnabled = false;
    room.analysisVotes.clear();
  }

  room.updatedAt = Date.now();
  io.to(room.id).emit("room:state", buildSnapshot(room));
}

function closeRoom(room: GameRoom): void {
  const socketsInRoom = io.sockets.adapter.rooms.get(room.id);
  if (socketsInRoom) {
    for (const socketId of socketsInRoom) {
      const memberSocket = io.sockets.sockets.get(socketId);
      if (!memberSocket) {
        continue;
      }

      memberSocket.leave(room.id);
      resetSocketState(socketId);
      memberSocket.emit("session:left");
      memberSocket.emit("room:error", { message: "Room closed because both players left." });
    }
  }

  rooms.delete(room.id);
}

function resetSocketState(socketId: string): void {
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) {
    return;
  }

  const clientState = socket.data as ClientState;
  delete clientState.roomId;
  delete clientState.role;
}

function removeFromRoom(socketId: string, immediate: boolean = false): void {
  const socket = io.sockets.sockets.get(socketId);

  for (const room of rooms.values()) {
    let changed = false;

    // Si es desconexión normal (no inmediata), marcar como "desconectado temporalmente"
    // permitiendo reconexión dentro del grace period
    if (room.white === socketId && !immediate) {
      room.whiteDisconnectedAt = Date.now();
      changed = true;
    } else if (room.white === socketId && immediate) {
      delete room.white;
      delete room.whiteDisconnectedAt;
      changed = true;
    }

    if (room.black === socketId && !immediate) {
      room.blackDisconnectedAt = Date.now();
      changed = true;
    } else if (room.black === socketId && immediate) {
      delete room.black;
      delete room.blackDisconnectedAt;
      changed = true;
    }

    if (room.ownerId === socketId && !immediate) {
      room.ownerDisconnectedAt = Date.now();
      changed = true;
    } else if (room.ownerId === socketId && immediate) {
      delete room.ownerId;
      delete room.ownerDisconnectedAt;
      changed = true;
    }

    if (room.rematchVotes.delete(socketId)) {
      changed = true;
    }

    if (room.analysisVotes.delete(socketId)) {
      changed = true;
    }

    if (room.labelsVotes.delete(socketId)) {
      changed = true;
    }

    if (room.pendingUndoRequester === socketId) {
      delete room.pendingUndoRequester;
      changed = true;
    }

    if (room.readyPlayers.delete(socketId)) {
      changed = true;
    }

    if (room.spectators.delete(socketId)) {
      changed = true;
    }

    if (room.analysisEnabled && (!room.white || !room.black)) {
      room.analysisEnabled = false;
      room.analysisVotes.clear();
      changed = true;
    }

    if (!room.white || !room.black) {
      pauseClock(room);
      changed = true;
    }

    if (!changed) {
      continue;
    }

    if (socket) {
      socket.leave(room.id);
    }

    // Solo eliminar la sala si:
    // 1. Ambos jugadores se desconectaron inmediatamente, O
    // 2. El grace period pasó para ambos jugadores
    const bothDisconnected = !room.white && !room.black;
    const noSpectators = getSpectatorCount(room.id, room) === 0;

    if (bothDisconnected && (immediate || noSpectators)) {
      closeRoom(room);
      resetSocketState(socketId);
      continue;
    }

    emitRoomState(room);
    resetSocketState(socketId);
    return;
  }
}

function assignRole(room: GameRoom, socketId: string): RoomRole {
  if (!room.white) {
    room.spectators.delete(socketId);
    room.white = socketId;
    return "w";
  }

  if (!room.black) {
    room.spectators.delete(socketId);
    room.black = socketId;
    return "b";
  }

  room.spectators.add(socketId);
  return "spectator";
}

function getRoomForSocket(socketId: string): GameRoom | undefined {
  for (const room of rooms.values()) {
    if (room.white === socketId || room.black === socketId || room.spectators.has(socketId)) {
      return room;
    }
  }

  return undefined;
}

function getActivePlayerSockets(room: GameRoom): string[] {
  return [room.white, room.black].filter((value): value is string => Boolean(value));
}

function getLiveRoomRole(room: GameRoom, socketId: string): RoomRole | null {
  if (room.white === socketId) {
    return "w";
  }

  if (room.black === socketId) {
    return "b";
  }

  if (room.spectators.has(socketId)) {
    return "spectator";
  }

  return null;
}

function isSquare(value: unknown): value is Square {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [roomId, room] of rooms.entries()) {
    let changed = false;

    // Limpiar grace periods expirados
    if (room.whiteDisconnectedAt && now - room.whiteDisconnectedAt > PLAYER_DISCONNECT_GRACE_MS) {
      delete room.white;
      delete room.whiteDisconnectedAt;
      changed = true;
    }

    if (room.blackDisconnectedAt && now - room.blackDisconnectedAt > PLAYER_DISCONNECT_GRACE_MS) {
      delete room.black;
      delete room.blackDisconnectedAt;
      changed = true;
    }

    if (room.ownerDisconnectedAt && now - room.ownerDisconnectedAt > PLAYER_DISCONNECT_GRACE_MS) {
      delete room.ownerId;
      delete room.ownerDisconnectedAt;
      changed = true;
    }

    if (!room.white || !room.black) {
      pauseClock(room, now);
      changed = true;
    }

    if (changed) {
      emitRoomState(room);
    }

    // Limpiar salas vacías después del TTL
    if (now - room.updatedAt < ROOM_TTL_MS) {
      continue;
    }

    if (getSpectatorCount(roomId, room) > 0 || room.white || room.black) {
      continue;
    }

    rooms.delete(roomId);
  }
}, 60_000);

cleanupTimer.unref();

const clockTimer = setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.isStarted || !room.clockRunning || room.winner || room.chess.isGameOver()) {
      continue;
    }

    emitRoomState(room);
  }
}, 1_000);

clockTimer.unref();

io.on("connection", (socket) => {
  socket.emit("connection:status", { connected: true });

  socket.on("room:create", () => {
    // Creating a new room is an intentional leave from any previous room.
    // Detach immediately to avoid stale seat/owner references across rooms.
    removeFromRoom(socket.id, true);
    const roomId = createRoomCode();
    const room: GameRoom = {
      id: roomId,
      chess: new Chess(),
      white: socket.id,
      ownerId: socket.id,
      spectators: new Set(),
      rematchVotes: new Set(),
      analysisVotes: new Set(),
      labelsVotes: new Set(),
      analysisEnabled: false,
      analysisLabelsOnlyEnabled: false,
      updatedAt: Date.now(),
      isStarted: false,
      colorChoices: new Map(),
      readyPlayers: new Set(),
      timeControl: "blitz3",
      clockWhiteMs: TIME_CONTROL_PRESETS.blitz3.initialMs,
      clockBlackMs: TIME_CONTROL_PRESETS.blitz3.initialMs,
      clockActive: null,
      clockRunning: false,
      clockLastUpdatedAt: Date.now(),
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    const clientState = socket.data as ClientState;
    clientState.roomId = roomId;
    clientState.role = "w";

    socket.emit("session:joined", {
      roomId,
      role: "w",
      shareUrl: buildShareUrl(socket.id, roomId),
    });

    emitRoomState(room);
  });

  socket.on("room:join", (payload?: { roomId?: string }) => {
    const roomId = payload?.roomId?.trim();
    if (!roomId) {
      socket.emit("room:error", { message: "Enter a room code first." });
      return;
    }

    if (!ROOM_ID_PATTERN.test(roomId)) {
      socket.emit("room:error", { message: "Room code must be exactly 4 digits." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: `Room ${roomId} does not exist.` });
      return;
    }

    // Joining another room is also an intentional leave from the current one.
    removeFromRoom(socket.id, true);

    socket.join(roomId);
    
    // Intentar reconectarse si está dentro del grace period
    let role: RoomRole = "spectator";
    const ownerWasWhite = room.ownerId && room.white === room.ownerId;
    const ownerWasBlack = room.ownerId && room.black === room.ownerId;

    if (room.whiteDisconnectedAt && Date.now() - room.whiteDisconnectedAt < PLAYER_DISCONNECT_GRACE_MS) {
      role = "w";
      room.white = socket.id;
      if (ownerWasWhite) {
        room.ownerId = socket.id;
        delete room.ownerDisconnectedAt;
      }
      room.spectators.delete(socket.id);
      delete room.whiteDisconnectedAt;
    } else if (room.blackDisconnectedAt && Date.now() - room.blackDisconnectedAt < PLAYER_DISCONNECT_GRACE_MS) {
      role = "b";
      room.black = socket.id;
      if (ownerWasBlack) {
        room.ownerId = socket.id;
        delete room.ownerDisconnectedAt;
      }
      room.spectators.delete(socket.id);
      delete room.blackDisconnectedAt;
    } else {
      role = assignRole(room, socket.id);
    }

    const clientState = socket.data as ClientState;
    clientState.roomId = roomId;
    clientState.role = role;

    socket.emit("session:joined", {
      roomId,
      role,
      shareUrl: buildShareUrl(socket.id, roomId),
    });

    emitRoomState(room);
  });

  socket.on("room:leave", () => {
    const room = getRoomForSocket(socket.id);
    if (!room) {
      return;
    }

    socket.leave(room.id);
    removeFromRoom(socket.id, true);
    socket.emit("session:left");
  });

  socket.on("pregame:mode", (payload?: { mode?: TimeControlPresetId }) => {
    if (!payload || !isTimeControlPresetId(payload.mode)) {
      socket.emit("room:error", { message: "Invalid game mode." });
      return;
    }

    const room = getRoomForSocket(socket.id);
    if (!room || room.isStarted) {
      return;
    }

    const liveRole = getLiveRoomRole(room, socket.id);
    if (!liveRole || liveRole === "spectator") {
      socket.emit("room:error", { message: "Only seated players can set the game mode." });
      return;
    }

    if (room.ownerId !== socket.id) {
      socket.emit("room:error", { message: "Only the room creator can change game mode." });
      return;
    }

    room.timeControl = payload.mode;
    room.readyPlayers.clear();
    resetRoomClock(room);
    emitRoomState(room);
  });

  socket.on(
    "game:move",
    (payload?: { from?: Square; to?: Square; promotion?: "q" | "r" | "b" | "n" }) => {
      const clientState = socket.data as ClientState;
      const roomId = clientState.roomId;

      if (!roomId) {
        socket.emit("room:error", { message: "Only seated players can move pieces." });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("room:error", { message: "The room is no longer available." });
        return;
      }

      const liveRole = getLiveRoomRole(room, socket.id);
      if (!liveRole || liveRole === "spectator") {
        socket.emit("room:error", { message: "Only seated players can move pieces." });
        return;
      }

      // Keep socket state aligned with authoritative room seat mapping.
      if (clientState.role !== liveRole) {
        clientState.role = liveRole;
      }

   if (room.chess.isGameOver()) {
        socket.emit("room:error", { message: "This game is already finished. Start a rematch." });
        return;
      }

      if (!room.isStarted) {
        socket.emit("room:error", { message: "The game hasn't started yet." });
        return;
      }

      if (room.chess.turn() !== liveRole) {
        socket.emit("room:error", { message: "Wait for your turn." });
        return;
      }

      syncActiveClock(room);
      if (room.winner) {
        emitRoomState(room);
        socket.emit("room:error", { message: "Time is over. The game already ended." });
        return;
      }

      const from = payload?.from;
      const to = payload?.to;
      if (!isSquare(from) || !isSquare(to)) {
        socket.emit("room:error", { message: "Invalid move payload." });
        return;
      }

      let move: Move | null = null;
      try {
        move = room.chess.move({
          from,
          to,
          promotion: payload?.promotion ?? "q",
        });
      } catch {
        socket.emit("room:error", { message: "That move is not legal." });
        return;
      }

      if (!move) {
        socket.emit("room:error", { message: "That move is not legal." });
        return;
      }

      room.rematchVotes.clear();
      room.analysisVotes.clear();
      delete room.pendingUndoRequester;
      applyMoveIncrement(room, liveRole);
      if (!room.winner && !room.chess.isGameOver() && room.isStarted && room.white && room.black) {
        room.clockActive = room.chess.turn();
        room.clockRunning = true;
        room.clockLastUpdatedAt = Date.now();
      } else {
        room.clockActive = null;
        room.clockRunning = false;
      }
      emitRoomState(room);
    },
  );

  socket.on("game:resign", () => {
    const clientState = socket.data as ClientState;
    const roomId = clientState.roomId;
    const role = clientState.role;

    if (!roomId || !role || role === "spectator") return;

    const room = rooms.get(roomId);
    if (!room || room.chess.isGameOver() || room.winner) return;

    // El ganador es el oponente del que se rinde
    room.winner = role === "w" ? "b" : "w";
    room.statusOverride = `${role === "w" ? "White" : "Black"} resigned.`;
    room.clockRunning = false;
    room.clockActive = null;
    
    emitRoomState(room);
  });

  socket.on("analysis:toggle", () => {
    const clientState = socket.data as ClientState;
    const roomId = clientState.roomId;
    const role = clientState.role;

    if (!roomId || !role || role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can toggle live analysis." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: "The room is no longer available." });
      return;
    }

    if (isLiveCompetitiveMatch(room)) {
      room.analysisEnabled = false;
      room.analysisVotes.clear();
      emitRoomState(room);
      socket.emit("room:error", { message: "Live analysis is disabled during active multiplayer games." });
      return;
    }

    const players = getActivePlayerSockets(room);
    if (players.length < 2) {
      socket.emit("room:error", { message: "Live analysis requires both players connected." });
      return;
    }

    if (room.analysisEnabled) {
      room.analysisEnabled = false;
      room.analysisVotes.clear();
      emitRoomState(room);
      return;
    }

    if (room.analysisVotes.has(socket.id)) {
      room.analysisVotes.delete(socket.id);
    } else {
      room.analysisVotes.add(socket.id);
    }

    if (players.every((playerId) => room.analysisVotes.has(playerId))) {
      room.analysisEnabled = true;
      room.analysisVotes.clear();
    }

    emitRoomState(room);
  });

  socket.on("analysis:labels:toggle", () => {
    const clientState = socket.data as ClientState;
    const roomId = clientState.roomId;
    const role = clientState.role;

    if (!roomId || !role || role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can change move labels mode." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: "The room is no longer available." });
      return;
    }

    const players = getActivePlayerSockets(room);
    if (players.length < 2) {
      socket.emit("room:error", { message: "Labels-only mode requires both players connected." });
      return;
    }

    if (room.analysisLabelsOnlyEnabled) {
      room.analysisLabelsOnlyEnabled = false;
      room.labelsVotes.clear();
      emitRoomState(room);
      return;
    }

    if (room.labelsVotes.has(socket.id)) {
      room.labelsVotes.clear();
      emitRoomState(room);
      return;
    }

    room.labelsVotes.add(socket.id);
    if (players.every((playerId) => room.labelsVotes.has(playerId))) {
      room.analysisLabelsOnlyEnabled = true;
      room.labelsVotes.clear();
    }

    emitRoomState(room);
  });

  socket.on("game:undo:request", () => {
    const clientState = socket.data as ClientState;
    const roomId = clientState.roomId;
    const role = clientState.role;

    if (!roomId || !role || role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can request an undo." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: "The room is no longer available." });
      return;
    }

    if (!room.isStarted || room.chess.isGameOver() || room.winner) {
      socket.emit("room:error", { message: "Undo is only available during an active game." });
      return;
    }

    if (room.chess.history().length === 0) {
      socket.emit("room:error", { message: "There are no moves to undo." });
      return;
    }

    if (room.pendingUndoRequester) {
      socket.emit("room:error", { message: "An undo request is already pending." });
      return;
    }

    const opponentId = getOpponentSocketId(room, socket.id);
    if (!opponentId) {
      socket.emit("room:error", { message: "Undo requires both players connected." });
      return;
    }

    room.pendingUndoRequester = socket.id;
    emitRoomState(room);
    io.to(opponentId).emit("undo:requested");
  });

  socket.on("game:undo:respond", (payload?: { accept?: boolean }) => {
    if (typeof payload?.accept !== "boolean") {
      socket.emit("room:error", { message: "Invalid undo response payload." });
      return;
    }

    const clientState = socket.data as ClientState;
    const roomId = clientState.roomId;
    const role = clientState.role;

    if (!roomId || !role || role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can respond to undo requests." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: "The room is no longer available." });
      return;
    }

    const requesterId = room.pendingUndoRequester;
    if (!requesterId) {
      socket.emit("room:error", { message: "There is no pending undo request." });
      return;
    }

    if (requesterId === socket.id) {
      socket.emit("room:error", { message: "Wait for your opponent to respond." });
      return;
    }

    const expectedResponderId = getOpponentSocketId(room, requesterId);
    if (!expectedResponderId || expectedResponderId !== socket.id) {
      socket.emit("room:error", { message: "Only your opponent can respond to this undo request." });
      return;
    }

    if (!payload.accept) {
      delete room.pendingUndoRequester;
      emitRoomState(room);
      io.to(requesterId).emit("undo:declined");
      return;
    }

    const undoneMove = room.chess.undo();
    delete room.pendingUndoRequester;

    if (!undoneMove) {
      emitRoomState(room);
      socket.emit("room:error", { message: "No move available to undo." });
      return;
    }

    room.rematchVotes.clear();
    room.analysisVotes.clear();
    room.labelsVotes.clear();
    room.analysisEnabled = false;
    delete room.winner;
    delete room.statusOverride;

    if (room.isStarted && room.white && room.black && !room.chess.isGameOver() && !room.winner) {
      room.clockActive = room.chess.turn();
      room.clockRunning = true;
      room.clockLastUpdatedAt = Date.now();
    } else {
      room.clockActive = null;
      room.clockRunning = false;
    }

    emitRoomState(room);
    io.to(requesterId).emit("undo:accepted");
  });

  socket.on("pregame:select", (payload?: { color: "w" | "b" }) => {
    if (!payload || (payload.color !== "w" && payload.color !== "b")) return;

    const clientState = socket.data as ClientState;
    if (!clientState.roomId || !clientState.role || clientState.role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can choose a color." });
      return;
    }

    const room = getRoomForSocket(socket.id);
    if (!room || room.isStarted) return;

    if (room.white !== socket.id && room.black !== socket.id) {
      socket.emit("room:error", { message: "Only seated players can choose a color." });
      return;
    }

    const opponentId = room.white === socket.id ? room.black : room.white;
    const opponentChoice = opponentId ? room.colorChoices.get(opponentId) : null;
    if (opponentChoice === payload.color) {
      socket.emit("room:error", { message: "Both players cannot select the same color." });
      return;
    }

    room.colorChoices.set(socket.id, payload.color);
    room.readyPlayers.delete(socket.id); // Un-ready them if they switch colors
    emitRoomState(room);
  });

  socket.on("pregame:ready", () => {
    const clientState = socket.data as ClientState;
    if (!clientState.roomId || !clientState.role || clientState.role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can click ready." });
      return;
    }

    const room = getRoomForSocket(socket.id);
    if (!room || room.isStarted) return;

    if (room.white !== socket.id && room.black !== socket.id) {
      socket.emit("room:error", { message: "Only seated players can click ready." });
      return;
    }

    const choice = room.colorChoices.get(socket.id);
    if (!choice) {
      socket.emit("room:error", { message: "Choose a color first." });
      return;
    }

    const opponentId = room.white === socket.id ? room.black : room.white;
    const opponentChoice = opponentId ? room.colorChoices.get(opponentId) : null;
    if (opponentChoice && opponentChoice === choice) {
      socket.emit("room:error", { message: "Both players cannot select the same color." });
      return;
    }

    room.readyPlayers.add(socket.id);

    if (room.white && room.black && room.readyPlayers.has(room.white) && room.readyPlayers.has(room.black)) {
      const c1 = room.colorChoices.get(room.white);
      const c2 = room.colorChoices.get(room.black);
      if (c1 && c2 && c1 !== c2) {
        room.isStarted = true;
        resetRoomClock(room);
        
        // If the creator actually chose black, swap their seats globally
      if (c1 === "b" && room.white && room.black) {
          const w = room.white;
          const b = room.black;
          room.white = b;
          room.black = w;

          io.sockets.sockets.get(room.white)?.emit("session:joined", { roomId: room.id, role: "w", shareUrl: buildShareUrl(room.white, room.id) });
          io.sockets.sockets.get(room.black)?.emit("session:joined", { roomId: room.id, role: "b", shareUrl: buildShareUrl(room.black, room.id) });

          const wData = io.sockets.sockets.get(room.white)?.data as ClientState | undefined;
          if (wData) wData.role = "w";
          const bData = io.sockets.sockets.get(room.black)?.data as ClientState | undefined;
          if (bData) bData.role = "b";
        }

        startClock(room);
      }
    }
    emitRoomState(room);
  });

socket.on("game:rematch", () => {
    const clientState = socket.data as ClientState;
    const roomId = clientState.roomId;
    const role = clientState.role;

    if (!roomId || !role || role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can request a rematch." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: "The room is no longer available." });
      return;
    }

    room.rematchVotes.add(socket.id);
    const players = getActivePlayerSockets(room);

    
   if (players.length === 2 && players.every((playerId) => room.rematchVotes.has(playerId))) {
      room.chess.reset();
      delete room.winner;      
      delete room.statusOverride; 
      delete room.pendingUndoRequester;
      room.rematchVotes.clear();
      resetRoomClock(room);

    
      if (room.white && room.black) {
        const w = room.white;
        const b = room.black;
        room.white = b;
        room.black = w;
      }

      if (room.white) {
        const wData = io.sockets.sockets.get(room.white)?.data as ClientState | undefined;
        if (wData) wData.role = "w";
        io.sockets.sockets.get(room.white)?.emit("session:joined", { roomId: room.id, role: "w", shareUrl: buildShareUrl(room.white, room.id) });
      }
      if (room.black) {
        const bData = io.sockets.sockets.get(room.black)?.data as ClientState | undefined;
        if (bData) bData.role = "b";
        io.sockets.sockets.get(room.black)?.emit("session:joined", { roomId: room.id, role: "b", shareUrl: buildShareUrl(room.black, room.id) });
      }

      startClock(room);
    }

    emitRoomState(room); 
  });

  socket.on("disconnect", () => {
    removeFromRoom(socket.id, false); // false = no es inmediato, aplicar grace period
  });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Realtime chess server listening on http://localhost:${port}`);
});