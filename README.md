# H5 Voice Assistant

Mobile-first voice assistant web app. Long-press the orb to talk, release to send. AI responds with synchronized voice and text.

## Quick Start


up to date, audited 98 packages in 2s

23 packages are looking for funding
  run `npm fund` for details

1 moderate severity vulnerability

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.

> h5-voice-assistant@1.0.0 start
> node server/index.js

Open http://localhost:3000 on your phone.

## Features

- Voice Input - Long-press orb to record, release to send
- LLM Powered - Volcengine ARK API
- Voice Reply - TTS plays automatically, text shows synchronously
- Volume and Speed controls in settings
- Mute toggle from top bar
- Browser TTS fallback when server TTS is unavailable

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/chat | POST | Send text, get AI reply + audio URL |
| /api/tts | POST | Convert text to speech |
| /api/stt | POST | Convert audio to text |
| /api/health | GET | Health check |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| ARK_API_KEY | Yes | Volcengine ARK API key |
| TTS_API_KEY | No | Volcengine TTS key |
| PORT | No | Server port (default 3000) |

## Deploy

Run behind nginx with HTTPS (required for mic permission).


