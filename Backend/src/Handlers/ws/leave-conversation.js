const { getConnectionById, updateConnectionPresence } = require('../../services/ws-connections');

exports.handler = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const connection = await getConnectionById(connectionId);

    if (!connection) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Connection already gone' }),
      };
    }

    await updateConnectionPresence({
      userId: connection.userId,
      connectionId,
      currentConversationId: null,
      currentPersonaId: null,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Left conversation' }),
    };
  } catch (error) {
    console.error('WebSocket leave conversation failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to leave conversation' }),
    };
  }
};
