const { badRequest, internalServerError, ok, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { updateUserProfile } = require('../../services/users');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function updateProfileHandler(event) {
  try {
    const claims = event.auth.claims;
    const userId = claims.sub;
    const body = parseJsonBody(event);

    const name = normalizeString(body.name);
    const username = normalizeString(body.username)?.replace(/^@+/, '');
    const gender = normalizeString(body.gender)?.toLowerCase();
    const bio = normalizeString(body.bio);
    const avatar = normalizeString(body.avatar);
    const age =
      body.age === undefined || body.age === null || body.age === ''
        ? undefined
        : Number(body.age);

    if (body.age !== undefined && (Number.isNaN(age) || age <= 0)) {
      return badRequest('Age must be a valid positive number');
    }

    const updatedUser = await updateUserProfile(userId, {
      name,
      username,
      gender,
      age,
      bio,
      avatar,
    });

    return ok({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    return internalServerError('Failed to update profile');
  }
}

exports.handler = withAuth(updateProfileHandler);
