import fs from "node:fs";
import path from "node:path";

type PlayerRole = "w" | "b";
type TimeControlPresetId = "bullet1" | "bullet2p1" | "blitz3" | "blitz3p2" | "blitz5" | "rapid10" | "rapid15p10";

export type PersistedRoomAccessState = {
  inviteLinkToken: string;
  invitedUserIds: string[];
  allowedSpectatorUserIds: string[];
};

export type PersistedRoomState = {
  id: string;
  movesSan: string[];
  whiteUserId: string | null;
  blackUserId: string | null;
  ownerUserId: string | null;
  winner: PlayerRole | null;
  statusOverride: string | null;
  whiteDisconnectedAt: number | null;
  blackDisconnectedAt: number | null;
  ownerDisconnectedAt: number | null;
  updatedAt: number;
  isStarted: boolean;
  analysisEnabled: boolean;
  analysisLabelsOnlyEnabled: boolean;
  timeControl: TimeControlPresetId;
  clockWhiteMs: number;
  clockBlackMs: number;
  clockActive: PlayerRole | null;
  clockRunning: boolean;
  clockLastUpdatedAt: number;
  voiceWAcceptsB: boolean;
  voiceBAcceptsW: boolean;
  whiteColorChoice: PlayerRole | null;
  blackColorChoice: PlayerRole | null;
  whiteReady: boolean;
  blackReady: boolean;
  access: PersistedRoomAccessState;
};

type RoomStoreFileSchema = {
  schemaVersion: 1;
  rooms: PersistedRoomState[];
};

export type RoomStateStore = {
  loadRooms: () => PersistedRoomState[];
  saveRooms: (rooms: PersistedRoomState[]) => void;
};

const VALID_TIME_CONTROL_IDS = new Set<TimeControlPresetId>([
  "bullet1",
  "bullet2p1",
  "blitz3",
  "blitz3p2",
  "blitz5",
  "rapid10",
  "rapid15p10",
]);

function normalizeRole(value: unknown): PlayerRole | null {
  return value === "w" || value === "b" ? value : null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  return rounded >= 0 ? rounded : null;
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value !== "boolean") {
    return fallback;
  }

  return value;
}

function normalizeUserIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = candidate.trim();
    if (!normalized) {
      continue;
    }

    deduped.add(normalized);
    if (deduped.size >= 5000) {
      break;
    }
  }

  return [...deduped];
}

function normalizeMovesSan(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const moves: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }

    const san = candidate.trim();
    if (!san) {
      continue;
    }

    moves.push(san);
    if (moves.length >= 5000) {
      break;
    }
  }

  return moves;
}

function normalizeTimeControlId(value: unknown): TimeControlPresetId {
  if (typeof value === "string" && VALID_TIME_CONTROL_IDS.has(value as TimeControlPresetId)) {
    return value as TimeControlPresetId;
  }

  return "blitz3";
}

function normalizeAccess(value: unknown): PersistedRoomAccessState {
  const access = value && typeof value === "object"
    ? value as Partial<PersistedRoomAccessState>
    : null;

  const inviteLinkToken = typeof access?.inviteLinkToken === "string" && access.inviteLinkToken.trim()
    ? access.inviteLinkToken.trim()
    : "";

  return {
    inviteLinkToken,
    invitedUserIds: normalizeUserIdList(access?.invitedUserIds),
    allowedSpectatorUserIds: normalizeUserIdList(access?.allowedSpectatorUserIds),
  };
}

function normalizeRoomRecord(value: unknown): PersistedRoomState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PersistedRoomState>;
  const id = normalizeString(candidate.id).trim();
  if (!/^\d{4}$/.test(id)) {
    return null;
  }

  const access = normalizeAccess(candidate.access);
  if (!access.inviteLinkToken) {
    return null;
  }

  return {
    id,
    movesSan: normalizeMovesSan(candidate.movesSan),
    whiteUserId: normalizeStringOrNull(candidate.whiteUserId),
    blackUserId: normalizeStringOrNull(candidate.blackUserId),
    ownerUserId: normalizeStringOrNull(candidate.ownerUserId),
    winner: normalizeRole(candidate.winner),
    statusOverride: normalizeStringOrNull(candidate.statusOverride),
    whiteDisconnectedAt: normalizeTimestamp(candidate.whiteDisconnectedAt),
    blackDisconnectedAt: normalizeTimestamp(candidate.blackDisconnectedAt),
    ownerDisconnectedAt: normalizeTimestamp(candidate.ownerDisconnectedAt),
    updatedAt: normalizeFiniteNumber(candidate.updatedAt, Date.now()),
    isStarted: normalizeBoolean(candidate.isStarted, false),
    analysisEnabled: normalizeBoolean(candidate.analysisEnabled, false),
    analysisLabelsOnlyEnabled: normalizeBoolean(candidate.analysisLabelsOnlyEnabled, false),
    timeControl: normalizeTimeControlId(candidate.timeControl),
    clockWhiteMs: Math.max(0, normalizeFiniteNumber(candidate.clockWhiteMs, 0)),
    clockBlackMs: Math.max(0, normalizeFiniteNumber(candidate.clockBlackMs, 0)),
    clockActive: normalizeRole(candidate.clockActive),
    clockRunning: normalizeBoolean(candidate.clockRunning, false),
    clockLastUpdatedAt: normalizeFiniteNumber(candidate.clockLastUpdatedAt, Date.now()),
    voiceWAcceptsB: normalizeBoolean(candidate.voiceWAcceptsB, false),
    voiceBAcceptsW: normalizeBoolean(candidate.voiceBAcceptsW, false),
    whiteColorChoice: normalizeRole(candidate.whiteColorChoice),
    blackColorChoice: normalizeRole(candidate.blackColorChoice),
    whiteReady: normalizeBoolean(candidate.whiteReady, false),
    blackReady: normalizeBoolean(candidate.blackReady, false),
    access,
  };
}

export function createRoomStateStore(projectRoot: string): RoomStateStore {
  const dataDir = path.join(projectRoot, "data");
  const filePath = path.join(dataDir, "rooms-state.json");

  function ensureStorageDir(): void {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  function loadRooms(): PersistedRoomState[] {
    ensureStorageDir();

    if (!fs.existsSync(filePath)) {
      const initialPayload: RoomStoreFileSchema = { schemaVersion: 1, rooms: [] };
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(initialPayload), "utf8");
      fs.renameSync(tmpPath, filePath);
      return [];
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<RoomStoreFileSchema>;
      const rooms = Array.isArray(parsed.rooms) ? parsed.rooms : [];

      const normalizedRooms: PersistedRoomState[] = [];
      for (const room of rooms) {
        const normalized = normalizeRoomRecord(room);
        if (!normalized) {
          continue;
        }
        normalizedRooms.push(normalized);
      }

      return normalizedRooms;
    } catch {
      return [];
    }
  }

  function saveRooms(rooms: PersistedRoomState[]): void {
    ensureStorageDir();

    const payload: RoomStoreFileSchema = {
      schemaVersion: 1,
      rooms,
    };

    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
    fs.renameSync(tmpPath, filePath);
  }

  return {
    loadRooms,
    saveRooms,
  };
}
