const { listPersonaMemories } = require('../services/memories');

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
  );
}

const EMOTIONAL_KEYWORDS = new Set([
  'sad', 'lonely', 'miss', 'cry', 'hurt', 'anxious', 'stress', 'love', 'excited', 'happy',
  'worried', 'scared', 'angry', 'fight', 'milestone', 'comfort', 'intimate', 'deep', 'feel',
  'heart', 'dil', 'pyaar', 'dukh', 'khush', 'udaas', 'darr', 'akela', 'yaad', 'rona', 'sorry'
]);

function calculateMemoryScore(memory, queryTokens, rank) {
  // 1. Recency Score: newer memories get a higher base score (up to 10 points)
  // listPersonaMemories returns memories sorted by newest first
  const recencyScore = Math.max(0, 10 - rank * 0.5);

  const memoryText = [
    memory.summary,
    memory.embeddingText,
    ...(memory.tags || [])
  ].join(' ').toLowerCase();

  const memoryTokens = tokenize(memoryText);

  // 2. Relevance Score: overlap with the current conversation query tokens
  let relevanceOverlap = 0;
  queryTokens.forEach((token) => {
    if (memoryTokens.has(token)) {
      relevanceOverlap += 1;
    }
  });
  const relevanceScore = relevanceOverlap * 4.0;

  // 3. Emotional Weight: boost memories containing emotional keywords
  let emotionalOverlap = 0;
  EMOTIONAL_KEYWORDS.forEach((keyword) => {
    if (memoryTokens.has(keyword)) {
      emotionalOverlap += 1;
    }
  });
  const emotionalWeight = emotionalOverlap * 3.0;

  // 4. Frequency/Inside Jokes Score: tags/inside jokes add minor weight
  const frequencyScore = (memory.tags?.length || 0) * 1.0;

  // Total composite memory score
  return recencyScore + relevanceScore + emotionalWeight + frequencyScore;
}

async function retrieveRelevantMemories({ userId, personaId, userMessage, recentMessages }) {
  const memories = await listPersonaMemories(
    userId,
    personaId,
    Number(process.env.MEMORY_RETRIEVAL_LIMIT || 25)
  );

  if (memories.length === 0) {
    return [];
  }

  // Construct query tokens from user message and last 4 recent chat texts
  const contextText = [
    userMessage,
    ...recentMessages.slice(-4).map((message) => message.text),
  ].join(' ');
  const queryTokens = tokenize(contextText);

  return memories
    .map((memory, rank) => {
      const score = calculateMemoryScore(memory, queryTokens, rank);
      return {
        ...memory,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4); // Retrieve top 4 memories to give richer context
}

module.exports = {
  retrieveRelevantMemories,
};
