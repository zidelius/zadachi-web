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

  var CAM = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
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
        q(sb.from('workouts').select('*').gte('day', addDays(T(), -365)).order('day').order('at', { nullsFirst: true })),
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
      h += '<label class="hadd">' + CAM + '<span>' + (s._up ? 'Загрузка…' : 'Снять') + '</span><input type="file" accept="image/*" capture="environment" data-hfile hidden></label>';
      h += '<label class="hadd">' + I('inbox') + '<span>Галерея</span><input type="file" accept="image/*" multiple data-hfile hidden></label>';
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
        s.micros = cleanMicros(r.micros);
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

  /* Пересчёт по этикетке: цифры «на 100 г» умножаются на вес порции.
     Если цифр ещё нет, но есть фото — сначала считываем их с этикетки (ИИ), потом пересчитываем. */
  /* микроэлементы: только числа больше нуля, до 4 знаков */
  function cleanMicros(m) {
    var out = {}, n = 0;
    Object.keys(m || {}).forEach(function (k) { var v = num(m[k]); if (v != null && v > 0) { out[k] = Math.round(v * 1000) / 1000; n++; } });
    return n ? out : null;
  }
  function scaleLabel(s) {
    var g = num(s.grams), k = g / 100;
    var put = function (f, p) { var v = num(s[p]); s[f] = v == null ? '' : r1(v * k); };
    put('kcal', 'p_kcal'); put('protein', 'p_protein'); put('fat', 'p_fat'); put('carbs', 'p_carbs');
    if (s.pm) { var sc = {}; Object.keys(s.pm).forEach(function (key) { sc[key] = s.pm[key] * k; }); s.micros = cleanMicros(sc); }
    s._note = 'Пересчитано на ' + r1(g) + ' г по этикетке (на 100 г: ' + [s.p_kcal ? s.p_kcal + ' ккал' : '', s.p_protein ? 'Б ' + s.p_protein : '', s.p_fat ? 'Ж ' + s.p_fat : '', s.p_carbs ? 'У ' + s.p_carbs : ''].filter(Boolean).join(', ') + ').';
    s._err = '';
  }
  async function labelGo() {
    var s = UI.sheet; if (!s || s._busy) return;
    var haveNums = ['p_kcal', 'p_protein', 'p_fat', 'p_carbs'].some(function (f) { return num(s[f]) != null; });
    var g = num(s.grams);
    if (haveNums) {
      if (g == null || g <= 0) { toast('Впиши вес порции в граммах'); return; }
      scaleLabel(s); renderSheet(); return;
    }
    if (!s.photos.length) { toast('Добавь фото этикетки или впиши цифры на 100 г'); return; }
    s._busy = true; s._err = ''; renderSheet();
    try {
      var images = [];
      for (var i = 0; i < s.photos.length; i++) images.push({ media_type: 'image/jpeg', data: await blobB64(await photoBlob(s.photos[i])) });
      var r = await callAI({ mode: 'label', images: images, text: '' });
      if (UI.sheet !== s) return;
      var p = r.per100 || {};
      s.p_kcal = r1(p.kcal); s.p_protein = r1(p.protein); s.p_fat = r1(p.fat); s.p_carbs = r1(p.carbs);
      s.pm = cleanMicros(r.micros_per100);   // микроэлементы на 100 г, если указаны на этикетке
      s.ai = Object.assign({}, s.ai || {}, { label: r });
      if (!s.title && r.name) s.title = r.name;
      if (!['p_kcal', 'p_protein', 'p_fat', 'p_carbs'].some(function (f) { return s[f] !== ''; })) {
        s._err = 'На фото не нашлась таблица пищевой ценности. ' + (r.notes || 'Сфотографируй её ближе и ровнее или впиши цифры вручную.');
      } else if (g == null || g <= 0) {
        s._note = 'Цифры с этикетки считаны (на 100 г)' + (r.serving_g ? '. Порция по упаковке: ' + r1(r.serving_g) + ' г' : '') + '. Проверь их, впиши вес порции и нажми «Пересчитать» ещё раз. ' + (r.notes || '');
      } else { scaleLabel(s); if (r.notes) s._note += ' ' + r.notes; }
    } catch (e) { s._err = e.message || 'Не получилось'; }
    s._busy = false; if (UI.sheet === s) renderSheet();
  }

  /* ---------- связь с обычными задачами ---------- */
  /* Настройки напоминания у задачи: за сколько минут (lead: -1 — без напоминания) и через сколько повторять (nag, минуты) */
  function remindFields(time, rem) {
    var lead = rem && rem.lead != null ? +rem.lead : 0, nag = rem && rem.nag != null ? +rem.nag : 10;
    if (!time || lead < 0 || isNaN(lead)) return { due_time: null, remind_every: 0, remind_times: 0, lead: -1 };
    var p = time.split(':'), m = Math.max(0, (+p[0]) * 60 + (+p[1]) - lead);
    return { due_time: String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'), remind_every: nag || 0, remind_times: nag ? 3 : 0, lead: lead };
  }
  function taskTitle(prefix, title, time, rf) {
    var same = !title || String(title).trim().toLowerCase() === String(prefix).trim().toLowerCase();   // «Обед: Обед» не нужно
    return (prefix + (same ? '' : ': ' + title) + (rf.lead > 0 && time ? ' · в ' + time : '')).slice(0, 200);
  }
  async function makeTask(prefix, title, dayKey, time, rem) {
    var rf = remindFields(time, rem);
    var r = await createTask({
      title: taskTitle(prefix, title, time, rf),
      due_date: dayKey, due_time: rf.due_time,
      remind_every: rf.remind_every, remind_times: rf.remind_times
    });
    return r ? r.id : null;
  }
  function patchLinkedTask(taskId, prefix, title, dayKey, time, rem) {
    var rf = remindFields(time, rem);
    patchTask(taskId, { title: taskTitle(prefix, title, time, rf), due_date: dayKey, due_time: rf.due_time, remind_every: rf.remind_every, remind_times: rf.remind_times });
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
  /* повторяющиеся напоминания (каждый день в 8:30 и т. п.): живут в разделе «Здоровье» (wellbeing.js) */
  function bellBtn(kind) { return window.WELL ? '<button class="btn2 hbell" data-a="wPlans" data-v="' + kind + '" aria-label="Напоминания">' + I('bell') + '</button>' : ''; }
  function foodView() {
    var d = day(), h = '<div class="top"><div><div class="date">' + fmtLong(T()) + '</div><h1 class="dh">Питание</h1></div>' +
      '<div class="tbtns">' + bellBtn('meal') + (HUI.foodTab === 'day' ? '<button class="btn2" data-a="hMealNew">' + I('plus') + 'Добавить</button>' : '') + '</div></div>';
    h += tabs([['day', 'День'], ['kitchen', 'Кухня']], HUI.foodTab, 'hFoodTab');
    if (!H.ok) return h + notReady();
    return h + (HUI.foodTab === 'day' ? foodDay(d) : kitchenView());
  }
  /* Белки, жиры, углеводы за день: с целями — полоски прогресса и остаток, без целей — просто цифры */
  function macroBlock(t) {
    var goals = [num(X.SET.proteinGoal), num(X.SET.fatGoal), num(X.SET.carbsGoal)], any = goals.some(function (g) { return g; });
    var items = [['Белки', t.protein], ['Жиры', t.fat], ['Углеводы', t.carbs]];
    if (!any) return '<div class="hmac">' + items.map(function (it) { return '<span><b>' + Math.round(it[1]) + '</b> ' + it[0] + '</span>'; }).join('') + '</div>';
    var h = '<div class="hmacros">' + items.map(function (it, i) {
      var g = goals[i], v = it[1];
      return '<div class="hmc"><div class="hmn"><span>' + it[0] + '</span><b>' + Math.round(v) + (g ? ' / ' + Math.round(g) : '') + ' г</b></div>' +
        (g ? '<div class="hbar"><i style="width:' + Math.min(100, Math.round(v / g * 100)) + '%' + (v > g * 1.05 ? ';background:var(--warn)' : '') + '"></i></div>' : '') + '</div>';
    }).join('') + '</div>';
    var kg = num(X.SET.kcalGoal), left = [];
    if (kg) left.push(Math.round(kg - totalsNow.kcal) + ' ккал');
    items.forEach(function (it, i) { if (goals[i]) left.push(it[0][0] + ' ' + Math.round(goals[i] - it[1])); });
    return h + '<div class="muted" style="margin-top:10px;font-size:13px">Осталось: ' + left.join(' · ') + '</div>';
  }
  var totalsNow = { kcal: 0 };
  function foodDay(d) {
    var t = totals(d), goal = num(X.SET.kcalGoal), ms = mealsOf(d);
    totalsNow = t;
    var h = '<div class="calnav"><button class="iconbtn" data-a="hDay" data-v="prev" aria-label="Предыдущий день">' + I('left') + '</button>' +
      '<button class="link" data-a="hDay" data-v="today"><b>' + esc(dayWord(d)) + '</b></button>' +
      '<button class="iconbtn" data-a="hDay" data-v="next" aria-label="Следующий день">' + I('right') + '</button></div>';
    var pct = goal ? Math.min(100, Math.round(t.kcal / goal * 100)) : 0;
    h += '<div class="hsum"><div class="hk"><b>' + Math.round(t.kcal) + '</b><span>ккал' + (goal ? ' из ' + Math.round(goal) : '') + '</span>' +
      '<button class="link" data-a="hGoal">' + (goal || num(X.SET.proteinGoal) || num(X.SET.fatGoal) || num(X.SET.carbsGoal) ? 'изменить цели' : 'задать цели') + '</button></div>' +
      (goal ? '<div class="hbar"><i style="width:' + pct + '%' + (t.kcal > goal * 1.05 ? ';background:var(--warn)' : '') + '"></i></div>' : '') +
      macroBlock(t) +
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
      h += section('Готовое блюдо', field('hint', '', s.hint || '', 'placeholder="Подсказка: порция 250 г, съел половину…" aria-label="Подсказка для расчёта" autocomplete="off"') +
        '<button type="button" class="btn2" style="margin-top:8px;width:100%" data-a="hAnalyze" data-v="food"' + (s._busy ? ' disabled' : '') + '>' + I('spark') + (s._busy ? 'Считаю…' : 'Оценить блюдо по фото') + '</button>');
    }
    h += section('Этикетка: цифры на 100 г',
      '<div class="row4">' + numField('p_kcal', 'Ккал', s.p_kcal) + numField('p_protein', 'Белки', s.p_protein) + numField('p_fat', 'Жиры', s.p_fat) + numField('p_carbs', 'Углев.', s.p_carbs) + '</div>' +
      '<div style="margin-top:10px">' + numField('grams', 'Вес порции, г', s.grams) + '</div>' +
      '<button type="button" class="btn2" style="margin-top:10px;width:100%" data-a="hLabel"' + (s._busy ? ' disabled' : '') + '>' + I('repeat') + (s._busy ? 'Считываю…' : 'Пересчитать по этикетке') + '</button>' +
      '<div class="muted" style="font-size:13px;line-height:1.45;margin-top:8px">Сфотографируй этикетку, впиши вес порции и нажми «Пересчитать»: цифры на 100 г пересчитаются на твой вес. Цифры можно вписать и вручную.</div>');
    if (s._err) h += '<div class="herr">' + esc(s._err) + '</div>';
    if (s._note) h += '<div class="hnote">' + esc(s._note) + '</div>';
    if ((s.items || []).length) h += '<div class="fields">' + s.items.map(function (i) { return '<div class="fr"><span>' + esc(i.name) + (i.grams ? ', ' + Math.round(i.grams) + ' г' : '') + '</span><b style="font-weight:500">' + Math.round(i.kcal || 0) + ' ккал</b></div>'; }).join('') + '</div>';
    h += section('Итого в порции', '<div class="row2">' + numField('kcal', 'Ккал', s.kcal) + '</div><div class="row3" style="margin-top:10px">' + numField('protein', 'Белки, г', s.protein) + numField('fat', 'Жиры, г', s.fat) + numField('carbs', 'Углеводы, г', s.carbs) + '</div>');
    h += microBlock(s);
    if (s.planned) h += remindBlock(s);
    h += field('note', 'Заметка', s.note, 'autocomplete="off"');
    return h;
  }
  function nutMeta(k) { return window.WELL && WELL.nutMeta ? WELL.nutMeta(k) : { n: k, u: '' }; }
  function microBlock(s) {
    var keys = Object.keys(s.micros || {});
    var list = keys.length
      ? '<details class="wdet"><summary>Оценка есть: ' + keys.length + ' ' + plural(keys.length, 'показатель', 'показателя', 'показателей') + '</summary><div class="fields">' + keys.map(function (k) { var m = nutMeta(k); return '<div class="fr"><span>' + esc(m.n) + '</span><b style="font-weight:500">' + r1(s.micros[k]) + ' ' + esc(m.u) + '</b></div>'; }).join('') + '</div></details>'
      : '<div class="muted" style="font-size:13px;line-height:1.45">Витамины и минералы пока не оценены. Они нужны для раздела «Здоровье».</div>';
    return section('Витамины и минералы', list + '<button type="button" class="btn2" style="width:100%;margin-top:8px" data-a="hMicro"' + (s._microBusy ? ' disabled' : '') + '>' + I('spark') + (s._microBusy ? 'Оцениваю…' : (keys.length ? 'Оценить заново' : 'Оценить витамины и минералы')) + '</button>' + (s._microErr ? '<div class="herr" style="margin-top:8px">' + esc(s._microErr) + '</div>' : ''));
  }
  async function microGo() {
    var s = UI.sheet; if (!s || s._microBusy) return;
    if (!(s.title || '').trim() && !s.photos.length) { toast('Сначала напиши, что это, или добавь фото'); return; }
    s._microBusy = true; s._microErr = ''; renderSheet();
    try {
      var r = await callAI({ mode: 'micro', title: s.title || 'Приём пищи', grams: num(s.grams), kcal: num(s.kcal), protein: num(s.protein), fat: num(s.fat), carbs: num(s.carbs), text: s.hint || '' });
      if (UI.sheet !== s) return;
      s.micros = cleanMicros(r.micros);
      if (!s.micros) s._microErr = 'Не удалось оценить: ' + (r.notes || 'слишком мало данных о блюде.');
      else if (r.notes) s._note = (s._note ? s._note + ' ' : '') + r.notes;
    } catch (e) { s._microErr = e.message || 'Не получилось'; }
    s._microBusy = false; if (UI.sheet === s) renderSheet();
  }

  /* Напоминание о запланированной еде или тренировке: за сколько минут и сколько раз повторять, пока не отмечу */
  function remindBlock(s) {
    return section('Напоминание', chipSet('lead', [['-1', 'Без напоминания'], ['0', 'В это время'], ['15', 'За 15 мин'], ['30', 'За 30 мин'], ['60', 'За 1 час']], s.lead == null ? '0' : s.lead) +
      (String(s.lead == null ? '0' : s.lead) === '-1' ? '' : '<div style="margin-top:8px">' + chipSet('nag', [['0', 'Не повторять'], ['10', 'Повторять через 10 мин'], ['30', 'Через 30 мин']], s.nag == null ? '10' : s.nag) + '</div>') +
      (!s.at && String(s.lead == null ? '0' : s.lead) !== '-1' ? '<div class="muted" style="font-size:13px;margin-top:6px">Укажи время, иначе уведомление не придёт.</div>' : ''));
  }
  function mealOpen(m, preset) {
    var base = { type: 'h-meal', id: null, day: day(), at: '', kind: guessKind(), title: '', grams: '', kcal: '', protein: '', fat: '', carbs: '', p_kcal: '', p_protein: '', p_fat: '', p_carbs: '', note: '', photos: [], planned: false, _rm: [] };
    if (m) {
      base = Object.assign(base, { id: m.id, day: m.day, at: hm(m.at), kind: m.kind, title: m.title, grams: r1(m.grams), kcal: r1(m.kcal), protein: r1(m.protein), fat: r1(m.fat), carbs: r1(m.carbs), note: m.note || '', photos: (m.photos || []).slice(), planned: m.planned, task_id: m.task_id, ai: m.ai, micros: m.micros || null });
      var p100 = m.ai && m.ai.per100;   // цифры с этикетки сохраняются, чтобы пересчитать при правке веса
      if (p100) Object.assign(base, { p_kcal: r1(p100.kcal), p_protein: r1(p100.protein), p_fat: r1(p100.fat), p_carbs: r1(p100.carbs) });
      if (m.ai && m.ai.pm) base.pm = m.ai.pm;
      if (m.ai && m.ai.remind) Object.assign(base, { lead: m.ai.remind.lead, nag: m.ai.remind.nag });
    }
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
    var per = { kcal: num(s.p_kcal), protein: num(s.p_protein), fat: num(s.p_fat), carbs: num(s.p_carbs) };
    if (per.kcal != null || per.protein != null || per.fat != null || per.carbs != null) row.ai = Object.assign({}, row.ai || {}, { per100: per });
    if (s.pm) row.ai = Object.assign({}, row.ai || {}, { pm: s.pm });
    if (s.planned) row.ai = Object.assign({}, row.ai || {}, { remind: { lead: s.lead == null ? '0' : s.lead, nag: s.nag == null ? '10' : s.nag } });
    row.micros = cleanMicros(s.micros);
    try {
      if (s.planned) {
        var k = KIND[s.kind] || KIND.snack;
        var rem = { lead: s.lead == null ? '0' : s.lead, nag: s.nag == null ? '10' : s.nag };
        if (s.id && s.task_id && findTask(s.task_id)) patchLinkedTask(s.task_id, k.name, row.title, row.day, row.at, rem);
        else if (!s.task_id) row.task_id = await makeTask(k.name, row.title, row.day, row.at, rem);
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
        macros: { protein: num(X.SET.proteinGoal), fat: num(X.SET.fatGoal), carbs: num(X.SET.carbsGoal) },
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
    var h = '<div class="top"><div><div class="date">' + fmtLong(T()) + '</div><h1 class="dh">Тренировки</h1></div><div class="tbtns">' + bellBtn('workout') + '<button class="btn2" data-a="' + (HUI.fitTab === 'body' ? 'hBodyNew' : 'hWorkNew') + '">' + I('plus') + (HUI.fitTab === 'body' ? 'Замер' : 'Добавить') + '</button></div></div>';
    h += tabs([['log', 'Тренировки'], ['load', 'Нагрузка'], ['prog', 'Прогресс'], ['body', 'Замеры']], HUI.fitTab, 'hFitTab');
    if (!H.ok) return h + notReady();
    return h + (HUI.fitTab === 'log' ? workLog() : HUI.fitTab === 'load' ? loadView() : HUI.fitTab === 'prog' ? progView() : bodyView());
  }
  function workRow(w) {
    var d = isDone(w), k = FKIND[w.kind] || FKIND.other;
    var lead = w.planned
      ? '<button class="chk' + (d ? ' on' : '') + '" data-a="hWorkChk" data-id="' + w.id + '" aria-label="Отметить"><span>' + (d ? I('check') : '') + '</span></button>'
      : '<span class="hdot">' + I(k.icon) + '</span>';
    var exs = w.exercises || [], nsets = exs.reduce(function (a, e) { return a + workingSets(e).length; }, 0);
    var meta = '<span>' + k.name + (hm(w.at) ? ', ' + hm(w.at) : '') + '</span>' + (exs.length ? '<span class="tm">' + exs.length + ' упр., ' + nsets + ' ' + plural(nsets, 'подход', 'подхода', 'подходов') + '</span>' : '') + (w.minutes != null ? '<span class="tm">' + Math.round(w.minutes) + ' мин</span>' : '') +
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
    if (s.kind === 'strength') h += liftBlock(s);
    h += section('Фото экрана тренажёра, часов, веса на штанге', photoBlock(s));
    if ((s.photos || []).length) h += '<button type="button" class="btn2" data-a="hAnalyze" data-v="fit"' + (s._busy ? ' disabled' : '') + '>' + I('spark') + (s._busy ? 'Считываю…' : 'Считать цифры с фото') + '</button>';
    if (s._err) h += '<div class="herr">' + esc(s._err) + '</div>';
    if (s._note) h += '<div class="hnote">' + esc(s._note) + '</div>';
    if ((s.metrics || []).length) h += '<div class="fields">' + s.metrics.map(function (m, i) { return '<div class="fr"><span>' + esc(m.name) + '</span><b style="font-weight:500">' + esc(m.value) + (m.unit ? ' ' + esc(m.unit) : '') + '</b><button type="button" class="iconbtn" data-a="hMetricDel" data-v="' + i + '" aria-label="Убрать">' + I('x') + '</button></div>'; }).join('') + '</div>';
    h += '<div class="row2">' + numField('minutes', 'Минуты', s.minutes) + numField('kcal', 'Ккал', s.kcal) + '</div>';
    if (s.planned) h += remindBlock(s);
    h += field('note', 'Заметка', s.note, 'autocomplete="off"');
    return h;
  }
  function workOpen(w, preset) {
    var base = { type: 'h-work', id: null, day: T(), at: '', kind: 'strength', title: '', minutes: '', kcal: '', note: '', photos: [], metrics: [], exercises: [], liftText: '', planned: false, _rm: [] };
    if (w) base = Object.assign(base, { id: w.id, day: w.day, at: hm(w.at), kind: w.kind, title: w.title, minutes: r1(w.minutes), kcal: r1(w.kcal), note: w.note || '', photos: (w.photos || []).slice(), metrics: (w.metrics || []).slice(), exercises: JSON.parse(JSON.stringify(w.exercises || [])), liftText: (w.ai && w.ai.liftText) || '', planned: w.planned, task_id: w.task_id, ai: w.ai });
    if (w && w.ai && w.ai.remind) Object.assign(base, { lead: w.ai.remind.lead, nag: w.ai.remind.nag });
    if (preset) Object.assign(base, preset);
    UI.sheet = base; renderSheet(true);
  }
  async function saveWork(btn) {
    var s = UI.sheet; if (!s) return;
    var k = FKIND[s.kind] || FKIND.other, title = (s.title || '').trim() || k.name;
    if (btn) btn.disabled = true;
    var exs = cleanExercises(s.exercises);
    var row = { owner: X.ME, day: s.day || T(), at: s.at || null, kind: s.kind, title: title, minutes: num(s.minutes), kcal: num(s.kcal), note: s.note || '', photos: s.photos, metrics: s.metrics || [], exercises: exs, planned: !!s.planned, ai: s.ai || null };
    if ((s.liftText || '').trim()) row.ai = Object.assign({}, row.ai || {}, { liftText: s.liftText });
    if (s.planned) row.ai = Object.assign({}, row.ai || {}, { remind: { lead: s.lead == null ? '0' : s.lead, nag: s.nag == null ? '10' : s.nag } });
    try {
      if (s.planned) {
        var remW = { lead: s.lead == null ? '0' : s.lead, nag: s.nag == null ? '10' : s.nag };
        if (s.id && s.task_id && findTask(s.task_id)) patchLinkedTask(s.task_id, 'Тренировка', title, row.day, row.at, remW);
        else if (!s.task_id) row.task_id = await makeTask('Тренировка', title, row.day, row.at, remW);
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

  /* =================== СИЛОВЫЕ: упражнения, нагрузка на мышцы, прогресс =================== */
  var MUS = {
    chest: 'Грудные', 'front-deltoids': 'Передние и средние дельты', 'back-deltoids': 'Задние дельты', biceps: 'Бицепс',
    triceps: 'Трицепс', forearm: 'Предплечья', abs: 'Пресс', obliques: 'Косые мышцы живота', trapezius: 'Трапеции',
    'upper-back': 'Широчайшие и спина', 'lower-back': 'Поясница', gluteal: 'Ягодичные', quadriceps: 'Квадрицепс',
    hamstring: 'Задняя поверхность бедра', adductor: 'Приводящие бедра', abductors: 'Отводящие бедра', calves: 'Икры', neck: 'Шея'
  };
  /* Красный цвет = столько подходов на мышцу, сколько обычно хватает для максимальной нагрузки:
     за одну тренировку 8 условных подходов, за неделю 12. Основная мышца в подходе считается за 1, вторичная за 0,5. */
  var TARGET = { workout: 8, week: 12 };
  function fmtN(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
  function normName(n) { return String(n || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(); }
  function workingSets(ex) { return (ex.sets || []).filter(function (s) { return !s.warmup && +s.reps > 0; }); }
  function mapMuscles(arr) {
    var m = {};
    (arr || []).forEach(function (x) { if (x && MUS[x.muscle] && +x.weight > 0) m[x.muscle] = Math.min(1, +x.weight); });
    return m;
  }
  function cleanExercises(list) {
    return (list || []).map(function (e) {
      return {
        name: String(e.name || '').trim(), muscles: e.muscles || {},
        sets: (e.sets || []).map(function (st) { return { reps: Math.round(+st.reps) || 0, weight: st.weight === '' || st.weight == null || isNaN(+st.weight) ? null : +st.weight, warmup: !!st.warmup }; }).filter(function (st) { return st.reps > 0; })
      };
    }).filter(function (e) { return e.name && e.sets.length; });
  }
  function loadOf(workouts) {
    var L = {};
    workouts.forEach(function (w) {
      (w.exercises || []).forEach(function (ex) {
        var n = workingSets(ex).length; if (!n) return;
        Object.keys(ex.muscles || {}).forEach(function (m) { L[m] = (L[m] || 0) + n * ex.muscles[m]; });
      });
    });
    return L;
  }
  function heat(v) {   // 0 — зелёный (нет нагрузки), 1 — красный (максимум), между ними жёлтый и оранжевый
    v = Math.max(0, Math.min(1, v));
    return 'hsl(' + Math.round(120 * (1 - v)) + ',68%,' + (v > 0.55 ? 46 : 42) + '%)';
  }
  function bodyMap(L, target) {
    if (!window.ANATOMY) return '';
    var fig = function (side, label) {
      return '<div class="hbfig"><svg viewBox="0 0 1000 2000" class="hbody" role="img" aria-label="' + label + '">' + window.ANATOMY[side].map(function (g) {
        var key = (g.m === 'left-soleus' || g.m === 'right-soleus') ? 'calves' : g.m;
        var fill = (key === 'head' || key === 'knees') ? 'var(--soft)' : heat((L[key] || 0) / target);
        return g.p.map(function (p) { return '<polygon points="' + p + '" fill="' + fill + '" stroke="var(--bg)" stroke-width="7" stroke-linejoin="round"></polygon>'; }).join('');
      }).join('') + '</svg><div>' + label + '</div></div>';
    };
    return '<div class="hbodies">' + fig('front', 'Спереди') + fig('back', 'Сзади') + '</div>' +
      '<div class="hlegend"><span>нет нагрузки</span><i></i><span>максимум</span></div>';
  }
  function muscleList(L, target) {
    var keys = Object.keys(MUS).filter(function (k) { return (L[k] || 0) > 0; }).sort(function (a, b) { return L[b] - L[a]; });
    var h = keys.map(function (k) {
      var v = L[k] / target;
      return '<div class="hml"><div class="hmn"><span>' + MUS[k] + '</span><b>' + fmtN(L[k]) + '</b></div><div class="hbar"><i style="width:' + Math.round(Math.min(1, v) * 100) + '%;background:' + heat(v) + '"></i></div></div>';
    }).join('');
    var rest = Object.keys(MUS).filter(function (k) { return !(L[k] > 0); }).map(function (k) { return MUS[k].toLowerCase(); });
    if (rest.length && keys.length) h += '<div class="muted" style="font-size:13px;margin-top:8px;line-height:1.45">Без нагрузки: ' + esc(rest.join(', ')) + '.</div>';
    return h;
  }
  function doneLifts() {
    return H.workouts.filter(function (w) { return isDone(w) && (w.exercises || []).length; }).sort(function (a, b) { return (a.day + hm(a.at)) < (b.day + hm(b.at)) ? -1 : 1; });
  }
  function knownExercises() {
    var seen = {}, out = [];
    H.workouts.forEach(function (w) { (w.exercises || []).forEach(function (e) { var k = normName(e.name); if (k && !seen[k]) { seen[k] = 1; out.push(e.name); } }); });
    return out;
  }

  /* --- блок упражнений в форме тренировки --- */
  function liftBlock(s) {
    var h = '<div><div class="gl">Что делал на тренировке</div>' +
      '<textarea class="fld hta" data-f="liftText" rows="5" placeholder="Своими словами: жим лёжа 4×8 по 80 кг, подтягивания 3×10, разводка гантелей 3×12 по 14 кг…" aria-label="Упражнения и подходы">' + esc(s.liftText || '') + '</textarea>' +
      '<button type="button" class="btn2" style="margin-top:8px;width:100%" data-a="hLift"' + (s._lifting ? ' disabled' : '') + '>' + I('spark') + (s._lifting ? 'Разбираю…' : ((s.exercises || []).length ? 'Разобрать заново' : 'Разобрать и посчитать нагрузку')) + '</button>';
    if (s._liftErr) h += '<div class="herr" style="margin-top:8px">' + esc(s._liftErr) + '</div>';
    if (s._liftNote) h += '<div class="hnote" style="margin-top:8px">' + esc(s._liftNote) + '</div>';
    h += '</div>';
    var exs = s.exercises || [];
    exs.forEach(function (e, i) {
      h += '<div class="hex"><div class="hexh"><input class="fld" data-ex="' + i + ':name" value="' + esc(e.name) + '" aria-label="Название упражнения"><button type="button" class="iconbtn" data-a="hExDel" data-v="' + i + '" aria-label="Убрать упражнение">' + I('trash') + '</button></div>';
      (e.sets || []).forEach(function (st, j) {
        h += '<div class="hset"><span class="n">' + (j + 1) + '</span><input class="fld" inputmode="numeric" data-ex="' + i + ':' + j + ':reps" value="' + esc(st.reps) + '" aria-label="Повторы"><span>×</span><input class="fld" inputmode="decimal" data-ex="' + i + ':' + j + ':weight" value="' + esc(st.weight == null ? '' : st.weight) + '" placeholder="свой вес" aria-label="Вес, кг"><span class="u">кг</span>' +
          '<label class="hwarm"><input type="checkbox" data-ex="' + i + ':' + j + ':warmup"' + (st.warmup ? ' checked' : '') + '>разм.</label><button type="button" class="iconbtn" data-a="hSetDel" data-v="' + i + ':' + j + '" aria-label="Убрать подход">' + I('x') + '</button></div>';
      });
      var mus = Object.keys(e.muscles || {}).sort(function (a, b) { return e.muscles[b] - e.muscles[a]; }).map(function (k) { return (MUS[k] || k) + (e.muscles[k] < 1 ? ' ×' + fmtN(e.muscles[k]) : ''); });
      h += '<button type="button" class="btn2 hsetadd" data-a="hSetAdd" data-v="' + i + '">' + I('plus') + 'Подход</button>' + (mus.length ? '<div class="muted" style="font-size:12.5px;line-height:1.4;margin-top:8px">Работают: ' + esc(mus.join(', ')) + '</div>' : '') + '</div>';
    });
    if (exs.length) {
      var L = loadOf([{ exercises: cleanExercises(exs) }]);
      h += '<div><div class="gl">Нагрузка на мышцы в этой тренировке</div>' + bodyMap(L, TARGET.workout) + muscleList(L, TARGET.workout) + '</div>';
    }
    return h;
  }
  async function liftGo() {
    var s = UI.sheet; if (!s || s._lifting) return;
    var text = (s.liftText || '').trim();
    if (!text) { toast('Напиши, что делал на тренировке'); return; }
    s._lifting = true; s._liftErr = ''; renderSheet();
    try {
      var r = await callAI({ mode: 'lift', text: text, known: knownExercises() });
      if (UI.sheet !== s) return;
      s.exercises = (r.exercises || []).map(function (e) {
        return { name: e.name, muscles: mapMuscles(e.muscles), sets: (e.sets || []).filter(function (x) { return +x.reps > 0; }).map(function (x) { return { reps: Math.round(+x.reps), weight: x.weight_kg == null ? null : +x.weight_kg, warmup: !!x.warmup }; }) };
      }).filter(function (e) { return e.sets.length; });
      s.kind = 'strength';
      if (!(s.title || '').trim() && r.title) s.title = r.title;
      s._liftNote = r.notes || '';
      if (!s.exercises.length) s._liftErr = 'Не нашёл упражнений в записи. Напиши, например: «жим лёжа 4×8 по 80 кг».';
    } catch (e) { s._liftErr = e.message || 'Не получилось'; }
    s._lifting = false; if (UI.sheet === s) renderSheet();
  }

  /* --- вкладка «Нагрузка» --- */
  function loadView() {
    var lifts = doneLifts();
    if (!lifts.length) return '<div class="empty">Здесь будет схема тела: мышцы окрашиваются от зелёного (нет нагрузки) до красного (максимум) по твоим упражнениям. Запиши силовую тренировку и опиши упражнения, и схема заполнится.</div>';
    var P = HUI.loadP || '7', L, target, cap, list;
    if (P === 'last') { var w = lifts[lifts.length - 1]; list = [w]; L = loadOf(list); target = TARGET.workout; cap = esc(w.title || 'Тренировка') + ', ' + esc(dayWord(w.day)); }
    else {
      var days = +P; list = lifts.filter(function (x) { return diff(x.day, T()) > -days; }); L = loadOf(list);
      Object.keys(L).forEach(function (k) { L[k] = L[k] * 7 / days; }); target = TARGET.week;
      cap = list.length + ' ' + plural(list.length, 'тренировка', 'тренировки', 'тренировок') + ' за ' + days + ' ' + plural(days, 'день', 'дня', 'дней') + (days > 7 ? ', в пересчёте на неделю' : '');
    }
    var h = '<div class="chipsrow">' + [['7', '7 дней'], ['30', '30 дней'], ['last', 'Последняя']].map(function (p) { return '<button class="fchip' + (P === p[0] ? ' on' : '') + '" data-a="hLoadP" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="muted" style="font-size:13px;margin-top:10px">' + cap + '</div>';
    if (!list.length) return h + '<div class="empty">За этот период силовых тренировок нет, все мышцы зелёные.' + '<br><br>' + bodyMap({}, target) + '</div>';
    h += bodyMap(L, target);
    h += '<div class="gl" style="margin-top:14px">Условных подходов на мышцу' + (P === 'last' ? '' : ' в неделю') + ' (красный — от ' + target + ')</div>' + muscleList(L, target);
    return h;
  }

  /* --- вкладка «Прогресс» --- */
  function summarizeSets(sets) {
    var out = [], cur = null;
    sets.forEach(function (s) {
      var key = s.reps + '|' + s.weight;
      if (cur && cur.key === key) cur.n++; else { cur = { key: key, n: 1, reps: s.reps, weight: s.weight }; out.push(cur); }
    });
    return out.map(function (c) { return c.n + '×' + c.reps + (c.weight != null ? ' ' + fmtN(c.weight) + ' кг' : ''); }).join(', ');
  }
  function progressData() {
    var map = {};
    doneLifts().forEach(function (w) {
      (w.exercises || []).forEach(function (ex) {
        var ws = workingSets(ex); if (!ws.length) return;
        var k = normName(ex.name), rec = map[k] = map[k] || { name: ex.name, pts: [] };
        var weighted = ws.filter(function (s) { return s.weight > 0; });
        var score = weighted.length ? Math.max.apply(null, weighted.map(function (s) { return s.weight * (1 + s.reps / 30); })) : Math.max.apply(null, ws.map(function (s) { return s.reps; }));
        var vol = ws.reduce(function (a, s) { return a + s.reps * (s.weight || 0); }, 0);
        rec.pts.push({ day: w.day, score: score, kg: weighted.length > 0, summary: summarizeSets(ws), vol: vol });
      });
    });
    return map;
  }
  function lineSvg(pts, unit) {
    if (pts.length < 2) return '';
    var vals = pts.map(function (p) { return p.y; }), mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mx - mn < 1) { mx += 0.5; mn -= 0.5; }
    var t0 = fromKey(pts[0].x).getTime(), t1 = fromKey(pts[pts.length - 1].x).getTime(), W = 300, Hh = 110, pad = 8;
    var xy = pts.map(function (p) { return [pad + (t1 === t0 ? 0 : (fromKey(p.x).getTime() - t0) / (t1 - t0)) * (W - 2 * pad), pad + (1 - (p.y - mn) / (mx - mn)) * (Hh - 2 * pad)]; });
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" class="hchart" role="img" aria-label="График прогресса"><path d="' + xy.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('') + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      xy.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="currentColor"/>'; }).join('') + '</svg><div class="hrange"><span>' + fmtN(mn) + ' ' + unit + '</span><span>' + fmtN(mx) + ' ' + unit + '</span></div>';
  }
  function weeklyVolume() {
    var wk = [], mon = addDays(T(), -((new Date().getDay() + 6) % 7));
    for (var i = 11; i >= 0; i--) wk.push({ from: addDays(mon, -7 * i), v: 0 });
    doneLifts().forEach(function (w) {
      var b = wk.filter(function (x) { return w.day >= x.from && w.day < addDays(x.from, 7); })[0]; if (!b) return;
      (w.exercises || []).forEach(function (e) { workingSets(e).forEach(function (s) { b.v += s.reps * (s.weight || 0); }); });
    });
    var mx = Math.max.apply(null, wk.map(function (x) { return x.v; }));
    if (!mx) return '';
    return '<div class="hsum"><div class="hk"><b>' + Math.round(wk[11].v / 100) / 10 + '</b><span>т поднято на этой неделе</span></div><svg viewBox="0 0 300 80" class="hchart" style="height:80px" role="img" aria-label="Объём по неделям">' +
      wk.map(function (x, i) { var hh = Math.max(x.v ? 3 : 0, x.v / mx * 70); return '<rect x="' + (i * 25 + 3) + '" y="' + (76 - hh) + '" width="19" height="' + hh + '" rx="3" fill="currentColor" opacity="' + (i === 11 ? 1 : 0.45) + '"/>'; }).join('') + '</svg><div class="hrange"><span>12 недель назад</span><span>эта неделя</span></div></div>';
  }
  function progView() {
    var data = progressData(), keys = Object.keys(data);
    if (!keys.length) return '<div class="empty">Прогресс появится, когда ты запишешь несколько силовых тренировок. По каждому упражнению покажу рабочий максимум (расчётный вес на один повтор) и как он менялся.</div>';
    keys.sort(function (a, b) { return data[a].pts[data[a].pts.length - 1].day < data[b].pts[data[b].pts.length - 1].day ? 1 : -1; });
    var h = weeklyVolume();
    h += '<div class="dday">Упражнения</div>';
    keys.forEach(function (k) {
      var d = data[k], pts = d.pts, last = pts[pts.length - 1], first = pts[0], unit = last.kg ? 'кг' : 'повт.';
      var ch = '';
      if (pts.length > 1 && first.score > 0) {
        var pc = Math.round((last.score - first.score) / first.score * 100);
        ch = '<span class="' + (pc > 0 ? 'hup' : pc < 0 ? 'hdown' : '') + '">' + (pc > 0 ? '▲ +' : pc < 0 ? '▼ ' : '') + pc + '% за ' + diff(last.day, first.day) + ' ' + plural(diff(last.day, first.day), 'день', 'дня', 'дней') + '</span>';
      }
      h += '<div class="task hrow"><div class="hlead"><span class="hdot">' + I('dumb') + '</span></div><button class="tb" data-a="hProgOpen" data-v="' + esc(k) + '"><span class="tt">' + esc(d.name) + '</span><span class="meta"><span class="tm">' + esc(last.summary) + '</span><span>' + esc(dayWord(last.day)) + '</span>' + (ch || '<span>' + pts.length + ' ' + plural(pts.length, 'запись', 'записи', 'записей') + '</span>') + '</span></button></div>';
    });
    return h;
  }
  function progSheet(s) {
    var d = progressData()[s.key]; if (!d) return '<div class="empty">Нет данных</div>';
    var pts = d.pts, kg = pts[pts.length - 1].kg, best = pts.reduce(function (a, p) { return p.score > a.score ? p : a; }, pts[0]);
    var h = '<div class="muted" style="line-height:1.5">' + (kg ? 'Расчётный максимум на один повтор (формула Эпли) — лучший подход в тренировке.' : 'Максимум повторений в подходе.') + '</div>';
    h += '<div class="hsum"><div class="hk"><b>' + fmtN(best.score) + '</b><span>' + (kg ? 'кг, рекорд ' : 'повторений, рекорд ') + esc(dayWord(best.day).toLowerCase()) + '</span></div>' + lineSvg(pts.map(function (p) { return { x: p.day, y: p.score }; }), kg ? 'кг' : 'повт.') + '</div>';
    h += '<div class="fields">' + pts.slice().reverse().slice(0, 40).map(function (p) { return '<div class="fr"><span>' + esc(fmtDM(p.day)) + '</span><b style="font-weight:500;text-align:right">' + esc(p.summary) + '</b></div>'; }).join('') + '</div>';
    return h;
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
      case 'h-prog': return { title: (progressData()[s.key] || {}).name || 'Упражнение', body: progSheet(s), foot: '' };
      case 'h-pantry': return { title: 'Продукт', body: field('name', 'Название', s.name) + '<div class="row2">' + numField('qty', 'Количество', s.qty) + '<label><div class="gl">Единица</div><select class="fld" data-f="unit">' + UNITS.map(function (u) { return '<option' + (u === s.unit ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></label></div><label><div class="gl">Годен до</div><input class="fld" type="date" data-f="expires" value="' + esc(s.expires || '') + '"></label>', foot: '<button class="btn" data-a="hPantrySave">Сохранить</button>' };
      case 'h-goal': {
        var kc = num(s.goal), pp = num(s.g_p), ff = num(s.g_f), cc = num(s.g_c);
        var fromMacro = (pp != null || ff != null || cc != null) ? Math.round((pp || 0) * 4 + (ff || 0) * 9 + (cc || 0) * 4) : null;
        return { title: 'Цели на день', body:
          '<div class="muted" style="line-height:1.5">Сколько ты хочешь съедать в день. Эти цели видны в дневнике питания, их учитывает помощник при советах и подборе рецептов. Любое поле можно оставить пустым.</div>' +
          numField('goal', 'Калории, ккал', s.goal) +
          '<div class="row3">' + numField('g_p', 'Белки, г', s.g_p) + numField('g_f', 'Жиры, г', s.g_f) + numField('g_c', 'Углеводы, г', s.g_c) + '</div>' +
          (fromMacro ? '<div class="hnote">По граммам БЖУ выходит около ' + fromMacro + ' ккал' + (kc ? (Math.abs(fromMacro - kc) > kc * 0.08 ? ', это заметно отличается от цели по калориям.' : ', это сходится с целью по калориям.') : '.') + '</div>' : '') +
          (kc ? section('Рассчитать БЖУ по калориям', '<div class="chips"><button type="button" class="chip" data-a="hGoalSplit" data-v="balance">Баланс 30/30/40</button><button type="button" class="chip" data-a="hGoalSplit" data-v="protein">Больше белка 35/25/40</button><button type="button" class="chip" data-a="hGoalSplit" data-v="lowcarb">Меньше углеводов 30/35/35</button></div>') : '<div class="muted" style="font-size:13px">Впиши калории, и появятся кнопки, которые сами рассчитают БЖУ.</div>'),
          foot: '<button class="btn" data-a="hGoalSave">Сохранить</button>' };
      }
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
    hLabel: function () { labelGo(); },
    hMicro: function () { microGo(); },
    hMetricDel: function (v) { var s = UI.sheet; if (s && s.metrics) { s.metrics.splice(+v, 1); renderSheet(); } },
    /* еда */
    hMealNew: function () { mealOpen(null, { day: day() }); },
    hMealOpen: function (v, id) { var m = H.meals.filter(function (x) { return x.id === id; })[0]; if (m) mealOpen(m); },
    hMealSave: function (v, id, el) { saveMeal(el); },
    hMealDel: function () { var s = UI.sheet; if (s && s.id) delRecord('meals', H.meals, s.id, 'Запись'); },
    hMealChk: function (v, id) { var m = H.meals.filter(function (x) { return x.id === id; })[0]; if (m) toggleLinked(m, 'meals'); },
    hGoal: function () { var S = X.SET; UI.sheet = { type: 'h-goal', goal: r1(S.kcalGoal), g_p: r1(S.proteinGoal), g_f: r1(S.fatGoal), g_c: r1(S.carbsGoal) }; renderSheet(true); },
    hGoalSplit: function (v) {
      var s = UI.sheet, kc = num(s.goal); if (!kc) return;
      var sp = { balance: [0.3, 0.3, 0.4], protein: [0.35, 0.25, 0.4], lowcarb: [0.3, 0.35, 0.35] }[v] || [0.3, 0.3, 0.4];   // доли калорий: белки / жиры / углеводы
      s.g_p = String(Math.round(kc * sp[0] / 4)); s.g_f = String(Math.round(kc * sp[1] / 9)); s.g_c = String(Math.round(kc * sp[2] / 4)); renderSheet();
    },
    hGoalSave: function () {
      var s = UI.sheet, S = X.SET;
      S.kcalGoal = num(s.goal) || null; S.proteinGoal = num(s.g_p) || null; S.fatGoal = num(s.g_f) || null; S.carbsGoal = num(s.g_c) || null;
      saveSettings(); closeSheet(); render(); toast('Цели сохранены');
    },
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
    hLift: function () { liftGo(); },
    hExDel: function (v) { var s = UI.sheet; if (s && s.exercises) { s.exercises.splice(+v, 1); renderSheet(); } },
    hSetAdd: function (v) {
      var s = UI.sheet; if (!s || !s.exercises[+v]) return; var sets = s.exercises[+v].sets, l = sets[sets.length - 1];
      sets.push({ reps: l ? l.reps : 8, weight: l ? l.weight : null, warmup: false }); renderSheet();
    },
    hSetDel: function (v) {
      var s = UI.sheet, p = String(v).split(':'); if (!s || !s.exercises[+p[0]]) return;
      s.exercises[+p[0]].sets.splice(+p[1], 1); if (!s.exercises[+p[0]].sets.length) s.exercises.splice(+p[0], 1); renderSheet();
    },
    hLoadP: function (v) { HUI.loadP = v; render(); },
    hProgOpen: function (v) { UI.sheet = { type: 'h-prog', key: v }; renderSheet(true); },
    hWorkChk: function (v, id) { var w = H.workouts.filter(function (x) { return x.id === id; })[0]; if (w) toggleLinked(w, 'workouts'); },
    hBodyNew: function () { bodyOpen(null); },
    hBodyOpen: function (v, id) { var b = H.body.filter(function (x) { return x.id === id; })[0]; if (b) bodyOpen(b); },
    hBodySave: function (v, id, el) { saveBody(el); },
    hBodyDel: function () { var s = UI.sheet; if (s && s.id) delRecord('body_log', H.body, s.id, 'Замер'); }
  };

  /* поля формы пишем в состояние окна, чтобы перерисовка ничего не стирала */
  function isH() { return UI.sheet && /^[hw]-/.test(String(UI.sheet.type)); }   // окна «Питания/Тренировок» (h-) и «Здоровья» (w-)
  /* таблица упражнений: data-ex="упражнение:поле" или "упражнение:подход:поле" */
  function setEx(el) {
    var s = UI.sheet, p = el.getAttribute('data-ex').split(':'), ex = s.exercises && s.exercises[+p[0]]; if (!ex) return;
    if (p.length === 2) { ex.name = el.value; return; }
    var st = ex.sets[+p[1]]; if (!st) return;
    if (p[2] === 'reps') st.reps = parseInt(el.value, 10) || 0;
    else if (p[2] === 'weight') st.weight = num(el.value);
    else if (p[2] === 'warmup') st.warmup = el.checked;
  }
  document.addEventListener('input', function (e) {
    var el = e.target; if (!isH() || !el.getAttribute) return;
    if (el.getAttribute('data-ex')) { if (el.type !== 'checkbox') setEx(el); return; }
    if (!el.getAttribute('data-f')) return;
    UI.sheet[el.getAttribute('data-f')] = el.value;
  });
  document.addEventListener('change', function (e) {
    var el = e.target; if (!isH() || !el.getAttribute) return;
    if (el.getAttribute('data-ex')) { setEx(el); return; }
    var f = el.getAttribute('data-f'); if (f) UI.sheet[f] = el.value;
    if (f && UI.sheet.type === 'h-goal') renderSheet();   // обновить подсказку и кнопки расчёта БЖУ
    if (el.hasAttribute('data-hfile') && el.files && el.files.length) { var files = Array.prototype.slice.call(el.files); el.value = ''; addPhotos(files); }
  });

  /* =================== ПОМОЩНИК: фото и предложенные записи =================== */
  var PEND = [], PEND_UP = 0;   // фото, прикреплённые к ещё не отправленному сообщению
  function asAttach() { return '<label class="iconbtn asatt" aria-label="Прикрепить фото">' + CAM + '<input type="file" accept="image/*" multiple data-asfile hidden></label>'; }
  function asPending() {
    if (!PEND.length && !PEND_UP) return '';
    return '<div class="aspend">' + PEND.map(function (p, i) { return '<div class="hph sm"><img data-ph="' + esc(p) + '" alt="Фото"><button type="button" data-a="hAsPhDel" data-v="' + i + '" aria-label="Убрать фото">' + I('x') + '</button></div>'; }).join('') + (PEND_UP ? '<div class="hph sm hload">…</div>' : '') + '</div>';
  }
  function asPhotos(paths) { return '<div class="asph">' + paths.map(function (p) { return '<img data-ph="' + esc(p) + '" alt="Фото">'; }).join('') + '</div>'; }
  async function asImages(paths) {
    var out = [];
    for (var i = 0; i < paths.length; i++) { try { out.push({ media_type: 'image/jpeg', data: await blobB64(await photoBlob(paths[i])) }); } catch (e) { /* фото могло быть удалено */ } }
    return out;
  }
  function rerenderKeep() {
    var ta = document.getElementById('asin'), v = ta ? ta.value : '';
    render();
    var t2 = document.getElementById('asin'); if (t2 && v) t2.value = v;
  }
  async function addAsPhotos(files) {
    PEND_UP += files.length; rerenderKeep();
    for (var i = 0; i < files.length; i++) {
      try {
        if (PEND.length >= 4) throw new Error('К одному сообщению можно приложить до 4 фото');
        var b = await shrink(files[i]), path = X.ME + '/' + uid() + '.jpg';
        var u = await sb.storage.from(BUCKET).upload(path, b, { contentType: 'image/jpeg' });
        if (u.error) throw u.error;
        BLOBS[path] = b; PEND.push(path);
      } catch (e) { err(e); }
      PEND_UP--;
    }
    rerenderKeep();
  }

  var ETITLE = { meal: 'Питание', workout: 'Тренировки', body: 'Замеры', pantry: 'Холодильник', note: 'Заметки', cabinet: 'Аптечка', intake: 'Приём', lab: 'Анализы' };
  function wellOwns(t) { return !!(window.WELL && WELL.owns(t)); }   // типы записей раздела «Здоровье»
  function asEntries(a, photos) {
    var out = [], used = false;
    var withPh = function () { if (used || !photos || !photos.length) return []; used = true; return photos.slice(); };
    (a.meals || []).forEach(function (d) { out.push({ t: 'meal', d: d, photos: withPh() }); });
    (a.workouts || []).forEach(function (d) { out.push({ t: 'workout', d: d, photos: withPh() }); });
    (a.body_logs || []).forEach(function (d) { out.push({ t: 'body', d: d, photos: withPh() }); });
    if (window.WELL) out = out.concat(WELL.asEntries(a, withPh));
    (a.pantry_items || []).forEach(function (d) { out.push({ t: 'pantry', d: d }); });
    (a.new_notes || []).forEach(function (d) { out.push({ t: 'note', d: d }); });
    return out;
  }
  function entryInfo(e) {
    if (wellOwns(e.t)) return WELL.entryInfo(e);
    var d = e.d, when = function () { return (d.planned ? 'запланировано, ' : '') + dayWord(d.day || T()).toLowerCase() + (d.at ? ' ' + d.at : ''); };
    if (e.t === 'meal') {
      var k = KIND[d.kind] || KIND.snack;
      return { title: d.title, meta: [k.name, d.kcal != null ? Math.round(d.kcal) + ' ккал' : '', (d.protein != null || d.fat != null || d.carbs != null) ? 'Б ' + Math.round(d.protein || 0) + ' · Ж ' + Math.round(d.fat || 0) + ' · У ' + Math.round(d.carbs || 0) : '', d.grams ? Math.round(d.grams) + ' г' : '', when()], note: d.note };
    }
    if (e.t === 'workout') {
      var exs = d.exercises || [], ns = exs.reduce(function (a, x) { return a + workingSets(x).length; }, 0);
      return { title: d.title, meta: [(FKIND[d.kind] || FKIND.other).name, exs.length ? exs.length + ' упр., ' + ns + ' ' + plural(ns, 'подход', 'подхода', 'подходов') : '', d.minutes != null ? Math.round(d.minutes) + ' мин' : '', d.kcal != null ? Math.round(d.kcal) + ' ккал' : '']
        .concat((d.metrics || []).slice(0, 3).map(function (m) { return m.name + ' ' + m.value + (m.unit ? ' ' + m.unit : ''); })).concat([when()]), note: d.note };
    }
    if (e.t === 'body') return { title: d.weight != null ? r1(d.weight) + ' кг' : 'Замер', meta: [d.fat != null ? 'жир ' + r1(d.fat) + '%' : '', d.muscle != null ? 'мышцы ' + r1(d.muscle) + ' кг' : '', d.waist != null ? 'талия ' + r1(d.waist) + ' см' : '', dayWord(d.day || T()).toLowerCase()], note: d.note };
    if (e.t === 'pantry') return { title: d.name, meta: [d.kind === 'spice' ? 'приправа' : 'продукт', d.qty != null ? r1(d.qty) + ' ' + (d.unit || '') : '', d.expires ? 'до ' + fmtDM(d.expires) : ''], note: '' };
    return { title: d.title, meta: [], note: String(d.body || '').slice(0, 140) };
  }
  var BTN = { meal: function (d) { return d.planned ? 'Запланировать' : 'Записать в питание'; }, workout: function (d) { return d.planned ? 'Запланировать' : 'Записать тренировку'; }, body: function () { return 'Записать замер'; }, pantry: function (d) { return d.kind === 'spice' ? 'В приправы' : 'В холодильник'; }, note: function () { return 'Создать заметку'; }, cabinet: function () { return 'В аптечку'; }, intake: function () { return 'Записать приём'; }, lab: function () { return 'Записать анализы'; } };
  var DONE ={ ok: 'записано', note: 'в заметках', task: 'в задачах' };
  function asCards(m, mi) {
    var es = m.entries || []; if (!es.length) return '';
    var open = es.filter(function (e) { return !e._done; }).length, h = '';
    es.forEach(function (e, ei) {
      var inf = entryInfo(e), v = mi + ':' + ei;
      h += '<div class="prop hentry"><div style="flex:1;min-width:0"><span class="hetag">' + ETITLE[e.t] + '</span><b>' + esc(inf.title) + '</b><div class="meta">' + inf.meta.filter(Boolean).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' + (inf.note ? '<div class="muted" style="font-size:12.5px;margin-top:4px;line-height:1.4">' + esc(inf.note) + '</div>' : '') + '</div>';
      if (e._done) h += '<span class="badge">' + DONE[e._done] + '</span>';
      else {
        h += '<div class="hebtns"><button class="btn2" data-a="hAsEntry" data-v="' + v + '">' + BTN[e.t](e.d) + '</button>';
        if (e.t !== 'note') h += '<button class="link" data-a="hAsTo" data-v="' + v + ':note">в заметки</button>';
        h += '<button class="link" data-a="hAsTo" data-v="' + v + ':task">задачей</button></div>';
      }
      h += '</div>';
    });
    if (open > 1) h += '<button class="btn2" style="margin-top:8px" data-a="hAsAll" data-v="' + mi + '">Записать всё (' + open + ')</button>';
    return h;
  }
  function asSummary(m) {
    return (m.entries || []).map(function (e) {
      var inf = entryInfo(e);
      return ETITLE[e.t].toLowerCase() + ' «' + inf.title + '» (' + inf.meta.filter(Boolean).join(', ') + ')' + (e._done ? ' — ' + DONE[e._done] : '');
    }).join('; ');
  }

  /* занесение предложенных записей по разделам */
  async function addMealFrom(d, photos) {
    var k = KIND[d.kind] || KIND.snack, day = d.day || T();
    var row = { owner: X.ME, day: day, at: d.at || null, kind: d.kind in KIND ? d.kind : 'snack', title: d.title, grams: d.grams, kcal: d.kcal, protein: d.protein, fat: d.fat, carbs: d.carbs, note: d.note || '', photos: photos || [], planned: !!d.planned, ai: { source: 'assistant' } };
    if (row.planned) row.task_id = await makeTask(k.name, row.title, row.day, row.at);
    var saved = await q(sb.from('meals').insert(row).select().single()); H.meals.push(saved); HUI.day = saved.day;
  }
  async function addWorkoutFrom(d, photos) {
    var day = d.day || T();
    var row = { owner: X.ME, day: day, at: d.at || null, kind: d.kind in FKIND ? d.kind : 'other', title: d.title, minutes: d.minutes, kcal: d.kcal, note: d.note || '', photos: photos || [], metrics: d.metrics || [], exercises: cleanExercises(d.exercises), planned: !!d.planned, ai: { source: 'assistant' } };
    if (row.planned) row.task_id = await makeTask('Тренировка', row.title, row.day, row.at);
    var saved = await q(sb.from('workouts').insert(row).select().single()); H.workouts.push(saved);
  }
  async function addBodyFrom(d, photos) {
    var saved = await q(sb.from('body_log').insert({ owner: X.ME, day: d.day || T(), weight: d.weight, fat: d.fat, muscle: d.muscle, waist: d.waist, note: d.note || '', photos: photos || [], ai: { source: 'assistant' } }).select().single()); H.body.push(saved);
  }
  async function addPantryFrom(d) {
    var saved = await q(sb.from('pantry').insert({ owner: X.ME, kind: d.kind === 'spice' ? 'spice' : 'food', name: d.name, qty: d.qty, unit: d.unit || '', expires: d.expires || null }).select().single());
    H.pantry.push(saved); H.pantry.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  }
  async function addNoteFrom(title, bodyText) {
    var row = await q(sb.from('notes').insert({ owner: X.ME, title: title, body: bodyText }).select().single());
    if (X.D.notes.indexOf(row) < 0) X.D.notes.unshift(row);
  }
  function entryText(e) {
    if (wellOwns(e.t)) return WELL.entryText(e);
    var inf = entryInfo(e), d = e.d;
    if (e.t === 'note') return { title: d.title, body: d.body || '' };
    var lines = [inf.meta.filter(Boolean).join(' · ')];
    if (inf.note) lines.push(inf.note);
    if (e.t === 'workout') (d.exercises || []).forEach(function (x) { lines.push(x.name + ': ' + summarizeSets(workingSets(x))); });
    return { title: ETITLE[e.t] + ': ' + inf.title, body: lines.filter(Boolean).join('\n') };
  }
  async function entryAdd(mi, ei, to) {
    var m = X.AS.msgs[mi], e = m && m.entries && m.entries[ei]; if (!e || e._done) return false;
    try {
      if (to === 'note') { var t1 = entryText(e); await addNoteFrom(t1.title, t1.body); e._done = 'note'; }
      else if (to === 'task') {
        var t2 = entryText(e), d = e.d || {};
        await createTask({ title: t2.title.slice(0, 200), details: t2.body, due_date: d.day && (d.planned || e.t === 'meal' || e.t === 'workout') ? d.day : null, due_time: d.at || null });
        e._done = 'task';
      } else {
        if (e.t === 'meal') await addMealFrom(e.d, e.photos);
        else if (e.t === 'workout') await addWorkoutFrom(e.d, e.photos);
        else if (e.t === 'body') await addBodyFrom(e.d, e.photos);
        else if (e.t === 'pantry') await addPantryFrom(e.d);
        else if (e.t === 'note') await addNoteFrom(e.d.title, e.d.body);
        else if (wellOwns(e.t)) await WELL.addFrom(e);
        e._done = 'ok';
      }
      X.asSave(); render(); return true;
    } catch (x) { err(x); return false; }
  }
  Object.assign(actions, {
    hAsPhDel: function (v) {
      var p = PEND.splice(+v, 1)[0]; if (p) { sb.storage.from(BUCKET).remove([p]); delete BLOBS[p]; }
      rerenderKeep();
    },
    hAsEntry: async function (v) { var p = v.split(':'); if (await entryAdd(+p[0], +p[1], '')) toast('Записано'); },
    hAsTo: async function (v) { var p = v.split(':'); if (await entryAdd(+p[0], +p[1], p[2])) toast(p[2] === 'note' ? 'Создана заметка' : 'Создана задача'); },
    hAsAll: async function (v) {
      var m = X.AS.msgs[+v], n = 0; if (!m) return;
      for (var i = 0; i < m.entries.length; i++) if (!m.entries[i]._done && await entryAdd(+v, i, '')) n++;
      if (n) toast('Записано: ' + n);
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.hasAttribute && el.hasAttribute('data-asfile') && el.files && el.files.length) { var files = Array.prototype.slice.call(el.files); el.value = ''; addAsPhotos(files); }
  });

  Object.assign(A, actions);
  window.HEALTH = {
    load: load, foodView: foodView, fitView: fitView, sheet: sheet,
    asAttach: asAttach, asPending: asPending, asPendingPaths: function () { return PEND.slice(); }, asUploading: function () { return PEND_UP > 0; },
    asTake: function () { var p = PEND; PEND = []; return p; }, asPhotos: asPhotos, asImages: asImages, asEntries: asEntries, asCards: asCards, asSummary: asSummary,
    /* утилиты для раздела «Здоровье» (wellbeing.js) */
    u: {
      num: num, r1: r1, hm: hm, field: field, numField: numField, chipSet: chipSet, section: section, tabs: tabs, photoBlock: photoBlock,
      callAI: callAI, photoBlob: photoBlob, blobB64: blobB64, BLOBS: BLOBS, shrink: shrink, BUCKET: BUCKET, CAM: CAM, KIND: KIND, cleanMicros: cleanMicros,
      meals: function () { return H.meals; }, isDone: isDone, load: load,
      updateMealMicros: async function (id, micros) {
        var row = await q(sb.from('meals').update({ micros: micros }).eq('id', id).select().single());
        var i = H.meals.findIndex(function (x) { return x.id === id; }); if (i >= 0) H.meals[i] = row; return row;
      }
    }
  };
  /* если основное приложение уже успело загрузиться раньше этого файла — догружаем данные разделов */
  if (X.ME && X.D.profiles.length) load().then(function () { render(); });
})();
