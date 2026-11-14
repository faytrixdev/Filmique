'use client';

import React from 'react';
import { useActionState } from 'react';
import { requestMagicAction, type RequestState } from '@/app/actions/auth';

export default function LoginForm(): React.ReactElement {
  const [state, formAction, pending] = useActionState<RequestState, FormData>(requestMagicAction, null);
  return (
    <form action={formAction} className="stack" style={{ gap: '0.9rem' }}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@studio.fr"
          className="input"
        />
      </div>
      <button className="btn btn--primary btn--block" disabled={pending} type="submit">
        {pending ? 'Envoi du lien…' : 'Recevoir le lien'}
      </button>
      {state?.error ? <p className="alert">{state.error}</p> : null}
      {state?.link ? (
        <p className="note">
          Lien envoyé (MVP, pas de SMTP) :{' '}
          <a href={state.link} style={{ color: 'var(--amber)', fontWeight: 600 }}>
            ouvrir la session
          </a>
        </p>
      ) : null}
      <p className="note">
        En continuant, vous acceptez de recevoir un email de connexion. Aucun mot de passe à retenir.
      </p>
    </form>
  );
}
