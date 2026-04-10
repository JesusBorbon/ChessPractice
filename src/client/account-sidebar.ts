import type { User } from "firebase/auth";
import { Chess } from "chess.js";

import {
  deleteStoredGameForUser,
  formatGoogleAuthError,
  getFirebaseAuthDisabledReason,
  getStoredGameCount,
  getStoredGameHistory,
  initializeFirebaseClient,
  isFirebaseAuthEnabled,
  listenToAuthState,
  SavedGameHistoryEntry,
  saveGamePgnForUser,
  signInWithGoogle,
  signOutCurrentUser,
} from "./firebase";

type SocketLike = {
  connected: boolean;
  emit: (event: string, payload: unknown) => void;
};

export type AccountSidebarDomRefs = { // this is for the sake of better readability and maintainability, grouping all DOM refs related to the account sidebar in a single typez
  quickIdentity: HTMLParagraphElement;
  accountMenuButton: HTMLButtonElement;
  sidebarBackdrop: HTMLDivElement;
  accountSidebar: HTMLElement;
  sidebarCloseButton: HTMLButtonElement;
  sidebarProfileTab: HTMLButtonElement;
  sidebarHistoryTab: HTMLButtonElement;
  sidebarProfilePanel: HTMLElement;
  sidebarHistoryPanel: HTMLElement;
  historyPanelStatus: HTMLParagraphElement;
  savedGamesList: HTMLDivElement;
  authStatus: HTMLParagraphElement;
  storedGamesMeta: HTMLParagraphElement;
  usernameInput: HTMLInputElement;
  saveUsernameButton: HTMLButtonElement;
  guestModeButton: HTMLButtonElement;
  signInGoogleButton: HTMLButtonElement;
  signOutButton: HTMLButtonElement;
};

type PersistFinishedGameInput = { // input for the function that handles the persistence of finished games, containing a unique signature to identify the game and its PGN data
  signature: string;
  pgn: string | null;
};

type CreateAccountSidebarControllerOptions = {
  socket: SocketLike;
  refs: AccountSidebarDomRefs;
  showToast: (message: string) => void;
  onIdentityUpdated: () => void;
  onOpenSavedGameForAnalysis?: (pgn: string) => void;
};

export type AccountSidebarController = {
  initialize: () => Promise<void>;
  dispose: () => void;
  emitCurrentProfileName: () => void;
  getCurrentPlayerName: () => string;
  normalizeUsername: (value: string) => string;
  resetFinishedGameTracking: () => void;
  handleFinishedGamePersist: (input: PersistFinishedGameInput) => Promise<void>;
};

const USERNAME_STORAGE_PREFIX = "chess-custom-username:"; // prefix for localStorage keys where custom usernames are stored, namespaced by user ID
const MOBILE_BREAKPOINT_PX = 640;
const MOBILE_SCROLL_LOCK_CLASS = "sidebar-open-mobile";

export function createAccountSidebarController({
  socket,
  refs,
  showToast,
  onIdentityUpdated,
  onOpenSavedGameForAnalysis,
}: CreateAccountSidebarControllerOptions): AccountSidebarController {
  let authenticatedUser: User | null = null;
  let authUnsubscribe: (() => void) | null = null;
  let authBusy = false;
  let authInitFinished = false;
  let storedGamesCount: number | null = null;
  let editableUsername = "";

  let sidebarOpen = false;
  let activeSidebarTab: "profile" | "history" = "profile";
  let savedGameHistory: SavedGameHistoryEntry[] = [];
  let historyLoading = false;
  let deletingGameId: string | null = null;
  let importSourceDraft = "";
  let importBusy = false;

  let savingGameSignature: string | null = null;
  let savedGameSignature: string | null = null;
  let failedGameSignature: string | null = null;

  let listenersWired = false;

  const onAccountMenuClick = (): void => {
    const nextOpen = !sidebarOpen;
    setSidebarOpen(nextOpen);
    if (nextOpen && activeSidebarTab === "history") {
      void refreshSavedHistoryPanel();
    }
  };

  const onSidebarCloseClick = (): void => {
    setSidebarOpen(false);
  };

  const onSidebarBackdropClick = (): void => {
    setSidebarOpen(false);
  };

  const onSidebarProfileTabClick = (): void => {
    setActiveSidebarTab("profile");
  };

  const onSidebarHistoryTabClick = (): void => {
    setActiveSidebarTab("history");
    void refreshSavedHistoryPanel();
  };

  const onEscapeCloseSidebar = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  const onViewportResize = (): void => {
    syncBodyScrollLock();
  };

  const onSignInGoogleClick = async (): Promise<void> => {
    if (authBusy || !isFirebaseAuthEnabled()) {
      return;
    }

    authBusy = true;
    renderAuthPanel();

    try {
      await signInWithGoogle();
    } catch (error) {
      showToast(formatGoogleAuthError(error));
    } finally {
      authBusy = false;
      renderAuthPanel();
    }
  };

  const onUsernameInput = (): void => {
    editableUsername = refs.usernameInput.value;
    renderAuthPanel();
  };

  const onSaveUsernameClick = (): void => {
    if (!authenticatedUser) {
      showToast("Only registered users can set a custom username.");
      return;
    }

    const normalized = normalizeUsername(refs.usernameInput.value);
    if (normalized.length < 2) {
      showToast("Username must be at least 2 characters.");
      return;
    }

    localStorage.setItem(usernameStorageKey(authenticatedUser.uid), normalized);
    editableUsername = normalized;
    emitCurrentProfileName();
    renderAuthPanel();
    onIdentityUpdated();
    showToast("Username updated.");
  };

  const onGuestModeClick = async (): Promise<void> => {
    if (authBusy) {
      return;
    }

    if (!authenticatedUser) {
      showToast("You are already playing as a guest.");
      return;
    }

    if (!isFirebaseAuthEnabled()) {
      showToast("Now playing as guest.");
      return;
    }

    authBusy = true;
    renderAuthPanel();

    try {
      await signOutCurrentUser();
      showToast("Switched to guest mode.");
    } catch {
      showToast("Could not switch to guest mode.");
    } finally {
      authBusy = false;
      renderAuthPanel();
    }
  };

  const onSignOutClick = async (): Promise<void> => {
    if (authBusy || !isFirebaseAuthEnabled()) {
      return;
    }

    authBusy = true;
    renderAuthPanel();

    try {
      await signOutCurrentUser();
    } catch {
      showToast("Sign-out failed.");
    } finally {
      authBusy = false;
      renderAuthPanel();
    }
  };

  function usernameStorageKey(uid: string): string {
    return `${USERNAME_STORAGE_PREFIX}${uid}`;
  }

  function normalizeUsername(value: string): string {
    return value.trim().replace(/\s+/g, " ").slice(0, 24);
  }

  function getCurrentPlayerName(): string {
    if (!authenticatedUser) {
      return "Guest";
    }

    const custom = normalizeUsername(localStorage.getItem(usernameStorageKey(authenticatedUser.uid)) ?? "");
    if (custom) {
      return custom;
    }

    const fallback = normalizeUsername(authenticatedUser.displayName ?? "");
    if (fallback) {
      return fallback;
    }

    return "Player";
  }

  function emitCurrentProfileName(): void {
    if (!socket.connected) {
      return;
    }

    socket.emit("profile:setName", { name: getCurrentPlayerName() });
  }

  function setSidebarOpen(nextOpen: boolean): void {
    sidebarOpen = nextOpen;
    refs.accountSidebar.classList.toggle("open", sidebarOpen);
    refs.sidebarBackdrop.hidden = !sidebarOpen;
    refs.accountSidebar.setAttribute("aria-hidden", sidebarOpen ? "false" : "true");
    refs.accountMenuButton.setAttribute("aria-expanded", sidebarOpen ? "true" : "false");
    syncBodyScrollLock();
  }

  function syncBodyScrollLock(): void {
    const isMobileViewport = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches;
    document.body.classList.toggle(MOBILE_SCROLL_LOCK_CLASS, sidebarOpen && isMobileViewport);
  }

  function setActiveSidebarTab(nextTab: "profile" | "history"): void {
    activeSidebarTab = nextTab;
    const showProfile = activeSidebarTab === "profile";
    refs.sidebarProfileTab.classList.toggle("active", showProfile);
    refs.sidebarHistoryTab.classList.toggle("active", !showProfile);
    refs.sidebarProfilePanel.hidden = !showProfile;
    refs.sidebarHistoryPanel.hidden = showProfile;
  }

  function getSavedGameTimestamp(savedAt: string | null): number {
    if (!savedAt) {
      return 0;
    }

    const parsed = new Date(savedAt).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function getSortedSavedGameHistory(): SavedGameHistoryEntry[] {
    return savedGameHistory
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => {
        const timestampDiff = getSavedGameTimestamp(right.entry.savedAt) - getSavedGameTimestamp(left.entry.savedAt);
        if (timestampDiff !== 0) {
          return timestampDiff;
        }

        return left.index - right.index;
      })
      .map((item) => item.entry);
  }

  function formatSavedGameDate(savedAt: string | null): string {
    if (!savedAt) {
      return "Date unavailable";
    }

    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return `Played ${date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })}`;
  }

  function openSavedGameInAnalysis(pgn: string): void {
    const normalizedPgn = pgn.trim();
    if (!normalizedPgn) {
      showToast("This saved game does not contain a valid PGN.");
      return;
    }

    if (onOpenSavedGameForAnalysis) {
      onOpenSavedGameForAnalysis(normalizedPgn);
      return;
    }

    localStorage.removeItem("postGameMoves");
    localStorage.setItem("postGamePgn", normalizedPgn);
    window.location.assign("/analyze");
  }

  async function handleDeleteSavedGame(game: SavedGameHistoryEntry): Promise<void> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      return;
    }

    if (deletingGameId) {
      return;
    }

    deletingGameId = game.id;
    renderSavedHistoryPanel();

    try {
      storedGamesCount = await deleteStoredGameForUser(authenticatedUser.uid, game.id);
      savedGameHistory = savedGameHistory.filter((entry) => entry.id !== game.id);
      showToast("Saved game deleted.");
    } catch {
      showToast("Could not delete saved game.");
    } finally {
      deletingGameId = null;
      renderAuthPanel();
      renderSavedHistoryPanel();
    }
  }

  function validateImportedPgn(pgn: string): string | null {
    const normalized = pgn.trim();
    if (!normalized) {
      return null;
    }

    const replay = new Chess();
    try {
      replay.loadPgn(normalized, { strict: false });
    } catch {
      return null;
    }

    if (replay.history().length === 0) {
      return null;
    }

    return normalized;
  }

  async function resolveImportedPgn(source: string): Promise<string | null> {
    const response = await fetch("/api/pgn-import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source }),
    });

    const payload = await response.json().catch(() => ({})) as { pgn?: unknown; error?: unknown };
    if (!response.ok) {
      const errorMessage = typeof payload.error === "string" ? payload.error : "Could not import PGN from that source.";
      throw new Error(errorMessage);
    }

    if (typeof payload.pgn !== "string") {
      throw new Error("Import source did not return a PGN.");
    }

    return validateImportedPgn(payload.pgn);
  }

  async function handleImportPgn(): Promise<void> {
    if (importBusy) {
      return;
    }

    const source = importSourceDraft.trim();
    if (!source) {
      showToast("Paste a PGN or game URL first.");
      return;
    }

    importBusy = true;
    renderSavedHistoryPanel();

    try {
      const importedPgn = await resolveImportedPgn(source);
      if (!importedPgn) {
        showToast("Source did not contain a valid PGN.");
        return;
      }

      if (authenticatedUser && isFirebaseAuthEnabled()) {
        try {
          storedGamesCount = await saveGamePgnForUser(authenticatedUser.uid, importedPgn);
          savedGameHistory = await getStoredGameHistory(authenticatedUser.uid);
          renderAuthPanel();
        } catch {
          showToast("PGN imported for analysis, but cloud history save failed.");
        }
      }

      importSourceDraft = "";
      setSidebarOpen(false);
      openSavedGameInAnalysis(importedPgn);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not import PGN from that source.";
      showToast(message);
    } finally {
      importBusy = false;
      renderSavedHistoryPanel();
    }
  }

  function appendImportCard(): void {
    const placeholderCard = document.createElement("article");
    placeholderCard.className = "saved-game-import-placeholder";

    const title = document.createElement("h3");
    title.textContent = "Import external PGN";

    const description = document.createElement("p");
    description.className = "saved-game-import-description";
    description.textContent = "Paste a PGN or game URL (Chess.com, Lichess, or any valid source).";

    const input = document.createElement("textarea");
    input.className = "saved-game-import-input";
    input.rows = 4;
    input.placeholder = "Example: https://www.chess.com/game/live/123456789 or full PGN text";
    input.value = importSourceDraft;
    input.addEventListener("input", () => {
      importSourceDraft = input.value;
    });

    const controls = document.createElement("div");
    controls.className = "saved-game-import-controls";

    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.className = "ghost saved-game-import-button";
    importButton.disabled = importBusy;
    importButton.textContent = importBusy ? "Importing..." : "Import & Analyze";
    importButton.addEventListener("click", () => {
      void handleImportPgn();
    });

    const status = document.createElement("p");
    status.className = "saved-game-import-status";
    status.textContent = authenticatedUser
      ? "Imported games are also saved to your cloud history."
      : "Guest imports open in analysis immediately (not saved to cloud).";

    placeholderCard.appendChild(title);
    placeholderCard.appendChild(description);
    placeholderCard.appendChild(input);
    controls.appendChild(importButton);
    placeholderCard.appendChild(controls);
    placeholderCard.appendChild(status);
    refs.savedGamesList.appendChild(placeholderCard);
  }

  function renderSavedHistoryPanel(): void {
    refs.savedGamesList.innerHTML = "";

    if (!authenticatedUser) {
      refs.historyPanelStatus.textContent = "Sign in to view cloud history. You can still import a PGN for analysis.";
      appendImportCard();
      return;
    }

    if (!isFirebaseAuthEnabled()) {
      refs.historyPanelStatus.textContent = "Firebase is unavailable right now.";
      appendImportCard();
      return;
    }

    if (historyLoading) {
      refs.historyPanelStatus.textContent = "Loading saved games...";
      appendImportCard();
      return;
    }

    const sortedGames = getSortedSavedGameHistory();
    if (sortedGames.length === 0) {
      refs.historyPanelStatus.textContent = "No saved games yet. Finished games are saved automatically.";
      appendImportCard();
      return;
    }

    refs.historyPanelStatus.textContent = `Showing ${sortedGames.length} saved game${sortedGames.length === 1 ? "" : "s"}. Select one to analyze.`;

    sortedGames.forEach((game, index) => {
      const deletingThisGame = deletingGameId === game.id;

      const item = document.createElement("article");
      item.className = "saved-game-item";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      if (deletingThisGame) {
        item.classList.add("deleting");
      }

      const header = document.createElement("div");
      header.className = "saved-game-header";

      const heading = document.createElement("h3");
      heading.textContent = `Game ${index + 1}`;

      const dateLabel = document.createElement("p");
      dateLabel.className = "saved-game-date";
      dateLabel.textContent = formatSavedGameDate(game.savedAt);

      const actions = document.createElement("div");
      actions.className = "saved-game-actions";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "ghost saved-game-delete-button";
      deleteButton.disabled = deletingThisGame;
      deleteButton.textContent = deletingThisGame ? "Deleting..." : "Delete";
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        void handleDeleteSavedGame(game);
      });

      const openHint = document.createElement("p");
      openHint.className = "saved-game-open-hint";
      openHint.textContent = "Tap to open in analysis";

      actions.appendChild(deleteButton);
      header.appendChild(heading);
      header.appendChild(actions);

      item.appendChild(header);
      item.appendChild(dateLabel);
      item.appendChild(openHint);

      item.addEventListener("click", () => {
        if (deletingGameId) {
          return;
        }

        setSidebarOpen(false);
        openSavedGameInAnalysis(game.pgn);
      });

      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        if (deletingGameId) {
          return;
        }

        setSidebarOpen(false);
        openSavedGameInAnalysis(game.pgn);
      });

      refs.savedGamesList.appendChild(item);
    });

    appendImportCard();
  }

  async function refreshSavedHistoryPanel(): Promise<void> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      savedGameHistory = [];
      historyLoading = false;
      renderSavedHistoryPanel();
      return;
    }

    historyLoading = true;
    renderSavedHistoryPanel();

    try {
      savedGameHistory = await getStoredGameHistory(authenticatedUser.uid);
    } catch {
      savedGameHistory = [];
      showToast("Could not load saved PGN history.");
    } finally {
      historyLoading = false;
      renderSavedHistoryPanel();
    }
  }

  function renderAuthPanel(): void {
    if (!authInitFinished) {
      refs.quickIdentity.textContent = "Loading...";
      refs.authStatus.textContent = "Loading Firebase settings...";
      refs.storedGamesMeta.textContent = "Checking Firebase authentication...";
      refs.usernameInput.hidden = true;
      refs.saveUsernameButton.hidden = true;
      refs.guestModeButton.disabled = true;
      refs.signInGoogleButton.hidden = false;
      refs.signInGoogleButton.disabled = true;
      refs.signInGoogleButton.textContent = "Loading...";
      refs.signOutButton.hidden = true;
      return;
    }

    if (!isFirebaseAuthEnabled()) {
      const reason = getFirebaseAuthDisabledReason() ?? "Missing Firebase configuration.";
      refs.quickIdentity.textContent = "Guest";
      refs.authStatus.textContent = `Playing as Guest. Firebase unavailable: ${reason}`;
      refs.storedGamesMeta.textContent = "Analysis is available, but cloud PGN history is disabled.";
      refs.usernameInput.hidden = true;
      refs.saveUsernameButton.hidden = true;
      refs.guestModeButton.disabled = false;
      refs.signInGoogleButton.hidden = false;
      refs.signInGoogleButton.disabled = true;
      refs.signInGoogleButton.textContent = "Firebase unavailable";
      refs.signOutButton.hidden = true;
      return;
    }

    if (authenticatedUser) {
      const userLabel = getCurrentPlayerName();
      refs.quickIdentity.textContent = userLabel;
      refs.authStatus.textContent = `Signed in as ${userLabel}`;
      refs.storedGamesMeta.textContent = `History enabled: ${storedGamesCount ?? "..."} / 100 PGNs`;
      refs.usernameInput.hidden = false;
      refs.saveUsernameButton.hidden = false;
      refs.usernameInput.disabled = authBusy;
      if (document.activeElement !== refs.usernameInput) {
        refs.usernameInput.value = editableUsername;
      }
      const normalizedDraft = normalizeUsername(refs.usernameInput.value);
      refs.saveUsernameButton.disabled = authBusy || normalizedDraft.length < 2 || normalizedDraft === getCurrentPlayerName();
      refs.guestModeButton.disabled = authBusy;
      refs.signInGoogleButton.hidden = true;
      refs.signOutButton.hidden = false;
      refs.signOutButton.disabled = authBusy;
      return;
    }

    refs.quickIdentity.textContent = "Guest";
    refs.authStatus.textContent = "Playing as Guest.";
    refs.storedGamesMeta.textContent = "Guests can play and analyze, but games are not saved.";
    refs.usernameInput.hidden = true;
    refs.saveUsernameButton.hidden = true;
    refs.guestModeButton.disabled = authBusy;
    refs.signInGoogleButton.hidden = false;
    refs.signInGoogleButton.disabled = authBusy;
    refs.signInGoogleButton.textContent = authBusy ? "Signing in..." : "Sign in / Sign up";
    refs.signOutButton.hidden = true;
  }

  async function refreshStoredGamesCount(): Promise<void> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      storedGamesCount = null;
      renderAuthPanel();
      return;
    }

    try {
      storedGamesCount = await getStoredGameCount(authenticatedUser.uid);
    } catch {
      storedGamesCount = null;
    }

    renderAuthPanel();
  }

  async function handleFinishedGamePersist({ signature, pgn }: PersistFinishedGameInput): Promise<void> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      return;
    }

    if (
      signature === savedGameSignature
      || signature === savingGameSignature
      || signature === failedGameSignature
    ) {
      return;
    }

    if (!pgn) {
      failedGameSignature = signature;
      return;
    }

    savingGameSignature = signature;

    try {
      storedGamesCount = await saveGamePgnForUser(authenticatedUser.uid, pgn);
      void refreshSavedHistoryPanel();
      savedGameSignature = signature;
      failedGameSignature = null;
      showToast("Game saved to your cloud PGN history.");
    } catch {
      failedGameSignature = signature;
      showToast("Could not save game to Firebase.");
    } finally {
      if (savingGameSignature === signature) {
        savingGameSignature = null;
      }
      renderAuthPanel();
    }
  }

  function resetFinishedGameTracking(): void {
    savingGameSignature = null;
    savedGameSignature = null;
    failedGameSignature = null;
  }

  function wireEventListeners(): void {
    if (listenersWired) {
      return;
    }

    refs.accountMenuButton.addEventListener("click", onAccountMenuClick);
    refs.sidebarCloseButton.addEventListener("click", onSidebarCloseClick);
    refs.sidebarBackdrop.addEventListener("click", onSidebarBackdropClick);
    refs.sidebarProfileTab.addEventListener("click", onSidebarProfileTabClick);
    refs.sidebarHistoryTab.addEventListener("click", onSidebarHistoryTabClick);
    window.addEventListener("keydown", onEscapeCloseSidebar);
    window.addEventListener("resize", onViewportResize);

    refs.signInGoogleButton.addEventListener("click", onSignInGoogleClick);
    refs.usernameInput.addEventListener("input", onUsernameInput);
    refs.saveUsernameButton.addEventListener("click", onSaveUsernameClick);
    refs.guestModeButton.addEventListener("click", onGuestModeClick);
    refs.signOutButton.addEventListener("click", onSignOutClick);

    listenersWired = true;
  }

  function unWireEventListeners(): void {
    if (!listenersWired) {
      return;
    }

    refs.accountMenuButton.removeEventListener("click", onAccountMenuClick);
    refs.sidebarCloseButton.removeEventListener("click", onSidebarCloseClick);
    refs.sidebarBackdrop.removeEventListener("click", onSidebarBackdropClick);
    refs.sidebarProfileTab.removeEventListener("click", onSidebarProfileTabClick);
    refs.sidebarHistoryTab.removeEventListener("click", onSidebarHistoryTabClick);
    window.removeEventListener("keydown", onEscapeCloseSidebar);
    window.removeEventListener("resize", onViewportResize);

    refs.signInGoogleButton.removeEventListener("click", onSignInGoogleClick);
    refs.usernameInput.removeEventListener("input", onUsernameInput);
    refs.saveUsernameButton.removeEventListener("click", onSaveUsernameClick);
    refs.guestModeButton.removeEventListener("click", onGuestModeClick);
    refs.signOutButton.removeEventListener("click", onSignOutClick);

    listenersWired = false;
  }

  async function initialize(): Promise<void> {
    setSidebarOpen(false);
    setActiveSidebarTab("profile");
    renderSavedHistoryPanel();
    wireEventListeners();

    renderAuthPanel();
    await initializeFirebaseClient();
    authInitFinished = true;
    renderAuthPanel();

    if (!isFirebaseAuthEnabled()) {
      return;
    }

    authUnsubscribe?.();
    authUnsubscribe = listenToAuthState((user) => {
      authenticatedUser = user;
      storedGamesCount = null;
      savedGameHistory = [];
      historyLoading = false;
      deletingGameId = null;

      editableUsername = getCurrentPlayerName();

      renderAuthPanel();
      renderSavedHistoryPanel();
      emitCurrentProfileName();
      onIdentityUpdated();

      if (user) {
        void refreshStoredGamesCount();
        void refreshSavedHistoryPanel();
      }
    });
  }

  function dispose(): void {
    authUnsubscribe?.();
    authUnsubscribe = null;
    unWireEventListeners();
    document.body.classList.remove(MOBILE_SCROLL_LOCK_CLASS);
  }

  return {
    initialize,
    dispose,
    emitCurrentProfileName,
    getCurrentPlayerName,
    normalizeUsername,
    resetFinishedGameTracking,
    handleFinishedGamePersist,
  };
}
