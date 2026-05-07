import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const TTS_ENDPOINT = process.env.TTS_ENDPOINT || 'https://openspeech.bytedance.com/api/v1/tts';
const TTS_API_KEY = process.env.TTS_API_KEY;

/**
 * Convert text to speech audio file.
 * Returns the public URL of the saved audio file, or null if unavailable.
 */
export async function textToSpeech(text, voiceSpeed = 1.0) {
  if (!TTS_API_KEY) {
    console.warn('[TTS] TTS_API_KEY not configured — skipping server TTS');
    return null;
  }

  try {
    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TTS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appid: process.env.TTS_APPID || '',
        text: text,
        voice: process.env.TTS_VOICE || 'zh_female_shanbai_bigtts',
        speed_ratio: voiceSpeed,
        volume_ratio: 1.0,
        pitch_ratio: 1.0,
        audio_type: 3, // 3 = mp3
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
    }

    // node-fetch v3: use arrayBuffer() then Buffer.from()
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filename = `${uuidv4()}.mp3`;
    const filepath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filepath, buffer);

    console.log(`[TTS] Generated: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('[TTS] textToSpeech failed:', err.message);
    return null;
  }
}
