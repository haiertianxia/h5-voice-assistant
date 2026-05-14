export class AudioRecorder {
  constructor(canvasEl) {
    this.canvas       = canvasEl;
    this.ctx          = canvasEl.getContext('2d');
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
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width  = rect.width  * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  /**
   * Request microphone permission.
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start recording. Caller must have called requestPermission() first
   * and verified the stream is available.
   */
  start() {
    if (!this.stream) return false;

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
    this.isRecording = true;
    this._startWaveform();
    this._resetSilenceTimer();

    // Max recording duration: 60 seconds (per spec)
    this.maxDurTimer = setTimeout(() => {
      if (this.isRecording) {
        console.warn('[Recorder] Max duration reached — stopping');
        this.onSilence?.();
      }
    }, 60_000);

    return true;
  }

  /**
   * Stop recording and return the audio Blob.
   * @returns {Promise<Blob|null>}
   */
  stop() {
    return new Promise(resolve => {
      if (!this.mediaRecorder) { resolve(null); return; }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this._cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this._cleanup();
  }

  _cleanup() {
    this.isRecording = false;
    this._stopWaveform();
    clearTimeout(this.silenceTimer);
    clearTimeout(this.maxDurTimer);
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
    if (this.stream)       { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.analyser    = null;
    this.mediaRecorder = null;
  }

  _resetSilenceTimer() {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (this.isRecording && this.onSilence) this.onSilence();
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
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const barH  = level * 40 * (0.5 + Math.sin(Date.now() * 0.005 + i) * 0.5);
        const r     = baseRadius + barH;
        const x     = cx + Math.cos(angle) * r;
        const y     = cy + Math.sin(angle) * r;

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
