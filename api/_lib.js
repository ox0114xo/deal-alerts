// 共用函式：呼叫 Supabase 管理 RPC、分批推播、LINE 廣播
const webpush = require('web-push');
const SB = 'https://bfydeckhzazenebgduwy.supabase.co', KEY = 'sb_publishable_fwuVUnvOmOFSCgnv8F-Rhg_OlG9vtlD', PUB = 'BM28jEtri0zOpJy0fm44NMh3brS-RKk6NBB1XET8rkNFofI74u9U4qMPFmevaUztuDoMJhsvEFmOIucbM4_5mlY';
const BASE = 'https://instant-deal-alerts.vercel.app';
const PAGE = 500, CHUNK = 50;

// ip：把真實使用者 IP 帶給 Supabase，登入失敗鎖定才不會誤鎖整個 Vercel
async function call(pw, action, args = {}, ip) {
  const h = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  if (ip) h['x-forwarded-for'] = ip;
  const r = await fetch(SB + '/rest/v1/rpc/push_demo_admin', { method: 'POST', headers: h, body: JSON.stringify({ p_pw: pw, p_action: action, p_args: args }) });
  const j = await r.json().catch(() => ({}));
  return j && typeof j === 'object' ? j : { ok: false, error: 'bad response' };
}

async function lineBroadcast(pw, a, id) {
  try {
    const t = await call(pw, 'secret_get');
    if (!t.ok || !t.value) return 'no-token';
    const text = `${a.title}\n${String(a.body).slice(0, 300)}\n${BASE}/article.html?id=${id}`;
    const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t.value, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ type: 'text', text }] })
    });
    return r.ok ? 'ok' : 'fail:' + r.status;
  } catch (e) { return 'error'; }
}

// 發送一篇文章給符合分類的訂閱者；opts.reminder = 到期前提醒
async function sendArticle(pw, id, opts = {}) {
  webpush.setVapidDetails('mailto:admin@example.com', PUB, process.env.VAPID_PRIVATE);
  const art = await call(pw, 'article', { id });
  const a = art.article;
  if (!a) return null;
  const payload = JSON.stringify({
    title: (opts.reminder ? '⏰ 即將結束：' : '') + a.title,
    body: String(a.body).slice(0, 120),
    image: a.image_url || undefined,
    url: '/article.html?id=' + id
  });
  let total = 0, sent = 0, failed = 0;
  const dead = [];
  for (let off = 0; ; off += PAGE) {
    const r = await call(pw, 'list_page', { offset: off, limit: PAGE, category: a.category || '' });
    const subs = r.subs || [];
    if (!subs.length) break;
    total += subs.length;
    for (let i = 0; i < subs.length; i += CHUNK) {
      await Promise.all(subs.slice(i, i + CHUNK).map(async s => {
        try { await webpush.sendNotification(s, payload); sent++; }
        catch (e) { failed++; if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint); }
      }));
    }
    if (subs.length < PAGE) break;
  }
  // 迴圈結束後再移除失效訂閱，避免分頁位移
  await Promise.all(dead.map(ep => call(pw, 'remove', { endpoint: ep })));
  let line = null;
  if (!opts.reminder) {
    await call(pw, 'finish', { id, total, sent, failed });
    // 設定中開啟「自動同步 LINE」時一併廣播
    const cfg = await fetch(SB + '/rest/v1/rpc/push_demo_settings_get', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json()).catch(() => ({}));
    if (cfg.line_auto === true) line = await lineBroadcast(pw, a, id);
  }
  return { total, sent, failed, line };
}
module.exports = { call, sendArticle };
