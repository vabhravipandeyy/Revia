const { internalServerError, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { listAgentsByUser } = require('../../services/agents');

async function listAgentsHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const agents = await listAgentsByUser(userId);

    return ok({ agents });
  } catch (error) {
    console.error('List agents error', error);
    return internalServerError('Failed to fetch agents');
  }
}

exports.handler = withAuth(listAgentsHandler);
