import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const MAX_FILE_AGE_MS = 60 * 60 * 1000; // 1 hour

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Clean up old files on startup
cleanupOldFiles();

const TIMEOUT_MS   = 10_000;

/**
 * Convert text to speech audio file.
 * Returns the public URL of the saved audio file, or null if unavailable.
 */
export async function textToSpeech(text, voiceSpeed = 1.0) {
  const TTS_API_KEY  = process.env.TTS_API_KEY;
  const TTS_ENDPOINT = process.env.TTS_ENDPOINT || 'https://openspeech.bytedance.com/api/v1/tts';

  if (!TTS_API_KEY) {
    console.warn('[TTS] TTS_API_KEY not configured — skipping server TTS');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${TTS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appid:       process.env.TTS_APPID || '',
        text,
        voice:       process.env.TTS_VOICE || 'zh_female_shanbai_bigtts',
        speed_ratio: voiceSpeed,
        volume_ratio: 1.0,
        pitch_ratio:  1.0,
        audio_type:   3, // MP3
      }),
    });

    clearTimeout(timeout);

    // ByteDance TTS returns JSON with { code, message } on error
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('application/json')) {
      let detail = '';
      try {
        const json = await response.json();
        detail = json.message || JSON.stringify(json);
      } catch {
        detail = response.statusText;
      }
      throw new Error(`TTS API error ${response.status}: ${detail}`);
    }

    if (!contentType.includes('audio') && !contentType.includes('octet')) {
      throw new Error(`Unexpected TTS content-type: ${contentType}`);
    }

    const buffer   = Buffer.from(await response.arrayBuffer());
    const filename = `${uuidv4()}.mp3`;
    const filepath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filepath, buffer);
    console.log(`[TTS] Generated: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);

    return `/uploads/${filename}`;
  } catch (err) {
    clearTimeout(timeout);
    console.error('[TTS] textToSpeech failed:', err.message);
    return null;
  }
}

/**
 * Delete audio files older than MAX_FILE_AGE_MS.
 */
function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const now   = Date.now();
    let cleaned = 0;

    for (const file of files) {
      if (!file.endsWith('.mp3')) continue;
      const filepath = path.join(UPLOADS_DIR, file);
      const stat = fs.statSync(filepath);
      if (now - stat.mtimeMs > MAX_FILE_AGE_MS) {
        fs.unlinkSync(filepath);
        cleaned++;
      }
    }

    if (cleaned > 0) console.log(`[TTS] Cleaned up ${cleaned} old audio file(s)`);
  } catch (err) {
    console.warn('[TTS] cleanupOldFiles error:', err.message);
  }
}
