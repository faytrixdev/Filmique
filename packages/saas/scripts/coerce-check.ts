import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { ARCHETYPES, coerceProps } from '@what-if/engine';
import type { EpisodeJson } from '@what-if/engine/schema';

// Does the coercion pipeline actually fix the props stored in the newest episode?

type Row = { id: string; episode: unknown };

const main = async (): Promise<void> => {
  const sql = neon(process.env.DATABASE_URL as string);
  const rows = (await sql`SELECT id, episode FROM episodes ORDER BY created_at DESC LIMIT 1`) as Row[];
  const ep = rows[0].episode as EpisodeJson;
  console.log('episode', rows[0].id);
  for (const shot of ep.shots) {
    console.log(`${shot.id} ${shot.archetype ?? '(none)'} RAW: ${JSON.stringify(shot.archetypeProps)}`);
    if (!shot.archetype) {
      console.log(`${shot.id}: no archetype`);
      continue;
    }
    const A = ARCHETYPES[shot.archetype];
    if (!A) {
      console.log(`${shot.id}: unknown archetype ${shot.archetype}`);
      continue;
    }
    const direct = A.PropsZ.safeParse(shot.archetypeProps ?? {});
    if (direct.success) {
      console.log(`${shot.id}: ${shot.archetype} already OK`);
      continue;
    }
    const coerced = coerceProps(A.PropsZ as never, (shot.archetypeProps ?? {}) as Record<string, unknown>);
    if (coerced) {
      console.log(`${shot.id}: ${shot.archetype} COERCIBLE → ${JSON.stringify(coerced).slice(0, 160)}`);
    } else {
      const issues = direct.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join(' | ');
      console.log(`${shot.id}: ${shot.archetype} NOT COERCIBLE → ${issues}`);
    }
  }
};

void main();
