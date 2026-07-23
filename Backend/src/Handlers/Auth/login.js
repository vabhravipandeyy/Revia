const { loginUser } = require('../../services/cognito');
const {
  ok,
  badRequest,
  unauthorized,
  internalServerError,
  parseJsonBody,
} = require('../../lib/http');

exports.handler = async (event) => {
  try {
    const body = parseJsonBody(event);
    const email = body.email ? String(body.email).trim().toLowerCase() : '';
    const password = body.password ? String(body.password) : '';

    if (!email || !password) {
      return badRequest('email and password are required');
    }

    const response = await loginUser({ email, password });
    const auth = response.AuthenticationResult;

    if (!auth || !auth.AccessToken) {
      return unauthorized('Login failed');
    }

    return ok({
      message: 'Login successful',
      tokens: {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn,
        tokenType: auth.TokenType || 'Bearer',
      },
    });
  } catch (error) {
    console.error('Login error', error);

    if (
      error.name === 'NotAuthorizedException' ||
      error.name === 'UserNotConfirmedException' ||
      error.name === 'UserNotFoundException'
    ) {
      return unauthorized('Invalid email or password');
    }

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    return internalServerError('Failed to log in user');
  }
};
