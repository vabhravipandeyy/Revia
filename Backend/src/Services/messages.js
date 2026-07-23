const { randomUUID } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

function buildMessageSortKey(agentId, timestamp, messageId) {
  return `AGENT#${agentId}#TS#${timestamp}#MSG#${messageId}`;
}

function buildMessageRecord(input) {
  const messageId = randomUUID();
  const timestamp = new Date().toISOString();

  return {
    messageId,
    userId: input.userId,
    agentId: input.agentId,
    role: input.role,
    text: input.text,
    timestamp,
    messageKey: buildMessageSortKey(input.agentId, timestamp, messageId),
  };
}

async function createMessage(input) {
  const message = buildMessageRecord(input);

  await docClient.send(
    new PutCommand({
      TableName: process.env.MESSAGES_TABLE,
      Item: message,
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(messageKey)',
    })
  );

  return message;
}

async function listMessagesByAgent(userId, agentId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: process.env.MESSAGES_TABLE,
      KeyConditionExpression: 'userId = :userId AND begins_with(messageKey, :prefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': `AGENT#${agentId}#`,
      },
      ScanIndexForward: true,
    })
  );

  return result.Items || [];
}

async function deleteMessagesByAgent(userId, agentId) {
  const messages = await listMessagesByAgent(userId, agentId);

  if (messages.length === 0) {
    return 0;
  }

  let deletedCount = 0;

  for (let index = 0; index < messages.length; index += 25) {
    const chunk = messages.slice(index, index + 25);

    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [process.env.MESSAGES_TABLE]: chunk.map((message) => ({
            DeleteRequest: {
              Key: {
                userId,
                messageKey: message.messageKey,
              },
            },
          })),
        },
      })
    );

    deletedCount += chunk.length;
  }

  return deletedCount;
}

module.exports = {
  buildMessageSortKey,
  createMessage,
  listMessagesByAgent,
  deleteMessagesByAgent,
};
