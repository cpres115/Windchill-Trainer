import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const SANITIZE_OPTIONS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'details', 'summary', 'kbd', 'mark', 'del', 'input']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['id', 'class'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    a: ['href', 'title'],
    th: ['align', 'colspan', 'rowspan'],
    td: ['align', 'colspan', 'rowspan'],
    input: ['type', 'checked', 'disabled'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  transformTags: {
    // Task-list checkboxes only; never an editable form field.
    input: (tagName, attribs) =>
      attribs.type === 'checkbox'
        ? { tagName, attribs: { type: 'checkbox', disabled: 'disabled', ...(attribs.checked !== undefined ? { checked: 'checked' } : {}) } }
        : { tagName: 'span', attribs: {} },
    // External links open in a new tab.
    a: (tagName, attribs) =>
      /^https?:\/\//i.test(attribs.href || '')
        ? { tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }
        : { tagName, attribs },
  },
};
SANITIZE_OPTIONS.allowedAttributes.a.push('target', 'rel');

/**
 * Renders Markdown to sanitized HTML and collects h2/h3 headings for a table
 * of contents.
 */
export function renderMarkdown(source) {
  const toc = [];
  const seen = new Map();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        let id = slugifyHeading(html) || 'section';
        const n = seen.get(id) || 0;
        seen.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth === 2 || depth === 3) toc.push({ id, depth, text: html.replace(/<[^>]+>/g, '') });
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      },
    },
  });
  const html = sanitizeHtml(marked.parse(source || ''), SANITIZE_OPTIONS);
  return { html, toc };
}

/** Plain text version of Markdown, used for indexing and search snippets. */
export function markdownToText(source) {
  const { html } = renderMarkdown(source);
  return sanitizeHtml(html.replace(/<\/(p|h\d|li|tr|pre|blockquote)>/g, '$& '), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
