const ARK_ENDPOINT = process.env.ARK_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ARK_MODEL   = process.env.ARK_MODEL    || 'doubao-seed-1-8-251228';
const ARK_API_KEY = process.env.ARK_API_KEY;

const TIMEOUT_MS = 15_000; // 15s — prevents backend hanging

const SYSTEM_PROMPT = `你是一个温暖、聪明、口语化的AI语音助手。请用自然、简洁的方式回答，就像朋友聊天一样。每条回复控制在100字以内。
遇到无法回答的问题，请坦诚说明，不要编造信息。`;

/**
 * Call the ARK chat API with an abort timeout.
 * @param {string} text  — user message
 * @returns {Promise<string>} AI reply text
 */
export async function chat(text) {
  if (!ARK_API_KEY) {
    throw new Error('ARK_API_KEY environment variable is not set');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ARK_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': 'Bearer ' + ARK_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: text },
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      throw new Error('ARK API error ' + response.status + ': ' + err);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('Empty response from ARK API');
    return reply.trim();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('ARK API request timed out after ' + (TIMEOUT_MS / 1000) + 's');
    }
    throw err;
  }
}
