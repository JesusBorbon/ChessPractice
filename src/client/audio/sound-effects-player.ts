export type SoundEffectsPlayer = {
  play: (src: string) => void;
  stopAll: () => void;
  resume: () => Promise<void>;
};

type WindowWithWebkitAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const DEFAULT_SFX_GAIN = 0.9;

export function createSoundEffectsPlayer(): SoundEffectsPlayer {
  const fallbackAudioCache: Record<string, HTMLAudioElement> = {};
  const decodedBufferLoads = new Map<string, Promise<AudioBuffer | null>>();
  const activeSources = new Set<AudioBufferSourceNode>();
  let stopEpoch = 0;

  let audioContext: AudioContext | null = null;
  let masterGainNode: GainNode | null = null;

  function ensureAudioContext(): AudioContext | null {
    if (audioContext) {
      return audioContext;
    }

    const webkitWindow = window as WindowWithWebkitAudioContext;
    const AudioContextCtor = window.AudioContext ?? webkitWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    audioContext = new AudioContextCtor();
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = DEFAULT_SFX_GAIN;
    masterGainNode.connect(audioContext.destination);
    return audioContext;
  }

  async function loadDecodedBuffer(src: string, context: AudioContext): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(src);
      if (!response.ok) {
        return null;
      }

      const encodedBuffer = await response.arrayBuffer();
      return await context.decodeAudioData(encodedBuffer.slice(0));
    } catch {
      return null;
    }
  }

  function playFallbackAudio(src: string): void {
    let audio = fallbackAudioCache[src];
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      fallbackAudioCache[src] = audio;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => { });
  }

  function playFromBuffer(src: string): void {
    const requestEpoch = stopEpoch;
    const context = ensureAudioContext();
    const gainNode = masterGainNode;
    if (!context || !gainNode) {
      playFallbackAudio(src);
      return;
    }

    void context.resume().catch(() => { });

    let bufferLoad = decodedBufferLoads.get(src);
    if (!bufferLoad) {
      bufferLoad = loadDecodedBuffer(src, context);
      decodedBufferLoads.set(src, bufferLoad);
    }

    void bufferLoad.then((buffer) => {
      if (requestEpoch !== stopEpoch) {
        return;
      }

      if (!buffer) {
        playFallbackAudio(src);
        return;
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.onended = () => {
        activeSources.delete(source);
      };
      activeSources.add(source);
      source.start(0);
    }).catch(() => {
      playFallbackAudio(src);
    });
  }

  function stopAll(): void {
    stopEpoch += 1;

    for (const source of activeSources) {
      try {
        source.stop(0);
      } catch {
        // Ignore source stop errors from already-finished nodes.
      }
    }
    activeSources.clear();

    for (const audio of Object.values(fallbackAudioCache)) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  async function resumeAudioContext(): Promise<void> {
    const context = ensureAudioContext();
    if (context && context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        // Resume may fail if not triggered by user interaction
      }
    }
  }

  return {
    play: playFromBuffer,
    stopAll,
    resume: resumeAudioContext,
  };
}
