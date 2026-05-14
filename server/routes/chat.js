import express from 'express';
import { chat } from '../services/ark.js';
import { textToSpeech } from '../services/tts.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { text, voiceSpeed } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  if (text.length > 2000) {
    return res.status(400).json({ error: 'text too long (max 2000 chars)' });
  }

  try {
    const reply = await chat(text.trim());
    const audioUrl = await textToSpeech(reply, voiceSpeed || 1.0);
    res.json({ reply, audioUrl });
  } catch (err) {
    console.error('Chat error:', err);
    const status = err.message.includes('not set') ? 503 : 500;
    res.status(status).json({ error: '处理失败，请稍后重试', detail: err.message });
  }
});

export default router;
