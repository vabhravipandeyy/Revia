const { badRequest, created, internalServerError, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { createSpace } = require('../../services/spaces');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

async function createSpaceHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const body = parseJsonBody(event);

    const name = normalizeString(body.name);
    const description = normalizeString(body.description);
    const vibe = normalizeString(body.vibe);
    const coverImage = normalizeString(body.coverImage);
    const agents = normalizeStringArray(body.agents);
    const theme =
      body.theme && typeof body.theme === 'object' && !Array.isArray(body.theme)
        ? body.theme
        : undefined;

    if (!name) {
      return badRequest('Space name is required');
    }

    if (agents.length === 0) {
      return badRequest('At least one agent must be added to the space');
    }

    const space = await createSpace({
      userId,
      name,
      description,
      vibe,
      agents,
      theme,
      coverImage,
    });

    return created({
      message: 'Space created successfully',
      space,
    });
  } catch (error) {
    console.error('Create space error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    return internalServerError('Failed to create space');
  }
}

exports.handler = withAuth(createSpaceHandler);
