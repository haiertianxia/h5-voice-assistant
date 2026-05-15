import { BrowserSTT } from './stt.js';

/**
 * AudioRecorder — handles microphone capture + Web Speech API recognition.
 *
 * Priority: Web Speech API (real-time, no server needed)
 * Fallback:  MediaRecorder → server /api/stt
 */
export class AudioRecorder {
  constructor(canvasEl) {
    this.canvas        = canvasEl;
    this.ctx           = canvasEl.getContext('2d');
    this.mediaRecorder = null;
    this.audioContext  = null;
    this.analyser      = null;
    this.stream        = null;
    this.chunks        = [];
    this.isRecording   = false;
    this.silenceTimer  = null;
    this.maxDurTimer   = null;
    this.onSilence     = null;
    this.animationId   = null;

    // Speech recognition
    this._browserSTT  = new BrowserSTT();
    this._srInterim  = '';
    this._srFinal    = '';
    this._srOnInterim = null; // callback for interim transcript
    this._srOnFinal   = null; // callback for final transcript
    this._srActive    = false;

    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  get supportsBrowserSTT() { return this._browserSTT.available; }

  _resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width  * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  // ── Microphone permission ──────────────────────────────────────────

  async requestPermission() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return true;
    } catch {
      return false;
    }
  }

  // ── Start recording ───────────────────────────────────────────────

  /**
   * @param {object} opts
   * @param {function(string)} opts.onInterim  — real-time transcript
   * @param {function(string)} opts.onFinal    — final transcript
   * @param {function(string)} opts.onError    — error message
   */
  start({ onInterim, onFinal, onError } = {}) {
    this._srInterim = '';
    this._srFinal   = '';
    this._srOnInterim = onInterim;
    this._srOnFinal   = onFinal;

    // Try Web Speech API first
    if (this._browserSTT.available) {
      this._srActive = true;
      this._browserSTT.start({
        onInterim: text => {
          this._srInterim = text;
          onInterim?.(this._srFinal + text);
        },
        onFinal: text => {
          this._srFinal += text;
          onFinal?.(this._srFinal.trim());
          this._srActive = false;
        },
        onError: err => {
          console.warn('[Recorder] Web Speech error:', err);
          this._srActive = false;
          // Fall back to MediaRecorder if SR fails
          if (err === 'no-speech' || err === 'not-allowed') {
            onError?.(err);
          }
        },
      });
    }

    // Also start MediaRecorder as backup (or for audio capture)
    if (this.stream) {
      this._startMediaRecorder();
    } else {
      // No mic stream — Web Speech-only mode
    }

    this.isRecording = true;
    this._startWaveform();
    this._resetSilenceTimer();

    this.maxDurTimer = setTimeout(() => {
      if (this.isRecording) {
        console.warn('[Recorder] Max duration — stopping');
        this.onSilence?.();
      }
    }, 60_000);

    return true;
  }

  _startMediaRecorder() {
    if (!this.stream) return;
    this.chunks = [];
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    this.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.start(100);
  }

  // ── Stop / Cancel ────────────────────────────────────────────────

  stop() {
    return new Promise(resolve => {
      // Stop Web Speech
      const srText = this._browserSTT.stop();

      if (this.mediaRecorder) {
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.chunks, { type: 'audio/webm' });
          this._cleanup();
          // Prefer Web Speech result; use blob only if needed
          resolve({ blob, srText: srText || null });
        };
        this.mediaRecorder.stop();
      } else {
        this._cleanup();
        resolve({ blob: null, srText: srText || null });
      }
    });
  }

  cancel() {
    this._browserSTT.abort();
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this._cleanup();
  }

  _cleanup() {
    this.isRecording = false;
    this._srActive = false;
    this._stopWaveform();
    clearTimeout(this.silenceTimer);
    clearTimeout(this.maxDurTimer);
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.analyser     = null;
    this.mediaRecorder = null;
  }

  // ── Silence detection ────────────────────────────────────────────

  _resetSilenceTimer() {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.isRecording && !this._srActive) this.onSilence?.();
    }, 3_000);
  }

  _checkAudioLevel() {
    if (!this.analyser || !this.isRecording) return 0;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    if (rms > 0.01) this._resetSilenceTimer();
    return rms;
  }

  // ── Waveform ─────────────────────────────────────────────────────

  _startWaveform() {
    const draw = () => {
      if (!this.isRecording) return;
      const level = this._checkAudioLevel();
      const w = this.canvas.getBoundingClientRect().width;
      const h = this.canvas.getBoundingClientRect().height;
      this.ctx.clearRect(0, 0, w, h);

      const bars       = 8;
      const cx         = w / 2;
      const cy         = h / 2;
      const baseRadius = Math.min(w, h) * 0.35;

      for (let i = 0; i < bars; i++) {
        const angle  = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const barH   = level * 40 * (0.5 + Math.sin(Date.now() * 0.005 + i) * 0.5);
        const r      = baseRadius + barH;
        const x      = cx + Math.cos(angle) * r;
        const y      = cy + Math.sin(angle) * r;

        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(6,182,212,${0.4 + level * 2})`;
        this.ctx.fill();
      }

      this.animationId = requestAnimationFrame(draw);
    };
    draw();
  }

  _stopWaveform() {
    cancelAnimationFrame(this.animationId);
    const w = this.canvas.getBoundingClientRect().width;
    const h = this.canvas.getBoundingClientRect().height;
    this.ctx.clearRect(0, 0, w, h);
  }
}
