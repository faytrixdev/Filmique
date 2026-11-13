import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const main = async (): Promise<void> => {
  const sql = neon(process.env.DATABASE_URL as string);
  const rows = (await sql`SELECT id, created_at, topic FROM episodes ORDER BY created_at DESC LIMIT 4`) as { id: string; created_at: string; topic: string }[];
  for (const r of rows) console.log(`${r.created_at}  ${r.id}  ${r.topic}`);
  console.log('now:', new Date().toISOString());
};

void main();
