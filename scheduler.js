/**
 * scheduler.js — Session Auto-Trigger Engine
 * Re-aligned for the Aurora Zenith system.
 */

const Scheduler = (() => {
  let _intervalId = null;
  let _lastFired = { morning: null, evening: null };

  function _currentHHMM() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function _check() {
    const nowHHMM = _currentHHMM();
    const today = new Date().toISOString().slice(0, 10);

    ['morning', 'evening'].forEach(session => {
      const autoEl = document.getElementById(`${session}-auto`);
      const timeEl = document.getElementById(`${session}-time`);
      
      if (!autoEl || !timeEl) return;
      
      const isAuto = autoEl.checked;
      const scheduledTime = timeEl.value;

      if (isAuto && scheduledTime === nowHHMM && _lastFired[session] !== today) {
        _lastFired[session] = today;
        console.log(`[Scheduler] Auto-triggering ${session} session`);
        
        // Trigger via app logic (which handles tracks/loading)
        const btn = document.getElementById(`btn-play-${session}`);
        if (btn) btn.click();
      }
    });
  }

  return {
    start: () => {
      if (_intervalId) return;
      _intervalId = setInterval(_check, 30000);
      _check();
    },
    stop: () => { if (_intervalId) clearInterval(_intervalId); }
  };
})();
