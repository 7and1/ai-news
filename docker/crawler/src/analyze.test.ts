import { describe, expect, it } from "vitest";
import type { CrawlerConfig } from "./config.js";
import { analyze } from "./analyze.js";

const baseConfig: CrawlerConfig = {
  AI_NEWS_BASE_URL: "http://localhost:3000",
  INGEST_SECRET: "x",
  SOURCES_LIMIT: 10,
  ITEMS_PER_SOURCE: 5,
  CONCURRENCY: 2,
  LOOP: false,
  LOOP_INTERVAL_MS: 60_000,
  JINA_READER_PREFIX: "https://r.jina.ai/http://",
  ANTHROPIC_API_KEY: undefined,
  ANTHROPIC_MODEL: "claude-3-5-haiku-latest",
  GEMINI_API_KEY: undefined,
  GEMINI_MODEL: "gemini-1.5-flash",
};

describe("analyze (heuristic fallback)", () => {
  it("detects Chinese", async () => {
    const a = await analyze(baseConfig, {
      title: "OpenAI 发布新模型",
      content: "这是一个关于 AI 的新闻。",
      sourceName: "测试源",
      sourceCategory: "ai_company",
    });
    expect(a.language).toBe("zh");
  });

  it("keeps importance in range", async () => {
    const a = await analyze(baseConfig, {
      title: "OpenAI announces a new GPT release",
      content: "Release notes...",
      sourceName: "OpenAI",
      sourceCategory: "ai_company",
    });
    expect(a.importance).toBeGreaterThanOrEqual(0);
    expect(a.importance).toBeLessThanOrEqual(100);
    expect(a.tags.length).toBeGreaterThan(0);
  });
});
