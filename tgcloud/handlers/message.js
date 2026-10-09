// handlers/message.js — the bot's only entry point.
//
// Implements the `/re` command: reply to a message with `/re` and the bot
// reposts that message, attributed to its sender. A sticker is re-sent as a
// sticker; the sender's own `/re` message is removed; warnings self-destruct
// after five seconds.

import { api } from 'sdk';
import { i18n } from '../lib/i18n.js';
import { escapeMarkdown, textMarkdownV2, captionMarkdownV2 } from '../lib/markdown.js';

// Telegram's "GroupAnonymousBot" — the `from.id` of an anonymous group admin.
const ANONYMOUS_ADMIN_ID = 1087968824;

// The bot's own username, needed to tell `/re` from `/re@some_other_bot`.
// Cached for as long as the isolate stays warm.
let cachedBotUsername;

async function botUsername() {
  if (!cachedBotUsername) {
    cachedBotUsername = (await api.getMe()).username;
  }
  return cachedBotUsername;
}

// A `/re` command: the first entity must be a `bot_command` at offset 0 and the
// command word must be `re`. Returns the `@name` the command is addressed to
// (`undefined` for a bare `/re`), or `null` when the message is not a `/re`
// command at all.
function reCommandTarget(message) {
  if (!message.text) return null;
  const [first] = message.entities ?? [];
  if (!first || first.type !== 'bot_command' || first.offset !== 0) return null;
  const [command, target] = message.text.slice(1, first.length).split('@');
  return command.toLowerCase() === 're' ? { target } : null;
}

function fullName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ');
}

// The MarkdownV2 mention of whoever sent the message being repeated. Anonymous
// group admins are attributed to the group (plus their signature), everyone
// else to their user link.
function buildMention(message, lang) {
  const sender = message.from;

  if (sender.id === ANONYMOUS_ADMIN_ID && message.sender_chat) {
    const chat = message.sender_chat;
    const label = chat.title || i18n('group', lang);
    let mention = chat.username
      ? `[${escapeMarkdown(label)}](https://t.me/${chat.username})`
      : escapeMarkdown(label);
    if (message.author_signature) {
      mention += ` \\(${escapeMarkdown(message.author_signature)}\\)`;
    }
    return mention;
  }

  const name = fullName(sender) || i18n('user', lang);
  return `[${escapeMarkdown(name)}](tg://user?id=${sender.id})`;
}

async function deleteQuietly(chatId, messageId) {
  try {
    await api.deleteMessage({ chat_id: chatId, message_id: messageId });
  } catch {
    // Already gone or not deletable — nothing to do.
  }
}

// Telegram Serverless provides no timers (`setTimeout`, `setInterval` and
// `queueMicrotask` are all undefined) and `Date.now()` is frozen, so the
// five-second self-destruct cannot use a timer. `Atomics.wait` blocks the
// current thread for the delay without using CPU — which matters, because the
// runtime enforces a ~3s CPU budget and a busy-wait trips it. The wait happens
// inside the invocation, before it returns.
const WARNING_TTL_MS = 5000;

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    return true;
  } catch {
    return false;
  }
}

async function replyWarning(message, text) {
  const sent = await api.sendMessage({
    chat_id: message.chat.id,
    text,
    reply_parameters: { message_id: message.message_id },
  });
  if (sleep(WARNING_TTL_MS)) {
    await deleteQuietly(message.chat.id, sent.message_id);
  }
}

export default async function (message) {
  const command = reCommandTarget(message);
  if (!command) return;
  if (command.target !== undefined) {
    const username = await botUsername();
    if (command.target.toLowerCase() !== username.toLowerCase()) return;
  }

  const lang = message.from?.language_code;

  const reply = message.reply_to_message;
  if (!reply) {
    await replyWarning(message, i18n('not_replying', lang));
    return;
  }

  if (!message.from) return;

  const mention = buildMention(message, lang);
  const repliedMd = textMarkdownV2(reply) || captionMarkdownV2(reply) || '';

  if (repliedMd) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `${mention}: ${repliedMd}`,
      parse_mode: 'MarkdownV2',
    });
    await deleteQuietly(message.chat.id, message.message_id);
    return;
  }

  if (reply.sticker) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `${mention}:`,
      parse_mode: 'MarkdownV2',
    });
    await api.sendSticker({
      chat_id: message.chat.id,
      sticker: reply.sticker.file_id,
    });
    await deleteQuietly(message.chat.id, message.message_id);
    return;
  }

  await replyWarning(message, i18n('no_text', lang));
}
