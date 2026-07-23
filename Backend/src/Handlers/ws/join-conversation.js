const { getConnectionById, updateConnectionPresence } = require('../../services/ws-connections');
const { postEventToConnection } = require('../../services/ws-events');

function parseBody(event) {
  if (!event.body) {
    return {};
  }

  return JSON.parse(event.body);
}

exports.handler = async (event) => {
  try {
    const body = parseBody(event);
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
    const personaId = typeof body.personaId === 'string' ? body.personaId.trim() : '';
    const connectionId = event.requestContext.connectionId;
    const connection = await getConnectionById(connectionId);

    if (!connection) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unknown connection' }),
      };
    }

    await updateConnectionPresence({
      userId: connection.userId,
      connectionId,
      currentConversationId: conversationId || null,
      currentPersonaId: personaId || null,
    });

    await postEventToConnection({
      domainName: event.requestContext.domainName,
      stage: event.requestContext.stage,
      connectionId,
      userId: connection.userId,
      payload: {
        type: 'joined_conversation',
        conversationId,
        personaId,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Joined conversation' }),
    };
  } catch (error) {
    console.error('WebSocket join conversation failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to join conversation' }),
    };
  }
};
