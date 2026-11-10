import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleJobsRepo } from '@/db/jobs-repo';
import { getEpisode } from '@/lib/episodes';
import EditorClient from './editor-client';
import type { EpisodeJson } from '@what-if/engine';
import type { TtsResult } from '@/lib/api-tts';

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // session + DB + params live only at request time
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  if (!session) redirect('/login');
  const db = getDb();
  const episodeRepo = drizzleEpisodeRepo(db);
  const userId = await episodeRepo.userIdByEmail(session.email);
  if (!userId) redirect('/login');
  const id = (await params).id;
  const row = await getEpisode(episodeRepo, userId, id);
  if (!row) notFound();
  const tts = await drizzleJobsRepo(db).latestDone(id);
  return <EditorClient episodeId={row.id} episode={row.episode as EpisodeJson} tts={tts} />;
}

// /episodes/[id] — the editor. Session-guarded, ownership-guarded.
export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p style={{ margin: '8vh auto', maxWidth: 720 }}>Chargement…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}
