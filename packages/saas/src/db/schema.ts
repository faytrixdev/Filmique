import { pgTable, text, timestamp, uuid, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { z } from 'zod';

// Minimal SaaS tables: users (magic-link auth), magic_links (mailbox tokens),
// episodes (one slug, active json), episode_versions (immutable snapshots),
// jobs (render/tts pipeline rows), credit_ledger (append-only spends & refunds).

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('member'), // member | admin
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const magicLinks = pgTable(
  'magic_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('magic_links_email_idx').on(t.email)],
);

export const episodes = pgTable(
  'episodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    topic: text('topic').notNull(),
    episode: jsonb('episode').notNull(), // EpisodeJson (Zod-gated on every save)
    status: text('status').notNull().default('draft'), // draft | render_pending | rendered | failed
    shareToken: text('share_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('episodes_user_idx').on(t.userId)],
);

export const episodeVersions = pgTable(
  'episode_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    episode: jsonb('episode').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('episode_versions_episode_idx').on(t.episodeId)],
);

/** jobs rows mirror packages/jobs JobRunner state jobsBy id for the web/API side. */
export const JobKindZ = z.enum(['tts', 'render', 'compose']);

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // JobKindZ
    status: text('status').notNull().default('queued'), // queued | running | done | failed | refunded
    spec: jsonb('spec').notNull(), // provider-specific payload (voice text, lambda params...)
    result: jsonb('result'),
    error: text('error'), // [] if any — point fix: first line removed?
    costEurMicros: integer('cost_eur_micros').default(0),
    retries: integer('retries').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('jobs_episode_idx').on(t.episodeId)],
);

/** append-only: charge (negative) and refunds (positive) keep the audit trail. */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    deltaEuroMicros: integer('delta_eur_micros').notNull(), // negative = spend, positive = refund
    balanceAfterEuroMicros: integer('balance_after_eur_micros').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('credit_ledger_user_idx').on(t.userId)],
);

export const hasRendered = (status: string) => status === 'rendered' || status === 'failed';
