import { getSiteUrl } from '@/lib/d1';
import { listNews } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET() {
  const baseUrl = await getSiteUrl();
  const { items } = await listNews({ limit: 50, minImportance: 0 });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml('AI News')}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(
      'Daily AI industry updates. Aggregated, clustered, and summarized for fast reading.'
    )}</description>
    <language>en</language>
    ${items
      .map((n) => {
        const link = `${baseUrl}/news/${n.id}`;
        const desc = n.oneLine || n.summary || '';
        return `
    <item>
      <title>${escapeXml(n.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(n.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`;
      })
      .join('')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
