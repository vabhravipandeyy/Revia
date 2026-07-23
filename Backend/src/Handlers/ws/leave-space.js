const { getConnectionById, updateConnectionSpacePresence } = require('../../services/ws-connections');

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

    await updateConnectionSpacePresence(connection.userId, connectionId, null);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Left space' }),
    };
  } catch (error) {
    console.error('WebSocket leave space failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to leave space' }),
    };
  }
};
