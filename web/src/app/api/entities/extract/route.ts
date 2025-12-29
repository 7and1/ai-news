import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { extractEntities } from '@/lib/entities';
interface ExtractRequest {
  text: string;
  existing?: {
    companies: string[];
    models: string[];
    technologies: string[];
    concepts: string[];
  } | null;
}

export async function POST(req: NextRequest) {
  try {
    const body: ExtractRequest = await req.json();
    const { text, existing } = body;

    if (typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid input: text must be a string' }, { status: 400 });
    }

    const entities = extractEntities(text, existing ?? null);

    return NextResponse.json({ entities });
  } catch (error) {
    console.error('Entity extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract entities' }, { status: 500 });
  }
}
