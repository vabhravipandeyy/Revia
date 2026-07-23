const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { unauthorized, internalServerError } = require('./http');

const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID,
});

const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID,
});

function extractBearerToken(event) {
  const authorizationHeader =
    event?.headers?.Authorization || event?.headers?.authorization;

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function verifyToken(token) {
  try {
    return await accessTokenVerifier.verify(token);
  } catch (accessError) {
    try {
      return await idTokenVerifier.verify(token);
    } catch (idError) {
      console.warn('Token verification failed:', {
        accessError: accessError?.message || accessError,
        idError: idError?.message || idError,
      });
      const authError = new Error('Invalid or expired token');
      authError.name = 'UnauthorizedError';
      throw authError;
    }
  }
}

function withAuth(handler) {
  return async (event) => {
    try {
      const token = extractBearerToken(event);

      if (!token) {
        return unauthorized('Missing or invalid Authorization header');
      }

      try {
        event.auth = {
          token,
          claims: await verifyToken(token),
        };
      } catch (error) {
        if (error?.name === 'UnauthorizedError') {
          return unauthorized('Invalid or expired token');
        }

        throw error;
      }

      return await handler(event);
    } catch (error) {
      if (error && error.name && (error.name.includes('Jwt') || error.name === 'UnauthorizedError')) {
        return unauthorized('Invalid or expired token');
      }

      if (error && error.message === 'Token not provided') {
        return unauthorized(error.message);
      }

      console.error('Token validation failed', error);
      return internalServerError('Token validation failed');
    }
  };
}

module.exports = {
  withAuth,
  extractBearerToken,
  verifyToken,
};
