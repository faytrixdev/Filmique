'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowIcon } from '@/components/brand';

// Topic → POST /api/episodes/generate → straight into the editor.
export const GenerateForm = (): React.ReactElement => {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [state, setState] = useState('');
  const busy = state === 'Génération…';

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (topic.trim().length < 8) {
      setState('Sujet trop court (8 caractères minimum).');
      return;
    }
    setState('Génération…');
    const res = await fetch('/api/episodes/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic }),
    });
    if (res.status === 201) {
      const data = (await res.json()) as { id: string };
      router.push(`/episodes/${data.id}`);
      return;
    }
    if (res.status === 503) setState('Aucun LLM configuré (LLM_PROVIDER / clé API).');
    else if (res.status === 502) setState(`Le compose a échoué (${((await res.json()) as { note: string }).note}).`);
    else if (res.status === 400) setState('Sujet trop court (8 caractères minimum).');
    else setState(`Erreur ${res.status}`);
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="card card--pad" style={{ display: 'grid', gap: '0.85rem' }}>
      <div className="row" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
        <span className="card__label">Nouvelle hypothèse</span>
        <span className="spacer" />
        <span className="note">Écriture + storyboard en une minute environ</span>
      </div>
      <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Et si le pain tombait du ciel ?"
          className="input input--lg"
          style={{ flex: '1 1 320px' }}
          disabled={busy}
          aria-label="Sujet de l’épisode"
        />
        <button className="btn btn--primary btn--lg" type="submit" disabled={busy}>
          {busy ? 'Génération…' : 'Générer le film'}
          {busy ? null : <ArrowIcon />}
        </button>
      </div>
      {state ? (
        <p className="status" data-busy={busy}>
          {state}
        </p>
      ) : null}
    </form>
  );
};
