PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO sources (id, name, url, type, category, language, crawl_frequency, need_crawl) VALUES
  ('openai-blog', 'OpenAI News', 'https://openai.com/news/rss.xml', 'blog', 'ai_company', 'en', 10800, 0),
  ('anthropic-news', 'Anthropic News', 'https://rsshub.bestblogs.dev/anthropic/news', 'blog', 'ai_company', 'en', 10800, 1),
  ('huggingface-blog', 'Hugging Face Blog', 'https://huggingface.co/blog/feed.xml', 'blog', 'ai_company', 'en', 10800, 0),
  ('deepmind-blog', 'Google DeepMind Blog', 'https://deepmind.com/blog/feed/basic/', 'blog', 'ai_company', 'en', 10800, 0),
  ('qbitai', '量子位', 'https://www.qbitai.com/feed', 'news', 'ai_media', 'zh', 7200, 1),
  ('jiqizhixin', '机器之心', 'https://wechat2rss.bestblogs.dev/feed/8d97af31b0de9e48da74558af128a4673d78c9a3.xml', 'wechat', 'ai_media', 'zh', 7200, 1),
  ('xinzhiyuan', '新智元', 'https://wechat2rss.bestblogs.dev/feed/e531a18b21c34cf787b83ab444eef659d7a980de.xml', 'wechat', 'ai_media', 'zh', 7200, 1),
  ('twitter-openai', 'OpenAI (@OpenAI)', 'https://api.xgo.ing/rss/user/0c0856a69f9f49cf961018c32a0b0049', 'twitter', 'ai_company', 'en', 1800, 0),
  ('twitter-karpathy', 'Andrej Karpathy (@karpathy)', 'https://api.xgo.ing/rss/user/edf707b5c0b248579085f66d7a3c5524', 'twitter', 'ai_kol', 'en', 1800, 0),
  ('twitter-dotey', '宝玉 (@dotey)', 'https://api.xgo.ing/rss/user/97f1484ae48c430fbbf3438099743674', 'twitter', 'ai_kol', 'zh', 1800, 0);

-- Optional: a small demo row for local preview.
INSERT OR IGNORE INTO news (
  id, title, summary, one_line, content, url, source_id, category, tags, importance, sentiment, language, published_at, crawled_at
) VALUES (
  'demo-1',
  'AI News is ready: seed content',
  'This is a seeded demo item so the UI has something to render in local development.',
  'Seeded demo item for local dev.',
  '<p>This is a seeded demo item. Run the crawler or POST to <code>/api/ingest</code> to add real data.</p>',
  'https://example.com/ai-news-seed',
  'openai-blog',
  'announcement',
  '["seed","demo"]',
  80,
  'neutral',
  'en',
  unixepoch() * 1000,
  unixepoch() * 1000
);
