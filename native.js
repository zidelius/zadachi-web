/* Нативные уведомления для Android-обёртки (Capacitor). В браузере и PWA модуль ничего не делает. */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var LN = C.Plugins && C.Plugins.LocalNotifications;
  if (!LN) return;
  var X = window.__app;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function at(day, min) { var p = day.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], Math.floor(min / 60), min % 60, 0); }
  function quiet(min) { var f = toMin(X.SET.quiet.from), t = toMin(X.SET.quiet.to); if (f === null || t === null || f === t) return false; return f < t ? (min >= f && min < t) : (min >= f || min < t); }
  var NAG_CAP = 6, DAYS = 3, MAX = 180;

  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000 + 1; }
  function build() {
    var out = [], now = new Date(), today = X.T(), days = [];
    for (var i = 0; i < DAYS; i++) days.push(X.addDays(today, i));
    function push(key, when, title, body, type, extra) { if (when.getTime() > now.getTime() + 5000) out.push({ id: hash(key), title: title, body: body, schedule: { at: when, allowWhileIdle: true }, actionTypeId: type, extra: extra, channelId: 'zadachi', smallIcon: 'ic_stat', group: type }); }
    X.D.tasks.forEach(function (t) {
      if (t.done || t.status === 'done' || t.status === 'archived') return;
      var title = t.title, ex = { kind: 'task', id: t.id };
      if (!t.due_date) { days.forEach(function (d) { (t.remind_at || []).forEach(function (a) { var m = toMin(a); if (m !== null) push('t' + t.id + d + a, at(d, m), title, 'Напоминание', 'TASK', ex); }); }); return; }
      var base = toMin(t.due_time), e = +t.remind_every || 0, n = +t.remind_times || 0;
      days.forEach(function (d) {
        if (t.due_date === d) {
          if (base !== null) {
            push('t' + t.id + d + 'main', at(d, base), title, 'Время: ' + t.due_time, 'TASK', ex);
            if (e) for (var i = 1; i <= (n || NAG_CAP) && i <= NAG_CAP; i++) { var m = base + e * i; if (m < 1440 && !quiet(m)) push('t' + t.id + d + 'r' + i, at(d, m), title, 'Напоминаю ещё раз', 'TASK', ex); }
          }
          (t.remind_at || []).forEach(function (a) { var m = toMin(a); if (m !== null) push('t' + t.id + d + 'a' + a, at(d, m), title, 'Напоминание', 'TASK', ex); });
        }
      });
      if (t.due_date < today && e && !n) { var b = base === null ? 540 : base; for (var k = 1; k <= NAG_CAP; k++) { var mm = b + e * k; var nn = new Date(); var nm = nn.getHours() * 60 + nn.getMinutes(); var m2 = Math.ceil((nm + 1 - b) / e) * e + b + (k - 1) * e; if (m2 < 1440 && !quiet(m2)) push('t' + t.id + 'o' + k + today, at(today, m2), title, 'Просрочено', 'TASK', ex); } }
    });
    var habits = X.D.habits.slice(), plans = (window.WELL && WELL.plans && WELL.plans()) || [], pk = {};
    plans.forEach(function (p) { if (p.habit_id) pk[p.habit_id] = p.kind; });
    if (window.WELL && WELL.habits) WELL.habits().forEach(function (h) { habits.push(h); });
    habits.forEach(function (h) {
      if (h.paused || h.finished) return;
      var times = [h.remind].concat(h.remind_at || []).filter(function (x) { return toMin(x) !== null; });
      if (!times.length) return;
      var kind = pk[h.id], head = kind === 'med' ? 'Пора принять' : kind === 'meal' ? 'Время поесть' : kind === 'workout' ? 'Время тренировки' : 'Привычка';
      var ex = { kind: 'habit', id: h.id };
      days.forEach(function (d) {
        if (!X.sched(h, d)) return;
        if (d === today && X.cnt(h, d) >= X.tgt(h)) return;
        var e = +h.remind_every || 0;
        times.forEach(function (a) {
          var m = toMin(a); push('h' + h.id + d + a, at(d, m), h.name, head, kind === 'med' ? 'MED' : 'HABIT', ex);
          if (e && d === today) for (var i = 1; i <= NAG_CAP; i++) { var m3 = m + e * i; if (m3 < 1440 && !quiet(m3)) push('h' + h.id + d + a + 'r' + i, at(d, m3), h.name, head + ' · напоминаю ещё раз', kind === 'med' ? 'MED' : 'HABIT', ex); }
        });
      });
    });
    out.sort(function (a, b) { return a.schedule.at - b.schedule.at; });
    return out.slice(0, MAX);
  }

  var lastSig = '', busy = false;
  async function sync(force) {
    if (busy || !X.ME || !X.D.profiles.length) return;
    busy = true;
    try {
      var list = build(), sig = JSON.stringify(list.map(function (n) { return [n.id, +n.schedule.at, n.title]; }));
      if (!force && sig === lastSig) return;
      var pend = await LN.getPending();
      if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(function (n) { return { id: n.id }; }) });
      if (list.length) await LN.schedule({ notifications: list });
      lastSig = sig;
    } catch (e) { console.warn('native notifications', e); } finally { busy = false; }
  }

  async function init() {
    try {
      var p = await LN.checkPermissions();
      if (p.display !== 'granted') p = await LN.requestPermissions();
      try { var ea = await LN.checkExactAlarmPermission(); if (ea && ea.exact_alarm !== 'granted') await LN.changeExactNotificationSetting(); } catch (e) {}
      try { await LN.createChannel({ id: 'zadachi', name: 'Напоминания', importance: 5, visibility: 1, vibration: true, lights: true }); } catch (e) {}
      await LN.registerActionTypes({ types: [
        { id: 'TASK', actions: [{ id: 'done', title: 'Выполнено' }, { id: 'snooze', title: '+10 мин' }] },
        { id: 'HABIT', actions: [{ id: 'done', title: 'Отметить' }, { id: 'snooze', title: '+10 мин' }] },
        { id: 'MED', actions: [{ id: 'done', title: 'Принял(а)' }, { id: 'snooze', title: '+10 мин' }] }] });
    } catch (e) { console.warn(e); }
    LN.addListener('localNotificationActionPerformed', async function (ev) {
      var ex = ev.notification && ev.notification.extra || {}, act = ev.actionId;
      for (var w = 0; w < 60 && !(X.ME && X.D.profiles.length); w++) await new Promise(function (r) { setTimeout(r, 500); });
      try {
        if (act === 'snooze') {
          await LN.schedule({ notifications: [{ id: hash('snz' + ex.id + Date.now()), title: ev.notification.title, body: 'Отложенное напоминание', schedule: { at: new Date(Date.now() + 10 * 60000), allowWhileIdle: true }, actionTypeId: ev.notification.actionTypeId, extra: ex, channelId: 'zadachi', smallIcon: 'ic_stat' }] });
        } else if (act === 'done') {
          if (ex.kind === 'task') await X.completeTask(ex.id);
          else { var hs = X.D.habits.concat((window.WELL && WELL.habits && WELL.habits()) || []), h = hs.filter(function (x) { return x.id === ex.id; })[0]; if (h) await X.setMark(h, X.T(), X.cnt(h, X.T()) + 1); }
          sync(true);
        }
      } catch (e) { console.warn(e); }
    });
    sync(true);
    setInterval(function () { sync(false); }, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(true); });
  }
  init();
})();
