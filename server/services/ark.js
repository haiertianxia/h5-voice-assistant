const ARK_ENDPOINT = process.env.ARK_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ARK_MODEL = process.env.ARK_MODEL || 'doubao-seed-1-8-251228';
const ARK_API_KEY = process.env.ARK_API_KEY; // Must be set in .env

export async function chat(text) {
  const systemPrompt = '你是一个温暖、聪明、口语化的AI语音助手。请用自然、简洁的方式回答，就像朋友聊天一样。每条回复控制在100字以内。';

  if (!ARK_API_KEY) {
    throw new Error('ARK_API_KEY environment variable is not set');
  }

  const response = await fetch(ARK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + ARK_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ARK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: 300,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('ARK API error ' + response.status + ': ' + err);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content || '抱歉，我现在无法回答。';
  return reply.trim();
}
