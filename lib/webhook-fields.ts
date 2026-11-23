// Field inventory over captured webhook payloads: every JSON path seen, which
// types it carried, how many events contained it, and a sample value. This is
// what to read when deciding which Shopify fields belong in the Prisma schema.
//
// Paths use `.` for object keys and `[]` for array elements, e.g.
//   line_items[].price_set.shop_money.amount
// Pure functions — no DB access — so they can be reused by scripts.

export interface FieldStat {
  path: string;
  /** e.g. ["string"], ["string","null"] — "null" means the field is nullable. */
  types: string[];
  /** Number of events whose payload contained this path at least once. */
  events: number;
  /** JSON-encoded example of a non-null primitive value, truncated. */
  sample: string | null;
}

const MAX_DEPTH = 16;
const MAX_PATHS_PER_EVENT = 5_000;
const MAX_SAMPLE_CHARS = 80;

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function sampleOf(value: unknown): string | null {
  if (value === null || typeof value === "object") return null;
  const json = JSON.stringify(value);
  return json.length > MAX_SAMPLE_CHARS ? `${json.slice(0, MAX_SAMPLE_CHARS)}…` : json;
}

interface PathAcc {
  types: Set<string>;
  sample: string | null;
}

function walk(
  value: unknown,
  prefix: string,
  depth: number,
  out: Map<string, PathAcc>,
) {
  if (depth > MAX_DEPTH || out.size >= MAX_PATHS_PER_EVENT) return;

  const visit = (path: string, child: unknown) => {
    let acc = out.get(path);
    if (!acc) {
      if (out.size >= MAX_PATHS_PER_EVENT) return;
      acc = { types: new Set(), sample: null };
      out.set(path, acc);
    }
    acc.types.add(typeOf(child));
    if (acc.sample === null) acc.sample = sampleOf(child);
    if (child && typeof child === "object") walk(child, path, depth + 1, out);
  };

  if (Array.isArray(value)) {
    for (const item of value) visit(`${prefix}[]`, item);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      visit(prefix ? `${prefix}.${key}` : key, child);
    }
  }
}

/** Every path in one payload, with its types and a sample. */
export function collectPaths(payload: unknown): Map<string, PathAcc> {
  const out = new Map<string, PathAcc>();
  walk(payload, "", 0, out);
  return out;
}

/** Aggregate paths across many payloads, sorted by path. */
export function buildFieldInventory(payloads: unknown[]): FieldStat[] {
  const agg = new Map<string, { types: Set<string>; events: number; sample: string | null }>();

  for (const payload of payloads) {
    for (const [path, acc] of collectPaths(payload)) {
      let row = agg.get(path);
      if (!row) {
        row = { types: new Set(), events: 0, sample: null };
        agg.set(path, row);
      }
      row.events++;
      acc.types.forEach((t) => row!.types.add(t));
      if (row.sample === null) row.sample = acc.sample;
    }
  }

  return [...agg.entries()]
    .map(([path, row]) => ({
      path,
      types: [...row.types].sort(),
      events: row.events,
      sample: row.sample,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
