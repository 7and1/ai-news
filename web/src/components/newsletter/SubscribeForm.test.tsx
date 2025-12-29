/**
 * Tests for SubscribeForm component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SubscribeForm } from './SubscribeForm';

// Mock fetch
global.fetch = vi.fn();

describe('SubscribeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetch).mockReset();
  });

  it('renders form elements', () => {
    render(<SubscribeForm />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByText(/topics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(<SubscribeForm className="custom-class" />);

    const form = container.querySelector('.custom-class');
    expect(form).toBeInTheDocument();
  });

  it('has pre-selected categories', () => {
    render(<SubscribeForm />);

    expect(screen.getByRole('checkbox', { name: /artificial intelligence/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /programming/i })).toBeChecked();
  });

  it('has pre-selected frequency', () => {
    render(<SubscribeForm />);

    const frequencySelect = screen.getByLabelText(/frequency/i);
    expect(frequencySelect).toHaveValue('weekly');
  });

  it('has pre-selected language', () => {
    render(<SubscribeForm />);

    const languageSelect = screen.getByLabelText(/language/i);
    expect(languageSelect).toHaveValue('en');
  });

  it('updates email on input', () => {
    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    expect(emailInput).toHaveValue('user@example.com');
  });

  it('toggles category selection', () => {
    render(<SubscribeForm />);

    const aiCheckbox = screen.getByRole('checkbox', { name: /artificial intelligence/i });
    expect(aiCheckbox).toBeChecked();

    fireEvent.click(aiCheckbox);
    expect(aiCheckbox).not.toBeChecked();

    fireEvent.click(aiCheckbox);
    expect(aiCheckbox).toBeChecked();
  });

  it('updates frequency selection', () => {
    render(<SubscribeForm />);

    const frequencySelect = screen.getByLabelText(/frequency/i);
    fireEvent.change(frequencySelect, { target: { value: 'daily' } });

    expect(frequencySelect).toHaveValue('daily');
  });

  it('updates language selection', () => {
    render(<SubscribeForm />);

    const languageSelect = screen.getByLabelText(/language/i);
    fireEvent.change(languageSelect, { target: { value: 'zh' } });

    expect(languageSelect).toHaveValue('zh');
  });

  it('subscribes successfully with confirmation required', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Please check your email',
        confirmed: false,
      }),
    } as Response);

    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/newsletter/subscribe',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('user@example.com'),
      })
    );
  });

  it('subscribes successfully when already confirmed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Already subscribed',
        confirmed: true,
      }),
    } as Response);

    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/already subscribed/i)).toBeInTheDocument();
    });
  });

  it('shows error on invalid email', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Invalid email address',
      }),
    } as Response);

    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('shows error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('disables submit button while submitting', async () => {
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ success: true, confirmed: false }),
            } as Response);
          }, 100);
        })
    );

    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    // Should be disabled during submission
    await waitFor(
      () => {
        expect(submitButton).toBeDisabled();
      },
      { timeout: 50 }
    );
  });

  it('disables submit button when email is empty', () => {
    render(<SubscribeForm />);

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    expect(submitButton).toBeDisabled();
  });

  it('calls onSuccess callback on successful subscription', async () => {
    const onSuccess = vi.fn();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        confirmed: true,
      }),
    } as Response);

    render(<SubscribeForm onSuccess={onSuccess} />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('sends selected categories in request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, confirmed: false }),
    } as Response);

    render(<SubscribeForm />);

    // Deselect some categories
    const aiCheckbox = screen.getByRole('checkbox', { name: /artificial intelligence/i });
    fireEvent.click(aiCheckbox);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);

    expect(body.preferences.categories).not.toContain('Artificial_Intelligence');
  });

  it('sends frequency in request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, confirmed: false }),
    } as Response);

    render(<SubscribeForm />);

    const frequencySelect = screen.getByLabelText(/frequency/i);
    fireEvent.change(frequencySelect, { target: { value: 'daily' } });

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);

    expect(body.preferences.frequency).toBe('daily');
  });

  it('sends language in request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, confirmed: false }),
    } as Response);

    render(<SubscribeForm />);

    const languageSelect = screen.getByLabelText(/language/i);
    fireEvent.change(languageSelect, { target: { value: 'zh' } });

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);

    expect(body.preferences.language).toBe('zh');
  });

  it('shows error message from API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Rate limit exceeded',
      }),
    } as Response);

    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument();
    });
  });

  it('resets form after successful submission', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Check your email',
        confirmed: false,
      }),
    } as Response);

    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });

    // Should show success state, not form
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });

	  it('handles all frequency options', () => {
	    render(<SubscribeForm />);

	    const frequencySelect = screen.getByLabelText(/frequency/i);
	    expect(frequencySelect).toBeInTheDocument();

	    const options = [
	      { value: 'weekly', label: 'Weekly' },
	      { value: 'biweekly', label: 'Bi-weekly' },
	      { value: 'daily', label: 'Daily' },
    ];

    options.forEach((option) => {
      expect(screen.getByText(option.label)).toBeInTheDocument();
    });
  });

	  it('handles both language options', () => {
	    render(<SubscribeForm />);

	    const languageSelect = screen.getByLabelText(/language/i);
	    expect(languageSelect).toBeInTheDocument();

	    expect(screen.getByText('English')).toBeInTheDocument();
	    expect(screen.getByText('Chinese')).toBeInTheDocument();
	  });

  it('shows privacy notice', () => {
    render(<SubscribeForm />);

    expect(screen.getByText(/privacy/i)).toBeInTheDocument();
    expect(screen.getByText(/unsubscribe/i)).toBeInTheDocument();
  });

  it('has accessible form controls', () => {
    render(<SubscribeForm />);

    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('required');

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).toHaveAttribute('type', 'checkbox');
    });
  });

  it('displays description text', () => {
    render(<SubscribeForm />);

    expect(screen.getByText(/latest AI news/i)).toBeInTheDocument();
  });

  it('handles special characters in email', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, confirmed: false }),
    } as Response);

    render(<SubscribeForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'user+tag@example.com' } });

    const submitButton = screen.getByRole('button', { name: /subscribe/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);

    expect(body.email).toBe('user+tag@example.com');
  });

  it('handles long email addresses', () => {
    render(<SubscribeForm />);

    const longEmail = 'a'.repeat(100) + '@example.com';
    const emailInput = screen.getByLabelText(/email address/i);

    fireEvent.change(emailInput, { target: { value: longEmail } });

    expect(emailInput).toHaveValue(longEmail);
  });
});
