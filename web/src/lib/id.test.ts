import { describe, expect, it } from 'vitest';

import { idFromUrl } from './id';

describe('idFromUrl', () => {
  it('is deterministic and length-bounded', () => {
    const a = idFromUrl('https://example.com/a', 16);
    const b = idFromUrl('https://example.com/a', 16);
    expect(a).toBe(b);
    expect(a.length).toBe(16);
  });
});
