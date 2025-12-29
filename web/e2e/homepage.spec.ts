/**
 * E2E Tests for Homepage
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/BestBlogs/i);
  });

  test('displays navigation', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('displays header with logo', async ({ page }) => {
    await expect(page.getByRole('link', { name: /bestblogs/i })).toBeVisible();
  });

  test('displays news section', async ({ page }) => {
    const newsSection = page.locator('main').or(page.locator('[role="main"]'));
    await expect(newsSection).toBeVisible();
  });

  test('displays search input', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search/i });
    await expect(searchInput).toBeVisible();
  });

  test('search input has placeholder', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search/i });
    await expect(searchInput).toHaveAttribute('placeholder', /search/i);
  });

  test('can navigate to about page', async ({ page }) => {
    await page.click('a[href="/about"]');
    await expect(page).toHaveURL(/\/about/);
  });

  test('can navigate to newsletter page', async ({ page }) => {
    await page.click('a[href="/newsletter"]');
    await expect(page).toHaveURL(/\/newsletter/);
  });

  test('displays footer', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('has responsive design', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('meta tags are present', async ({ page }) => {
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();
  });

  test('has no console errors', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(logs).toHaveLength(0);
  });

  test('loads within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000); // 3 seconds
  });

  test('handles dark mode toggle', async ({ page }) => {
    // Look for a dark mode toggle button
    const darkModeToggle = page.getByRole('button', { name: /dark|theme|mode/i });

    if (await darkModeToggle.isVisible({ timeout: 1000 })) {
      const htmlBefore = await page.locator('html').getAttribute('class');

      await darkModeToggle.click();
      await page.waitForTimeout(500);

      const htmlAfter = await page.locator('html').getAttribute('class');
      expect(htmlAfter).not.toBe(htmlBefore);
    }
  });
});
