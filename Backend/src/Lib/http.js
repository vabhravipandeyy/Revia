function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
    },
    body: JSON.stringify(body),
  };
}

function ok(body) {
  return json(200, body);
}

function created(body) {
  return json(201, body);
}

function badRequest(message, details) {
  return json(400, {
    error: 'BadRequest',
    message,
    details,
  });
}

function unauthorized(message = 'Unauthorized') {
  return json(401, {
    error: 'Unauthorized',
    message,
  });
}

function conflict(message) {
  return json(409, {
    error: 'Conflict',
    message,
  });
}

function notFound(message = 'Resource not found') {
  return json(404, {
    error: 'NotFound',
    message,
  });
}

function internalServerError(message = 'Internal server error') {
  return json(500, {
    error: 'InternalServerError',
    message,
  });
}

function parseJsonBody(event) {
  if (!event || !event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

module.exports = {
  json,
  ok,
  created,
  badRequest,
  unauthorized,
  conflict,
  notFound,
  internalServerError,
  parseJsonBody,
};
