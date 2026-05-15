/**
 * Browser-side Speech Recognition (Web Speech API).
 * Falls back to null if the browser doesn't support it.
 */
export class BrowserSTT {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this._sr = SR ? new SR() : null;
    this._interim = '';
    this._final = '';
    this._onInterim = null;
    this._onFinal = null;
    this._onError = null;

    if (this._sr) {
      this._sr.continuous = false;
      this._sr.interimResults = true;
      this._sr.lang = 'zh-CN';

      this._sr.onresult = evt => {
        let interim = '';
        let final = '';
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          const r = evt.results[i];
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (interim) this._onInterim?.(interim);
        if (final) {
          this._final += final;
          this._onFinal?.(this._final);
        }
      };

      this._sr.onerror = e => {
        console.warn('[BrowserSTT] error:', e.error);
        this._onError?.(e.error);
      };
    }
  }

  /** Whether Web Speech API is available */
  get available() { return !!this._sr; }

  /**
   * Start real-time recognition.
   * @param {function(string)} onInterim — called with interim transcript
   * @param {function(string)} onFinal   — called with final transcript
   * @param {function(string)} onError  — called on error
   */
  start({ onInterim, onFinal, onError }) {
    if (!this._sr) {
      onError?.('not_supported');
      return;
    }
    this._interim = '';
    this._final = '';
    this._onInterim = onInterim;
    this._onFinal = onFinal;
    this._onError = onError;
    try {
      this._sr.start();
    } catch (e) {
      console.warn('[BrowserSTT] start error:', e);
    }
  }

  stop() {
    if (!this._sr) return;
    try { this._sr.stop(); } catch {}
    return this._final.trim();
  }

  abort() {
    if (!this._sr) return;
    try { this._sr.abort(); } catch {}
  }
}
