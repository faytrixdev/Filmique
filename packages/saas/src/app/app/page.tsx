import React, { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import { authSecret, readRequestSession, SESSION_COOKIE } from '@/lib/auth';
import { getDb } from '@/db';
import { drizzleEpisodeRepo } from '@/db/episodes-repo';
import { drizzleCreditRepo } from '@/db/credits-repo';
import { logoutAction } from '@/app/actions/auth';
import { ArrowIcon, Brand, Grain } from '@/components/brand';

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'pill--draft' },
  render_pending: { label: 'Rendu en cours', className: 'pill--voiced' },
  rendered: { label: 'Rendu', className: 'pill--rendered' },
  failed: { label: 'Échec', className: 'pill--failed' },
};

const euros = (micros: number): string => (micros / 1_000_000).toFixed(2).replace('.', ',') + ' €';

const formatDate = (value: number | Date | string): string =>
  new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

async function Dashboard(): Promise<React.ReactElement> {
  await connection(); // session only exists at request time (cookies + Date.now)
  const session = readRequestSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret());
  if (!session) redirect('/login');
  const db = getDb();
  const episodeRepo = drizzleEpisodeRepo(db);
  const userId = await episodeRepo.userIdByEmail(session.email);
  if (!userId) redirect('/login');
  const episodes = await episodeRepo.listFor(userId);
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
        <div className="row" style={{ alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="stack" style={{ gap: '0.4rem' }}>
            <span className="eyebrow">Studio</span>
            <h1 className="display">Mes épisodes</h1>
          </div>
          <span className="spacer" />
          <span className="mono faint">
            {episodes.length} {episodes.length === 1 ? 'film' : 'films'} · solde {euros(balance)}
          </span>
        </div>

        <div style={{ marginTop: '1.75rem' }}>
          <div className="card card--pad" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="stack" style={{ gap: '0.3rem', flex: '1 1 320px' }}>
              <span className="card__label">Nouvelle hypothèse</span>
              <p className="note" style={{ fontSize: '0.92rem' }}>
                Sujet, réglages, script relu par vous, puis mise en scène. Quatre étapes, aucune corvée.
              </p>
            </div>
            <Link className="btn btn--primary btn--lg" href="/app/new">
              Créer un film
              <ArrowIcon />
            </Link>
          </div>
        </div>

        <div style={{ marginTop: '2.5rem' }}>
          {episodes.length === 0 ? (
            <div className="empty">
              <span className="eyebrow">Rien à l’affiche</span>
              <p className="lede" style={{ textAlign: 'center' }}>
                Aucun épisode pour l’instant. Écrivez une hypothèse ci-dessus — « et si… » — et le studio s’occupe du
                reste.
              </p>
            </div>
          ) : (
            <div className="episodes">
              {episodes.map((row) => {
                const status = STATUS[row.status] ?? STATUS.draft;
                return (
                  <Link className="episode-card" key={row.id} href={`/episodes/${row.id}`}>
                    <div className="row" style={{ gap: '0.5rem' }}>
                      <span className={`pill ${status.className}`}>
                        <span className="pill__dot" />
                        {status.label}
                      </span>
                      <span className="spacer" />
                      <span className="mono faint">{formatDate(row.updatedAt)}</span>
                    </div>
                    <h2 className="episode-card__title">{row.episode.title.join(' ')}</h2>
                    <div className="episode-card__meta">
                      <span>
                        {row.episode.shots.length} plans · {row.episode.script.length} beats ·{' '}
                        {row.episode.settings?.durationS ?? 24} s
                      </span>
                      <span className="episode-card__cta">Ouvrir →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Protected dashboard: no valid session → straight to /login.
export default function AppPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="ground loading">Ouverture du studio…</div>}>
      <Dashboard />
    </Suspense>
  );
}
