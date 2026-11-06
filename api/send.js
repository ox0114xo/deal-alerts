// 發送 / 預約優惠：建立文章(同時驗證密碼與角色) -> 立即分批推播，或等排程
const { call, sendArticle } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const b = req.body || {};
  if (!b.pw || !b.title || !b.body) return res.status(400).json({ error: '缺少密碼、標題或內容' });
  // Vercel 注入的真實使用者 IP（不可偽造）
  const ip = (req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || undefined;
  const c = await call(b.pw, 'create', {
    title: b.title, body: b.body, image: b.image || '', link: b.link || '', category: b.category || '',
    expires_at: b.expires_at || '', scheduled_at: b.scheduled_at || '', remind: !!b.remind
  }, ip);
  if (!c.ok) {
    const map = { unauthorized: '密碼錯誤', locked: '錯誤次數過多，請 15 分鐘後再試', forbidden: '沒有權限' };
    return res.status(c.error === 'unauthorized' || c.error === 'locked' ? 401 : 400).json({ error: map[c.error] || c.error });
  }
  if (c.status === 'scheduled') return res.json({ id: c.id, scheduled: true });
  const r = await sendArticle(b.pw, c.id);
  res.json({ id: c.id, ...(r || {}) });
};
