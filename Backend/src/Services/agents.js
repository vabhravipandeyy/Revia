const { randomUUID } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
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

function buildAgentRecord(input) {
  const timestamp = new Date().toISOString();

  return {
    agentId: randomUUID(),
    userId: input.userId,
    name: input.name,
    gender: input.gender,
    age: input.age,
    language: input.language,
    traits: input.traits || [],
    conversationStyle: input.conversationStyle,
    personaConfig: input.personaConfig || {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function createAgent(input) {
  const agent = buildAgentRecord(input);

  await docClient.send(
    new PutCommand({
      TableName: process.env.AGENTS_TABLE,
      Item: agent,
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(agentId)',
    })
  );

  return agent;
}

async function listAgentsByUser(userId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: process.env.AGENTS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false,
    })
  );

  return result.Items || [];
}

async function getAgentById(userId, agentId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.AGENTS_TABLE,
      Key: {
        userId,
        agentId,
      },
    })
  );

  return result.Item || null;
}

async function updateAgent(userId, agentId, updates) {
  const updateEntries = Object.entries(updates).filter(([, value]) => value !== undefined);

  if (updateEntries.length === 0) {
    return getAgentById(userId, agentId);
  }

  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  const updateExpressionParts = [];

  updateEntries.forEach(([key, value]) => {
    const nameKey = `#${key}`;
    const valueKey = `:${key}`;
    expressionAttributeNames[nameKey] = key;
    expressionAttributeValues[valueKey] = value;
    updateExpressionParts.push(`${nameKey} = ${valueKey}`);
  });

  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressionParts.push('#updatedAt = :updatedAt');

  const result = await docClient.send(
    new UpdateCommand({
      TableName: process.env.AGENTS_TABLE,
      Key: {
        userId,
        agentId,
      },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(agentId)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes || null;
}

async function deleteAgent(userId, agentId) {
  await docClient.send(
    new DeleteCommand({
      TableName: process.env.AGENTS_TABLE,
      Key: {
        userId,
        agentId,
      },
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(agentId)',
    })
  );
}

module.exports = {
  createAgent,
  listAgentsByUser,
  getAgentById,
  updateAgent,
  deleteAgent,
};
