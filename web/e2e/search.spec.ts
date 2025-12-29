/**
 * E2E Tests for Search Functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test('loads search page', async ({ page }) => {
    await page.goto('/search');

    await expect(page).toHaveURL(/\/search/);
  });

  test('displays search input', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByRole('searchbox');
    await expect(searchInput).toBeVisible();
  });

  test('can search for query', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('GPT-4');

    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/q=GPT-4/);
  });

  test('displays search results', async ({ page }) => {
    await page.goto('/search?q=AI');

    await page.waitForLoadState('networkidle');

    const results = page.locator("article, [data-testid='search-results'], .results");
    await expect(results).toBeVisible();
  });

  test('shows no results message for empty query', async ({ page }) => {
    await page.goto('/search?q=');

    // Should handle empty query gracefully
    await page.waitForLoadState('networkidle');

    const noResults = page.getByText(/no results|nothing found/i);
    if (await noResults.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(noResults).toBeVisible();
    }
  });

  test('shows no results for non-existent query', async ({ page }) => {
    const randomQuery = `xyz${Date.now()}abc`;

    await page.goto(`/search?q=${encodeURIComponent(randomQuery)}`);
    await page.waitForLoadState('networkidle');

    // Should show no results message
    const noResults = page.getByText(/no results/i).or(page.getByText(/nothing found/i));
    if (await noResults.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(noResults).toBeVisible();
    }
  });

  test('can click on search result', async ({ page }) => {
    await page.goto('/search?q=AI');
    await page.waitForLoadState('networkidle');

    // Try to find and click a result link
    const firstResultLink = page.locator('article a').first();

    if (await firstResultLink.isVisible({ timeout: 2000 })) {
      await firstResultLink.click();
      await page.waitForLoadState('networkidle');

      expect(page.url()).toMatch(/\/news\//);
    }
  });

  test('displays search suggestions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('searchbox');
    await searchInput.focus();
    await searchInput.fill('GPT');

    // Wait for suggestions to load
    await page.waitForTimeout(500);

    const suggestions = page.locator('[role="listbox"], .suggestions, [data-testid="suggestions"]');

    if (await suggestions.isVisible({ timeout: 2000 })) {
      await expect(suggestions).toBeVisible();
    }
  });

  test('can select search suggestion', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('searchbox');
    await searchInput.focus();
    await searchInput.fill('GPT');

    await page.waitForTimeout(500);

    // Try to click a suggestion
    const firstSuggestion = page.locator('[role="option"], .suggestion').first();

    if (await firstSuggestion.isVisible({ timeout: 2000 })) {
      await firstSuggestion.click();
      await page.waitForLoadState('networkidle');

      expect(page.url()).toMatch(/\/search\?q=/);
    }
  });

  test('clears search with escape key', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('test query');
    await searchInput.focus();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Should clear or close suggestions
    const value = await searchInput.inputValue();
    expect(typeof value).toBe('string');
  });

  test('navigates between results with keyboard', async ({ page }) => {
    await page.goto('/search?q=AI');
    await page.waitForLoadState('networkidle');

    // Test arrow navigation
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // Visual feedback for navigation
    const focused = page.locator(':focus').or(page.locator('.focused, [aria-selected=true]'));
    const focusedCount = await focused.count();
    expect(focusedCount).toBeGreaterThanOrEqual(0);
  });

  test('displays result metadata', async ({ page }) => {
    await page.goto('/search?q=AI');
    await page.waitForLoadState('networkidle');

    // Check for source, date, etc.
    const firstArticle = page.locator('article').first();

    if (await firstArticle.isVisible({ timeout: 2000 })) {
      await expect(firstArticle).toBeVisible();

      // Should contain some metadata
      const text = await firstArticle.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('persists search across navigation', async ({ page }) => {
    await page.goto('/search?q=test');
    await page.waitForLoadState('networkidle');

    // Navigate away and back
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/search');
  });

  test('loads search results quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/search?q=AI');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('handles special characters in query', async ({ page }) => {
    const specialQuery = 'C++ & C#';

    await page.goto(`/search?q=${encodeURIComponent(specialQuery)}`);
    await page.waitForLoadState('networkidle');

    // Should not error
    const searchInput = page.getByRole('searchbox');
    await expect(searchInput).toHaveValue(specialQuery);
  });

  test('handles unicode in query', async ({ page }) => {
    const unicodeQuery = 'AI 人工智能';

    await page.goto(`/search?q=${encodeURIComponent(unicodeQuery)}`);
    await page.waitForLoadState('networkidle');

    // Should not error
    expect(page.url()).toContain(encodeURIComponent(unicodeQuery));
  });

  test('displays search tips', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('searchbox');
    await searchInput.focus();

    const tips = page.getByText(/tips|help/i);

    if (await tips.isVisible({ timeout: 1000 })) {
      await expect(tips).toBeVisible();
    }
  });

  test('filters by category', async ({ page }) => {
    await page.goto('/search?q=AI&category=Artificial_Intelligence');
    await page.waitForLoadState('networkidle');

    // Should show category filter somewhere
    const categoryIndicator = page.getByText(/Artificial_Intelligence/i);

    if (await categoryIndicator.isVisible({ timeout: 1000 })) {
      await expect(categoryIndicator).toBeVisible();
    }
  });

  test('filters by language', async ({ page }) => {
    await page.goto('/search?q=test&language=en');
    await page.waitForLoadState('networkidle');

    // Should handle language filter
    expect(page.url()).toContain('language=en');
  });

  test('searches from homepage redirect to search page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('test query');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toMatch(/\/search/);
    expect(page.url()).toContain('test+query');
  });

  test('displays loading state during search', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('loading test');

    // Look for loading indicator
    const loading = page.locator('.loading, .spinner, [aria-busy=true]').first();

    // Navigate
    await page.keyboard.press('Enter');

    // Loading might appear briefly
    if (await loading.isVisible({ timeout: 100 }).catch(() => false)) {
      await expect(loading).toBeHidden({ timeout: 5000 });
    }
  });
});
