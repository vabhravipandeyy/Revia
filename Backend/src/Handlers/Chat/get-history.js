const { internalServerError, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { getConversationHistory } = require('../../services/chat');

async function getHistoryHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const conversationId = event.pathParameters?.conversationId;

    const messages = await getConversationHistory({
      userId,
      conversationId,
    });

    return ok({
      conversationId,
      messages,
    });
  } catch (error) {
    console.error('Get chat history error', error);
    return internalServerError('Failed to fetch chat history');
  }
}

exports.handler = withAuth(getHistoryHandler);
