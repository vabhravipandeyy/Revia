const { getConnectionById, listConnectionsForConversation } = require('../../services/ws-connections');
const { broadcastToConnections } = require('../../services/ws-events');
const { schedulePersonaReply, generatePersonaReply } = require('../../services/chat');
const { buildConversationMessageKey, updateMessageStatus } = require('../../services/chat-messages');

function parseBody(event) {
  if (!event.body) {
    return {};
  }
  return JSON.parse(event.body);
}

function sanitizeDelayWindow(input) {
  const minSeconds = Number(input?.minSeconds);
  const maxSeconds = Number(input?.maxSeconds);

  if (!Number.isFinite(minSeconds) || !Number.isFinite(maxSeconds)) {
    return {
      minSeconds: 10,
      maxSeconds: 20,
    };
  }

  const min = Math.max(1, Math.min(30, minSeconds));
  const max = Math.max(min, Math.min(30, maxSeconds));

  return {
    minSeconds: min,
    maxSeconds: max,
  };
}

exports.handler = async (event) => {
  try {
    const body = parseBody(event);
    const connectionId = event.requestContext.connectionId;
    const connection = await getConnectionById(connectionId);

    if (!connection) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unknown connection' }),
      };
    }

    const personaId = typeof body.personaId === 'string' ? body.personaId.trim() : '';
    const conversationId =
      typeof body.conversationId === 'string' && body.conversationId.trim().length > 0
        ? body.conversationId.trim()
        : personaId;
    const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
    const spontaneous = body.spontaneous === true;
    const tempId = typeof body.tempId === 'string' ? body.tempId : null;
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : 'UTC';
    const replyToMessageId = typeof body.replyToMessageId === 'string' ? body.replyToMessageId : undefined;
    const replyPreview = typeof body.replyPreview === 'string' ? body.replyPreview : undefined;
    const actionType = typeof body.actionType === 'string' ? body.actionType : undefined;

    if (!personaId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'personaId is required' }),
      };
    }

    const listeners = await listConnectionsForConversation(connection.userId, conversationId);
    const audience = listeners.length > 0 ? listeners : [connection];

    // Branch logic by actionType
    if (actionType === 'generate') {
      // PHASE 2: Generate response
      const response = await generatePersonaReply({
        userId: connection.userId,
        personaId,
        conversationId,
      });

      if (response.status === 'skipped') {
        console.log(`Spontaneous message generation skipped: ${response.reason}`);
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Skipped', reason: response.reason }),
        };
      }

      await broadcastToConnections({
        domainName: event.requestContext.domainName,
        stage: event.requestContext.stage,
        connections: audience,
        payload: {
          type: 'ai_response',
          conversationId,
          personaId,
          assistantMessages: response.assistantMessages,
          chunks: response.chunks,
          chunkDelays: response.chunkDelays,
          typingDelay: response.typingDelay,
          thinkingDelay: 0,
          spontaneous: response.spontaneous,
          persona: response.persona,
        },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Generated' }),
      };

    } else if (actionType === 'seen') {
      // Update status to seen in DB
      const messageId = body.messageId;
      const timestamp = body.timestamp;
      if (messageId && timestamp) {
        const messageKey = buildConversationMessageKey(conversationId, timestamp, messageId);
        await updateMessageStatus(connection.userId, messageKey, 'seen');

        // Broadcast seen status
        await broadcastToConnections({
          domainName: event.requestContext.domainName,
          stage: event.requestContext.stage,
          connections: audience,
          payload: {
            type: 'message_status',
            conversationId,
            personaId,
            messageId,
            status: 'seen',
          },
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Seen updated' }),
      };

    } else if (actionType === 'delivered') {
      // Update status to delivered in DB
      const messageId = body.messageId;
      const timestamp = body.timestamp;
      if (messageId && timestamp) {
        const messageKey = buildConversationMessageKey(conversationId, timestamp, messageId);
        await updateMessageStatus(connection.userId, messageKey, 'delivered');

        // Broadcast delivered status
        await broadcastToConnections({
          domainName: event.requestContext.domainName,
          stage: event.requestContext.stage,
          connections: audience,
          payload: {
            type: 'message_status',
            conversationId,
            personaId,
            messageId,
            status: 'delivered',
          },
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Delivered updated' }),
      };

    } else {
      // DEFAULT / PHASE 1: Schedule reply
      if (!spontaneous && !userMessage) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'message is required' }),
        };
      }

      const delayWindow = sanitizeDelayWindow(body.delayWindow);

      const response = await schedulePersonaReply({
        userId: connection.userId,
        personaId,
        conversationId,
        userMessage: spontaneous ? '' : userMessage,
        replyToMessageId,
        replyPreview,
        spontaneous,
        delayWindow,
        timezone,
      });

      if (response.status === 'skipped') {
        console.log(`Spontaneous message schedule skipped: ${response.reason}`);
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Skipped', reason: response.reason }),
        };
      }

      if (response.userMessage && tempId) {
        // Send ACK back to the client immediately
        await broadcastToConnections({
          domainName: event.requestContext.domainName,
          stage: event.requestContext.stage,
          connections: audience,
          payload: {
            type: 'message_ack',
            tempId,
            conversationId,
            personaId,
            message: response.userMessage,
          },
        });

        // Update DB status to delivered and broadcast delivered status
        const msgKey = buildConversationMessageKey(conversationId, response.userMessage.timestamp, response.userMessage.messageId);
        await updateMessageStatus(connection.userId, msgKey, 'delivered');
        await broadcastToConnections({
          domainName: event.requestContext.domainName,
          stage: event.requestContext.stage,
          connections: audience,
          payload: {
            type: 'message_status',
            conversationId,
            personaId,
            messageId: response.userMessage.messageId,
            status: 'delivered',
          },
        });
      }

      // Broadcast reply_scheduled event
      await broadcastToConnections({
        domainName: event.requestContext.domainName,
        stage: event.requestContext.stage,
        connections: audience,
        payload: {
          type: 'reply_scheduled',
          conversationId,
          personaId,
          thinkingDelay: response.thinkingDelay,
          readDelay: response.readDelay,
          userMessage: response.userMessage,
        },
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Scheduled' }),
      };
    }
  } catch (error) {
    console.error('WebSocket send message failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error?.message || 'Failed to send websocket message' }),
    };
  }
};
