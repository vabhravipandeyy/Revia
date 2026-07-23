const { getRecentSpontaneousMessages, extractRecentOpeners } = require('./spontaneous-history');
const { listRecentConversationMessages } = require('./chat-messages');
const { listPersonaMemories } = require('./memories');

// ─── Time-of-day classification ─────────────────────────────────────────────

function getTimeOfDay(date) {
  const hour = (date || new Date()).getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'late-night';
}

const TIME_MOOD_MAP = {
  morning: {
    moodModifier: 'morning-light',
    energyLevel: 'playful',
    description: 'Light, fresh, positive energy. Greet casually or share something fun.',
    exampleStyles: [
      'share a cheerful thought',
      'reference something they enjoy in mornings',
      'light playful tease',
    ],
  },
  afternoon: {
    moodModifier: 'afternoon-casual',
    energyLevel: 'relaxed',
    description: 'Casual, relaxed vibe. Share random thoughts or observations.',
    exampleStyles: [
      'share a random thought or observation',
      'reference something they talked about recently',
      'casual banter',
    ],
  },
  evening: {
    moodModifier: 'evening-warm',
    energyLevel: 'warm',
    description: 'Warm, engaging, emotionally present. Good for deeper check-ins.',
    exampleStyles: [
      'warm emotional check-in',
      'ask about their day genuinely',
      'reference a shared memory or moment',
    ],
  },
  'late-night': {
    moodModifier: 'late-night-soft',
    energyLevel: 'soft',
    description: 'Soft, intimate, slower pacing. Deep emotional texts or gentle presence.',
    exampleStyles: [
      'soft emotional message',
      'gentle "thinking about you" energy',
      'reflective late-night thought',
    ],
  },
};

function getTimeMoodContext(date) {
  const timeOfDay = getTimeOfDay(date);
  return {
    timeOfDay,
    ...TIME_MOOD_MAP[timeOfDay],
  };
}

// ─── Trigger evaluation ─────────────────────────────────────────────────────

const MIN_INACTIVITY_MS = 3 * 60 * 60 * 1000;    // 3 hours
const MIN_COOLDOWN_MS = 6 * 60 * 60 * 1000;       // 6 hours between spontaneous messages
const QUIET_HOURS_START = 1;                        // 1 AM
const QUIET_HOURS_END = 7;                          // 7 AM

function isInQuietHours(date) {
  const hour = (date || new Date()).getHours();
  return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
}

/**
 * Estimate emotional depth from recent messages.
 * Returns 'high', 'medium', or 'low'.
 */
function estimateEmotionalDepth(recentMessages) {
  if (!recentMessages || recentMessages.length === 0) return 'low';

  const emotionalWords = [
    'sad', 'lonely', 'miss', 'cry', 'hurt', 'anxious', 'stress', 'love',
    'mood', 'tired', 'upset', 'scared', 'happy', 'excited', 'worried',
    'broken', 'pain', 'sorry', 'care', 'feel', 'heart', 'dil', 'pyaar',
    'dukh', 'khush', 'udaas', 'darr', 'akela', 'yaad', 'rona',
  ];

  let totalHits = 0;
  const textsToCheck = recentMessages.slice(-10);

  for (const msg of textsToCheck) {
    const text = String(msg.text || '').toLowerCase();
    for (const word of emotionalWords) {
      if (text.includes(word)) totalHits++;
    }
  }

  if (totalHits >= 5) return 'high';
  if (totalHits >= 2) return 'medium';
  return 'low';
}

/**
 * Estimate relationship closeness from interaction history.
 * Returns a score 0–1.
 */
function estimateRelationshipCloseness(messageCount, memoryCount) {
  const msgScore = Math.min(1, (messageCount || 0) / 50);
  const memScore = Math.min(1, (memoryCount || 0) / 10);
  return 0.6 * msgScore + 0.4 * memScore;
}

/**
 * Core decision: should we trigger a spontaneous message?
 */
async function shouldTriggerSpontaneous(userId, personaId, context = {}) {
  const now = new Date();
  const reasons = [];

  // 1. Check quiet hours (unless user was recently active)
  if (isInQuietHours(now) && !context.userRecentlyActive) {
    return { shouldTrigger: false, reason: 'quiet-hours' };
  }

  // 2. Check inactivity duration
  const lastActiveMs = context.lastActiveTimestamp
    ? new Date(context.lastActiveTimestamp).getTime()
    : 0;
  const inactivityMs = lastActiveMs > 0 ? now.getTime() - lastActiveMs : Infinity;

  if (inactivityMs < MIN_INACTIVITY_MS) {
    return { shouldTrigger: false, reason: 'user-still-active', inactivityMs };
  }

  reasons.push(`inactive-for-${Math.round(inactivityMs / (60 * 1000))}min`);

  // 3. Check cooldown (don't spam spontaneous messages)
  const recentSpontaneous = await getRecentSpontaneousMessages(userId, personaId, 1);
  if (recentSpontaneous.length > 0) {
    const lastSpontaneousMs = new Date(recentSpontaneous[0].sentAt).getTime();
    const cooldownElapsed = now.getTime() - lastSpontaneousMs;
    if (cooldownElapsed < MIN_COOLDOWN_MS) {
      return { shouldTrigger: false, reason: 'cooldown-active', cooldownRemainingMs: MIN_COOLDOWN_MS - cooldownElapsed };
    }
  }

  // 4. Check emotional depth of recent conversation
  const emotionalDepth = context.emotionalDepth || 'low';
  if (emotionalDepth === 'high') {
    reasons.push('emotional-depth-high');
  }

  // 5. Check relationship closeness
  const closeness = context.relationshipCloseness || 0;
  if (closeness < 0.15) {
    return { shouldTrigger: false, reason: 'relationship-too-new', closeness };
  }

  if (closeness > 0.5) {
    reasons.push('close-relationship');
  }

  // 6. Probability gate — not every qualifying moment should trigger a message
  const baseProbability = 0.35;
  let adjustedProbability = baseProbability;
  if (emotionalDepth === 'high') adjustedProbability += 0.20;
  if (closeness > 0.6) adjustedProbability += 0.15;
  if (inactivityMs > 6 * 60 * 60 * 1000) adjustedProbability += 0.10; // 6+ hours
  if (getTimeOfDay(now) === 'evening') adjustedProbability += 0.10;
  if (getTimeOfDay(now) === 'late-night') adjustedProbability += 0.05;

  adjustedProbability = Math.min(0.85, adjustedProbability);

  const roll = Math.random();
  if (roll > adjustedProbability) {
    return { shouldTrigger: false, reason: 'probability-gate', probability: adjustedProbability, roll };
  }

  reasons.push(`probability-passed(${adjustedProbability.toFixed(2)})`);

  return {
    shouldTrigger: true,
    reasons,
    inactivityMs,
    emotionalDepth,
    closeness,
    timeOfDay: getTimeOfDay(now),
  };
}

// ─── Context builder ────────────────────────────────────────────────────────

/**
 * Build rich context for spontaneous message generation.
 * This data is passed to the system prompt and AI user message.
 */
async function buildSpontaneousContext(userId, personaId, conversationId) {
  const now = new Date();
  const timeMood = getTimeMoodContext(now);

  // Fetch recent conversation for emotional context
  let recentMessages = [];
  try {
    recentMessages = await listRecentConversationMessages(userId, conversationId || personaId, 10);
  } catch (error) {
    console.error('Failed to fetch recent messages for spontaneous context', error);
  }

  // Fetch memories for deeper context
  let memories = [];
  try {
    memories = await listPersonaMemories(userId, personaId, 5);
  } catch (error) {
    console.error('Failed to fetch memories for spontaneous context', error);
  }

  // Fetch recent spontaneous messages for anti-repetition
  const recentSpontaneous = await getRecentSpontaneousMessages(userId, personaId, 10);
  const recentOpeners = extractRecentOpeners(recentSpontaneous);

  // Extract conversation topics
  const userTopics = recentMessages
    .filter((m) => m.role === 'user')
    .slice(-5)
    .map((m) => String(m.text || '').trim())
    .filter(Boolean);

  // Extract emotional keywords from recent history
  const emotionalKeywords = [];
  for (const msg of recentMessages.slice(-8)) {
    const text = String(msg.text || '').toLowerCase();
    const emWords = ['happy', 'sad', 'excited', 'tired', 'stressed', 'love', 'miss', 'worry', 'scared', 'angry'];
    for (const w of emWords) {
      if (text.includes(w) && !emotionalKeywords.includes(w)) {
        emotionalKeywords.push(w);
      }
    }
  }

  // Memory summaries for context injection
  const memorySummaries = memories
    .map((m) => m.summary)
    .filter(Boolean)
    .slice(0, 3);

  // Emotional depth estimation
  const emotionalDepth = estimateEmotionalDepth(recentMessages);

  // Relationship closeness
  const relationshipCloseness = estimateRelationshipCloseness(
    recentMessages.length,
    memories.length
  );

  const lastMessage = recentMessages[recentMessages.length - 1];
  const lastMessageTimestamp = lastMessage?.timestamp || null;
  const hoursSinceLastMessage = lastMessageTimestamp
    ? (now.getTime() - new Date(lastMessageTimestamp).getTime()) / (3600 * 1000)
    : null;

  return {
    timeOfDay: timeMood.timeOfDay,
    moodModifier: timeMood.moodModifier,
    energyLevel: timeMood.energyLevel,
    timeDescription: timeMood.description,
    suggestedStyles: timeMood.exampleStyles,
    recentOpeners,
    recentSpontaneousCount: recentSpontaneous.length,
    userTopics,
    emotionalKeywords,
    memorySummaries,
    emotionalDepth,
    relationshipCloseness,
    lastMessageTimestamp,
    hoursSinceLastMessage,
    lastUserMessage: recentMessages.filter((m) => m.role === 'user').slice(-1)[0]?.text || null,
    conversationLength: recentMessages.length,
  };
}

/**
 * Build the spontaneous AI user message (replaces the hardcoded string in chat.js).
 * This is what gets sent as the "user message" to the LLM for spontaneous generation.
 */
function buildSpontaneousUserPrompt(context) {
  const parts = [
    '[SPONTANEOUS MESSAGE — The user has NOT sent a new message. You are reaching out on your own.]',
    '',
  ];

  // Time context
  parts.push(`Current time: ${context.timeOfDay}. ${context.timeDescription || ''}`);
  parts.push(`Energy level for this time: ${context.energyLevel || 'medium'}.`);
  parts.push('');

  // Anti-repetition
  if (context.recentOpeners && context.recentOpeners.length > 0) {
    parts.push('⚠️ MESSAGES YOU RECENTLY SENT (DO NOT repeat or closely resemble these):');
    context.recentOpeners.forEach((opener, i) => {
      parts.push(`  ${i + 1}. "${opener}"`);
    });
    parts.push('Generate something COMPLETELY different in structure, wording, and approach.');
    parts.push('');
  }

  // Emotional context
  if (context.emotionalKeywords && context.emotionalKeywords.length > 0) {
    parts.push(`Recent emotional context: user has expressed ${context.emotionalKeywords.join(', ')}.`);
  }

  // Memory context
  if (context.memorySummaries && context.memorySummaries.length > 0) {
    parts.push('Relevant memories you can naturally reference:');
    context.memorySummaries.forEach((mem) => {
      parts.push(`  - ${mem}`);
    });
    parts.push('');
  }

  // User topics
  if (context.userTopics && context.userTopics.length > 0) {
    parts.push('Recent topics the user discussed:');
    context.userTopics.slice(0, 3).forEach((topic) => {
      parts.push(`  - "${topic.slice(0, 80)}"`);
    });
    parts.push('');
  }

  // Recency instruction
  if (context.hoursSinceLastMessage !== null) {
    const hrs = context.hoursSinceLastMessage;
    parts.push(`— CONVERSATION RECENCY CONTEXT —`);
    parts.push(`It has been ${hrs.toFixed(1)} hours since the last message in this conversation.`);
    
    if (hrs < 6) {
      parts.push(`⚠️ HIGH CONTEXT FRESHNESS: The conversation was very recent (${hrs.toFixed(1)} hours ago).`);
      parts.push(`- You MUST directly reference, follow up on, or naturally continue the topic of the last 2-3 messages in the chat history.`);
      parts.push(`- DO NOT start a completely new, random topic (like sunset, tea cravings, poetry, shayari, or random quotes) unless it directly flows from the last messages.`);
      parts.push(`- Write your message as if continuing the conversation thread. Ask a natural follow-up or check-in on what was being discussed.`);
    } else if (hrs < 18) {
      parts.push(`⚠️ MEDIUM CONTEXT FRESHNESS: The last chat was moderately recent (${hrs.toFixed(1)} hours ago).`);
      parts.push(`- Refer to or follow up on the previous discussion or mood naturally (e.g. check on how they are feeling, or ask about something they mentioned).`);
      parts.push(`- If introducing a new thought, connect it casually, referencing the past conversation or the day's progression.`);
    } else {
      parts.push(`⚠️ COLD CONTEXT: The last conversation was a while ago (${hrs.toFixed(1)} hours ago).`);
      parts.push(`- Since it has been a long time, you can initiate a fresh topic.`);
      parts.push(`- Share a thought related to the current time of day, a memory, or an interesting observation, but keep it highly personalized to your connection and relationship style.`);
    }
    parts.push('');
  }

  // Generation instructions
  parts.push('Pick ONE natural approach:');
  if (context.suggestedStyles) {
    context.suggestedStyles.forEach((style) => {
      parts.push(`  • ${style}`);
    });
  }
  parts.push('  • Reference a specific past conversation or memory');
  parts.push('  • Share a thought related to something they care about');
  parts.push('  • React naturally to the time of day');
  parts.push('');

  parts.push('Rules:');
  parts.push('- Send 1 to 3 tiny texting-style bursts.');
  parts.push('- Do NOT use generic greetings like "kaise ho" or "kya chal raha hai" unless contextually justified (e.g., checking on pain/stress discussed earlier).');
  parts.push('- Do NOT invent events or memories that aren\'t listed above.');
  parts.push('- Sound like a real person who randomly thought of them, NOT a scheduled bot.');
  parts.push('- Match the emotional depth and energy of the current time of day.');
  parts.push('- If the last message was recent, prioritize thread continuity over random observations.');

  return parts.join('\n');
}

module.exports = {
  getTimeOfDay,
  getTimeMoodContext,
  shouldTriggerSpontaneous,
  buildSpontaneousContext,
  buildSpontaneousUserPrompt,
  estimateEmotionalDepth,
  estimateRelationshipCloseness,
  isInQuietHours,
  // Constants exposed for configuration
  MIN_INACTIVITY_MS,
  MIN_COOLDOWN_MS,
};
