import { AudioRecorder } from './recorder.js';
import { AudioPlayer } from './player.js';
import { UIController } from './ui.js';

class VoiceAssistant {
  constructor() {
    this.recorder = new AudioRecorder(document.getElementById('waveformCanvas'));
    this.player = new AudioPlayer(document.getElementById('audioPlayer'));
    this.ui = new UIController(this);
    this.state = 'idle';
    this.settings = this._loadSettings();
    this.applySettings();
    this._bindEvents();
  }

  _loadSettings() {
    try { return JSON.parse(localStorage.getItem('vaSettings')) || {}; }
    catch { return {}; }
  }

  _saveSettings() {
    localStorage.setItem('vaSettings', JSON.stringify(this.settings));
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

    document.getElementById('ttsWebBtn').classList.add('active');
    document.getElementById('ttsServerBtn').style.display = 'none';
    document.querySelector('.setting-hint').textContent = '使用浏览器内置语音，Chrome/Edge 效果最佳';
  }

  _bindEvents() {
    const orb = document.getElementById('orb');
    let pressTimer = null;

    const startRecord = (e) => {
      e.preventDefault();
      if (this.state !== 'idle') return;
      pressTimer = setTimeout(() => this._startRecording(), 120);
    };

    const endRecord = (e) => {
      e.preventDefault();
      clearTimeout(pressTimer);
      if (this.state === 'recording') this._stopRecording();
    };

    const cancelRecord = () => {
      clearTimeout(pressTimer);
      if (this.state === 'recording') this._cancelRecording();
    };

    orb.addEventListener('mousedown', startRecord);
    orb.addEventListener('mouseup', endRecord);
    orb.addEventListener('mouseleave', cancelRecord);
    orb.addEventListener('touchstart', startRecord, { passive: false });
    orb.addEventListener('touchend', endRecord, { passive: false });
    orb.addEventListener('touchcancel', cancelRecord);
  }

  async _startRecording() {
    try {
      this.recorder.start();
      this.state = 'recording';
      this.ui.setRecording(true);
      this.ui.setHint('正在听... 请说话');
    } catch (err) {
      this.ui.showToast('请允许麦克风权限', 'error');
      document.getElementById('permissionHint').style.display = 'block';
    }
  }

  async _stopRecording() {
    if (this.state !== 'recording') return;
    this.state = 'processing';
    this.recorder.stop();
    this.ui.setRecording(false);
    this.ui.setProcessing(true);
    this.ui.setHint('识别中...');

    const blob = await this.recorder.stop();

    if (!blob || blob.size < 500) {
      this._resetState('没检测到声音，请重试');
      return;
    }

    // Send to server STT
    const text = await this._serverSTT(blob);

    if (!text || text.trim().length === 0) {
      this._resetState('没听清楚，请再说一次~');
      return;
    }

    this.ui.addMessage('user', text.trim());
    this.ui.setHint('思考中...');
    await this._chat(text.trim());
  }

  _cancelRecording() {
    this.recorder.cancel();
    this.state = 'idle';
    this.ui.setRecording(false);
    this.ui.setHint('长按说话，松开发送');
  }

  _resetState(msg) {
    this.state = 'idle';
    this.ui.setProcessing(false);
    this.ui.setError(true);
    this.ui.setHint(msg || '长按说话，松开发送');
    setTimeout(() => this.ui.setError(false), 700);
  }

  async _serverSTT(blob) {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      const res = await fetch('/api/stt', { method: 'POST', body: formData });
      if (!res.ok) return null;
      const data = await res.json();
      return data.text;
    } catch {
      return null;
    }
  }

  async _chat(text) {
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceSpeed: (this.settings.speed ?? 100) / 100 }),
      });
      if (!r.ok) throw new Error('API error');
      const d = await r.json();
      await this._showAIReply(d.reply, d.audioUrl);
    } catch {
      await this._showAIReply('抱歉，服务暂时不可用，请检查网络后重试。', null);
    }
  }

  async _showAIReply(text, audioUrl) {
    this.state = 'idle';
    this.ui.setProcessing(false);
    this.ui.setHint('长按说话，松开发送');

    const msgId = this.ui.addMessage('ai', '');
    const p = document.querySelector('[data-msg-id="' + msgId + '"] .message-content p');
    await this._typewriter(p, text);

    if (!this.settings.muted) {
      await this.player.speak(text, (pr) => this.ui.updateAudioProgress(msgId, pr));
    }
  }

  async _typewriter(el, text) {
    el.textContent = '';
    for (const ch of text) {
      el.textContent += ch;
      await new Promise(r => setTimeout(r, 28));
    }
  }

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
    this.player.setTTSSource(source);
    this._saveSettings();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new VoiceAssistant();
});
