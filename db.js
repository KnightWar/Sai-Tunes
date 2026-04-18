/**
 * db.js — IndexedDB wrapper for large audio storage
 * Bypasses the 5MB limit of localStorage.
 */

const DB = (() => {
  const DB_NAME = 'AudioSchedulerDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'tracks';

  let _db = null;

  function init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  async function ensureDB() {
    if (!_db) await init();
  }

  async function saveTrack(track) {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = _db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(track);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function getTrack(id) {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = _db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteTrack(id) {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = _db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function clearTracks() {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = _db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  return { init, saveTrack, getTrack, deleteTrack, clearTracks };
})();
