const { internalServerError, ok } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { listSpaceMessages } = require('../../services/space-messages');

async function listSpaceMessagesHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const spaceId = event.pathParameters?.id;

    const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : 50;
    const newestFirst = event.queryStringParameters?.newestFirst === 'true';
    let lastKey = null;

    if (event.queryStringParameters?.lastKey) {
      try {
        lastKey = JSON.parse(decodeURIComponent(event.queryStringParameters.lastKey));
      } catch (err) {
        console.warn('Failed to parse lastKey query parameter', err);
      }
    }

    const result = await listSpaceMessages(userId, spaceId, {
      limit,
      newestFirst,
      lastKey,
    });

    return ok({
      messages: result.messages,
      lastKey: result.lastKey ? encodeURIComponent(JSON.stringify(result.lastKey)) : null,
    });
  } catch (error) {
    console.error('List space messages error', error);
    return internalServerError('Failed to fetch space messages');
  }
}

exports.handler = withAuth(listSpaceMessagesHandler);
