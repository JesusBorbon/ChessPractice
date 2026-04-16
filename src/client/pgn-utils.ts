import { Chess } from "chess.js";

import type { MoveSummary, PgnHeaderOptions, RoomSnapshot } from "./main-types";

export function buildPgnFromMoves(moves: MoveSummary[], headers?: PgnHeaderOptions): string | null {
  if (moves.length === 0) {
    return null;
  }

  const replay = new Chess();
  try {
    if (headers?.whiteName || headers?.blackName || headers?.result) {
      replay.header(
        "White",
        headers.whiteName?.trim() || "White",
        "Black",
        headers.blackName?.trim() || "Black",
        "Result",
        headers.result || "*",
      );
    }

    for (const move of moves) {
      const appliedMove = replay.move(move.san);
      if (!appliedMove) {
        return null;
      }
    }

    return replay.pgn();
  } catch {
    return null;
  }
}

export function buildFinishedGameSignature(gameMode: "multiplayer" | "bot", snapshot: RoomSnapshot): string {
  return [
    gameMode,
    snapshot.roomId,
    snapshot.moveCount,
    snapshot.status,
    snapshot.winner ?? "none",
    snapshot.lastMove?.san ?? "none",
  ].join(":");
}
