const { getConnectionById, listConnectionsForSpace } = require('../../services/ws-connections');
const { broadcastToConnections } = require('../../services/ws-events');
const { createSpaceMessage } = require('../../services/space-messages');
const { generateGroupResponses } = require('../../services/group-chat');
const { getUserProfile } = require('../../services/users');

function parseBody(event) {
  if (!event.body) {
    return {};
  }
  return JSON.parse(event.body);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

    const spaceId = typeof body.spaceId === 'string' ? body.spaceId.trim() : '';
    const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
    const tempId = typeof body.tempId === 'string' ? body.tempId : null;

    if (!spaceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'spaceId is required' }),
      };
    }

    if (!userMessage) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'message is required' }),
      };
    }

    // 1. Fetch user profile for display name
    let senderName = 'You';
    try {
      const profile = await getUserProfile(connection.userId);
      if (profile) {
        senderName = profile.name || profile.username || 'You';
      }
    } catch (err) {
      console.error('Failed to fetch user profile', err);
    }

    // 2. Save user message to SpaceMessagesTable
    const userMsg = await createSpaceMessage({
      userId: connection.userId,
      spaceId,
      senderId: connection.userId,
      senderType: 'user',
      senderName,
      text: userMessage,
    });

    // 3. Get connections listening in this space
    const audience = await listConnectionsForSpace(connection.userId, spaceId);
    const activeAudience = audience.length > 0 ? audience : [connection];

    // 4. Broadcast user message ack
    if (tempId) {
      await broadcastToConnections({
        domainName: event.requestContext.domainName,
        stage: event.requestContext.stage,
        connections: activeAudience,
        payload: {
          type: 'space_message_ack',
          tempId,
          spaceId,
          message: userMsg,
        },
      });
    }

    // 5. Generate responding agent plans
    const agentReplies = await generateGroupResponses({
      userId: connection.userId,
      spaceId,
      userMessage,
    });

    // 6. Deliver each agent's message with typing indicators and natural delays
    for (let index = 0; index < agentReplies.length; index++) {
      const { persona, deliveryPlan, messages } = agentReplies[index];
      
      // Broadcast typing indicator
      await broadcastToConnections({
        domainName: event.requestContext.domainName,
        stage: event.requestContext.stage,
        connections: activeAudience,
        payload: {
          type: 'space_ai_typing',
          spaceId,
          personaId: persona.personaId,
          personaName: persona.name,
        },
      });

      // Wait initial typing delay
      await wait(Math.max(1000, deliveryPlan.typingDelay || 1500));

      // Deliver chunks
      for (let c = 0; c < messages.length; c++) {
        if (c > 0) {
          // Inter-chunk pause
          const pauseDelay = Math.max(500, deliveryPlan.chunkDelays?.[c] || 800);
          await wait(pauseDelay);
        }

        await broadcastToConnections({
          domainName: event.requestContext.domainName,
          stage: event.requestContext.stage,
          connections: activeAudience,
          payload: {
            type: 'space_ai_chunk',
            spaceId,
            personaId: persona.personaId,
            message: messages[c],
          },
        });
      }

      // Broadcast done typing for this persona
      await broadcastToConnections({
        domainName: event.requestContext.domainName,
        stage: event.requestContext.stage,
        connections: activeAudience,
        payload: {
          type: 'space_ai_done',
          spaceId,
          personaId: persona.personaId,
        },
      });

      // Inter-agent delay (pause 2-4 seconds before the next agent starts if there are more)
      if (index < agentReplies.length - 1) {
        const interAgentDelay = 2000 + Math.floor(Math.random() * 2000);
        await wait(interAgentDelay);
      }
    }

    // 7. Broadcast space all done
    await broadcastToConnections({
      domainName: event.requestContext.domainName,
      stage: event.requestContext.stage,
      connections: activeAudience,
      payload: {
        type: 'space_all_done',
        spaceId,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Delivered to space' }),
    };
  } catch (error) {
    console.error('WebSocket send space message failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error?.message || 'Failed to send space message' }),
    };
  }
};
