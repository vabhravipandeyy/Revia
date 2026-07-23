const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

async function putUserProfile(user) {
  await docClient.send(
    new PutCommand({
      TableName: process.env.USERS_TABLE,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)',
    })
  );

  return user;
}

async function getUserProfile(userId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: {
        userId,
      },
    })
  );

  return result.Item || null;
}

async function updateUserProfile(userId, updates) {
  const updateEntries = Object.entries(updates).filter(([, value]) => value !== undefined);

  if (updateEntries.length === 0) {
    return getUserProfile(userId);
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
      TableName: process.env.USERS_TABLE,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(userId)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes || null;
}

async function deleteUserProfile(userId) {
  await docClient.send(
    new DeleteCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
    })
  );
}

module.exports = {
  putUserProfile,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
};
