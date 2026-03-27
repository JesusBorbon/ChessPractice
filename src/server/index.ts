import path from "node:path";
import { createServer } from "node:http";

import express from "express";
import { Chess, Move, Square } from "chess.js";
import { Server } from "socket.io";

type PlayerRole = "w" | "b";
type RoomRole = PlayerRole | "spectator";

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

type GameRoom = {
  id: string;
  chess: Chess;
  white?: string;
  black?: string;
  winner?: PlayerRole | null;      
  statusOverride?: string;
  whiteDisconnectedAt?: number;
  blackDisconnectedAt?: number;
  rematchVotes: Set<string>;
  analysisVotes: Set<string>;
  analysisEnabled: boolean;
  updatedAt: number;

  isStarted: boolean;
  colorChoices: Map<string, "w" | "b">;
  readyPlayers: Set<string>;
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
  const socketCount = io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
  const playerCount = Number(Boolean(room.white)) + Number(Boolean(room.black));
  return Math.max(0, socketCount - playerCount);
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
  
  let { status, winner } = buildStatus(room.chess);

  if (room.winner) {
    winner = room.winner;
    status = room.statusOverride || status;
  }

return {
    roomId: room.id,
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
    },
    isStarted: room.isStarted,
    pregame: {
      p1Choice: room.white ? (room.colorChoices.get(room.white) || null) : null,
      p2Choice: room.black ? (room.colorChoices.get(room.black) || null) : null,
      p1Ready: room.white ? room.readyPlayers.has(room.white) : false,
      p2Ready: room.black ? room.readyPlayers.has(room.black) : false,
    }
  };
}

function emitRoomState(room: GameRoom): void {
  room.updatedAt = Date.now();
  io.to(room.id).emit("room:state", buildSnapshot(room));
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

    if (room.rematchVotes.delete(socketId)) {
      changed = true;
    }

    if (room.analysisVotes.delete(socketId)) {
      changed = true;
    }

    if (room.readyPlayers.delete(socketId)) {
      changed = true;
    }

    if (room.analysisEnabled && (!room.white || !room.black)) {
      room.analysisEnabled = false;
      room.analysisVotes.clear();
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

    if (bothDisconnected && noSpectators) {
      rooms.delete(room.id);
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
    room.white = socketId;
    return "w";
  }

  if (!room.black) {
    room.black = socketId;
    return "b";
  }

  return "spectator";
}

function getRoomForSocket(socketId: string): GameRoom | undefined {
  for (const room of rooms.values()) {
    if (room.white === socketId || room.black === socketId || io.sockets.adapter.rooms.get(room.id)?.has(socketId)) {
      return room;
    }
  }

  return undefined;
}

function getActivePlayerSockets(room: GameRoom): string[] {
  return [room.white, room.black].filter((value): value is string => Boolean(value));
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

io.on("connection", (socket) => {
  socket.emit("connection:status", { connected: true });

  socket.on("room:create", () => {
    removeFromRoom(socket.id);
const roomId = createRoomCode();
    const room: GameRoom = {
      id: roomId,
      chess: new Chess(),
      white: socket.id,
      rematchVotes: new Set(),
      analysisVotes: new Set(),
      analysisEnabled: false,
      updatedAt: Date.now(),
      isStarted: false,
      colorChoices: new Map(),
      readyPlayers: new Set(),
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

    removeFromRoom(socket.id);

    socket.join(roomId);
    
    // Intentar reconectarse si está dentro del grace period
    let role: RoomRole = "spectator";
    if (room.whiteDisconnectedAt && Date.now() - room.whiteDisconnectedAt < PLAYER_DISCONNECT_GRACE_MS) {
      role = "w";
      room.white = socket.id;
      delete room.whiteDisconnectedAt;
    } else if (room.blackDisconnectedAt && Date.now() - room.blackDisconnectedAt < PLAYER_DISCONNECT_GRACE_MS) {
      role = "b";
      room.black = socket.id;
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
    removeFromRoom(socket.id);
    socket.emit("session:left");
  });

  socket.on(
    "game:move",
    (payload?: { from?: Square; to?: Square; promotion?: "q" | "r" | "b" | "n" }) => {
      const clientState = socket.data as ClientState;
      const roomId = clientState.roomId;
      const role = clientState.role;

      if (!roomId || !role || role === "spectator") {
        socket.emit("room:error", { message: "Only seated players can move pieces." });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("room:error", { message: "The room is no longer available." });
        return;
      }

   if (room.chess.isGameOver()) {
        socket.emit("room:error", { message: "This game is already finished. Start a rematch." });
        return;
      }

      if (!room.isStarted) {
        socket.emit("room:error", { message: "The game hasn't started yet." });
        return;
      }

      if (room.chess.turn() !== role) {
        socket.emit("room:error", { message: "Wait for your turn." });
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

  socket.on("pregame:select", (payload?: { color: "w" | "b" }) => {
    if (!payload || (payload.color !== "w" && payload.color !== "b")) return;
    const room = getRoomForSocket(socket.id);
    if (!room || room.isStarted) return;

    room.colorChoices.set(socket.id, payload.color);
    room.readyPlayers.delete(socket.id); // Un-ready them if they switch colors
    emitRoomState(room);
  });

  socket.on("pregame:ready", () => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.isStarted) return;

    const choice = room.colorChoices.get(socket.id);
    if (!choice) return;

    room.readyPlayers.add(socket.id);

    if (room.white && room.black && room.readyPlayers.has(room.white) && room.readyPlayers.has(room.black)) {
      const c1 = room.colorChoices.get(room.white);
      const c2 = room.colorChoices.get(room.black);
      if (c1 && c2 && c1 !== c2) {
        room.isStarted = true;
        
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
      room.rematchVotes.clear();

    
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