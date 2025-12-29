import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getEnv } from '@/lib/d1';
import { compareSecrets } from '@/lib/security/timing';


interface WebVitalsPayload {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
  delta: number;
  navigationType?: string;
  url: string;
  userAgent: string;
  timestamp: number;
  analyticsId?: string;
}

const metricsCache: Map<string, WebVitalsPayload[]> = new Map();

function validatePayload(data: unknown): data is WebVitalsPayload {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const payload = data as Record<string, unknown>;
  return (
    typeof payload.name === 'string' &&
    typeof payload.value === 'number' &&
    typeof payload.rating === 'string' &&
    typeof payload.id === 'string' &&
    typeof payload.url === 'string' &&
    typeof payload.timestamp === 'number'
  );
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    if (!validatePayload(payload)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const dateKey = new Date(payload.timestamp).toISOString().slice(0, 10);
    const key = `${payload.name}-${dateKey}`;
    const existing = metricsCache.get(key) || [];
    existing.push(payload);
    metricsCache.set(key, existing.slice(-1000));

    try {
      const env = await getEnv();
      if (env.WEB_VITALS_KV) {
        await env.WEB_VITALS_KV.put(`metrics:${key}:${payload.id}`, JSON.stringify(payload), {
          expirationTtl: 60 * 60 * 24 * 30,
        });
      }
    } catch {
      // KV might not be available
    }

    return NextResponse.json({ received: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? null;
  const env = await getEnv();
  const expected = env.ADMIN_API_KEY ?? env.ADMIN_SECRET ?? null;
  if (!expected || !token || !compareSecrets(expected, token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const aggregates: Record<string, { count: number; avg: number; p75: number }> = {};

  for (const [key, metrics] of Array.from(metricsCache.entries())) {
    const parts = key.split('-');
    const name = parts[0];
    if (!name) {
      continue;
    }
    const values = metrics.map((m) => m.value).sort((a, b) => a - b);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const p75Index = Math.floor(values.length * 0.75);
    const p75 = values[p75Index] ?? 0;

    aggregates[name] = {
      count: values.length,
      avg: Math.round(avg),
      p75: Math.round(p75),
    };
  }

  return NextResponse.json({ metrics: aggregates });
}
