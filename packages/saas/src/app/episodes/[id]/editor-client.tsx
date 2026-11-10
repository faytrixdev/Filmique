'use client';

import React, { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { buildShotMap, composeTimeline, Episode, type EpisodeJson } from '@what-if/engine';
import { synthWords } from '@/lib/demo-words';
import { STUDIO_LOOKS } from '@/lib/looks';
import type { TtsResult } from '@/lib/api-tts';

const fps = 30;

// The whole episode as one Remotion component, over its own data. Real TTS words
// when a voice job exists, the deterministic demo cadence otherwise.
export const SaaSEpisode: React.FC<{ episode: EpisodeJson; tts: TtsResult | null }> = ({ episode, tts }) => {
  const words = useMemo(() => tts?.words ?? synthWords(episode.script), [tts, episode.script]);
  const audio = useMemo(() => (tts ? { voice: tts.audioUrl, voiceVol: 1 } : {}), [tts]);
  const timeline = useMemo(() => composeTimeline(episode, words, { fps, audio }), [episode, words, audio]);
  const shots = useMemo(() => buildShotMap(episode), [episode]);
  return <Episode timeline={timeline} shots={shots} looks={STUDIO_LOOKS} />;
};

type Beat = { beat: string; text: string };

export default function EditorClient({ episodeId, episode, tts: initialTts }: { episodeId: string; episode: EpisodeJson; tts: TtsResult | null }) {
  const [tab, setTab] = useState<'script' | 'shots' | 'audio'>('script');
  const [beatEdits, setBeatEdits] = useState<(string | null)[]>(episode.script.map(() => null));
  const [tts, setTts] = useState<TtsResult | null>(initialTts);
  const [state, setState] = useState<string>('');

  const timeline = useMemo(() => {
    const words = tts?.words ?? synthWords(episode.script);
    const audio = tts ? { voice: tts.audioUrl, voiceVol: 1 } : {};
    return composeTimeline(episode, words, { fps, audio });
  }, [episode, tts]);

  const editedScript = useMemo(
    () => episode.script.map((b, i) => ({ ...b, text: beatEdits[i] ?? b.text })),
    [episode.script, beatEdits],
  );

  const save = async (): Promise<void> => {
    setState('Enregistrement…');
    const script = editedScript;
    const res = await fetch(`/api/episodes/${episodeId}`, { method: 'PUT', body: JSON.stringify({ ...episode, script }) });
    if (!res.ok) {
      setState(`Échec de l'enregistrement (${res.status})`);
      return;
    }
    setState('Enregistré.');
  };

  const rerunTts = async (): Promise<void> => {
    setState('Voix…');
    const res = await fetch(`/api/episodes/${episodeId}/tts`, { method: 'POST' });
    if (!res.ok) {
      setState(`Synthèse impossible (${res.status})`);
      return;
    }
    setTts((await res.json()) as TtsResult);
    setState('Voix mise à jour.');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16, padding: 16, minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>{episode.title.join(' ')}</h1>
        {/* 1920x1080 preview scaled; true 9:16 crop is a post-render job on Lambda (MVP) */}
        <Player
          component={SaaSEpisode}
          inputProps={{ episode: { ...episode, script: editedScript }, tts }}
          durationInFrames={timeline.total}
          fps={fps}
          compositionWidth={1920}
          compositionHeight={1080}
          controls
          loop
          style={{ width: '100%', aspectRatio: '16 / 9', background: '#0E0C1E' }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <button onClick={() => void save()}>Enregistrer</button>
          <button onClick={() => void rerunTts()}>Voix</button>
          <span style={{ opacity: 0.7 }}>
            {state || `${timeline.total}f · ${timeline.shots.length} plans · ${tts ? 'voix réelle' : 'piste démo 0,35 s/mot'}`}
          </span>
        </div>
      </div>

      <aside style={{ borderLeft: '1px solid #E5E0F0', paddingLeft: 16 }}>
        <nav style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {(['script', 'shots', 'audio'] as const).map((tabName) => (
            <button key={tabName} onClick={() => setTab(tabName)} style={{ fontWeight: tab === tabName ? 700 : 400 }}>
              {tabName}
            </button>
          ))}
        </nav>
        {tab === 'script' ? (
          <div>
            {editedScript.map((b, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, opacity: 0.7 }}>{b.beat}</label>
                <textarea
                  value={b.text}
                  onChange={(e) => {
                    const next = [...beatEdits];
                    next[i] = e.target.value;
                    setBeatEdits(next);
                  }}
                  rows={3}
                  style={{ width: '100%', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
            ))}
            <p style={{ fontSize: 12, opacity: 0.6 }}>Enregistrer → sauvegarde la version. Voix → re-TTS et recalage des cuts.</p>
          </div>
        ) : tab === 'shots' ? (
          <ul style={{ fontSize: 13, paddingLeft: 16 }}>
            {timeline.shots.map((s) => (
              <li key={s.id}>
                <b>{s.id}</b> · {s.size} · key {s.key} · {s.len}f
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 13, opacity: 0.6 }}>
            {tts ? `Voix ${tts.voiceId}` : 'Pas encore de voix'} — pick/gains arrive avec le Task 13.
          </p>
        )}
      </aside>
    </div>
  );
}
