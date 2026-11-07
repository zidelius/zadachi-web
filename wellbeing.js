/* Раздел «Здоровье»: аптечка и БАДы, приём и расписания, нутриенты, анализы.
   Подключается после health.js. Расписания приёма и повторяющиеся напоминания о еде и тренировках
   построены на привычках (habits): они дают время, дни недели, повторы и кнопку «Отметить» прямо в уведомлении.
   Справка, а не врач: приложение ничего не назначает. */
(function () {
  'use strict';

  var X = window.__app, HE = window.HEALTH, U = HE && HE.u;
  if (!X || !U) return;
  var T = X.T, addDays = X.addDays, diff = X.diff, fromKey = X.fromKey, fmtDM = X.fmtDM, dayWord = X.dayWord, esc = X.esc, uid = X.uid,
    plural = X.plural, I = X.I, nowHM = X.nowHM, toast = X.toast, err = X.err, q = X.q, sb = X.sb, UI = X.UI, A = X.A, render = X.render,
    renderSheet = X.renderSheet, closeSheet = X.closeSheet, createTask = X.createTask, saveSettings = X.saveSettings,
    setMark = X.setMark, tgt = X.tgt, sched = X.sched, COLORS = X.COLORS, WD = X.WD;
  var num = U.num, r1 = U.r1, hm = U.hm, field = U.field, numField = U.numField, chipSet = U.chipSet, section = U.section, tabs = U.tabs,
    photoBlock = U.photoBlock, callAI = U.callAI, photoBlob = U.photoBlob, blobB64 = U.blobB64, BLOBS = U.BLOBS, shrink = U.shrink,
    BUCKET = U.BUCKET, CAM = U.CAM, KIND = U.KIND;

  var W = { cabinet: [], intakes: [], plans: [], labs: [], habits: [], ok: false, error: '' };
  var WUI = { tab: 'intake', cab: 'med', period: '7' };
  var UNITS = ['таб.', 'капс.', 'мл', 'доз.', 'пак.', 'шт.'];
  var SYMPTOMS = ['насморк', 'головная боль', 'температура', 'боль в горле', 'кашель', 'изжога', 'расстройство желудка', 'аллергия', 'бессонница'];

  /* ---------- нормы потребления (ориентиры для взрослых) ----------
     m / f — рекомендуемое в день для мужчин и женщин; ul — безопасный верхний уровень из всех источников;
     ulS — верхний уровень только из добавок; limit — не больше. Это общие ориентиры, а не медицинские назначения. */
  var NUT = [
    { k: 'fiber_g', n: 'Клетчатка', u: 'г', g: 'Основное', m: 38, f: 25 },
    { k: 'omega3_g', n: 'Омега-3 (ALA)', u: 'г', g: 'Основное', m: 1.6, f: 1.1 },
    { k: 'sodium_mg', n: 'Натрий', u: 'мг', g: 'Минералы', limit: 2300 },
    { k: 'potassium_mg', n: 'Калий', u: 'мг', g: 'Минералы', m: 3400, f: 2600 },
    { k: 'calcium_mg', n: 'Кальций', u: 'мг', g: 'Минералы', m: 1000, f: 1000, ul: 2500 },
    { k: 'iron_mg', n: 'Железо', u: 'мг', g: 'Минералы', m: 8, f: 18, ul: 45 },
    { k: 'magnesium_mg', n: 'Магний', u: 'мг', g: 'Минералы', m: 420, f: 320, ulS: 350 },
    { k: 'zinc_mg', n: 'Цинк', u: 'мг', g: 'Минералы', m: 11, f: 8, ul: 40 },
    { k: 'phosphorus_mg', n: 'Фосфор', u: 'мг', g: 'Минералы', m: 700, f: 700, ul: 4000 },
    { k: 'selenium_ug', n: 'Селен', u: 'мкг', g: 'Минералы', m: 55, f: 55, ul: 400 },
    { k: 'iodine_ug', n: 'Йод', u: 'мкг', g: 'Минералы', m: 150, f: 150, ul: 1100 },
    { k: 'vit_a_ug', n: 'Витамин A', u: 'мкг', g: 'Витамины', m: 900, f: 700, ul: 3000 },
    { k: 'vit_c_mg', n: 'Витамин C', u: 'мг', g: 'Витамины', m: 90, f: 75, ul: 2000 },
    { k: 'vit_d_ug', n: 'Витамин D', u: 'мкг', g: 'Витамины', m: 15, f: 15, ul: 100 },
    { k: 'vit_e_mg', n: 'Витамин E', u: 'мг', g: 'Витамины', m: 15, f: 15, ul: 1000 },
    { k: 'vit_k_ug', n: 'Витамин K', u: 'мкг', g: 'Витамины', m: 120, f: 90 },
    { k: 'b1_mg', n: 'B1 (тиамин)', u: 'мг', g: 'Витамины', m: 1.2, f: 1.1 },
    { k: 'b2_mg', n: 'B2 (рибофлавин)', u: 'мг', g: 'Витамины', m: 1.3, f: 1.1 },
    { k: 'b3_mg', n: 'B3 (ниацин)', u: 'мг', g: 'Витамины', m: 16, f: 14, ulS: 35 },
    { k: 'b6_mg', n: 'B6', u: 'мг', g: 'Витамины', m: 1.3, f: 1.3, ulS: 100 },
    { k: 'b9_ug', n: 'B9 (фолат)', u: 'мкг', g: 'Витамины', m: 400, f: 400, ulS: 1000 },
    { k: 'b12_ug', n: 'B12', u: 'мкг', g: 'Витамины', m: 2.4, f: 2.4 }
  ];
  var NUTBY = {}; NUT.forEach(function (n) { NUTBY[n.k] = n; });
  function nutMeta(k) { var n = NUTBY[k]; return n ? { n: n.n, u: n.u } : { n: k, u: '' }; }
  function normOf(n) {
    var S = X.SET, sex = S.hSex === 'f' ? 'f' : 'm', age = num(S.hAge) || 30;
    var v = sex === 'f' ? (n.f != null ? n.f : n.m) : (n.m != null ? n.m : n.f);
    if (v == null) return null;
    if (age >= 51) { if (n.k === 'calcium_mg' && sex === 'f') v = 1200; if (n.k === 'iron_mg' && sex === 'f') v = 8; if (n.k === 'b6_mg') v = sex === 'f' ? 1.5 : 1.7; }
    if (age >= 71) { if (n.k === 'vit_d_ug') v = 20; if (n.k === 'calcium_mg') v = 1200; }
    return v;
  }
  function fmtN(x) { x = +x || 0; return String(x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).replace('.', ','); }
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(); }

  /* ---------- данные ---------- */
  function cabById(id) { return W.cabinet.filter(function (c) { return c.id === id; })[0]; }
  function cabByName(n) {
    n = norm(n); if (!n) return null;
    return W.cabinet.filter(function (c) { return norm(c.name) === n; })[0] ||
      W.cabinet.filter(function (c) { var m = norm(c.name); return m.indexOf(n) >= 0 || n.indexOf(m) >= 0; })[0] || null;
  }
  function planById(id) { return W.plans.filter(function (p) { return p.id === id; })[0]; }
  function habitOf(p) { return p && p.habit_id ? W.habits.filter(function (h) { return h.id === p.habit_id; })[0] : null; }
  function markCount(h, day) { var m = X.D.marks[h.id]; return (m && m[day]) || 0; }
  function unitOf(c) { return (c && c.unit) || 'ед.'; }

  async function load() {
    try {
      var since = addDays(T(), -120);
      var r = await Promise.all([
        q(sb.from('cabinet').select('*').order('name')),
        q(sb.from('intakes').select('*').gte('day', since).order('day', { ascending: false })),
        q(sb.from('h_plans').select('*')),
        q(sb.from('labs').select('*').order('day', { ascending: false }).limit(300))
      ]);
      W.cabinet = r[0]; W.intakes = r[1]; W.plans = r[2]; W.labs = r[3];
      // привычки-расписания не показываем среди обычных привычек
      var ids = {}; W.plans.forEach(function (p) { if (p.habit_id) ids[p.habit_id] = 1; });
      var map = {}; W.habits.forEach(function (h) { map[h.id] = h; });
      X.D.habits.forEach(function (h) { if (ids[h.id]) map[h.id] = h; });
      W.habits = Object.keys(map).filter(function (id) { return ids[id]; }).map(function (id) { return map[id]; });
      X.D.habits = X.D.habits.filter(function (h) { return !ids[h.id]; });
      W.ok = true; W.error = '';
      endCourses();
    } catch (e) { W.ok = false; W.error = (e && e.message) || 'ошибка связи'; }
  }
  /* курс закончился — расписание ставим на паузу (напоминания перестают приходить) */
  function endCourses() {
    var t = T();
    W.plans.forEach(function (p) {
      var h = habitOf(p);
      if (h && !h.finished && p.end_day && p.end_day < t) {
        h.finished = true;
        sb.from('habits').update({ finished: true }).eq('id', h.id).then(function () {});
      }
    });
  }
  function isOver(p) { var h = habitOf(p); return !!(h && h.finished) || !!(p.end_day && p.end_day < T()); }

  /* ---------- питательные вещества за период ---------- */
  function suppAmounts(item, units, into) { (item.nutrients || []).forEach(function (nt) { into[nt.key] = (into[nt.key] || 0) + (+nt.amount || 0) * units; }); }
  function suppIntake(from, to) {
    var tot = {};
    W.intakes.forEach(function (i) {
      if (i.day < from || i.day > to) return;
      var it = cabById(i.item_id) || cabByName(i.name); if (it) suppAmounts(it, +i.units || 1, tot);
    });
    W.plans.forEach(function (p) {
      if (p.kind !== 'med' || !p.habit_id) return;
      var it = cabById(p.item_id); if (!it) return;
      var m = X.D.marks[p.habit_id] || {};
      Object.keys(m).forEach(function (day) { if (day >= from && day <= to && m[day] > 0) suppAmounts(it, m[day] * (+p.units || 1), tot); });
    });
    return tot;
  }
  function nutrition(days) {
    var to = T(), from = addDays(to, -(days - 1));
    var meals = U.meals().filter(function (m) { return m.day >= from && m.day <= to && U.isDone(m); });
    var dd = {}; meals.forEach(function (m) { dd[m.day] = 1; });
    var nd = Math.max(1, Object.keys(dd).length), food = {}, withM = 0, noM = [], mac = { kcal: 0, p: 0, f: 0, c: 0 };
    meals.forEach(function (m) {
      mac.kcal += +m.kcal || 0; mac.p += +m.protein || 0; mac.f += +m.fat || 0; mac.c += +m.carbs || 0;
      if (m.micros && Object.keys(m.micros).length) { withM++; Object.keys(m.micros).forEach(function (k) { food[k] = (food[k] || 0) + (+m.micros[k] || 0); }); }
      else noM.push(m);
    });
    var supp = suppIntake(from, to);
    var rows = NUT.map(function (n) {
      var f = (food[n.k] || 0) / nd, s = (supp[n.k] || 0) / days, tot = f + s, nm = normOf(n);
      var st = 'ok';
      if (n.limit != null) st = tot > n.limit ? 'high' : 'ok';
      else if (nm != null) {
        if ((n.ul != null && tot > n.ul) || (n.ulS != null && s > n.ulS)) st = 'high';
        else if (tot / nm < 0.5) st = 'low'; else if (tot / nm < 0.9) st = 'mid';
      }
      return { n: n, f: f, s: s, tot: tot, norm: nm, st: st, has: tot > 0 };
    });
    return { days: days, nd: nd, nMeals: meals.length, withM: withM, noM: noM, mac: { kcal: mac.kcal / nd, p: mac.p / nd, f: mac.f / nd, c: mac.c / nd }, rows: rows };
  }
  var ST = { low: ['мало', 'hsl(18,72%,46%)'], mid: ['маловато', 'hsl(40,78%,45%)'], ok: ['норма', 'var(--ok)'], high: ['много', 'hsl(0,68%,48%)'] };

  /* Краткая сводка для помощника: что за последние 7 дней пришло из еды и добавок */
  function summaryText() {
    if (!W.ok) return '';
    var d = nutrition(7);
    if (!d.nMeals && !W.cabinet.length) return '';
    var S = X.SET, h = 'Нормы для: ' + (S.hSex === 'f' ? 'женщина' : S.hSex === 'm' ? 'мужчина' : 'пол не указан (приняты нормы для мужчины)') + (S.hAge ? ', ' + S.hAge + ' лет' : '') + '. Среднее за день за 7 дней; еда считается по дням с записями, добавки по всему периоду.\n';
    h += 'Макронутриенты в день: ' + Math.round(d.mac.kcal) + ' ккал, Б ' + Math.round(d.mac.p) + ', Ж ' + Math.round(d.mac.f) + ', У ' + Math.round(d.mac.c) + '.\n';
    if (d.noM.length) h += 'У ' + d.noM.length + ' из ' + d.nMeals + ' приёмов пищи нет оценки микроэлементов, в расчёт они не вошли.\n';
    d.rows.forEach(function (r) {
      if (!r.has && r.norm == null) return;
      h += r.n.n + ': ' + fmtN(r.tot) + ' ' + r.n.u + (r.s > 0 ? ' (еда ' + fmtN(r.f) + ' + добавки ' + fmtN(r.s) + ')' : '') + ', ' + (r.n.limit != null ? 'не больше ' + r.n.limit : 'норма ' + fmtN(r.norm)) + ', ' + ST[r.st][0] + (r.has ? '' : ' (нет данных)') + '\n';
    });
    return h.slice(0, 3200);
  }

  /* =================== ЭКРАН «ЗДОРОВЬЕ» =================== */
  function view() {
    var addBtn = WUI.tab === 'intake' ? '<button class="btn2" data-a="wIntakeNew">' + I('plus') + 'Приём</button>' :
      WUI.tab === 'cab' ? '<button class="btn2" data-a="wItemNew">' + I('plus') + 'Добавить</button>' :
      WUI.tab === 'labs' ? '<button class="btn2" data-a="wLabNew">' + I('plus') + 'Анализы</button>' : '<button class="btn2" data-a="wProf">' + I('gear') + 'Профиль</button>';
    var h = '<div class="top"><div><div class="date">' + X.fmtLong(T()) + '</div><h1 class="dh">Здоровье</h1></div>' + addBtn + '</div>';
    h += tabs([['intake', 'Приём'], ['cab', 'Аптечка'], ['nut', 'Нутриенты'], ['labs', 'Анализы']], WUI.tab, 'wTab');
    if (!W.ok) return h + (W.error ? '<div class="empty">Раздел пока не подключён к базе.<br>' + esc(W.error) + '<br><br>Нужно выполнить миграцию в Supabase.</div>' : '<div class="empty">Загружаю…</div>');
    return h + (WUI.tab === 'intake' ? intakeView() : WUI.tab === 'cab' ? cabView() : WUI.tab === 'nut' ? nutView() : labsView());
  }
  function disclaimer() { return '<div class="wdisc">Справочная информация, не медицинская рекомендация. Лекарства принимайте по инструкции и назначению врача.</div>'; }

  /* ---------- Приём ---------- */
  function todayPlans() {
    var t = T();
    return W.plans.filter(function (p) { return p.kind === 'med'; }).map(function (p) { return { p: p, h: habitOf(p) }; }).filter(function (x) {
      return x.h && !x.h.finished && !x.h.paused && x.p.start_day <= t && (!x.p.end_day || x.p.end_day >= t) && sched(x.h, t);
    });
  }
  function timesOf(h) { return [h.remind].concat(h.remind_at || []).filter(Boolean).sort(); }
  function planWhen(p) {
    var h = habitOf(p); if (!h) return '';
    var days = !h.days || !h.days.length ? 'каждый день' : (h.days.length === 5 && h.days.indexOf(5) < 0 && h.days.indexOf(6) < 0) ? 'по будням' : h.days.slice().sort().map(function (i) { return WD[i]; }).join(', ');
    return timesOf(h).join(' · ') + ' · ' + days + (p.end_day ? ' · до ' + fmtDM(p.end_day) : '') + (h.paused ? ' · на паузе' : '') + (isOver(p) ? ' · курс завершён' : '');
  }
  function intakeView() {
    var h = '', tp = todayPlans(), t = T();
    var rows = tp.map(function (x) {
      var c = markCount(x.h, t), n = tgt(x.h), tm = timesOf(x.h), it = cabById(x.p.item_id);
      var slots = tm.map(function (s, i) { return '<span class="wslot' + (c > i ? ' on' : '') + '">' + (c > i ? '✓ ' : '') + s + '</span>'; }).join('');
      return '<div class="task hrow"><div class="hlead"><span class="hdot">' + I('pill') + '</span></div><div class="tb"><span class="tt">' + esc(x.p.title) + '</span><span class="meta"><span class="tm">' + r1(x.p.units) + ' ' + esc(unitOf(it)) + ' за раз</span><span>принято ' + c + ' из ' + n + '</span></span><span class="wslots">' + slots + '</span></div>' +
        (c > 0 ? '<button class="iconbtn" data-a="wUntake" data-id="' + x.p.id + '" aria-label="Отменить отметку">' + I('left') + '</button>' : '') +
        (c < n ? '<button class="btn2 wtake" data-a="wTake" data-id="' + x.p.id + '">' + I('check') + 'Принял(а)</button>' : '<span class="badge">всё принято</span>') + '</div>';
    }).join('');
    h += '<div style="margin-top:16px">' + section('Сегодня', rows || '<div class="muted" style="line-height:1.5">На сегодня приёмов по расписанию нет. Можно создать расписание или записать приём вручную.</div>') + '</div>';
    h += '<div class="row2" style="margin-top:12px"><button class="btn2" data-a="wIntakeNew">' + I('plus') + 'Записать приём</button><button class="btn2" data-a="wPlanNew" data-v="med">' + I('bell') + 'Расписание</button></div>';
    var plans = W.plans.filter(function (p) { return p.kind === 'med'; });
    if (plans.length) h += '<div class="dday">Расписания</div>' + plans.map(function (p) {
      return '<div class="task hrow' + (isOver(p) ? ' plan' : '') + '"><div class="hlead"><span class="hdot">' + I('bell') + '</span></div><button class="tb" data-a="wPlanOpen" data-id="' + p.id + '"><span class="tt">' + esc(p.title) + '</span><span class="meta"><span>' + esc(planWhen(p)) + '</span></span></button></div>';
    }).join('');
    h += historyView();
    return h + disclaimer();
  }
  function historyView() {
    var byDay = {}, from = addDays(T(), -13);
    W.intakes.forEach(function (i) { if (i.day >= from) (byDay[i.day] = byDay[i.day] || []).push({ at: hm(i.at), t: i.name + ' ×' + r1(i.units), id: i.id }); });
    W.plans.forEach(function (p) {
      var hb = habitOf(p); if (!hb || p.kind !== 'med') return;
      var m = X.D.marks[hb.id] || {};
      Object.keys(m).forEach(function (day) { if (day >= from && m[day] > 0) (byDay[day] = byDay[day] || []).push({ at: '', t: p.title + ': принято ' + m[day] + ' из ' + tgt(hb) }); });
    });
    var days = Object.keys(byDay).sort().reverse();
    if (!days.length) return '';
    var h = '<div class="dday">История за 2 недели</div>';
    days.forEach(function (d) {
      h += '<div class="hdate">' + esc(dayWord(d)) + '</div>';
      byDay[d].sort(function (a, b) { return a.at < b.at ? 1 : -1; }).forEach(function (x) {
        h += '<div class="drow">' + (x.id ? '<button class="tb" style="flex:1;flex-direction:row;align-items:center;gap:10px" data-a="wIntakeOpen" data-id="' + x.id + '">' : '<div style="flex:1;display:flex;gap:10px;align-items:center">') + '<span class="b">' + I('check') + '</span>' + esc(x.t) + '<span class="at">' + esc(x.at) + '</span>' + (x.id ? '</button>' : '</div>') + '</div>';
      });
    });
    return h;
  }

  /* ---------- Аптечка ---------- */
  function expiryInfo(c) {
    if (!c.expires) return '';
    var left = diff(c.expires, T());
    if (left < 0) return '<span class="over">просрочено</span>';
    if (left <= 30) return '<span class="over">годен до ' + fmtDM(c.expires) + '</span>';
    return '<span>до ' + fmtDM(c.expires) + '</span>';
  }
  function cabView() {
    var kind = WUI.cab, items = W.cabinet.filter(function (c) { return c.kind === kind; });
    var h = '<div class="chipsrow"><button class="fchip' + (kind === 'med' ? ' on' : '') + '" data-a="wCabKind" data-v="med">' + I('pill') + 'Лекарства (' + W.cabinet.filter(function (c) { return c.kind === 'med'; }).length + ')</button><button class="fchip' + (kind === 'supp' ? ' on' : '') + '" data-a="wCabKind" data-v="supp">' + I('leaf') + 'БАДы и витамины (' + W.cabinet.filter(function (c) { return c.kind === 'supp'; }).length + ')</button></div>';
    h += '<div style="display:flex;flex-direction:column;gap:18px;margin-top:6px">';
    h += section('Что подойдёт?', '<div class="muted" style="font-size:13px;line-height:1.45;margin-bottom:8px">Помощник посмотрит вашу аптечку и подскажет, что из неё обычно применяют при этих жалобах. Это справка, не замена врача.</div><div class="chips">' +
      SYMPTOMS.map(function (s) { return '<button class="chip" data-a="wAsk" data-v="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<form class="hadd-form" style="margin-top:10px" autocomplete="off"><input class="fld" id="w-sym" placeholder="Опишите, что беспокоит" aria-label="Симптомы"><button class="btn" type="submit" data-a="wAskText" aria-label="Спросить помощника">' + I('send') + '</button></form>');
    h += '<form class="hadd-form" style="margin:0" autocomplete="off"><input class="fld" id="wc-name" placeholder="' + (kind === 'med' ? 'Лекарство' : 'БАД или витамин') + '" aria-label="Название"><input class="fld hq" id="wc-qty" inputmode="decimal" placeholder="Кол-во" aria-label="Количество"><select class="fld hu" id="wc-unit" aria-label="Единица">' + UNITS.map(function (u) { return '<option>' + u + '</option>'; }).join('') + '</select><button class="btn" type="submit" data-a="wCabAdd" aria-label="Добавить">' + I('plus') + '</button></form>';
    h += '</div>';
    h += '<button class="btn2" style="width:100%;margin-top:10px" data-a="wItemNew" data-v="photo">' + CAM + 'Добавить по фото упаковки</button>';
    if (!items.length) return h + '<div class="empty">' + (kind === 'med' ? 'Аптечка пуста. Добавьте лекарства, которые у вас есть, и помощник сможет подсказывать, что из них подойдёт.' : 'Здесь пока нет БАДов и витаминов. По фото упаковки состав считается сам, и он попадёт в расчёт нутриентов.') + '</div>' + disclaimer();
    h += '<div style="margin-top:8px">' + items.slice().sort(function (a, b) { return (a.expires || '9999') < (b.expires || '9999') ? -1 : 1; }).map(function (c) {
      return '<div class="task hrow"><div class="hlead"><span class="hdot">' + I(c.kind === 'supp' ? 'leaf' : 'pill') + '</span></div><button class="tb" data-a="wItemOpen" data-id="' + c.id + '"><span class="tt">' + esc(c.name) + (c.dosage ? ' <small class="muted">' + esc(c.dosage) + '</small>' : '') + '</span><span class="meta">' +
        (c.form ? '<span>' + esc(c.form) + '</span>' : '') + (c.qty != null ? '<span class="tm">' + r1(c.qty) + ' ' + esc(c.unit) + '</span>' : '') + expiryInfo(c) + (c.purpose ? '<span>' + esc(c.purpose.slice(0, 60)) + '</span>' : '') + '</span></button>' +
        '<button class="iconbtn" data-a="wTakeNow" data-id="' + c.id + '" aria-label="Принял(а) сейчас">' + I('check') + '</button></div>';
    }).join('') + '</div>';
    return h + disclaimer();
  }

  /* ---------- Нутриенты ---------- */
  function nutView() {
    var d = nutrition(+WUI.period), S = X.SET, h = '';
    h += '<div class="chipsrow">' + [['1', 'Сегодня'], ['7', '7 дней'], ['30', '30 дней']].map(function (p) { return '<button class="fchip' + (WUI.period === p[0] ? ' on' : '') + '" data-a="wPeriod" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="muted" style="font-size:13px;margin-top:10px;line-height:1.5">Нормы для: ' + (S.hSex === 'f' ? 'женщины' : S.hSex === 'm' ? 'мужчины' : 'мужчины (пол не указан)') + ', ' + (S.hAge ? S.hAge + ' лет' : '30 лет по умолчанию') + ' · <button class="link" data-a="wProf">изменить</button><br>Еда: среднее за день по дням, где есть записи' + (d.days > 1 ? ' (' + d.nd + ' из ' + d.days + ')' : '') + '. Добавки и лекарства: среднее за весь период.</div>';
    var kg = num(S.kcalGoal), pg = num(S.proteinGoal), fg = num(S.fatGoal), cg = num(S.carbsGoal);
    var mb = function (l, v, g) { return '<div class="hmc"><div class="hmn"><span>' + l + '</span><b>' + Math.round(v) + (g ? ' / ' + Math.round(g) : '') + ' ' + (l === 'Калории' ? 'ккал' : 'г') + '</b></div>' + (g ? '<div class="hbar"><i style="width:' + Math.min(100, Math.round(v / g * 100)) + '%' + (v > g * 1.05 ? ';background:var(--warn)' : '') + '"></i></div>' : '') + '</div>'; };
    h += '<div class="hsum"><div class="hmacros" style="grid-template-columns:repeat(2,1fr);margin-top:0">' + mb('Калории', d.mac.kcal, kg) + mb('Белки', d.mac.p, pg) + mb('Жиры', d.mac.f, fg) + mb('Углеводы', d.mac.c, cg) + '</div></div>';
    if (d.noM.length) h += '<div class="hnote" style="margin-top:12px">У ' + d.noM.length + ' из ' + d.nMeals + ' приёмов пищи нет оценки витаминов и минералов, поэтому в расчёт они не вошли. ' + (d.noM.length <= 40 ? '<button class="link" data-a="wMicroAll">Оценить сейчас (' + d.noM.length + ' ' + plural(d.noM.length, 'запрос', 'запроса', 'запросов') + ' к ИИ)</button>' : 'Оцените их по одному в карточке приёма пищи.') + '</div>';
    if (!d.nMeals && !Object.keys(suppIntake(addDays(T(), -(d.days - 1)), T())).length) h += '<div class="empty">Пока нет данных за период. Записывайте питание и принимайте добавки в приложении, и здесь появится картина по витаминам и минералам.</div>';
    ['Основное', 'Минералы', 'Витамины'].forEach(function (g) {
      h += '<div class="dday">' + g + '</div>';
      d.rows.filter(function (r) { return r.n.g === g; }).forEach(function (r) {
        var st = ST[r.st], pct = r.n.limit != null ? r.tot / r.n.limit : (r.norm ? r.tot / r.norm : 0);
        h += '<div class="wn"><div class="hmn"><span>' + esc(r.n.n) + '</span><b>' + (r.has ? fmtN(r.tot) : '—') + ' / ' + (r.n.limit != null ? 'до ' + r.n.limit : fmtN(r.norm)) + ' ' + r.n.u + '</b></div><div class="hbar"><i style="width:' + Math.min(100, Math.round(pct * 100)) + '%;background:' + (r.has ? st[1] : 'var(--faint)') + '"></i></div>' +
          '<div class="wsub"><span style="color:' + (r.has ? st[1] : 'var(--muted)') + '">' + (r.has ? st[0] : 'нет данных') + '</span>' + (r.s > 0 ? '<span>еда ' + fmtN(r.f) + ' + добавки ' + fmtN(r.s) + '</span>' : '') + '</div></div>';
      });
    });
    h += '<div class="row2" style="margin-top:16px"><button class="btn" data-a="asHealth">' + I('spark') + 'Общий разбор здоровья</button></div>';
    h += '<div class="wdisc">Нормы: общие ориентиры для взрослых. Оценка витаминов и минералов в еде приблизительная, она не заменяет анализы. Добавки и лекарства принимайте по инструкции и согласуйте с врачом, особенно при хронических болезнях и беременности.</div>';
    return h;
  }
  async function microAll() {
    var d = nutrition(+WUI.period), list = d.noM.filter(function (m) { return (m.title || '').trim(); });
    if (!list.length || WUI._mb) return;
    WUI._mb = true; var ok = 0;
    for (var i = 0; i < list.length; i++) {
      toast('Оцениваю витамины и минералы: ' + (i + 1) + ' из ' + list.length);
      try {
        var m = list[i], r = await callAI({ mode: 'micro', title: m.title, grams: m.grams, kcal: m.kcal, protein: m.protein, fat: m.fat, carbs: m.carbs });
        var mi = U.cleanMicros(r.micros);
        if (mi) { await U.updateMealMicros(m.id, mi); ok++; }
      } catch (e) { err(e); break; }
    }
    WUI._mb = false; render(); toast('Оценено приёмов пищи: ' + ok);
  }

  /* ---------- Анализы ---------- */
  function nk(name) { return String(name || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ''); }
  function flagOf(it) {
    var v = num(it.value), lo = num(it.low), hi = num(it.high);
    if (v == null || (lo == null && hi == null)) return it.flag || 'unknown';
    if (lo != null && v < lo) return 'low'; if (hi != null && v > hi) return 'high'; return 'normal';
  }
  var FL = { low: ['ниже', 'hsl(18,72%,46%)'], high: ['выше', 'hsl(0,68%,48%)'], normal: ['норма', 'var(--ok)'], unknown: ['—', 'var(--muted)'] };
  function refText(it) { return it.low != null || it.high != null ? (it.low != null ? r1(it.low) : '') + '–' + (it.high != null ? r1(it.high) : '') : ''; }
  function labsView() {
    var labs = W.labs.slice().sort(function (a, b) { return a.day < b.day ? 1 : -1; });
    if (!labs.length) return '<div class="empty">Анализов пока нет. Нажмите «Анализы»: можно сфотографировать бланк или загрузить PDF, показатели считаются сами. Они попадут в общий разбор здоровья.</div>' + disclaimer();
    var h = '', ind = {};
    labs.slice().reverse().forEach(function (l) {
      (l.items || []).forEach(function (it) {
        var k = nk(it.name); if (!k) return;
        var r = ind[k] = ind[k] || { name: it.name, pts: [] };
        r.pts.push({ day: l.day, it: it });
      });
    });
    var keys = Object.keys(ind).sort(function (a, b) {
      var fa = flagOf(ind[a].pts[ind[a].pts.length - 1].it), fb = flagOf(ind[b].pts[ind[b].pts.length - 1].it), wa = fa === 'low' || fa === 'high' ? 0 : 1, wb = fb === 'low' || fb === 'high' ? 0 : 1;
      return wa !== wb ? wa - wb : ind[a].name < ind[b].name ? -1 : 1;
    });
    h += '<div class="row2" style="margin-top:14px"><button class="btn" data-a="asHealth">' + I('spark') + 'Общий разбор здоровья</button></div>';
    h += '<div class="dday">Показатели</div>';
    keys.slice(0, 80).forEach(function (k) {
      var r = ind[k], last = r.pts[r.pts.length - 1].it, prev = r.pts.length > 1 ? r.pts[r.pts.length - 2].it : null, fl = flagOf(last), f = FL[fl];
      var ch = '';
      if (prev && num(last.value) != null && num(prev.value) != null) { var dl = num(last.value) - num(prev.value); ch = '<span>' + (dl > 0 ? '▲ +' : dl < 0 ? '▼ ' : '') + r1(dl) + ' к прошлому</span>'; }
      h += '<div class="task hrow"><div class="hlead"><span class="wdot" style="background:' + f[1] + '"></span></div><button class="tb" data-a="wTrendOpen" data-v="' + esc(k) + '"><span class="tt">' + esc(r.name) + '</span><span class="meta"><span class="tm">' + esc(last.value != null ? r1(last.value) : (last.text || '—')) + ' ' + esc(last.unit || '') + '</span><span style="color:' + f[1] + '">' + f[0] + (refText(last) ? ' · норма ' + esc(refText(last)) : '') + '</span>' + ch + '</span></button></div>';
    });
    h += '<div class="dday">Бланки</div>' + labs.map(function (l) {
      var its = l.items || [], bad = its.filter(function (x) { var f = flagOf(x); return f === 'low' || f === 'high'; }).length;
      return '<div class="task hrow"><div class="hlead"><span class="hdot">' + I('note') + '</span></div><button class="tb" data-a="wLabOpen" data-id="' + l.id + '"><span class="tt">' + esc(l.title || 'Анализы') + '</span><span class="meta"><span>' + esc(dayWord(l.day)) + '</span><span>' + its.length + ' ' + plural(its.length, 'показатель', 'показателя', 'показателей') + '</span>' + (bad ? '<span class="over">вне нормы: ' + bad + '</span>' : '') + (l.lab ? '<span>' + esc(l.lab) + '</span>' : '') + '</span></button></div>';
    }).join('');
    return h + disclaimer();
  }

  /* =================== ОКНА =================== */
  function sheet(s) {
    switch (s.type) {
      case 'w-item': return { title: s.id ? (s.kind === 'supp' ? 'БАД или витамин' : 'Лекарство') : 'Новая позиция', body: itemSheet(s), foot: '<button class="btn" data-a="wItemSave">Сохранить</button>' + (s.id ? '<div class="row2"><button class="btn2" data-a="wTakeNow" data-id="' + s.id + '">Принял(а) сейчас</button><button class="btn2" data-a="wPlanFromItem">Расписание</button></div><button class="btn2" data-a="wItemAsk">Спросить помощника про препарат</button><button class="btn2 warn" data-a="wItemDel">Удалить</button>' : '') };
      case 'w-intake': return { title: s.id ? 'Приём' : 'Записать приём', body: intakeSheet(s), foot: '<button class="btn" data-a="wIntakeSave">Сохранить</button>' + (s.id ? '<button class="btn2 warn" data-a="wIntakeDel">Удалить</button>' : '') };
      case 'w-plan': return { title: s.id ? (s.pk === 'nudge' ? 'Напоминание поддержки' : 'Расписание') : (s.pk === 'med' ? 'Новое расписание приёма' : s.pk === 'meal' ? 'Напоминание о еде' : s.pk === 'nudge' ? 'Новая поддержка' : 'Напоминание о тренировке'), body: planSheet(s), foot: '<button class="btn" data-a="wPlanSave">Сохранить</button>' + (s.id ? '<button class="btn2 warn" data-a="wPlanDel">Удалить</button>' : '') };
      case 'w-plans': return { title: s.pk === 'meal' ? 'Напоминания о еде' : 'Напоминания о тренировках', body: plansSheet(s), foot: '<button class="btn" data-a="wPlanNew" data-v="' + s.pk + '">' + I('plus') + 'Добавить напоминание</button>' };
      case 'w-sos': return { title: 'SOS: мне тяжело держаться', body: sosSheet(s), foot: '' };
      case 'w-lab': return { title: s.id ? 'Анализы' : 'Новые анализы', body: labSheet(s), foot: '<button class="btn" data-a="wLabSave">Сохранить</button>' + (s.id ? '<button class="btn2 warn" data-a="wLabDel">Удалить</button>' : '') };
      case 'w-trend': return { title: (trendData(s.key) || {}).name || 'Показатель', body: trendSheet(s), foot: '' };
      case 'w-prof': return { title: 'Профиль для норм', body: '<div class="muted" style="line-height:1.5">Нормы витаминов и минералов зависят от пола и возраста. Данные остаются в вашем аккаунте.</div>' + section('Пол', chipSet('sex', [['m', 'Мужской'], ['f', 'Женский']], s.sex)) + numField('age', 'Возраст, лет', s.age), foot: '<button class="btn" data-a="wProfSave">Сохранить</button>' };
    }
    return { title: '', body: '' };
  }

  /* --- позиция в аптечке --- */
  function itemSheet(s) {
    var h = section('Тип', chipSet('kind', [['med', 'Лекарство'], ['supp', 'БАД / витамин']], s.kind));
    h += section('Фото упаковки', photoBlock(s));
    if ((s.photos || []).length) h += '<button type="button" class="btn2" style="width:100%" data-a="wPackGo"' + (s._busy ? ' disabled' : '') + '>' + I('spark') + (s._busy ? 'Читаю упаковку…' : 'Считать с упаковки') + '</button>';
    if (s._err) h += '<div class="herr">' + esc(s._err) + '</div>';
    if (s._note) h += '<div class="hnote">' + esc(s._note) + '</div>';
    h += field('name', 'Название', s.name, 'autocomplete="off"');
    h += '<div class="row2">' + field('form', 'Форма', s.form, 'placeholder="таблетки, капли…" autocomplete="off"') + field('dosage', 'Дозировка', s.dosage, 'placeholder="500 мг" autocomplete="off"') + '</div>';
    h += field('active', 'Действующее вещество', s.active, 'autocomplete="off"');
    h += field('purpose', 'Для чего применяют', s.purpose, 'placeholder="Справка, не назначение" autocomplete="off"');
    h += '<div class="row2">' + numField('qty', 'Осталось', s.qty) + '<label><div class="gl">Единица</div><select class="fld" data-f="unit">' + UNITS.concat(UNITS.indexOf(s.unit) < 0 && s.unit ? [s.unit] : []).map(function (u) { return '<option' + (u === s.unit ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '</select></label></div>';
    h += '<label><div class="gl">Годен до</div><input class="fld" type="date" data-f="expires" value="' + esc(s.expires || '') + '"></label>';
    h += field('instructions', 'Как принимать (с упаковки)', s.instructions, 'autocomplete="off"');
    h += section('Состав одной ' + (s.unit === 'мл' ? 'мл' : 'единицы') + ' (для расчёта витаминов)',
      ((s.nutrients || []).length ? '<div class="chips">' + s.nutrients.map(function (n, i) { var m = nutMeta(n.key); return '<button type="button" class="chip on" data-a="wNutDel" data-v="' + i + '" aria-label="Убрать">' + esc(m.n) + ' ' + fmtN(n.amount) + ' ' + esc(m.u) + I('x') + '</button>'; }).join('') + '</div>' : '<div class="muted" style="font-size:13px;line-height:1.45">Нужен для витаминов и БАД: что и сколько в одной таблетке. Считывается с упаковки или добавляется вручную.</div>') +
      '<div class="row2" style="margin-top:10px"><label><div class="gl">Вещество</div><select class="fld" data-f="nk">' + NUT.map(function (n) { return '<option value="' + n.k + '"' + (s.nk === n.k ? ' selected' : '') + '>' + esc(n.n) + ', ' + n.u + '</option>'; }).join('') + '</select></label>' + numField('na', 'Количество', s.na) + '</div><button type="button" class="btn2" style="margin-top:8px;width:100%" data-a="wNutAdd">' + I('plus') + 'Добавить вещество</button>');
    h += field('note', 'Заметка', s.note, 'autocomplete="off"');
    return h;
  }
  function itemOpen(c, preset) {
    var base = { type: 'w-item', id: null, kind: WUI.cab, name: '', form: '', dosage: '', active: '', purpose: '', qty: '', unit: 'таб.', expires: '', instructions: '', note: '', photos: [], nutrients: [], nk: NUT[0].k, na: '', _rm: [] };
    if (c) base = Object.assign(base, { id: c.id, kind: c.kind, name: c.name, form: c.form, dosage: c.dosage, active: c.active, purpose: c.purpose, qty: r1(c.qty), unit: c.unit || '', expires: c.expires || '', instructions: c.instructions || '', note: c.note || '', photos: (c.photos || []).slice(), nutrients: JSON.parse(JSON.stringify(c.nutrients || [])), ai: c.ai });
    if (preset) Object.assign(base, preset);
    UI.sheet = base; renderSheet(true);
  }
  function itemRow(s) {
    return { owner: X.ME, kind: s.kind, name: (s.name || '').trim(), form: s.form || '', dosage: s.dosage || '', active: s.active || '', purpose: s.purpose || '', qty: num(s.qty), unit: s.unit || '', expires: s.expires || null, nutrients: s.nutrients || [], instructions: s.instructions || '', note: s.note || '', photos: s.photos || [], ai: s.ai || null };
  }
  async function saveItem(btn) {
    var s = UI.sheet; if (!s) return;
    if (!(s.name || '').trim()) { toast('Напишите название'); return; }
    if (btn) btn.disabled = true;
    try {
      var row = itemRow(s);
      var saved = s.id ? await q(sb.from('cabinet').update(row).eq('id', s.id).select().single()) : await q(sb.from('cabinet').insert(row).select().single());
      var i = W.cabinet.findIndex(function (x) { return x.id === saved.id; });
      if (i >= 0) W.cabinet[i] = saved; else W.cabinet.push(saved);
      W.cabinet.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      if (s._rm && s._rm.length) sb.storage.from(BUCKET).remove(s._rm);
      WUI.cab = saved.kind; closeSheet(); render(); toast('Сохранено');
    } catch (e) { if (btn) btn.disabled = false; err(e); }
  }
  async function packGo() {
    var s = UI.sheet; if (!s || s._busy) return;
    if (!s.photos.length) { toast('Сначала добавьте фото'); return; }
    s._busy = true; s._err = ''; renderSheet();
    try {
      var images = [];
      for (var i = 0; i < s.photos.length; i++) images.push({ media_type: 'image/jpeg', data: await blobB64(await photoBlob(s.photos[i])) });
      var r = await callAI({ mode: 'pack', images: images });
      if (UI.sheet !== s) return;
      var items = r.items || [];
      if (!items.length) { s._err = 'Не удалось прочитать упаковку. ' + (r.notes || 'Сфотографируйте её ближе и ровнее.'); }
      else {
        fillItem(s, items[0]);
        s._note = (r.notes ? r.notes + ' ' : '') + 'Проверьте данные: ИИ может ошибаться.';
        var extra = items.slice(1);
        for (var k = 0; k < extra.length; k++) {
          var tmp = {};
          fillItem(tmp, extra[k]);
          await addCabinetRow(Object.assign({ kind: 'med', unit: 'таб.' }, tmp, { photos: s.photos.slice() }));
        }
        if (extra.length) toast('На фото ещё ' + extra.length + ': добавлены в аптечку отдельно');
      }
    } catch (e) { s._err = e.message || 'Не получилось'; }
    s._busy = false; if (UI.sheet === s) renderSheet();
  }
  function fillItem(s, it) {
    s.kind = it.kind === 'supp' ? 'supp' : 'med'; s.name = it.name || s.name || ''; s.form = it.form || ''; s.dosage = it.dosage || ''; s.active = it.active || ''; s.purpose = it.purpose || '';
    s.qty = it.units_in_pack != null ? r1(it.units_in_pack) : (s.qty || ''); s.unit = it.unit || s.unit || 'таб.'; s.expires = it.expires || s.expires || ''; s.instructions = it.instructions || '';
    s.nutrients = (it.nutrients || []).filter(function (n) { return NUTBY[n.key] && +n.amount > 0; }).map(function (n) { return { key: n.key, amount: +n.amount }; });
    if (it.warnings) s.note = (s.note ? s.note + '\n' : '') + 'С упаковки: ' + it.warnings;
    s.ai = Object.assign({}, s.ai || {}, { pack: { name: it.name } });
  }
  async function addCabinetRow(s) {
    var row = itemRow(Object.assign({ kind: 'med' }, s));
    var saved = await q(sb.from('cabinet').insert(row).select().single());
    W.cabinet.push(saved); W.cabinet.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return saved;
  }
  async function adjustStock(item, delta) {
    if (!item || item.qty == null) return;
    var nq = Math.max(0, +item.qty + delta);
    try { await q(sb.from('cabinet').update({ qty: nq }).eq('id', item.id)); item.qty = nq; } catch (e) { err(e); }
  }

  /* --- разовый приём --- */
  function intakeSheet(s) {
    var items = W.cabinet.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var h = '';
    if (items.length) h += section('Что приняли', '<div class="chips">' + items.slice(0, 24).map(function (c) { return '<button type="button" class="chip' + (s.item_id === c.id ? ' on' : '') + '" data-a="wIntItem" data-v="' + c.id + '">' + I(c.kind === 'supp' ? 'leaf' : 'pill') + esc(c.name) + '</button>'; }).join('') + '</div>');
    h += field('name', items.length ? 'Или другое' : 'Что приняли', s.name, 'autocomplete="off" placeholder="Например, парацетамол"');
    h += '<div class="row2">' + numField('units', 'Сколько (шт., доз)', s.units) + '<label><div class="gl">Время</div><input class="fld" type="time" data-f="at" value="' + esc(s.at || '') + '"></label></div>';
    h += '<label><div class="gl">Дата</div><input class="fld" type="date" data-f="day" value="' + esc(s.day) + '"></label>';
    h += field('note', 'Заметка', s.note, 'autocomplete="off"');
    return h;
  }
  function intakeOpen(rec, preset) {
    var base = { type: 'w-intake', id: null, item_id: null, name: '', units: '1', day: T(), at: nowHM(), note: '' };
    if (rec) base = Object.assign(base, { id: rec.id, item_id: rec.item_id, name: rec.name, units: r1(rec.units), day: rec.day, at: hm(rec.at), note: rec.note || '' });
    if (preset) Object.assign(base, preset);
    UI.sheet = base; renderSheet(true);
  }
  async function saveIntake(btn) {
    var s = UI.sheet; if (!s) return;
    var name = (s.name || '').trim();
    if (!name) { toast('Выберите или напишите, что приняли'); return; }
    if (btn) btn.disabled = true;
    var units = num(s.units) > 0 ? num(s.units) : 1;
    try {
      var row = { owner: X.ME, item_id: s.item_id || null, name: name, day: s.day || T(), at: s.at || null, units: units, note: s.note || '' };
      var saved = s.id ? await q(sb.from('intakes').update(row).eq('id', s.id).select().single()) : await q(sb.from('intakes').insert(row).select().single());
      var i = W.intakes.findIndex(function (x) { return x.id === saved.id; });
      if (i >= 0) W.intakes[i] = saved; else W.intakes.push(saved);
      W.intakes.sort(function (a, b) { return a.day < b.day ? 1 : -1; });
      if (!s.id) await adjustStock(cabById(saved.item_id), -units);
      closeSheet(); render(); toast('Записано');
    } catch (e) { if (btn) btn.disabled = false; err(e); }
  }

  /* --- расписания (привычки + смысл) --- */
  var KICON = { med: 'pill', meal: 'coffee', workout: 'dumb', nudge: 'star' }, KCOLOR = { med: 3, meal: 1, workout: 2, nudge: 4 };
  /* --- поддержка: заготовки на типичные трудные моменты (фразы можно править и дополнять ИИ) --- */
  var TOPICS = [['food', 'Еда'], ['fit', 'Тренировки'], ['tasks', 'Дела и лень'], ['sleep', 'Сон'], ['other', 'Другое']];
  var PRESETS = {
    food: [
      { n: 'Хочется есть до обеда', title: 'Дотерпи до обеда', at: '11:00', msgs: ['Тяга к еде приходит волной и обычно проходит за 10 минут. Выпей воды и подожди.', 'Ты уже рассчитал(а) свой обед. Он скоро, не меняй его на случайный перекус.', 'Если очень хочется есть, сначала стакан воды или белковый перекус по плану. Потом решай.', 'Ты начинал(а) это ради цели. Один спокойный час сейчас дороже случайного перекуса.', 'Голод и скука похожи. Займи руки на 10 минут, а потом проверь, правда ли хочешь есть.', 'Ты уже держался(ась) столько часов. Дотяни до плана, и вечером будет чем гордиться.', 'Не нужно идеально. Нужно просто не брать первое, что попалось. Подожди 10 минут.'] },
      { n: 'Лень готовить', title: 'Приготовь по плану', at: '17:30', msgs: ['Начни с самого малого: достань продукты на 2 минуты. Дальше проще.', 'Готовка по плану занимает меньше времени, чем ты думаешь. Включи музыку и начни.', 'Лень это нормально. Решение принимает действие: поставь воду или разогрей сковороду.', 'Если сегодня нет сил, возьми самый простой вариант из твоего плана, а не фастфуд.', 'Один пропущенный день не ломает неделю. Но сегодняшний ужин по плану её укрепит.', 'Через час ты скажешь себе спасибо за приготовленную еду. Сделай это для себя.', 'Правило двух минут: начни и разрешай себе остановиться. Обычно останавливаться не хочется.'] },
      { n: 'Вечерняя тяга к сладкому', title: 'Сладкое подождёт', at: '20:30', msgs: ['Вечерняя тяга чаще про усталость, чем про голод. Чай, вода или душ подождут 10 минут.', 'Если хочется сладкого, выбери порцию в тарелку, а не из пачки. Так ты решаешь сам(а).', 'Ты хорошо шёл(шла) весь день. Не отдавай вечер случайному перекусу.', 'Подожди 10 минут и спроси себя: я голоден(на) или просто устал(а)?', 'Один съеденный кусок это не срыв. Срыв это решить, что день потерян. Продолжай по плану.', 'Что-нибудь из плана по белку и тёплый чай часто снимают тягу.', 'Завтра утром тебе понравится, что ты удержался(ась) сегодня.'] },
      { n: 'После срыва', title: 'Срыв не конец', at: '09:00', msgs: ['Вчера было, сегодня новый день. Главное не пропустить дважды: следующий приём пищи по плану.', 'Один срыв не ломает неделю. Не наказывай себя, просто вернись к плану на ближайшем приёме.', 'Без самокритики: что подтолкнуло вчера? Подготовь на сегодня маленькое решение для этого момента.', 'Режим держится на возвращении, а не на безупречности. Возвращайся прямо сейчас.', 'Не нужно «отрабатывать» и голодать. Просто обычный завтрак по плану.', 'Ты уже знаешь, как это работает. Один хороший приём пищи, и ты снова в потоке.', 'Хороший день начинается с первого шага по плану. Сделай его.'] }
    ],
    fit: [
      { n: 'Лень на тренировку', title: 'Тренировка сегодня', at: '17:30', msgs: ['Надень форму и дойди до зала. Остальное решишь уже там. Обычно начинать сложнее всего.', 'Даже короткая тренировка лучше пропуска. Разрешаю себе только разминку.', 'Ты не обязан(а) быть в форме, чтобы начать. Достаточно начать, чтобы быть в форме.', 'Через час ты будешь рад(а), что сходил(а). Запомни это чувство.', 'Пропуск одной тренировки не страшен, но не пропускай дважды подряд.', 'Сделай хотя бы первое упражнение. Дальше пойдёт.', 'Твои веса растут только от тех тренировок, на которые ты вышел(ла) через «не хочу».'] }
    ],
    tasks: [
      { n: 'Не могу начать дела', title: 'Маленький шаг', at: '10:00', msgs: ['Выбери одну задачу и работай над ней всего 2 минуты. Потом можно остановиться.', 'Не нужно делать всё. Сделай самое неприятное дело первым, остальное станет легче.', 'Таймер на 15 минут и одно дело. Потом решишь, продолжать или нет.', 'Начало самое тяжёлое, а потом идёт само. Открой задачу прямо сейчас.', 'Идеальный момент не придёт. Сделай неидеально, но начни.', 'Разбей задачу на шаг на 5 минут и сделай только его.', 'Ты уже делал(а) такое. Вспомни, как приятно ставить галочку.'] }
    ],
    sleep: [
      { n: 'Пора ложиться', title: 'Пора готовиться ко сну', at: '22:30', msgs: ['Отложи телефон и приглушите свет. Завтра будет легче, если ляжешь сейчас.', 'Сон это тоже часть тренировки и питания. Дай телу восстановиться.', 'Ещё одна серия подождёт. Сейчас лучшая инвестиция это сон.', 'Поставь зарядку и ложись. Утром ты скажешь себе спасибо.', 'Режим держится на одинаковом времени сна. Сегодня тоже ложись вовремя.', 'Вечерний ритуал: вода, душ, свет вниз. Начни с первого шага.', 'Лучше недосмотреть, чем недоспать. Выключай экран.'] }
    ],
    other: [
      { n: 'Просто поддержка', title: 'Ты справляешься', at: '12:00', msgs: ['Ты уже на правильном пути. Следующий шаг маленький, и он по силам.', 'Не нужно идеально. Нужно регулярно. Сделай следующее, что запланировал(а).', 'Помни, зачем ты начал(а). Это стоит усилий.', 'Прогресс идёт даже в дни, когда его не видно.', 'Сделай паузу, вдохни и вернись к плану. Всё остальное подождёт.', 'Ты уже сделал(а) больше, чем кажется. Продолжай.', 'Один день не определяет результат, определяет привычка возвращаться.'] }
    ]
  };
  var TOPICN = {}; TOPICS.forEach(function (t) { TOPICN[t[0]] = t[1]; });
  var TPRE = { med: ['08:00', '13:00', '20:00', '22:00'], meal: ['08:00', '13:00', '19:00'], workout: ['07:00', '18:00', '19:00'], nudge: ['10:00', '11:00', '15:00', '17:30', '20:30', '22:30'] };
  function planSheet(s) {
    var pk = s.pk, h = '';
    if (pk === 'nudge') return nudgeSheet(s);
    if (pk === 'med') {
      var items = W.cabinet.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      if (items.length) h += section('Препарат из аптечки', '<div class="chips">' + items.slice(0, 24).map(function (c) { return '<button type="button" class="chip' + (s.item_id === c.id ? ' on' : '') + '" data-a="wPlanItem" data-v="' + c.id + '">' + esc(c.name) + '</button>'; }).join('') + '</div>');
      h += field('title', items.length ? 'Или название вручную' : 'Что принимать', s.title, 'autocomplete="off" placeholder="Например, витамин D3"');
      h += '<div class="row2">' + numField('units', 'Сколько за раз', s.units) + numField('course', 'Курс, дней (пусто — без конца)', s.course) + '</div>';
    } else if (pk === 'meal') {
      h += section('Приём пищи', '<div class="chips">' + ['Завтрак', 'Обед', 'Ужин', 'Перекус'].map(function (n) { return '<button type="button" class="chip' + (s.title === n ? ' on' : '') + '" data-a="hSet" data-v="title:' + n + '">' + n + '</button>'; }).join('') + '</div>');
      h += field('title', 'Или своё название', s.title, 'autocomplete="off" placeholder="Например, второй завтрак"');
    } else {
      h += field('title', 'Название', s.title, 'autocomplete="off" placeholder="Например, тренировка ног"');
    }
    var tms = (s.times || []).slice().sort(), pre = TPRE[pk];
    h += section('Напоминать в', '<div class="chips">' + pre.concat(tms.filter(function (x) { return pre.indexOf(x) < 0; })).sort().map(function (x) { var on = tms.indexOf(x) >= 0; return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-a="wTimeTog" data-v="' + x + '" aria-pressed="' + on + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div class="hadd-form" style="margin-top:10px"><input class="fld" type="time" data-f="t_add" value="' + esc(s.t_add || '') + '" aria-label="Своё время"><button type="button" class="btn2" data-a="wTimeAdd" style="flex:0 0 auto">' + I('plus') + 'Своё время</button></div>' +
      (pk === 'med' ? '<div class="muted" style="font-size:13px;margin-top:6px;line-height:1.45">Несколько времён = несколько приёмов в день. Нажмите «Принял(а)» в уведомлении или в разделе «Приём».</div>' : ''));
    h += section('Дни', chipSet('dmode', [['all', 'Каждый день'], ['wk', 'По будням'], ['pick', 'Выбрать']], s.dmode) +
      (s.dmode === 'pick' ? '<div class="chips" style="margin-top:8px">' + WD.map(function (d, i) { var on = s.days.indexOf(i) >= 0; return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-a="wDay" data-v="' + i + '">' + d + '</button>'; }).join('') + '</div>' : ''));
    h += section('Если не отметил(а)', chipSet('nag', [['0', 'Не повторять'], ['15', 'Через 15 мин'], ['30', 'Через 30 мин'], ['60', 'Через час']], s.nag));
    h += '<label><div class="gl">Начало</div><input class="fld" type="date" data-f="start" value="' + esc(s.start) + '"></label>';
    return h;
  }
  function nudgeSheet(s) {
    var h = section('Сфера', '<div class="chips">' + TOPICS.map(function (t) { return '<button type="button" class="chip' + (s.topic === t[0] ? ' on' : '') + '" data-a="wNudgeTopic" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>');
    h += section('Готовая заготовка', '<div class="chips">' + (PRESETS[s.topic] || []).map(function (p, i) { return '<button type="button" class="chip" data-a="wNudgePreset" data-v="' + i + '">' + esc(p.n) + '</button>'; }).join('') + '</div><div class="muted" style="font-size:13px;margin-top:6px;line-height:1.45">Заготовка подставит название, время и фразы. Всё можно изменить.</div>');
    h += field('title', 'Заголовок уведомления', s.title, 'autocomplete="off" placeholder="Например, Дотерпи до обеда"');
    h += '<label><div class="gl">Фразы (каждая с новой строки, чередуются по дням)</div><textarea class="fld" rows="6" data-f="msgs" placeholder="Тяга к еде проходит за 10 минут. Выпей воды и подожди.">' + esc(s.msgs || '') + '</textarea></label>';
    h += '<div class="row2" style="margin-top:8px"><button type="button" class="btn2" data-a="wNudgeAI"' + (s._ai ? ' disabled' : '') + '>' + I('spark') + (s._ai ? 'Придумываю…' : 'Придумать фразы с ИИ') + '</button></div>';
    if (s._err) h += '<div class="muted" style="color:var(--warn);margin-top:6px">' + esc(s._err) + '</div>';
    var tms = (s.times || []).slice().sort(), pre = TPRE.nudge;
    h += section('Напоминать в', '<div class="chips">' + pre.concat(tms.filter(function (x) { return pre.indexOf(x) < 0; })).sort().map(function (x) { var on = tms.indexOf(x) >= 0; return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-a="wTimeTog" data-v="' + x + '" aria-pressed="' + on + '">' + x + '</button>'; }).join('') + '</div>' +
      '<div class="hadd-form" style="margin-top:10px"><input class="fld" type="time" data-f="t_add" value="' + esc(s.t_add || '') + '" aria-label="Своё время"><button type="button" class="btn2" data-a="wTimeAdd" style="flex:0 0 auto">' + I('plus') + 'Своё время</button></div>');
    h += section('Дни', chipSet('dmode', [['all', 'Каждый день'], ['wk', 'По будням'], ['pick', 'Выбрать']], s.dmode) +
      (s.dmode === 'pick' ? '<div class="chips" style="margin-top:8px">' + WD.map(function (d, i) { var on = s.days.indexOf(i) >= 0; return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-a="wDay" data-v="' + i + '">' + d + '</button>'; }).join('') + '</div>' : ''));
    return h;
  }
  function planOpen(pk, p, preset) {
    var base = { type: 'w-plan', pk: pk, topic: 'food', msgs: '', id: null, item_id: null, title: pk === 'workout' ? 'Тренировка' : '', units: '1', course: '', times: [], dmode: 'all', days: [], nag: '0', start: T(), t_add: '' };
    if (p) {
      var hb = habitOf(p), ds = (hb && hb.days) || [];
      base = Object.assign(base, { id: p.id, topic: p.topic || 'food', msgs: (p.msgs || []).join('\n'), item_id: p.item_id, title: p.title, units: r1(p.units), start: p.start_day, course: p.end_day ? String(diff(p.end_day, p.start_day) + 1) : '', times: hb ? timesOf(hb) : [], dmode: !ds.length ? 'all' : (ds.length === 5 && ds.indexOf(5) < 0 && ds.indexOf(6) < 0) ? 'wk' : 'pick', days: ds.slice(), nag: String((hb && hb.remind_every) || 0) });
    }
    if (preset) Object.assign(base, preset);
    UI.sheet = base; renderSheet(true);
  }
  async function savePlan(btn) {
    var s = UI.sheet; if (!s) return;
    var title = (s.title || '').trim(), tms = (s.times || []).slice().sort();
    if (!title) { toast('Напишите название'); return; }
    if (!tms.length) { toast('Выберите хотя бы одно время'); return; }
    if (s.dmode === 'pick' && !s.days.length) { toast('Выберите хотя бы один день'); return; }
    if (btn) btn.disabled = true;
    var units = num(s.units) > 0 ? num(s.units) : 1, it = cabById(s.item_id);
    var name = s.pk === 'med' ? title + ' · ' + r1(units) + ' ' + unitOf(it) : title;
    var msgs = s.pk === 'nudge' ? String(s.msgs || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 30) : [];
    if (s.pk === 'nudge' && !msgs.length) { if (btn) btn.disabled = false; toast('Добавьте хотя бы одну фразу или возьмите заготовку'); return; }
    var days = s.dmode === 'all' ? [] : s.dmode === 'wk' ? [0, 1, 2, 3, 4] : s.days.slice().sort();
    var start = s.start || T(), course = num(s.course), end = s.pk === 'med' && course > 0 ? addDays(start, Math.round(course) - 1) : null;
    var hf = { name: name, icon: KICON[s.pk], color: COLORS[KCOLOR[s.pk]] || COLORS[0], target: tms.length, days: days, remind: tms[0], remind_at: tms.slice(1), remind_every: s.pk === 'nudge' ? 0 : (+s.nag || 0), started_on: start, paused: false, finished: !!(end && end < T()) };
    try {
      var pl;
      if (s.id) {
        pl = planById(s.id); var hb = habitOf(pl);
        if (hb) { var hr = await q(sb.from('habits').update(hf).eq('id', hb.id).select().single()); Object.assign(hb, hr); }
        var pr = await q(sb.from('h_plans').update({ title: title, units: units, item_id: s.item_id || null, start_day: start, end_day: end, msgs: msgs, topic: s.pk === 'nudge' ? s.topic : '' }).eq('id', s.id).select().single());
        Object.assign(pl, pr);
      } else {
        var hrow = await q(sb.from('habits').insert(hf).select().single());
        W.habits.push(hrow);
        var prow = await q(sb.from('h_plans').insert({ owner: X.ME, kind: s.pk, item_id: s.item_id || null, title: title, units: units, habit_id: hrow.id, start_day: start, end_day: end, msgs: msgs, topic: s.pk === 'nudge' ? s.topic : '' }).select().single());
        W.plans.push(prow);
      }
      closeSheet(); render(); toast(s.pk === 'med' ? 'Расписание сохранено, напоминания включены' : s.pk === 'nudge' ? 'Поддержка включена: напоминания придут в выбранное время' : 'Напоминание сохранено');
    } catch (e) { if (btn) btn.disabled = false; err(e); }
  }
  async function delPlan(id) {
    var p = planById(id); if (!p) return;
    try {
      var hb = habitOf(p);
      if (hb) { await q(sb.from('habits').delete().eq('id', hb.id)); W.habits = W.habits.filter(function (x) { return x.id !== hb.id; }); }
      await q(sb.from('h_plans').delete().eq('id', id));
      W.plans = W.plans.filter(function (x) { return x.id !== id; });
      closeSheet(); render(); toast('Расписание удалено');
    } catch (e) { err(e); }
  }
  function plansSheet(s) {
    var list = W.plans.filter(function (p) { return p.kind === s.pk; });
    return (s.pk === 'meal' ? '<div class="muted" style="line-height:1.5">Повторяющиеся напоминания о еде. В уведомлении есть кнопка «Отметить». Разовые приёмы пищи на конкретное время ставятся кнопкой «Добавить» → «Запланировать».</div>' : '<div class="muted" style="line-height:1.5">Повторяющиеся напоминания о тренировках по дням недели. Разовые тренировки ставятся кнопкой «Добавить» → «Запланировать».</div>') +
      (list.length ? '<div class="fields">' + list.map(function (p) { return '<button class="lrow" data-a="wPlanOpen" data-id="' + p.id + '">' + I('bell') + '<b>' + esc(p.title) + '<br><small class="muted" style="font-weight:400">' + esc(planWhen(p)) + '</small></b>' + I('right') + '</button>'; }).join('') + '</div>' : '<div class="empty">Напоминаний пока нет.</div>');
  }

  /* --- анализы --- */
  function labFiles(s) {
    var h = '<div class="hphotos">';
    (s.photos || []).forEach(function (p, i) {
      h += '<div class="hph">' + (/\.pdf$/i.test(p) ? '<div class="wpdf">' + I('note') + 'PDF</div>' : '<img data-ph="' + esc(p) + '" alt="Бланк">') + '<button type="button" data-a="hPhotoDel" data-v="' + i + '" aria-label="Убрать файл">' + I('x') + '</button></div>';
    });
    if ((s.photos || []).length < 4) {
      h += '<label class="hadd">' + CAM + '<span>' + (s._up ? 'Загрузка…' : 'Снять') + '</span><input type="file" accept="image/*" capture="environment" data-wlfile hidden></label>';
      h += '<label class="hadd">' + I('inbox') + '<span>Фото / PDF</span><input type="file" accept="image/*,application/pdf" multiple data-wlfile hidden></label>';
    }
    return h + '</div>';
  }
  async function addLabFiles(files) {
    var s = UI.sheet; if (!s || !s.photos) return;
    s._up = true; renderSheet();
    try {
      for (var i = 0; i < files.length && s.photos.length < 4; i++) {
        var f = files[i], pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name), blob, path;
        if (pdf) { if (f.size > 8 * 1024 * 1024) throw new Error('PDF больше 8 МБ. Сожмите файл или сфотографируйте страницы.'); blob = f; path = X.ME + '/' + uid() + '.pdf'; }
        else { blob = await shrink(f); path = X.ME + '/' + uid() + '.jpg'; }
        var u = await sb.storage.from(BUCKET).upload(path, blob, { contentType: pdf ? 'application/pdf' : 'image/jpeg' });
        if (u.error) throw u.error;
        BLOBS[path] = blob; s.photos.push(path);
      }
    } catch (e) { err(e); }
    s._up = false; if (UI.sheet === s) renderSheet();
  }
  function labSheet(s) {
    var h = '<div class="row2"><label><div class="gl">Дата взятия</div><input class="fld" type="date" data-f="day" value="' + esc(s.day) + '"></label>' + field('lab', 'Лаборатория', s.lab, 'autocomplete="off"') + '</div>';
    h += field('title', 'Название', s.title, 'placeholder="Например, общий анализ крови" autocomplete="off"');
    h += section('Бланк: фото или PDF', labFiles(s));
    if ((s.photos || []).length) h += '<button type="button" class="btn2" style="width:100%" data-a="wLabGo"' + (s._busy ? ' disabled' : '') + '>' + I('spark') + (s._busy ? 'Читаю бланк…' : 'Считать показатели') + '</button>';
    if (s._err) h += '<div class="herr">' + esc(s._err) + '</div>';
    if (s._note) h += '<div class="hnote">' + esc(s._note) + '</div>';
    var its = s.items || [];
    h += section('Показатели (' + its.length + ')', its.length ? '<div class="fields">' + its.map(function (it, i) {
      var f = FL[flagOf(it)];
      return '<div class="fr wlrow"><button type="button" class="wlmain" data-a="wLabItemEdit" data-v="' + i + '"><span>' + esc(it.name) + '</span><b style="font-weight:500">' + esc(it.value != null ? r1(it.value) : (it.text || '—')) + ' ' + esc(it.unit || '') + '</b><i style="color:' + f[1] + '">' + f[0] + (refText(it) ? ' · ' + esc(refText(it)) : '') + '</i></button><button type="button" class="iconbtn" data-a="wLabItemDel" data-v="' + i + '" aria-label="Убрать">' + I('x') + '</button></div>';
    }).join('') + '</div>' : '<div class="muted" style="font-size:13px">Пока пусто. Считайте с бланка или добавьте вручную ниже.</div>');
    h += section(s._edit != null ? 'Исправить показатель' : 'Добавить вручную', field('ni_name', 'Показатель', s.ni_name, 'autocomplete="off"') + '<div class="row3" style="margin-top:10px">' + field('ni_value', 'Значение', s.ni_value, 'inputmode="decimal" autocomplete="off"') + field('ni_unit', 'Единицы', s.ni_unit, 'autocomplete="off"') + field('ni_low', 'Норма от', s.ni_low, 'inputmode="decimal" autocomplete="off"') + '</div><div style="margin-top:10px">' + field('ni_high', 'Норма до', s.ni_high, 'inputmode="decimal" autocomplete="off"') + '</div><button type="button" class="btn2" style="margin-top:8px;width:100%" data-a="wLabItemAdd">' + I('plus') + (s._edit != null ? 'Сохранить показатель' : 'Добавить показатель') + '</button>');
    h += field('note', 'Заметка', s.note, 'autocomplete="off"');
    h += '<div class="wdisc">Приложение переносит значения с бланка и сравнивает их с границами нормы из бланка. Оценку результатов даёт врач.</div>';
    return h;
  }
  function labOpen(l) {
    var base = { type: 'w-lab', id: null, day: T(), title: '', lab: '', items: [], photos: [], note: '', ni_name: '', ni_value: '', ni_unit: '', ni_low: '', ni_high: '', _edit: null, _rm: [] };
    if (l) base = Object.assign(base, { id: l.id, day: l.day, title: l.title, lab: l.lab || '', items: JSON.parse(JSON.stringify(l.items || [])), photos: (l.photos || []).slice(), note: l.note || '', ai: l.ai });
    UI.sheet = base; renderSheet(true);
  }
  async function labGo() {
    var s = UI.sheet; if (!s || s._busy) return;
    if (!s.photos.length) { toast('Сначала добавьте бланк'); return; }
    s._busy = true; s._err = ''; renderSheet();
    try {
      var images = [], docs = [];
      for (var i = 0; i < s.photos.length; i++) {
        var data = await blobB64(await photoBlob(s.photos[i]));
        if (/\.pdf$/i.test(s.photos[i])) docs.push({ media_type: 'application/pdf', data: data }); else images.push({ media_type: 'image/jpeg', data: data });
      }
      var r = await callAI({ mode: 'lab', images: images, docs: docs });
      if (UI.sheet !== s) return;
      var its = (r.items || []).map(function (x) { return { name: x.name, value: x.value == null ? null : +x.value, text: x.text || '', unit: x.unit || '', low: x.low == null ? null : +x.low, high: x.high == null ? null : +x.high, flag: x.flag || 'unknown' }; });
      its.forEach(function (it) { it.flag = flagOf(it); });
      if (!its.length) s._err = 'Не удалось найти показатели. ' + (r.notes || 'Попробуйте фото получше или PDF.');
      else {
        s.items = its; if (!(s.title || '').trim()) s.title = r.title || ''; if (r.day) s.day = r.day; if (!(s.lab || '').trim()) s.lab = r.lab || '';
        s._note = (r.notes ? r.notes + ' ' : '') + 'Сверьте цифры с бланком: ИИ может ошибиться при чтении.';
      }
    } catch (e) { s._err = e.message || 'Не получилось'; }
    s._busy = false; if (UI.sheet === s) renderSheet();
  }
  function labItemAdd() {
    var s = UI.sheet; if (!s) return;
    var name = (s.ni_name || '').trim(); if (!name) { toast('Напишите название показателя'); return; }
    var v = num(s.ni_value), it = { name: name, value: v, text: v == null ? (s.ni_value || '') : '', unit: s.ni_unit || '', low: num(s.ni_low), high: num(s.ni_high), flag: 'unknown' };
    it.flag = flagOf(it);
    if (s._edit != null) { s.items[s._edit] = it; s._edit = null; } else s.items.push(it);
    s.ni_name = s.ni_value = s.ni_unit = s.ni_low = s.ni_high = ''; renderSheet();
  }
  async function saveLab(btn) {
    var s = UI.sheet; if (!s) return;
    if (!(s.items || []).length && !(s.photos || []).length) { toast('Добавьте показатели или бланк'); return; }
    if (btn) btn.disabled = true;
    try {
      var row = { owner: X.ME, day: s.day || T(), title: (s.title || '').trim() || 'Анализы', lab: s.lab || '', items: s.items || [], note: s.note || '', photos: s.photos || [], ai: s.ai || null };
      var saved = s.id ? await q(sb.from('labs').update(row).eq('id', s.id).select().single()) : await q(sb.from('labs').insert(row).select().single());
      var i = W.labs.findIndex(function (x) { return x.id === saved.id; });
      if (i >= 0) W.labs[i] = saved; else W.labs.push(saved);
      if (s._rm && s._rm.length) sb.storage.from(BUCKET).remove(s._rm);
      closeSheet(); render(); toast('Анализы сохранены');
    } catch (e) { if (btn) btn.disabled = false; err(e); }
  }
  function trendData(key) {
    var pts = [], name = '';
    W.labs.slice().sort(function (a, b) { return a.day < b.day ? -1 : 1; }).forEach(function (l) {
      (l.items || []).forEach(function (it) { if (nk(it.name) === key) { name = it.name; pts.push({ day: l.day, it: it }); } });
    });
    return pts.length ? { name: name, pts: pts } : null;
  }
  function lineSvg(pts, lo, hi) {
    var vals = pts.map(function (p) { return p.y; }).concat([lo, hi].filter(function (x) { return x != null; }));
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals); if (mx - mn < 1e-9) { mx += 1; mn -= 1; }
    var pad = (mx - mn) * 0.1; mn -= pad; mx += pad;
    var t0 = fromKey(pts[0].x).getTime(), t1 = fromKey(pts[pts.length - 1].x).getTime(), Wd = 300, Hh = 120, p = 10;
    var X_ = function (d) { return t1 === t0 ? Wd / 2 : p + (fromKey(d).getTime() - t0) / (t1 - t0) * (Wd - 2 * p); }, Y_ = function (v) { return p + (1 - (v - mn) / (mx - mn)) * (Hh - 2 * p); };
    var band = lo != null && hi != null ? '<rect x="0" y="' + Y_(hi).toFixed(1) + '" width="' + Wd + '" height="' + Math.max(2, Y_(lo) - Y_(hi)).toFixed(1) + '" fill="var(--ok)" opacity=".13"/>' : '';
    return '<svg viewBox="0 0 ' + Wd + ' ' + Hh + '" class="hchart" role="img" aria-label="Динамика показателя">' + band + (pts.length > 1 ? '<path d="' + pts.map(function (q2, i) { return (i ? 'L' : 'M') + X_(q2.x).toFixed(1) + ' ' + Y_(q2.y).toFixed(1); }).join('') + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' : '') + pts.map(function (q2) { return '<circle cx="' + X_(q2.x).toFixed(1) + '" cy="' + Y_(q2.y).toFixed(1) + '" r="3" fill="currentColor"/>'; }).join('') + '</svg>';
  }
  function trendSheet(s) {
    var d = trendData(s.key); if (!d) return '<div class="empty">Нет данных</div>';
    var last = d.pts[d.pts.length - 1].it, num_ = d.pts.filter(function (p) { return num(p.it.value) != null; });
    var h = '';
    if (num_.length) h += '<div class="hsum"><div class="hk"><b>' + r1(last.value) + '</b><span>' + esc(last.unit || '') + (refText(last) ? ', норма ' + esc(refText(last)) : '') + '</span></div>' + lineSvg(num_.map(function (p) { return { x: p.day, y: +p.it.value }; }), num(last.low), num(last.high)) + '<div class="muted" style="font-size:12px;margin-top:4px">Зелёная полоса — границы нормы из последнего бланка.</div></div>';
    h += '<div class="fields">' + d.pts.slice().reverse().map(function (p) { var f = FL[flagOf(p.it)]; return '<div class="fr"><span>' + esc(fmtDM(p.day)) + '</span><b style="font-weight:500;text-align:right">' + esc(p.it.value != null ? r1(p.it.value) : (p.it.text || '—')) + ' ' + esc(p.it.unit || '') + ' <i style="color:' + f[1] + ';font-style:normal">' + f[0] + '</i></b></div>'; }).join('') + '</div>';
    return h;
  }

  /* =================== ПОДДЕРЖКА (отдельный раздел, не только про еду) =================== */
  function nudgePlans() { return W.plans.filter(function (p) { return p.kind === 'nudge'; }); }
  function supportView() {
    var h = '<div class="top"><div><div class="date">' + X.fmtLong(T()) + '</div><h1 class="dh">Поддержка</h1></div><button class="btn2" data-a="wPlanNew" data-v="nudge">' + I('plus') + 'Добавить</button></div>';
    if (!W.ok) return h + (W.error ? '<div class="empty">Раздел пока не подключён к базе.<br>' + esc(W.error) + '</div>' : '<div class="empty">Загружаю…</div>');
    h += '<div class="muted" style="line-height:1.5;margin-top:8px">Короткие напоминания, которые придут в самый трудный момент: когда хочется сорваться с питания, лень готовить или тренироваться, не получается взяться за дела или лечь вовремя.</div>';
    h += '<button class="btn" style="width:100%;margin-top:14px" data-a="wSos">' + I('heart') + 'SOS: мне прямо сейчас тяжело</button>';
    var list = nudgePlans();
    if (!list.length) {
      h += '<div class="dday">Быстрый старт</div><div class="chips">' + [['food', 0], ['food', 1], ['fit', 0], ['tasks', 0], ['sleep', 0]].map(function (x) { return '<button class="chip" data-a="wNudgeQuick" data-v="' + x[0] + ':' + x[1] + '">' + esc(PRESETS[x[0]][x[1]].n) + '</button>'; }).join('') + '</div><div class="muted" style="margin-top:8px;font-size:13px;line-height:1.45">Нажмите заготовку, проверьте фразы и время, сохраните. Всё можно изменить.</div>';
    } else {
      TOPICS.forEach(function (t) {
        var ps = list.filter(function (p) { return (p.topic || 'other') === t[0] || (t[0] === 'other' && !TOPICN[p.topic]); });
        if (!ps.length) return;
        h += '<div class="dday">' + t[1] + '</div><div class="fields">' + ps.map(function (p) {
          return '<button class="lrow" data-a="wPlanOpen" data-id="' + p.id + '">' + I('bell') + '<b>' + esc(p.title) + '<br><small class="muted" style="font-weight:400">' + esc(planWhen(p)) + ' · ' + (p.msgs || []).length + ' фраз</small></b>' + I('right') + '</button>';
        }).join('') + '</div>';
      });
      h += '<div class="dday">Ещё</div><div class="chips">' + [['food', 0], ['food', 1], ['food', 2], ['food', 3], ['fit', 0], ['tasks', 0], ['sleep', 0]].map(function (x) { return '<button class="chip" data-a="wNudgeQuick" data-v="' + x[0] + ':' + x[1] + '">' + I('plus') + esc(PRESETS[x[0]][x[1]].n) + '</button>'; }).join('') + '</div>';
    }
    return h + '<div class="wdisc">Это не медицинская помощь. Если срывы случаются часто и вызывают сильную тревогу или вину, обсудите это со специалистом.</div>';
  }
  var SOS = [
    ['food', 'Тянет на вредное или лишнюю еду', ['Выпей стакан воды и поставь таймер на 10 минут: тяга приходит волной и обычно спадает.', 'Съешь то, что в плане: белковый перекус или ближайший приём пищи.', 'Если всё же ешь, положи порцию в тарелку и ешь сидя, без экрана.']],
    ['cook', 'Лень готовить', ['Сделай только первый шаг: достань продукты и поставь воду или сковороду. Это 2 минуты.', 'Выбери самый простой вариант из своего плана, а не доставку.', 'Начни и разреши себе остановиться через 5 минут. Обычно остановиться уже не хочется.']],
    ['fit', 'Лень тренироваться', ['Оденься в форму и выйди из дома. Решишь по дороге.', 'Договорись с собой на 10 минут: разминка и одно упражнение.', 'Короткая тренировка лучше пропуска. Главное не пропустить дважды подряд.']],
    ['tasks', 'Не могу взяться за дела', ['Выбери одну задачу и поставь таймер на 15 минут.', 'Разбей её на шаг на 5 минут и сделай только его.', 'Начни с самого неприятного, остальное станет легче.']],
    ['slip', 'Был срыв', ['Один срыв не ломает неделю. Не наказывай себя голодом и не «отрабатывай».', 'Следующий приём пищи по плану: возвращайся сразу, не с понедельника.', 'Запиши, что подтолкнуло, и подготовь заранее маленькое решение на этот момент.']]
  ];
  function sosSheet(s) {
    var h = '<div class="muted" style="line-height:1.5">Выберите, что сейчас происходит. Дам короткий план на ближайшие минуты.</div>' + section('Что происходит', '<div class="chips">' + SOS.map(function (x) { return '<button type="button" class="chip' + (s.sos === x[0] ? ' on' : '') + '" data-a="wSosPick" data-v="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>');
    var cur = SOS.filter(function (x) { return x[0] === s.sos; })[0];
    if (!cur) return h;
    h += '<div class="fields" style="margin-top:12px">' + cur[2].map(function (t, i) { return '<div class="fr"><b style="font-weight:600">' + (i + 1) + '</b><span style="line-height:1.45">' + esc(t) + '</span></div>'; }).join('') + '</div>';
    var tp = { food: 'food', cook: 'food', fit: 'fit', tasks: 'tasks', slip: 'food' }[cur[0]], pool = [];
    nudgePlans().forEach(function (p) { if (p.topic === tp) pool = pool.concat(p.msgs || []); });
    if (!pool.length) pool = (PRESETS[tp] || PRESETS.other)[0].msgs;
    h += '<div class="wdisc" style="font-style:normal;margin-top:12px">' + esc(pool[Math.floor(Math.random() * pool.length)]) + '</div>';
    var H = window.HEALTH && HEALTH.u, nm = null;
    if ((cur[0] === 'food' || cur[0] === 'cook' || cur[0] === 'slip') && H && H.meals) {
      try { var now = X.nowHM(); nm = H.meals().filter(function (m) { return m.day === T() && m.planned && !H.isDone(m) && (m.at || '99') >= now.slice(0, 5); }).sort(function (a, b) { return (a.at || '') < (b.at || '') ? -1 : 1; })[0]; } catch (e) { nm = null; }
    }
    if (nm) h += '<div class="muted" style="margin-top:10px;line-height:1.5">Ближайший приём по плану: <b>' + esc(nm.title) + '</b>' + (nm.at ? ' в ' + esc(String(nm.at).slice(0, 5)) : '') + (nm.kcal ? ', ' + Math.round(nm.kcal) + ' ккал' : '') + '.</div>';
    h += '<div class="row2" style="margin-top:14px"><button class="btn2" data-a="wSosTimer">' + I('clock') + 'Таймер на 10 минут</button><button class="btn2" data-a="wSosDone">Справился(ась)</button></div>';
    return h;
  }
  async function nudgeAI(btn) {
    var s = UI.sheet; if (!s || s._ai) return;
    var S = X.SET, ctx = [];
    if (+S.kcalGoal) ctx.push('Цель: ' + S.kcalGoal + ' ккал' + (+S.proteinGoal ? ', белки ' + S.proteinGoal + ' г' : '') + (+S.fatGoal ? ', жиры ' + S.fatGoal + ' г' : '') + (+S.carbsGoal ? ', углеводы ' + S.carbsGoal + ' г' : ''));
    try { var H = HEALTH.u; var pm = H.meals().filter(function (m) { return m.day === T() && m.planned; }).slice(0, 5); if (pm.length) ctx.push('Запланировано сегодня: ' + pm.map(function (m) { return (m.at ? String(m.at).slice(0, 5) + ' ' : '') + m.title; }).join('; ')); } catch (e) {}
    var trig = (s.title || '').trim() + ((s.msgs || '').trim() ? '. Примеры моих фраз: ' + String(s.msgs).split(/\r?\n/).slice(0, 3).join(' / ') : '');
    s._ai = true; s._err = ''; renderSheet();
    try {
      var r = await HEALTH.u.callAI({ mode: 'nudge', text: trig || (PRESETS[s.topic] || PRESETS.other)[0].n, topic: TOPICN[s.topic] || '', context: ctx.join('\n') });
      if (UI.sheet !== s) return;
      var ms = (r.messages || []).map(function (x) { return String(x).trim(); }).filter(Boolean);
      if (ms.length) s.msgs = ms.join('\n'); else s._err = 'ИИ не вернул фраз, попробуйте ещё раз';
    } catch (e) { s._err = e.message || 'Не получилось'; }
    s._ai = false; if (UI.sheet === s) renderSheet();
  }
  /* =================== ПОМОЩНИК: записи по фото и словам =================== */
  var OWN = { cabinet: 1, intake: 1, lab: 1 };
  function asEntries(a, withPh) {
    var out = [];
    (a.cabinet_items || []).forEach(function (d) { out.push({ t: 'cabinet', d: d, photos: withPh() }); });
    (a.intakes || []).forEach(function (d) { out.push({ t: 'intake', d: d }); });
    (a.labs || []).forEach(function (d) { out.push({ t: 'lab', d: d, photos: withPh() }); });
    return out;
  }
  function entryInfo(e) {
    var d = e.d;
    if (e.t === 'cabinet') return { title: d.name, meta: [d.kind === 'supp' ? 'БАД' : 'лекарство', d.form, d.dosage, d.qty != null ? r1(d.qty) + ' ' + (d.unit || '') : '', d.expires ? 'до ' + fmtDM(d.expires) : ''], note: d.purpose };
    if (e.t === 'intake') return { title: d.name, meta: ['× ' + r1(d.units), dayWord(d.day || T()).toLowerCase() + (d.at ? ' ' + d.at : '')], note: d.note };
    var its = d.items || [], bad = its.filter(function (x) { return x.flag === 'low' || x.flag === 'high'; }).length;
    return { title: d.title, meta: [dayWord(d.day || T()).toLowerCase(), its.length + ' ' + plural(its.length, 'показатель', 'показателя', 'показателей'), bad ? 'вне нормы: ' + bad : ''], note: d.lab };
  }
  function entryText(e) {
    var inf = entryInfo(e), d = e.d, lines = [inf.meta.filter(Boolean).join(' · ')];
    if (inf.note) lines.push(inf.note);
    if (e.t === 'cabinet' && d.instructions) lines.push('Как принимать: ' + d.instructions);
    if (e.t === 'lab') (d.items || []).forEach(function (x) { lines.push(x.name + ': ' + (x.value != null ? x.value : (x.text || '')) + ' ' + (x.unit || '') + (refText(x) ? ' (норма ' + refText(x) + ')' : '')); });
    return { title: (e.t === 'cabinet' ? 'Аптечка: ' : e.t === 'intake' ? 'Приём: ' : 'Анализы: ') + inf.title, body: lines.filter(Boolean).join('\n') };
  }
  async function addFrom(e) {
    var d = e.d;
    if (e.t === 'cabinet') { await addCabinetRow({ kind: d.kind, name: d.name, form: d.form, dosage: d.dosage, active: d.active, purpose: d.purpose, qty: d.qty == null ? '' : d.qty, unit: d.unit, expires: d.expires || '', instructions: d.instructions, nutrients: d.nutrients || [], photos: e.photos || [] }); WUI.cab = d.kind === 'supp' ? 'supp' : 'med'; }
    else if (e.t === 'intake') {
      var it = cabByName(d.name), units = +d.units > 0 ? +d.units : 1;
      var saved = await q(sb.from('intakes').insert({ owner: X.ME, item_id: it ? it.id : null, name: d.name, day: d.day || T(), at: d.at || null, units: units, note: d.note || '' }).select().single());
      W.intakes.push(saved); await adjustStock(it, -units);
    } else if (e.t === 'lab') {
      var items = (d.items || []).map(function (x) { var y = { name: x.name, value: x.value, text: x.text || '', unit: x.unit || '', low: x.low, high: x.high, flag: x.flag }; y.flag = flagOf(y); return y; });
      var lr = await q(sb.from('labs').insert({ owner: X.ME, day: d.day || T(), title: d.title, lab: d.lab || '', items: items, photos: e.photos || [] }).select().single());
      W.labs.push(lr);
    }
  }

  /* =================== действия =================== */
  var actions = {
    wTab: function (v) { WUI.tab = v; render(); },
    wCabKind: function (v) { WUI.cab = v; render(); },
    wPeriod: function (v) { WUI.period = v; render(); },
    /* аптечка */
    wItemNew: function (v) { itemOpen(null, v === 'photo' ? { _hint: true } : null); },
    wItemOpen: function (v, id) { var c = cabById(id); if (c) itemOpen(c); },
    wItemSave: function (v, id, el) { saveItem(el); },
    wItemDel: async function () {
      var s = UI.sheet; if (!s || !s.id) return; var c = cabById(s.id); if (!c) return;
      try { await q(sb.from('cabinet').delete().eq('id', s.id)); W.cabinet = W.cabinet.filter(function (x) { return x.id !== s.id; }); if ((c.photos || []).length) sb.storage.from(BUCKET).remove(c.photos); closeSheet(); render(); toast(c.name + ' удалено'); } catch (e) { err(e); }
    },
    wCabAdd: function (v, id, el) {
      var f = el.form, name = ((f.querySelector('#wc-name') || {}).value || '').trim(); if (!name) return;
      addCabinetRow({ kind: WUI.cab, name: name, qty: (f.querySelector('#wc-qty') || {}).value, unit: (f.querySelector('#wc-unit') || {}).value || '' }).then(function () { render(); }).catch(err);
    },
    wPackGo: function () { packGo(); },
    wNutAdd: function () {
      var s = UI.sheet, a = num(s.na); if (!s || !(a > 0)) { toast('Впишите количество'); return; }
      s.nutrients = (s.nutrients || []).filter(function (n) { return n.key !== s.nk; }).concat([{ key: s.nk, amount: a }]); s.na = ''; renderSheet();
    },
    wNutDel: function (v) { var s = UI.sheet; if (s) { s.nutrients.splice(+v, 1); renderSheet(); } },
    wAsk: function (v) { A.asAsk('У меня ' + v + '. Что из моей аптечки и БАД может помочь и на что обратить внимание? Когда стоит обратиться к врачу?'); },
    wAskText: function (v, id, el) { var t = ((el.form.querySelector('#w-sym') || {}).value || '').trim(); if (!t) return; A.asAsk('Что меня беспокоит: ' + t + '. Что из моей аптечки и БАД может помочь и на что обратить внимание? Когда стоит обратиться к врачу?'); },
    wItemAsk: function () { var s = UI.sheet; if (!s || !s.name) return; var n = s.name + (s.dosage ? ' ' + s.dosage : ''); closeSheet(); A.asAsk('Расскажи про мой препарат «' + n + '»: для чего он применяется, как обычно принимают, какие есть противопоказания и с чем его нельзя сочетать из того, что у меня есть в аптечке и расписании.'); },
    /* приём */
    wIntakeNew: function () { intakeOpen(null); },
    wIntakeOpen: function (v, id) { var r = W.intakes.filter(function (x) { return x.id === id; })[0]; if (r) intakeOpen(r); },
    wIntItem: function (v) { var c = cabById(v), s = UI.sheet; if (!c || !s) return; s.item_id = c.id; s.name = c.name + (c.dosage ? ' ' + c.dosage : ''); renderSheet(); },
    wIntakeSave: function (v, id, el) { saveIntake(el); },
    wIntakeDel: async function () {
      var s = UI.sheet; if (!s || !s.id) return;
      try { await q(sb.from('intakes').delete().eq('id', s.id)); W.intakes = W.intakes.filter(function (x) { return x.id !== s.id; }); closeSheet(); render(); toast('Удалено'); } catch (e) { err(e); }
    },
    wTakeNow: function (v, id) { var c = cabById(id); if (!c) return; if (UI.sheet) closeSheet(); intakeOpen(null, { item_id: c.id, name: c.name + (c.dosage ? ' ' + c.dosage : ''), units: '1' }); },
    wTake: async function (v, id) {
      var p = planById(id), h = habitOf(p); if (!p || !h) return;
      var c = markCount(h, T()); if (c >= tgt(h)) return;
      await setMark(h, T(), c + 1); await adjustStock(cabById(p.item_id), -(+p.units || 1)); toast('Принято ✓ ' + p.title);
    },
    wUntake: async function (v, id) {
      var p = planById(id), h = habitOf(p); if (!p || !h) return;
      var c = markCount(h, T()); if (c <= 0) return;
      await setMark(h, T(), c - 1); await adjustStock(cabById(p.item_id), +(+p.units || 1));
    },
    /* расписания */
    wNudgeTopic: function (v) { if (UI.sheet) { UI.sheet.topic = v; renderSheet(); } },
    wNudgePreset: function (v) { var s = UI.sheet, p = (PRESETS[s.topic] || [])[+v]; if (!p) return; s.title = p.title; s.msgs = p.msgs.join('\n'); if (!(s.times || []).length) s.times = [p.at]; renderSheet(); },
    wNudgeAI: function () { nudgeAI(); },
    wNudgeQuick: function (v) { var a = String(v).split(':'), p = PRESETS[a[0]][+a[1]]; planOpen('nudge', null, { topic: a[0], title: p.title, msgs: p.msgs.join('\n'), times: [p.at] }); },
    wSos: function () { UI.sheet = { type: 'w-sos', sos: '' }; renderSheet(true); },
    wSosPick: function (v) { UI.sheet.sos = v; renderSheet(); },
    wSosDone: function () { closeSheet(); toast('Молодец. Продолжай по плану'); },
    wSosTimer: async function () {
      var d = new Date(Date.now() + 10 * 60000), hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), day = X.T();
      try { await X.createTask({ title: 'Прошло 10 минут: как ты? Тяга обычно уже слабее', due_date: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), due_time: hm, remind_every: 0, remind_times: 0 }); closeSheet(); toast('Напомню через 10 минут'); } catch (e) { err(e); }
    },
    wPlanNew: function (v) { if (UI.sheet) closeSheet(); planOpen(v || 'med', null); },
    wPlanOpen: function (v, id) { var p = planById(id); if (p) planOpen(p.kind, p); },
    wPlanFromItem: function () { var s = UI.sheet; if (!s || !s.id) return; var c = cabById(s.id); closeSheet(); planOpen('med', null, { item_id: c.id, title: c.name + (c.dosage ? ' ' + c.dosage : '') }); },
    wPlanItem: function (v) { var c = cabById(v), s = UI.sheet; if (!c || !s) return; s.item_id = c.id; s.title = c.name + (c.dosage ? ' ' + c.dosage : ''); renderSheet(); },
    wPlanSave: function (v, id, el) { savePlan(el); },
    wPlanDel: function () { var s = UI.sheet; if (s && s.id) delPlan(s.id); },
    wPlans: function (v) { UI.sheet = { type: 'w-plans', pk: v }; renderSheet(true); },
    wTimeTog: function (v) { var s = UI.sheet; if (!s) return; var i = s.times.indexOf(v); if (i >= 0) s.times.splice(i, 1); else s.times.push(v); renderSheet(); },
    wTimeAdd: function () { var s = UI.sheet; if (!s || !s.t_add) { toast('Выберите время'); return; } if (s.times.indexOf(s.t_add) < 0) s.times.push(s.t_add); s.t_add = ''; renderSheet(); },
    wDay: function (v) { var s = UI.sheet, i = s.days.indexOf(+v); if (i >= 0) s.days.splice(i, 1); else s.days.push(+v); renderSheet(); },
    /* нутриенты */
    wMicroAll: function () { microAll(); },
    wProf: function () { var S = X.SET; UI.sheet = { type: 'w-prof', sex: S.hSex || 'm', age: S.hAge ? String(S.hAge) : '' }; renderSheet(true); },
    wProfSave: function () { var s = UI.sheet, S = X.SET; S.hSex = s.sex === 'f' ? 'f' : 'm'; S.hAge = num(s.age) || null; saveSettings(); closeSheet(); render(); toast('Сохранено'); },
    /* анализы */
    wLabNew: function () { labOpen(null); },
    wLabOpen: function (v, id) { var l = W.labs.filter(function (x) { return x.id === id; })[0]; if (l) labOpen(l); },
    wLabGo: function () { labGo(); },
    wLabSave: function (v, id, el) { saveLab(el); },
    wLabDel: async function () {
      var s = UI.sheet; if (!s || !s.id) return; var l = W.labs.filter(function (x) { return x.id === s.id; })[0];
      try { await q(sb.from('labs').delete().eq('id', s.id)); W.labs = W.labs.filter(function (x) { return x.id !== s.id; }); if (l && (l.photos || []).length) sb.storage.from(BUCKET).remove(l.photos); closeSheet(); render(); toast('Анализы удалены'); } catch (e) { err(e); }
    },
    wLabItemAdd: function () { labItemAdd(); },
    wLabItemDel: function (v) { var s = UI.sheet; if (s) { s.items.splice(+v, 1); s._edit = null; renderSheet(); } },
    wLabItemEdit: function (v) {
      var s = UI.sheet, it = s && s.items[+v]; if (!it) return;
      s._edit = +v; s.ni_name = it.name; s.ni_value = it.value != null ? r1(it.value) : (it.text || ''); s.ni_unit = it.unit || ''; s.ni_low = it.low != null ? r1(it.low) : ''; s.ni_high = it.high != null ? r1(it.high) : ''; renderSheet();
    },
    wTrendOpen: function (v) { UI.sheet = { type: 'w-trend', key: v }; renderSheet(true); }
  };
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.hasAttribute && el.hasAttribute('data-wlfile') && el.files && el.files.length) { var files = Array.prototype.slice.call(el.files); el.value = ''; addLabFiles(files); }
  });
  Object.assign(A, actions);

  window.WELL = {
    load: load, view: view, supportView: supportView, sheet: sheet, habits: function () { return W.habits; }, plans: function () { return W.plans; }, nutMeta: nutMeta, summaryText: summaryText,
    owns: function (t) { return !!OWN[t]; }, asEntries: asEntries, entryInfo: entryInfo, entryText: entryText, addFrom: addFrom
  };
  /* если основное приложение уже успело загрузиться раньше этого файла — догружаем данные раздела */
  if (X.ME && X.D.profiles.length) load().then(function () { render(); });
})();
