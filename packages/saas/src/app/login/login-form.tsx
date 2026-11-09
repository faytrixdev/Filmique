'use client';

import { useActionState } from 'react';
import { requestMagicAction, type RequestState } from '@/app/actions/auth';

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<RequestState, FormData>(requestMagicAction, null);
  return (
    <form action={formAction}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required placeholder="pip@whatif.studio" />
      <button disabled={pending} type="submit">
        {pending ? 'Envoi…' : 'Recevoir le lien'}
      </button>
      {state?.error ? <p style={{ color: 'crimson' }}>{state.error}</p> : null}
      {state?.link ? (
        <p>
          Lien envoyé (MVP, pas de SMTP) :{' '}
          <a href={state.link}>ouvrir la session</a>
        </p>
      ) : null}
    </form>
  );
}
