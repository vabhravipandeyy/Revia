const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { generateGroqResponse } = require('../models/groq');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const dynamoClient = new DynamoDBClient({ region });
const s3Client = new S3Client({ region });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

async function getFileContent(bucketName, objectKey) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    const response = await s3Client.send(command);
    return await response.Body.transformToString('utf-8');
  } catch (error) {
    console.error(`Failed to get S3 object content: ${objectKey}`, error);
    return '';
  }
}

async function processPersonaKnowledge(userId, persona) {
  const uploadedFileIds = persona.personaConfig?.uploadedFileIds || [];
  if (uploadedFileIds.length === 0) {
    return null;
  }

  console.log(`Processing knowledge files for user ${userId}, persona ${persona.name}:`, uploadedFileIds);
  const fileContents = [];

  for (const fileId of uploadedFileIds) {
    try {
      const getResult = await docClient.send(
        new GetCommand({
          TableName: process.env.UPLOADS_TABLE,
          Key: {
            userId,
            fileId,
          },
        })
      );

      const fileRecord = getResult.Item;
      if (!fileRecord || !fileRecord.objectKey) {
        console.warn(`File record not found or missing S3 key: ${fileId}`);
        continue;
      }

      // We only parse text and CSV files
      const isText = fileRecord.fileType?.includes('text') || 
                     fileRecord.fileType?.includes('csv') ||
                     fileRecord.fileName?.endsWith('.txt') || 
                     fileRecord.fileName?.endsWith('.csv');

      if (!isText) {
        console.log(`Skipping non-text file parsing: ${fileRecord.fileName} (${fileRecord.fileType})`);
        continue;
      }

      const content = await getFileContent(process.env.UPLOADS_BUCKET, fileRecord.objectKey);
      if (content.trim()) {
        fileContents.push(`--- File: ${fileRecord.fileName} ---\n${content}`);
      }
    } catch (err) {
      console.error(`Error loading file ID ${fileId}:`, err);
    }
  }

  if (fileContents.length === 0) {
    return null;
  }

  const mergedContents = fileContents.join('\n\n');
  const systemPrompt = `You are a specialized cognitive compiler. Your task is to process uploaded documentation, notes, vocabulary, or behavioral instructions for a companion persona named '${persona.name}'.
Extract details from the provided texts to construct a unified persona profile.

You must reply with a valid JSON block containing four string fields:
1. semanticSummary: Key background details, facts, memories, or stories about the persona or user described in the text.
2. emotionalPatterns: Emotional traits, fears, attachment tendencies, or vulnerabilities of the persona.
3. speakingStyle: Specific words, phrases, linguistic habits, spelling habits, slang, Hinglish patterns, or punctuation styles observed.
4. behavioralGuidelines: Specific rules on how this persona should react, behave, or reply in conversations according to the texts.

Ensure your response is valid JSON only. Do not enclose it in markdown code blocks or add any conversational intro/outro text.`;

  const userMessage = `Process the following knowledge documents:\n\n${mergedContents.slice(0, 15000)}`;

  try {
    const aiResponse = await generateGroqResponse({
      systemPrompt,
      userMessage,
      recentMessages: [],
    });

    let rawJsonText = aiResponse.text || '';
    
    // Clean up code block formatting if Groq added it despite instructions
    if (rawJsonText.includes('```')) {
      rawJsonText = rawJsonText.replace(/```json|```/g, '').trim();
    }

    const parsedProfile = JSON.parse(rawJsonText);
    console.log(`Successfully compiled knowledge profile for persona: ${persona.name}`);
    return {
      semanticSummary: parsedProfile.semanticSummary || '',
      emotionalPatterns: parsedProfile.emotionalPatterns || '',
      speakingStyle: parsedProfile.speakingStyle || '',
      behavioralGuidelines: parsedProfile.behavioralGuidelines || '',
    };
  } catch (error) {
    console.error('Failed to parse Groq response for knowledge profile, using raw compilation fallback', error);
    // Fallback: use a basic slice of the text
    return {
      semanticSummary: `Knowledge summary:\n${mergedContents.slice(0, 500)}`,
      emotionalPatterns: '',
      speakingStyle: '',
      behavioralGuidelines: 'Adopt traits and details described in the knowledge files.',
    };
  }
}

module.exports = {
  processPersonaKnowledge,
};
