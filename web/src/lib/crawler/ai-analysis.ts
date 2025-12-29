/**
 * AI-powered content analysis for crawled articles.
 * Supports Anthropic Claude and Google Gemini with heuristic fallback.
 */

import type { CrawlerConfig, Analysis } from './types';

/**
 * Analyze article content using available AI services.
 */
export async function analyzeArticle(
  config: CrawlerConfig,
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  }
): Promise<Analysis> {
  const textForLang = `${input.title}\n${input.content}`.slice(0, 4000);
  const language = detectLanguage(textForLang);

  // Try Anthropic first if available
  if (config.anthropicApiKey) {
    try {
      return await analyzeWithAnthropic(config, input, language);
    } catch (error) {
      console.warn(`Anthropic analysis failed: ${error}`);
    }
  }

  // Try Gemini as fallback
  if (config.geminiApiKey) {
    try {
      return await analyzeWithGemini(config, input, language);
    } catch (error) {
      console.warn(`Gemini analysis failed: ${error}`);
    }
  }

  // Fall back to heuristic analysis
  return heuristicAnalysis(input, language);
}

/**
 * Analyze using Anthropic Claude API.
 */
async function analyzeWithAnthropic(
  config: CrawlerConfig,
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  },
  language: 'en' | 'zh'
): Promise<Analysis> {
  const prompt = buildAnthropicPrompt(input, language);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 700,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = (data.content ?? [])
    .filter(
      (block: unknown) =>
        typeof block === 'object' && block !== null && (block as { type: string }).type === 'text'
    )
    .map((block: unknown) => (block as { text: string }).text)
    .join('')
    .trim();

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Anthropic response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return validateAnalysis(parsed);
}

/**
 * Analyze using Google Gemini API.
 */
async function analyzeWithGemini(
  config: CrawlerConfig,
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  },
  language: 'en' | 'zh'
): Promise<Analysis> {
  const prompt = buildGeminiPrompt(input, language);

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`
  );
  url.searchParams.set('key', config.geminiApiKey!);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: unknown) => (part as { text?: string })?.text ?? '')
      .join('') ?? '';

  if (!text) {
    throw new Error('No text in Gemini response');
  }

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Gemini response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return validateAnalysis(parsed);
}

/**
 * Heuristic analysis when AI services are unavailable.
 */
function heuristicAnalysis(
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  },
  language: 'en' | 'zh'
): Analysis {
  const title = input.title.trim();
  const content = input.content.trim().slice(0, 600);

  return {
    summary: content || null,
    oneLine: title.slice(0, 140),
    category: heuristicCategory(title),
    tags: heuristicTags(title),
    importance: heuristicImportance(title, input.sourceCategory),
    sentiment: 'neutral',
    language,
  };
}

/**
 * Build prompt for Anthropic API.
 */
function buildAnthropicPrompt(
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  },
  language: 'en' | 'zh'
): string {
  const lang = language === 'zh' ? 'Chinese' : 'English';

  return `You are a news analyst for BestBlogs.dev, an AI news aggregation site.
Analyze the following article and return ONLY valid JSON (no markdown, no backticks).

Response schema:
{
  "summary": string | null,  // 2-4 sentences summarizing the article
  "oneLine": string | null,  // Single line, max 120 characters
  "category": string | null, // One of: release, research, security, business, policy, news
  "tags": string[],          // 3-8 short, relevant tags
  "importance": number,      // 0-100, based on source credibility, novelty, and industry impact
  "sentiment": "positive" | "neutral" | "negative",
  "language": "en" | "zh"
}

Source: ${input.sourceName} (${input.sourceCategory ?? 'unknown'})
Language: ${lang}

Title: ${input.title}

Content:
${input.content.slice(0, 12000)}`;
}

/**
 * Build prompt for Gemini API.
 */
function buildGeminiPrompt(
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  },
  _language: 'en' | 'zh'
): string {
  return `Return ONLY valid JSON matching this schema:
{"summary":string|null,"oneLine":string|null,"category":string|null,"tags":[],"importance":0-100,"sentiment":"positive"|"neutral"|"negative","language":"en"|"zh"}

Source: ${input.sourceName} (${input.sourceCategory ?? 'unknown'})
Title: ${input.title}
Content:
${input.content.slice(0, 12000)}`;
}

/**
 * Detect language from text (Chinese or English).
 */
function detectLanguage(text: string): 'en' | 'zh' {
  // Check for Chinese characters (CJK Unified Ideographs)
  const chineseCharMatch = text.match(/[\u4e00-\u9fff]/g);
  if (chineseCharMatch && chineseCharMatch.length > text.length * 0.1) {
    return 'zh';
  }
  return 'en';
}

/**
 * Heuristic category detection from title.
 */
function heuristicCategory(title: string): string | null {
  const t = title.toLowerCase();

  if (/(release|launch|announce|introduc|unveil|ship|drop)/.test(t)) {
    return 'release';
  }
  if (/(research|paper|benchmark|dataset|arxiv|study)/.test(t)) {
    return 'research';
  }
  if (/(security|vuln|cve|attack|prompt injection|exploit)/.test(t)) {
    return 'security';
  }
  if (/(funding|acquir|ipo|valuation|invest|fundraise)/.test(t)) {
    return 'business';
  }
  if (/(policy|regulat|law|compliance|copyright|gdpr)/.test(t)) {
    return 'policy';
  }

  return 'news';
}

/**
 * Heuristic tag extraction from title.
 */
function heuristicTags(title: string): string[] {
  // Remove URLs and special characters
  const cleaned = title
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim();

  // Split into tokens and filter
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 3 && t.length <= 24);

  // Remove duplicates (case-insensitive)
  const uniqueTokens = Array.from(new Set(tokens.map((t) => t.toLowerCase())));

  // Return top tags
  return uniqueTokens.slice(0, 8);
}

/**
 * Heuristic importance scoring.
 */
function heuristicImportance(title: string, sourceCategory: string | null): number {
  let score = 50;

  const t = title.toLowerCase();

  // Source category boosts
  if (sourceCategory === 'ai_company') {
    score += 10;
  }

  // Company mentions
  if (/(openai|anthropic|deepmind|google|meta|microsoft|amazon|nvidia|apple)/i.test(t)) {
    score += 10;
  }

  // AI model mentions
  if (/(gpt|claude|gemini|llama|qwen|kimi|deepseek|mistral|flux)/i.test(t)) {
    score += 8;
  }

  // Action words
  if (/(release|launch|announce|unveil|introduc)/i.test(t)) {
    score += 6;
  }

  // Negative words (security issues, etc.)
  if (/(vulnerability|breach|leak|exploit|vuln)/i.test(t)) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Validate and sanitize analysis result.
 */
function validateAnalysis(data: unknown): Analysis {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid analysis result: not an object');
  }

  const obj = data as Record<string, unknown>;

  return {
    summary: typeof obj.summary === 'string' ? obj.summary.slice(0, 500) : null,
    oneLine: typeof obj.oneLine === 'string' ? obj.oneLine.slice(0, 140) : null,
    category: typeof obj.category === 'string' ? obj.category.slice(0, 50) : null,
    tags: Array.isArray(obj.tags)
      ? (obj.tags as string[])
          .filter((t) => typeof t === 'string')
          .map((t) => t.trim().slice(0, 50))
          .filter((t) => t.length > 0)
          .slice(0, 10)
      : [],
    importance:
      typeof obj.importance === 'number' ? Math.max(0, Math.min(100, obj.importance)) : 50,
    sentiment:
      obj.sentiment === 'positive' || obj.sentiment === 'negative' ? obj.sentiment : 'neutral',
    language: obj.language === 'zh' ? 'zh' : 'en',
  };
}

/**
 * Batch analyze multiple articles (simpler version).
 */
export async function batchAnalyze(
  config: CrawlerConfig,
  items: Array<{
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  }>
): Promise<Analysis[]> {
  // For now, process sequentially
  // TODO: Implement batch API calls for better efficiency
  const results: Analysis[] = [];

  for (const item of items) {
    try {
      const analysis = await analyzeArticle(config, item);
      results.push(analysis);
    } catch {
      // Use heuristic fallback on error
      results.push(heuristicAnalysis(item, detectLanguage(item.title + item.content)));
    }
  }

  return results;
}
