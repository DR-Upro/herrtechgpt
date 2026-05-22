import { ApifyClient } from "apify-client";

let cached: ApifyClient | null = null;

export function getApify(): ApifyClient {
  if (cached) return cached;
  if (!process.env.APIFY_TOKEN) {
    throw new Error("APIFY_TOKEN not set");
  }
  cached = new ApifyClient({ token: process.env.APIFY_TOKEN });
  return cached;
}

export async function runActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  { timeoutSecs = 180 }: { timeoutSecs?: number } = {},
): Promise<T[]> {
  const apify = getApify();
  const run = await apify.actor(actorId).call(input, { timeout: timeoutSecs });
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items as T[];
}
