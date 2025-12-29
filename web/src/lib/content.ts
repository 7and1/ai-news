import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export type ContentFormat = 'markdown' | 'html' | 'text';

export function toSafeHtml(input: string, format: ContentFormat = 'markdown') {
  const raw =
    format === 'html'
      ? input
      : format === 'text'
        ? `<p>${escapeHtml(input)}</p>`
        : String(marked.parse(input, { async: false }));

  return sanitizeHtml(raw, {
    allowedTags: [
      'p',
      'br',
      'hr',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'code',
      'pre',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      th: ['align'],
      td: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'nofollow noopener noreferrer',
        target: '_blank',
      }),
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
    },
  });
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
