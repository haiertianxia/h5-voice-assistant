import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import http from 'http';
import https from 'https';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { createRateLimiter } from './utils/ratelimit.js';
import chatRouter from './routes/chat.js';
import ttsRouter from './routes/tts.js';
import sttRouter from './routes/stt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — tighten to known origins in production
app.use(cors({
  origin: process.env.CORS_ORIGIN || false, // false = same-origin only by default
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Apply rate limiting to all API routes
const apiLimiter = createRateLimiter();
app.use('/api/chat', apiLimiter);
app.use('/api/tts',  apiLimiter);
app.use('/api/stt',  apiLimiter);

app.use('/api/chat', chatRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/stt', sttRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ark: !!process.env.ARK_API_KEY,
    tts: !!process.env.TTS_API_KEY,
    stt: !!process.env.ASSEMBLYAI_API_KEY,
    time: new Date().toISOString(),
  });
});

app.get('/', (req, res) => res.redirect('/index.html'));

// HTTPS server — graceful startup even if certs are missing
let server;
try {
  server = https.createServer({
    key:  fs.readFileSync(path.join(__dirname, 'certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, 'certs/server.crt')),
  }, app);
} catch (err) {
  console.warn('[VoiceAssistant] HTTPS certs not found — falling back to HTTP');
  console.warn('[VoiceAssistant] For production, place server.key / server.crt in server/certs/');
  server = http.createServer(app);
}

server.listen(PORT, '0.0.0.0', () => {
  const addr = server.address();
  const proto = addr.family === 'IPv6' ? 'http' : 'http';
  console.log(`[VoiceAssistant] running at http://0.0.0.0:${PORT}`);
  console.log('[VoiceAssistant] ARK key loaded:', !!process.env.ARK_API_KEY);
});
