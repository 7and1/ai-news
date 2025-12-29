# Security Implementation Guide

This document describes the security implementation for the BestBlogs.dev web application.

## Overview

The application implements multiple layers of security:

1. **Rate Limiting** - Prevents abuse and DoS attacks
2. **Authentication** - Timing-safe secret validation and JWT support
3. **Input Validation** - Comprehensive Zod schemas for all inputs
4. **Security Headers** - CSP, CORS, and other protective headers
5. **Environment Management** - Secure handling of secrets

## Configuration

### Secrets

Secrets must be set via Wrangler secrets, not in code or config files:

```bash
# Set production secrets
npx wrangler secret put INGEST_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put JWT_SECRET

# For preview environments
npx wrangler secret put INGEST_SECRET --env preview
```

For local development with `wrangler dev`, create a `.dev.vars` file:

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your development secrets
```

### KV Namespaces

The following KV namespaces are required:

1. `RATE_LIMIT_KV` - Stores rate limit counters
2. `LOGS` - Application logs
3. `METRICS` - Metrics storage
4. `ERROR_TRACKING` - Error tracking

Create them with:

```bash
npx wrangler kv:namespace create "RATE_LIMIT_KV"
npx wrangler kv:namespace create "LOGS"
npx wrangler kv:namespace create "METRICS"
npx wrangler kv:namespace create "ERROR_TRACKING"
```

## Rate Limiting

Rate limiting is applied to all API endpoints:

| Endpoint Tier | Requests | Window |
| ------------- | -------- | ------ |
| PUBLIC        | 60/min   | 60s    |
| SEARCH        | 20/min   | 60s    |
| INGEST        | 10/min   | 60s    |
| ADMIN         | 30/min   | 60s    |
| ITEM          | 100/min  | 60s    |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 30
```

When rate limited:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

## Authentication

### Secret-Based Authentication

The ingest and admin endpoints use shared secret authentication:

```bash
# Using x-ingest-secret header
curl -X POST https://api.example.com/api/ingest \
  -H "x-ingest-secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '...'
```

### JWT Authentication

For more advanced authentication, JWT tokens are supported:

```typescript
import { createAdminToken, createServiceToken } from '@/lib/security/jwt';

// Create an admin token (24h expiry)
const token = await createAdminToken('user-id', jwtSecret);

// Create a service token (1h expiry)
const serviceToken = await createServiceToken('service-name', jwtSecret);
```

Using JWT in requests:

```bash
curl https://api.example.com/api/admin/sources \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Security Headers

All responses include security headers:

- `Content-Security-Policy` - Restricts content sources
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `Strict-Transport-Security` - Enforces HTTPS
- `Referrer-Policy` - Controls referrer information
- `Permissions-Policy` - Restricts browser features
- `Cross-Origin-Resource-Policy` - Controls cross-origin access

## CORS Configuration

Public APIs allow cross-origin requests:

```json
{
  "allowedOrigins": ["*"],
  "allowedMethods": ["GET", "HEAD", "OPTIONS"],
  "allowedHeaders": ["Content-Type", "Authorization"]
}
```

For production, configure specific origins in `ALLOWED_ORIGINS`:

```
ALLOWED_ORIGINS=https://bestblogs.dev,https://www.bestblogs.dev
```

## Input Validation

All API inputs are validated using Zod schemas:

- Query parameters are validated before use
- Request bodies are parsed and validated
- Path parameters are checked for format
- Length limits prevent DoS via large inputs

Example validation error:

```json
{
  "error": "validation_error",
  "details": {
    "limit": ["Must be at most 1000"],
    "category": [
      "Invalid enum value. Expected 'Artificial_Intelligence' | 'Business_Tech' | ..."
    ]
  }
}
```

## Timing-Safe Comparisons

Secret comparisons use constant-time algorithms to prevent timing attacks:

```typescript
import { compareSecrets } from '@/lib/security/timing';

const isValid = compareSecrets(storedSecret, providedSecret);
```

## CSRF Protection

State-changing operations require:

1. Non-GET HTTP methods (POST, PUT, DELETE)
2. Authentication via headers (not cookies)
3. CORS validation
4. Rate limiting

## Best Practices

1. **Never commit secrets** - Use Wrangler secrets
2. **Rotate secrets regularly** - Update via `wrangler secret put`
3. **Monitor rate limits** - Watch for abuse patterns
4. **Review logs** - Check LOGS and ERROR_TRACKING KV
5. **Keep dependencies updated** - Run `npm audit` regularly
6. **Test security** - Use the validation schemas in tests

## Testing Security

```typescript
import { timingSafeEqual, compareSecrets } from '@/lib/security/timing';
import { createToken, verifyToken } from '@/lib/security/jwt';

// Test timing-safe comparison
console.assert(timingSafeEqual('secret', 'secret') === true);
console.assert(timingSafeEqual('secret', 'wrong') === false);

// Test JWT flow
const token = await createToken({ sub: 'user', type: 'admin' }, 'secret');
const payload = await verifyToken(token, 'secret');
console.assert(payload.sub === 'user');
```

## Troubleshooting

### Rate Limiting Not Working

Ensure `RATE_LIMIT_KV` is bound in wrangler.json and the KV namespace exists.

### Authentication Failing

1. Check secrets are set: `npx wrangler secret list`
2. Verify header format: `x-ingest-secret` or `Authorization: Bearer ...`
3. Ensure secret is at least 32 characters

### CORS Errors

1. Check `ALLOWED_ORIGINS` includes your domain
2. Verify OPTIONS requests return 204 status
3. Check for typos in allowed headers

## Migration Guide

### From Simple String Comparison

Before:

```typescript
if (secret !== env.INGEST_SECRET) {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
```

After:

```typescript
import { compareSecrets } from '@/lib/security/timing';

if (!compareSecrets(env.INGEST_SECRET, secret)) {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
```

### Adding Rate Limiting

Before:

```typescript
export async function GET(request: NextRequest) {
  // ... handler code
}
```

After:

```typescript
export const GET = createMiddleware(
  { rateLimit: 'PUBLIC', securityHeaders: true, cors: true },
  async (request: NextRequest): Promise<NextResponse> => {
    // ... handler code
  }
);
```

## Additional Resources

- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)
- [Cloudflare Workers Security](https://developers.cloudflare.com/workers/configuration/security/)
- [Zod Validation](https://zod.dev/)
