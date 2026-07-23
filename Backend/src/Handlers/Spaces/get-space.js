const { internalServerError, notFound, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { getSpace } = require('../../services/spaces');

async function getSpaceHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const spaceId = event.pathParameters?.id;

    const space = await getSpace(userId, spaceId);

    if (!space) {
      return notFound('Space not found');
    }

    return ok({ space });
  } catch (error) {
    console.error('Get space error', error);
    return internalServerError('Failed to fetch space');
  }
}

exports.handler = withAuth(getSpaceHandler);
