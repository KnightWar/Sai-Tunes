/**
 * storage.js — localStorage abstraction layer
 * Handles all persistence: playlists, schedule times, reminders.
 * Audio files stored as base64 so they survive page reloads.
 */

const Storage = (() => {
  const KEYS = {
    MORNING_TRACKS:  'as_morning_tracks',
    EVENING_TRACKS:  'as_evening_tracks',
    MORNING_TIME:    'as_morning_time',
    EVENING_TIME:    'as_evening_time',
    MORNING_AUTO:    'as_morning_auto',
    EVENING_AUTO:    'as_evening_auto',
    REMINDERS:       'as_reminders',
    NOTIFY_GRANTED:  'as_notify_granted',
  };

  /* ── Generic helpers ── */
  function _get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[Storage] Could not save:', key, e);
      return false;
    }
  }

  /* ── Tracks ── */
  function getTracks(session) {
    const key = session === 'morning' ? KEYS.MORNING_TRACKS : KEYS.EVENING_TRACKS;
    return _get(key, []);
  }

  function saveTracks(session, tracks) {
    const key = session === 'morning' ? KEYS.MORNING_TRACKS : KEYS.EVENING_TRACKS;
    // Store only metadata in localStorage
    const data = tracks.map(t => ({
      id:       t.id,
      name:     t.name,
      duration: t.duration,
      mimeType: t.mimeType,
      // base64 is handled by DB.js
    }));
    return _set(key, data);
  }

  /* ── Schedule times ── */
  function getTime(session) {
    const key = session === 'morning' ? KEYS.MORNING_TIME : KEYS.EVENING_TIME;
    return _get(key, session === 'morning' ? '06:00' : '19:00');
  }

  function saveTime(session, timeStr) {
    const key = session === 'morning' ? KEYS.MORNING_TIME : KEYS.EVENING_TIME;
    return _set(key, timeStr);
  }

  /* ── Auto-play flags ── */
  function getAuto(session) {
    const key = session === 'morning' ? KEYS.MORNING_AUTO : KEYS.EVENING_AUTO;
    return _get(key, false);
  }

  function saveAuto(session, val) {
    const key = session === 'morning' ? KEYS.MORNING_AUTO : KEYS.EVENING_AUTO;
    return _set(key, val);
  }

  /* ── Reminders ── */
  function getReminders() {
    return _get(KEYS.REMINDERS, []);
  }

  function saveReminders(reminders) {
    return _set(KEYS.REMINDERS, reminders);
  }

  function addReminder(reminder) {
    const list = getReminders();
    list.push(reminder);
    return saveReminders(list);
  }

  function updateReminder(id, updates) {
    const list = getReminders().map(r => r.id === id ? { ...r, ...updates } : r);
    return saveReminders(list);
  }

  function deleteReminder(id) {
    const list = getReminders().filter(r => r.id !== id);
    return saveReminders(list);
  }

  /* ── Notification permission ── */
  function getNotifyGranted() { return _get(KEYS.NOTIFY_GRANTED, false); }
  function setNotifyGranted(val) { return _set(KEYS.NOTIFY_GRANTED, val); }

  return {
    getTracks, saveTracks,
    getTime, saveTime,
    getAuto, saveAuto,
    getReminders, saveReminders, addReminder, updateReminder, deleteReminder,
    getNotifyGranted, setNotifyGranted,
  };
})();
