# Test Documentation

This document describes the test setup and how to run tests for the BestBlogs.dev web application.

## Test Structure

```
web/
├── e2e/                          # E2E tests with Playwright
│   ├── homepage.spec.ts
│   ├── search.spec.ts
│   ├── newsletter.spec.ts
│   └── api.spec.ts
├── src/
│   ├── components/               # Component tests
│   │   ├── news/
│   │   │   └── NewsCard.test.tsx
│   │   ├── search/
│   │   │   └── SearchInput.test.tsx
│   │   └── newsletter/
│   │       └── SubscribeForm.test.tsx
│   ├── lib/                      # Unit tests
│   │   ├── db/
│   │   │   └── search-queries.test.ts
│   │   ├── email/
│   │   │   └── templates.test.ts
│   │   ├── entities.test.ts
│   │   ├── security/
│   │   │   ├── timing.test.ts
│   │   │   ├── jwt.test.ts
│   │   │   ├── rate-limit.test.ts
│   │   │   ├── headers.test.ts
│   │   │   └── config.test.ts
│   │   ├── monitoring/
│   │   │   ├── logger.test.ts
│   │   │   ├── errors.test.ts
│   │   │   └── metrics.test.ts
│   │   ├── validation/
│   │   │   └── schemas.test.ts
│   │   └── test-utils/           # Test utilities
│   │       ├── mocks.ts
│   │       ├── fixtures.ts
│   │       └── setup.ts
│   └── app/api/                  # Integration tests (TODO)
│       ├── news/
│       ├── search/
│       └── newsletter/
└── test-results/                 # Test results output
    ├── coverage/
    ├── results.json
    └── playwright-report/
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run a single test file
npm run test:single -- src/lib/security/timing.test.ts

# Run tests matching a pattern
npm run test:single -- --grep "timing"
```

### E2E Tests

```bash
# Run all E2E tests
npm run e2e

# Run E2E tests with UI
npm run e2e:ui

# Run E2E tests in headed mode (shows browser)
npm run e2e:headed

# Debug E2E tests
npm run e2e:debug

# Run specific E2E test file
npx playwright test e2e/homepage.spec.ts
```

### Component Tests

Component tests use Vitest with React Testing Library:

```bash
# Run component tests
npm run test:component
```

## Coverage

Coverage reports are generated in `test-results/coverage/`:

```bash
# Generate coverage report
npm run test:coverage

# Open HTML coverage report
open test-results/coverage/index.html
```

Coverage thresholds are configured in `vitest.config.ts`:

- Overall: 80% lines, functions, statements; 75% branches
- Per-file: 50% lines, functions, statements; 40% branches

## Test Utilities

### Mocks (`src/lib/test-utils/mocks.ts`)

- `MockD1Database` - Mock D1 database for testing
- `MockKVNamespace` - Mock KV storage
- `MockR2Bucket` - Mock R2 object storage
- `createMockEnv()` - Create complete mock Cloudflare environment

### Fixtures (`src/lib/test-utils/fixtures.ts`)

- `mockNewsItems` - Sample news articles
- `mockSubscriber` - Sample newsletter subscriber
- `mockSearchAnalytics` - Sample search analytics data
- `createMockRequest()` - Helper to create mock Request objects

### Setup (`src/lib/test-utils/setup.ts`)

Global test setup including:

- Crypto API mocks
- Fetch mocks
- Environment configuration

## CI Integration

Tests run in CI with the following commands:

```bash
# Run unit tests with coverage (CI mode)
npm run test:ci

# Run E2E tests
npm run e2e
```

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { functionToTest } from './module';

describe('functionToTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does something correctly', () => {
    const result = functionToTest('input');
    expect(result).toBe('expected output');
  });
});
```

### Component Test Example

```typescript
import { render, screen } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent prop="value" />);
    expect(screen.getByText("value")).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('user can search', async ({ page }) => {
  await page.goto('/');
  await page.fill('[role="searchbox"]', 'test query');
  await page.press('[role="searchbox"]', 'Enter');
  await expect(page).toHaveURL(/search/);
});
```

## Debugging Tests

### Unit Tests

```bash
# Run with --inspect flag for Node debugger
node --inspect-brk node_modules/.bin/vitest --run

# Or use Vitest UI
npm run test:ui
```

### E2E Tests

```bash
# Run in debug mode
npm run e2e:debug

# Or run headed to see the browser
npm run e2e:headed
```

## Test Data Management

Tests use mock data to avoid dependencies on:

- Real databases (use MockD1Database)
- Real Cloudflare services (use createMockEnv())
- External APIs (use fetch mocks)

## Best Practices

1. **Isolation**: Each test should be independent and not depend on other tests
2. **Clear names**: Test descriptions should clearly state what is being tested
3. **One assertion per test**: Focus on testing one thing per test case
4. **Setup/teardown**: Use `beforeEach`/`afterEach` for test setup
5. **Edge cases**: Include tests for edge cases and error conditions
6. **Mock appropriately**: Mock external dependencies but test real logic
7. **Avoid testing implementation details**: Focus on behavior, not internals

## Troubleshooting

### Tests timing out

Increase timeout in `vitest.config.ts` or per test:

```typescript
it('slow test', { timeout: 30000 }, async () => {
  // test code
});
```

### E2E tests failing locally

Make sure the dev server is running:

```bash
npm run dev
```

Or let Playwright start it automatically (configured in playwright.config.ts).

### Coverage not reporting

Run with clean state:

```bash
rm -rf node_modules/.vite
npm run test:coverage
```
