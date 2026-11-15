/* Шаги — один дневной итог, не сумма скриншотов/источников.
   Подключается после wellbeing.js. Запись только по действию пользователя. */
(function () {
  'use strict';
  var X = window.__app;
  if (!X || !X.sb) return;
  var S = { logs: [], ok: false, error: '', owner: null }, F = { day: '', steps: '', dirty: false, owner: null }, period = 7;
  var pending = {}, loading = 0, busy = false;
  function isDay(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s >= '2000-01-01' && !isNaN(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  }
  function stepsValue(n) {
    if (typeof n === 'string') { if (!/^\d+$/.test(n.trim())) return null; n = Number(n); }
    return Number.isInteger(n) && n >= 0 && n <= 200000 ? n : null;
  }
  function valid(d) { return !!d && isDay(d.day) && d.day <= X.T() && stepsValue(d.steps) !== null; }
  function fmt(n) { return Number(n).toLocaleString('ru-RU'); }
  function ownRows() { return S.owner === X.ME ? S.logs.filter(function (r) { return r.owner === X.ME && valid(r); }) : []; }
  function byDay(day) { return ownRows().filter(function (r) { return r.day === day; })[0] || null; }
  function resetOwner() {
    if (S.owner === X.ME && F.owner === X.ME) return;
    S.logs = []; S.ok = false; S.error = ''; S.owner = X.ME;
    F = { day: X.T(), steps: '', dirty: false, owner: X.ME }; pending = {};
  }
  function hydrate() {
    resetOwner(); if (!F.day) F.day = X.T();
    if (!F.dirty) { var row = byDay(F.day); F.steps = row ? String(row.steps) : ''; }
  }
  function dedupe(rows, owner) {
    var map = {};
    (rows || []).forEach(function (r) {
      if (r.owner !== owner || !valid(r)) return;
      var old = map[r.day];
      if (!old || String(r.updated_at || r.created_at || '') >= String(old.updated_at || old.created_at || '')) map[r.day] = r;
    });
    return Object.keys(map).sort().map(function (d) { return map[d]; });
  }
  async function load() {
    resetOwner(); var owner = X.ME, token = ++loading;
    if (!owner) return;
    try {
      var rows = await X.q(X.sb.from('activity_logs').select('*').eq('owner', owner).gte('day', X.addDays(X.T(), -365)).lte('day', X.T()).order('day'));
      if (owner !== X.ME || token !== loading) return;
      S.logs = dedupe(rows, owner); S.ok = true; S.error = ''; hydrate();
    } catch (e) { if (owner === X.ME && token === loading) { S.ok = false; S.error = e && e.message || 'Ошибка связи'; } }
  }
  function dates(from, to) {
    if (!isDay(from) || !isDay(to) || from > to || to > X.T() || Math.round((Date.parse(to) - Date.parse(from)) / 86400000) > 365) throw new Error('Выбери прошедший период до 366 дней');
    var out = []; for (var d = from; d <= to; d = X.addDays(d, 1)) out.push(d); return out;
  }
  function makeReport(rows, from, to) {
    var ds = dates(from, to), map = {};
    dedupe(rows, X.ME).forEach(function (r) { map[r.day] = r; });
    var days = ds.map(function (day) { var r = map[day]; return { day: day, steps: r ? Number(r.steps) : null, source: r ? r.source : undefined }; });
    var logged = days.filter(function (d) { return d.steps !== null; }), total = logged.reduce(function (n, d) { return n + d.steps; }, 0);
    return { days: days, coverage: { from: from, to: to, loggedDays: logged.length, totalDays: ds.length, totalSteps: total }, supported: true };
  }
  function summary(from, to) { return makeReport(ownRows(), from || X.addDays(X.T(), -6), to || X.T()); }
  async function reportData(from, to) {
    dates(from, to); var owner = X.ME;
    if (!owner) throw new Error('Войди в аккаунт');
    // Отчёт не ограничен текущим кэшем за год и не подменяет ошибку пустым набором.
    var rows = await X.q(X.sb.from('activity_logs').select('*').eq('owner', owner).gte('day', from).lte('day', to).order('day'));
    if (X.ME !== owner) throw new Error('Аккаунт изменился. Повтори запрос');
    return makeReport(rows, from, to);
  }
  function timezone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) { return 'UTC'; } }
  async function save(d, source, entry) {
    resetOwner(); var owner = X.ME;
    if (!owner) throw new Error('Войди в аккаунт');
    if (!valid(d)) throw new Error('Укажи реальную дату не позже сегодня и целое число шагов от 0 до 200 000');
    var key = owner + ':' + d.day;
    if (pending[key]) throw new Error('Этот день уже сохраняется. Дождись окончания');
    pending[key] = true;
    try {
      var row = { owner: owner, day: d.day, steps: stepsValue(d.steps), source: source, time_zone: timezone() };
      var saved = await X.q(X.sb.from('activity_logs').upsert(row, { onConflict: 'owner,day' }).select().single());
      if (owner !== X.ME) throw new Error('Аккаунт изменился. Итог сохранён в предыдущем аккаунте');
      if (!saved || saved.owner !== owner || saved.day !== d.day || !valid(saved)) throw new Error('Сервер не подтвердил итог дня');
      var old = byDay(saved.day);
      if (entry && old && Number(old.steps) === Number(saved.steps)) entry._existing = true;
      S.logs = dedupe(S.logs.filter(function (r) { return r.day !== saved.day; }).concat([saved]), owner); S.owner = owner;
      if (F.day === saved.day) { F.steps = String(saved.steps); F.dirty = false; }
      return saved;
    } finally { delete pending[key]; }
  }
  function addProposal(d, entry) { return save(d, 'assistant', entry); }
  function view() {
    hydrate(); var esc = X.esc, today = X.T(), from = X.addDays(today, 1 - period);
    var h = '<div class="hnote">Шаги — дневной итог с телефона или часов. Введи число вручную или пришли скриншот помощнику и подтверди карточку. Повторная запись заменяет итог дня, а не прибавляется. Автосинхронизации с датчиками пока нет.</div>';
    if (!S.ok) h += '<div class="herr">' + esc(S.error ? 'Не удалось загрузить шаги. ' + S.error : 'Загружаю шаги…') + '</div><button class="btn2" data-a="activityRetry">Повторить загрузку</button>';
    var existing = byDay(F.day);
    h += '<form data-activity-form="daily" class="hsum"><div class="gl">Дневной итог</div><div class="row2"><label><div class="gl">Дата</div><input class="fld" type="date" data-activity-field="day" value="' + esc(F.day) + '" min="2000-01-01" max="' + today + '" required></label><label><div class="gl">Шагов за день</div><input class="fld" type="number" inputmode="numeric" data-activity-field="steps" min="0" max="200000" step="1" value="' + esc(F.steps) + '" placeholder="Например, 6200" required></label></div><div class="muted" style="font-size:12.5px;margin:8px 0">' + (existing ? 'Сохранено ' + fmt(existing.steps) + '. Новое число заменит этот итог.' : 'Пустое поле — нет данных. 0 сохраняй только если шагов действительно не было.') + '</div><button class="btn2" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Сохраняю…' : 'Сохранить итог') + '</button></form>';
    h += '<div class="chipsrow">' + [7, 30, 90].map(function (n) { return '<button class="fchip' + (period === n ? ' on' : '') + '" data-a="activityPeriod" data-v="' + n + '">' + n + ' дней</button>'; }).join('') + '</div>';
    if (!S.ok) return h;
    var r = summary(from, today), c = r.coverage;
    h += '<div class="hsum"><div class="hk"><b>' + (c.loggedDays ? fmt(c.totalSteps) : '—') + '</b><span>шагов за ' + period + ' дней</span></div><div class="meta"><span>Итоги: ' + c.loggedDays + ' из ' + c.totalDays + ' дней</span>' + (c.loggedDays ? '<span>Среднее по записанным дням: ' + fmt(Math.round(c.totalSteps / c.loggedDays)) + '</span>' : '') + '</div><div class="muted" style="font-size:12.5px;margin-top:8px">Пропуски не считаются нулём. Шаги из прогулок и тренировок дополнительно не прибавляются: они уже входят в дневной итог.</div></div>';
    h += '<div class="dday">По дням</div>' + r.days.slice().reverse().map(function (d) {
      return '<div class="task hrow"><div class="hlead"><span class="hdot">' + X.I('run') + '</span></div><button class="tb" data-a="activityEdit" data-v="' + d.day + '"><span class="tt">' + esc(X.dayWord(d.day)) + '</span><span class="meta"><span>' + (d.steps === null ? 'Нет данных' : fmt(d.steps) + ' шагов') + '</span>' + (d.source ? '<span>' + ({ manual: 'вручную', screenshot: 'со скриншота', assistant: 'через помощника' }[d.source] || 'источник не указан') + '</span>' : '') + '<span>Изменить итог</span></span></button></div>';
    }).join('');
    return h;
  }
  function asEntries(a) {
    var seen = {};
    return (Array.isArray(a && a.activity_logs) ? a.activity_logs : []).filter(function (d) { if (!valid(d) || seen[d.day]) return false; seen[d.day] = true; return true; }).slice(0, 14).map(function (d) { return { t: 'activity', d: { day: d.day, steps: stepsValue(d.steps), reason: String(d.reason || '').slice(0, 500) } }; });
  }
  function entryInfo(e) {
    var d = e.d || {}, old = byDay(d.day);
    return { title: fmt(stepsValue(d.steps) || 0) + ' шагов', meta: [isDay(d.day) ? X.dayWord(d.day) : 'Уточни дату', 'дневной итог'], note: (old ? 'Сейчас за день: ' + fmt(old.steps) + '. Новый итог заменит его, не прибавится. ' : 'Сохранится один итог за день. ') + String(d.reason || '') };
  }
  function entryText(e) { var inf = entryInfo(e); return { title: 'Шаги: ' + inf.title, body: inf.meta.join(' · ') + '\n' + inf.note }; }
  Object.assign(X.A, {
    activityRetry: async function () { await load(); X.render(); },
    activityEdit: function (v) { if (!isDay(v) || v > X.T()) return; resetOwner(); F.day = v; F.dirty = false; hydrate(); X.render(); },
    activityPeriod: function (v) { period = [7, 30, 90].indexOf(+v) >= 0 ? +v : 7; X.render(); }
  });
  document.addEventListener('input', function (e) {
    var el = e.target, f = el && el.getAttribute && el.getAttribute('data-activity-field');
    if (f === 'steps') { resetOwner(); F.steps = el.value; F.dirty = true; }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, f = el && el.getAttribute && el.getAttribute('data-activity-field');
    if (f === 'day') { resetOwner(); F.day = el.value; F.dirty = false; hydrate(); X.render(); }
  });
  document.addEventListener('submit', function (e) {
    if (!e.target || !e.target.getAttribute || e.target.getAttribute('data-activity-form') !== 'daily') return;
    e.preventDefault(); if (busy) return;
    busy = true; var draft = { day: F.day, steps: F.steps }; X.render();
    save(draft, 'manual').then(function () { X.toast('Итог шагов сохранён'); }).catch(X.err).finally(function () { busy = false; X.render(); });
  });
  window.ACTIVITY = {
    load: load, view: view, summary: summary, reportData: reportData, addProposal: addProposal,
    data: function () { resetOwner(); return { logs: ownRows().slice(), ok: S.ok, error: S.error }; },
    exportData: function () { return ownRows().slice(); },
    owns: function (t) { return t === 'activity'; }, asEntries: asEntries, entryInfo: entryInfo, entryText: entryText,
    addFrom: function (e) { return addProposal(e.d, e); }
  };
  if (X.ME && X.D.profiles.length) load().then(function () { X.render(); });
})();
