// 每分鐘由 Supabase pg_cron 呼叫：送出到時間的排程優惠 + 到期前 3 小時提醒
const crypto = require('crypto');
const { call, sendArticle } = require('./_lib');
// 只存雜湊；先在本地比對，避免外人亂打 /api/cron 造成資料庫鎖定
const CRON_HASH = 'df4a55160e749919182a5f88dc6fc865f1ed8f00e63fbf3c354993098d6e65af';
module.exports = async (req, res) => {
  const secret = req.headers['x-cron-secret'] || '';
  const h = crypto.createHash('sha256').update('deal-alerts:' + secret).digest('hex');
  if (!secret || h !== CRON_HASH) return res.status(401).json({ error: 'unauthorized' });
  const due = await call(secret, 'due');
  const rem = await call(secret, 'reminders');
  for (const id of due.ids || []) await sendArticle(secret, id);
  for (const id of rem.ids || []) await sendArticle(secret, id, { reminder: true });
  res.json({ due: (due.ids || []).length, reminders: (rem.ids || []).length });
};
