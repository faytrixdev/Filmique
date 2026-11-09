import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { authSecret, readSession, SESSION_COOKIE } from '@/lib/auth';
import { logoutAction } from '@/app/actions/auth';

async function Dashboard() {
  await connection(); // session only exists at request time (cookies + Date.now)
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value, authSecret(), Date.now());
  if (!session) redirect('/login');
  return (
    <main style={{ maxWidth: 720, margin: '8vh auto', fontFamily: 'system-ui' }}>
      <h1>Mes épisodes</h1>
      <p>Connecté en tant qu&apos;{session.email} — le CRUD arrive avec l&apos;étape suivante.</p>
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
