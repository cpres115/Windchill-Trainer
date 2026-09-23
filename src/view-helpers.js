const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** HTML-escapes text and wraps each matched search term in <mark>. */
export function highlight(text, terms = []) {
  const safe = escapeHtml(text);
  const words = terms
    .filter((t) => t && t.length > 1)
    .map((t) => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return safe;
  return safe.replace(new RegExp(`(${words.join('|')})`, 'gi'), '<mark>$1</mark>');
}

/** "2026-09-23T14:05:00.000Z" -> "2026-09-23" */
export function fmtDate(iso) {
  return String(iso || '').slice(0, 10);
}
