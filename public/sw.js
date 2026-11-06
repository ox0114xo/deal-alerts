// 收到推播 -> 顯示通知（image 僅 Android/桌面支援，iPhone 會忽略）
self.addEventListener('push', e => {
  let d = { title: '最新優惠', body: '' };
  try { d = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: '/icon-192.png', badge: '/icon-192.png', image: d.image,
    data: { url: d.url || '/' }
  }));
});
// 點通知 -> 開啟文章頁
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data.url || '/', self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) { if ('navigate' in c) { c.focus(); return c.navigate(url); } }
    return clients.openWindow(url);
  }));
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
// 空的 fetch handler：確保舊版 Android Chrome 也判定為可安裝
self.addEventListener('fetch', () => {});
