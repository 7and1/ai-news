import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  it('roundtrips encode/decode', () => {
    const encoded = encodeCursor({ publishedAt: 1735689600000, id: 'abc123' });
    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual({ publishedAt: 1735689600000, id: 'abc123' });
  });

  it('returns null for invalid cursor', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
  });
});
