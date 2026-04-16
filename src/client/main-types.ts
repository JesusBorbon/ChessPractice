import type { Square } from "chess.js";

import type { BoardOrientation } from "../../engine";
import type { BestMoveArrow } from "./best-move-arrow";

export type PlayerRole = "w" | "b";
export type RoomRole = PlayerRole | "spectator";

export type TimeControlPresetId =
  | "bullet1"
  | "bullet2p1"
  | "blitz3"
  | "blitz3p2"
  | "blitz5"
  | "rapid10"
  | "rapid15p10";

export type TimeControlPreset = {
  id: TimeControlPresetId;
  label: string;
  initialMs: number;
  incrementMs: number;
};

export type PromotionPiece = "q" | "r" | "b" | "n";

export type MoveCategory =
  | "brilliant"
  | "great"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

export type QualityResult = {
  category: MoveCategory;
  label: string;
};

export type MoveSummary = {
  color: PlayerRole;
  from: Square;
  to: Square;
  san: string;
  piece: string;
};

export type PgnHeaderOptions = {
  whiteName?: string;
  blackName?: string;
  result?: "1-0" | "0-1" | "1/2-1/2" | "*";
};

export type RoomSnapshot = {
  roomId: string;
  ownerId: string | null;
  fen: string;
  turn: PlayerRole;
  status: string;
  winner: PlayerRole | null;
  check: boolean;
  checkmate: boolean;
  draw: boolean;
  moveCount: number;
  moves: MoveSummary[];
  lastMove: MoveSummary | null;

  players: {
    whiteConnected: boolean;
    blackConnected: boolean;
    spectatorCount: number;
    whiteName: string;
    blackName: string;
    whiteUserId: string | null;
    blackUserId: string | null;
    whiteFriendId: string | null;
    blackFriendId: string | null;
  };

  rematchVotes: number;

  analysis: {
    enabled: boolean;
    votes: number;
    locked: boolean;
    labelsOnly: boolean;
    labelsVotes: number;
  };

  undo: {
    pending: boolean;
    requester: PlayerRole | null;
  };

  isStarted: boolean;

  pregame: {
    p1Choice: "w" | "b" | null;
    p2Choice: "w" | "b" | null;
    p1Ready: boolean;
    p2Ready: boolean;
  };

  timeControl: TimeControlPreset;

  clock: {
    whiteMs: number;
    blackMs: number;
    active: PlayerRole | null;
    running: boolean;
    lowTimeThresholdMs: number;
    serverNowMs: number;
  };
};

export type PendingPromotion = {
  from: Square;
  to: Square;
};

export type IncomingFriendInvite = {
  inviteId: string;
  fromUserId: string;
  fromName: string;
  roomId: string;
  inviteToken: string | null;
};

export type IncomingInGameFriendRequest = {
  requestId: string;
  fromUserId: string;
  fromName: string;
  fromFriendId: string;
};

export type Premove = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
};

export type AppState = {
  connected: boolean;
  roomId: string | null;
  role: RoomRole | null;
  shareUrl: string;
  snapshot: RoomSnapshot | null;
  orientation: BoardOrientation;
  selectedSquare: Square | null;
  legalTargets: Square[];
  toastMessage: string;
  pendingPromotion: PendingPromotion | null;
  premoves: Premove[];
  autoJoinCode: string | null;
  autoJoinInviteToken: string | null;
  focusMode: boolean;
  liveAnalysisSummary: string;
  lastAnalyzedMoveKey: string | null;
  liveMoveGrades: Record<number, { label: string; cpl: number; category: MoveCategory }>;
  animationStyle: "smooth" | "epic";
  bloodFxEnabled: boolean;
  gameMode: "multiplayer" | "bot";
  botLevel: number;
  botTimeControlId: TimeControlPresetId;
  botPickerOpen: boolean;
  viewCursor: number | null;
  trailFxEnabled: boolean;
  legalMovesEnabled: boolean;
  bestMoveArrow: BestMoveArrow | null;
  bestMoveArrowFen: string | null;
};

export type EngineEval = {
  cp: number;
  mate: number | null;
  bestMove: string;
  pv: string;
};

export type BotDifficultyPreset = {
  level: number;
  label: string;
  elo: number | null;
  skillLevel: number;
  moveTimeMs: number;
  fullStrength: boolean;
};

export type BotTimingProfile = "premove" | "quick" | "standard" | "deep";

export type BotResponseTiming = {
  profile: BotTimingProfile;
  preDelayMs: number;
  engineMoveTimeMs: number;
};
