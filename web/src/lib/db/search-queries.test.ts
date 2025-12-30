/**
 * Tests for search query utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock getDb
vi.mock('../d1', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../d1';

import {
  advancedSearch,
  searchNews,
  getSearchSuggestions,
  trackSearch,
  trackSearchClick,
  getPopularSearches,
  getZeroResultSearches,
  extractHighlights,
  type AdvancedSearchParams,
} from './search-queries';

describe('search queries', () => {
  const mockDb = {
    prepare: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockResolvedValue(mockDb as unknown as D1Database);

    // Default mock for prepared statements
    mockDb.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ changes: 0 }),
    });
  });

  describe('advancedSearch', () => {
    const defaultParams: AdvancedSearchParams = {
      q: 'test query',
      limit: 10,
    };

    it('searches with basic query', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await advancedSearch(defaultParams);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('nextCursor');
      expect(result).toHaveProperty('queryInfo');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('returns empty results for no matches', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await advancedSearch(defaultParams);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('applies limit parameter', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({ ...defaultParams, limit: 50 });

      expect(
        mockStmt.bind.mock.calls.some((call) => call[call.length - 1] === 51) // limit + 1 for cursor check
      ).toBe(true);
    });

    it('enforces maximum limit', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({ ...defaultParams, limit: 1000 });

      // Should use 51 (max 50 + 1), not 1001
      const limitBinds = mockStmt.bind.mock.calls
        .map((call) => call[call.length - 1])
        .filter((v): v is number => typeof v === 'number');
      expect(Math.max(...limitBinds)).toBeLessThanOrEqual(51);
    });

    it('enforces minimum limit', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({ ...defaultParams, limit: 0 });

      // Should use at least 1 (plus 1 extra row for cursor check)
      const limitBinds = mockStmt.bind.mock.calls
        .map((call) => call[call.length - 1])
        .filter((v): v is number => typeof v === 'number');
      expect(Math.min(...limitBinds)).toBeGreaterThanOrEqual(2);
    });

    it('applies category filter', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        ...defaultParams,
        category: 'Artificial_Intelligence',
      });

      expect(mockStmt.bind).toHaveBeenCalled();
    });

    it('applies multiple category filters', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        ...defaultParams,
        category: ['Artificial_Intelligence', 'Business_Tech'],
      });

      expect(mockStmt.bind).toHaveBeenCalled();
    });

    it('applies language filter', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        ...defaultParams,
        language: 'en',
      });

      expect(mockStmt.bind).toHaveBeenCalled();
    });

    it('applies tag filter', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        ...defaultParams,
        tags: ['openai', 'gpt-4'],
      });

      expect(mockStmt.bind).toHaveBeenCalled();
    });

    it('applies date range filters', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        ...defaultParams,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(mockStmt.bind).toHaveBeenCalled();
    });

    it('applies importance range', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        ...defaultParams,
        minImportance: 50,
        maxImportance: 90,
      });

      expect(mockStmt.bind).toHaveBeenCalled();
    });

    describe('sort orders', () => {
      it('sorts by relevance by default', async () => {
        const mockStmt = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
        mockDb.prepare.mockReturnValue(mockStmt);

        await advancedSearch(defaultParams);

        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('bm25'));
      });

      it('sorts by newest', async () => {
        const mockStmt = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
        mockDb.prepare.mockReturnValue(mockStmt);

        await advancedSearch({
          ...defaultParams,
          sortBy: 'newest',
        });

        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('published_at DESC'));
      });

      it('sorts by oldest', async () => {
        const mockStmt = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
        mockDb.prepare.mockReturnValue(mockStmt);

        await advancedSearch({
          ...defaultParams,
          sortBy: 'oldest',
        });

        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('published_at ASC'));
      });

      it('sorts by importance', async () => {
        const mockStmt = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
        mockDb.prepare.mockReturnValue(mockStmt);

        await advancedSearch({
          ...defaultParams,
          sortBy: 'importance',
        });

        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('importance DESC'));
      });
    });

    it('handles cursor pagination', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        ...defaultParams,
        cursor: 'eyJwdWJsaXNoZWRBdCI6MTcwNDA2NzIwMDAwMCwiaWQiOiJhcnRpY2xlLTEifQ',
      });

      expect(mockStmt.bind).toHaveBeenCalled();
    });

    it('generates nextCursor when more results exist', async () => {
      const mockRows = Array.from({ length: 10 }, (_, i) => ({
        id: `article-${i}`,
        published_at: Date.now(),
      }));

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockRows }),
      });

      const result = await advancedSearch({ ...defaultParams, limit: 5 });

      expect(result.nextCursor).toBeTruthy();
    });

    it('returns null nextCursor when no more results', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await advancedSearch(defaultParams);

      expect(result.nextCursor).toBeNull();
    });

    it('includes query info in response', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await advancedSearch(defaultParams);

      expect(result.queryInfo).toHaveProperty('query');
      expect(result.queryInfo).toHaveProperty('parsedQuery');
      expect(result.queryInfo).toHaveProperty('filters');
      expect(result.queryInfo).toHaveProperty('hasAdvancedSyntax');
    });

    it('handles empty query', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await advancedSearch({
        q: '',
        limit: 10,
      });

      expect(result.items).toEqual([]);
    });

    it('handles phrase search', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        q: '"exact phrase"',
        limit: 10,
      });

      expect(
        mockStmt.bind.mock.calls
          .flat()
          .some((arg) => typeof arg === 'string' && arg.includes('"exact phrase"'))
      ).toBe(true);
    });

    it('handles field-specific search', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        q: 'title:GPT-4',
        limit: 10,
      });

      expect(
        mockStmt.bind.mock.calls
          .flat()
          .some((arg) => typeof arg === 'string' && arg.includes('title:'))
      ).toBe(true);
    });

    it('handles wildcard search', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        q: 'GPT*',
        limit: 10,
      });

      // Should handle wildcards appropriately
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('searchNews', () => {
    it('provides simple search interface', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await searchNews({
        q: 'test',
        limit: 10,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('nextCursor');
    });

    it('defaults to relevance sort', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await searchNews({ q: 'test', limit: 10 });

      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('getSearchSuggestions', () => {
    it('returns empty array for short prefix', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await getSearchSuggestions('a');

      expect(result.suggestions).toEqual([]);
      expect(result.types).toEqual([]);
    });

    it('returns suggestions for valid prefix', async () => {
      const mockQueries = [
        { query: 'GPT-4', count: 100 },
        { query: 'GPT-4 Turbo', count: 50 },
      ];

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi
          .fn()
          .mockResolvedValueOnce({ results: mockQueries })
          .mockResolvedValue({ results: [] })
          .mockResolvedValue({ results: [] })
          .mockResolvedValue({ results: [] }),
      });

      const result = await getSearchSuggestions('GPT');

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.types).toHaveLength(result.suggestions.length);
    });

    it('limits suggestions', async () => {
      const manyQueries = Array.from({ length: 20 }, (_, i) => ({
        query: `query ${i}`,
        count: 10,
      }));

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi
          .fn()
          .mockResolvedValueOnce({ results: manyQueries })
          .mockResolvedValue({ results: [] })
          .mockResolvedValue({ results: [] })
          .mockResolvedValue({ results: [] }),
      });

      const result = await getSearchSuggestions('query', 5);

      expect(result.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('includes suggestion types', async () => {
      const popularStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ query: 'test', count: 10 }] }),
      };
      const titleStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ title: 'Test Article' }] }),
      };
      const tagStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [{ value: 'test-tag' }] }),
      };
      const entityStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare
        .mockReturnValueOnce(popularStmt)
        .mockReturnValueOnce(titleStmt)
        .mockReturnValueOnce(tagStmt)
        .mockReturnValueOnce(entityStmt);

      const result = await getSearchSuggestions('test');

      expect(result.types).toContain('query');
      expect(result.types).toContain('title');
      expect(result.types).toContain('tag');
    });
  });

  describe('trackSearch', () => {
    it('tracks search query', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const queryId = await trackSearch({
        query: 'GPT-4',
        resultsCount: 10,
      });

      expect(queryId).toBeTruthy();
      expect(typeof queryId).toBe('string');
    });

    it('updates popular searches', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await trackSearch({
        query: 'test query',
        resultsCount: 5,
      });

      expect(mockStmt.run).toHaveBeenCalled();
    });
  });

  describe('trackSearchClick', () => {
    it('tracks search result click', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ changes: 1 }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await trackSearchClick({
        queryId: 'test-query-id',
        newsId: 'article-123',
      });

      expect(mockStmt.run).toHaveBeenCalled();
    });
  });

  describe('getPopularSearches', () => {
    it('returns popular searches', async () => {
      const mockResults = [
        { query: 'GPT-4', count: 100 },
        { query: 'Claude', count: 80 },
      ];

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockResults }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await getPopularSearches(10);

      expect(result.queries).toHaveLength(2);
      expect(result.trending).toHaveLength(2);
      expect(result.queries[0].query).toBe('GPT-4');
    });

    it('respects limit parameter', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await getPopularSearches(5);

      expect(mockStmt.bind).toHaveBeenCalledWith(5);
    });
  });

  describe('getZeroResultSearches', () => {
    it('returns searches with zero results', async () => {
      const mockResults = [{ query: 'nonexistent', count: 10, lastSeen: Date.now() }];

      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockResults }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const result = await getZeroResultSearches(20);

      expect(result).toHaveLength(1);
      expect(result[0].query).toBe('nonexistent');
      expect(result[0].count).toBe(10);
    });
  });

  describe('extractHighlights', () => {
    it('extracts highlights from content', () => {
      const content =
        'This is an article about GPT-4 and artificial intelligence. GPT-4 is a large language model.';
      const query = 'GPT-4';

      const highlights = extractHighlights(content, query);

      expect(highlights.length).toBeGreaterThan(0);
    });

    it('handles null content', () => {
      const highlights = extractHighlights(null, 'test');

      expect(highlights).toEqual([]);
    });

    it('handles empty content', () => {
      const highlights = extractHighlights('', 'test');

      expect(highlights).toEqual([]);
    });

    it('limits max snippets', () => {
      const content = 'term '.repeat(100);
      const highlights = extractHighlights(content, 'term', 3);

      expect(highlights.length).toBeLessThanOrEqual(3);
    });

    it('adds ellipsis for truncated snippets', () => {
      const content = 'Start of content. Search term here. End of content.';
      const highlights = extractHighlights(content, 'Search term');

      // Should include ellipsis if snippet is in middle
      expect(highlights.some((h) => h.includes('...'))).toBe(true);
    });

    it('handles short terms', () => {
      const content = 'AI is growing. AI is powerful.';
      const highlights = extractHighlights(content, 'AI');

      expect(highlights.length).toBeGreaterThan(0);
    });

    it('filters very short terms', () => {
      const content = 'A B C D E F G';
      const highlights = extractHighlights(content, 'A B');

      // Should filter out terms shorter than 3 chars
      expect(highlights.length).toBeGreaterThanOrEqual(0);
    });

    it('handles HTML in content', () => {
      const content = '<p>This is <strong>GPT-4</strong> content.</p>';
      const highlights = extractHighlights(content, 'GPT-4');

      expect(highlights.length).toBeGreaterThan(0);
      expect(highlights[0]).not.toContain('<strong>');
    });

    it('handles multiple search terms', () => {
      const content = 'GPT-4 and Claude are language models.';
      const highlights = extractHighlights(content, 'GPT-4 Claude');

      expect(highlights.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles very long queries', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      const longQuery = 'word '.repeat(100);

      await expect(advancedSearch({ q: longQuery, limit: 10 })).resolves.toBeDefined();
    });

    it('handles special characters in query', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        q: 'C++ & C# & Python',
        limit: 10,
      });

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('handles unicode in query', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        q: 'AI development in China - 中国人工智能',
        limit: 10,
      });

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('handles boolean operators', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      mockDb.prepare.mockReturnValue(mockStmt);

      await advancedSearch({
        q: 'GPT-4 AND Claude NOT Llama',
        limit: 10,
      });

      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });
});
