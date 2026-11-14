import React from 'react';
import type { Metadata } from 'next';
import { Brand, Grain } from '@/components/brand';
import LoginForm from './login-form';

export const metadata: Metadata = { title: 'Connexion — Filmique' };

export default function LoginPage(): React.ReactElement {
  return (
    <div className="ground">
      <Grain />
      <div className="auth">
        <aside className="auth__poster">
          <Brand />
          <div style={{ position: 'relative' }}>
            <span className="eyebrow">Le studio</span>
            <p className="display" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.9rem)', marginTop: '0.9rem' }}>
              Et si vous n’aviez
              <br />
              jamais eu besoin
              <br />
              de <em>monter</em> ?
            </p>
          </div>
          <p className="note" style={{ position: 'relative', maxWidth: '34ch' }}>
            Un lien de connexion, pas de mot de passe. Vos films restent les vôtres.
          </p>
        </aside>

        <main className="auth__form">
          <div className="auth__card">
            <div>
              <span className="eyebrow">Connexion</span>
              <h1 className="display" style={{ fontSize: '2.1rem', marginTop: '0.5rem' }}>
                Entrer dans le studio
              </h1>
              <p className="note" style={{ marginTop: '0.5rem' }}>
                Indiquez votre email : nous vous envoyons un lien d’accès à usage unique.
              </p>
            </div>
            <LoginForm />
          </div>
        </main>
      </div>
    </div>
  );
}
