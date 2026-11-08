/* Отчёт по питанию и тренировкам за день или за неделю: картинка PNG.
   Рисуется на холсте из уже загруженных данных раздела (health.js отдаёт их через HEALTH.r).
   В браузере файл скачивается или отправляется через «Поделиться», в приложении для Android —
   сохраняется в галерею (Pictures/Задачи) или уходит в системное «Поделиться» (WidgetBridge). */
(function () {
  'use strict';
  var X = window.__app, HL = window.HEALTH;
  if (!X || !HL || !HL.r) return;
  var R = HL.r, T = X.T, addDays = X.addDays, fromKey = X.fromKey, esc = X.esc, plural = X.plural, toast = X.toast,
    UI = X.UI, A = X.A, renderSheet = X.renderSheet;

  /* ---------- оформление ---------- */
  var W = 1080, M = 44, P = 40, CW = W - 2 * M - 2 * P;
  var C = {
    bg: '#F6F5F1', card: '#FFFFFF', ink: '#141414', muted: '#6E6C66', faint: '#A9A69E', line: '#E7E4DD', soft: '#EEECE6',
    prot: '#4A6FB0', fat: '#C0663B', carb: '#3F7D5C', warn: '#B4521A', ok: '#2F7A4F', head: '#141414'
  };
  var BODY = '"Golos Text", system-ui, -apple-system, "Segoe UI", sans-serif';
  var DISP = 'Oswald, "Golos Text", system-ui, sans-serif';
  var EMO = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  var KEMO = { breakfast: '🍳', lunch: '🍲', dinner: '🍽️', snack: '🍎' };
  var FEMO = { strength: '🏋️', run: '🏃', walk: '🚶', swim: '🏊', bike: '🚴', yoga: '🧘', stretch: '🤸', other: '⚡' };
  var WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  var MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function dm(k) { var d = fromKey(k); return d.getDate() + ' ' + MONG[d.getMonth()]; }
  function wdLong(k) { return fromKey(k).toLocaleDateString('ru-RU', { weekday: 'long' }); }
  function wdi(k) { return (fromKey(k).getDay() + 6) % 7; }
  function monday(k) { return addDays(k, -wdi(k)); }
  function n0(x) { return String(Math.round(x || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function n1(x) { return String(Math.round((x || 0) * 10) / 10).replace('.', ','); }
  function hm(t) { return R.hm(t); }

  /* ---------- примитивы рисования ---------- */
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function font(g, px, weight, fam) { g.font = (weight || 400) + ' ' + px + 'px ' + (fam || BODY); }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function fillR(g, x, y, w, h, r, col) { if (w <= 0 || h <= 0) return; rr(g, x, y, w, h, r); g.fillStyle = col; g.fill(); }
  function ell(g, t, max) {
    t = String(t || ''); if (!max || g.measureText(t).width <= max) return t;
    while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t.replace(/\s+$/, '') + '…';
  }
  function txt(g, t, x, y, o) {
    o = o || {}; font(g, o.size || 28, o.weight || 400, o.fam);
    g.fillStyle = o.color || C.ink; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
    var s = ell(g, t, o.max); g.fillText(s, x, y); return g.measureText(s).width;
  }
  function wrap(g, t, max, lines) {
    var words = String(t || '').split(/\s+/), out = [], cur = '';
    words.forEach(function (w) {
      var test = cur ? cur + ' ' + w : w;
      if (g.measureText(test).width <= max || !cur) cur = test; else { out.push(cur); cur = w; }
    });
    if (cur) out.push(cur);
    if (lines && out.length > lines) { out = out.slice(0, lines); out[lines - 1] = ell(g, out[lines - 1] + ' …', max); }
    return out;
  }
  function emoji(g, e, cx, cy, size, bg) {
    if (bg) { g.beginPath(); g.arc(cx, cy, size * 0.95, 0, Math.PI * 2); g.fillStyle = bg; g.fill(); }
    font(g, size, 400, EMO); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.ink; g.fillText(e, cx, cy + size * 0.06);
  }
  function hline(g, y, w) { g.fillStyle = C.line; g.fillRect(0, y, w, 2); }
  function cover(g, img, x, y, w, h, r) {
    var iw = img.width, ih = img.height, k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
    g.save(); rr(g, x, y, w, h, r); g.clip(); g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h); g.restore();
  }
  /* блок рисуется на своём холсте, потом из него вырезается использованная высота */
  function block(fn) {
    var c = canvas(CW, 5200), g = c.getContext('2d'), h = Math.ceil(fn(g)) || 0;
    return { c: c, h: Math.min(h, 5200) };
  }
  function title(g, y, t, emo) {
    var x = 0;
    if (emo) { emoji(g, emo, 26, y + 22, 34); x = 62; }
    txt(g, t.toUpperCase(), x, y + 36, { size: 38, weight: 600, fam: DISP });
    return y + 70;
  }
  function note(g, y, t) {
    font(g, 26, 400); var ls = wrap(g, t, CW);
    ls.forEach(function (l, i) { txt(g, l, 0, y + 30 + i * 36, { size: 26, color: C.muted }); });
    return y + 30 + ls.length * 36;
  }

  /* ---------- данные ---------- */
  function mealsIn(from, to) { return R.H.meals.filter(function (m) { return m.day >= from && m.day <= to; }); }
  function worksIn(from, to) {
    return R.H.workouts.filter(function (w) { return w.day >= from && w.day <= to && R.isDone(w); })
      .sort(function (a, b) { return (a.day + (hm(a.at) || '99')) < (b.day + (hm(b.at) || '99')) ? -1 : 1; });
  }
  function bodyIn(from, to) { return R.H.body.filter(function (b) { return b.day >= from && b.day <= to; }).sort(function (a, b) { return a.day < b.day ? -1 : 1; }); }
  function goals() { var s = X.SET || {}; return { kcal: R.num(s.kcalGoal), p: R.num(s.proteinGoal), f: R.num(s.fatGoal), c: R.num(s.carbsGoal) }; }
  function tonnage(ws) { var v = 0; ws.forEach(function (w) { (w.exercises || []).forEach(function (e) { R.workingSets(e).forEach(function (s) { v += s.reps * (s.weight || 0); }); }); }); return v; }
  function setsCount(w) { return (w.exercises || []).reduce(function (a, e) { return a + R.workingSets(e).length; }, 0); }
  function best(ws) {   // лучший расчётный максимум по каждому упражнению
    var m = {};
    ws.forEach(function (w) {
      (w.exercises || []).forEach(function (e) {
        R.workingSets(e).forEach(function (s) {
          if (!(s.weight > 0)) return;
          var k = R.normName(e.name), sc = s.weight * (1 + s.reps / 30);
          if (!m[k] || sc > m[k].sc) m[k] = { sc: sc, name: e.name, s: s };
        });
      });
    });
    return m;
  }

  /* ---------- общие куски ---------- */
  function header(g, kind, line1, line2) {
    var h = 300;
    g.fillStyle = C.head; g.fillRect(0, 0, W, h);
    var gr = g.createLinearGradient(0, 0, W, h); gr.addColorStop(0, 'rgba(74,111,176,0.35)'); gr.addColorStop(1, 'rgba(192,102,59,0.28)');
    g.fillStyle = gr; g.fillRect(0, 0, W, h);
    txt(g, kind, M + 4, 92, { size: 30, weight: 500, color: 'rgba(255,255,255,0.7)', fam: DISP });
    txt(g, line1, M, 190, { size: 84, weight: 600, color: '#FFFFFF', fam: DISP, max: W - 2 * M });
    txt(g, line2, M + 4, 250, { size: 32, color: 'rgba(255,255,255,0.78)', max: W - 2 * M });
    txt(g, 'ЗАДАЧИ', W - M, 92, { size: 28, weight: 500, color: 'rgba(255,255,255,0.55)', fam: DISP, align: 'right' });
    return h;
  }
  function tiles(g, y, items) {
    var gap = 16, n = items.length, w = (W - 2 * M - gap * (n - 1)) / n, h = 170;
    items.forEach(function (it, i) {
      var x = M + i * (w + gap);
      g.save(); g.shadowColor = 'rgba(20,20,20,0.07)'; g.shadowBlur = 24; g.shadowOffsetY = 6; fillR(g, x, y, w, h, 24, C.card); g.restore();
      fillR(g, x, y, 8, h, 4, it[3] || C.ink);
      txt(g, it[0], x + 28, y + 46, { size: 24, color: C.muted, max: w - 40 });
      txt(g, it[1], x + 28, y + 112, { size: 58, weight: 600, fam: DISP, max: w - 40 });
      txt(g, it[2], x + 28, y + 148, { size: 22, color: C.muted, max: w - 40 });
    });
    return y + h;
  }
  function macroRows(g, x, y, w, vals, gl, unit) {
    var rows = [['Белки', vals.p, gl.p, C.prot], ['Жиры', vals.f, gl.f, C.fat], ['Углеводы', vals.c, gl.c, C.carb]];
    rows.forEach(function (r) {
      txt(g, r[0], x, y + 30, { size: 27, weight: 500 });
      txt(g, n0(r[1]) + (r[2] ? ' / ' + n0(r[2]) : '') + ' г' + (unit || ''), x + w, y + 30, { size: 27, weight: 600, align: 'right' });
      fillR(g, x, y + 46, w, 16, 8, C.soft);
      var max = r[2] || Math.max(vals.p, vals.f, vals.c, 1), k = Math.min(1, r[1] / max);
      fillR(g, x, y + 46, Math.max(k ? 16 : 0, w * k), 16, 8, r[2] && r[1] > r[2] * 1.05 ? C.warn : r[3]);
      y += 86;
    });
    return y;
  }
  function splitBar(g, y, p, f, c) {
    var kp = p * 4, kf = f * 9, kc = c * 4, sum = kp + kf + kc;
    if (!sum) return y;
    txt(g, 'Откуда калории', 0, y + 30, { size: 24, color: C.muted });
    var x = 0, parts = [[kp, C.prot, 'Б'], [kf, C.fat, 'Ж'], [kc, C.carb, 'У']];
    g.save(); rr(g, 0, y + 48, CW, 28, 14); g.clip();
    parts.forEach(function (pt) { var w = CW * pt[0] / sum; g.fillStyle = pt[1]; g.fillRect(x, y + 48, w + 1, 28); x += w; });
    g.restore();
    var lx = 0;
    parts.forEach(function (pt) {
      g.beginPath(); g.arc(lx + 9, y + 108, 9, 0, Math.PI * 2); g.fillStyle = pt[1]; g.fill();
      lx += 26 + txt(g, pt[2] + ' ' + Math.round(pt[0] / sum * 100) + '%', lx + 26, y + 117, { size: 25, weight: 500 }) + 34;
    });
    return y + 136;
  }
  function ring(g, cx, cy, r, val, goal) {
    g.lineCap = 'round'; g.lineWidth = 24;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.strokeStyle = C.soft; g.stroke();
    var k = goal ? Math.min(1, val / goal) : (val ? 1 : 0);
    if (k > 0) { g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokeStyle = goal && val > goal * 1.05 ? C.warn : C.ink; g.stroke(); }
    txt(g, n0(val), cx, cy + 12, { size: 58, weight: 600, fam: DISP, align: 'center' });
    txt(g, goal ? 'из ' + n0(goal) + ' ккал' : 'ккал', cx, cy + 50, { size: 23, color: C.muted, align: 'center' });
  }
  /* схема мышц: L — нагрузка по мышцам, target — значение «красного» */
  function bodyMap(g, x, y, h, L, target) {
    if (!window.ANATOMY) return y;
    var k = h / 2200, fw = 1000 * k, gap = 24;
    ['front', 'back'].forEach(function (side, i) {
      var ox = x + i * (fw + gap);
      window.ANATOMY[side].forEach(function (grp) {
        var key = (grp.m === 'left-soleus' || grp.m === 'right-soleus') ? 'calves' : grp.m;
        var fill = (key === 'head' || key === 'knees') ? C.soft : R.heat((L[key] || 0) / target);
        grp.p.forEach(function (pts) {
          var a = pts.split(' ').map(Number); g.beginPath();
          for (var j = 0; j < a.length; j += 2) { var px = ox + a[j] * k, py = y + a[j + 1] * k; if (j) g.lineTo(px, py); else g.moveTo(px, py); }
          g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.card; g.stroke();
        });
      });
      txt(g, i ? 'сзади' : 'спереди', ox + fw / 2, y + h + 30, { size: 22, color: C.muted, align: 'center' });
    });
    return { w: 2 * fw + gap, bottom: y + h + 40 };
  }
  function muscles(g, x, y, w, L, target, maxN) {
    var keys = Object.keys(R.MUS).filter(function (k) { return (L[k] || 0) > 0; }).sort(function (a, b) { return L[b] - L[a]; }).slice(0, maxN);
    keys.forEach(function (k) {
      var v = L[k] / target;
      txt(g, R.MUS[k], x, y + 28, { size: 24, weight: 500, max: w - 70 });
      txt(g, n1(L[k]), x + w, y + 28, { size: 24, weight: 600, align: 'right' });
      fillR(g, x, y + 40, w, 12, 6, C.soft); fillR(g, x, y + 40, Math.max(12, w * Math.min(1, v)), 12, 6, R.heat(v));
      y += 68;
    });
    return y;
  }
  function loadSection(g, y, ws, target, label) {
    var L = R.loadOf(ws); if (!Object.keys(L).length) return y;
    y += 14; txt(g, label, 0, y + 30, { size: 26, weight: 600 }); y += 52;
    var bm = bodyMap(g, 0, y, 430, L, target);
    var lx = bm.w + 40, ly = muscles(g, lx, y - 6, CW - lx, L, target, 7);
    y = Math.max(bm.bottom, ly) + 8;
    // шкала
    var gr = g.createLinearGradient(0, 0, 260, 0); gr.addColorStop(0, R.heat(0)); gr.addColorStop(0.5, R.heat(0.5)); gr.addColorStop(1, R.heat(1));
    fillR(g, 0, y + 6, 260, 12, 6, gr);
    txt(g, 'нет нагрузки → максимум (' + target + ' усл. подходов)', 280, y + 19, { size: 21, color: C.muted, max: CW - 280 });
    return y + 40;
  }

  /* ---------- отчёт за день ---------- */
  async function photosFor(ms) {
    var out = {};
    await Promise.all(ms.filter(function (m) { return (m.photos || []).length; }).slice(0, 12).map(async function (m) {
      try {
        var b = await Promise.race([R.photoBlob(m.photos[0]), new Promise(function (_, rej) { setTimeout(function () { rej(new Error('t')); }, 8000); })]);
        out[m.id] = await new Promise(function (res, rej) { var u = URL.createObjectURL(b), im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = u; });
      } catch (e) { }
    }));
    return out;
  }
  function mealList(g, y, ms, ph) {
    ms.forEach(function (m, i) {
      var done = R.isDone(m), k = R.KIND[m.kind] || R.KIND.snack, top = y;
      if (i) hline(g, y, CW);
      y += 22;
      g.globalAlpha = done ? 1 : 0.5;
      if (ph[m.id]) cover(g, ph[m.id], 0, y, 104, 104, 20);
      else { fillR(g, 0, y, 104, 104, 20, C.soft); emoji(g, KEMO[m.kind] || '🍴', 52, y + 52, 46); }
      var tx = 132, tw = CW - tx - 190;
      font(g, 30, 600); var ls = wrap(g, m.title || k.name, tw, 2);
      ls.forEach(function (l, j) { txt(g, l, tx, y + 34 + j * 38, { size: 30, weight: 600 }); });
      var sub = k.name + (hm(m.at) ? ' · ' + hm(m.at) : '') + (m.planned && !done ? ' · план, не отмечено' : '');
      txt(g, sub, tx, y + 34 + ls.length * 38 + 2, { size: 24, color: C.muted, max: tw });
      if (m.kcal != null) {
        txt(g, n0(m.kcal), CW, y + 44, { size: 46, weight: 600, fam: DISP, align: 'right' });
        txt(g, 'ккал', CW, y + 74, { size: 22, color: C.muted, align: 'right' });
      }
      if (m.protein != null || m.fat != null || m.carbs != null) {
        var bx = CW, parts = [['У ' + n0(m.carbs), C.carb], ['Ж ' + n0(m.fat), C.fat], ['Б ' + n0(m.protein), C.prot]];
        parts.forEach(function (pt) { var w = txt(g, pt[0], bx, y + 108, { size: 23, weight: 600, color: pt[1], align: 'right' }); bx -= w + 16; });
      }
      g.globalAlpha = 1;
      y = Math.max(y + 104, y + 34 + ls.length * 38 + 14, y + 112) + 22;
    });
    return y;
  }
  function workList(g, y, ws, showDay) {
    ws.forEach(function (w, i) {
      var k = R.FKIND[w.kind] || R.FKIND.other;
      if (i) hline(g, y, CW);
      y += 24;
      fillR(g, 0, y, 92, 92, 46, C.soft); emoji(g, FEMO[w.kind] || '⚡', 46, y + 46, 42);
      var tx = 120, tw = CW - tx;
      txt(g, w.title || k.name, tx, y + 36, { size: 31, weight: 600, max: tw });
      var bits = [];
      if (showDay) bits.push(WD[wdi(w.day)] + ', ' + dm(w.day)); else if (hm(w.at)) bits.push(hm(w.at));
      bits.push(k.name);
      if (w.minutes != null) bits.push(Math.round(w.minutes) + ' мин');
      if (w.kcal != null) bits.push(n0(w.kcal) + ' ккал');
      var ns = setsCount(w); if (ns) bits.push((w.exercises || []).length + ' упр., ' + ns + ' ' + plural(ns, 'подход', 'подхода', 'подходов'));
      var t = tonnage([w]); if (t) bits.push(n1(t / 1000) + ' т');
      txt(g, bits.join(' · '), tx, y + 74, { size: 24, color: C.muted, max: tw });
      y += 100;
      var mets = (w.metrics || []).slice(0, 6);
      if (mets.length) {
        var cx = tx; font(g, 23, 500);
        mets.forEach(function (m) {
          var s = m.name + ' ' + m.value + (m.unit ? ' ' + m.unit : ''), mw = Math.min(tw, g.measureText(s).width + 32);
          if (cx + mw > CW) { cx = tx; y += 50; }
          fillR(g, cx, y, mw, 40, 20, C.soft); txt(g, s, cx + 16, y + 28, { size: 23, weight: 500, max: mw - 32 }); cx += mw + 10;
        });
        y += 56;
      }
      if (!showDay) (w.exercises || []).forEach(function (e) {
        var ws2 = R.workingSets(e); if (!ws2.length) return;
        txt(g, e.name, tx, y + 28, { size: 26, weight: 500, max: tw * 0.48 });
        font(g, 24, 400); var ls = wrap(g, R.summarizeSets(ws2), tw * 0.5, 3);
        ls.forEach(function (l, j) { txt(g, l, CW, y + 28 + j * 32, { size: 24, color: C.muted, align: 'right' }); });
        y += Math.max(1, ls.length) * 32 + 12;
      });
      if (w.note && !showDay) { font(g, 24, 400); wrap(g, w.note, tw, 3).forEach(function (l) { txt(g, l, tx, y + 28, { size: 24, color: C.muted }); y += 32; }); y += 6; }
      y += 10;
    });
    return y;
  }
  function bodyCard(list, single) {
    if (!list.length) return null;
    return block(function (g) {
      var y = title(g, 0, 'Замеры', '⚖️');
      var a = list[0], b = list[list.length - 1], cells = [];
      if (b.weight != null) cells.push(['Вес', n1(b.weight) + ' кг', !single && a.weight != null && a !== b ? (b.weight - a.weight > 0 ? '+' : '') + n1(b.weight - a.weight) + ' кг за неделю' : '']);
      if (b.fat != null) cells.push(['Жир', n1(b.fat) + ' %', '']);
      if (b.muscle != null) cells.push(['Мышцы', n1(b.muscle) + ' кг', '']);
      if (b.waist != null) cells.push(['Талия', n1(b.waist) + ' см', '']);
      if (!cells.length) return note(g, y, 'Замер без цифр.') + 10;
      var w = (CW - 16 * (cells.length - 1)) / cells.length;
      cells.forEach(function (c, i) {
        var x = i * (w + 16); fillR(g, x, y, w, 140, 20, C.soft);
        txt(g, c[0], x + 22, y + 40, { size: 23, color: C.muted });
        txt(g, c[1], x + 22, y + 94, { size: 44, weight: 600, fam: DISP, max: w - 40 });
        if (c[2]) txt(g, c[2], x + 22, y + 126, { size: 20, color: C.muted, max: w - 40 });
      });
      return y + 150;
    });
  }
  async function dayReport(d) {
    var ms = R.mealsOf(d), ws = worksIn(d, d), gl = goals(), t = R.totals(d), ph = await photosFor(ms);
    var burned = ws.reduce(function (a, w) { return a + (+w.kcal || 0); }, 0), mins = ws.reduce(function (a, w) { return a + (+w.minutes || 0); }, 0);
    var cards = [];
    cards.push(block(function (g) {
      var y = title(g, 0, 'Питание', '🥗');
      if (!ms.length) return note(g, y, 'В этот день записей о еде нет.') + 10;
      ring(g, 120, y + 125, 104, t.kcal, gl.kcal);
      var my = macroRows(g, 290, y + 2, CW - 290, { p: t.protein, f: t.fat, c: t.carbs }, gl);
      y = Math.max(y + 260, my) + 10;
      y = splitBar(g, y, t.protein, t.fat, t.carbs);
      if (t.plan) y = note(g, y - 12, 'Запланировано, но не отмечено: ещё ' + n0(t.plan) + ' ккал.') + 6;
      y += 10;
      return mealList(g, y, ms, ph);
    }));
    cards.push(block(function (g) {
      var y = title(g, 0, 'Тренировки', '💪');
      if (!ws.length) return note(g, y, 'В этот день тренировок не было.') + 10;
      y = workList(g, y - 10, ws, false);
      return loadSection(g, y, ws.filter(function (w) { return (w.exercises || []).length; }), R.TARGET.workout, 'Нагрузка на мышцы');
    }));
    var bc = bodyCard(bodyIn(d, d), true); if (bc) cards.push(bc);
    var dd = fromKey(d);
    return compose('ОТЧЁТ ЗА ДЕНЬ', dm(d), wdLong(d).replace(/^./, function (c) { return c.toUpperCase(); }) + ', ' + dd.getFullYear(), [
      ['Съедено', n0(t.kcal), gl.kcal ? 'из ' + n0(gl.kcal) + ' ккал' : 'ккал', C.ink],
      ['Белки', n0(t.protein), gl.p ? 'из ' + n0(gl.p) + ' г' : 'грамм', C.prot],
      ['Тренировки', String(ws.length), mins ? Math.round(mins) + ' мин' : plural(ws.length, 'тренировка', 'тренировки', 'тренировок'), C.carb],
      ['Сожжено', n0(burned), 'ккал на тренировках', C.fat]
    ], cards);
  }

  /* ---------- отчёт за неделю ---------- */
  function weekBars(g, y, days, gl) {
    var h = 300, top = y + 50, bw = CW / 7, vals = days.map(function (x) { return x.t.kcal; });
    var mx = Math.max.apply(null, vals.concat([gl.kcal ? gl.kcal * 1.15 : 0, 1]));
    for (var i = 0; i <= 2; i++) { var gy = top + h - h * i / 2; g.fillStyle = C.line; g.fillRect(0, gy, CW, 2); }
    days.forEach(function (x, i) {
      var v = x.t.kcal, bh = v ? Math.max(8, h * v / mx) : 0, bx = i * bw + bw * 0.18, w = bw * 0.64;
      if (v) {
        fillR(g, bx, top + h - bh, w, bh, 14, gl.kcal && v > gl.kcal * 1.1 ? C.warn : C.ink);
        txt(g, n0(v), bx + w / 2, top + h - bh - 14, { size: 24, weight: 600, align: 'center' });
      } else txt(g, '—', bx + w / 2, top + h - 14, { size: 26, color: C.faint, align: 'center' });
      txt(g, WD[i], bx + w / 2, top + h + 38, { size: 25, weight: 600, align: 'center' });
      txt(g, String(fromKey(x.d).getDate()), bx + w / 2, top + h + 70, { size: 22, color: C.muted, align: 'center' });
    });
    if (gl.kcal) {
      var ly = top + h - h * gl.kcal / mx; g.save(); g.setLineDash([12, 10]); g.strokeStyle = C.carb; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, ly); g.lineTo(CW, ly); g.stroke(); g.restore();
      txt(g, 'цель ' + n0(gl.kcal), CW, ly - 10, { size: 21, weight: 600, color: C.carb, align: 'right' });
    }
    return top + h + 92;
  }
  function weekTable(g, y, days) {
    var cols = [[0, 'День', 'left'], [CW * 0.42, 'ккал', 'right'], [CW * 0.58, 'Б', 'right'], [CW * 0.72, 'Ж', 'right'], [CW * 0.86, 'У', 'right'], [CW, 'приёмов', 'right']];
    cols.forEach(function (c) { txt(g, c[1], c[0], y + 28, { size: 22, color: C.muted, align: c[2] }); });
    y += 44;
    days.forEach(function (x, i) {
      if (i % 2 === 0) fillR(g, -12, y, CW + 24, 52, 12, '#F7F6F2');
      var has = x.t.n > 0, col = has ? C.ink : C.faint;
      txt(g, WD[i] + ', ' + dm(x.d), 8, y + 35, { size: 25, weight: 500, color: col });
      txt(g, has ? n0(x.t.kcal) : '—', cols[1][0], y + 35, { size: 25, weight: 600, color: col, align: 'right' });
      txt(g, has ? n0(x.t.protein) : '—', cols[2][0], y + 35, { size: 25, color: has ? C.prot : col, align: 'right' });
      txt(g, has ? n0(x.t.fat) : '—', cols[3][0], y + 35, { size: 25, color: has ? C.fat : col, align: 'right' });
      txt(g, has ? n0(x.t.carbs) : '—', cols[4][0], y + 35, { size: 25, color: has ? C.carb : col, align: 'right' });
      txt(g, has ? String(x.t.n) : '—', CW - 8, y + 35, { size: 25, color: col, align: 'right' });
      y += 52;
    });
    return y + 10;
  }
  function weekStrip(g, y, from, ws) {
    var bw = CW / 7;
    for (var i = 0; i < 7; i++) {
      var d = addDays(from, i), dw = ws.filter(function (w) { return w.day === d; }), cx = i * bw + bw / 2;
      g.beginPath(); g.arc(cx, y + 50, 44, 0, Math.PI * 2); g.fillStyle = dw.length ? C.ink : C.soft; g.fill();
      if (dw.length) { emoji(g, FEMO[dw[0].kind] || '⚡', cx, y + 50, 38); if (dw.length > 1) { g.beginPath(); g.arc(cx + 34, y + 18, 17, 0, Math.PI * 2); g.fillStyle = C.fat; g.fill(); txt(g, String(dw.length), cx + 34, y + 26, { size: 21, weight: 700, color: '#fff', align: 'center' }); } }
      txt(g, WD[i], cx, y + 128, { size: 24, weight: 600, align: 'center', color: dw.length ? C.ink : C.muted });
    }
    return y + 150;
  }
  function records(g, y, from, to) {
    var before = best(R.H.workouts.filter(function (w) { return R.isDone(w) && w.day < from; }));
    var now = best(worksIn(from, to)), rows = [];
    Object.keys(now).forEach(function (k) {
      var b = before[k], n = now[k];
      if (!b) rows.push([n.name, n.s.reps + ' × ' + n1(n.s.weight) + ' кг', 'впервые']);
      else if (n.sc > b.sc * 1.001) rows.push([n.name, n.s.reps + ' × ' + n1(n.s.weight) + ' кг', '▲ +' + Math.round((n.sc - b.sc) / b.sc * 100) + '%']);
    });
    if (!rows.length) return y;
    y += 10; txt(g, 'Рекорды и новые упражнения', 0, y + 30, { size: 26, weight: 600 }); y += 50;
    rows.slice(0, 8).forEach(function (r) {
      txt(g, r[0], 0, y + 30, { size: 25, weight: 500, max: CW * 0.5 });
      txt(g, r[1], CW * 0.74, y + 30, { size: 25, color: C.muted, align: 'right' });
      txt(g, r[2], CW, y + 30, { size: 25, weight: 600, color: r[2] === 'впервые' ? C.muted : C.ok, align: 'right' });
      y += 44;
    });
    return y + 8;
  }
  async function weekReport(d) {
    var from = monday(d), to = addDays(from, 6), gl = goals(), days = [];
    for (var i = 0; i < 7; i++) { var k = addDays(from, i); days.push({ d: k, t: R.totals(k) }); }
    var fed = days.filter(function (x) { return x.t.n > 0; }), nf = fed.length || 1;
    var avg = { kcal: 0, p: 0, f: 0, c: 0 };
    fed.forEach(function (x) { avg.kcal += x.t.kcal / nf; avg.p += x.t.protein / nf; avg.f += x.t.fat / nf; avg.c += x.t.carbs / nf; });
    var ws = worksIn(from, to), mins = ws.reduce(function (a, w) { return a + (+w.minutes || 0); }, 0), ton = tonnage(ws), burned = ws.reduce(function (a, w) { return a + (+w.kcal || 0); }, 0);
    var cards = [];
    cards.push(block(function (g) {
      var y = title(g, 0, 'Питание', '🥗');
      if (!fed.length) return note(g, y, 'На этой неделе записей о еде нет.') + 10;
      y = weekBars(g, y - 30, days, gl);
      txt(g, 'В среднем за день', 0, y + 30, { size: 26, weight: 600 });
      txt(g, 'по ' + fed.length + ' ' + plural(fed.length, 'дню', 'дням', 'дням') + ' с записями', CW, y + 30, { size: 23, color: C.muted, align: 'right' });
      y += 50;
      ring(g, 120, y + 125, 104, avg.kcal, gl.kcal);
      var my = macroRows(g, 290, y + 2, CW - 290, avg, gl);
      y = Math.max(y + 260, my) + 10;
      y = splitBar(g, y, avg.p, avg.f, avg.c);
      if (gl.kcal) {
        var inG = fed.filter(function (x) { return Math.abs(x.t.kcal - gl.kcal) <= gl.kcal * 0.1; }).length;
        y = note(g, y - 12, 'В пределах цели (±10%): ' + inG + ' из ' + fed.length + ' ' + plural(fed.length, 'дня', 'дней', 'дней') + '.') + 14;
      }
      return weekTable(g, y + 6, days);
    }));
    cards.push(block(function (g) {
      var y = title(g, 0, 'Тренировки', '💪');
      if (!ws.length) return note(g, y, 'На этой неделе тренировок не было.') + 10;
      y = weekStrip(g, y, from, ws);
      y = workList(g, y - 10, ws, true);
      y = records(g, y, from, to);
      return loadSection(g, y, ws.filter(function (w) { return (w.exercises || []).length; }), R.TARGET.week, 'Нагрузка на мышцы за неделю');
    }));
    var bc = bodyCard(bodyIn(from, to), false); if (bc) cards.push(bc);
    var fd = fromKey(from), td = fromKey(to);
    var range = fd.getMonth() === td.getMonth() ? fd.getDate() + '–' + dm(to) : dm(from) + ' – ' + dm(to);
    return compose('ОТЧЁТ ЗА НЕДЕЛЮ', range, 'Понедельник – воскресенье, ' + td.getFullYear(), [
      ['Калории', n0(avg.kcal), gl.kcal ? 'в день, цель ' + n0(gl.kcal) : 'ккал в день', C.ink],
      ['Белки', n0(avg.p), gl.p ? 'г в день, цель ' + n0(gl.p) : 'г в день', C.prot],
      ['Тренировки', String(ws.length), mins ? Math.round(mins) + ' мин' : plural(ws.length, 'тренировка', 'тренировки', 'тренировок'), C.carb],
      ton ? ['Поднято', n1(ton / 1000), 'тонн за неделю', C.fat] : ['Сожжено', n0(burned), 'ккал на тренировках', C.fat]
    ], cards);
  }

  /* ---------- сборка картинки ---------- */
  function compose(kind, l1, l2, tl, cards) {
    var H0 = 300 + 40 + 170 + 36, total = H0 + cards.reduce(function (a, b) { return a + b.h + 2 * P + 28; }, 0) + 90;
    var c = canvas(W, total), g = c.getContext('2d');
    g.fillStyle = C.bg; g.fillRect(0, 0, W, total);
    header(g, kind, l1, l2);
    var y = tiles(g, 300 + 40 - 0, tl) + 36;
    cards.forEach(function (b) {
      g.save(); g.shadowColor = 'rgba(20,20,20,0.07)'; g.shadowBlur = 30; g.shadowOffsetY = 8; fillR(g, M, y, W - 2 * M, b.h + 2 * P, 32, C.card); g.restore();
      g.drawImage(b.c, 0, 0, CW, b.h, M + P, y + P, CW, b.h);
      y += b.h + 2 * P + 28;
    });
    var now = new Date();
    txt(g, 'Сформировано ' + now.getDate() + ' ' + MONG[now.getMonth()] + ' ' + now.getFullYear() + ', ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' · приложение «Задачи»', W / 2, y + 40, { size: 22, color: C.faint, align: 'center' });
    return c;
  }
  async function fontsReady() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.race([Promise.all(['600 60px Oswald', '500 30px Oswald', '400 28px "Golos Text"', '500 28px "Golos Text"', '600 28px "Golos Text"'].map(function (f) { return document.fonts.load(f, 'АБВабв123'); })),
        new Promise(function (r) { setTimeout(r, 3000); })]);
    } catch (e) { }
  }
  async function build(period, d) {
    await fontsReady();
    var c = period === 'week' ? await weekReport(d) : await dayReport(d);
    return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('Не удалось собрать картинку')); }, 'image/png'); });
  }
  function fileName(s) { return 'Отчёт_' + (s.period === 'week' ? 'неделя_' + monday(s.day) : 'день_' + s.day) + '.png'; }

  /* ---------- окно отчёта ---------- */
  var ICON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 17v-3M12 17v-6M15 17v-4"/></svg>';
  var CUR = { blob: null, url: '', key: '' }, SEQ = 0;
  function isNative() { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.nativePromise); }
  function sheet(s) {
    var body = '<div class="chips">' + [['day', 'За день'], ['week', 'За неделю']].map(function (p) {
      return '<button type="button" class="chip' + (s.period === p[0] ? ' on' : '') + '" data-a="hRepP" data-v="' + p[0] + '">' + p[1] + '</button>';
    }).join('') + '</div>' +
      '<label><div class="gl">' + (s.period === 'week' ? 'Любой день нужной недели' : 'День') + '</div><input class="fld" type="date" data-f="day" value="' + esc(s.day) + '" max="' + T() + '" min="' + addDays(T(), -120) + '"></label>' +
      (s.period === 'week' ? '<div class="gh">Неделя с понедельника по воскресенье: ' + esc(dm(monday(s.day)) + ' – ' + dm(addDays(monday(s.day), 6))) + '.</div>' : '') +
      '<div class="rprev">' + (s.err ? '<div class="empty">' + esc(s.err) + '</div>' : s.url ? '<img src="' + s.url + '" alt="Отчёт">' : '<div class="empty">Собираю отчёт…</div>') + '</div>';
    var ready = !!s.url && !s.busy;
    var foot = '<button class="btn" data-a="hRepSave"' + (ready ? '' : ' disabled') + '>Сохранить</button>' +
      (isNative() || (navigator.canShare && navigator.share) ? '<button class="btn2" data-a="hRepShare"' + (ready ? '' : ' disabled') + '>Поделиться</button>' : '');
    return { title: 'Отчёт', body: body, foot: foot };
  }
  async function regen() {
    var s = UI.sheet; if (!s || s.type !== 'h-report') return;
    var key = s.period + ':' + s.day, my = ++SEQ;
    if (CUR.key === key && CUR.url) { s.url = CUR.url; s.busy = false; renderSheet(); return; }
    s.busy = true; s.url = ''; s.err = ''; renderSheet();
    try {
      var b = await build(s.period, s.day);
      if (my !== SEQ || UI.sheet !== s) return;
      if (CUR.url) URL.revokeObjectURL(CUR.url);
      CUR = { blob: b, url: URL.createObjectURL(b), key: key };
      s.url = CUR.url; s.busy = false; renderSheet();
    } catch (e) { if (my === SEQ && UI.sheet === s) { s.busy = false; s.err = 'Не получилось собрать отчёт: ' + ((e && e.message) || e); renderSheet(); } }
  }
  function b64(blob) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1]); }; fr.onerror = rej; fr.readAsDataURL(blob); }); }
  function oldApk(e) { return /not implemented|unimplemented|not available/i.test(String((e && (e.message || e.code)) || e)); }
  async function save() {
    var s = UI.sheet; if (!CUR.blob) return;
    if (isNative()) {
      try { await Capacitor.nativePromise('WidgetBridge', 'saveImage', { data: await b64(CUR.blob), name: fileName(s) }); toast('Сохранено в галерею: Pictures/Задачи'); }
      catch (e) { if (/old_android/.test(String(e && e.message))) return share(); toast(oldApk(e) ? 'Обнови приложение: Настройки → Скачать APK' : 'Не удалось сохранить: ' + ((e && e.message) || e)); }
      return;
    }
    var a = document.createElement('a'); a.href = CUR.url; a.download = fileName(s); document.body.appendChild(a); a.click(); a.remove();
    toast('Файл скачан');
  }
  async function share() {
    var s = UI.sheet; if (!CUR.blob) return;
    if (isNative()) {
      try { await Capacitor.nativePromise('WidgetBridge', 'shareImage', { data: await b64(CUR.blob), name: fileName(s) }); }
      catch (e) { toast(oldApk(e) ? 'Обнови приложение: Настройки → Скачать APK' : 'Не удалось отправить: ' + ((e && e.message) || e)); }
      return;
    }
    var f = new File([CUR.blob], fileName(s), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: 'Отчёт' }); } catch (e) { if (e && e.name !== 'AbortError') save(); }
    } else save();
  }
  Object.assign(A, {
    hReport: function (v) { UI.sheet = { type: 'h-report', period: v === 'week' ? 'week' : 'day', day: R.day ? R.day() : T(), url: '', busy: true }; renderSheet(true); regen(); },
    hRepP: function (v) { var s = UI.sheet; if (!s) return; s.period = v; regen(); },
    hRepSave: function () { save(); },
    hRepShare: function () { share(); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, s = UI.sheet;
    if (s && s.type === 'h-report' && el && el.getAttribute && el.getAttribute('data-f') === 'day' && el.value) { s.day = el.value; regen(); }
  });
  window.HREPORT = { sheet: sheet, icon: ICON, build: build };
})();
