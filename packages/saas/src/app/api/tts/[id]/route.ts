import type { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { drizzleAudioStore } from '@/db/audio-repo';

// Public read of a TTS audio blob by unguessable uuid. Loaded by the Remotion
// Player (and by Lambda renders), so it must not require the session cookie.
// Range requests are supported: Remotion needs a seekable media source.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseRange = (header: string | null, size: number): { start: number; end: number } | null => {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return null;
  let start: number;
  let end: number;
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!UUID.test(id)) return new Response('not found', { status: 404 });
  const row = await drizzleAudioStore(getDb()).get(id);
  if (!row) return new Response('not found', { status: 404 });

  const size = row.bytes.byteLength;
  const common = {
    'content-type': row.mime,
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=31536000, immutable',
  };

  const range = parseRange(req.headers.get('range'), size);
  if (range) {
    const slice = row.bytes.slice(range.start, range.end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...common,
        'content-length': String(slice.byteLength),
        'content-range': `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  }

  return new Response(row.bytes, {
    headers: { ...common, 'content-length': String(size) },
  });
}
