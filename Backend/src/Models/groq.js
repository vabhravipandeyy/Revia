async function generateGroqResponse({
  model,
  systemPrompt,
  recentMessages,
  userMessage,
}) {
  const apiKey = process.env.GROQ_API_KEY;
  console.log('Groq key exists:', Boolean(apiKey));

  if (!apiKey) {
    throw new Error('Groq API key is not configured');
  }

  const primaryModel = model || process.env.GROQ_MODEL || process.env.DEFAULT_MODEL_NAME || 'llama-3.3-70b-versatile';
  const fallbackModel = process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant';
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  const messages = [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...recentMessages.map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.text,
    })),
    {
      role: 'user',
      content: userMessage,
    },
  ];

  async function requestWithModel(modelName) {
    console.log('Sending request to Groq', {
      model: modelName,
      recentMessagesCount: recentMessages.length,
      userMessageLength: (userMessage || '').length,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.9,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    console.log('Groq raw response:', JSON.stringify(data));

    if (!response.ok) {
      const message = data?.error?.message || 'Groq request failed';
      const error = new Error(message);
      error.name = 'GroqApiError';
      error.response = {
        status: response.status,
        data,
      };
      throw error;
    }

    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) {
      throw new Error('Groq returned an empty response');
    }

    return {
      text,
      provider: 'groq',
      model: modelName,
      raw: data,
    };
  }

  try {
    return await requestWithModel(primaryModel);
  } catch (error) {
    if (primaryModel !== fallbackModel) {
      console.error('GROQ ERROR:', error?.response?.data || error);
      return requestWithModel(fallbackModel);
    }
    throw error;
  }
}

module.exports = {
  generateGroqResponse,
};
