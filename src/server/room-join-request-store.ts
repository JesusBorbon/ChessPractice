import fs from "node:fs";
import path from "node:path";

export type StoredRoomJoinRequest = {
  requestId: string;
  roomId: string;
  requesterUserId: string;
  targetUserId: string;
  requesterName: string;
  createdAt: number;
};

type StoreFileSchema = {
  requests: StoredRoomJoinRequest[];
};

export type RoomJoinRequestStore = {
  save: (request: StoredRoomJoinRequest) => void;
  getById: (requestId: string) => StoredRoomJoinRequest | null;
  delete: (requestId: string) => StoredRoomJoinRequest | null;
  getPendingForTarget: (targetUserId: string) => StoredRoomJoinRequest[];
  getPendingForRoom: (roomId: string) => StoredRoomJoinRequest[];
  findDuplicatePending: (input: { requesterUserId: string; targetUserId: string; roomId: string }) => StoredRoomJoinRequest | null;
  pruneExpired: (expiryMs: number, now?: number) => StoredRoomJoinRequest[];
};

export function createRoomJoinRequestStore(projectRoot: string): RoomJoinRequestStore {
  const dataDir = path.join(projectRoot, "data");
  const filePath = path.join(dataDir, "room-join-requests.json");
  const requestsById = new Map<string, StoredRoomJoinRequest>();

  loadFromDisk();

  function loadFromDisk(): void {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      persistToDisk();
      return;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoreFileSchema>;
      const requests = Array.isArray(parsed.requests) ? parsed.requests : [];
      for (const request of requests) {
        if (!request || typeof request !== "object") {
          continue;
        }

        const candidate = request as Partial<StoredRoomJoinRequest>;
        if (
          typeof candidate.requestId !== "string"
          || typeof candidate.roomId !== "string"
          || typeof candidate.requesterUserId !== "string"
          || typeof candidate.targetUserId !== "string"
          || typeof candidate.requesterName !== "string"
          || typeof candidate.createdAt !== "number"
          || !Number.isFinite(candidate.createdAt)
        ) {
          continue;
        }

        requestsById.set(candidate.requestId, {
          requestId: candidate.requestId,
          roomId: candidate.roomId,
          requesterUserId: candidate.requesterUserId,
          targetUserId: candidate.targetUserId,
          requesterName: candidate.requesterName,
          createdAt: Math.floor(candidate.createdAt),
        });
      }
    } catch {
      requestsById.clear();
      persistToDisk();
    }
  }

  function persistToDisk(): void {
    const payload: StoreFileSchema = {
      requests: [...requestsById.values()].sort((a, b) => a.createdAt - b.createdAt),
    };

    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
    fs.renameSync(tmpPath, filePath);
  }

  function save(request: StoredRoomJoinRequest): void {
    requestsById.set(request.requestId, request);
    persistToDisk();
  }

  function getById(requestId: string): StoredRoomJoinRequest | null {
    return requestsById.get(requestId) ?? null;
  }

  function deleteRequest(requestId: string): StoredRoomJoinRequest | null {
    const removed = requestsById.get(requestId) ?? null;
    if (!removed) {
      return null;
    }

    requestsById.delete(requestId);
    persistToDisk();
    return removed;
  }

  function getPendingForTarget(targetUserId: string): StoredRoomJoinRequest[] {
    return [...requestsById.values()]
      .filter((request) => request.targetUserId === targetUserId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getPendingForRoom(roomId: string): StoredRoomJoinRequest[] {
    return [...requestsById.values()]
      .filter((request) => request.roomId === roomId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function findDuplicatePending(input: { requesterUserId: string; targetUserId: string; roomId: string }): StoredRoomJoinRequest | null {
    for (const request of requestsById.values()) {
      if (
        request.requesterUserId === input.requesterUserId
        && request.targetUserId === input.targetUserId
        && request.roomId === input.roomId
      ) {
        return request;
      }
    }

    return null;
  }

  function pruneExpired(expiryMs: number, now = Date.now()): StoredRoomJoinRequest[] {
    const removed: StoredRoomJoinRequest[] = [];
    for (const request of [...requestsById.values()]) {
      if (now - request.createdAt <= expiryMs) {
        continue;
      }

      requestsById.delete(request.requestId);
      removed.push(request);
    }

    if (removed.length > 0) {
      persistToDisk();
    }

    return removed;
  }

  return {
    save,
    getById,
    delete: deleteRequest,
    getPendingForTarget,
    getPendingForRoom,
    findDuplicatePending,
    pruneExpired,
  };
}
