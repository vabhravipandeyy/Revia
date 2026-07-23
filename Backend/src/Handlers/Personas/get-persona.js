const { internalServerError, notFound, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { getPersonaById } = require('../../services/personas');
const { hydratePersonaAvatarUrls } = require('../../services/uploads');

async function getPersonaHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const personaId = event.pathParameters?.id;
    const persona = await getPersonaById(userId, personaId);

    if (!persona) {
      return notFound('Persona not found');
    }

    const hydratedPersona = await hydratePersonaAvatarUrls(persona);

    return ok({ persona: hydratedPersona });
  } catch (error) {
    console.error('Get persona error', error);
    return internalServerError('Failed to fetch persona');
  }
}

exports.handler = withAuth(getPersonaHandler);
