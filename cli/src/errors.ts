/**
 * Midnight's runtime wraps the message that actually explains a failure — a witness's
 * reason, or the node's rejection code — inside a generic outer error. Flatten the cause
 * chain so the CLI and the dashboard can show what really happened.
 */
export const explain = (err: unknown): string => {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;

  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    const message = current instanceof Error ? current.message : String(current);
    if (message && !parts.includes(message)) parts.push(message);
    current = current instanceof Error ? (current as { cause?: unknown }).cause : undefined;
  }

  return parts.join(' ← ') || 'unknown error';
};
