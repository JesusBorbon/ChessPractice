import type { Square } from "chess.js";
import { BoardPoint, buildArrowPath } from "./arrow-geometry";
import type { BestMoveArrow } from "./best-move-arrow";

type ArrowVariant = "board" | "analyze";

type ArrowPreview = {
  from: Square;
  pointer: BoardPoint;
};

type ArrowRenderParams = {
  variant: ArrowVariant;
  annotations: Iterable<string>;
  preview: ArrowPreview | null;
  bestMove: BestMoveArrow | null;
  squareCenter: (square: Square) => BoardPoint;
};

export function buildArrowLayerMarkup(params: ArrowRenderParams): string {
  const { variant, annotations, preview, bestMove, squareCenter } = params;
  const baseClass = `${variant}-arrow`;

  const annotationMarkup = [...annotations]
    .map((entry) => {
      const [from, to] = entry.split("-") as [Square, Square];
      const pathData = buildArrowPath(squareCenter(from), squareCenter(to));
      if (!pathData) {
        return "";
      }
      return `<path class="${baseClass}" d="${pathData}"/>`;
    })
    .join("");

  const previewMarkup = preview
    ? (() => {
        const pathData = buildArrowPath(squareCenter(preview.from), preview.pointer);
        if (!pathData) {
          return "";
        }
        return `<path class="${baseClass} ${baseClass}-preview" d="${pathData}"/>`;
      })()
    : "";

  const bestMoveMarkup = bestMove
    ? (() => {
        const pathData = buildArrowPath(squareCenter(bestMove.from), squareCenter(bestMove.to));
        if (!pathData) {
          return "";
        }
        return `<path class="${baseClass} ${baseClass}-best-move" d="${pathData}"/>`;
      })()
    : "";

  return `${annotationMarkup}${bestMoveMarkup}${previewMarkup}`;
}
