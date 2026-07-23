const { badRequest, internalServerError, ok, parseJsonBody } = require('../../lib/http');
const { confirmForgotPasswordOtp } = require('../../services/cognito');

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);
    const email = body.email ? String(body.email).trim().toLowerCase() : '';
    const otp = body.otp ? String(body.otp).trim() : '';
    const newPassword = body.newPassword ? String(body.newPassword) : '';

    if (!email || !otp || !newPassword) {
      return badRequest('email, otp, and newPassword are required');
    }

    await confirmForgotPasswordOtp({
      email,
      confirmationCode: otp,
      newPassword,
    });

    return ok({
      message: 'Password reset successful',
    });
  } catch (error) {
    console.error('Forgot password confirm error', error);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'CodeMismatchException') {
      return badRequest('Invalid OTP');
    }

    if (error.name === 'ExpiredCodeException') {
      return badRequest('OTP has expired');
    }

    if (error.name === 'InvalidPasswordException') {
      return badRequest('Password does not meet Cognito policy requirements');
    }

    return internalServerError('Failed to reset password');
  }
};
