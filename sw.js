/* Service worker «Задачи»: показывает напоминания и обрабатывает кнопки в уведомлениях */
var PUSH_URL = 'https://avegfmaiutxryomjzoch.supabase.co/functions/v1/push';
var API_KEY = 'sb_publishable_LQAG5aiqmzc2BOfcgW1YEA_bIeMB9Ut';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Задачи', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Задачи', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: d.data || {},
    actions: d.actions || [],
    requireInteraction: !!d.sticky
  }));
});

/* Сообщить открытым окнам приложения, что данные изменились */
function tellClients(msg) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    cs.forEach(function (c) { c.postMessage(msg); });
  });
}

/* Открыть приложение (и задачу, если она есть) */
function openApp(taskId) {
  var url = new URL('./', self.registration.scope);
  if (taskId) url.searchParams.set('task', taskId);
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if ('focus' in cs[i]) { cs[i].postMessage({ open: taskId || null, refresh: true }); return cs[i].focus(); }
    }
    return self.clients.openWindow(url.href);
  });
}

/* Короткое уведомление с результатом нажатия кнопки */
function notifyResult(ok, text, d) {
  return self.registration.showNotification(ok ? 'Готово ✓' : 'Не получилось', {
    body: text,
    tag: d.tag || ('result-' + (d.task_id || '')),
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    silent: ok,
    data: { task_id: d.task_id || null, result: true }
  });
}

self.addEventListener('notificationclick', function (e) {
  var n = e.notification, d = n.data || {};
  n.close();

  // Кнопка в уведомлении (например, «Отметить»)
  if (e.action && d.token) {
    e.waitUntil(
      fetch(PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: API_KEY },
        body: JSON.stringify({ action: 'act', token: d.token, act: e.action })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
        .then(function (res) {
          var ok = res.r.ok && res.j && res.j.ok !== false && !res.j.error;
          var label = (n.actions || []).filter(function (a) { return a.action === e.action; }).map(function (a) { return a.title; })[0] || '';
          return tellClients({ refresh: true }).then(function () {
            return notifyResult(ok, ok ? (label ? label + ': ' : '') + (n.title || 'задача') : ((res.j && res.j.error) || ('ошибка ' + res.r.status)) + '. Нажмите, чтобы открыть задачу', d);
          });
        })
        .catch(function () {
          return notifyResult(false, 'Нет связи с сервером. Нажмите, чтобы открыть задачу', d);
        })
    );
    return;
  }

  // Нажатие на само уведомление — открыть приложение
  e.waitUntil(openApp(d.task_id));
});
