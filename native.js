/* Нативные уведомления для Android-обёртки (Capacitor). В браузере и PWA модуль ничего не делает. */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var LN = (C.Plugins && C.Plugins.LocalNotifications) || (C.registerPlugin && C.registerPlugin('LocalNotifications'));
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
    function push(key, when, title, body, type, extra) { if (when.getTime() > now.getTime() + 5000) out.push({ id: hash(key), title: title, body: body, schedule: { at: when, allowWhileIdle: true }, actionTypeId: type, extra: extra, channelId: (extra && extra.ch) || 'tasks', smallIcon: 'ic_stat', group: type }); }
    X.D.tasks.forEach(function (t) {
      if (t.done || t.status === 'done' || t.status === 'archived') return;
      var title = t.title, ex = { kind: 'task', id: t.id, ch: 'tasks' };
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
    var pm = {}; plans.forEach(function (p) { if (p.habit_id) { pk[p.habit_id] = p.kind; pm[p.habit_id] = (p.msgs || []).filter(Boolean); } });
    if (window.WELL && WELL.habits) WELL.habits().forEach(function (h) { habits.push(h); });
    habits.forEach(function (h) {
      if (h.paused || h.finished) return;
      var times = [h.remind].concat(h.remind_at || []).filter(function (x) { return toMin(x) !== null; });
      if (!times.length) return;
      var kind = pk[h.id], msgs = pm[h.id] || [], head = kind === 'med' ? 'Пора принять' : kind === 'meal' ? 'Время поесть' : kind === 'workout' ? 'Время тренировки' : 'Привычка';
      var ex = { kind: 'habit', id: h.id, ch: { med: 'meds', meal: 'meals', workout: 'workouts', nudge: 'support' }[kind] || 'habits' };
      days.forEach(function (d) {
        if (!X.sched(h, d)) return;
        if (d === today && X.cnt(h, d) >= X.tgt(h)) return;
        var e = +h.remind_every || 0;
        times.forEach(function (a) {
          var m = toMin(a); if (kind === 'nudge') { var dn = Math.floor(at(d, 0).getTime() / 86400000), txt = msgs.length ? msgs[(dn + times.indexOf(a)) % msgs.length] : 'Ты на правильном пути. Сделай следующий маленький шаг.'; push('h' + h.id + d + a, at(d, m), h.name, txt, 'NUDGE', ex); return; } push('h' + h.id + d + a, at(d, m), h.name, head, kind === 'med' ? 'MED' : kind === 'nudge' ? 'NUDGE' : 'HABIT', ex);
          if (e && d === today) for (var i = 1; i <= NAG_CAP; i++) { var m3 = m + e * i; if (m3 < 1440 && !quiet(m3)) push('h' + h.id + d + a + 'r' + i, at(d, m3), h.name, head + ' · напоминаю ещё раз', kind === 'med' ? 'MED' : 'HABIT', ex); }
        });
      });
    });
    out.sort(function (a, b) { return a.schedule.at - b.schedule.at; });
    return out.slice(0, MAX);
  }

  /* виджет рабочего стола: дела на сегодня и просроченные + привычки на сегодня */
  var WB = C.registerPlugin ? C.registerPlugin('WidgetBridge') : null, wSig = '';
  function widgetData() {
    var today = X.T(), items = [];
    X.D.tasks.forEach(function (t) {
      if (t.done || t.status === 'done' || t.status === 'archived' || !t.due_date || t.due_date > today) return;
      items.push({ t: t.title, m: (t.due_date < today ? 'просрочено' : '') + (t.due_date === today && t.due_time ? t.due_time : ''), o: t.due_date < today, h: false, k: (t.due_date < today ? '0' : '1') + (t.due_time || '99') });
    });
    var hs = X.D.habits.slice(); if (window.WELL && WELL.habits) WELL.habits().forEach(function (h) { hs.push(h); });
    hs.forEach(function (h) { if (h.paused || h.finished || !X.sched(h, today) || X.cnt(h, today) >= X.tgt(h)) return; items.push({ t: h.name, m: h.remind || '', o: false, h: true, k: '1' + (h.remind || '99') }); });
    items.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
    var d = new Date(), WDN = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'], MN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return { date: WDN[d.getDay()] + ', ' + d.getDate() + ' ' + MN[d.getMonth()], items: items.slice(0, 40).map(function (x) { return { t: x.t, m: x.m, o: x.o, h: x.h }; }) };
  }
  async function widgetSync() {
    if (!WB || !X.ME || !X.D.profiles.length) return;
    try { var j = JSON.stringify(widgetData()); if (j === wSig) return; await WB.update({ json: j }); wSig = j; } catch (e) { /* виджет не установлен или плагин недоступен */ }
  }

  var lastSig = '', busy = false;
  async function sync(force) {
    widgetSync();
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
      /* отдельный канал на каждый раздел: в настройках Android для каждого можно задать свой звук и вибрацию */
      var CHS = [['tasks', 'Задачи', 'Напоминания о задачах и повторы'], ['habits', 'Привычки', 'Напоминания о привычках'], ['meds', 'Лекарства и БАДы', 'Время приёма'], ['meals', 'Питание', 'Приёмы пищи по плану'], ['workouts', 'Тренировки', 'Время тренировки'], ['support', 'Поддержка', 'Мотивационные напоминания']];
      try { await LN.deleteChannel({ id: 'zadachi' }); } catch (e) {}
      for (var ci = 0; ci < CHS.length; ci++) { try { await LN.createChannel({ id: CHS[ci][0], name: CHS[ci][1], description: CHS[ci][2], importance: CHS[ci][0] === 'support' ? 4 : 5, visibility: 1, vibration: true, lights: true }); } catch (e) {} }
      await LN.registerActionTypes({ types: [
        { id: 'TASK', actions: [{ id: 'done', title: 'Выполнено' }, { id: 'snooze', title: '+10 мин' }] },
        { id: 'HABIT', actions: [{ id: 'done', title: 'Отметить' }, { id: 'snooze', title: '+10 мин' }] },
        { id: 'NUDGE', actions: [{ id: 'done', title: 'Справился(ась)' }, { id: 'snooze', title: '+10 мин' }] },
        { id: 'MED', actions: [{ id: 'done', title: 'Принял(а)' }, { id: 'snooze', title: '+10 мин' }] }] });
    } catch (e) { console.warn(e); }
    LN.addListener('localNotificationActionPerformed', async function (ev) {
      var ex = ev.notification && ev.notification.extra || {}, act = ev.actionId;
      for (var w = 0; w < 60 && !(X.ME && X.D.profiles.length); w++) await new Promise(function (r) { setTimeout(r, 500); });
      try {
        if (act === 'snooze') {
          await LN.schedule({ notifications: [{ id: hash('snz' + ex.id + Date.now()), title: ev.notification.title, body: 'Отложенное напоминание', schedule: { at: new Date(Date.now() + 10 * 60000), allowWhileIdle: true }, actionTypeId: ev.notification.actionTypeId, extra: ex, channelId: ex.ch || 'tasks', smallIcon: 'ic_stat' }] });
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
