type Tone = "success" | "warning" | "destructive" | "info" | "muted";

export const AUDIT_BASE = "/audit";

/** /audit URL from the current params with `next` applied (null removes a key). */
export function auditHref(
  current: Record<string, string | undefined>,
  next: Record<string, string | null> = {},
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...next })) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${AUDIT_BASE}?${qs}` : AUDIT_BASE;
}

const STATUS_TONE: Record<string, Tone> = {
  processed: "success",
  failed: "warning",
  rejected: "destructive",
  error: "destructive",
  received: "info", // still in flight, or the outcome write was lost
};

export function eventStatusTone(status: string): Tone {
  return STATUS_TONE[status] ?? "muted";
}

export function signatureLabel(valid: boolean | null): string {
  if (valid === true) return "Valid";
  if (valid === false) return "Invalid";
  return "Not checked";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Requests captured before `url` was recorded fall back to the route path. */
export function eventUrl(e: { url: string | null; endpoint: string }): string {
  return e.url ?? `/api/webhooks/${e.endpoint}`;
}

/** One-line JSON preview for a table cell, or null when nothing was recorded. */
export function responsePreview(response: unknown, max = 140): string | null {
  if (response === null || response === undefined) return null;
  const json = JSON.stringify(response);
  return json.length > max ? `${json.slice(0, max)}…` : json;
}

/** Pretty JSON, cut at `max` characters. */
export function jsonExcerpt(value: unknown, max: number): string {
  const json = JSON.stringify(value, null, 2);
  return json.length > max ? `${json.slice(0, max)}\n… (truncated, open the request for the rest)` : json;
}
