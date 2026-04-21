import { Chess, Move, PieceSymbol, Square } from "chess.js";

import type { MoveSummary, PlayerRole, Premove } from "./main-types";

export function isTheoreticallyPossible(from: Square, to: Square, piece: PieceSymbol, color: PlayerRole): boolean {
  const fromFile = from.charCodeAt(0) - 97;
  const fromRank = parseInt(from[1]!, 10);
  const toFile = to.charCodeAt(0) - 97;
  const toRank = parseInt(to[1]!, 10);

  const dx = Math.abs(toFile - fromFile);
  const dy = Math.abs(toRank - fromRank);

  if (dx === 0 && dy === 0) return false;

  switch (piece) {
    case "p": {
      const forward = color === "w" ? (toRank - fromRank) : (fromRank - toRank);
      const isStartRank = (color === "w" && fromRank === 2) || (color === "b" && fromRank === 7);
      if (dx === 0) return forward === 1 || (isStartRank && forward === 2);
      if (dx === 1) return forward === 1;
      return false;
    }
    case "n":
      return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    case "b":
      return dx === dy;
    case "r":
      return dx === 0 || dy === 0;
    case "q":
      return dx === dy || dx === 0 || dy === 0;
    case "k":
      return (dx <= 1 && dy <= 1) || (dx === 2 && dy === 0);
    default:
      return false;
  }
}

export function reachesPromotionRank(square: Square, role: PlayerRole): boolean {
  return role === "w" ? square.endsWith("8") : square.endsWith("1");
}

export function getVirtualBoard(baseFen: string, premoves: Premove[], role: PlayerRole): Chess {
  const virtualBoard = new Chess(baseFen);

  for (const premove of premoves) {
    const piece = virtualBoard.get(premove.from);
    if (!piece) {
      continue;
    }

    const nextPiece = { ...piece };
    const isCastle =
      piece.type === "k"
      && premove.from[1] === premove.to[1]
      && Math.abs(premove.to.charCodeAt(0) - premove.from.charCodeAt(0)) === 2;

    virtualBoard.remove(premove.from);
    virtualBoard.remove(premove.to);
    if (premove.promotion) {
      nextPiece.type = premove.promotion as PieceSymbol;
    }
    virtualBoard.put(nextPiece, premove.to);

    if (isCastle) {
      const rank = premove.from[1];
      const isKingSide = premove.to.charCodeAt(0) > premove.from.charCodeAt(0);
      const rookFrom = `${isKingSide ? "h" : "a"}${rank}` as Square;
      const rookTo = `${isKingSide ? "f" : "d"}${rank}` as Square;
      const rook = virtualBoard.get(rookFrom);
      if (rook?.type === "r" && rook.color === piece.color) {
        virtualBoard.remove(rookFrom);
        virtualBoard.remove(rookTo);
        virtualBoard.put({ ...rook }, rookTo);
      }
    }
  }

  const fenParts = virtualBoard.fen().split(" ");
  fenParts[1] = role;
  fenParts[3] = "-";
  virtualBoard.load(fenParts.join(" "));

  return virtualBoard;
}

export function countFenPieces(fen: string): number {
  const boardFen = fen.split(" ")[0] ?? "";
  let count = 0;
  for (const ch of boardFen) {
    if (/[prnbqkPRNBQK]/.test(ch)) {
      count += 1;
    }
  }
  return count;
}

export function detectCapturedPiece(previousFen: string, lastMove: MoveSummary): PieceSymbol | null {
  const replay = new Chess(previousFen);
  const promotionMatch = lastMove.san.match(/=([QRBN])/);
  const promotion = promotionMatch?.[1]?.toLowerCase() as PieceSymbol | undefined;

  let move: Move | null = null;
  try {
    move = replay.move(
      promotion
        ? { from: lastMove.from, to: lastMove.to, promotion: promotion as "q" | "r" | "b" | "n" }
        : { from: lastMove.from, to: lastMove.to },
    );
  } catch {
    return null;
  }

  return move?.captured ?? null;
}
