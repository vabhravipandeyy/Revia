const { generateGroqResponse } = require('./groq');
const { buildPersonaSystemPrompt } = require('../prompts/persona-system-prompt');

async function generateResponse({
  provider,
  model,
  persona,
  memories,
  recentMessages,
  userMessage,
  spontaneousContext,
  personaFacts,
  timezone,
}) {
  const resolvedProvider = typeof provider === 'string' ? provider.toLowerCase() : 'groq';
  const resolvedModel = model || process.env.GROQ_MODEL || process.env.DEFAULT_MODEL_NAME || 'llama-3.3-70b-versatile';
  const systemPrompt = buildPersonaSystemPrompt({
    persona,
    memories,
    spontaneousContext: spontaneousContext || null,
    personaFacts: personaFacts || [],
    timezone,
  });

  const payload = {
    model: resolvedModel,
    persona,
    memories,
    recentMessages,
    systemPrompt,
    userMessage,
  };

  if (resolvedProvider !== 'groq') {
    console.warn('Unsupported provider requested, defaulting to Groq', { requestedProvider: resolvedProvider });
  }

  return generateGroqResponse(payload);
}

module.exports = {
  generateResponse,
};

