import 'dotenv/config';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { neon } from '@neondatabase/serverless';
import { composeTimeline, EpisodeJsonZ, type EpisodeJson } from '@what-if/engine';
import { ARCHETYPES } from '@what-if/engine/src/archetypes/registry';
import type { Words } from '@what-if/engine/schema';
import { synthWords } from '../src/lib/demo-words';
import { ShotFrame } from '@what-if/engine/src/episode';

// Repro of the Vercel editor black screen: load the LATEST episodes from Neon,
// rebuild their timeline and ShotMap, then render every segment's shot at
// several frames with react-dom/server. Reports WHY a shot is unbound.

type EpisodeRow = { id: string; episode: unknown };
type JobRow = { kind: string; status: string; result: unknown; created_at: string };

type ShotLike = { id: string; archetype?: string; archetypeProps?: Record<string, unknown> };

const main = async (): Promise<void> => {
  const sql = neon(process.env.DATABASE_URL as string);
  const rows = (await sql`SELECT id, episode FROM episodes ORDER BY created_at DESC LIMIT 3`) as EpisodeRow[];
  if (rows.length === 0) {
    console.log('no episodes in db');
    return;
  }
  for (const row of rows) {
    console.log(`\n=== episode ${row.id}`);
    const parsed = EpisodeJsonZ.safeParse(row.episode);
    if (!parsed.success) {
      console.log('episode json fails EpisodeJsonZ:', parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`));
      continue;
    }
    const ep = parsed.data as EpisodeJson;
    const jobRows = (await sql`SELECT kind, status, result, created_at FROM jobs WHERE episode_id = ${row.id} AND kind = 'tts' AND status = 'done' ORDER BY created_at DESC LIMIT 1`) as JobRow[];
    let words: Words;
    if (jobRows[0]) {
      words = (jobRows[0].result as { words?: Words }).words ?? [];
      console.log(`tts words: ${words.length}`);
    } else {
      words = synthWords(ep.script);
      console.log('no tts job → demo words');
    }
    const tl = composeTimeline(ep, words, { fps: 30, audio: {} });
    console.log(`timeline: total=${tl.total}f (${(tl.total / 30).toFixed(1)}s) segments=${tl.segments.length}`);
    for (const shot of ep.shots as ShotLike[]) {
      const arch = shot.archetype;
      if (!arch) {
        console.log(`${shot.id}: NO ARCHETYPE (builtin set only)`);
        continue;
      }
      const A = ARCHETYPES[arch];
      if (!A) {
        console.log(`${shot.id}: UNKNOWN ARCHETYPE '${arch}' → unbound`);
        continue;
      }
      const direct = A.PropsZ.safeParse(shot.archetypeProps ?? {});
      if (direct.success) {
        console.log(`${shot.id}: ${arch} OK`);
      } else {
        const issues = direct.error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ');
        console.log(`${shot.id}: ${arch} PROPS INVALID → ${issues}`);
      }
    }
    // render every bound shot at t=0 / mid / end of its first segment
    const map = (await import('@what-if/engine/src/archetypes/registry')).buildShotMap(ep);
    for (const seg of tl.segments) {
      const Shot = map[seg.shot];
      if (!Shot) {
        console.log(`seg ${seg.a}-${seg.b} ${seg.shot}: UNBOUND → black`);
        continue;
      }
      const info = tl.shots.find((s) => s.id === seg.shot);
      const len = info?.len ?? seg.b - seg.a;
      for (const t of [seg.t0, (seg.t0 + seg.t1) / 2, seg.t1 - 1]) {
        try {
          const html = renderToStaticMarkup(
            React.createElement(ShotFrame, null, React.createElement(Shot, { t, len, f: seg.a, uid: seg.shot })),
          );
          const texts = (html.match(/>([^<>]{2,})</g) ?? []).length;
          if (html.length < 400) console.log(`seg ${seg.shot} t=${t.toFixed(0)}: NEARLY EMPTY (${html.length} chars, ${texts} text nodes)`);
        } catch (e) {
          console.log(`seg ${seg.shot} t=${t.toFixed(0)} THROWS: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }
  console.log('\ndone');
};

void main();

