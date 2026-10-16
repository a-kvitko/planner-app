/**
 * Runnable check for deferred task→Logbook complete display rules.
 * node js/task-complete-check.js
 */
function taskShowsChecked(done, pending) {
  return !!(done || pending);
}
function inLogbook(done, pending) {
  return !!(done && !pending);
}

if (taskShowsChecked(false, false)) throw new Error('open should be unchecked');
if (!taskShowsChecked(false, true)) throw new Error('pending should look checked');
if (!taskShowsChecked(true, false)) throw new Error('done should look checked');
if (inLogbook(false, true)) throw new Error('pending must not be in Logbook yet');
if (!inLogbook(true, false)) throw new Error('settled done belongs in Logbook');
console.log('task-complete self-check: ok');
