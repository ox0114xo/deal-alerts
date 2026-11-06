// Push received -> show notification
self.addEventListener('push', e => {
  let d = { title: '最新優惠', body: '' };
  try { d = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/' }
  }));
});
// Notification click -> open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(l => l.length ? l[0].focus() : clients.openWindow('/')));
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// 空的 fetch handler：確保舊版 Android Chrome 也判定為可安裝
self.addEventListener('fetch', () => {});
