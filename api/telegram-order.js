export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return res.status(500).json({ ok: false, error: 'Telegram environment variables are missing' });
    }

    const order = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const total = order.total_price || order.totalPrice || order.price || '';
    const quantity = order.quantity || '';
    const city = order.city || '';
    const address = order.address || order.customer_address || '';
    const product = order.product || '';
    const notes = order.notes || '';
    const orderId = order.order_id || order.orderId || '';
    const pageUrl = order.url || '';

    const message = [
      '🔥 <b>New Libya Order - Pump</b>',
      '',
      `🆔 <b>Order:</b> ${escapeHtml(orderId)}`,
      `👤 <b>Name:</b> ${escapeHtml(order.name || order.customer_name || '')}`,
      `📞 <b>Phone:</b> ${escapeHtml(order.phone || order.customer_phone || '')}`,
      `📍 <b>City:</b> ${escapeHtml(city)}`,
      `🏠 <b>Address:</b> ${escapeHtml(address)}`,
      '',
      `📦 <b>Product:</b> ${escapeHtml(product)}`,
      `🔢 <b>Qty:</b> ${escapeHtml(quantity)}`,
      `💰 <b>Total:</b> ${escapeHtml(total)} ${escapeHtml(order.currency || 'LYD')}`,
      `📝 <b>Notes:</b> ${escapeHtml(notes)}`,
      '',
      `🔗 <b>Page:</b> ${escapeHtml(pageUrl)}`
    ].join('\n');

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      return res.status(502).json({ ok: false, error: 'Telegram send failed', details: telegramResult });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Unknown error' });
  }
}
