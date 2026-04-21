import type { User } from "firebase/auth";
import { Chess } from "chess.js";

import {
  clearStoredGamesForUser,
  deleteStoredGameForUser,
  FriendListEntry,
  FriendRequestEntry,
  formatGoogleAuthError,
  getFirebaseAuthDisabledReason,
  getPublicUserProfile,
  PublicUserProfile,
  renameUserProfile,
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
import { buildMatchTitleFromPgn, formatSavedGameDateTime } from "./game-display";
import {
  getLookupRequestState,
  loadFriendSystemSnapshot,
  removeFriendConnection,
  submitFriendRequestByLookup,
} from "./friend-system";
import {
  createFriendActivityRealtimeController,
  FriendActivityState,
} from "./friend-activity-realtime";

type SocketLike = {
  connected: boolean;
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, listener: (payload?: unknown) => void) => void;
  off: (event: string, listener: (payload?: unknown) => void) => void;
};

type FriendPresenceStatus = "online" | "in-room" | "playing-bot" | "offline";
type FriendPresenceActivity = "playing-bot" | null;

type SidebarFriendEntry = FriendListEntry & {
  status: FriendPresenceStatus;
  presenceRoomId: string | null;
  canSpectate: boolean;
  canRequestJoin: boolean;
};

export type FriendInviteCandidate = {
  userId: string;
  displayName: string;
  email: string | null;
  status: FriendPresenceStatus;
};

export type MultiplayerFriendshipStatus = "friends" | "not-friends" | "unknown";

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
  emitFriendshipState: () => void;
  setFriendPresenceActivity: (activity: FriendPresenceActivity) => void;
  getCurrentPlayerName: () => string;
  getAuthenticatedUserId: () => string | null;
  isRegisteredOnlineUser: () => boolean;
  canPlayOnlineMultiplayer: () => boolean;
  getFriendshipStatusWithUser: (userId: string | null | undefined) => MultiplayerFriendshipStatus;
  openSidebarToFriends: () => void;
  getInviteCandidates: () => FriendInviteCandidate[];
  canSendRoomInvites: () => boolean;
  sendInviteToFriend: (userId: string) => boolean;
  addFriendByLookup: (lookup: string) => Promise<boolean>;
  normalizeUsername: (value: string) => string;
  resetFinishedGameTracking: () => void;
  handleFinishedGamePersist: (input: PersistFinishedGameInput) => Promise<void>;
};

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
  let currentProfile: PublicUserProfile | null = null;

  let sidebarOpen = false;
  let activeSidebarTab: "profile" | "history" = "profile";
  let savedGameHistory: SavedGameHistoryEntry[] = [];
  let historyLoading = false;
  let deletingGameId: string | null = null;
  let clearSavedGamesConfirmOpen = false;
  let clearSavedGamesBusy = false;
  let importSourceDraft = "";
  let importComposerOpen = false;
  let importBusy = false;
  let savedGamesTouchStartY: number | null = null;

  let friends: SidebarFriendEntry[] = [];
  let friendsLoading = false;
  let addFriendBusy = false;
  let friendsComposerOpen = false;
  let incomingFriendRequests: FriendRequestEntry[] = [];
  let outgoingFriendRequests: FriendRequestEntry[] = [];
  const pendingFriendRemovals = new Set<string>();
  let currentFriendId: string | null = null;
  let currentRoomId: string | null = null;
  let currentRoomRole: "w" | "b" | "spectator" | null = null;
  let friendPresenceActivity: FriendPresenceActivity = null;

  let savingGameSignature: string | null = null;
  let savedGameSignature: string | null = null;
  let failedGameSignature: string | null = null;

  let listenersWired = false;
  const friendActivityRealtime = createFriendActivityRealtimeController({ socket });
  const unsubscribeFriendActivity = friendActivityRealtime.subscribe((snapshot) => {
    applyRealtimeFriendActivity(snapshot);
  });

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

  const onSaveUsernameClick = async (): Promise<void> => {
    if (authBusy) {
      return;
    }

    if (!authenticatedUser) {
      showToast("Only registered users can set a custom username.");
      return;
    }

    const normalized = normalizeUsernameDraft(refs.usernameInput.value);
    if (normalized.length < 2) {
      showToast("Username must be at least 2 characters.");
      return;
    }

    if (/\s/.test(normalized)) {
      showToast("Username cannot contain spaces.");
      return;
    }

    if ((currentProfile?.usernameChangeCount ?? 0) >= 1) {
      showToast("Username can only be changed once per account.");
      return;
    }

    if (currentProfile && normalized === currentProfile.displayName) {
      showToast("Choose a different username.");
      return;
    }

    authBusy = true;
    renderAuthPanel();

    try {
      const updatedProfile = await renameUserProfile(authenticatedUser, normalized);
      currentProfile = updatedProfile;
      currentFriendId = updatedProfile.friendId || currentFriendId;
      editableUsername = updatedProfile.displayName;
      emitCurrentProfileName();
      onIdentityUpdated();
      await refreshFriendsPanel();
      showToast("Username updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update username right now.";
      showToast(message);
    } finally {
      authBusy = false;
      renderAuthPanel();
    }
  };

  const onFriendProfileUpdate = (payload?: unknown): void => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const record = payload as { userId?: unknown; displayName?: unknown; friendId?: unknown };
    const userId = normalizeSocketUserId(record.userId);
    const displayName = normalizeUsernameDraft(typeof record.displayName === "string" ? record.displayName : "");
    const friendId = typeof record.friendId === "string" ? record.friendId.trim() : "";
    if (!userId || !displayName) {
      return;
    }

    let changed = false;
    friends = friends.map((entry) => {
      if (entry.userId !== userId) {
        return entry;
      }

      const nextFriendId = friendId || entry.friendId;
      if (entry.displayName === displayName && entry.friendId === nextFriendId) {
        return entry;
      }

      changed = true;
      return {
        ...entry,
        displayName,
        friendId: nextFriendId,
      };
    });

    incomingFriendRequests = incomingFriendRequests.map((request) => {
      if (request.fromUserId !== userId || request.fromDisplayName === displayName) {
        return request;
      }

      changed = true;
      return {
        ...request,
        fromDisplayName: displayName,
      };
    });

    outgoingFriendRequests = outgoingFriendRequests.map((request) => {
      if (request.toUserId !== userId || request.toDisplayName === displayName) {
        return request;
      }

      changed = true;
      return {
        ...request,
        toDisplayName: displayName,
      };
    });

    if (authenticatedUser && authenticatedUser.uid === userId && currentProfile && currentProfile.displayName !== displayName) {
      currentProfile = {
        ...currentProfile,
        displayName,
      };
      editableUsername = displayName;
      changed = true;
      onIdentityUpdated();
    }

    if (changed) {
      renderFriendsPanel();
      renderAuthPanel();
    }
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
      showToast("Sign in to send friend requests.");
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

    const sent = await sendFriendRequestByLookup(lookupQuery);
    if (sent) {
      refs.friendIdInput.value = "";
      renderFriendsPanel();
    }
  };

  async function sendFriendRequestByLookup(lookup: string): Promise<boolean> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      showToast("Sign in to send friend requests.");
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
      const request = await submitFriendRequestByLookup(authenticatedUser.uid, lookupQuery);
      if (socket.connected) {
        socket.emit("friends:notification:request", {
          toUserId: request.toUserId,
          requestId: request.requestId,
          fromDisplayName: request.fromDisplayName,
        });
      }
      showToast(`Request sent to ${request.toDisplayName}.`);
      await refreshFriendsPanel();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send friend request right now.";
      showToast(message);
      return false;
    } finally {
      addFriendBusy = false;
      renderFriendsPanel();
    }
  }

  async function handleRemoveFriend(entry: SidebarFriendEntry): Promise<void> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      showToast("Sign in to manage friends.");
      return;
    }

    if (pendingFriendRemovals.has(entry.userId)) {
      return;
    }

    pendingFriendRemovals.add(entry.userId);
    renderFriendsPanel();

    try {
      await removeFriendConnection(authenticatedUser.uid, entry.userId);
      showToast(`${entry.displayName} removed from friends.`);
      await refreshFriendsPanel();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove friend right now.";
      showToast(message);
    } finally {
      pendingFriendRemovals.delete(entry.userId);
      renderFriendsPanel();
    }
  }

  const onSessionJoined = (payload?: unknown): void => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const roomId = normalizeRoomId((payload as { roomId?: unknown }).roomId);
    const roomRole = normalizeRoomRole((payload as { role?: unknown }).role);
    currentRoomId = roomId;
    currentRoomRole = roomRole;
    renderFriendsPanel();
  };

  const onSessionLeft = (payload?: unknown): void => {
    const roomId = payload && typeof payload === "object"
      ? normalizeRoomId((payload as { roomId?: unknown }).roomId)
      : null;
    if (roomId && currentRoomId && roomId !== currentRoomId) {
      return;
    }

    if (currentRoomId === null && currentRoomRole === null) {
      return;
    }

    currentRoomId = null;
    currentRoomRole = null;
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

  function normalizeUsername(value: string): string {
    return value.trim().replace(/\s+/g, " ").slice(0, 24);
  }

  function normalizeUsernameDraft(value: string): string {
    return value.trim().slice(0, 24);
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

  function normalizeRoomId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return ROOM_ID_PATTERN.test(normalized) ? normalized : null;
  }

  function normalizeRoomRole(value: unknown): "w" | "b" | "spectator" | null {
    if (value === "w" || value === "b" || value === "spectator") {
      return value;
    }

    return null;
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
      currentProfile = null;
      renderFriendsPanel();
      return;
    }

    try {
      const profile = await getPublicUserProfile(authenticatedUser.uid);
      currentProfile = profile;
      currentFriendId = profile?.friendId || null;
      if (profile?.displayName) {
        editableUsername = profile.displayName;
      }
    } catch {
      currentFriendId = null;
      currentProfile = null;
    }

    renderFriendsPanel();
    emitCurrentProfileName();
  }

  function applyRealtimeFriendActivity(presenceByUserId: Map<string, FriendActivityState>): void {
    if (friends.length === 0) {
      return;
    }

    let changed = false;
    friends = friends.map((entry) => {
      const presence = presenceByUserId.get(entry.userId);
      const nextStatus = presence?.status ?? "offline";
      const nextRoomId = presence?.roomId ?? null;
      const nextCanSpectate = presence?.canSpectate ?? false;
      const nextCanRequestJoin = presence?.canRequestJoin ?? false;
      if (
        entry.status === nextStatus
        && entry.presenceRoomId === nextRoomId
        && entry.canSpectate === nextCanSpectate
        && entry.canRequestJoin === nextCanRequestJoin
      ) {
        return entry;
      }

      changed = true;
      return {
        ...entry,
        status: nextStatus,
        presenceRoomId: nextRoomId,
        canSpectate: nextCanSpectate,
        canRequestJoin: nextCanRequestJoin,
      };
    });

    if (changed) {
      renderFriendsPanel();
    }
  }

  function syncFriendActivitySubscription(): void {
    friendActivityRealtime.updateWatchedFriendIds(friends.map((entry) => entry.userId));
  }

  function getCurrentPlayerName(): string {
    if (!authenticatedUser) {
      return "Guest";
    }

    const profileName = normalizeUsernameDraft(currentProfile?.displayName ?? "");
    if (profileName) {
      return profileName;
    }

    const fallback = normalizeUsernameDraft(authenticatedUser.displayName ?? "").replace(/\s+/g, "");
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
      usernameChangeCount: currentProfile?.usernameChangeCount ?? 0,
    });
  }

  function emitFriendshipState(): void {
    if (!socket.connected || !authenticatedUser || !isFirebaseAuthEnabled() || friendsLoading) {
      return;
    }

    const friendUserIds = Array.from(new Set(friends.map((entry) => entry.userId).filter(Boolean)));
    socket.emit("friends:state", {
      userId: authenticatedUser.uid,
      friendUserIds,
      activity: friendPresenceActivity,
    });
  }

  function setFriendPresenceActivity(activity: FriendPresenceActivity): void {
    const normalized = activity === "playing-bot" ? "playing-bot" : null;
    if (friendPresenceActivity === normalized) {
      return;
    }

    friendPresenceActivity = normalized;
    emitFriendshipState();
  }

  function getAuthenticatedUserId(): string | null {
    return authenticatedUser?.uid ?? null;
  }

  function isRegisteredOnlineUser(): boolean {
    return Boolean(authenticatedUser && isFirebaseAuthEnabled());
  }

  function canPlayOnlineMultiplayer(): boolean {
    return isRegisteredOnlineUser();
  }

  function getFriendshipStatusWithUser(userId: string | null | undefined): MultiplayerFriendshipStatus {
    const currentUserId = getAuthenticatedUserId();
    const targetUserId = normalizeSocketUserId(userId);
    if (!currentUserId || !targetUserId || !isFirebaseAuthEnabled()) {
      return "unknown";
    }

    if (targetUserId === currentUserId) {
      return "friends";
    }

    if (friendsLoading) {
      return "unknown";
    }

    return friends.some((entry) => entry.userId === targetUserId) ? "friends" : "not-friends";
  }

  function getPresenceLabel(status: FriendPresenceStatus): string {
    if (status === "in-room") {
      return "In Room";
    }

    if (status === "playing-bot") {
      return "Playing vs Bot";
    }

    if (status === "online") {
      return "Online";
    }

    return "Offline";
  }

  function getInviteCandidates(): FriendInviteCandidate[] {
    const byStatusPriority: Record<FriendPresenceStatus, number> = {
      "in-room": 0,
      "playing-bot": 1,
      online: 2,
      offline: 3,
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
    return Boolean(
      currentRoomId
      && (currentRoomRole === "w" || currentRoomRole === "b")
      && canPlayOnlineMultiplayer(),
    );
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

    if (!canSendRoomInvites()) {
      showToast("Only registered seated players can send room invites.");
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
    const scrollAnchor = refs.friendsList.hidden ? refs.friendsToggleButton : refs.friendsList;

    window.requestAnimationFrame(() => {
      scrollAnchor.scrollIntoView({
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

    if (canSendRoomInvites()) {
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

    if (entry.canRequestJoin && entry.presenceRoomId && entry.presenceRoomId !== currentRoomId) {
      const joinButton = document.createElement("button");
      joinButton.type = "button";
      joinButton.className = "action friend-spectate-button";
      joinButton.disabled = !socket.connected;
      joinButton.textContent = "Join";
      joinButton.addEventListener("click", () => {
        if (!entry.presenceRoomId) {
          return;
        }

        if (!canPlayOnlineMultiplayer()) {
          showToast("Sign in to send room join requests.");
          return;
        }

        // Push current friendship snapshot before validating join eligibility server-side.
        emitFriendshipState();
        socket.emit("friends:room-join:request", {
          toUserId: entry.userId,
          roomId: entry.presenceRoomId,
        });
      });
      actions.appendChild(joinButton);
    } else if (entry.canSpectate && entry.presenceRoomId && entry.presenceRoomId !== currentRoomId) {
      const spectateButton = document.createElement("button");
      spectateButton.type = "button";
      spectateButton.className = "action friend-spectate-button";
      spectateButton.disabled = !socket.connected;
      spectateButton.textContent = "Spectate";
      spectateButton.addEventListener("click", () => {
        if (!entry.presenceRoomId) {
          return;
        }

        socket.emit("room:join", { roomId: entry.presenceRoomId, spectateOnly: true });
        setSidebarOpen(false);
        showToast(`Joining ${entry.displayName}'s game as spectator...`);
      });
      actions.appendChild(spectateButton);
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "chip friend-remove-button";
    const removing = pendingFriendRemovals.has(entry.userId);
    removeButton.disabled = removing;
    removeButton.textContent = removing ? "Removing..." : "Remove";
    removeButton.addEventListener("click", () => {
      void handleRemoveFriend(entry);
    });
    actions.appendChild(removeButton);

    if (actions.childElementCount > 0) {
      item.appendChild(actions);
    }

    return item;
  }

  function renderFriendsPanel(): void {
    const canUseFriends = Boolean(authenticatedUser && isFirebaseAuthEnabled());
    const lookupValue = normalizeFriendLookupQuery(refs.friendIdInput.value);
    const numericLookup = isNumericFriendLookup(lookupValue);
    const lookupState = getLookupRequestState(
      lookupValue,
      friends,
      incomingFriendRequests,
      outgoingFriendRequests,
    );

    refs.friendPlayerId.textContent = currentFriendId ?? (authenticatedUser ? "Generating..." : "Sign in to reveal your Friend ID");
    refs.copyPlayerIdButton.disabled = !authenticatedUser || !currentFriendId;
    refs.friendIdInput.disabled = !canUseFriends || addFriendBusy;

    const hasValidLookup =
      lookupValue.length >= 2
      && (!numericLookup || lookupValue.length === FRIEND_NUMERIC_ID_LENGTH);

    const canSubmitRequest = hasValidLookup && lookupState === "ready";
    refs.addFriendButton.disabled = !canUseFriends || addFriendBusy || !canSubmitRequest;
    refs.addFriendButton.textContent = addFriendBusy
      ? "Sending..."
      : lookupState === "outgoing"
        ? "Request Sent"
        : lookupState === "friend"
          ? "Friend Added"
          : lookupState === "incoming"
            ? "Check Requests"
            : "Send";
    refs.friendsList.innerHTML = "";
    refs.friendsList.hidden = true;

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

    refs.friendsList.hidden = false;
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
      incomingFriendRequests = [];
      outgoingFriendRequests = [];
      friendsLoading = false;
      renderFriendsPanel();
      syncFriendActivitySubscription();
      return;
    }

    friendsLoading = true;
    renderFriendsPanel();

    try {
      const snapshot = await loadFriendSystemSnapshot(authenticatedUser.uid);
      const loadedFriends = snapshot.friends;
      const nextIncoming = snapshot.incomingRequests;
      const nextOutgoing = snapshot.outgoingRequests;

      incomingFriendRequests = nextIncoming;
      outgoingFriendRequests = nextOutgoing;
      friends = loadedFriends.map((entry) => ({
        ...entry,
        status: "offline",
        presenceRoomId: null,
        canSpectate: false,
        canRequestJoin: false,
      }));
    } catch {
      friends = [];
      incomingFriendRequests = [];
      outgoingFriendRequests = [];
      showToast("Could not load friends list.");
    } finally {
      friendsLoading = false;
      renderFriendsPanel();
      syncFriendActivitySubscription();
      emitFriendshipState();
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

    if (deletingGameId || clearSavedGamesBusy) {
      return;
    }

    deletingGameId = game.id;
    clearSavedGamesConfirmOpen = false;
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

  async function handleClearSavedGames(): Promise<void> {
    if (!authenticatedUser || !isFirebaseAuthEnabled()) {
      return;
    }

    if (clearSavedGamesBusy || deletingGameId) {
      return;
    }

    if (savedGameHistory.length === 0) {
      clearSavedGamesConfirmOpen = false;
      renderSavedHistoryPanel();
      return;
    }

    clearSavedGamesBusy = true;
    renderSavedHistoryPanel();

    try {
      storedGamesCount = await clearStoredGamesForUser(authenticatedUser.uid);
      savedGameHistory = [];
      clearSavedGamesConfirmOpen = false;
      showToast("All saved games cleared.");
    } catch {
      showToast("Could not clear saved games.");
    } finally {
      clearSavedGamesBusy = false;
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
      clearSavedGamesConfirmOpen = false;
      refs.historyPanelStatus.textContent = "No saved games yet. Finished games are saved automatically.";
      return;
    }

    refs.historyPanelStatus.textContent = `Showing ${sortedGames.length} saved game${sortedGames.length === 1 ? "" : "s"}. Select one to analyze.`;

    const controls = document.createElement("div");
    controls.className = "saved-games-toolbar";

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "ghost saved-games-clear-button";
    clearButton.disabled = Boolean(deletingGameId) || clearSavedGamesBusy || importBusy;
    clearButton.textContent = clearSavedGamesBusy ? "Clearing..." : "Clear";
    clearButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (clearSavedGamesBusy) {
        return;
      }

      clearSavedGamesConfirmOpen = !clearSavedGamesConfirmOpen;
      renderSavedHistoryPanel();
    });

    controls.appendChild(clearButton);
    refs.savedGamesList.appendChild(controls);

    if (clearSavedGamesConfirmOpen) {
      const confirmCard = document.createElement("article");
      confirmCard.className = "saved-games-clear-confirm";

      const confirmText = document.createElement("p");
      confirmText.className = "saved-games-clear-confirm-text";
      confirmText.textContent = "Clear all saved games?";

      const confirmActions = document.createElement("div");
      confirmActions.className = "saved-games-clear-confirm-actions";

      const acceptButton = document.createElement("button");
      acceptButton.type = "button";
      acceptButton.className = "ghost saved-games-clear-accept";
      acceptButton.disabled = clearSavedGamesBusy;
      acceptButton.textContent = clearSavedGamesBusy ? "Clearing..." : "Accept";
      acceptButton.addEventListener("click", (event) => {
        event.stopPropagation();
        void handleClearSavedGames();
      });

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "ghost saved-games-clear-cancel";
      cancelButton.disabled = clearSavedGamesBusy;
      cancelButton.textContent = "Cancel";
      cancelButton.addEventListener("click", (event) => {
        event.stopPropagation();
        clearSavedGamesConfirmOpen = false;
        renderSavedHistoryPanel();
      });

      confirmActions.appendChild(acceptButton);
      confirmActions.appendChild(cancelButton);
      confirmCard.appendChild(confirmText);
      confirmCard.appendChild(confirmActions);
      refs.savedGamesList.appendChild(confirmCard);
    }

    sortedGames.forEach((game) => {
      const deletingThisGame = deletingGameId === game.id || clearSavedGamesBusy;

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
      heading.textContent = buildMatchTitleFromPgn(game.pgn);

      const dateLabel = document.createElement("p");
      dateLabel.className = "saved-game-date";
      dateLabel.textContent = formatSavedGameDateTime(game.savedAt);

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
        if (deletingGameId || clearSavedGamesBusy) {
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
        if (deletingGameId || clearSavedGamesBusy) {
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
      refs.storedGamesMeta.textContent = "Analysis and spectating are available, but online PvP and cloud history are disabled.";
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
      const canRenameUsername = (currentProfile?.usernameChangeCount ?? 0) < 1;
      refs.quickIdentity.textContent = userLabel;
      refs.authStatus.textContent = canRenameUsername
        ? `Signed in as ${userLabel}. You can change your username once.`
        : `Signed in as ${userLabel}. Username change already used.`;
      refs.storedGamesMeta.textContent = `History enabled: ${storedGamesCount ?? "..."} / 100 PGNs`;
      refs.usernameInput.hidden = !canRenameUsername;
      refs.saveUsernameButton.hidden = !canRenameUsername;
      refs.usernameInput.disabled = authBusy || !canRenameUsername;
      if (document.activeElement !== refs.usernameInput) {
        refs.usernameInput.value = editableUsername;
      }
      const normalizedDraft = normalizeUsernameDraft(refs.usernameInput.value);
      const hasWhitespace = /\s/.test(normalizedDraft);
      refs.saveUsernameButton.disabled = authBusy
        || !canRenameUsername
        || normalizedDraft.length < 2
        || hasWhitespace
        || normalizedDraft === getCurrentPlayerName();
      refs.guestModeButton.disabled = authBusy;
      refs.signInGoogleButton.hidden = true;
      refs.signOutButton.hidden = false;
      refs.signOutButton.disabled = authBusy;
      renderFriendsPanel();
      return;
    }

    refs.quickIdentity.textContent = "Guest";
    refs.authStatus.textContent = "Playing as Guest.";
    refs.storedGamesMeta.textContent = "Guests can play bots, analyze boards, and spectate online rooms, but cannot play online PvP.";
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
    socket.on("friends:invite:sent", onFriendInviteSent);
    socket.on("friends:profile:update", onFriendProfileUpdate);
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
    socket.off("friends:invite:sent", onFriendInviteSent);
    socket.off("friends:profile:update", onFriendProfileUpdate);
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
    friendActivityRealtime.initialize();

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
      currentProfile = null;
      storedGamesCount = null;
      savedGameHistory = [];
      historyLoading = false;
      deletingGameId = null;
      friends = [];
      incomingFriendRequests = [];
      outgoingFriendRequests = [];
      pendingFriendRemovals.clear();
      friendsLoading = Boolean(user);
      addFriendBusy = false;
      currentFriendId = null;
      friendActivityRealtime.updateWatchedFriendIds([]);

      editableUsername = getCurrentPlayerName();

      renderAuthPanel();
      renderSavedHistoryPanel();

      if (user) {
        void (async () => {
          try {
            const profile = await syncUserProfile(user, getCurrentPlayerName());
            currentProfile = profile;
            currentFriendId = profile.friendId ?? null;
            editableUsername = profile.displayName;
            renderFriendsPanel();
            renderAuthPanel();
            emitCurrentProfileName();
            onIdentityUpdated();
          } catch {
            emitCurrentProfileName();
            onIdentityUpdated();
          }
        })();
        void refreshStoredGamesCount();
        void refreshSavedHistoryPanel();
        void refreshFriendsPanel();
      } else {
        emitCurrentProfileName();
        onIdentityUpdated();
        void refreshCurrentFriendId();
        void refreshFriendsPanel();
      }
    });
  }

  function dispose(): void {
    authUnsubscribe?.();
    authUnsubscribe = null;
    unsubscribeFriendActivity();
    friendActivityRealtime.dispose();
    unWireEventListeners();
    document.body.classList.remove(MOBILE_SCROLL_LOCK_CLASS);
  }

  return {
    initialize,
    dispose,
    emitCurrentProfileName,
    emitFriendshipState,
    setFriendPresenceActivity,
    getCurrentPlayerName,
    getAuthenticatedUserId,
    isRegisteredOnlineUser,
    canPlayOnlineMultiplayer,
    getFriendshipStatusWithUser,
    openSidebarToFriends,
    getInviteCandidates,
    canSendRoomInvites,
    sendInviteToFriend,
    addFriendByLookup: sendFriendRequestByLookup,
    normalizeUsername,
    resetFinishedGameTracking,
    handleFinishedGamePersist,
  };
}
