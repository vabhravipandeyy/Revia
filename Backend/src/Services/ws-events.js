const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { removeConnection } = require('./ws-connections');

function createManagementClient(domainName, stage) {
  return new ApiGatewayManagementApiClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
    endpoint: `https://${domainName}/${stage}`,
  });
}

async function postEventToConnection({
  domainName,
  stage,
  connectionId,
  payload,
  userId,
}) {
  const client = createManagementClient(domainName, stage);

  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(payload)),
      })
    );
  } catch (error) {
    if (error?.name === 'GoneException' && userId) {
      await removeConnection(userId, connectionId);
      return;
    }

    throw error;
  }
}

async function broadcastToConnections({
  domainName,
  stage,
  connections,
  payload,
}) {
  for (const connection of connections) {
    await postEventToConnection({
      domainName,
      stage,
      connectionId: connection.connectionId,
      userId: connection.userId,
      payload,
    });
  }
}

module.exports = {
  postEventToConnection,
  broadcastToConnections,
};
