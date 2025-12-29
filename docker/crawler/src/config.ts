import { z } from "zod";

const schema = z.object({
  AI_NEWS_BASE_URL: z.string().url(),
  INGEST_SECRET: z.string().min(1),
  SOURCES_LIMIT: z.coerce.number().int().min(1).max(500).default(200),
  ITEMS_PER_SOURCE: z.coerce.number().int().min(1).max(50).default(20),
  CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  LOOP: z
    .string()
    .optional()
    .transform((v) => (v ?? "false").toLowerCase() === "true"),
  LOOP_INTERVAL_MS: z.coerce.number().int().min(5000).default(60_000),
  JINA_READER_PREFIX: z.string().default("https://r.jina.ai/http://"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-haiku-latest"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),
});

export type CrawlerConfig = z.infer<typeof schema>;

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): CrawlerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid config: ${parsed.error.message}`);
  }
  return parsed.data;
}
