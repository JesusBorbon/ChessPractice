export function syncUrl(roomId: string | null, inviteToken: string | null = null): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("rejoin");
  url.searchParams.delete("rejoinTs");
  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }

  if (roomId && inviteToken) {
    url.searchParams.set("invite", inviteToken);
  } else {
    url.searchParams.delete("invite");
  }

  window.history.replaceState({}, "", url);
}
