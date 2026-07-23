const { badRequest, internalServerError, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { requestDeleteAccountOtp } = require('../../services/cognito');

async function deleteAccountRequestHandler(event) {
  try {
    await requestDeleteAccountOtp({
      accessToken: event.auth.token,
    });

    return ok({
      message: 'Delete account OTP sent to your email',
    });
  } catch (error) {
    console.error('Delete account OTP request error', error);

    if (error.name === 'InvalidParameterException') {
      return badRequest('Unable to send OTP for this account right now');
    }

    return internalServerError('Failed to send delete account OTP');
  }
}

exports.handler = withAuth(deleteAccountRequestHandler);
