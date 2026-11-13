import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

// One-off: give the founding user their welcome credits (the grant now lives in
// signup, but this account predates it). Same conditional single-statement grant
// as drizzleCreditRepo.grant.

const EMAIL = process.argv[2] ?? 'faissaldiabate1@gmail.com';
const MICROS = Number(process.argv[3] ?? 1_000_000);

const main = async (): Promise<void> => {
  const sql = neon(process.env.DATABASE_URL as string);
  const users = (await sql`SELECT id FROM users WHERE email = ${EMAIL} LIMIT 1`) as { id: string }[];
  if (!users[0]) {
    console.log(`no user for ${EMAIL}`);
    return;
  }
  const res = await sql`
    INSERT INTO credit_ledger (user_id, delta_eur_micros, balance_after_eur_micros, reason)
    SELECT ${users[0].id}::uuid, ${MICROS}::int,
      COALESCE((SELECT SUM(delta_eur_micros) FROM credit_ledger WHERE user_id = ${users[0].id}::uuid), 0) + ${MICROS}::int,
      'welcome'
    WHERE COALESCE((SELECT SUM(delta_eur_micros) FROM credit_ledger WHERE user_id = ${users[0].id}::uuid), 0) + ${MICROS}::int >= 0
    RETURNING balance_after_eur_micros`;
  const rows = res as unknown as unknown[];
  console.log(`granted ${MICROS} micros to ${EMAIL} — raw: ${JSON.stringify(rows)}`);
};

void main();
