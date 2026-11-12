import { defineConfig } from 'drizzle-kit';

// Migration tool for the saas schema (src/db/schema.ts). Run from
// packages/saas with DATABASE_URL set: `pnpm exec drizzle-kit push`.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
