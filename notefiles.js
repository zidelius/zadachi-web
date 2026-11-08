/* Вложения в заметках: изображения и любые файлы.
   Файлы лежат в приватном хранилище Supabase «notes» по пути <id заметки>/<случайное>.<расширение>,
   список — в колонке notes.files: [{path, name, type, size}]. Видят и добавляют вложения все,
   кто видит заметку (автор и те, с кем ею поделились).
   Добавить: кнопка-скрепка, вставка из буфера (Ctrl+V) или перетаскивание файла в заметку. */
(function () {
  'use strict';
  var X = window.__app;
  if (!X || !X.sb) return;
  var sb = X.sb, q = X.q, esc = X.esc, uid = X.uid, toast = X.toast, err = X.err, UI = X.UI, A = X.A;
  var BUCKET = 'notes', MAX = 25 * 1024 * 1024;
  var CLIP = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5l-8.1 8.1a5 5 0 0 1-7.1-7.1l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/></svg>';
  var DOC = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/></svg>';
  var SIGNED = {}, BLOBS = {}, UP = {};   // путь -> ссылка / Blob; заметка -> число идущих загрузок
  var VIEW = null;                        // открытое вложение {nid, i}

  function note() { return UI.noteId && X.D.notes.filter(function (n) { return n.id === UI.noteId; })[0]; }
  function files(n) { return Array.isArray(n && n.files) ? n.files : []; }
  function isImg(f) { return /^image\//.test(f.type || ''); }
  function size(b) { return b < 1024 ? b + ' Б' : b < 1048576 ? Math.round(b / 1024) + ' КБ' : (Math.round(b / 104857.6) / 10 + ' МБ').replace('.', ','); }
  function ext(name) { var m = /\.([a-z0-9]{1,8})$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function isNative() { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.nativePromise); }

  /* ---------- блок вложений внутри редактора ---------- */
  function block(n) {
    var fs = files(n), up = UP[n.id] || 0;
    if (!fs.length && !up) return '';
    var imgs = fs.map(function (f, i) { return [f, i]; }).filter(function (x) { return isImg(x[0]); });
    var docs = fs.map(function (f, i) { return [f, i]; }).filter(function (x) { return !isImg(x[0]); });
    var h = '<div class="nfiles">';
    if (imgs.length) h += '<div class="nfgrid">' + imgs.map(function (x) {
      return '<button class="nfimg" data-a="nfOpen" data-v="' + x[1] + '" aria-label="' + esc(x[0].name) + '"><img data-nf="' + esc(x[0].path) + '" alt=""></button>';
    }).join('') + '</div>';
    docs.forEach(function (x) {
      var f = x[0];
      h += '<button class="nfdoc" data-a="nfOpen" data-v="' + x[1] + '">' + DOC + '<span><b>' + esc(f.name) + '</b><small>' + esc((ext(f.name) || 'файл').toUpperCase() + ' · ' + size(f.size || 0)) + '</small></span></button>';
    });
    if (up) h += '<div class="muted nfup">Загружаю ' + up + ' ' + X.plural(up, 'файл', 'файла', 'файлов') + '…</div>';
    return h + '</div>';
  }
  function refresh() {
    var n = note(), el = document.getElementById('nfiles');
    if (el && n) { el.innerHTML = block(n); hydrate(); }
    var v = document.getElementById('nfview'); if (v) v.outerHTML = viewer();
  }
  async function url(path) {
    if (BLOBS[path]) return BLOBS[path].u;
    if (SIGNED[path] && SIGNED[path].t > Date.now()) return SIGNED[path].u;
    var r = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (r.error) throw r.error;
    SIGNED[path] = { u: r.data.signedUrl, t: Date.now() + 3400000 };
    return SIGNED[path].u;
  }
  function hydrate() {
    document.querySelectorAll('img[data-nf]:not([src])').forEach(function (im) {
      im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==');
      url(im.getAttribute('data-nf')).then(function (u) { im.src = u; }).catch(function () { im.classList.add('bad'); });
    });
  }

  /* ---------- загрузка ---------- */
  function shrink(file) {   // большие фото с камеры уменьшаем до 2560 px, остальное — как есть
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size < 1.5 * 1048576) return Promise.resolve(file);
    return new Promise(function (res) {
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 2560 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) {
          if (!b || b.size >= file.size) return res(file);
          res(new File([b], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(u); res(file); };
      img.src = u;
    });
  }
  async function add(list) {
    var n = note(); if (!n || !list.length) return;
    var big = list.filter(function (f) { return f.size > MAX; });
    if (big.length) toast('Слишком большой файл (больше 25 МБ): ' + big[0].name);
    list = list.filter(function (f) { return f.size <= MAX; });
    if (!list.length) return;
    UP[n.id] = (UP[n.id] || 0) + list.length; refresh();
    var added = 0;
    for (var i = 0; i < list.length; i++) {
      try {
        var f = await shrink(list[i]), name = f.name || ('Вставка ' + new Date().toLocaleString('ru-RU') + (f.type === 'image/png' ? '.png' : ''));
        var path = n.id + '/' + uid() + (ext(name) ? '.' + ext(name) : '');
        var r = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
        if (r.error) throw r.error;
        BLOBS[path] = { b: f, u: URL.createObjectURL(f) };
        var cur = files(n).slice(); cur.push({ path: path, name: name, type: f.type || '', size: f.size });
        n.files = cur; added++;
        await q(sb.from('notes').update({ files: cur }).eq('id', n.id));
      } catch (e) {
        var m = String((e && e.message) || e);
        toast(/bucket|not found|column|files/i.test(m) ? 'Вложения ещё не подключены в базе' : 'Не удалось загрузить: ' + m);
      } finally { UP[n.id]--; refresh(); }
    }
    if (added) toast(added === 1 ? 'Файл прикреплён' : 'Прикреплено: ' + added);
  }

  /* ---------- просмотр, скачивание, удаление ---------- */
  function viewer() {
    var n = VIEW && X.D.notes.filter(function (x) { return x.id === VIEW.nid; })[0], f = n && files(n)[VIEW.i];
    if (!f) return '<div id="nfview" hidden></div>';
    return '<div id="nfview" class="nfview" role="dialog" aria-label="' + esc(f.name) + '"><div class="nfvbar"><button class="iconbtn" data-a="nfClose" aria-label="Закрыть">' + X.I('x') + '</button><b>' + esc(f.name) + '</b><small>' + esc(size(f.size || 0)) + '</small></div>' +
      '<div class="nfvbody">' + (isImg(f) ? '<img data-nf="' + esc(f.path) + '" alt="' + esc(f.name) + '">' : '<div class="nfvdoc">' + DOC + '<b>' + esc(f.name) + '</b><span class="muted">' + esc((ext(f.name) || 'файл').toUpperCase() + ' · ' + size(f.size || 0)) + '</span></div>') + '</div>' +
      '<div class="nfvfoot"><button class="btn" data-a="nfSave">' + (isNative() ? 'Сохранить' : 'Скачать') + '</button>' +
      (isNative() || navigator.share ? '<button class="btn2" data-a="nfShare">' + (isImg(f) ? 'Поделиться' : 'Открыть в…') + '</button>' : (!isImg(f) ? '<button class="btn2" data-a="nfTab">Открыть</button>' : '')) +
      '<button class="btn2 warn" data-a="nfDel">Удалить</button></div></div>';
  }
  function showViewer() { var v = document.getElementById('nfview'); if (v) v.outerHTML = viewer(); else document.body.insertAdjacentHTML('beforeend', viewer()); hydrate(); }
  function cur() { var n = VIEW && X.D.notes.filter(function (x) { return x.id === VIEW.nid; })[0]; return n ? { n: n, f: files(n)[VIEW.i] } : {}; }
  async function blob(f) {
    if (BLOBS[f.path]) return BLOBS[f.path].b;
    var r = await sb.storage.from(BUCKET).download(f.path);
    if (r.error) throw r.error;
    return r.data;
  }
  function b64(b) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1]); }; fr.onerror = rej; fr.readAsDataURL(b); }); }
  function oldApk(e) { return /not implemented|unimplemented|not available/i.test(String((e && (e.message || e.code)) || e)); }
  async function save() {
    var c = cur(); if (!c.f) return;
    try {
      var b = await blob(c.f);
      if (isNative()) {
        try { await Capacitor.nativePromise('WidgetBridge', 'saveFile', { data: await b64(b), name: c.f.name, mime: c.f.type || 'application/octet-stream' }); toast(isImg(c.f) ? 'Сохранено в галерею: Pictures/Задачи' : 'Сохранено в Загрузки/Задачи'); }
        catch (e) { if (oldApk(e)) toast('Обнови приложение: Настройки → Скачать APK'); else if (/old_android/.test(String(e && e.message))) share(); else throw e; }
        return;
      }
      var u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = c.f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    } catch (e) { err(e); }
  }
  async function share() {
    var c = cur(); if (!c.f) return;
    try {
      var b = await blob(c.f);
      if (isNative()) {
        try { await Capacitor.nativePromise('WidgetBridge', 'shareFile', { data: await b64(b), name: c.f.name, mime: c.f.type || 'application/octet-stream' }); }
        catch (e) { toast(oldApk(e) ? 'Обнови приложение: Настройки → Скачать APK' : 'Не удалось: ' + ((e && e.message) || e)); }
        return;
      }
      var file = new File([b], c.f.name, { type: c.f.type || 'application/octet-stream' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: c.f.name });
      else save();
    } catch (e) { if (!e || e.name !== 'AbortError') err(e); }
  }
  async function openTab() {
    var c = cur(); if (!c.f) return;
    try { window.open(await url(c.f.path), '_blank', 'noopener'); } catch (e) { err(e); }
  }
  async function del() {
    var c = cur(); if (!c.f || !confirm('Удалить вложение «' + c.f.name + '»?')) return;
    var n = c.n, f = c.f, before = files(n);
    n.files = before.filter(function (x) { return x.path !== f.path; });
    VIEW = null; showViewer(); refresh();
    try {
      await q(sb.from('notes').update({ files: n.files }).eq('id', n.id));
      sb.storage.from(BUCKET).remove([f.path]);
    } catch (e) { n.files = before; refresh(); err(e); }
  }
  /* удаление заметки целиком: убрать её файлы из хранилища */
  function purge(n) {
    var p = files(n).map(function (f) { return f.path; });
    return p.length ? sb.storage.from(BUCKET).remove(p).catch(function () { }) : Promise.resolve();
  }

  Object.assign(A, {
    nfOpen: function (v) { var n = note(); if (!n) return; VIEW = { nid: n.id, i: +v }; showViewer(); },
    nfClose: function () { VIEW = null; showViewer(); },
    nfSave: function () { save(); }, nfShare: function () { share(); }, nfTab: function () { openTab(); }, nfDel: function () { del(); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.hasAttribute && el.hasAttribute('data-nfile') && el.files && el.files.length) { var l = Array.prototype.slice.call(el.files); el.value = ''; add(l); }
  });
  /* вставка картинки или файла из буфера обмена прямо в текст заметки */
  document.addEventListener('paste', function (e) {
    if (!note() || !e.clipboardData || !e.target || !e.target.closest || !e.target.closest('.editor')) return;
    var l = Array.prototype.slice.call(e.clipboardData.files || []);
    if (l.length) { e.preventDefault(); add(l); }
  });
  /* перетаскивание файлов в открытую заметку (компьютер) */
  document.addEventListener('dragover', function (e) { if (note() && e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); var ed = document.querySelector('.editor'); if (ed) ed.classList.add('nfdrag'); } });
  document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) { var ed = document.querySelector('.editor'); if (ed) ed.classList.remove('nfdrag'); } });
  document.addEventListener('drop', function (e) {
    var ed = document.querySelector('.editor'); if (ed) ed.classList.remove('nfdrag');
    if (!note() || !e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault(); add(Array.prototype.slice.call(e.dataTransfer.files));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && VIEW) { VIEW = null; showViewer(); e.stopPropagation(); } }, true);

  window.NOTEFILES = {
    button: function () { return '<label class="iconbtn" aria-label="Прикрепить файл" title="Прикрепить изображение или файл">' + CLIP + '<input type="file" multiple data-nfile hidden></label>'; },
    block: function (n) { return '<div id="nfiles">' + block(n) + '</div>'; },
    after: hydrate, count: function (n) { return files(n).length; }, clip: CLIP, purge: purge,
    has: function (n) { return files(n).length > 0 || (UP[n.id] || 0) > 0; }
  };
})();
