export default async function handler(req, res) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return res.status(500).json({
        ok: false,
        error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID',
        hasToken: Boolean(token),
        hasChatId: Boolean(chatId)
      });
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ Telegram test from Vercel is working.',
        disable_web_page_preview: true
      })
    });

    const result = await telegramResponse.json();

    return res.status(telegramResponse.ok ? 200 : 502).json({
      ok: telegramResponse.ok && result.ok,
      telegramStatus: telegramResponse.status,
      result
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Unknown error' });
  }
}
