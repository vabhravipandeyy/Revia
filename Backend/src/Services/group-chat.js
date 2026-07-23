const { generateGroqResponse } = require('../models/groq');
const { buildGroupSystemPrompt } = require('../prompts/group-system-prompt');
const { getPersonaById } = require('./personas');
const { getSpace } = require('./spaces');
const { createSpaceMessage, listRecentSpaceMessages } = require('./space-messages');

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
    .split(/(?<=[.!?])\s+|(?<=,)\s+|(?:\s+and\s+)|(?:\s+but\s+)|(?:\s+so\s+)/i)
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

  if (!trimmed) {
    return [];
  }

  const profile = normalizeTextingProfile(persona);
  const replyBehavior = String(persona?.replyBehavior || persona?.personaConfig?.responseSpeed || '').toLowerCase();
  const sentenceChunks = splitByTextingPauses(trimmed);

  let maxChunks = 2;
  if (profile.textingEnergy === 'high' || moodState === 'excited' || replyBehavior.includes('instant')) {
    maxChunks = 4;
  } else if (profile.textingEnergy === 'low' || moodState === 'dry' || replyBehavior.includes('measured')) {
    maxChunks = 2;
  } else if (moodState === 'soft' || moodState === 'warm') {
    maxChunks = 3;
  }

  let chunks = sentenceChunks.slice(0, maxChunks);

  if (chunks.length === 1) {
    const desiredCount =
      profile.textingEnergy === 'high'
        ? 3
        : profile.textingEnergy === 'medium' && trimmed.length > 55
          ? 2
          : 1;
    chunks = splitLongChunk(chunks[0], desiredCount);
  }

  if (profile.textingEnergy === 'high' && chunks.length < 3 && trimmed.length > 36) {
    const expanded = [];
    for (const chunk of chunks) {
      expanded.push(...splitLongChunk(chunk, 2));
    }
    chunks = expanded.slice(0, 4);
  }

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

function buildDeliveryPlan({ text, persona, spontaneous, recentMessages, delayWindow }) {
  const emotionalIntensity = inferEmotionalIntensity(text, persona);
  const profile = normalizeTextingProfile(persona);
  const moodState = pickMoodState({
    persona,
    emotionalIntensity,
    spontaneous,
    recentMessages,
  });
  const chunks = splitAssistantReplyIntoChunks(text, persona, moodState);
  const speed = String(persona?.replyBehavior || persona?.personaConfig?.responseSpeed || '').toLowerCase();

  let typingDelay;
  if (chunks.join(' ').length <= 24) {
    typingDelay = 700 + Math.round(Math.random() * 500);
  } else if (chunks.join(' ').length <= 95) {
    typingDelay = 1800 + Math.round(Math.random() * 1600);
  } else {
    typingDelay = 3200 + Math.round(Math.random() * 2400);
  }

  if (emotionalIntensity === 'high') {
    typingDelay += 700;
  }
  if (profile.textingEnergy === 'high') {
    typingDelay -= 250;
  }
  if (moodState === 'dry' || speed.includes('measured')) {
    typingDelay += 900;
  }
  if (spontaneous) {
    typingDelay += 500;
  }

  typingDelay = Math.max(500, typingDelay);

  if (delayWindow && Number.isFinite(delayWindow.minSeconds) && Number.isFinite(delayWindow.maxSeconds)) {
    const minMs = Math.max(1000, Number(delayWindow.minSeconds) * 1000);
    const maxMs = Math.max(minMs, Number(delayWindow.maxSeconds) * 1000);
    const moodWeight =
      moodState === 'dry' || moodState === 'thoughtful'
        ? 0.82
        : moodState === 'excited' || profile.textingEnergy === 'high'
          ? 0.28
          : 0.55;
    const jitter = Math.random() * Math.min(1800, (maxMs - minMs) * 0.12);
    typingDelay = Math.round(Math.min(maxMs, Math.max(minMs, minMs + moodWeight * (maxMs - minMs) + jitter)));
  }

  const chunkDelays = chunks.map((chunk, index) => {
    if (index === 0) {
      return typingDelay;
    }

    let basePause;
    if (profile.textingEnergy === 'high') {
      basePause = 450 + Math.round(Math.random() * 650);
    } else if (profile.textingEnergy === 'low' || moodState === 'dry') {
      basePause = 1800 + Math.round(Math.random() * 1600);
    } else {
      basePause = 900 + Math.round(Math.random() * 1200);
    }

    if (chunk.length > 40) {
      basePause += 700;
    }
    if (moodState === 'soft') {
      basePause += 300;
    }
    if (moodState === 'excited') {
      basePause = Math.max(400, basePause - 250);
    }

    return basePause;
  });

  return {
    chunks,
    chunkDelays,
    typingDelay,
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

function selectRespondingAgents(userMessage, space, activePersonas, recentMessages) {
  const lowerMsg = userMessage.toLowerCase();
  const emotionalTokens = ['sad', 'lonely', 'miss', 'cry', 'hurt', 'anxious', 'stress', 'tired', 'upset', 'scared'];
  const hasEmotionalToken = emotionalTokens.some(token => lowerMsg.includes(token));

  const scoredPersonas = activePersonas.map((persona) => {
    let score = 0.0;

    // 1. Personality relevance (traits / speakingStyle)
    (persona.traits || []).forEach(trait => {
      if (lowerMsg.includes(trait.toLowerCase())) score += 8;
    });
    (persona.speakingStyle || []).forEach(style => {
      if (lowerMsg.includes(style.toLowerCase())) score += 8;
    });
    score = Math.min(score, 25.0);

    // 2. Emotional relevance
    if (hasEmotionalToken) {
      if (persona.category === 'emotional' || (persona.traits || []).some(t => ['caring', 'gentle', 'empathetic', 'supportive'].includes(t.toLowerCase()))) {
        score += 20.0;
      }
    }

    // 3. Recency factor (who hasn't spoken recently)
    const lastSpeakers = recentMessages.slice(-10).map(m => m.senderId);
    if (!lastSpeakers.includes(persona.personaId)) {
      score += 15.0;
    } else {
      const lastIndex = lastSpeakers.lastIndexOf(persona.personaId);
      score += (lastIndex * 1.5); // Spoke further back in history = higher boost
    }

    // 4. Relationship closeness
    const rel = (persona.relationshipType || '').toLowerCase();
    if (rel.includes('soulmate') || rel.includes('partner')) score += 15.0;
    else if (rel.includes('companion') || rel.includes('lover')) score += 12.0;
    else if (rel.includes('friend') || rel.includes('buddy')) score += 8.0;
    else if (rel.includes('mentor') || rel.includes('guide')) score += 5.0;
    else score += 5.0;

    // 5. Conversation threading / Mentions
    if (lowerMsg.includes(persona.name.toLowerCase())) {
      score += 15.0;
    }

    // 6. Random factor
    score += Math.random() * 10.0;

    return { persona, score };
  });

  // Sort DESC
  scoredPersonas.sort((a, b) => b.score - a.score);

  // Pick count
  let count = 2;
  if (lowerMsg.length < 10) {
    count = Math.random() > 0.5 ? 1 : 2;
  } else if (hasEmotionalToken || lowerMsg.length > 80) {
    count = Math.random() > 0.3 ? 2 : 3;
  } else if (lowerMsg.includes('?')) {
    count = Math.random() > 0.5 ? 1 : 2;
  }

  count = Math.min(count, activePersonas.length);

  return scoredPersonas.slice(0, count).map(p => p.persona);
}

async function generateGroupResponses({ userId, spaceId, userMessage, space: providedSpace, delayWindow }) {
  const space = providedSpace || (await getSpace(userId, spaceId));
  if (!space) {
    throw new Error('Space not found');
  }

  // 1. Load recent context (last 30 messages)
  const recentMessages = await listRecentSpaceMessages(userId, spaceId, 30);

  // 2. Resolve persona details for all agents in space
  const agentPersonas = await Promise.all(
    space.agents.map(agentId => getPersonaById(userId, agentId))
  );
  const activePersonas = agentPersonas.filter(Boolean);

  // 3. Select responding agents
  const selectedPersonas = selectRespondingAgents(userMessage, space, activePersonas, recentMessages);

  // 4. Generate responses sequentially
  const responses = [];
  const currentRecentMessages = [...recentMessages];

  for (const persona of selectedPersonas) {
    const recentMessagesText = currentRecentMessages
      .map(m => `${m.senderName}: ${m.text}`)
      .join('\n');

    const otherAgentNames = activePersonas
      .filter(p => p.personaId !== persona.personaId)
      .map(p => p.name)
      .join(', ');

    const systemPrompt = buildGroupSystemPrompt({
      persona,
      space,
      otherAgentNames,
      recentMessagesText,
    });

    const formattedRecent = currentRecentMessages.map(m => ({
      role: m.senderType === 'user' ? 'user' : 'assistant',
      text: `${m.senderName}: ${m.text}`,
    }));

    const modelResponse = await generateGroqResponse({
      model: persona.modelName,
      systemPrompt,
      recentMessages: formattedRecent,
      userMessage: `${space.name} group chat: User message: "${userMessage}"`,
    });

    const text = modelResponse.text;

    const deliveryPlan = buildDeliveryPlan({
      text,
      persona,
      spontaneous: false,
      recentMessages: currentRecentMessages,
      delayWindow,
    });

    const chunkGroupId = `${spaceId}-${Date.now()}`;
    const chunkTimestamps = buildChunkTimestamps(new Date().toISOString(), deliveryPlan.chunkDelays);
    const createdMessages = [];

    for (let i = 0; i < deliveryPlan.chunks.length; i++) {
      const chunkText = deliveryPlan.chunks[i];
      const chunkMsg = await createSpaceMessage({
        userId,
        spaceId,
        senderId: persona.personaId,
        senderType: 'agent',
        senderName: persona.name,
        text: chunkText,
        timestamp: chunkTimestamps[i],
        metadata: {
          chunkGroupId,
          chunkIndex: i,
          chunkCount: deliveryPlan.chunks.length,
          delay: deliveryPlan.chunkDelays[i],
          moodState: deliveryPlan.moodState,
        },
      });

      createdMessages.push(chunkMsg);

      currentRecentMessages.push({
        senderId: persona.personaId,
        senderType: 'agent',
        senderName: persona.name,
        text: chunkText,
        timestamp: chunkTimestamps[i],
      });
    }

    responses.push({
      persona,
      deliveryPlan,
      messages: createdMessages,
    });
  }

  return responses;
}

module.exports = {
  selectRespondingAgents,
  generateGroupResponses,
};
