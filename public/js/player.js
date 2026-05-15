// Audio player — handles both server audio files and Web Speech Synthesis

export class AudioPlayer {
  constructor(audioEl) {
    this.audio = audioEl;
    this.rate = 1.0;
    this.volume = 0.8;
    this.currentProgressCallback = null;
    this._speaking = false;
    this._utterance = null;
    this._ttsSource = 'web'; // 'web' | 'server'
    this._currentMsgId = null;
    this._bindEvents();
  }

  _bindEvents() {
    this.audio.addEventListener('timeupdate', () => {
      if (this.currentProgressCallback && this.audio.duration) {
        this.currentProgressCallback({
          current: this.audio.currentTime,
          total: this.audio.duration,
          pct: this.audio.currentTime / this.audio.duration,
        });
      }
    });
    this.audio.addEventListener('ended', () => {
      this.currentProgressCallback = null;
      this._speaking = false;
    });
    this.audio.addEventListener('error', () => {
      console.warn('[AudioPlayer] Audio error:', this.audio.error);
      this.currentProgressCallback = null;
      this._speaking = false;
    });
  }

  setVolume(v) { this.volume = v; this.audio.volume = v; }
  setRate(r) { this.rate = r; }
  setTTSSource(src) { this._ttsSource = src; }

  /** Play a server-hosted audio file URL (e.g. /uploads/xxx.mp3) */
  async play(url, onProgress) {
    this.stop();
    this.currentProgressCallback = onProgress;
    this.audio.volume = this.volume;
    this.audio.src = url;
    try {
      await this.audio.play();
    } catch (e) {
      console.warn('[AudioPlayer] play() failed:', e.message);
    }
  }

  /**
   * Speak text: prefers server TTS if configured, falls back to browser synthesis.
   * Also handles calling /api/tts when source = 'server'.
   */
  async speak(text, onProgress) {
    this.stop();

    if (this._ttsSource === 'server') {
      // Fetch server TTS, then stream the returned audio URL
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceSpeed: this.rate,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.audioUrl) {
            this._speaking = true;
            this.currentProgressCallback = onProgress;
            this.audio.volume = this.volume;
            this.audio.src = data.audioUrl;
            this.audio.oncanplay = () => {
              this.audio.play().catch(() => {});
            };
            return;
          }
        }
        // If no audioUrl (TTS not configured or failed), fall through to browser
        console.warn('[AudioPlayer] Server TTS returned no audioUrl, using browser fallback');
      } catch (e) {
        console.warn('[AudioPlayer] Server TTS call failed, using browser fallback:', e.message);
      }
    }

    // Browser Speech Synthesis fallback
    await this._speakWeb(text, onProgress);
  }

  /** Browser Web Speech Synthesis */
  async _speakWeb(text, onProgress) {
    if (!window.speechSynthesis) {
      console.warn('Web Speech Synthesis not available');
      return;
    }

    this._speaking = true;
    this.currentProgressCallback = onProgress;
    const estimatedDuration = (text.length / 5) / this.rate;
    const startTime = Date.now();

    const updateProgress = () => {
      if (!this._speaking || !this.currentProgressCallback) return;
      const elapsed = (Date.now() - startTime) / 1000;
      const total = estimatedDuration;
      this.currentProgressCallback({
        current: Math.min(elapsed, total),
        total,
        pct: Math.min(elapsed / total, 1),
      });
      if (elapsed < total) requestAnimationFrame(updateProgress);
    };
    updateProgress();

    // Try to get Chinese voice
    let zhVoice = speechSynthesis.getVoices().find(v => v.lang.includes('zh'));
    if (!zhVoice) {
      await new Promise(resolve => {
        speechSynthesis.onvoiceschanged = resolve;
        setTimeout(resolve, 1000);
      });
      zhVoice = speechSynthesis.getVoices().find(v => v.lang.includes('zh'));
    }

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'zh-CN';
    utt.rate = this.rate;
    utt.volume = this.volume;
    if (zhVoice) utt.voice = zhVoice;

    utt.onend = () => {
      this._speaking = false;
      if (this.currentProgressCallback) {
        this.currentProgressCallback({ current: estimatedDuration, total: estimatedDuration, pct: 1 });
        setTimeout(() => { this.currentProgressCallback = null; }, 300);
      }
    };
    utt.onerror = () => {
      this._speaking = false;
      this.currentProgressCallback = null;
    };

    speechSynthesis.speak(utt);
    this._utterance = utt;
  }

  /** Stop all audio / speech */
  stop() {
    speechSynthesis.cancel();
    this.audio.pause();
    this.audio.src = '';
    this.audio.oncanplay = null;
    this._speaking = false;
    this._utterance = null;
    this.currentProgressCallback = null;
  }

  /** Seek audio to a specific percentage (0-1) */
  seekTo(pct) {
    if (this.audio.duration) {
      this.audio.currentTime = pct * this.audio.duration;
    }
  }
}
