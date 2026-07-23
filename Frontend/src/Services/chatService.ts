import { apiFetch } from '@/src/utils/apiFetch';

export interface ChatMessageRecord {
  messageId: string;
  conversationId: string;
  personaId: string;
  userId: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  replyToMessageId?: string;
  replyPreview?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'seen';
  metadata?: {
    chunks?: string[];
    chunkDelays?: number[];
    typingDelay?: number;
    thinkingDelay?: number;
    emotionalIntensity?: string;
    spontaneous?: boolean;
    chunkGroupId?: string;
    chunkIndex?: number;
    chunkCount?: number;
    delay?: number;
    moodState?: string;
    textingProfile?: {
      emojiFrequency?: string;
      textingEnergy?: string;
      expressiveLevel?: string;
    };
  };
}

export async function sendChatMessage(payload: {
  personaId: string;
  conversationId?: string;
  message: string;
  spontaneous?: boolean;
  timezone?: string;
  replyToMessageId?: string;
  replyPreview?: string;
  actionType?: 'generate' | 'seen' | 'delivered';
  messageId?: string;
  timestamp?: string;
}) {
  return apiFetch<{
    conversationId: string;
    spontaneous?: boolean;
    userMessage: ChatMessageRecord | null;
    assistantMessage: ChatMessageRecord | null;
    assistantMessages?: ChatMessageRecord[];
    fullAssistantText?: string;
    typingDelay?: number;
    chunks?: string[];
    chunkDelays?: number[];
    emotionalMetadata?: { intensity: string; spontaneous: boolean; moodState?: string };
    responseDelay?: number;
    memoriesUsed: Array<{ memoryId: string; summary: string; tags: string[] }>;
    model: { provider: string; name: string };
  }>('/chat/send', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getChatHistory(conversationId: string) {
  return apiFetch<{
    conversationId: string;
    messages: ChatMessageRecord[];
  }>(`/chat/history/${conversationId}`, {
    method: 'GET',
    auth: true,
  });
}
