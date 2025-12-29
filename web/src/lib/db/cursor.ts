export type NewsCursor = {
  publishedAt: number;
  id: string;
};

export function encodeCursor(cursor: NewsCursor): string {
  const raw = `${cursor.publishedAt}:${cursor.id}`;
  return Buffer.from(raw).toString('base64url');
}

export function decodeCursor(cursor: string): NewsCursor | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [publishedAtRaw, id] = raw.split(':');
    const publishedAt = Number(publishedAtRaw);
    if (!Number.isFinite(publishedAt) || !id) {return null;}
    return { publishedAt, id };
  } catch {
    return null;
  }
}
