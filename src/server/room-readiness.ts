export type PregameSeatState = {
  white: string | undefined;
  black: string | undefined;
  isStarted: boolean;
  colorChoices: Map<string, "w" | "b">;
  readyPlayers: Set<string>;
};

export function sanitizePregameSeatState(state: PregameSeatState): boolean {
  const seatedSocketIds = new Set<string>();
  if (state.white) {
    seatedSocketIds.add(state.white);
  }
  if (state.black) {
    seatedSocketIds.add(state.black);
  }

  let changed = false;

  for (const socketId of [...state.colorChoices.keys()]) {
    if (seatedSocketIds.has(socketId)) {
      continue;
    }

    state.colorChoices.delete(socketId);
    changed = true;
  }

  for (const socketId of [...state.readyPlayers]) {
    if (seatedSocketIds.has(socketId)) {
      continue;
    }

    state.readyPlayers.delete(socketId);
    changed = true;
  }

  if (!state.white || !state.black) {
    return changed;
  }

  return changed;
}

export function canStartPregameMatch(state: PregameSeatState): boolean {
  if (state.isStarted || !state.white || !state.black) {
    return false;
  }

  if (!state.readyPlayers.has(state.white) || !state.readyPlayers.has(state.black)) {
    return false;
  }

  const whiteChoice = state.colorChoices.get(state.white);
  const blackChoice = state.colorChoices.get(state.black);
  if (!whiteChoice || !blackChoice) {
    return false;
  }

  return whiteChoice !== blackChoice;
}
