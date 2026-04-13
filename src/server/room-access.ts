import { randomUUID } from "node:crypto";

export type RoomJoinAuthorizationSource = "member" | "direct-invite" | "invite-link";

export type RoomJoinAuthorization = {
  allowed: boolean;
  source: RoomJoinAuthorizationSource | null;
  reason: string | null;
};

export type RoomAccessState = {
  inviteLinkToken: string;
  invitedUserIds: Set<string>;
  allowedSpectatorUserIds: Set<string>;
};

type EvaluateRoomJoinAuthorizationInput = {
  access: RoomAccessState;
  userId: string | null;
  inviteToken: string | null;
  isAlreadyMember: boolean;
};

type CanSpectateInput = {
  access: RoomAccessState;
  userId: string | null;
  authSource: RoomJoinAuthorizationSource;
};

function normalizeToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const token = value.trim();
  return token ? token : null;
}

export function createRoomAccessState(): RoomAccessState {
  return {
    inviteLinkToken: randomUUID(),
    invitedUserIds: new Set<string>(),
    allowedSpectatorUserIds: new Set<string>(),
  };
}

export function buildRoomInviteQuery(roomId: string, inviteToken: string): string {
  const room = encodeURIComponent(roomId);
  const token = encodeURIComponent(inviteToken);
  return `room=${room}&invite=${token}`;
}

export function grantDirectRoomInvite(access: RoomAccessState, userId: string, allowSpectator = true): void {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return;
  }

  access.invitedUserIds.add(normalizedUserId);
  if (allowSpectator) {
    access.allowedSpectatorUserIds.add(normalizedUserId);
  }
}

export function evaluateRoomJoinAuthorization({
  access,
  userId,
  inviteToken,
  isAlreadyMember,
}: EvaluateRoomJoinAuthorizationInput): RoomJoinAuthorization {
  if (isAlreadyMember) {
    return {
      allowed: true,
      source: "member",
      reason: null,
    };
  }

  const normalizedToken = normalizeToken(inviteToken);
  if (normalizedToken && normalizedToken === access.inviteLinkToken) {
    return {
      allowed: true,
      source: "invite-link",
      reason: null,
    };
  }

  if (userId && access.invitedUserIds.has(userId)) {
    return {
      allowed: true,
      source: "direct-invite",
      reason: null,
    };
  }

  return {
    allowed: false,
    source: null,
    reason: "You need a valid invite link or direct invitation to join this room.",
  };
}

export function canJoinAsSpectator({ access, userId, authSource }: CanSpectateInput): boolean {
  if (authSource === "member") {
    return true;
  }

  if (authSource === "invite-link") {
    return true;
  }

  if (authSource === "direct-invite") {
    return Boolean(userId && access.allowedSpectatorUserIds.has(userId));
  }

  return false;
}