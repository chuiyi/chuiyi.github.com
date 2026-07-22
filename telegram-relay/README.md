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

### Deploy via the Cloudflare dashboard instead

No CLI needed if you'd rather use the web UI:

1. **Workers & Pages -> Create a Worker -> Start with Hello World!**, name it
   `dcu-telegram-relay`.
2. In the online editor, replace the generated code with the contents of
   `worker.js` in this directory, then **Deploy**.
3. Copy the worker's `*.workers.dev` URL from the overview page.
4. **Settings -> Variables and Secrets** -> add the same five values as
   above, each as type **Secret** (not Plaintext). Redeploy if prompted so
   they take effect.

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
- Button press (`callback_query`) -> immediately collapses the message's
  buttons to a status label (`editMessageReplyMarkup`) so a repeat tap can't
  re-fire the routine, then fires the routine with
  `[Telegram Bot] action=dcu_approve` or `dcu_discard`, and acknowledges the
  tap so Telegram clears the loading spinner. A tap that lands after the
  buttons already collapsed (race on a fast double-tap) is answered with
  "這則已經處理過了" and dropped.
- Free-text reply (`message`) -> fires the routine with
  `[Telegram Bot] instruction=<your text>`, so you can ask for edits
  ("拿掉第二則", "標題改短一點") without pressing a button.
- Everything else is dropped silently.

## Routine prompt

This is the Instructions text pasted into the DCU news routine at
claude.ai/code/routines (not something this repo runs — kept here so the
worker's expectations and the routine's behavior stay documented together).

```
【任務】每日 DC Universe（DCU）新聞整理 + Telegram 確認流程

一、判斷觸發來源
- 若收到的訊息包含 <routine-fire-payload> 區塊，代表這次是 Telegram Bot（經 Cloudflare relay）觸發的確認/調整流程，直接跳到「二、Telegram 觸發分支」，不要重新搜尋新聞。
- 否則視為每日排程觸發，執行「三、排程分支」。

二、Telegram 觸發分支
1. 解析 <routine-fire-payload> 內容，格式為 "[Telegram Bot] action=xxx" 或 "[Telegram Bot] instruction=自由文字"。
2. 到分支 claude/dcu-pending 讀取最新的草稿檔 DCU/_pending/news-<日期>.json；若找不到，用 Telegram sendMessage 回報「找不到待確認的新聞草稿」並結束。
3a. action=dcu_approve → 將草稿內容（已是完整 schema，見「三」）直接合併進 /DCU/data/news.json（依 id 去重，不覆蓋舊資料），建立分支、commit（訊息加註 "via Telegram Bot"）、開 Pull Request（PR 說明註明是透過 Telegram Bot 確認後自動送出），完成後用 Telegram sendMessage 回報 PR 連結，並清掉 claude/dcu-pending 上的草稿檔。
3b. action=dcu_discard → 刪除 claude/dcu-pending 上的草稿檔，用 Telegram sendMessage 回報「已放棄本次新聞草稿」，結束。
3c. instruction=自由文字 → 依文字調整草稿內容（刪除某則/修改摘要/只留幾則等，調整後仍要維持三、規定的完整 schema），更新 claude/dcu-pending 上的草稿檔，然後用 Telegram sendMessage 附上調整後的清單與新的 inline keyboard（✅ 確認上稿 / ❌ 放棄）再次確認；若文字已經明確要求發布/上稿/開PR，視同 action=dcu_approve 直接執行 3a。

三、排程分支（每天觸發一次）
1. 搜尋過去 3 天內所有與 DC Universe 相關新聞，範圍含 DC Studios（James Gunn 領導）電影、影集、選角、拍攝進度、發行日期異動。
2. 依日期新到舊排序整理，每則直接產生對齊網站 /DCU/data/news.json 的完整欄位：
   - id：kebab-case 唯一識別字串，格式 "<YYYY-MM-DD>-<事件關鍵字slug>"，例如 "2026-07-20-lanterns-teaser-poster"
   - date："YYYY.MM.DD"（注意用點不是橫線，跟現有資料格式一致）
   - tag：從既有分類挑選最相關的一個，例如 Superman / Supergirl / Clayface / Lanterns / Batman / Blue Beetle / The Authority / Elseworlds；找不到對應角色/作品就用 "DCU"
   - title：新聞標題
   - summaryHtml：2-3 句改寫摘要（用自己的話，不逐字引用原文；純文字或簡單 HTML 皆可，會被直接當 HTML 渲染）
   - sourceName：來源媒體名稱；同一事件多家媒體報導時，選最主要一家當 sourceName，其餘來源可以在 summaryHtml 結尾補充列出
   - sourceUrl：來源連結
3. 若過去 3 天內沒有相關新聞：用 Telegram sendMessage 回報「近三天無 DCU 相關新聞」，結束，不用往下走。
4. 若有新聞：把整理結果（陣列，元素為上述完整欄位物件）寫成 DCU/_pending/news-<今天日期 YYYY-MM-DD>.json，push 到分支 claude/dcu-pending（分支已存在就覆蓋更新該檔案，不用開 PR）。
5. 用 Telegram Bot API（TELEGRAM_BOT_TOKEN、TELEGRAM_CHAT_ID 為環境變數）sendMessage 傳送新聞清單摘要（繁體中文，可讀性優先，不用貼整包 JSON），並附上 inline keyboard：
   [[{"text":"✅ 確認上稿","callback_data":"dcu_approve"},{"text":"❌ 放棄","callback_data":"dcu_discard"}]]
   也可以直接用文字回覆調整內容，會走「二、Telegram 觸發分支」的 instruction 流程。

四、注意事項
- 只有「二、Telegram 觸發分支」的 3a（或等同的 instruction）可以寫入 /DCU/data/news.json；排程分支本身絕對不要直接寫入正式檔案。
- id 一旦產生就不要在後續調整（3c）中更動，除非該則新聞被整則刪除；這樣才能穩定用 id 去重。
- Telegram sendMessage 範例：
  POST https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage
  body: {"chat_id":"$TELEGRAM_CHAT_ID","text":"...","reply_markup":{"inline_keyboard":[[...]]}}
```
