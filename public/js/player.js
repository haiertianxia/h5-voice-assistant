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
    this._bindEvents();
  }

  _bindEvents() {
    this.audio.addEventListener('timeupdate', () => {
      if (this.currentProgressCallback && this.audio.duration) {
        this.currentProgressCallback({
          current: this.audio.currentTime,
          total: this.audio.duration,
          pct: this.audio.currentTime / this.audio.duration
        });
      }
    });
    this.audio.addEventListener('ended', () => {
      this.currentProgressCallback = null;
    });
  }

  setVolume(v) { this.volume = v; this.audio.volume = v; }
  setRate(r) { this.rate = r; }
  setTTSSource(src) { this._ttsSource = src; }

  async play(url, onProgress) {
    this.stop();
    this.currentProgressCallback = onProgress;
    this.audio.volume = this.volume;
    this.audio.src = url;
    await this.audio.play().catch(() => {});
  }

  async speak(text, onProgress) {
    this.stop();
    if (!window.speechSynthesis) {
      console.warn('Web Speech Synthesis not available');
      return;
    }

    // Prefer server TTS when available
    if (this._ttsSource === 'server') {
      // Server TTS plays via URL — caller should use play() instead
      return;
    }

    this._speaking = true;
    this.currentProgressCallback = onProgress;

    // Estimate duration: ~5 chars/sec adjusted by rate
    const estimatedDuration = (text.length / 5) / this.rate;
    let startTime = Date.now();

    const updateProgress = () => {
      if (!this._speaking || !this.currentProgressCallback) return;
      const elapsed = (Date.now() - startTime) / 1000;
      const total = estimatedDuration;
      this.currentProgressCallback({
        current: Math.min(elapsed, total),
        total: total,
        pct: Math.min(elapsed / total, 1)
      });
      if (elapsed < total) requestAnimationFrame(updateProgress);
    };
    updateProgress();

    const voices = speechSynthesis.getVoices();
    let zhVoice = voices.find(v => v.lang.includes('zh'));

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

  stop() {
    speechSynthesis.cancel();
    this.audio.pause();
    this.audio.src = '';
    this._speaking = false;
    this._utterance = null;
    this.currentProgressCallback = null;
  }
}
