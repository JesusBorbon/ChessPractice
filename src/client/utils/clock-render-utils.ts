import type { PlayerRole, RoomSnapshot } from "../main/main-types";

type ClockRenderContext = {
  mode: "multiplayer" | "bot";
  lastRoomStateReceivedAtMs: number;
  nowMs?: number;
};

export function formatClockMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getDisplayClockMs(snapshot: RoomSnapshot, color: PlayerRole, context: ClockRenderContext): number {
  const baseMs = color === "w" ? snapshot.clock.whiteMs : snapshot.clock.blackMs;

  if (!snapshot.clock.running || snapshot.clock.active !== color || snapshot.moveCount === 0) {
    return baseMs;
  }

  const referenceNowMs = context.mode === "bot"
    ? snapshot.clock.serverNowMs
    : context.lastRoomStateReceivedAtMs;
  const elapsed = Math.max(0, (context.nowMs ?? Date.now()) - referenceNowMs);
  return Math.max(0, baseMs - elapsed);
}
