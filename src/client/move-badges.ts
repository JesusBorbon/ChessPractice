export const MOVE_BADGE_LABELS = {
  brilliant: "Brilliant",
  great: "Great",
  bestmove: "Best move",
  forced: "Forced",
  excellent: "Excellent",
  good: "Good",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
} as const;

export type MoveBadgeCategory = keyof typeof MOVE_BADGE_LABELS;

export const MOVE_BADGE_ICON_PATHS: Record<MoveBadgeCategory, string> = {
  brilliant: "/assets/labelBadges/brilliant-move-chess.png",
  great: "/assets/labelBadges/great.png",
  bestmove: "/assets/labelBadges/bestmove.png",
  forced: "/assets/labelBadges/forced.png",
  excellent: "/assets/labelBadges/excellent.png",
  good: "/assets/labelBadges/good.png",
  inaccuracy: "/assets/labelBadges/unaccuracy.png",
  mistake: "/assets/labelBadges/mistake.png",
  blunder: "/assets/labelBadges/blunder.png",
};

export function appendMoveBadgeMarkerContent(marker: HTMLElement, category: MoveBadgeCategory): void {
  const icon = document.createElement("img");
  icon.className = "piece-quality-marker-icon";
  icon.src = MOVE_BADGE_ICON_PATHS[category];
  icon.alt = `${MOVE_BADGE_LABELS[category]} move`;
  icon.draggable = false;
  marker.append(icon);
}

export function renderMoveBadgeHtml(
  category: MoveBadgeCategory,
  className: "move-quality-badge" | "move-quality-tag",
  label: string = MOVE_BADGE_LABELS[category],
): string {
  const iconClassName = `${className}-icon`;
  return `<span class="${className} ${category}" title="${label}"><img class="${iconClassName}" src="${MOVE_BADGE_ICON_PATHS[category]}" alt="" aria-hidden="true" draggable="false">${label}</span>`;
}
