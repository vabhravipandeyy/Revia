const { removeConnectionById } = require('../../services/ws-connections');

exports.handler = async (event) => {
  try {
    await removeConnectionById(event.requestContext.connectionId);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected' }),
    };
  } catch (error) {
    console.error('WebSocket disconnect failed', error);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnect cleanup skipped' }),
    };
  }
};
