import {
  FriendListEntry,
  FriendRequestEntry,
  getFriendListForUser,
  getIncomingFriendRequestsForUser,
  getOutgoingFriendRequestsForUser,
  removeFriendForUser,
  respondToFriendRequest,
  sendFriendRequestByLookup,
} from "./firebase";

export type FriendSystemSnapshot = {
  friends: FriendListEntry[];
  incomingRequests: FriendRequestEntry[];
  outgoingRequests: FriendRequestEntry[];
};

export type LookupRequestState = "ready" | "friend" | "outgoing" | "incoming";

function normalizeLookup(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLookupKey(value: string): string {
  return normalizeLookup(value).toLowerCase();
}

function isNumericLookup(value: string): boolean {
  return /^\d+$/.test(value);
}

export async function loadFriendSystemSnapshot(userId: string): Promise<FriendSystemSnapshot> {
  const [friends, incomingRequests, outgoingRequests] = await Promise.all([
    getFriendListForUser(userId),
    getIncomingFriendRequestsForUser(userId),
    getOutgoingFriendRequestsForUser(userId),
  ]);

  return { friends, incomingRequests, outgoingRequests };
}

export function getLookupRequestState(
  lookup: string,
  friends: FriendListEntry[],
  incomingRequests: FriendRequestEntry[],
  outgoingRequests: FriendRequestEntry[],
): LookupRequestState {
  const normalizedLookup = normalizeLookup(lookup);
  const lookupKey = normalizeLookupKey(normalizedLookup);
  if (!normalizedLookup) {
    return "ready";
  }

  const numeric = isNumericLookup(normalizedLookup);

  const isExistingFriend = friends.some((friend) => {
    if (numeric) {
      return friend.friendId === normalizedLookup;
    }

    return normalizeLookupKey(friend.displayName) === lookupKey;
  });
  if (isExistingFriend) {
    return "friend";
  }

  const hasOutgoing = outgoingRequests.some((request) => {
    if (numeric) {
      return request.toFriendId === normalizedLookup;
    }

    return normalizeLookupKey(request.toDisplayName) === lookupKey;
  });
  if (hasOutgoing) {
    return "outgoing";
  }

  const hasIncoming = incomingRequests.some((request) => {
    if (numeric) {
      return request.fromFriendId === normalizedLookup;
    }

    return normalizeLookupKey(request.fromDisplayName) === lookupKey;
  });
  if (hasIncoming) {
    return "incoming";
  }

  return "ready";
}

export async function submitFriendRequestByLookup(userId: string, lookup: string): Promise<FriendRequestEntry> {
  return sendFriendRequestByLookup(userId, lookup);
}

export async function replyToFriendRequest(userId: string, requestId: string, accepted: boolean): Promise<FriendRequestEntry> {
  return respondToFriendRequest(userId, requestId, accepted);
}

export async function removeFriendConnection(userId: string, friendUserId: string): Promise<void> {
  await removeFriendForUser(userId, friendUserId);
}
