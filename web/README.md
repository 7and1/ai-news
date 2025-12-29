# AI News Web

Next.js (App Router) frontend running on Cloudflare Workers via OpenNext, backed by a D1 (SQLite) database.

For the full project overview and crawler instructions, see the repo root `README.md`.

## Local Development (Workers-style)

```bash
cd web
npm install

# init local D1
npm run d1:migrate:local
npm run d1:seed:local

# build + run via wrangler
npm run preview
```

Open `http://localhost:3000`.
