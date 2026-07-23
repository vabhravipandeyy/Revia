const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  }, 
});

// ─── Tokenization helpers ────────────────────────────────────────────────────

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function uniqueTokens(text) {
  return new Set(tokenize(text));
}

function trigrams(text) {
  const tokens = tokenize(text);
  const grams = new Set();
  for (let i = 0; i <= tokens.length - 3; i++) {
    grams.add(tokens.slice(i, i + 3).join(' '));
  }
  return grams;
}

// ─── Structural pattern detection ────────────────────────────────────────────

const GREETING_PATTERNS = [
  /kaise? ho/i,
  /kya (chal|ho|kar) raha?/i,
  /how are you/i,
  /what('?s| is) up/i,
  /sup\b/i,
  /heyy+/i,
  /hellou?/i,
  /hiiii+/i,
  /good morning/i,
  /good night/i,
  /kya haal/i,
  /sab theek/i,
  /baat nahi ki/i,
  /kabse baat/i,
  /miss kar raha/i,
  /yaad aa? (gayi|rahi|aaya)/i,
  /soo? (gaye?|rahi?|rahe?)\??/i,
  /kahan ho/i,
  /busy ho/i,
];

const STRUCTURE_CATEGORIES = {
  question: /\?$/,
  exclamation: /!$/,
  ellipsis: /\.{2,}$/,
  emojiEnding: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]$/u,
  shortBurst: /^.{1,25}$/,
  longMessage: /^.{80,}$/,
};

function classifyStructure(text) {
  const normalized = String(text || '').trim();
  const tags = [];
  for (const [tag, regex] of Object.entries(STRUCTURE_CATEGORIES)) {
    if (regex.test(normalized)) {
      tags.push(tag);
    }
  }
  return tags;
}

function matchesGreetingPattern(text) {
  const normalized = String(text || '').toLowerCase();
  return GREETING_PATTERNS.filter((pattern) => pattern.test(normalized));
}

// ─── Similarity scoring ─────────────────────────────────────────────────────

function tokenOverlapScore(textA, textB) {
  const tokensA = uniqueTokens(textA);
  const tokensB = uniqueTokens(textB);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) overlap++;
  });

  const minSize = Math.min(tokensA.size, tokensB.size);
  return overlap / minSize;
}

function trigramOverlapScore(textA, textB) {
  const gramsA = trigrams(textA);
  const gramsB = trigrams(textB);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;

  let overlap = 0;
  gramsA.forEach((gram) => {
    if (gramsB.has(gram)) overlap++;
  });

  const minSize = Math.min(gramsA.size, gramsB.size);
  return overlap / minSize;
}

function structuralSimilarity(textA, textB) {
  const tagsA = new Set(classifyStructure(textA));
  const tagsB = new Set(classifyStructure(textB));
  if (tagsA.size === 0 && tagsB.size === 0) return 0;

  let overlap = 0;
  tagsA.forEach((tag) => {
    if (tagsB.has(tag)) overlap++;
  });

  const union = new Set([...tagsA, ...tagsB]);
  return union.size > 0 ? overlap / union.size : 0;
}

/**
 * Combined similarity score (0–1) using weighted components.
 */
function computeSimilarityScore(candidateText, previousText) {
  const tokenScore = tokenOverlapScore(candidateText, previousText);
  const trigramScore = trigramOverlapScore(candidateText, previousText);
  const structScore = structuralSimilarity(candidateText, previousText);

  // Weighted: trigrams are the strongest signal, then tokens, then structure
  return 0.45 * trigramScore + 0.35 * tokenScore + 0.20 * structScore;
}

/**
 * Compute the maximum repetition penalty against a list of recent messages.
 * Returns value between 0 (no similarity) and 1 (near-duplicate).
 */
function computeRepetitionPenalty(candidateText, recentMessages) {
  if (!recentMessages || recentMessages.length === 0) return 0;

  let maxScore = 0;
  for (const msg of recentMessages) {
    const text = typeof msg === 'string' ? msg : msg.messageText || msg.text || '';
    const score = computeSimilarityScore(candidateText, text);
    if (score > maxScore) maxScore = score;
  }

  // Bonus penalty if candidate uses a common greeting pattern that was recently used
  const candidateGreetings = matchesGreetingPattern(candidateText);
  if (candidateGreetings.length > 0) {
    for (const msg of recentMessages.slice(0, 5)) {
      const prevText = typeof msg === 'string' ? msg : msg.messageText || msg.text || '';
      const prevGreetings = matchesGreetingPattern(prevText);
      if (prevGreetings.length > 0) {
        // Shared greeting pattern → heavy penalty
        maxScore = Math.min(1, maxScore + 0.25);
        break;
      }
    }
  }

  return Math.min(1, maxScore);
}

/**
 * Quick boolean check if message is too similar to recent history.
 */
function isMessageTooSimilar(candidateText, recentMessages, threshold = 0.4) {
  return computeRepetitionPenalty(candidateText, recentMessages) >= threshold;
}

// ─── DynamoDB persistence ───────────────────────────────────────────────────

function makeUserPersonaKey(userId, personaId) {
  return `${userId}#${personaId}`;
}

async function recordSpontaneousMessage(userId, personaId, messageText) {
  const tableName = process.env.SPONTANEOUS_HISTORY_TABLE;
  if (!tableName) {
    console.warn('SPONTANEOUS_HISTORY_TABLE not configured, skipping record');
    return null;
  }

  const sentAt = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 day TTL

  const item = {
    userPersonaKey: makeUserPersonaKey(userId, personaId),
    sentAt,
    messageText: String(messageText || '').trim(),
    greetingPatterns: matchesGreetingPattern(messageText).map((p) => p.source),
    structureTags: classifyStructure(messageText),
    ttl,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );
    return item;
  } catch (error) {
    console.error('Failed to record spontaneous message', error);
    return null;
  }
}

async function getRecentSpontaneousMessages(userId, personaId, limit = 10) {
  const tableName = process.env.SPONTANEOUS_HISTORY_TABLE;
  if (!tableName) {
    return [];
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'userPersonaKey = :key',
        ExpressionAttributeValues: {
          ':key': makeUserPersonaKey(userId, personaId),
        },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    return result.Items || [];
  } catch (error) {
    console.error('Failed to fetch spontaneous history', error);
    return [];
  }
}

/**
 * Build a list of recently used openers/phrases for injection into the system prompt.
 * Returns an array of strings the AI should avoid repeating.
 */
function extractRecentOpeners(recentMessages) {
  return recentMessages
    .map((msg) => {
      const text = String(msg.messageText || msg.text || '').trim();
      // Take first sentence or first 60 chars as the "opener"
      const firstSentence = text.split(/[.!?]\s/)[0] || text;
      return firstSentence.slice(0, 60).trim();
    })
    .filter(Boolean);
}

module.exports = {
  recordSpontaneousMessage,
  getRecentSpontaneousMessages,
  computeRepetitionPenalty,
  isMessageTooSimilar,
  extractRecentOpeners,
  matchesGreetingPattern,
  classifyStructure,
  // Exposed for testing
  tokenOverlapScore,
  trigramOverlapScore,
  computeSimilarityScore,
};
