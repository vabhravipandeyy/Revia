const { randomUUID } = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { bindDefaultPersonaToUser } = require('./default-personas');
const { getDefaultPersonaById, listDefaultPersonas } = require('./default-persona-store');
const { getLatestConversationMessage } = require('./chat-messages');
const { processPersonaKnowledge } = require('./knowledge-processor');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function mergeMissingDefaultPersonaData(existingRecord, defaultRecord) {
  if (!existingRecord || !defaultRecord) {
    return existingRecord;
  }

  const existingConfig = normalizePersonaConfig(existingRecord.personaConfig);
  const defaultConfig = normalizePersonaConfig(defaultRecord.personaConfig);

  return {
    ...existingRecord,
    personaId: existingRecord.personaId || defaultRecord.personaId,
    agentId: existingRecord.agentId || existingRecord.personaId || defaultRecord.personaId,
    userId: existingRecord.userId || defaultRecord.userId,
    name: firstDefined(existingRecord.name, defaultRecord.name),
    age: firstDefined(existingRecord.age, defaultRecord.age),
    gender: firstDefined(existingRecord.gender, defaultRecord.gender),
    language: firstDefined(existingRecord.language, defaultRecord.language),
    traits:
      Array.isArray(existingRecord.traits) && existingRecord.traits.length > 0
        ? existingRecord.traits
        : defaultRecord.traits || [],
    speakingStyle:
      Array.isArray(existingRecord.speakingStyle) && existingRecord.speakingStyle.length > 0
        ? existingRecord.speakingStyle
        : defaultRecord.speakingStyle || [],
    emotionalTone: firstDefined(existingRecord.emotionalTone, defaultRecord.emotionalTone),
    relationshipType: firstDefined(existingRecord.relationshipType, defaultRecord.relationshipType),
    replyBehavior: firstDefined(existingRecord.replyBehavior, defaultRecord.replyBehavior),
    modelProvider: firstDefined(existingRecord.modelProvider, defaultRecord.modelProvider),
    modelName: firstDefined(existingRecord.modelName, defaultRecord.modelName),
    category: firstDefined(existingRecord.category, defaultRecord.category, ''),
    spontaneityLevel: firstDefined(existingRecord.spontaneityLevel, defaultRecord.spontaneityLevel, 'medium'),
    editable: existingRecord.editable !== undefined ? existingRecord.editable : defaultRecord.editable,
    createdAt: firstDefined(existingRecord.createdAt, defaultRecord.createdAt),
    updatedAt: new Date().toISOString(),
    personaConfig: {
      ...defaultConfig,
      ...existingConfig,
      avatar: firstDefined(existingConfig.avatar, existingConfig.profileImage, defaultConfig.avatar, defaultConfig.profileImage),
      profileImage: firstDefined(existingConfig.avatar, existingConfig.profileImage, defaultConfig.avatar, defaultConfig.profileImage),
      theme: {
        ...(defaultConfig.theme || {}),
        ...(existingConfig.theme || {}),
      },
    },
  };
}

function normalizePersonaConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {};
  }

  const avatarFromConfig =
    typeof config.avatar === 'string' && config.avatar.trim().length > 0
      ? config.avatar.trim()
      : typeof config.profileImage === 'string' && config.profileImage.trim().length > 0
        ? config.profileImage.trim()
        : undefined;

  return {
    ...config,
    ...(avatarFromConfig
      ? {
        avatar: avatarFromConfig,
        profileImage: avatarFromConfig,
      }
      : {}),
  };
}

function buildPersonaRecord(input) {
  const timestamp = new Date().toISOString();
  const personaId = randomUUID();

  return {
    personaId,
    agentId: personaId,
    userId: input.userId,
    name: input.name,
    age: input.age,
    gender: input.gender,
    language: input.language,
    traits: input.traits || [],
    speakingStyle: input.speakingStyle || [],
    emotionalTone: input.emotionalTone,
    relationshipType: input.relationshipType,
    replyBehavior: input.replyBehavior,
    modelProvider: input.modelProvider || process.env.DEFAULT_MODEL_PROVIDER || 'groq',
    modelName: input.modelName || process.env.GROQ_MODEL || process.env.DEFAULT_MODEL_NAME || 'llama-3.3-70b-versatile',
    personaConfig: normalizePersonaConfig(input.personaConfig),
    category: input.category || '',
    spontaneityLevel: input.spontaneityLevel || 'medium',
    editable: input.editable !== false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function createPersona(input) {
  const persona = buildPersonaRecord(input);

  if (persona.personaConfig?.uploadedFileIds?.length > 0) {
    try {
      const profile = await processPersonaKnowledge(input.userId, persona);
      if (profile) {
        persona.personaConfig.knowledgeProfile = profile;
      }
    } catch (err) {
      console.error('Failed to compile knowledge profile during persona creation:', err);
    }
  }

  await docClient.send(
    new PutCommand({
      TableName: process.env.AGENTS_TABLE,
      Item: persona,
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(agentId)',
    })
  );

  return persona;
}

async function listPersonasByUser(userId) {
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

  const customPersonas = (result.Items || []).map(normalizeLegacyPersonaRecord);
  const defaultPersonas = await listDefaultPersonas();
  const defaultPersonaMap = new Map(defaultPersonas.map((persona) => [persona.personaId, persona]));

  for (const item of customPersonas) {
    const defaultPersona = defaultPersonaMap.get(item.personaId);

    if (!defaultPersona) {
      continue;
    }

    const merged = mergeMissingDefaultPersonaData(item, bindDefaultPersonaToUser(defaultPersona, userId));
    const changed = JSON.stringify(item) !== JSON.stringify(merged);

    if (!changed) {
      continue;
    }

    try {
      await docClient.send(
        new PutCommand({
          TableName: process.env.AGENTS_TABLE,
          Item: merged,
        })
      );
      Object.assign(item, merged);
    } catch (error) {
      console.error('Failed to enrich custom persona with default metadata', merged.personaId, error);
    }
  }

  const customIds = new Set(customPersonas.map((item) => item.personaId));
  const boundDefaultPersonas = defaultPersonas
    .filter((persona) => !customIds.has(persona.personaId))
    .map((persona) => normalizeLegacyPersonaRecord(bindDefaultPersonaToUser(persona, userId)));
  const allPersonas = [...customPersonas, ...boundDefaultPersonas];
  const latestMessages = await Promise.all(
    allPersonas.map(async (persona) => [persona.personaId, await getLatestConversationMessage(userId, persona.personaId)])
  );
  const latestMessageMap = new Map(latestMessages);

  return allPersonas
    .map((persona) => attachLatestConversationPreview(persona, latestMessageMap.get(persona.personaId) || null))
    .sort((left, right) => {
      const rightActivity = new Date(
        right.lastMessageAt || right.updatedAt || right.createdAt || 0
      ).getTime();
      const leftActivity = new Date(
        left.lastMessageAt || left.updatedAt || left.createdAt || 0
      ).getTime();

      return rightActivity - leftActivity;
    });
}

async function getPersonaById(userId, personaId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.AGENTS_TABLE,
      Key: {
        userId,
        agentId: personaId,
      },
    })
  );

  if (result.Item) {
    return normalizeLegacyPersonaRecord(result.Item);
  }

  const defaultPersona = await getDefaultPersonaById(personaId);
  return defaultPersona ? normalizeLegacyPersonaRecord(bindDefaultPersonaToUser(defaultPersona, userId)) : null;
}

async function updatePersona(userId, personaId, updates) {
  const updateEntries = Object.entries(updates).filter(([, value]) => value !== undefined);

  if (updateEntries.length === 0) {
    return getPersonaById(userId, personaId);
  }

  const existingRecordResult = await docClient.send(
    new GetCommand({
      TableName: process.env.AGENTS_TABLE,
      Key: {
        userId,
        agentId: personaId,
      },
    })
  );

  if (!existingRecordResult.Item) {
    const defaultPersona = await getDefaultPersonaById(personaId);
    if (!defaultPersona) {
      return null;
    }

    const basePersona = normalizeLegacyPersonaRecord(bindDefaultPersonaToUser(defaultPersona, userId));
    const nextPersona = {
      ...basePersona,
      ...updates,
      personaConfig:
        updates.personaConfig === undefined
          ? basePersona.personaConfig
          : normalizePersonaConfig({
            ...basePersona.personaConfig,
            ...updates.personaConfig,
          }),
      updatedAt: new Date().toISOString(),
    };

    if (nextPersona.personaConfig?.uploadedFileIds?.length > 0) {
      try {
        const profile = await processPersonaKnowledge(userId, nextPersona);
        if (profile) {
          nextPersona.personaConfig.knowledgeProfile = profile;
        }
      } catch (err) {
        console.error('Failed to compile knowledge profile during default persona edit:', err);
      }
    }

    await docClient.send(
      new PutCommand({
        TableName: process.env.AGENTS_TABLE,
        Item: nextPersona,
      })
    );

    return normalizeLegacyPersonaRecord(nextPersona);
  }

  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  const updateExpressionParts = [];
  const existingRecord = normalizeLegacyPersonaRecord(existingRecordResult.Item);

  let nextConfig = existingRecord.personaConfig;
  const configEntry = updateEntries.find(([key]) => key === 'personaConfig');
  if (configEntry) {
    nextConfig = normalizePersonaConfig({
      ...existingRecord.personaConfig,
      ...configEntry[1],
    });

    const oldFileIds = existingRecord.personaConfig?.uploadedFileIds || [];
    const newFileIds = nextConfig?.uploadedFileIds || [];
    const fileIdsChanged = JSON.stringify(oldFileIds) !== JSON.stringify(newFileIds);

    if (fileIdsChanged && newFileIds.length > 0) {
      try {
        const tempPersona = { ...existingRecord, personaConfig: nextConfig };
        const profile = await processPersonaKnowledge(userId, tempPersona);
        if (profile) {
          nextConfig.knowledgeProfile = profile;
        }
      } catch (err) {
        console.error('Failed to compile knowledge profile during persona update:', err);
      }
    } else if (newFileIds.length === 0) {
      delete nextConfig.knowledgeProfile;
    }
  }

  updateEntries.forEach(([key, value]) => {
    const nameKey = `#${key}`;
    const valueKey = `:${key}`;
    expressionAttributeNames[nameKey] = key;
    expressionAttributeValues[valueKey] =
      key === 'personaConfig' ? nextConfig : value;
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
        agentId: personaId,
      },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(agentId)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes ? normalizeLegacyPersonaRecord(result.Attributes) : null;
}

async function deletePersona(userId, personaId) {
  await docClient.send(
    new DeleteCommand({
      TableName: process.env.AGENTS_TABLE,
      Key: {
        userId,
        agentId: personaId,
      },
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(agentId)',
    })
  );
}

function normalizeLegacyPersonaRecord(record) {
  if (!record) {
    return null;
  }

  const normalizedRecord = record.personaId
    ? record
    : {
    personaId: record.agentId,
    userId: record.userId,
    name: record.name,
    age: record.age,
    gender: record.gender,
    language: record.language,
    traits: record.traits || [],
    speakingStyle: Array.isArray(record.conversationStyle)
      ? record.conversationStyle
      : record.conversationStyle
        ? [record.conversationStyle]
        : [],
    emotionalTone: record.personaConfig?.emotionalTone || 'balanced',
    relationshipType: record.personaConfig?.relationshipType || 'companion',
    replyBehavior: record.personaConfig?.replyBehavior || 'thoughtful',
    modelProvider: record.personaConfig?.modelProvider || process.env.DEFAULT_MODEL_PROVIDER || 'groq',
    modelName:
      record.personaConfig?.modelName ||
      process.env.GROQ_MODEL ||
      process.env.DEFAULT_MODEL_NAME ||
      'llama-3.3-70b-versatile',
    personaConfig: record.personaConfig || {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  const defaultRelationship = {
    closenessScore: 0.2,
    comfortLevel: 'casual',
    attachmentLevel: 'low',
    insideJokes: [],
    lastInteractionTime: normalizedRecord.updatedAt || new Date().toISOString(),
    interactionCount: 0,
  };

  const relationship = {
    ...defaultRelationship,
    ...(normalizedRecord.relationship || record.relationship || {}),
  };

  const defaultConversationalState = {
    activeTopics: [],
    unresolvedTopics: [],
    lastFollowUpTimestamp: null,
  };

  const conversationalState = {
    ...defaultConversationalState,
    ...(normalizedRecord.conversationalState || record.conversationalState || {}),
  };

  const moodState = normalizedRecord.moodState || record.moodState || 'neutral';

  return {
    ...normalizedRecord,
    agentId: normalizedRecord.agentId || normalizedRecord.personaId,
    category: normalizedRecord.category || record.category || '',
    spontaneityLevel: normalizedRecord.spontaneityLevel || record.spontaneityLevel || 'medium',
    editable: normalizedRecord.editable !== undefined ? normalizedRecord.editable : (record.editable !== undefined ? record.editable : true),
    lastMessageAt: normalizedRecord.lastMessageAt || normalizedRecord.personaConfig?.lastMessageAt || null,
    relationship,
    moodState,
    conversationalState,
    personaConfig: {
      avatar: normalizedRecord.personaConfig?.avatar || normalizedRecord.personaConfig?.profileImage,
      profileImage: normalizedRecord.personaConfig?.avatar || normalizedRecord.personaConfig?.profileImage,
      tagline: normalizedRecord.personaConfig?.tagline,
      description: normalizedRecord.personaConfig?.description,
      lastMessage: normalizedRecord.personaConfig?.lastMessage || '',
      status: normalizedRecord.personaConfig?.status || 'ready',
      lastSeen: normalizedRecord.personaConfig?.lastSeen || '',
      responseSpeed: normalizedRecord.personaConfig?.responseSpeed || normalizedRecord.replyBehavior || 'Thoughtful',
      theme: normalizedRecord.personaConfig?.theme,
      ...normalizedRecord.personaConfig,
    },
  };
}

function attachLatestConversationPreview(persona, latestMessage) {
  if (!latestMessage) {
    return persona;
  }

  return {
    ...persona,
    lastMessageAt: latestMessage.timestamp,
    personaConfig: {
      ...persona.personaConfig,
      lastMessage:
        typeof latestMessage.text === 'string' && latestMessage.text.trim().length > 0
          ? latestMessage.text.trim()
          : persona.personaConfig?.lastMessage || '',
      lastMessageAt: latestMessage.timestamp,
    },
  };
}

module.exports = {
  createPersona,
  listPersonasByUser,
  getPersonaById,
  updatePersona,
  deletePersona,
};
