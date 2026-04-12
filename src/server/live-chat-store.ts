import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type ChatRole = "w" | "b";

export type ChatTextMessage = {
  id: string;
  roomId: string;
  senderRole: ChatRole;
  senderName: string;
  kind: "text";
  text: string;
  createdAt: number;
};

export type ChatVoiceMessage = {
  id: string;
  roomId: string;
  senderRole: ChatRole;
  senderName: string;
  kind: "voice";
  mimeType: string;
  audioBase64: string;
  durationMs: number;
  createdAt: number;
};

export type ChatStoredMessage = ChatTextMessage | ChatVoiceMessage;

type StoreSchema = {
  messages: ChatStoredMessage[];
};

type AddTextInput = {
  roomId: string;
  senderRole: ChatRole;
  senderName: string;
  text: string;
};

type AddVoiceInput = {
  roomId: string;
  senderRole: ChatRole;
  senderName: string;
  mimeType: string;
  audioBase64: string;
  durationMs: number;
};

export type LiveChatStore = {
  addTextMessage: (input: AddTextInput) => ChatTextMessage;
  addVoiceMessage: (input: AddVoiceInput) => ChatVoiceMessage;
  getRoomMessages: (roomId: string) => ChatStoredMessage[];
  deleteRoomMessages: (roomId: string) => number;
};

const MAX_MESSAGES_PER_ROOM = 120;

export function createLiveChatStore(projectRoot: string): LiveChatStore {
  const dataDir = path.join(projectRoot, "data");
  const filePath = path.join(dataDir, "live-chat-messages.json");
  const roomMessages = new Map<string, ChatStoredMessage[]>();

  load();

  function load(): void {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      persist();
      return;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoreSchema>;
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];

      for (const message of messages) {
        if (!message || typeof message !== "object") {
          continue;
        }

        const roomId = typeof message.roomId === "string" ? message.roomId : "";
        if (!roomId) {
          continue;
        }

        const list = roomMessages.get(roomId) ?? [];
        list.push(message as ChatStoredMessage);
        roomMessages.set(roomId, list);
      }
    } catch {
      roomMessages.clear();
      persist();
    }
  }

  function persist(): void {
    const payload: StoreSchema = {
      messages: [...roomMessages.values()].flat(),
    };

    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
    fs.renameSync(tmpPath, filePath);
  }

  function pushMessage(roomId: string, message: ChatStoredMessage): void {
    const list = roomMessages.get(roomId) ?? [];
    list.push(message);

    if (list.length > MAX_MESSAGES_PER_ROOM) {
      list.splice(0, list.length - MAX_MESSAGES_PER_ROOM);
    }

    roomMessages.set(roomId, list);
    persist();
  }

  function addTextMessage(input: AddTextInput): ChatTextMessage {
    const message: ChatTextMessage = {
      id: crypto.randomUUID(),
      roomId: input.roomId,
      senderRole: input.senderRole,
      senderName: input.senderName,
      kind: "text",
      text: input.text,
      createdAt: Date.now(),
    };

    pushMessage(input.roomId, message);
    return message;
  }

  function addVoiceMessage(input: AddVoiceInput): ChatVoiceMessage {
    const message: ChatVoiceMessage = {
      id: crypto.randomUUID(),
      roomId: input.roomId,
      senderRole: input.senderRole,
      senderName: input.senderName,
      kind: "voice",
      mimeType: input.mimeType,
      audioBase64: input.audioBase64,
      durationMs: input.durationMs,
      createdAt: Date.now(),
    };

    pushMessage(input.roomId, message);
    return message;
  }

  function getRoomMessages(roomId: string): ChatStoredMessage[] {
    const list = roomMessages.get(roomId) ?? [];
    return [...list].sort((a, b) => a.createdAt - b.createdAt);
  }

  function deleteRoomMessages(roomId: string): number {
    const removed = roomMessages.get(roomId)?.length ?? 0;
    roomMessages.delete(roomId);
    persist();
    return removed;
  }

  return {
    addTextMessage,
    addVoiceMessage,
    getRoomMessages,
    deleteRoomMessages,
  };
}
