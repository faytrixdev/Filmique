import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { getEpisode } from '@/lib/episodes';
import EditorClient from './editor-client';
import type { EpisodeJson } from '@what-if/engine';

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // session + DB + params live only at request time
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  if (!session) redirect('/login');
  const repo = drizzleEpisodeRepo(getDb());
  const userId = await repo.userIdByEmail(session.email);
  if (!userId) redirect('/login');
  const row = await getEpisode(repo, userId, (await params).id);
  if (!row) notFound();
  return <EditorClient episode={row.episode as EpisodeJson} />;
}

// /episodes/[id] — the editor. Session-guarded, ownership-guarded.
export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p style={{ margin: '8vh auto', maxWidth: 720 }}>Chargement…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}
