// Vercel Function: 驗證密碼並建立文章 -> 分批讀取訂閱 -> 分批推播 -> 回寫結果
const webpush = require('web-push');
const SB = 'https://bfydeckhzazenebgduwy.supabase.co', KEY = 'sb_publishable_fwuVUnvOmOFSCgnv8F-Rhg_OlG9vtlD';
const PAGE = 500, CHUNK = 50;
const rpc = (fn, args) => fetch(SB + '/rest/v1/rpc/' + fn, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(args)
});
const okUrl = u => !u || /^https:\/\/[^\s]+$/i.test(u);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { pw, title, body, image, link } = req.body || {};
  if (!pw || !body) return res.status(400).json({ error: '缺少密碼或內容' });
  if (!okUrl(image) || !okUrl(link)) return res.status(400).json({ error: '圖片/連結必須是 https 網址' });
  webpush.setVapidDetails('mailto:admin@example.com', 'BM28jEtri0zOpJy0fm44NMh3brS-RKk6NBB1XET8rkNFofI74u9U4qMPFmevaUztuDoMJhsvEFmOIucbM4_5mlY', process.env.VAPID_PRIVATE);

  // 建立文章（同時驗證密碼）
  const t = (title || '最新優惠').slice(0, 100);
  const c = await rpc('push_demo_create', { p_pw: pw, p_title: t, p_body: body, p_image: image || '', p_link: link || '' });
  if (!c.ok) return res.status(401).json({ error: '密碼錯誤' });
  const id = await c.json();

  // 通知 payload 需小於 4KB，內文只帶摘要；點擊後開啟文章頁
  const payload = JSON.stringify({ title: t, body: body.slice(0, 120), image: image || undefined, url: '/article.html?id=' + id });

  let total = 0, sent = 0, failed = 0;
  const dead = [];
  for (let off = 0; ; off += PAGE) {
    const r = await rpc('push_demo_list_page', { p_pw: pw, p_offset: off, p_limit: PAGE });
    if (!r.ok) break;
    const subs = await r.json();
    if (!subs.length) break;
    total += subs.length;
    for (let i = 0; i < subs.length; i += CHUNK) {
      await Promise.all(subs.slice(i, i + CHUNK).map(async s => {
        try { await webpush.sendNotification(s, payload); sent++; }
        catch (e) {
          failed++;
          if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint);
        }
      }));
    }
    if (subs.length < PAGE) break;
  }
  // 迴圈結束後再移除失效訂閱，避免分頁位移
  await Promise.all(dead.map(ep => rpc('push_demo_remove', { p_pw: pw, p_endpoint: ep })));
  await rpc('push_demo_finish', { p_pw: pw, p_id: id, p_total: total, p_sent: sent, p_failed: failed });
  res.json({ id, total, sent, failed });
};
