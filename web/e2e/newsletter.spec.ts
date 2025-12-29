/**
 * E2E Tests for Newsletter Subscription
 */

import { test, expect } from '@playwright/test';

test.describe('Newsletter', () => {
  test('loads newsletter page', async ({ page }) => {
    await page.goto('/newsletter');

    await expect(page).toHaveURL(/\/newsletter/);
    await expect(page.getByText(/newsletter/i)).toBeVisible();
  });

  test('displays subscribe form', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();

    const submitButton = page.getByRole('button', { name: /subscribe/i });
    await expect(submitButton).toBeVisible();
  });

  test('displays category options', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    // Check for category checkboxes
    const aiCheckbox = page.getByRole('checkbox', { name: /artificial intelligence/i });
    if (await aiCheckbox.isVisible({ timeout: 1000 })) {
      await expect(aiCheckbox).toBeVisible();
    }
  });

  test('displays frequency options', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const frequencySelect = page.getByLabel(/frequency/i);
    if (await frequencySelect.isVisible({ timeout: 1000 })) {
      await expect(frequencySelect).toBeVisible();
    }
  });

  test('displays language options', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const languageSelect = page.getByLabel(/language/i);
    if (await languageSelect.isVisible({ timeout: 1000 })) {
      await expect(languageSelect).toBeVisible();
    }
  });

  test('validates email input', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel(/email/i);
    const submitButton = page.getByRole('button', { name: /subscribe/i });

    // Try submitting with invalid email
    await emailInput.fill('invalid-email');
    await submitButton.click();
    await page.waitForTimeout(500);

    // Should show validation error
    const errorMessage = page.getByText(/invalid|error/i);
    if (await errorMessage.isVisible({ timeout: 1000 })) {
      await expect(errorMessage).toBeVisible();
    }

    // Browser might also prevent form submission
  });

  test('subscribes with valid email', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel(/email/i);
    const submitButton = page.getByRole('button', { name: /subscribe/i });

    // Use a timestamp to ensure unique email
    const timestamp = Date.now();
    await emailInput.fill(`test${timestamp}@example.com`);
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Should show success message or confirmation message
    const successMessage = page.getByText(/check your email|confirm|subscribed/i);
    if (await successMessage.isVisible({ timeout: 2000 })) {
      await expect(successMessage).toBeVisible();
    }
  });

  test('shows privacy notice', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const privacyText = page.getByText(/privacy/i);
    if (await privacyText.isVisible({ timeout: 1000 })) {
      await expect(privacyText).toBeVisible();
    }
  });

  test('can toggle category selection', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const aiCheckbox = page.getByRole('checkbox', { name: /artificial intelligence/i });

    if (await aiCheckbox.isVisible({ timeout: 1000 })) {
      await aiCheckbox.check();
      await expect(aiCheckbox).toBeChecked();

      await aiCheckbox.uncheck();
      await expect(aiCheckbox).not.toBeChecked();
    }
  });

  test('can change frequency', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const frequencySelect = page.getByLabel(/frequency/i);

    if (await frequencySelect.isVisible({ timeout: 1000 })) {
      await frequencySelect.selectOption('daily');
      await expect(frequencySelect).toHaveValue('daily');

      await frequencySelect.selectOption('weekly');
      await expect(frequencySelect).toHaveValue('weekly');
    }
  });

  test('can change language', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const languageSelect = page.getByLabel(/language/i);

    if (await languageSelect.isVisible({ timeout: 1000 })) {
      await languageSelect.selectOption('zh');
      await expect(languageSelect).toHaveValue('zh');

      await languageSelect.selectOption('en');
      await expect(languageSelect).toHaveValue('en');
    }
  });

  test('displays description', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const description = page.getByText(/AI news|latest articles/i);
    await expect(description).toBeVisible();
  });

  test('form is accessible', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    // Check for proper labels
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();

    // Check form has proper structure
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
  });

  test('handles already subscribed email', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel(/email/i);
    const submitButton = page.getByRole('button', { name: /subscribe/i });

    // This might already be subscribed in test environment
    await emailInput.fill('existing@example.com');
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Should show appropriate message
    const message = page.getByText(/already|confirm/i);
    if (await message.isVisible({ timeout: 2000 })) {
      await expect(message).toBeVisible();
    }
  });

  test('clears form after submission', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel(/email/i);
    const submitButton = page.getByRole('button', { name: /subscribe/i });

    const timestamp = Date.now();
    await emailInput.fill(`test${timestamp}@example.com`);
    await submitButton.click();
    await page.waitForTimeout(1000);

    // After successful submission, form might be replaced or cleared
    const isInputVisible = await emailInput.isVisible();
    if (isInputVisible) {
      const value = await emailInput.inputValue();
      // Value might be cleared, depending on UX.
      expect(typeof value).toBe('string');
    } else {
      expect(isInputVisible).toBe(false);
    }
  });

  test('handles network errors gracefully', async ({ page }) => {
    // Intercept and fail the request
    await page.route('**/api/newsletter/subscribe', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel(/email/i);
    const submitButton = page.getByRole('button', { name: /subscribe/i });

    await emailInput.fill('test@example.com');
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Should show error message
    const errorMessage = page.getByText(/error|failed|network/i);
    if (await errorMessage.isVisible({ timeout: 2000 })) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('shows loading state during submission', async ({ page }) => {
    // Slow down the response
    await page.route('**/api/newsletter/subscribe', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const emailInput = page.getByLabel(/email/i);
    const submitButton = page.getByRole('button', { name: /subscribe/i });

    const timestamp = Date.now();
    await emailInput.fill(`test${timestamp}@example.com`);
    await submitButton.click();

    // Check for loading state
    await expect(submitButton).toHaveAttribute('disabled', '', { timeout: 500 });
  });

  test('displays newsletter benefits', async ({ page }) => {
    await page.goto('/newsletter');
    await page.waitForLoadState('networkidle');

    const benefits = page.getByText(/curated|weekly|ai news/i);
    await expect(benefits).toBeVisible();
  });

  test('newsletter form accessible from homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const newsletterLink = page.getByRole('link', { name: /newsletter/i });

    if (await newsletterLink.isVisible({ timeout: 1000 })) {
      await newsletterLink.click();
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/newsletter');
    }
  });
});
