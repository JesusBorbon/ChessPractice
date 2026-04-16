import { Chess } from "chess.js";
import type { Color, Move } from "chess.js";

import type { BotDifficultyPreset, TimeControlPreset, TimeControlPresetId } from "./main-types";

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

export const BOT_DIFFICULTY_PRESETS: BotDifficultyPreset[] = [
  { level: 1, label: "Level 1 - 800 Elo", elo: 800, skillLevel: 2, moveTimeMs: 170, fullStrength: false },
  { level: 2, label: "Level 2 - 1000 Elo", elo: 1000, skillLevel: 4, moveTimeMs: 230, fullStrength: false },
  { level: 3, label: "Level 3 - 1200 Elo", elo: 1200, skillLevel: 4, moveTimeMs: 240, fullStrength: false },
  { level: 4, label: "Level 4 - 1400 Elo", elo: 1400, skillLevel: 6, moveTimeMs: 340, fullStrength: false },
  { level: 5, label: "Level 5 - 1600 Elo", elo: 1600, skillLevel: 9, moveTimeMs: 470, fullStrength: false },
  { level: 6, label: "Level 6 - 1800 Elo", elo: 1800, skillLevel: 12, moveTimeMs: 650, fullStrength: false },
  { level: 7, label: "Level 7 - 2000 Elo", elo: 2000, skillLevel: 14, moveTimeMs: 900, fullStrength: false },
  { level: 8, label: "Level 8 - 2200 Elo", elo: 2200, skillLevel: 16, moveTimeMs: 1250, fullStrength: false },
  { level: 9, label: "Level 9 - 2400 Elo", elo: 2400, skillLevel: 18, moveTimeMs: 1700, fullStrength: false },
  { level: 10, label: "Level 10 - Full Strength", elo: null, skillLevel: 20, moveTimeMs: 2600, fullStrength: true },
];

export const TIME_CONTROL_PRESETS: TimeControlPreset[] = [
  { id: "bullet1", label: "1+0 Bullet", initialMs: 60_000, incrementMs: 0 },
  { id: "bullet2p1", label: "2+1 Bullet", initialMs: 120_000, incrementMs: 1_000 },
  { id: "blitz3", label: "3-minute Blitz", initialMs: 180_000, incrementMs: 0 },
  { id: "blitz3p2", label: "3+2 Blitz", initialMs: 180_000, incrementMs: 2_000 },
  { id: "blitz5", label: "5-minute Blitz", initialMs: 300_000, incrementMs: 0 },
  { id: "rapid10", label: "10-minute Rapid", initialMs: 600_000, incrementMs: 0 },
  { id: "rapid15p10", label: "15+10 Rapid", initialMs: 900_000, incrementMs: 10_000 },
];

export const DEFAULT_BOT_TIME_CONTROL_ID: TimeControlPresetId = "blitz3";

export function isTimeControlPresetId(value: unknown): value is TimeControlPresetId {
  return typeof value === "string" && TIME_CONTROL_PRESETS.some((entry) => entry.id === value);
}

export function normalizeBotTimeControlId(value: unknown): TimeControlPresetId {
  if (typeof value !== "string") {
    return DEFAULT_BOT_TIME_CONTROL_ID;
  }

  const normalized = value.trim();
  const preset = TIME_CONTROL_PRESETS.find((entry) => entry.id === normalized);
  return preset?.id ?? DEFAULT_BOT_TIME_CONTROL_ID;
}

export function getBotTimeControlPreset(id: TimeControlPresetId): TimeControlPreset {
  const preset = TIME_CONTROL_PRESETS.find((entry) => entry.id === id);
  return preset ?? TIME_CONTROL_PRESETS[0]!;
}

export function getLowTimeThresholdMs(initialMs: number): number {
  return Math.min(20_000, Math.max(5_000, Math.floor(initialMs * 0.18)));
}

export function clampBotLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 1;
  }

  return Math.min(10, Math.max(1, Math.round(level)));
}

export function getBotDifficultyPreset(level: number): BotDifficultyPreset {
  const resolved = BOT_DIFFICULTY_PRESETS[clampBotLevel(level) - 1];
  return resolved ?? BOT_DIFFICULTY_PRESETS[0]!;
}

export function botDifficultySummary(preset: BotDifficultyPreset): string {
  return preset.fullStrength ? `Level ${preset.level} Max` : `Level ${preset.level} ${preset.elo} Elo`;
}

export function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function pickRandomMove(moves: Move[]): Move {
  return moves[Math.floor(Math.random() * moves.length)]!;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clampBotMoveTimeMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 60;
  }

  return Math.max(25, Math.min(4200, Math.round(value)));
}

function scoreMoveForHumanizedBot(move: Move): number {
  const capturedValue = move.captured ? (PIECE_VALUES[move.captured] ?? 0) : 0;
  const moverValue = PIECE_VALUES[move.piece] ?? 0;
  const file = move.to.charCodeAt(0) - 97;
  const rank = Number(move.to[1]) - 1;
  const centrality = Math.max(0, 3.5 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5)) / 2);

  let score = 0;
  score += capturedValue - moverValue * 0.15;
  score += centrality * 12;
  if (move.promotion) score += 900;
  if (move.san.includes("+")) score += 85;
  if (move.flags.includes("k") || move.flags.includes("q")) score += 40;

  return score;
}

type BotMoveQualityTuning = {
  blunderChance: number;
  inaccuracyChance: number;
  slightInaccuracyChance: number;
};

const BOT_MOVE_QUALITY_TUNING_BY_LEVEL: Record<number, BotMoveQualityTuning> = {
  1: { blunderChance: 0.11, inaccuracyChance: 0.34, slightInaccuracyChance: 0.29 },
  2: { blunderChance: 0.08, inaccuracyChance: 0.31, slightInaccuracyChance: 0.29 },
  3: { blunderChance: 0.06, inaccuracyChance: 0.26, slightInaccuracyChance: 0.28 },
  4: { blunderChance: 0.1, inaccuracyChance: 0.23, slightInaccuracyChance: 0.26 },
  5: { blunderChance: 0.08, inaccuracyChance: 0.18, slightInaccuracyChance: 0.26 },
  6: { blunderChance: 0.05, inaccuracyChance: 0.13, slightInaccuracyChance: 0.24 },
  7: { blunderChance: 0.02, inaccuracyChance: 0.08, slightInaccuracyChance: 0.20 },
  8: { blunderChance: 0.01, inaccuracyChance: 0.05, slightInaccuracyChance: 0.16 },
  9: { blunderChance: 0.003, inaccuracyChance: 0.025, slightInaccuracyChance: 0.11 },
  10: { blunderChance: 0, inaccuracyChance: 0, slightInaccuracyChance: 0 },
};

function pickBiasedFromSlice<T>(items: T[], towardFrontBias = 1.5): T {
  if (items.length === 1) {
    return items[0]!;
  }

  const biasedRoll = Math.pow(Math.random(), Math.max(1, towardFrontBias));
  const index = Math.min(items.length - 1, Math.floor(biasedRoll * items.length));
  return items[index]!;
}

function getSliceByPercentiles<T>(items: T[], start: number, end: number): T[] {
  if (items.length === 0) {
    return [];
  }

  const clampedStart = Math.max(0, Math.min(1, start));
  const clampedEnd = Math.max(clampedStart, Math.min(1, end));
  const startIndex = Math.min(items.length - 1, Math.floor(items.length * clampedStart));
  const endIndex = Math.max(startIndex + 1, Math.ceil(items.length * clampedEnd));
  return items.slice(startIndex, Math.min(items.length, endIndex));
}

function getComplexityPenaltyFactor(legalMoveCount: number): number {
  if (legalMoveCount <= 2) {
    return 0.15;
  }

  if (legalMoveCount <= 4) {
    return 0.45;
  }

  if (legalMoveCount <= 8) {
    return 0.72;
  }

  return 1;
}

function evaluateTacticalPenalty(positionFen: string, move: Move): number {
  const board = new Chess(positionFen);
  const applied = board.move(
    move.promotion
      ? { from: move.from, to: move.to, promotion: move.promotion }
      : { from: move.from, to: move.to },
  );
  if (!applied) {
    return 0;
  }

  const destination = applied.to;
  const movedValue = PIECE_VALUES[applied.piece] ?? 0;
  if (movedValue <= 0) {
    return 0;
  }

  const opponentColor: Color = applied.color === "w" ? "b" : "w";
  const legalCaptureReplies = board.moves({ verbose: true }).filter((reply) => {
    return reply.to === destination && Boolean(reply.captured);
  });
  if (legalCaptureReplies.length === 0) {
    return 0;
  }

  const defenderCount = board.attackers(destination, applied.color).length;
  const leastCapturerValue = Math.min(...legalCaptureReplies.map((reply) => PIECE_VALUES[reply.piece] ?? 0));
  const capturedValue = move.captured ? (PIECE_VALUES[move.captured] ?? 0) : 0;
  const isHanging = defenderCount === 0;

  let penalty = 0;
  if (leastCapturerValue < movedValue) {
    penalty += (movedValue - leastCapturerValue) * 1.15;
  }

  if (isHanging) {
    penalty += movedValue * 0.85;
  }

  if (!move.captured) {
    penalty += 40;
  }

  if (capturedValue >= leastCapturerValue && capturedValue > 0) {
    penalty *= 0.74;
  }

  if (move.san.includes("+")) {
    penalty *= 0.68;
  }

  if (
    applied.piece === "q"
    && isHanging
    && leastCapturerValue <= 330
    && !move.captured
    && !move.san.includes("+")
  ) {
    penalty += 1300;
  }

  const isSquareAttackedByOpponent = board.isAttacked(destination, opponentColor);
  if (!isSquareAttackedByOpponent) {
    return 0;
  }

  return penalty;
}

function getCatastrophicPenaltyThreshold(level: number): number {
  if (level <= 1) return 760;
  if (level <= 2) return 700;
  if (level <= 3) return 660;
  if (level <= 5) return 620;
  return 580;
}

export function chooseBotMoveByDifficulty(
  bestMoveUci: string,
  preset: BotDifficultyPreset,
  legalMoves: Move[],
  currentFen?: string,
): string {
  if (preset.fullStrength || preset.level >= 10) {
    return bestMoveUci;
  }

  if (legalMoves.length <= 1) {
    return bestMoveUci;
  }

  const bestMove = bestMoveUci.trim();
  const scoredMoves = legalMoves
    .map((move) => ({
      uci: moveToUci(move),
      baseScore: scoreMoveForHumanizedBot(move),
      tacticalPenalty: currentFen ? evaluateTacticalPenalty(currentFen, move) : 0,
    }))
    .map((entry) => ({
      uci: entry.uci,
      score: entry.baseScore - entry.tacticalPenalty,
      tacticalPenalty: entry.tacticalPenalty,
    }))
    .sort((left, right) => right.score - left.score);

  const bestMoveIsLegal = scoredMoves.some((entry) => entry.uci === bestMove);
  if (!bestMoveIsLegal) {
    return scoredMoves[0]?.uci ?? bestMoveUci;
  }

  const scoredAlternatives = scoredMoves.filter((entry) => entry.uci !== bestMove);
  if (scoredAlternatives.length === 0) {
    return bestMoveUci;
  }

  const catastrophicThreshold = getCatastrophicPenaltyThreshold(preset.level);
  const nonCatastrophicAlternatives = scoredAlternatives.filter((entry) => entry.tacticalPenalty < catastrophicThreshold);
  const candidatePool = nonCatastrophicAlternatives.length > 0 ? nonCatastrophicAlternatives : scoredAlternatives;

  const levelTuning = BOT_MOVE_QUALITY_TUNING_BY_LEVEL[preset.level] ?? BOT_MOVE_QUALITY_TUNING_BY_LEVEL[1]!;
  const complexityPenalty = getComplexityPenaltyFactor(legalMoves.length);
  const blunderChance = levelTuning.blunderChance * complexityPenalty;
  const inaccuracyChance = levelTuning.inaccuracyChance * complexityPenalty;
  const slightInaccuracyChance = levelTuning.slightInaccuracyChance * complexityPenalty;
  const roll = Math.random();

  if (roll < blunderChance) {
    const worstSlice = getSliceByPercentiles(candidatePool.slice().reverse(), 0, 0.2);
    const picked = pickBiasedFromSlice(worstSlice, 1.7);
    return picked.uci;
  }

  if (roll < blunderChance + inaccuracyChance) {
    const inaccurateSlice = getSliceByPercentiles(candidatePool.slice().reverse(), 0.18, 0.62);
    const picked = pickBiasedFromSlice(inaccurateSlice, 1.2);
    return picked.uci;
  }

  if (roll < blunderChance + inaccuracyChance + slightInaccuracyChance) {
    const topAlternatives = getSliceByPercentiles(candidatePool, 0, 0.3);
    const picked = pickBiasedFromSlice(topAlternatives, 1.35);
    return picked.uci;
  }

  return bestMove;
}
