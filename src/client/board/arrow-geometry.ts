export type BoardPoint = { x: number; y: number };

export type ArrowShapeOptions = {
  shaftWidth?: number;
  headLength?: number;
  headWidth?: number;
};

export function buildArrowPath(
  start: BoardPoint,
  end: BoardPoint,
  options: ArrowShapeOptions = {},
): string {
  const shaftWidth = options.shaftWidth ?? 14;
  const headLength = options.headLength ?? 56;
  const headWidth = options.headWidth ?? 46;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return "";
  }

  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;

  const safeHeadLength = Math.min(headLength, Math.max(18, length * 0.45));
  const shaftHalf = shaftWidth / 2;
  const headHalf = headWidth / 2;

  const baseX = end.x - ux * safeHeadLength;
  const baseY = end.y - uy * safeHeadLength;

  const tailLeftX = start.x + px * shaftHalf;
  const tailLeftY = start.y + py * shaftHalf;
  const tailRightX = start.x - px * shaftHalf;
  const tailRightY = start.y - py * shaftHalf;

  const baseLeftX = baseX + px * shaftHalf;
  const baseLeftY = baseY + py * shaftHalf;
  const baseRightX = baseX - px * shaftHalf;
  const baseRightY = baseY - py * shaftHalf;

  const wingLeftX = baseX + px * headHalf;
  const wingLeftY = baseY + py * headHalf;
  const wingRightX = baseX - px * headHalf;
  const wingRightY = baseY - py * headHalf;

  return [
    `M ${tailLeftX.toFixed(2)} ${tailLeftY.toFixed(2)}`,
    `L ${baseLeftX.toFixed(2)} ${baseLeftY.toFixed(2)}`,
    `L ${wingLeftX.toFixed(2)} ${wingLeftY.toFixed(2)}`,
    `L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    `L ${wingRightX.toFixed(2)} ${wingRightY.toFixed(2)}`,
    `L ${baseRightX.toFixed(2)} ${baseRightY.toFixed(2)}`,
    `L ${tailRightX.toFixed(2)} ${tailRightY.toFixed(2)}`,
    `A ${shaftHalf.toFixed(2)} ${shaftHalf.toFixed(2)} 0 0 0 ${tailLeftX.toFixed(2)} ${tailLeftY.toFixed(2)}`,
    "Z",
  ].join(" ");
}
