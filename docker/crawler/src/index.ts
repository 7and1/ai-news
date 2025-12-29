import pLimit from "p-limit";
import { loadConfig } from "./config.js";
import { fetchDueSources, postSourceStatus } from "./api.js";
import { crawlSource } from "./crawl.js";

// Shutdown flag for graceful termination
let shutdown = false;

// Handle shutdown signals
function setupShutdownHandlers() {
  const shutdownHandler = () => {
    console.log(
      "[crawler] shutdown signal received, finishing current tasks...",
    );
    shutdown = true;
  };

  process.on("SIGTERM", shutdownHandler);
  process.on("SIGINT", shutdownHandler);
}

async function runOnce() {
  const config = loadConfig();
  const sources = await fetchDueSources(config);
  if (sources.length === 0) {
    console.log(`[crawler] no due sources`);
    return;
  }

  console.log(`[crawler] due sources: ${sources.length}`);
  const limiter = pLimit(config.CONCURRENCY);

  const results = await Promise.allSettled(
    sources.map((s) =>
      limiter(async () => {
        const start = Date.now();
        try {
          const metrics = await crawlSource(config, s);
          const durationMs = Date.now() - start;
          console.log(
            `[crawler] ${s.id} ok=${metrics.ok} skipped=${metrics.skipped} failed=${metrics.failed} total=${metrics.total} (${durationMs}ms)`,
          );
          await postSourceStatus(config, {
            id: s.id,
            crawledAt: Date.now(),
            success: metrics.failed === 0,
            errorCountDelta: metrics.failed,
          });
        } catch (err) {
          const durationMs = Date.now() - start;
          console.warn(
            `[crawler] ${s.id} failed (${durationMs}ms):`,
            err instanceof Error ? err.message : err,
          );
          await postSourceStatus(config, {
            id: s.id,
            crawledAt: Date.now(),
            success: false,
            errorCountDelta: 1,
          });
        }
      }),
    ),
  );

  const rejected = results.filter((r) => r.status === "rejected").length;
  if (rejected) {
    console.warn(`[crawler] ${rejected} tasks rejected`);
  }
}

async function main() {
  const config = loadConfig();
  if (!config.LOOP) {
    await runOnce();
    return;
  }

  console.log(`[crawler] loop enabled interval=${config.LOOP_INTERVAL_MS}ms`);
  setupShutdownHandlers();

  // eslint-disable-next-line no-constant-condition
  while (!shutdown) {
    await runOnce().catch((err) => {
      console.error("[crawler] runOnce error:", err);
    });

    if (shutdown) {
      console.log("[crawler] shutting down gracefully");
      break;
    }

    await new Promise((r) => setTimeout(r, config.LOOP_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
