const { badRequest, internalServerError, notFound, ok, parseJsonBody } = require('../../lib/http');
const { withAuth } = require('../../lib/withAuth');
const { schedulePersonaReply, generatePersonaReply } = require('../../services/chat');

async function sendMessageHandler(event) {
  try {
    const userId = event.auth.claims.sub;
    const body = parseJsonBody(event);
    const personaId = typeof body.personaId === 'string' ? body.personaId.trim() : '';
    const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
    const spontaneous = body.spontaneous === true;
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : 'UTC';
    const conversationId =
      typeof body.conversationId === 'string' && body.conversationId.trim().length > 0
        ? body.conversationId.trim()
        : personaId;
    const replyToMessageId = typeof body.replyToMessageId === 'string' ? body.replyToMessageId : undefined;
    const replyPreview = typeof body.replyPreview === 'string' ? body.replyPreview : undefined;
    const actionType = typeof body.actionType === 'string' ? body.actionType : undefined;
    const requestId = event?.requestContext?.requestId || 'unknown';

    console.log('Chat send request received', {
      requestId,
      userId,
      personaId,
      conversationId,
      actionType,
      spontaneous,
      timezone,
    });

    if (!personaId) {
      return badRequest('personaId is required');
    }

    if (actionType === 'generate') {
      const result = await generatePersonaReply({
        userId,
        personaId,
        conversationId,
      });
      return ok(result);
    } else {
      // For spontaneous messages, we don't require a user message
      if (!spontaneous && !userMessage) {
        return badRequest('message is required');
      }

      const result = await schedulePersonaReply({
        userId,
        personaId,
        conversationId,
        userMessage: spontaneous ? '' : userMessage,
        replyToMessageId,
        replyPreview,
        spontaneous,
        timezone,
      });
      return ok(result);
    }
  } catch (error) {
    console.error('CHAT SEND ERROR', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    console.error('ERROR RESPONSE', error?.response?.data || null);

    if (error.message === 'Invalid JSON body') {
      return badRequest('Request body must be valid JSON');
    }

    if (error.name === 'NotFoundError') {
      return notFound(error.message);
    }

    if (error.message === 'Groq API key is not configured') {
      return internalServerError('AI provider is not configured');
    }

    return internalServerError(error.message || 'Failed to generate chat response');
  }
}

exports.handler = withAuth(sendMessageHandler);
