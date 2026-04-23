import { Chess, Move, PieceSymbol, Square } from "chess.js";
import { io } from "socket.io-client";

import { SquareName, buildSquareList, isLightSquare } from "../../engine";
import "./theme-palette.css";
import "./button-animations.css";
import "./arrows.css";
import "./styles.css";
import "./account-sidebar.css";
import "./notifications.css";
import "./account-sidebar-import.css";
import "./badge-icon-colors.css";
import { buildArrowLayerMarkup } from "./board/arrow-render";
import { canShowBestMoveArrow, parseBestMoveArrow } from "./board/best-move-arrow";
import { createAccountSidebarController, type MultiplayerFriendshipStatus } from "./account-sidebar";
import {
  BOT_DIFFICULTY_PRESETS,
  TIME_CONTROL_PRESETS,
  botDifficultySummary,
  chooseBotMoveByDifficulty,
  clampBotLevel,
  clampBotMoveTimeMs,
  getBotDifficultyPreset,
  getBotTimeControlPreset,
  getLowTimeThresholdMs,
  isTimeControlPresetId,
  normalizeBotTimeControlId,
  randomInt,
} from "./bot-config";
import {
  PIECE_THEME_STORAGE_KEY,
  SOUND_THEME_STORAGE_KEY,
  normalizePieceTheme,
  normalizeSoundEffectName,
  normalizeSoundTheme,
  resolvePieceSpritePath,
  resolveSoundPackSrc,
} from "./contexts/asset-theme-context";
import {
  ANALYZE_LAUNCH_PARAM,
  buildAnalyzeLaunchSessionKey,
  type AnalyzeLaunchPayload,
} from "./contexts/analyze-launch-context";
import {
  ROOM_RETURN_CONTEXT_STORAGE_KEY,
  parseStoredRoomReturnContext,
  type StoredRoomReturnContext,
} from "./contexts/room-return-context";
import {
  clearBotSessionPayloadForUser,
  getBotSessionPayloadForUser,
  saveBotSessionPayloadForUser,
  isFirebaseAuthEnabled,
} from "./firebase";
import { createSoundEffectsPlayer } from "./audio/sound-effects-player";
import { playSoundForHistoryNavigation, playSoundForMoveTraversal } from "./analysis/history-audio";
import {
  appendLiveCategoryMarkerContent,
  buildBeforeAfterFenFromMoves,
  classifyLiveMoveQuality,
  materialFromPerspective,
  summarizeLiveMove,
  verifyLiveBrilliantOffer,
} from "./analysis/live-analysis-utils";
import { createVoiceChatController } from "./live-chat";
import { boardPointFromClient, getSquareFromPoint, squareCenter } from "./main/board-geometry";
import { createBoardEffectsController } from "./main/board-effects";
import {
  countFenPieces,
  detectCapturedPiece,
  getVirtualBoard,
  isTheoreticallyPossible,
  reachesPromotionRank,
} from "./main/chess-helpers";
import { buildMainAppMarkup } from "./main/main-template";
import { canSendFriendRequest, getCurrentSeatInfo, getOpponentSeatInfo, humanRole, seatLabel } from "./main/seat-context-utils";
import type {
  AppState,
  BotDifficultyPreset,
  BotResponseTiming,
  BotTimingProfile,
  IncomingFriendInvite,
  IncomingInGameFriendRequest,
  MoveCategory,
  MoveSummary,
  PendingPromotion,
  PlayerRole,
  PromotionPiece,
  RoomRole,
  RoomSnapshot,
} from "./main/main-types";
import { syncUrl } from "./main/url-utils";
import { createNotificationsStateController } from "./notifications/notification-state";
import { createNotificationsUiController } from "./notifications/notification-ui";
import { buildFinishedGameSignature, buildPgnFromMoves } from "./pgn-utils";
import { StockfishBridge } from "./stockfish-bridge";
import { mountThemeSwitcher, normalizeAnimationStyle, type AnimationStyle, type PieceThemeChoice, type SoundThemeChoice } from "./theme";
import { formatClockMs, getDisplayClockMs } from "./utils/clock-render-utils";
import { isElementMostlyVisible, isTypingTarget, mountGpuAccelerationPolicy, shouldAutoScrollInviteJoin } from "./utils/interaction-utils";

type IncomingRoomJoinRequest = {
  requestId: string;
  fromUserId: string;
  fromName: string;
  roomId: string;
};

type WoodTextureOffsets = {
  fileShift: number;
  fileShift2: number;
  rankShift: number;
  rankShift2: number;
  grainGap1: number;
  grainGap2: number;
  grainRepeat2: number;
  grainGap3: number;
  grainRepeat3: number;
  grainAngle2: number;
  grainAngle3: number;
  grainAlpha1: number;
  grainAlpha2: number;
  grainAlpha3: number;
};

function computeBotResponseTiming(preset: BotDifficultyPreset, playerMove: Move | null): BotResponseTiming {
  const legalReplies = chess.moves({ verbose: true }).length;
  const moveCount = state.snapshot?.moveCount ?? 0;
  const isOpening = moveCount <= 14;
  const isMiddlegameOrLater = moveCount >= 16;
  const playerCaptured = Boolean(playerMove?.captured);
  const playerGaveCheck = Boolean(playerMove?.san.includes("+"));
  const forcedReply = legalReplies <= 2;
  const botRole = getBotRole();
  const botClockMs = state.snapshot
    ? (botRole === "w" ? state.snapshot.clock.whiteMs : state.snapshot.clock.blackMs)
    : null;
  const lowTimeThresholdMs = state.snapshot?.clock.lowTimeThresholdMs ?? 10_000;
  const inTimeTrouble = botClockMs !== null && botClockMs <= lowTimeThresholdMs;
  const veryLowTime = botClockMs !== null && botClockMs <= Math.max(2_500, Math.floor(lowTimeThresholdMs * 0.55));
  const isFastTimeControl = (state.snapshot?.timeControl.initialMs ?? 0) <= 180_000;

  const roll = Math.random();
  let profile: BotTimingProfile = "standard";

  let premoveChance = 0.05;
  if (forcedReply) premoveChance += 0.08;
  if (playerCaptured) premoveChance += 0.04;
  if (isOpening) premoveChance += 0.02;
  if (inTimeTrouble) premoveChance += 0.08;
  if (veryLowTime) premoveChance += 0.12;
  premoveChance = Math.min(0.4, premoveChance);

  let quickChance = 0.27;
  if (isOpening) quickChance += 0.03;
  if (playerCaptured) quickChance += 0.03;
  if (playerGaveCheck) quickChance += 0.02;
  if (forcedReply) quickChance += 0.06;
  if (inTimeTrouble) quickChance += 0.12;
  if (veryLowTime) quickChance += 0.16;
  quickChance = Math.min(0.65, quickChance);

  let deepChance = 0.2;
  if (isMiddlegameOrLater) deepChance += 0.06;
  if (playerCaptured) deepChance += 0.02;
  if (playerGaveCheck) deepChance -= 0.05;
  if (forcedReply) deepChance -= 0.08;
  if (inTimeTrouble) deepChance -= 0.12;
  if (veryLowTime) deepChance -= 0.1;
  deepChance = Math.max(0.04, Math.min(0.34, deepChance));

  if (roll < premoveChance) {
    profile = "premove";
  } else if (roll < premoveChance + quickChance) {
    profile = "quick";
  } else if (roll > 1 - deepChance) {
    profile = "deep";
  }

  const levelMultiplier = 0.82 + preset.level * 0.045;
  const baseThink = preset.moveTimeMs;

  const premoveMinDelay = veryLowTime ? 14 : isFastTimeControl ? 30 : 55;
  const premoveMaxDelay = veryLowTime ? 90 : isFastTimeControl ? 140 : 220;
  const quickMinDelay = veryLowTime ? 75 : isFastTimeControl ? 145 : 240;
  const quickMaxDelay = veryLowTime ? 260 : isFastTimeControl ? 470 : 820;
  const standardMinDelay = veryLowTime ? 150 : isFastTimeControl ? 300 : 520;
  const standardMaxDelay = veryLowTime ? 520 : isFastTimeControl ? 980 : 1700;
  const deepMinDelay = veryLowTime ? 280 : isFastTimeControl ? 680 : 980;
  const deepMaxDelay = veryLowTime ? 880 : isFastTimeControl ? 1850 : 3000;

  if (profile === "premove") {
    return {
      profile,
      preDelayMs: randomInt(premoveMinDelay, premoveMaxDelay),
      engineMoveTimeMs: clampBotMoveTimeMs(baseThink * (0.24 + Math.random() * 0.28)),
    };
  }

  if (profile === "quick") {
    return {
      profile,
      preDelayMs: randomInt(quickMinDelay, quickMaxDelay),
      engineMoveTimeMs: clampBotMoveTimeMs(baseThink * levelMultiplier * (0.48 + Math.random() * 0.44)),
    };
  }

  if (profile === "deep") {
    return {
      profile,
      preDelayMs: randomInt(deepMinDelay, deepMaxDelay),
      engineMoveTimeMs: clampBotMoveTimeMs(baseThink * levelMultiplier * (1.12 + Math.random() * 0.72)),
    };
  }

  return {
    profile,
    preDelayMs: randomInt(standardMinDelay, standardMaxDelay),
    engineMoveTimeMs: clampBotMoveTimeMs(baseThink * levelMultiplier * (0.76 + Math.random() * 0.62)),
  };
}

const chess = new Chess();
const socket = io();
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

mountGpuAccelerationPolicy();

const initialQuery = new URLSearchParams(window.location.search);
const initialRoomCode = initialQuery.get("room")?.trim() ?? null;
const initialInviteToken = initialQuery.get("invite")?.trim() ?? null;
const initialRejoinRequested = initialQuery.get("rejoin") === "1";

// Restaurar roomId guardada en localStorage si existe
const savedRoomId = localStorage.getItem("chess_roomId")?.trim() || null;
const savedInviteToken = localStorage.getItem("chess_roomInviteToken")?.trim() || null;
const storedRoomReturnContext = parseStoredRoomReturnContext(localStorage.getItem(ROOM_RETURN_CONTEXT_STORAGE_KEY));
if (!storedRoomReturnContext) {
  localStorage.removeItem(ROOM_RETURN_CONTEXT_STORAGE_KEY);
}
const hasExplicitRoomJoinIntent = Boolean(initialRoomCode || initialInviteToken || initialRejoinRequested);
const persistedRoomId = storedRoomReturnContext?.roomId ?? savedRoomId;
const autoJoinCode = initialRoomCode ?? persistedRoomId;
const autoJoinInviteToken = initialInviteToken ?? storedRoomReturnContext?.inviteToken ?? savedInviteToken;
const urlRoomMatchesPersistedRoom = Boolean(initialRoomCode && persistedRoomId && initialRoomCode === persistedRoomId);
const autoJoinFromPersistedRoom = initialRejoinRequested
  || urlRoomMatchesPersistedRoom
  || (!initialRoomCode && Boolean(persistedRoomId));
const savedBotLevel = clampBotLevel(Number(localStorage.getItem("chess-bot-level")) || 1);
const savedBotTimeControlId = normalizeBotTimeControlId(localStorage.getItem("chess-bot-time-control"));
const savedBotPlayerSide: PlayerRole = localStorage.getItem("chess-bot-player-side") === "b" ? "b" : "w";
const savedPieceTheme = normalizePieceTheme(localStorage.getItem(PIECE_THEME_STORAGE_KEY));
const savedSoundTheme = normalizeSoundTheme(localStorage.getItem(SOUND_THEME_STORAGE_KEY));

const state: AppState = {
  connected: false,
  roomId: null,
  role: null,
  shareUrl: "",
  snapshot: null,
  orientation: "w",
  selectedSquare: null,
  legalTargets: [],
  toastMessage: "",
  pendingPromotion: null,
  premoves: [],
  autoJoinCode,
  autoJoinInviteToken,
  focusMode: false,
  liveAnalysisSummary: "Live analysis disabled.",
  lastAnalyzedMoveKey: null,
  liveMoveGrades: {},
  animationStyle: normalizeAnimationStyle(localStorage.getItem("chess-animation-style")),
  bloodFxEnabled: localStorage.getItem("chess-blood-fx") === "on",
  gameMode: "multiplayer",
  botLevel: savedBotLevel,
  botTimeControlId: savedBotTimeControlId,
  botPlayerSide: savedBotPlayerSide,
  botPickerOpen: false,
  viewCursor: null,
  trailFxEnabled: localStorage.getItem("chess-trail-fx") === "on",
  legalMovesEnabled: localStorage.getItem("chess-legal-moves") !== "off",
  pieceTheme: savedPieceTheme,
  soundTheme: savedSoundTheme,
  bestMoveArrow: null,
  bestMoveArrowFen: null,
};

(window as any).state = state;

let lastAnimatedMoveKey: string | null = null;
let suppressAnimationForMove: { from: Square; to: Square } | null = null;
let activeGhostAnimation: Animation | null = null;
let activeGhostNode: HTMLElement | null = null;
let activeGhostDestinationPiece: HTMLElement | null = null;
let pendingBoardRefresh = false;
let liveAnalyzer: StockfishBridge | null = null;
let botAnalyzer: StockfishBridge | null = null;
let liveAnalysisToken = 0;
let bestMoveArrowToken = 0;
let currentModalAction: "leave" | "resign" | "bot" | "settings" | null = null;
let animationFinished = true; 
let animatingToSquare: Square | null = null;
let lastRoomStateReceivedAtMs = Date.now();
let lastLiveQualityCalloutKey: string | null = null;
let botPickerHideTimer: number | null = null;
let botPickerLockedScrollY: number | null = null;
let botResponseTimer: number | null = null;
let lastBotSessionPersistAt = 0;
let lastBotCloudSyncAt = 0;
let pendingBotCloudRestore = false;
let pendingFriendInvite: IncomingFriendInvite | null = null;
let pendingInGameFriendRequest: IncomingInGameFriendRequest | null = null;
let activeRoomJoinRequest: IncomingRoomJoinRequest | null = null;
let queuedRoomJoinRequests: IncomingRoomJoinRequest[] = [];
let sendFriendRequestBusy = false;
let lowTimeWarningTimer: number | null = null;
let profileIdentitySyncedForAutoJoin = false;
let shouldCleanUiBeforeAutoJoin = initialRejoinRequested || Boolean(storedRoomReturnContext);
const lowTimeWarningShownByColor: Record<PlayerRole, boolean> = { w: false, b: false };
const woodTextureOffsetsBySquare = new Map<Square, WoodTextureOffsets>();
let woodTextureSeed = (Math.random() * 0xffffffff) >>> 0;

const SMOOTH_MOVE_DURATION_MS = 580;
const FAST_MOVE_DURATION_MS = 244;
const EPIC_MOVE_DURATION_MS = {
  smash: 820,
  spin: 720,
  slide: 580,
} as const;
const LOW_TIME_WARNING_TRIGGER_MS = 30_000;
const LOW_TIME_WARNING_CLEAR_MS = 20_000;
const LOW_TIME_WARNING_EFFECT_MS = 10_000;

const PIECE_SYMBOLS_MAP: Record<string, string> = {
  p: "â™Ÿ",
  n: "â™ž",
  b: "â™",
  r: "â™œ",
  q: "â™›",
} as const;
const ROOM_CODE_LENGTH = 4;
const ROOM_ID_PATTERN = new RegExp(`^\\d{${ROOM_CODE_LENGTH}}$`);
const BOT_SESSION_STORAGE_KEY = "chess-bot-session-v1";
const BOT_SESSION_SCHEMA_VERSION = 1;
const BOT_SESSION_PERSIST_INTERVAL_MS = 1000;
const BOT_CLOUD_SYNC_INTERVAL_MS = 5000;

type PersistedBotSession = {
  version: number;
  savedAt: number;
  botPlayerSide: PlayerRole;
  botLevel: number;
  botTimeControlId: string;
  snapshot: RoomSnapshot;
};

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }

  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomIntInclusive(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomFloat(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

function regenerateWoodTextureOffsets(seed = (Math.random() * 0xffffffff) >>> 0): void {
  woodTextureSeed = seed >>> 0;
  const rand = createSeededRandom(woodTextureSeed ^ 0xa5c31d29);
  woodTextureOffsetsBySquare.clear();

  for (const squareName of buildSquareList("w")) {
    const square = squareName as Square;
    woodTextureOffsetsBySquare.set(square, {
      fileShift: randomIntInclusive(rand, -10, 10),
      fileShift2: randomIntInclusive(rand, -10, 10),
      rankShift: randomIntInclusive(rand, -10, 10),
      rankShift2: randomIntInclusive(rand, -10, 10),
      grainGap1: randomIntInclusive(rand, 8, 18),
      grainGap2: randomIntInclusive(rand, 10, 24),
      grainRepeat2: randomIntInclusive(rand, 18, 46),
      grainGap3: randomIntInclusive(rand, 14, 38),
      grainRepeat3: randomIntInclusive(rand, 24, 68),
      grainAngle2: randomIntInclusive(rand, 94, 116),
      grainAngle3: randomIntInclusive(rand, 6, 30),
      grainAlpha1: randomFloat(rand, 0.045, 0.12),
      grainAlpha2: randomFloat(rand, 0.035, 0.1),
      grainAlpha3: randomFloat(rand, 0.025, 0.085),
    });
  }
}

function applyWoodTextureOffsets(button: HTMLButtonElement, square: Square): void {
  const offsets = woodTextureOffsetsBySquare.get(square);
  if (!offsets) {
    return;
  }

  button.style.setProperty("--base-file-shift", `${offsets.fileShift}px`);
  button.style.setProperty("--base-file-shift-2", `${offsets.fileShift2}px`);
  button.style.setProperty("--base-rank-shift", `${offsets.rankShift}px`);
  button.style.setProperty("--base-rank-shift-2", `${offsets.rankShift2}px`);
  button.style.setProperty("--base-grain-gap-1", `${offsets.grainGap1}px`);
  button.style.setProperty("--base-grain-gap-2", `${offsets.grainGap2}px`);
  button.style.setProperty("--base-grain-repeat-2", `${offsets.grainRepeat2}px`);
  button.style.setProperty("--base-grain-gap-3", `${offsets.grainGap3}px`);
  button.style.setProperty("--base-grain-repeat-3", `${offsets.grainRepeat3}px`);
  button.style.setProperty("--base-grain-angle-2", `${offsets.grainAngle2}deg`);
  button.style.setProperty("--base-grain-angle-3", `${offsets.grainAngle3}deg`);
  button.style.setProperty("--base-grain-alpha-1", offsets.grainAlpha1.toFixed(3));
  button.style.setProperty("--base-grain-alpha-2", offsets.grainAlpha2.toFixed(3));
  button.style.setProperty("--base-grain-alpha-3", offsets.grainAlpha3.toFixed(3));
}

regenerateWoodTextureOffsets();

function resolveSmoothMoveDurationMs(style: AnimationStyle): number {
  return style === "fast" ? FAST_MOVE_DURATION_MS : SMOOTH_MOVE_DURATION_MS;
}

function applyAnimationTiming(style: AnimationStyle): void {
  const cssDuration = style === "epic" ? 720 : resolveSmoothMoveDurationMs(style);
  document.documentElement.style.setProperty("--move-duration", `${cssDuration}ms`);
}

function revealDestinationMarker(marker: HTMLElement | null): void {
  if (!marker) return;
  marker.style.visibility = "";
  marker.style.zIndex = "260";
  marker.classList.remove("marker-reveal");
  void marker.offsetWidth;
  marker.classList.add("marker-reveal");
}


function triggerGameOverScreen(title: string, subtitle: string) {
  const boardWrap = board.parentElement;
  if (!boardWrap) return;

  // Prevent duplicate banners if the board refreshes
  if (boardWrap.querySelector('.endgame-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'endgame-overlay';
  overlay.innerHTML = `
    <div class="endgame-banner">
      <h1 class="endgame-title">${title}</h1>
      <div class="endgame-subtitle">${subtitle}</div>
    </div>
  `;
  
  // Ensure the wrapper is positioned relatively so the absolute overlay fits perfectly inside it
  boardWrap.style.position = "relative"; 
  boardWrap.appendChild(overlay);
}

// â”€â”€ Sound â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const soundEffectsPlayer = createSoundEffectsPlayer();

function getPieceSpritePath(color: PlayerRole, piece: PieceSymbol): string {
  return resolvePieceSpritePath(state.pieceTheme, color, piece);
}

function stopAllCachedAudio(): void {
  soundEffectsPlayer.stopAll();
}

function playSound(name: string): void {
  const normalizedName = normalizeSoundEffectName(name);
  if (!normalizedName) {
    return;
  }

  const src = resolveSoundPackSrc(state.soundTheme, normalizedName);
  soundEffectsPlayer.play(src);
}
let _lastPlayedMoveCount = -1;

function navigateToHistoryPosition(targetPos: number): void {
  const snapshot = state.snapshot;
  if (!snapshot || snapshot.moves.length === 0) {
    return;
  }

  const maxMoves = snapshot.moves.length;
  const previousPos = state.viewCursor !== null ? state.viewCursor : maxMoves;
  const clampedTarget = Math.max(0, Math.min(targetPos, maxMoves));
  if (clampedTarget === previousPos) {
    return;
  }

  state.viewCursor = clampedTarget === maxMoves ? null : clampedTarget;
  playSoundForHistoryNavigation(snapshot, previousPos, clampedTarget, playSound);
  render();
}

function playSoundForSnapshot(snapshot: RoomSnapshot): void {
  const last = snapshot.lastMove;
  if (!last) return;

  playSoundForMoveTraversal(last.san, snapshot.check, snapshot.checkmate || snapshot.draw, playSound);
}

app.innerHTML = buildMainAppMarkup({
  botButtonLabel: botDifficultySummary(getBotDifficultyPreset(savedBotLevel)),
  botDifficultyOptions: BOT_DIFFICULTY_PRESETS,
  timeControlOptions: TIME_CONTROL_PRESETS,
});



const appShell = must<HTMLDivElement>(".app-shell");
const board = must<HTMLDivElement>("#board");
const boardWrap = board.parentElement as HTMLDivElement | null;
const boardEffects = createBoardEffectsController({
  getBoardWrap: () => boardWrap,
  getSquareCenter: (square) => squareCenter(square, state.orientation),
});
const pregamePlaceholder = must<HTMLDivElement>("#pregamePlaceholder");
const inviteJoinCard = must<HTMLElement>("#inviteJoinCard");
const analysisBoardLink = must<HTMLAnchorElement>("#analysisBoardLink");
const quickIdentity = must<HTMLParagraphElement>("#quickIdentity");
const notificationsShell = must<HTMLElement>("#notificationsShell");
const notificationsButton = must<HTMLButtonElement>("#notificationsButton");
const notificationsBadge = must<HTMLSpanElement>("#notificationsBadge");
const notificationsPopover = must<HTMLElement>("#notificationsPopover");
const notificationsStatus = must<HTMLParagraphElement>("#notificationsStatus");
const notificationsList = must<HTMLDivElement>("#notificationsList");
const accountMenuButton = must<HTMLButtonElement>("#accountMenuButton");
const sidebarBackdrop = must<HTMLDivElement>("#sidebarBackdrop");
const accountSidebar = must<HTMLElement>("#accountSidebar");
const sidebarCloseButton = must<HTMLButtonElement>("#sidebarCloseButton");
const sidebarProfileTab = must<HTMLButtonElement>("#sidebarProfileTab");
const sidebarHistoryTab = must<HTMLButtonElement>("#sidebarHistoryTab");
const sidebarProfilePanel = must<HTMLElement>("#sidebarProfilePanel");
const sidebarHistoryPanel = must<HTMLElement>("#sidebarHistoryPanel");
const historyPanelStatus = must<HTMLParagraphElement>("#historyPanelStatus");
const savedGamesList = must<HTMLDivElement>("#savedGamesList");
const authStatus = must<HTMLParagraphElement>("#authStatus");
const storedGamesMeta = must<HTMLParagraphElement>("#storedGamesMeta");
const usernameInput = must<HTMLInputElement>("#usernameInput");
const saveUsernameButton = must<HTMLButtonElement>("#saveUsernameButton");
const friendsToggleButton = must<HTMLButtonElement>("#friendsToggleButton");
const friendsComposer = must<HTMLDivElement>("#friendsComposer");
const friendPlayerId = must<HTMLParagraphElement>("#friendPlayerId");
const copyPlayerIdButton = must<HTMLButtonElement>("#copyPlayerIdButton");
const friendIdInput = must<HTMLInputElement>("#friendIdInput");
const addFriendButton = must<HTMLButtonElement>("#addFriendButton");
const friendsStatus = must<HTMLParagraphElement>("#friendsStatus");
const friendsList = must<HTMLDivElement>("#friendsList");
const guestModeButton = must<HTMLButtonElement>("#guestModeButton");
const signInGoogleButton = must<HTMLButtonElement>("#signInGoogleButton");
const signOutButton = must<HTMLButtonElement>("#signOutButton");
const roomInput = must<HTMLInputElement>("#roomInput");
const roomBadge = must<HTMLDivElement>("#roomBadge");
const roleBadge = must<HTMLDivElement>("#roleBadge");
const matchStatus = must<HTMLDivElement>("#matchStatus");
const boardCaption = must<HTMLDivElement>("#boardCaption");
const roomInviteButton = must<HTMLButtonElement>("#roomInviteButton");
const seatCard = must<HTMLElement>("#seatCard");
const summaryCard = must<HTMLElement>("#summaryCard");
const movesCard = must<HTMLElement>("#movesCard");
const whiteSeat = must<HTMLSpanElement>("#whiteSeat");
const blackSeat = must<HTMLSpanElement>("#blackSeat");
const turnMeta = must<HTMLSpanElement>("#turnMeta");
const movesMeta = must<HTMLSpanElement>("#movesMeta");
const spectatorMeta = must<HTMLSpanElement>("#spectatorMeta");
const inGameFriendPanel = must<HTMLElement>("#inGameFriendPanel");
const inGameFriendMeta = must<HTMLParagraphElement>("#inGameFriendMeta");
const sendFriendRequestButton = must<HTMLButtonElement>("#sendFriendRequestButton");
const inGameFriendRequest = must<HTMLElement>("#inGameFriendRequest");
const inGameFriendRequestText = must<HTMLParagraphElement>("#inGameFriendRequestText");
const acceptInGameFriendRequestButton = must<HTMLButtonElement>("#acceptInGameFriendRequestButton");
const declineInGameFriendRequestButton = must<HTMLButtonElement>("#declineInGameFriendRequestButton");
const summaryText = must<HTMLParagraphElement>("#summaryText");
const liveAnalysisText = must<HTMLParagraphElement>("#liveAnalysisText");
const chatFabButton = must<HTMLButtonElement>("#chatFabButton");
const chatFabBadge = must<HTMLSpanElement>("#chatFabBadge");
const chatPanel = must<HTMLElement>("#chatPanel");
const chatCloseButton = must<HTMLButtonElement>("#chatCloseButton");
const chatStatusText = must<HTMLParagraphElement>("#chatStatusText");
const chatConsentButton = must<HTMLButtonElement>("#chatConsentButton");
const chatMessages = must<HTMLDivElement>("#chatMessages");
const chatInput = must<HTMLInputElement>("#chatInput");
const chatSendButton = must<HTMLButtonElement>("#chatSendButton");
const chatVoiceButton = must<HTMLButtonElement>("#chatVoiceButton");
const moveList = must<HTMLDivElement>("#moveList");
const toast = must<HTMLDivElement>("#toast");
const friendInvitePrompt = must<HTMLElement>("#friendInvitePrompt");
const friendInvitePromptText = must<HTMLParagraphElement>("#friendInvitePromptText");
const friendInviteDeclineButton = must<HTMLButtonElement>("#friendInviteDeclineButton");
const friendInviteAcceptButton = must<HTMLButtonElement>("#friendInviteAcceptButton");
const roomJoinRequestPrompt = must<HTMLElement>("#roomJoinRequestPrompt");
const roomJoinRequestPromptText = must<HTMLParagraphElement>("#roomJoinRequestPromptText");
const roomJoinRequestDeclineButton = must<HTMLButtonElement>("#roomJoinRequestDeclineButton");
const roomJoinRequestAcceptButton = must<HTMLButtonElement>("#roomJoinRequestAcceptButton");
const promotionDialog = must<HTMLDivElement>("#promotionDialog");
const createRoomButton = must<HTMLButtonElement>("#createRoomButton");
const backToMenuButton = must<HTMLButtonElement>("#backToMenuButton");
const focusHud = must<HTMLDivElement>("#focusHud");
const focusTimer = must<HTMLSpanElement>("#focusTimer");
const focusModeButton = must<HTMLButtonElement>("#focusModeBtn");
const focusMaterialHud = must<HTMLDivElement>("#focusMaterialHud");
const playBotButton = must<HTMLButtonElement>("#playBotButton");
const botDifficultyOverlay = must<HTMLDivElement>("#botDifficultyOverlay");
const botDifficultyPicker = must<HTMLDivElement>("#botDifficultyPicker");
const botDifficultyBackdrop = must<HTMLDivElement>("#botDifficultyBackdrop");
const botDifficultySelect = must<HTMLSelectElement>("#botDifficultySelect");
const botTimeControlSelect = must<HTMLSelectElement>("#botTimeControlSelect");
const botSideSelect = must<HTMLSelectElement>("#botSideSelect");
const startBotGameButton = must<HTMLButtonElement>("#startBotGameButton");
const confirmDialog = must<HTMLElement>("#confirmDialog");
const confirmYesBtn = must<HTMLButtonElement>("#confirmYesBtn");
const confirmNoBtn = must<HTMLButtonElement>("#confirmNoBtn");
const modalTitle = must<HTMLElement>("#modalTitle");
const modalDescription = must<HTMLElement>("#modalDescription");
const gameNav = must<HTMLElement>("#gameNav");

const pregameWaiting = must<HTMLDivElement>("#pregameWaiting");
const pregameSelection = must<HTMLDivElement>("#pregameSelection");
const multiplayerTimeControlSelect = must<HTMLSelectElement>("#multiplayerTimeControlSelect");
const modeHint = must<HTMLParagraphElement>("#modeHint");
const myPickWhite = must<HTMLButtonElement>("#myPickWhite");
const myPickBlack = must<HTMLButtonElement>("#myPickBlack");
const opPickWhite = must<HTMLButtonElement>("#opPickWhite");
const opPickBlack = must<HTMLButtonElement>("#opPickBlack");
const myReadyBadge = must<HTMLDivElement>("#myReadyBadge");
const opReadyBadge = must<HTMLDivElement>("#opReadyBadge");
const pregameReadyBtn = must<HTMLButtonElement>("#pregameReadyBtn");
const pregameConflictWarning = must<HTMLDivElement>("#pregameConflictWarning");
const whiteClock = must<HTMLSpanElement>("#whiteClock");
const blackClock = must<HTMLSpanElement>("#blackClock");

const ROOM_CREATE_BUTTON_LABEL = "Create room";
const ROOM_CREATE_BUTTON_PENDING_LABEL = "Creating room...";
const ROOM_CREATE_TRANSITION_CLASS = "room-create-transition";
const ROOM_CREATE_TRANSITION_MS = 620;
const PREGAME_COLOR_CONFLICT_ERROR = "Both players selected the same color. Please choose different colors to continue.";

let roomCreatePending = false;
let roomCreateTransitionTimer: number | null = null;

function clearRoomCreateTransitionClass(): void {
  appShell.classList.remove(ROOM_CREATE_TRANSITION_CLASS);
  if (roomCreateTransitionTimer !== null) {
    window.clearTimeout(roomCreateTransitionTimer);
    roomCreateTransitionTimer = null;
  }
}

function setRoomCreatePending(next: boolean): void {
  roomCreatePending = next;
  createRoomButton.classList.toggle("is-pending", next);
  createRoomButton.textContent = next ? ROOM_CREATE_BUTTON_PENDING_LABEL : ROOM_CREATE_BUTTON_LABEL;
}

function triggerRoomCreateTransition(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    clearRoomCreateTransitionClass();
    return;
  }

  clearRoomCreateTransitionClass();
  // Force reflow so class-based entrance animations retrigger reliably.
  void appShell.offsetWidth;
  appShell.classList.add(ROOM_CREATE_TRANSITION_CLASS);
  roomCreateTransitionTimer = window.setTimeout(() => {
    appShell.classList.remove(ROOM_CREATE_TRANSITION_CLASS);
    roomCreateTransitionTimer = null;
  }, ROOM_CREATE_TRANSITION_MS);
}

multiplayerTimeControlSelect.addEventListener("change", () => {
  const nextMode = multiplayerTimeControlSelect.value;
  if (!isTimeControlPresetId(nextMode)) {
    return;
  }

  socket.emit("pregame:mode", { mode: nextMode });
});

myPickWhite.addEventListener("click", () => socket.emit("pregame:select", { color: "w" }));
myPickBlack.addEventListener("click", () => socket.emit("pregame:select", { color: "b" }));
pregameReadyBtn.addEventListener("click", () => socket.emit("pregame:ready"));

mountThemeSwitcher();
applyAnimationTiming(state.animationStyle);

window.addEventListener("animationchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ style: AnimationStyle }>;
  state.animationStyle = customEvent.detail.style;
  applyAnimationTiming(state.animationStyle);
});



window.addEventListener("bloodfxchange", (event: Event) => {
  const customEvent = event as CustomEvent<{ enabled: boolean }>;
  state.bloodFxEnabled = customEvent.detail.enabled;
});

window.addEventListener("legalmoveschange" , (event: Event) => {
  const customEvent = event as CustomEvent<{ enabled: boolean }>;
  state.legalMovesEnabled = customEvent.detail.enabled;
  requestBoardRefresh(true);
});

window.addEventListener("piecethemechange", (event: Event) => {
  const customEvent = event as CustomEvent<{ theme: PieceThemeChoice }>;
  state.pieceTheme = customEvent.detail.theme;
  requestBoardRefresh(true);
  updateCaption();
  updateFocusHud();
});

window.addEventListener("soundthemechange", (event: Event) => {
  const customEvent = event as CustomEvent<{ theme: SoundThemeChoice }>;
  state.soundTheme = customEvent.detail.theme;
  stopAllCachedAudio();
});


const spectateRoomButton = must<HTMLButtonElement>("#spectateRoomButton");
const joinGrid = must<HTMLElement>(".join-grid");
const copyLinkButton = must<HTMLButtonElement>("#copyLinkButton");
const leaveRoomButton = must<HTMLButtonElement>("#leaveRoomButton");
const flipBoardButton = must<HTMLButtonElement>("#flipBoardButton");
const rematchButton = must<HTMLButtonElement>("#rematchButton");
const roomSettingsButton = must<HTMLButtonElement>("#roomSettingsButton");
const undoRequestButton = must<HTMLButtonElement>("#undoRequestButton");
const undoDeclineButton = must<HTMLButtonElement>("#undoDeclineButton");
const labelsOnlyButton = must<HTMLButtonElement>("#labelsOnlyButton");
const arrowLayer = must<SVGSVGElement>("#arrowLayer");
const resignButton = must<HTMLButtonElement>("#resignButton");

const liveNavFirst = must<HTMLButtonElement>("#liveNavFirst");
const liveNavPrev = must<HTMLButtonElement>("#liveNavPrev");
const liveNavNext = must<HTMLButtonElement>("#liveNavNext");
const liveNavLast = must<HTMLButtonElement>("#liveNavLast");
const gameNavRow = must<HTMLDivElement>("#gameNavRow");

const arrowAnnotations = new Set<string>();
const squareAnnotations = new Set<string>(); 

const accountSidebarController = createAccountSidebarController({
  socket,
  refs: {
    quickIdentity,
    accountMenuButton,
    sidebarBackdrop,
    accountSidebar,
    sidebarCloseButton,
    sidebarProfileTab,
    sidebarHistoryTab,
    sidebarProfilePanel,
    sidebarHistoryPanel,
    historyPanelStatus,
    savedGamesList,
    authStatus,
    storedGamesMeta,
    usernameInput,
    saveUsernameButton,
    friendsToggleButton,
    friendsComposer,
    friendPlayerId,
    copyPlayerIdButton,
    friendIdInput,
    addFriendButton,
    friendsStatus,
    friendsList,
    guestModeButton,
    signInGoogleButton,
    signOutButton,
  },
  showToast,
  onIdentityUpdated: () => {
    void (async () => {
      await syncBotSessionWithCloudIdentity();
      tryAutoJoinPendingRoom();
      render();
    })();
  },
  onOpenSavedGameForAnalysis: (pgn: string) => {
    openAnalyzeInIsolatedTab({
      postGamePgn: pgn,
    });
  },
});

const voiceChatController = createVoiceChatController({
  socket,
  refs: {
    chatFabButton,
    chatFabBadge,
    chatPanel,
    chatCloseButton,
    chatStatusText,
    chatConsentButton,
    chatMessages,
    chatInput,
    chatSendButton,
    chatVoiceButton,
  },
  showToast,
});

const notificationsStateController = createNotificationsStateController({
  socket,
  getResponderDisplayName: () => accountSidebarController.getCurrentPlayerName(),
  showToast,
});

const notificationsUiController = createNotificationsUiController({
  refs: {
    shell: notificationsShell,
    button: notificationsButton,
    badge: notificationsBadge,
    popover: notificationsPopover,
    status: notificationsStatus,
    list: notificationsList,
  },
  onAccept: (requestId: string) => notificationsStateController.accept(requestId),
  onDecline: (requestId: string) => notificationsStateController.decline(requestId),
});

const unsubscribeNotificationsState = notificationsStateController.subscribe((snapshot) => {
  notificationsUiController.render(snapshot);
});

function normalizeUsername(value: string): string {
  return accountSidebarController.normalizeUsername(value);
}

function getCurrentPlayerName(): string {
  return accountSidebarController.getCurrentPlayerName();
}

function emitCurrentProfileName(): void {
  accountSidebarController.emitCurrentProfileName();
}

function getCurrentRoomInviteToken(): string | null {
  if (state.shareUrl) {
    try {
      const parsed = new URL(state.shareUrl, window.location.origin);
      const token = parsed.searchParams.get("invite")?.trim() || "";
      if (token) {
        return token;
      }
    } catch {
      // Ignore malformed share URL and fall back to persisted token.
    }
  }

  const persistedToken = localStorage.getItem("chess_roomInviteToken")?.trim() || "";
  return persistedToken || null;
}

function persistRoomReturnContextForAnalysis(): void {
  if (!state.roomId || state.gameMode !== "multiplayer") {
    localStorage.removeItem(ROOM_RETURN_CONTEXT_STORAGE_KEY);
    return;
  }

  const payload: StoredRoomReturnContext = {
    roomId: state.roomId,
    inviteToken: getCurrentRoomInviteToken(),
    createdAt: Date.now(),
  };
  localStorage.setItem(ROOM_RETURN_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
}

function openAnalyzeInIsolatedTab(payload: AnalyzeLaunchPayload | null = null): void {
  persistRoomReturnContextForAnalysis();

  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    showToast("Pop-up blocked. Allow pop-ups to open analysis in a separate tab.");
    return;
  }

  try {
    tab.opener = null;
  } catch {
    // Ignore browsers that disallow overriding opener.
  }

  const targetUrl = new URL("/analyze", window.location.origin);
  if (payload) {
    const launchToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const sessionKey = buildAnalyzeLaunchSessionKey(launchToken);
    try {
      tab.sessionStorage.setItem(sessionKey, JSON.stringify(payload));
      targetUrl.searchParams.set(ANALYZE_LAUNCH_PARAM, launchToken);
    } catch {
      // Fallback for storage failures: use existing localStorage bootstrap path.
      if (payload.postGameMeta) {
        localStorage.setItem("postGameMeta", JSON.stringify(payload.postGameMeta));
      }
      if (payload.postGamePgn) {
        localStorage.removeItem("postGameMoves");
        localStorage.setItem("postGamePgn", payload.postGamePgn);
      } else if (payload.postGameMoves && payload.postGameMoves.length > 0) {
        localStorage.removeItem("postGamePgn");
        localStorage.setItem("postGameMoves", JSON.stringify(payload.postGameMoves));
      }
    }
  }

  tab.location.assign(targetUrl.toString());
  tab.focus();
}

function resetTransientRoomUiBeforeControlledRejoin(): void {
  setRoomCreatePending(false);
  clearRoomCreateTransitionClass();
  clearScheduledBotResponse();
  pendingFriendInvite = null;
  pendingInGameFriendRequest = null;
  hideFriendInvitePrompt();
  clearRoomJoinRequestQueue();
  setSendFriendRequestState(false);
  state.roomId = null;
  state.role = null;
  state.shareUrl = "";
  state.snapshot = null;
  state.pendingPromotion = null;
  state.premoves = [];
  state.selectedSquare = null;
  state.legalTargets = [];
  state.viewCursor = null;
  state.focusMode = false;
  state.gameMode = "multiplayer";
  accountSidebarController.setFriendPresenceActivity(null);
  state.liveAnalysisSummary = "Live analysis disabled.";
  state.lastAnalyzedMoveKey = null;
  state.liveMoveGrades = {};
  currentModalAction = null;
  suppressAnimationForMove = null;
  lastAnimatedMoveKey = null;
  pendingBoardRefresh = false;
  animationFinished = true;
  animatingToSquare = null;
  _lastPlayedMoveCount = -1;
  roomInput.value = "";
  regenerateWoodTextureOffsets();
  voiceChatController.syncSession({
    roomId: null,
    role: null,
    gameMode: "multiplayer",
    isGameActive: false,
  });
  clearArrows();
  chess.reset();
  resetLowTimeWarningState();
  renderSession();
  renderMoves();
  updateCaption();
}

function tryAutoJoinPendingRoom(): void {
  if (!state.autoJoinCode) {
    return;
  }

  if (!ROOM_ID_PATTERN.test(state.autoJoinCode)) {
    state.autoJoinCode = null;
    state.autoJoinInviteToken = null;
    return;
  }

  if (shouldCleanUiBeforeAutoJoin) {
    resetTransientRoomUiBeforeControlledRejoin();
    shouldCleanUiBeforeAutoJoin = false;
  }

  const hasInviteToken = Boolean(state.autoJoinInviteToken);
  const shouldPreferSeatRecovery = autoJoinFromPersistedRoom && !hasInviteToken;
  if (shouldPreferSeatRecovery && (!profileIdentitySyncedForAutoJoin || !accountSidebarController.isIdentityHydrated())) {
    // Wait for auth/profile hydration so server can restore by stable user identity.
    return;
  }
  const shouldAttemptSeatRecovery = shouldPreferSeatRecovery && Boolean(accountSidebarController.getAuthenticatedUserId());
  if (shouldPreferSeatRecovery && !shouldAttemptSeatRecovery) {
    // Do not auto-join as spectator when we intended seat recovery.
    // Keep pending room context so a later identity sync can recover the seat.
    return;
  }

  socket.emit("room:join", {
    roomId: state.autoJoinCode,
    inviteToken: state.autoJoinInviteToken,
    spectateOnly: !hasInviteToken && !shouldAttemptSeatRecovery,
  });
  clearPersistedBotSession();

  state.autoJoinCode = null;
  state.autoJoinInviteToken = null;
}

async function clearPersistedBotSessionFromCloud(): Promise<void> {
  if (!isFirebaseAuthEnabled()) {
    return;
  }

  const userId = accountSidebarController.getAuthenticatedUserId();
  if (!userId) {
    return;
  }

  try {
    await clearBotSessionPayloadForUser(userId);
    lastBotCloudSyncAt = Date.now();
  } catch {
    // Ignore cloud clear failures; local state is still authoritative.
  }
}

function clearPersistedBotSession(options: { clearCloud?: boolean } = {}): void {
  const shouldClearCloud = options.clearCloud ?? true;
  lastBotSessionPersistAt = 0;
  localStorage.removeItem(BOT_SESSION_STORAGE_KEY);

  if (shouldClearCloud) {
    void clearPersistedBotSessionFromCloud();
  }
}

function isBoardSquare(value: unknown): value is Square {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}

function parsePersistedBotSession(raw: string | null): PersistedBotSession | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedBotSession>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (parsed.version !== BOT_SESSION_SCHEMA_VERSION) {
      return null;
    }

    const botPlayerSide = parsed.botPlayerSide;
    if (botPlayerSide !== "w" && botPlayerSide !== "b") {
      return null;
    }

    if (typeof parsed.botLevel !== "number" || !Number.isFinite(parsed.botLevel)) {
      return null;
    }

    if (typeof parsed.botTimeControlId !== "string") {
      return null;
    }

    if (!parsed.snapshot || typeof parsed.snapshot !== "object") {
      return null;
    }

    const snapshot = parsed.snapshot as Partial<RoomSnapshot>;
    if (
      typeof snapshot.fen !== "string"
      || !Array.isArray(snapshot.moves)
      || (snapshot.turn !== "w" && snapshot.turn !== "b")
      || !snapshot.timeControl
      || typeof snapshot.timeControl !== "object"
      || typeof snapshot.clock !== "object"
    ) {
      return null;
    }

    const movesValid = snapshot.moves.every((move) => {
      const candidate = move as Partial<MoveSummary>;
      return candidate
        && (candidate.color === "w" || candidate.color === "b")
        && isBoardSquare(candidate.from)
        && isBoardSquare(candidate.to)
        && typeof candidate.san === "string"
        && candidate.san.trim().length > 0
        && typeof candidate.piece === "string";
    });

    if (!movesValid) {
      return null;
    }

    const savedAt = typeof parsed.savedAt === "number" && Number.isFinite(parsed.savedAt)
      ? parsed.savedAt
      : Date.now();

    return {
      version: BOT_SESSION_SCHEMA_VERSION,
      savedAt,
      botPlayerSide,
      botLevel: parsed.botLevel,
      botTimeControlId: parsed.botTimeControlId,
      snapshot: parsed.snapshot as RoomSnapshot,
    };
  } catch {
    return null;
  }
}

function buildPersistedBotSession(): PersistedBotSession | null {
  if (state.gameMode !== "bot" || !state.snapshot) {
    return null;
  }

  return {
    version: BOT_SESSION_SCHEMA_VERSION,
    savedAt: Date.now(),
    botPlayerSide: getBotPlayerRole(),
    botLevel: state.botLevel,
    botTimeControlId: state.botTimeControlId,
    snapshot: state.snapshot,
  };
}

async function persistBotSessionToCloud(payloadJson: string, force = false): Promise<void> {
  if (!isFirebaseAuthEnabled()) {
    return;
  }

  const userId = accountSidebarController.getAuthenticatedUserId();
  if (!userId) {
    return;
  }

  const now = Date.now();
  if (!force && now - lastBotCloudSyncAt < BOT_CLOUD_SYNC_INTERVAL_MS) {
    return;
  }

  try {
    await saveBotSessionPayloadForUser(userId, payloadJson);
    lastBotCloudSyncAt = now;
  } catch {
    // Ignore cloud persistence failures; local fallback remains enabled.
  }
}

function persistBotSession(force = false): void {
  const payload = buildPersistedBotSession();
  if (!payload) {
    clearPersistedBotSession();
    return;
  }

  const now = Date.now();
  if (!force && now - lastBotSessionPersistAt < BOT_SESSION_PERSIST_INTERVAL_MS) {
    return;
  }

  try {
    const payloadJson = JSON.stringify(payload);
    localStorage.setItem(BOT_SESSION_STORAGE_KEY, payloadJson);
    lastBotSessionPersistAt = now;
    void persistBotSessionToCloud(payloadJson, force);
  } catch {
    // Ignore storage failures in private mode / quota constraints.
  }
}

function hydratePersistedBotSession(
  persisted: PersistedBotSession,
  source: "local" | "cloud",
): boolean {
  const replay = new Chess();
  for (const move of persisted.snapshot.moves) {
    try {
      const applied = replay.move(move.san);
      if (!applied) {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (replay.fen() !== persisted.snapshot.fen) {
    return false;
  }

  chess.reset();
  for (const move of persisted.snapshot.moves) {
    chess.move(move.san);
  }

  const normalizedSide: PlayerRole = persisted.botPlayerSide === "b" ? "b" : "w";
  const normalizedBotLevel = clampBotLevel(persisted.botLevel);
  const normalizedBotTimeControlId = normalizeBotTimeControlId(persisted.botTimeControlId);
  const snapshotTimeControlId = isTimeControlPresetId(persisted.snapshot.timeControl.id)
    ? persisted.snapshot.timeControl.id
    : normalizedBotTimeControlId;
  const normalizedLowTimeThresholdMs = getLowTimeThresholdMs(persisted.snapshot.timeControl.initialMs);

  state.gameMode = "bot";
  state.botPlayerSide = normalizedSide;
  state.botLevel = normalizedBotLevel;
  state.botTimeControlId = snapshotTimeControlId;
  state.role = normalizedSide;
  state.orientation = normalizedSide;
  state.roomId = "BOT";
  state.shareUrl = "";
  state.pendingPromotion = null;
  state.premoves = [];
  state.selectedSquare = null;
  state.legalTargets = [];
  state.viewCursor = null;
  state.autoJoinCode = null;
  state.autoJoinInviteToken = null;
  shouldCleanUiBeforeAutoJoin = false;
  state.snapshot = {
    ...persisted.snapshot,
    roomId: "LOCAL",
    timeControl: {
      ...persisted.snapshot.timeControl,
      id: snapshotTimeControlId,
    },
    clock: {
      ...persisted.snapshot.clock,
      lowTimeThresholdMs: normalizedLowTimeThresholdMs,
    },
  };
  localStorage.removeItem("chess_roomId");
  localStorage.removeItem("chess_roomInviteToken");
  localStorage.removeItem(ROOM_RETURN_CONTEXT_STORAGE_KEY);
  syncUrl(null);

  accountSidebarController.setFriendPresenceActivity("playing-bot");
  regenerateWoodTextureOffsets();
  clearArrows();
  resetLowTimeWarningState();
  lastRoomStateReceivedAtMs = Date.now();
  syncBotClockToNow(lastRoomStateReceivedAtMs);
  clearScheduledBotResponse();

  const botRole = getBotRole();
  if (
    state.snapshot.turn === botRole
    && !state.snapshot.checkmate
    && !state.snapshot.draw
    && state.snapshot.winner === null
  ) {
    scheduleBotResponse(null);
  }

  persistBotSession(true);
  showToast(source === "cloud" ? "Recovered your bot game from cloud." : "Recovered your bot game.");
  return true;
}

function restorePersistedBotSessionFromLocal(): boolean {
  if (hasExplicitRoomJoinIntent) {
    return false;
  }

  const persisted = parsePersistedBotSession(localStorage.getItem(BOT_SESSION_STORAGE_KEY));
  if (!persisted) {
    clearPersistedBotSession({ clearCloud: false });
    return false;
  }

  const hydrated = hydratePersistedBotSession(persisted, "local");
  if (!hydrated) {
    clearPersistedBotSession({ clearCloud: false });
  }
  return hydrated;
}

async function restorePersistedBotSessionFromCloud(): Promise<boolean> {
  if (pendingBotCloudRestore || hasExplicitRoomJoinIntent) {
    return false;
  }

  if (state.gameMode === "bot" || Boolean(state.roomId)) {
    return false;
  }

  if (!isFirebaseAuthEnabled()) {
    return false;
  }

  const userId = accountSidebarController.getAuthenticatedUserId();
  if (!userId) {
    return false;
  }

  pendingBotCloudRestore = true;
  try {
    const payloadJson = await getBotSessionPayloadForUser(userId);
    const persisted = parsePersistedBotSession(payloadJson);
    if (!persisted) {
      return false;
    }

    const hydrated = hydratePersistedBotSession(persisted, "cloud");
    if (!hydrated) {
      return false;
    }

    render();
    return true;
  } catch {
    return false;
  } finally {
    pendingBotCloudRestore = false;
  }
}

async function syncBotSessionWithCloudIdentity(): Promise<void> {
  if (state.gameMode === "bot" && state.snapshot) {
    persistBotSession(true);
    return;
  }

  if (state.roomId || hasExplicitRoomJoinIntent) {
    return;
  }

  await restorePersistedBotSessionFromCloud();
}

async function maybePersistFinishedGame(snapshot: RoomSnapshot | null): Promise<void> {
  if (!snapshot) {
    return;
  }

  const gameEnded = snapshot.checkmate || snapshot.draw || snapshot.winner !== null;
  if (!gameEnded || snapshot.moveCount === 0) {
    return;
  }

  const signature = buildFinishedGameSignature(state.gameMode, snapshot);
  const result: "1-0" | "0-1" | "1/2-1/2" | "*" =
    snapshot.draw
      ? "1/2-1/2"
      : snapshot.winner === "w"
      ? "1-0"
      : snapshot.winner === "b"
      ? "0-1"
      : "*";
  const pgn = buildPgnFromMoves(snapshot.moves, {
    whiteName: snapshot.players.whiteName,
    blackName: snapshot.players.blackName,
    result,
  });
  await accountSidebarController.handleFinishedGamePersist({ signature, pgn });
}

void accountSidebarController.initialize();
void notificationsStateController.initialize();
void restorePersistedBotSessionFromLocal();
void syncBotSessionWithCloudIdentity();

window.addEventListener("beforeunload", () => {
  unsubscribeNotificationsState();
  notificationsUiController.dispose();
  notificationsStateController.dispose();
  accountSidebarController.dispose();
  voiceChatController.dispose();
});

function refreshBotDifficultyUi(): void {
  playBotButton.textContent = "Play vs Bot";
  playBotButton.classList.toggle("is-active", state.botPickerOpen);
  botDifficultySelect.value = String(getBotDifficultyPreset(state.botLevel).level);
  botTimeControlSelect.value = state.botTimeControlId;
  botSideSelect.value = state.botPlayerSide;

  if (state.botPickerOpen) {
    botDifficultyOverlay.hidden = false;
    if (botPickerHideTimer !== null) {
      window.clearTimeout(botPickerHideTimer);
      botPickerHideTimer = null;
    }
  } else if (botPickerHideTimer === null) {
    botPickerHideTimer = window.setTimeout(() => {
      if (!state.botPickerOpen) {
        botDifficultyOverlay.hidden = true;
      }
      botPickerHideTimer = null;
    }, 430);
  }

  botDifficultyOverlay.classList.toggle("is-open", state.botPickerOpen);
  botDifficultyOverlay.setAttribute("aria-hidden", String(!state.botPickerOpen));
  botDifficultyPicker.classList.toggle("is-open", state.botPickerOpen);
  botDifficultyPicker.setAttribute("aria-hidden", String(!state.botPickerOpen));
  botDifficultyBackdrop.classList.toggle("is-open", state.botPickerOpen);
  botDifficultyBackdrop.setAttribute("aria-hidden", String(!state.botPickerOpen));
  document.body.classList.toggle("bot-picker-open", state.botPickerOpen);
  syncBotPickerScrollLock(state.botPickerOpen);
}

function isBotPickerMobileViewport(): boolean {
  return window.matchMedia("(max-width: 900px)").matches;
}

function syncBotPickerScrollLock(shouldLock: boolean): void {
  if (shouldLock && isBotPickerMobileViewport()) {
    if (botPickerLockedScrollY !== null) {
      return;
    }

    botPickerLockedScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${botPickerLockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    return;
  }

  if (botPickerLockedScrollY === null) {
    return;
  }

  const restoreY = botPickerLockedScrollY;
  botPickerLockedScrollY = null;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, restoreY);
}

function openBotDifficultyPicker(): void {
  botDifficultyOverlay.hidden = false;
  state.botPickerOpen = true;
  refreshBotDifficultyUi();
  window.requestAnimationFrame(() => botDifficultySelect.focus());
}

function closeBotDifficultyPicker(): void {
  if (!state.botPickerOpen) {
    return;
  }
  state.botPickerOpen = false;
  refreshBotDifficultyUi();
}

function startBotGameWithSelection(): void {
  closeBotDifficultyPicker();
  if (state.roomId && state.gameMode === "multiplayer") {
    toggleConfirmModal(true, "bot");
  } else {
    startBotGame(state.botPlayerSide);
  }
}

botDifficultySelect.addEventListener("change", () => {
  const nextLevel = clampBotLevel(Number(botDifficultySelect.value));
  state.botLevel = nextLevel;
  localStorage.setItem("chess-bot-level", String(nextLevel));
  refreshBotDifficultyUi();

  if (state.gameMode === "bot") {
    showToast(`Bot strength updated: ${botDifficultySummary(getBotDifficultyPreset(nextLevel))}.`);
  }
});

botTimeControlSelect.addEventListener("change", () => {
  const nextTimeControlId = normalizeBotTimeControlId(botTimeControlSelect.value);
  state.botTimeControlId = nextTimeControlId;
  localStorage.setItem("chess-bot-time-control", nextTimeControlId);
  refreshBotDifficultyUi();

  if (state.gameMode === "bot") {
    const preset = getBotTimeControlPreset(nextTimeControlId);
    showToast(`Bot timer set to ${preset.label} (applies to next bot game).`);
  }
});

botSideSelect.addEventListener("change", () => {
  const nextSide: PlayerRole = botSideSelect.value === "b" ? "b" : "w";
  state.botPlayerSide = nextSide;
  localStorage.setItem("chess-bot-player-side", nextSide);
  refreshBotDifficultyUi();

  if (state.gameMode === "bot") {
    showToast(`Bot side set to ${nextSide === "w" ? "White" : "Black"} (applies to next bot game).`);
  }
});

refreshBotDifficultyUi();

analysisBoardLink.addEventListener("click", (event) => {
  event.preventDefault();
  openAnalyzeInIsolatedTab();
});

playBotButton.addEventListener("click", () => {
  if (state.botPickerOpen) {
    closeBotDifficultyPicker();
  } else {
    openBotDifficultyPicker();
  }
});

startBotGameButton.addEventListener("click", () => {
  startBotGameWithSelection();
});

window.addEventListener("pointerdown", (event) => {
  if (!state.botPickerOpen) {
    return;
  }

  const target = event.target as Node | null;
  if (target && (botDifficultyPicker.contains(target) || playBotButton.contains(target))) {
    return;
  }

  closeBotDifficultyPicker();
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.botPickerOpen) {
    return;
  }
  closeBotDifficultyPicker();
});

window.addEventListener("resize", () => {
  syncBotPickerScrollLock(state.botPickerOpen);
});

createRoomButton.addEventListener("click", () => {
  closeBotDifficultyPicker();
  if (roomCreatePending) {
    return;
  }
  if (!accountSidebarController.canPlayOnlineMultiplayer()) {
    showToast("Guest mode is spectator-only online. Sign in to create a PvP room.");
    return;
  }
  setRoomCreatePending(true);
  state.gameMode = "multiplayer"; // forcing the mode to multiplayer to avoid "ghost bot" bugs when switching from bot games
  clearPersistedBotSession();
  socket.emit("room:create");
  scrollToInviteJoinCardOnMobile();
});

function requestSpectateFromRoomInput(): void {
  closeBotDifficultyPicker();
  const code = roomInput.value.trim();
  if (!code) {
    showToast("Enter a room ID first.");
    return;
  }

  if (!ROOM_ID_PATTERN.test(code)) {
    showToast("Room ID must be exactly 4 digits.");
    return;
  }

  clearPersistedBotSession();
  socket.emit("room:join", { roomId: code, spectateOnly: true });
  showToast(`Joining room ${code} as spectator...`);
}

spectateRoomButton.addEventListener("click", () => {
  requestSpectateFromRoomInput();
});

roomInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  requestSpectateFromRoomInput();
});

copyLinkButton.addEventListener("click", async () => {
  if (!state.shareUrl || !state.role || state.role === "spectator") {
    showToast("Create or join as a player before copying an invite link.");
    return;
  }

  try {
    await navigator.clipboard.writeText(state.shareUrl);
    showToast("Invite link copied.");
  } catch {
    showToast("Clipboard access failed. Copy the link manually.");
  }
});

roomInviteButton.addEventListener("click", () => {
  if (!accountSidebarController.canSendRoomInvites()) {
    showToast("Only registered seated players can invite friends.");
    return;
  }

  accountSidebarController.openSidebarToFriends();
});

liveNavFirst.addEventListener("click", () => {
  navigateToHistoryPosition(0);
});

liveNavPrev.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  const currentPos = state.viewCursor !== null ? state.viewCursor : snapshot.moves.length;
  navigateToHistoryPosition(currentPos - 1);
});

liveNavNext.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  const maxMoves = snapshot.moves.length;
  const currentPos = state.viewCursor !== null ? state.viewCursor : maxMoves;
  navigateToHistoryPosition(currentPos + 1);
});

liveNavLast.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  navigateToHistoryPosition(snapshot.moves.length);
});

leaveRoomButton.addEventListener("click", () => {
  if (!state.roomId) {
    showToast("You are not in a room.");
    return;
  }

  socket.emit("room:leave");
  clearLocalRoomState();
  render();
});

resignButton.addEventListener("click", () => {
  const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) return;
  
  toggleConfirmModal(true, "resign");
});

rematchButton.addEventListener("click", () => {
  if (state.gameMode === "multiplayer") {
    socket.emit("game:rematch");
  } else {
    startBotGame(); // Just restart the local game
  }
});

roomSettingsButton.addEventListener("click", () => {
  if (state.gameMode !== "multiplayer" || !state.roomId) {
    return;
  }

  const snapshot = state.snapshot;
  const isCreator = Boolean(snapshot?.ownerId && socket.id && snapshot.ownerId === socket.id);
  if (!isCreator) {
    showToast("Only the room creator can change game settings.");
    return;
  }

  const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));
  const isGameInProgress = Boolean(snapshot?.isStarted && !gameEnded);
  if (isGameInProgress) {
    toggleConfirmModal(true, "settings");
    return;
  }

  socket.emit("room:settings");
});

undoRequestButton.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot || state.gameMode !== "multiplayer") {
    return;
  }

  const canRespondToPendingUndo = snapshot.undo.pending && snapshot.undo.requester !== null && snapshot.undo.requester !== state.role;
  if (canRespondToPendingUndo) {
    socket.emit("game:undo:respond", { accept: true });
    return;
  }

  socket.emit("game:undo:request");
});

undoDeclineButton.addEventListener("click", () => {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.undo.pending) {
    return;
  }

  socket.emit("game:undo:respond", { accept: false });
});

labelsOnlyButton.addEventListener("click", () => {
  if (state.gameMode === "bot" && state.snapshot) {
    state.snapshot.analysis.enabled = !state.snapshot.analysis.enabled;
    if (state.snapshot.analysis.enabled) {
      void maybeRunLiveAnalysis(state.snapshot);
    } else {
      state.lastAnalyzedMoveKey = null;
      state.liveMoveGrades = {};
      clearBestMoveArrow();
    }
    render();
    return;
  }

  if (state.gameMode !== "multiplayer") {
    return;
  }

  socket.emit("analysis:labels:toggle");
});

flipBoardButton.addEventListener("click", () => {
  state.orientation = state.orientation === "w" ? "b" : "w";
  requestBoardRefresh();
  updateCaption();
});




const toggleConfirmModal = (show: boolean, type?: "leave" | "resign" | "bot" | "settings") => {
  if (show && type) {
    currentModalAction = type;
    document.body.classList.add("modal-open");
    
    // Set dynamic text for the Bot transition
    if (type === "bot") {
      modalTitle.textContent = "Switch to Bot?";
      modalDescription.textContent = "You are currently in a room. Do you want to leave and start a local game against the AI?";
    } else if (type === "settings") {
      modalTitle.textContent = "Change Game Settings?";
      modalDescription.textContent = "Are you sure you want to change the game settings? The current game will be ended if it is still in progress.";
    } else if (type === "resign") {
      modalTitle.textContent = "Resign Game?";
      modalDescription.textContent = "This will count as a loss. Are you sure you want to give up?";
    } else {
      modalTitle.textContent = "Leave Match?";
      modalDescription.textContent = "Your current game progress will be lost. Return to menu?";
    }
  } else {
    document.body.classList.remove("modal-open");
  }
  confirmDialog.hidden = !show;
};

backToMenuButton.addEventListener("click", () => {  
  const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) {
    socket.emit("room:leave");
    clearLocalRoomState();
    render();
  } else {
    toggleConfirmModal(true, "leave");
  }
});

confirmNoBtn.addEventListener("click", () => toggleConfirmModal(false));

// close the modal without confirming:
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !confirmDialog.hidden) {
    toggleConfirmModal(false);
  }
});

// confirm with "Enter" key when the modal is open:
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !confirmDialog.hidden) {
    confirmYesBtn.click();
  }
});

// main.ts - Update inside the confirmYesBtn listener
confirmYesBtn.addEventListener("click", () => {
  const action = currentModalAction;
  document.body.classList.remove("modal-open");
  toggleConfirmModal(false);

  if (action === "bot") {
    // 1. Tell server we are leaving
    socket.emit("room:leave");
    
    // 2. Clear the multiplayer UI/State locally right now
    clearLocalRoomState();  
    
    // 3. Start the bot game immediately (Direct transition)
    startBotGame();
  } else if (action === "resign") {
    if (state.gameMode === "multiplayer") {
      socket.emit("game:resign");
    } else if (state.snapshot) {
      state.snapshot.winner = (state.role === "w" ? "b" : "w") as any;
      state.snapshot.status = "Resigned";
      persistBotSession(true);
      render();
    }
  } else if (action === "settings") {
    socket.emit("room:settings");
  } else if (action === "leave") {
    socket.emit("room:leave");
    clearLocalRoomState();
    render();
  }
});

focusModeButton.addEventListener("click", () => {
  void toggleFocusMode();
});



window.addEventListener("keydown", (e) => {
  if (isTypingTarget(e.target)) return;
  if (!state.snapshot || state.snapshot.moves.length === 0) return;

  const maxMoves = state.snapshot.moves.length;
  // If we aren't viewing history, our "current" position is the very end of the game
  let currentPos = state.viewCursor !== null ? state.viewCursor : maxMoves;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (currentPos > 0) {
      navigateToHistoryPosition(currentPos - 1);
    }
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (currentPos < maxMoves) {
      navigateToHistoryPosition(currentPos + 1);
    }
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "z" || isTypingTarget(event.target)) {
    return;
  }

  if (focusModeButton.hidden) {
    return;
  }

  event.preventDefault();
  void toggleFocusMode();
});

board.addEventListener("click", (event) => {
  const squareButton = (event.target as HTMLElement).closest<HTMLButtonElement>(".square");
  const square = squareButton?.dataset.square as Square | undefined;
  if (!square) {
    if (state.selectedSquare) {
      state.selectedSquare = null;
      state.legalTargets = [];
      requestBoardRefresh(true); // Force a refresh even if animating
      updateCaption();
    }
    return;
  }

  // Ignore duplicate synthetic click when pointerup already handled a tap.
  if (
    lastPointerTapSquare === square
    && performance.now() - lastPointerTapAtMs < 250
  ) {
    return;
  }

  // Ignore only the synthetic click generated right after a drag-drop move.
  if (
    lastDragCommitSquare === square
    && performance.now() - lastDragCommitAtMs < 250
  ) {
    return;
  }

  clearArrows();
  onSquarePressed(square);
});

board.addEventListener("contextmenu", (event) => {
  event.preventDefault(); 
  if (state.premoves.length > 0) {
    state.premoves = [];
    // showToast("Premoves canceled.");
    requestBoardRefresh();
    updateCaption();
  }
});



let ptrDragFrom: Square | null = null;
let ptrDragNode: HTMLImageElement | null = null;
let ptrDragMoved = false;
let dragHoverSquare: Square | null = null;
let ptrStartX = 0;
let ptrStartY = 0;
let lastDragCommitSquare: Square | null = null;
let lastDragCommitAtMs = 0;
let lastPointerTapSquare: Square | null = null;
let lastPointerTapAtMs = 0;
let arrowDragFrom: Square | null = null;
let arrowDragTo: Square | null = null;
let arrowDragPointer: { x: number; y: number } | null = null;
let arrowDragMoved = false;

function cancelArrowDragPreview(): void {
  if (!arrowDragFrom && !arrowDragTo && !arrowDragPointer && !arrowDragMoved) {
    return;
  }

  arrowDragFrom = null;
  arrowDragTo = null;
  arrowDragPointer = null;
  arrowDragMoved = false;
  renderArrows();
}

function cancelActivePointerInteractions(): void {
  const hadArrowDrag = Boolean(arrowDragFrom || arrowDragTo || arrowDragPointer || arrowDragMoved);
  const hadPieceDrag = Boolean(ptrDragFrom || ptrDragNode || ptrDragMoved || dragHoverSquare);

  if (!hadArrowDrag && !hadPieceDrag) {
    return;
  }

  if (hadArrowDrag) {
    cancelArrowDragPreview();
  }

  if (hadPieceDrag) {
    cancelCurrentDrag();
  }

  requestBoardRefresh(true);
  updateCaption();
}

board.addEventListener("pointerdown", (event) => {

if (event.button === 0 && (arrowAnnotations.size > 0 || squareAnnotations.size > 0)) {
    clearArrows();
  }
  const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) return;

  if (event.button === 2) {
    if (ptrDragFrom || ptrDragNode || ptrDragMoved) {
      cancelCurrentDrag();
    }

    const square = getSquareFromPoint(event.clientX, event.clientY);
    if (!square) return;

    arrowDragFrom = square;
    arrowDragTo = null;
    arrowDragPointer = squareCenter(square, state.orientation);
    arrowDragMoved = false;
    ptrStartX = event.clientX;
    ptrStartY = event.clientY;
    board.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }

  if (event.button !== 0) return;
  if (arrowDragFrom || arrowDragTo || arrowDragPointer || arrowDragMoved) {
    cancelArrowDragPreview();
  }
  const squareButton = (event.target as HTMLElement).closest<HTMLButtonElement>(".square");
  const square = squareButton?.dataset.square as Square | undefined;
  if (!square || !canStartMoveFrom(square)) return;

  ptrDragFrom = square;
  ptrDragMoved = false;
  ptrStartX = event.clientX;
  ptrStartY = event.clientY;
  board.setPointerCapture(event.pointerId);
});

board.addEventListener("pointermove", (event) => {
  if (arrowDragFrom) {
    const hoverSquare = getSquareFromPoint(event.clientX, event.clientY);
    arrowDragTo = hoverSquare && hoverSquare !== arrowDragFrom ? hoverSquare : null;
    arrowDragPointer = boardPointFromClient(board, event.clientX, event.clientY);
    renderArrows();
  }

  if (arrowDragFrom && !arrowDragMoved && Math.hypot(event.clientX - ptrStartX, event.clientY - ptrStartY) >= 5) {
    arrowDragMoved = true;
  }

  if (!ptrDragFrom) return;
  if (!ptrDragMoved && Math.hypot(event.clientX - ptrStartX, event.clientY - ptrStartY) < 3) return;

  if (!ptrDragMoved) {
    ptrDragMoved = true;
    state.selectedSquare = ptrDragFrom;
    
    const vBoard = getVirtualBoard(chess.fen(), state.premoves, state.role as PlayerRole);
    const virtualPiece = vBoard.get(ptrDragFrom);
    
    state.legalTargets = vBoard.moves({ square: ptrDragFrom, verbose: true }).map(m => m.to);
    syncBoardInteractionState();
    updateCaption();

    const btn = board.querySelector<HTMLButtonElement>(`[data-square="${ptrDragFrom}"]`);
    if (btn && virtualPiece) {
      const spritePath = getPieceSpritePath(virtualPiece.color as PlayerRole, virtualPiece.type);
      
      ptrDragNode = document.createElement("img");
      ptrDragNode.src = spritePath;
      Object.assign(ptrDragNode.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "12000",
        width: `${btn.offsetWidth}px`, 
        height: `${btn.offsetHeight}px`,
        transform: "translate(-50%, -50%)",
        opacity: "1" 
      });
      
      document.body.append(ptrDragNode);
      btn.classList.add("dragging");
    }
  }

  const hoverSquare = getSquareFromPoint(event.clientX, event.clientY);
  dragHoverSquare = hoverSquare ?? null;
  syncBoardInteractionState();

  if (ptrDragNode) {
    ptrDragNode.style.left = `${event.clientX}px`;
    ptrDragNode.style.top  = `${event.clientY}px`;
  
  }
});
function endPointerDrag(event: PointerEvent, commit: boolean): void {
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const squareButton = el?.closest<HTMLButtonElement>(".square");
  const targetSquare = squareButton?.dataset.square as Square | undefined;

  // SCENARIO 1: Tapping an empty square or opponent piece (no piece grabbed)
  if (!ptrDragFrom) {
    if (commit && targetSquare && !ptrDragMoved) {
      lastPointerTapSquare = targetSquare;
      lastPointerTapAtMs = performance.now();
      
      onSquarePressed(targetSquare);
    }
    return;
  }

  const fromSquare = ptrDragFrom;
  const wasDrag = ptrDragMoved;

  // Cleanup visual drag states
  ptrDragFrom = null;
  dragHoverSquare = null;
  if (ptrDragNode) { ptrDragNode.remove(); ptrDragNode = null; }
  board.querySelector<HTMLElement>(".square.dragging")?.classList.remove("dragging");
  board.querySelector<HTMLElement>(".square.drag-origin")?.classList.remove("drag-origin");
  // Remove hover ring while drag-hover transitions are still disabled.
  syncBoardInteractionState();
  ptrDragMoved = false;
  // Re-enable normal square transitions only after hover ring is gone.
  syncBoardInteractionState();

  // FIX: Force a sync right after dropping a piece. 
  // This clears the inline 'opacity: 0' applied during dragging to prevent flickering.
  requestBoardRefresh(true);

  // SCENARIO 2: Tapped a piece but didn't drag it
  if (!wasDrag) {
    if (commit && targetSquare) {
      lastPointerTapSquare = targetSquare;
      lastPointerTapAtMs = performance.now();

      onSquarePressed(targetSquare);
    }
    return;
  }

  // SCENARIO 3: Finished a real Drag-and-Drop
  if (commit && targetSquare && targetSquare !== fromSquare) {
    clearSelection();
    suppressAnimationForMove = { from: fromSquare, to: targetSquare };
    tryMoveFromTo(fromSquare, targetSquare);
  }
}
function endArrowDrag(event: PointerEvent, commit: boolean): void {
  if (!arrowDragFrom) return;

  const fromSquare = arrowDragFrom;
  const previewTo = arrowDragTo;
  arrowDragFrom = null;
  arrowDragTo = null;
  arrowDragPointer = null;
  renderArrows();

  if (!commit) {
    arrowDragMoved = false;
    return;
  }

  const targetSquare = previewTo ?? getSquareFromPoint(event.clientX, event.clientY);
  if (!targetSquare) {
    arrowDragMoved = false;
    return;
  }

  // NEW: Detect a static right click on a single square
  if (!arrowDragMoved || targetSquare === fromSquare) {
    if (squareAnnotations.has(fromSquare)) {
      squareAnnotations.delete(fromSquare);
    } else {
      squareAnnotations.add(fromSquare);
    }
    arrowDragMoved = false;
    requestBoardRefresh(true); // Forces board to re-render the squares
    return;
  }

  toggleArrow(fromSquare, targetSquare);
  arrowDragMoved = false;
  renderArrows();
}

board.addEventListener("pointerup", (event) => {
  if (arrowDragFrom) {
    endArrowDrag(event, event.button === 2);
  } else if (event.button === 2) {
    endArrowDrag(event, true);
  }

  if (event.button === 0) {
    endPointerDrag(event, true);
  }
});

board.addEventListener("pointercancel", (event) => {
  endArrowDrag(event, false);
  endPointerDrag(event, false);
});

board.addEventListener("lostpointercapture", () => {
  cancelActivePointerInteractions();
});

window.addEventListener("blur", () => {
  cancelActivePointerInteractions();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    cancelActivePointerInteractions();
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    cancelActivePointerInteractions();
  }
});

function clearScheduledBotResponse(): void {
  if (botResponseTimer !== null) {
    window.clearTimeout(botResponseTimer);
    botResponseTimer = null;
  }
}

function finishBotGameOnTime(timeoutColor: PlayerRole): void {
  if (state.gameMode !== "bot" || !state.snapshot || state.snapshot.winner !== null || state.snapshot.checkmate || state.snapshot.draw) {
    return;
  }

  const winner = timeoutColor === "w" ? "b" : "w";
  const loserLabel = timeoutColor === "w" ? "White" : "Black";
  const winnerLabel = winner === "w" ? "White" : "Black";

  state.snapshot.winner = winner;
  state.snapshot.status = `${loserLabel} flagged on time. ${winnerLabel} wins.`;
  state.snapshot.clock.running = false;
  state.snapshot.clock.active = null;
  state.snapshot.clock.serverNowMs = Date.now();

  clearScheduledBotResponse();
  persistBotSession(true);
  render(true);
  showToast(state.snapshot.status);
}

function clearLowTimeWarningEffect(): void {
  if (!boardWrap) {
    return;
  }

  if (lowTimeWarningTimer !== null) {
    window.clearTimeout(lowTimeWarningTimer);
    lowTimeWarningTimer = null;
  }
  boardWrap.classList.remove("low-time-warning");
}

function resetLowTimeWarningState(): void {
  clearLowTimeWarningEffect();
  lowTimeWarningShownByColor.w = false;
  lowTimeWarningShownByColor.b = false;
}

function triggerLowTimeWarningEffect(color: PlayerRole): void {
  if (!boardWrap || lowTimeWarningShownByColor[color]) {
    return;
  }

  lowTimeWarningShownByColor[color] = true;

  boardWrap.classList.remove("low-time-warning");
  // Force reflow so the animation retriggers reliably when the class is re-added.
  void boardWrap.offsetWidth;
  boardWrap.classList.add("low-time-warning");

  if (lowTimeWarningTimer !== null) {
    window.clearTimeout(lowTimeWarningTimer);
  }

  lowTimeWarningTimer = window.setTimeout(() => {
    if (boardWrap) {
      boardWrap.classList.remove("low-time-warning");
    }
    lowTimeWarningTimer = null;
  }, LOW_TIME_WARNING_EFFECT_MS);
}

function getBotPlayerRole(): PlayerRole {
  if (state.role === "w" || state.role === "b") {
    return state.role;
  }

  return state.botPlayerSide;
}

function getBotRole(): PlayerRole {
  return getBotPlayerRole() === "w" ? "b" : "w";
}

function syncBotClockToNow(now = Date.now()): void {
  if (state.gameMode !== "bot" || !state.snapshot) {
    return;
  }

  const { clock } = state.snapshot;
  if (!clock.running || !clock.active || state.snapshot.winner !== null || state.snapshot.checkmate || state.snapshot.draw) {
    clock.serverNowMs = now;
    return;
  }

  const elapsed = Math.max(0, now - clock.serverNowMs);
  if (elapsed <= 0) {
    return;
  }

  if (clock.active === "w") {
    clock.whiteMs = Math.max(0, clock.whiteMs - elapsed);
    if (clock.whiteMs === 0) {
      finishBotGameOnTime("w");
      return;
    }
  } else {
    clock.blackMs = Math.max(0, clock.blackMs - elapsed);
    if (clock.blackMs === 0) {
      finishBotGameOnTime("b");
      return;
    }
  }

  clock.serverNowMs = now;
}

function finalizeBotClockAfterMove(mover: PlayerRole): void {
  if (state.gameMode !== "bot" || !state.snapshot) {
    return;
  }

  const now = Date.now();
  const incrementMs = state.snapshot.timeControl.incrementMs;
  if (incrementMs > 0) {
    if (mover === "w") {
      state.snapshot.clock.whiteMs += incrementMs;
    } else {
      state.snapshot.clock.blackMs += incrementMs;
    }
  }

  if (state.snapshot.winner !== null || state.snapshot.checkmate || state.snapshot.draw) {
    state.snapshot.clock.running = false;
    state.snapshot.clock.active = null;
    state.snapshot.clock.serverNowMs = now;
    persistBotSession(true);
    return;
  }

  state.snapshot.clock.running = true;
  state.snapshot.clock.active = state.snapshot.turn;
  state.snapshot.clock.serverNowMs = now;
  persistBotSession(true);
}

function scheduleBotResponse(playerMove: Move | null): void {
  clearScheduledBotResponse();

  if (!state.snapshot || state.gameMode !== "bot" || state.snapshot.checkmate || state.snapshot.draw) {
    return;
  }

  const botPreset = getBotDifficultyPreset(state.botLevel);
  const timing = computeBotResponseTiming(botPreset, playerMove);

  botResponseTimer = window.setTimeout(() => {
    botResponseTimer = null;
    void triggerBotResponse(timing.engineMoveTimeMs);
  }, timing.preDelayMs);
}

async function triggerBotResponse(engineMoveTimeMs?: number) {
  const botRole = getBotRole();
  syncBotClockToNow();
  if (
    state.gameMode !== "bot"
    || !state.snapshot
    || state.snapshot.turn !== botRole
    || state.snapshot.winner !== null
    || state.snapshot.checkmate
    || state.snapshot.draw
  ) {
    return;
  }

  if (!botAnalyzer) {
    botAnalyzer = new StockfishBridge();
  }

  const botPreset = getBotDifficultyPreset(state.botLevel);
  const bestMoveUci = await botAnalyzer.getBotMove(chess.fen(), botPreset, engineMoveTimeMs);

  syncBotClockToNow();
  if (
    state.gameMode !== "bot"
    || !state.snapshot
    || state.snapshot.turn !== botRole
    || state.snapshot.winner !== null
    || state.snapshot.checkmate
    || state.snapshot.draw
  ) {
    return;
  }

  const selectedMoveUci = chooseBotMoveByDifficulty(
    bestMoveUci,
    botPreset,
    chess.moves({ verbose: true }),
    chess.fen(),
  );

  let botMove: Move | null = null;
  const attemptedMoves = selectedMoveUci === bestMoveUci
    ? [selectedMoveUci]
    : [selectedMoveUci, bestMoveUci];

  for (const moveUci of attemptedMoves) {
    const bFrom = moveUci.substring(0, 2) as Square;
    const bTo = moveUci.substring(2, 4) as Square;
    const bPromo = moveUci.length === 5 ? moveUci[4] as any : "q";

    try {
      botMove = chess.move({ from: bFrom, to: bTo, promotion: bPromo });
    } catch {
      botMove = null;
    }

    if (botMove) {
      break;
    }
  }
  
  if (botMove && state.snapshot) {
    updateManualSnapshot(botMove);
    finalizeBotClockAfterMove(botRole);
    playSoundForSnapshot(state.snapshot);

    const premoveExecuted = state.premoves.length > 0 && checkAndExecutePremove();
    if (!premoveExecuted) {
      // Keep board, moves, and material captures in sync on all devices.
      render(true);
    }
  }
}
promotionDialog.addEventListener("click", (event) => {
  const clickedElement = event.target as HTMLElement;
  const clickedInsideCard = Boolean(clickedElement.closest(".promotion-card"));
  if (!clickedInsideCard) {
    state.pendingPromotion = null;
    promotionDialog.hidden = true;
    clearSelection();
    requestBoardRefresh(true);
    return;
  }

  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-promotion]");
  if (!button || !state.pendingPromotion) return;

  const promotion = button.dataset.promotion as PromotionPiece;
  const { from, to } = state.pendingPromotion;

  if (state.gameMode === "bot") {
    const playerRole = getBotPlayerRole();
    syncBotClockToNow();
    if (state.snapshot?.winner !== null || state.snapshot?.checkmate || state.snapshot?.draw) {
      state.pendingPromotion = null;
      promotionDialog.hidden = true;
      clearSelection();
      render();
      return;
    }

    let moveResult: Move | null = null;
    try {
      moveResult = chess.move({ from, to, promotion });
    } catch (e) {
      console.warn("Invalid promotion move attempted");
    }
    state.pendingPromotion = null;
    promotionDialog.hidden = true;

    if (moveResult) {
      updateManualSnapshot(moveResult);
      finalizeBotClockAfterMove(playerRole);
      suppressAnimationForMove = { from, to }; 
      render();
      playSoundForSnapshot(state.snapshot!);

      if (!state.snapshot!.checkmate && !state.snapshot!.draw) {
        scheduleBotResponse(moveResult);
      }
    } else {
      requestBoardRefresh(true);
    }
  } else {
    socket.emit("game:move", { from, to, promotion });
    state.pendingPromotion = null;
    promotionDialog.hidden = true;
  }
});

function hideFriendInvitePrompt(): void {
  pendingFriendInvite = null;
  friendInvitePrompt.hidden = true;
  friendInvitePrompt.classList.remove("is-visible");
}

function showFriendInvitePrompt(payload: IncomingFriendInvite): void {
  pendingFriendInvite = payload;
  friendInvitePromptText.textContent = `${payload.fromName} invited you to room ${payload.roomId}`;
  friendInvitePrompt.hidden = false;
  friendInvitePrompt.classList.remove("is-visible");
  requestAnimationFrame(() => {
    friendInvitePrompt.classList.add("is-visible");
  });
}

function hideRoomJoinRequestPrompt(): void {
  roomJoinRequestPrompt.hidden = true;
  roomJoinRequestPrompt.classList.remove("is-visible");
}

function renderActiveRoomJoinRequestPrompt(): void {
  if (!activeRoomJoinRequest) {
    hideRoomJoinRequestPrompt();
    return;
  }

  roomJoinRequestPromptText.textContent = `${activeRoomJoinRequest.fromName} wants to join room ${activeRoomJoinRequest.roomId}`;
  roomJoinRequestPrompt.hidden = false;
  roomJoinRequestPrompt.classList.remove("is-visible");
  requestAnimationFrame(() => {
    roomJoinRequestPrompt.classList.add("is-visible");
  });
}

function shiftToNextRoomJoinRequest(): void {
  activeRoomJoinRequest = queuedRoomJoinRequests.shift() ?? null;
  renderActiveRoomJoinRequestPrompt();
}

function clearRoomJoinRequestQueue(): void {
  activeRoomJoinRequest = null;
  queuedRoomJoinRequests = [];
  hideRoomJoinRequestPrompt();
}

function enqueueRoomJoinRequest(request: IncomingRoomJoinRequest): void {
  if (activeRoomJoinRequest?.requestId === request.requestId) {
    return;
  }

  if (queuedRoomJoinRequests.some((entry) => entry.requestId === request.requestId)) {
    return;
  }

  queuedRoomJoinRequests.push(request);
  if (!activeRoomJoinRequest) {
    shiftToNextRoomJoinRequest();
  }
}

friendInviteAcceptButton.addEventListener("click", () => {
  if (!pendingFriendInvite) {
    return;
  }

  const invite = pendingFriendInvite;
  socket.emit("friends:invite:respond", {
    inviteId: invite.inviteId,
    fromUserId: invite.fromUserId,
    accepted: true,
  });
  hideFriendInvitePrompt();
  const spectateOnly = !accountSidebarController.canPlayOnlineMultiplayer();
  socket.emit("room:join", { roomId: invite.roomId, inviteToken: invite.inviteToken, spectateOnly });
  showToast(spectateOnly ? `Joining room ${invite.roomId} as spectator...` : `Joining room ${invite.roomId}...`);
});

friendInviteDeclineButton.addEventListener("click", () => {
  if (!pendingFriendInvite) {
    hideFriendInvitePrompt();
    return;
  }

  const invite = pendingFriendInvite;
  socket.emit("friends:invite:respond", {
    inviteId: invite.inviteId,
    fromUserId: invite.fromUserId,
    accepted: false,
  });
  hideFriendInvitePrompt();
  showToast("Invitation declined.");
});

roomJoinRequestAcceptButton.addEventListener("click", () => {
  if (!activeRoomJoinRequest) {
    hideRoomJoinRequestPrompt();
    return;
  }

  const request = activeRoomJoinRequest;
  socket.emit("friends:room-join:respond", {
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    accepted: true,
  });

  showToast(`Accepted ${request.fromName}'s join request.`);
  shiftToNextRoomJoinRequest();
});

roomJoinRequestDeclineButton.addEventListener("click", () => {
  if (!activeRoomJoinRequest) {
    hideRoomJoinRequestPrompt();
    return;
  }

  const request = activeRoomJoinRequest;
  socket.emit("friends:room-join:respond", {
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    accepted: false,
  });

  showToast(`Declined ${request.fromName}'s join request.`);
  shiftToNextRoomJoinRequest();
});

function setSendFriendRequestState(nextBusy: boolean): void {
  sendFriendRequestBusy = nextBusy;
  if (!sendFriendRequestButton.hidden) {
    sendFriendRequestButton.disabled = nextBusy;
    sendFriendRequestButton.textContent = nextBusy ? "Sending..." : "Send Friend Request";
  }
}

sendFriendRequestButton.addEventListener("click", () => {
  if (sendFriendRequestBusy || !state.snapshot) {
    return;
  }

  const currentSeat = getCurrentSeatInfo(state.snapshot, state.role, normalizeUsername);
  const opponentSeat = getOpponentSeatInfo(state.snapshot, state.role, normalizeUsername);
  if (!currentSeat || !opponentSeat || !opponentSeat.connected) {
    showToast("Opponent is unavailable for friend requests right now.");
    return;
  }

  const currentUserIsRegistered = Boolean(currentSeat.userId && currentSeat.friendId);
  const opponentIsRegistered = Boolean(opponentSeat.userId && opponentSeat.friendId);
  const friendshipStatus = accountSidebarController.getFriendshipStatusWithUser(opponentSeat.userId);
  const eligible = canSendFriendRequest(
    { isRegistered: currentUserIsRegistered },
    { isRegistered: opponentIsRegistered },
    friendshipStatus,
  );

  if (!eligible) {
    if (!currentUserIsRegistered) {
      showToast("Sign in with a registered account to send friend requests.");
      return;
    }

    if (!opponentIsRegistered) {
      showToast("Opponent is playing as guest and cannot receive friend requests.");
      return;
    }

    if (friendshipStatus === "friends") {
      showToast("You are already friends with your opponent.");
      return;
    }

    showToast("Checking friendship status. Try again in a moment.");
    return;
  }

  const opponentUserId = opponentSeat.userId;
  if (!opponentUserId) {
    showToast("Opponent is unavailable for friend requests right now.");
    return;
  }

  setSendFriendRequestState(true);
  socket.emit("friends:request:send", { toUserId: opponentUserId });
});

acceptInGameFriendRequestButton.addEventListener("click", async () => {
  if (!pendingInGameFriendRequest) {
    return;
  }

  const request = pendingInGameFriendRequest;
  pendingInGameFriendRequest = null;
  renderSession();

  await accountSidebarController.addFriendByLookup(request.fromFriendId);
  socket.emit("friends:request:respond", {
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    accepted: true,
  });
  showToast(`${request.fromName} added to your friends.`);
});

declineInGameFriendRequestButton.addEventListener("click", () => {
  if (!pendingInGameFriendRequest) {
    return;
  }

  const request = pendingInGameFriendRequest;
  pendingInGameFriendRequest = null;
  renderSession();

  socket.emit("friends:request:respond", {
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    accepted: false,
  });
  showToast("Friend request declined.");
});

// --- SOCKET.IO LISTENERS ---

function onSocketConnect() {
  state.connected = true;
  profileIdentitySyncedForAutoJoin = false;
  clearRoomJoinRequestQueue();
  emitCurrentProfileName();
  accountSidebarController.emitFriendshipState();
  tryAutoJoinPendingRoom();
}
socket.on("connect", onSocketConnect);
if (socket.connected) onSocketConnect(); // Fires immediately if already connected

socket.on("disconnect", () => {
  state.connected = false;
  profileIdentitySyncedForAutoJoin = false;
  clearRoomJoinRequestQueue();
  if (roomCreatePending) {
    setRoomCreatePending(false);
    renderSession();
  }
});

socket.on("connection:status", () => {
  state.connected = true;
});

socket.on("profile:setName:applied", () => {
  profileIdentitySyncedForAutoJoin = true;
  void (async () => {
    await syncBotSessionWithCloudIdentity();
    tryAutoJoinPendingRoom();
  })();
});

socket.on("friends:invite:incoming", (payload?: {
  inviteId?: string;
  fromUserId?: string;
  fromName?: string;
  roomId?: string;
  inviteToken?: string;
}) => {
  const inviteId = typeof payload?.inviteId === "string" ? payload.inviteId : "";
  const fromUserId = typeof payload?.fromUserId === "string" ? payload.fromUserId : "";
  const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
  if (!inviteId || !fromUserId || !ROOM_ID_PATTERN.test(roomId)) {
    return;
  }

  const fromName = typeof payload?.fromName === "string" && payload.fromName.trim()
    ? payload.fromName.trim().slice(0, 24)
    : "A friend";
  const inviteToken = typeof payload?.inviteToken === "string" && payload.inviteToken.trim()
    ? payload.inviteToken.trim()
    : null;

  showFriendInvitePrompt({ inviteId, fromUserId, fromName, roomId, inviteToken });
});

socket.on("friends:invite:response", (payload?: { accepted?: boolean; friendName?: string }) => {
  const accepted = Boolean(payload?.accepted);
  const friendName = typeof payload?.friendName === "string" && payload.friendName.trim()
    ? payload.friendName.trim().slice(0, 24)
    : "Friend";
  showToast(accepted ? `${friendName} accepted your invitation.` : `${friendName} declined your invitation.`);
});

socket.on("friends:room-join:incoming", (payload?: {
  requestId?: string;
  fromUserId?: string;
  fromName?: string;
  roomId?: string;
}) => {
  const requestId = typeof payload?.requestId === "string" ? payload.requestId.trim() : "";
  const fromUserId = typeof payload?.fromUserId === "string" ? payload.fromUserId.trim() : "";
  const roomId = typeof payload?.roomId === "string" ? payload.roomId.trim() : "";
  if (!requestId || !fromUserId || !ROOM_ID_PATTERN.test(roomId)) {
    return;
  }

  if (!state.roomId || state.roomId !== roomId) {
    return;
  }

  const fromName = typeof payload?.fromName === "string" && payload.fromName.trim()
    ? payload.fromName.trim().slice(0, 24)
    : "A friend";

  enqueueRoomJoinRequest({
    requestId,
    fromUserId,
    fromName,
    roomId,
  });
});

socket.on("friends:room-join:requested", (payload?: { roomId?: string }) => {
  const roomId = typeof payload?.roomId === "string" ? payload.roomId.trim() : "";
  if (ROOM_ID_PATTERN.test(roomId)) {
    showToast(`Join request sent for room ${roomId}.`);
    return;
  }

  showToast("Join request sent.");
});

socket.on("friends:room-join:response", (payload?: {
  accepted?: boolean;
  fromName?: string;
  roomId?: string;
  inviteToken?: string | null;
  message?: string;
}) => {
  const accepted = Boolean(payload?.accepted);
  const fromName = typeof payload?.fromName === "string" && payload.fromName.trim()
    ? payload.fromName.trim().slice(0, 24)
    : "Friend";
  const fallbackMessage = accepted
    ? `${fromName} accepted your join request.`
    : `${fromName} declined your join request.`;
  const message = typeof payload?.message === "string" && payload.message.trim()
    ? payload.message.trim()
    : fallbackMessage;

  showToast(message);

  if (!accepted) {
    return;
  }

  const roomId = typeof payload?.roomId === "string" ? payload.roomId.trim() : "";
  if (!ROOM_ID_PATTERN.test(roomId) || state.roomId === roomId) {
    return;
  }

  const inviteToken = typeof payload?.inviteToken === "string" && payload.inviteToken.trim()
    ? payload.inviteToken.trim()
    : undefined;
  socket.emit("room:join", {
    roomId,
    inviteToken,
    spectateOnly: false,
  });
});

socket.on("friends:request:incoming", (payload?: {
  requestId?: string;
  fromUserId?: string;
  fromName?: string;
  fromFriendId?: string;
}) => {
  const requestId = typeof payload?.requestId === "string" ? payload.requestId.trim() : "";
  const fromUserId = typeof payload?.fromUserId === "string" ? payload.fromUserId.trim() : "";
  const fromName = typeof payload?.fromName === "string" && payload.fromName.trim()
    ? payload.fromName.trim().slice(0, 24)
    : "Opponent";
  const fromFriendId = typeof payload?.fromFriendId === "string" ? payload.fromFriendId.trim() : "";

  if (!requestId || !fromUserId || !/^\d{5}$/.test(fromFriendId)) {
    return;
  }

  pendingInGameFriendRequest = { requestId, fromUserId, fromName, fromFriendId };
  renderSession();
  showToast(`${fromName} sent you a friend request.`);
});

socket.on("friends:request:sent", () => {
  setSendFriendRequestState(false);
  showToast("Friend request sent.");
});

socket.on("friends:request:response", (payload?: { accepted?: boolean; friendName?: string; friendId?: string | null }) => {
  setSendFriendRequestState(false);
  const accepted = Boolean(payload?.accepted);
  const friendName = typeof payload?.friendName === "string" && payload.friendName.trim()
    ? payload.friendName.trim().slice(0, 24)
    : "Opponent";
  const friendId = typeof payload?.friendId === "string" ? payload.friendId.trim() : "";

  if (accepted && /^\d{5}$/.test(friendId)) {
    void accountSidebarController.addFriendByLookup(friendId);
  }

  showToast(accepted ? `${friendName} accepted your friend request.` : `${friendName} declined your friend request.`);
});

socket.on("session:joined", (payload: { roomId: string; role: RoomRole; shareUrl: string }) => {
  const shouldAnimateRoomCreate = roomCreatePending && (payload.role === "w" || payload.role === "b");
  const switchedRooms = Boolean(state.snapshot && state.snapshot.roomId !== payload.roomId);

  if (switchedRooms) {
    // Detach all room-scoped UI/game state so stale post-game context cannot leak across rooms.
    clearScheduledBotResponse();
    pendingInGameFriendRequest = null;
    clearRoomJoinRequestQueue();
    setSendFriendRequestState(false);
    state.snapshot = null;
    state.pendingPromotion = null;
    state.premoves = [];
    state.selectedSquare = null;
    state.legalTargets = [];
    state.viewCursor = null;
    state.liveAnalysisSummary = "Live analysis disabled.";
    state.lastAnalyzedMoveKey = null;
    state.liveMoveGrades = {};
    suppressAnimationForMove = null;
    lastAnimatedMoveKey = null;
    _lastPlayedMoveCount = -1;
    regenerateWoodTextureOffsets();
    clearArrows();
    chess.reset();
    resetLowTimeWarningState();
  }

  setRoomCreatePending(false);

  state.gameMode = "multiplayer";
  clearPersistedBotSession();
  state.roomId = payload.roomId;
  state.role = payload.role;
  state.shareUrl = payload.shareUrl || `${window.location.origin}/?room=${payload.roomId}`;
  roomInput.value = payload.roomId;

  localStorage.setItem("chess_roomId", payload.roomId);
  try {
    const shareUrl = new URL(state.shareUrl, window.location.origin);
    const inviteToken = shareUrl.searchParams.get("invite")?.trim() || "";
    if (inviteToken) {
      localStorage.setItem("chess_roomInviteToken", inviteToken);
    } else {
      localStorage.removeItem("chess_roomInviteToken");
    }
    syncUrl(payload.roomId, inviteToken || null);
  } catch {
    localStorage.removeItem("chess_roomInviteToken");
    syncUrl(payload.roomId, null);
  }

  if (payload.role === "w" || payload.role === "b") {
    state.orientation = payload.role;
  }

  accountSidebarController.resetFinishedGameTracking();

  emitCurrentProfileName();
  render();
  if (shouldAnimateRoomCreate) {
    triggerRoomCreateTransition();
  }
});

socket.on("session:left", (payload?: { roomId?: string }) => {
  setRoomCreatePending(false);
  clearRoomCreateTransitionClass();
  if (state.gameMode === "bot") return;

  const leftRoomId = typeof payload?.roomId === "string" ? payload.roomId : null;
  if (leftRoomId && state.roomId && leftRoomId !== state.roomId) {
    return;
  }

  clearLocalRoomState();
  render();
});

socket.on("room:state", (snapshot: RoomSnapshot) => {
  if (!state.roomId || state.gameMode !== "multiplayer" || snapshot.roomId !== state.roomId) {
    return;
  }

  if (!snapshot.checkmate && !snapshot.draw && snapshot.winner === null && snapshot.moveCount === 0) {
    accountSidebarController.resetFinishedGameTracking();
  }

  lastRoomStateReceivedAtMs = Date.now();
  const previousSnapshot = state.snapshot;
  const previousMoveCount = state.snapshot?.moveCount ?? 0;
  const previousTurn = state.snapshot?.turn ?? null;
  const previousStatus = state.snapshot?.status ?? "";
  const previousWinner = state.snapshot?.winner ?? null;
  const previousCheckmate = state.snapshot?.checkmate ?? false;
  const previousDraw = state.snapshot?.draw ?? false;
  const previousAnalysisEnabled = state.snapshot?.analysis.enabled ?? false;
  const previousSelectedSquare = state.selectedSquare;
  const previousLegalTargetsKey = state.legalTargets.join(",");
  const previousFen = chess.fen();
  let boardRefreshForcedByArrowClear = false;
  let boardRefreshForcedByPremoveQueueChange = false;
  
  if (
    !snapshot.checkmate
    && !snapshot.draw
    && snapshot.winner === null
    && snapshot.moveCount === 0
    && previousMoveCount > 0
  ) {
    resetLowTimeWarningState();
    regenerateWoodTextureOffsets();
  }

  state.snapshot = snapshot;
  
  chess.load(snapshot.fen);

  // Sound & Visual Effects
  const isActuallyNewMove = _lastPlayedMoveCount !== -1 && snapshot.moveCount > _lastPlayedMoveCount;
  _lastPlayedMoveCount = snapshot.moveCount;
  
  if (isActuallyNewMove) {
    playSoundForSnapshot(snapshot);
    if (snapshot.check) boardEffects.triggerCheckFlash();
  }

  const capturedByCount = countFenPieces(snapshot.fen) < countFenPieces(previousFen);
  if (state.bloodFxEnabled && isActuallyNewMove && capturedByCount && snapshot.lastMove) {
    const capturedPiece = detectCapturedPiece(previousFen, snapshot.lastMove);
    boardEffects.spawnBloodSplatter(snapshot.lastMove.to, capturedPiece ?? "p");
  }

  if (snapshot.moveCount > previousMoveCount) {
    boardRefreshForcedByArrowClear = clearArrows();
  }

  // Sync selection
  if (state.selectedSquare) {
    const activeRole = state.role;
    const selectionBoard = activeRole && activeRole !== "spectator" && snapshot.turn !== activeRole
      ? getVirtualBoard(chess.fen(), state.premoves, activeRole)
      : chess;
    const currentPiece = selectionBoard.get(state.selectedSquare);
    if (!currentPiece || !isOwnPiece(currentPiece.color)) {
      clearSelection();
    } else {
      state.legalTargets = selectionBoard.moves({ square: state.selectedSquare, verbose: true }).map((move) => move.to);
    }
  }

  if (!snapshot.analysis.enabled) {
    const labelsOnlyMode = snapshot.analysis.labelsOnly && isLiveAnalysisLocked(snapshot);
    if (!labelsOnlyMode) {
      state.lastAnalyzedMoveKey = null;
      state.liveMoveGrades = {};
      liveAnalysisToken += 1;
    }
  }

  // PREMOVE EXECUTION
  if (state.role && state.role !== "spectator" && snapshot.turn === state.role && state.premoves.length > 0) {
    if (!snapshot.checkmate && !snapshot.draw && snapshot.winner === null) {
      const { move: nextMove, pruned } = pullNextLegalPremove();
      if (pruned > 0) {
        boardRefreshForcedByPremoveQueueChange = true;
      }

      if (nextMove) {
        suppressAnimationForMove = { from: nextMove.from, to: nextMove.to };
        socket.emit("game:move", nextMove.promotion ? nextMove : { from: nextMove.from, to: nextMove.to });
        void maybeRunLiveAnalysis(snapshot);
        // Note: We return here because the server will send another state for this move.
        return;
      }
    } else {
      state.premoves = [];
      boardRefreshForcedByPremoveQueueChange = true;
    }
  }

  const legalTargetsChanged = previousLegalTargetsKey !== state.legalTargets.join(",");
  const boardStateChanged =
    previousFen !== snapshot.fen ||
    previousMoveCount !== snapshot.moveCount ||
    previousTurn !== snapshot.turn ||
    previousStatus !== snapshot.status ||
    previousWinner !== snapshot.winner ||
    previousCheckmate !== snapshot.checkmate ||
    previousDraw !== snapshot.draw ||
    previousAnalysisEnabled !== snapshot.analysis.enabled ||
    previousSelectedSquare !== state.selectedSquare ||
    legalTargetsChanged ||
    previousSnapshot === null;

  // Keep board work limited to actual board-state changes.
  // This avoids iOS/Safari-class flicker when only clocks/session text update.
  if (!boardRefreshForcedByArrowClear && (boardStateChanged || boardRefreshForcedByPremoveQueueChange)) {
    // Never force-cancel active animations on routine room ticks.
    // If an animation is active, requestBoardRefresh() queues a safe render.
    requestBoardRefresh();
  }

  renderSession();
  renderMoves();
  updateCaption();
  updateFocusHud();

  void maybeRunLiveAnalysis(snapshot);
  void maybeUpdateBestMoveArrow(snapshot);
  void maybePersistFinishedGame(snapshot);
});

socket.on("room:error", (payload: { message: string }) => {
  setRoomCreatePending(false);
  setSendFriendRequestState(false);
  suppressAnimationForMove = null;
  if (state.autoJoinCode) {
    state.autoJoinCode = null;
    state.autoJoinInviteToken = null;
    shouldCleanUiBeforeAutoJoin = false;
    localStorage.removeItem("chess_roomId");
    localStorage.removeItem("chess_roomInviteToken");
    localStorage.removeItem(ROOM_RETURN_CONTEXT_STORAGE_KEY);
    syncUrl(null);
    return;
  }

  if (payload.message === PREGAME_COLOR_CONFLICT_ERROR && !pregameSelection.hidden) {
    pregameConflictWarning.textContent = payload.message;
    pregameConflictWarning.hidden = false;
  }

  showToast(payload.message);
});

socket.on("undo:requested", () => {
  showToast("Opponent requested an undo.");
});

socket.on("undo:accepted", () => {
  showToast("Undo request accepted.");
});

socket.on("undo:declined", () => {
  showToast("Undo request declined.");
});

function must<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

// main.ts - Update the render() function
function render(force = false): void {
  const savedScroll = window.scrollY;
  requestBoardRefresh(force);
  renderSession();
  renderMoves();
  updateCaption();
  updateFocusHud();
  void maybePersistFinishedGame(state.snapshot);

  // FIX: Ensure analysis runs for local bot moves
  if (state.snapshot?.analysis.enabled) {
    void maybeRunLiveAnalysis(state.snapshot);
  }

  requestAnimationFrame(() => {
    if (window.scrollY !== savedScroll) {
      window.scrollTo({ top: savedScroll, behavior: "instant" });
    }
  });
}

// --- ARCADE TRAIL ENGINE ---
let trailRafId: number | null = null;

function startTrailSpawning(): void {
  if (!state.trailFxEnabled) return;

  let lastSpawnTime = 0;
  const spawnRateMs = 12; 

  function spawn() {
    // FIX: Look for whichever piece is currently moving (Dragged OR Animating)
    const movingNode = activeGhostNode || ptrDragNode;

    if (!movingNode) {
      trailRafId = null;
      return;
    }

    const now = performance.now();
    if (now - lastSpawnTime > spawnRateMs) {
      createTrailParticle(movingNode);
      lastSpawnTime = now;
    }

    trailRafId = requestAnimationFrame(spawn);
  }

  if (trailRafId) cancelAnimationFrame(trailRafId);
  trailRafId = requestAnimationFrame(spawn);
}

function createTrailParticle(sourceNode: HTMLElement): void {
  const rect = sourceNode.getBoundingClientRect();
  
  const particle = document.createElement("div");
  particle.className = "piece-trail-particle";
  
  const img = sourceNode.querySelector("img");
  if (img) {
    const imgEl = document.createElement("img");
    imgEl.src = img.src;
    imgEl.className = "piece-image";
    particle.appendChild(imgEl);
  }

  particle.style.left = `${rect.left + window.scrollX}px`;
  particle.style.top = `${rect.top + window.scrollY}px`;
  particle.style.width = `${rect.width}px`;
  particle.style.height = `${rect.height}px`;

  document.body.appendChild(particle);
  
  // Clean up instantly when the subtle CSS fade finishes
  setTimeout(() => particle.remove(), 250); 
}

function renderSession(): void {
  const snapshot = state.snapshot;
  const hasRoom = Boolean(state.roomId);
  const isCreator = Boolean(snapshot?.ownerId && socket.id && snapshot.ownerId === socket.id);
  refreshBotDifficultyUi();
  
  // 1. Core State Calculations
  const isMultiplayer = state.gameMode === "multiplayer";
  const bothConnected = Boolean(snapshot?.players.whiteConnected && snapshot?.players.blackConnected);
  const isStartedMultiplayerGame = Boolean(isMultiplayer && snapshot?.isStarted);
  const canPlayOnlineMultiplayer = accountSidebarController.canPlayOnlineMultiplayer();
  const canSendRoomInvites = hasRoom && isMultiplayer && accountSidebarController.canSendRoomInvites();
  const hasPlayerInviteLink = Boolean(state.shareUrl && state.role && state.role !== "spectator");
  
  const isGameActive = Boolean(
    isStartedMultiplayerGame || 
    (state.gameMode === "bot" && snapshot !== null)
  );

  voiceChatController.syncSession({
    roomId: state.roomId,
    role: state.role,
    gameMode: state.gameMode,
    isGameActive,
  });

  if (isGameActive && state.botPickerOpen) {
    closeBotDifficultyPicker();
  }
  
  const canVote = state.role === "w" || state.role === "b";
  const isSeatedPlayer = state.role === "w" || state.role === "b";
  const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));
  const analysisLocked = Boolean(snapshot?.analysis.locked && state.gameMode === "multiplayer");
  const maxMoves = snapshot?.moves.length ?? 0;

  inGameFriendRequest.hidden = pendingInGameFriendRequest === null || !isGameActive || state.gameMode !== "multiplayer";
  if (pendingInGameFriendRequest) {
    inGameFriendRequestText.textContent = `${pendingInGameFriendRequest.fromName} sent you a friend request.`;
  }

  // 2. Setup UI & Action Visibility Toggles
  gameNavRow.hidden = !isGameActive || maxMoves === 0;

  roomBadge.textContent = state.roomId ? `Room ${state.roomId}` : "No active room";
  roleBadge.textContent = humanRole(state.role, getCurrentPlayerName());
  roomInviteButton.hidden = !canSendRoomInvites;

  const heroCopy = document.querySelector<HTMLElement>(".hero-copy");
  if (heroCopy) heroCopy.hidden = isGameActive;

  inviteJoinCard.hidden = isGameActive;
  createRoomButton.hidden = isGameActive || !canPlayOnlineMultiplayer;
  createRoomButton.disabled = !canPlayOnlineMultiplayer || roomCreatePending;
  createRoomButton.classList.toggle("is-pending", roomCreatePending);
  createRoomButton.textContent = roomCreatePending ? ROOM_CREATE_BUTTON_PENDING_LABEL : ROOM_CREATE_BUTTON_LABEL;
  playBotButton.hidden = isGameActive;
  botDifficultyOverlay.hidden = isGameActive;

  leaveRoomButton.hidden = !hasRoom;
  // Spectate controls are main-menu only to avoid room-switch conflicts while already in a room.
  joinGrid.hidden = hasRoom;
  copyLinkButton.hidden = !hasPlayerInviteLink || isGameActive;
  flipBoardButton.hidden = !isGameActive;
  focusModeButton.hidden = !isGameActive;
  gameNav.hidden = !isGameActive;
  
  seatCard.hidden = !hasRoom;
  summaryCard.hidden = !isGameActive;
  movesCard.hidden = !isGameActive;
  inGameFriendPanel.hidden = !isGameActive || state.gameMode !== "multiplayer" || !isSeatedPlayer;

  labelsOnlyButton.hidden = !isGameActive || !canVote;
  undoRequestButton.hidden = !isGameActive || !canVote || state.gameMode !== "multiplayer";
  undoDeclineButton.hidden = true;
  rematchButton.hidden = !gameEnded || !canVote || !hasRoom;
  roomSettingsButton.hidden = !isMultiplayer || !hasRoom || !isCreator || !isSeatedPlayer;
  resignButton.hidden = !isGameActive || gameEnded || !canVote;

  if (!isGameActive && state.focusMode) {
    state.focusMode = false;
    applyFocusMode();
  }
  
  // 3. Early Exit if No Snapshot (Lobby State)
  if (!snapshot) {
    clearLowTimeWarningEffect();
    pregamePlaceholder.hidden = false;
    pregameWaiting.hidden = false;
    pregameSelection.hidden = true;
    matchStatus.textContent = canPlayOnlineMultiplayer
      ? "Create a room to start."
      : "Spectate a room or sign in to play online.";
    whiteSeat.textContent = "Waiting for player";
    blackSeat.textContent = "Waiting for player";
    turnMeta.textContent = "White";
    movesMeta.textContent = "0";
    spectatorMeta.textContent = "0";
    whiteClock.textContent = "03:00";
    blackClock.textContent = "03:00";
    whiteClock.classList.remove("is-low");
    blackClock.classList.remove("is-low");
    modeHint.textContent = "Room creator selects the timer. Color choice and ready are still required.";
    summaryText.textContent = "Ready to play.";
    liveAnalysisText.textContent = "Live analysis disabled.";
    inGameFriendPanel.hidden = true;
    inGameFriendMeta.textContent = "Opponent info unavailable.";
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
    updateFocusHud();
    return;
  }
  
  // 4. Pregame Selection Menu Logic (Consolidated!)
  pregamePlaceholder.hidden = isGameActive;

  if (isMultiplayer && !isGameActive) {
     const canConfigurePregame = state.role === "w" || state.role === "b";
     pregameSelection.hidden = !canConfigurePregame;
     pregameWaiting.hidden = canConfigurePregame;

     if (canConfigurePregame) {
       const isWhiteSeat = state.role === "w";
       const myChoice = isWhiteSeat ? snapshot.pregame.p1Choice : snapshot.pregame.p2Choice;
       const opChoice = isWhiteSeat ? snapshot.pregame.p2Choice : snapshot.pregame.p1Choice;
       const myReady = isWhiteSeat ? snapshot.pregame.p1Ready : snapshot.pregame.p2Ready;
       const opReady = isWhiteSeat ? snapshot.pregame.p2Ready : snapshot.pregame.p1Ready;
       const opponentConnected = isWhiteSeat ? snapshot.players.blackConnected : snapshot.players.whiteConnected;

      const selectedMode = snapshot.timeControl.id;
      multiplayerTimeControlSelect.value = selectedMode;
      multiplayerTimeControlSelect.disabled = !isCreator;

       if (isCreator) {
         modeHint.textContent = `You are the room creator. Current mode: ${snapshot.timeControl.label}.`;
       } else {
         modeHint.textContent = `Room creator controls mode. Current mode: ${snapshot.timeControl.label}.`;
       }

       myPickWhite.classList.toggle("selected", myChoice === "w");
       myPickBlack.classList.toggle("selected", myChoice === "b");
       opPickWhite.classList.toggle("selected", opChoice === "w");
       opPickBlack.classList.toggle("selected", opChoice === "b");
       opPickWhite.classList.toggle("disabled", !opponentConnected);
       opPickBlack.classList.toggle("disabled", !opponentConnected);

       myReadyBadge.classList.toggle("is-ready", myReady);
       opReadyBadge.classList.toggle("is-ready", opReady);

       const hasConflict = myChoice !== null && opChoice !== null && myChoice === opChoice;
       pregameConflictWarning.textContent = PREGAME_COLOR_CONFLICT_ERROR;
       pregameConflictWarning.hidden = !hasConflict;

       pregameReadyBtn.hidden = false;
       pregameReadyBtn.disabled = !myReady && myChoice === null;
       if (myReady) {
         pregameReadyBtn.textContent = "Unready";
       } else if (!bothConnected) {
         pregameReadyBtn.textContent = "Ready (Waiting Opponent)";
       } else {
         pregameReadyBtn.textContent = "Ready to Play";
       }
    } else {
       pregameReadyBtn.hidden = true;
    }
  } else {
    multiplayerTimeControlSelect.disabled = true;
    pregameReadyBtn.hidden = state.role === "spectator";
  }

  // 5. Live Game Data
  matchStatus.textContent = snapshot.status;
  whiteSeat.textContent = snapshot.players.whiteConnected
    ? seatLabel(
      "w",
      snapshot.players.whiteName,
      snapshot.players.whiteFriendId,
      snapshot.players.whiteUserId,
      state.role,
      getCurrentPlayerName(),
      normalizeUsername,
    )
    : "Waiting for player";
  blackSeat.textContent = snapshot.players.blackConnected
    ? seatLabel(
      "b",
      snapshot.players.blackName,
      snapshot.players.blackFriendId,
      snapshot.players.blackUserId,
      state.role,
      getCurrentPlayerName(),
      normalizeUsername,
    )
    : "Waiting for player";
  turnMeta.textContent = snapshot.turn === "w" ? "White" : "Black";
  movesMeta.textContent = String(snapshot.moveCount);
  spectatorMeta.textContent = String(snapshot.players.spectatorCount);

  const whiteMs = getDisplayClockMs(snapshot, "w", {
    mode: state.gameMode,
    lastRoomStateReceivedAtMs,
  });
  const blackMs = getDisplayClockMs(snapshot, "b", {
    mode: state.gameMode,
    lastRoomStateReceivedAtMs,
  });
  whiteClock.textContent = formatClockMs(whiteMs);
  blackClock.textContent = formatClockMs(blackMs);
  whiteClock.classList.toggle("is-low", snapshot.isStarted && whiteMs <= snapshot.clock.lowTimeThresholdMs);
  blackClock.classList.toggle("is-low", snapshot.isStarted && blackMs <= snapshot.clock.lowTimeThresholdMs);

  const activeClockMs = snapshot.clock.active === "w"
    ? whiteMs
    : snapshot.clock.active === "b"
    ? blackMs
    : null;
  const activeClockColor = snapshot.clock.active;
  const showLowTimeWarning = Boolean(
    isGameActive
    && !gameEnded
    && snapshot.clock.running
    && (activeClockColor === "w" || activeClockColor === "b")
    && activeClockMs !== null
    && activeClockMs <= LOW_TIME_WARNING_TRIGGER_MS
    && activeClockMs > LOW_TIME_WARNING_CLEAR_MS,
  );

  if (showLowTimeWarning && (activeClockColor === "w" || activeClockColor === "b")) {
    triggerLowTimeWarningEffect(activeClockColor);
  } else if (gameEnded || !isGameActive || !snapshot.clock.running) {
    clearLowTimeWarningEffect();
  }

  const opponentSeat = getOpponentSeatInfo(snapshot, state.role, normalizeUsername);
  const currentSeat = getCurrentSeatInfo(snapshot, state.role, normalizeUsername);
  const currentUserIsRegistered = Boolean(currentSeat?.userId && currentSeat.friendId);
  const opponentIsRegistered = Boolean(opponentSeat?.userId && opponentSeat?.friendId);
  const friendshipStatus: MultiplayerFriendshipStatus = opponentSeat
    ? accountSidebarController.getFriendshipStatusWithUser(opponentSeat.userId)
    : "unknown";
  const canShowSendFriendRequestButton = Boolean(
    opponentSeat
    && opponentSeat.connected
    && canSendFriendRequest(
      { isRegistered: currentUserIsRegistered },
      { isRegistered: opponentIsRegistered },
      friendshipStatus,
    ),
  );

  if (inGameFriendPanel.hidden || !opponentSeat || !opponentSeat.connected) {
    inGameFriendMeta.textContent = "Waiting for opponent to connect.";
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
  } else if (!currentUserIsRegistered) {
    inGameFriendMeta.textContent = "Friend requests are available for registered accounts only.";
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
  } else if (!opponentIsRegistered) {
    inGameFriendMeta.textContent = `${opponentSeat.name} is playing as guest.`;
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
  } else if (friendshipStatus === "friends") {
    inGameFriendMeta.textContent = `You and ${opponentSeat.name} are already friends.`;
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
  } else if (!canShowSendFriendRequestButton) {
    inGameFriendMeta.textContent = "Checking friendship status...";
    sendFriendRequestButton.hidden = true;
    sendFriendRequestButton.disabled = true;
  } else {
    inGameFriendMeta.textContent = `Opponent: ${opponentSeat.name} (ID ${opponentSeat.friendId})`;
    sendFriendRequestButton.hidden = false;
    sendFriendRequestButton.disabled = sendFriendRequestBusy;
    sendFriendRequestButton.textContent = sendFriendRequestBusy ? "Sending..." : "Send Friend Request";
  }

  // 6. Text Summary
  const roleDescription = state.role === "spectator"
    ? "Spectating."
    : state.role ? `Playing ${state.role === "w" ? "White" : "Black"}.` : "Not seated.";
      
  const lastMoveDescription = snapshot.lastMove
    ? ` Last move: ${snapshot.lastMove.san} (${snapshot.lastMove.from} to ${snapshot.lastMove.to}).`
    : "";
    
  const rematchDescription = (state.gameMode === "multiplayer" && snapshot.rematchVotes > 0)
    ? ` Rematch votes: ${snapshot.rematchVotes}/2.` 
    : "";

  const undoDescription = snapshot.undo.pending
    ? ` Undo request pending (${snapshot.undo.requester === "w" ? "White" : snapshot.undo.requester === "b" ? "Black" : "Unknown"}).`
    : "";

  summaryText.textContent = `${roleDescription} ${snapshot.status}${lastMoveDescription}${rematchDescription}${undoDescription}`.trim();

  // 7. Analysis Button State
  if (state.gameMode === "bot") {
    labelsOnlyButton.textContent = snapshot.analysis.enabled ? "Move badges: On" : "Move badges: Off";
    labelsOnlyButton.disabled = false;
  } else {
    const seatedPlayers = Number(snapshot.players.whiteConnected) + Number(snapshot.players.blackConnected);
    if (snapshot.analysis.labelsOnly) {
      labelsOnlyButton.textContent = "Labels only: On";
      labelsOnlyButton.disabled = false;
    } else {
      labelsOnlyButton.textContent = `Show Badges (${snapshot.analysis.labelsVotes}/2)`;
      labelsOnlyButton.disabled = seatedPlayers < 2;
    }
  }

  if (!undoRequestButton.hidden) {
    const canRequestUndo = snapshot.moveCount > 0 && !gameEnded;
    const pendingUndo = snapshot.undo.pending;
    const requester = snapshot.undo.requester;

    if (!pendingUndo) {
      undoRequestButton.textContent = "Request undo";
      undoRequestButton.disabled = !canRequestUndo;
    } else if (requester && requester !== state.role) {
      undoRequestButton.textContent = "Accept undo";
      undoRequestButton.disabled = false;
      undoDeclineButton.hidden = false;
      undoDeclineButton.disabled = false;
    } else {
      undoRequestButton.textContent = "Undo requested...";
      undoRequestButton.disabled = true;
    }
  }

  rematchButton.disabled = !gameEnded;

  // 8. Live Analysis Text
  if (snapshot.analysis.enabled) {
    liveAnalysisText.textContent = state.liveAnalysisSummary;
  } else if (analysisLocked && snapshot.analysis.labelsOnly) {
    liveAnalysisText.textContent = state.liveAnalysisSummary || "Labels-only mode active. Best lines are hidden.";
  } else if (analysisLocked && state.gameMode === "multiplayer" && snapshot.analysis.labelsVotes > 0) {
    liveAnalysisText.textContent = `Labels-only vote pending: ${snapshot.analysis.labelsVotes}/2.`;
  } else if (analysisLocked) {
    liveAnalysisText.textContent = "Live analysis and best-move arrows are disabled during active multiplayer games.";
  } else {
    liveAnalysisText.textContent = "Live analysis disabled.";
  }

  // 9. Wipe the old banner if the game restarts
  if (!gameEnded) {
    const existingOverlay = document.querySelector('.game-over-overlay');
    if (existingOverlay) existingOverlay.remove();
  }

  updateFocusHud();
}

/** * Cancels the current drag interaction and cleans up UI elements.
 * This ensures that if a piece is captured while being held, it disappears from the cursor.
 */
function cancelCurrentDrag(): void {
  if (ptrDragNode) {
    ptrDragNode.remove();
    ptrDragNode = null;
  }
  
  if (ptrDragFrom) {
    const draggedSquareEl = board.querySelector<HTMLElement>(`[data-square="${ptrDragFrom}"]`);
    draggedSquareEl?.classList.remove("dragging");
    draggedSquareEl?.classList.remove("drag-origin");
    ptrDragFrom = null;
  }
  
  dragHoverSquare = null;
  syncBoardInteractionState();
  ptrDragMoved = false;
  board.classList.remove("drag-hover-active");
  syncBoardInteractionState();
  
  // Clear the internal selection state to prevent "ghost" highlight rings
  state.selectedSquare = null;
  state.legalTargets = [];
}

function getDisplayBoard(): Chess {
  if (state.viewCursor === null || !state.snapshot) {
    if (state.premoves.length > 0 && (state.role === "w" || state.role === "b")) {
      return getVirtualBoard(chess.fen(), state.premoves, state.role);
    }
    return chess;
  }

  const historyBoard = new Chess();
  for (let i = 0; i < state.viewCursor; i++) {
    const move = state.snapshot.moves[i];
    if (move) historyBoard.move(move.san); // FIX: Safe check
  }
  return historyBoard;
}


function renderBoard(): void {
  if (ptrDragFrom) {
    const activeRole = state.role;
    const dragBoard = activeRole && activeRole !== "spectator" && state.snapshot?.turn !== activeRole
      ? getVirtualBoard(chess.fen(), state.premoves, activeRole)
      : chess;
    const pieceAtSource = dragBoard.get(ptrDragFrom);
    if (!pieceAtSource || (activeRole && activeRole !== "spectator" && pieceAtSource.color !== activeRole)) {
      cancelCurrentDrag();
    }
  }

  const fragment = document.createDocumentFragment();
  const squares = buildSquareList(state.orientation);
  
  const isHistoryView = state.viewCursor !== null;
  const displayBoard = getDisplayBoard();
  
  let lastMove = state.snapshot?.lastMove ?? null;
  if (isHistoryView && state.snapshot && state.viewCursor !== null && state.viewCursor > 0) {
    lastMove = state.snapshot.moves[state.viewCursor - 1] ?? null;
  } else if (isHistoryView && state.viewCursor === 0) {
    lastMove = null;
  }

  const lastMoveSquares = new Set<string>();
  if (lastMove) {
    lastMoveSquares.add(lastMove.from);
    lastMoveSquares.add(lastMove.to);
  }

  let checkedKingSquare: string | null = null;
  if (displayBoard.isCheck()) {
    const checkedColor = displayBoard.turn();
    for (const sqName of squares) {
      const p = displayBoard.get(sqName as Square);
      if (p?.type === "k" && p.color === checkedColor) {
        checkedKingSquare = sqName;
        break;
      }
    }
  }

  const liveGrade = state.snapshot
    && (state.snapshot.analysis.enabled || state.snapshot.analysis.labelsOnly)
    && state.snapshot.lastMove
    ? state.liveMoveGrades[state.snapshot.moveCount]
    : undefined;
    
  const liveMarkerSquare = (!isHistoryView && liveGrade && state.snapshot?.lastMove) 
    ? state.snapshot.lastMove.to 
    : null;
  const showQualityCallout = !isHistoryView && liveGrade && liveMarkerSquare
    && (liveGrade.category === "great" || liveGrade.category === "brilliant");
  const liveQualityCalloutKey = showQualityCallout
    ? `${state.snapshot?.moveCount ?? 0}:${liveGrade!.category}:${liveMarkerSquare}`
    : null;

  for (const squareName of squares) {
    const square = squareName as Square;
    const piece = displayBoard.get(square);
    
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.className = `square ${isLightSquare(squareName) ? "light" : "dark"}`;
    button.dataset.square = squareName;
    applyWoodTextureOffsets(button, square);

  if (lastMoveSquares.has(squareName)) button.classList.add("last-move");
  if (checkedKingSquare === squareName) button.classList.add("in-check");
  if (squareAnnotations.has(squareName)) button.classList.add("highlight-red"); // NEW
  if (liveGrade?.category === "great" && liveMarkerSquare === squareName) button.classList.add("great-move-highlight");
  if (liveGrade?.category === "brilliant" && liveMarkerSquare === squareName) button.classList.add("brilliant-move-highlight");
  
  // Also inside renderBoard(), anywhere outside the loop:
  if (!gameNavRow.hidden) {
    const isHistoryView = state.viewCursor !== null;
    const maxMoves = state.snapshot?.moves.length ?? 0;
    const currentPos = isHistoryView ? state.viewCursor! : maxMoves;

    liveNavFirst.disabled = currentPos === 0;
    liveNavPrev.disabled = currentPos === 0;
    liveNavNext.disabled = currentPos === maxMoves;
    liveNavLast.disabled = currentPos === maxMoves;
  }

    if (!isHistoryView && state.selectedSquare === square) button.classList.add("selected");
    if (!isHistoryView && state.legalMovesEnabled && state.legalTargets.includes(square)) button.classList.add("legal");
    
    if (lastMoveSquares.has(squareName)) button.classList.add("last-move");
    if (checkedKingSquare === squareName) button.classList.add("in-check");

    if (square === ptrDragFrom) button.classList.add("dragging");
    if (ptrDragMoved && square === ptrDragFrom) button.classList.add("drag-origin");
    if (ptrDragMoved && dragHoverSquare === square) {
      button.classList.add("drag-hover-legal");
    }

    // --- 1. PREMOVE & RED CAPTURE LOGIC ---
    if (!isHistoryView) {
      state.premoves.forEach((p) => {
        if (p.from === square) button.classList.add("premove-from");
        if (p.to === square) {
          button.classList.add("premove-to");
          if (piece) button.classList.add("premove-capture");
        }
      });
    }

    // --- 2. RENDER REAL PIECE (OPTIMIZED VISIBILITY) ---
    if (piece) {
      const spritePath = getPieceSpritePath(piece.color as PlayerRole, piece.type);
      const pieceElement = document.createElement("span");
      pieceElement.className = `piece piece-${piece.type} ${piece.color === "w" ? "white" : "black"}`;
      
      const isMyPremove = suppressAnimationForMove && square === suppressAnimationForMove.to;
      const isTargetOfActiveAnimation = square === animatingToSquare && !animationFinished;
      const isBeingDragged = square === ptrDragFrom;

      const shouldHide = (isTargetOfActiveAnimation && activeGhostNode) || isBeingDragged;

      if (shouldHide && !isMyPremove && !isHistoryView) {
        pieceElement.style.opacity = "0";
        pieceElement.style.visibility = "hidden";
        pieceElement.style.pointerEvents = "none";
      } else {
      
        pieceElement.style.opacity = "1";
        pieceElement.style.visibility = "";
        pieceElement.style.pointerEvents = "";
      }

      if (isMyPremove) pieceElement.style.transition = "none";

      const pieceImage = document.createElement("img");
      pieceImage.className = "piece-image";
      pieceImage.src = spritePath;
      pieceImage.draggable = false;
      pieceElement.append(pieceImage);
      button.append(pieceElement);

      if (liveGrade && liveMarkerSquare === squareName) {
        const marker = document.createElement("span");
        marker.className = `piece-quality-marker ${liveGrade.category}`;
        appendLiveCategoryMarkerContent(marker, liveGrade.category);
        button.append(marker);
      }
    }

    fragment.append(button);
  }

  board.replaceChildren(fragment);

  if (showQualityCallout && liveQualityCalloutKey && lastLiveQualityCalloutKey !== liveQualityCalloutKey) {
    lastLiveQualityCalloutKey = liveQualityCalloutKey;
    boardEffects.showLiveQualityMoveCallout(liveGrade.category, liveMarkerSquare);
  }

  if (!isHistoryView) {
    const isPremoveExecution = suppressAnimationForMove && 
                               lastMove && 
                               lastMove.from === suppressAnimationForMove.from && 
                               lastMove.to === suppressAnimationForMove.to;

    if (isPremoveExecution) {
      lastAnimatedMoveKey = `${state.snapshot!.moveCount}:${lastMove!.from}:${lastMove!.to}:${lastMove!.san}`;
      suppressAnimationForMove = null; 
      animationFinished = true;
      requestAnimationFrame(() => renderBoard());
    } else if (lastMove) {
      const moveKey = `${state.snapshot!.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
      if (lastAnimatedMoveKey !== moveKey) {
        if (state.animationStyle === "epic") animateLastMoveEpic(lastMove);
        else animateLastMove(lastMove);
      }
    }
  } else {
    if (activeGhostAnimation) {
      const tempAnim = activeGhostAnimation;
      activeGhostAnimation = null; 
      tempAnim.cancel();
    }
  }

  renderArrows();

  const snapshot = state.snapshot;
  const gameEnded = Boolean(snapshot && (snapshot.checkmate || snapshot.draw || snapshot.winner !== null));

  if (gameEnded && snapshot && !isHistoryView) {
    const overlay = document.createElement("div");
    overlay.className = "game-over-overlay";

    // The new cinematic wrapper
    const banner = document.createElement("div");
    banner.className = "game-over-banner";

    const title = document.createElement("h2");
    title.className = "game-over-title";
    
    if (snapshot.checkmate) title.textContent = snapshot.winner === "w" ? "White Wins!" : "Black Wins!";
    else if (snapshot.draw) title.textContent = "Draw";
    else if (snapshot.winner) title.textContent = snapshot.winner === "w" ? "White Wins" : "Black Wins";

    const reason = document.createElement("p");
    reason.className = "game-over-reason";
    reason.textContent = snapshot.status;

    // A container to keep the buttons neatly side-by-side
    const actionContainer = document.createElement("div");
    actionContainer.className = "game-over-actions";

    const overlayRematchBtn = document.createElement("button");
    overlayRematchBtn.className = "action cta-turquoise";
    overlayRematchBtn.textContent = state.gameMode === "bot" ? "Play Again" : "Request Rematch";
    overlayRematchBtn.onclick = () => {
      if (state.gameMode === "bot") startBotGame();
      else socket.emit("game:rematch");
    };

    const overlayAnalyzeBtn = document.createElement("a");
    overlayAnalyzeBtn.className = "action cta-rainbow";
    overlayAnalyzeBtn.style.textDecoration = "none";
    overlayAnalyzeBtn.onclick = () => {
      openAnalyzeInIsolatedTab({
        postGameMeta: {
          whiteName: snapshot.players.whiteName,
          blackName: snapshot.players.blackName,
        },
        postGameMoves: snapshot.moves.map((move) => move.san),
      });
    };
    overlayAnalyzeBtn.textContent = "Analyze Game";

    actionContainer.append(overlayRematchBtn, overlayAnalyzeBtn);
    banner.append(title, reason, actionContainer);
    overlay.append(banner);
    board.append(overlay);
  }
}

function toggleArrow(from: Square, to: Square): void {
  const key = `${from}-${to}`;
  if (arrowAnnotations.has(key)) {
    arrowAnnotations.delete(key);
    return;
  }

  arrowAnnotations.add(key);
}

function clearArrows(): boolean {
  if (arrowAnnotations.size === 0 && squareAnnotations.size === 0) {
    return false;
  }

  arrowAnnotations.clear();
  squareAnnotations.clear();
  renderArrows();
  requestBoardRefresh(true);
  return true;
}

function isSnapshotGameOver(snapshot: RoomSnapshot): boolean {
  return snapshot.checkmate || snapshot.draw || snapshot.winner !== null;
}

function isLiveAnalysisLocked(snapshot: RoomSnapshot): boolean {
  return state.gameMode === "multiplayer" && snapshot.analysis.locked;
}

function isLabelsOnlyMode(snapshot: RoomSnapshot): boolean {
  return isLiveAnalysisLocked(snapshot) && snapshot.analysis.labelsOnly;
}

function isBotBadgesMode(snapshot: RoomSnapshot): boolean {
  return state.gameMode === "bot" && snapshot.analysis.enabled;
}

function clearBestMoveArrow(): void {
  if (!state.bestMoveArrow && !state.bestMoveArrowFen) {
    return;
  }

  bestMoveArrowToken += 1;
  state.bestMoveArrow = null;
  state.bestMoveArrowFen = null;
  renderArrows();
}

async function maybeUpdateBestMoveArrow(snapshot: RoomSnapshot | null): Promise<void> {
  if (!snapshot) {
    clearBestMoveArrow();
    return;
  }

  if (isLiveAnalysisLocked(snapshot) || isBotBadgesMode(snapshot)) {
    clearBestMoveArrow();
    return;
  }

  const shouldShow = canShowBestMoveArrow(snapshot.analysis.enabled, isSnapshotGameOver(snapshot));
  if (!shouldShow) {
    clearBestMoveArrow();
    return;
  }

  if (state.bestMoveArrowFen === snapshot.fen) {
    return;
  }

  const token = ++bestMoveArrowToken;

  try {
    if (!liveAnalyzer) {
      liveAnalyzer = new StockfishBridge();
    }

    const evaluation = await liveAnalyzer.evaluateFen(snapshot.fen, 10);
    if (token !== bestMoveArrowToken) {
      return;
    }

    state.bestMoveArrow = parseBestMoveArrow(evaluation.bestMove);
    state.bestMoveArrowFen = snapshot.fen;
  } catch {
    if (token !== bestMoveArrowToken) {
      return;
    }

    state.bestMoveArrow = null;
    state.bestMoveArrowFen = snapshot.fen;
  }

  renderArrows();
}

function renderArrows(): void {
  const snapshot = state.snapshot;
  const bestMove = snapshot
    && !isLiveAnalysisLocked(snapshot)
    && !isBotBadgesMode(snapshot)
    && canShowBestMoveArrow(snapshot.analysis.enabled, isSnapshotGameOver(snapshot))
    ? state.bestMoveArrow
    : null;

  arrowLayer.innerHTML = buildArrowLayerMarkup({
    variant: "board",
    annotations: arrowAnnotations,
    preview: arrowDragFrom && arrowDragPointer
      ? { from: arrowDragFrom, pointer: arrowDragPointer }
      : null,
    bestMove,
    squareCenter: (square) => squareCenter(square, state.orientation),
  });
}

function syncBoardInteractionState(): void {
  board.classList.toggle("drag-hover-active", ptrDragMoved);

  for (const squareButton of board.querySelectorAll<HTMLButtonElement>(".square")) {
    const square = squareButton.dataset.square as Square | undefined;
    if (!square) {
      continue;
    }

    squareButton.classList.toggle("selected", state.selectedSquare === square);
    squareButton.classList.toggle("legal", state.legalMovesEnabled && state.legalTargets.includes(square));    
    squareButton.classList.toggle("dragging", square === ptrDragFrom);
    squareButton.classList.toggle("drag-origin", ptrDragMoved && square === ptrDragFrom);
    squareButton.classList.toggle(
      "drag-hover-legal",
      ptrDragMoved && dragHoverSquare === square,
    );
  }
}


// main.ts
function checkAndExecutePremove(): boolean {
  const snapshot = state.snapshot;
  if (!snapshot || !state.role || state.role === "spectator") return false;

  if (snapshot.turn !== state.role || state.premoves.length === 0) {
    return false;
  }

  if (snapshot.checkmate || snapshot.draw || snapshot.winner !== null) {
    state.premoves = [];
    requestBoardRefresh();
    updateCaption();
    return false;
  }

  const { move: nextMove, pruned } = pullNextLegalPremove();
  if (!nextMove) {
    if (pruned > 0) {
      requestBoardRefresh();
      updateCaption();
    }
    return false;
  }

  // Marcamos para que renderBoard sepa que este movimiento NO se anima
  suppressAnimationForMove = { from: nextMove.from, to: nextMove.to };
  animationFinished = true;
  tryMoveFromTo(nextMove.from, nextMove.to);
  return true;
}

function renderMoves(): void {
  const snapshot = state.snapshot;
  if (!snapshot || snapshot.moves.length === 0) {
    moveList.innerHTML = '<div class="empty-state">No moves yet.</div>';
    return;
  }

  const rows: string[] = [];
  for (let index = 0; index < snapshot.moves.length; index += 2) {
    const whiteMove = snapshot.moves[index] as MoveSummary | undefined;
    const blackMove = snapshot.moves[index + 1] as MoveSummary | undefined;
    
    const whitePly = index + 1;
    const blackPly = index + 2;
    
    const whiteGrade = state.liveMoveGrades[whitePly];
    const blackGrade = state.liveMoveGrades[blackPly];
    
    const whiteBadge = whiteMove && whiteGrade
      ? ` <span class="move-quality-tag ${whiteGrade.category}">${whiteGrade.label}</span>`
      : "";
    const blackBadge = blackMove && blackGrade
      ? ` <span class="move-quality-tag ${blackGrade.category}">${blackGrade.label}</span>`
      : "";
      
    const moveNumber = Math.floor(index / 2) + 1;

    // Apply a highlight if the user is currently viewing this specific move in history
    const wActiveStyle = state.viewCursor === whitePly ? "background: var(--accent); color: #fffdf8;" : "";
    const bActiveStyle = state.viewCursor === blackPly ? "background: var(--accent); color: #fffdf8;" : "";

    rows.push(`
      <div class="move-row">
        <strong>${moveNumber}.</strong>
        <span class="move-clickable" data-index="${whitePly}" style="cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s ease, color 0.2s ease; ${wActiveStyle}">
          ${whiteMove ? whiteMove.san : ""}${whiteBadge}
        </span>
        <span class="move-clickable" data-index="${blackPly}" style="cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: background 0.2s ease, color 0.2s ease; ${bActiveStyle}">
          ${blackMove ? blackMove.san : ""}${blackBadge}
        </span>
      </div>
    `);
  }

  moveList.innerHTML = rows.join("");
}

moveList.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLSpanElement>(".move-clickable");
  if (!target || !state.snapshot) return;
  
  const index = parseInt(target.dataset.index!, 10);
  navigateToHistoryPosition(index);
});
function updateCaption(): void {
  const snapshot = state.snapshot;
  
  if (!snapshot || !state.role || state.role === "spectator") {
    boardCaption.textContent = snapshot ? `Spectating room ${snapshot.roomId}` : "";
    return;
  }

  const myColor = state.role as PlayerRole;
  const opColor = myColor === "w" ? "b" : "w";
  
  // FIX: Replay the server's authoritative move list on a temporary board.
  // This completely sidesteps the "FEN wiping history" bug.
  const movesToReplay = state.viewCursor !== null 
    ? snapshot.moves.slice(0, state.viewCursor) 
    : snapshot.moves;

  const replayBoard = new Chess();
  const myCaptures: PieceSymbol[] = [];
  const opCaptures: PieceSymbol[] = [];

  for (const moveSummary of movesToReplay) {
    const moveResult = replayBoard.move(moveSummary.san);
    if (moveResult && moveResult.captured) {
      if (moveResult.color === myColor) {
        myCaptures.push(moveResult.captured); // We captured their piece
      } else {
        opCaptures.push(moveResult.captured); // They captured our piece
      }
    }
  }

  // Sort captures: Queens first, then Rooks, Bishops, Knights, Pawns
  const sortOrder: Record<PieceSymbol, number> = { q: 1, r: 2, b: 3, n: 4, p: 5, k: 6 };
  myCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
  opCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);

  let myCapturesHtml = "";
  myCaptures.forEach(piece => {
    myCapturesHtml += `<img src="${getPieceSpritePath(opColor, piece)}" class="captured-icon" />`;
  });

  let opCapturesHtml = "";
  opCaptures.forEach(piece => {
    opCapturesHtml += `<img src="${getPieceSpritePath(myColor, piece)}" class="captured-icon" />`;
  });

  const currentFen = replayBoard.fen();
  const rawValue = materialFromPerspective(currentFen, myColor);
  const netValue = Math.floor(rawValue / 100);

  if (!myCapturesHtml && !opCapturesHtml && netValue === 0) {
    boardCaption.innerHTML = `<span style="opacity: 0.6; font-weight: 500;">Material: Even</span>`;
  } else {
    boardCaption.innerHTML = `
      <div class="captures-wrapper">
        ${myCapturesHtml || netValue > 0 ? `
        <div class="captures-row">
          <div class="captures-icons">${myCapturesHtml}</div>
          ${netValue > 0 ? `<strong class="material-score plus">+${netValue}</strong>` : ""}
        </div>` : ""}
        
        ${opCapturesHtml || netValue < 0 ? `
        <div class="captures-row">
          <div class="captures-icons" style="opacity: 0.85;">${opCapturesHtml}</div>
          ${netValue < 0 ? `<strong class="material-score minus">${netValue}</strong>` : ""}
        </div>` : ""}
      </div>
    `;
  }
}

async function maybeRunLiveAnalysis(snapshot: RoomSnapshot): Promise<void> {
  const labelsOnlyMode = isLabelsOnlyMode(snapshot);
  if (isLiveAnalysisLocked(snapshot) && !labelsOnlyMode) {
    state.liveAnalysisSummary = "Live analysis disabled during active multiplayer games.";
    return;
  }

  if ((!snapshot.analysis.enabled && !labelsOnlyMode) || !snapshot.lastMove || snapshot.moves.length === 0) {
    return;
  }

  const moveKey = `${snapshot.moveCount}:${snapshot.lastMove.from}:${snapshot.lastMove.to}:${snapshot.lastMove.san}`;
  if (state.lastAnalyzedMoveKey === moveKey) {
    return;
  }

  const fenPair = buildBeforeAfterFenFromMoves(snapshot.moves);
  if (!fenPair) {
    return;
  }

  const token = ++liveAnalysisToken;
  state.liveAnalysisSummary = labelsOnlyMode ? "Classifying last move..." : "Analyzing last move...";
  renderSession();

  try {
    if (!liveAnalyzer) {
      liveAnalyzer = new StockfishBridge();
    }

    const [before, after] = await Promise.all([
      liveAnalyzer.evaluateFen(fenPair.beforeFen, 10),
      liveAnalyzer.evaluateFen(fenPair.afterFen, 10),
    ]);

    if (token !== liveAnalysisToken) {
      return;
    }

    if (!state.snapshot) {
      return;
    }

    const stillLabelsOnly = isLabelsOnlyMode(state.snapshot);
    if (!state.snapshot.analysis.enabled && !stillLabelsOnly) {
      return;
    }

    const moverBefore = before.cp;
    const moverAfter = -after.cp;
    const cpl = Math.max(0, Math.round(moverBefore - moverAfter));
    const playedUci = `${snapshot.lastMove.from}${snapshot.lastMove.to}`;
    const matchesBestMove = before.bestMove.startsWith(playedUci);
    const moverColor = (fenPair.beforeFen.split(" ")[1] as "w" | "b") || "w";
    const materialBefore = materialFromPerspective(fenPair.beforeFen, moverColor);
    const materialAfter = materialFromPerspective(fenPair.afterFen, moverColor);
    const materialDelta = materialAfter - materialBefore;
    const evalGain = Math.round(moverAfter - moverBefore);
    const previousOpponentCategory = state.liveMoveGrades[snapshot.moveCount - 1]?.category;
    const brilliantOffer = await verifyLiveBrilliantOffer({
      engine: liveAnalyzer,
      move: snapshot.lastMove,
      beforeFen: fenPair.beforeFen,
      afterFen: fenPair.afterFen,
      beforeMoverCp: moverBefore,
      afterMoverCp: moverAfter,
      cpl,
      matchesBestMove,
      materialDelta,
    });
    const quality = classifyLiveMoveQuality({
      cpl,
      matchesBestMove,
      materialDelta,
      evalGain,
      isCapture: snapshot.lastMove.san.includes("x"),
      previousOpponentCategory,
      brilliantOffer,
    });

    const label = quality.label;
    const category = quality.category;
    state.liveAnalysisSummary = labelsOnlyMode
      ? `${label}: ${snapshot.lastMove.san}`
      : summarizeLiveMove(label, cpl, snapshot.lastMove.san);
    state.liveMoveGrades[snapshot.moveCount] = { label, cpl, category };
    state.lastAnalyzedMoveKey = moveKey;
  } catch {
    if (token !== liveAnalysisToken) {
      return;
    }

    state.liveAnalysisSummary = "Live analysis temporarily unavailable.";
  }

  render();
}

async function maybeRunLiveAnalysisForMove(
  previousMoves: MoveSummary[],
  move: Move,
  _expectedMoveCount: number,
  _expectedMoveKey: string,
): Promise<void> {
  if (!liveAnalyzer) {
    try {
      liveAnalyzer = new StockfishBridge();
    } catch {
      return;
    }
  }

  try {
    // Build FEN before and after this move
    const recreatedChess = new Chess();
    for (const m of previousMoves) {
      recreatedChess.move(m.san);
    }

    const beforeFen = recreatedChess.fen();
    const moveResult = recreatedChess.move(move);
    if (!moveResult) {
      return;
    }
    const afterFen = recreatedChess.fen();

    const [before, after] = await Promise.all([
      liveAnalyzer.evaluateFen(beforeFen, 10),
      liveAnalyzer.evaluateFen(afterFen, 10),
    ]);

    const moverBefore = before.cp;
    const moverAfter = -after.cp;
    const cpl = Math.max(0, Math.round(moverBefore - moverAfter));
    const playedUci = `${moveResult.from}${moveResult.to}`;
    const matchesBestMove = before.bestMove.startsWith(playedUci);
    const moverColor = (beforeFen.split(" ")[1] as "w" | "b") || "w";
    const materialBefore = materialFromPerspective(beforeFen, moverColor);
    const materialAfter = materialFromPerspective(afterFen, moverColor);
    const materialDelta = materialAfter - materialBefore;
    const evalGain = Math.round(moverAfter - moverBefore);
    const previousOpponentCategory = state.liveMoveGrades[(state.snapshot?.moveCount ?? 0) - 1]?.category;
    const brilliantOffer = await verifyLiveBrilliantOffer({
      engine: liveAnalyzer,
      move: moveResult,
      beforeFen,
      afterFen,
      beforeMoverCp: moverBefore,
      afterMoverCp: moverAfter,
      cpl,
      matchesBestMove,
      materialDelta,
    });
    const quality = classifyLiveMoveQuality({
      cpl,
      matchesBestMove,
      materialDelta,
      evalGain,
      isCapture: Boolean(moveResult.captured),
      previousOpponentCategory,
      brilliantOffer,
    });
    const label = quality.label;

    // Keep optimistic feedback textual only; canonical room-state analysis writes final badge.
    state.liveAnalysisSummary = `You played: ${summarizeLiveMove(label, cpl, moveResult.san)}`;
    render();
  } catch (e) {
    console.error("Live analysis error:", e);
  }
}

function getCheckedKingSquare(): Square | null {
  if (!chess.isCheck()) {
    return null;
  }

  const checkedColor = chess.turn();
  for (const squareName of buildSquareList("w")) {
    const square = squareName as Square;
    const piece = chess.get(square);
    if (piece?.type === "k" && piece.color === checkedColor) {
      return square;
    }
  }

  return null;
}

function animateLastMove(lastMove: MoveSummary | null): void {
  if (!state.snapshot || !lastMove) {
    lastAnimatedMoveKey = null;
    return;
  }

  const moveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
  if (lastAnimatedMoveKey === moveKey) return;

  // 1. Reset all flags if a premove or manual drag is happening
  if (state.premoves.length > 0 || suppressAnimationForMove) {
    lastAnimatedMoveKey = moveKey;
    suppressAnimationForMove = null; 
    if (activeGhostAnimation) activeGhostAnimation.cancel();
    activeGhostAnimation = null;
    animationFinished = true;
    animatingToSquare = null;
    return; 
  }

  lastAnimatedMoveKey = moveKey;
  animationFinished = false;
  animatingToSquare = lastMove.to;

  // 2. Cleanup any previous ghost animations
  if (activeGhostAnimation) activeGhostAnimation.cancel();
  if (activeGhostNode) {
    activeGhostNode.remove();
    activeGhostNode = null;
  }
  if (activeGhostDestinationPiece) {
    activeGhostDestinationPiece.style.visibility = "";
    activeGhostDestinationPiece = null;
  }

  const fromSquareButton = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.from}"]`);
  const toSquareButton   = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.to}"]`);
  const destinationPiece = toSquareButton?.querySelector<HTMLElement>(".piece");
  
  if (!fromSquareButton || !toSquareButton || !destinationPiece) {
    animationFinished = true;
    animatingToSquare = null;
    return;
  }

  // 3. Calculate the distance (delta) for the animation
  const fromRect = fromSquareButton.getBoundingClientRect();
  const toRect = toSquareButton.getBoundingClientRect();
  const deltaX = (fromRect.left + fromRect.width / 2) - (toRect.left + toRect.width / 2);
  const deltaY = (fromRect.top + fromRect.height / 2) - (toRect.top + toRect.height / 2);

  // 4. Create the ghostPiece (the one that actually moves)
  const ghostPiece = destinationPiece.cloneNode(true) as HTMLElement;
  const destinationMarker = toSquareButton.querySelector<HTMLElement>(".piece-quality-marker");
  if (destinationMarker) {
    destinationMarker.classList.remove("marker-reveal");
    destinationMarker.style.visibility = "hidden";
  }
  const pieceRect = destinationPiece.getBoundingClientRect();
  
  Object.assign(ghostPiece.style, {
    position: "absolute",
    left: `${toRect.left + toRect.width / 2 + window.scrollX}px`,
    top: `${toRect.top + toRect.height / 2 + window.scrollY}px`,
    width: `${pieceRect.width}px`,
    height: `${pieceRect.height}px`,
    transform: "translate3d(-50%, -50%, 0)",
    zIndex: "9999",
    pointerEvents: "none",
    // Notice: No filter here, so no blurry black shadows!
  });

  // Hide the real piece at the destination until the ghost arrives
  destinationPiece.style.visibility = "hidden";
  activeGhostNode = ghostPiece;
  activeGhostDestinationPiece = destinationPiece;
  document.body.append(ghostPiece);

  // 5. Trigger the smooth animation
  const animation = ghostPiece.animate(
    [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0)` },
      { transform: "translate3d(-50%, -50%, 0)" },
    ],
    { duration: resolveSmoothMoveDurationMs(state.animationStyle), easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" }
  );

  activeGhostAnimation = animation;

  let finalized = false;
  const onEnd = () => {
  if (finalized) return;
  finalized = true;
  ghostPiece.remove();
  destinationPiece.style.visibility = "";
  destinationPiece.style.opacity = "1";
  revealDestinationMarker(destinationMarker);

  animationFinished = true;
  animatingToSquare = null;

  if (activeGhostAnimation === animation) {
    activeGhostAnimation = null;
    activeGhostNode = null;
    activeGhostDestinationPiece = null;
    
    // If a server update arrived while we were animating, 
    // run the render now that the path is clear.
    if (pendingBoardRefresh) {
      pendingBoardRefresh = false;
      renderBoard();
    }
  }
};

  animation.addEventListener("finish", onEnd);
  animation.addEventListener("cancel", onEnd);
}

function requestBoardRefresh(force = false): void {
  if (force && activeGhostAnimation) {
    const tempAnim = activeGhostAnimation;
    activeGhostAnimation = null; 

    // 1. Physical Cleanup: Remove the moving ghost image
    if (activeGhostNode) {
      activeGhostNode.remove();
      activeGhostNode = null;
    }

    // 2. Visibility Restore: Instantly show the "real" piece again
    if (activeGhostDestinationPiece) {
      activeGhostDestinationPiece.style.visibility = "";
      activeGhostDestinationPiece.style.opacity = "1"; 
      activeGhostDestinationPiece = null;
    }

    // 3. State Reset: Tell the renderer the animation is officially OVER
    animationFinished = true;
    animatingToSquare = null;
    
    // FIX: DO NOT clear lastAnimatedMoveKey here! 
    // Clearing it caused the renderer to think the move had never been animated, 
    // resulting in the piece "re-animating" if you clicked during the movement.

    tempAnim.cancel(); 
  }

  // If a move is still animating and we aren't forcing, queue it up
  if (!force && activeGhostAnimation) {
    pendingBoardRefresh = true;
    return;
  }

  pendingBoardRefresh = false;
  renderBoard();
}

function animateLastMoveEpic(lastMove: MoveSummary | null): void {
  if (!state.snapshot || !lastMove) {
    lastAnimatedMoveKey = null;
    return;
  }

  const moveKey = `${state.snapshot.moveCount}:${lastMove.from}:${lastMove.to}:${lastMove.san}`;
  if (lastAnimatedMoveKey === moveKey) return;

  if (state.premoves.length > 0 || suppressAnimationForMove) {
    lastAnimatedMoveKey = moveKey;
    suppressAnimationForMove = null; 
    if (activeGhostAnimation) activeGhostAnimation.cancel();
    activeGhostAnimation = null;
    animationFinished = true;
    animatingToSquare = null;
    return; 
  }

  lastAnimatedMoveKey = moveKey;
  animationFinished = false;
  animatingToSquare = lastMove.to;

  if (activeGhostAnimation) activeGhostAnimation.cancel();
  if (activeGhostNode) {
    activeGhostNode.remove();
    activeGhostNode = null;
  }
  if (activeGhostDestinationPiece) {
    activeGhostDestinationPiece.style.visibility = "";
    activeGhostDestinationPiece = null;
  }

  const fromSquareButton = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.from}"]`);
  const toSquareButton   = board.querySelector<HTMLButtonElement>(`[data-square="${lastMove.to}"]`);
  const destinationPiece = toSquareButton?.querySelector<HTMLElement>(".piece");
  if (!fromSquareButton || !toSquareButton || !destinationPiece) {
    animationFinished = true;
    animatingToSquare = null;
    return;
  }

  const fromRect = fromSquareButton.getBoundingClientRect();
  const toRect = toSquareButton.getBoundingClientRect();
  const startX = fromRect.left + fromRect.width / 2 + window.scrollX;
  const startY = fromRect.top + fromRect.height / 2 + window.scrollY;
  const endX = toRect.left + toRect.width / 2 + window.scrollX;
  const endY = toRect.top + toRect.height / 2 + window.scrollY;
  const deltaX = startX - endX;
  const deltaY = startY - endY;

  const pieceRect = destinationPiece.getBoundingClientRect();
  const ghostPiece = destinationPiece.cloneNode(true) as HTMLElement;
  const destinationMarker = toSquareButton.querySelector<HTMLElement>(".piece-quality-marker");
  if (destinationMarker) {
    destinationMarker.classList.remove("marker-reveal");
    destinationMarker.style.visibility = "hidden";
  }
  
  Object.assign(ghostPiece.style, {
    position: "absolute",
    left: `${endX}px`,
    top: `${endY}px`,
    width: `${pieceRect.width}px`,
    height: `${pieceRect.height}px`,
    transform: "translate3d(-50%, -50%, 0)",
    zIndex: "9999",
    pointerEvents: "none",
  });

  destinationPiece.style.visibility = "hidden";
  activeGhostNode = ghostPiece;
  activeGhostDestinationPiece = destinationPiece;
  document.body.append(ghostPiece);

  const aura = state.trailFxEnabled ? "drop-shadow(0 0 12px rgba(255,255,255,0.3))" : "";

  // --- RANDOMIZED PROFILE SYSTEM ---
  const roll = Math.random();
  let profile = "slide"; // 40% chance
  if (roll < 0.3) profile = "smash"; // 30% chance
  else if (roll < 0.6) profile = "spin"; // 30% chance

  let keyframes: Keyframe[] = [];
  let duration: number = EPIC_MOVE_DURATION_MS.spin;

  if (profile === "smash") {
    // 1. THE SMASH (Massive Jump & Scale)
    duration = EPIC_MOVE_DURATION_MS.smash;
    const jump = 90 + Math.random() * 40;
    const scale = 1.25 + Math.random() * 0.15;
    const spin = (Math.random() * 15 + 10) * (Math.random() > 0.5 ? 1 : -1);
    
    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) scale(1)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.15}px), calc(-50% + ${-jump}px), 0) rotateZ(${spin}deg) scale(${scale})`, filter: `brightness(1.4) drop-shadow(0 40px 25px rgba(0,0,0,0.45)) ${aura}`, offset: 0.65 },
      { transform: `translate3d(-50%, calc(-50% + 8px), 0) rotateZ(${-(spin * 0.5)}deg) scale(0.92)`, filter: `brightness(1.05) drop-shadow(0 2px 4px rgba(0,0,0,0.7)) ${aura}`, offset: 0.92 },
      { transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) scale(1)", filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 1 }
    ];
  } 
  else if (profile === "spin") {
    // 2. THE SPIN (360 Kickflip)
    duration = EPIC_MOVE_DURATION_MS.spin;
    const jump = 40 + Math.random() * 20;
    const spinDir = Math.random() > 0.5 ? 360 : -360;
    
    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${-jump}px), 0) rotateZ(${spinDir * 0.6}deg)`, filter: `brightness(1.2) drop-shadow(0 15px 15px rgba(0,0,0,0.3)) ${aura}`, offset: 0.5 },
      { transform: `translate3d(-50%, -50%, 0) rotateZ(${spinDir}deg)`, filter: `brightness(1) drop-shadow(0 0 0 rgba(0,0,0,0)) ${aura}`, offset: 1 }
    ];
  } 
  else {
    // 3. THE SLIDE (Fast, Low, Aggressive Tilt)
    duration = EPIC_MOVE_DURATION_MS.slide;
    // Calculate tilt direction based on movement (deltaX is inverted: negative means moving right)
    const tilt = deltaX < 0 ? 18 : (deltaX > 0 ? -18 : 0); 
    
    keyframes = [
      { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) rotateZ(0deg) scale(1)`, filter: `brightness(1) ${aura}`, offset: 0 },
      { transform: `translate3d(calc(-50% + ${deltaX * 0.4}px), calc(-50% + ${deltaY * 0.4 - 10}px), 0) rotateZ(${tilt}deg) scale(1.05)`, filter: `brightness(1.1) drop-shadow(0 8px 10px rgba(0,0,0,0.25)) ${aura}`, offset: 0.4 },
      { transform: `translate3d(-50%, calc(-50% + 4px), 0) rotateZ(${-(tilt * 0.3)}deg) scale(0.95)`, filter: `brightness(1) drop-shadow(0 2px 2px rgba(0,0,0,0.5)) ${aura}`, offset: 0.9 },
      { transform: "translate3d(-50%, -50%, 0) rotateZ(0deg) scale(1)", filter: `brightness(1) ${aura}`, offset: 1 }
    ];
  }

  const animation = ghostPiece.animate(keyframes, {
    duration,
    easing: profile === "slide" ? "cubic-bezier(0.1, 0.9, 0.2, 1)" : "cubic-bezier(0.22, 0.61, 0.36, 1)", // Slide gets a punchier easing
  });

  activeGhostAnimation = animation;
  
  startTrailSpawning();

 let finalized = false;
 const onEnd = () => {
  if (finalized) return;
  finalized = true;
  ghostPiece.remove();
  destinationPiece.style.visibility = "";
  destinationPiece.style.opacity = "1";
  revealDestinationMarker(destinationMarker);

  animationFinished = true;
  animatingToSquare = null;

  if (activeGhostAnimation === animation) {
    activeGhostAnimation = null;
    activeGhostNode = null;
    activeGhostDestinationPiece = null;
    
    // If a server update arrived while we were animating, 
    // run the render now that the path is clear.
    if (pendingBoardRefresh) {
      pendingBoardRefresh = false;
      renderBoard();
    }
  }
};

  animation.addEventListener("finish", onEnd);
  animation.addEventListener("cancel", onEnd);
}

function onSquarePressed(square: Square): void {
  if (state.viewCursor !== null) {
    state.viewCursor = null;
    render();
    return;
  }
  
  const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) return;

  if (!state.snapshot || !state.role || state.role === "spectator") return;

  if (state.snapshot.turn !== state.role) {
    onPremoveSquarePressed(square);
    return;
  }

  if (square === state.selectedSquare) {
    clearSelection();
    requestBoardRefresh(true);
    updateCaption();
    return;
  }

  if (state.legalTargets.includes(square)) {
    const from = state.selectedSquare;
    clearSelection();
    requestBoardRefresh(true);
    
    if (from) {
      suppressAnimationForMove = null; 
      tryMoveFromTo(from, square);
    }
    
    updateCaption();
    return;
  }

  const clickedPiece = chess.get(square);
  if (clickedPiece && isOwnPiece(clickedPiece.color)) {
    selectSquare(square); 
    return;
  }

  // FIX: Only force refresh if there was actually a selection to clear.
  // This prevents random clicks on empty squares from resetting/flickering the board.
  if (state.selectedSquare) {
    clearSelection();
    requestBoardRefresh(true);
    updateCaption();
  }
}
function selectSquare(square: Square): void {
  state.selectedSquare = square;
  state.legalTargets = legalTargetsFor(square);
  requestBoardRefresh();
  updateCaption();
}

function clearSelection(): void {
  state.selectedSquare = null;
  state.legalTargets = [];
}

function legalTargetsFor(square: Square): Square[] {
  return chess.moves({ square, verbose: true }).map((move) => move.to);
}

function legalTargetsForRole(square: Square, role: PlayerRole): Square[] {
  const fenParts = chess.fen().split(" ");
  fenParts[1] = role;
  const roleChess = new Chess(fenParts.join(" "));
  return roleChess.moves({ square, verbose: true }).map((move) => move.to);
}

function canStartMoveFrom(square: Square): boolean {
  if (state.viewCursor !== null) return false;

  if (!state.snapshot || !state.role || state.role === "spectator") return false;

  // Miramos el tablero virtual para permitir arrastrar "fantasmas"
  const vBoard = getVirtualBoard(chess.fen(), state.premoves, state.role as PlayerRole);
  const piece = vBoard.get(square);

  if (!piece || piece.color !== state.role) return false;

  // Si es tu turno real o si la pieza tiene movimientos teÃ³ricos/legales
  return true; 
}

function tryMoveFromTo(from: Square, to: Square): void {
 const gameEnded = Boolean(state.snapshot && (state.snapshot.checkmate || state.snapshot.draw || state.snapshot.winner !== null));
  if (gameEnded) return;

  if (!state.snapshot || !state.role || state.role === "spectator") return;

  // Handle Premoves
  if (state.snapshot.turn !== state.role) {
    queuePremove(from, to);
    return;
  }

  // Handle Promotion Branch
  const selectedPiece = chess.get(from);
  if (selectedPiece?.type === "p" && reachesPromotionRank(to, state.role)) {
    // FIX: Verify the promotion move is actually legal before showing the dialog
    const isLegal = chess.moves({ verbose: true }).some(m => m.from === from && m.to === to);
    if (!isLegal) return; 

    state.pendingPromotion = { from, to };
    promotionDialog.hidden = false;
    return;
  }

  let playerMoveResult: Move | null = null;

  if (state.gameMode === "multiplayer") {
    // Standard Multiplayer Logic
    socket.emit("game:move", { from, to });
    const temp = new Chess(chess.fen());
    playerMoveResult = temp.move({ from, to, promotion: "q" });
  } else {
    const playerRole = getBotPlayerRole();
    // BOT MODE: Process player move locally
    syncBotClockToNow();
    if (!state.snapshot || state.snapshot.winner !== null || state.snapshot.checkmate || state.snapshot.draw) {
      render();
      return;
    }

    playerMoveResult = chess.move({ from, to, promotion: "q" });
    if (!playerMoveResult) return;

    updateManualSnapshot(playerMoveResult);
    finalizeBotClockAfterMove(playerRole);
   
    render(true); 
    playSoundForSnapshot(state.snapshot);

    // Trigger Bot Response after a short delay
    if (!state.snapshot.checkmate && !state.snapshot.draw) {
      scheduleBotResponse(playerMoveResult);
    }
  }

  // Live Analysis logic for the move you just played
  if (state.snapshot?.analysis.enabled && playerMoveResult) {
    state.liveAnalysisSummary = "Analyzing move...";
    renderSession();
    
    const moveKey = `${state.snapshot.moveCount}:${from}:${to}:${playerMoveResult.san}`;
    void maybeRunLiveAnalysisForMove(
      state.snapshot.moves.slice(0, -1), 
      playerMoveResult, 
      state.snapshot.moveCount, 
      moveKey
    );
  }
}

/** Starts a local game against the AI */
function startBotGame(playerSide: PlayerRole = state.botPlayerSide) {
  clearScheduledBotResponse();
  resetLowTimeWarningState();
  accountSidebarController.resetFinishedGameTracking();

  const normalizedPlayerSide: PlayerRole = playerSide === "b" ? "b" : "w";
  const botSide: PlayerRole = normalizedPlayerSide === "w" ? "b" : "w";
  const botPreset = getBotDifficultyPreset(state.botLevel);
  const botTimeControl = getBotTimeControlPreset(state.botTimeControlId);
  const playerName = getCurrentPlayerName();
  const botName = `Bot (${botDifficultySummary(botPreset)})`;
  const now = Date.now();

  state.gameMode = "bot";
  state.botPlayerSide = normalizedPlayerSide;
  localStorage.setItem("chess-bot-player-side", normalizedPlayerSide);
  state.role = normalizedPlayerSide;
  state.orientation = normalizedPlayerSide;
  state.roomId = "BOT";
  state.shareUrl = "";
  state.pendingPromotion = null;
  state.premoves = [];
  state.selectedSquare = null;
  state.legalTargets = [];
  state.viewCursor = null;
  accountSidebarController.setFriendPresenceActivity("playing-bot");
  regenerateWoodTextureOffsets();
  
  chess.reset();
  
  // Initialize snapshot manually to bypass server socket
  state.snapshot = {
    roomId: "LOCAL",
    ownerId: null,
    fen: chess.fen(),
    turn: chess.turn(),
    status: "Active",
    winner: null,
    check: false,
    checkmate: false,
    draw: false,
    moveCount: 0,
    moves: [],
    lastMove: null,
    players: {
      whiteConnected: true,
      blackConnected: true,
      spectatorCount: 0,
      whiteName: normalizedPlayerSide === "w" ? playerName : botName,
      blackName: normalizedPlayerSide === "b" ? playerName : botName,
      whiteUserId: null,
      blackUserId: null,
      whiteFriendId: null,
      blackFriendId: null,
    },
    rematchVotes: 0,
    analysis: { enabled: false, votes: 0, locked: false, labelsOnly: false, labelsVotes: 0 },
    undo: { pending: false, requester: null },
    isStarted: true,
    pregame: { p1Choice: normalizedPlayerSide, p2Choice: botSide, p1Ready: true, p2Ready: true },
    timeControl: { ...botTimeControl },
    clock: {
      whiteMs: botTimeControl.initialMs,
      blackMs: botTimeControl.initialMs,
      active: "w",
      running: true,
      lowTimeThresholdMs: getLowTimeThresholdMs(botTimeControl.initialMs),
      serverNowMs: now,
    },
  };
  lastRoomStateReceivedAtMs = now;

  showToast(
    `Bot mode active. ${botTimeControl.label}. You are ${normalizedPlayerSide === "w" ? "White" : "Black"}. ${botDifficultySummary(botPreset)}.`,
  );
  persistBotSession(true);
  render();

  if (state.snapshot.turn === botSide && !state.snapshot.checkmate && !state.snapshot.draw) {
    scheduleBotResponse(null);
  }
}

/** Updates the snapshot locally after a move in Bot mode */
// main.ts - Actualiza updateManualSnapshot
function updateManualSnapshot(move: Move): void {
  if (!state.snapshot) return;

  // Contamos piezas antes del movimiento
  const countPieces = (f: string) => (f.split(" ")[0] || "").replace(/[^a-zA-Z]/g, "").length;
  const previousPieceCount = countPieces(state.snapshot.fen);

  const newSummary: MoveSummary = {
    color: move.color as PlayerRole,
    from: move.from,
    to: move.to,
    san: move.san,
    piece: move.piece
  };

  state.snapshot.fen = chess.fen();
  state.snapshot.turn = chess.turn() as PlayerRole;
  state.snapshot.moveCount++;
  state.snapshot.lastMove = newSummary;
  state.snapshot.moves.push(newSummary);

  clearArrows();
  
  // blood logic
  const currentPieceCount = countPieces(state.snapshot.fen);
  if (state.bloodFxEnabled && currentPieceCount < previousPieceCount) {
    boardEffects.spawnBloodSplatter(move.to, (move.captured as PieceSymbol) || "p");
  }

  state.snapshot.check = chess.inCheck();
  state.snapshot.checkmate = chess.isCheckmate();
  state.snapshot.draw = chess.isDraw();
  
  if (state.snapshot.checkmate) {
    state.snapshot.winner = move.color as PlayerRole;
  }
  persistBotSession(true);
}
function queuePremove(from: Square, to: Square): void {
  if (!state.role || state.role === "spectator") return;

  // Miramos el tablero virtual para saber quÃ© pieza estamos moviendo realmente
  const vBoard = getVirtualBoard(chess.fen(), state.premoves, state.role);
  const piece = vBoard.get(from);

  if (!piece || piece.color !== state.role) return;

  if (!isTheoreticallyPossible(from, to, piece.type, piece.color)) return;

  const existingIndex = state.premoves.findIndex(p => p.from === from && p.to === to);
  if (existingIndex !== -1) {
    state.premoves.splice(existingIndex, 1);
  } else {
    if (state.premoves.length >= 10) return;
    const promotion = (piece.type === "p" && reachesPromotionRank(to, state.role)) ? "q" : undefined;
    state.premoves.push(promotion ? { from, to, promotion } : { from, to });
    playSound("premove");
  }

  clearSelection();
  requestBoardRefresh();
  updateCaption();
}

// main.ts - Update the logic inside onPremoveSquarePressed
function onPremoveSquarePressed(square: Square): void {
  if (!state.role || state.role === "spectator") return;

  const vBoard = getVirtualBoard(chess.fen(), state.premoves, state.role); 
  const clickedPiece = vBoard.get(square);

  if (!state.selectedSquare) {
    // If clicking own piece, select it
    if (clickedPiece && clickedPiece.color === state.role) {
      state.selectedSquare = square;
      state.legalTargets = vBoard.moves({ square, verbose: true }).map(m => m.to);
      requestBoardRefresh(true); // Force refresh to show selection
      updateCaption();
    }
    return;
  }

  if (square === state.selectedSquare) {
    clearSelection();
    requestBoardRefresh(true);
    updateCaption();
    return;
  }

  const pieceToMove = vBoard.get(state.selectedSquare);
  if (pieceToMove && isTheoreticallyPossible(state.selectedSquare, square, pieceToMove.type, pieceToMove.color)) {
    queuePremove(state.selectedSquare, square);
  } else {
    // Keep queued premoves intact; only adjust the active selection context.
    if (clickedPiece && clickedPiece.color === state.role) {
      state.selectedSquare = square;
      state.legalTargets = vBoard.moves({ square, verbose: true }).map(m => m.to);
    } else {
      clearSelection();
    }
    requestBoardRefresh(true); 
  }

  updateCaption();
}

function pullNextLegalPremove(): { move: (typeof state.premoves)[number] | null; pruned: number } {
  const legalMoves = chess.moves({ verbose: true });
  let pruned = 0;

  while (state.premoves.length > 0) {
    const queued = state.premoves[0];
    if (!queued) {
      break;
    }
    const isLegalNow = legalMoves.some((move) => move.from === queued.from && move.to === queued.to);
    if (!isLegalNow) {
      state.premoves.shift();
      pruned += 1;
      continue;
    }

    state.premoves.shift();
    return { move: queued, pruned };
  }

  return { move: null, pruned };
}

function isOwnPiece(color: PlayerRole): boolean {
  return state.role === color;
}

function clearLocalRoomState(options: { preserveRoomReturnContext?: boolean } = {}): void {  
  setRoomCreatePending(false);
  clearRoomCreateTransitionClass();
  clearScheduledBotResponse();
  pendingInGameFriendRequest = null;
  clearRoomJoinRequestQueue();
  setSendFriendRequestState(false);
  voiceChatController.syncSession({
    roomId: null,
    role: null,
    gameMode: "multiplayer",
    isGameActive: false,
  });

  if (botAnalyzer) {
    botAnalyzer.terminate();
    botAnalyzer = null;
  }

  if (activeGhostAnimation) {
    const animation = activeGhostAnimation;
    activeGhostAnimation = null;
    animation.cancel();
  }

  if (activeGhostNode) {
    activeGhostNode.remove();
    activeGhostNode = null;
  }

  if (activeGhostDestinationPiece) {
    activeGhostDestinationPiece.style.visibility = "";
    activeGhostDestinationPiece.style.opacity = "1";
    activeGhostDestinationPiece = null;
  }

  if (trailRafId !== null) {
    cancelAnimationFrame(trailRafId);
    trailRafId = null;
  }

  state.roomId = null;
  state.role = null;
  state.shareUrl = "";
  state.snapshot = null;
  state.pendingPromotion = null;
  state.premoves = [];
  state.selectedSquare = null;
  state.legalTargets = [];
  state.viewCursor = null;
  state.focusMode = false;

  state.gameMode = "multiplayer"; 
  accountSidebarController.setFriendPresenceActivity(null);

  state.liveAnalysisSummary = "Live analysis disabled.";
  state.lastAnalyzedMoveKey = null;
  state.liveMoveGrades = {};
  currentModalAction = null;
  suppressAnimationForMove = null;
  lastAnimatedMoveKey = null;
  pendingBoardRefresh = false;
  animationFinished = true;
  animatingToSquare = null;
  _lastPlayedMoveCount = -1;
  roomInput.value = "";

  stopAllCachedAudio();

  liveAnalysisToken += 1;
  lastRoomStateReceivedAtMs = Date.now();
  
  localStorage.removeItem("chess_roomId");
  localStorage.removeItem("chess_roomInviteToken");
  clearPersistedBotSession();
  if (!options.preserveRoomReturnContext) {
    localStorage.removeItem(ROOM_RETURN_CONTEXT_STORAGE_KEY);
  }
  
  // NEW: Ensure any active drag is killed when leaving or resetting
  cancelCurrentDrag();
  
  clearArrows();
  chess.reset();
  resetLowTimeWarningState();
  syncUrl(null);
}

function scrollToInviteJoinCardOnMobile(): void {
  const needsForcedReveal = !isElementMostlyVisible(inviteJoinCard);
  if (!shouldAutoScrollInviteJoin() && !needsForcedReveal) {
    return;
  }

  window.requestAnimationFrame(() => {
    inviteJoinCard.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  });
}

function getFocusTimerText(): string {
  const snapshot = state.snapshot;
  if (!snapshot) {
    return "W 00:00 | B 00:00";
  }

  const whiteText = formatClockMs(getDisplayClockMs(snapshot, "w", {
    mode: state.gameMode,
    lastRoomStateReceivedAtMs,
  }));
  const blackText = formatClockMs(getDisplayClockMs(snapshot, "b", {
    mode: state.gameMode,
    lastRoomStateReceivedAtMs,
  }));

  if (state.role === "w") {
    return `${whiteText} | Opp ${blackText}`;
  }

  if (state.role === "b") {
    return `${blackText} | Opp ${whiteText}`;
  }

  return `W ${whiteText} | B ${blackText}`;
}

let lastFocusMaterialKey: string | null = null;
let focusMaterialWasVisible = false;

function setFocusMaterialVisibility(visible: boolean): void {
  if (!visible) {
    focusMaterialHud.classList.remove("focus-material-appear");
    focusMaterialHud.hidden = true;
    focusMaterialWasVisible = false;
    return;
  }

  focusMaterialHud.hidden = false;
  if (!focusMaterialWasVisible) {
    focusMaterialHud.classList.remove("focus-material-appear");
    void focusMaterialHud.offsetWidth;
    focusMaterialHud.classList.add("focus-material-appear");
  }
  focusMaterialWasVisible = true;
}

function updateFocusHud(): void {
  if (!state.focusMode) {
    focusHud.hidden = true;
    focusMaterialHud.innerHTML = "";
    lastFocusMaterialKey = null;
    setFocusMaterialVisibility(false);
    return;
  }

  // Reveal container first to avoid stale first-frame text after toggling focus mode.
  focusHud.hidden = false;
  focusTimer.textContent = getFocusTimerText();

  const snapshot = state.snapshot;
  if (snapshot && state.role && state.role !== "spectator") {
    const myColor = state.role as PlayerRole;
    const opColor = myColor === "w" ? "b" : "w";
    
    // FIX: Apply the same robust replay logic to the Focus HUD
    const movesToReplay = state.viewCursor !== null 
      ? snapshot.moves.slice(0, state.viewCursor) 
      : snapshot.moves;

    const replayBoard = new Chess();
    const myCaptures: PieceSymbol[] = [];
    const opCaptures: PieceSymbol[] = [];

    for (const moveSummary of movesToReplay) {
      const moveResult = replayBoard.move(moveSummary.san);
      if (moveResult && moveResult.captured) {
        if (moveResult.color === myColor) {
          myCaptures.push(moveResult.captured);
        } else {
          opCaptures.push(moveResult.captured);
        }
      }
    }

    const sortOrder: Record<PieceSymbol, number> = { q: 1, r: 2, b: 3, n: 4, p: 5, k: 6 };
    myCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);
    opCaptures.sort((a, b) => sortOrder[a] - sortOrder[b]);

    let myCapturesHtml = "";
    myCaptures.forEach(piece => {
      myCapturesHtml += `<img src="${getPieceSpritePath(opColor, piece)}" class="captured-icon" />`;
    });

    let opCapturesHtml = "";
    opCaptures.forEach(piece => {
      opCapturesHtml += `<img src="${getPieceSpritePath(myColor, piece)}" class="captured-icon" />`;
    });

    const currentFen = replayBoard.fen();
    const rawValue = materialFromPerspective(currentFen, myColor);
    const netValue = Math.floor(rawValue / 100);
    const hasMovesPlayed = movesToReplay.length > 0;
    const hasMaterialData = Boolean(myCapturesHtml || opCapturesHtml || netValue !== 0);
    const shouldShowMaterialHud = hasMovesPlayed && hasMaterialData;

    if (shouldShowMaterialHud) {
      const markup = `
        ${myCapturesHtml || netValue > 0 ? `
        <div class="focus-capture-row">
           <div class="focus-icons">${myCapturesHtml}</div>
           ${netValue > 0 ? `<span class="focus-score plus">+${netValue}</span>` : ""}
        </div>` : ""}
        
        ${opCapturesHtml || netValue < 0 ? `
        <div class="focus-capture-row">
           <div class="focus-icons" style="opacity: 0.85;">${opCapturesHtml}</div>
           ${netValue < 0 ? `<span class="focus-score minus">${netValue}</span>` : ""}
        </div>` : ""}
      `;
      const materialKey = `${movesToReplay.length}:${myCaptures.join("")}:${opCaptures.join("")}:${netValue}`;
      if (materialKey !== lastFocusMaterialKey) {
        focusMaterialHud.innerHTML = markup;
        lastFocusMaterialKey = materialKey;
      }
      setFocusMaterialVisibility(true);
    } else {
      focusMaterialHud.innerHTML = "";
      lastFocusMaterialKey = null;
      setFocusMaterialVisibility(false);
    }
  } else {
    focusMaterialHud.innerHTML = "";
    lastFocusMaterialKey = null;
    setFocusMaterialVisibility(false);
  }
}
function applyFocusMode(): void {
  document.body.classList.toggle("focus-mode", state.focusMode);
  document.body.classList.toggle("focus-multiplayer", state.focusMode);
  focusModeButton.setAttribute("aria-pressed", String(state.focusMode));
  focusModeButton.textContent = state.focusMode ? "Exit" : "Focus";
  updateFocusHud();
}

async function toggleFocusMode(force?: boolean): Promise<void> {
  const nextMode = force ?? !state.focusMode;
  if (nextMode === state.focusMode) {
    return;
  }

  state.focusMode = nextMode;
  applyFocusMode();
}

let toastTimer = 0;

function showToast(message: string): void {
  state.toastMessage = message;
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}

render();
window.setInterval(updateFocusHud, 1000);
window.setInterval(() => {
  if (!state.snapshot || !state.snapshot.clock.running) {
    return;
  }

  if (state.gameMode === "bot") {
    syncBotClockToNow();
    persistBotSession();
  }

  renderSession();
}, 250);

window.addEventListener("beforeunload", () => {
  persistBotSession(true);
  liveAnalyzer?.terminate();
  botAnalyzer?.terminate();
});

