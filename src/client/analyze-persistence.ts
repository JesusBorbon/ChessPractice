export interface AnalyzeSession {
    fenHistory: string[];
    moveHistory: any[]; // serialized Move objects
    analysisByPly?: any[];
    cursor: number;
    orientation: "w" | "b";
    focusMode?: boolean;
    timestamp: number;
}

const STORAGE_KEY = "chess-analyze-session";

export function saveAnalyzeSession(session: AnalyzeSession): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
        // ignore storage errors
    }
}

export function loadAnalyzeSession(): AnalyzeSession | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AnalyzeSession;
        return parsed;
    } catch {
        return null;
    }
}

export function clearAnalyzeSession(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { }
}
