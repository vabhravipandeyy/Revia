import { Agent } from '@/src/types';
import { apiFetch } from '@/src/utils/apiFetch';

export interface PersonaRecord {
  personaId: string;
  name: string;
  age?: number;
  gender?: string;
  language?: string;
  traits?: string[];
  speakingStyle?: string[];
  emotionalTone?: string;
  relationshipType?: string;
  replyBehavior?: string;
  modelProvider?: string;
  modelName?: string;
  category?: string;
  spontaneityLevel?: string;
  editable?: boolean;
  lastMessageAt?: string | null;
  personaConfig?: {
    avatar?: string;
    tagline?: string;
    description?: string;
    lastMessage?: string;
    lastMessageAt?: string | null;
    status?: string;
    lastSeen?: string;
    responseSpeed?: string;
    isPinned?: boolean;
    isArchived?: boolean;
    theme?: {
      primary: string;
      secondary: string;
      gradient: string;
      vibe?: string;
    };
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonaPayload {
  name: string;
  age?: number;
  gender?: string;
  language?: string;
  traits?: string[];
  speakingStyle?: string[];
  emotionalTone?: string;
  relationshipType?: string;
  replyBehavior?: string;
  modelProvider?: string;
  modelName?: string;
  category?: string;
  spontaneityLevel?: string;
  editable?: boolean;
  personaConfig?: Record<string, unknown>;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildPersonaTheme(persona: PersonaRecord) {
  const tone = (persona.emotionalTone || '').toLowerCase();
  const gender = (persona.gender || '').toLowerCase();

  if (tone.includes('warm') || tone.includes('care')) {
    return {
      primary: '#E85D9B',
      secondary: '#F7C5D9',
      gradient: 'linear-gradient(135deg, #FFF3F7 0%, #FFE5EF 100%)',
      vibe: 'Warm',
    };
  }

  if (tone.includes('calm') || tone.includes('balanced')) {
    return {
      primary: '#4F8CFF',
      secondary: '#BED6FF',
      gradient: 'linear-gradient(135deg, #F1F6FF 0%, #E2EEFF 100%)',
      vibe: 'Calm',
    };
  }

  if (gender === 'male') {
    return {
      primary: '#06B6D4',
      secondary: '#A5F3FC',
      gradient: 'linear-gradient(135deg, #EFFCFF 0%, #DFF7FB 100%)',
      vibe: 'Focused',
    };
  }

  return {
    primary: '#6C63FF',
    secondary: '#C9C4FF',
    gradient: 'linear-gradient(135deg, #F4F2FF 0%, #ECE8FF 100%)',
    vibe: 'Reflective',
  };
}

function isRenderableAvatar(value: unknown) {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('blob:')) {
    return false;
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/photos/')
  ) {
    return true;
  }

  return false;
}

export function mapPersonaToAgent(persona: PersonaRecord): Agent {
  const resolvedTheme = persona.personaConfig?.theme || buildPersonaTheme(persona);
  const theme = {
    ...resolvedTheme,
    vibe: resolvedTheme.vibe || persona.emotionalTone || 'Companion',
  };
  const normalizedTraits = persona.traits || [];
  const speakingStyle = persona.speakingStyle || [];
  const resolvedAvatar = isRenderableAvatar(persona.personaConfig?.avatar)
    ? (persona.personaConfig?.avatar as string)
    : isRenderableAvatar(persona.personaConfig?.profileImage)
      ? (persona.personaConfig?.profileImage as string)
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(persona.name)}`;

  return {
    id: persona.personaId,
    name: persona.name,
    gender: (persona.gender as Agent['gender']) || 'female',
    personality: `${capitalize(persona.emotionalTone || 'balanced')} • ${persona.language || 'English'}`,
    avatar: resolvedAvatar,
    tagline:
      persona.personaConfig?.tagline ||
      (speakingStyle.length > 0
        ? speakingStyle.slice(0, 2).join(' • ')
        : normalizedTraits.slice(0, 2).join(' • ') || 'Emotionally present companion'),
    description:
      persona.personaConfig?.description || normalizedTraits.join(', ') || 'Emotionally intelligent persona',
    lastMessage: persona.personaConfig?.lastMessage || '',
    lastMessageAt: persona.lastMessageAt || persona.personaConfig?.lastMessageAt || null,
    status: (persona.personaConfig?.status as Agent['status']) || 'ready',
    age: persona.age,
    language: persona.language || 'English',
    conversationStyle: speakingStyle,
    lastSeen: persona.personaConfig?.lastSeen,
    responseSpeed: persona.personaConfig?.responseSpeed || persona.replyBehavior || 'Thoughtful',
    isPinned: Boolean(persona.personaConfig?.isPinned),
    isArchived: Boolean(persona.personaConfig?.isArchived),
    category: persona.category,
    spontaneityLevel: persona.spontaneityLevel,
    editable: persona.editable,
    theme,
  };
}

export async function listPersonas() {
  return apiFetch<{ personas: PersonaRecord[] }>('/personas', {
    method: 'GET',
    auth: true,
  });
}

export async function createPersona(payload: PersonaPayload) {
  return apiFetch<{ message: string; persona: PersonaRecord }>('/personas', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updatePersona(personaId: string, payload: Partial<PersonaPayload>) {
  return apiFetch<{ message: string; persona: PersonaRecord }>(`/personas/${personaId}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function deletePersona(personaId: string) {
  return apiFetch<{ message: string }>(`/personas/${personaId}`, {
    method: 'DELETE',
    auth: true,
  });
}
