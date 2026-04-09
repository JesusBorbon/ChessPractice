import type { Square } from "chess.js";

export type BestMoveArrow = {
  from: Square;
  to: Square;
};

const UCI_MOVE_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function parseBestMoveArrow(uci: string): BestMoveArrow | null {
  const normalized = (uci ?? "").trim().toLowerCase();
  if (!UCI_MOVE_PATTERN.test(normalized)) {
    return null;
  }

  return {
    from: normalized.slice(0, 2) as Square,
    to: normalized.slice(2, 4) as Square,
  };
}

export function canShowBestMoveArrow(isAnalysisEnabled: boolean, isGameOver: boolean): boolean {
  return isAnalysisEnabled || isGameOver;
}
