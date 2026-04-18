/**
 * reminder.js — Alert-Based Reminders
 * Triggers system alerts and in-app feedback.
 */

const ReminderManager = (() => {
  let _intervalId  = null;
  let _onListChange = null;

  function _currentHHMM() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  function _check() {
    const nowTime = _currentHHMM();
    const today   = new Date().toISOString().slice(0, 10);

    let changed = false;
    const reminders = Storage.getReminders().map(r => {
      // Logic: If time matches and not already fired today, and has days left
      if (r.daysRemaining > 0 && r.time === nowTime && r.lastFired !== today) {
        
        // TRIGGER ALERT (System level)
        setTimeout(() => {
          alert(`🚨 REMINDER: ${r.label}\nTime: ${r.time}\nRemaining: ${r.daysRemaining - 1} days`);
        }, 10);

        Toast.show(`🔔 Reminder: ${r.label}`, 'success');
        
        changed = true;
        return { ...r, lastFired: today, daysRemaining: r.daysRemaining - 1 };
      }
      return r;
    });

    if (changed) {
      Storage.saveReminders(reminders);
      if (_onListChange) _onListChange();
    }
  }

  /* ── API ── */
  function add({ label, days, time }) {
    Storage.addReminder({
      id: `r_${Date.now()}`,
      label: label || 'Daily Routine',
      daysTotal: parseInt(days),
      daysRemaining: parseInt(days),
      time: time,
      lastFired: null
    });
    if (_onListChange) _onListChange();
    Toast.show('Reminder Scheduled ✓', 'success');
  }

  function remove(id) {
    Storage.deleteReminder(id);
    if (_onListChange) _onListChange();
  }

  function start() {
    if (_intervalId) return;
    _intervalId = setInterval(_check, 10000); // Check every 10 seconds
    _check();
  }

  return { 
    add, remove, start, 
    getAll: () => Storage.getReminders(),
    onChange: (fn) => _onListChange = fn 
  };
})();
