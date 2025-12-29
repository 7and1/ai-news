import { ImageResponse } from 'next/og';

export const alt = 'AI News - Daily AI Industry Updates';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        color: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            background: '#fafafa',
            color: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          AI
        </div>
        <div style={{ fontSize: 64, fontWeight: 700 }}>AI News</div>
      </div>

      <div
        style={{
          fontSize: 32,
          opacity: 0.8,
          textAlign: 'center',
          maxWidth: 800,
          lineHeight: 1.4,
        }}
      >
        Daily AI industry updates. Aggregated, clustered, and summarized for fast reading.
      </div>

      <div
        style={{
          marginTop: 48,
          display: 'flex',
          gap: 32,
          fontSize: 20,
          opacity: 0.6,
        }}
      >
        <span>Latest News</span>
        <span>|</span>
        <span>Companies</span>
        <span>|</span>
        <span>Search</span>
        <span>|</span>
        <span>RSS Feed</span>
      </div>
    </div>,
    { ...size }
  );
}
