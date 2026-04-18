/**
 * app.js — Aurora Zenith Master Controller (v5)
 * Centered UI, Dynamic Luminous Hero, and Perfect Playback Sync.
 */

/* ── Quotes Array ── */
const QUOTES = [
  "Your session, your rhythm.",
  "Begin each day with a clear mind.",
  "Music is the shorthand of emotion.",
  "Small steps lead to great heights.",
  "Silence is sometimes the best sound.",
  "Crafting your perfect routine...",
  "The secret of getting ahead is getting started.",
  "Harmony in audio, harmony in life.",
  "Flow with the frequency."
];

/* ── Toast ── */
const Toast = (() => {
  const el = document.getElementById('toast');
  let timer;
  return { show: (msg, type='info') => {
    el.textContent = msg; el.className = `show ${type}`;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => el.className = '', 3000);
  }};
})();

/* ── Global State ── */
let morningTracks = [];
let eveningTracks = [];
let isSeeking = false;

/* ── Utils ── */
const formatTime = (s) => isNaN(s) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const uniqueId = () => `t_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const currentHHMM = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ── Drag & Drop ── */
let draggedTrackData = null;
function setupDragAndDrop() {
  document.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.track-item'); if (!item) return;
    draggedTrackData = { id: item.dataset.id, from: item.dataset.session };
    item.classList.add('dragging');
  });
  document.addEventListener('dragend', (e) => {
    if (e.target.closest('.track-item')) e.target.closest('.track-item').classList.remove('dragging');
    document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('over'));
  });
  document.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('over'); if (!draggedTrackData) return;
      const toSess = zone.dataset.session; const fromSess = draggedTrackData.from; const tId = draggedTrackData.id;
      let fromL = fromSess === 'morning' ? morningTracks : eveningTracks; let toL = toSess === 'morning' ? morningTracks : eveningTracks;
      const idx = fromL.findIndex(t => t.id === tId); if (idx === -1) return;
      const [track] = fromL.splice(idx, 1); toL.push(track);
      Storage.saveTracks('morning', morningTracks); Storage.saveTracks('evening', eveningTracks);
      if (Player.getSession() === fromSess && Player.getIndex() === idx) { Player.stop(); resetNowPlayingUI(); }
      renderPlaylists(); Toast.show(`Moved to ${toSess}`, 'success');
    });
  });
}

/* ── Track Logic ── */
async function handleFileAdd(session, files) {
  const tracks = session === 'morning' ? morningTracks : eveningTracks;
  Toast.show(`Adding ${files.length} tracks...`);
  for (const file of files) {
    const reader = new FileReader();
    const base64 = await new Promise(r => { reader.onload = e => r(e.target.result.split(',')[1]); reader.readAsDataURL(file); });
    const audio = new Audio();
    const duration = await new Promise(r => {
      const url = URL.createObjectURL(file);
      audio.onloadedmetadata = () => { URL.revokeObjectURL(url); r(audio.duration); };
      audio.src = url;
    });
    const id = uniqueId();
    await DB.saveTrack({ id, base64, mimeType: file.type });
    tracks.push({ id, name: file.name.split('.')[0], duration, mimeType: file.type });
  }
  Storage.saveTracks(session, tracks); renderPlaylists();
}

async function deleteTrack(session, id) {
  const isM = session === 'morning'; let list = isM ? morningTracks : eveningTracks;
  const filtered = list.filter(t => t.id !== id);
  if (isM) morningTracks = filtered; else eveningTracks = filtered;
  Storage.saveTracks(session, filtered); await DB.deleteTrack(id);
  if (Player.getSession() === session) { Player.stop(); resetNowPlayingUI(); }
  renderPlaylists();
}

/* ── UI Rendering ── */
function renderPlaylists() { renderPlaylist('morning'); renderPlaylist('evening'); }
function renderPlaylist(session) {
  const container = document.getElementById(`${session}-playlist`);
  const tracks = session === 'morning' ? morningTracks : eveningTracks;
  container.innerHTML = tracks.length ? '' : `<div class="empty-playlist"><p>Empty</p></div>`;
  tracks.forEach((t, i) => {
    const item = document.createElement('div');
    const isActive = Player.getSession() === session && Player.getIndex() === i;
    item.className = 'track-item' + (isActive ? ' session-active' : '');
    item.draggable = true; item.dataset.id = t.id; item.dataset.session = session;
    item.innerHTML = `<div class="track-name">${t.name}</div><div class="track-dur">${formatTime(t.duration)}</div><button class="ctrl-btn-small" onclick="event.stopPropagation(); deleteTrack('${session}','${t.id}')">🗑</button>`;
    item.onclick = () => Player.load(tracks, session, i);
    container.appendChild(item);
  });
}

function resetNowPlayingUI() {
  document.getElementById('now-playing-title').textContent = 'Ready to Begin';
  document.getElementById('now-playing-index').textContent = 'Select session or track';
  document.getElementById('now-playing-duration').textContent = '--:--';
  document.getElementById('progress-bar').style.width = '0%';
  document.getElementById('progress-slider').value = 0;
  document.getElementById('btn-play').textContent = '▶';
  document.getElementById('track-icon').parentElement.classList.remove('playing');
}

function updateTheme(session) {
  const root = document.documentElement;
  if (session === 'morning') { root.style.setProperty('--aurora-1', '#ffab40'); root.style.setProperty('--aurora-2', '#ff5722'); }
  else { root.style.setProperty('--aurora-1', '#00e5ff'); root.style.setProperty('--aurora-2', '#7c4dff'); }
}

function rotateQuote() {
  const el = document.getElementById('live-quote');
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  el.style.opacity = 0;
  setTimeout(() => { 
    el.textContent = `"${quote}"`; 
    el.style.opacity = 1; 
    // Pulse the border to draw attention
    el.style.borderLeftColor = 'white';
    setTimeout(() => { el.style.borderLeftColor = ''; }, 500);
  }, 500);
}

/* ── Initialization ── */
document.addEventListener('DOMContentLoaded', async () => {
  await DB.init();
  morningTracks = Storage.getTracks('morning');
  eveningTracks = Storage.getTracks('evening');
  renderPlaylists(); setupDragAndDrop(); rotateQuote();
  setInterval(rotateQuote, 10000);

  setInterval(() => { document.getElementById('live-time').textContent = new Date().toLocaleTimeString(); }, 1000);

  /* ── Player Logic Sync ── */
  Player.onTrackChange((t, i, sess) => {
    document.getElementById('btn-play').textContent = '⏸';
    document.getElementById('now-playing-title').textContent = t.name;
    document.getElementById('now-playing-index').textContent = `${sess.toUpperCase()} Session • Track ${i+1}`;
    document.getElementById('now-playing-duration').textContent = formatTime(t.duration);
    document.getElementById('track-icon').parentElement.classList.add('playing');
    updateTheme(sess); renderPlaylists();
  });

  Player.onProgress((cur, tot) => {
    if (isSeeking) return;
    const pct = (cur / tot) * 100;
    document.getElementById('progress-bar').style.width = `${pct}%`;
    document.getElementById('progress-slider').value = pct;
    document.getElementById('progress-current').textContent = formatTime(cur);
    document.getElementById('progress-total').textContent = formatTime(tot);
  });

  Player.onPlaybackEnd(() => {
    document.getElementById('btn-play').textContent = '▶';
    document.getElementById('track-icon').parentElement.classList.remove('playing');
    document.getElementById('now-playing-title').textContent = 'Session Complete';
    renderPlaylists();
  });

  /* ── Seeking Logic ── */
  const slider = document.getElementById('progress-slider');
  slider.oninput = () => isSeeking = true;
  slider.onchange = (e) => { Player.seekTo(e.target.value / 100); isSeeking = false; };

  /* ── Centralized Events ── */
  document.getElementById('btn-play').onclick = () => {
    if (Player.isPlaying()) { Player.pause(); document.getElementById('btn-play').textContent = '▶'; }
    else { Player.play(); document.getElementById('btn-play').textContent = '⏸'; }
  };
  document.getElementById('btn-stop').onclick = () => { Player.stop(); resetNowPlayingUI(); };
  document.getElementById('btn-next').onclick = () => Player.next();
  document.getElementById('btn-prev').onclick = () => Player.prev();
  document.getElementById('volume-slider').oninput = (e) => Player.setVolume(e.target.value);
  
  document.getElementById('btn-load-morning').onclick = () => Player.load(morningTracks, 'morning');
  document.getElementById('btn-load-evening').onclick = () => Player.load(eveningTracks, 'evening');
  
  document.getElementById('btn-add-morning').onclick = () => document.getElementById('file-morning').click();
  document.getElementById('btn-add-evening').onclick = () => document.getElementById('file-evening').click();
  document.getElementById('file-morning').onchange = (e) => handleFileAdd('morning', e.target.files);
  document.getElementById('file-evening').onchange = (e) => handleFileAdd('evening', e.target.files);

  // Reminders Form
  document.getElementById('btn-add-reminder').onclick = () => document.getElementById('reminder-form').style.display = 'block';
  document.getElementById('btn-cancel-reminder').onclick = () => document.getElementById('reminder-form').style.display = 'none';
  document.getElementById('btn-save-reminder').onclick = () => {
    const label = document.getElementById('reminder-label').value;
    const days = document.getElementById('reminder-days').value;
    const time = document.getElementById('reminder-time-input').value;
    if (time) { ReminderManager.add({ label, days, time }); document.getElementById('reminder-form').style.display = 'none'; }
  };

  ReminderManager.onChange(() => {
    const container = document.getElementById('reminder-list');
    const reminders = ReminderManager.getAll();
    container.innerHTML = reminders.length ? '' : '<div class="empty-reminders"><p>Clear Horizons</p></div>';
    reminders.forEach(r => {
      const el = document.createElement('div'); el.className = 'reminder-item';
      el.innerHTML = `<div><div style="font-weight:600">${r.label}</div><div class="days-tag">${r.daysRemaining} days left</div></div><div style="text-align:right"><div style="color:var(--aurora-1); font-weight:700">${r.time}</div><button class="ctrl-btn-small" onclick="ReminderManager.remove('${r.id}')">Cancel</button></div>`;
      container.appendChild(el);
    });
  });

  /* ── Wake Lock & Background Management ── */
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('[App] Wake Lock active');
        wakeLock.addEventListener('release', () => console.log('[App] Wake Lock released'));
      }
    } catch (err) { console.warn(`[App] Wake Lock error: ${err.name}, ${err.message}`); }
  }

  // Request wake lock on any interaction
  document.addEventListener('click', () => {
    requestWakeLock();
    Player.init();
    // Resume audio context
    if (window.AudioContext || window.webkitAudioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    }
  }, { once: true });

  // Handle visibility (though Workers handle intervals, we want to ensure visual sync)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wakeLock === null) requestWakeLock();
  });

  ReminderManager.start();
  Scheduler.start();
});
