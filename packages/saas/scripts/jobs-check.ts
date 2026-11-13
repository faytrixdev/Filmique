import { neon } from '@neondatabase/serverless';

const main = async (): Promise<void> => {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`select kind, status, error, spec->>'voiceId' as voice, created_at from jobs order by created_at desc limit 8`) as {
    kind: string;
    status: string;
    error: string | null;
    voice: string | null;
    created_at: string;
  }[];
  for (const r of rows) console.log(r.kind, '|', r.status, '|', r.voice, '|', String(r.error ?? '').slice(0, 300), '|', r.created_at);
  const n = (await sql`select count(*)::int as n from jobs`) as { n: number }[];
  console.log('total jobs:', n[0]?.n);
};

void main();
