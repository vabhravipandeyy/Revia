const { randomUUID } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DeleteCommand,
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

function buildMemoryKey(personaId, timestamp, memoryId) {
  return `PERSONA#${personaId}#MEM#${timestamp}#${memoryId}`;
}

async function createMemory(input) {
  const memoryId = randomUUID();
  const timestamp = new Date().toISOString();
  const memory = {
    memoryId,
    userId: input.userId,
    personaId: input.personaId,
    summary: input.summary,
    embeddingText: input.embeddingText,
    tags: input.tags || [],
    createdAt: timestamp,
    memoryKey: buildMemoryKey(input.personaId, timestamp, memoryId),
  };

  await docClient.send(
    new PutCommand({
      TableName: process.env.MEMORIES_TABLE,
      Item: memory,
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(memoryKey)',
    })
  );

  return memory;
}

async function listPersonaMemories(userId, personaId, limit = 25) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: process.env.MEMORIES_TABLE,
      KeyConditionExpression: 'userId = :userId AND begins_with(memoryKey, :prefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': `PERSONA#${personaId}#`,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return result.Items || [];
}

async function deletePersonaMemories(userId, personaId) {
  const memories = await listPersonaMemories(userId, personaId, 100);

  for (const memory of memories) {
    await docClient.send(
      new DeleteCommand({
        TableName: process.env.MEMORIES_TABLE,
        Key: {
          userId,
          memoryKey: memory.memoryKey,
        },
      })
    );
  }

  return memories.length;
}

async function savePersonalFact(input) {
  const timestamp = new Date().toISOString();
  const fact = {
    userId: input.userId,
    personaId: input.personaId,
    type: 'personal_fact',
    factKey: input.factKey,
    factValue: input.factValue,
    confidence: input.confidence || 1.0,
    summary: `User's ${input.factKey.replace(/_/g, ' ')} is ${input.factValue}`,
    createdAt: timestamp,
    memoryKey: `PERSONA#${input.personaId}#FACT#${input.factKey}`,
  };

  await docClient.send(
    new PutCommand({
      TableName: process.env.MEMORIES_TABLE,
      Item: fact,
    })
  );

  return fact;
}

async function listPersonaFacts(userId, personaId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: process.env.MEMORIES_TABLE,
      KeyConditionExpression: 'userId = :userId AND begins_with(memoryKey, :prefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':prefix': `PERSONA#${personaId}#FACT#`,
      },
      ScanIndexForward: false,
    })
  );

  return result.Items || [];
}

module.exports = {
  createMemory,
  listPersonaMemories,
  deletePersonaMemories,
  savePersonalFact,
  listPersonaFacts,
};
