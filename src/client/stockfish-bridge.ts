import { clampBotMoveTimeMs } from "./bot-config";
import type { BotDifficultyPreset, EngineEval } from "./main-types";

const LIVE_MATE_CP = 100000;

function parseInfoLine(line: string): { cp: number; mate: number | null; pv: string } | null {
  const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
  if (!scoreMatch) {
    return null;
  }

  const kind = scoreMatch[1];
  const value = Number(scoreMatch[2]);
  const pvMatch = line.match(/\spv\s(.+)$/);
  const pv = pvMatch?.[1]?.trim() ?? "";
  if (kind === "mate") {
    const cp = value > 0 ? LIVE_MATE_CP - Math.min(Math.abs(value), 99) * 100 : -LIVE_MATE_CP + Math.min(Math.abs(value), 99) * 100;
    return { cp, mate: value, pv };
  }

  return { cp: value, mate: null, pv };
}

export class StockfishBridge {
  private readonly worker: Worker;
  private ready = false;
  private initResolve!: () => void;
  private initReject!: (error: Error) => void;
  private readonly initPromise: Promise<void>;
  private readonly readyWaiters: Array<() => void> = [];
  private lastBotConfigKey: string | null = null;
  private activeEval: {
    resolve: (value: EngineEval) => void;
    reject: (reason?: unknown) => void;
    lastCp: number;
    mate: number | null;
    pv: string;
    bestMove: string;
  } | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(workerPath = "/stockfish/stockfish-18-lite-single.js") {
    this.worker = new Worker(workerPath);
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
    });

    this.worker.onmessage = (event) => this.onMessage(String(event.data ?? ""));
    this.worker.onerror = () => {
      if (!this.ready) this.initReject(new Error("Stockfish init failed."));
      this.activeEval?.reject(new Error("Worker error."));
      this.activeEval = null;
    };

    this.send("uci");
    this.send("isready");
  }

  async getBotMove(fen: string, preset: BotDifficultyPreset, moveTimeOverrideMs?: number): Promise<string> {
    await this.initPromise;
    const botPromise = this.queue.then(async () => {
      await this.applyBotDifficulty(preset);
      const effectiveMoveTimeMs = clampBotMoveTimeMs(moveTimeOverrideMs ?? preset.moveTimeMs);
      return new Promise<string>((resolve, reject) => {
        this.activeEval = {
          resolve: (res) => resolve(res.bestMove),
          reject,
          lastCp: 0,
          mate: null,
          pv: "",
          bestMove: "",
        };
        this.send(`position fen ${fen}`);
        this.send(`go movetime ${effectiveMoveTimeMs}`);
      });
    });
    this.queue = botPromise.then(() => undefined).catch(() => undefined);
    return botPromise;
  }

  async evaluateFen(fen: string, depth: number): Promise<EngineEval> {
    await this.initPromise;
    const evalPromise = this.queue.then(() => {
      return new Promise<EngineEval>((resolve, reject) => {
        this.activeEval = {
          resolve,
          reject,
          lastCp: 0,
          mate: null,
          pv: "",
          bestMove: "",
        };
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);
      });
    });
    this.queue = evalPromise.then(() => undefined).catch(() => undefined);
    return evalPromise;
  }

  private onMessage(line: string): void {
    if (line === "readyok") {
      if (!this.ready) {
        this.ready = true;
        this.initResolve();
      }
      const waiters = this.readyWaiters.splice(0);
      for (const waiter of waiters) {
        waiter();
      }
      return;
    }

    if (!this.activeEval) {
      return;
    }

    if (line.startsWith("info ")) {
      const parsed = parseInfoLine(line);
      if (parsed) {
        this.activeEval.lastCp = parsed.cp;
        this.activeEval.mate = parsed.mate;
        this.activeEval.pv = parsed.pv;
      }
    } else if (line.startsWith("bestmove ")) {
      this.activeEval.bestMove = line.split(" ")[1] ?? "";
      this.activeEval.resolve({
        cp: this.activeEval.lastCp,
        mate: this.activeEval.mate,
        bestMove: this.activeEval.bestMove,
        pv: this.activeEval.pv,
      });
      this.activeEval = null;
    }
  }

  private awaitReadyRoundTrip(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.readyWaiters.push(resolve);
      this.send("isready");
    });
  }

  private async applyBotDifficulty(preset: BotDifficultyPreset): Promise<void> {
    const configKey = `${preset.level}:${preset.elo ?? "max"}:${preset.skillLevel}:${preset.fullStrength}`;
    if (configKey === this.lastBotConfigKey) {
      return;
    }

    if (preset.fullStrength) {
      this.send("setoption name UCI_LimitStrength value false");
      this.send("setoption name Skill Level value 20");
    } else {
      this.send("setoption name UCI_LimitStrength value true");
      this.send(`setoption name UCI_Elo value ${preset.elo}`);
      this.send(`setoption name Skill Level value ${preset.skillLevel}`);
    }

    await this.awaitReadyRoundTrip();
    this.lastBotConfigKey = configKey;
  }

  private send(cmd: string): void {
    this.worker.postMessage(cmd);
  }

  terminate(): void {
    this.worker.terminate();
  }
}
