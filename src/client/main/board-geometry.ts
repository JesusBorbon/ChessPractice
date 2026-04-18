import type { Square } from "chess.js";

import type { BoardOrientation } from "../../../engine";

export function getSquareFromPoint(clientX: number, clientY: number): Square | null {
  const node = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  const squareButton = node?.closest<HTMLButtonElement>(".square");
  return (squareButton?.dataset.square as Square | undefined) ?? null;
}

export function boardPointFromClient(
  boardElement: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = boardElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 400, y: 400 };
  }

  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const clampedX = Math.max(0, Math.min(rect.width, localX));
  const clampedY = Math.max(0, Math.min(rect.height, localY));

  return {
    x: (clampedX / rect.width) * 800,
    y: (clampedY / rect.height) * 800,
  };
}

export function squareCenter(square: Square, orientation: BoardOrientation): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === "w" ? file : 7 - file;
  const row = orientation === "w" ? 7 - rank : rank;

  return {
    x: col * 100 + 50,
    y: row * 100 + 50,
  };
}
