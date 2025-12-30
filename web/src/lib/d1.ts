import { getCloudflareContext } from '@opennextjs/cloudflare';

export type AppEnv = CloudflareEnv;

export async function getEnv(): Promise<AppEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as AppEnv;
}

export async function getDb() {
  const env = await getEnv();
  if (!env.DB) {
    throw new Error(
      'Missing D1 binding `DB`. Make sure `web/wrangler.json` has `d1_databases` and you run via `wrangler dev`/OpenNext.'
    );
  }
  return env.DB;
}

export async function getSiteUrl(): Promise<string> {
  const env = await getEnv();
  const fromBinding = env.SITE_URL?.trim();
  if (fromBinding) {
    return fromBinding;
  }
  const fromPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromPublic) {
    return fromPublic;
  }
  return 'http://localhost:3000';
}
