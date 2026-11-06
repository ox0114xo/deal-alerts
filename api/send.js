// Vercel Function：驗證管理員密碼(由 Supabase RPC 檢查) -> 取出所有訂閱 -> 推播
const webpush = require('web-push');
const SB = 'https://bfydeckhzazenebgduwy.supabase.co', KEY = 'sb_publishable_fwuVUnvOmOFSCgnv8F-Rhg_OlG9vtlD';
const rpc = (fn, args) => fetch(SB + '/rest/v1/rpc/' + fn, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(args)
});
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { pw, title, body } = req.body || {};
  if (!pw || !body) return res.status(400).json({ error: '缺少密碼或內容' });
  webpush.setVapidDetails('mailto:admin@example.com', 'BM28jEtri0zOpJy0fm44NMh3brS-RKk6NBB1XET8rkNFofI74u9U4qMPFmevaUztuDoMJhsvEFmOIucbM4_5mlY', process.env.VAPID_PRIVATE);
  const r = await rpc('push_demo_list', { p_pw: pw });
  if (!r.ok) return res.status(401).json({ error: '密碼錯誤' });
  const subs = await r.json();
  const payload = JSON.stringify({ title: title || '公告', body });
  let sent = 0, failed = 0;
  await Promise.all(subs.map(async s => {
    try { await webpush.sendNotification(s, payload); sent++; }
    catch (e) {
      failed++;
      // 訂閱失效 -> 移除
      if (e.statusCode === 404 || e.statusCode === 410) await rpc('push_demo_remove', { p_pw: pw, p_endpoint: s.endpoint });
    }
  }));
  res.json({ total: subs.length, sent, failed });
};
