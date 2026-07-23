const { badRequest, internalServerError, notFound, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { deleteConversationMessages } = require('../../services/chat-messages');
const { deletePersonaMemories } = require('../../services/memories');
const { deletePersona, getPersonaById } = require('../../services/personas');

async function deletePersonaHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const personaId = event.pathParameters?.id;
    const persona = await getPersonaById(userId, personaId);

    if (!persona) {
      return notFound('Persona not found');
    }

    if (persona.editable === false) {
      return badRequest('Default signature personas cannot be deleted');
    }

    await deleteConversationMessages(userId, personaId);
    await deletePersonaMemories(userId, personaId);
    await deletePersona(userId, personaId);

    return ok({
      message: 'Persona deleted successfully',
    });
  } catch (error) {
    console.error('Delete persona error', error);

    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Persona not found');
    }

    return internalServerError('Failed to delete persona');
  }
}

exports.handler = withAuth(deletePersonaHandler);
