import express from 'express';
import { chat } from '../services/ark.js';
import { textToSpeech } from '../services/tts.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { text, voiceSpeed } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    // 1. Get LLM response
    const reply = await chat(text.trim());

    // 2. Generate TTS audio
    const audioUrl = await textToSpeech(reply, voiceSpeed || 1.0);

    res.json({
      reply,
      audioUrl, // may be null if TTS not configured
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      error: '处理失败，请稍后重试',
      detail: err.message,
    });
  }
});

export default router;
