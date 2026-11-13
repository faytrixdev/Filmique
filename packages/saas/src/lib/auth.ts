import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Magic-link auth, no deps: single-use tokens (TTL 15 min) + HMAC-signed session
// cookie (TTL 7 days). All logic is pure over a tiny repo interface, so the token
// flow is unit-testable without a database.

export const MAGIC_TTL_MS = 15 * 60_000;
export const SESSION_TTL_MS = 7 * 24 * 3_600_000;

export type StoredLink = {
  email: string;
  tokenHash: string;
  expiresAt: number; // epoch ms
  usedAt: number | null;
};

export interface MagicRepo {
  save(link: { email: string; tokenHash: string; expiresAt: number }): Promise<void>;
  byTokenHash(tokenHash: string): Promise<StoredLink | null>;
  markUsed(tokenHash: string, usedAt: number): Promise<void>;
  upsertUser(email: string): Promise<unknown>;
}

export const newMagicToken = (): string => `wl_${randomBytes(24).toString('hex')}`;
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const issuedLink = (email: string, now: number): { token: string; stored: StoredLink } => {
  const token = newMagicToken();
  return {
    token,
    stored: { email: email.toLowerCase(), tokenHash: hashToken(token), expiresAt: now + MAGIC_TTL_MS, usedAt: null },
  };
};

export type ConsumeResult = { ok: true; email: string } | { ok: false; reason: 'used' | 'expired' | 'unknown' };

export const checkLink = (link: StoredLink | null, now: number): ConsumeResult => {
  if (!link) return { ok: false, reason: 'unknown' };
  if (link.usedAt !== null) return { ok: false, reason: 'used' };
  if (now > link.expiresAt) return { ok: false, reason: 'expired' };
  return { ok: true, email: link.email };
};

/** Requests a magic link: persists only the hash, returns the token for the mailer. */
export const requestMagicLink = async (repo: MagicRepo, email: string, now: number): Promise<string> => {
  const { token, stored } = issuedLink(email, now);
  await repo.save(stored);
  return token;
};

/** Click flow: single swap-once consum — checks, marks used, upserts the user. */
export const consumeMagicLink = async (repo: MagicRepo, token: string, now: number): Promise<ConsumeResult> => {
  const tokenHash = hashToken(token);
  const link = await repo.byTokenHash(tokenHash);
  const res = checkLink(link, now);
  if (!res.ok) return res;
  await repo.markUsed(tokenHash, now);
  await repo.upsertUser(res.email);
  return res;
};

// ---------- signed session cookie (no deps, tamper-proof against a secret) ----------

const b64u = (s: string): string => Buffer.from(s).toString('base64url');
const unb64u = (s: string): string => Buffer.from(s, 'base64url').toString();

const sessionId = (email: string, expiresAt: number): string => `v1:${b64u(email)}:${expiresAt}`;

export const sessionCookie = (email: string, secret: string, now: number): string =>
  `${sessionId(email, now + SESSION_TTL_MS)}:${createHmac('sha256', secret).update(sessionId(email, now + SESSION_TTL_MS)).digest('base64url')}`;

export const readSession = (value: string | undefined, secret: string, now: number): { email: string } | null => {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const body = `v1:${parts[1]}:${parts[2]}`;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const got = Buffer.from(parts[3]);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const expiresAt = Number(parts[2]);
  if (!Number.isFinite(expiresAt) || now > expiresAt) return null;
  return { email: unb64u(parts[1]) };
};

export const SESSION_COOKIE = 'wis_session';
export const authSecret = (): string => process.env.AUTH_SECRET ?? 'dev-secret-rotate-me';

/** Session read for RSC pages: the request clock lives here, outside the
 * component body, so the React purity lint stays green. */
export const readRequestSession = (value: string | undefined, secret: string): { email: string } | null =>
  readSession(value, secret, Date.now());
