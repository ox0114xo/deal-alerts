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

// 離線快取：頁面採「網路優先，失敗才用快取」，避免部署後看到舊版
const CACHE = 'deal-alerts-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // 只處理本站 GET 頁面/靜態檔；API 與後台一律走網路
  if (e.request.method !== 'GET' || u.origin !== self.location.origin || u.pathname.startsWith('/api/') || u.pathname === '/admin.html') return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match('/'))));
});
