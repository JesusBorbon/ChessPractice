import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type VoiceRole = "w" | "b";

export type VoiceStoredMessage = {
  id: string;
  roomId: string;
  senderRole: VoiceRole;
  receiverRole: VoiceRole;
  senderName: string;
  mimeType: string;
  audioBase64: string;
  durationMs: number;
  createdAt: number;
};

type VoiceStoreFileSchema = {
  messages: VoiceStoredMessage[];
};

type CreateVoiceMessageInput = {
  roomId: string;
  senderRole: VoiceRole;
  receiverRole: VoiceRole;
  senderName: string;
  mimeType: string;
  audioBase64: string;
  durationMs: number;
};

export type VoiceMessageStore = {
  addMessage: (input: CreateVoiceMessageInput) => VoiceStoredMessage;
  getMessagesForReceiver: (roomId: string, receiverRole: VoiceRole) => VoiceStoredMessage[];
  countMessagesForReceiver: (roomId: string, receiverRole: VoiceRole) => number;
  deleteRoomMessages: (roomId: string) => number;
};

const MAX_MESSAGES_PER_ROOM = 40;

export function createVoiceMessageStore(projectRoot: string): VoiceMessageStore {
  const storageDir = path.join(projectRoot, "data");
  const storageFilePath = path.join(storageDir, "voice-messages.json");

  const byRoom = new Map<string, VoiceStoredMessage[]>();

  loadFromDisk();

  function loadFromDisk(): void {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    if (!fs.existsSync(storageFilePath)) {
      persistToDisk();
      return;
    }

    try {
      const raw = fs.readFileSync(storageFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<VoiceStoreFileSchema>;
      const records = Array.isArray(parsed.messages) ? parsed.messages : [];
      for (const record of records) {
        if (!record || typeof record !== "object") {
          continue;
        }

        const roomId = typeof record.roomId === "string" ? record.roomId : "";
        if (!roomId) {
          continue;
        }

        const list = byRoom.get(roomId) ?? [];
        list.push(record as VoiceStoredMessage);
        byRoom.set(roomId, list);
      }
    } catch {
      byRoom.clear();
      persistToDisk();
    }
  }

  function persistToDisk(): void {
    const payload: VoiceStoreFileSchema = {
      messages: [...byRoom.values()].flat(),
    };

    const tmpPath = `${storageFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
    fs.renameSync(tmpPath, storageFilePath);
  }

  function addMessage(input: CreateVoiceMessageInput): VoiceStoredMessage {
    const message: VoiceStoredMessage = {
      id: crypto.randomUUID(),
      roomId: input.roomId,
      senderRole: input.senderRole,
      receiverRole: input.receiverRole,
      senderName: input.senderName,
      mimeType: input.mimeType,
      audioBase64: input.audioBase64,
      durationMs: input.durationMs,
      createdAt: Date.now(),
    };

    const list = byRoom.get(input.roomId) ?? [];
    list.push(message);

    if (list.length > MAX_MESSAGES_PER_ROOM) {
      list.splice(0, list.length - MAX_MESSAGES_PER_ROOM);
    }

    byRoom.set(input.roomId, list);
    persistToDisk();
    return message;
  }

  function getMessagesForReceiver(roomId: string, receiverRole: VoiceRole): VoiceStoredMessage[] {
    const list = byRoom.get(roomId) ?? [];
    return list.filter((message) => message.receiverRole === receiverRole);
  }

  function countMessagesForReceiver(roomId: string, receiverRole: VoiceRole): number {
    return getMessagesForReceiver(roomId, receiverRole).length;
  }

  function deleteRoomMessages(roomId: string): number {
    const removed = byRoom.get(roomId)?.length ?? 0;
    byRoom.delete(roomId);
    persistToDisk();
    return removed;
  }

  return {
    addMessage,
    getMessagesForReceiver,
    countMessagesForReceiver,
    deleteRoomMessages,
  };
}
