type SocketLike = {
  connected: boolean;
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, listener: (payload?: unknown) => void) => void;
  off: (event: string, listener: (payload?: unknown) => void) => void;
};

export type FriendActivityStatus = "online" | "in-room" | "playing-bot" | "offline";

export type FriendActivityState = {
  status: FriendActivityStatus;
  roomId: string | null;
  canSpectate: boolean;
  canRequestJoin: boolean;
};

type CreateFriendActivityRealtimeControllerOptions = {
  socket: SocketLike;
};

type FriendActivityListener = (snapshot: Map<string, FriendActivityState>) => void;

export type FriendActivityRealtimeController = {
  initialize: () => void;
  dispose: () => void;
  subscribe: (listener: FriendActivityListener) => () => void;
  updateWatchedFriendIds: (friendIds: string[]) => void;
};

const ROOM_ID_PATTERN = /^\d{4}$/;

function normalizeUserId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeStatus(value: unknown): FriendActivityStatus {
  if (value === "online" || value === "in-room" || value === "playing-bot") {
    return value;
  }

  return "offline";
}

function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return ROOM_ID_PATTERN.test(normalized) ? normalized : null;
}

function getOfflineState(): FriendActivityState {
  return {
    status: "offline",
    roomId: null,
    canSpectate: false,
    canRequestJoin: false,
  };
}

function buildStateSignature(snapshot: Map<string, FriendActivityState>): string {
  const chunks: string[] = [];
  for (const [userId, state] of snapshot.entries()) {
    chunks.push(`${userId}:${state.status}:${state.roomId ?? "-"}:${state.canSpectate ? "1" : "0"}:${state.canRequestJoin ? "1" : "0"}`);
  }

  return chunks.join("|");
}

export function createFriendActivityRealtimeController({
  socket,
}: CreateFriendActivityRealtimeControllerOptions): FriendActivityRealtimeController {
  let initialized = false;
  let watchedFriendIds: string[] = [];
  let presenceByUserId = new Map<string, FriendActivityState>();
  let lastSignature = "";

  const listeners = new Set<FriendActivityListener>();

  const emitWatchRequest = (): void => {
    if (!socket.connected) {
      return;
    }

    socket.emit("friends:watch", { friendIds: watchedFriendIds });
  };

  const emitSnapshot = (): void => {
    const signature = buildStateSignature(presenceByUserId);
    if (signature === lastSignature) {
      return;
    }

    lastSignature = signature;
    const snapshot = new Map(presenceByUserId);
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const onSocketConnect = (): void => {
    emitWatchRequest();
  };

  const onFriendsPresence = (payload?: unknown): void => {
    const nextPresenceByUserId = new Map<string, FriendActivityState>();
    const friendRecords = payload && typeof payload === "object"
      ? (payload as { friends?: unknown }).friends
      : null;

    if (Array.isArray(friendRecords)) {
      for (const record of friendRecords) {
        if (!record || typeof record !== "object") {
          continue;
        }

        const item = record as {
          userId?: unknown;
          status?: unknown;
          roomId?: unknown;
          canSpectate?: unknown;
          canRequestJoin?: unknown;
        };
        const userId = normalizeUserId(item.userId);
        if (!userId) {
          continue;
        }

        nextPresenceByUserId.set(userId, {
          status: normalizeStatus(item.status),
          roomId: normalizeRoomId(item.roomId),
          canSpectate: item.canSpectate === true,
          canRequestJoin: item.canRequestJoin === true,
        });
      }
    }

    const watchedSet = new Set(watchedFriendIds);
    const merged = new Map<string, FriendActivityState>();
    for (const friendId of watchedSet) {
      merged.set(friendId, nextPresenceByUserId.get(friendId) ?? getOfflineState());
    }

    presenceByUserId = merged;
    emitSnapshot();
  };

  function initialize(): void {
    if (initialized) {
      return;
    }

    initialized = true;
    socket.on("connect", onSocketConnect);
    socket.on("friends:presence", onFriendsPresence);
    emitWatchRequest();
  }

  function dispose(): void {
    if (!initialized) {
      return;
    }

    initialized = false;
    socket.off("connect", onSocketConnect);
    socket.off("friends:presence", onFriendsPresence);
    listeners.clear();
    watchedFriendIds = [];
    presenceByUserId.clear();
    lastSignature = "";
  }

  function subscribe(listener: FriendActivityListener): () => void {
    listeners.add(listener);
    listener(new Map(presenceByUserId));
    return () => {
      listeners.delete(listener);
    };
  }

  function updateWatchedFriendIds(friendIds: string[]): void {
    const normalized = [...new Set(friendIds.map((id) => normalizeUserId(id)).filter(Boolean))];
    watchedFriendIds = normalized;

    const nextPresenceByUserId = new Map<string, FriendActivityState>();
    for (const friendId of watchedFriendIds) {
      nextPresenceByUserId.set(friendId, presenceByUserId.get(friendId) ?? getOfflineState());
    }

    presenceByUserId = nextPresenceByUserId;
    emitSnapshot();
    emitWatchRequest();
  }

  return {
    initialize,
    dispose,
    subscribe,
    updateWatchedFriendIds,
  };
}
