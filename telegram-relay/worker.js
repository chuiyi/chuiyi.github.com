/**
 * Cloudflare Worker relay: Telegram webhook -> Claude Code Routine API trigger.
 *
 * Telegram can't send an `Authorization: Bearer <routine token>` header on its
 * own, so this worker sits in between: it verifies the request really came
 * from Telegram, then re-issues it as an authenticated POST to the routine's
 * /fire endpoint.
 *
 * Required secrets (set with `wrangler secret put <NAME>`):
 *   TELEGRAM_BOT_TOKEN     - the bot's token from BotFather
 *   TELEGRAM_WEBHOOK_SECRET - random string, must match the secret_token
 *                             passed to setWebhook
 *   TELEGRAM_CHAT_ID       - your personal chat id; messages from any other
 *                             chat are ignored
 *   ROUTINE_ID             - the routine's id (from the /fire URL shown in
 *                             the routine's API trigger settings)
 *   ROUTINE_TOKEN          - the bearer token generated for that API trigger
 */

const TELEGRAM_API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;
const KNOWN_ACTIONS = new Set(['dcu_approve', 'dcu_discard']);

async function answerCallback(env, callbackQueryId, text) {
  await fetch(TELEGRAM_API(env.TELEGRAM_BOT_TOKEN, 'answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function collapseButtons(env, chatId, messageId, label) {
  // Replace the button row with a single disabled-looking status label so a
  // second tap can't re-fire the routine. If a near-simultaneous tap already
  // collapsed the buttons, Telegram returns a harmless "message is not
  // modified" error here - swallow it.
  await fetch(TELEGRAM_API(env.TELEGRAM_BOT_TOKEN, 'editMessageReplyMarkup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [[{ text: label, callback_data: 'dcu_noop' }]] },
    }),
  }).catch(() => {});
}

async function sendMessage(env, text) {
  await fetch(TELEGRAM_API(env.TELEGRAM_BOT_TOKEN, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
}

async function fireRoutine(env, text) {
  return fetch(`https://api.anthropic.com/v1/claude_code/routines/${env.ROUTINE_ID}/fire`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.ROUTINE_TOKEN}`,
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('ok');
    }

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('bad request', { status: 400 });
    }

    const chatId = update.callback_query?.message?.chat?.id ?? update.message?.chat?.id;
    if (chatId === undefined || String(chatId) !== env.TELEGRAM_CHAT_ID) {
      // Not our chat - drop it silently so the endpoint can't be used to
      // fire the routine from someone else's Telegram account.
      return new Response('ignored');
    }

    let fireText = null;

    if (update.callback_query) {
      const cq = update.callback_query;
      const action = cq.data; // "dcu_approve" | "dcu_discard" | "dcu_noop"

      if (!KNOWN_ACTIONS.has(action)) {
        // Buttons were already collapsed to a "dcu_noop" status label by an
        // earlier tap - a repeat tap lands here and does nothing.
        await answerCallback(env, cq.id, '這則已經處理過了');
        return new Response('ignored');
      }

      const messageId = cq.message?.message_id;
      if (messageId !== undefined) {
        const label = action === 'dcu_approve' ? '✅ 已確認上稿，處理中…' : '❌ 已放棄';
        await collapseButtons(env, chatId, messageId, label);
      }

      fireText = `[Telegram Bot] action=${action}`;
      await answerCallback(env, cq.id, action === 'dcu_approve' ? '已送出，處理中…' : '已取消');
    } else if (update.message?.text) {
      fireText = `[Telegram Bot] instruction=${update.message.text}`;
    }

    if (!fireText) {
      return new Response('ignored');
    }

    const fireResp = await fireRoutine(env, fireText);
    if (!fireResp.ok) {
      const errText = await fireResp.text();
      await sendMessage(env, `⚠️ 觸發 Routine 失敗（${fireResp.status}）：${errText}`);
    }

    return new Response('ok');
  },
};
