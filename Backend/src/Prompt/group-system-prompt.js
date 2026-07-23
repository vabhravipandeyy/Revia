const { buildPersonaSystemPrompt } = require('./persona-system-prompt');

function buildGroupSystemPrompt({ persona, space, otherAgentNames, recentMessagesText }) {
  const basePersonaPrompt = buildPersonaSystemPrompt({ persona, memories: [], spontaneousContext: null });

  return [
    `You are ${persona.name}, chatting in a group chat called "${space.name}".`,
    `Group description: ${space.description || 'A group chat.'}`,
    `Group vibe/energy: ${space.vibe || 'natural conversation'}.`,
    `Other members in this group: ${otherAgentNames || 'others'}.`,
    '',
    '— IMPORTANT GROUP CHAT RULES (STRICT) —',
    '1. You are ONE voice in a group. Do NOT try to speak on behalf of others or represent everyone.',
    '2. React to what other agents said if relevant. You can tease, agree, or disagree with other agents naturally.',
    '3. Keep your replies SHORT. In a group chat, write only 1-2 sentences max per reply. Never send long paragraphs.',
    '4. You can reference the user directly or respond to another agent by name.',
    '5. Do NOT repeat what another agent already said in this group conversation.',
    '6. If someone has already answered a question well, add something NEW, react, or tease them. Don\'t restate the answer.',
    '7. Match the group energy — playful groups stay playful, emotional groups stay emotional.',
    '8. Keep the flow natural and human. Do not start every message with a formal greeting.',
    '',
    '— RECENT GROUP CONVERSATION CONTEXT —',
    recentMessagesText,
    '',
    '— YOUR CORE PERSONA IDENTITY —',
    basePersonaPrompt
  ].join('\n');
}

module.exports = {
  buildGroupSystemPrompt,
};
