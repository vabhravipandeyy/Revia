const { saveConnection } = require('../../services/ws-connections');
const { verifyToken } = require('../../lib/withAuth');

function response(statusCode, body) {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    const token = event.queryStringParameters?.token;

    if (!token) {
      return response(401, { message: 'Missing token' });
    }

    const claims = await verifyToken(token);
    const userId = claims.sub;
    const connectionId = event.requestContext.connectionId;

    await saveConnection({
      userId,
      connectionId,
      connectedAt: new Date().toISOString(),
      domainName: event.requestContext.domainName,
      stage: event.requestContext.stage,
    });

    return response(200, { message: 'Connected' });
  } catch (error) {
    console.error('WebSocket connect failed', error);
    return response(401, { message: 'Unauthorized' });
  }
};
