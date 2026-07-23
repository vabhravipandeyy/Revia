const { randomUUID } = require('node:crypto');
const { retrieveRelevantMemories } = require('../memory/retrieve-relevant-memories');
const { buildMemorySummary } = require('../memory/build-memory-summary');
const {
  createConversationMessage,
  createConversationMessages,
  listConversationMessages,
  listRecentConversationMessages,
  buildConversationMessageKey,
  updateMessageStatus,
} = require('./chat-messages');
const { createMemory, savePersonalFact, listPersonaFacts } = require('./memories');
const { getPersonaById, updatePersona } = require('./personas');
const { generateResponse } = require('../models');
const {
  getRecentSpontaneousMessages,
  recordSpontaneousMessage,
  isMessageTooSimilar,
  extractRecentOpeners,
} = require('./spontaneous-history');
const {
  buildSpontaneousContext,
  buildSpontaneousUserPrompt,
} = require('./spontaneous-engine');

const EMOTIONAL_KEYWORDS = new Set([
  'sad', 'lonely', 'miss', 'cry', 'hurt', 'anxious', 'stress', 'love', 'excited', 'happy',
  'worried', 'scared', 'angry', 'fight', 'milestone', 'comfort', 'intimate', 'deep', 'feel',
  'heart', 'dil', 'pyaar', 'dukh', 'khush', 'udaas', 'darr', 'akela', 'yaad', 'rona', 'sorry'
]);

function shouldCreateMemory(messagesCount) {
  const interval = Number(process.env.MEMORY_SUMMARY_INTERVAL || 6);
  return messagesCount > 0 && messagesCount % interval === 0;
}

async function safelyRetrieveMemories({ userId, personaId, userMessage, recentMessages }) {
  try {
    return await retrieveRelevantMemories({
      userId,
      personaId,
      userMessage,
      recentMessages,
    });
  } catch (error) {
    console.error('Memory retrieval failed, continuing without memories', error);
    return [];
  }
}

const { generateGroqResponse } = require('../models/groq');

async function safelyCreateMemoryAndEvolveRelationship({ userId, personaId, persona, currentConversation }) {
  try {
    const transcript = currentConversation
      .map((msg) => `${msg.role === 'assistant' ? persona.name : 'User'}: ${msg.text}`)
      .join('\n');

    const systemPrompt = `You are the emotional cognitive engine of the companion '${persona.name}'.
Review the recent chat history between '${persona.name}' (you) and the User.
Based on this interaction, update your internal cognitive state, relationship metrics, conversational state (active/unresolved topics), and extract any permanent personal facts.

Current State:
- Closeness Score (0.0 to 1.0): ${persona.relationship?.closenessScore || 0.2}
- Comfort Level: ${persona.relationship?.comfortLevel || 'casual'}
- Inside Jokes: ${JSON.stringify(persona.relationship?.insideJokes || [])}
- Attachment Level: ${persona.relationship?.attachmentLevel || 'low'}
- Current Mood: ${persona.moodState || 'neutral'}
- Current Topic: "${persona.conversationalState?.currentTopic || ''}"
- Active Topics: ${JSON.stringify(persona.conversationalState?.activeTopics || [])}
- Unresolved Topics: ${JSON.stringify(persona.conversationalState?.unresolvedTopics || [])}
- Active Emotions: ${JSON.stringify(persona.conversationalState?.activeEmotions || [])}

Analyze the recent messages:
1. Did the relationship closeness grow or shrink? Adjust the Closeness Score (0.0 to 1.0) slightly (typically increments of 0.01 to 0.05 if positive, or decrements if cold/dry).
2. Did any inside jokes, nicknames, or repeated habits emerge? (Keep list under 5 items).
3. Evolve the Comfort Level ('formal', 'casual', 'warm', 'intimate', 'deep') and Attachment Level ('low', 'medium', 'high', 'deep') contextually.
4. Determine your new Mood State: choose from ('clingy', 'tired', 'energetic', 'emotional', 'playful', 'jealous', 'comforting', 'distant', 'neutral').
5. Extract a concise emotional memory summary (up to 150 characters) if any emotional moments, fights, comforting periods, or personal milestones were shared.
6. Extract any new permanent personal facts about the user (e.g. user's name, nickname, city, relationship status, favorite food/drink/activities, hobbies, family details, current life events). ONLY extract facts stated with high confidence. Do not include temporary or generic statements.
7. Track the conversational state:
   - Identify the primary current topic of discussion.
   - Identify currently active discussion topics.
   - Track unresolved topics (topics that require emotional follow-up or were left open/unresolved and need checking in later).
   - Identify any active emotions currently expressed or felt in the conversation (e.g. happy, stressed, anxious, warm, sad, playful).

Return your response as a valid JSON block only. Do not add markdown backticks. The JSON MUST follow this exact schema:
{
  "closenessScore": number,
  "comfortLevel": "string",
  "insideJokes": ["string"],
  "attachmentLevel": "string",
  "moodState": "string",
  "memorySummary": "string" or null,
  "personalFacts": [
    {
      "factKey": "string (lowercase, snake_case, e.g. user_name, city, relationship_status, favorite_drink)",
      "factValue": "string (the value, e.g. Shreyash, Mumbai, single, Latte)",
      "confidence": number (between 0.0 and 1.0)
    }
  ],
  "conversationalState": {
    "currentTopic": "string" or null,
    "activeTopics": ["string"],
    "activeEmotions": ["string"],
    "unresolvedTopics": [
      {
        "topic": "string",
        "lastMentionedText": "string (a brief quote or summary of what was said)"
      }
    ]
  }
}
`;

    const response = await generateGroqResponse({
      systemPrompt,
      userMessage: `Analyze recent transcript:\n\n${transcript}`,
      recentMessages: [],
    });

    let rawJsonText = response.text || '';
    if (rawJsonText.includes('```')) {
      rawJsonText = rawJsonText.replace(/```json|```/g, '').trim();
    }

    const evolved = JSON.parse(rawJsonText);
    console.log('Evolved persona relationship & mood & facts & topics:', evolved);

    const updatedRelationship = {
      closenessScore: Math.max(0.0, Math.min(1.0, Number(evolved.closenessScore) || persona.relationship.closenessScore || 0.2)),
      comfortLevel: evolved.comfortLevel || persona.relationship.comfortLevel || 'casual',
      attachmentLevel: evolved.attachmentLevel || persona.relationship.attachmentLevel || 'low',
      insideJokes: Array.isArray(evolved.insideJokes) ? evolved.insideJokes.slice(0, 5) : (persona.relationship.insideJokes || []),
      lastInteractionTime: new Date().toISOString(),
      interactionCount: persona.relationship.interactionCount || 0,
    };

    const newMoodState = evolved.moodState || persona.moodState || 'neutral';

    const updatedConversationalState = {
      currentTopic: evolved.conversationalState?.currentTopic || persona.conversationalState?.currentTopic || null,
      activeTopics: Array.isArray(evolved.conversationalState?.activeTopics) ? evolved.conversationalState.activeTopics : [],
      activeEmotions: Array.isArray(evolved.conversationalState?.activeEmotions) ? evolved.conversationalState.activeEmotions : [],
      unresolvedTopics: Array.isArray(evolved.conversationalState?.unresolvedTopics) ? evolved.conversationalState.unresolvedTopics : [],
      lastAskedQuestions: Array.isArray(persona.conversationalState?.lastAskedQuestions) ? persona.conversationalState.lastAskedQuestions : [],
      lastFollowUpTimestamp: evolved.conversationalState?.lastFollowUpTimestamp || persona.conversationalState?.lastFollowUpTimestamp || null,
    };

    await updatePersona(userId, personaId, {
      relationship: updatedRelationship,
      moodState: newMoodState,
      conversationalState: updatedConversationalState,
    });

    if (evolved.memorySummary && evolved.memorySummary.trim()) {
      await createMemory({
        userId,
        personaId,
        summary: evolved.memorySummary.trim(),
        embeddingText: transcript.slice(-1000),
        tags: evolved.insideJokes || [],
      });
      console.log('Created emotional memory:', evolved.memorySummary);
    }

    if (Array.isArray(evolved.personalFacts)) {
      for (const fact of evolved.personalFacts) {
        if (fact.factKey && fact.factValue) {
          const cleanedKey = String(fact.factKey).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
          await savePersonalFact({
            userId,
            personaId,
            factKey: cleanedKey,
            factValue: String(fact.factValue).trim(),
            confidence: Number(fact.confidence) || 1.0,
          });
          console.log(`Saved personal fact: key=${cleanedKey}, value=${fact.factValue}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to evolve relationship and create memory:', error);
  }
}

function inferEmotionalIntensity(text, persona) {
  const normalized = String(text || '').toLowerCase();
  const emotionalTokens = [
    'sad',
    'lonely',
    'miss',
    'cry',
    'hurt',
    'anxious',
    'stress',
    'love',
    'off',
    'mood',
    'tired',
    'upset',
    'scared',
    'happy',
    'excited',
  ];
  const tokenHits = emotionalTokens.filter((token) => normalized.includes(token)).length;
  const personaTone = String(persona?.emotionalTone || '').toLowerCase();

  if (tokenHits >= 2 || personaTone.includes('deep') || personaTone.includes('warm')) {
    return 'high';
  }

  if (tokenHits === 1 || personaTone.includes('support')) {
    return 'medium';
  }

  return 'low';
}

function pickScaleValue(value, fallback = 'medium') {
  const normalized = String(value || fallback).toLowerCase();
  if (normalized.includes('low') || normalized.includes('minimal') || normalized.includes('quiet')) {
    return 'low';
  }
  if (normalized.includes('high') || normalized.includes('max') || normalized.includes('bubbly') || normalized.includes('loud')) {
    return 'high';
  }
  return 'medium';
}

function normalizeTextingProfile(persona) {
  const config = persona?.personaConfig || {};
  const traits = (persona?.traits || []).map((trait) => String(trait).toLowerCase());
  const style = (persona?.speakingStyle || []).map((item) => String(item).toLowerCase()).join(' ');
  const tone = String(persona?.emotionalTone || '').toLowerCase();
  const relationshipType = String(persona?.relationshipType || '').toLowerCase();

  let textingEnergy = pickScaleValue(config.textingEnergy, 'medium');
  let expressiveLevel = pickScaleValue(config.expressiveLevel, 'medium');
  let emojiFrequency = pickScaleValue(config.emojiFrequency, 'low');

  if (traits.some((trait) => ['bubbly', 'fun', 'expressive', 'cheerful', 'upbeat'].includes(trait))) {
    textingEnergy = 'high';
    expressiveLevel = 'high';
    emojiFrequency = emojiFrequency === 'low' ? 'medium' : emojiFrequency;
  }

  if (traits.some((trait) => ['sarcastic', 'mysterious', 'brief', 'quiet', 'logical'].includes(trait))) {
    expressiveLevel = expressiveLevel === 'high' ? 'medium' : expressiveLevel;
    emojiFrequency = 'low';
  }

  if (style.includes('slow paced') || tone.includes('thoughtful') || relationshipType === 'mentor') {
    textingEnergy = textingEnergy === 'high' ? 'medium' : textingEnergy;
  }

  return {
    emojiFrequency,
    textingEnergy,
    expressiveLevel,
    typoFrequency: pickScaleValue(config.typoFrequency, textingEnergy === 'high' ? 'medium' : 'low'),
    fillerFrequency: pickScaleValue(config.fillerFrequency, expressiveLevel),
    lowercaseBias: config.lowercaseBias !== false,
    followUpStyle: config.followUpStyle || (relationshipType.includes('best') ? 'warm-check-in' : 'minimal'),
    moodPalette: Array.isArray(config.moodPalette) && config.moodPalette.length > 0
      ? config.moodPalette
      : ['present', 'soft', 'playful'],
  };
}

function pickMoodState({ persona, emotionalIntensity, spontaneous, recentMessages }) {
  const profile = normalizeTextingProfile(persona);
  const lastUserText = String(
    recentMessages.filter((message) => message.role === 'user').slice(-1)[0]?.text || ''
  ).toLowerCase();

  if (/(sad|miss|hurt|off|lonely|stress|tired|cry)/.test(lastUserText)) {
    return 'soft';
  }
  if (/(haha|lol|lmao|yay|excited|party)/.test(lastUserText)) {
    return 'excited';
  }
  if (spontaneous && profile.textingEnergy === 'high') {
    return 'clingy';
  }
  if (emotionalIntensity === 'high') {
    return 'warm';
  }
  if (profile.textingEnergy === 'low') {
    return 'dry';
  }

  const palette = profile.moodPalette;
  return String(palette[Math.floor(Math.random() * palette.length)] || 'present').toLowerCase();
}

function cleanupChunkText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

function applyHumanTextingFinish(text, { persona, moodState, profile, index, totalChunks }) {
  let result = cleanupChunkText(text);

  if (!result) {
    return '';
  }

  if (profile.lowercaseBias && profile.textingEnergy !== 'low') {
    result = result.charAt(0).toLowerCase() + result.slice(1);
  }

  if (profile.textingEnergy === 'high' && /[a-z]{3,}/i.test(result) && Math.random() < 0.18) {
    result = result.replace(/\b([a-zA-Z]{3,})\b/, (word) => `${word}${word.slice(-1)}`);
  }

  if (profile.typoFrequency !== 'low' && moodState !== 'dry' && Math.random() < 0.08) {
    result = result.replace(/\b(hai|really|kya|yaar)\b/i, (word) => `${word}${word.slice(-1)}`);
  }

  if (
    profile.emojiFrequency === 'high' &&
    !/[!?.]$/.test(result) &&
    index === totalChunks - 1 &&
    Math.random() < 0.25
  ) {
    result = `${result} :)`;
  }

  return cleanupChunkText(result);
}

function splitByTextingPauses(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((chunk) => cleanupChunkText(chunk))
    .filter(Boolean);
}

function splitLongChunk(chunk, desiredCount) {
  if (!chunk || desiredCount <= 1) {
    return [chunk].filter(Boolean);
  }

  const words = chunk.split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return [chunk];
  }

  const parts = [];
  const segmentSize = Math.ceil(words.length / desiredCount);
  for (let index = 0; index < words.length; index += segmentSize) {
    parts.push(words.slice(index, index + segmentSize).join(' '));
  }
  return parts.map(cleanupChunkText).filter(Boolean);
}

function splitAssistantReplyIntoChunks(text, persona, moodState) {
  const trimmed = cleanupChunkText(text);
  if (!trimmed) return [];

  // Split strictly by sentence boundaries
  const sentences = splitByTextingPauses(trimmed);
  if (sentences.length === 0) return [];

  // Group sentences into at most 2-3 chunks of uneven sizes
  const chunks = [];
  if (sentences.length <= 1) {
    chunks.push(sentences[0]);
  } else if (sentences.length === 2) {
    chunks.push(sentences[0]);
    chunks.push(sentences[1]);
  } else if (sentences.length === 3) {
    if (Math.random() < 0.5) {
      chunks.push(sentences[0]);
      chunks.push(sentences.slice(1).join(' '));
    } else {
      chunks.push(sentences.slice(0, 2).join(' '));
      chunks.push(sentences[2]);
    }
  } else {
    const targetChunks = Math.random() < 0.4 ? 2 : 3;
    if (targetChunks === 2) {
      const splitIdx = Math.floor(sentences.length / 2) + (Math.random() < 0.5 ? 0 : 1);
      chunks.push(sentences.slice(0, splitIdx).join(' '));
      chunks.push(sentences.slice(splitIdx).join(' '));
    } else {
      const size1 = Math.max(1, Math.floor(sentences.length / 3));
      const size2 = Math.max(1, Math.floor((sentences.length - size1) / 2));
      chunks.push(sentences.slice(0, size1).join(' '));
      chunks.push(sentences.slice(size1, size1 + size2).join(' '));
      chunks.push(sentences.slice(size1 + size2).join(' '));
    }
  }

  const profile = normalizeTextingProfile(persona);
  const cleaned = chunks
    .map((chunk, index) =>
      applyHumanTextingFinish(chunk, {
        persona,
        moodState,
        profile,
        index,
        totalChunks: chunks.length,
      })
    )
    .filter(Boolean);

  return cleaned.length > 0 ? cleaned : [trimmed];
}

function buildDeliveryPlan({ text, persona, spontaneous, recentMessages, delayWindow, timezone }) {
  const emotionalIntensity = inferEmotionalIntensity(text, persona);
  const profile = normalizeTextingProfile(persona);
  const moodState = pickMoodState({
    persona,
    emotionalIntensity,
    spontaneous,
    recentMessages,
  });
  const chunks = splitAssistantReplyIntoChunks(text, persona, moodState);
  const charCount = chunks.join(' ').length;

  // Determine baseline response delay range (in seconds) based on message length
  let minSeconds = 20;
  let maxSeconds = 90;

  if (charCount > 120) {
    minSeconds = 60;
    maxSeconds = 150;
  } else if (charCount >= 40) {
    minSeconds = 45;
    maxSeconds = 120;
  } else {
    minSeconds = 20;
    maxSeconds = 90;
  }

  // Emotional messages pacing adjustment
  if (emotionalIntensity === 'high') {
    minSeconds = Math.max(minSeconds, 60);
    maxSeconds = Math.max(maxSeconds, 180);
  }

  // Time of Day pacing adjustment (late-night: 11 PM - 6 AM in user timezone)
  let hour = new Date().getHours();
  if (timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone,
      });
      const parts = formatter.formatToParts(new Date());
      const hourPart = parts.find(part => part.type === 'hour');
      if (hourPart) {
        hour = parseInt(hourPart.value, 10);
      }
    } catch (e) {
      console.warn(`Failed to format time with timezone: ${timezone}`, e);
    }
  }
  const isLateNight = hour >= 23 || hour < 6;
  if (isLateNight) {
    const timeMultiplier = 1.3 + Math.random() * 0.5; // +30% to +80% delay
    minSeconds = Math.round(minSeconds * timeMultiplier);
    maxSeconds = Math.round(maxSeconds * timeMultiplier);
  }

  // Mood-based pacing adjustments
  const mood = moodState.toLowerCase();
  if (mood === 'tired' || mood === 'distant' || mood === 'dry') {
    const moodMultiplier = 1.4 + Math.random() * 0.6; // +40% to +100% delay
    minSeconds = Math.round(minSeconds * moodMultiplier);
    maxSeconds = Math.round(maxSeconds * moodMultiplier);
  } else if (mood === 'excited' || mood === 'clingy') {
    const moodMultiplier = 0.6 + Math.random() * 0.2; // -20% to -40% faster
    minSeconds = Math.round(minSeconds * moodMultiplier);
    maxSeconds = Math.round(maxSeconds * moodMultiplier);
  }

  // Calculate final delay with a random roll in the computed range
  const rolledSeconds = minSeconds + Math.random() * (maxSeconds - minSeconds);
  let totalDelayMs = Math.round(rolledSeconds * 1000);

  // Absolute clamp for safety/usability (5s to 180s)
  totalDelayMs = Math.max(5000, Math.min(180000, totalDelayMs));

  // Split totalDelayMs into typingDelay (proportional to message size) and thinkingDelay
  const firstChunkText = chunks[0] || '';
  const msPerChar = 50;
  const baseTypingMs = 1200;
  const typingDelay = Math.max(1200, Math.min(12000, baseTypingMs + firstChunkText.length * msPerChar));
  const thinkingDelay = Math.max(0, totalDelayMs - typingDelay);

  // Subsequent chunk delays represent the pause between separate message bursts.
  // The first chunk delay in the DB will represent total delay (thinking + typing).
  const chunkDelays = chunks.map((chunk, index) => {
    if (index === 0) {
      return totalDelayMs;
    }

    // Small pause between message bursts (2 to 5 seconds)
    let pauseMs = 2000 + Math.round(Math.random() * 3000);

    if (profile.textingEnergy === 'high') {
      pauseMs = 1200 + Math.round(Math.random() * 1500); // faster bursts
    } else if (profile.textingEnergy === 'low' || mood === 'dry' || mood === 'tired') {
      pauseMs = 3500 + Math.round(Math.random() * 2500); // slower pauses
    }

    if (chunk.length > 50) {
      pauseMs += 1000;
    }

    return pauseMs;
  });

  return {
    chunks,
    chunkDelays,
    typingDelay,
    thinkingDelay,
    emotionalIntensity,
    moodState,
    textingProfile: profile,
  };
}



function buildChunkTimestamps(initialTimestamp, chunkDelays) {
  const timestamps = [];
  let elapsed = 0;
  const base = new Date(initialTimestamp).getTime();

  for (let index = 0; index < chunkDelays.length; index += 1) {
    elapsed += chunkDelays[index] || 0;
    timestamps.push(new Date(base + elapsed).toISOString());
  }

  return timestamps;
}

async function schedulePersonaReply({
  userId,
  personaId,
  conversationId,
  userMessage,
  replyToMessageId,
  replyPreview,
  spontaneous,
  delayWindow,
  timezone
}) {
  let persona = await getPersonaById(userId, personaId);

  if (!persona) {
    const error = new Error('Persona not found');
    error.name = 'NotFoundError';
    throw error;
  }

  // Layer 1: Short Term Context
  const recentMessages = await listRecentConversationMessages(userId, conversationId, 35);

  // Dynamic Inactivity Mood Shift
  const lastMsg = recentMessages[recentMessages.length - 1];
  if (lastMsg && lastMsg.timestamp) {
    const elapsedHours = (Date.now() - new Date(lastMsg.timestamp).getTime()) / (3600 * 1000);
    if (elapsedHours > 24 && (persona.relationship?.closenessScore || 0) > 0.5) {
      const roll = Math.random();
      let newMood = 'neutral';
      if (roll < 0.35) newMood = 'clingy';
      else if (roll < 0.70) newMood = 'distant';
      else if (roll < 0.90) newMood = 'tired';
      else newMood = 'emotional';
      
      if (persona.moodState !== newMood) {
        persona.moodState = newMood;
        await updatePersona(userId, personaId, { moodState: newMood });
        console.log(`Silence of ${elapsedHours.toFixed(1)}h triggered inactivity mood shift for ${persona.name} to: ${newMood}`);
      }
    }
  }

  // Layer 2: Emotional Memory
  const memories = await safelyRetrieveMemories({
    userId,
    personaId,
    userMessage: spontaneous ? recentMessages.slice(-3).map((message) => message.text).join(' ') || 'general check-in' : userMessage,
    recentMessages,
  });

  const personaFacts = await listPersonaFacts(userId, personaId);

  // Spontaneous message check
  if (spontaneous) {
    const closenessScore = persona.relationship?.closenessScore || 0.0;
    const closenessPassed = closenessScore >= 0.25;

    let inactivityPassed = true;
    if (recentMessages.length > 0) {
      const lastMessage = recentMessages[recentMessages.length - 1];
      const lastMessageTime = new Date(lastMessage.timestamp).getTime();
      const elapsedHours = (Date.now() - lastMessageTime) / (3600 * 1000);
      if (elapsedHours < 3) {
        inactivityPassed = false;
      }
    }

    const unresolvedTopics = persona.conversationalState?.unresolvedTopics || [];
    
    const hasEmotionalMemory = memories.some((memory) => {
      const summary = String(memory.summary || '').toLowerCase();
      return Array.from(EMOTIONAL_KEYWORDS).some((keyword) => summary.includes(keyword));
    });

    const hasContext = (unresolvedTopics.length > 0) || hasEmotionalMemory;

    if (!closenessPassed || !inactivityPassed || !hasContext) {
      console.log(`Spontaneous message skipped: closenessPassed=${closenessPassed}, inactivityPassed=${inactivityPassed}, hasContext=${hasContext}`);
      return {
        status: 'skipped',
        reason: `filter_failed (closeness:${closenessPassed}, inactivity:${inactivityPassed}, context:${hasContext})`,
      };
    }
  }

  // Save the user message to DynamoDB
  let savedUserMessage = null;
  if (!spontaneous) {
    savedUserMessage = await createConversationMessage({
      userId,
      personaId,
      conversationId,
      role: 'user',
      text: userMessage,
      replyToMessageId,
      replyPreview,
      status: 'sent',
    });
  }

  // Thread tracking
  let state = persona.conversationalState || {};
  if (!state.activeConversationThread) {
    state.activeConversationThread = randomUUID();
  }
  if (!state.unresolvedThreadIds) {
    state.unresolvedThreadIds = [];
  }
  if (savedUserMessage) {
    state.unresolvedThreadIds.push(savedUserMessage.messageId);
  }

  // Create or Merge pending reply snapshot
  let pendingReply = state.pendingReply || null;
  const isStale = pendingReply && pendingReply.scheduledAt &&
    (new Date().getTime() - new Date(pendingReply.scheduledAt).getTime() > 5 * 60 * 1000);

  if (pendingReply && !spontaneous && !isStale) {
    pendingReply.mergedMessages = pendingReply.mergedMessages || [];
    pendingReply.mergedMessages.push(userMessage);
    pendingReply.replyTargetText = pendingReply.mergedMessages.join(' | ');
    pendingReply.replyTargetMessageId = savedUserMessage.messageId;
    console.log(`Merged message into existing pending reply for persona ${personaId}`);
  } else {
    if (isStale) {
      console.log(`Previous pending reply for persona ${personaId} was stale (scheduled at ${pendingReply.scheduledAt}). Starting a fresh reply schedule.`);
    }
    pendingReply = {
      replyTargetMessageId: savedUserMessage ? savedUserMessage.messageId : null,
      replyTargetText: userMessage || 'general check-in',
      mergedMessages: userMessage ? [userMessage] : [],
      memorySnapshot: memories,
      personaFactsSnapshot: personaFacts,
      topicSnapshot: state.currentTopic || 'general',
      relationshipSnapshot: JSON.parse(JSON.stringify(persona.relationship || {})),
      timezone: timezone || 'UTC',
      delayWindow,
      scheduledAt: new Date().toISOString(),
    };
  }

  // Estimate pacing delay (thinking delay)
  const charCount = pendingReply.replyTargetText.length;
  let minThinking = 6;
  let maxThinking = 20;
  if (charCount > 100) {
    minThinking = 10;
    maxThinking = 30;
  }
  const rolledThinking = minThinking + Math.random() * (maxThinking - minThinking);
  let thinkingDelay = Math.round(rolledThinking * 1000);

  // Set read receipt delay (seen delay)
  const readDelay = Math.max(2000, Math.round(2000 + Math.random() * 18000)); // 2-20s random

  // Update persona
  state.pendingReply = pendingReply;
  state.lastReplyTarget = pendingReply.replyTargetMessageId;
  await updatePersona(userId, personaId, { conversationalState: state });

  return {
    status: 'scheduled',
    thinkingDelay,
    readDelay,
    userMessage: savedUserMessage,
    conversationId,
    personaId,
  };
}

function validateResponseQuality(text, targetMessageText) {
  const normalized = String(text || '').toLowerCase();
  
  // 1. Too assistant-like declarations
  const assistantPhrases = [
    'as an ai', 'i am an ai', 'how can i help you', 'assist you', 'system prompt',
    'haan main sarcastic hu', 'haan main ajeeb hu', 'haan mein sarcastic hu', 'haan mein ajeeb hu',
    'according to my memory', 'in my memory'
  ];
  if (assistantPhrases.some(phrase => normalized.includes(phrase))) {
    return { valid: false, reason: 'assistant_like_phrases' };
  }

  // 2. Overexplaining / too long (e.g. if the user message was tiny and AI responds with a huge paragraph of >300 chars)
  if (targetMessageText && targetMessageText.length < 15 && text.length > 300) {
    return { valid: false, reason: 'overexplaining_short_target' };
  }

  // 3. Repeated sentence starts (e.g., "Main toh...", "Main toh...", or "Haa...", "Haa...")
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length > 1) {
    const starts = sentences.map(s => s.split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
    const uniqueStarts = new Set(starts);
    if (starts.length - uniqueStarts.size >= 2) {
      return { valid: false, reason: 'repeated_sentence_starts' };
    }
  }

  return { valid: true };
}

async function generatePersonaReply({ userId, personaId, conversationId }) {
  let persona = await getPersonaById(userId, personaId);
  if (!persona) {
    const error = new Error('Persona not found');
    error.name = 'NotFoundError';
    throw error;
  }

  const state = persona.conversationalState || {};
  const pendingReply = state.pendingReply;
  if (!pendingReply) {
    return { status: 'skipped', reason: 'no_pending_reply' };
  }

  const targetMessageId = pendingReply.replyTargetMessageId;
  const targetMessageText = pendingReply.replyTargetText;
  const memories = pendingReply.memorySnapshot || [];
  const personaFacts = pendingReply.personaFactsSnapshot || [];
  const timezone = pendingReply.timezone || 'UTC';
  const delayWindow = pendingReply.delayWindow;
  const spontaneous = targetMessageId === null;

  const recentMessages = await listRecentConversationMessages(userId, conversationId, 35);

  let spontaneousContext = null;
  let aiUserMessage = targetMessageText;

  if (spontaneous) {
    try {
      spontaneousContext = await buildSpontaneousContext(userId, personaId, conversationId);
      aiUserMessage = buildSpontaneousUserPrompt(spontaneousContext);
    } catch (error) {
      console.error('Failed to build spontaneous context, using fallback', error);
      aiUserMessage =
        '[The user has not sent a new message. You are reaching out first like a real person who suddenly thought of them. Send a short, natural texting-style opener in 1 to 3 tiny bursts. Use past emotional context if relevant, but do not invent events. DO NOT use generic greetings like "kaise ho" or "kya chal raha hai".]';
    }
  }

  const maxAttempts = 3; // run filter checks for both
  let assistantText = '';
  let modelResponse = null;
  let recentSpontaneousMessages = [];

  if (spontaneous) {
    try {
      recentSpontaneousMessages = await getRecentSpontaneousMessages(userId, personaId, 10);
    } catch (error) {
      console.error('Failed to fetch spontaneous history for anti-repetition', error);
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let currentUserMessage = aiUserMessage;

    if (attempt > 0 && spontaneous) {
      const recentTexts = recentSpontaneousMessages.map((m) => m.messageText || '').filter(Boolean);
      currentUserMessage = [
        aiUserMessage,
        '',
        `⚠️ RETRY ${attempt}: Your previous attempt was too similar to recent messages.`,
        'Generate something COMPLETELY DIFFERENT in structure, wording, and emotional approach.',
        recentTexts.length > 0 ? `Avoid anything resembling: ${recentTexts.slice(0, 3).map((t) => `"${t.slice(0, 50)}"`).join(', ')}` : '',
      ].filter(Boolean).join('\n');
    }

    modelResponse = await generateResponse({
      provider: 'groq',
      model: persona.modelName || process.env.GROQ_MODEL || process.env.DEFAULT_MODEL_NAME || 'llama-3.3-70b-versatile',
      persona,
      memories,
      recentMessages,
      userMessage: currentUserMessage,
      spontaneousContext: spontaneous ? spontaneousContext : undefined,
      personaFacts,
      timezone,
    });

    assistantText = cleanupChunkText(modelResponse?.text || '');

    if (!assistantText) {
      continue;
    }

    // Spontaneous anti-repetition check
    if (spontaneous && recentSpontaneousMessages.length > 0 && attempt < maxAttempts - 1) {
      if (isMessageTooSimilar(assistantText, recentSpontaneousMessages, 0.4)) {
        console.log(`Spontaneous message attempt ${attempt + 1} too similar, retrying...`);
        continue;
      }
    }

    // Quality controls check
    const qualityResult = validateResponseQuality(assistantText, targetMessageText);
    if (!qualityResult.valid && attempt < maxAttempts - 1) {
      console.log(`Generated response attempt ${attempt + 1} rejected by quality filter: ${qualityResult.reason}. Retrying...`);
      continue;
    }

    break;
  }

  if (!assistantText) {
    assistantText = "pata nahi... thoda weird lag raha hai abhi 😭";
  }

  // Spontaneous post-gen greeting filter
  if (spontaneous) {
    const genericTriggers = [
      'kya kar rahe ho',
      'kya kar rhe ho',
      'kya chal raha hai',
      'kya chal rha hai',
      'aur batao',
      'aur batao kya chal raha',
      'what are you doing',
      'what\'s up',
      'how are you'
    ];
    const normalizedText = assistantText.toLowerCase();
    const isGeneric = genericTriggers.some(trigger => normalizedText.includes(trigger));
    if (isGeneric) {
      console.log(`Spontaneous message skipped (generic content detected): "${assistantText}"`);
      // Clear pending state
      state.pendingReply = null;
      await updatePersona(userId, personaId, { conversationalState: state });
      return {
        status: 'skipped',
        reason: 'generic_content_detected',
      };
    }
  }

  // Spontaneous record
  if (spontaneous) {
    try {
      await recordSpontaneousMessage(userId, personaId, assistantText);
    } catch (error) {
      console.error('Failed to record spontaneous message', error);
    }
  }

  // Programmatic question tracking
  const newQuestions = assistantText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.endsWith('?'));

  if (newQuestions.length > 0) {
    try {
      const prevQuestions = persona.conversationalState?.lastAskedQuestions || [];
      const mergedQuestions = [...new Set([...newQuestions, ...prevQuestions])].slice(0, 5);
      
      if (!persona.conversationalState) {
        persona.conversationalState = {};
      }
      persona.conversationalState.lastAskedQuestions = mergedQuestions;
      await updatePersona(userId, personaId, {
        conversationalState: persona.conversationalState,
      });
    } catch (err) {
      console.error('Failed to update programmatic questions:', err);
    }
  }

  const chunks = splitAssistantReplyIntoChunks(assistantText, persona, persona.moodState || 'neutral');

  // Build pacing / typing delays
  const firstChunkText = chunks[0] || '';
  const msPerChar = 50;
  const baseTypingMs = 1200;
  const typingDelay = Math.max(1200, Math.min(12000, baseTypingMs + firstChunkText.length * msPerChar));

  const chunkDelays = chunks.map((chunk, index) => {
    if (index === 0) return typingDelay;
    return 1800 + Math.round(Math.random() * 2200); // 1.8 - 4s pause
  });

  const createdAt = new Date().toISOString();
  const chunkTimestamps = buildChunkTimestamps(createdAt, chunkDelays);
  const chunkGroupId = `${conversationId}-${Date.now()}`;

  const assistantMessages = await createConversationMessages(
    chunks.map((chunk, index) => ({
      userId,
      personaId,
      conversationId,
      role: 'assistant',
      text: chunk,
      timestamp: chunkTimestamps[index],
      replyToMessageId: targetMessageId || undefined,
      replyPreview: targetMessageText || undefined,
      status: 'sent',
      metadata: {
        chunkGroupId,
        chunkIndex: index,
        chunkCount: chunks.length,
        delay: chunkDelays[index],
        typingDelay,
        thinkingDelay: 0,
        spontaneous: !!spontaneous,
        moodState: persona.moodState,
      },
    }))
  );

  // Evolve closeness
  if (!spontaneous && persona.relationship) {
    persona.relationship.closenessScore = Math.min(1.0, (persona.relationship.closenessScore || 0) + 0.001);
    persona.relationship.interactionCount = (persona.relationship.interactionCount || 0) + 1;
    persona.relationship.lastInteractionTime = new Date().toISOString();
    await updatePersona(userId, personaId, { relationship: persona.relationship });
  }

  // Periodic evolution
  if (persona.relationship?.interactionCount && persona.relationship.interactionCount % 6 === 0) {
    const currentConversation = await listRecentConversationMessages(userId, conversationId, 30);
    await safelyCreateMemoryAndEvolveRelationship({
      userId,
      personaId,
      persona,
      currentConversation,
    });
    const evolvedPersona = await getPersonaById(userId, personaId);
    if (evolvedPersona) {
      persona = evolvedPersona;
    }
  }

  // Clear unresolved message thread list and pendingReply snapshot
  state.unresolvedThreadIds = [];
  state.pendingReply = null;
  await updatePersona(userId, personaId, { conversationalState: state });

  return {
    status: 'delivered',
    conversationId,
    persona,
    spontaneous: !!spontaneous,
    userMessageId: targetMessageId,
    assistantMessages,
    chunks,
    chunkDelays,
    typingDelay,
  };
}

async function sendPersonaMessage(input) {
  const sched = await schedulePersonaReply(input);
  if (sched.status === 'skipped') {
    return sched;
  }
  const result = await generatePersonaReply({
    userId: input.userId,
    personaId: input.personaId,
    conversationId: input.conversationId,
  });
  return result;
}

function estimateResponseDelayMs(text, persona) {
  const charCount = (text || '').trim().length;
  const speed = String(persona?.replyBehavior || persona?.personaConfig?.responseSpeed || '').toLowerCase();
  let baseDelay = 2500;

  if (speed.includes('instant')) {
    baseDelay = 900;
  } else if (speed.includes('fast') || speed.includes('very fast')) {
    baseDelay = 1500;
  } else if (speed.includes('normal') || speed.includes('intentional')) {
    baseDelay = 2400;
  } else if (speed.includes('slow') || speed.includes('measured')) {
    baseDelay = 4200;
  } else if (speed.includes('random')) {
    baseDelay = 1200 + Math.round(Math.random() * 3600);
  }

  if (charCount <= 35) {
    return Math.max(700, Math.round(baseDelay * 0.75));
  }
  if (charCount <= 120) {
    return Math.max(1200, baseDelay);
  }
  return Math.round(baseDelay * 1.25);
}

async function getConversationHistory({ userId, conversationId }) {
  return listConversationMessages(userId, conversationId, {
    limit: 100,
    newestFirst: false,
  });
}

module.exports = {
  sendPersonaMessage,
  getConversationHistory,
  schedulePersonaReply,
  generatePersonaReply,
};
