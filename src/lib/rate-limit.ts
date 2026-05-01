interface RateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

interface CloudflareContext {
  env?: {
    RATE_LIMITER?: RateLimiterBinding;
  };
}

export async function isRateLimited(key: string): Promise<boolean> {
  try {
    const mod = await import("@opennextjs/cloudflare");
    const getCloudflareContext = mod.getCloudflareContext as () =>
      | CloudflareContext
      | Promise<CloudflareContext>;
    const { env } = await getCloudflareContext();
    const result = await env?.RATE_LIMITER?.limit({ key });
    return result?.success === false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Rate limiter unavailable; allowing request:", message);
    return false;
  }
}
