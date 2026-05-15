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

    const volSlider = document.getElementById('volumeSlider');
    const volVal = document.getElementById('volumeValue');
    volSlider?.addEventListener('input', () => {
      volVal.textContent = volSlider.value + '%';
      this.app.updateVolume(parseInt(volSlider.value));
    });

    const spSlider = document.getElementById('speedSlider');
    const spVal = document.getElementById('speedValue');
    spSlider?.addEventListener('input', () => {
      spVal.textContent = (parseInt(spSlider.value) / 100).toFixed(1) + 'x';
      this.app.updateSpeed(parseInt(spSlider.value));
    });

    document.getElementById('muteToggle')?.addEventListener('change', e => {
      this.app.toggleMute(e.target.checked);
    });
    document.getElementById('muteBtn')?.addEventListener('click', () => {
      const muted = !(this.app.settings.muted ?? false);
      this.app.toggleMute(muted);
      const mt = document.getElementById('muteToggle');
      if (mt) mt.checked = muted;
    });

    document.getElementById('ttsWebBtn')?.addEventListener('click', () => {
      document.querySelectorAll('.tts-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('ttsWebBtn')?.classList.add('active');
      this.app.setTTSSource('web');
    });
    document.getElementById('ttsServerBtn')?.addEventListener('click', () => {
      document.querySelectorAll('.tts-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('ttsServerBtn')?.classList.add('active');
      this.app.setTTSSource('server');
    });

    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
      this.app.clearHistory();
      overlay.classList.remove('open');
    });
  }

  // ── Orb state ────────────────────────────────────────────────────

  setRecording(val) {
    const orb = document.getElementById('orb');
    const canvas = document.getElementById('waveformCanvas');
    orb.classList.toggle('recording', val);
    canvas.classList.toggle('active', val);
    const micIcon = document.getElementById('orbIconMic');
    if (micIcon) micIcon.style.display = val ? 'none' : '';
  }

  setProcessing(val) {
    const orb = document.getElementById('orb');
    orb.classList.toggle('processing', val);
    const micIcon = document.getElementById('orbIconMic');
    const loadIcon = document.getElementById('orbIconLoading');
    if (micIcon) micIcon.style.display = val ? 'none' : '';
    if (loadIcon) loadIcon.style.display = val ? '' : 'none';
  }

  setError(val) {
    const orb = document.getElementById('orb');
    orb.classList.toggle('error', val);
    setTimeout(() => orb.classList.remove('error'), 600);
  }

  setHint(text) {
    const el = document.getElementById('hintText');
    if (el) el.textContent = text;
  }

  // ── Messages ─────────────────────────────────────────────────────

  addMessage(role, text, audioUrl = null) {
    _msgCounter++;
    const id = 'msg-' + _msgCounter;
    const messages = document.getElementById('messages');

    // Remove welcome on first real message
    const welcome = messages.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = 'message message-' + role;
    div.setAttribute('data-msg-id', id);

    const micSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`;
    const botSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    // Cursor for typewriter effect
    const cursor = role === 'ai' ? '<span class="typewriter-cursor">|</span>' : '';

    div.innerHTML =
      `<div class="message-avatar">${role === 'user' ? micSvg : botSvg}</div>` +
      `<div class="message-content${role === 'ai' ? ' ai-msg' : ''}" data-reply-text="${this._escapeAttr(text || '')}">` +
        `<p>${this._escapeHtml(text || '')}${cursor}</p>` +
        // Audio player bar (AI messages only)
        (role === 'ai' ? `<div class="audio-player" data-audio-url="${audioUrl || ''}">
          <button class="play-btn" aria-label="播放">
            <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <svg class="icon-pause" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
          <div class="progress-bar-wrap">
            <div class="progress-bar"><div class="progress-fill"></div></div>
          </div>
          <span class="play-time">0:00</span>
          <button class="skip-btn skip-back" title="后退5秒">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
          </button>
          <button class="skip-btn skip-fwd" title="前进5秒">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>
          </button>
          <button class="retry-btn" title="重播">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-4.5"></path></svg>
          </button>
        </div>` : '');

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;

    if (role === 'ai') this._bindAudioPlayer(div);

    // Click AI message body to replay
    if (role === 'ai') {
      const content = div.querySelector('.message-content');
      content?.addEventListener('click', e => {
        // Don't trigger if clicking controls
        if (e.target.closest('.audio-player')) return;
        const text = content.getAttribute('data-reply-text') || '';
        if (text) this.app.replayMessage(text);
      });
    }

    return id;
  }

  /** Update an existing user message text (live typing) */
  updateUserMessage(msgId, text) {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) return;
    const p = el.querySelector('p');
    if (p) p.textContent = text || '...';
    document.getElementById('messages').scrollTop = 1e9;
  }

  /** Update typewriter cursor in an AI message */
  _hideCursor(msgEl) {
    const cur = msgEl.querySelector('.typewriter-cursor');
    if (cur) cur.remove();
  }

  _bindAudioPlayer(msgEl) {
    const playBtn  = msgEl.querySelector('.play-btn');
    const progressWrap = msgEl.querySelector('.progress-bar-wrap');
    const retryBtn = msgEl.querySelector('.retry-btn');
    const skipBack = msgEl.querySelector('.skip-back');
    const skipFwd  = msgEl.querySelector('.skip-fwd');
    const fill     = msgEl.querySelector('.progress-fill');
    const timeEl   = msgEl.querySelector('.play-time');
    const iconPlay  = msgEl.querySelector('.icon-play');
    const iconPause = msgEl.querySelector('.icon-pause');
    const content   = msgEl.querySelector('.message-content');
    const replyText = content?.getAttribute('data-reply-text') || '';
    const player    = this.app.player;

    if (!playBtn || !progressWrap) return;

    let playing = false;

    const showPlaying = () => {
      playing = true;
      if (iconPlay) iconPlay.style.display = 'none';
      if (iconPause) iconPause.style.display = '';
    };
    const showPaused = () => {
      playing = false;
      if (iconPlay) iconPlay.style.display = '';
      if (iconPause) iconPause.style.display = 'none';
    };

    const startPlayback = () => {
      showPlaying();
      player.speak(replyText, data => {
        this._updateProgress(msgEl, data);
        if (data.pct >= 1) {
          showPaused();
          this._hideCursor(msgEl);
        }
      });
    };

    playBtn.addEventListener('click', () => {
      if (playing) {
        player.stop();
        showPaused();
      } else {
        startPlayback();
      }
    });

    // Seek by clicking progress bar
    progressWrap.addEventListener('click', e => {
      const rect = progressWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      player.seekTo(pct);
    });

    skipBack?.addEventListener('click', () => {
      const cur = player.audio.currentTime;
      player.seekTo(Math.max(0, (cur - 5) / (player.audio.duration || 1)));
    });
    skipFwd?.addEventListener('click', () => {
      const cur = player.audio.currentTime;
      const tot = player.audio.duration || 1;
      player.seekTo(Math.min(1, (cur + 5) / tot));
    });

    retryBtn?.addEventListener('click', () => {
      player.stop();
      startPlayback();
    });
  }

  _updateProgress(msgEl, data) {
    const fill  = msgEl.querySelector('.progress-fill');
    const timeEl = msgEl.querySelector('.play-time');
    if (fill) fill.style.width = (data.pct * 100).toFixed(1) + '%';
    if (timeEl) {
      const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
      timeEl.textContent = fmt(data.current) + ' / ' + fmt(data.total);
    }
  }

  updateAudioProgress(msgId, data) {
    const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!msgEl) return;
    this._updateProgress(msgEl, data);
  }

  // ── Mute icon ───────────────────────────────────────────────────

  updateMuteIcon(muted) {
    const unmute = document.getElementById('iconUnmute');
    const mute   = document.getElementById('iconMute');
    if (unmute) unmute.style.display = muted ? 'none' : '';
    if (mute)   mute.style.display   = muted ? '' : 'none';
  }

  // ── Toast ───────────────────────────────────────────────────────

  showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    const text  = document.getElementById('toastText');
    if (!toast || !text) return;
    text.textContent = msg;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 2500);
  }

  // ── Helpers ────────────────────────────────────────────────────

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  _escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
