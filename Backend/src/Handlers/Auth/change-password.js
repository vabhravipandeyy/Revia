const { badRequest, internalServerError, ok, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { changeUserPassword } = require('../../services/cognito');

async function changePasswordHandler(event) {
  try {
    const body = parseJsonBody(event);
    const currentPassword = body.currentPassword ? String(body.currentPassword) : '';
    const newPassword = body.newPassword ? String(body.newPassword) : '';

    if (!currentPassword || !newPassword) {
      return badRequest('currentPassword and newPassword are required');
    }

    await changeUserPassword({
      accessToken: event.auth.token,
      previousPassword: currentPassword,
      proposedPassword: newPassword,
    });

    return ok({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'NotAuthorizedException') {
      return badRequest('Current password is incorrect');
    }

    if (error.name === 'InvalidPasswordException') {
      return badRequest('Password does not meet Cognito policy requirements');
    }

    return internalServerError('Failed to change password');
  }
}

exports.handler = withAuth(changePasswordHandler);
