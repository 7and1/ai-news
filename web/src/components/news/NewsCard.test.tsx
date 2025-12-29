/**
 * Tests for NewsCard component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { NewsListItem } from '@/lib/db/types';

import { NewsCard } from './NewsCard';

describe('NewsCard', () => {
  const mockItem: NewsListItem = {
    id: 'article-123',
    title: 'OpenAI Announces GPT-5 with Enhanced Reasoning',
    oneLine: 'The latest model features significant improvements in reasoning capabilities.',
    summary: 'OpenAI has unveiled GPT-5 with advanced reasoning capabilities.',
    url: 'https://example.com/openai-gpt5',
    sourceId: 'openai-blog',
    sourceName: 'OpenAI Blog',
    sourceType: 'article',
    sourceCategory: 'ai',
    category: 'Artificial_Intelligence',
    tags: ['openai', 'gpt-5', 'llm', 'reasoning'],
    importance: 85,
    sentiment: 'positive',
    language: 'en',
    ogImage: 'https://example.com/images/gpt5.jpg',
    publishedAt: 1704067200000,
    crawledAt: 1704070800000,
  };

  it('renders article title', () => {
    render(<NewsCard item={mockItem} />);

    expect(screen.getByText('OpenAI Announces GPT-5 with Enhanced Reasoning')).toBeInTheDocument();
  });

  it('links title to article page', () => {
    render(<NewsCard item={mockItem} />);

    const titleLink = screen.getByRole('link', { name: /OpenAI Announces GPT-5/ });
    expect(titleLink).toHaveAttribute('href', '/news/article-123');
  });

  it('displays importance badge', () => {
    render(<NewsCard item={mockItem} />);

    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('displays one-line summary when available', () => {
    render(<NewsCard item={mockItem} />);

    expect(
      screen.getByText(
        'The latest model features significant improvements in reasoning capabilities.'
      )
    ).toBeInTheDocument();
  });

  it('falls back to summary when one-line is not available', () => {
    const itemWithoutOneLine = { ...mockItem, oneLine: undefined };
    render(<NewsCard item={itemWithoutOneLine} />);

    expect(screen.getByText(/OpenAI has unveiled GPT-5/)).toBeInTheDocument();
  });

  it('omits description when both one-line and summary are missing', () => {
    const itemWithoutDescription = {
      ...mockItem,
      oneLine: undefined,
      summary: undefined,
    };
    const { container } = render(<NewsCard item={itemWithoutDescription} />);

    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('displays source name', () => {
    render(<NewsCard item={mockItem} />);

    expect(screen.getByText('OpenAI Blog')).toBeInTheDocument();
  });

  it('displays published date', () => {
    render(<NewsCard item={mockItem} />);

    expect(screen.getByText(/2024-01-01/)).toBeInTheDocument();
  });

  it('displays category when available', () => {
    render(<NewsCard item={mockItem} />);

    const categoryLink = screen.getByRole('link', { name: 'Artificial_Intelligence' });
    expect(categoryLink).toHaveAttribute('href', '/category/Artificial_Intelligence');
  });

  it('does not display category when not available', () => {
    const itemWithoutCategory = { ...mockItem, category: undefined };
    render(<NewsCard item={itemWithoutCategory} />);

    const categoryLink = screen.queryByRole('link', { name: /Artificial_Intelligence/ });
    expect(categoryLink).toBeNull();
  });

  it('displays tags', () => {
    render(<NewsCard item={mockItem} />);

    expect(screen.getByText('#openai')).toBeInTheDocument();
    expect(screen.getByText('#gpt-5')).toBeInTheDocument();
    expect(screen.getByText('#llm')).toBeInTheDocument();
    expect(screen.getByText('#reasoning')).toBeInTheDocument();
  });

  it('limits tags to 6', () => {
    const itemWithManyTags = {
      ...mockItem,
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8'],
    };
    render(<NewsCard item={itemWithManyTags} />);

    // Only first 6 tags should be displayed
    expect(screen.getByText('#tag1')).toBeInTheDocument();
    expect(screen.getByText('#tag6')).toBeInTheDocument();
    expect(screen.queryByText('#tag7')).not.toBeInTheDocument();
    expect(screen.queryByText('#tag8')).not.toBeInTheDocument();
  });

  it('displays read original link', () => {
    render(<NewsCard item={mockItem} />);

    const originalLink = screen.getByRole('link', { name: 'Read original' });
    expect(originalLink).toHaveAttribute('href', 'https://example.com/openai-gpt5');
    expect(originalLink).toHaveAttribute('target', '_blank');
    expect(originalLink).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  });

  it('applies correct styling classes', () => {
    const { container } = render(<NewsCard item={mockItem} />);

    const article = container.querySelector('article');
    expect(article).toHaveClass('rounded-xl', 'border', 'shadow-sm');
  });

  it('handles dark mode classes', () => {
    const { container } = render(<NewsCard item={mockItem} />);

    const article = container.querySelector('article');
    expect(article?.className).toContain('dark:');
  });

  it('renders without tags', () => {
    const itemWithoutTags = { ...mockItem, tags: [] };
    const { container } = render(<NewsCard item={itemWithoutTags} />);

    expect(container.querySelector('article')).toBeInTheDocument();
  });

  it('renders with null ogImage', () => {
    const itemWithoutImage = { ...mockItem, ogImage: null };
    const { container } = render(<NewsCard item={itemWithoutImage} />);

    expect(container.querySelector('article')).toBeInTheDocument();
  });

  it('escapes HTML in title', () => {
    const itemWithXss = {
      ...mockItem,
      title: '<script>alert("xss")</script>Title',
    };
    render(<NewsCard item={itemWithXss} />);

    // Should not actually execute script
    expect(screen.queryByText(/<script>/i)).not.toBeInTheDocument();
  });

  it('handles very long titles', () => {
    const longTitle = 'A'.repeat(500);
    const itemWithLongTitle = { ...mockItem, title: longTitle };
    render(<NewsCard item={itemWithLongTitle} />);

    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });

  it('handles very long summaries', () => {
    const longSummary = 'B '.repeat(1000);
    const itemWithLongSummary = { ...mockItem, oneLine: longSummary };
    const { container } = render(<NewsCard item={itemWithLongSummary} />);

    expect(container.querySelector('article')).toBeInTheDocument();
  });

  it('handles special characters in text', () => {
    const itemWithSpecialChars = {
      ...mockItem,
      title: 'Test & "Special" <Chars>',
      summary: 'Summary with \'quotes\' and "double quotes"',
    };
    render(<NewsCard item={itemWithSpecialChars} />);

    expect(screen.getByText(/Test &/)).toBeInTheDocument();
  });

  it('handles unicode in text', () => {
    const itemWithUnicode = {
      ...mockItem,
      title: 'AI development in China - 中国人工智能',
      tags: ['café', '演示'],
    };
    render(<NewsCard item={itemWithUnicode} />);

    expect(screen.getByText(/中国人工智能/)).toBeInTheDocument();
    expect(screen.getByText('#café')).toBeInTheDocument();
    expect(screen.getByText('#演示')).toBeInTheDocument();
  });

  it('displays importance score in badge', () => {
    render(<NewsCard item={mockItem} />);

    const badge = screen.getByText('85').closest('div');
    expect(badge?.className).toContain('rounded-md');
    expect(badge?.className).toContain('px-2');
    expect(badge?.className).toContain('py-1');
  });
});
