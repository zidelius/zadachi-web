/* Разделы «Питание» и «Тренировки».
   Подключается после app.js и использует его функции (render, q, sb, createTask, toast и т. д.).
   Запланированные приёмы пищи и тренировки создают обычную задачу, поэтому работают напоминания,
   календарь и кнопки в уведомлениях. Отметка в любом из двух мест синхронизируется. */
(function () {
  'use strict';

  /* app.js работает в замыкании и отдаёт нужное через window.__app */
  var X = window.__app;
  if (!X || !X.sb) return;
  var T = X.T, addDays = X.addDays, diff = X.diff, fromKey = X.fromKey, fmtLong = X.fmtLong, fmtDM = X.fmtDM,
    dayWord = X.dayWord, esc = X.esc, uid = X.uid, plural = X.plural, I = X.I, nowHM = X.nowHM, toast = X.toast,
    err = X.err, q = X.q, sb = X.sb, SUPA_URL = X.SUPA_URL, SUPA_KEY = X.SUPA_KEY, UI = X.UI, A = X.A,
    render = X.render, renderSheet = X.renderSheet, closeSheet = X.closeSheet, createTask = X.createTask,
    patchTask = X.patchTask, completeTask = X.completeTask, reopenTask = X.reopenTask, deleteTask = X.deleteTask,
    findTask = X.findTask, saveSettings = X.saveSettings;

  var BUCKET = 'health';
  var H = { meals: [], pantry: [], appliances: [], workouts: [], body: [], ok: false, error: '' };
  var HUI = { foodTab: 'day', day: null, kTab: 'fridge', fitTab: 'log' };
  var BLOBS = {};      // путь в хранилище -> Blob (только что загруженные фото)
  var URLS = {};       // путь -> адрес для показа
  var SIGNED = {};     // путь -> временная ссылка из хранилища

  var KIND = {
    breakfast: { name: 'Завтрак', icon: 'coffee', order: 1 },
    lunch: { name: 'Обед', icon: 'leaf', order: 2 },
    dinner: { name: 'Ужин', icon: 'moon', order: 3 },
    snack: { name: 'Перекус', icon: 'star', order: 4 }
  };
  var FKIND = {
    strength: { name: 'Силовая', icon: 'dumb' }, run: { name: 'Бег', icon: 'run' },
    walk: { name: 'Ходьба', icon: 'run' }, swim: { name: 'Плавание', icon: 'drop' },
    bike: { name: 'Велосипед', icon: 'wave' }, yoga: { name: 'Йога', icon: 'leaf' },
    stretch: { name: 'Растяжка', icon: 'sun' }, other: { name: 'Другое', icon: 'heart' }
  };
  var APPLIANCES = ['Плита', 'Духовка', 'Микроволновка', 'Мультиварка', 'Аэрогриль', 'Блендер', 'Пароварка',
    'Хлебопечка', 'Сэндвичмейкер', 'Тостер', 'Гриль', 'Мясорубка', 'Кофемашина', 'Слоу-кукер'];
  var SPICES = ['Соль', 'Перец чёрный', 'Паприка', 'Куркума', 'Чеснок сушёный', 'Зира', 'Орегано', 'Базилик',
    'Корица', 'Лавровый лист', 'Карри', 'Имбирь', 'Хмели-сунели', 'Прованские травы'];
  var UNITS = ['г', 'кг', 'мл', 'л', 'шт', 'уп'];

  /* ---------- вспомогательное ---------- */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var x = parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }
  function r1(x) { return x === null || x === undefined ? '' : String(Math.round(x * 10) / 10); }
  function hm(t) { return t ? String(t).slice(0, 5) : ''; }
  function day() { if (!HUI.day) HUI.day = T(); return HUI.day; }
  function isDone(m) {
    if (!m.planned) return true;
    var t = m.task_id && findTask(m.task_id);
    return t ? !!t.done : false;
  }
  function field(f, label, val, extra) {
    return '<label><div class="gl">' + label + '</div><input class="fld" data-f="' + f + '" value="' + esc(val == null ? '' : val) + '" ' + (extra || '') + '></label>';
  }
  function numField(f, label, val) { return field(f, label, val, 'inputmode="decimal" autocomplete="off"'); }
  function chipSet(f, items, cur) {
    return '<div class="chips">' + items.map(function (it) {
      return '<button type="button" class="chip' + (String(cur) === String(it[0]) ? ' on' : '') + '" data-a="hSet" data-v="' + f + ':' + it[0] + '">' + it[1] + '</button>';
    }).join('') + '</div>';
  }
  function section(label, inner) { return '<div><div class="gl">' + label + '</div>' + inner + '</div>'; }
  function tabs(items, cur, act) {
    return '<div class="tabs">' + items.map(function (t) {
      return '<button class="' + (cur === t[0] ? 'on' : '') + '" data-a="' + act + '" data-v="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }
  function notReady() {
    if (!H.error) return '<div class="empty">Загружаю…</div>';
    return '<div class="empty">Раздел пока не подключён к базе.<br>' + esc(H.error) + '<br><br>Нужно выполнить миграцию в Supabase.</div>';
  }

  /* ---------- загрузка ---------- */
  async function load() {
    try {
      var since = addDays(T(), -120);
      var r = await Promise.all([
        q(sb.from('meals').select('*').gte('day', since).order('day').order('at', { nullsFirst: true })),
        q(sb.from('pantry').select('*').order('name')),
        q(sb.from('appliances').select('*').order('name')),
        q(sb.from('workouts').select('*').gte('day', since).order('day').order('at', { nullsFirst: true })),
        q(sb.from('body_log').select('*').order('day', { ascending: false }).limit(300))
      ]);
      H.meals = r[0]; H.pantry = r[1]; H.appliances = r[2]; H.workouts = r[3]; H.body = r[4];
      H.ok = true; H.error = '';
    } catch (e) {
      H.ok = false; H.error = (e && e.message) || 'ошибка связи';
    }
  }

  /* ---------- фото: сжатие, загрузка, показ ---------- */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1280 / Math.max(img.width, img.height));
        var w = Math.round(img.width * k), h = Math.round(img.height * k);
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Не удалось обработать фото')); }, 'image/jpeg', 0.74);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Не удалось открыть фото. Попробуй сделать снимок заново.')); };
      img.src = url;
    });
  }
  function blobB64(b) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1]); };
      fr.onerror = function () { rej(new Error('Не удалось прочитать фото')); };
      fr.readAsDataURL(b);
    });
  }
  async function photoBlob(path) {
    if (BLOBS[path]) return BLOBS[path];
    var r = await sb.storage.from(BUCKET).download(path);
    if (r.error) throw r.error;
    return r.data;
  }
  async function addPhotos(files) {
    var s = UI.sheet; if (!s || !s.photos) return;
    s._up = true; renderSheet();
    try {
      for (var i = 0; i < files.length && s.photos.length < 4; i++) {
        var b = await shrink(files[i]);
        var path = X.ME + '/' + uid() + '.jpg';
        var u = await sb.storage.from(BUCKET).upload(path, b, { contentType: 'image/jpeg' });
        if (u.error) throw u.error;
        BLOBS[path] = b; s.photos.push(path);
      }
    } catch (e) { err(e); }
    s._up = false; if (UI.sheet === s) renderSheet();
  }
  function hydrate() {
    var imgs = document.querySelectorAll('img[data-ph]:not([src])');
    imgs.forEach(function (im) {
      var p = im.getAttribute('data-ph');
      if (BLOBS[p]) { URLS[p] = URLS[p] || URL.createObjectURL(BLOBS[p]); im.src = URLS[p]; return; }
      if (SIGNED[p]) { im.src = SIGNED[p]; return; }
      im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
      sb.storage.from(BUCKET).createSignedUrl(p, 3600).then(function (r) {
        if (r.data && r.data.signedUrl) { SIGNED[p] = r.data.signedUrl; document.querySelectorAll('img[data-ph="' + p + '"]').forEach(function (x) { x.src = SIGNED[p]; }); }
      });
    });
  }
  var hyT = null;
  new MutationObserver(function () { cancelAnimationFrame(hyT); hyT = requestAnimationFrame(hydrate); })
    .observe(document.documentElement, { childList: true, subtree: true });

  function photoBlock(s) {
    var h = '<div class="hphotos">';
    (s.photos || []).forEach(function (p, i) {
      h += '<div class="hph"><img data-ph="' + esc(p) + '" alt="Фото"><button type="button" data-a="hPhotoDel" data-v="' + i + '" aria-label="Убрать фото">' + I('x') + '</button></div>';
    });
    if ((s.photos || []).length < 4) {
      h += '<label class="hadd">' + I('plus') + '<span>' + (s._up ? 'Загружаю…' : 'Сфотографировать') + '</span><input type="file" accept="image/*" capture="environment" data-hfile hidden></label>';
      h += '<label class="hadd">' + I('inbox') + '<span>Из галереи</span><input type="file" accept="image/*" multiple data-hfile hidden></label>';
    }
    return h + '</div>';
  }
  async function callAI(body) {
    var ses = await sb.auth.getSession();
    var tok = ses.data && ses.data.session && ses.data.session.access_token;
    if (!tok) throw new Error('Нужно войти заново');
    var r = await fetch(SUPA_URL + '/functions/v1/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPA_KEY, Authorization: 'Bearer ' + tok },
      body: JSON.stringify(body)
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) {
      var m = j.error || ('ошибка ' + r.status);
      if (r.status === 404) m = 'Функция health ещё не опубликована в Supabase';
      throw new Error(m);
    }
    return j.result;
  }
  async function analyze(mode) {
    var s = UI.sheet; if (!s || s._busy) return;
    if (!s.photos.length) { toast('Сначала добавь фото'); return; }
    s._busy = true; s._err = ''; renderSheet();
    try {
      var images = [];
      for (var i = 0; i < s.photos.length; i++) images.push({ media_type: 'image/jpeg', data: await blobB64(await photoBlob(s.photos[i])) });
      var r = await callAI({ mode: mode, images: images, text: s.hint || '' });
      if (UI.sheet !== s) return;
      s.ai = r;
      if (mode === 'food') {
        var t = r.total || {};
        if (!s.title || s._autoTitle) { s.title = r.name || s.title; s._autoTitle = true; }
        s.kcal = r1(t.kcal); s.protein = r1(t.protein); s.fat = r1(t.fat); s.carbs = r1(t.carbs);
        if (t.grams) s.grams = r1(t.grams);
        s.items = r.items || [];
        s._note = (r.confidence === 'high' ? 'Оценка уверенная. ' : r.confidence === 'medium' ? 'Оценка средней точности. ' : 'Оценка приблизительная. ') + (r.notes || '');
      } else if (mode === 'fit') {
        if (!s.title) s.title = r.title || '';
        if (r.kind && FKIND[r.kind]) s.kind = r.kind;
        if (r.minutes != null) s.minutes = r1(r.minutes);
        if (r.kcal != null) s.kcal = r1(r.kcal);
        s.metrics = (r.metrics || []).map(function (m) { return { name: m.name, value: m.value, unit: m.unit || '' }; });
        s._note = r.notes || '';
      } else if (mode === 'body') {
        if (r.weight_kg != null) s.weight = r1(r.weight_kg);
        if (r.fat_pct != null) s.fat = r1(r.fat_pct);
        if (r.muscle_kg != null) s.muscle = r1(r.muscle_kg);
        s._note = (r.notes || '') + ((r.other || []).length ? ' Ещё на экране: ' + r.other.map(function (o) { return o.name + ' ' + o.value + (o.unit ? ' ' + o.unit : ''); }).join(', ') + '.' : '');
      }
    } catch (e) { s._err = e.message || 'Не получилось'; }
    s._busy = false; if (UI.sheet === s) renderSheet();
  }

  /* ---------- связь с обычными задачами ---------- */
  async function makeTask(prefix, title, dayKey, time) {
    var r = await createTask({
      title: (prefix + (title ? ': ' + title : '')).slice(0, 200),
      due_date: dayKey, due_time: time || null,
      remind_every: time ? 10 : 0, remind_times: time ? 3 : 0
    });
    return r ? r.id : null;
  }
  async function toggleLinked(rec, table) {
    var t = rec.task_id && findTask(rec.task_id);
    if (t) { if (t.done) reopenTask(t.id); else completeTask(t.id); return; }
    // задачи уже нет — просто превращаем плановую запись в выполненную
    try {
      var row = await q(sb.from(table).update({ planned: false }).eq('id', rec.id).select().single());
      Object.assign(rec, row); render();
    } catch (e) { err(e); }
  }

  /* =================== ПИТАНИЕ =================== */
  function mealsOf(d) {
    return H.meals.filter(function (m) { return m.day === d; }).sort(function (a, b) {
      var ta = hm(a.at) || '99:99', tb = hm(b.at) || '99:99';
      return ta === tb ? (KIND[a.kind].order - KIND[b.kind].order) : (ta < tb ? -1 : 1);
    });
  }
  function totals(d) {
    var t = { kcal: 0, protein: 0, fat: 0, carbs: 0, plan: 0, n: 0 };
    mealsOf(d).forEach(function (m) {
      if (isDone(m)) { t.kcal += +m.kcal || 0; t.protein += +m.protein || 0; t.fat += +m.fat || 0; t.carbs += +m.carbs || 0; t.n++; }
      else t.plan += +m.kcal || 0;
    });
    return t;
  }
  function foodView() {
    var d = day(), h = '<div class="top"><div><div class="date">' + fmtLong(T()) + '</div><h1 class="dh">Питание</h1></div>' +
      (HUI.foodTab === 'day' ? '<button class="btn2" data-a="hMealNew">' + I('plus') + 'Добавить</button>' : '') + '</div>';
    h += tabs([['day', 'День'], ['kitchen', 'Кухня']], HUI.foodTab, 'hFoodTab');
    if (!H.ok) return h + notReady();
    return h + (HUI.foodTab === 'day' ? foodDay(d) : kitchenView());
  }
  function foodDay(d) {
    var t = totals(d), goal = num(X.SET.kcalGoal), ms = mealsOf(d);
    var h = '<div class="calnav"><button class="iconbtn" data-a="hDay" data-v="prev" aria-label="Предыдущий день">' + I('left') + '</button>' +
      '<button class="link" data-a="hDay" data-v="today"><b>' + esc(dayWord(d)) + '</b></button>' +
      '<button class="iconbtn" data-a="hDay" data-v="next" aria-label="Следующий день">' + I('right') + '</button></div>';
    var pct = goal ? Math.min(100, Math.round(t.kcal / goal * 100)) : 0;
    h += '<div class="hsum"><div class="hk"><b>' + Math.round(t.kcal) + '</b><span>ккал' + (goal ? ' из ' + Math.round(goal) : '') + '</span>' +
      '<button class="link" data-a="hGoal">' + (goal ? 'изменить цель' : 'задать цель') + '</button></div>' +
      (goal ? '<div class="hbar"><i style="width:' + pct + '%"></i></div>' : '') +
      '<div class="hmac"><span><b>' + Math.round(t.protein) + '</b> Белки</span><span><b>' + Math.round(t.fat) + '</b> Жиры</span><span><b>' + Math.round(t.carbs) + '</b> Углеводы</span></div>' +
      (t.plan ? '<div class="muted" style="margin-top:8px;font-size:13px">Запланировано ещё на ' + Math.round(t.plan) + ' ккал</div>' : '') + '</div>';
    if (!ms.length) return h + '<div class="empty">На этот день записей нет. Нажми «Добавить»: можно сфотографировать еду или этикетку, или запланировать приём пищи.</div>';
    ms.forEach(function (m) { h += mealRow(m); });
    return h;
  }
  function mealRow(m) {
    var d = isDone(m), k = KIND[m.kind] || KIND.snack;
    var lead = m.planned
      ? '<button class="chk' + (d ? ' on' : '') + '" data-a="hMealChk" data-id="' + m.id + '" aria-label="Отметить"><span>' + (d ? I('check') : '') + '</span></button>'
      : '<span class="hdot">' + I(k.icon) + '</span>';
    var meta = '<span>' + k.name + (hm(m.at) ? ', ' + hm(m.at) : '') + '</span>' +
      (m.kcal != null ? '<span class="tm">' + Math.round(m.kcal) + ' ккал</span>' : '') +
      (m.protein != null || m.fat != null || m.carbs != null ? '<span>Б ' + Math.round(m.protein || 0) + ' · Ж ' + Math.round(m.fat || 0) + ' · У ' + Math.round(m.carbs || 0) + '</span>' : '') +
      (m.planned && !d ? '<span class="badge">план</span>' : '') +
      ((m.photos || []).length ? '<span>' + I('inbox') + (m.photos || []).length + '</span>' : '');
    return '<div class="task hrow"><div class="hlead">' + lead + '</div><button class="tb" data-a="hMealOpen" data-id="' + m.id + '"><span class="tt' + (m.planned && d ? ' done' : '') + '">' + esc(m.title || k.name) + '</span><span class="meta">' + meta + '</span></button></div>';
  }

  /* --- кухня: холодильник, приправы, техника --- */
  function kitchenView() {
    var h = '<div style="margin-top:16px"><button class="btn" style="width:100%" data-a="hRecipeOpen">' + I('spark') + 'Что приготовить?</button></div>';
    h += tabs([['fridge', 'Холодильник'], ['spices', 'Приправы'], ['tech', 'Техника']], HUI.kTab, 'hKTab');
    if (HUI.kTab === 'fridge') return h + fridgeView();
    if (HUI.kTab === 'spices') return h + spicesView();
    return h + techView();
  }
  function fridgeView() {
    var items = H.pantry.filter(function (p) { return p.kind === 'food'; });
    var h = '<form class="hadd-form" autocomplete="off"><input class="fld" id="hp-name" placeholder="Продукт" aria-label="Продукт">' +
      '<input class="fld hq" id="hp-qty" inputmode="decimal" placeholder="Кол-во" aria-label="Количество">' +
      '<select class="fld hu" id="hp-unit" aria-label="Единица">' + UNITS.map(function (u) { return '<option>' + u + '</option>'; }).join('') + '</select>' +
      '<button class="btn" type="submit" data-a="hPantryAdd" data-v="food" aria-label="Добавить">' + I('plus') + '</button></form>';
    if (!items.length) return h + '<div class="empty">Холодильник пуст. Добавь продукты, которые у тебя есть, и нажми «Что приготовить?».</div>';
    h += '<div style="margin-top:6px">';
    items.slice().sort(function (a, b) { return (a.expires || '9999') < (b.expires || '9999') ? -1 : 1; }).forEach(function (p) {
      var left = p.expires ? diff(p.expires, T()) : null;
      var exp = left === null ? '' : left < 0 ? '<span class="over">просрочено</span>' : left <= 2 ? '<span class="over">годен ещё ' + (left === 0 ? 'сегодня' : left + ' дн.') + '</span>' : '<span>до ' + fmtDM(p.expires) + '</span>';
      h += '<div class="task hrow"><div class="hlead"><span class="hdot">' + I('leaf') + '</span></div><button class="tb" data-a="hPantryOpen" data-id="' + p.id + '"><span class="tt">' + esc(p.name) + '</span><span class="meta">' +
        (p.qty != null ? '<span class="tm">' + r1(p.qty) + ' ' + esc(p.unit) + '</span>' : '') + exp + '</span></button>' +
        '<button class="iconbtn" data-a="hPantryDel" data-id="' + p.id + '" aria-label="Убрать">' + I('x') + '</button></div>';
    });
    return h + '</div>';
  }
  function spicesView() {
    var mine = H.pantry.filter(function (p) { return p.kind === 'spice'; });
    var have = mine.map(function (p) { return p.name.toLowerCase(); });
    var h = '<form class="hadd-form" autocomplete="off"><input class="fld" id="hs-name" placeholder="Своя приправа" aria-label="Приправа"><button class="btn" type="submit" data-a="hPantryAdd" data-v="spice" aria-label="Добавить">' + I('plus') + '</button></form>';
    h += section('Есть', mine.length ? '<div class="chips">' + mine.map(function (p) { return '<button class="chip on" data-a="hPantryDel" data-id="' + p.id + '" aria-label="Убрать ' + esc(p.name) + '">' + esc(p.name) + I('x') + '</button>'; }).join('') + '</div>' : '<div class="muted">Пока ничего. Отметь ниже то, что есть на кухне.</div>');
    var rest = SPICES.filter(function (s) { return have.indexOf(s.toLowerCase()) < 0; });
    if (rest.length) h += section('Быстро добавить', '<div class="chips">' + rest.map(function (s) { return '<button class="chip" data-a="hSpiceAdd" data-v="' + esc(s) + '">' + I('plus') + esc(s) + '</button>'; }).join('') + '</div>');
    return '<div style="display:flex;flex-direction:column;gap:18px;margin-top:16px">' + h + '</div>';
  }
  function techView() {
    var have = H.appliances.map(function (a) { return a.name.toLowerCase(); });
    var h = '<div class="muted" style="margin-top:14px;line-height:1.5">Отметь технику, которая есть у тебя. Рецепты будут подбираться только под неё.</div>';
    h += '<div class="chips" style="margin-top:12px">' + APPLIANCES.map(function (a) { var on = have.indexOf(a.toLowerCase()) >= 0; return '<button class="chip' + (on ? ' on' : '') + '" data-a="hApplToggle" data-v="' + esc(a) + '">' + (on ? I('check') : I('plus')) + esc(a) + '</button>'; }).join('') + '</div>';
    var custom = H.appliances.filter(function (a) { return APPLIANCES.map(function (x) { return x.toLowerCase(); }).indexOf(a.name.toLowerCase()) < 0; });
    if (custom.length) h += '<div class="chips" style="margin-top:10px">' + custom.map(function (a) { return '<button class="chip on" data-a="hApplToggle" data-v="' + esc(a.name) + '">' + I('check') + esc(a.name) + '</button>'; }).join('') + '</div>';
    h += '<form class="hadd-form" style="margin-top:16px" autocomplete="off"><input class="fld" id="ha-name" placeholder="Другая техника" aria-label="Другая техника"><button class="btn" type="submit" data-a="hApplAdd" aria-label="Добавить">' + I('plus') + '</button></form>';
    return h;
  }

  /* --- форма приёма пищи --- */
  function mealSheet(s) {
    var h = '';
    if (!s.id) h += chipSet('planned', [['0', 'Уже съел(а)'], ['1', 'Запланировать']], s.planned ? '1' : '0');
    else if (s.planned) h += '<div class="muted">Запланированный приём пищи. Отметить его можно кнопкой в списке или в обычных задачах.</div>';
    h += section('Приём пищи', chipSet('kind', Object.keys(KIND).map(function (k) { return [k, KIND[k].name]; }), s.kind));
    h += '<div class="row2"><label><div class="gl">Дата</div><input class="fld" type="date" data-f="day" value="' + esc(s.day) + '"></label><label><div class="gl">Время</div><input class="fld" type="time" data-f="at" value="' + esc(s.at || '') + '"></label></div>';
    h += field('title', 'Что это', s.title, 'placeholder="Например, гречка с курицей" autocomplete="off"');
    h += section('Фото еды или этикетки', photoBlock(s));
    if ((s.photos || []).length) {
      h += field('hint', 'Подсказка для расчёта (необязательно)', s.hint || '', 'placeholder="Например: порция 250 г, или съел половину" autocomplete="off"');
      h += '<button type="button" class="btn2" data-a="hAnalyze" data-v="food"' + (s._busy ? ' disabled' : '') + '>' + I('spark') + (s._busy ? 'Считаю…' : 'Посчитать по фото') + '</button>';
    }
    if (s._err) h += '<div class="herr">' + esc(s._err) + '</div>';
    if (s._note) h += '<div class="hnote">' + esc(s._note) + '</div>';
    if ((s.items || []).length) h += '<div class="fields">' + s.items.map(function (i) { return '<div class="fr"><span>' + esc(i.name) + (i.grams ? ', ' + Math.round(i.grams) + ' г' : '') + '</span><b style="font-weight:500">' + Math.round(i.kcal || 0) + ' ккал</b></div>'; }).join('') + '</div>';
    h += '<div class="row2">' + numField('kcal', 'Ккал', s.kcal) + numField('grams', 'Вес, г', s.grams) + '</div>';
    h += '<div class="row2">' + numField('protein', 'Белки, г', s.protein) + numField('fat', 'Жиры, г', s.fat) + numField('carbs', 'Углеводы, г', s.carbs) + '</div>';
    h += field('note', 'Заметка', s.note, 'autocomplete="off"');
    return h;
  }
  function mealOpen(m, preset) {
    var base = { type: 'h-meal', id: null, day: day(), at: '', kind: guessKind(), title: '', grams: '', kcal: '', protein: '', fat: '', carbs: '', note: '', photos: [], planned: false, _rm: [] };
    if (m) base = Object.assign(base, { id: m.id, day: m.day, at: hm(m.at), kind: m.kind, title: m.title, grams: r1(m.grams), kcal: r1(m.kcal), protein: r1(m.protein), fat: r1(m.fat), carbs: r1(m.carbs), note: m.note || '', photos: (m.photos || []).slice(), planned: m.planned, task_id: m.task_id, ai: m.ai });
    if (preset) Object.assign(base, preset);
    UI.sheet = base; renderSheet(true);
  }
  function guessKind() { var h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }

  async function saveMeal(btn) {
    var s = UI.sheet; if (!s) return;
    var title = (s.title || '').trim();
    if (!title && num(s.kcal) == null && !s.photos.length) { toast('Напиши, что это, или добавь фото'); return; }
    if (btn) btn.disabled = true;
    var row = {
      owner: X.ME, day: s.day || T(), at: s.at || null, kind: s.kind, title: title || (KIND[s.kind] || KIND.snack).name,
      grams: num(s.grams), kcal: num(s.kcal), protein: num(s.protein), fat: num(s.fat), carbs: num(s.carbs),
      note: s.note || '', photos: s.photos, planned: !!s.planned, ai: s.ai || null
    };
    try {
      if (s.planned) {
        var k = KIND[s.kind] || KIND.snack;
        if (s.id && s.task_id && findTask(s.task_id)) patchTask(s.task_id, { title: (k.name + ': ' + row.title).slice(0, 200), due_date: row.day, due_time: row.at });
        else if (!s.task_id) row.task_id = await makeTask(k.name, row.title, row.day, row.at);
      }
      var saved = s.id
        ? await q(sb.from('meals').update(row).eq('id', s.id).select().single())
        : await q(sb.from('meals').insert(row).select().single());
      var i = H.meals.findIndex(function (x) { return x.id === saved.id; });
      if (i >= 0) H.meals[i] = saved; else H.meals.push(saved);
      if (s._rm && s._rm.length) sb.storage.from(BUCKET).remove(s._rm);
      HUI.day = saved.day; closeSheet(); render();
      toast(s.planned ? 'Запланировано' : 'Записано');
    } catch (e) { if (btn) btn.disabled = false; err(e); }
  }
  async function delRecord(table, list, id, label) {
    var rec = list.filter(function (x) { return x.id === id; })[0]; if (!rec) return;
    var copy = Object.assign({}, rec);
    try {
      await q(sb.from(table).delete().eq('id', id));
      list.splice(list.indexOf(rec), 1);
      var t = rec.task_id && findTask(rec.task_id); if (t && !t.done) deleteTask(t.id);
      if ((rec.photos || []).length) sb.storage.from(BUCKET).remove(rec.photos);
      closeSheet(); render();
      toast(label + ' удалено');
    } catch (e) { err(e); }
    return copy;
  }

  /* --- рецепты --- */
  function recipeSheet(s) {
    var food = H.pantry.filter(function (p) { return p.kind === 'food'; });
    var h = '';
    if (!food.length) h += '<div class="hnote">В холодильнике пусто. Добавь продукты на вкладке «Холодильник», тогда рецепты получатся точнее.</div>';
    else h += '<div class="muted" style="line-height:1.5">Используем: ' + esc(food.map(function (p) { return p.name; }).join(', ')) + '.<br>Техника: ' + esc(H.appliances.length ? H.appliances.map(function (a) { return a.name; }).join(', ') : 'не указана (плита и посуда)') + '.</div>';
    h += field('text', 'Пожелания (необязательно)', s.text || '', 'placeholder="Быстро, больше белка, на ужин…" autocomplete="off"');
    h += '<button type="button" class="btn" data-a="hRecipeGo"' + (s._busy ? ' disabled' : '') + '>' + I('spark') + (s._busy ? 'Подбираю…' : (s.recipes ? 'Подобрать другие' : 'Подобрать рецепты')) + '</button>';
    if (s._err) h += '<div class="herr">' + esc(s._err) + '</div>';
    (s.recipes || []).forEach(function (r, i) {
      h += '<div class="hrec"><b>' + esc(r.title) + '</b><div class="meta" style="margin:4px 0 8px"><span>' + I('clock') + Math.round(r.time_min || 0) + ' мин</span><span>' + esc(r.appliance || '') + '</span><span>' + Math.round(r.servings || 1) + ' ' + plural(Math.round(r.servings || 1), 'порция', 'порции', 'порций') + '</span><span class="tm">' + Math.round(r.kcal || 0) + ' ккал на порцию</span></div>' +
        (r.protein != null ? '<div class="muted" style="font-size:13px;margin-bottom:8px">Б ' + Math.round(r.protein || 0) + ' · Ж ' + Math.round(r.fat || 0) + ' · У ' + Math.round(r.carbs || 0) + ' на порцию</div>' : '') +
        '<div class="hing">' + (r.ingredients || []).map(function (g) { return '<span class="' + (g.in_stock ? '' : 'miss') + '">' + esc(g.name) + ', ' + esc(g.amount) + (g.in_stock ? '' : ' (нет)') + '</span>'; }).join('') + '</div>' +
        '<ol>' + (r.steps || []).map(function (st) { return '<li>' + esc(st) + '</li>'; }).join('') + '</ol>' +
        (r.tip ? '<div class="muted" style="font-size:13px;margin:6px 0">' + esc(r.tip) + '</div>' : '') +
        '<div class="row2"><button class="btn2" data-a="hRecipeEat" data-v="' + i + '">Приготовил(а)</button><button class="btn2" data-a="hRecipePlan" data-v="' + i + '">Запланировать</button></div></div>';
    });
    if (s.notes) h += '<div class="hnote">' + esc(s.notes) + '</div>';
    return h;
  }
  async function recipeGo() {
    var s = UI.sheet; if (!s || s._busy) return;
    s._busy = true; s._err = ''; renderSheet();
    try {
      var r = await callAI({
        mode: 'recipe', text: s.text || '', today: T(), goal: num(X.SET.kcalGoal),
        pantry: H.pantry.filter(function (p) { return p.kind === 'food'; }).map(function (p) { return { name: p.name, qty: p.qty, unit: p.unit, expires: p.expires }; }),
        spices: H.pantry.filter(function (p) { return p.kind === 'spice'; }).map(function (p) { return p.name; }),
        appliances: H.appliances.map(function (a) { return a.name; })
      });
      if (UI.sheet !== s) return;
      s.recipes = r.recipes || []; s.notes = r.notes || '';
    } catch (e) { s._err = e.message || 'Не получилось'; }
    s._busy = false; if (UI.sheet === s) renderSheet();
  }
  function recipeToMeal(r) {
    return { title: r.title, kcal: r1(r.kcal), protein: r1(r.protein), fat: r1(r.fat), carbs: r1(r.carbs), note: 'Рецепт: ' + (r.appliance || '') + ', ' + Math.round(r.time_min || 0) + ' мин' };
  }

  /* =================== ТРЕНИРОВКИ =================== */
  function fitView() {
    var h = '<div class="top"><div><div class="date">' + fmtLong(T()) + '</div><h1 class="dh">Тренировки</h1></div><button class="btn2" data-a="' + (HUI.fitTab === 'body' ? 'hBodyNew' : 'hWorkNew') + '">' + I('plus') + (HUI.fitTab === 'body' ? 'Замер' : 'Добавить') + '</button></div>';
    h += tabs([['log', 'Тренировки'], ['body', 'Замеры']], HUI.fitTab, 'hFitTab');
    if (!H.ok) return h + notReady();
    return h + (HUI.fitTab === 'log' ? workLog() : bodyView());
  }
  function workRow(w) {
    var d = isDone(w), k = FKIND[w.kind] || FKIND.other;
    var lead = w.planned
      ? '<button class="chk' + (d ? ' on' : '') + '" data-a="hWorkChk" data-id="' + w.id + '" aria-label="Отметить"><span>' + (d ? I('check') : '') + '</span></button>'
      : '<span class="hdot">' + I(k.icon) + '</span>';
    var meta = '<span>' + k.name + (hm(w.at) ? ', ' + hm(w.at) : '') + '</span>' + (w.minutes != null ? '<span class="tm">' + Math.round(w.minutes) + ' мин</span>' : '') +
      (w.kcal != null ? '<span>' + Math.round(w.kcal) + ' ккал</span>' : '') +
      ((w.metrics || []).length ? '<span>' + (w.metrics || []).slice(0, 2).map(function (m) { return esc(m.name + ' ' + m.value + (m.unit ? ' ' + m.unit : '')); }).join(' · ') + '</span>' : '') +
      (w.planned && !d ? '<span class="badge">план</span>' : '') + ((w.photos || []).length ? '<span>' + I('inbox') + (w.photos || []).length + '</span>' : '');
    return '<div class="task hrow"><div class="hlead">' + lead + '</div><button class="tb" data-a="hWorkOpen" data-id="' + w.id + '"><span class="tt' + (w.planned && d ? ' done' : '') + '">' + esc(w.title || k.name) + '</span><span class="meta">' + meta + '</span></button></div>';
  }
  function workLog() {
    var plan = H.workouts.filter(function (w) { return w.planned && !isDone(w); }).sort(function (a, b) { return (a.day + hm(a.at)) < (b.day + hm(b.at)) ? -1 : 1; });
    var done = H.workouts.filter(function (w) { return isDone(w); }).sort(function (a, b) { return (a.day + hm(a.at)) < (b.day + hm(b.at)) ? 1 : -1; });
    var h = '';
    if (!plan.length && !done.length) return '<div class="empty">Тренировок пока нет. Нажми «Добавить»: можно запланировать тренировку или записать уже проведённую, с фото экрана тренажёра или часов.</div>';
    if (plan.length) { h += '<div class="dday">Запланировано</div>'; plan.forEach(function (w) { h += '<div class="hdate">' + esc(dayWord(w.day)) + '</div>' + workRow(w); }); }
    if (done.length) {
      var last = '';
      done.slice(0, 80).forEach(function (w) { if (w.day !== last) { last = w.day; h += '<div class="dday">' + esc(dayWord(w.day)) + '</div>'; } h += workRow(w); });
    }
    return h;
  }
  function workSheet(s) {
    var h = '';
    if (!s.id) h += chipSet('planned', [['0', 'Уже провёл(а)'], ['1', 'Запланировать']], s.planned ? '1' : '0');
    else if (s.planned) h += '<div class="muted">Запланированная тренировка. Отметить её можно кнопкой в списке или в обычных задачах.</div>';
    h += section('Тип', chipSet('kind', Object.keys(FKIND).map(function (k) { return [k, FKIND[k].name]; }), s.kind));
    h += '<div class="row2"><label><div class="gl">Дата</div><input class="fld" type="date" data-f="day" value="' + esc(s.day) + '"></label><label><div class="gl">Время</div><input class="fld" type="time" data-f="at" value="' + esc(s.at || '') + '"></label></div>';
    h += field('title', 'Название', s.title, 'placeholder="Например, грудь и трицепс" autocomplete="off"');
    h += section('Фото экрана тренажёра, часов, веса на штанге', photoBlock(s));
    if ((s.photos || []).length) h += '<button type="button" class="btn2" data-a="hAnalyze" data-v="fit"' + (s._busy ? ' disabled' : '') + '>' + I('spark') + (s._busy ? 'Считываю…' : 'Считать цифры с фото') + '</button>';
    if (s._err) h += '<div class="herr">' + esc(s._err) + '</div>';
    if (s._note) h += '<div class="hnote">' + esc(s._note) + '</div>';
    if ((s.metrics || []).length) h += '<div class="fields">' + s.metrics.map(function (m, i) { return '<div class="fr"><span>' + esc(m.name) + '</span><b style="font-weight:500">' + esc(m.value) + (m.unit ? ' ' + esc(m.unit) : '') + '</b><button type="button" class="iconbtn" data-a="hMetricDel" data-v="' + i + '" aria-label="Убрать">' + I('x') + '</button></div>'; }).join('') + '</div>';
    h += '<div class="row2">' + numField('minutes', 'Минуты', s.minutes) + numField('kcal', 'Ккал', s.kcal) + '</div>';
    h += field('note', 'Заметка', s.note, 'autocomplete="off"');
    return h;
  }
  function workOpen(w, preset) {
    var base = { type: 'h-work', id: null, day: T(), at: '', kind: 'strength', title: '', minutes: '', kcal: '', note: '', photos: [], metrics: [], planned: false, _rm: [] };
    if (w) base = Object.assign(base, { id: w.id, day: w.day, at: hm(w.at), kind: w.kind, title: w.title, minutes: r1(w.minutes), kcal: r1(w.kcal), note: w.note || '', photos: (w.photos || []).slice(), metrics: (w.metrics || []).slice(), planned: w.planned, task_id: w.task_id, ai: w.ai });
    if (preset) Object.assign(base, preset);
    UI.sheet = base; renderSheet(true);
  }
  async function saveWork(btn) {
    var s = UI.sheet; if (!s) return;
    var k = FKIND[s.kind] || FKIND.other, title = (s.title || '').trim() || k.name;
    if (btn) btn.disabled = true;
    var row = { owner: X.ME, day: s.day || T(), at: s.at || null, kind: s.kind, title: title, minutes: num(s.minutes), kcal: num(s.kcal), note: s.note || '', photos: s.photos, metrics: s.metrics || [], planned: !!s.planned, ai: s.ai || null };
    try {
      if (s.planned) {
        if (s.id && s.task_id && findTask(s.task_id)) patchTask(s.task_id, { title: ('Тренировка: ' + title).slice(0, 200), due_date: row.day, due_time: row.at });
        else if (!s.task_id) row.task_id = await makeTask('Тренировка', title, row.day, row.at);
      }
      var saved = s.id
        ? await q(sb.from('workouts').update(row).eq('id', s.id).select().single())
        : await q(sb.from('workouts').insert(row).select().single());
      var i = H.workouts.findIndex(function (x) { return x.id === saved.id; });
      if (i >= 0) H.workouts[i] = saved; else H.workouts.push(saved);
      if (s._rm && s._rm.length) sb.storage.from(BUCKET).remove(s._rm);
      closeSheet(); render(); toast(s.planned ? 'Запланировано' : 'Записано');
    } catch (e) { if (btn) btn.disabled = false; err(e); }
  }

  /* --- замеры --- */
  function bodyView() {
    var list = H.body.slice().sort(function (a, b) { return a.day < b.day ? 1 : -1; });
    if (!list.length) return '<div class="empty">Замеров пока нет. Нажми «Замер»: можно сфотографировать экран весов, и цифры подставятся сами.</div>';
    var h = weightChart(list);
    list.slice(0, 60).forEach(function (b) {
      h += '<div class="task hrow"><div class="hlead"><span class="hdot">' + I('wave') + '</span></div><button class="tb" data-a="hBodyOpen" data-id="' + b.id + '"><span class="tt">' + (b.weight != null ? r1(b.weight) + ' кг' : 'Замер') + '</span><span class="meta"><span>' + esc(dayWord(b.day)) + '</span>' +
        (b.fat != null ? '<span>жир ' + r1(b.fat) + '%</span>' : '') + (b.muscle != null ? '<span>мышцы ' + r1(b.muscle) + ' кг</span>' : '') + (b.waist != null ? '<span>талия ' + r1(b.waist) + ' см</span>' : '') + ((b.photos || []).length ? '<span>' + I('inbox') + (b.photos || []).length + '</span>' : '') + '</span></button></div>';
    });
    return h;
  }
  function weightChart(list) {
    var pts = list.filter(function (b) { return b.weight != null; }).slice(0, 90).reverse();
    if (pts.length < 2) return pts.length ? '<div class="hsum"><div class="hk"><b>' + r1(pts[0].weight) + '</b><span>кг</span></div><div class="muted" style="margin-top:6px;font-size:13px">Добавь ещё замер, и появится график.</div></div>' : '';
    var vals = pts.map(function (p) { return +p.weight; }), mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mx - mn < 1) { mx += .5; mn -= .5; }
    var t0 = fromKey(pts[0].day).getTime(), t1 = fromKey(pts[pts.length - 1].day).getTime() || t0 + 1, W = 300, Hh = 110, pad = 8;
    var xy = pts.map(function (p) { var x = pad + (t1 === t0 ? 0 : (fromKey(p.day).getTime() - t0) / (t1 - t0)) * (W - 2 * pad); var y = pad + (1 - (p.weight - mn) / (mx - mn)) * (Hh - 2 * pad); return [x, y]; });
    var d = xy.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    var change = pts[pts.length - 1].weight - pts[0].weight;
    return '<div class="hsum"><div class="hk"><b>' + r1(pts[pts.length - 1].weight) + '</b><span>кг, ' + (change > 0 ? '+' : '') + r1(change) + ' за период</span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + Hh + '" class="hchart" role="img" aria-label="График веса"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      xy.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="currentColor"/>'; }).join('') + '</svg>' +
      '<div class="hrange"><span>' + r1(mn) + '</span><span>' + r1(mx) + '</span></div></div>';
  }
  function bodySheet(s) {
    var h = '<label><div class="gl">Дата</div><input class="fld" type="date" data-f="day" value="' + esc(s.day) + '"></label>';
    h += section('Фото экрана весов', photoBlock(s));
    if ((s.photos || []).length) h += '<button type="button" class="btn2" data-a="hAnalyze" data-v="body"' + (s._busy ? ' disabled' : '') + '>' + I('spark') + (s._busy ? 'Считываю…' : 'Считать цифры с фото') + '</button>';
    if (s._err) h += '<div class="herr">' + esc(s._err) + '</div>';
    if (s._note) h += '<div class="hnote">' + esc(s._note) + '</div>';
    h += '<div class="row2">' + numField('weight', 'Вес, кг', s.weight) + numField('fat', 'Жир, %', s.fat) + '</div>';
    h += '<div class="row2">' + numField('muscle', 'Мышцы, кг', s.muscle) + numField('waist', 'Талия, см', s.waist) + '</div>';
    h += field('note', 'Заметка', s.note, 'autocomplete="off"');
    return h;
  }
  function bodyOpen(b) {
    var base = { type: 'h-body', id: null, day: T(), weight: '', fat: '', muscle: '', waist: '', note: '', photos: [], _rm: [] };
    if (b) base = Object.assign(base, { id: b.id, day: b.day, weight: r1(b.weight), fat: r1(b.fat), muscle: r1(b.muscle), waist: r1(b.waist), note: b.note || '', photos: (b.photos || []).slice(), ai: b.ai });
    UI.sheet = base; renderSheet(true);
  }
  async function saveBody(btn) {
    var s = UI.sheet; if (!s) return;
    if (num(s.weight) == null && num(s.fat) == null && num(s.muscle) == null && num(s.waist) == null) { toast('Впиши хотя бы один показатель'); return; }
    if (btn) btn.disabled = true;
    var row = { owner: X.ME, day: s.day || T(), weight: num(s.weight), fat: num(s.fat), muscle: num(s.muscle), waist: num(s.waist), note: s.note || '', photos: s.photos, ai: s.ai || null };
    try {
      var saved = s.id ? await q(sb.from('body_log').update(row).eq('id', s.id).select().single()) : await q(sb.from('body_log').insert(row).select().single());
      var i = H.body.findIndex(function (x) { return x.id === saved.id; });
      if (i >= 0) H.body[i] = saved; else H.body.push(saved);
      if (s._rm && s._rm.length) sb.storage.from(BUCKET).remove(s._rm);
      closeSheet(); render(); toast('Записано');
    } catch (e) { if (btn) btn.disabled = false; err(e); }
  }

  /* =================== окна и действия =================== */
  function sheet(s) {
    switch (s.type) {
      case 'h-meal': return { title: s.id ? 'Приём пищи' : (s.planned ? 'Запланировать еду' : 'Записать еду'), body: mealSheet(s), foot: '<button class="btn" data-a="hMealSave">' + (s.id ? 'Сохранить' : (s.planned ? 'Запланировать' : 'Записать')) + '</button>' + (s.id ? '<button class="btn2 warn" data-a="hMealDel">Удалить</button>' : '') };
      case 'h-work': return { title: s.id ? 'Тренировка' : (s.planned ? 'Запланировать тренировку' : 'Записать тренировку'), body: workSheet(s), foot: '<button class="btn" data-a="hWorkSave">' + (s.id ? 'Сохранить' : (s.planned ? 'Запланировать' : 'Записать')) + '</button>' + (s.id ? '<button class="btn2 warn" data-a="hWorkDel">Удалить</button>' : '') };
      case 'h-body': return { title: s.id ? 'Замер' : 'Новый замер', body: bodySheet(s), foot: '<button class="btn" data-a="hBodySave">Сохранить</button>' + (s.id ? '<button class="btn2 warn" data-a="hBodyDel">Удалить</button>' : '') };
      case 'h-recipe': return { title: 'Что приготовить', body: recipeSheet(s), foot: '' };
      case 'h-pantry': return { title: 'Продукт', body: field('name', 'Название', s.name) + '<div class="row2">' + numField('qty', 'Количество', s.qty) + '<label><div class="gl">Единица</div><select class="fld" data-f="unit">' + UNITS.map(function (u) { return '<option' + (u === s.unit ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></label></div><label><div class="gl">Годен до</div><input class="fld" type="date" data-f="expires" value="' + esc(s.expires || '') + '"></label>', foot: '<button class="btn" data-a="hPantrySave">Сохранить</button>' };
      case 'h-goal': return { title: 'Цель по калориям', body: '<div class="muted" style="line-height:1.5">Сколько килокалорий в день ты хочешь съедать. Эту цифру увидит и помощник при подборе рецептов.</div>' + numField('goal', 'Ккал в день', s.goal), foot: '<button class="btn" data-a="hGoalSave">Сохранить</button>' };
    }
    return { title: '', body: '' };
  }

  var actions = {
    hFoodTab: function (v) { HUI.foodTab = v; render(); },
    hKTab: function (v) { HUI.kTab = v; render(); },
    hFitTab: function (v) { HUI.fitTab = v; render(); },
    hDay: function (v) { HUI.day = v === 'prev' ? addDays(day(), -1) : v === 'next' ? addDays(day(), 1) : T(); render(); },
    hSet: function (v) {
      var s = UI.sheet; if (!s) return; var i = v.indexOf(':'), f = v.slice(0, i), val = v.slice(i + 1);
      s[f] = f === 'planned' ? val === '1' : val; renderSheet();
    },
    hPhotoDel: function (v) {
      var s = UI.sheet; if (!s) return; var p = s.photos.splice(+v, 1)[0];
      if (p) { if (BLOBS[p]) { sb.storage.from(BUCKET).remove([p]); delete BLOBS[p]; } else (s._rm = s._rm || []).push(p); }
      renderSheet();
    },
    hAnalyze: function (v) { analyze(v); },
    hMetricDel: function (v) { var s = UI.sheet; if (s && s.metrics) { s.metrics.splice(+v, 1); renderSheet(); } },
    /* еда */
    hMealNew: function () { mealOpen(null, { day: day() }); },
    hMealOpen: function (v, id) { var m = H.meals.filter(function (x) { return x.id === id; })[0]; if (m) mealOpen(m); },
    hMealSave: function (v, id, el) { saveMeal(el); },
    hMealDel: function () { var s = UI.sheet; if (s && s.id) delRecord('meals', H.meals, s.id, 'Запись'); },
    hMealChk: function (v, id) { var m = H.meals.filter(function (x) { return x.id === id; })[0]; if (m) toggleLinked(m, 'meals'); },
    hGoal: function () { UI.sheet = { type: 'h-goal', goal: X.SET.kcalGoal || '' }; renderSheet(true); },
    hGoalSave: function () { var s = UI.sheet; X.SET.kcalGoal = num(s.goal) || null; saveSettings(); closeSheet(); render(); },
    /* кухня */
    hPantryAdd: function (v, id, el) {
      var f = el.form, spice = v === 'spice';
      var name = ((f.querySelector(spice ? '#hs-name' : '#hp-name') || {}).value || '').trim(); if (!name) return;
      var row = { owner: X.ME, kind: v, name: name, unit: '' };
      if (!spice) { row.qty = num((f.querySelector('#hp-qty') || {}).value); row.unit = (f.querySelector('#hp-unit') || {}).value || ''; }
      q(sb.from('pantry').insert(row).select().single()).then(function (r) { H.pantry.push(r); H.pantry.sort(function (a, b) { return a.name < b.name ? -1 : 1; }); render(); }).catch(err);
    },
    hSpiceAdd: function (v) { q(sb.from('pantry').insert({ owner: X.ME, kind: 'spice', name: v, unit: '' }).select().single()).then(function (r) { H.pantry.push(r); render(); }).catch(err); },
    hPantryDel: function (v, id) {
      var p = H.pantry.filter(function (x) { return x.id === id; })[0]; if (!p) return;
      q(sb.from('pantry').delete().eq('id', id)).then(function () { H.pantry.splice(H.pantry.indexOf(p), 1); render(); toast(p.name + ' убрано', function () { q(sb.from('pantry').insert({ owner: X.ME, kind: p.kind, name: p.name, qty: p.qty, unit: p.unit, expires: p.expires }).select().single()).then(function (r) { H.pantry.push(r); render(); }).catch(err); }); }).catch(err);
    },
    hPantryOpen: function (v, id) { var p = H.pantry.filter(function (x) { return x.id === id; })[0]; if (p) { UI.sheet = { type: 'h-pantry', id: id, name: p.name, qty: r1(p.qty), unit: p.unit || 'г', expires: p.expires || '' }; renderSheet(true); } },
    hPantrySave: function (v, id, el) {
      var s = UI.sheet; if (!s || !(s.name || '').trim()) { toast('Напиши название'); return; } el.disabled = true;
      q(sb.from('pantry').update({ name: s.name.trim(), qty: num(s.qty), unit: s.unit, expires: s.expires || null }).eq('id', s.id).select().single()).then(function (r) { var i = H.pantry.findIndex(function (x) { return x.id === r.id; }); if (i >= 0) H.pantry[i] = r; closeSheet(); render(); }).catch(function (e) { el.disabled = false; err(e); });
    },
    hApplToggle: function (v) {
      var cur = H.appliances.filter(function (a) { return a.name.toLowerCase() === v.toLowerCase(); })[0];
      if (cur) q(sb.from('appliances').delete().eq('id', cur.id)).then(function () { H.appliances.splice(H.appliances.indexOf(cur), 1); render(); }).catch(err);
      else q(sb.from('appliances').insert({ owner: X.ME, name: v }).select().single()).then(function (r) { H.appliances.push(r); render(); }).catch(err);
    },
    hApplAdd: function (v, id, el) { var n = ((el.form.querySelector('#ha-name') || {}).value || '').trim(); if (n) actions.hApplToggle(n); },
    hRecipeOpen: function () { UI.sheet = { type: 'h-recipe', text: '', recipes: null }; renderSheet(true); },
    hRecipeGo: function () { recipeGo(); },
    hRecipeEat: function (v) { var r = UI.sheet.recipes[+v]; mealOpen(null, Object.assign(recipeToMeal(r), { day: T(), at: nowHM(), planned: false })); },
    hRecipePlan: function (v) { var r = UI.sheet.recipes[+v]; mealOpen(null, Object.assign(recipeToMeal(r), { day: T(), kind: 'dinner', planned: true })); },
    /* тренировки */
    hWorkNew: function () { workOpen(null); },
    hWorkOpen: function (v, id) { var w = H.workouts.filter(function (x) { return x.id === id; })[0]; if (w) workOpen(w); },
    hWorkSave: function (v, id, el) { saveWork(el); },
    hWorkDel: function () { var s = UI.sheet; if (s && s.id) delRecord('workouts', H.workouts, s.id, 'Тренировка'); },
    hWorkChk: function (v, id) { var w = H.workouts.filter(function (x) { return x.id === id; })[0]; if (w) toggleLinked(w, 'workouts'); },
    hBodyNew: function () { bodyOpen(null); },
    hBodyOpen: function (v, id) { var b = H.body.filter(function (x) { return x.id === id; })[0]; if (b) bodyOpen(b); },
    hBodySave: function (v, id, el) { saveBody(el); },
    hBodyDel: function () { var s = UI.sheet; if (s && s.id) delRecord('body_log', H.body, s.id, 'Замер'); }
  };

  /* поля формы пишем в состояние окна, чтобы перерисовка ничего не стирала */
  function isH() { return UI.sheet && String(UI.sheet.type).indexOf('h-') === 0; }
  document.addEventListener('input', function (e) {
    var el = e.target; if (!isH() || !el.getAttribute || !el.getAttribute('data-f')) return;
    UI.sheet[el.getAttribute('data-f')] = el.value;
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (!isH() || !el.getAttribute) return;
    var f = el.getAttribute('data-f'); if (f) UI.sheet[f] = el.value;
    if (el.hasAttribute('data-hfile') && el.files && el.files.length) { var files = Array.prototype.slice.call(el.files); el.value = ''; addPhotos(files); }
  });

  Object.assign(A, actions);
  window.HEALTH = { load: load, foodView: foodView, fitView: fitView, sheet: sheet };
  /* если основное приложение уже успело загрузиться раньше этого файла — догружаем данные разделов */
  if (X.ME && X.D.profiles.length) load().then(function () { render(); });
})();
