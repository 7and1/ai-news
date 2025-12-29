# Repository Guidelines

## Project Structure & Module Organization

- `web/`: Next.js (App Router) frontend + Cloudflare Workers runtime via OpenNext. Most code lives in `web/src/`:
  - `web/src/app/`: routes, layouts, server components
  - `web/src/components/`: UI components (Tailwind utility classes)
  - `web/src/lib/`: shared utilities, SEO helpers, and D1 access (`web/src/lib/db/`)
  - `web/public/`: static assets
- `docker/crawler/`: RSS crawler + ingest client (TypeScript). Source in `docker/crawler/src/`, compiled to `docker/crawler/dist/`.
- `docs/`: architecture and API docs (start with `docs/IMPLEMENTATION_PLAN.md` and `docs/API_DOCS.md`).
- `flows/`: Dify workflow definitions and DSL exports.

## Build, Test, and Development Commands

Web (run from `web/`):

- `npm ci` (or `npm install`): install deps (repo uses `package-lock.json`)
- `npm run dev`: run Next.js dev server (app-only)
- `npm run build`: build Next.js + Workers bundle
- `npm run d1:migrate:local`: apply local D1 schema from `web/src/lib/db/schema.sql`
- `npm run d1:seed:local`: seed local D1 data from `web/src/lib/db/seed.sql`
- `npm run preview`: build + run with `wrangler dev` on `http://localhost:3000`
- `npm run lint`: Next.js ESLint checks
- `npm test`: Vitest unit tests

Crawler (run from `docker/crawler/`):

- `cp .env.example .env` then `npm run build` and `npm run start`

## Coding Style & Naming Conventions

- TypeScript everywhere; 2-space indentation; use double quotes as the project default.
- Prefer small, typed modules; validate external inputs with `zod`.
- Keep URLs and secrets out of code. Use `web/.env.example`, `web/wrangler.json` vars, and `docker/crawler/.env`.

## Testing Guidelines

- Framework: `vitest`.
- Naming: `*.test.ts` (examples in `web/src/lib/`).
- Add tests for parsing, ID generation, DB cursor/pagination, and any ingest/crawler logic changes.

## Commit & Pull Request Guidelines

- Commit messages in history are short and imperative (often `update …`), with occasional prefixes like `doc:`.
  - Recommended: `doc: …`, `feat: …`, `fix: …` (keep subject ≤ 72 chars).
- PRs should include: what changed, how to run locally (commands), and screenshots for UI/SEO changes.
- If you change D1 schema, update both `schema.sql` and `seed.sql`, and mention any migration/seed steps in the PR.

## Security & Configuration Tips

- Do not commit `.env*`, `node_modules/`, `web/.next/`, `web/.open-next/`, `web/.wrangler/`, or `docker/crawler/dist/` (ignored by subproject `.gitignore` files).
- Treat `INGEST_SECRET` / `CRON_SECRET` as production secrets; rotate if exposed.
