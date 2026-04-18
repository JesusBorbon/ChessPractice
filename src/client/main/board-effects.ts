import type { PieceSymbol, Square } from "chess.js";

import type { MoveCategory } from "./main-types";

type BoardPoint = { x: number; y: number };

type BoardEffectsOptions = {
  getBoardWrap: () => HTMLElement | null;
  getSquareCenter: (square: Square) => BoardPoint;
};

export function createBoardEffectsController(options: BoardEffectsOptions) {
  let activeLiveQualityCallout: HTMLDivElement | null = null;

  function showLiveQualityMoveCallout(category: MoveCategory, square: Square): void {
    const boardWrap = options.getBoardWrap();
    if (!boardWrap) {
      return;
    }

    activeLiveQualityCallout?.remove();
    activeLiveQualityCallout = null;

    const center = options.getSquareCenter(square);
    const callout = document.createElement("div");
    callout.className = `move-quality-callout move-quality-callout--${category}`;
    callout.textContent = category === "great" ? "Great Move" : "Brilliant Move";
    callout.style.left = `${(center.x / 800) * 100}%`;
    callout.style.top = `${(center.y / 800) * 100}%`;

    boardWrap.append(callout);
    activeLiveQualityCallout = callout;

    const clearCallout = () => {
      if (activeLiveQualityCallout === callout) {
        activeLiveQualityCallout = null;
      }
      callout.remove();
    };

    callout.addEventListener("animationend", clearCallout, { once: true });
    window.setTimeout(clearCallout, 2000);
  }

  function triggerCheckFlash(): void {
    const flash = document.createElement("div");
    flash.className = "check-flash-overlay";
    document.body.append(flash);
    flash.addEventListener("animationend", () => flash.remove(), { once: true });
  }

  function spawnBloodSplatter(square: Square, capturedPiece: PieceSymbol): void {
    const boardWrap = options.getBoardWrap();
    if (!boardWrap) {
      return;
    }

    const intensityByPiece: Record<PieceSymbol, number> = {
      p: 0.6,
      n: 0.8,
      b: 0.8,
      r: 1.0,
      q: 1.4,
      k: 1.2,
    };
    const intensity = intensityByPiece[capturedPiece] ?? 0.8;

    const center = options.getSquareCenter(square);
    const splatter = document.createElement("div");
    splatter.className = "capture-splatter";
    splatter.style.left = `${(center.x / 800) * 100}%`;
    splatter.style.top = `${(center.y / 800) * 100}%`;
    splatter.style.setProperty("--intensity", String(intensity));

    const dropCount = Math.floor(4 + Math.random() * 6 * intensity);
    for (let index = 0; index < dropCount; index += 1) {
      const drop = document.createElement("span");
      drop.className = "capture-drop";
      const angle = Math.random() * Math.PI * 2;
      const distance = (20 + Math.random() * 40) * intensity;
      const size = (6 + Math.random() * 10) * intensity;

      drop.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      drop.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      drop.style.setProperty("--size", `${size}px`);
      drop.style.setProperty("--delay", `${Math.random() * 50}ms`);
      splatter.append(drop);
    }

    boardWrap.append(splatter);
    window.setTimeout(() => splatter.remove(), 2500);
  }

  return {
    showLiveQualityMoveCallout,
    triggerCheckFlash,
    spawnBloodSplatter,
  };
}
