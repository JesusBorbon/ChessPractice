export type GameParticipants = {
  whiteName: string;
  blackName: string;
};

type RawGameParticipants = {
  whiteName: string | null;
  blackName: string | null;
};

const BOT_KEYWORD_PATTERN = /\b(bot|stockfish|engine|ai)\b/i;
const PGN_HEADER_VALUE_PATTERN = /((?:[^"\\]|\\.)*)/;

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function decodePgnHeaderValue(value: string): string {
  return value.replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
}

function parsePgnHeaderValue(pgn: string, key: "White" | "Black"): string | null {
  const pattern = new RegExp(`\\[${key}\\s+"${PGN_HEADER_VALUE_PATTERN.source}"\\]`, "i");
  const match = pgn.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  const decoded = normalizeWhitespace(decodePgnHeaderValue(match[1]));
  return decoded || null;
}

function normalizeBotName(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "Bot";
  }

  const exactBotMatch = normalized.match(/^bot(?:\s*\(([^)]+)\))?$/i);
  if (exactBotMatch) {
    const details = normalizeWhitespace(exactBotMatch[1] ?? "");
    return details ? `Bot (${details})` : "Bot";
  }

  const ratingMatch = normalized.match(/\b(\d{3,4})\b/);
  if (ratingMatch?.[1]) {
    return `Bot (${ratingMatch[1]})`;
  }

  const levelMatch = normalized.match(/\blevel\s*(\d{1,2})\b/i);
  if (levelMatch?.[1]) {
    return `Bot (Level ${levelMatch[1]})`;
  }

  return "Bot";
}

export function normalizeParticipantDisplayName(value: string | null | undefined, fallback: string): string {
  const normalized = normalizeWhitespace(value ?? "");
  if (!normalized) {
    return fallback;
  }

  if (BOT_KEYWORD_PATTERN.test(normalized)) {
    return normalizeBotName(normalized);
  }

  return normalized;
}

export function parseRawGameParticipantsFromPgn(pgn: string): RawGameParticipants {
  const normalizedPgn = pgn.trim();
  if (!normalizedPgn) {
    return { whiteName: null, blackName: null };
  }

  return {
    whiteName: parsePgnHeaderValue(normalizedPgn, "White"),
    blackName: parsePgnHeaderValue(normalizedPgn, "Black"),
  };
}

export function resolveGameParticipants(input: {
  whiteName?: string | null;
  blackName?: string | null;
}): GameParticipants {
  return {
    whiteName: normalizeParticipantDisplayName(input.whiteName, "White"),
    blackName: normalizeParticipantDisplayName(input.blackName, "Black"),
  };
}

export function resolveGameParticipantsFromPgn(pgn: string): GameParticipants {
  const parsed = parseRawGameParticipantsFromPgn(pgn);
  return resolveGameParticipants(parsed);
}

export function buildMatchTitle(participants: GameParticipants): string {
  return `${participants.whiteName} vs ${participants.blackName}`;
}

export function buildMatchTitleFromPgn(pgn: string): string {
  return buildMatchTitle(resolveGameParticipantsFromPgn(pgn));
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatSavedGameDateTime(savedAt: string | null): string {
  if (!savedAt) {
    return "Date unavailable";
  }

  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  const year = date.getFullYear();
  const month = padTwo(date.getMonth() + 1);
  const day = padTwo(date.getDate());
  const hours = padTwo(date.getHours());
  const minutes = padTwo(date.getMinutes());
  return `Played ${year}-${month}-${day} ${hours}:${minutes}`;
}
