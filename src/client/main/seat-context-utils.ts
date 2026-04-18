import type { MultiplayerFriendshipStatus } from "../account-sidebar";
import type { PlayerRole, RoomRole, RoomSnapshot } from "./main-types";

type SeatInfo = {
  connected: boolean;
  role: PlayerRole;
  name: string;
  userId: string | null;
  friendId: string | null;
};

export function canSendFriendRequest(
  currentUser: { isRegistered: boolean },
  opponent: { isRegistered: boolean },
  friendshipStatus: MultiplayerFriendshipStatus,
): boolean {
  return currentUser.isRegistered && opponent.isRegistered && friendshipStatus === "not-friends";
}

export function getCurrentSeatInfo(
  snapshot: RoomSnapshot,
  currentRole: RoomRole | null,
  normalizeUsername: (value: string) => string,
): SeatInfo | null {
  if (currentRole === "w") {
    return {
      connected: snapshot.players.whiteConnected,
      role: "w",
      name: normalizeUsername(snapshot.players.whiteName) || "Guest",
      userId: snapshot.players.whiteUserId,
      friendId: snapshot.players.whiteFriendId,
    };
  }

  if (currentRole === "b") {
    return {
      connected: snapshot.players.blackConnected,
      role: "b",
      name: normalizeUsername(snapshot.players.blackName) || "Guest",
      userId: snapshot.players.blackUserId,
      friendId: snapshot.players.blackFriendId,
    };
  }

  return null;
}

export function getOpponentSeatInfo(
  snapshot: RoomSnapshot,
  currentRole: RoomRole | null,
  normalizeUsername: (value: string) => string,
): SeatInfo | null {
  if (currentRole === "w") {
    return {
      connected: snapshot.players.blackConnected,
      role: "b",
      name: normalizeUsername(snapshot.players.blackName) || "Guest",
      userId: snapshot.players.blackUserId,
      friendId: snapshot.players.blackFriendId,
    };
  }

  if (currentRole === "b") {
    return {
      connected: snapshot.players.whiteConnected,
      role: "w",
      name: normalizeUsername(snapshot.players.whiteName) || "Guest",
      userId: snapshot.players.whiteUserId,
      friendId: snapshot.players.whiteFriendId,
    };
  }

  return null;
}

export function seatLabel(
  seatRole: PlayerRole,
  playerName: string,
  friendId: string | null,
  userId: string | null,
  currentRole: RoomRole | null,
  currentPlayerName: string,
  normalizeUsername: (value: string) => string,
): string {
  const safeName = normalizeUsername(playerName) || "Guest";
  const colorLabel = seatRole === "w" ? "White" : "Black";

  if (currentRole === seatRole) {
    return `You (${currentPlayerName})`;
  }

  if (userId && friendId) {
    return `${safeName} (${colorLabel} - ID ${friendId})`;
  }

  return `${safeName} (${colorLabel} - Guest)`;
}

export function humanRole(role: RoomRole | null, currentPlayerName: string): string {
  if (role === "w") {
    return `${currentPlayerName} (White)`;
  }

  if (role === "b") {
    return `${currentPlayerName} (Black)`;
  }

  if (role === "spectator") {
    return `${currentPlayerName} (Spectator)`;
  }

  return `${currentPlayerName} (Not seated)`;
}
