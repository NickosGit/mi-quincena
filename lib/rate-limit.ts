// In-memory sliding-window rate limit. Per server instance only (resets on cold
// start), which is enough to stop one person or script from draining the free
// Gemini quota.

export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    // Keep the map from growing forever on a long-lived instance.
    if (hits.size > 5000) {
      for (const [k, ts] of hits) if (ts.every((t) => now - t >= windowMs)) hits.delete(k);
    }
    return true;
  };
}
