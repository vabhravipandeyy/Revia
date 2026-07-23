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
const { DEFAULT_SPACES } = require('./default-spaces');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const SPACES_TABLE = process.env.SPACES_TABLE || 'revia-spaces-dev';

function buildSpaceRecord(input) {
  const timestamp = new Date().toISOString();

  return {
    userId: input.userId,
    spaceId: input.spaceId || randomUUID(),
    name: input.name,
    description: input.description || '',
    theme: input.theme || {
      primary: '#FF2E93',
      secondary: '#F5F5F7',
      gradient: 'linear-gradient(135deg, #FF2E93 0%, #111111 200%)',
    },
    agents: input.agents || [],
    coverImage: input.coverImage || null,
    isDefault: !!input.isDefault,
    vibe: input.vibe || '',
    lastMessagePreview: input.lastMessagePreview || null,
    lastMessageAt: input.lastMessageAt || null,
    lastActiveSpeakers: input.lastActiveSpeakers || [],
    currentTopic: input.currentTopic || null,
    emotionalTone: input.emotionalTone || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function createSpace(input) {
  const space = buildSpaceRecord(input);

  await docClient.send(
    new PutCommand({
      TableName: SPACES_TABLE,
      Item: space,
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(spaceId)',
    })
  );

  return space;
}

async function seedDefaultSpaces(userId) {
  const seeded = [];
  for (const def of DEFAULT_SPACES) {
    const spaceInput = {
      userId,
      spaceId: def.spaceId,
      name: def.name,
      description: def.description,
      vibe: def.vibe,
      agents: def.agents,
      theme: def.theme,
      isDefault: true,
    };
    try {
      const space = await createSpace(spaceInput);
      seeded.push(space);
    } catch (err) {
      // If it already exists, just ignore the error
      if (err.name !== 'ConditionalCheckFailedException') {
        console.error(`Failed to seed default space ${def.spaceId} for user ${userId}`, err);
      }
    }
  }
  return seeded;
}

async function listSpaces(userId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: SPACES_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    })
  );

  let items = result.Items || [];

  if (items.length === 0) {
    await seedDefaultSpaces(userId);
    // Re-query to get the seeded spaces
    const reQueryResult = await docClient.send(
      new QueryCommand({
        TableName: SPACES_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      })
    );
    items = reQueryResult.Items || [];
  }

  return items;
}

async function getSpace(userId, spaceId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: SPACES_TABLE,
      Key: {
        userId,
        spaceId,
      },
    })
  );

  if (!result.Item) {
    // If it's a default space, try seeding it dynamically or returning it
    const def = DEFAULT_SPACES.find((s) => s.spaceId === spaceId);
    if (def) {
      await seedDefaultSpaces(userId);
      const reResult = await docClient.send(
        new GetCommand({
          TableName: SPACES_TABLE,
          Key: {
            userId,
            spaceId,
          },
        })
      );
      return reResult.Item || null;
    }
  }

  return result.Item || null;
}

async function updateSpace(userId, spaceId, updates) {
  const updateEntries = Object.entries(updates).filter(([, value]) => value !== undefined);

  if (updateEntries.length === 0) {
    return getSpace(userId, spaceId);
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
      TableName: SPACES_TABLE,
      Key: {
        userId,
        spaceId,
      },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(spaceId)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes || null;
}

async function deleteSpace(userId, spaceId) {
  const space = await getSpace(userId, spaceId);
  if (!space) {
    throw new Error('Space not found');
  }

  if (space.isDefault) {
    throw new Error('Default spaces cannot be deleted');
  }

  await docClient.send(
    new DeleteCommand({
      TableName: SPACES_TABLE,
      Key: {
        userId,
        spaceId,
      },
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(spaceId)',
    })
  );
}

module.exports = {
  createSpace,
  listSpaces,
  getSpace,
  updateSpace,
  deleteSpace,
  seedDefaultSpaces,
};
