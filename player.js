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
  
  // Dual players
  const _players  = [
    document.getElementById('audio-player-1'),
    document.getElementById('audio-player-2')
  ];
  let _activeIdx  = 0;

  // Silent player for background session persistence
  const _silentPlayer = new Audio();
  _silentPlayer.loop = true;
  // 10s silent buffer - more robust for mobile OS to recognize active session
  const _silentSrc = 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFhYAAAAbAAAAGxhdmY1OC4yOS4xMDABABUAAAAAAAAAAAAAAAD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDD/80MUAAAAAAAAAAAAAAAAAAAAAExhdmY1OC4yOS4xMDCU';
  _silentPlayer.src = _silentSrc;

  function _primeMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Sai Tunes Active',
        artist: 'Sai Tunes',
        artwork: [{ src: 'brand-logo.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play', () => Player.play());
      navigator.mediaSession.setActionHandler('pause', () => Player.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => Player.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => Player.next());
    }
  }

  function _startSilence() {
    _silentPlayer.play().catch(() => {});
    _primeMediaSession();
  }

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
      
      _players.forEach(p => {
        const source = _audioCtx.createMediaElementSource(p);
        source.connect(_analyser);
      });
      
      _analyser.connect(_audioCtx.destination);
      _analyser.fftSize = 128;
      _drawVisualizer();

      // Resilience for mobile backgrounding
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && _audioCtx.state === 'suspended') {
          _audioCtx.resume();
        }
      });
    } catch (e) { console.warn('[Player] Visualizer init failed:', e); }
  }

  function _drawVisualizer() {
    if (!_ctx || !_analyser) return;
    _visId = requestAnimationFrame(_drawVisualizer);
    if (document.visibilityState !== 'visible') return;

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

  /* ── Playback Logic ── */
  async function _playIndex(i) {
    if (i < 0 || i >= _playlist.length) return;
    
    _initAudioCtx();
    if (_audioCtx.state === 'suspended') await _audioCtx.resume();

    const trackMeta = _playlist[i];
    const trackData = await DB.getTrack(trackMeta.id);
    if (!trackData) { i++; return _playIndex(i); }

    _players.forEach(p => { p.pause(); p.onended = null; p.ontimeupdate = null; });
    const activePlayer = _players[0];
    _activeIdx = 0; 

    const blob = _base64ToBlob(trackData.base64, trackData.mimeType);
    const url = URL.createObjectURL(blob);
    
    if (activePlayer._url) URL.revokeObjectURL(activePlayer._url);
    activePlayer.src = url;
    activePlayer._url = url;
    activePlayer.volume = document.getElementById('volume-slider').value;
    
    try {
      await activePlayer.play();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } catch (e) { console.error('[Player] Playback failed:', e); }

    _index = i;
    _paused = false;
    _updateMediaSession(trackMeta);

    activePlayer.ontimeupdate = () => {
      if (_onProgress) _onProgress(activePlayer.currentTime, activePlayer.duration);
    };

    activePlayer.onended = () => {
      if (_index < _playlist.length - 1) _playIndex(_index + 1);
      else { _index = -1; if (_onPlaybackEnd) _onPlaybackEnd(); }
    };

    if (_onTrackChange) _onTrackChange(trackMeta, i, _session);
  }

  function _updateMediaSession(meta) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.name,
        artist: 'Sai Tunes',
        album: _session ? `${_session.toUpperCase()} Session` : 'Audio Playlist',
        artwork: [{ src: 'brand-logo.png', sizes: '512x512', type: 'image/png' }]
      });
    }
  }

  function _base64ToBlob(base64, mimeType) {
    const chars = atob(base64);
    const bytes = new Uint8Array(chars.length);
    for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  }

  /* ── Public API ── */
  return {
    init: () => _startSilence(),
    load: (list, sess, start = 0) => { _startSilence(); _playlist = list; _session = sess; _playIndex(start); },
    play: () => {
      const p = _players[_activeIdx];
      if (_paused) { p.play(); _paused = false; if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; }
      else if (_index === -1 && _playlist.length > 0) _playIndex(0);
    },
    pause: () => { 
      const p = _players[_activeIdx];
      if (!p.paused) { p.pause(); _paused = true; if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; } 
    },
    stop: () => {
      _players.forEach(p => { p.pause(); p.src = ''; if (p._url) URL.revokeObjectURL(p._url); p._url = null; });
      _index = -1; _paused = false; _session = null;
      if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.metadata = null; }
    },
    next: () => { if (_index < _playlist.length - 1) _playIndex(_index + 1); },
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
