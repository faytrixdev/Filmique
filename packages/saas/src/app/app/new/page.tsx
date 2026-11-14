import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { authSecret, readRequestSession, SESSION_COOKIE } from '@/lib/auth';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleCreditRepo } from '@/db/credits-repo';
import { logoutAction } from '@/app/actions/auth';
import { Brand, Grain } from '@/components/brand';
import { NewFilm } from './new-film';

const euros = (micros: number): string => (micros / 1_000_000).toFixed(2).replace('.', ',') + ' €';

async function NewFilmPage(): Promise<React.ReactElement> {
  await connection(); // session only exists at request time (cookies + Date.now)
  const session = readRequestSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret());
  if (!session) redirect('/login');
  const db = getDb();
  const userId = await drizzleEpisodeRepo(db).userIdByEmail(session.email);
  if (!userId) redirect('/login');
  const balance = await drizzleCreditRepo(db).balanceFor(userId);

  return (
    <div className="ground">
      <Grain />
      <header className="topbar">
        <Brand href="/app" />
        <span className="spacer" />
        <span className="pill pill--voiced" title="Crédits disponibles">
          <span className="pill__dot" />
          {euros(balance)}
        </span>
        <span className="mono faint" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {session.email}
        </span>
        <form action={logoutAction}>
          <button className="btn btn--ghost btn--sm" type="submit">
            Se déconnecter
          </button>
        </form>
      </header>

      <main className="container" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        <NewFilm balanceMicros={balance} />
      </main>
    </div>
  );
}

export default function NewPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="ground loading">Ouverture du studio…</div>}>
      <NewFilmPage />
    </Suspense>
  );
}
