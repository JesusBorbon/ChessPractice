export const ROOM_RETURN_CONTEXT_STORAGE_KEY = "chess_roomReturnContext";
export const ROOM_RETURN_CONTEXT_TTL_MS = 1000 * 60 * 60 * 24;

export type StoredRoomReturnContext = {
  roomId: string;
  inviteToken: string | null;
  createdAt: number;
};

export function parseStoredRoomReturnContext(raw: string | null): StoredRoomReturnContext | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredRoomReturnContext>;
    const roomId = typeof parsed.roomId === "string" ? parsed.roomId.trim() : "";
    if (!/^\d{4}$/.test(roomId)) {
      return null;
    }

    const inviteToken = typeof parsed.inviteToken === "string" && parsed.inviteToken.trim()
      ? parsed.inviteToken.trim()
      : null;
    const createdAt = typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
      ? Math.floor(parsed.createdAt)
      : 0;
    if (!createdAt || Date.now() - createdAt > ROOM_RETURN_CONTEXT_TTL_MS) {
      return null;
    }

    return { roomId, inviteToken, createdAt };
  } catch {
    return null;
  }
}
