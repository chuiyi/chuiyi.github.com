# DCU Telegram relay

Small Cloudflare Worker that lets the `chuiyi/lucid-brahmagupta` DCU news
routine be confirmed/adjusted from Telegram instead of waiting in a chat
session. Telegram webhook -> this worker -> Claude Code Routine API trigger
(`/fire`).

Not part of the static site; deploys separately to Cloudflare. See the setup
walkthrough for the full picture (Telegram bot, this worker, and the
routine's own prompt/trigger changes).

## Deploy

Requires a Cloudflare account and the `wrangler` CLI (`npm install -g
wrangler`, or `npx wrangler`).

```bash
cd telegram-relay
wrangler login
wrangler deploy
```

Then set the five secrets (you'll be prompted to paste each value):

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put ROUTINE_ID
wrangler secret put ROUTINE_TOKEN
```

- `TELEGRAM_BOT_TOKEN` - from BotFather.
- `TELEGRAM_WEBHOOK_SECRET` - any random string you make up (e.g. `openssl
  rand -hex 20`). Must match the `secret_token` passed to `setWebhook` below.
- `TELEGRAM_CHAT_ID` - your personal chat id (see below). Messages/button
  presses from any other chat are ignored.
- `ROUTINE_ID` / `ROUTINE_TOKEN` - from the routine's **API trigger** settings
  at claude.ai/code/routines (see main setup walkthrough).

`wrangler deploy` prints the worker's URL, e.g.
`https://dcu-telegram-relay.<your-subdomain>.workers.dev`. That's the
webhook URL for the next step.

## Point the Telegram bot at this worker

Get your chat id (send any message to the bot first, then):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates"
# look for .result[].message.chat.id
```

Register the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://dcu-telegram-relay.<your-subdomain>.workers.dev" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Verify it took:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

## What it does

- Verifies `X-Telegram-Bot-Api-Secret-Token` and the sender's chat id.
- Button press (`callback_query`) -> fires the routine with
  `[Telegram Bot] action=dcu_approve` or `dcu_discard`, and acknowledges the
  tap so Telegram clears the loading spinner.
- Free-text reply (`message`) -> fires the routine with
  `[Telegram Bot] instruction=<your text>`, so you can ask for edits
  ("拿掉第二則", "標題改短一點") without pressing a button.
- Everything else is dropped silently.
