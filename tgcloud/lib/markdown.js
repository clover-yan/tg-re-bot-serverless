// MarkdownV2 helpers for reposting a message with its formatting intact:
// escaping, and the text/entity → MarkdownV2 conversion.
//
// The escaping rules and entity nesting follow python-telegram-bot.
//
// Telegram entity offsets are counted in UTF-16 code units, which is exactly how
// JavaScript strings are indexed, so entity slices map directly to `slice()`.
//
// Note there is no `version` argument: only MarkdownV2 is used here.

const ESCAPE_ALL = '_*[]()~`>#+-=|{}.!';
const ESCAPE_PRE_CODE = '\\`';
const ESCAPE_LINK = '\\)';

function escapeChars(entityType) {
  if (entityType === 'pre' || entityType === 'code') return ESCAPE_PRE_CODE;
  if (entityType === 'text_link' || entityType === 'custom_emoji') return ESCAPE_LINK;
  return ESCAPE_ALL;
}

// Escape Telegram MarkdownV2 special characters. `entityType` narrows the set
// (inside `code`/`pre`, or a link target).
export function escapeMarkdown(text, entityType) {
  if (text == null) return text;
  const chars = escapeChars(entityType);
  let out = '';
  for (const ch of text) {
    out += chars.includes(ch) ? '\\' + ch : ch;
  }
  return out;
}

function renderEntity(entity, raw, escaped) {
  switch (entity.type) {
    case 'text_link':
      return `[${escaped}](${escapeMarkdown(entity.url, 'text_link')})`;
    case 'text_mention':
      return entity.user ? `[${escaped}](tg://user?id=${entity.user.id})` : escaped;
    case 'bold':
      return `*${escaped}*`;
    case 'italic':
      return `_${escaped}_`;
    case 'code':
      return '`' + escapeMarkdown(raw, 'code') + '`';
    case 'pre': {
      const code = escapeMarkdown(raw, 'pre');
      let prefix;
      if (entity.language) prefix = '```' + entity.language + '\n';
      else if (code.startsWith('\\')) prefix = '```';
      else prefix = '```\n';
      return prefix + code + '```';
    }
    case 'underline':
      return `__${escaped}__`;
    case 'strikethrough':
      return `~${escaped}~`;
    case 'spoiler':
      return `||${escaped}||`;
    case 'blockquote':
      return '>' + escaped.split('\n').join('\n>');
    case 'expandable_blockquote':
      return `>${escaped.split('\n').join('\n>')}||`;
    case 'custom_emoji':
      return `![${escaped}](tg://emoji?id=${escapeMarkdown(entity.custom_emoji_id, 'custom_emoji')})`;
    default:
      // url, mention, hashtag, cashtag, bot_command, phone_number, …
      return escaped;
  }
}

// Port of `Message._parse_markdown(..., version=2, urled=False)`.
function parseMarkdown(messageText, entities, offset = 0) {
  const sorted = entities
    .map((entity, index) => ({ entity, index }))
    .sort((a, b) => a.entity.offset - b.entity.offset);

  let markdown = '';
  let lastOffset = 0;
  const parsed = new Set();

  for (const { entity, index } of sorted) {
    if (parsed.has(index)) continue;

    const nested = sorted.filter(
      (other) =>
        other.index !== index &&
        other.entity.offset >= entity.offset &&
        other.entity.offset + other.entity.length <= entity.offset + entity.length,
    );
    for (const n of nested) parsed.add(n.index);

    const start = entity.offset - offset;
    const end = start + entity.length;
    const raw = messageText.slice(start, end);
    const escaped = nested.length
      ? parseMarkdown(raw, nested.map((n) => n.entity), entity.offset)
      : escapeMarkdown(raw);

    markdown += escapeMarkdown(messageText.slice(lastOffset, start));
    markdown += renderEntity(entity, raw, escaped);
    lastOffset = end;
  }

  return markdown + escapeMarkdown(messageText.slice(lastOffset));
}

export function textMarkdownV2(message) {
  if (message.text == null) return null;
  return parseMarkdown(message.text, message.entities ?? []);
}

export function captionMarkdownV2(message) {
  if (message.caption == null) return null;
  return parseMarkdown(message.caption, message.caption_entities ?? []);
}
