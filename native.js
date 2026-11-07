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
      lastSig = sig; ST.notif = 'ок, запланировано: ' + list.length;
    } catch (e) { ST.notif = 'ошибка: ' + (e && e.message || e); console.warn('native notifications', e); } finally { busy = false; }
  }

  /* состояние нативной части: показывается в Настройках, чтобы было видно, что работает */
  var ST = window.NATIVE = { widget: '…', notif: '…', back: '…', perm: '…', refresh: function () { wSig = ''; return widgetSync(); } };
  function tmo(p, ms, name) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(name + ': нет ответа')); }, ms); })]); }
  async function widgetSync2() {
    if (!WB) { ST.widget = 'плагин виджета не найден'; return; }
    if (!X.ME || !X.D.profiles.length) return;
    try { var j = JSON.stringify(widgetData()); if (j === wSig) return; await tmo(WB.update({ json: j }), 8000, 'виджет'); wSig = j; ST.widget = 'ок, дел: ' + JSON.parse(j).items.length; }
    catch (e) { ST.widget = 'ошибка: ' + (e && e.message || e); }
  }
  widgetSync = widgetSync2;

  /* жест «назад» (с края экрана) и системная кнопка: окно -> панель -> предыдущий экран -> свернуть */
  var hist = [], skipHist = false, go0 = X.A.go;
  X.A.go = function (v) { var prev = X.UI.view, r = go0.apply(this, arguments); if (!skipHist && X.UI.view !== prev) { hist.push(prev); if (hist.length > 30) hist.shift(); } return r; };
  X.A.nativeRefresh = async function () { await ST.refresh(); X.toast('Виджет: ' + ST.widget); if (X.UI.sheet) X.renderSheet(); };
  X.A.nativeTest = async function () {
    try { var p = await LN.checkPermissions(); if (p.display !== 'granted') p = await LN.requestPermissions(); ST.perm = p.display; if (p.display !== 'granted') { X.toast('Уведомления запрещены в настройках Android'); return; }
      await LN.schedule({ notifications: [{ id: hash('test' + Date.now()), title: 'Проверка', body: 'Уведомления работают', schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true }, channelId: 'tasks', smallIcon: 'ic_stat' }] }); X.toast('Придёт через 3 секунды'); }
    catch (e) { X.toast('Ошибка: ' + (e && e.message || e)); }
  };
  function setupBack() {
    var APP = (C.Plugins && C.Plugins.App) || (C.registerPlugin && C.registerPlugin('App'));
    if (!APP || !APP.addListener) { ST.back = 'плагин App не найден'; return; }
    APP.addListener('backButton', function () {
      if (X.UI.sheet) { X.closeSheet(); return; }
      if (X.UI.sel) { X.UI.sel = null; X.render(); return; }
      if (hist.length) { var v = hist.pop(); skipHist = true; try { go0.call(X.A, v); } finally { skipHist = false; } return; }
      if (X.UI.view !== 'tasks') { skipHist = true; try { go0.call(X.A, 'tasks'); } finally { skipHist = false; } return; }
      if (APP.minimizeApp) APP.minimizeApp(); else if (APP.exitApp) APP.exitApp();
    });
    ST.back = 'ок';
  }
  try { setupBack(); } catch (e) { ST.back = 'ошибка: ' + (e && e.message || e); }

  async function init() {
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
    /* каждый шаг со своим таймаутом: один зависший вызов не должен останавливать остальное */
    var CHS = [['tasks', 'Задачи', 'Напоминания о задачах и повторы'], ['habits', 'Привычки', 'Напоминания о привычках'], ['meds', 'Лекарства и БАДы', 'Время приёма'], ['meals', 'Питание', 'Приёмы пищи по плану'], ['workouts', 'Тренировки', 'Время тренировки'], ['support', 'Поддержка', 'Мотивационные напоминания']];
    try { try { await tmo(LN.deleteChannel({ id: 'zadachi' }), 5000, 'канал'); } catch (e) {}
      for (var ci = 0; ci < CHS.length; ci++) { try { await tmo(LN.createChannel({ id: CHS[ci][0], name: CHS[ci][1], description: CHS[ci][2], importance: CHS[ci][0] === 'support' ? 4 : 5, visibility: 1, vibration: true, lights: true }), 5000, 'канал'); } catch (e) {} } } catch (e) {}
    try { await tmo(LN.registerActionTypes({ types: [
        { id: 'TASK', actions: [{ id: 'done', title: 'Выполнено' }, { id: 'snooze', title: '+10 мин' }] },
        { id: 'HABIT', actions: [{ id: 'done', title: 'Отметить' }, { id: 'snooze', title: '+10 мин' }] },
        { id: 'NUDGE', actions: [{ id: 'done', title: 'Справился(ась)' }, { id: 'snooze', title: '+10 мин' }] },
        { id: 'MED', actions: [{ id: 'done', title: 'Принял(а)' }, { id: 'snooze', title: '+10 мин' }] }] }), 5000, 'кнопки'); } catch (e) { ST.notif = 'ошибка кнопок: ' + e.message; }
    try { var p = await tmo(LN.checkPermissions(), 5000, 'разрешения'); ST.perm = p.display; if (p.display !== 'granted') { p = await tmo(LN.requestPermissions(), 60000, 'запрос'); ST.perm = p.display; } } catch (e) { ST.perm = 'ошибка: ' + e.message; }
    sync(true);
    try { var ea = await tmo(LN.checkExactAlarmPermission(), 5000, 'будильники'); if (ea && ea.exact_alarm !== 'granted') { ST.notif = 'нужно разрешение «Будильники и напоминания»'; await LN.changeExactNotificationSetting(); } } catch (e) {}
    setInterval(function () { sync(false); }, 15000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) sync(true); });
  }
  /* виджет обновляем независимо от уведомлений */
  setInterval(function () { widgetSync(); }, 5000);
  setTimeout(function () { widgetSync(); }, 1500);
  init();
})();