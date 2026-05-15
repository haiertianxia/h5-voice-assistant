import { AudioRecorder } from './recorder.js';
import { AudioPlayer }  from './player.js';
import { UIController } from './ui.js';

const HISTORY_KEY = 'vaConversation';

class VoiceAssistant {
  constructor() {
    this.recorder = new AudioRecorder(document.getElementById('waveformCanvas'));
    this.player   = new AudioPlayer(document.getElementById('audioPlayer'));
    this.ui       = new UIController(this);
    this.state    = 'idle';
    this.settings = this._loadSettings();
    this.messages = this._loadHistory();
    this._srTextBuffer = '';  // accumulated Web Speech text
    this._currentMsgId  = null; // live typing message id
    this.applySettings();
    this._bindEvents();
    this._renderHistory();
  }

  // ── Settings ───────────────────────────────────────────────────

  _loadSettings() {
    try { return JSON.parse(localStorage.getItem('vaSettings')) || {}; }
    catch { return {}; }
  }

  _saveSettings() {
    try { localStorage.setItem('vaSettings', JSON.stringify(this.settings)); } catch {}
  }

  applySettings() {
    const s = this.settings;
    this.player.setVolume((s.volume ?? 80) / 100);
    this.player.setRate((s.speed ?? 100) / 100);

    const vs = document.getElementById('volumeSlider');
    const ss = document.getElementById('speedSlider');
    const mt = document.getElementById('muteToggle');
    if (vs) vs.value = s.volume ?? 80;
    if (ss) ss.value = s.speed ?? 100;
    if (mt) mt.checked = s.muted ?? false;
    this.ui.updateMuteIcon(s.muted ?? false);
  }

  // ── History ───────────────────────────────────────────────────

  _loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }

  _saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.messages.slice(-50)));
    } catch {}
  }

  _addMessage(role, text) {
    this.messages.push({ role, text, ts: Date.now() });
    this._saveHistory();
  }

  _renderHistory() {
    const msgs = document.getElementById('messages');
    msgs.innerHTML = '';
    if (!this.messages.length) {
      msgs.innerHTML = `<div class="message message-ai welcome-message">
        <div class="message-avatar">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
        </div>
        <div class="message-content"><p>你好！我是你的语音助手 🤖<br/>长按圆圈开始说话吧~</p></div>
      </div>`;
      return;
    }
    for (const msg of this.messages) {
      this.ui.addMessage(msg.role, msg.text);
    }
  }

  clearHistory() {
    this.messages = [];
    this._saveHistory();
    this._renderHistory();
    this.ui.showToast('对话已清空', 'info');
  }

  // ── Events ─────────────────────────────────────────────────────

  _bindEvents() {
    const orb = document.getElementById('orb');
    let pressTimer = null;

    const startRecord = e => {
      e.preventDefault();
      if (this.state !== 'idle') return;
      pressTimer = setTimeout(() => this._startRecording(), 120);
    };

    const endRecord = e => {
      e.preventDefault();
      clearTimeout(pressTimer);
      if (this.state === 'recording') this._stopRecording();
    };

    orb.addEventListener('mousedown',  startRecord);
    orb.addEventListener('mouseup',    endRecord);
    orb.addEventListener('mouseleave', () => { clearTimeout(pressTimer); });
    orb.addEventListener('touchstart', startRecord, { passive: false });
    orb.addEventListener('touchend',   endRecord,   { passive: false });
    orb.addEventListener('touchcancel', () => { clearTimeout(pressTimer); this.recorder.cancel(); });

    document.getElementById('retryPermBtn')?.addEventListener('click', () => {
      this._startRecording();
    });
  }

  // ── Recording ──────────────────────────────────────────────────

  async _startRecording() {
    // Ensure mic permission
    if (!this.recorder.stream) {
      const granted = await this.recorder.requestPermission();
      if (!granted) {
        this.ui.showToast('请允许麦克风权限', 'error');
        document.getElementById('permissionHint').style.display = 'flex';
        return;
      }
      document.getElementById('permissionHint').style.display = 'none';
    }

    // Clear previous user message bubble, start live typing
    this._srTextBuffer = '';
    this._currentMsgId = null;

    const ok = this.recorder.start({
      onInterim: text => {
        // Update live typing with interim result
        this._updateLiveUserMessage(text);
      },
      onFinal: text => {
        this._srTextBuffer = text;
      },
      onError: err => {
        if (err === 'not-allowed') {
          this.ui.showToast('请允许麦克风权限', 'error');
        }
      },
    });

    if (!ok) {
      this.ui.showToast('录音初始化失败，请刷新重试', 'error');
      return;
    }

    this.state = 'recording';
    this.ui.setRecording(true);
    this.ui.setHint('正在听... 请说话');
    this.recorder.onSilence = () => this._stopRecording();
  }

  _updateLiveUserMessage(text) {
    const msgEl = document.querySelector('[data-msg-id="' + this._currentMsgId + '"]');
    if (msgEl) {
      msgEl.querySelector('p').textContent = text || '...';
    }
  }

  async _stopRecording() {
    if (this.state !== 'recording') return;
    this.state = 'processing';
    this.recorder.onSilence = null;

    this.ui.setRecording(false);
    this.ui.setProcessing(true);
    this.ui.setHint('识别中...');

    const { blob, srText } = await this.recorder.stop();

    // Prefer Web Speech result, fall back to server STT
    let text = srText || '';

    if (!text && blob && blob.size > 500) {
      this.ui.setHint('识别中...（服务器）');
      text = await this._serverSTT(blob);
    }

    if (!text || text.trim().length === 0) {
      this._resetState('没听清楚，请再说一次~');
      return;
    }

    const trimmed = text.trim();
    this._addMessage('user', trimmed);

    // Update live typing → final user message
    if (this._currentMsgId) {
      this.ui.updateUserMessage(this._currentMsgId, trimmed);
    } else {
      this.ui.addMessage('user', trimmed);
    }
    this._currentMsgId = null;

    this.ui.setHint('思考中...');
    await this._chat(trimmed);
  }

  _resetState(msg) {
    this.state = 'idle';
    this._currentMsgId = null;
    this.ui.setProcessing(false);
    this.ui.setError(true);
    this.ui.setHint(msg || '长按说话，松开发送');
    setTimeout(() => this.ui.setError(false), 700);
  }

  // ── STT ─────────────────────────────────────────────────────────

  async _serverSTT(blob) {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      const res = await fetch('/api/stt', { method: 'POST', body: formData });
      if (!res.ok) return null;
      const data = await res.json();
      return data.text;
    } catch { return null; }
  }

  // ── Chat ────────────────────────────────────────────────────────

  async _chat(text) {
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceSpeed: (this.settings.speed ?? 100) / 100,
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'API error');
      }

      const d = await r.json();
      await this._showAIReply(d.reply);
    } catch (err) {
      console.error('[_chat]', err);
      await this._showAIReply('抱歉，服务暂时不可用，请检查网络后重试。');
    }
  }

  // ── AI Reply with typewriter ────────────────────────────────────

  async _showAIReply(text) {
    this.state = 'idle';
    this.ui.setProcessing(false);
    this.ui.setHint('长按说话，松开发送');

    // Save + add AI message (empty text initially for typewriter)
    this._addMessage('ai', text);
    const msgId = this.ui.addMessage('ai', '');

    // Typewriter effect
    await this._typewriter(msgId, text);

    // Auto-play audio (unless muted)
    if (!this.settings.muted) {
      this.player.speak(text, data => {
        this.ui.updateAudioProgress(msgId, data);
        // Volume-reactive orb pulse
        if (data.pct < 1) {
          const orb = document.getElementById('orb');
          const pulse = 1 + (data.pct > 0 ? 0.06 * Math.sin(data.pct * Math.PI * 8) * 0.5 : 0);
          orb.style.transform = `scale(${pulse.toFixed(3)})`;
        } else {
          orb.style.transform = '';
        }
      });
    }
  }

  async _typewriter(msgId, text, speed = 28) {
    const msgEl = document.querySelector('[data-msg-id="' + msgId + '"]');
    if (!msgEl) return;
    const p = msgEl.querySelector('p');

    for (let i = 0; i <= text.length; i++) {
      p.textContent = text.slice(0, i);
      // Keep scroll跟上
      document.getElementById('messages').scrollTop = 1e9;
      if (i < text.length) await _sleep(speed);
    }
  }

  // ── Settings callbacks ──────────────────────────────────────────

  updateVolume(val) {
    this.settings.volume = val;
    this.player.setVolume(val / 100);
    this._saveSettings();
  }

  updateSpeed(val) {
    this.settings.speed = val;
    this.player.setRate(val / 100);
    this._saveSettings();
  }

  toggleMute(muted) {
    this.settings.muted = muted;
    if (muted) this.player.stop();
    this.ui.updateMuteIcon(muted);
    this._saveSettings();
  }

  setTTSSource(source) {
    this.settings.ttsSource = source;
    this.player.setTTSSource(source);
    this._saveSettings();
  }

  replayMessage(text) {
    if (!this.settings.muted) {
      this.player.stop();
      const orb = document.getElementById('orb');
      this.player.speak(text, data => {
        if (data.pct < 1) {
          const pulse = 1 + 0.06 * Math.sin(data.pct * Math.PI * 8) * 0.5;
          orb.style.transform = `scale(${pulse.toFixed(3)})`;
        } else {
          orb.style.transform = '';
        }
      });
    }
  }
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

document.addEventListener('DOMContentLoaded', () => {
  window.app = new VoiceAssistant();
});
