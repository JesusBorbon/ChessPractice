import "dotenv/config";
import path from "node:path";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import express from "express";
import { Chess, Move, Square } from "chess.js";
import nodemailer from "nodemailer";
import { Server } from "socket.io";
import { ChatRole, ChatStoredMessage, createLiveChatStore } from "./live-chat-store";

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
  displayName?: string;
  userId?: string;
  email?: string;
};

type FriendPresenceStatus = "online" | "in-room" | "offline";

type PendingFriendInvite = {
  inviteId: string;
  fromUserId: string;
  toUserId: string;
  roomId: string;
  fromName: string;
  createdAt: number;
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
    whiteName: string;
    blackName: string;
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
  voiceWAcceptsB: boolean;
  voiceBAcceptsW: boolean;
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
const activeUserSockets = new Map<string, Set<string>>();
const socketUserIds = new Map<string, string>();
const watchedFriendIdsBySocket = new Map<string, Set<string>>();
const friendWatchersByUserId = new Map<string, Set<string>>();
const pendingFriendInvites = new Map<string, PendingFriendInvite>();
const ROOM_ALPHABET = "0123456789";
const ROOM_CODE_LENGTH = 4;
const ROOM_ID_PATTERN = new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`);
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;
const PLAYER_DISCONNECT_GRACE_MS = 1000 * 60 * 3; // 3 minutos para reconectarse
const LOW_TIME_THRESHOLD_MS = 20_000;
const VOICE_MAX_BASE64_LENGTH = 2_200_000;
const VOICE_MAX_DURATION_MS = 20_000;
const VOICE_MIN_DURATION_MS = 250;
const VOICE_ALLOWED_MIME_PREFIX = "audio/";
const CHAT_MAX_TEXT_LENGTH = 420;
const FRIEND_INVITE_EXPIRY_MS = 1000 * 60 * 30;

const EMAIL_SMTP_USER = process.env.GMAIL_SMTP_USER?.trim() ?? "";
const EMAIL_SMTP_PASS = process.env.GMAIL_SMTP_PASS?.trim() ?? "";
const EMAIL_FROM = process.env.GMAIL_SMTP_FROM?.trim() || EMAIL_SMTP_USER;

const friendInviteMailer = EMAIL_SMTP_USER && EMAIL_SMTP_PASS
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_SMTP_USER,
        pass: EMAIL_SMTP_PASS,
      },
    })
  : null;

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
};

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
const liveChatStore = createLiveChatStore(projectRoot);

const MAX_IMPORT_SOURCE_LENGTH = 200_000;
const IMPORT_FETCH_TIMEOUT_MS = 12_000;

app.use(express.static(publicDir));
app.use("/stockfish", express.static(path.join(projectRoot, "node_modules", "stockfish", "bin")));
app.use(express.json({ limit: "1mb" }));

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isBlockedImportHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (
    normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "0.0.0.0"
    || normalized === "::1"
  ) {
    return true;
  }

  if (normalized.startsWith("10.") || normalized.startsWith("192.168.")) {
    return true;
  }

  const private172Match = normalized.match(/^172\.(\d{1,3})\./);
  if (private172Match) {
    const secondOctet = Number(private172Match[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}

function buildImportCandidates(url: URL): string[] {
  const candidates = new Set<string>();
  const normalizedHost = url.hostname.toLowerCase().replace(/^www\./, "");

  candidates.add(url.toString());

  if (normalizedHost.endsWith("chess.com")) {
    const chessComGameId = url.pathname.match(/\/(?:analysis\/game|game)\/(?:live|daily)\/(\d+)/i)?.[1] ?? null;
    if (chessComGameId) {
      candidates.add(`https://www.chess.com/callback/live/game/${chessComGameId}`);
      candidates.add(`https://www.chess.com/game/live/${chessComGameId}/pgn`);
      candidates.add(`https://www.chess.com/game/daily/${chessComGameId}/pgn`);
    }

    const pgnPath = `${url.origin}${url.pathname.replace(/\/$/, "")}/pgn`;
    candidates.add(pgnPath);
  }

  if (normalizedHost === "lichess.org" || normalizedHost.endsWith(".lichess.org")) {
    const lichessGameId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (/^[A-Za-z0-9]{6,12}$/.test(lichessGameId)) {
      candidates.add(`https://lichess.org/game/export/${lichessGameId}?moves=true&tags=true&clocks=false&evals=false`);
    }
  }

  return [...candidates];
}

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/\"/g, "\\\"")}"`);
  } catch {
    return value
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }
}

function getPgnCandidatesFromText(content: string): string[] {
  const candidates: string[] = [];
  const trimmed = content.trim();
  if (trimmed) {
    candidates.push(trimmed);
  }

  const eventTagIndex = content.indexOf("[Event");
  if (eventTagIndex >= 0) {
    candidates.push(content.slice(eventTagIndex).trim());
  }

  const pgnJsonRegex = /"pgn"\s*:\s*"((?:\\.|[^"\\])+)"/gi;
  let pgnMatch = pgnJsonRegex.exec(content);
  while (pgnMatch) {
    const captured = pgnMatch[1]?.trim();
    if (captured) {
      candidates.push(unescapeJsonString(captured));
    }
    pgnMatch = pgnJsonRegex.exec(content);
  }

  return candidates;
}

function findPgnInObject(value: unknown, depth = 0): string | null {
  if (depth > 5 || value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findPgnInObject(entry, depth + 1);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.pgn === "string") {
    return record.pgn;
  }

  for (const nestedValue of Object.values(record)) {
    const nested = findPgnInObject(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function normalizeValidatedPgn(input: string): string | null {
  const pgn = input.trim();
  if (!pgn) {
    return null;
  }

  const replay = new Chess();
  try {
    replay.loadPgn(pgn, { strict: false });
  } catch {
    return null;
  }

  if (replay.history().length === 0) {
    return null;
  }

  return pgn;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMPORT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "application/json,text/plain,text/html,*/*",
        "User-Agent": "ChessPractice-PGN-Importer/1.0",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function resolvePgnFromUrl(url: URL): Promise<string | null> {
  const candidates = buildImportCandidates(url);

  for (const candidate of candidates) {
    try {
      const response = await fetchWithTimeout(candidate);
      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

      const payloadCandidates: string[] = [];
      if (contentType.includes("json")) {
        const json = await response.json();
        const pgnFromObject = findPgnInObject(json);
        if (pgnFromObject) {
          payloadCandidates.push(pgnFromObject);
        }
      } else {
        const text = await response.text();
        payloadCandidates.push(...getPgnCandidatesFromText(text));
      }

      for (const candidatePgn of payloadCandidates) {
        const normalized = normalizeValidatedPgn(candidatePgn);
        if (normalized) {
          return normalized;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveImportedPgn(source: string): Promise<string | null> {
  const parsedUrl = parseHttpUrl(source);
  if (!parsedUrl) {
    return normalizeValidatedPgn(source);
  }

  if (isBlockedImportHost(parsedUrl.hostname)) {
    return null;
  }

  return resolvePgnFromUrl(parsedUrl);
}

function buildFirebaseClientConfig(): FirebaseClientConfig {
  return {
    apiKey: process.env.FIREBASE_API_KEY ?? "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.FIREBASE_APP_ID ?? "",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID ?? "",
  };
}

app.get("/api/firebase-config", (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.json(buildFirebaseClientConfig());
});

app.post("/api/pgn-import", async (request, response) => {
  const source = typeof request.body?.source === "string"
    ? request.body.source.trim()
    : "";

  if (!source) {
    response.status(400).json({ error: "Provide a PGN string or game URL." });
    return;
  }

  if (source.length > MAX_IMPORT_SOURCE_LENGTH) {
    response.status(413).json({ error: "Import source is too large." });
    return;
  }

  try {
    const resolvedPgn = await resolveImportedPgn(source);
    if (!resolvedPgn) {
      response.status(400).json({
        error: "Could not extract a valid PGN from that source. Paste the full PGN text if the URL blocks automated access.",
      });
      return;
    }

    response.setHeader("Cache-Control", "no-store");
    response.json({ pgn: resolvedPgn });
  } catch {
    response.status(500).json({ error: "PGN import failed unexpectedly." });
  }
});

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

function getSocketDisplayName(socketId: string | undefined): string {
  if (!socketId) {
    return "Guest";
  }

  const socket = io.sockets.sockets.get(socketId);
  const clientState = socket?.data as ClientState | undefined;
  const name = clientState?.displayName?.trim();
  if (!name) {
    return "Guest";
  }

  return name;
}

function normalizeUserId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return null;
  }

  return normalized;
}

function getSocketUserId(socketId: string): string | null {
  const state = io.sockets.sockets.get(socketId)?.data as ClientState | undefined;
  const normalized = normalizeUserId(state?.userId);
  return normalized || null;
}

function clearSocketUserIdentity(socketId: string): void {
  const previousUserId = socketUserIds.get(socketId);
  if (!previousUserId) {
    return;
  }

  socketUserIds.delete(socketId);

  const socketSet = activeUserSockets.get(previousUserId);
  if (socketSet) {
    socketSet.delete(socketId);
    if (socketSet.size === 0) {
      activeUserSockets.delete(previousUserId);
    }
  }

  notifyFriendWatchers(previousUserId);
}

function registerSocketUserIdentity(socketId: string, userId: string): void {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    clearSocketUserIdentity(socketId);
    return;
  }

  const previousUserId = socketUserIds.get(socketId);
  if (previousUserId && previousUserId !== normalizedUserId) {
    const previousSet = activeUserSockets.get(previousUserId);
    if (previousSet) {
      previousSet.delete(socketId);
      if (previousSet.size === 0) {
        activeUserSockets.delete(previousUserId);
      }
    }
    notifyFriendWatchers(previousUserId);
  }

  socketUserIds.set(socketId, normalizedUserId);
  const socketSet = activeUserSockets.get(normalizedUserId) ?? new Set<string>();
  socketSet.add(socketId);
  activeUserSockets.set(normalizedUserId, socketSet);
  notifyFriendWatchers(normalizedUserId);
}

function clearFriendWatchForSocket(socketId: string): void {
  const watchedIds = watchedFriendIdsBySocket.get(socketId);
  if (!watchedIds) {
    return;
  }

  watchedFriendIdsBySocket.delete(socketId);
  for (const watchedUserId of watchedIds) {
    const watchers = friendWatchersByUserId.get(watchedUserId);
    if (!watchers) {
      continue;
    }

    watchers.delete(socketId);
    if (watchers.size === 0) {
      friendWatchersByUserId.delete(watchedUserId);
    }
  }
}

function getFriendPresenceStatus(userId: string): FriendPresenceStatus {
  const sockets = activeUserSockets.get(userId);
  if (!sockets || sockets.size === 0) {
    return "offline";
  }

  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    const state = socket?.data as ClientState | undefined;
    if (state?.roomId) {
      return "in-room";
    }
  }

  return "online";
}

function emitFriendPresenceToSocket(socketId: string): void {
  const watchedIds = watchedFriendIdsBySocket.get(socketId) ?? new Set<string>();
  const friends = [...watchedIds].map((userId) => ({
    userId,
    status: getFriendPresenceStatus(userId),
  }));

  io.to(socketId).emit("friends:presence", { friends });
}

function notifyFriendWatchers(userId: string): void {
  const watchers = friendWatchersByUserId.get(userId);
  if (!watchers || watchers.size === 0) {
    return;
  }

  for (const watcherSocketId of watchers) {
    emitFriendPresenceToSocket(watcherSocketId);
  }
}

function setFriendWatchForSocket(socketId: string, friendIds: string[]): void {
  clearFriendWatchForSocket(socketId);

  const uniqueFriendIds = [...new Set(friendIds.map((id) => normalizeUserId(id)).filter(Boolean))];
  const watchedSet = new Set<string>(uniqueFriendIds);
  watchedFriendIdsBySocket.set(socketId, watchedSet);

  for (const friendId of watchedSet) {
    const watchers = friendWatchersByUserId.get(friendId) ?? new Set<string>();
    watchers.add(socketId);
    friendWatchersByUserId.set(friendId, watchers);
  }

  emitFriendPresenceToSocket(socketId);
}

function notifySocketOwnerPresence(socketId: string): void {
  const userId = getSocketUserId(socketId);
  if (!userId) {
    return;
  }

  notifyFriendWatchers(userId);
}

function canSendFriendInviteEmail(): boolean {
  return Boolean(friendInviteMailer && EMAIL_FROM);
}

async function sendOfflineFriendInviteEmail(input: {
  toEmail: string;
  inviterName: string;
  roomId: string;
  shareUrl: string;
}): Promise<void> {
  if (!friendInviteMailer || !EMAIL_FROM) {
    throw new Error("Friend invite email transport is not configured.");
  }

  const subject = `${input.inviterName} invited you to a ChessPractice room`;
  const text = [
    `${input.inviterName} invited you to join room ${input.roomId}.`,
    "",
    `Accept invitation: ${input.shareUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;color:#1e2b24;max-width:560px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">You have a chess invitation</h2>
      <p style="margin:0 0 14px;"><strong>${input.inviterName}</strong> invited you to room <strong>${input.roomId}</strong>.</p>
      <p style="margin:0 0 20px;">Tap accept to open the app and join the correct room automatically.</p>
      <a href="${input.shareUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#1f7a53;color:#ffffff;text-decoration:none;font-weight:700;">Accept invitation</a>
    </div>
  `;

  await friendInviteMailer.sendMail({
    from: EMAIL_FROM,
    to: input.toEmail,
    subject,
    text,
    html,
  });
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
      whiteName: getSocketDisplayName(room.white),
      blackName: getSocketDisplayName(room.black),
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

function resetRoomChatConsent(room: GameRoom): void {
  room.voiceWAcceptsB = false;
  room.voiceBAcceptsW = false;
}

function setChatConsentForReceiver(room: GameRoom, receiverRole: PlayerRole, accept: boolean): void {
  if (receiverRole === "w") {
    room.voiceWAcceptsB = accept;
    return;
  }

  room.voiceBAcceptsW = accept;
}

function hasMutualChatConsent(room: GameRoom): boolean {
  return room.voiceWAcceptsB && room.voiceBAcceptsW;
}

function isAudioMimeType(value: unknown): value is string {
  return typeof value === "string"
    && value.startsWith(VOICE_ALLOWED_MIME_PREFIX)
    && value.length <= 80;
}

function isCompactBase64(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= VOICE_MAX_BASE64_LENGTH
    && /^[A-Za-z0-9+/=\s]+$/.test(value);
}

function sanitizeVoiceDurationMs(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (rounded < VOICE_MIN_DURATION_MS || rounded > VOICE_MAX_DURATION_MS) {
    return null;
  }

  return rounded;
}

function sanitizeChatText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > CHAT_MAX_TEXT_LENGTH) {
    return null;
  }

  return normalized;
}

function toChatRole(role: PlayerRole): ChatRole {
  return role;
}

function buildChatState(room: GameRoom): {
  wAcceptsB: boolean;
  bAcceptsW: boolean;
  mutualConsent: boolean;
  messageCount: number;
} {
  return {
    wAcceptsB: room.voiceWAcceptsB,
    bAcceptsW: room.voiceBAcceptsW,
    mutualConsent: hasMutualChatConsent(room),
    messageCount: liveChatStore.getRoomMessages(room.id).length,
  };
}

function emitChatState(room: GameRoom): void {
  io.to(room.id).emit("chat:state", buildChatState(room));
}

function emitChatMessages(socketId: string, room: GameRoom): void {
  io.to(socketId).emit("chat:messages", {
    messages: liveChatStore.getRoomMessages(room.id),
  });
}

function purgeRoomChatData(room: GameRoom, reason: "abandoned" | "room-closed"): void {
  const deletedCount = liveChatStore.deleteRoomMessages(room.id);
  resetRoomChatConsent(room);
  io.to(room.id).emit("chat:purged", { reason, deletedCount });
  emitChatState(room);
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

function closeRoom(room: GameRoom, reason: "abandoned" | "room-closed" = "room-closed"): void {
  purgeRoomChatData(room, reason);

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
  const hadRoom = Boolean(clientState.roomId);
  delete clientState.roomId;
  delete clientState.role;

  if (hadRoom) {
    notifySocketOwnerPresence(socketId);
  }
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
      closeRoom(room, "abandoned");
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
    resetRoomChatConsent(room);
    return "w";
  }

  if (!room.black) {
    room.spectators.delete(socketId);
    room.black = socketId;
    resetRoomChatConsent(room);
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

    if (!room.white && !room.black && getSpectatorCount(roomId, room) === 0) {
      closeRoom(room, "abandoned");
      continue;
    }

    // Limpiar salas vacías después del TTL
    if (now - room.updatedAt < ROOM_TTL_MS) {
      continue;
    }

    if (getSpectatorCount(roomId, room) > 0 || room.white || room.black) {
      continue;
    }

    closeRoom(room, "abandoned");
  }

  for (const [inviteId, invite] of pendingFriendInvites.entries()) {
    if (now - invite.createdAt > FRIEND_INVITE_EXPIRY_MS) {
      pendingFriendInvites.delete(inviteId);
    }
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
  const initialState = socket.data as ClientState;
  if (!initialState.displayName) {
    initialState.displayName = "Guest";
  }

  socket.emit("connection:status", { connected: true });

  socket.on("profile:setName", (payload?: { name?: string; userId?: string | null; email?: string | null }) => {
    const rawName = payload?.name;
    if (typeof rawName !== "string") {
      socket.emit("room:error", { message: "Invalid player name." });
      return;
    }

    const trimmed = rawName.trim().slice(0, 24);
    if (!trimmed) {
      socket.emit("room:error", { message: "Player name cannot be empty." });
      return;
    }

    const state = socket.data as ClientState;
    state.displayName = trimmed;
    const normalizedUserId = normalizeUserId(payload?.userId);
    const normalizedEmail = normalizeEmail(payload?.email);

    if (normalizedUserId) {
      state.userId = normalizedUserId;
      if (normalizedEmail) {
        state.email = normalizedEmail;
      } else {
        delete state.email;
      }
      registerSocketUserIdentity(socket.id, normalizedUserId);
    } else {
      delete state.userId;
      delete state.email;
      clearSocketUserIdentity(socket.id);
    }

    const room = getRoomForSocket(socket.id);
    if (room) {
      emitRoomState(room);
    }
  });

  socket.on("friends:watch", (payload?: { friendIds?: string[] }) => {
    const friendIds = Array.isArray(payload?.friendIds) ? payload.friendIds : [];
    setFriendWatchForSocket(socket.id, friendIds);
  });

  socket.on("friends:invite:send", async (payload?: { toUserId?: string; toEmail?: string | null }) => {
    const senderUserId = getSocketUserId(socket.id);
    if (!senderUserId) {
      socket.emit("room:error", { message: "Sign in to invite friends." });
      return;
    }

    const room = getRoomForSocket(socket.id);
    if (!room) {
      socket.emit("room:error", { message: "Create or join a room before sending invites." });
      return;
    }

    const toUserId = normalizeUserId(payload?.toUserId);
    if (!toUserId) {
      socket.emit("room:error", { message: "Invalid friend ID." });
      return;
    }

    if (toUserId === senderUserId) {
      socket.emit("room:error", { message: "You cannot invite yourself." });
      return;
    }

    const inviteId = randomUUID();
    const fromName = getSocketDisplayName(socket.id);
    const shareUrl = buildShareUrl(socket.id, room.id);
    pendingFriendInvites.set(inviteId, {
      inviteId,
      fromUserId: senderUserId,
      toUserId,
      roomId: room.id,
      fromName,
      createdAt: Date.now(),
    });

    const recipientSockets = activeUserSockets.get(toUserId);
    if (recipientSockets && recipientSockets.size > 0) {
      for (const recipientSocketId of recipientSockets) {
        io.to(recipientSocketId).emit("friends:invite:incoming", {
          inviteId,
          fromUserId: senderUserId,
          fromName,
          roomId: room.id,
        });
      }

      socket.emit("friends:invite:sent", { toUserId, delivery: "realtime" });
      return;
    }

    const toEmail = normalizeEmail(payload?.toEmail);
    if (!toEmail) {
      socket.emit("room:error", { message: "Friend is offline and has no Gmail available for email invites." });
      return;
    }

    if (!canSendFriendInviteEmail()) {
      socket.emit("room:error", { message: "Gmail invite delivery is not configured on the server." });
      return;
    }

    try {
      await sendOfflineFriendInviteEmail({
        toEmail,
        inviterName: fromName,
        roomId: room.id,
        shareUrl,
      });
      socket.emit("friends:invite:sent", { toUserId, delivery: "email" });
    } catch {
      socket.emit("room:error", { message: "Could not send Gmail invite right now." });
    }
  });

  socket.on("friends:invite:respond", (payload?: { inviteId?: string; fromUserId?: string; accepted?: boolean }) => {
    if (typeof payload?.accepted !== "boolean") {
      socket.emit("room:error", { message: "Invalid invitation response." });
      return;
    }

    const inviteId = normalizeUserId(payload?.inviteId);
    const fromUserId = normalizeUserId(payload?.fromUserId);
    if (!inviteId || !fromUserId) {
      socket.emit("room:error", { message: "Invalid invitation response." });
      return;
    }

    const receiverUserId = getSocketUserId(socket.id);
    const pendingInvite = pendingFriendInvites.get(inviteId);
    if (pendingInvite && receiverUserId) {
      if (pendingInvite.toUserId !== receiverUserId || pendingInvite.fromUserId !== fromUserId) {
        socket.emit("room:error", { message: "Invitation does not match this account." });
        return;
      }

      pendingFriendInvites.delete(inviteId);
    }

    const senderSockets = activeUserSockets.get(fromUserId);
    if (!senderSockets || senderSockets.size === 0) {
      return;
    }

    const friendName = getSocketDisplayName(socket.id);
    for (const senderSocketId of senderSockets) {
      io.to(senderSocketId).emit("friends:invite:response", {
        accepted: payload.accepted,
        friendName,
      });
    }
  });

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
      voiceWAcceptsB: false,
      voiceBAcceptsW: false,
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    const clientState = socket.data as ClientState;
    clientState.roomId = roomId;
    clientState.role = "w";
    notifySocketOwnerPresence(socket.id);

    socket.emit("session:joined", {
      roomId,
      role: "w",
      shareUrl: buildShareUrl(socket.id, roomId),
    });

    emitRoomState(room);
    emitChatState(room);
    emitChatMessages(socket.id, room);
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
    notifySocketOwnerPresence(socket.id);

    socket.emit("session:joined", {
      roomId,
      role,
      shareUrl: buildShareUrl(socket.id, roomId),
    });

    emitRoomState(room);
    emitChatState(room);
    if (role === "w" || role === "b") {
      emitChatMessages(socket.id, room);
    }
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

  socket.on("chat:consent:set", (payload?: { accept?: boolean }) => {
    if (typeof payload?.accept !== "boolean") {
      socket.emit("room:error", { message: "Invalid chat consent payload." });
      return;
    }

    const room = getRoomForSocket(socket.id);
    if (!room) {
      socket.emit("room:error", { message: "Join a room before changing communication settings." });
      return;
    }

    const role = getLiveRoomRole(room, socket.id);
    if (!role || role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can change communication settings." });
      return;
    }

    setChatConsentForReceiver(room, role, payload.accept);
    emitChatState(room);
    emitChatMessages(socket.id, room);
  });

  socket.on("chat:sync", () => {
    const room = getRoomForSocket(socket.id);
    if (!room) {
      return;
    }

    const role = getLiveRoomRole(room, socket.id);
    if (!role || role === "spectator") {
      return;
    }

    emitChatMessages(socket.id, room);
    emitChatState(room);
  });

  socket.on("chat:text:send", (payload?: { text?: string }) => {
    const room = getRoomForSocket(socket.id);
    if (!room) {
      socket.emit("room:error", { message: "Join a room before sending messages." });
      return;
    }

    if (!room.isStarted || !room.white || !room.black) {
      socket.emit("room:error", { message: "Live chat is available during active multiplayer games." });
      return;
    }

    const role = getLiveRoomRole(room, socket.id);
    if (!role || role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can send messages." });
      return;
    }

    if (!hasMutualChatConsent(room)) {
      socket.emit("room:error", { message: "Both players must accept communication first." });
      return;
    }

    const text = sanitizeChatText(payload?.text);
    if (!text) {
      socket.emit("room:error", { message: "Message is empty or too long." });
      return;
    }

    const message: ChatStoredMessage = liveChatStore.addTextMessage({
      roomId: room.id,
      senderRole: toChatRole(role),
      senderName: getSocketDisplayName(socket.id),
      text,
    });

    io.to(room.id).emit("chat:message", { message });
    emitChatState(room);
  });

  socket.on("chat:voice:send", (payload?: {
    mimeType?: string;
    audioBase64?: string;
    durationMs?: number;
  }) => {
    const room = getRoomForSocket(socket.id);
    if (!room) {
      socket.emit("room:error", { message: "Join a room before sending voice notes." });
      return;
    }

    if (!room.isStarted || !room.white || !room.black) {
      socket.emit("room:error", { message: "Live chat is available during active multiplayer games." });
      return;
    }

    const role = getLiveRoomRole(room, socket.id);
    if (!role || role === "spectator") {
      socket.emit("room:error", { message: "Only seated players can send voice notes." });
      return;
    }

    if (!hasMutualChatConsent(room)) {
      socket.emit("room:error", { message: "Both players must accept communication first." });
      return;
    }

    const mimeType = payload?.mimeType;
    const audioBase64 = payload?.audioBase64;
    const durationMs = sanitizeVoiceDurationMs(payload?.durationMs);
    if (!isAudioMimeType(mimeType) || !isCompactBase64(audioBase64) || durationMs === null) {
      socket.emit("room:error", { message: "Invalid voice note payload." });
      return;
    }

    const message: ChatStoredMessage = liveChatStore.addVoiceMessage({
      roomId: room.id,
      senderRole: toChatRole(role),
      senderName: getSocketDisplayName(socket.id),
      mimeType,
      audioBase64,
      durationMs,
    });

    io.to(room.id).emit("chat:message", { message });
    emitChatState(room);
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

        resetRoomChatConsent(room);
        emitChatState(room);
        if (room.white) {
          emitChatMessages(room.white, room);
        }
        if (room.black) {
          emitChatMessages(room.black, room);
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

      resetRoomChatConsent(room);

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

      if (room.white) {
        emitChatMessages(room.white, room);
      }
      if (room.black) {
        emitChatMessages(room.black, room);
      }
      emitChatState(room);

      startClock(room);
    }

    emitRoomState(room); 
  });

  socket.on("disconnect", () => {
    removeFromRoom(socket.id, false); // false = no es inmediato, aplicar grace period
    clearFriendWatchForSocket(socket.id);
    clearSocketUserIdentity(socket.id);
  });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Realtime chess server listening on http://localhost:${port}`);
});