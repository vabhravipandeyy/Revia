import { apiFetch } from '@/src/utils/apiFetch';
import { Space, SpaceMessage, CreateSpacePayload, UpdateSpacePayload } from '../types';

export async function listSpaces(): Promise<Space[]> {
  const result = await apiFetch<{ spaces: any[] }>('/spaces', {
    method: 'GET',
    auth: true,
  });
  return (result.spaces || []).map((s) => ({
    id: s.spaceId,
    name: s.name,
    description: s.description,
    vibe: s.vibe,
    theme: s.theme,
    agents: s.agents,
    coverImage: s.coverImage,
    isDefault: s.isDefault,
    lastMessagePreview: s.lastMessagePreview,
    lastMessageAt: s.lastMessageAt,
    lastActiveSpeakers: s.lastActiveSpeakers,
    currentTopic: s.currentTopic,
  }));
}

export async function getSpace(spaceId: string): Promise<Space> {
  const result = await apiFetch<{ space: any }>(`/spaces/${spaceId}`, {
    method: 'GET',
    auth: true,
  });
  const s = result.space;
  return {
    id: s.spaceId,
    name: s.name,
    description: s.description,
    vibe: s.vibe,
    theme: s.theme,
    agents: s.agents,
    coverImage: s.coverImage,
    isDefault: s.isDefault,
    lastMessagePreview: s.lastMessagePreview,
    lastMessageAt: s.lastMessageAt,
    lastActiveSpeakers: s.lastActiveSpeakers,
    currentTopic: s.currentTopic,
  };
}

export async function createSpace(payload: CreateSpacePayload): Promise<Space> {
  const result = await apiFetch<{ space: any }>('/spaces', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
  const s = result.space;
  return {
    id: s.spaceId,
    name: s.name,
    description: s.description,
    vibe: s.vibe,
    theme: s.theme,
    agents: s.agents,
    coverImage: s.coverImage,
    isDefault: s.isDefault,
    lastMessagePreview: s.lastMessagePreview,
    lastMessageAt: s.lastMessageAt,
    lastActiveSpeakers: s.lastActiveSpeakers,
    currentTopic: s.currentTopic,
  };
}

export async function updateSpace(spaceId: string, payload: UpdateSpacePayload): Promise<Space> {
  const result = await apiFetch<{ space: any }>(`/spaces/${spaceId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
  const s = result.space;
  return {
    id: s.spaceId,
    name: s.name,
    description: s.description,
    vibe: s.vibe,
    theme: s.theme,
    agents: s.agents,
    coverImage: s.coverImage,
    isDefault: s.isDefault,
    lastMessagePreview: s.lastMessagePreview,
    lastMessageAt: s.lastMessageAt,
    lastActiveSpeakers: s.lastActiveSpeakers,
    currentTopic: s.currentTopic,
  };
}

export async function deleteSpace(spaceId: string): Promise<void> {
  await apiFetch<{ message: string; spaceId: string }>(`/spaces/${spaceId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function listSpaceMessages(
  spaceId: string,
  options?: { limit?: number; lastKey?: string }
): Promise<{ messages: SpaceMessage[]; lastKey?: string }> {
  let url = `/spaces/${spaceId}/messages?newestFirst=true`;
  if (options?.limit) {
    url += `&limit=${options.limit}`;
  }
  if (options?.lastKey) {
    url += `&lastKey=${encodeURIComponent(options.lastKey)}`;
  }

  const result = await apiFetch<{ messages: any[]; lastKey: string | null }>(url, {
    method: 'GET',
    auth: true,
  });

  const messages: SpaceMessage[] = (result.messages || []).map((m) => ({
    id: m.messageId,
    spaceId: m.spaceId,
    senderId: m.senderId,
    senderType: m.senderType,
    senderName: m.senderName,
    text: m.text,
    replyTo: m.replyTo,
    timestamp: new Date(m.timestamp),
    metadata: m.metadata,
  }));

  return {
    messages,
    lastKey: result.lastKey || undefined,
  };
}
