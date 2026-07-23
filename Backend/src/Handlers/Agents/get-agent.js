const { internalServerError, notFound, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { getAgentById } = require('../../services/agents');

async function getAgentHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const agentId = event.pathParameters?.id;

    const agent = await getAgentById(userId, agentId);

    if (!agent) {
      return notFound('Agent not found');
    }

    return ok({ agent });
  } catch (error) {
    console.error('Get agent error', error);
    return internalServerError('Failed to fetch agent');
  }
}

exports.handler = withAuth(getAgentHandler);
