import { createHmac, timingSafeEqual } from 'node:crypto';

// Whop webhook handling: signature check on the RAW body (whsec_ secret),
// membership.activated → monthly credit grant, payment.failed → grace note.
// Replay-safe: grants are keyed by the outgoing webhook id, once and only once.

export type WhopUserMap = {
  /** The local user linked to this Whop member id, creating a bare row if needed. */
  userByWhopId(whopUserId: string): Promise<string>;
};

export type WhopWebhookRepo = {
  seen(id: string): Promise<boolean>;
  markSeen(id: string, event: string): Promise<void>;
};

export const verifyWhopSignature = (rawBody: string, signatureHeader: string | undefined, secret: string): boolean => {
  if (!signatureHeader) return false;
  const signature = signatureHeader;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const got = Buffer.from(signature, 'utf8');
  const want = Buffer.from(expected, 'utf8');
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
};

export const MONTHLY_GRANT_MICROS = 3_000_000; // 3,00 € of credits per active month

export type WhopPayload = {
  event: string;
  data?: {
    user?: string; // whop user id
    membership?: { status?: string };
  };
};

export type WhopResult = { handled: 'granted' | 'failed' | 'duplicate' | 'skipped'; userId?: string; event: string };

export const processWhopWebhook = async (
  deps: { users: WhopUserMap; webhooks: WhopWebhookRepo; credits: CreditGrantRepo; whopUserId?: string | null },
  payload: WhopPayload,
  webhookId: string | undefined,
): Promise<WhopResult> => {
  if (!webhookId) return { handled: 'skipped', event: payload.event };
  if (await deps.webhooks.seen(webhookId)) return { handled: 'duplicate', event: payload.event };

  if (payload.event === 'membership.activated' && deps.whopUserId) {
    const userId = await deps.users.userByWhopId(deps.whopUserId);
    await deps.credits.grant(userId, 'whop-renewal');
    await deps.webhooks.markSeen(webhookId, payload.event);
    return { handled: 'granted', userId, event: payload.event };
  }

  if (payload.event === 'membership.activated' && !deps.whopUserId) {
    await deps.webhooks.markSeen(webhookId, payload.event);
    return { handled: 'skipped', event: payload.event };
  }

  // payment.failed and anything else: noop for credits, but recording keeps
  // redeliveries idempotent and gives us an audit trail.
  await deps.webhooks.markSeen(webhookId, payload.event);
  if (payload.event === 'payment.failed') return { handled: 'failed', event: payload.event };
  return { handled: 'skipped', event: payload.event };
};

export interface CreditGrantRepo {
  grant(userId: string, reason: string): Promise<unknown>;
}
