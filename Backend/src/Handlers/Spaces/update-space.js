const { badRequest, internalServerError, notFound, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { updateSpace, getSpace } = require('../../services/spaces');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

async function updateSpaceHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const spaceId = event.pathParameters?.id;
    const body = parseJsonBody(event);

    const space = await getSpace(userId, spaceId);
    if (!space) {
      return notFound('Space not found');
    }

    const updates = {};
    
    if (body.name !== undefined) {
      const name = normalizeString(body.name);
      if (!name) {
        return badRequest('Space name cannot be empty');
      }
      updates.name = name;
    }

    if (body.description !== undefined) {
      updates.description = normalizeString(body.description) || '';
    }

    if (body.vibe !== undefined) {
      updates.vibe = normalizeString(body.vibe) || '';
    }

    if (body.coverImage !== undefined) {
      updates.coverImage = normalizeString(body.coverImage) || null;
    }

    if (body.agents !== undefined) {
      const agents = normalizeStringArray(body.agents);
      if (!agents || agents.length === 0) {
        return badRequest('At least one agent must be added to the space');
      }
      updates.agents = agents;
    }

    if (body.theme !== undefined) {
      if (body.theme && typeof body.theme === 'object' && !Array.isArray(body.theme)) {
        updates.theme = body.theme;
      } else {
        return badRequest('Theme must be a valid object');
      }
    }

    const updatedSpace = await updateSpace(userId, spaceId, updates);

    return ok({
      message: 'Space updated successfully',
      space: updatedSpace,
    });
  } catch (error) {
    console.error('Update space error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    return internalServerError('Failed to update space');
  }
}

// helper to parse JSON body since parseJsonBody is in lib/http
function parseJsonBody(event) {
  if (!event || !event.body) {
    return {};
  }
  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

exports.handler = withAuth(updateSpaceHandler);
