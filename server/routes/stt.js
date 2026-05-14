import express from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB cap
});

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;
const TIMEOUT_MS    = 45_000; // STT can take a while

if (!ASSEMBLYAI_KEY) {
  console.warn('[STT] ASSEMBLYAI_API_KEY not set — backend STT unavailable');
}

router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no audio file' });
  if (!ASSEMBLYAI_KEY) {
    return res.status(503).json({ error: 'STT not configured', hint: 'Set ASSEMBLYAI_API_KEY env var' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Step 1: Upload audio
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method:  'POST',
      signal:  controller.signal,
      headers: {
        'Authorization': `Bearer ${ASSEMBLYAI_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: req.file.buffer,
    });

    clearTimeout(timeout);

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(502).json({ error: 'Audio upload failed', detail: err });
    }

    const { upload_url } = await uploadRes.json();

    // Step 2: Start transcription
    const transRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${ASSEMBLYAI_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        audio_url:     upload_url,
        language_code: 'zh',
        speech_model:  'universal',
      }),
    });

    if (!transRes.ok) {
      const err = await transRes.text();
      return res.status(502).json({ error: 'Transcription start failed', detail: err });
    }

    const { id: transcript_id } = await transRes.json();

    // Step 3: Poll for result (up to 30s)
    let text = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));

      const statusRes = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcript_id}`,
        { headers: { 'Authorization': `Bearer ${ASSEMBLYAI_KEY}` } }
      );

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.status === 'completed') {
        text = statusData.text;
        break;
      }
      if (statusData.status === 'error') {
        console.error('[STT] AssemblyAI error:', statusData.error);
        break;
      }
    }

    if (!text) {
      return res.status(504).json({ error: 'Transcription timeout or failed' });
    }

    res.json({ text });
  } catch (err) {
    console.error('[STT] error:', err.message);
    res.status(500).json({ error: 'STT failed', detail: err.message });
  }
});

export default router;
