const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  DynamoDBDocumentClient,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

const dynamoClient = new DynamoDBClient({ region });
const s3Client = new S3Client({ region });

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.txt',
  '.csv',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
]);

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
}

function validateUploadInput(fileName, fileType) {
  const extension = path.extname(fileName || '').toLowerCase();

  if (!fileName || typeof fileName !== 'string') {
    throw new Error('File name is required');
  }

  if (!fileType || typeof fileType !== 'string') {
    throw new Error('File type is required');
  }

  if (!ALLOWED_MIME_TYPES.has(fileType) || !ALLOWED_EXTENSIONS.has(extension)) {
    const error = new Error('Only TXT, CSV, PDF, and image files are supported');
    error.name = 'UnsupportedFileTypeError';
    throw error;
  }
}

function buildFileRecord({ userId, fileId, fileName, fileType }) {
  const timestamp = new Date().toISOString();
  const safeName = sanitizeFileName(fileName);
  const objectKey = `users/${userId}/uploads/${fileId}/${safeName}`;

  return {
    fileId,
    userId,
    fileName,
    fileType,
    objectKey,
    fileUrl: `https://${process.env.UPLOADS_BUCKET}.s3.${region}.amazonaws.com/${objectKey}`,
    status: 'pending',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildBucketHost() {
  return `${process.env.UPLOADS_BUCKET}.s3.${region}.amazonaws.com`;
}

function extractObjectKeyFromUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return null;
  }

  const trimmed = fileUrl.trim();

  try {
    const parsedUrl = new URL(trimmed);

    if (parsedUrl.hostname !== buildBucketHost()) {
      return null;
    }

    return decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  } catch (_error) {
    return null;
  }
}

async function createSignedViewUrlForFileUrl(fileUrl) {
  const objectKey = extractObjectKeyFromUrl(fileUrl);

  if (!objectKey) {
    return fileUrl;
  }

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: process.env.UPLOADS_BUCKET,
      Key: objectKey,
    }),
    {
      expiresIn: 3600,
    }
  );
}

async function hydratePersonaAvatarUrls(persona) {
  if (!persona || !persona.personaConfig) {
    return persona;
  }

  const rawAvatar =
    typeof persona.personaConfig.avatar === 'string' && persona.personaConfig.avatar.trim().length > 0
      ? persona.personaConfig.avatar.trim()
      : typeof persona.personaConfig.profileImage === 'string' && persona.personaConfig.profileImage.trim().length > 0
        ? persona.personaConfig.profileImage.trim()
        : null;

  if (!rawAvatar) {
    return persona;
  }

  let avatarUrl = rawAvatar;
  if (rawAvatar.startsWith('/photos/')) {
    const filename = path.basename(rawAvatar);
    avatarUrl = `https://${process.env.UPLOADS_BUCKET}.s3.${region}.amazonaws.com/defaults/${filename}`;
  }

  const resolvedAvatar = await createSignedViewUrlForFileUrl(avatarUrl);

  return {
    ...persona,
    personaConfig: {
      ...persona.personaConfig,
      avatar: resolvedAvatar,
      profileImage: resolvedAvatar,
    },
  };
}

async function createUploadSession({ userId, fileName, fileType }) {
  validateUploadInput(fileName, fileType);

  const fileId = randomUUID();
  const record = buildFileRecord({
    userId,
    fileId,
    fileName,
    fileType,
  });

  console.log('Preparing upload session', {
    userId,
    fileId,
    fileName,
    fileType,
    objectKey: record.objectKey,
  });

  await docClient.send(
    new PutCommand({
      TableName: process.env.UPLOADS_TABLE,
      Item: record,
      ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(fileId)',
    })
  );

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: process.env.UPLOADS_BUCKET,
      Key: record.objectKey,
      ContentType: fileType,
    }),
    {
      expiresIn: 300,
    }
  );

  const fileViewUrl = await createSignedViewUrlForFileUrl(record.fileUrl);

  return {
    uploadUrl,
    fileId: record.fileId,
    fileUrl: record.fileUrl,
    fileViewUrl,
  };
}

module.exports = {
  createUploadSession,
  createSignedViewUrlForFileUrl,
  hydratePersonaAvatarUrls,
};
