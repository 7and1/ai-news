# CI/CD Troubleshooting Guide

This guide helps diagnose and resolve common issues with the BestBlogs.dev CI/CD pipeline.

## Table of Contents

1. [Pipeline Failures](#pipeline-failures)
2. [Common Error Messages](#common-error-messages)
3. [Performance Issues](#performance-issues)
4. [Debugging Techniques](#debugging-techniques)
5. [Escalation Path](#escalation-path)

---

## Pipeline Failures

### Lint Job Failures

**Error**: `eslint found too many warnings (max: 0)`

**Diagnosis**:

```bash
# Run locally to reproduce
cd web
npm run lint

# Check for specific issues
npm run lint:fix
```

**Solutions**:

1. Run `npm run lint:fix` to auto-fix issues
2. For remaining issues, fix manually or update eslint rules
3. If rules are too strict, discuss in team before modifying

### Test Job Failures

**Error**: `Tests failed` or `Coverage below threshold`

**Diagnosis**:

```bash
# Run tests locally
npm run test

# Run with coverage
npm run test:coverage

# Run specific failing test
npm test -- src/lib/specific.test.ts
```

**Solutions**:

1. Check test output for specific failures
2. Update broken tests (not code) if code is correct
3. For new features without tests, add minimal test coverage
4. Request threshold adjustment if coverage goal is unrealistic

### Build Job Failures

**Error**: `Build failed` or `worker.js not found`

**Diagnosis**:

```bash
# Clean build
cd web
rm -rf .next .open-next node_modules
npm ci
npm run build

# Check build output
ls -la .open-next/worker.js
```

**Solutions**:

1. Ensure all dependencies are in package.json
2. Check TypeScript errors: `npm run typecheck`
3. Verify Next.js build completes successfully
4. Check wrangler.json configuration

### Migration Job Failures

**Error**: `Migration failed to apply`

**Diagnosis**:

```bash
# Check migration status
wrangler d1 execute ai_news_db --command="SELECT * FROM _migrations"

# Test migration SQL locally
sqlite3 :memory: < migrations/00000000_000000_init.sql
```

**Solutions**:

1. Verify SQL syntax is valid
2. Check if migration was already applied (idempotency)
3. Use rollback script if partial migration occurred
4. Re-run migration workflow with rollback flag

---

## Common Error Messages

### `Error: No D1 database named "ai_news_db"`

**Cause**: D1 database not created or wrong binding name

**Solution**:

```bash
# Create database
wrangler d1 create ai_news_db

# Update wrangler.json with returned database_id
```

### `Error: KV namespace not found`

**Cause**: KV namespace not created or wrong ID

**Solution**:

```bash
# List KV namespaces
wrangler kv:namespace list

# Create missing namespace
wrangler kv:namespace create "RATE_LIMIT_KV"
```

### `Error: Permission denied`

**Cause**: Insufficient Cloudflare API token permissions

**Solution**:

1. Go to Cloudflare Dashboard > My Profile > API Tokens
2. Edit token to include:
   - Account > Cloudflare Workers > Edit
   - Account > D1 > Edit
   - Account > Workers KV Storage > Edit
   - Account > Workers R2 Storage > Edit

### `Error: Module not found: Can't resolve '@/lib/...'`

**Cause**: Path alias issue or TypeScript config problem

**Solution**:

```bash
# Verify tsconfig.json paths
cat tsconfig.json | grep paths

# Verify imports use correct alias
# Should be: import { foo } from "@/lib/foo"
```

### `Error: Workers exceeded CPU limit`

**Cause**: Worker execution taking too long

**Solution**:

1. Add performance profiling
2. Optimize heavy computations
3. Consider splitting into multiple workers
4. Add caching for expensive operations

---

## Performance Issues

### Slow Build Times

**Symptom**: Build job takes > 20 minutes

**Diagnosis**:

```bash
# Time each build step
time npm ci
time npm run build:next
time npm run build:worker
```

**Solutions**:

1. Cache node_modules (already enabled in CI)
2. Parallelize test execution
3. Split build matrix if needed
4. Consider using build cache artifacts

### Slow Test Execution

**Symptom**: Test job takes > 10 minutes

**Diagnosis**:

```bash
# Run tests with timing
npm test -- --reporter=verbose
```

**Solutions**:

1. Use `vitest --threads` for parallel execution
2. Mock external API calls
3. Use test fixtures to reduce setup time
4. Only run affected tests in PRs

### Slow Deployments

**Symptom**: `wrangler deploy` takes > 5 minutes

**Diagnosis**:

```bash
# Check worker size
du -sh .open-next/

# Check upload speed
wrangler deploy --dry-run
```

**Solutions**:

1. Optimize bundle size
2. Exclude unnecessary files from .open-next/
3. Use Cloudflare's CDN caching more effectively
4. Consider edge functions for specific routes

---

## Debugging Techniques

### Local Reproduction

1. **Clone the failing branch**:

```bash
git fetch origin
git checkout <failing-branch>
```

2. **Run CI steps locally**:

```bash
cd web
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

3. **Compare with passing branch**:

```bash
git diff main -- web/package.json
git diff main -- web/tsconfig.json
```

### Wrangler Debug Mode

```bash
# Enable verbose output
wrangler deploy --verbose

# Dry run to check config
wrangler dev --dry-run

# Tail worker logs in real-time
wrangler tail --format pretty
```

### Database Inspection

```bash
# List all tables
wrangler d1 execute ai_news_db --command="SELECT name FROM sqlite_master WHERE type='table'"

# Check table schema
wrangler d1 execute ai_news_db --command="PRAGMA table_info(news)"

# Run custom query
wrangler d1 execute ai_news_db --command="SELECT COUNT(*) FROM news"
```

### GitHub Actions Debug Logging

1. Add secrets to repository: `ACTIONS_STEP_DEBUG = true`
2. Re-run failed workflow
3. Check logs for additional debug output
4. Remove secret after debugging

---

## Escalation Path

### Level 1: Self-Service

- Check documentation
- Review similar past issues
- Run diagnostic commands

### Level 2: Team Support

- Create issue with logs
- Tag DevOps team
- Slack #devops channel

### Level 3: Emergency

- Production down: Call on-call
- Security issue: Email security@
- Data loss: Email tech-lead@

### Issue Template

```markdown
## CI/CD Failure

**Workflow**: [CI/CD Pipeline / Migration / Crawler]
**Branch**: `branch-name`
**Commit**: `abc1234`
**Run Link**: https://github.com/user/repo/actions/runs/12345

### Error Message
```

Paste error here

```

### Steps Taken
1. ...
2. ...

### Local Result
- [ ] Reproduces locally
- [ ] Does not reproduce locally

### Additional Context
...
```

---

## Prevention Checklist

### Before Creating PR

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] No new console warnings
- [ ] Migration file follows naming convention
- [ ] Environment variables documented

### Before Merging to Main

- [ ] All CI checks pass
- [ ] At least one approval
- [ ] Tests cover new code
- [ ] Documentation updated
- [ ] Breaking changes noted

### After Deployment

- [ ] Health check passes
- [ ] Smoke tests pass
- [ ] Error rate normal
- [ ] Monitoring alerts checked
