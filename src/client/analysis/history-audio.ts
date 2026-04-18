import { Chess } from "chess.js";

import type { RoomSnapshot } from "../main/main-types";

export function playSoundForMoveTraversal(
  moveSan: string,
  isCheck: boolean,
  isGameEnd: boolean,
  playSound: (name: string) => void,
): void {
  if (isGameEnd) {
    playSound("gameEndOrCheckmate");
    return;
  }

  let specialSoundPlayed = false;

  if (isCheck) {
    playSound("checkMove");
    specialSoundPlayed = true;
  }

  if (moveSan.includes("x")) {
    playSound("capture");
    specialSoundPlayed = true;
  }

  if (moveSan.startsWith("O-O") && !specialSoundPlayed) {
    playSound("castle");
    specialSoundPlayed = true;
  }

  if (!specialSoundPlayed) {
    playSound("move-self");
  }
}

export function buildHistoryBoardAtMove(snapshot: RoomSnapshot, moveCount: number): Chess {
  const historyBoard = new Chess();
  const clampedCount = Math.max(0, Math.min(moveCount, snapshot.moves.length));

  for (let i = 0; i < clampedCount; i += 1) {
    const move = snapshot.moves[i];
    if (move) {
      historyBoard.move(move.san);
    }
  }

  return historyBoard;
}

export function playSoundForHistoryNavigation(
  snapshot: RoomSnapshot,
  previousPos: number,
  nextPos: number,
  playSound: (name: string) => void,
): void {
  if (previousPos === nextPos) {
    return;
  }

  const traversedMoveIndex = nextPos > previousPos ? nextPos - 1 : previousPos - 1;
  const traversedMove = snapshot.moves[traversedMoveIndex];
  if (!traversedMove) {
    return;
  }

  const boardAtNext = buildHistoryBoardAtMove(snapshot, nextPos);
  const isGameEnd = boardAtNext.isCheckmate() || boardAtNext.isDraw();
  const isCheck = boardAtNext.isCheck();
  playSoundForMoveTraversal(traversedMove.san, isCheck, isGameEnd, playSound);
}
