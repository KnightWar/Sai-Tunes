/**
 * player.js — Dual-Audio Crossfade Engine
 * Handles smooth transitions between tracks.
 */

const Player = (() => {
  /* ── State ── */
  let _playlist   = [];
  let _index      = -1;
  let _session    = null;
  let _paused     = false;
  
  // Dual players for crossfading
  const _players  = [
    document.getElementById('audio-player-1'),
    document.getElementById('audio-player-2')
  ];
  let _activeIdx  = 0; // index of the current active player in _players array

  /* ── Visualizer State ── */
  let _audioCtx   = null;
  let _analyser   = null;
  let _canvas     = null;
  let _ctx        = null;
  let _visId      = null;

  /* ── Events ── */
  let _onTrackChange = null;
  let _onPlaybackEnd = null;
  let _onProgress    = null;

  /* ── Helpers ── */
  function _initAudioCtx() {
    if (_audioCtx) return;
    try {
      _canvas = document.getElementById('visualizer');
      if (!_canvas) return;
      _ctx = _canvas.getContext('2d');
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      _analyser = _audioCtx.createAnalyser();
      
      // We need to connect BOTH players to the same analyser
      _players.forEach(p => {
        const source = _audioCtx.createMediaElementSource(p);
        source.connect(_analyser);
      });
      
      _analyser.connect(_audioCtx.destination);
      _analyser.fftSize = 128;
      _drawVisualizer();
    } catch (e) { console.warn('[Player] Visualizer init failed:', e); }
  }

  function _drawVisualizer() {
    if (!_ctx || !_analyser) return;
    _visId = requestAnimationFrame(_drawVisualizer);
    const bufferLength = _analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    _analyser.getByteFrequencyData(dataArray);
    const w = _canvas.width; const h = _canvas.height;
    _ctx.clearRect(0, 0, w, h);
    const barWidth = (w / bufferLength) * 2; let x = 0;
    const auroraColor = getComputedStyle(document.documentElement).getPropertyValue('--aurora-1').trim() || '#00e5ff';

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * h;
      _ctx.fillStyle = auroraColor + Math.floor(25 + (dataArray[i]/255) * 200).toString(16).padStart(2, '0');
      _ctx.fillRect(x, h - barHeight, barWidth, barHeight);
      x += barWidth + 2;
    }
  }

  /* ── Fading Logic ── */
  const FADE_TIME = 3000; // 3 seconds

  function _fadeOut(player) {
    const startVol = player.volume;
    const step = startVol / (FADE_TIME / 100);
    const interval = setInterval(() => {
      if (player.volume > step) player.volume -= step;
      else {
        player.volume = 0;
        player.pause();
        clearInterval(interval);
      }
    }, 100);
  }

  function _fadeIn(player, targetVol = 1) {
    player.volume = 0;
    player.play();
    const step = targetVol / (FADE_TIME / 100);
    const interval = setInterval(() => {
      if (player.volume < targetVol - step) player.volume += step;
      else {
        player.volume = targetVol;
        clearInterval(interval);
      }
    }, 100);
  }

  async function _playIndex(i, crossfade = false) {
    if (i < 0 || i >= _playlist.length) return;
    
    _initAudioCtx();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();

    const trackMeta = _playlist[i];
    const trackData = await DB.getTrack(trackMeta.id);
    if (!trackData) { i++; return _playIndex(i); }

    const oldPlayer = _players[_activeIdx];
    _activeIdx = (_activeIdx + 1) % 2;
    const newPlayer = _players[_activeIdx];

    const blob = _base64ToBlob(trackData.base64, trackData.mimeType);
    const url = URL.createObjectURL(blob);
    
    const prevUrl = newPlayer._url;
    newPlayer.src = url;
    newPlayer._url = url;
    if (prevUrl) URL.revokeObjectURL(prevUrl);

    if (crossfade && !oldPlayer.paused) {
      _fadeOut(oldPlayer);
      _fadeIn(newPlayer, _players[0].parentElement.querySelector('#volume-slider').value);
    } else {
      oldPlayer.pause();
      newPlayer.volume = _players[0].parentElement.querySelector('#volume-slider').value;
      newPlayer.play();
    }

    _index = i;
    _paused = false;

    // Reset events for new active player
    newPlayer.ontimeupdate = () => {
      if (_onProgress) _onProgress(newPlayer.currentTime, newPlayer.duration);
      // Auto trigger crossfade 3 seconds before ending
      if (newPlayer.duration && newPlayer.currentTime > newPlayer.duration - (FADE_TIME / 1000) && _index < _playlist.length - 1 && !newPlayer._fadingNext) {
        newPlayer._fadingNext = true;
        _playIndex(_index + 1, true);
      }
    };
    newPlayer.onended = () => {
      newPlayer._fadingNext = false;
      if (_index >= _playlist.length - 1) {
        _index = -1;
        if (_onPlaybackEnd) _onPlaybackEnd();
      }
    };

    if (_onTrackChange) _onTrackChange(trackMeta, i, _session);
  }

  function _base64ToBlob(base64, mimeType) {
    const chars = atob(base64);
    const bytes = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }

  /* ── Public API ── */
  return {
    load: (list, sess, start = 0) => {
      _playlist = list; _session = sess; _playIndex(start);
    },
    play: () => {
      const p = _players[_activeIdx];
      if (_paused) { p.play(); _paused = false; }
      else if (_index === -1 && _playlist.length > 0) _playIndex(0);
    },
    pause: () => { if (!_players[_activeIdx].paused) { _players[_activeIdx].pause(); _paused = true; } },
    stop: () => {
      _players.forEach(p => { p.pause(); p.src = ''; if (p._url) URL.revokeObjectURL(p._url); p._url = null; });
      _index = -1; _paused = false; _session = null;
    },
    next: () => { if (_index < _playlist.length - 1) _playIndex(_index + 1, true); },
    prev: () => { if (_index > 0) _playIndex(_index - 1); },
    setVolume: (v) => _players.forEach(p => p.volume = v),
    seekTo: (f) => { const p = _players[_activeIdx]; if (p.duration) p.currentTime = f * p.duration; },
    isPlaying: () => !_players[_activeIdx].paused,
    getIndex: () => _index,
    getSession: () => _session,
    onTrackChange: (f) => _onTrackChange = f,
    onPlaybackEnd: (f) => _onPlaybackEnd = f,
    onProgress: (f) => _onProgress = f
  };
})();
