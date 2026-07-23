const { badRequest, internalServerError, ok, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { confirmDeleteAccount } = require('../../services/cognito');
const { deleteUserProfile } = require('../../services/users');

async function deleteAccountConfirmHandler(event) {
  try {
    const body = parseJsonBody(event);
    const otp = body.otp ? String(body.otp).trim() : '';

    if (!otp) {
      return badRequest('otp is required');
    }

    await confirmDeleteAccount({
      accessToken: event.auth.token,
      confirmationCode: otp,
    });

    await deleteUserProfile(event.auth.claims.sub);

    return ok({
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account confirm error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'CodeMismatchException') {
      return badRequest('Invalid OTP');
    }

    if (error.name === 'ExpiredCodeException') {
      return badRequest('OTP has expired');
    }

    return internalServerError('Failed to delete account');
  }
}

exports.handler = withAuth(deleteAccountConfirmHandler);
