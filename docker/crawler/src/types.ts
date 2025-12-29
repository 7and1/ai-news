export type Source = {
  id: string;
  name: string;
  url: string;
  type: string;
  category: string | null;
  language: string | null;
  crawlFrequency: number;
  needCrawl: boolean;
};

export type Analysis = {
  summary: string | null;
  oneLine: string | null;
  category: string | null;
  tags: string[];
  importance: number;
  sentiment: "positive" | "neutral" | "negative";
  language: "en" | "zh";
};

export type IngestPayload = {
  id?: string;
  url: string;
  title: string;
  sourceId: string;
  publishedAt: number;
  crawledAt?: number;
  summary?: string | null;
  oneLine?: string | null;
  content?: string | null;
  contentFormat?: "markdown" | "html" | "text";
  category?: string | null;
  tags?: string[];
  importance?: number;
  sentiment?: string | null;
  language?: string | null;
};
