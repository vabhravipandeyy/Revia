const { randomUUID } = require('node:crypto');
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

function buildConversationMessageKey(conversationId, timestamp, messageId) {
  return `CONVO#${conversationId}#TS#${timestamp}#MSG#${messageId}`;
}

function buildConversationMessage(input) {
  const messageId = input.messageId || randomUUID();
  const timestamp = input.timestamp || new Date().toISOString();

  return {
    messageId,
    conversationId: input.conversationId,
    personaId: input.personaId,
    userId: input.userId,
    role: input.role,
    text: input.text,
    replyToMessageId: input.replyToMessageId || undefined,
    replyPreview: input.replyPreview || undefined,
    status: input.status || 'sent',
    metadata: input.metadata || undefined,
    timestamp,
    messageKey: buildConversationMessageKey(input.conversationId, timestamp, messageId),
  };
}

async function createConversationMessage(input) {
  const message = buildConversationMessage(input);

  await docClient.send(
    new PutCommand({
      TableName: process.env.MESSAGES_TABLE,
      Item: message,
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(messageKey)',
    })
  );

  return message;
}

async function createConversationMessages(inputs) {
  const createdMessages = [];

  for (const input of inputs) {
    const message = await createConversationMessage(input);
    createdMessages.push(message);
  }

  return createdMessages;
}

async function listConversationMessages(userId, conversationId, options = {}) {
  const limit = options.limit || 50;
  const newestFirst = options.newestFirst || false;

  const result = await docClient.send(
    new QueryCommand({
      TableName: process.env.MESSAGES_TABLE,
      KeyConditionExpression: 'userId = :userId AND begins_with(messageKey, :prefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': `CONVO#${conversationId}#`,
      },
      // Always query newest-first so limited history keeps the latest messages.
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  const items = result.Items || [];
  return newestFirst ? items : [...items].reverse();
}

async function listRecentConversationMessages(userId, conversationId, limit = 12) {
  const recentMessages = await listConversationMessages(userId, conversationId, {
    limit,
    newestFirst: true,
  });

  return [...recentMessages].reverse();
}

async function getLatestConversationMessage(userId, conversationId) {
  const [latestMessage] = await listConversationMessages(userId, conversationId, {
    limit: 1,
    newestFirst: true,
  });

  return latestMessage || null;
}

async function deleteConversationMessages(userId, conversationId) {
  const messages = await listConversationMessages(userId, conversationId, {
    limit: 200,
    newestFirst: false,
  });

  for (const message of messages) {
    await docClient.send(
      new DeleteCommand({
        TableName: process.env.MESSAGES_TABLE,
        Key: {
          userId,
          messageKey: message.messageKey,
        },
      })
    );
  }

  return messages.length;
}

async function updateMessageStatus(userId, messageKey, status) {
  await docClient.send(
    new UpdateCommand({
      TableName: process.env.MESSAGES_TABLE,
      Key: {
        userId,
        messageKey,
      },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
    })
  );
}

module.exports = {
  createConversationMessage,
  createConversationMessages,
  listConversationMessages,
  listRecentConversationMessages,
  getLatestConversationMessage,
  deleteConversationMessages,
  buildConversationMessageKey,
  updateMessageStatus,
};
