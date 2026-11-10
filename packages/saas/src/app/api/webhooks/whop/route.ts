import type { NextRequest } from 'next/server';
import { processWhopWebhook, verifyWhopSignature } from '@/lib/whop';
import { getDb } from '@/db';
import { drizzleWhopUserMap, drizzleWhopWebhookRepo, drizzleCreditGrantRepo } from '@/db/whop-repo';

// Whop outbound webhook: raw-body signature (whsec_), then the pure processor.
// Unverified or unsigned requests die before any credit touch.

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) return json({ error: 'unconfigured' }, 503);

  const raw = await req.text();
  if (!verifyWhopSignature(raw, req.headers.get('x-whop-signature') ?? undefined, secret)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let payload: { event: string; data?: { user?: string } } | null = null;
  try {
    payload = JSON.parse(raw) as { event: string; data?: { user?: string } };
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const db = getDb();
  const result = await processWhopWebhook(
    { users: drizzleWhopUserMap(db), webhooks: drizzleWhopWebhookRepo(db), credits: drizzleCreditGrantRepo(db), whopUserId: payload.data?.user ?? null },
    payload,
    req.headers.get('x-whop-webhook-id') ?? undefined,
  );
  return json(result, 200);
}
