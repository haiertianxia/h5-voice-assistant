import express from 'express';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;

if (!ASSEMBLYAI_KEY) {
  console.warn('[STT] ASSEMBLYAI_API_KEY not set — backend STT unavailable');
}

router.post('/', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no audio file' });
  if (!ASSEMBLYAI_KEY) return res.status(503).json({ error: 'STT not configured', hint: 'Set ASSEMBLYAI_API_KEY env var' });

  try {
    // Step 1: Upload audio to AssemblyAI
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_KEY,
        'Content-Type': 'audio/webm',
      },
      body: req.file.buffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(500).json({ error: 'Upload failed', detail: err });
    }

    const { upload_url } = await uploadRes.json();

    // Step 2: Start transcription with universal-2 model
    const transRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: 'zh',
        speech_models: ['universal-2'],
      }),
    });

    if (!transRes.ok) {
      const err = await transRes.text();
      return res.status(500).json({ error: 'Transcription start failed', detail: err });
    }

    const { id: transcript_id } = await transRes.json();

    // Step 3: Poll for result (max 30s)
    let text = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));

      const statusRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript_id}`, {
        headers: { 'Authorization': ASSEMBLYAI_KEY },
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();

      if (statusData.status === 'completed') {
        text = statusData.text;
        break;
      } else if (statusData.status === 'error') {
        console.error('AssemblyAI error:', statusData.error);
        break;
      }
    }

    if (!text) {
      return res.status(500).json({ error: 'Transcription timeout or failed' });
    }

    res.json({ text });
  } catch (err) {
    console.error('STT error:', err);
    res.status(500).json({ error: 'STT failed', detail: err.message });
  }
});

export default router;
