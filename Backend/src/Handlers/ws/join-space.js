const { getConnectionById, updateConnectionSpacePresence } = require('../../services/ws-connections');
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
    const spaceId = typeof body.spaceId === 'string' ? body.spaceId.trim() : '';
    const connectionId = event.requestContext.connectionId;
    const connection = await getConnectionById(connectionId);

    if (!connection) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unknown connection' }),
      };
    }

    await updateConnectionSpacePresence(connection.userId, connectionId, spaceId || null);

    await postEventToConnection({
      domainName: event.requestContext.domainName,
      stage: event.requestContext.stage,
      connectionId,
      userId: connection.userId,
      payload: {
        type: 'joined_space',
        spaceId,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Joined space' }),
    };
  } catch (error) {
    console.error('WebSocket join space failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to join space' }),
    };
  }
};
