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
};

type GameRoom = {
  id: string;
  chess: Chess;
  white?: string;
  black?: string;
  rematchVotes: Set<string>;
  analysisVotes: Set<string>;
  analysisEnabled: boolean;
  updatedAt: number;
};

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map<string, GameRoom>();
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;

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
  const { status, winner } = buildStatus(room.chess);

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

function removeFromRoom(socketId: string): void {
  const socket = io.sockets.sockets.get(socketId);

  for (const room of rooms.values()) {
    let changed = false;

    if (room.white === socketId) {
      delete room.white;
      changed = true;
    }

    if (room.black === socketId) {
      delete room.black;
      changed = true;
    }

    if (room.rematchVotes.delete(socketId)) {
      changed = true;
    }

    if (room.analysisVotes.delete(socketId)) {
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

    socket?.leave(room.id);

    if (!room.white && !room.black && getSpectatorCount(room.id, room) === 0) {
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
    const roomId = payload?.roomId?.trim().toUpperCase();
    if (!roomId) {
      socket.emit("room:error", { message: "Enter a room code first." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: `Room ${roomId} does not exist.` });
      return;
    }

    removeFromRoom(socket.id);

    socket.join(roomId);
    const role = assignRole(room, socket.id);
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
      room.rematchVotes.clear();
    }

    emitRoomState(room);
  });

  socket.on("disconnect", () => {
    removeFromRoom(socket.id);
  });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Realtime chess server listening on http://localhost:${port}`);
});