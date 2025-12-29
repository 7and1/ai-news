# Monitoring and Alerting Setup

This guide covers monitoring, logging, and alerting for BestBlogs.dev.

## Table of Contents

1. [Overview](#overview)
2. [Health Checks](#health-checks)
3. [Logging](#logging)
4. [Metrics](#metrics)
5. [Error Tracking](#error-tracking)
6. [Alerts](#alerts)
7. [Dashboards](#dashboards)

---

## Overview

BestBlogs.dev uses a multi-layered monitoring approach:

| Layer          | Tool            | Purpose            |
| -------------- | --------------- | ------------------ |
| Application    | Custom logger   | Structured logging |
| Error Tracking | KV storage      | Error aggregation  |
| Performance    | KV metrics      | Response times     |
| Uptime         | Health endpoint | Availability       |
| Deployment     | GitHub Actions  | CI/CD status       |

---

## Health Checks

### Health Check Endpoint

**URL**: `/api/health`

**Response**:

```json
{
  "status": "ok",
  "timestamp": 1706500800000,
  "version": "0.1.0-abc1234",
  "checks": {
    "database": "ok",
    "kv": "ok",
    "r2": "ok"
  }
}
```

### Monitoring Script

```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="https://bestblogs.dev/api/health"
TIMEOUT=10
MAX_RETRIES=3

for i in $(seq 1 $MAX_RETRIES); do
  RESPONSE=$(curl -sf -w "\n%{http_code}" --max-time $TIMEOUT $HEALTH_URL || echo "000")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [ "$HTTP_CODE" = "200" ]; then
    STATUS=$(echo "$BODY" | jq -r '.status')
    if [ "$STATUS" = "ok" ]; then
      echo "Health check passed"
      exit 0
    fi
  fi

  echo "Attempt $i failed (HTTP $HTTP_CODE)"
  sleep 5
done

echo "Health check failed after $MAX_RETRIES attempts"
exit 1
```

### Cron Job for Monitoring

```bash
# Add to crontab for every 5 minutes
*/5 * * * * /path/to/health-check.sh
```

---

## Logging

### Log Levels

| Level | Usage                    | Example          |
| ----- | ------------------------ | ---------------- |
| ERROR | Errors needing attention | Failed API calls |
| WARN  | Warning conditions       | High latency     |
| INFO  | Informational            | User actions     |
| DEBUG | Debugging                | Detailed flow    |

### Log Format

```typescript
interface LogEntry {
  level: "ERROR" | "WARN" | "INFO" | "DEBUG";
  timestamp: number;
  message: string;
  context?: {
    userId?: string;
    requestId?: string;
    path?: string;
    [key: string]: unknown;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}
```

### Writing Logs

```typescript
import { logger } from "@/lib/monitoring/logger";

// Info log
logger.info("User subscribed", { email: "user@example.com" });

// Warning log
logger.warn("High memory usage", { usage: "90%" });

// Error log
logger.error("Database query failed", {
  query: "SELECT * FROM news",
  error: err,
});

// Debug log
logger.debug("Processing article", { id: "123" });
```

### Accessing Logs

```bash
# Real-time logs via Wrangler
wrangler tail --format pretty

# Logs from KV
wrangler kv:key list --namespace-id=<logs-kv-id>

# Specific log entry
wrangler kv:key get "log:2025-01-29:abc123" --namespace-id=<logs-kv-id>
```

---

## Metrics

### Available Metrics

| Metric              | Type    | Description             |
| ------------------- | ------- | ----------------------- |
| `request_count`     | Counter | Total requests          |
| `response_time_p50` | Gauge   | 50th percentile latency |
| `response_time_p95` | Gauge   | 95th percentile latency |
| `error_rate`        | Gauge   | Error percentage        |
| `active_users`      | Gauge   | Current active users    |
| `news_count`        | Gauge   | Total news articles     |

### Recording Metrics

```typescript
import { recordMetric } from "@/lib/monitoring/metrics";

// Record request
await recordMetric("request_count", 1, {
  endpoint: "/api/news",
  method: "GET",
});

// Record response time
await recordMetric("response_time_p95", duration, {
  endpoint: "/api/search",
});

// Record error
await recordMetric("error_rate", 1, {
  type: "database",
});
```

### Querying Metrics

```bash
# Get latest metrics
wrangler kv:key get "metrics:$(date +%Y-%m-%d)" --namespace-id=<metrics-kv-id>

# Get specific metric
wrangler kv:key get "metric:request_count:2025-01-29" --namespace-id=<metrics-kv-id>
```

---

## Error Tracking

### Error Storage

Errors are stored in KV with this structure:

```
Key: error:<fingerprint>
Value: {
  fingerprint: string,
  message: string,
  stack: string,
  firstSeen: number,
  lastSeen: number,
  count: number,
  context: {...}
}
```

### Tracking Errors

```typescript
import { trackError } from "@/lib/monitoring/errors";

try {
  // Some operation
} catch (error) {
  await trackError(error, {
    context: { userId: "123", action: "subscribe" },
  });
}
```

### Viewing Errors

```bash
# List recent errors
wrangler kv:key list --namespace-id=<error-tracking-kv-id> --prefix="error:"

# Get specific error
wrangler kv:key get "error:abc123def456" --namespace-id=<error-tracking-kv-id>

# Admin API endpoint
curl https://bestblogs.dev/api/admin/errors
```

---

## Alerts

### Alert Types

| Alert                | Trigger                   | Severity |
| -------------------- | ------------------------- | -------- |
| Health Check Failure | 3 consecutive failures    | CRITICAL |
| High Error Rate      | > 1% for 5 minutes        | HIGH     |
| Slow Response        | p95 > 500ms for 5 minutes | MEDIUM   |
| Database Down        | Connection failure        | CRITICAL |
| Worker CPU Limit     | Exceeded                  | HIGH     |

### Slack Alert Format

```json
{
  "text": "Alert: High Error Rate",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Alert: High Error Rate*\n*Severity:* HIGH\n*Rate:* 1.5%\n*Duration:* 5m\n*Environment:* production"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View Logs" },
          "url": "https://dash.cloudflare.com/..."
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Acknowledge" },
          "style": "primary"
        }
      ]
    }
  ]
}
```

### Setting Up Alerts

#### 1. Cloudflare Workers Analytics

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select `ai-news` worker
4. Configure alerts for:
   - Error rate spikes
   - Request failures
   - CPU limit breaches

#### 2. Uptime Monitoring

Use external service (e.g., UptimeRobot, Pingdom):

```bash
# Monitor URL
https://bestblogs.dev/api/health

# Expected status: 200
# Response contains: {"status":"ok"}
# Check interval: 1 minute
```

#### 3. Custom Alert Script

```typescript
// scripts/check-alerts.ts
interface AlertCheck {
  name: string;
  check: () => Promise<boolean>;
  alert: (message: string) => Promise<void>;
}

const checks: AlertCheck[] = [
  {
    name: "health_check",
    check: async () => {
      const res = await fetch("https://bestblogs.dev/api/health");
      const data = await res.json();
      return data.status === "ok";
    },
    alert: async (msg) => {
      await sendSlackAlert(msg, "CRITICAL");
    },
  },
  {
    name: "error_rate",
    check: async () => {
      const rate = await getErrorRate();
      return rate < 0.01; // Less than 1%
    },
    alert: async (msg) => {
      await sendSlackAlert(msg, "HIGH");
    },
  },
];

// Run checks
for (const check of checks) {
  const passed = await check.check();
  if (!passed) {
    await check.alert(`Alert ${check.name} failed`);
  }
}
```

---

## Dashboards

### Cloudflare Dashboard

Access at: https://dash.cloudflare.com/

**Key Views**:

- Workers Analytics: Request volume, errors, latency
- D1 Database: Query performance, storage
- KV Storage: Read/write operations
- R2 Storage: Object count, size

### Custom Dashboard (Optional)

For a unified view, use Grafana or similar:

```yaml
# dashboard-config.yml
panels:
  - title: Request Rate
    query: |
      SELECT count(*) FROM logs
      WHERE timestamp > now() - 5m

  - title: Error Rate
    query: |
      SELECT count(*) / (SELECT count(*) FROM logs) * 100
      FROM logs WHERE level = 'ERROR'

  - title: P95 Latency
    query: |
      SELECT percentile(response_time, 95)
      FROM logs WHERE timestamp > now() - 5m
```

---

## Runbook for Alerts

### Health Check Failure

1. **Verify**: Check if site is actually down

   ```bash
   curl https://bestblogs.dev/api/health
   ```

2. **Check Logs**:

   ```bash
   wrangler tail --format pretty
   ```

3. **Check Deployment**:

   ```bash
   wrangler deployments list
   ```

4. **Rollback** if needed:
   ```bash
   wrangler rollback
   ```

### High Error Rate

1. **Identify Error Pattern**:

   ```bash
   wrangler kv:key list --namespace-id=<error-kv> --prefix="error:"
   ```

2. **Check Recent Deployments**:

   ```bash
   git log --oneline -10
   ```

3. **Review Error Details**:
   ```bash
   curl https://bestblogs.dev/api/admin/errors
   ```

### Slow Response Time

1. **Check Worker CPU Usage**:
   - View in Cloudflare Dashboard
   - Look for CPU limit errors

2. **Profile Application**:

   ```typescript
   console.time("slow-operation");
   // ... operation
   console.timeEnd("slow-operation");
   ```

3. **Check External Dependencies**:
   - D1 query performance
   - KV read/write latency
   - External API calls

---

## Related Documentation

- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
- [CI/CD Troubleshooting](./CI_CD_TROUBLESHOOTING.md)
