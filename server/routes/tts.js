import express from 'express';
import { textToSpeech } from '../services/tts.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { text, voiceSpeed } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const audioUrl = await textToSpeech(text.trim(), voiceSpeed || 1.0);

    if (!audioUrl) {
      return res.status(503).json({ error: 'TTS not available', useWebSpeech: true });
    }

    res.json({ audioUrl });
  } catch (err) {
    console.error('TTS route error:', err);
    res.status(500).json({ error: 'TTS failed', detail: err.message });
  }
});

export default router;
