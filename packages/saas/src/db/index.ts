import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';

/** Lazily-built Neon database handle (drizzle + http driver). */
export const getDb = (url = process.env.DATABASE_URL): NeonHttpDatabase => {
  if (!url) throw new Error('Missing DATABASE_URL (Neon)');
  return drizzle(neon(url));
};
