const { badRequest, internalServerError, ok, parseJsonBody } = require('../../lib/http');
const { confirmUserSignup } = require('../../services/cognito');

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);
    const email = body.email ? String(body.email).trim().toLowerCase() : '';
    const otp = body.otp ? String(body.otp).trim() : '';

    if (!email || !otp) {
      return badRequest('email and otp are required');
    }

    await confirmUserSignup({
      email,
      confirmationCode: otp,
    });

    return ok({
      message: 'Account verified successfully',
    });
  } catch (error) {
    console.error('Verify signup error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'CodeMismatchException') {
      return badRequest('Invalid OTP');
    }

    if (error.name === 'ExpiredCodeException') {
      return badRequest('OTP has expired');
    }

    if (error.name === 'NotAuthorizedException') {
      return badRequest('Account is already verified');
    }

    return internalServerError('Failed to verify account');
  }
};
