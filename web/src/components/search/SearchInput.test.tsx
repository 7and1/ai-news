/**
 * Tests for SearchInput component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SearchInput } from './SearchInput';


// Mock next/router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

// Mock fetch
global.fetch = vi.fn();

describe('SearchInput', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
    } as unknown as ReturnType<typeof useRouter>);

    // Mock localStorage
    const localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value.toString();
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      };
    })();

    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });

    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search/analytics')) {
        return Promise.resolve({
          json: async () => ({ queries: [] }),
        } as Response);
      }
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          json: async () => ({ suggestions: [], types: [] }),
        } as Response);
      }
      return Promise.resolve({ json: async () => ({}) } as Response);
    });
  });

  it('renders input with placeholder', () => {
    render(<SearchInput />);

    const input = screen.getByPlaceholderText(/Search \(e.g., OpenAI, GPT-5, agents\)/i);
    expect(input).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<SearchInput placeholder="Custom placeholder" />);

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('renders with default value', () => {
    render(<SearchInput defaultValue="test query" />);

    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('test query');
  });

  it('renders with autoFocus', () => {
    render(<SearchInput autoFocus={true} />);

    const input = screen.getByRole('searchbox');
    expect(input).toHaveFocus();
  });

  it('updates query on input change', () => {
    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'GPT-4' } });

    expect(input).toHaveValue('GPT-4');
  });

  it('submits form on Enter', () => {
    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test query' } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    expect(mockPush).toHaveBeenCalledWith('/search?q=test+query');
  });

  it('does not submit empty query', () => {
    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    const form = input.closest('form');

    if (form) {
      fireEvent.submit(form);
    }

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows clear button when query exists', () => {
    render(<SearchInput defaultValue="test" />);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('clears query on clear button click', () => {
    render(<SearchInput defaultValue="test" />);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    const input = screen.getByRole('searchbox');

    fireEvent.click(clearButton);

    expect(input).toHaveValue('');
  });

  it('shows suggestions dropdown on focus', () => {
    const localStorageMock = global.localStorage as Storage;
    localStorageMock.setItem('recentSearches', JSON.stringify(['recent1']));
    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);

    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText(/tips/i)).toBeInTheDocument();
  });

  it('hides suggestions on escape', () => {
    render(<SearchInput defaultValue="test" />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    expect(screen.getByText(/no suggestions found/i)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });

    // Suggestions should be hidden
    expect(screen.queryByText(/no suggestions found/i)).not.toBeInTheDocument();
  });

  it('clears query on escape when no suggestions', () => {
    render(<SearchInput defaultValue="test" />);

    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).not.toHaveFocus();
  });

  it('shows keyboard shortcut badge', () => {
    render(<SearchInput />);

    expect(screen.getByText(/⌘K/)).toBeInTheDocument();
  });

  it('fetches suggestions on input', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search/analytics')) {
        return Promise.resolve({ json: async () => ({ queries: [] }) } as Response);
      }
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          json: async () => ({
            suggestions: ['GPT-4', 'GPT-4 Turbo', 'Claude'],
            types: ['query', 'title', 'entity'],
          }),
        } as Response);
      }
      return Promise.resolve({ json: async () => ({}) } as Response);
    });

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'GPT' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/search/suggestions?q=GPT'));
    });
  });

  it('displays fetched suggestions', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search/analytics')) {
        return Promise.resolve({ json: async () => ({ queries: [] }) } as Response);
      }
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          json: async () => ({
            suggestions: ['GPT-4', 'Claude'],
            types: ['query', 'entity'],
          }),
        } as Response);
      }
      return Promise.resolve({ json: async () => ({}) } as Response);
    });

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'GPT' } });

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search/analytics')) {
        return Promise.resolve({ json: async () => ({ queries: [] }) } as Response);
      }
      if (url.includes('/api/search/suggestions')) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              json: async () => ({ suggestions: [], types: [] }),
            } as Response);
          }, 500);
        });
      }
      return Promise.resolve({ json: async () => ({}) } as Response);
    });

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    // Should show loading spinner
    await waitFor(
      () => {
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('shows no suggestions message when empty results', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search/analytics')) {
        return Promise.resolve({ json: async () => ({ queries: [] }) } as Response);
      }
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({ json: async () => ({ suggestions: [], types: [] }) } as Response);
      }
      return Promise.resolve({ json: async () => ({}) } as Response);
    });

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'xyz' } });

    await waitFor(() => {
      expect(screen.getByText(/No suggestions found/i)).toBeInTheDocument();
    });
  });

  it('loads recent searches from localStorage', () => {
    const localStorageMock = global.localStorage as Storage;
    localStorageMock.setItem('recentSearches', JSON.stringify(['recent1', 'recent2']));

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);

    // Should show recent searches
    expect(screen.getByText('recent1')).toBeInTheDocument();
    expect(screen.getByText('recent2')).toBeInTheDocument();
  });

  it('saves search to localStorage on submit', () => {
    const localStorageMock = global.localStorage as Storage;
    const setItemSpy = vi.spyOn(localStorageMock, 'setItem');

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'new search' } });

    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    expect(setItemSpy).toHaveBeenCalledWith(
      'recentSearches',
      expect.stringContaining('new search')
    );
  });

  it('limits recent searches to 10', () => {
    const localStorageMock = global.localStorage as Storage;
    const oldSearches = Array.from({ length: 10 }, (_, i) => `search${i}`);
    localStorageMock.setItem('recentSearches', JSON.stringify(oldSearches));

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'extra' } });
    const form = input.closest('form');
    if (form) {
      fireEvent.submit(form);
    }

    const stored = JSON.parse(localStorageMock.getItem('recentSearches') || '[]') as string[];
    expect(stored.length).toBeLessThanOrEqual(10);
  });

  it('clears recent searches', () => {
    const localStorageMock = global.localStorage as Storage;
    localStorageMock.setItem('recentSearches', JSON.stringify(['search1', 'search2']));

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    expect(localStorageMock.getItem('recentSearches')).toBeNull();
  });

  it('navigates on suggestion click', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search/analytics')) {
        return Promise.resolve({ json: async () => ({ queries: [] }) } as Response);
      }
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          json: async () => ({
            suggestions: ['GPT-4'],
            types: ['query'],
          }),
        } as Response);
      }
      return Promise.resolve({ json: async () => ({}) } as Response);
    });

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'GPT' } });

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('GPT-4'));

    expect(input).toHaveValue('GPT-4');
  });

  it('handles keyboard navigation in suggestions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({
        suggestions: ['Suggestion 1', 'Suggestion 2', 'Suggestion 3'],
        types: ['query', 'query', 'query'],
      }),
    } as Response);

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      // Navigate down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      // Navigate up
      fireEvent.keyDown(input, { key: 'ArrowUp' });
    });
  });

  it('selects suggestion on Enter with arrow navigation', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/search/analytics')) {
        return Promise.resolve({ json: async () => ({ queries: [] }) } as Response);
      }
      if (url.includes('/api/search/suggestions')) {
        return Promise.resolve({
          json: async () => ({
            suggestions: ['Suggestion 1'],
            types: ['query'],
          }),
        } as Response);
      }
      return Promise.resolve({ json: async () => ({}) } as Response);
    });

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Suggestion 1')).toBeInTheDocument();
    });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Should select the suggestion
    expect(input).toHaveValue('Suggestion 1');
  });

  it('closes suggestions on click outside', () => {
    render(<SearchInput defaultValue="test" />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    expect(screen.getByText(/no suggestions found/i)).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);

    expect(screen.queryByText(/no suggestions found/i)).not.toBeInTheDocument();
  });

  it('displays suggestion type icons', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({
        suggestions: ['GPT-4'],
        types: ['query'],
      }),
    } as Response);

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'GPT' } });

    await waitFor(() => {
      // Should show icon
      const icon = document.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  it('shows search tips', () => {
    render(<SearchInput defaultValue="te" />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);

    expect(screen.getByText(/Tips/i)).toBeInTheDocument();
  });

  it('handles fetch errors gracefully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    render(<SearchInput />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    // Should not throw
    await waitFor(() => {
      expect(input).toHaveValue('test');
    });
  });

  it('does not fetch suggestions for short queries', async () => {
    render(<SearchInput showPopular={false} />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'a' } });

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]).includes('/api/search/suggestions'))).toBe(
      false
    );
  });

  it('respects showPopular prop', () => {
    render(<SearchInput showPopular={false} />);

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);

    expect(vi.mocked(fetch).mock.calls.some((c) => String(c[0]).includes('/api/search/analytics'))).toBe(
      false
    );
  });
});
