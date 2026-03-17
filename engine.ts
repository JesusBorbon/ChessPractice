export type BoardOrientation = "w" | "b";

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

export type FileName = (typeof FILES)[number];
export type RankName = (typeof RANKS)[number];
export type SquareName = `${FileName}${RankName}`;

export function buildSquareList(orientation: BoardOrientation = "w"): SquareName[] {
  const files = orientation === "w" ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === "w" ? [...RANKS].reverse() : [...RANKS];
  const squares: SquareName[] = [];

  for (const rank of ranks) {
    for (const file of files) {
      squares.push(`${file}${rank}`);
    }
  }

  return squares;
}

export function isLightSquare(square: SquareName): boolean {
  const fileIndex = FILES.indexOf(square[0] as FileName);
  const rankIndex = RANKS.indexOf(square[1] as RankName);

  return (fileIndex + rankIndex) % 2 === 1;
}

export class BitboardEngine {
  whitePawns = 0xff00n;
  whiteKnights = 0x42n;
  whiteBishops = 0x24n;
  whiteRooks = 0x81n;
  whiteQueens = 0x8n;
  whiteKing = 0x10n;

  blackPawns = 0x00ff000000000000n;
  blackKnights = 0x4200000000000000n;
  blackBishops = 0x2400000000000000n;
  blackRooks = 0x8100000000000000n;
  blackQueens = 0x0800000000000000n;
  blackKing = 0x1000000000000000n;

  get allWhite(): bigint {
    return this.whitePawns |
      this.whiteKnights |
      this.whiteBishops |
      this.whiteRooks |
      this.whiteQueens |
      this.whiteKing;
  }

  get allBlack(): bigint {
    return this.blackPawns |
      this.blackKnights |
      this.blackBishops |
      this.blackRooks |
      this.blackQueens |
      this.blackKing;
  }

  get allPieces(): bigint {
    return this.allWhite | this.allBlack;
  }
}