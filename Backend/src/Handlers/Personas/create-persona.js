const { badRequest, created, internalServerError, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { createPersona } = require('../../services/personas');
const { hydratePersonaAvatarUrls } = require('../../services/uploads');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

async function createPersonaHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const body = parseJsonBody(event);

    const name = normalizeString(body.name);
    const age = body.age === undefined || body.age === null || body.age === '' ? undefined : Number(body.age);

    if (!name) {
      return badRequest('Persona name is required');
    }

    if (age !== undefined && (Number.isNaN(age) || age <= 0)) {
      return badRequest('Age must be a valid positive number');
    }

    const persona = await createPersona({
      userId,
      name,
      age,
      gender: normalizeString(body.gender)?.toLowerCase(),
      language: normalizeString(body.language) || 'English',
      traits: normalizeArray(body.traits),
      speakingStyle: normalizeArray(body.speakingStyle),
      emotionalTone: normalizeString(body.emotionalTone) || 'balanced',
      relationshipType: normalizeString(body.relationshipType) || 'companion',
      replyBehavior: normalizeString(body.replyBehavior) || 'thoughtful',
      modelProvider: normalizeString(body.modelProvider) || 'groq',
      modelName:
        normalizeString(body.modelName) ||
        process.env.GROQ_MODEL ||
        process.env.DEFAULT_MODEL_NAME ||
        'llama-3.3-70b-versatile',
      personaConfig:
        body.personaConfig && typeof body.personaConfig === 'object' && !Array.isArray(body.personaConfig)
          ? body.personaConfig
          : {},
    });

    const hydratedPersona = await hydratePersonaAvatarUrls(persona);

    return created({
      message: 'Persona created successfully',
      persona: hydratedPersona,
    });
  } catch (error) {
    console.error('Create persona error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    return internalServerError('Failed to create persona');
  }
}

exports.handler = withAuth(createPersonaHandler);
