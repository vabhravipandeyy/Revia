const { badRequest, internalServerError, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { listMessagesByAgent } = require('../../services/messages');

async function listMessagesHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const agentId = event.pathParameters?.agentId;

    if (!agentId) {
      return badRequest('agentId is required');
    }

    const messages = await listMessagesByAgent(userId, agentId);

    return ok({ messages });
  } catch (error) {
    console.error('List messages error', error);
    return internalServerError('Failed to fetch messages');
  }
}

exports.handler = withAuth(listMessagesHandler);
