import type { EpisodeJson, Words } from './schema';
import type { Fx, Seg, ShotInfo, Timeline } from './episode';

// Rebuilds the timeline from an episode.json and its aligned words.json — the
// TypeScript descendant of the studio's lost plan.py, golden-validated against the
// three shipped episodes. See timeline.md for the recovered rules.

export type ComposeOptions = {
  fps?: number;
  audio?: Timeline['audio'];
};

const bankRound = (x: number): number => {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
};

type Resolved = { a: number; at: number; end: number };

const resolveAnchor = (
  at: string,
  words: Words,
  fps: number,
  pointer: number,
): Resolved => {
  if (at.startsWith('f:')) {
    const frame = parseInt(at.slice(2), 10);
    return { a: frame, at: frame, end: frame / fps };
  }
  if (at.startsWith('s:')) {
    const sec = parseFloat(at.slice(2));
    return { a: bankRound(sec * fps), at: bankRound(sec * fps), end: sec };
  }
  const m = at.match(/^([^#]+)(?:#(\d+))?$/);
  if (!m) throw new Error(`bad anchor: ${at}`);
  const base = m[1].toLowerCase();
  const nth = m[2] ? parseInt(m[2], 10) : 1;
  for (let found = 0, i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.w.toLowerCase() !== base) continue;
    if (w.s < pointer - 1e-9) continue;
    found++;
    if (found === nth) return { a: Math.max(0, bankRound(w.s * fps) - 2), at: bankRound(w.s * fps), end: w.e };
  }
  throw new Error(`anchor word not found: ${at}`);
};

const lineOf = (words: Words, a: number, b: number, fps: number): string => {
  const spoken = words.filter((w) => {
    const f = bankRound(w.s * fps);
    return f >= a && f < b;
  });
  if (spoken.length === 0) return '';
  return spoken.map((w) => w.w + (w.p ?? '')).join(' ');
};

export const composeTimeline = (ep: EpisodeJson, words: Words, opts: ComposeOptions = {}): Timeline => {
  const fps = opts.fps ?? 30;
  const pointer = { sec: 0 };
  const lastOwnT1: Record<string, number> = {};

  const cuts = ep.edit.map((e) => {
    const r = resolveAnchor(e.at, words, fps, pointer.sec);
    pointer.sec = r.end;
    return { edit: e, ...r };
  });

  const total = ep.end
    ? resolveAnchor(ep.end, words, fps, pointer.sec).a
    : bankRound((words[words.length - 1].e + (ep.tail ?? 1.2)) * fps);

  const segments: Seg[] = cuts.map((c, k) => {
    const a = c.a;
    const b = k < cuts.length - 1 ? cuts[k + 1].a : total;
    const e = c.edit;
    let t0 = 0;
    let t1 = b - a;
    if (e.reverse) {
      t0 = e.from ?? lastOwnT1[e.shot] ?? 0;
      t1 = e.to ?? 0;
    }
    lastOwnT1[e.shot] = t1;
    return {
      shot: e.shot,
      a,
      b,
      t0,
      t1,
      ...(e.look ? { look: e.look } : {}),
      line: lineOf(words, a, b, fps),
    };
  });

  const shots: ShotInfo[] = ep.shots.map((s) => {
    const mine = segments.filter((g) => g.shot === s.id);
    if (mine.length === 0) return null as unknown as ShotInfo;
    return {
      id: s.id,
      size: s.size,
      key: s.key,
      len: Math.max(...mine.map((g) => g.b - g.a)),
      first: Math.min(...mine.map((g) => g.a)),
      ...(mine[0].line ? { line: mine[0].line } : { line: '' }),
      ...(s.note ? { note: s.note } : {}),
    };
  });

  const fx: Fx[] = ep.fx.map((f) => {
    const { at, ...rest } = f;
    let frame: number;
    if (at.startsWith('f:')) frame = parseInt(at.slice(2), 10);
    else if (at.startsWith('s:')) frame = bankRound(parseFloat(at.slice(2)) * fps);
    else {
      const m = at.match(/^([Ss]\d+)(?:\+(\d+))?$/);
      if (!m) throw new Error(`bad fx anchor: ${at}`);
      const seg = segments.find((g) => g.shot === m[1]);
      if (!seg) throw new Error(`fx anchor shot not found: ${at}`);
      frame = seg.a + (m[2] ? parseInt(m[2], 10) : 0);
    }
    return { ...rest, f: frame } as Fx;
  });

  return {
    slug: ep.slug,
    title: ep.title.join(' '),
    fps,
    total,
    segments,
    shots,
    fx,
    audio: opts.audio ?? {},
  };
};
