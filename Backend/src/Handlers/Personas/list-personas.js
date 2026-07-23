const { internalServerError, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { listPersonasByUser } = require('../../services/personas');
const { hydratePersonaAvatarUrls } = require('../../services/uploads');

async function listPersonasHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const personas = await listPersonasByUser(userId);
    const hydratedPersonas = await Promise.all(personas.map((persona) => hydratePersonaAvatarUrls(persona)));

    return ok({ personas: hydratedPersonas });
  } catch (error) {
    console.error('List personas error', error);
    return internalServerError('Failed to fetch personas');
  }
}

exports.handler = withAuth(listPersonasHandler);
