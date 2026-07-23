const { internalServerError, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { listSpaces } = require('../../services/spaces');

async function listSpacesHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const spaces = await listSpaces(userId);

    return ok({ spaces });
  } catch (error) {
    console.error('List spaces error', error);
    return internalServerError('Failed to fetch spaces');
  }
}

exports.handler = withAuth(listSpacesHandler);
