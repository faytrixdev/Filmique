import type { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { drizzleAudioStore } from '@/db/audio-repo';

// Public read of a TTS audio blob by unguessable uuid. Loaded by the Remotion
// Player (and by Lambda renders), so it must not require the session cookie.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) return new Response('not found', { status: 404 });
  const row = await drizzleAudioStore(getDb()).get(id);
  if (!row) return new Response('not found', { status: 404 });
  return new Response(row.bytes, {
    headers: {
      'content-type': row.mime,
      'content-length': String(row.bytes.byteLength),
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
