import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleCreditRepo } from '@/db/credits-repo';
import { logoutAction } from '@/app/actions/auth';
import { GenerateForm } from './generate-form';

async function Dashboard() {
  await connection(); // session only exists at request time (cookies + Date.now)
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  if (!session) redirect('/login');
  const db = getDb();
  const episodeRepo = drizzleEpisodeRepo(db);
  const userId = await episodeRepo.userIdByEmail(session.email);
  if (!userId) redirect('/login');
  const episodes = await episodeRepo.listFor(userId);
  const balance = await drizzleCreditRepo(db).balanceFor(userId);
  return (
    <main style={{ maxWidth: 720, margin: '8vh auto', fontFamily: 'system-ui' }}>
      <h1>Mes épisodes</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Connecté en tant qu&apos;{session.email} · solde {(balance / 1_000_000).toFixed(2)} €
      </p>
      {episodes.length === 0 ? (
        <p style={{ fontSize: 14, opacity: 0.6 }}>Aucun épisode pour l&apos;instant — écrivez un « Et si … » ci-dessous.</p>
      ) : (
        <ul style={{ paddingLeft: 16, fontSize: 14 }}>
          {episodes.map((row) => (
            <li key={row.id} style={{ marginBottom: 6 }}>
              <a href={`/episodes/${row.id}`} style={{ fontWeight: 600 }}>
                {row.episode.title.join(' ')}
              </a>
              <span style={{ opacity: 0.6 }}> · {row.status} · maj {new Date(row.updatedAt).toLocaleString('fr-FR')}</span>
            </li>
          ))}
        </ul>
      )}
      <GenerateForm />
      <form action={logoutAction}>
        <button type="submit">Se déconnecter</button>
      </form>
    </main>
  );
}

// Protected dashboard: no valid session → straight to /login.
export default function AppPage() {
  return (
    <Suspense fallback={<p style={{ margin: '8vh auto', maxWidth: 720 }}>Chargement…</p>}>
      <Dashboard />
    </Suspense>
  );
}
