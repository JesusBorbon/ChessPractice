import type { Move } from "chess.js";

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
  { level: 1, label: "Level 1 - 800 Elo", elo: 800, skillLevel: 0, moveTimeMs: 90, fullStrength: false },
  { level: 2, label: "Level 2 - 1000 Elo", elo: 1000, skillLevel: 2, moveTimeMs: 120, fullStrength: false },
  { level: 3, label: "Level 3 - 1200 Elo", elo: 1200, skillLevel: 4, moveTimeMs: 170, fullStrength: false },
  { level: 4, label: "Level 4 - 1400 Elo", elo: 1400, skillLevel: 6, moveTimeMs: 240, fullStrength: false },
  { level: 5, label: "Level 5 - 1600 Elo", elo: 1600, skillLevel: 8, moveTimeMs: 330, fullStrength: false },
  { level: 6, label: "Level 6 - 1800 Elo", elo: 1800, skillLevel: 10, moveTimeMs: 460, fullStrength: false },
  { level: 7, label: "Level 7 - 2000 Elo", elo: 2000, skillLevel: 12, moveTimeMs: 620, fullStrength: false },
  { level: 8, label: "Level 8 - 2200 Elo", elo: 2200, skillLevel: 14, moveTimeMs: 820, fullStrength: false },
  { level: 9, label: "Level 9 - 2400 Elo", elo: 2400, skillLevel: 17, moveTimeMs: 1100, fullStrength: false },
  { level: 10, label: "Level 10 - Full Strength", elo: null, skillLevel: 20, moveTimeMs: 2200, fullStrength: true },
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

export function chooseBotMoveByDifficulty(bestMoveUci: string, preset: BotDifficultyPreset, legalMoves: Move[]): string {
  if (preset.fullStrength || preset.level >= 10) {
    return bestMoveUci;
  }

  if (legalMoves.length <= 1) {
    return bestMoveUci;
  }

  const bestMove = bestMoveUci.trim();
  const alternatives = legalMoves.filter((move) => moveToUci(move) !== bestMove);
  if (alternatives.length === 0) {
    return bestMoveUci;
  }

  const levelGap = 10 - preset.level;
  const blunderChance = Math.max(0, (levelGap - 1) * 0.03);
  const inaccuracyChance = Math.max(0, levelGap * 0.045);
  const roll = Math.random();

  if (roll < blunderChance) {
    const sorted = [...alternatives].sort((a, b) => scoreMoveForHumanizedBot(a) - scoreMoveForHumanizedBot(b));
    const worstSlice = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 3)));
    return moveToUci(pickRandomMove(worstSlice));
  }

  if (roll < blunderChance + inaccuracyChance) {
    const sorted = [...alternatives].sort((a, b) => scoreMoveForHumanizedBot(a) - scoreMoveForHumanizedBot(b));
    const start = Math.floor(sorted.length * 0.2);
    const end = Math.max(start + 1, Math.floor(sorted.length * 0.7));
    const candidateSlice = sorted.slice(start, end);
    if (candidateSlice.length > 0) {
      return moveToUci(pickRandomMove(candidateSlice));
    }
  }

  return bestMoveUci;
}
