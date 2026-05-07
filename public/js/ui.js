let _msgCounter = 0;

export class UIController {
  constructor(app) {
    this.app = app;
    this._bindSettings();
  }

  _bindSettings() {
    const overlay = document.getElementById('settingsOverlay');
    document.getElementById('settingsBtn').addEventListener('click', () => overlay.classList.add('open'));
    document.getElementById('closeSettingsBtn').addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

    document.getElementById('muteBtn').addEventListener('click', () => {
      const muted = !this.app.settings.muted;
      this.app.toggleMute(muted);
    });

    const volSlider = document.getElementById('volumeSlider');
    const volVal = document.getElementById('volumeValue');
    volSlider.addEventListener('input', () => {
      volVal.textContent = volSlider.value + '%';
      this.app.updateVolume(parseInt(volSlider.value));
    });

    const spSlider = document.getElementById('speedSlider');
    const spVal = document.getElementById('speedValue');
    spSlider.addEventListener('input', () => {
      spVal.textContent = (parseInt(spSlider.value) / 100).toFixed(1) + 'x';
      this.app.updateSpeed(parseInt(spSlider.value));
    });

    document.getElementById('muteToggle').addEventListener('change', e => {
      this.app.toggleMute(e.target.checked);
    });

    document.getElementById('ttsWebBtn').addEventListener('click', () => {
      document.querySelectorAll('.tts-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('ttsWebBtn').classList.add('active');
      this.app.setTTSSource('web');
    });
    document.getElementById('ttsServerBtn').addEventListener('click', () => {
      document.querySelectorAll('.tts-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('ttsServerBtn').classList.add('active');
      this.app.setTTSSource('server');
    });
  }

  setRecording(val) {
    const orb = document.getElementById('orb');
    const canvas = document.getElementById('waveformCanvas');
    orb.classList.toggle('recording', val);
    canvas.classList.toggle('active', val);
    document.getElementById('orbIconMic').style.display = val ? 'none' : '';
  }

  setProcessing(val) {
    const orb = document.getElementById('orb');
    orb.classList.toggle('processing', val);
    document.getElementById('orbIconMic').style.display = val ? 'none' : '';
    document.getElementById('orbIconLoading').style.display = val ? '' : 'none';
  }

  setError(val) {
    const orb = document.getElementById('orb');
    orb.classList.toggle('error', val);
    setTimeout(() => orb.classList.remove('error'), 600);
  }

  setHint(text) {
    document.getElementById('hintText').textContent = text;
  }

  addMessage(role, text) {
    _msgCounter++;
    const id = 'msg-' + _msgCounter;
    const messages = document.getElementById('messages');

    const welcome = messages.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = 'message message-' + role;
    div.setAttribute('data-msg-id', id);

    const micSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>';
    const botSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

    div.innerHTML = '<div class="message-avatar">' + (role === 'user' ? micSvg : botSvg) + '</div>' +
      '<div class="message-content"><p>' + this._escapeHtml(text || '') + '</p></div>';

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return id;
  }

  removeTypingIndicator(id) {
    const el = document.querySelector('[data-msg-id="' + id + '"]');
    if (el) el.remove();
  }

  updateAudioProgress(msgId, data) {
    const msgEl = document.querySelector('[data-msg-id="' + msgId + '"]');
    if (!msgEl) return;

    let player = msgEl.querySelector('.audio-player');
    if (!player) {
      const content = msgEl.querySelector('.message-content');
      player = document.createElement('div');
      player.className = 'audio-player';
      const tmin = Math.floor(data.total / 60);
      const tsec = Math.floor(data.total % 60).toString().padStart(2, '0');
      player.innerHTML = '<button class="play-btn"><svg id="playIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button>' +
        '<div class="progress-bar"><div class="progress-fill"></div></div>' +
        '<span class="play-time">0:00 / ' + tmin + ':' + tsec + '</span>';
      content.appendChild(player);
    }

    const fill = player.querySelector('.progress-fill');
    const timeEl = player.querySelector('.play-time');
    if (fill) fill.style.width = (data.pct * 100) + '%';
    if (timeEl) {
      const cmin = Math.floor(data.current / 60);
      const csec = Math.floor(data.current % 60).toString().padStart(2, '0');
      const tmin = Math.floor(data.total / 60);
      const tsec = Math.floor(data.total % 60).toString().padStart(2, '0');
      timeEl.textContent = cmin + ':' + csec + ' / ' + tmin + ':' + tsec;
    }
  }

  updateMuteIcon(muted) {
    document.getElementById('iconUnmute').style.display = muted ? 'none' : '';
    document.getElementById('iconMute').style.display = muted ? '' : 'none';
  }

  showToast(msg, type) {
    const toast = document.getElementById('toast');
    const text = document.getElementById('toastText');
    text.textContent = msg;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    toast.style.display = 'block';
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 2000);
  }

  _escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g, '<br>');
  }
}
