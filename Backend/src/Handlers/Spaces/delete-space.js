const { badRequest, internalServerError, notFound, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { deleteSpace, getSpace } = require('../../services/spaces');

async function deleteSpaceHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const spaceId = event.pathParameters?.id;

    const space = await getSpace(userId, spaceId);
    if (!space) {
      return notFound('Space not found');
    }

    if (space.isDefault) {
      return badRequest('Default spaces cannot be deleted');
    }

    await deleteSpace(userId, spaceId);

    return ok({
      message: 'Space deleted successfully',
      spaceId,
    });
  } catch (error) {
    console.error('Delete space error', error);
    return internalServerError('Failed to delete space');
  }
}

exports.handler = withAuth(deleteSpaceHandler);
