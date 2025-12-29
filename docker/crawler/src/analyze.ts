import { z } from "zod";
import type { CrawlerConfig } from "./config.js";
import type { Analysis } from "./types.js";

const analysisSchema = z.object({
  summary: z.string().nullable(),
  oneLine: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  importance: z.number().int().min(0).max(100),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  language: z.enum(["en", "zh"]),
});

function detectLanguage(text: string): "en" | "zh" {
  return /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
}

function heuristicTags(title: string) {
  const cleaned = title
    .replaceAll(/https?:\/\/\S+/g, "")
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 3 && t.length <= 24)
    .slice(0, 12);
  const uniq = Array.from(new Set(tokens.map((t) => t.replaceAll("-", ""))));
  return uniq.slice(0, 8);
}

function heuristicCategory(title: string) {
  const t = title.toLowerCase();
  if (/(release|launch|announce|introduc|unveil|ship)/.test(t))
    return "release";
  if (/(research|paper|benchmark|dataset|arxiv)/.test(t)) return "research";
  if (/(security|vuln|cve|attack|prompt injection)/.test(t)) return "security";
  if (/(funding|acquir|ipo|valuation|invest)/.test(t)) return "business";
  if (/(policy|regulat|law|compliance|copyright)/.test(t)) return "policy";
  return "news";
}

function heuristicImportance(title: string, sourceCategory: string | null) {
  let score = 50;
  if (sourceCategory === "ai_company") score += 10;
  if (
    /(openai|anthropic|deepmind|google|meta|microsoft|amazon|nvidia)/i.test(
      title,
    )
  )
    score += 10;
  if (/(gpt|claude|gemini|llama|qwen|kimi|deepseek)/i.test(title)) score += 8;
  if (/(release|launch|announce|unveil)/i.test(title)) score += 6;
  return Math.max(0, Math.min(100, score));
}

export async function analyze(
  config: CrawlerConfig,
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  },
): Promise<Analysis> {
  const textForLang = `${input.title}\n${input.content}`.slice(0, 4000);
  const language = detectLanguage(textForLang);

  if (config.ANTHROPIC_API_KEY) {
    const maybe = await analyzeAnthropic(config, input).catch(() => null);
    if (maybe) return maybe;
  }

  if (config.GEMINI_API_KEY) {
    const maybe = await analyzeGemini(config, input).catch(() => null);
    if (maybe) return maybe;
  }

  return {
    summary: input.content ? input.content.slice(0, 600).trim() : null,
    oneLine: input.title.slice(0, 140),
    category: heuristicCategory(input.title),
    tags: heuristicTags(input.title),
    importance: heuristicImportance(input.title, input.sourceCategory),
    sentiment: "neutral",
    language,
  };
}

async function analyzeAnthropic(
  config: CrawlerConfig,
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  },
): Promise<Analysis> {
  const prompt = `You are a news analyst for an AI news aggregation site.
Return ONLY valid JSON (no markdown, no backticks) matching this TypeScript type:
{
  summary: string | null;
  oneLine: string | null;
  category: string | null;
  tags: string[];
  importance: number; // 0..100
  sentiment: "positive" | "neutral" | "negative";
  language: "en" | "zh";
}

Rules:
- summary: 2-4 sentences
- oneLine: <= 120 chars
- tags: 3-8 short tags
- importance: consider source + novelty + industry impact

Input:
Source: ${input.sourceName} (${input.sourceCategory ?? "unknown"})
Title: ${input.title}
Content:
${input.content.slice(0, 12_000)}
`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.ANTHROPIC_MODEL,
      max_tokens: 700,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
  }
  const json: any = await res.json();
  const text = (json?.content ?? [])
    .map((c: any) => (c?.type === "text" ? c.text : ""))
    .join("")
    .trim();

  const parsedJson = JSON.parse(text);
  const parsed = analysisSchema.safeParse(parsedJson);
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

async function analyzeGemini(
  config: CrawlerConfig,
  input: {
    title: string;
    content: string;
    sourceName: string;
    sourceCategory: string | null;
  },
): Promise<Analysis> {
  const prompt = `Return ONLY valid JSON matching:
{"summary":string|null,"oneLine":string|null,"category":string|null,"tags":string[],"importance":number,"sentiment":"positive"|"neutral"|"negative","language":"en"|"zh"}

Source: ${input.sourceName} (${input.sourceCategory ?? "unknown"})
Title: ${input.title}
Content:
${input.content.slice(0, 12_000)}
`;

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      config.GEMINI_MODEL,
    )}:generateContent`,
  );
  url.searchParams.set("key", config.GEMINI_API_KEY!);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  }
  const json: any = await res.json();
  const text =
    json?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? "")
      .join("") ?? "";
  const parsedJson = JSON.parse(String(text).trim());
  const parsed = analysisSchema.safeParse(parsedJson);
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}
