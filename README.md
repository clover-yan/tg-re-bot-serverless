# tg-re-bot-serverless

A Telegram bot that runs entirely on
[Telegram Serverless](https://core.telegram.org/bots/serverless) — no VPS, no
Docker, no container to keep alive.

## Usage

Demo: [@the_re_bot](https://t.me/the_re_bot)

```text
[reply] /re@the_re_bot
```

Reply to any message with `/re` and the bot reposts it, attributed to its sender.
A replied sticker is re-sent as a sticker. The `/re` command is removed
afterwards, and the "please reply to a message" / "no text content" warnings
self-destruct after five seconds.

## Layout

Everything the platform runs lives in `tgcloud/`:

```text
tgcloud/
├─ handlers/message.js   # the only entry point — handles the /re command
├─ lib/i18n.js           # localized strings (zh-hans / zh-hant / en)
├─ lib/markdown.js       # MarkdownV2 escaping and entity → MarkdownV2 conversion
└─ schema.js             # no tables — this bot keeps no state
```

See [AGENTS.md](AGENTS.md) for the platform's conventions and
[docs/tgcloud-sdk.md](docs/tgcloud-sdk.md) for the SDK reference.

## Deploy

**First, enable Serverless for your bot** in [@BotFather](https://t.me/BotFather)
→ your bot → **Serverless**, then grab the CLI access token (a token separate
from the bot API token).

```bash
npm install          # install the tgcloud CLI
npx tgcloud login    # paste the CLI access token
npx tgcloud status   # review what will be deployed
npx tgcloud push     # deploy the modules
```

Test a change before deploying, without a real update:

```bash
npx tgcloud run handlers/message \
  '{ chat: { id: 1 }, message_id: 10, from: { id: 2, first_name: "Ann" }, text: "/re", entities: [{ type: "bot_command", offset: 0, length: 3 }] }'
```

### Deploy from CI

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) deploys on every
push to `master` (and on manual dispatch). It needs the CLI access token as a
repository secret:

```bash
gh secret set TGCLOUD_TOKEN
```

Until the secret is set, the workflow succeeds but skips the deploy (with a
warning). It runs `tgcloud fetch` before `tgcloud push` so the deploy stays
conditional on the cloud revision — a concurrent deploy is rejected rather than
overwritten. Database migrations are not run by CI; run `npx tgcloud migrate` by
hand if `schema.js` ever gains tables.

## Implementation notes

A few things work differently on the Serverless runtime than on an ordinary
long-running bot:

- **The five-second warning delay is implemented with `Atomics.wait`.** The
  runtime has no timer (`setTimeout`, `setInterval` and `queueMicrotask` are all
  undefined) and `Date.now()` is frozen, so the wait blocks the invocation with
  `Atomics.wait` — zero CPU, which keeps it under the runtime's ~3s CPU budget (a
  busy-wait would be killed). Updates are dispatched asynchronously, so this
  doesn't delay other updates.
- **Only new messages are handled.** The webhook subscribes to the update types
  whose handlers exist, so there is no `edited_message` handler — edited `/re`
  commands are ignored.
- **The bot is stateless** — no database tables, no persistent storage.
