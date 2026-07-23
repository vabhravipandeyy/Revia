const { badRequest, internalServerError, ok, parseJsonBody } = require('../../lib/http');
const { requestForgotPasswordOtp } = require('../../services/cognito');

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);
    const email = body.email ? String(body.email).trim().toLowerCase() : '';

    if (!email) {
      return badRequest('email is required');
    }

    await requestForgotPasswordOtp({ email });

    return ok({
      message: 'OTP sent to your email',
    });
  } catch (error) {
    console.error('Forgot password request error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'UserNotFoundException') {
      return badRequest('No account found with this email');
    }

    if (error.name === 'InvalidParameterException') {
      return badRequest('This account is not ready for password reset. Try logging in once or verify the account email first.');
    }

    if (error.name === 'NotAuthorizedException') {
      return badRequest('Password reset is not allowed for this account right now.');
    }

    if (error.name === 'LimitExceededException') {
      return badRequest('Too many OTP requests. Please wait and try again shortly.');
    }

    return internalServerError('Failed to send password reset OTP');
  }
};
