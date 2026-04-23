import { FirebaseOptions, initializeApp } from "firebase/app";
import {
  Auth,
  AuthError,
  GoogleAuthProvider,
  User,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
};

export type SavedGameHistoryEntry = {
  id: string;
  pgn: string;
  savedAt: string | null;
};

export type PublicUserProfile = {
  userId: string;
  friendId: string;
  displayName: string;
  email: string | null;
  usernameChangeCount: number;
};

export type FriendListEntry = {
  userId: string;
  friendId: string;
  displayName: string;
  email: string | null;
};

export type FriendRequestEntry = {
  requestId: string;
  fromUserId: string;
  fromFriendId: string;
  fromDisplayName: string;
  fromEmail: string | null;
  toUserId: string;
  toFriendId: string;
  toDisplayName: string;
  toEmail: string | null;
  createdAt: string;
};

const REQUIRED_CONFIG_KEYS: Array<keyof FirebaseClientConfig> = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];

const GOOGLE_PROVIDER = new GoogleAuthProvider();
GOOGLE_PROVIDER.setCustomParameters({ prompt: "select_account" });

const POPUP_RECOVERY_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
]);

const MAX_FRIENDS = 200;
const MAX_FRIEND_REQUESTS = 300;
const FRIEND_ID_DIGITS = 5;
const FRIEND_ID_MIN = 10_000;
const FRIEND_ID_MAX = 99_999;
const MAX_BOT_SESSION_PAYLOAD_LENGTH = 900_000;
const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 24;

let auth: Auth | null = null;
let db: Firestore | null = null;
let disabledReason: string | null = null;
let initPromise: Promise<void> | null = null;

function normalizeConfig(value: unknown): FirebaseClientConfig {
  const source = typeof value === "object" && value ? (value as Record<string, unknown>) : {};

  return {
    apiKey: String(source.apiKey ?? ""),
    authDomain: String(source.authDomain ?? ""),
    projectId: String(source.projectId ?? ""),
    storageBucket: String(source.storageBucket ?? ""),
    messagingSenderId: String(source.messagingSenderId ?? ""),
    appId: String(source.appId ?? ""),
    measurementId: String(source.measurementId ?? ""),
  };
}

function buildGameIdFromPgn(pgn: string): string {
  let hash = 2166136261;

  for (let i = 0; i < pgn.length; i += 1) {
    hash ^= pgn.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `game_${(hash >>> 0).toString(36)}_${pgn.length}`;
}

function normalizeSavedAt(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeUserId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeBotSessionPayload(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_BOT_SESSION_PAYLOAD_LENGTH) {
    return null;
  }

  return normalized;
}

function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, USERNAME_MAX_LENGTH);
}

function normalizeInitialUsername(value: unknown): string {
  const stripped = normalizeUsername(value).replace(/\s+/g, "");
  if (stripped.length >= USERNAME_MIN_LENGTH) {
    return stripped;
  }

  return "Player";
}

function normalizeUsernameChangeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.floor(value);
  return rounded < 0 ? 0 : rounded;
}

function assertValidUsernameInput(value: unknown): string {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    throw new Error("Username cannot be empty.");
  }

  if (/\s/.test(normalized)) {
    throw new Error("Username cannot contain spaces.");
  }

  if (normalized.length < USERNAME_MIN_LENGTH) {
    throw new Error("Username must be at least 2 characters.");
  }

  return normalized;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return null;
  }

  return normalized;
}

function normalizeFriendId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return /^\d{5}$/.test(trimmed) ? trimmed : "";
}

function normalizeDisplayNameKey(value: unknown): string {
  return normalizeDisplayName(value).toLowerCase();
}

function isNumericFriendLookup(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function generateRandomFriendId(): string {
  const next = Math.floor(Math.random() * (FRIEND_ID_MAX - FRIEND_ID_MIN + 1)) + FRIEND_ID_MIN;
  return String(next).padStart(FRIEND_ID_DIGITS, "0");
}

function normalizeFriendList(value: unknown): FriendListEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<string>();
  const normalized: FriendListEntry[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const userId = normalizeUserId(record.userId);
    if (!userId || uniqueIds.has(userId)) {
      continue;
    }

    uniqueIds.add(userId);

    normalized.push({
      userId,
      friendId: normalizeFriendId(record.friendId),
      displayName: normalizeDisplayName(record.displayName) || "Player",
      email: normalizeEmail(record.email),
    });
  }

  return normalized.slice(0, MAX_FRIENDS);
}

function serializeFriendList(friends: FriendListEntry[]): Array<{
  userId: string;
  friendId: string;
  displayName: string;
  email: string | null;
}> {
  return friends.map((friend) => ({
    userId: friend.userId,
    friendId: friend.friendId,
    displayName: friend.displayName,
    email: friend.email,
  }));
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeFriendRequestList(value: unknown): FriendRequestEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();
  const normalized: FriendRequestEntry[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const requestId = normalizeUserId(record.requestId);
    const fromUserId = normalizeUserId(record.fromUserId);
    const toUserId = normalizeUserId(record.toUserId);

    if (!requestId || !fromUserId || !toUserId || seenIds.has(requestId)) {
      continue;
    }

    seenIds.add(requestId);
    normalized.push({
      requestId,
      fromUserId,
      fromFriendId: normalizeFriendId(record.fromFriendId),
      fromDisplayName: normalizeDisplayName(record.fromDisplayName) || "Player",
      fromEmail: normalizeEmail(record.fromEmail),
      toUserId,
      toFriendId: normalizeFriendId(record.toFriendId),
      toDisplayName: normalizeDisplayName(record.toDisplayName) || "Player",
      toEmail: normalizeEmail(record.toEmail),
      createdAt: normalizeIsoDate(record.createdAt),
    });
  }

  return normalized
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
        return 0;
      }

      return rightTime - leftTime;
    })
    .slice(0, MAX_FRIEND_REQUESTS);
}

function serializeFriendRequestList(requests: FriendRequestEntry[]): Array<{
  requestId: string;
  fromUserId: string;
  fromFriendId: string;
  fromDisplayName: string;
  fromEmail: string | null;
  toUserId: string;
  toFriendId: string;
  toDisplayName: string;
  toEmail: string | null;
  createdAt: string;
}> {
  return requests.map((request) => ({
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    fromFriendId: request.fromFriendId,
    fromDisplayName: request.fromDisplayName,
    fromEmail: request.fromEmail,
    toUserId: request.toUserId,
    toFriendId: request.toFriendId,
    toDisplayName: request.toDisplayName,
    toEmail: request.toEmail,
    createdAt: request.createdAt,
  }));
}

function buildRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function removeRequestsBetweenUsers(requests: FriendRequestEntry[], leftUserId: string, rightUserId: string): FriendRequestEntry[] {
  return requests.filter((request) => {
    const forward = request.fromUserId === leftUserId && request.toUserId === rightUserId;
    const backward = request.fromUserId === rightUserId && request.toUserId === leftUserId;
    return !forward && !backward;
  });
}

function normalizePublicUserProfile(userId: string, value: unknown): PublicUserProfile | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const normalizedUserId = normalizeUserId(record.userId) || userId;
  if (!normalizedUserId) {
    return null;
  }

  return {
    userId: normalizedUserId,
    friendId: normalizeFriendId(record.friendId),
    displayName: normalizeDisplayName(record.displayName) || "Player",
    email: normalizeEmail(record.email),
    usernameChangeCount: normalizeUsernameChangeCount(record.usernameChangeCount),
  };
}

async function resolveUniqueUsername(database: Firestore, userId: string, preferredUsername: string): Promise<string> {
  const preferred = normalizeInitialUsername(preferredUsername);

  for (let attempt = 0; attempt < 128; attempt += 1) {
    const suffix = attempt === 0 ? "" : String(attempt + 1);
    const baseLimit = USERNAME_MAX_LENGTH - suffix.length;
    const candidate = `${preferred.slice(0, Math.max(USERNAME_MIN_LENGTH, baseLimit))}${suffix}`;
    const candidateKey = normalizeDisplayNameKey(candidate);
    if (!candidateKey) {
      continue;
    }

    const indexRef = doc(database, "userDisplayNameIndex", candidateKey);
    const indexSnapshot = await getDoc(indexRef);
    const existingUserId = normalizeUserId(indexSnapshot.data()?.userId);
    if (!existingUserId || existingUserId === userId) {
      return candidate;
    }
  }

  throw new Error("Could not allocate a unique username.");
}

async function upsertUsernameIndex(database: Firestore, userId: string, username: string): Promise<void> {
  const usernameKey = normalizeDisplayNameKey(username);
  if (!usernameKey) {
    return;
  }

  await setDoc(
    doc(database, "userDisplayNameIndex", usernameKey),
    {
      userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function propagateProfileRename(
  database: Firestore,
  profile: PublicUserProfile,
  previousDisplayName: string,
): Promise<void> {
  if (profile.displayName === previousDisplayName) {
    return;
  }

  const ownerFriendsRef = doc(database, "userFriends", profile.userId);
  const ownerFriendsSnapshot = await getDoc(ownerFriendsRef);
  const ownerFriends = ownerFriendsSnapshot.exists()
    ? normalizeFriendList(ownerFriendsSnapshot.data().friends)
    : [];

  const friendDocUpdates = ownerFriends.map(async (friend) => {
    const friendFriendsRef = doc(database, "userFriends", friend.userId);
    const friendFriendsSnapshot = await getDoc(friendFriendsRef);
    if (!friendFriendsSnapshot.exists()) {
      return;
    }

    const friendList = normalizeFriendList(friendFriendsSnapshot.data().friends);
    let changed = false;
    const updatedFriendList = friendList.map((entry) => {
      if (entry.userId !== profile.userId) {
        return entry;
      }

      if (entry.displayName === profile.displayName && entry.email === profile.email) {
        return entry;
      }

      changed = true;
      return {
        ...entry,
        displayName: profile.displayName,
        email: profile.email,
      };
    });

    if (!changed) {
      return;
    }

    await setDoc(
      friendFriendsRef,
      {
        userId: friend.userId,
        friends: serializeFriendList(updatedFriendList),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  const ownerRequestsRef = doc(database, "userFriendRequests", profile.userId);
  const ownerRequestsSnapshot = await getDoc(ownerRequestsRef);
  const ownerIncoming = ownerRequestsSnapshot.exists()
    ? normalizeFriendRequestList(ownerRequestsSnapshot.data().incoming)
    : [];
  const ownerOutgoing = ownerRequestsSnapshot.exists()
    ? normalizeFriendRequestList(ownerRequestsSnapshot.data().outgoing)
    : [];

  const counterpartIds = new Set<string>();
  for (const request of ownerIncoming) {
    counterpartIds.add(request.fromUserId);
  }
  for (const request of ownerOutgoing) {
    counterpartIds.add(request.toUserId);
  }

  const syncRequestsDocForOwner = async (ownerUserId: string): Promise<void> => {
    const requestsRef = doc(database, "userFriendRequests", ownerUserId);
    const snapshot = await getDoc(requestsRef);
    if (!snapshot.exists()) {
      return;
    }

    const incoming = normalizeFriendRequestList(snapshot.data().incoming);
    const outgoing = normalizeFriendRequestList(snapshot.data().outgoing);

    let incomingChanged = false;
    const updatedIncoming = incoming.map((request) => {
      if (request.fromUserId !== profile.userId && request.toUserId !== profile.userId) {
        return request;
      }

      if (request.fromUserId === profile.userId) {
        if (request.fromDisplayName === profile.displayName && request.fromEmail === profile.email) {
          return request;
        }

        incomingChanged = true;
        return {
          ...request,
          fromDisplayName: profile.displayName,
          fromEmail: profile.email,
        };
      }

      if (request.toDisplayName === profile.displayName && request.toEmail === profile.email) {
        return request;
      }

      incomingChanged = true;
      return {
        ...request,
        toDisplayName: profile.displayName,
        toEmail: profile.email,
      };
    });

    let outgoingChanged = false;
    const updatedOutgoing = outgoing.map((request) => {
      if (request.fromUserId !== profile.userId && request.toUserId !== profile.userId) {
        return request;
      }

      if (request.fromUserId === profile.userId) {
        if (request.fromDisplayName === profile.displayName && request.fromEmail === profile.email) {
          return request;
        }

        outgoingChanged = true;
        return {
          ...request,
          fromDisplayName: profile.displayName,
          fromEmail: profile.email,
        };
      }

      if (request.toDisplayName === profile.displayName && request.toEmail === profile.email) {
        return request;
      }

      outgoingChanged = true;
      return {
        ...request,
        toDisplayName: profile.displayName,
        toEmail: profile.email,
      };
    });

    if (!incomingChanged && !outgoingChanged) {
      return;
    }

    await setDoc(
      requestsRef,
      {
        userId: ownerUserId,
        incoming: serializeFriendRequestList(updatedIncoming),
        outgoing: serializeFriendRequestList(updatedOutgoing),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const requestDocUpdates = [
    syncRequestsDocForOwner(profile.userId),
    ...Array.from(counterpartIds).map((counterpartId) => syncRequestsDocForOwner(counterpartId)),
  ];

  await Promise.all([...friendDocUpdates, ...requestDocUpdates]);
}

function upsertFriendEntry(list: FriendListEntry[], entry: FriendListEntry): FriendListEntry[] {
  const next = list.filter((friend) => friend.userId !== entry.userId);
  next.unshift(entry);
  return next.slice(0, MAX_FRIENDS);
}

function normalizeStoredGameHistory(value: unknown): SavedGameHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueByPgn = new Set<string>();
  const normalizedGames: SavedGameHistoryEntry[] = [];

  for (const entry of value) {
    const rawPgn = typeof entry === "string"
      ? entry
      : (typeof entry === "object" && entry && typeof (entry as { pgn?: unknown }).pgn === "string"
        ? (entry as { pgn: string }).pgn
        : "");

    const pgn = rawPgn.trim();
    if (!pgn || uniqueByPgn.has(pgn)) {
      continue;
    }

    uniqueByPgn.add(pgn);

    const objectEntry = typeof entry === "object" && entry ? entry as { id?: unknown; savedAt?: unknown } : null;
    const explicitId = objectEntry && typeof objectEntry.id === "string" ? objectEntry.id.trim() : "";

    normalizedGames.push({
      id: explicitId || buildGameIdFromPgn(pgn),
      pgn,
      savedAt: normalizeSavedAt(objectEntry?.savedAt),
    });
  }

  return normalizedGames;
}

function serializeStoredGameHistory(games: SavedGameHistoryEntry[]): Array<{
  id: string;
  pgn: string;
  savedAt: string | null;
}> {
  return games.map((game) => ({
    id: game.id,
    pgn: game.pgn,
    savedAt: game.savedAt,
  }));
}

function requireAuth(): Auth {
  if (!auth) {
    throw new Error("Firebase authentication is not initialized.");
  }

  return auth;
}

function requireDb(): Firestore {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized.");
  }

  return db;
}

async function fetchClientConfig(): Promise<FirebaseClientConfig> {
  const response = await fetch("/api/firebase-config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase config (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  return normalizeConfig(payload);
}

function toFirebaseOptions(config: FirebaseClientConfig): FirebaseOptions {
  const options: FirebaseOptions = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
  };

  if (config.storageBucket) {
    options.storageBucket = config.storageBucket;
  }

  if (config.messagingSenderId) {
    options.messagingSenderId = config.messagingSenderId;
  }

  if (config.measurementId) {
    options.measurementId = config.measurementId;
  }

  return options;
}

export async function initializeFirebaseClient(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const config = await fetchClientConfig();
      const missingKeys = REQUIRED_CONFIG_KEYS.filter((key) => !config[key]);

      if (missingKeys.length > 0) {
        disabledReason = `Missing Firebase env values: ${missingKeys.join(", ")}.`;
        return;
      }

      const app = initializeApp(toFirebaseOptions(config));
      auth = getAuth(app);
      db = getFirestore(app);
      await getRedirectResult(auth).catch(() => undefined);
      disabledReason = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Firebase initialization error.";
      disabledReason = message;
    }
  })();

  return initPromise;
}

export function isFirebaseAuthEnabled(): boolean {
  return Boolean(auth && db);
}

export function getFirebaseAuthDisabledReason(): string | null {
  return disabledReason;
}

export function listenToAuthState(listener: (user: User | null) => void): (() => void) | null {
  if (!auth) {
    return null;
  }

  return onAuthStateChanged(auth, listener);
}

export async function signInWithGoogle(): Promise<void> {
  await initializeFirebaseClient();
  const authInstance = requireAuth();

  try {
    await signInWithPopup(authInstance, GOOGLE_PROVIDER);
  } catch (error) {
    const authError = error as Partial<AuthError>;
    const code = authError.code ?? "";

    if (POPUP_RECOVERY_CODES.has(code)) {
      await signInWithRedirect(authInstance, GOOGLE_PROVIDER);
      return;
    }

    throw error;
  }
}

export function formatGoogleAuthError(error: unknown): string {
  const authError = error as Partial<AuthError>;
  const code = authError.code ?? "";

  if (!code) {
    return "Google sign-in failed for an unknown reason.";
  }

  switch (code) {
    case "auth/invalid-api-key":
      return "Firebase API key is invalid. Check FIREBASE_API_KEY in .env.";
    case "auth/unauthorized-domain":
      return "Current domain is not authorized in Firebase Auth. Add it in Authentication > Settings > Authorized domains.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completing authentication.";
    case "auth/popup-blocked":
      return "Popup was blocked by the browser. Allow popups for this site or retry.";
    case "auth/network-request-failed":
      return "Network request failed while contacting Firebase.";
    case "auth/operation-not-allowed":
      return "Google provider is not enabled in Firebase Authentication.";
    case "auth/configuration-not-found":
      return "Firebase Auth configuration is missing for this project.";
    default:
      return authError.message || `Google sign-in failed (${code}).`;
  }
}

export async function signOutCurrentUser(): Promise<void> {
  const authInstance = requireAuth();
  await signOut(authInstance);
}

export async function getStoredGameCount(userId: string): Promise<number> {
  const database = requireDb();
  const documentRef = doc(database, "userGameHistory", userId);
  const snapshot = await getDoc(documentRef);
  if (!snapshot.exists()) {
    return 0;
  }

  const games = normalizeStoredGameHistory(snapshot.data().games);
  return games.length;
}

export async function getStoredGameHistory(userId: string): Promise<SavedGameHistoryEntry[]> {
  const database = requireDb();
  const documentRef = doc(database, "userGameHistory", userId);
  const snapshot = await getDoc(documentRef);
  if (!snapshot.exists()) {
    return [];
  }

  return normalizeStoredGameHistory(snapshot.data().games);
}

export async function saveGamePgnForUser(userId: string, pgn: string): Promise<number> {
  const database = requireDb();
  const documentRef = doc(database, "userGameHistory", userId);
  const snapshot = await getDoc(documentRef);
  const existingGames = snapshot.exists() ? normalizeStoredGameHistory(snapshot.data().games) : [];
  const normalizedPgn = pgn.trim();
  if (!normalizedPgn) {
    return existingGames.length;
  }

  const updatedGames: SavedGameHistoryEntry[] = [
    {
      id: buildGameIdFromPgn(normalizedPgn),
      pgn: normalizedPgn,
      savedAt: new Date().toISOString(),
    },
    ...existingGames.filter((entry) => entry.pgn !== normalizedPgn),
  ].slice(0, 100);

  await setDoc(
    documentRef,
    {
      games: serializeStoredGameHistory(updatedGames),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return updatedGames.length;
}

export async function deleteStoredGameForUser(userId: string, gameId: string): Promise<number> {
  const normalizedGameId = gameId.trim();
  if (!normalizedGameId) {
    return 0;
  }

  const database = requireDb();
  const documentRef = doc(database, "userGameHistory", userId);
  const snapshot = await getDoc(documentRef);
  if (!snapshot.exists()) {
    return 0;
  }

  const existingGames = normalizeStoredGameHistory(snapshot.data().games);
  const updatedGames = existingGames.filter((entry) => entry.id !== normalizedGameId);

  if (updatedGames.length === existingGames.length) {
    return existingGames.length;
  }

  await setDoc(
    documentRef,
    {
      games: serializeStoredGameHistory(updatedGames),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return updatedGames.length;
}

export async function clearStoredGamesForUser(userId: string): Promise<number> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return 0;
  }

  const database = requireDb();
  const documentRef = doc(database, "userGameHistory", normalizedUserId);

  await setDoc(
    documentRef,
    {
      games: [],
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return 0;
}

export async function getBotSessionPayloadForUser(userId: string): Promise<string | null> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return null;
  }

  const database = requireDb();
  const documentRef = doc(database, "userBotSessions", normalizedUserId);
  const snapshot = await getDoc(documentRef);
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeBotSessionPayload(snapshot.data().payloadJson);
}

export async function saveBotSessionPayloadForUser(userId: string, payloadJson: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return;
  }

  const normalizedPayload = normalizeBotSessionPayload(payloadJson);
  if (!normalizedPayload) {
    throw new Error("Invalid bot session payload.");
  }

  const database = requireDb();
  const documentRef = doc(database, "userBotSessions", normalizedUserId);
  await setDoc(
    documentRef,
    {
      payloadJson: normalizedPayload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearBotSessionPayloadForUser(userId: string): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return;
  }

  const database = requireDb();
  const documentRef = doc(database, "userBotSessions", normalizedUserId);
  await deleteDoc(documentRef);
}

async function assignUniqueFriendId(database: Firestore, userId: string): Promise<string> {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = generateRandomFriendId();
    const indexRef = doc(database, "userFriendIdIndex", candidate);
    const indexSnapshot = await getDoc(indexRef);
    const existingUserId = normalizeUserId(indexSnapshot.data()?.userId);

    if (existingUserId && existingUserId !== userId) {
      continue;
    }

    await setDoc(
      indexRef,
      {
        userId,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return candidate;
  }

  throw new Error("Could not generate a unique 5-digit Friend ID.");
}

async function resolveUserProfileByLookup(database: Firestore, lookup: string): Promise<PublicUserProfile | null> {
  const normalizedLookup = lookup.trim();
  if (!normalizedLookup) {
    return null;
  }

  const normalizedFriendId = normalizeFriendId(normalizedLookup);
  if (normalizedFriendId) {
    const indexRef = doc(database, "userFriendIdIndex", normalizedFriendId);
    const indexSnapshot = await getDoc(indexRef);
    const indexedUserId = normalizeUserId(indexSnapshot.data()?.userId);
    if (indexedUserId) {
      const profileRef = doc(database, "userProfiles", indexedUserId);
      const profileSnapshot = await getDoc(profileRef);
      if (profileSnapshot.exists()) {
        return normalizePublicUserProfile(indexedUserId, profileSnapshot.data());
      }
    }
  }

  if (isNumericFriendLookup(normalizedLookup)) {
    return null;
  }

  const normalizedNameKey = normalizeDisplayNameKey(normalizedLookup);
  if (!normalizedNameKey) {
    return null;
  }

  const nameIndexRef = doc(database, "userDisplayNameIndex", normalizedNameKey);
  const nameIndexSnapshot = await getDoc(nameIndexRef);
  const indexedNameUserId = normalizeUserId(nameIndexSnapshot.data()?.userId);
  if (indexedNameUserId) {
    const profileRef = doc(database, "userProfiles", indexedNameUserId);
    const profileSnapshot = await getDoc(profileRef);
    if (profileSnapshot.exists()) {
      return normalizePublicUserProfile(indexedNameUserId, profileSnapshot.data());
    }
  }

  const profilesRef = collection(database, "userProfiles");
  const profileQuery = query(profilesRef, where("displayNameKey", "==", normalizedNameKey), limit(1));
  const profileResults = await getDocs(profileQuery);
  const firstResult = profileResults.docs[0];
  if (!firstResult) {
    return null;
  }

  return normalizePublicUserProfile(firstResult.id, firstResult.data());
}

export async function syncUserProfile(user: User, displayName: string): Promise<PublicUserProfile> {
  const userId = normalizeUserId(user.uid);
  if (!userId) {
    throw new Error("Invalid authenticated user ID.");
  }

  const database = requireDb();
  const profileRef = doc(database, "userProfiles", userId);
  const preferredDisplayName = normalizeInitialUsername(displayName);
  const profileSnapshot = await getDoc(profileRef);
  const existingProfile = profileSnapshot.exists()
    ? normalizePublicUserProfile(userId, profileSnapshot.data())
    : null;

  const friendId = existingProfile?.friendId || await assignUniqueFriendId(database, userId);
  const usernameChangeCount = existingProfile?.usernameChangeCount ?? 0;
  const normalizedDisplayName = existingProfile?.displayName
    || await resolveUniqueUsername(database, userId, preferredDisplayName);

  await setDoc(
    profileRef,
    {
      userId,
      friendId,
      displayName: normalizedDisplayName,
      displayNameKey: normalizeDisplayNameKey(normalizedDisplayName),
      email: normalizeEmail(user.email),
      usernameChangeCount,
      hasChangedUsername: usernameChangeCount >= 1,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(database, "userFriendIdIndex", friendId),
    {
      userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await upsertUsernameIndex(database, userId, normalizedDisplayName);

  return {
    userId,
    friendId,
    displayName: normalizedDisplayName,
    email: normalizeEmail(user.email),
    usernameChangeCount,
  };
}

export async function renameUserProfile(user: User, nextUsername: string): Promise<PublicUserProfile> {
  const userId = normalizeUserId(user.uid);
  if (!userId) {
    throw new Error("Invalid authenticated user ID.");
  }

  const database = requireDb();
  const requestedUsername = assertValidUsernameInput(nextUsername);
  const requestedUsernameKey = normalizeDisplayNameKey(requestedUsername);

  const profileRef = doc(database, "userProfiles", userId);
  const [profileSnapshot, usernameIndexSnapshot] = await Promise.all([
    getDoc(profileRef),
    getDoc(doc(database, "userDisplayNameIndex", requestedUsernameKey)),
  ]);

  if (!profileSnapshot.exists()) {
    throw new Error("Your profile is not ready yet. Please sign out and sign in again.");
  }

  const profile = normalizePublicUserProfile(userId, profileSnapshot.data());
  if (!profile) {
    throw new Error("Could not read player profile data.");
  }

  if (profile.usernameChangeCount >= 1) {
    throw new Error("Username can only be changed once per account.");
  }

  if (profile.displayName === requestedUsername) {
    throw new Error("Choose a different username.");
  }

  const indexedUserId = normalizeUserId(usernameIndexSnapshot.data()?.userId);
  if (indexedUserId && indexedUserId !== userId) {
    throw new Error("Username already taken.");
  }

  const previousDisplayName = profile.displayName;
  const nextCount = profile.usernameChangeCount + 1;
  const nextEmail = normalizeEmail(user.email);

  await setDoc(
    profileRef,
    {
      userId,
      displayName: requestedUsername,
      displayNameKey: requestedUsernameKey,
      email: nextEmail,
      usernameChangeCount: nextCount,
      hasChangedUsername: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await upsertUsernameIndex(database, userId, requestedUsername);

  const previousKey = normalizeDisplayNameKey(previousDisplayName);
  if (previousKey && previousKey !== requestedUsernameKey) {
    const previousIndexRef = doc(database, "userDisplayNameIndex", previousKey);
    const previousIndexSnapshot = await getDoc(previousIndexRef);
    const previousIndexOwner = normalizeUserId(previousIndexSnapshot.data()?.userId);
    if (previousIndexOwner === userId) {
      await deleteDoc(previousIndexRef);
    }
  }

  const updatedProfile: PublicUserProfile = {
    userId,
    friendId: profile.friendId,
    displayName: requestedUsername,
    email: nextEmail,
    usernameChangeCount: nextCount,
  };

  await propagateProfileRename(database, updatedProfile, previousDisplayName);

  return updatedProfile;
}

export async function getPublicUserProfile(userId: string): Promise<PublicUserProfile | null> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return null;
  }

  const database = requireDb();
  const profileRef = doc(database, "userProfiles", normalizedUserId);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) {
    return null;
  }

  return normalizePublicUserProfile(normalizedUserId, snapshot.data());
}

export async function getFriendListForUser(userId: string): Promise<FriendListEntry[]> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return [];
  }

  const database = requireDb();
  const friendsRef = doc(database, "userFriends", normalizedUserId);
  const snapshot = await getDoc(friendsRef);
  if (!snapshot.exists()) {
    return [];
  }

  return normalizeFriendList(snapshot.data().friends);
}

async function addFriendshipBetweenUsers(
  database: Firestore,
  ownerProfile: PublicUserProfile,
  targetProfile: PublicUserProfile,
): Promise<FriendListEntry> {
  const ownerFriendsRef = doc(database, "userFriends", ownerProfile.userId);
  const targetFriendsRef = doc(database, "userFriends", targetProfile.userId);

  const [ownerFriendsSnapshot, targetFriendsSnapshot] = await Promise.all([
    getDoc(ownerFriendsRef),
    getDoc(targetFriendsRef),
  ]);

  const ownerFriends = ownerFriendsSnapshot.exists()
    ? normalizeFriendList(ownerFriendsSnapshot.data().friends)
    : [];
  const targetFriends = targetFriendsSnapshot.exists()
    ? normalizeFriendList(targetFriendsSnapshot.data().friends)
    : [];

  const ownerEntry: FriendListEntry = {
    userId: targetProfile.userId,
    friendId: targetProfile.friendId,
    displayName: targetProfile.displayName,
    email: targetProfile.email,
  };

  const reciprocalEntry: FriendListEntry = {
    userId: ownerProfile.userId,
    friendId: ownerProfile.friendId,
    displayName: ownerProfile.displayName,
    email: ownerProfile.email,
  };

  const updatedOwnerFriends = upsertFriendEntry(ownerFriends, ownerEntry);
  const updatedTargetFriends = upsertFriendEntry(targetFriends, reciprocalEntry);

  await Promise.all([
    setDoc(
      ownerFriendsRef,
      {
        userId: ownerProfile.userId,
        friends: serializeFriendList(updatedOwnerFriends),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      targetFriendsRef,
      {
        userId: targetProfile.userId,
        friends: serializeFriendList(updatedTargetFriends),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);

  return ownerEntry;
}

export async function getIncomingFriendRequestsForUser(userId: string): Promise<FriendRequestEntry[]> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return [];
  }

  const database = requireDb();
  const requestsRef = doc(database, "userFriendRequests", normalizedUserId);
  const snapshot = await getDoc(requestsRef);
  if (!snapshot.exists()) {
    return [];
  }

  return normalizeFriendRequestList(snapshot.data().incoming)
    .filter((request) => request.toUserId === normalizedUserId);
}

export async function getOutgoingFriendRequestsForUser(userId: string): Promise<FriendRequestEntry[]> {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return [];
  }

  const database = requireDb();
  const requestsRef = doc(database, "userFriendRequests", normalizedUserId);
  const snapshot = await getDoc(requestsRef);
  if (!snapshot.exists()) {
    return [];
  }

  return normalizeFriendRequestList(snapshot.data().outgoing)
    .filter((request) => request.fromUserId === normalizedUserId);
}

export async function sendFriendRequestToUserId(userId: string, toUserId: string): Promise<FriendRequestEntry> {
  const senderId = normalizeUserId(userId);
  const recipientId = normalizeUserId(toUserId);

  if (!senderId || !recipientId) {
    throw new Error("Invalid sender or recipient account.");
  }

  if (senderId === recipientId) {
    throw new Error("You cannot send a friend request to yourself.");
  }

  const database = requireDb();
  const senderProfileRef = doc(database, "userProfiles", senderId);
  const recipientProfileRef = doc(database, "userProfiles", recipientId);
  const senderFriendsRef = doc(database, "userFriends", senderId);
  const senderRequestsRef = doc(database, "userFriendRequests", senderId);
  const recipientRequestsRef = doc(database, "userFriendRequests", recipientId);

  const [
    senderProfileSnapshot,
    recipientProfileSnapshot,
    senderFriendsSnapshot,
    senderRequestsSnapshot,
    recipientRequestsSnapshot,
  ] = await Promise.all([
    getDoc(senderProfileRef),
    getDoc(recipientProfileRef),
    getDoc(senderFriendsRef),
    getDoc(senderRequestsRef),
    getDoc(recipientRequestsRef),
  ]);

  if (!senderProfileSnapshot.exists()) {
    throw new Error("Your profile is not ready yet. Please sign out and sign in again.");
  }

  if (!recipientProfileSnapshot.exists()) {
    throw new Error("No player found with that username or Friend ID.");
  }

  const senderProfile = normalizePublicUserProfile(senderId, senderProfileSnapshot.data());
  const recipientProfile = normalizePublicUserProfile(recipientId, recipientProfileSnapshot.data());
  if (!senderProfile || !recipientProfile) {
    throw new Error("Could not read player profile data.");
  }

  const senderFriends = senderFriendsSnapshot.exists()
    ? normalizeFriendList(senderFriendsSnapshot.data().friends)
    : [];
  if (senderFriends.some((friend) => friend.userId === recipientId)) {
    throw new Error("This player is already in your friends list.");
  }

  const senderOutgoing = senderRequestsSnapshot.exists()
    ? normalizeFriendRequestList(senderRequestsSnapshot.data().outgoing)
    : [];
  const senderIncoming = senderRequestsSnapshot.exists()
    ? normalizeFriendRequestList(senderRequestsSnapshot.data().incoming)
    : [];
  const recipientIncoming = recipientRequestsSnapshot.exists()
    ? normalizeFriendRequestList(recipientRequestsSnapshot.data().incoming)
    : [];

  if (senderOutgoing.some((request) => request.toUserId === recipientId)) {
    throw new Error("Friend request already sent.");
  }

  if (senderIncoming.some((request) => request.fromUserId === recipientId)) {
    throw new Error("This player already sent you a friend request. Check your notifications.");
  }

  if (recipientIncoming.some((request) => request.fromUserId === senderId)) {
    throw new Error("Friend request already sent.");
  }

  const request: FriendRequestEntry = {
    requestId: buildRequestId(),
    fromUserId: senderProfile.userId,
    fromFriendId: senderProfile.friendId,
    fromDisplayName: senderProfile.displayName,
    fromEmail: senderProfile.email,
    toUserId: recipientProfile.userId,
    toFriendId: recipientProfile.friendId,
    toDisplayName: recipientProfile.displayName,
    toEmail: recipientProfile.email,
    createdAt: new Date().toISOString(),
  };

  const nextSenderOutgoing = [request, ...senderOutgoing].slice(0, MAX_FRIEND_REQUESTS);
  const nextRecipientIncoming = [request, ...recipientIncoming].slice(0, MAX_FRIEND_REQUESTS);

  await Promise.all([
    setDoc(
      senderRequestsRef,
      {
        userId: senderId,
        outgoing: serializeFriendRequestList(nextSenderOutgoing),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      recipientRequestsRef,
      {
        userId: recipientId,
        incoming: serializeFriendRequestList(nextRecipientIncoming),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);

  return request;
}

export async function sendFriendRequestByLookup(userId: string, friendLookup: string): Promise<FriendRequestEntry> {
  const senderId = normalizeUserId(userId);
  const normalizedLookup = friendLookup.trim();

  if (!senderId || !normalizedLookup) {
    throw new Error("Enter a username or Friend ID.");
  }

  const database = requireDb();
  const targetProfile = await resolveUserProfileByLookup(database, normalizedLookup);
  if (!targetProfile) {
    throw new Error("No player found with that username or Friend ID.");
  }

  return sendFriendRequestToUserId(senderId, targetProfile.userId);
}

export async function respondToFriendRequest(userId: string, requestId: string, accepted: boolean): Promise<FriendRequestEntry> {
  const receiverId = normalizeUserId(userId);
  const normalizedRequestId = normalizeUserId(requestId);

  if (!receiverId || !normalizedRequestId) {
    throw new Error("Invalid friend request response.");
  }

  const database = requireDb();
  const receiverRequestsRef = doc(database, "userFriendRequests", receiverId);
  const receiverRequestsSnapshot = await getDoc(receiverRequestsRef);
  const receiverIncoming = receiverRequestsSnapshot.exists()
    ? normalizeFriendRequestList(receiverRequestsSnapshot.data().incoming)
    : [];

  const request = receiverIncoming.find((entry) => entry.requestId === normalizedRequestId);
  if (!request) {
    throw new Error("Friend request has expired.");
  }

  if (request.toUserId !== receiverId) {
    throw new Error("Friend request does not match this account.");
  }

  const senderId = request.fromUserId;
  const senderRequestsRef = doc(database, "userFriendRequests", senderId);
  const senderProfileRef = doc(database, "userProfiles", senderId);
  const receiverProfileRef = doc(database, "userProfiles", receiverId);
  const senderFriendsRef = doc(database, "userFriends", senderId);
  const receiverFriendsRef = doc(database, "userFriends", receiverId);

  const [
    senderRequestsSnapshot,
    senderProfileSnapshot,
    receiverProfileSnapshot,
    senderFriendsSnapshot,
    receiverFriendsSnapshot,
  ] = await Promise.all([
    getDoc(senderRequestsRef),
    getDoc(senderProfileRef),
    getDoc(receiverProfileRef),
    getDoc(senderFriendsRef),
    getDoc(receiverFriendsRef),
  ]);

  const senderOutgoing = senderRequestsSnapshot.exists()
    ? normalizeFriendRequestList(senderRequestsSnapshot.data().outgoing)
    : [];

  const nextReceiverIncoming = receiverIncoming.filter((entry) => entry.requestId !== normalizedRequestId);
  const nextSenderOutgoing = senderOutgoing.filter((entry) => entry.requestId !== normalizedRequestId);

  const updates: Array<Promise<unknown>> = [
    setDoc(
      receiverRequestsRef,
      {
        userId: receiverId,
        incoming: serializeFriendRequestList(nextReceiverIncoming),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      senderRequestsRef,
      {
        userId: senderId,
        outgoing: serializeFriendRequestList(nextSenderOutgoing),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ];

  if (accepted) {
    const senderProfile = senderProfileSnapshot.exists()
      ? normalizePublicUserProfile(senderId, senderProfileSnapshot.data())
      : null;
    const receiverProfile = receiverProfileSnapshot.exists()
      ? normalizePublicUserProfile(receiverId, receiverProfileSnapshot.data())
      : null;

    if (!senderProfile || !receiverProfile) {
      throw new Error("Could not read player profile data.");
    }

    const senderFriends = senderFriendsSnapshot.exists()
      ? normalizeFriendList(senderFriendsSnapshot.data().friends)
      : [];
    const receiverFriends = receiverFriendsSnapshot.exists()
      ? normalizeFriendList(receiverFriendsSnapshot.data().friends)
      : [];

    const senderEntry: FriendListEntry = {
      userId: receiverProfile.userId,
      friendId: receiverProfile.friendId,
      displayName: receiverProfile.displayName,
      email: receiverProfile.email,
    };

    const receiverEntry: FriendListEntry = {
      userId: senderProfile.userId,
      friendId: senderProfile.friendId,
      displayName: senderProfile.displayName,
      email: senderProfile.email,
    };

    const nextSenderFriends = upsertFriendEntry(senderFriends, senderEntry);
    const nextReceiverFriends = upsertFriendEntry(receiverFriends, receiverEntry);

    updates.push(
      setDoc(
        senderFriendsRef,
        {
          userId: senderId,
          friends: serializeFriendList(nextSenderFriends),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
    updates.push(
      setDoc(
        receiverFriendsRef,
        {
          userId: receiverId,
          friends: serializeFriendList(nextReceiverFriends),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
  }

  await Promise.all(updates);
  return request;
}

export async function removeFriendForUser(userId: string, friendUserId: string): Promise<void> {
  const ownerId = normalizeUserId(userId);
  const targetId = normalizeUserId(friendUserId);
  if (!ownerId || !targetId || ownerId === targetId) {
    return;
  }

  const database = requireDb();
  const ownerFriendsRef = doc(database, "userFriends", ownerId);
  const targetFriendsRef = doc(database, "userFriends", targetId);
  const ownerRequestsRef = doc(database, "userFriendRequests", ownerId);
  const targetRequestsRef = doc(database, "userFriendRequests", targetId);

  const [ownerFriendsSnapshot, targetFriendsSnapshot, ownerRequestsSnapshot, targetRequestsSnapshot] = await Promise.all([
    getDoc(ownerFriendsRef),
    getDoc(targetFriendsRef),
    getDoc(ownerRequestsRef),
    getDoc(targetRequestsRef),
  ]);

  const ownerFriends = ownerFriendsSnapshot.exists()
    ? normalizeFriendList(ownerFriendsSnapshot.data().friends)
    : [];
  const targetFriends = targetFriendsSnapshot.exists()
    ? normalizeFriendList(targetFriendsSnapshot.data().friends)
    : [];

  const nextOwnerFriends = ownerFriends.filter((entry) => entry.userId !== targetId);
  const nextTargetFriends = targetFriends.filter((entry) => entry.userId !== ownerId);

  const ownerIncoming = ownerRequestsSnapshot.exists()
    ? normalizeFriendRequestList(ownerRequestsSnapshot.data().incoming)
    : [];
  const ownerOutgoing = ownerRequestsSnapshot.exists()
    ? normalizeFriendRequestList(ownerRequestsSnapshot.data().outgoing)
    : [];
  const targetIncoming = targetRequestsSnapshot.exists()
    ? normalizeFriendRequestList(targetRequestsSnapshot.data().incoming)
    : [];
  const targetOutgoing = targetRequestsSnapshot.exists()
    ? normalizeFriendRequestList(targetRequestsSnapshot.data().outgoing)
    : [];

  const nextOwnerIncoming = removeRequestsBetweenUsers(ownerIncoming, ownerId, targetId);
  const nextOwnerOutgoing = removeRequestsBetweenUsers(ownerOutgoing, ownerId, targetId);
  const nextTargetIncoming = removeRequestsBetweenUsers(targetIncoming, ownerId, targetId);
  const nextTargetOutgoing = removeRequestsBetweenUsers(targetOutgoing, ownerId, targetId);

  await Promise.all([
    setDoc(
      ownerFriendsRef,
      {
        userId: ownerId,
        friends: serializeFriendList(nextOwnerFriends),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      targetFriendsRef,
      {
        userId: targetId,
        friends: serializeFriendList(nextTargetFriends),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      ownerRequestsRef,
      {
        userId: ownerId,
        incoming: serializeFriendRequestList(nextOwnerIncoming),
        outgoing: serializeFriendRequestList(nextOwnerOutgoing),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      targetRequestsRef,
      {
        userId: targetId,
        incoming: serializeFriendRequestList(nextTargetIncoming),
        outgoing: serializeFriendRequestList(nextTargetOutgoing),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);
}

export async function addFriendForUserByLookup(userId: string, friendLookup: string): Promise<FriendListEntry> {
  const ownerId = normalizeUserId(userId);
  const normalizedLookup = friendLookup.trim();

  if (!ownerId || !normalizedLookup) {
    throw new Error("Enter a username or Friend ID.");
  }

  const database = requireDb();
  const targetProfileFromLookup = await resolveUserProfileByLookup(database, normalizedLookup);
  if (!targetProfileFromLookup) {
    throw new Error("No player found with that username or Friend ID.");
  }

  const targetId = targetProfileFromLookup.userId;
  if (ownerId === targetId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  const ownerProfileRef = doc(database, "userProfiles", ownerId);
  const targetProfileRef = doc(database, "userProfiles", targetId);

  const [ownerProfileSnapshot, targetProfileSnapshot] = await Promise.all([
    getDoc(ownerProfileRef),
    getDoc(targetProfileRef),
  ]);

  if (!ownerProfileSnapshot.exists()) {
    throw new Error("Your profile is not ready yet. Please sign out and sign in again.");
  }

  if (!targetProfileSnapshot.exists() || !targetProfileFromLookup) {
    throw new Error("No player found with that username or Friend ID.");
  }

  const ownerProfile = normalizePublicUserProfile(ownerId, ownerProfileSnapshot.data());
  const targetProfile = normalizePublicUserProfile(targetId, targetProfileSnapshot.data()) ?? targetProfileFromLookup;

  if (!ownerProfile || !targetProfile) {
    throw new Error("Could not read player profile data.");
  }

  return addFriendshipBetweenUsers(database, ownerProfile, targetProfile);
}
