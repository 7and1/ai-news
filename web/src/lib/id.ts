import { createHash } from 'crypto';

export function idFromUrl(url: string, length = 16): string {
  const hash = createHash('sha256').update(url).digest('base64url');
  return hash.slice(0, length);
}
