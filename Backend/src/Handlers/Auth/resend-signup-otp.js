const { badRequest, internalServerError, ok, parseJsonBody } = require('../../lib/http');
const { resendSignupOtp } = require('../../services/cognito');

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);
    const email = body.email ? String(body.email).trim().toLowerCase() : '';

    if (!email) {
      return badRequest('email is required');
    }

    await resendSignupOtp({ email });

    return ok({
      message: 'Verification OTP sent again',
    });
  } catch (error) {
    console.error('Resend signup OTP error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'UserNotFoundException') {
      return badRequest('No account found with this email');
    }

    if (error.name === 'NotAuthorizedException') {
      return badRequest('Account is already verified');
    }

    if (error.name === 'LimitExceededException') {
      return badRequest('Too many OTP requests. Please wait and try again shortly.');
    }

    return internalServerError('Failed to resend verification OTP');
  }
};
