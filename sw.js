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

self.addEventListener('notificationclick', function (e) {
  var n = e.notification, d = n.data || {};
  n.close();
  if (e.action && d.token) {
    e.waitUntil(fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify({ action: 'act', token: d.token, act: e.action })
    }).catch(function () {}));
    return;
  }
  var url = new URL('./', self.registration.scope);
  if (d.task_id) url.searchParams.set('task', d.task_id);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if ('focus' in cs[i]) { cs[i].postMessage({ open: d.task_id || null }); return cs[i].focus(); }
    }
    return self.clients.openWindow(url.href);
  }));
});
