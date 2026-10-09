// Localized user-facing strings. An unknown / missing language falls back to
// Simplified Chinese.

const LOCALE = {
  user: { 'zh-hans': '用户', 'zh-hant': '用戶', en: 'User' },
  group: { 'zh-hans': '群组', 'zh-hant': '群組', en: 'Group' },
  not_replying: {
    'zh-hans': '请使用 /re 回复一条消息',
    'zh-hant': '請使用 /re 回覆一條消息',
    en: 'Please reply to a message with /re',
  },
  no_text: {
    'zh-hans': '被回复的消息没有文字内容',
    'zh-hant': '被回覆的消息沒有文字內容',
    en: 'The replied message has no text content',
  },
};

export function i18n(key, lang) {
  if (!lang) return LOCALE[key]['zh-hans'];
  if (lang.startsWith('zh')) {
    if (lang.replace(/-/g, '').toLowerCase().includes('hant')) {
      return LOCALE[key]['zh-hant'];
    }
    const lower = lang.toLowerCase();
    if (lower.includes('tw') || lower.includes('hk')) {
      return LOCALE[key]['zh-hant'];
    }
    return LOCALE[key]['zh-hans'];
  }
  return LOCALE[key]['en'];
}
