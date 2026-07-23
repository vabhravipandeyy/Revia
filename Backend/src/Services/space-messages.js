const { randomUUID } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const { updateSpace } = require('./spaces');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const SPACE_MESSAGES_TABLE = process.env.SPACE_MESSAGES_TABLE || 'revia-space-messages-dev';

function buildUserSpaceKey(userId, spaceId) {
  return `${userId}#${spaceId}`;
}

function buildMessageKey(timestamp, messageId) {
  return `TS#${timestamp}#MSG#${messageId}`;
}

function buildSpaceMessage(input) {
  const messageId = randomUUID();
  const timestamp = input.timestamp || new Date().toISOString();

  return {
    userSpaceKey: buildUserSpaceKey(input.userId, input.spaceId),
    messageKey: buildMessageKey(timestamp, messageId),
    messageId,
    spaceId: input.spaceId,
    senderId: input.senderId,
    senderType: input.senderType, // 'user' | 'agent' | 'system'
    senderName: input.senderName,
    text: input.text,
    replyTo: input.replyTo || undefined,
    metadata: input.metadata || undefined,
    timestamp,
  };
}

async function createSpaceMessage(input) {
  const message = buildSpaceMessage(input);

  await docClient.send(
    new PutCommand({
      TableName: SPACE_MESSAGES_TABLE,
      Item: message,
      ConditionExpression: 'attribute_not_exists(userSpaceKey) AND attribute_not_exists(messageKey)',
    })
  );

  // Update last message details in Spaces table asynchronously
  try {
    await updateSpace(input.userId, input.spaceId, {
      lastMessagePreview: input.text.substring(0, 100),
      lastMessageAt: message.timestamp,
    });
  } catch (err) {
    console.error('Failed to update space last message info', err);
  }

  return message;
}

async function createSpaceMessages(inputs) {
  const createdMessages = [];

  for (const input of inputs) {
    const message = await createSpaceMessage(input);
    createdMessages.push(message);
  }

  return createdMessages;
}

async function listSpaceMessages(userId, spaceId, options = {}) {
  const limit = options.limit || 50;
  const newestFirst = options.newestFirst || false;
  const userSpaceKey = buildUserSpaceKey(userId, spaceId);

  const queryParams = {
    TableName: SPACE_MESSAGES_TABLE,
    KeyConditionExpression: 'userSpaceKey = :userSpaceKey AND begins_with(messageKey, :prefix)',
    ExpressionAttributeValues: {
      ':userSpaceKey': userSpaceKey,
      ':prefix': 'TS#',
    },
    ScanIndexForward: false, // Always query newest-first so limited history keeps the latest messages.
    Limit: limit,
  };

  if (options.lastKey) {
    queryParams.ExclusiveStartKey = options.lastKey;
  }

  const result = await docClient.send(new QueryCommand(queryParams));

  const items = result.Items || [];
  return {
    messages: newestFirst ? items : [...items].reverse(),
    lastKey: result.LastEvaluatedKey || null,
  };
}

async function listRecentSpaceMessages(userId, spaceId, count = 30) {
  const { messages } = await listSpaceMessages(userId, spaceId, {
    limit: count,
    newestFirst: true,
  });

  return [...messages].reverse();
}

async function getLatestSpaceMessage(userId, spaceId) {
  const { messages } = await listSpaceMessages(userId, spaceId, {
    limit: 1,
    newestFirst: true,
  });

  return messages[0] || null;
}

module.exports = {
  createSpaceMessage,
  createSpaceMessages,
  listSpaceMessages,
  listRecentSpaceMessages,
  getLatestSpaceMessage,
};
