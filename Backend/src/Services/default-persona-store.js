const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { buildDefaultPersonaRecords } = require('./default-personas');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

function getTableName() {
  return process.env.DEFAULT_PERSONAS_TABLE;
}

async function ensureDefaultPersonaCatalogSeeded() {
  const tableName = getTableName();

  if (!tableName) {
    throw new Error('DEFAULT_PERSONAS_TABLE is not configured');
  }

  const existing = await docClient.send(
    new ScanCommand({
      TableName: tableName,
      Limit: 1,
    })
  );

  if (existing.Items && existing.Items.length > 0) {
    return;
  }

  const defaults = buildDefaultPersonaRecords();

  for (const persona of defaults) {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: persona,
      })
    );
  }
}

async function listDefaultPersonas() {
  await ensureDefaultPersonaCatalogSeeded();

  const result = await docClient.send(
    new ScanCommand({
      TableName: getTableName(),
    })
  );

  return result.Items || [];
}

async function getDefaultPersonaById(personaId) {
  await ensureDefaultPersonaCatalogSeeded();

  const result = await docClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: {
        personaId,
      },
    })
  );

  return result.Item || null;
}

module.exports = {
  ensureDefaultPersonaCatalogSeeded,
  listDefaultPersonas,
  getDefaultPersonaById,
};
