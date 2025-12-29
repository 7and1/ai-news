import { ImageResponse } from 'next/og';

import { getNewsById } from '@/lib/db/queries';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const news = await getNewsById(id);
  if (!news) {
    return new Response('Not found', { status: 404 });
  }

  const title = news.title.length > 120 ? `${news.title.slice(0, 117)}…` : news.title;
  const subtitle = `${news.sourceName} • ${news.language.toUpperCase()} • ${news.importance}/100`;

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px',
        background: '#0a0a0a',
        color: '#fafafa',
      }}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: '#fafafa',
            color: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          AI
        </div>
        <div style={{ fontSize: 24, fontWeight: 600 }}>AI News</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
        <div style={{ fontSize: 24, opacity: 0.85 }}>{subtitle}</div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 20,
          opacity: 0.75,
        }}
      >
        <div>ai-news</div>
        <div>{new Date(news.publishedAt).toISOString().slice(0, 10)}</div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
