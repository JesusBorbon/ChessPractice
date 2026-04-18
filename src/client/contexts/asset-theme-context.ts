import type { PieceSymbol } from "chess.js";

import type { PieceThemeChoice, SoundThemeChoice } from "../theme";

export const PIECE_THEME_STORAGE_KEY = "chess-piece-theme";
export const SOUND_THEME_STORAGE_KEY = "chess-sound-theme";

type BoardColor = "w" | "b";
type PieceKey = `${BoardColor}${PieceSymbol}`;

export type SoundEffectName = "move-self" | "capture" | "castle" | "checkMove" | "gameEndOrCheckmate" | "premove";

export const PIECE_SETS: Record<PieceThemeChoice, Record<PieceKey, string>> = {
  original: {
    wp: "/pieces/wP.svg",
    wn: "/pieces/wN.svg",
    wb: "/pieces/wB.svg",
    wr: "/pieces/wR.svg",
    wq: "/pieces/wQ.svg",
    wk: "/pieces/wK.svg",
    bp: "/pieces/bP.svg",
    bn: "/pieces/bN.svg",
    bb: "/pieces/bB.svg",
    br: "/pieces/bR.svg",
    bq: "/pieces/bQ.svg",
    bk: "/pieces/bK.svg",
  },
  chesscom: {
    wp: "/pieces/chessComPieces/wpCom.png",
    wn: "/pieces/chessComPieces/wnCom.png",
    wb: "/pieces/chessComPieces/wbCom.png",
    wr: "/pieces/chessComPieces/wrCom.png",
    wq: "/pieces/chessComPieces/wqCom.png",
    wk: "/pieces/chessComPieces/wkCom.png",
    bp: "/pieces/chessComPieces/bpCom.png",
    bn: "/pieces/chessComPieces/bnCom.png",
    bb: "/pieces/chessComPieces/bbCom.png",
    br: "/pieces/chessComPieces/brCom.png",
    bq: "/pieces/chessComPieces/bqCom.png",
    bk: "/pieces/chessComPieces/bkCom.png",
  },
};

export const SOUND_PACKS: Record<SoundThemeChoice, Record<SoundEffectName, string>> = {
  original: {
    "move-self": "/sounds/move-self.mp3",
    capture: "/sounds/capture.mp3",
    castle: "/sounds/castle.mp3",
    checkMove: "/sounds/checkMove.mp3",
    gameEndOrCheckmate: "/sounds/gameEndOrCheckmate.mp3",
    premove: "/sounds/move-self.mp3",
  },
  chesscom: {
    "move-self": "/sounds/chessComSounds/moveChesscom.mp3",
    capture: "/sounds/chessComSounds/captureChesscom.mp3",
    castle: "/sounds/chessComSounds/castleChesscom.mp3",
    checkMove: "/sounds/chessComSounds/checkMoveChesscom.mp3",
    gameEndOrCheckmate: "/sounds/chessComSounds/gameEndOrCheckmate.mp3",
    premove: "/sounds/chessComSounds/premove.mp3",
  },
};

export function normalizePieceTheme(value: string | null): PieceThemeChoice {
  return value === "chesscom" ? "chesscom" : "original";
}

export function normalizeSoundTheme(value: string | null): SoundThemeChoice {
  return value === "chesscom" ? "chesscom" : "original";
}

export function normalizeSoundEffectName(name: string): SoundEffectName | null {
  if (name === "move-self") return "move-self";
  if (name === "capture") return "capture";
  if (name === "castle") return "castle";
  if (name === "checkMove") return "checkMove";
  if (name === "gameEndOrCheckmate") return "gameEndOrCheckmate";
  if (name === "premove") return "premove";
  return null;
}

export function resolvePieceSpritePath(theme: PieceThemeChoice, color: BoardColor, piece: PieceSymbol): string {
  const pieceKey = `${color}${piece}` as PieceKey;
  return PIECE_SETS[theme][pieceKey];
}

export function resolveSoundPackSrc(theme: SoundThemeChoice, effectName: SoundEffectName): string {
  return SOUND_PACKS[theme][effectName];
}
