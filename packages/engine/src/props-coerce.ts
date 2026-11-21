import { z } from 'zod';

const editDistance = (a: string, b: string): number => {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
};

const coerceOnce = (raw: Record<string, unknown>, issues: { path: PropertyKey[]; code?: string; expected?: string; values?: unknown[]; limit?: unknown }[]): { next: Record<string, unknown>; fixed: Set<string> } => {
  const out = { ...raw };
  const fixed = new Set<string>();
  for (const issue of issues) {
    // nested array items (ticks.0, lines.1…): coerce the element in place
    if (issue.path.length === 2 && typeof issue.path[1] === 'number') {
      const k = String(issue.path[0]);
      const arr = out[k];
      if (!Array.isArray(arr)) continue;
      const idx = issue.path[1] as number;
      const item = arr[idx];
      if (issue.expected === 'string' && typeof item === 'number') {
        arr[idx] = String(item);
        fixed.add(k);
      } else if ((issue.expected === 'number' || issue.expected === 'int') && typeof item === 'string') {
        const n = Number(item.replace(',', '.').replace(/[^0-9.+-]/g, ''));
        if (Number.isFinite(n)) {
          arr[idx] = issue.expected === 'int' ? Math.round(n) : n;
          fixed.add(k);
        }
      }
      continue;
    }
    if (issue.path.length !== 1) continue;
    const k = String(issue.path[0]);
    if (!(k in out)) continue;
    const v = out[k];
    if (v === null) {
      delete out[k];
      fixed.add(k);
      continue;
    }
    if ((issue.expected === 'number' || issue.expected === 'int') && typeof v === 'string') {
      const n = Number(String(v).replace(',', '.').replace(/[^0-9.+-]/g, ''));
      if (Number.isFinite(n)) {
        out[k] = issue.expected === 'int' ? Math.round(n) : n;
        fixed.add(k);
      }
    } else if (issue.expected === 'int' && typeof v === 'number' && Number.isFinite(v)) {
      out[k] = Math.round(v);
      fixed.add(k);
    } else if (issue.expected === 'number' && typeof v === 'string') {
      const n = Number(String(v).replace(',', '.').replace(/[^0-9.+-]/g, ''));
      if (Number.isFinite(n)) {
        out[k] = n;
        fixed.add(k);
      }
    } else if (issue.expected === 'boolean' && typeof v === 'string') {
      const s = String(v).toLowerCase();
      if (s === 'true' || s === 'yes' || s === '1') {
        out[k] = true;
        fixed.add(k);
      } else if (s === 'false' || s === 'no' || s === '0') {
        out[k] = false;
        fixed.add(k);
      }
    } else if ((issue.expected === 'array' || issue.expected === 'tuple') && typeof v === 'string') {
      out[k] = String(v).split(/\s*[|,/\n]\s*/).filter(Boolean);
      fixed.add(k);
    } else if (issue.expected === 'string' && typeof v === 'number') {
      out[k] = String(v);
      fixed.add(k);
    } else if (Array.isArray(issue.values) && typeof v === 'string') {
      const lower = String(v).toLowerCase();
      const hit =
        issue.values.find((o) => String(o).toLowerCase() === lower) ??
        issue.values.find((o) => String(o).toLowerCase().includes(lower) || lower.includes(String(o).toLowerCase())) ??
        issue.values.find((o) => {
          const c = String(o).toLowerCase();
          const max = Math.max(c.length, lower.length) > 7 ? 3 : 2;
          return editDistance(c, lower) <= max;
        });
      if (hit !== undefined) {
        out[k] = hit;
        fixed.add(k);
      }
    } else if (issue.code === 'too_small' && Array.isArray(v) && typeof issue.limit === 'number') {
      while (v.length < issue.limit) v.push('');
      fixed.add(k);
    } else if (issue.code === 'too_small' && typeof v === 'number' && typeof issue.limit === 'number') {
      out[k] = issue.limit + 1;
      fixed.add(k);
    } else if (issue.code === 'too_big' && typeof v === 'number' && typeof issue.limit === 'number') {
      out[k] = issue.limit;
      fixed.add(k);
    }
  }
  return { next: out, fixed };
};

export const coerceProps = (PropsZ: z.ZodType<{ [k: string]: unknown }>, raw: Record<string, unknown>): Record<string, unknown> | null => {
  let cur = { ...raw };
  for (let i = 0; i < 6; i++) {
    const r = PropsZ.safeParse(cur);
    if (r.success) return r.data as Record<string, unknown>;
    const { next, fixed } = coerceOnce(cur, r.error.issues as never);
    // Keys no coercion could rescue (invented enums, nonsense shapes) are dropped:
    // their schema default kicks in while the salvaged props around them survive.
    for (const issue of r.error.issues as { path: PropertyKey[] }[]) {
      if (issue.path.length !== 1) continue;
      const k = String(issue.path[0]);
      if (!(k in next)) continue;
      if (!fixed.has(k) && next[k] === cur[k]) delete next[k];
    }
    if (JSON.stringify(next) === JSON.stringify(cur)) return null;
    cur = next as Record<string, unknown>;
  }
  return null;
};
