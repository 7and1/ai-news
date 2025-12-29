import { describe, expect, it } from 'vitest';

import { toSafeHtml } from './content';

describe('toSafeHtml', () => {
  it('removes scripts', () => {
    const html = toSafeHtml('<p>ok</p><script>alert(1)</script>', 'html');
    expect(html).toContain('<p>ok</p>');
    expect(html).not.toContain('script');
    expect(html).not.toContain('alert(1)');
  });

  it('renders markdown safely', () => {
    const html = toSafeHtml('**bold**\n\n<a href="javascript:alert(1)">x</a>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).not.toContain('javascript:');
  });
});
