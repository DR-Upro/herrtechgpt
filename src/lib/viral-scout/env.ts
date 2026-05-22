export type Env = {
  anthropicKey: string | null;
  apifyToken: string | null;
};

const nonEmpty = (v: string | undefined): string | null =>
  v && v.length > 0 ? v : null;

export function readEnv(): Env {
  return {
    anthropicKey: nonEmpty(process.env.ANTHROPIC_API_KEY),
    apifyToken: nonEmpty(process.env.APIFY_TOKEN),
  };
}

export function hasLiveKeys(env: Env): boolean {
  return !!env.anthropicKey && !!env.apifyToken;
}
