import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import chatRouter from './routes/chat.js';
import ttsRouter from './routes/tts.js';
import sttRouter from './routes/stt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// HTTPS server
const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'certs/server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs/server.crt')),
}, app);

server.listen(PORT, '0.0.0.0', () => {
  console.log('[VoiceAssistant] HTTPS running at https://0.0.0.0:' + PORT);
  console.log('[VoiceAssistant] ARK key loaded:', !!process.env.ARK_API_KEY);
});
