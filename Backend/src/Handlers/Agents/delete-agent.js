const { internalServerError, notFound, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { deleteAgent, getAgentById } = require('../../services/agents');
const { deleteMessagesByAgent } = require('../../services/messages');

async function deleteAgentHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const agentId = event.pathParameters?.id;

    const existingAgent = await getAgentById(userId, agentId);

    if (!existingAgent) {
      return notFound('Agent not found');
    }

    await deleteMessagesByAgent(userId, agentId);
    await deleteAgent(userId, agentId);

    return ok({
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    console.error('Delete agent error', error);

    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Agent not found');
    }

    return internalServerError('Failed to delete agent');
  }
}

exports.handler = withAuth(deleteAgentHandler);
