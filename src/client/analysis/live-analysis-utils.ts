import { Chess, PieceSymbol, Square } from "chess.js";

import type { MoveCategory, MoveSummary, QualityResult } from "../main/main-types";
import { MOVE_BADGE_LABELS, appendMoveBadgeMarkerContent } from "../move-badges";
import { StockfishBridge } from "../stockfish-bridge";

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const LIVE_BRILLIANT_VERIFICATION_DEPTH = 16;

export function materialFromPerspective(fen: string, color: "w" | "b"): number {
  const board = fen.split(" ")[0] ?? "";
  let white = 0;
  let black = 0;

  for (const ch of board) {
    if (ch === "/" || /\d/.test(ch)) {
      continue;
    }

    const value = PIECE_VALUES[ch.toLowerCase()] ?? 0;
    if (ch === ch.toUpperCase()) {
      white += value;
    } else {
      black += value;
    }
  }

  return color === "w" ? white - black : black - white;
}

export function hasSingleLegalMove(fen: string): boolean {
  try {
    return new Chess(fen).moves().length === 1;
  } catch {
    return false;
  }
}

export function classifyLiveMoveQuality(input: {
  cpl: number;
  matchesBestMove: boolean;
  isForcedMove: boolean;
  materialDelta: number;
  evalGain: number;
  isCapture: boolean;
  previousOpponentCategory: MoveCategory | undefined;
  brilliantOffer: boolean;
}): QualityResult {
  const {
    cpl,
    matchesBestMove,
    isForcedMove,
    materialDelta,
    evalGain,
    isCapture,
    previousOpponentCategory,
    brilliantOffer,
  } = input;

  const opponentBlundered = previousOpponentCategory === "mistake" || previousOpponentCategory === "blunder";
  const isSacrifice = materialDelta <= -100;
  const brilliantSacrifice = isSacrifice && evalGain >= 80 && cpl <= 35;
  const greatPunish = matchesBestMove
    && cpl <= 22
    && opponentBlundered
    && (isCapture || materialDelta >= 100 || evalGain >= 110);

  if (isForcedMove) {
    return { category: "forced", label: MOVE_BADGE_LABELS.forced };
  }

  if (brilliantSacrifice || brilliantOffer) {
    return { category: "brilliant", label: MOVE_BADGE_LABELS.brilliant };
  }

  if (greatPunish) {
    return { category: "great", label: MOVE_BADGE_LABELS.great };
  }

  if (matchesBestMove) {
    return { category: "bestmove", label: MOVE_BADGE_LABELS.bestmove };
  }

  if (cpl <= 45) {
    return { category: "excellent", label: MOVE_BADGE_LABELS.excellent };
  }

  if (cpl <= 90) {
    return { category: "good", label: MOVE_BADGE_LABELS.good };
  }

  if (cpl <= 160) {
    return { category: "inaccuracy", label: MOVE_BADGE_LABELS.inaccuracy };
  }

  if (cpl <= 280) {
    return { category: "mistake", label: MOVE_BADGE_LABELS.mistake };
  }

  return { category: "blunder", label: MOVE_BADGE_LABELS.blunder };
}

export async function verifyLiveBrilliantOffer(input: {
  engine: StockfishBridge;
  move: { to: string; san: string; piece?: string };
  beforeFen: string;
  afterFen: string;
  beforeMoverCp: number;
  afterMoverCp: number;
  cpl: number;
  matchesBestMove: boolean;
  materialDelta: number;
}): Promise<boolean> {
  const {
    engine,
    move,
    beforeFen,
    afterFen,
    beforeMoverCp,
    afterMoverCp,
    cpl,
    matchesBestMove,
    materialDelta,
  } = input;

  if (materialDelta < 0 || cpl > 35 || (!matchesBestMove && afterMoverCp < beforeMoverCp - 40)) {
    return false;
  }

  const board = new Chess(afterFen);
  const movedPiece = board.get(move.to as Square)?.type ?? (move.piece as PieceSymbol | undefined);
  const movedPieceValue = movedPiece ? (PIECE_VALUES[movedPiece] ?? 0) : 0;
  if (movedPieceValue < 330) {
    return false;
  }

  const captureReplies = board.moves({ verbose: true }).filter((reply) => {
    if (reply.to !== move.to || !reply.captured) {
      return false;
    }

    const capturerValue = PIECE_VALUES[reply.piece] ?? 0;
    return capturerValue <= movedPieceValue;
  });

  if (captureReplies.length === 0) {
    return false;
  }

  let worstReplyScore = Number.POSITIVE_INFINITY;
  for (const reply of captureReplies.slice(0, 3)) {
    const replyBoard = new Chess(afterFen);
    replyBoard.move(reply);
    const replyEval = await engine.evaluateFen(replyBoard.fen(), LIVE_BRILLIANT_VERIFICATION_DEPTH);
    worstReplyScore = Math.min(worstReplyScore, replyEval.cp);
  }

  return worstReplyScore >= Math.max(150, beforeMoverCp - 90);
}

export function appendLiveCategoryMarkerContent(marker: HTMLElement, category: MoveCategory): void {
  appendMoveBadgeMarkerContent(marker, category);
}

export function summarizeLiveMove(label: string, cpl: number, san: string): string {
  return `${label}: ${san} (${cpl} CPL)`;
}

export function buildBeforeAfterFenFromMoves(moves: MoveSummary[]): { beforeFen: string; afterFen: string } | null {
  if (moves.length === 0) {
    return null;
  }

  const replay = new Chess();
  for (let index = 0; index < moves.length - 1; index += 1) {
    replay.move(moves[index]!.san);
  }

  const beforeFen = replay.fen();
  replay.move(moves[moves.length - 1]!.san);
  const afterFen = replay.fen();
  return { beforeFen, afterFen };
}
