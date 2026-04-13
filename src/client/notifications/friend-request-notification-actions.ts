import { FriendRequestEntry } from "../firebase";
import { replyToFriendRequest } from "../friend-system";

type SocketLike = {
  connected: boolean;
  emit: (event: string, payload?: unknown) => void;
};

type ResolveFriendRequestInput = {
  userId: string;
  requestId: string;
  accepted: boolean;
  fromUserId: string;
};

type CreateFriendRequestNotificationActionsOptions = {
  socket: SocketLike;
  getResponderDisplayName: () => string;
};

export type FriendRequestNotificationActions = {
  resolve: (input: ResolveFriendRequestInput) => Promise<FriendRequestEntry>;
};

export function createFriendRequestNotificationActions({
  socket,
  getResponderDisplayName,
}: CreateFriendRequestNotificationActionsOptions): FriendRequestNotificationActions {
  async function resolve(input: ResolveFriendRequestInput): Promise<FriendRequestEntry> {
    const resolved = await replyToFriendRequest(input.userId, input.requestId, input.accepted);

    if (socket.connected) {
      socket.emit("friends:notification:response", {
        toUserId: input.fromUserId,
        requestId: input.requestId,
        accepted: input.accepted,
        fromDisplayName: getResponderDisplayName(),
      });
    }

    return resolved;
  }

  return { resolve };
}
