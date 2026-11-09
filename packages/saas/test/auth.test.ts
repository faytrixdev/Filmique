import { describe, expect, it } from 'vitest';
import {
  checkLink,
  consumeMagicLink,
  hashToken,
  issuedLink,
  MAGIC_TTL_MS,
  readSession,
  requestMagicLink,
  SESSION_TTL_MS,
  sessionCookie,
  type MagicRepo,
} from '../src/lib/auth';

const T0 = 1_700_000_000_000;

/** same-interface in-memory repo: the only thing the unit tests fake. */
const fakeRepo = (): MagicRepo & { rows: Map<string, { email: string; tokenHash: string; expiresAt: number; usedAt: number | null }> } => {
  const rows = new Map<string, { email: string; tokenHash: string; expiresAt: number; usedAt: number | null }>();
  return {
    rows,
    async save(l) {
      rows.set(l.tokenHash, { ...l, usedAt: null });
    },
    async byTokenHash(h) {
      return rows.get(h) ?? null;
    },
    async markUsed(h, usedAt) {
      const row = rows.get(h);
      if (row) row.usedAt = usedAt;
    },
    async upsertUser(email) {
      return { email };
    },
  };
};

describe('magic link token flow', () => {
  it('a fresh link verifies, consumes once, then refuses reuse', async () => {
    const repo = fakeRepo();
    const token = await requestMagicLink(repo, 'Pip@WhatIf.studio', T0);
    expect(token.startsWith('wl_')).toBe(true);
    expect([...repo.rows.keys()]).toEqual([hashToken(token)]); // only the hash is stored

    const first = await consumeMagicLink(repo, token, T0 + 1_000);
    expect(first).toEqual({ ok: true, email: 'pip@whatif.studio' });

    const reapplied = await consumeMagicLink(repo, token, T0 + 2_000);
    expect(reapplied).toEqual({ ok: false, reason: 'used' });
  });

  it('an unknown token is refused and a wrong token never matches a hash', async () => {
    const repo = fakeRepo();
    await requestMagicLink(repo, 'a@b.c', T0);
    expect(await consumeMagicLink(repo, 'wl_nope', T0 + 1)).toEqual({ ok: false, reason: 'unknown' });
    expect(checkLink(null, T0)).toEqual({ ok: false, reason: 'unknown' });
  });

  it('a link expires after 15 minutes', async () => {
    const { token, stored } = issuedLink('a@b.c', T0);
    expect(stored.expiresAt - T0).toBe(MAGIC_TTL_MS);
    const repo = fakeRepo();
    await repo.save(stored);
    expect(await consumeMagicLink(repo, token, T0 + MAGIC_TTL_MS - 1)).toMatchObject({ ok: true });
    const repo2 = fakeRepo();
    await repo2.save(stored);
    expect(await consumeMagicLink(repo2, token, T0 + MAGIC_TTL_MS + 1)).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('signed session cookie', () => {
  it('round-trips the email and refuses tampering or expiry', () => {
    const secret = 'test-secret';
    const cookie = sessionCookie('pip@whatif.studio', secret, T0);
    expect(readSession(cookie, secret, T0)).toEqual({ email: 'pip@whatif.studio' });
    expect(cookie.length).toBeGreaterThan(40);

    expect(readSession(cookie, 'other-secret', T0)).toBeNull();
    // flip one char of the signature
    const tampered = `${cookie.slice(0, -2)}qq`;
    expect(readSession(tampered, secret, T0)).toBeNull();
    // expired
    expect(readSession(cookie, secret, T0 + SESSION_TTL_MS + 1)).toBeNull();
  });

  it('session ttl is 7 days', () => {
    expect(SESSION_TTL_MS).toBe(7 * 24 * 3_600_000);
  });
});
