const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

function getTableName() {
  return process.env.CONNECTIONS_TABLE;
}

async function saveConnection({
  userId,
  connectionId,
  connectedAt,
  domainName,
  stage,
  currentConversationId = null,
  currentPersonaId = null,
}) {
  await docClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: {
        userId,
        connectionId,
        connectedAt,
        domainName,
        stage,
        currentConversationId,
        currentPersonaId,
      },
    })
  );
}

async function listConnectionsForUser(userId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    })
  );

  return result.Items || [];
}

async function getConnectionById(connectionId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: 'ConnectionIdIndex',
      KeyConditionExpression: 'connectionId = :connectionId',
      ExpressionAttributeValues: {
        ':connectionId': connectionId,
      },
      Limit: 1,
    })
  );

  return result.Items?.[0] || null;
}

async function updateConnectionPresence({
  userId,
  connectionId,
  currentConversationId = null,
  currentPersonaId = null,
}) {
  await docClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: {
        userId,
        connectionId,
      },
      UpdateExpression:
        'SET currentConversationId = :currentConversationId, currentPersonaId = :currentPersonaId, lastSeenAt = :lastSeenAt',
      ExpressionAttributeValues: {
        ':currentConversationId': currentConversationId,
        ':currentPersonaId': currentPersonaId,
        ':lastSeenAt': new Date().toISOString(),
      },
    })
  );
}

async function removeConnection(userId, connectionId) {
  await docClient.send(
    new DeleteCommand({
      TableName: getTableName(),
      Key: {
        userId,
        connectionId,
      },
    })
  );
}

async function removeConnectionById(connectionId) {
  const connection = await getConnectionById(connectionId);

  if (!connection) {
    return null;
  }

  await removeConnection(connection.userId, connection.connectionId);
  return connection;
}

async function listConnectionsForConversation(userId, conversationId) {
  const connections = await listConnectionsForUser(userId);
  return connections.filter((connection) => connection.currentConversationId === conversationId);
}

async function updateConnectionSpacePresence(userId, connectionId, spaceId = null) {
  await docClient.send(
    new UpdateCommand({
      TableName: getTableName(),
      Key: {
        userId,
        connectionId,
      },
      UpdateExpression:
        'SET currentSpaceId = :currentSpaceId, lastSeenAt = :lastSeenAt',
      ExpressionAttributeValues: {
        ':currentSpaceId': spaceId,
        ':lastSeenAt': new Date().toISOString(),
      },
    })
  );
}

async function listConnectionsForSpace(userId, spaceId) {
  const connections = await listConnectionsForUser(userId);
  return connections.filter((connection) => connection.currentSpaceId === spaceId);
}

module.exports = {
  saveConnection,
  getConnectionById,
  updateConnectionPresence,
  removeConnection,
  removeConnectionById,
  listConnectionsForConversation,
  updateConnectionSpacePresence,
  listConnectionsForSpace,
};
