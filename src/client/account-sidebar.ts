import type { User } from "firebase/auth";
import { Chess } from "chess.js";

import {
  addFriendForUserByLookup,
  deleteStoredGameForUser,
  FriendListEntry,
  formatGoogleAuthError,
  getFirebaseAuthDisabledReason,
  getFriendListForUser,
  getPublicUserProfile,
  getStoredGameCount,
  getStoredGameHistory,
  initializeFirebaseClient,
  isFirebaseAuthEnabled,
  listenToAuthState,
  SavedGameHistoryEntry,
  saveGamePgnForUser,
  signInWithGoogle,
  signOutCurrentUser,
  syncUserProfile,
} from "./firebase";

type SocketLike = {
  connected: boolean;
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, listener: (payload?: unknown) => void) => void;
  off: (event: string, listener: (payload?: unknown) => void) => void;
};

type FriendPresenceStatus = "online" | "in-room" | "offline";

type SidebarFriendEntry = FriendListEntry & {
  status: FriendPresenceStatus;
  presenceRoomId: string | null;
  canSpectate: boolean;
};

export type FriendInviteCandidate = {
  userId: string;
  displayName: string;
  email: string | null;
  status: FriendPresenceStatus;
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
  friendsToggleButton: HTMLButtonElement;
  friendsComposer: HTMLDivElement;
  friendPlayerId: HTMLParagraphElement;
  copyPlayerIdButton: HTMLButtonElement;
  friendIdInput: HTMLInputElement;
  addFriendButton: HTMLButtonElement;
  friendsStatus: HTMLParagraphElement;
  friendsList: HTMLDivElement;
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
  openSidebarToFriends: () => void;
  getInviteCandidates: () => FriendInviteCandidate[];
  canSendRoomInvites: () => boolean;
  sendInviteToFriend: (userId: string) => boolean;
  addFriendByLookup: (lookup: string) => Promise<boolean>;
  normalizeUsername: (value: string) => string;
  resetFinishedGameTracking: () => void;
  handleFinishedGamePersist: (input: PersistFinishedGameInput) => Promise<void>;
};

const USERNAME_STORAGE_PREFIX = "chess-custom-username:"; // prefix for localStorage keys where custom usernames are stored, namespaced by user ID
const MOBILE_BREAKPOINT_PX = 640;
const MOBILE_SCROLL_LOCK_CLASS = "sidebar-open-mobile";
const FRIEND_NUMERIC_ID_LENGTH = 5;
const ROOM_ID_PATTERN = /^\d{4}$/;

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
  let importComposerOpen = false;
  let importBusy = false;
  let savedGamesTouchStartY: number | null = null;

  let friends: SidebarFriendEntry[] = [];
  let friendsLoading = false;
  let addFriendBusy = false;
  let friendsComposerOpen = false;
  let currentFriendId: string | null = null;
  let currentRoomId: string | null = null;

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

  const onFriendsToggleClick = (): void => {
    setFriendsComposerOpen(!friendsComposerOpen);
  };

  const onFriendsComposerTransitionEnd = (event: TransitionEvent): void => {
    if (event.propertyName !== "max-height" || !friendsComposerOpen) {
      return;
    }

    refs.friendsComposer.style.maxHeight = "none";
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
    if (authenticatedUser && isFirebaseAuthEnabled()) {
      void syncUserProfile(authenticatedUser, normalized);
    }
    renderAuthPanel();
    onIdentityUpdated();
    showToast("Username updated.");
  };

  const onFriendIdInput = (): void => {
    if (friendsComposerOpen && refs.friendsComposer.style.maxHeight !== "none") {
      refs.friendsComposer.style.maxHeight = `${refs.friendsComposer.scrollHeight}px`;
    }
    renderFriendsPanel();
  };

  const onCopyPlayerIdClick = async (): Promise<void> => {
    if (!authenticatedUser) {
      showToast("Sign in to get your Friend ID.");
      return;
    }

    if (!currentFriendId) {
      showToast("Your Friend ID is still being generated. Try again in a moment.");
      return;
    }

    try {
      await navigator.clipboard.writeText(currentFriendId);
      showToast("Friend ID copied.");
    } catch {
      showToast("Could not copy Friend ID.");
    }
  };

  const onAddFriendClick = async (): Promise<void> => {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      showToast("Sign in to add friends.");
      return;
    }

    const lookupQuery = normalizeFriendLookupQuery(refs.friendIdInput.value);
    if (!lookupQuery || lookupQuery.length < 2) {
      showToast("Enter a username or 5-digit Friend ID.");
      return;
    }

    if (isNumericFriendLookup(lookupQuery) && lookupQuery.length !== FRIEND_NUMERIC_ID_LENGTH) {
      showToast("Friend ID must be exactly 5 digits.");
      return;
    }

    const added = await addFriendByLookup(lookupQuery);
    if (added) {
      refs.friendIdInput.value = "";
      renderFriendsPanel();
    }
  };

  async function addFriendByLookup(lookup: string): Promise<boolean> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      showToast("Sign in to add friends.");
      return false;
    }

    if (addFriendBusy) {
      return false;
    }

    const lookupQuery = normalizeFriendLookupQuery(lookup);
    if (!lookupQuery) {
      return false;
    }

    addFriendBusy = true;
    renderFriendsPanel();

    try {
      await addFriendForUserByLookup(authenticatedUser.uid, lookupQuery);
      showToast("Friend added.");
      await refreshFriendsPanel();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not find that friend by username or ID.";
      showToast(message);
      return false;
    } finally {
      addFriendBusy = false;
      renderFriendsPanel();
    }
  }

  const onFriendsPresence = (payload?: unknown): void => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const records = (payload as { friends?: unknown }).friends;
    if (!Array.isArray(records)) {
      return;
    }

    const presenceById = new Map<string, {
      status: FriendPresenceStatus;
      roomId: string | null;
      canSpectate: boolean;
    }>();
    for (const item of records) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const record = item as { userId?: unknown; status?: unknown; roomId?: unknown; canSpectate?: unknown };
      const userId = normalizeSocketUserId(record.userId);
      const status = normalizePresenceStatus(record.status);
      const roomId = normalizeRoomId(record.roomId);
      const canSpectate = record.canSpectate === true;
      if (!userId) {
        continue;
      }

      presenceById.set(userId, { status, roomId, canSpectate });
    }

    friends = friends.map((entry) => {
      const presence = presenceById.get(entry.userId);
      return {
        ...entry,
        status: presence?.status ?? "offline",
        presenceRoomId: presence?.roomId ?? null,
        canSpectate: presence?.canSpectate ?? false,
      };
    });
    renderFriendsPanel();
  };

  const onSessionJoined = (payload?: unknown): void => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const roomId = normalizeRoomId((payload as { roomId?: unknown }).roomId);
    currentRoomId = roomId;
    renderFriendsPanel();
  };

  const onSessionLeft = (): void => {
    if (currentRoomId === null) {
      return;
    }

    currentRoomId = null;
    renderFriendsPanel();
  };

  const onFriendInviteSent = (payload?: unknown): void => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const delivery = (payload as { delivery?: unknown }).delivery;
    if (delivery === "email") {
      showToast("Friend offline: invitation email sent.");
      return;
    }

    if (delivery === "realtime") {
      showToast("Live invitation sent.");
    }
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

  function normalizeSocketUserId(value: unknown): string {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim();
  }

  function normalizeFriendLookupQuery(value: unknown): string {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim().replace(/\s+/g, " ");
  }

  function isNumericFriendLookup(value: string): boolean {
    return /^\d+$/.test(value.trim());
  }

  function normalizePresenceStatus(value: unknown): FriendPresenceStatus {
    if (value === "online" || value === "in-room") {
      return value;
    }

    return "offline";
  }

  function normalizeRoomId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return ROOM_ID_PATTERN.test(normalized) ? normalized : null;
  }

  function setFriendsComposerOpen(nextOpen: boolean, shouldAnimate = true): void {
    friendsComposerOpen = nextOpen;
    refs.friendsToggleButton.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    refs.friendsToggleButton.classList.toggle("expanded", nextOpen);

    const description = refs.friendsToggleButton.querySelector<HTMLElement>(".friends-toggle-description");
    const indicator = refs.friendsToggleButton.querySelector<HTMLElement>(".friends-toggle-indicator");

    if (description) {
      description.textContent = nextOpen
        ? "Add a friend by username or 5-digit Friend ID."
        : "Tap to manage friends by username or Friend ID.";
    }

    if (indicator) {
      indicator.textContent = nextOpen ? "Hide" : "Open";
    }

    if (!shouldAnimate) {
      refs.friendsComposer.style.maxHeight = nextOpen ? "none" : "0px";
      return;
    }

    if (nextOpen) {
      refs.friendsComposer.style.maxHeight = "0px";
      requestAnimationFrame(() => {
        refs.friendsComposer.style.maxHeight = `${refs.friendsComposer.scrollHeight}px`;
      });
      window.setTimeout(() => refs.friendIdInput.focus(), 160);
      return;
    }

    if (refs.friendsComposer.style.maxHeight === "none") {
      refs.friendsComposer.style.maxHeight = `${refs.friendsComposer.scrollHeight}px`;
    }

    refs.friendsComposer.style.maxHeight = `${refs.friendsComposer.scrollHeight}px`;
    requestAnimationFrame(() => {
      refs.friendsComposer.style.maxHeight = "0px";
    });
  }

  async function refreshCurrentFriendId(): Promise<void> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      currentFriendId = null;
      renderFriendsPanel();
      return;
    }

    try {
      const profile = await getPublicUserProfile(authenticatedUser.uid);
      currentFriendId = profile?.friendId || null;
    } catch {
      currentFriendId = null;
    }

    renderFriendsPanel();
    emitCurrentProfileName();
  }

  function syncFriendPresenceWatch(): void {
    if (!authenticatedUser || !socket.connected) {
      socket.emit("friends:watch", { friendIds: [] });
      return;
    }

    const friendIds = friends.map((entry) => entry.userId);
    socket.emit("friends:watch", { friendIds });
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

    socket.emit("profile:setName", {
      name: getCurrentPlayerName(),
      userId: authenticatedUser?.uid ?? null,
      email: authenticatedUser?.email ?? null,
      friendId: currentFriendId,
    });

    syncFriendPresenceWatch();
  }

  function getPresenceLabel(status: FriendPresenceStatus): string {
    if (status === "in-room") {
      return "In Room";
    }

    if (status === "online") {
      return "Online";
    }

    return "Offline";
  }

  function getInviteCandidates(): FriendInviteCandidate[] {
    const byStatusPriority: Record<FriendPresenceStatus, number> = {
      "in-room": 0,
      online: 1,
      offline: 2,
    };

    return [...friends]
      .sort((left, right) => {
        const priorityDiff = byStatusPriority[left.status] - byStatusPriority[right.status];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return left.displayName.localeCompare(right.displayName);
      })
      .map((entry) => ({
        userId: entry.userId,
        displayName: entry.displayName,
        email: entry.email,
        status: entry.status,
      }));
  }

  function canSendRoomInvites(): boolean {
    return Boolean(currentRoomId);
  }

  function sendInviteToFriend(userId: string): boolean {
    const normalizedUserId = normalizeSocketUserId(userId);
    if (!normalizedUserId) {
      showToast("Select a valid friend first.");
      return false;
    }

    const friend = friends.find((entry) => entry.userId === normalizedUserId);
    if (!friend) {
      showToast("Friend not found in your list.");
      return false;
    }

    if (!socket.connected) {
      showToast("Reconnect before sending invites.");
      return false;
    }

    if (!currentRoomId) {
      showToast("Create or join a room before sending invites.");
      return false;
    }

    socket.emit("friends:invite:send", {
      toUserId: friend.userId,
      toEmail: friend.email,
    });

    return true;
  }

  function openSidebarToFriends(): void {
    setActiveSidebarTab("profile");
    setSidebarOpen(true);

    window.requestAnimationFrame(() => {
      refs.friendsList.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    });
  }

  function renderFriendItem(entry: SidebarFriendEntry): HTMLElement {
    const item = document.createElement("article");
    item.className = "friend-item";

    const identity = document.createElement("div");
    identity.className = "friend-identity";

    const title = document.createElement("strong");
    title.textContent = entry.displayName;

    const idLine = document.createElement("p");
    idLine.className = "friend-id-line";
    idLine.textContent = `Friend ID: ${entry.friendId ?? "Unavailable"}`;

    const status = document.createElement("span");
    status.className = `friend-status friend-status--${entry.status}`;
    status.textContent = getPresenceLabel(entry.status);

    identity.appendChild(title);
    identity.appendChild(idLine);
    identity.appendChild(status);

    item.appendChild(identity);

    const actions = document.createElement("div");
    actions.className = "friend-actions";

    if (currentRoomId) {
      const inviteButton = document.createElement("button");
      inviteButton.type = "button";
      inviteButton.className = "chip friend-invite-button";
      inviteButton.disabled = !socket.connected;
      inviteButton.textContent = entry.status === "offline" ? "Send Gmail Invite" : "Invite";
      inviteButton.addEventListener("click", () => {
        sendInviteToFriend(entry.userId);
      });
      actions.appendChild(inviteButton);
    }

    if (entry.canSpectate && entry.presenceRoomId && entry.presenceRoomId !== currentRoomId) {
      const spectateButton = document.createElement("button");
      spectateButton.type = "button";
      spectateButton.className = "action friend-spectate-button";
      spectateButton.disabled = !socket.connected;
      spectateButton.textContent = "Spectate";
      spectateButton.addEventListener("click", () => {
        if (!entry.presenceRoomId) {
          return;
        }

        socket.emit("room:join", { roomId: entry.presenceRoomId });
        setSidebarOpen(false);
        showToast(`Joining ${entry.displayName}'s game as spectator...`);
      });
      actions.appendChild(spectateButton);
    }

    if (actions.childElementCount > 0) {
      item.appendChild(actions);
    }

    return item;
  }

  function renderFriendsPanel(): void {
    const canUseFriends = Boolean(authenticatedUser && isFirebaseAuthEnabled());
    const lookupValue = normalizeFriendLookupQuery(refs.friendIdInput.value);
    const numericLookup = isNumericFriendLookup(lookupValue);

    refs.friendPlayerId.textContent = currentFriendId ?? (authenticatedUser ? "Generating..." : "Sign in to reveal your Friend ID");
    refs.copyPlayerIdButton.disabled = !authenticatedUser || !currentFriendId;
    refs.friendIdInput.disabled = !canUseFriends || addFriendBusy;

    const hasValidLookup =
      lookupValue.length >= 2
      && (!numericLookup || lookupValue.length === FRIEND_NUMERIC_ID_LENGTH);

    refs.addFriendButton.disabled = !canUseFriends || addFriendBusy || !hasValidLookup;
    refs.addFriendButton.textContent = addFriendBusy ? "Adding..." : "Add";
    refs.friendsList.innerHTML = "";

    if (!authenticatedUser) {
      refs.friendsStatus.textContent = "Sign in to add friends by username or 5-digit Friend ID.";
      return;
    }

    if (!isFirebaseAuthEnabled()) {
      refs.friendsStatus.textContent = "Friends unavailable because Firebase is not configured.";
      return;
    }

    if (friendsLoading) {
      refs.friendsStatus.textContent = "Loading friends...";
      return;
    }

    if (friends.length === 0) {
      refs.friendsStatus.textContent = "No friends yet. Add one using username or Friend ID.";
      return;
    }

    refs.friendsStatus.textContent = `Friends: ${friends.length}`;
    for (const friend of friends) {
      refs.friendsList.appendChild(renderFriendItem(friend));
    }

    if (friendsComposerOpen && refs.friendsComposer.style.maxHeight !== "none") {
      refs.friendsComposer.style.maxHeight = `${refs.friendsComposer.scrollHeight}px`;
    }
  }

  async function refreshFriendsPanel(): Promise<void> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      friends = [];
      friendsLoading = false;
      renderFriendsPanel();
      syncFriendPresenceWatch();
      return;
    }

    friendsLoading = true;
    renderFriendsPanel();

    try {
      const loadedFriends = await getFriendListForUser(authenticatedUser.uid);
      friends = loadedFriends.map((entry) => ({
        ...entry,
        status: "offline",
        presenceRoomId: null,
        canSpectate: false,
      }));
    } catch {
      friends = [];
      showToast("Could not load friends list.");
    } finally {
      friendsLoading = false;
      renderFriendsPanel();
      syncFriendPresenceWatch();
    }
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

  function isMobileViewport(): boolean {
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches;
  }

  const onSavedGamesTouchStart = (event: TouchEvent): void => {
    if (!sidebarOpen || !isMobileViewport() || event.touches.length !== 1) {
      return;
    }

    savedGamesTouchStartY = event.touches[0]?.clientY ?? null;
  };

  const onSavedGamesTouchMove = (event: TouchEvent): void => {
    if (!sidebarOpen || !isMobileViewport() || event.touches.length !== 1) {
      return;
    }

    const currentY = event.touches[0]?.clientY;
    if (typeof currentY !== "number") {
      return;
    }

    const scrollContainer = refs.savedGamesList;
    const previousY = savedGamesTouchStartY ?? currentY;
    const deltaY = currentY - previousY;
    const atTop = scrollContainer.scrollTop <= 0;
    const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 1;
    const cannotScroll = scrollContainer.scrollHeight <= scrollContainer.clientHeight;

    savedGamesTouchStartY = currentY;

    if (cannotScroll || (atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
      event.preventDefault();
    }

    event.stopPropagation();
  };

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
      importComposerOpen = false;
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

  function autoResizeImportInput(textarea: HTMLTextAreaElement): void {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function appendImportCard(): void {
    const card = document.createElement("article");
    card.className = "saved-game-import-placeholder";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "saved-game-import-toggle";

    const toggleCopy = document.createElement("div");
    toggleCopy.className = "saved-game-import-toggle-copy";

    const title = document.createElement("h3");
    title.textContent = "Import External PGN";

    const description = document.createElement("p");
    description.className = "saved-game-import-description";

    const toggleIndicator = document.createElement("span");
    toggleIndicator.className = "saved-game-import-toggle-indicator";
    toggleIndicator.setAttribute("aria-hidden", "true");

    toggleCopy.appendChild(title);
    toggleCopy.appendChild(description);
    toggleButton.appendChild(toggleCopy);
    toggleButton.appendChild(toggleIndicator);

    const composer = document.createElement("div");
    composer.className = "saved-game-import-composer";

    const input = document.createElement("textarea");
    input.className = "saved-game-import-input";
    input.rows = 1;
    input.placeholder = "Example: https://www.chess.com/game/live/123456789 or full PGN text";
    input.value = importSourceDraft;
    input.addEventListener("input", () => {
      importSourceDraft = input.value;
      autoResizeImportInput(input);
      if (importComposerOpen) {
        composer.style.maxHeight = `${composer.scrollHeight}px`;
      }
    });
    input.addEventListener("touchmove", (event) => {
      if (!sidebarOpen || !isMobileViewport()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

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
      : "Guest imports open in analysis immediately and are not saved to cloud.";

    const syncImportComposerUi = (nextOpen: boolean, shouldAnimate = true): void => {
      importComposerOpen = nextOpen;
      toggleButton.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      description.textContent = nextOpen
        ? "Paste a PGN or game URL for instant analysis."
        : "Paste a PGN or game URL from Chess.com, Lichess, or any valid source.";
      toggleIndicator.textContent = nextOpen ? "Hide" : "Open";

      if (!shouldAnimate) {
        card.classList.toggle("expanded", nextOpen);
        composer.style.maxHeight = nextOpen ? "none" : "0px";
        return;
      }

      if (nextOpen) {
        card.classList.add("expanded");
        autoResizeImportInput(input);
        composer.style.maxHeight = "0px";
        requestAnimationFrame(() => {
          composer.style.maxHeight = `${composer.scrollHeight}px`;
        });
        setTimeout(() => input.focus(), 160);
        return;
      }

      if (composer.style.maxHeight === "none") {
        composer.style.maxHeight = `${composer.scrollHeight}px`;
      }

      composer.style.maxHeight = `${composer.scrollHeight}px`;
      requestAnimationFrame(() => {
        card.classList.remove("expanded");
        composer.style.maxHeight = "0px";
      });
    };

    composer.addEventListener("transitionend", (event) => {
      if (event.propertyName !== "max-height" || !importComposerOpen) {
        return;
      }

      composer.style.maxHeight = "none";
    });

    controls.appendChild(importButton);
    composer.appendChild(input);
    composer.appendChild(controls);
    composer.appendChild(status);

    card.appendChild(toggleButton);
    card.appendChild(composer);
    refs.savedGamesList.appendChild(card);

    syncImportComposerUi(importComposerOpen, false);

    toggleButton.addEventListener("click", () => {
      syncImportComposerUi(!importComposerOpen);
    });
  }

  function renderSavedHistoryPanel(): void {
    refs.savedGamesList.innerHTML = "";
    appendImportCard();

    if (!authenticatedUser) {
      refs.historyPanelStatus.textContent = "Sign in to view cloud history. You can still import a PGN for analysis.";
      return;
    }

    if (!isFirebaseAuthEnabled()) {
      refs.historyPanelStatus.textContent = "Firebase is unavailable right now.";
      return;
    }

    if (historyLoading) {
      refs.historyPanelStatus.textContent = "Loading saved games...";
      return;
    }

    const sortedGames = getSortedSavedGameHistory();
    if (sortedGames.length === 0) {
      refs.historyPanelStatus.textContent = "No saved games yet. Finished games are saved automatically.";
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
      renderFriendsPanel();
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
      renderFriendsPanel();
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
      renderFriendsPanel();
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
    renderFriendsPanel();
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
    refs.friendsToggleButton.addEventListener("click", onFriendsToggleClick);
    refs.friendsComposer.addEventListener("transitionend", onFriendsComposerTransitionEnd);
    window.addEventListener("keydown", onEscapeCloseSidebar);
    window.addEventListener("resize", onViewportResize);
    refs.savedGamesList.addEventListener("touchstart", onSavedGamesTouchStart, { passive: true });
    refs.savedGamesList.addEventListener("touchmove", onSavedGamesTouchMove, { passive: false });

    refs.signInGoogleButton.addEventListener("click", onSignInGoogleClick);
    refs.usernameInput.addEventListener("input", onUsernameInput);
    refs.saveUsernameButton.addEventListener("click", onSaveUsernameClick);
    refs.friendIdInput.addEventListener("input", onFriendIdInput);
    refs.copyPlayerIdButton.addEventListener("click", onCopyPlayerIdClick);
    refs.addFriendButton.addEventListener("click", onAddFriendClick);
    refs.guestModeButton.addEventListener("click", onGuestModeClick);
    refs.signOutButton.addEventListener("click", onSignOutClick);
    socket.on("friends:presence", onFriendsPresence);
    socket.on("friends:invite:sent", onFriendInviteSent);
    socket.on("session:joined", onSessionJoined);
    socket.on("session:left", onSessionLeft);

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
    refs.friendsToggleButton.removeEventListener("click", onFriendsToggleClick);
    refs.friendsComposer.removeEventListener("transitionend", onFriendsComposerTransitionEnd);
    window.removeEventListener("keydown", onEscapeCloseSidebar);
    window.removeEventListener("resize", onViewportResize);
    refs.savedGamesList.removeEventListener("touchstart", onSavedGamesTouchStart);
    refs.savedGamesList.removeEventListener("touchmove", onSavedGamesTouchMove);

    refs.signInGoogleButton.removeEventListener("click", onSignInGoogleClick);
    refs.usernameInput.removeEventListener("input", onUsernameInput);
    refs.saveUsernameButton.removeEventListener("click", onSaveUsernameClick);
    refs.friendIdInput.removeEventListener("input", onFriendIdInput);
    refs.copyPlayerIdButton.removeEventListener("click", onCopyPlayerIdClick);
    refs.addFriendButton.removeEventListener("click", onAddFriendClick);
    refs.guestModeButton.removeEventListener("click", onGuestModeClick);
    refs.signOutButton.removeEventListener("click", onSignOutClick);
    socket.off("friends:presence", onFriendsPresence);
    socket.off("friends:invite:sent", onFriendInviteSent);
    socket.off("session:joined", onSessionJoined);
    socket.off("session:left", onSessionLeft);

    listenersWired = false;
  }

  async function initialize(): Promise<void> {
    setSidebarOpen(false);
    setActiveSidebarTab("profile");
    setFriendsComposerOpen(false, false);
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
      friends = [];
      friendsLoading = false;
      addFriendBusy = false;
      currentFriendId = null;

      editableUsername = getCurrentPlayerName();

      renderAuthPanel();
      renderSavedHistoryPanel();
      emitCurrentProfileName();
      onIdentityUpdated();

      if (user) {
        void (async () => {
          const profile = await syncUserProfile(user, getCurrentPlayerName());
          currentFriendId = profile.friendId ?? null;
          renderFriendsPanel();
          emitCurrentProfileName();
        })();
        void refreshStoredGamesCount();
        void refreshSavedHistoryPanel();
        void refreshFriendsPanel();
      } else {
        void refreshCurrentFriendId();
        void refreshFriendsPanel();
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
    openSidebarToFriends,
    getInviteCandidates,
    canSendRoomInvites,
    sendInviteToFriend,
    addFriendByLookup,
    normalizeUsername,
    resetFinishedGameTracking,
    handleFinishedGamePersist,
  };
}
