import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchDueSources } from "@/lib/crawler/api-client";
import { loadCrawlerConfig } from "@/lib/crawler/config";
import { batchCrawlSources } from "@/lib/crawler/crawler";
import { getEnv } from "@/lib/d1";
import { createMiddleware, ValidationError, withSecurityHeaders } from "@/lib/middleware";
import { logger, reportError } from "@/lib/monitoring";

const bodySchema = z.object({
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  sourceTypes: z.array(z.string().min(1)).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const POST = createMiddleware(
  {
    requireSecret: { key: "CRON_SECRET" },
    rateLimit: "INGEST",
    securityHeaders: true,
  },
  async (request: NextRequest): Promise<NextResponse> => {
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    const startedAt = Date.now();
    const { priority, sourceTypes, limit } = parsed.data;

    try {
      const env = await getEnv();
      if (!env.DB) {
        throw new Error("Database not available");
      }

      const config = loadCrawlerConfig(env as unknown as CloudflareEnv);
      const selectedTypes =
        sourceTypes && sourceTypes.length > 0
          ? sourceTypes
          : priority === "high"
            ? config.highPriorityTypes
            : priority === "medium"
              ? config.mediumPriorityTypes
              : config.lowPriorityTypes;

      const dueSources = await fetchDueSources(config, env.DB as any, {
        limit: limit ?? config.sourcesPerBatch,
        sourceTypes: selectedTypes as string[],
      });

      if (dueSources.length === 0) {
        return NextResponse.json({
          ok: true,
          priority,
          sources: 0,
          total: { ok: 0, skipped: 0, failed: 0, total: 0 },
          durationMs: Date.now() - startedAt,
        });
      }

      await logger.info("Cron crawl started", {
        priority,
        sources: dueSources.length,
        types: selectedTypes,
      });

      const sources = dueSources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        type: s.type as any,
        category: s.category,
        language: s.language,
        crawlFrequency: s.crawlFrequency,
        needCrawl: s.needCrawl,
        lastCrawledAt: s.lastCrawledAt,
        errorCount: s.errorCount,
      }));

      const result = await batchCrawlSources(config, env.DB as any, sources as any);
      const durationMs = Date.now() - startedAt;

      await logger.info("Cron crawl completed", {
        priority,
        durationMs,
        total: result.total,
      });

      // Best-effort: store last run in KV for the admin crawler dashboard.
      if (env.METRICS) {
        try {
          const existing = (await env.METRICS.get("crawler:recent_runs", "json")) as unknown;
          const runs = Array.isArray(existing) ? existing.slice(0, 49) : [];
          runs.unshift({
            at: startedAt,
            priority,
            durationMs,
            sources: dueSources.length,
            total: result.total,
          });
          await env.METRICS.put("crawler:recent_runs", JSON.stringify(runs));
          await env.METRICS.put("crawler:last_run", String(startedAt));
        } catch {
          // ignore KV failures
        }
      }

      return NextResponse.json({
        ok: true,
        priority,
        sources: dueSources.length,
        total: result.total,
        durationMs,
      });
    } catch (err) {
      await reportError(err, { endpoint: "/api/cron/crawl", priority });
      throw err;
    }
  }
);

export const OPTIONS = withSecurityHeaders(async (): Promise<NextResponse> => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret",
      "Access-Control-Max-Age": "86400",
    },
  });
});
