import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { processWhopWebhook, verifyWhopSignature, type CreditGrantRepo, type WhopUserMap, type WhopWebhookRepo } from '../src/lib/whop';

const SECRET = 'whsec_test123';

const signed = (body: string): string => createHmac('sha256', SECRET).update(body).digest('hex');

describe('whop webhook verification (offline)', () => {
  it('accepts the signed raw body and.refuses tampering or absence', () => {
    const raw = JSON.stringify({ event: 'membership.activated', data: { user: 'whop-123' } });
    expect(verifyWhopSignature(raw, signed(raw), SECRET)).toBe(true);
    expect(verifyWhopSignature(raw, signed(`${raw}x`), SECRET)).toBe(false);
    expect(verifyWhopSignature(raw, undefined, SECRET)).toBe(false);
    expect(verifyWhopSignature(raw, signed(raw), 'whsec_wrong')).toBe(false);
  });

  it('membership.activated grants once, deduplicates on redelivery', async () => {
    const grants: string[] = [];
    const seenIds = new Set<string>();
    const deps = {
      users: {
        userByWhopId: async (whopId: string) => {
          const userId = `local-${whopId}`;
          void whopId;
          return userId;
        },
      } as WhopUserMap,
      webhooks: {
        seen: async (id: string) => seenIds.has(id),
        markSeen: async (id: string) => void seenIds.add(id),
      } as WhopWebhookRepo,
      credits: {
        grant: async (userId: string) => void grants.push(userId),
      } as CreditGrantRepo,
      whopUserId: 'whop-123',
    };
    const payload = { event: 'membership.activated' };

    const first = await processWhopWebhook(deps, payload, 'wh-1');
    expect(first.handled).toBe('granted');
    expect(grants).toEqual(['local-whop-123']);

    const replay = await processWhopWebhook(deps, payload, 'wh-1');
    expect(replay.handled).toBe('duplicate');
    expect(grants).toEqual(['local-whop-123']); // no second grant

    const other = await processWhopWebhook(deps, payload, 'wh-2'); // renewal = new id
    expect(other.handled).toBe('granted');
    expect(grants).toHaveLength(2);
  });

  it('payment.failed records but grants nothing; unknown events are skipped', async () => {
    const grants: string[] = [];
    const seen: [string, string][] = [];
    const deps = {
      users: { userByWhopId: async () => 'local-x' } as WhopUserMap,
      webhooks: {
        seen: async () => false,
        markSeen: async (id: string, event: string) => void seen.push([id, event]),
      } as WhopWebhookRepo,
      credits: { grant: async (u: string) => void grants.push(u) } as CreditGrantRepo,
      whopUserId: 'whop-9',
    };

    const failed = await processWhopWebhook(deps, { event: 'payment.failed' }, 'wh-f');
    expect(failed.handled).toBe('failed');
    expect(grants).toEqual([]);
    expect(seen).toEqual([['wh-f', 'payment.failed']]);

    const unknown = await processWhopWebhook(deps, { event: 'membership.deactivated' }, 'wh-u');
    expect(unknown.handled).toBe('skipped');

    // missing whop user id: activation records + skips
    const lost = await processWhopWebhook({ ...deps, whopUserId: null }, { event: 'membership.activated' }, 'wh-l');
    expect(lost.handled).toBe('skipped');
    expect(grants).toEqual([]);
    expect(seen).toHaveLength(3);
  });

  it('no webhook id → untouched (defends malformed calls)', async () => {
    const seen: [string, string][] = [];
    const deps = {
      users: { userByWhopId: async () => 'local-x' } as WhopUserMap,
      webhooks: { seen: async () => false, markSeen: async () => undefined } as WhopWebhookRepo,
      credits: { grant: async () => undefined } as CreditGrantRepo,
      whopUserId: 'x',
    };
    const res = await processWhopWebhook(deps, { event: 'membership.activated' }, undefined);
    expect(res.handled).toBe('skipped');
    expect(seen).toEqual([]);
  });
});
