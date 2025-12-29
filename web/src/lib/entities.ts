import type { NewsEntities } from '@/lib/db/types';

// Entity dictionaries for extraction
const AI_MODELS = [
  // OpenAI
  'gpt-4',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'gpt-3.5',
  'chatgpt',
  'o1',
  'o1-preview',
  'o1-mini',
  // Anthropic
  'claude-3.5-sonnet',
  'claude-3.5-opus',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'claude-2',
  'claude-instant',
  'claude',
  // Google/DeepMind
  'gemini-2.0',
  'gemini-1.5',
  'gemini-pro',
  'gemini-ultra',
  'gemini-nano',
  'gemini-flash',
  'gemini',
  'palm-2',
  'palm',
  'bard',
  // Meta
  'llama-3.3',
  'llama-3.2',
  'llama-3.1',
  'llama-3',
  'llama-2',
  'llama',
  'code-llama',
  'llava',
  'mistral',
  // xAI
  'grok-2',
  'grok-1.5',
  'grok-1',
  'grok',
  // Mistral AI
  'mistral-large',
  'mistral-medium',
  'mistral-small',
  'mistral-7b',
  'mistral',
  'mixtral-8x7b',
  'mixtral',
  'codestral',
  // Stability AI
  'stable-diffusion',
  'stable-diffusion-xl',
  'sdxl',
  'stable-video',
  // Other notable models
  'dall-e-3',
  'dall-e-2',
  'dall-e',
  'midjourney',
  'sora',
  'sora-video',
  'flacon',
  'bloom',
  'gpt-neox',
  'opt',
  'galactica',
  'alphafold',
  'alphago',
  'alphastar',
  'whisper',
  'tts',
  'elevenlabs',
  'huggingface',
  'transformers',
  'bert',
  'gpt',
  'gpt-2',
];

const COMPANIES = [
  // Tech Giants
  'openai',
  'anthropic',
  'google',
  'deepmind',
  'microsoft',
  'meta',
  'facebook',
  'amazon',
  'apple',
  'nvidia',
  'amd',
  'intel',
  // AI Companies
  'stability ai',
  'hugging face',
  'midjourney',
  'character.ai',
  'a16z',
  'andreessen horowitz',
  'sequoia',
  'yscale',
  'replicate',
  'runway',
  'pika',
  'heygen',
  'synthesia',
  'scale ai',
  'labelbox',
  'snorkel ai',
  'langchain',
  'langfuse',
  'haystack',
  'llamaindex',
  'weaviate',
  'pinecone',
  'chroma',
  'zilliz',
  'cohere',
  'ai21 labs',
  'jina ai',
  'nomic ai',
  'perplexity',
  'you.com',
  'neeva',
  'robotics',
  'boston dynamics',
  'figure',
  'agility robotics',
  'tesla',
  'spacex',
  'waymo',
  'cruise',
  'inflection',
  'deepset',
  'fixie',
  // Cloud Providers
  'aws',
  'azure',
  'gcp',
  'google cloud',
  'oracle cloud',
];

const TECHNOLOGIES = [
  // Frameworks & Libraries
  'pytorch',
  'tensorflow',
  'jax',
  'flax',
  'keras',
  'mxnet',
  'paddle',
  'scikit-learn',
  'numpy',
  'pandas',
  'polars',
  'langchain',
  'llamaindex',
  'haystack',
  'semantic kernel',
  'transformers',
  'diffusers',
  'accelerate',
  // ML Techniques
  'transformer',
  'attention mechanism',
  'self-attention',
  'multi-head attention',
  'diffusion model',
  'stable diffusion',
  'gan',
  'vae',
  'neural network',
  'reinforcement learning',
  'deep learning',
  'machine learning',
  'supervised learning',
  'unsupervised learning',
  'semi-supervised learning',
  'transfer learning',
  'few-shot learning',
  'zero-shot learning',
  'one-shot learning',
  'fine-tuning',
  'prompt engineering',
  'rag',
  'retrieval augmented generation',
  'chain-of-thought',
  'cot',
  'reasoning',
  'embedding',
  'vector database',
  'vector store',
  'semantic search',
  'tokenization',
  'tokenizer',
  // AI/ML Concepts
  'llm',
  'large language model',
  'foundation model',
  'multimodal',
  'agentic ai',
  'autonomous agents',
  'ai agents',
  'copilot',
  'generative ai',
  'genai',
  'computer vision',
  'nlp',
  'natural language processing',
  'speech recognition',
  'text-to-speech',
  'tts',
  'image generation',
  'video generation',
  'audio generation',
  'neural rendering',
  'neural radiance fields',
  'nerf',
  // Development Tools
  'docker',
  'kubernetes',
  'gpu',
  'tpu',
  'cuda',
  'opencl',
  'huggingface',
  'wandb',
  'weights and biases',
  'mlflow',
  'gradio',
  'streamlit',
  'dash',
];

const CONCEPTS = [
  // AI Safety & Ethics
  'ai safety',
  'alignment',
  'interpretability',
  'explainability',
  'xai',
  'bias',
  'fairness',
  'ethics',
  'responsible ai',
  'hallucination',
  'adversarial attacks',
  'prompt injection',
  // Business & Industry
  'enterprise ai',
  'industrial ai',
  'ai adoption',
  'ai strategy',
  'mlops',
  'llmops',
  'dataops',
  'modelops',
  'devops',
  'ai governance',
  'ai regulation',
  'eu ai act',
  // Applications
  'chatbot',
  'virtual assistant',
  'copilot',
  'code generation',
  'code completion',
  'github copilot',
  'content creation',
  'automated content',
  'autonomous driving',
  'self-driving cars',
  'medical ai',
  'healthcare ai',
  'drug discovery',
  'fintech',
  'ai trading',
  'fraud detection',
  // Research Topics
  'scaling laws',
  'emergent abilities',
  'grokking',
  'chain of thought',
  'cot',
  'tree of thoughts',
  'tot',
  'constitutional ai',
  'rlhf',
  'rlaif',
  'dpo',
  'ppo',
  'instruction tuning',
  'pretraining',
  'continual learning',
  'model distillation',
  'quantization',
  'pruning',
  'multimodal',
  'vision language models',
  'vlm',
];

// Compile regex patterns from entity lists (case-insensitive, word boundaries)
function buildEntityPattern(entities: string[]): RegExp {
  const escaped = entities.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

const MODEL_PATTERN = buildEntityPattern(AI_MODELS);
const COMPANY_PATTERN = buildEntityPattern(COMPANIES);
const TECH_PATTERN = buildEntityPattern(TECHNOLOGIES);
const CONCEPT_PATTERN = buildEntityPattern(CONCEPTS);

/**
 * Extract entities from text content
 */
export function extractEntities(text: string, existing: NewsEntities | null = null): NewsEntities {
  if (!text || typeof text !== 'string') {
    return existing ?? { companies: [], models: [], technologies: [], concepts: [] };
  }

  const models = new Set(existing?.models ?? []);
  const companies = new Set(existing?.companies ?? []);
  const technologies = new Set(existing?.technologies ?? []);
  const concepts = new Set(existing?.concepts ?? []);

  // Extract models
  let match;
  const modelRegex = new RegExp(MODEL_PATTERN);
  while ((match = modelRegex.exec(text)) !== null) {
    if (match[1]) {models.add(normalizeEntity(match[1]));}
  }

  // Extract companies
  const companyRegex = new RegExp(COMPANY_PATTERN);
  while ((match = companyRegex.exec(text)) !== null) {
    if (match[1]) {companies.add(normalizeEntity(match[1]));}
  }

  // Extract technologies
  const techRegex = new RegExp(TECH_PATTERN);
  while ((match = techRegex.exec(text)) !== null) {
    if (match[1]) {technologies.add(normalizeEntity(match[1]));}
  }

  // Extract concepts
  const conceptRegex = new RegExp(CONCEPT_PATTERN);
  while ((match = conceptRegex.exec(text)) !== null) {
    if (match[1]) {concepts.add(normalizeEntity(match[1]));}
  }

  return {
    companies: Array.from(companies),
    models: Array.from(models),
    technologies: Array.from(technologies),
    concepts: Array.from(concepts),
  };
}

/**
 * Normalize entity name for consistent storage
 */
function normalizeEntity(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Get human-readable entity name from slug
 */
export function entitySlugToName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate slug from entity name
 */
export function entityToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Link entities in HTML content
 */
export function linkEntitiesInContent(html: string, entities: NewsEntities | null): string {
  if (!html || !entities) {return html;}

  let result = html;
  const allEntities = [
    ...entities.companies.map((e) => ({ name: e, type: 'company' as const })),
    ...entities.models.map((e) => ({ name: e, type: 'topic' as const })),
    ...entities.technologies.map((e) => ({ name: e, type: 'topic' as const })),
  ];

  // Sort by length (longest first) to avoid partial matches
  allEntities.sort((a, b) => b.name.length - a.name.length);

  for (const entity of allEntities) {
    const href = entity.type === 'company' ? `/company/${entity.name}` : `/topic/${entity.name}`;

    const entityPattern = buildEntityTextPattern(entity.name);
    // Avoid matching inside HTML tags or inside existing anchors.
    const pattern = new RegExp(
      `(?<![A-Za-z0-9])${entityPattern}(?![A-Za-z0-9])(?!([^<]*>)|([^<]*<\\/a>))`,
      'gi'
    );

    result = result.replace(
      pattern,
      (match) =>
        `<a href="${href}" class="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300" data-entity="${entity.type}">${match}</a>`
    );
  }

  return result;
}

function buildEntityTextPattern(slug: string): string {
  const parts = slug
    .split('-')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(escapeRegex);

  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  return parts.join('(?:\\s+|-)+');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get entity type from entity name
 */
export function getEntityType(name: string): 'company' | 'model' | 'technology' | 'concept' | null {
  const normalized = name.toLowerCase().replace(/\s+/g, '-');

  if (COMPANIES.some((c) => c.replace(/\s+/g, '-') === normalized)) {
    return 'company';
  }
  if (AI_MODELS.some((m) => m.replace(/-/g, '').toLowerCase() === normalized.replace(/-/g, ''))) {
    return 'model';
  }
  if (TECHNOLOGIES.some((t) => t.replace(/\s+/g, '-') === normalized)) {
    return 'technology';
  }
  if (CONCEPTS.some((c) => c.replace(/\s+/g, '-') === normalized)) {
    return 'concept';
  }

  return null;
}

/**
 * Get all entity dictionaries for reference
 */
export function getEntityDictionaries() {
  return {
    models: AI_MODELS,
    companies: COMPANIES,
    technologies: TECHNOLOGIES,
    concepts: CONCEPTS,
  };
}
