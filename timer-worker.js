/**
 * timer-worker.js
 * A dedicated worker to handle background intervals without throttling.
 */

const timers = {};

self.onmessage = (e) => {
  const { action, id, delay } = e.data;

  if (action === 'start') {
    if (timers[id]) clearInterval(timers[id]);
    timers[id] = setInterval(() => {
      self.postMessage({ id, type: 'tick' });
    }, delay);
  } else if (action === 'stop') {
    if (timers[id]) {
      clearInterval(timers[id]);
      delete timers[id];
    }
  }
};
