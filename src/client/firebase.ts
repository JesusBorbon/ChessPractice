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
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
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
