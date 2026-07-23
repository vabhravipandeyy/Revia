const { badRequest, created, internalServerError, notFound, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { getAgentById } = require('../../services/agents');
const { createMessage } = require('../../services/messages');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function createMessageHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const body = parseJsonBody(event);

    const agentId = normalizeString(body.agentId);
    const role = normalizeString(body.role)?.toLowerCase();
    const text = normalizeString(body.text);

    if (!agentId) {
      return badRequest('agentId is required');
    }

    if (!text) {
      return badRequest('Message text is required');
    }

    if (role !== 'user' && role !== 'ai') {
      return badRequest('role must be either user or ai');
    }

    const agent = await getAgentById(userId, agentId);

    if (!agent) {
      return notFound('Agent not found');
    }

    const message = await createMessage({
      userId,
      agentId,
      role,
      text,
    });

    return created({
      message: 'Message stored successfully',
      data: message,
    });
  } catch (error) {
    console.error('Create message error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    return internalServerError('Failed to store message');
  }
}

exports.handler = withAuth(createMessageHandler);
