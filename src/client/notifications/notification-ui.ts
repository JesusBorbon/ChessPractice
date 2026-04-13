import {
  FriendRequestNotificationItem,
  NotificationsSnapshot,
} from "./notification-state";

type NotificationsUiRefs = {
  button: HTMLButtonElement;
  badge: HTMLSpanElement;
  popover: HTMLElement;
  status: HTMLParagraphElement;
  list: HTMLDivElement;
};

type CreateNotificationsUiControllerOptions = {
  refs: NotificationsUiRefs;
  onAccept: (requestId: string) => Promise<boolean>;
  onDecline: (requestId: string) => Promise<boolean>;
};

export type NotificationsUiController = {
  render: (snapshot: NotificationsSnapshot) => void;
  dispose: () => void;
};

function formatNotificationTime(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  const minutesAgo = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60_000));
  if (minutesAgo < 1) {
    return "Just now";
  }

  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) {
    return `${hoursAgo}h ago`;
  }

  const daysAgo = Math.floor(hoursAgo / 24);
  return `${daysAgo}d ago`;
}

export function createNotificationsUiController({
  refs,
  onAccept,
  onDecline,
}: CreateNotificationsUiControllerOptions): NotificationsUiController {
  let isOpen = false;
  let latestSnapshot: NotificationsSnapshot = {
    items: [],
    pendingCount: 0,
    loading: false,
    enabled: true,
    signedIn: false,
  };

  const busyRequestIds = new Set<string>();

  const onToggleOpen = (): void => {
    if (refs.button.disabled) {
      return;
    }

    isOpen = !isOpen;
    syncPopoverVisibility();
  };

  const onDocumentClick = (event: MouseEvent): void => {
    if (!isOpen) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (refs.button.contains(target) || refs.popover.contains(target)) {
      return;
    }

    isOpen = false;
    syncPopoverVisibility();
  };

  const onEscapeKey = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !isOpen) {
      return;
    }

    isOpen = false;
    syncPopoverVisibility();
  };

  function syncPopoverVisibility(): void {
    const canShow = isOpen && !refs.button.disabled;
    refs.popover.hidden = !canShow;
    refs.button.setAttribute("aria-expanded", canShow ? "true" : "false");
  }

  function createFriendRequestItem(item: FriendRequestNotificationItem): HTMLElement {
    const card = document.createElement("article");
    card.className = "notifications-item";

    const title = document.createElement("strong");
    title.className = "notifications-item-title";
    title.textContent = item.fromDisplayName;

    const subtitle = document.createElement("p");
    subtitle.className = "notifications-item-subtitle";
    subtitle.textContent = `Friend request • ID ${item.fromFriendId || "Unknown"} • ${formatNotificationTime(item.createdAt)}`;

    const actions = document.createElement("div");
    actions.className = "notifications-item-actions";

    const busy = busyRequestIds.has(item.requestId);

    const declineButton = document.createElement("button");
    declineButton.type = "button";
    declineButton.className = "chip notifications-decline";
    declineButton.disabled = busy;
    declineButton.textContent = busy ? "Working..." : "Decline";
    declineButton.addEventListener("click", () => {
      void runAction(item.requestId, false);
    });

    const acceptButton = document.createElement("button");
    acceptButton.type = "button";
    acceptButton.className = "action notifications-accept";
    acceptButton.disabled = busy;
    acceptButton.textContent = busy ? "Working..." : "Accept";
    acceptButton.addEventListener("click", () => {
      void runAction(item.requestId, true);
    });

    actions.appendChild(declineButton);
    actions.appendChild(acceptButton);

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(actions);

    return card;
  }

  async function runAction(requestId: string, accepted: boolean): Promise<void> {
    if (busyRequestIds.has(requestId)) {
      return;
    }

    busyRequestIds.add(requestId);
    render(latestSnapshot);

    try {
      if (accepted) {
        await onAccept(requestId);
      } else {
        await onDecline(requestId);
      }
    } finally {
      busyRequestIds.delete(requestId);
      render(latestSnapshot);
    }
  }

  function render(snapshot: NotificationsSnapshot): void {
    latestSnapshot = snapshot;

    refs.badge.hidden = snapshot.pendingCount <= 0;
    refs.badge.textContent = String(snapshot.pendingCount);

    const disabled = !snapshot.enabled || !snapshot.signedIn;
    refs.button.disabled = disabled;

    if (disabled) {
      isOpen = false;
      refs.status.textContent = snapshot.enabled
        ? "Sign in to view notifications."
        : "Notifications unavailable while Firebase is disabled.";
      refs.list.innerHTML = "";
      syncPopoverVisibility();
      return;
    }

    if (snapshot.loading) {
      refs.status.textContent = "Loading notifications...";
      refs.list.innerHTML = "";
      syncPopoverVisibility();
      return;
    }

    refs.list.innerHTML = "";

    if (snapshot.items.length === 0) {
      refs.status.textContent = "No notifications right now.";
      syncPopoverVisibility();
      return;
    }

    refs.status.textContent = `Pending requests: ${snapshot.pendingCount}`;

    for (const item of snapshot.items) {
      refs.list.appendChild(createFriendRequestItem(item));
    }

    syncPopoverVisibility();
  }

  refs.button.addEventListener("click", onToggleOpen);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onEscapeKey);

  return {
    render,
    dispose: () => {
      refs.button.removeEventListener("click", onToggleOpen);
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onEscapeKey);
    },
  };
}
