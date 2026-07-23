const { badRequest, internalServerError, notFound, ok, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { updateAgent } = require('../../services/agents');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalStringArray(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

async function updateAgentHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const agentId = event.pathParameters?.id;
    const body = parseJsonBody(event);

    const name = normalizeString(body.name);
    const gender = normalizeString(body.gender)?.toLowerCase();
    const language = normalizeString(body.language);
    const conversationStyle = normalizeString(body.conversationStyle);
    const traits = normalizeOptionalStringArray(body.traits);
    const personaConfig =
      body.personaConfig === undefined
        ? undefined
        : body.personaConfig && typeof body.personaConfig === 'object' && !Array.isArray(body.personaConfig)
          ? body.personaConfig
          : {};
    const age =
      body.age === undefined || body.age === null || body.age === ''
        ? undefined
        : Number(body.age);

    if (body.age !== undefined && body.age !== null && body.age !== '' && (Number.isNaN(age) || age <= 0)) {
      return badRequest('Age must be a valid positive number');
    }

    const agent = await updateAgent(userId, agentId, {
      name,
      gender,
      age,
      language,
      traits,
      conversationStyle,
      personaConfig,
    });

    if (!agent) {
      return notFound('Agent not found');
    }

    return ok({
      message: 'Agent updated successfully',
      agent,
    });
  } catch (error) {
    console.error('Update agent error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Agent not found');
    }

    return internalServerError('Failed to update agent');
  }
}

exports.handler = withAuth(updateAgentHandler);
