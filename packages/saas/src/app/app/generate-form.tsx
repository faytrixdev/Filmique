'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Topic → POST /api/episodes/generate → straight into the editor.
export const GenerateForm = (): React.ReactElement => {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [state, setState] = useState('');

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
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
    <form onSubmit={(e) => void submit(e)} style={{ marginTop: 16, display: 'flex', gap: 8 }}>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Et si le pain tombait du ciel ?"
        style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
      />
      <button type="submit" disabled={state === 'Génération…'}>
        Générer
      </button>
      {state ? <span style={{ fontSize: 13, opacity: 0.7, alignSelf: 'center' }}>{state}</span> : null}
    </form>
  );
};
