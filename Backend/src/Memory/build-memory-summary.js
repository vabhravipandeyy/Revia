function extractTags(text) {
  const unique = new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 4)
  );

  return Array.from(unique).slice(0, 8);
}

function buildMemorySummary(persona, messages) {
  const lastMessages = messages.slice(-6);
  const userHighlights = lastMessages
    .filter((message) => message.role === 'user')
    .map((message) => message.text.trim())
    .filter(Boolean)
    .slice(-3);
  const assistantHighlights = lastMessages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.text.trim())
    .filter(Boolean)
    .slice(-2);

  const summary = [
    `${persona.name} and the user discussed ${userHighlights.join(' | ') || 'ongoing personal context'}.`,
    assistantHighlights.length > 0
      ? `${persona.name} replied with ${persona.emotionalTone || 'balanced'} energy and ${persona.speakingStyle?.join(', ') || 'their usual style'}.`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  const embeddingText = lastMessages.map((message) => `${message.role}: ${message.text}`).join('\n');

  return {
    summary,
    embeddingText,
    tags: extractTags(`${summary} ${embeddingText}`),
  };
}

module.exports = {
  buildMemorySummary,
};
