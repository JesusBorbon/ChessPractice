import { User } from "firebase/auth";

import {
  FriendRequestEntry,
  initializeFirebaseClient,
  isFirebaseAuthEnabled,
  listenToAuthState,
} from "../firebase";
import { loadFriendSystemSnapshot } from "../friend-system";
import {
  createFriendRequestNotificationActions,
  FriendRequestNotificationActions,
} from "./friend-request-notification-actions";

type SocketLike = {
  connected: boolean;
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, listener: (payload?: unknown) => void) => void;
  off: (event: string, listener: (payload?: unknown) => void) => void;
};

export type FriendRequestNotificationItem = {
  id: string;
  type: "friend-request";
  requestId: string;
  fromUserId: string;
  fromDisplayName: string;
  fromFriendId: string;
  createdAt: string;
};

export type NotificationsSnapshot = {
  items: FriendRequestNotificationItem[];
  pendingCount: number;
  loading: boolean;
  enabled: boolean;
  signedIn: boolean;
};

type CreateNotificationsStateControllerOptions = {
  socket: SocketLike;
  getResponderDisplayName: () => string;
  showToast: (message: string) => void;
  pollIntervalMs?: number;
};

export type NotificationsStateController = {
  initialize: () => Promise<void>;
  dispose: () => void;
  subscribe: (listener: (snapshot: NotificationsSnapshot) => void) => () => void;
  getSnapshot: () => NotificationsSnapshot;
  refresh: () => Promise<void>;
  accept: (requestId: string) => Promise<boolean>;
  decline: (requestId: string) => Promise<boolean>;
};

const DEFAULT_POLL_INTERVAL_MS = 15_000;

function mapFriendRequestToNotification(request: FriendRequestEntry): FriendRequestNotificationItem {
  return {
    id: request.requestId,
    type: "friend-request",
    requestId: request.requestId,
    fromUserId: request.fromUserId,
    fromDisplayName: request.fromDisplayName,
    fromFriendId: request.fromFriendId,
    createdAt: request.createdAt,
  };
}

function sortNotificationsByDate(items: FriendRequestNotificationItem[]): FriendRequestNotificationItem[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return 0;
    }

    return rightTime - leftTime;
  });
}

export function createNotificationsStateController({
  socket,
  getResponderDisplayName,
  showToast,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: CreateNotificationsStateControllerOptions): NotificationsStateController {
  let currentUser: User | null = null;
  let authUnsubscribe: (() => void) | null = null;
  let pollTimer: number | null = null;
  let loading = false;
  let enabled = false;
  let disposed = false;
  let notifications: FriendRequestNotificationItem[] = [];

  const listeners = new Set<(snapshot: NotificationsSnapshot) => void>();
  const actions: FriendRequestNotificationActions = createFriendRequestNotificationActions({
    socket,
    getResponderDisplayName,
  });

  const onIncomingNotification = (): void => {
    if (!currentUser || !enabled) {
      return;
    }

    void refresh();
  };

  const onResponseNotification = (): void => {
    if (!currentUser || !enabled) {
      return;
    }

    void refresh();
  };

  function emitSnapshot(): void {
    if (disposed) {
      return;
    }

    const snapshot = getSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function setPollEnabled(nextEnabled: boolean): void {
    if (!nextEnabled) {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      return;
    }

    if (pollTimer !== null) {
      return;
    }

    pollTimer = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);
  }

  async function refresh(): Promise<void> {
    if (disposed || !enabled || !currentUser) {
      notifications = [];
      loading = false;
      emitSnapshot();
      return;
    }

    loading = true;
    emitSnapshot();

    try {
      const snapshot = await loadFriendSystemSnapshot(currentUser.uid);
      notifications = sortNotificationsByDate(snapshot.incomingRequests.map(mapFriendRequestToNotification));
    } catch {
      notifications = [];
      showToast("Could not load notifications.");
    } finally {
      loading = false;
      emitSnapshot();
    }
  }

  function removeNotificationByRequestId(requestId: string): FriendRequestNotificationItem | null {
    const index = notifications.findIndex((item) => item.requestId === requestId);
    if (index < 0) {
      return null;
    }

    const [removed] = notifications.splice(index, 1);
    return removed ?? null;
  }

  async function resolveRequest(requestId: string, accepted: boolean): Promise<boolean> {
    if (!enabled || !currentUser) {
      return false;
    }

    const target = notifications.find((item) => item.requestId === requestId);
    if (!target) {
      return false;
    }

    const removed = removeNotificationByRequestId(requestId);
    emitSnapshot();

    try {
      await actions.resolve({
        userId: currentUser.uid,
        requestId,
        accepted,
        fromUserId: target.fromUserId,
      });
      showToast(accepted
        ? `${target.fromDisplayName} added to your friends.`
        : `Declined request from ${target.fromDisplayName}.`);
      return true;
    } catch (error) {
      if (removed) {
        notifications = sortNotificationsByDate([...notifications, removed]);
      }
      emitSnapshot();

      const message = error instanceof Error ? error.message : "Could not process request.";
      showToast(message);
      return false;
    }
  }

  async function initialize(): Promise<void> {
    if (disposed) {
      return;
    }

    await initializeFirebaseClient();
    enabled = isFirebaseAuthEnabled();

    if (!enabled) {
      currentUser = null;
      notifications = [];
      loading = false;
      emitSnapshot();
      return;
    }

    socket.on("friends:notification:request", onIncomingNotification);
    socket.on("friends:notification:response", onResponseNotification);

    authUnsubscribe?.();
    authUnsubscribe = listenToAuthState((user) => {
      currentUser = user;
      notifications = [];
      loading = false;
      setPollEnabled(Boolean(user));
      emitSnapshot();
      if (user) {
        void refresh();
      }
    });
  }

  function dispose(): void {
    disposed = true;
    authUnsubscribe?.();
    authUnsubscribe = null;
    setPollEnabled(false);
    socket.off("friends:notification:request", onIncomingNotification);
    socket.off("friends:notification:response", onResponseNotification);
    listeners.clear();
  }

  function subscribe(listener: (snapshot: NotificationsSnapshot) => void): () => void {
    listeners.add(listener);
    listener(getSnapshot());

    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): NotificationsSnapshot {
    return {
      items: notifications,
      pendingCount: notifications.length,
      loading,
      enabled,
      signedIn: Boolean(currentUser),
    };
  }

  return {
    initialize,
    dispose,
    subscribe,
    getSnapshot,
    refresh,
    accept: (requestId: string) => resolveRequest(requestId, true),
    decline: (requestId: string) => resolveRequest(requestId, false),
  };
}
