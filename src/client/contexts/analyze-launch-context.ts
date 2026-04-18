export const ANALYZE_LAUNCH_PARAM = "launch";
export const ANALYZE_LAUNCH_SESSION_PREFIX = "chess_analyzeLaunch_";

export type AnalyzeLaunchPayload = {
  postGameMeta?: {
    whiteName?: string;
    blackName?: string;
  };
  postGameMoves?: string[];
  postGamePgn?: string;
};

export function buildAnalyzeLaunchSessionKey(launchToken: string): string {
  return `${ANALYZE_LAUNCH_SESSION_PREFIX}${launchToken}`;
}
