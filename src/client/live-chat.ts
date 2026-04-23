type PlayerRole = "w" | "b";
type RoomRole = PlayerRole | "spectator";
type GameMode = "multiplayer" | "bot";

type SocketLike = {
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
  off: (event: string, listener: (...args: any[]) => void) => void;
};

export type VoiceChatDomRefs = {
  chatFabButton: HTMLButtonElement;
  chatFabBadge: HTMLSpanElement;
  chatPanel: HTMLElement;
  chatCloseButton: HTMLButtonElement;
  chatStatusText: HTMLParagraphElement;
  chatConsentButton: HTMLButtonElement;
  chatMessages: HTMLDivElement;
  chatInput: HTMLInputElement;
  chatSendButton: HTMLButtonElement;
  chatVoiceButton: HTMLButtonElement;
};

type ChatStatePayload = {
  wAcceptsB: boolean;
  bAcceptsW: boolean;
  mutualConsent: boolean;
  messageCount: number;
};

type ChatTextMessage = {
  id: string;
  roomId: string;
  senderRole: PlayerRole;
  senderName: string;
  kind: "text";
  text: string;
  createdAt: number;
};

type ChatVoiceMessage = {
  id: string;
  roomId: string;
  senderRole: PlayerRole;
  senderName: string;
  kind: "voice";
  mimeType: string;
  audioBase64: string;
  durationMs: number;
  createdAt: number;
};

type ChatMessage = ChatTextMessage | ChatVoiceMessage;

type CreateVoiceChatControllerOptions = {
  socket: SocketLike;
  refs: VoiceChatDomRefs;
  showToast: (message: string) => void;
};

type LegacyNavigatorMedia = Navigator & {
  webkitGetUserMedia?: (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: unknown) => void,
  ) => void;
  mozGetUserMedia?: (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: unknown) => void,
  ) => void;
  msGetUserMedia?: (
    constraints: MediaStreamConstraints,
    onSuccess: (stream: MediaStream) => void,
    onError: (error: unknown) => void,
  ) => void;
};

export type VoiceChatController = {
  syncSession: (context: {
    roomId: string | null;
    role: RoomRole | null;
    gameMode: GameMode;
    isGameActive: boolean;
  }) => void;
  dispose: () => void;
};

const MAX_RECORDING_MS = 20_000;
const RECORDER_AUDIO_BITS_PER_SECOND = 96_000;
const RECORDER_STREAM_IDLE_RELEASE_MS = 8_000;
const AUDIO_CAPTURE_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 48_000,
  sampleSize: 16,
};

export function createVoiceChatController({ socket, refs, showToast }: CreateVoiceChatControllerOptions): VoiceChatController {
  let roomId: string | null = null;
  let role: RoomRole | null = null;
  let gameMode: GameMode = "multiplayer";
  let isGameActive = false;

  let chatPanelOpen = false;
  let unreadCount = 0;
  let lastSyncKey: string | null = null;
  let lastRenderedMessagesKey: string | null = null;

  let chatState: ChatStatePayload = {
    wAcceptsB: false,
    bAcceptsW: false,
    mutualConsent: false,
    messageCount: 0,
  };

  let messages: ChatMessage[] = [];
  const readMessageIds = new Set<string>();

  let recorder: MediaRecorder | null = null;
  let recorderStream: MediaStream | null = null;
  let recorderChunks: BlobPart[] = [];
  let recording = false;
  let recordingStartedAt = 0;
  let recordingMaxTimer: number | null = null;
  let recorderStreamReleaseTimer: number | null = null;
  let recorderMimeType = "audio/webm";

  const onChatState = (payload: ChatStatePayload): void => {
    chatState = payload;
    render();
  };

  const onChatMessages = (payload?: { messages?: ChatMessage[] }): void => {
    messages = Array.isArray(payload?.messages)
      ? payload.messages.slice().sort((a, b) => a.createdAt - b.createdAt)
      : [];

    if (chatPanelOpen) {
      markAllAsRead();
    } else {
      unreadCount = countUnreadIncoming();
    }

    render();
  };

  const onChatMessage = (payload?: { message?: ChatMessage }): void => {
    const message = payload?.message;
    if (!message || !roomId || message.roomId !== roomId) {
      return;
    }

    messages = [...messages, message].sort((a, b) => a.createdAt - b.createdAt).slice(-120);

    const incomingFromOpponent = isIncomingMessage(message);
    if (chatPanelOpen) {
      markAllAsRead();
    } else if (incomingFromOpponent) {
      unreadCount += 1;
    }

    render();
  };

  const onChatPurged = (): void => {
    messages = [];
    unreadCount = 0;
    chatState = {
      wAcceptsB: false,
      bAcceptsW: false,
      mutualConsent: false,
      messageCount: 0,
    };
    readMessageIds.clear();
    showToast("Chat and voice messages were permanently deleted for this room.");
    render();
  };

  const onFabClick = (): void => {
    if (!canUseChat()) {
      return;
    }

    chatPanelOpen = !chatPanelOpen;
    if (chatPanelOpen) {
      markAllAsRead();
      unreadCount = 0;
    }
    render();
  };

  const onCloseClick = (): void => {
    chatPanelOpen = false;
    render();
  };

  const onConsentClick = (): void => {
    if (!canUseChat()) {
      return;
    }

    socket.emit("chat:consent:set", { accept: !myConsent() });
  };

  const onSendClick = (): void => {
    void sendTextMessage();
  };

  const onInputKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void sendTextMessage();
  };

  const onVoicePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    void startRecording();
  };

  const onVoicePointerEnd = (): void => {
    void stopRecording();
  };

  const onVoiceKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    if (!recording) {
      void startRecording();
    }
  };

  const onVoiceKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== " " && event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    if (recording) {
      void stopRecording();
    }
  };

  socket.on("chat:state", onChatState);
  socket.on("chat:messages", onChatMessages);
  socket.on("chat:message", onChatMessage);
  socket.on("chat:purged", onChatPurged);

  refs.chatFabButton.addEventListener("click", onFabClick);
  refs.chatCloseButton.addEventListener("click", onCloseClick);
  refs.chatConsentButton.addEventListener("click", onConsentClick);
  refs.chatSendButton.addEventListener("click", onSendClick);
  refs.chatInput.addEventListener("keydown", onInputKeyDown);
  refs.chatVoiceButton.addEventListener("pointerdown", onVoicePointerDown);
  refs.chatVoiceButton.addEventListener("pointerup", onVoicePointerEnd);
  refs.chatVoiceButton.addEventListener("pointercancel", onVoicePointerEnd);
  refs.chatVoiceButton.addEventListener("pointerleave", onVoicePointerEnd);
  refs.chatVoiceButton.addEventListener("keydown", onVoiceKeyDown);
  refs.chatVoiceButton.addEventListener("keyup", onVoiceKeyUp);

  function canUseChat(): boolean {
    return gameMode === "multiplayer" && isGameActive && (role === "w" || role === "b") && Boolean(roomId);
  }

  function myConsent(): boolean {
    if (role === "w") {
      return chatState.wAcceptsB;
    }

    if (role === "b") {
      return chatState.bAcceptsW;
    }

    return false;
  }

  function opponentConsent(): boolean {
    if (role === "w") {
      return chatState.bAcceptsW;
    }

    if (role === "b") {
      return chatState.wAcceptsB;
    }

    return false;
  }

  function isIncomingMessage(message: ChatMessage): boolean {
    return role === "w" || role === "b"
      ? message.senderRole !== role
      : false;
  }

  function countUnreadIncoming(): number {
    return messages.filter((message) => isIncomingMessage(message) && !readMessageIds.has(message.id)).length;
  }

  function markAllAsRead(): void {
    for (const message of messages) {
      if (isIncomingMessage(message)) {
        readMessageIds.add(message.id);
      }
    }
  }

  function clearSessionState(): void {
    chatPanelOpen = false;
    unreadCount = 0;
    lastSyncKey = null;
    lastRenderedMessagesKey = null;
    messages = [];
    readMessageIds.clear();
    refs.chatInput.value = "";
    resetRecordingState();
    stopRecorderStream();
  }

  async function sendTextMessage(): Promise<void> {
    if (!canUseChat()) {
      return;
    }

    if (!chatState.mutualConsent) {
      showToast("Both players need to accept communication first.");
      return;
    }

    const text = refs.chatInput.value.trim();
    if (!text) {
      return;
    }

    socket.emit("chat:text:send", { text });
    refs.chatInput.value = "";
  }

  function resetRecordingState(): void {
    if (recordingMaxTimer !== null) {
      window.clearTimeout(recordingMaxTimer);
      recordingMaxTimer = null;
    }

    recording = false;
    recordingStartedAt = 0;
    recorderChunks = [];
    refs.chatVoiceButton.classList.remove("is-recording");
    refs.chatVoiceButton.textContent = "Hold to Talk";
  }

  function stopRecorderStream(): void {
    if (recorderStreamReleaseTimer !== null) {
      window.clearTimeout(recorderStreamReleaseTimer);
      recorderStreamReleaseTimer = null;
    }

    if (!recorderStream) {
      return;
    }

    for (const track of recorderStream.getTracks()) {
      track.stop();
    }
    recorderStream = null;
  }

  function scheduleRecorderStreamRelease(delayMs = RECORDER_STREAM_IDLE_RELEASE_MS): void {
    if (recording) {
      return;
    }

    if (recorderStreamReleaseTimer !== null) {
      window.clearTimeout(recorderStreamReleaseTimer);
    }

    recorderStreamReleaseTimer = window.setTimeout(() => {
      recorderStreamReleaseTimer = null;
      if (recording) {
        return;
      }
      stopRecorderStream();
    }, delayMs);
  }

  function chooseRecorderMimeType(): string {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
      return "audio/webm";
    }

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];

    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return "audio/webm";
  }

  async function ensureRecorderStream(): Promise<MediaStream | null> {
    if (recorderStreamReleaseTimer !== null) {
      window.clearTimeout(recorderStreamReleaseTimer);
      recorderStreamReleaseTimer = null;
    }

    if (recorderStream && recorderStream.active) {
      return recorderStream;
    }

    const mediaDevices = navigator.mediaDevices;
    if (mediaDevices?.getUserMedia) {
      try {
        recorderStream = await mediaDevices.getUserMedia({ audio: AUDIO_CAPTURE_CONSTRAINTS });
        return recorderStream;
      } catch (error) {
        const isInsecureContext = typeof window !== "undefined" && !window.isSecureContext;
        if (isInsecureContext) {
          showToast("Microphone capture requires HTTPS (or localhost).");
          return null;
        }

        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          showToast("Microphone permission was denied.");
          return null;
        }

        showToast("Could not access microphone input.");
        return null;
      }
    }

    const legacyNavigator = navigator as LegacyNavigatorMedia;
    const legacyGetUserMedia =
      legacyNavigator.webkitGetUserMedia
      ?? legacyNavigator.mozGetUserMedia
      ?? legacyNavigator.msGetUserMedia;

    if (!legacyGetUserMedia) {
      const isInsecureContext = typeof window !== "undefined" && !window.isSecureContext;
      showToast(
        isInsecureContext
          ? "Microphone capture requires HTTPS (or localhost)."
          : "Your browser does not support microphone capture.",
      );
      return null;
    }

    try {
      recorderStream = await new Promise<MediaStream>((resolve, reject) => {
        legacyGetUserMedia.call(
          navigator,
          { audio: AUDIO_CAPTURE_CONSTRAINTS },
          (stream) => resolve(stream),
          (error) => reject(error),
        );
      });
      return recorderStream;
    } catch {
      showToast("Microphone permission was denied.");
      return null;
    }
  }

  async function startRecording(): Promise<void> {
    if (!canUseChat()) {
      return;
    }

    if (!chatState.mutualConsent) {
      showToast("Both players need to accept communication first.");
      return;
    }

    if (recording) {
      return;
    }

    const stream = await ensureRecorderStream();
    if (!stream) {
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      scheduleRecorderStreamRelease(0);
      showToast("Voice notes are not supported in this browser.");
      return;
    }

    recorderChunks = [];
    recorderMimeType = chooseRecorderMimeType();

    const recorderOptionsCandidates: MediaRecorderOptions[] = [
      { mimeType: recorderMimeType, audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND },
      { mimeType: recorderMimeType },
      { audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND },
      {},
    ];

    recorder = null;
    for (const options of recorderOptionsCandidates) {
      try {
        recorder = new MediaRecorder(stream, options);
        break;
      } catch {
        // Try next options fallback.
      }
    }

    if (!recorder) {
      scheduleRecorderStreamRelease(0);
      showToast("Could not initialize voice recording.");
      return;
    }

    recorderMimeType = recorder.mimeType || recorderMimeType || "audio/webm";

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        recorderChunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      void finalizeRecording();
    };

    recording = true;
    recordingStartedAt = performance.now();
    refs.chatVoiceButton.classList.add("is-recording");
    refs.chatVoiceButton.textContent = "Release to Send";

    try {
      recorder.start();
      recordingMaxTimer = window.setTimeout(() => {
        void stopRecording();
      }, MAX_RECORDING_MS);
    } catch {
      recorder = null;
      resetRecordingState();
      scheduleRecorderStreamRelease(0);
      showToast("Could not start voice recording.");
    }
  }

  async function stopRecording(): Promise<void> {
    if (!recording || !recorder) {
      return;
    }

    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        resetRecordingState();
        scheduleRecorderStreamRelease();
      }
    }
  }

  async function finalizeRecording(): Promise<void> {
    const activeRecorder = recorder;
    const durationMs = Math.round(performance.now() - recordingStartedAt);
    const chunks = recorderChunks.slice();
    const mimeType = activeRecorder?.mimeType || recorderMimeType || "audio/webm";

    recorder = null;
    resetRecordingState();
    scheduleRecorderStreamRelease();

    if (!activeRecorder || !canUseChat() || !chatState.mutualConsent) {
      return;
    }

    if (durationMs < 250) {
      return;
    }

    const blob = new Blob(chunks, {
      type: mimeType,
    });

    if (blob.size < 600) {
      return;
    }

    const audioBase64 = await blobToBase64(blob);
    if (!audioBase64) {
      showToast("Could not encode voice note.");
      return;
    }

    socket.emit("chat:voice:send", {
      mimeType: blob.type || "audio/webm",
      audioBase64,
      durationMs,
    });
  }

  function blobToBase64(blob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = typeof reader.result === "string" ? reader.result : "";
        const commaIndex = data.indexOf(",");
        if (commaIndex < 0) {
          resolve(null);
          return;
        }

        resolve(data.slice(commaIndex + 1));
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDuration(durationMs: number): string {
    const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function renderMessages(): void {
    const messagesRenderKey = `${role ?? "spectator"}:${messages.map((message) => message.id).join("|")}`;
    if (messagesRenderKey === lastRenderedMessagesKey) {
      return;
    }

    const previousScrollTop = refs.chatMessages.scrollTop;
    const previousClientHeight = refs.chatMessages.clientHeight;
    const previousScrollHeight = refs.chatMessages.scrollHeight;
    const wasNearBottom = previousScrollHeight - (previousScrollTop + previousClientHeight) <= 28;

    if (messages.length === 0) {
      refs.chatMessages.innerHTML = '<div class="empty-state">No messages yet.</div>';
      refs.chatMessages.scrollTop = 0;
      lastRenderedMessagesKey = messagesRenderKey;
      return;
    }

    refs.chatMessages.innerHTML = messages.map((message) => {
      const mine = role === "w" || role === "b"
        ? message.senderRole === role
        : false;
      const bubbleClass = mine ? "chat-bubble mine" : "chat-bubble opp";
      const sender = escapeHtml(message.senderName || "Player");
      const time = formatTime(message.createdAt);

      if (message.kind === "text") {
        return `
          <article class="${bubbleClass}">
            <header class="chat-bubble-meta">${sender} • ${time}</header>
            <p class="chat-bubble-text">${escapeHtml(message.text)}</p>
          </article>
        `;
      }

      const src = `data:${message.mimeType};base64,${message.audioBase64}`;
      return `
        <article class="${bubbleClass}">
          <header class="chat-bubble-meta">${sender} • ${time} • ${formatDuration(message.durationMs)}</header>
          <audio controls preload="none">
            <source src="${src}" type="${message.mimeType}" />
            Your browser cannot play this voice note format.
          </audio>
        </article>
      `;
    }).join("");

    if (wasNearBottom) {
      refs.chatMessages.scrollTop = refs.chatMessages.scrollHeight;
    } else {
      refs.chatMessages.scrollTop = previousScrollTop;
    }

    lastRenderedMessagesKey = messagesRenderKey;
  }

  function renderStatus(): string {
    if (!canUseChat()) {
      return "Live chat is available only for seated multiplayer players during active matches.";
    }

    const mine = myConsent();
    const opp = opponentConsent();

    if (chatState.mutualConsent) {
      return "Communication active. You can send text and voice notes in real time.";
    }

    if (!mine && !opp) {
      return "Both players have communication blocked. Accept to start chatting.";
    }

    if (mine && !opp) {
      return "You accepted communication. Waiting for your opponent to accept.";
    }

    return "Your opponent accepted communication. Accept to start chatting.";
  }

  function render(): void {
    const enabled = canUseChat();

    refs.chatFabButton.hidden = !enabled;
    refs.chatPanel.hidden = !enabled || !chatPanelOpen;
    refs.chatStatusText.textContent = renderStatus();

    refs.chatConsentButton.textContent = myConsent()
      ? "Block Communication"
      : "Accept Communication";

    const canSend = enabled && chatState.mutualConsent;
    refs.chatInput.disabled = !canSend;
    refs.chatSendButton.disabled = !canSend;
    refs.chatVoiceButton.disabled = !canSend;

    if (!recording) {
      refs.chatVoiceButton.textContent = "Hold to Talk";
      refs.chatVoiceButton.classList.remove("is-recording");
    }

    if (unreadCount > 0) {
      refs.chatFabBadge.hidden = false;
      refs.chatFabBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    } else {
      refs.chatFabBadge.hidden = true;
      refs.chatFabBadge.textContent = "";
    }

    renderMessages();
  }

  function syncSession(context: {
    roomId: string | null;
    role: RoomRole | null;
    gameMode: GameMode;
    isGameActive: boolean;
  }): void {
    const previousRoomId = roomId;
    const sessionChanged =
      roomId !== context.roomId
      || role !== context.role
      || gameMode !== context.gameMode
      || isGameActive !== context.isGameActive;
    let shouldRender = sessionChanged;

    roomId = context.roomId;
    role = context.role;
    gameMode = context.gameMode;
    isGameActive = context.isGameActive;

    if (!roomId || roomId !== previousRoomId) {
      clearSessionState();
    }

    const syncKey = canUseChat() && role ? `${roomId}:${role}` : null;
    if (syncKey && syncKey !== lastSyncKey) {
      socket.emit("chat:sync");
      lastSyncKey = syncKey;
      shouldRender = true;
    }

    if (!syncKey) {
      if (chatPanelOpen) {
        shouldRender = true;
      }
      chatPanelOpen = false;

      if (lastSyncKey !== null) {
        shouldRender = true;
      }
      lastSyncKey = null;
      stopRecorderStream();
    }

    if (shouldRender) {
      render();
    }
  }

  function dispose(): void {
    socket.off("chat:state", onChatState);
    socket.off("chat:messages", onChatMessages);
    socket.off("chat:message", onChatMessage);
    socket.off("chat:purged", onChatPurged);

    refs.chatFabButton.removeEventListener("click", onFabClick);
    refs.chatCloseButton.removeEventListener("click", onCloseClick);
    refs.chatConsentButton.removeEventListener("click", onConsentClick);
    refs.chatSendButton.removeEventListener("click", onSendClick);
    refs.chatInput.removeEventListener("keydown", onInputKeyDown);
    refs.chatVoiceButton.removeEventListener("pointerdown", onVoicePointerDown);
    refs.chatVoiceButton.removeEventListener("pointerup", onVoicePointerEnd);
    refs.chatVoiceButton.removeEventListener("pointercancel", onVoicePointerEnd);
    refs.chatVoiceButton.removeEventListener("pointerleave", onVoicePointerEnd);
    refs.chatVoiceButton.removeEventListener("keydown", onVoiceKeyDown);
    refs.chatVoiceButton.removeEventListener("keyup", onVoiceKeyUp);

    if (recording && recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Ignore recorder stop failure on dispose.
      }
    }

    recorder = null;
    resetRecordingState();
    stopRecorderStream();
  }

  render();

  return {
    syncSession,
    dispose,
  };
}
