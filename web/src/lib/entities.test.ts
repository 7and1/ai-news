import { describe, expect, it } from 'vitest';

import type { NewsEntities } from '@/lib/db/types';

import {
  entitySlugToName,
  entityToSlug,
  extractEntities,
  getEntityDictionaries,
  getEntityType,
  linkEntitiesInContent,
} from './entities';

describe('entities', () => {
  it('extractEntities returns empty arrays for empty input', () => {
    const entities = extractEntities('');
    expect(entities).toEqual({ companies: [], models: [], technologies: [], concepts: [] });
  });

  it('extractEntities normalizes and deduplicates entities', () => {
    const text =
      'OpenAI released GPT-4 using PyTorch. OpenAI also mentioned machine learning and AI safety.';
    const entities = extractEntities(text);

    expect(entities.companies).toContain('openai');
    expect(entities.models).toContain('gpt-4');
    expect(entities.technologies).toContain('pytorch');
    expect(entities.technologies).toContain('machine-learning');
    expect(entities.concepts).toContain('ai-safety');
    expect(entities.companies.filter((c) => c === 'openai')).toHaveLength(1);
  });

  it('extractEntities avoids partial matches', () => {
    const text = 'The opening was dramatic. (Not OpenAI)';
    const entities = extractEntities(text);
    expect(entities.companies).not.toContain('opening');
  });

  it('getEntityType classifies known entities', () => {
    expect(getEntityType('OpenAI')).toBe('company');
    expect(getEntityType('GPT-4')).toBe('model');
    expect(getEntityType('PyTorch')).toBe('technology');
    expect(getEntityType('AI safety')).toBe('concept');
  });

  it('entityToSlug creates stable slugs', () => {
    expect(entityToSlug('Google Cloud')).toBe('google-cloud');
    expect(entityToSlug('GPT-4')).toBe('gpt-4');
  });

  it('entitySlugToName creates basic display names', () => {
    expect(entitySlugToName('machine-learning')).toBe('Machine Learning');
    expect(entitySlugToName('gpt-4')).toBe('Gpt 4');
  });

  it('linkEntitiesInContent links known entities while preserving original casing', () => {
    const entities: NewsEntities = {
      companies: ['openai'],
      models: ['gpt-4'],
      technologies: ['pytorch'],
      concepts: [],
    };

    const html = '<p>OpenAI built GPT-4 with PyTorch.</p>';
    const linked = linkEntitiesInContent(html, entities);

    expect(linked).toContain('href="/company/openai"');
    expect(linked).toContain('>OpenAI</a>');
    expect(linked).toContain('href="/topic/gpt-4"');
    expect(linked).toContain('>GPT-4</a>');
    expect(linked).toContain('href="/topic/pytorch"');
    expect(linked).toContain('>PyTorch</a>');
  });

  it('linkEntitiesInContent does not double-link existing anchors', () => {
    const entities: NewsEntities = {
      companies: ['openai'],
      models: [],
      technologies: [],
      concepts: [],
    };

    const html = '<p><a href="/company/openai">OpenAI</a> builds tools.</p>';
    const linked = linkEntitiesInContent(html, entities);

    expect(linked.match(/href="\/company\/openai"/g)?.length).toBe(1);
  });

  it('getEntityDictionaries returns non-empty lists', () => {
    const dicts = getEntityDictionaries();
    expect(dicts.models.length).toBeGreaterThan(0);
    expect(dicts.companies.length).toBeGreaterThan(0);
    expect(dicts.technologies.length).toBeGreaterThan(0);
    expect(dicts.concepts.length).toBeGreaterThan(0);
  });
});
