const { badRequest, created, internalServerError, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { createAgent } = require('../../services/agents');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

async function createAgentHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const body = parseJsonBody(event);

    const name = normalizeString(body.name);
    const gender = normalizeString(body.gender)?.toLowerCase();
    const language = normalizeString(body.language);
    const conversationStyle = normalizeString(body.conversationStyle);
    const traits = normalizeStringArray(body.traits);
    const personaConfig =
      body.personaConfig && typeof body.personaConfig === 'object' && !Array.isArray(body.personaConfig)
        ? body.personaConfig
        : {};
    const age =
      body.age === undefined || body.age === null || body.age === ''
        ? undefined
        : Number(body.age);

    if (!name) {
      return badRequest('Agent name is required');
    }

    if (body.age !== undefined && body.age !== null && body.age !== '' && (Number.isNaN(age) || age <= 0)) {
      return badRequest('Age must be a valid positive number');
    }

    const agent = await createAgent({
      userId,
      name,
      gender,
      age,
      language,
      traits,
      conversationStyle,
      personaConfig,
    });

    return created({
      message: 'Agent created successfully',
      agent,
    });
  } catch (error) {
    console.error('Create agent error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    return internalServerError('Failed to create agent');
  }
}

exports.handler = withAuth(createAgentHandler);
