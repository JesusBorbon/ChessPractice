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
};

export type FriendListEntry = {
  userId: string;
  friendId: string;
  displayName: string;
  email: string | null;
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
const FRIEND_ID_DIGITS = 5;
const FRIEND_ID_MIN = 10_000;
const FRIEND_ID_MAX = 99_999;

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

function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 24);
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
  };
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
  const normalizedDisplayName = normalizeDisplayName(displayName) || "Player";
  const profileSnapshot = await getDoc(profileRef);
  const existingProfile = profileSnapshot.exists()
    ? normalizePublicUserProfile(userId, profileSnapshot.data())
    : null;

  const friendId = existingProfile?.friendId || await assignUniqueFriendId(database, userId);

  await setDoc(
    profileRef,
    {
      userId,
      friendId,
      displayName: normalizedDisplayName,
      displayNameKey: normalizeDisplayNameKey(normalizedDisplayName),
      email: normalizeEmail(user.email),
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

  return {
    userId,
    friendId,
    displayName: normalizedDisplayName,
    email: normalizeEmail(user.email),
  };
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
  const ownerFriendsRef = doc(database, "userFriends", ownerId);
  const targetFriendsRef = doc(database, "userFriends", targetId);

  const [ownerProfileSnapshot, targetProfileSnapshot, ownerFriendsSnapshot, targetFriendsSnapshot] = await Promise.all([
    getDoc(ownerProfileRef),
    getDoc(targetProfileRef),
    getDoc(ownerFriendsRef),
    getDoc(targetFriendsRef),
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

  const ownerFriends = ownerFriendsSnapshot.exists()
    ? normalizeFriendList(ownerFriendsSnapshot.data().friends)
    : [];
  const targetFriends = targetFriendsSnapshot.exists()
    ? normalizeFriendList(targetFriendsSnapshot.data().friends)
    : [];

  const updatedOwnerFriends = upsertFriendEntry(ownerFriends, ownerEntry);
  const updatedTargetFriends = upsertFriendEntry(targetFriends, reciprocalEntry);

  await Promise.all([
    setDoc(
      ownerFriendsRef,
      {
        userId: ownerId,
        friends: serializeFriendList(updatedOwnerFriends),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      targetFriendsRef,
      {
        userId: targetId,
        friends: serializeFriendList(updatedTargetFriends),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);

  return ownerEntry;
}
