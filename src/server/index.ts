import "dotenv/config";
import path from "node:path";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import express from "express";
import { Chess, Move, Square } from "chess.js";
import { Server } from "socket.io";
import {
  canSendFriendInviteEmail,
  getGmailInviteConfigErrorMessage,
  sendOfflineFriendInviteEmail,
} from "./gmail-invite";
import { ChatRole, ChatStoredMessage, createLiveChatStore } from "./live-chat-store";
import {
  buildRoomInviteQuery,
  canJoinAsSpectator,
  createRoomAccessState,
  evaluateRoomJoinAuthorization,
  grantDirectRoomInvite,
  RoomAccessState,
} from "./room-access";
import { createRoomJoinRequestStore, StoredRoomJoinRequest } from "./room-join-request-store";
import { canStartPregameMatch, sanitizePregameSeatState } from "./room-readiness";
import { createRoomStateStore, type PersistedRoomState } from "./room-state-store";

type PlayerRole = "w" | "b";
type RoomRole = PlayerRole | "spectator";
type TimeControlPresetId = "bullet1" | "bullet2p1" | "blitz3" | "blitz3p2" | "blitz5" | "rapid10" | "rapid15p10";

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
  friendId?: string;
  usernameChangeCount?: number;
  friendPresenceActivity?: FriendPresenceActivity;
};

type OnlineMultiplayerAccountRole = "guest" | "registered";

type OnlineMultiplayerPermissions = {
  accountRole: OnlineMultiplayerAccountRole;
  canPlayOnlineMatches: boolean;
  canUseInviteSystem: boolean;
  canUseAccountFeatures: boolean;
};

type FriendPresenceActivity = "playing-bot";
type FriendPresenceStatus = "online" | "in-room" | "playing-bot" | "offline";

type FriendPresenceInfo = {
  status: FriendPresenceStatus;
  roomId: string | null;
  canSpectate: boolean;
  canRequestJoin: boolean;
};

type PendingFriendInvite = {
  inviteId: string;
  fromUserId: string;
  toUserId: string;
  roomId: string;
  inviteToken: string;
  fromName: string;
  createdAt: number;
};

type PendingFriendRequest = {
  requestId: string;
  fromUserId: string;
  fromName: string;
  fromFriendId: string;
  toUserId: string;
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
    whiteUserId: string | null;
    blackUserId: string | null;
    whiteFriendId: string | null;
    blackFriendId: string | null;
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
  whiteUserId?: string | null;
  black?: string;
  blackUserId?: string | null;
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
  access: RoomAccessState;
};

const PREGAME_COLOR_CONFLICT_ERROR = "Both players selected the same color. Please choose different colors to continue.";

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
const knownFriendUserIdsBySocket = new Map<string, Set<string>>();
const lockedUsernameByUserId = new Map<string, string>();
const lockedUsernameOwnerByKey = new Map<string, string>();
const cachedFriendPresenceByUserId = new Map<string, string>();
const pendingFriendInvites = new Map<string, PendingFriendInvite>();
const pendingFriendRequests = new Map<string, PendingFriendRequest>();
const ROOM_ALPHABET = "0123456789";
const ROOM_CODE_LENGTH = 4;
const ROOM_ID_PATTERN = new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`);
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;
const PLAYER_DISCONNECT_GRACE_MS = 1000 * 60 * 3; // 3 minutos para reconectarse
const POST_GAME_DISCONNECT_GRACE_MS = 1000 * 60 * 60 * 24; // keep finished-game seats for 24h
const LOW_TIME_THRESHOLD_MS = 20_000;
const VOICE_MAX_BASE64_LENGTH = 2_200_000;
const VOICE_MAX_DURATION_MS = 20_000;
const VOICE_MIN_DURATION_MS = 250;
const VOICE_ALLOWED_MIME_PREFIX = "audio/";
const CHAT_MAX_TEXT_LENGTH = 420;
const FRIEND_INVITE_EXPIRY_MS = 1000 * 60 * 30;
const ROOM_JOIN_REQUEST_EXPIRY_MS = 1000 * 60 * 20;

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
  bullet1: { id: "bullet1", label: "1+0 Bullet", initialMs: 60_000, incrementMs: 0 },
  bullet2p1: { id: "bullet2p1", label: "2+1 Bullet", initialMs: 120_000, incrementMs: 1_000 },
  blitz3: { id: "blitz3", label: "3-minute Blitz", initialMs: 3 * 60_000, incrementMs: 0 },
  blitz3p2: { id: "blitz3p2", label: "3+2 Blitz", initialMs: 3 * 60_000, incrementMs: 2_000 },
  blitz5: { id: "blitz5", label: "5-minute Blitz", initialMs: 5 * 60_000, incrementMs: 0 },
  rapid10: { id: "rapid10", label: "10-minute Rapid", initialMs: 10 * 60_000, incrementMs: 0 },
  rapid15p10: { id: "rapid15p10", label: "15+10 Rapid", initialMs: 15 * 60_000, incrementMs: 10_000 },
};

const projectRoot = process.cwd();
const publicDir =
  process.env.NODE_ENV === "production"
    ? path.join(projectRoot, "dist", "public")
    : path.join(projectRoot, "public");
const liveChatStore = createLiveChatStore(projectRoot);
const roomJoinRequestStore = createRoomJoinRequestStore(projectRoot);
const roomStateStore = createRoomStateStore(projectRoot);

const MAX_IMPORT_SOURCE_LENGTH = 200_000;
const IMPORT_FETCH_TIMEOUT_MS = 12_000;
const PERSISTED_SEAT_PLACEHOLDER_PREFIX = "__persisted-seat__";
const PERSISTED_SEAT_RECOVERY_GRACE_MS = 1000 * 60 * 60 * 24 * 7;

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

function buildShareUrl(socketId: string, roomId: string, inviteToken: string | null = null): string {
  const socket = io.sockets.sockets.get(socketId);
  const host = socket?.handshake.headers.host;
  const forwardedProto = socket?.handshake.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto ?? (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    if (!inviteToken) {
      return `/?room=${roomId}`;
    }

    return `/?${buildRoomInviteQuery(roomId, inviteToken)}`;
  }

  if (!inviteToken) {
    return `${protocol}://${host}/?room=${roomId}`;
  }

  return `${protocol}://${host}/?${buildRoomInviteQuery(roomId, inviteToken)}`;
}

function roomTrace(event: string, details: Record<string, unknown>): void {
  console.info(`[room:${event}]`, details);
}

function createPersistedSeatPlaceholder(roomId: string, role: PlayerRole): string {
  return `${PERSISTED_SEAT_PLACEHOLDER_PREFIX}:${roomId}:${role}`;
}

function isPersistedSeatPlaceholder(socketId: string | undefined): boolean {
  return typeof socketId === "string" && socketId.startsWith(`${PERSISTED_SEAT_PLACEHOLDER_PREFIX}:`);
}

function resolveSeatUserId(
  room: GameRoom,
  role: PlayerRole,
): string | null {
  if (role === "w") {
    return room.whiteUserId ?? (room.white ? getSocketUserId(room.white) : null);
  }

  return room.blackUserId ?? (room.black ? getSocketUserId(room.black) : null);
}

function resolveOwnerUserId(room: GameRoom): string | null {
  if (!room.ownerId) {
    return null;
  }

  if (room.ownerId === room.white) {
    return resolveSeatUserId(room, "w");
  }

  if (room.ownerId === room.black) {
    return resolveSeatUserId(room, "b");
  }

  return getSocketUserId(room.ownerId);
}

function serializeRoomState(room: GameRoom): PersistedRoomState {
  const whiteUserId = resolveSeatUserId(room, "w");
  const blackUserId = resolveSeatUserId(room, "b");
  const ownerUserId = resolveOwnerUserId(room);
  const whiteChoice = room.white ? room.colorChoices.get(room.white) ?? null : null;
  const blackChoice = room.black ? room.colorChoices.get(room.black) ?? null : null;
  const whiteReady = room.white ? room.readyPlayers.has(room.white) : false;
  const blackReady = room.black ? room.readyPlayers.has(room.black) : false;

  return {
    id: room.id,
    movesSan: room.chess.history(),
    whiteUserId,
    blackUserId,
    ownerUserId,
    winner: room.winner ?? null,
    statusOverride: room.statusOverride ?? null,
    whiteDisconnectedAt: room.whiteDisconnectedAt ?? null,
    blackDisconnectedAt: room.blackDisconnectedAt ?? null,
    ownerDisconnectedAt: room.ownerDisconnectedAt ?? null,
    updatedAt: room.updatedAt,
    isStarted: room.isStarted,
    analysisEnabled: room.analysisEnabled,
    analysisLabelsOnlyEnabled: room.analysisLabelsOnlyEnabled,
    timeControl: room.timeControl,
    clockWhiteMs: room.clockWhiteMs,
    clockBlackMs: room.clockBlackMs,
    clockActive: room.clockActive ?? null,
    clockRunning: room.clockRunning,
    clockLastUpdatedAt: room.clockLastUpdatedAt,
    voiceWAcceptsB: room.voiceWAcceptsB,
    voiceBAcceptsW: room.voiceBAcceptsW,
    whiteColorChoice: whiteChoice,
    blackColorChoice: blackChoice,
    whiteReady,
    blackReady,
    access: {
      inviteLinkToken: room.access.inviteLinkToken,
      invitedUserIds: [...room.access.invitedUserIds],
      allowedSpectatorUserIds: [...room.access.allowedSpectatorUserIds],
    },
  };
}

function deserializeRoomState(record: PersistedRoomState): GameRoom | null {
  const chess = new Chess();
  for (const san of record.movesSan) {
    try {
      const applied = chess.move(san);
      if (!applied) {
        return null;
      }
    } catch {
      return null;
    }
  }

  const whiteSeatId = record.whiteUserId ? createPersistedSeatPlaceholder(record.id, "w") : undefined;
  const blackSeatId = record.blackUserId ? createPersistedSeatPlaceholder(record.id, "b") : undefined;
  const ownerSeatId =
    record.ownerUserId && record.ownerUserId === record.whiteUserId
      ? whiteSeatId
      : record.ownerUserId && record.ownerUserId === record.blackUserId
      ? blackSeatId
      : undefined;
  const now = Date.now();

  const room: GameRoom = {
    id: record.id,
    chess,
    whiteUserId: record.whiteUserId,
    blackUserId: record.blackUserId,
    spectators: new Set<string>(),
    rematchVotes: new Set<string>(),
    analysisVotes: new Set<string>(),
    labelsVotes: new Set<string>(),
    analysisEnabled: record.analysisEnabled,
    analysisLabelsOnlyEnabled: record.analysisLabelsOnlyEnabled,
    updatedAt: record.updatedAt,
    isStarted: record.isStarted,
    colorChoices: new Map<string, "w" | "b">(),
    readyPlayers: new Set<string>(),
    timeControl: record.timeControl,
    clockWhiteMs: record.clockWhiteMs,
    clockBlackMs: record.clockBlackMs,
    clockActive: record.clockActive,
    clockRunning: record.clockRunning,
    clockLastUpdatedAt: record.clockLastUpdatedAt,
    voiceWAcceptsB: record.voiceWAcceptsB,
    voiceBAcceptsW: record.voiceBAcceptsW,
    access: {
      inviteLinkToken: record.access.inviteLinkToken,
      invitedUserIds: new Set<string>(record.access.invitedUserIds),
      allowedSpectatorUserIds: new Set<string>(record.access.allowedSpectatorUserIds),
    },
  };

  if (whiteSeatId) {
    room.white = whiteSeatId;
    room.whiteDisconnectedAt = record.whiteDisconnectedAt ?? now;
  }
  if (blackSeatId) {
    room.black = blackSeatId;
    room.blackDisconnectedAt = record.blackDisconnectedAt ?? now;
  }
  if (ownerSeatId) {
    room.ownerId = ownerSeatId;
    room.ownerDisconnectedAt = record.ownerDisconnectedAt ?? now;
  }
  if (record.winner) {
    room.winner = record.winner;
  }
  if (record.statusOverride) {
    room.statusOverride = record.statusOverride;
  }

  if (whiteSeatId && record.whiteColorChoice) {
    room.colorChoices.set(whiteSeatId, record.whiteColorChoice);
  }
  if (blackSeatId && record.blackColorChoice) {
    room.colorChoices.set(blackSeatId, record.blackColorChoice);
  }
  if (whiteSeatId && record.whiteReady) {
    room.readyPlayers.add(whiteSeatId);
  }
  if (blackSeatId && record.blackReady) {
    room.readyPlayers.add(blackSeatId);
  }

  return room;
}

function persistRoomsToDisk(): void {
  const now = Date.now();
  const serializedRooms: PersistedRoomState[] = [];

  for (const room of rooms.values()) {
    syncActiveClock(room, now);
    serializedRooms.push(serializeRoomState(room));
  }

  roomStateStore.saveRooms(serializedRooms);
}

function restoreRoomsFromDisk(): void {
  const restoredRooms = roomStateStore.loadRooms();
  if (restoredRooms.length === 0) {
    return;
  }

  for (const record of restoredRooms) {
    const hydrated = deserializeRoomState(record);
    if (!hydrated) {
      roomTrace("restore-skip-invalid", { roomId: record.id });
      continue;
    }

    rooms.set(hydrated.id, hydrated);
  }

  roomTrace("restore-complete", {
    restoredCount: rooms.size,
  });
  persistRoomsToDisk();
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

function normalizeFriendId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!/^\d{5}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeFriendPresenceActivity(value: unknown): FriendPresenceActivity | null {
  if (value === "playing-bot") {
    return "playing-bot";
  }

  return null;
}

function normalizeUsernameChangeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const normalized = Math.floor(value);
  return normalized < 0 ? 0 : normalized;
}

function getSocketUserId(socketId: string): string | null {
  const state = io.sockets.sockets.get(socketId)?.data as ClientState | undefined;
  const normalized = normalizeUserId(state?.userId);
  return normalized || null;
}

function getSocketFriendId(socketId: string): string | null {
  const state = io.sockets.sockets.get(socketId)?.data as ClientState | undefined;
  return normalizeFriendId(state?.friendId);
}

function getOnlineMultiplayerPermissions(socketId: string): OnlineMultiplayerPermissions {
  const isRegistered = Boolean(getSocketUserId(socketId));
  if (!isRegistered) {
    return {
      accountRole: "guest",
      canPlayOnlineMatches: false,
      canUseInviteSystem: false,
      canUseAccountFeatures: false,
    };
  }

  return {
    accountRole: "registered",
    canPlayOnlineMatches: true,
    canUseInviteSystem: true,
    canUseAccountFeatures: true,
  };
}

function isSocketConnected(socketId: string | undefined): socketId is string {
  return typeof socketId === "string" && io.sockets.sockets.has(socketId);
}

function getConnectedUserSocketIds(userId: string): string[] {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return [];
  }

  const socketSet = activeUserSockets.get(normalizedUserId);
  if (!socketSet || socketSet.size === 0) {
    return [];
  }

  const connectedSocketIds: string[] = [];
  for (const socketId of socketSet) {
    if (!isSocketConnected(socketId)) {
      socketSet.delete(socketId);
      socketUserIds.delete(socketId);
      continue;
    }

    connectedSocketIds.push(socketId);
  }

  if (socketSet.size === 0) {
    activeUserSockets.delete(normalizedUserId);
  }

  return connectedSocketIds;
}

function clearKnownFriendsForSocket(socketId: string): void {
  knownFriendUserIdsBySocket.delete(socketId);
}

function setKnownFriendsForSocket(socketId: string, friendUserIds: readonly string[]): void {
  const senderUserId = getSocketUserId(socketId);
  if (!senderUserId) {
    clearKnownFriendsForSocket(socketId);
    return;
  }

  const normalizedFriendIds = new Set<string>();
  for (const rawFriendUserId of friendUserIds) {
    const friendUserId = normalizeUserId(rawFriendUserId);
    if (!friendUserId || friendUserId === senderUserId) {
      continue;
    }

    normalizedFriendIds.add(friendUserId);
    if (normalizedFriendIds.size >= 1000) {
      break;
    }
  }

  knownFriendUserIdsBySocket.set(socketId, normalizedFriendIds);
}

function areKnownFriendsForSocket(socketId: string, targetUserId: string): boolean {
  const normalizedTargetUserId = normalizeUserId(targetUserId);
  if (!normalizedTargetUserId) {
    return false;
  }

  const knownFriends = knownFriendUserIdsBySocket.get(socketId);
  if (!knownFriends) {
    return false;
  }

  return knownFriends.has(normalizedTargetUserId);
}

function isWatchedFriendForSocket(socketId: string, targetUserId: string): boolean {
  const normalizedTargetUserId = normalizeUserId(targetUserId);
  if (!normalizedTargetUserId) {
    return false;
  }

  const watchedFriendIds = watchedFriendIdsBySocket.get(socketId);
  if (!watchedFriendIds) {
    return false;
  }

  return watchedFriendIds.has(normalizedTargetUserId);
}

function hasLiveFriendSignalForSocket(socketId: string, targetUserId: string): boolean {
  return areKnownFriendsForSocket(socketId, targetUserId)
    || isWatchedFriendForSocket(socketId, targetUserId);
}

function areLikelyFriendsForJoinRequest(
  requesterSocketId: string,
  requesterUserId: string,
  targetUserId: string,
): boolean {
  if (hasLiveFriendSignalForSocket(requesterSocketId, targetUserId)) {
    return true;
  }

  const targetSockets = getConnectedUserSocketIds(targetUserId);
  for (const targetSocketId of targetSockets) {
    if (hasLiveFriendSignalForSocket(targetSocketId, requesterUserId)) {
      return true;
    }
  }

  return false;
}

function pruneDisconnectedRoomSeats(room: GameRoom, now = Date.now()): boolean {
  let changed = false;
  const whiteSeatGraceMs = getSeatDisconnectGraceMs(room, room.white);
  const blackSeatGraceMs = getSeatDisconnectGraceMs(room, room.black);
  const ownerSeatGraceMs = getSeatDisconnectGraceMs(room, room.ownerId);

  const whiteConnected = isSocketConnected(room.white);
  const blackConnected = isSocketConnected(room.black);
  const ownerConnected = isSocketConnected(room.ownerId);

  if (room.white && !whiteConnected && !room.whiteDisconnectedAt && room.whiteUserId) {
    room.whiteDisconnectedAt = now;
    changed = true;
  }

  if (room.black && !blackConnected && !room.blackDisconnectedAt && room.blackUserId) {
    room.blackDisconnectedAt = now;
    changed = true;
  }

  const ownerHasPersistentIdentity = Boolean(
    room.ownerId
    && ((room.ownerId === room.white && room.whiteUserId) || (room.ownerId === room.black && room.blackUserId)),
  );
  if (room.ownerId && !ownerConnected && !room.ownerDisconnectedAt && ownerHasPersistentIdentity) {
    room.ownerDisconnectedAt = now;
    changed = true;
  }

  const shouldReleaseWhite = Boolean(
    room.white && (
      (room.whiteDisconnectedAt && now - room.whiteDisconnectedAt > whiteSeatGraceMs)
      || (!whiteConnected && !room.whiteDisconnectedAt && !room.whiteUserId)
    ),
  );

  if (shouldReleaseWhite && room.white) {
    room.colorChoices.delete(room.white);
    room.readyPlayers.delete(room.white);
    if (room.pendingUndoRequester === room.white) {
      delete room.pendingUndoRequester;
    }
    delete room.white;
    delete room.whiteUserId;
    delete room.whiteDisconnectedAt;
    changed = true;
  }

  const shouldReleaseBlack = Boolean(
    room.black && (
      (room.blackDisconnectedAt && now - room.blackDisconnectedAt > blackSeatGraceMs)
      || (!blackConnected && !room.blackDisconnectedAt && !room.blackUserId)
    ),
  );

  if (shouldReleaseBlack && room.black) {
    room.colorChoices.delete(room.black);
    room.readyPlayers.delete(room.black);
    if (room.pendingUndoRequester === room.black) {
      delete room.pendingUndoRequester;
    }
    delete room.black;
    delete room.blackUserId;
    delete room.blackDisconnectedAt;
    changed = true;
  }

  const shouldReleaseOwner = Boolean(
    room.ownerId && (
      (room.ownerDisconnectedAt && now - room.ownerDisconnectedAt > ownerSeatGraceMs)
      || (!ownerConnected && !room.ownerDisconnectedAt && !ownerHasPersistentIdentity)
    ),
  );

  if (shouldReleaseOwner) {
    delete room.ownerId;
    delete room.ownerDisconnectedAt;
    changed = true;
  }

  if (!room.ownerId) {
    const nextOwner = room.white ?? room.black;
    if (nextOwner) {
      room.ownerId = nextOwner;
      delete room.ownerDisconnectedAt;
      changed = true;
    }
  }

  return changed;
}

function isFinishedStartedRoom(room: GameRoom): boolean {
  return room.isStarted && (Boolean(room.winner) || room.chess.isGameOver());
}

function getSeatDisconnectGraceMs(room: GameRoom, seatSocketId?: string): number {
  const baseGraceMs = isFinishedStartedRoom(room)
    ? POST_GAME_DISCONNECT_GRACE_MS
    : PLAYER_DISCONNECT_GRACE_MS;

  if (!isPersistedSeatPlaceholder(seatSocketId)) {
    return baseGraceMs;
  }

  return Math.max(baseGraceMs, PERSISTED_SEAT_RECOVERY_GRACE_MS);
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

function getFriendPresenceInfo(userId: string): FriendPresenceInfo {
  const connectedSocketIds = getConnectedUserSocketIds(userId);
  if (connectedSocketIds.length === 0) {
    return {
      status: "offline",
      roomId: null,
      canSpectate: false,
      canRequestJoin: false,
    };
  }

  let inRoomPresence: FriendPresenceInfo | null = null;
  let hasBotActivity = false;

  for (const socketId of connectedSocketIds) {
    const socket = io.sockets.sockets.get(socketId);
    const state = socket?.data as ClientState | undefined;
    if (normalizeFriendPresenceActivity(state?.friendPresenceActivity) === "playing-bot") {
      hasBotActivity = true;
    }

    if (!state?.roomId) {
      continue;
    }

    const room = rooms.get(state.roomId);
    if (!room) {
      inRoomPresence ??= {
        status: "in-room",
        roomId: state.roomId,
        canSpectate: false,
        canRequestJoin: false,
      };
      continue;
    }

    const liveRole = getLiveRoomRole(room, socketId);
    const isSeatedPlayer = liveRole === "w" || liveRole === "b";
    const bothPlayersSeated = Boolean(room.white && room.black);
    const exactlyOneSeatFilled = Boolean((room.white && !room.black) || (!room.white && room.black));
    const inPregameSetup = !room.isStarted;
    const inLiveGame = room.isStarted && !room.winner && !room.chess.isGameOver();
    const canSpectate = isSeatedPlayer && bothPlayersSeated && inLiveGame;
    const canRequestJoin = isSeatedPlayer && exactlyOneSeatFilled && inPregameSetup;

    if (canRequestJoin) {
      return {
        status: "in-room",
        roomId: room.id,
        canSpectate: false,
        canRequestJoin: true,
      };
    }

    if (canSpectate) {
      return {
        status: "in-room",
        roomId: room.id,
        canSpectate: true,
        canRequestJoin: false,
      };
    }

    inRoomPresence ??= {
      status: "in-room",
      roomId: room.id,
      canSpectate: false,
      canRequestJoin: false,
    };
  }

  if (inRoomPresence) {
    return inRoomPresence;
  }

  if (hasBotActivity) {
    return {
      status: "playing-bot",
      roomId: null,
      canSpectate: false,
      canRequestJoin: false,
    };
  }

  return {
    status: "online",
    roomId: null,
    canSpectate: false,
    canRequestJoin: false,
  };
}

function emitFriendPresenceToSocket(socketId: string): void {
  const watchedIds = watchedFriendIdsBySocket.get(socketId) ?? new Set<string>();
  const friends = [...watchedIds].map((userId) => {
    const presence = getFriendPresenceInfo(userId);
    return {
      userId,
      status: presence.status,
      roomId: presence.roomId,
      canSpectate: presence.canSpectate,
      canRequestJoin: presence.canRequestJoin,
    };
  });

  io.to(socketId).emit("friends:presence", { friends });
}

function buildFriendPresenceSignature(presence: FriendPresenceInfo): string {
  return `${presence.status}:${presence.roomId ?? "-"}:${presence.canSpectate ? "1" : "0"}:${presence.canRequestJoin ? "1" : "0"}`;
}

function notifyFriendWatchers(userId: string): void {
  const watchers = friendWatchersByUserId.get(userId);
  if (!watchers || watchers.size === 0) {
    return;
  }

  const currentPresence = getFriendPresenceInfo(userId);
  const nextSignature = buildFriendPresenceSignature(currentPresence);
  const previousSignature = cachedFriendPresenceByUserId.get(userId);
  if (previousSignature === nextSignature) {
    return;
  }

  cachedFriendPresenceByUserId.set(userId, nextSignature);

  for (const watcherSocketId of watchers) {
    emitFriendPresenceToSocket(watcherSocketId);
  }
}

function notifyFriendProfileWatchers(userId: string, displayName: string, friendId: string | null): void {
  const watchers = friendWatchersByUserId.get(userId);
  if (!watchers || watchers.size === 0) {
    return;
  }

  for (const watcherSocketId of watchers) {
    io.to(watcherSocketId).emit("friends:profile:update", {
      userId,
      displayName,
      friendId,
    });
  }
}

function notifyRoomParticipantPresence(room: GameRoom): void {
  const participantUserIds = new Set<string>();
  if (room.white) {
    const whiteUserId = getSocketUserId(room.white);
    if (whiteUserId) {
      participantUserIds.add(whiteUserId);
    }
  }

  if (room.black) {
    const blackUserId = getSocketUserId(room.black);
    if (blackUserId) {
      participantUserIds.add(blackUserId);
    }
  }

  for (const userId of participantUserIds) {
    notifyFriendWatchers(userId);
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
      whiteConnected: isSocketConnected(room.white),
      blackConnected: isSocketConnected(room.black),
      spectatorCount: getSpectatorCount(room.id, room),
      whiteName: getSocketDisplayName(room.white),
      blackName: getSocketDisplayName(room.black),
      whiteUserId: room.whiteUserId ?? (room.white ? getSocketUserId(room.white) : null),
      blackUserId: room.blackUserId ?? (room.black ? getSocketUserId(room.black) : null),
      whiteFriendId: room.white ? getSocketFriendId(room.white) : null,
      blackFriendId: room.black ? getSocketFriendId(room.black) : null,
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

function buildRoomShareUrl(socketId: string, room: GameRoom): string {
  const role = getLiveRoomRole(room, socketId);
  const inviteToken = role === "w" || role === "b" ? room.access.inviteLinkToken : null;
  return buildShareUrl(socketId, room.id, inviteToken);
}

function reconcileRoomPregameState(room: GameRoom): void {
  sanitizePregameSeatState({
    white: room.white,
    black: room.black,
    isStarted: room.isStarted,
    colorChoices: room.colorChoices,
    readyPlayers: room.readyPlayers,
  });
}

function emitSessionJoinForSeatedPlayers(room: GameRoom): void {
  if (room.white) {
    io.sockets.sockets.get(room.white)?.emit("session:joined", {
      roomId: room.id,
      role: "w",
      shareUrl: buildRoomShareUrl(room.white, room),
    });
  }

  if (room.black) {
    io.sockets.sockets.get(room.black)?.emit("session:joined", {
      roomId: room.id,
      role: "b",
      shareUrl: buildRoomShareUrl(room.black, room),
    });
  }
}

function resetRoomToPregame(room: GameRoom): void {
  room.chess.reset();
  room.isStarted = false;
  room.colorChoices.clear();
  room.readyPlayers.clear();
  room.rematchVotes.clear();
  room.analysisVotes.clear();
  room.labelsVotes.clear();
  room.analysisEnabled = false;
  room.analysisLabelsOnlyEnabled = false;
  delete room.pendingUndoRequester;
  delete room.winner;
  delete room.statusOverride;
  resetRoomClock(room);
  resetRoomChatConsent(room);
}

function maybeStartPregameMatch(room: GameRoom): boolean {
  if (!canStartPregameMatch({
    white: room.white,
    black: room.black,
    isStarted: room.isStarted,
    colorChoices: room.colorChoices,
    readyPlayers: room.readyPlayers,
  })) {
    return false;
  }

  room.isStarted = true;
  roomTrace("pregame-start", {
    roomId: room.id,
    white: room.white,
    black: room.black,
    whiteUserId: room.whiteUserId ?? null,
    blackUserId: room.blackUserId ?? null,
    whiteChoice: room.white ? room.colorChoices.get(room.white) ?? null : null,
    blackChoice: room.black ? room.colorChoices.get(room.black) ?? null : null,
  });
  resetRoomClock(room);

  const currentWhite = room.white;
  const currentBlack = room.black;
  const whiteChoice = currentWhite ? room.colorChoices.get(currentWhite) : null;
  if (whiteChoice === "b" && currentWhite && currentBlack) {
    room.white = currentBlack;
    room.black = currentWhite;

    const whiteUserId = room.whiteUserId ?? null;
    room.whiteUserId = room.blackUserId ?? null;
    room.blackUserId = whiteUserId;
  }

  if (room.white) {
    const whiteState = io.sockets.sockets.get(room.white)?.data as ClientState | undefined;
    if (whiteState) {
      whiteState.role = "w";
    }
  }

  if (room.black) {
    const blackState = io.sockets.sockets.get(room.black)?.data as ClientState | undefined;
    if (blackState) {
      blackState.role = "b";
    }
  }

  emitSessionJoinForSeatedPlayers(room);
  resetRoomChatConsent(room);
  emitChatState(room);
  if (room.white) {
    emitChatMessages(room.white, room);
  }
  if (room.black) {
    emitChatMessages(room.black, room);
  }
  startClock(room);
  return true;
}

function purgeRoomChatData(room: GameRoom, reason: "abandoned" | "room-closed"): void {
  const deletedCount = liveChatStore.deleteRoomMessages(room.id);
  resetRoomChatConsent(room);
  io.to(room.id).emit("chat:purged", { reason, deletedCount });
  emitChatState(room);
}

function emitRoomState(room: GameRoom): void {
  syncActiveClock(room);
  reconcileRoomPregameState(room);
  if (!room.isStarted) {
    maybeStartPregameMatch(room);
  }

  if (!isRoomOpenForJoinRequests(room)) {
    clearPendingRoomJoinRequestsForRoom(room, "Room no longer accepts join requests right now.");
  }

  if (isLiveCompetitiveMatch(room) && (room.analysisEnabled || room.analysisVotes.size > 0)) {
    room.analysisEnabled = false;
    room.analysisVotes.clear();
  }

  room.updatedAt = Date.now();
  persistRoomsToDisk();
  io.to(room.id).emit("room:state", buildSnapshot(room));
  notifyRoomParticipantPresence(room);
}

function closeRoom(room: GameRoom, reason: "abandoned" | "room-closed" = "room-closed"): void {
  purgeRoomChatData(room, reason);
  clearPendingRoomJoinRequestsForRoom(room, "Room closed before your join request could be accepted.");

  const socketsInRoom = io.sockets.adapter.rooms.get(room.id);
  if (socketsInRoom) {
    for (const socketId of socketsInRoom) {
      const memberSocket = io.sockets.sockets.get(socketId);
      if (!memberSocket) {
        continue;
      }

      memberSocket.leave(room.id);
      resetSocketState(socketId);
      memberSocket.emit("session:left", { roomId: room.id });
      memberSocket.emit("room:error", { message: "Room closed because both players left." });
    }
  }

  rooms.delete(room.id);
  persistRoomsToDisk();
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
  const socketUserId = getSocketUserId(socketId);

  for (const room of rooms.values()) {
    let changed = false;
    const shouldHoldSeat = !immediate;

    // Si es desconexión normal (no inmediata), marcar como "desconectado temporalmente"
    // permitiendo reconexión dentro del grace period
    if (room.white === socketId) {
      const canHoldWhiteSeat = shouldHoldSeat && Boolean(room.whiteUserId || socketUserId);
      if (canHoldWhiteSeat) {
        room.whiteUserId = room.whiteUserId ?? socketUserId;
        room.whiteDisconnectedAt = Date.now();
      } else {
        room.colorChoices.delete(socketId);
        delete room.white;
        delete room.whiteUserId;
        delete room.whiteDisconnectedAt;
      }
      changed = true;
    }

    if (room.black === socketId) {
      const canHoldBlackSeat = shouldHoldSeat && Boolean(room.blackUserId || socketUserId);
      if (canHoldBlackSeat) {
        room.blackUserId = room.blackUserId ?? socketUserId;
        room.blackDisconnectedAt = Date.now();
      } else {
        room.colorChoices.delete(socketId);
        delete room.black;
        delete room.blackUserId;
        delete room.blackDisconnectedAt;
      }
      changed = true;
    }

    if (room.ownerId === socketId) {
      if (shouldHoldSeat) {
        room.ownerDisconnectedAt = Date.now();
      } else {
        delete room.ownerId;
        delete room.ownerDisconnectedAt;
      }
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

    if (pruneDisconnectedRoomSeats(room, Date.now())) {
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

    if (bothDisconnected && noSpectators && immediate) {
      closeRoom(room, "abandoned");
      resetSocketState(socketId);
      continue;
    }

    emitRoomState(room);
    resetSocketState(socketId);
    return;
  }
}

function assignRole(room: GameRoom, socketId: string, allowSeatClaim = true): RoomRole {
  if (!allowSeatClaim) {
    room.spectators.add(socketId);
    return "spectator";
  }

  const socketUserId = getSocketUserId(socketId);
  if (!room.white) {
    room.spectators.delete(socketId);
    room.white = socketId;
    room.whiteUserId = socketUserId;
    resetRoomChatConsent(room);
    return "w";
  }

  if (!room.black) {
    room.spectators.delete(socketId);
    room.black = socketId;
    room.blackUserId = socketUserId;
    resetRoomChatConsent(room);
    return "b";
  }

  room.spectators.add(socketId);
  return "spectator";
}

function reclaimDisconnectedSeatForIdentity(
  room: GameRoom,
  socketId: string,
  userId: string,
): PlayerRole | null {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return null;
  }

  const now = Date.now();

  const tryReclaim = (role: PlayerRole): boolean => {
    const seatSocketId = role === "w" ? room.white : room.black;
    const seatUserId = role === "w" ? room.whiteUserId : room.blackUserId;
    const seatDisconnectedAt = role === "w" ? room.whiteDisconnectedAt : room.blackDisconnectedAt;
    if (!seatSocketId || seatUserId !== normalizedUserId) {
      return false;
    }

    if (seatSocketId === socketId) {
      return true;
    }

    const seatConnected = isSocketConnected(seatSocketId);
    const seatGraceMs = getSeatDisconnectGraceMs(room, seatSocketId);
    const stillRecoverable = !seatConnected && (
      !seatDisconnectedAt || now - seatDisconnectedAt < seatGraceMs
    );
    if (!stillRecoverable) {
      return false;
    }

    const ownerWasSeat = room.ownerId === seatSocketId;
    room.colorChoices.delete(seatSocketId);
    room.readyPlayers.delete(seatSocketId);
    if (room.pendingUndoRequester === seatSocketId) {
      delete room.pendingUndoRequester;
    }

    if (role === "w") {
      room.white = socketId;
      room.whiteUserId = normalizedUserId;
      delete room.whiteDisconnectedAt;
    } else {
      room.black = socketId;
      room.blackUserId = normalizedUserId;
      delete room.blackDisconnectedAt;
    }

    if (ownerWasSeat) {
      room.ownerId = socketId;
      delete room.ownerDisconnectedAt;
    }

    room.spectators.delete(socketId);
    return true;
  };

  if (tryReclaim("w")) {
    return "w";
  }
  if (tryReclaim("b")) {
    return "b";
  }

  return null;
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
  return [room.white, room.black].filter((value): value is string => isSocketConnected(value));
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

function isRoomOpenForJoinRequests(room: GameRoom): boolean {
  if (room.isStarted) {
    return false;
  }

  const hasExactlyOneSeatedPlayer = Boolean((room.white && !room.black) || (!room.white && room.black));
  return hasExactlyOneSeatedPlayer;
}

function findJoinRequestTargetRoom(targetUserId: string, requestedRoomId: string | null = null): GameRoom | null {
  const normalizedRoomId = requestedRoomId && ROOM_ID_PATTERN.test(requestedRoomId)
    ? requestedRoomId
    : null;

  const targetSockets = getConnectedUserSocketIds(targetUserId);
  for (const targetSocketId of targetSockets) {
    const room = getRoomForSocket(targetSocketId);
    if (!room) {
      continue;
    }

    if (normalizedRoomId && room.id !== normalizedRoomId) {
      continue;
    }

    const liveRole = getLiveRoomRole(room, targetSocketId);
    const isSeatedPlayer = liveRole === "w" || liveRole === "b";
    if (!isSeatedPlayer) {
      continue;
    }

    if (!isRoomOpenForJoinRequests(room)) {
      continue;
    }

    return room;
  }

  return null;
}

function emitRoomJoinRequestResultToRequester(
  request: StoredRoomJoinRequest,
  payload: {
    accepted: boolean;
    fromName: string;
    message: string;
    roomId?: string;
    inviteToken?: string | null;
  },
): void {
  const requesterSockets = getConnectedUserSocketIds(request.requesterUserId);
  if (requesterSockets.length === 0) {
    return;
  }

  for (const requesterSocketId of requesterSockets) {
    io.to(requesterSocketId).emit("friends:room-join:response", {
      requestId: request.requestId,
      accepted: payload.accepted,
      fromName: payload.fromName,
      roomId: payload.roomId,
      inviteToken: payload.inviteToken ?? null,
      message: payload.message,
    });
  }
}

function emitPendingRoomJoinRequestsForUser(targetUserId: string): void {
  const pendingRequests = roomJoinRequestStore.getPendingForTarget(targetUserId);
  if (pendingRequests.length === 0) {
    return;
  }

  const targetSockets = getConnectedUserSocketIds(targetUserId);
  if (targetSockets.length === 0) {
    return;
  }

  for (const request of pendingRequests) {
    const requestableRoom = findJoinRequestTargetRoom(targetUserId, request.roomId);
    if (!requestableRoom) {
      roomJoinRequestStore.delete(request.requestId);
      emitRoomJoinRequestResultToRequester(request, {
        accepted: false,
        fromName: "Room host",
        message: "Join request expired because the room is no longer available.",
      });
      continue;
    }

    for (const targetSocketId of targetSockets) {
      io.to(targetSocketId).emit("friends:room-join:incoming", {
        requestId: request.requestId,
        fromUserId: request.requesterUserId,
        fromName: request.requesterName,
        roomId: request.roomId,
      });
    }
  }
}

function clearPendingRoomJoinRequestsForRoom(room: GameRoom, message: string): void {
  const pendingRequests = roomJoinRequestStore.getPendingForRoom(room.id);
  if (pendingRequests.length === 0) {
    return;
  }

  const sourceSocketId = room.ownerId ?? room.white ?? room.black;
  const sourceName = sourceSocketId ? getSocketDisplayName(sourceSocketId) : "Room host";

  for (const request of pendingRequests) {
    roomJoinRequestStore.delete(request.requestId);
    emitRoomJoinRequestResultToRequester(request, {
      accepted: false,
      fromName: sourceName,
      message,
    });
  }
}

restoreRoomsFromDisk();

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [roomId, room] of rooms.entries()) {
    let changed = false;

    if (pruneDisconnectedRoomSeats(room, now)) {
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

  for (const [requestId, request] of pendingFriendRequests.entries()) {
    if (now - request.createdAt > FRIEND_INVITE_EXPIRY_MS) {
      pendingFriendRequests.delete(requestId);
    }
  }

  const expiredRoomJoinRequests = roomJoinRequestStore.pruneExpired(ROOM_JOIN_REQUEST_EXPIRY_MS, now);
  for (const request of expiredRoomJoinRequests) {
    emitRoomJoinRequestResultToRequester(request, {
      accepted: false,
      fromName: "Room host",
      message: "Join request expired.",
    });
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

  socket.on("profile:setName", (payload?: { name?: string; userId?: string | null; email?: string | null; friendId?: string | null; usernameChangeCount?: number }) => {
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

    if (/\s/.test(trimmed)) {
      socket.emit("room:error", { message: "Username cannot contain spaces." });
      return;
    }

    const state = socket.data as ClientState;
    const previousUserId = normalizeUserId(state.userId);
    const previousDisplayName = state.displayName?.trim() ?? "";
    const normalizedUserId = normalizeUserId(payload?.userId);
    const normalizedEmail = normalizeEmail(payload?.email);
    const normalizedFriendId = normalizeFriendId(payload?.friendId);
    const requestedChangeCount = normalizeUsernameChangeCount(payload?.usernameChangeCount);
    const emitProfileApplied = (): void => {
      socket.emit("profile:setName:applied", { userId: normalizedUserId || null });
    };

    if (normalizedUserId) {
      const previousCount = normalizeUsernameChangeCount(state.usernameChangeCount);
      const nextCount = Math.max(previousCount, requestedChangeCount);
      const lockedUsername = lockedUsernameByUserId.get(normalizedUserId);
      const requestedUsernameKey = trimmed.toLowerCase();
      const keyOwnerUserId = lockedUsernameOwnerByKey.get(requestedUsernameKey);

      if (keyOwnerUserId && keyOwnerUserId !== normalizedUserId) {
        socket.emit("room:error", { message: "Username already taken." });
        return;
      }

      if (lockedUsername && trimmed !== lockedUsername) {
        socket.emit("room:error", { message: "Username can only be changed once per account." });
        return;
      }

      if (
        nextCount >= 1
        && previousDisplayName
        && previousDisplayName !== "Guest"
        && trimmed !== previousDisplayName
      ) {
        socket.emit("room:error", { message: "Username can only be changed once per account." });
        return;
      }

      state.usernameChangeCount = nextCount;
    } else {
      delete state.usernameChangeCount;
    }

    state.displayName = trimmed;

    if (normalizedUserId) {
      state.userId = normalizedUserId;
      if (normalizedEmail) {
        state.email = normalizedEmail;
      } else {
        delete state.email;
      }
      if (normalizedFriendId) {
        state.friendId = normalizedFriendId;
      } else {
        delete state.friendId;
      }
      registerSocketUserIdentity(socket.id, normalizedUserId);
    } else {
      delete state.userId;
      delete state.email;
      delete state.friendId;
      clearSocketUserIdentity(socket.id);
    }

    if (normalizedUserId && normalizeUsernameChangeCount(state.usernameChangeCount) >= 1) {
      const previousLockedUsername = lockedUsernameByUserId.get(normalizedUserId);
      if (previousLockedUsername && previousLockedUsername.toLowerCase() !== trimmed.toLowerCase()) {
        lockedUsernameOwnerByKey.delete(previousLockedUsername.toLowerCase());
      }
      lockedUsernameByUserId.set(normalizedUserId, trimmed);
      lockedUsernameOwnerByKey.set(trimmed.toLowerCase(), normalizedUserId);
    }

    if (!normalizedUserId || previousUserId !== normalizedUserId) {
      clearKnownFriendsForSocket(socket.id);
    }

    if (normalizedUserId && trimmed !== previousDisplayName) {
      notifyFriendProfileWatchers(normalizedUserId, trimmed, normalizedFriendId);
    }

    const room = getRoomForSocket(socket.id);
    if (room) {
      let liveRole = getLiveRoomRole(room, socket.id);
      const isSeatedPlayer = liveRole === "w" || liveRole === "b";
      if (!normalizedUserId && isSeatedPlayer) {
        removeFromRoom(socket.id, true);
        socket.emit("session:left", { roomId: room.id });
        socket.emit("room:error", { message: "Guest mode is spectator-only online. Sign in to play online PvP." });
        emitProfileApplied();
        return;
      }

      if (normalizedUserId && liveRole === "spectator") {
        const reclaimedRole = reclaimDisconnectedSeatForIdentity(room, socket.id, normalizedUserId);
        if (reclaimedRole) {
          const stateAfterReclaim = socket.data as ClientState;
          stateAfterReclaim.role = reclaimedRole;
          stateAfterReclaim.roomId = room.id;
          socket.emit("session:joined", {
            roomId: room.id,
            role: reclaimedRole,
            shareUrl: buildRoomShareUrl(socket.id, room),
          });
          emitRoomState(room);
          emitProfileApplied();
          return;
        }
      }

      if (room.white === socket.id) {
        room.whiteUserId = normalizedUserId ?? null;
      }
      if (room.black === socket.id) {
        room.blackUserId = normalizedUserId ?? null;
      }
      emitRoomState(room);
    }

    if (normalizedUserId) {
      emitPendingRoomJoinRequestsForUser(normalizedUserId);
    }

    emitProfileApplied();
  });

  socket.on("friends:watch", (payload?: { friendIds?: string[] }) => {
    const friendIds = Array.isArray(payload?.friendIds) ? payload.friendIds : [];
    setFriendWatchForSocket(socket.id, friendIds);
  });

  socket.on("friends:state", (payload?: {
    userId?: string | null;
    friendUserIds?: string[];
    activity?: FriendPresenceActivity | null;
  }) => {
    const senderUserId = getSocketUserId(socket.id);
    if (!senderUserId) {
      clearKnownFriendsForSocket(socket.id);
      return;
    }

    const payloadUserId = normalizeUserId(payload?.userId);
    if (payloadUserId && payloadUserId !== senderUserId) {
      roomTrace("friends-state-mismatch", {
        socketId: socket.id,
        senderUserId,
        payloadUserId,
      });
      return;
    }

    const friendUserIds = Array.isArray(payload?.friendUserIds) ? payload.friendUserIds : [];
    setKnownFriendsForSocket(socket.id, friendUserIds);

    const clientState = socket.data as ClientState;
    const previousActivity = normalizeFriendPresenceActivity(clientState.friendPresenceActivity);
    const nextActivity = normalizeFriendPresenceActivity(payload?.activity);
    if (nextActivity) {
      clientState.friendPresenceActivity = nextActivity;
    } else {
      delete clientState.friendPresenceActivity;
    }

    if (previousActivity !== nextActivity) {
      notifyFriendWatchers(senderUserId);
    }
  });

  socket.on("friends:notification:request", (payload?: {
    toUserId?: string;
    requestId?: string;
    fromDisplayName?: string;
  }) => {
    const senderUserId = getSocketUserId(socket.id);
    if (!senderUserId) {
      return;
    }

    const toUserId = normalizeUserId(payload?.toUserId);
    const requestId = normalizeUserId(payload?.requestId);
    const fromDisplayName = typeof payload?.fromDisplayName === "string"
      ? payload.fromDisplayName.trim().slice(0, 24)
      : "";

    if (!toUserId || !requestId || toUserId === senderUserId) {
      return;
    }

    const recipientSockets = getConnectedUserSocketIds(toUserId);
    for (const recipientSocketId of recipientSockets) {
      io.to(recipientSocketId).emit("friends:notification:request", {
        requestId,
        fromUserId: senderUserId,
        fromDisplayName: fromDisplayName || getSocketDisplayName(socket.id),
      });
    }
  });

  socket.on("friends:notification:response", (payload?: {
    toUserId?: string;
    requestId?: string;
    accepted?: boolean;
    fromDisplayName?: string;
  }) => {
    const senderUserId = getSocketUserId(socket.id);
    if (!senderUserId) {
      return;
    }

    const toUserId = normalizeUserId(payload?.toUserId);
    const requestId = normalizeUserId(payload?.requestId);
    const fromDisplayName = typeof payload?.fromDisplayName === "string"
      ? payload.fromDisplayName.trim().slice(0, 24)
      : "";

    if (!toUserId || !requestId || toUserId === senderUserId || typeof payload?.accepted !== "boolean") {
      return;
    }

    const recipientSockets = getConnectedUserSocketIds(toUserId);
    for (const recipientSocketId of recipientSockets) {
      io.to(recipientSocketId).emit("friends:notification:response", {
        requestId,
        accepted: payload.accepted,
        fromUserId: senderUserId,
        fromDisplayName: fromDisplayName || getSocketDisplayName(socket.id),
      });
    }
  });

  socket.on("friends:invite:send", async (payload?: { toUserId?: string; toEmail?: string | null }) => {
    const onlinePermissions = getOnlineMultiplayerPermissions(socket.id);
    if (!onlinePermissions.canUseInviteSystem) {
      socket.emit("room:error", { message: "Guest accounts cannot send online invites." });
      return;
    }

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

    if (room.white !== socket.id && room.black !== socket.id) {
      socket.emit("room:error", { message: "Only seated players can invite users to this room." });
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
    const inviteToken = room.access.inviteLinkToken;
    const shareUrl = buildShareUrl(socket.id, room.id, inviteToken);
    roomTrace("invite-send", {
      roomId: room.id,
      inviteId,
      fromUserId: senderUserId,
      toUserId,
      inviteToken,
      senderSocketId: socket.id,
    });
    grantDirectRoomInvite(room.access, toUserId, true);
    persistRoomsToDisk();
    pendingFriendInvites.set(inviteId, {
      inviteId,
      fromUserId: senderUserId,
      toUserId,
      roomId: room.id,
      inviteToken,
      fromName,
      createdAt: Date.now(),
    });

    const recipientSockets = getConnectedUserSocketIds(toUserId);
    if (recipientSockets.length > 0) {
      for (const recipientSocketId of recipientSockets) {
        io.to(recipientSocketId).emit("friends:invite:incoming", {
          inviteId,
          fromUserId: senderUserId,
          fromName,
          roomId: room.id,
          inviteToken,
        });
      }

      socket.emit("friends:invite:sent", { toUserId, delivery: "realtime" });
      roomTrace("invite-send-delivery", {
        roomId: room.id,
        inviteId,
        toUserId,
        delivery: "realtime",
        recipientSocketCount: recipientSockets.length,
      });
      return;
    }

    const toEmail = normalizeEmail(payload?.toEmail);
    if (!toEmail) {
      socket.emit("room:error", { message: "Friend is offline and has no email on file for Gmail invites." });
      return;
    }

    if (!canSendFriendInviteEmail()) {
      socket.emit("room:error", { message: getGmailInviteConfigErrorMessage() });
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
      roomTrace("invite-send-delivery", {
        roomId: room.id,
        inviteId,
        toUserId,
        delivery: "email",
      });
    } catch (error) {
      const details = error instanceof Error ? error.message.trim() : "";
      socket.emit("room:error", { message: details ? `Could not send Gmail invite: ${details}` : "Could not send Gmail invite right now." });
      roomTrace("invite-send-error", {
        roomId: room.id,
        inviteId,
        toUserId,
        details,
      });
    }
  });

  socket.on("friends:invite:respond", (payload?: { inviteId?: string; fromUserId?: string; accepted?: boolean }) => {
    const onlinePermissions = getOnlineMultiplayerPermissions(socket.id);
    if (!onlinePermissions.canUseInviteSystem) {
      socket.emit("room:error", { message: "Guest accounts cannot respond to online invites." });
      return;
    }

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
    if (!receiverUserId) {
      socket.emit("room:error", { message: "Sign in to respond to invitations." });
      return;
    }

    const pendingInvite = pendingFriendInvites.get(inviteId);
    roomTrace("invite-respond", {
      inviteId,
      fromUserId,
      receiverUserId,
      accepted: payload.accepted,
      hasPendingInvite: Boolean(pendingInvite),
    });
    if (!pendingInvite) {
      socket.emit("room:error", { message: "Invitation has expired." });
      return;
    }

    if (pendingInvite.toUserId !== receiverUserId || pendingInvite.fromUserId !== fromUserId) {
      socket.emit("room:error", { message: "Invitation does not match this account." });
      return;
    }

    if (payload.accepted) {
      const room = rooms.get(pendingInvite.roomId);
      if (room) {
        grantDirectRoomInvite(room.access, receiverUserId, true);
        persistRoomsToDisk();
        roomTrace("invite-respond-grant", {
          roomId: room.id,
          inviteId,
          receiverUserId,
          fromUserId,
        });
      }
    }

    pendingFriendInvites.delete(inviteId);

    const senderSockets = getConnectedUserSocketIds(fromUserId);
    if (senderSockets.length === 0) {
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

  socket.on("friends:request:send", (payload?: { toUserId?: string }) => {
    const senderUserId = getSocketUserId(socket.id);
    const senderFriendId = getSocketFriendId(socket.id);
    if (!senderUserId || !senderFriendId) {
      socket.emit("room:error", { message: "Sign in with an account before sending friend requests." });
      return;
    }

    const room = getRoomForSocket(socket.id);
    if (!room || !room.isStarted) {
      socket.emit("room:error", { message: "Friend requests are available during active multiplayer games." });
      return;
    }

    if (room.white !== socket.id && room.black !== socket.id) {
      socket.emit("room:error", { message: "Only seated players can send friend requests." });
      return;
    }

    const opponentSocketId = getOpponentSocketId(room, socket.id);
    if (!opponentSocketId) {
      socket.emit("room:error", { message: "No opponent connected yet." });
      return;
    }

    const opponentUserId = getSocketUserId(opponentSocketId);
    if (!opponentUserId) {
      socket.emit("room:error", { message: "Opponent is playing as guest and cannot receive friend requests." });
      return;
    }

    const payloadToUserId = normalizeUserId(payload?.toUserId);
    if (payloadToUserId && payloadToUserId !== opponentUserId) {
      socket.emit("room:error", { message: "Friend request target does not match the current opponent." });
      return;
    }

    if (opponentUserId === senderUserId) {
      socket.emit("room:error", { message: "You cannot send a friend request to yourself." });
      return;
    }

    if (areKnownFriendsForSocket(socket.id, opponentUserId) || areKnownFriendsForSocket(opponentSocketId, senderUserId)) {
      socket.emit("room:error", { message: "You and your opponent are already friends." });
      return;
    }

    const requestId = randomUUID();
    const fromName = getSocketDisplayName(socket.id);
    pendingFriendRequests.set(requestId, {
      requestId,
      fromUserId: senderUserId,
      fromName,
      fromFriendId: senderFriendId,
      toUserId: opponentUserId,
      createdAt: Date.now(),
    });

    io.to(opponentSocketId).emit("friends:request:incoming", {
      requestId,
      fromUserId: senderUserId,
      fromFriendId: senderFriendId,
      fromName,
    });

    socket.emit("friends:request:sent", { toUserId: opponentUserId });
  });

  socket.on("friends:request:respond", (payload?: { requestId?: string; fromUserId?: string; accepted?: boolean }) => {
    if (typeof payload?.accepted !== "boolean") {
      socket.emit("room:error", { message: "Invalid friend request response." });
      return;
    }

    const requestId = normalizeUserId(payload?.requestId);
    const fromUserId = normalizeUserId(payload?.fromUserId);
    if (!requestId || !fromUserId) {
      socket.emit("room:error", { message: "Invalid friend request response." });
      return;
    }

    const receiverUserId = getSocketUserId(socket.id);
    if (!receiverUserId) {
      socket.emit("room:error", { message: "Only signed-in players can respond to friend requests." });
      return;
    }

    const pendingRequest = pendingFriendRequests.get(requestId);
    if (!pendingRequest) {
      socket.emit("room:error", { message: "Friend request has expired." });
      return;
    }

    if (pendingRequest.toUserId !== receiverUserId || pendingRequest.fromUserId !== fromUserId) {
      socket.emit("room:error", { message: "Friend request does not match this account." });
      return;
    }

    pendingFriendRequests.delete(requestId);

    const senderSockets = getConnectedUserSocketIds(fromUserId);
    if (senderSockets.length === 0) {
      return;
    }

    const friendName = getSocketDisplayName(socket.id);
    const friendId = getSocketFriendId(socket.id);
    for (const senderSocketId of senderSockets) {
      io.to(senderSocketId).emit("friends:request:response", {
        accepted: payload.accepted,
        friendName,
        friendId,
      });
    }
  });

  socket.on("friends:room-join:request", (payload?: { toUserId?: string; roomId?: string }) => {
    const onlinePermissions = getOnlineMultiplayerPermissions(socket.id);
    if (!onlinePermissions.canPlayOnlineMatches) {
      socket.emit("room:error", { message: "Sign in to request joining a friend's room." });
      return;
    }

    const requesterUserId = getSocketUserId(socket.id);
    if (!requesterUserId) {
      socket.emit("room:error", { message: "Sign in to request joining a friend's room." });
      return;
    }

    const toUserId = normalizeUserId(payload?.toUserId);
    if (!toUserId) {
      socket.emit("room:error", { message: "Invalid friend target for join request." });
      return;
    }

    if (toUserId === requesterUserId) {
      socket.emit("room:error", { message: "You cannot request to join your own room." });
      return;
    }

    if (!areLikelyFriendsForJoinRequest(socket.id, requesterUserId, toUserId)) {
      socket.emit("room:error", { message: "Join requests are only available for friends in your list." });
      return;
    }

    const normalizedRequestedRoomId = typeof payload?.roomId === "string"
      ? payload.roomId.trim()
      : "";
    const requestedRoomId = ROOM_ID_PATTERN.test(normalizedRequestedRoomId)
      ? normalizedRequestedRoomId
      : null;

    const room = findJoinRequestTargetRoom(toUserId, requestedRoomId);
    if (!room) {
      socket.emit("room:error", { message: "This room is not accepting join requests right now." });
      return;
    }

    if (room.whiteUserId === requesterUserId || room.blackUserId === requesterUserId) {
      socket.emit("room:error", { message: "You are already in that room." });
      return;
    }

    const duplicateRequest = roomJoinRequestStore.findDuplicatePending({
      requesterUserId,
      targetUserId: toUserId,
      roomId: room.id,
    });
    if (duplicateRequest) {
      socket.emit("room:error", { message: "A join request for that room is already pending." });
      return;
    }

    const requestId = randomUUID();
    const requesterName = getSocketDisplayName(socket.id);
    const requestRecord: StoredRoomJoinRequest = {
      requestId,
      roomId: room.id,
      requesterUserId,
      targetUserId: toUserId,
      requesterName,
      createdAt: Date.now(),
    };
    roomJoinRequestStore.save(requestRecord);

    const targetSockets = getConnectedUserSocketIds(toUserId);
    for (const targetSocketId of targetSockets) {
      io.to(targetSocketId).emit("friends:room-join:incoming", {
        requestId,
        fromUserId: requesterUserId,
        fromName: requesterName,
        roomId: room.id,
      });
    }

    socket.emit("friends:room-join:requested", {
      requestId,
      toUserId,
      roomId: room.id,
    });
  });

  socket.on("friends:room-join:respond", (payload?: { requestId?: string; fromUserId?: string; accepted?: boolean }) => {
    if (typeof payload?.accepted !== "boolean") {
      socket.emit("room:error", { message: "Invalid join request response." });
      return;
    }

    const targetUserId = getSocketUserId(socket.id);
    if (!targetUserId) {
      socket.emit("room:error", { message: "Sign in to respond to join requests." });
      return;
    }

    const requestId = normalizeUserId(payload?.requestId);
    const fromUserId = normalizeUserId(payload?.fromUserId);
    if (!requestId || !fromUserId) {
      socket.emit("room:error", { message: "Invalid join request response." });
      return;
    }

    const request = roomJoinRequestStore.getById(requestId);
    if (!request) {
      socket.emit("room:error", { message: "Join request has expired." });
      return;
    }

    if (request.targetUserId !== targetUserId || request.requesterUserId !== fromUserId) {
      socket.emit("room:error", { message: "Join request does not match this account." });
      return;
    }

    roomJoinRequestStore.delete(requestId);
    const responderName = getSocketDisplayName(socket.id);

    if (!payload.accepted) {
      emitRoomJoinRequestResultToRequester(request, {
        accepted: false,
        fromName: responderName,
        message: `${responderName} declined your join request.`,
      });
      return;
    }

    const room = findJoinRequestTargetRoom(targetUserId, request.roomId);
    if (!room) {
      emitRoomJoinRequestResultToRequester(request, {
        accepted: false,
        fromName: responderName,
        message: "Room is no longer available for join requests.",
      });
      return;
    }

    grantDirectRoomInvite(room.access, request.requesterUserId, true);
    persistRoomsToDisk();
    emitRoomJoinRequestResultToRequester(request, {
      accepted: true,
      fromName: responderName,
      roomId: room.id,
      inviteToken: room.access.inviteLinkToken,
      message: `${responderName} accepted your join request. Joining room ${room.id}...`,
    });
  });

  socket.on("room:create", () => {
    const onlinePermissions = getOnlineMultiplayerPermissions(socket.id);
    if (!onlinePermissions.canPlayOnlineMatches) {
      socket.emit("room:error", { message: "Guest mode is spectator-only online. Sign in to create a PvP room." });
      return;
    }

    // Creating a new room is an intentional leave from any previous room.
    // Detach immediately to avoid stale seat/owner references across rooms.
    removeFromRoom(socket.id, true);
    const roomId = createRoomCode();
    const room: GameRoom = {
      id: roomId,
      chess: new Chess(),
      white: socket.id,
      whiteUserId: getSocketUserId(socket.id),
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
      access: createRoomAccessState(),
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
      shareUrl: buildRoomShareUrl(socket.id, room),
    });
    roomTrace("create", {
      roomId,
      ownerSocketId: socket.id,
      ownerUserId: getSocketUserId(socket.id),
      inviteToken: room.access.inviteLinkToken,
    });

    emitRoomState(room);
    emitChatState(room);
    emitChatMessages(socket.id, room);
  });

  socket.on("room:join", (payload?: { roomId?: string; inviteToken?: string; spectateOnly?: boolean }) => {
    const roomId = payload?.roomId?.trim();
    if (!roomId) {
      socket.emit("room:error", { message: "Enter a room ID first." });
      return;
    }

    if (!ROOM_ID_PATTERN.test(roomId)) {
      socket.emit("room:error", { message: "Room ID must be exactly 4 digits." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: `Room ${roomId} does not exist.` });
      return;
    }

    const joinInviteToken = typeof payload?.inviteToken === "string"
      ? payload.inviteToken.trim() || null
      : null;
    const requestedSpectateOnly = payload?.spectateOnly === true;
    const onlinePermissions = getOnlineMultiplayerPermissions(socket.id);
    const requesterUserId = getSocketUserId(socket.id);
    const isSocketMember = room.white === socket.id || room.black === socket.id || room.spectators.has(socket.id);
    const isSeatedIdentityMember = Boolean(
      requesterUserId
      && (requesterUserId === room.whiteUserId || requesterUserId === room.blackUserId),
    );
    const enforceSpectatorOnly = (requestedSpectateOnly || !onlinePermissions.canPlayOnlineMatches) && !isSeatedIdentityMember;
    const isInvitedPlayerCandidate = Boolean(
      requesterUserId && room.access.invitedUserIds.has(requesterUserId),
    );
    const isAlreadyMember = Boolean(isSocketMember || isSeatedIdentityMember);
    const joinAuthorization = enforceSpectatorOnly
      ? null
      : evaluateRoomJoinAuthorization({
          access: room.access,
          userId: requesterUserId,
          inviteToken: joinInviteToken,
          isAlreadyMember,
        });
    roomTrace("join-auth", {
      roomId,
      socketId: socket.id,
      requesterUserId,
      requestedSpectateOnly,
      enforceSpectatorOnly,
      accountRole: onlinePermissions.accountRole,
      isSocketMember,
      isSeatedIdentityMember,
      isInvitedPlayerCandidate,
      authAllowed: joinAuthorization?.allowed ?? true,
      authSource: joinAuthorization?.source ?? null,
    });
    if (!enforceSpectatorOnly && (!joinAuthorization?.allowed || !joinAuthorization.source)) {
      socket.emit("room:error", { message: joinAuthorization?.reason ?? "You are not allowed to join this room." });
      return;
    }

    if (requesterUserId && joinAuthorization?.source === "invite-link") {
      grantDirectRoomInvite(room.access, requesterUserId, true);
      persistRoomsToDisk();
    }

    pruneDisconnectedRoomSeats(room, Date.now());

    // Joining another room is also an intentional leave from the current one.
    removeFromRoom(socket.id, true);

    socket.join(roomId);
    
    // Intentar reconectarse si está dentro del grace period y con la misma identidad.
    let role: RoomRole = "spectator";
    if (enforceSpectatorOnly) {
      room.spectators.add(socket.id);
    } else {
      const ownerWasWhite = room.ownerId && room.white === room.ownerId;
      const ownerWasBlack = room.ownerId && room.black === room.ownerId;

      const now = Date.now();
      const whiteSeatGraceMs = getSeatDisconnectGraceMs(room, room.white);
      const blackSeatGraceMs = getSeatDisconnectGraceMs(room, room.black);
      const canReclaimWhite = Boolean(
        room.white
        && room.whiteDisconnectedAt
        && now - room.whiteDisconnectedAt < whiteSeatGraceMs
        && room.whiteUserId
        && requesterUserId
        && requesterUserId === room.whiteUserId,
      );
      const canReclaimBlack = Boolean(
        room.black
        && room.blackDisconnectedAt
        && now - room.blackDisconnectedAt < blackSeatGraceMs
        && room.blackUserId
        && requesterUserId
        && requesterUserId === room.blackUserId,
      );
      if (canReclaimWhite) {
        role = "w";
        room.white = socket.id;
        if (ownerWasWhite) {
          room.ownerId = socket.id;
          delete room.ownerDisconnectedAt;
        }
        room.spectators.delete(socket.id);
        delete room.whiteDisconnectedAt;
      } else if (canReclaimBlack) {
        role = "b";
        room.black = socket.id;
        if (ownerWasBlack) {
          room.ownerId = socket.id;
          delete room.ownerDisconnectedAt;
        }
        room.spectators.delete(socket.id);
        delete room.blackDisconnectedAt;
      } else {
        const allowSeatClaim = Boolean(
          joinAuthorization?.source === "invite-link"
          || joinAuthorization?.source === "direct-invite"
          || isSeatedIdentityMember
          || isInvitedPlayerCandidate
          || room.ownerId === socket.id,
        );
        role = assignRole(room, socket.id, allowSeatClaim);
      }
    }

    roomTrace("join-role", {
      roomId,
      socketId: socket.id,
      requesterUserId,
      requestedSpectateOnly,
      enforceSpectatorOnly,
      accountRole: onlinePermissions.accountRole,
      role,
      allowSeatByInvite: isInvitedPlayerCandidate,
      white: room.white,
      black: room.black,
      whiteUserId: room.whiteUserId,
      blackUserId: room.blackUserId,
    });

    if (role === "spectator" && !enforceSpectatorOnly) {
      const authSource = joinAuthorization?.source;
      if (!authSource) {
        room.spectators.delete(socket.id);
        socket.leave(roomId);
        socket.emit("room:error", { message: "Spectator access could not be validated." });
        return;
      }

      const canSpectate = canJoinAsSpectator({
        access: room.access,
        userId: requesterUserId,
        authSource,
      });
      if (!canSpectate) {
        room.spectators.delete(socket.id);
        socket.leave(roomId);
        socket.emit("room:error", { message: "Spectator access requires explicit approval from a seated player." });
        return;
      }
      if (requesterUserId) {
        room.access.allowedSpectatorUserIds.add(requesterUserId);
        persistRoomsToDisk();
      }
    }

    const clientState = socket.data as ClientState;
    clientState.roomId = roomId;
    clientState.role = role;
    notifySocketOwnerPresence(socket.id);

    socket.emit("session:joined", {
      roomId,
      role,
      shareUrl: buildRoomShareUrl(socket.id, room),
    });
    roomTrace("join-final", {
      roomId,
      socketId: socket.id,
      requesterUserId,
      requestedSpectateOnly,
      enforceSpectatorOnly,
      accountRole: onlinePermissions.accountRole,
      role,
      authSource: joinAuthorization?.source ?? (enforceSpectatorOnly ? "spectate-only" : null),
      white: room.white,
      black: room.black,
      whiteUserId: room.whiteUserId,
      blackUserId: room.blackUserId,
      spectatorCount: room.spectators.size,
    });

    emitRoomState(room);
    emitChatState(room);
    if (role === "w" || role === "b") {
      emitChatMessages(socket.id, room);
    }
  });

  socket.on("room:leave", (ack?: () => void) => {
    const room = getRoomForSocket(socket.id);
    if (!room) {
      ack?.();
      return;
    }

    socket.leave(room.id);
    removeFromRoom(socket.id, true);
    socket.emit("session:left", { roomId: room.id });
    ack?.();
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

  socket.on("room:settings", () => {
    const clientState = socket.data as ClientState;
    const roomId = clientState.roomId;

    if (!roomId) {
      socket.emit("room:error", { message: "Join a room before opening settings." });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room:error", { message: "The room is no longer available." });
      return;
    }

    const liveRole = getLiveRoomRole(room, socket.id);
    if (!liveRole || liveRole === "spectator") {
      socket.emit("room:error", { message: "Only seated players can open room settings." });
      return;
    }

    if (room.ownerId !== socket.id) {
      socket.emit("room:error", { message: "Only the room creator can change game settings." });
      return;
    }

    if (!room.isStarted) {
      emitRoomState(room);
      return;
    }

    resetRoomToPregame(room);
    emitSessionJoinForSeatedPlayers(room);
    emitRoomState(room);
    emitChatState(room);
    if (room.white) {
      emitChatMessages(room.white, room);
    }
    if (room.black) {
      emitChatMessages(room.black, room);
    }
  });

  socket.on("pregame:mode", (payload?: { mode?: TimeControlPresetId }) => {
    if (!payload || !isTimeControlPresetId(payload.mode)) {
      socket.emit("room:error", { message: "Invalid game mode." });
      return;
    }

    const room = getRoomForSocket(socket.id);
    if (!room) {
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

    if (room.isStarted) {
      socket.emit("room:error", { message: "Open Settings first to return to room setup." });
      return;
    }

    room.timeControl = payload.mode;
    room.colorChoices.clear();
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

    if (room.readyPlayers.has(socket.id)) {
      room.readyPlayers.delete(socket.id);
      emitRoomState(room);
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
      socket.emit("room:error", { message: PREGAME_COLOR_CONFLICT_ERROR });
      return;
    }

    room.readyPlayers.add(socket.id);
    maybeStartPregameMatch(room);
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

    if (!isFinishedStartedRoom(room)) {
      socket.emit("room:error", { message: "Rematch is only available after a game finishes." });
      return;
    }

    room.rematchVotes.add(socket.id);
    const players = getActivePlayerSockets(room);

    
   if (players.length === 2 && players.every((playerId) => room.rematchVotes.has(playerId))) {
      room.chess.reset();
      room.isStarted = true;
      room.rematchVotes.clear();
      room.analysisVotes.clear();
      room.labelsVotes.clear();
      room.analysisEnabled = false;
      room.analysisLabelsOnlyEnabled = false;
      room.colorChoices.clear();
      room.readyPlayers.clear();
      delete room.pendingUndoRequester;
      delete room.winner;
      delete room.statusOverride;
      resetRoomClock(room);
      startClock(room);
    }

    emitRoomState(room); 
  });

  socket.on("disconnect", () => {
    removeFromRoom(socket.id, false); // false = no es inmediato, aplicar grace period
    clearFriendWatchForSocket(socket.id);
    clearKnownFriendsForSocket(socket.id);
    clearSocketUserIdentity(socket.id);
  });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Realtime chess server listening on http://localhost:${port}`);
});
