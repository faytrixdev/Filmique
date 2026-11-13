import { neon } from '@neondatabase/serverless';

const main = async (): Promise<void> => {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`create table if not exists audio_files (
    id uuid primary key default gen_random_uuid(),
    episode_id uuid references episodes(id) on delete cascade,
    mime text not null default 'audio/mpeg',
    data_b64 text not null,
    created_at timestamptz not null default now()
  )`;
  const cols = (await sql`select column_name from information_schema.columns where table_name = 'audio_files' order by ordinal_position`) as { column_name: string }[];
  console.log('audio_files columns:', cols.map((c) => c.column_name).join(', '));
};

void main();
