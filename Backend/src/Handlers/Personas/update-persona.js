const { badRequest, internalServerError, notFound, ok, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { getPersonaById, updatePersona } = require('../../services/personas');
const { hydratePersonaAvatarUrls } = require('../../services/uploads');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeArray(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function isPreferenceOnlyPersonaUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }

  const allowedTopLevelKeys = ['personaConfig'];
  const bodyKeys = Object.keys(body);

  if (bodyKeys.length === 0 || bodyKeys.some((key) => !allowedTopLevelKeys.includes(key))) {
    return false;
  }

  if (!body.personaConfig || typeof body.personaConfig !== 'object' || Array.isArray(body.personaConfig)) {
    return false;
  }

  const allowedConfigKeys = ['isPinned', 'isArchived'];
  const configKeys = Object.keys(body.personaConfig);

  return configKeys.length > 0 && configKeys.every((key) => allowedConfigKeys.includes(key));
}

async function updatePersonaHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const personaId = event.pathParameters?.id;
    const body = parseJsonBody(event);
    const age = body.age === undefined || body.age === null || body.age === '' ? undefined : Number(body.age);
    const existingPersona = await getPersonaById(userId, personaId);

    if (!existingPersona) {
      return notFound('Persona not found');
    }

    if (existingPersona.editable === false && !isPreferenceOnlyPersonaUpdate(body)) {
      return badRequest('Default signature personas cannot be edited');
    }

    if (age !== undefined && (Number.isNaN(age) || age <= 0)) {
      return badRequest('Age must be a valid positive number');
    }

    const persona = await updatePersona(userId, personaId, {
      name: normalizeString(body.name),
      age,
      gender: normalizeString(body.gender)?.toLowerCase(),
      language: normalizeString(body.language),
      traits: normalizeArray(body.traits),
      speakingStyle: normalizeArray(body.speakingStyle),
      emotionalTone: normalizeString(body.emotionalTone),
      relationshipType: normalizeString(body.relationshipType),
      replyBehavior: normalizeString(body.replyBehavior),
      modelProvider: normalizeString(body.modelProvider),
      modelName: normalizeString(body.modelName),
      personaConfig:
        body.personaConfig === undefined
          ? undefined
          : body.personaConfig && typeof body.personaConfig === 'object' && !Array.isArray(body.personaConfig)
            ? {
              ...existingPersona.personaConfig,
              ...body.personaConfig,
            }
            : {},
    });

    if (!persona) {
      return notFound('Persona not found');
    }

    const hydratedPersona = await hydratePersonaAvatarUrls(persona);

    return ok({
      message: 'Persona updated successfully',
      persona: hydratedPersona,
    });
  } catch (error) {
    console.error('Update persona error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Persona not found');
    }

    return internalServerError('Failed to update persona');
  }
}

exports.handler = withAuth(updatePersonaHandler);
