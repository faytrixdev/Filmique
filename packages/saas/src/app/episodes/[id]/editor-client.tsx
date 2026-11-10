'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { buildShotMap, composeTimeline, Episode, MUSIC, type EpisodeJson } from '@what-if/engine';
import { synthWords } from '@/lib/demo-words';
import { STUDIO_LOOKS } from '@/lib/looks';
import type { TtsResult } from '@/lib/api-tts';
import { clampKey, moveShot, type Shot } from '@/lib/editor-helpers';

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

export default function EditorClient({ episodeId, episode, tts: initialTts }: { episodeId: string; episode: EpisodeJson; tts: TtsResult | null }) {
  const [tab, setTab] = useState<'script' | 'shots' | 'audio'>('script');
  const [draft, setDraft] = useState<EpisodeJson>(episode);
  const [tts, setTts] = useState<TtsResult | null>(initialTts);
  const [state, setState] = useState('');
  const playerRef = useRef<PlayerRef>(null);

  const timeline = useMemo(() => {
    const words = tts?.words ?? synthWords(draft.script);
    const audio = tts ? { voice: tts.audioUrl, voiceVol: 1 } : {};
    return composeTimeline(draft, words, { fps, audio });
  }, [draft, tts]);

  const mutate = (fn: (d: EpisodeJson) => EpisodeJson): void => setDraft(fn);

  const save = async (): Promise<void> => {
    setState('Enregistrement…');
    const res = await fetch(`/api/episodes/${episodeId}`, { method: 'PUT', body: JSON.stringify(draft) });
    setState(res.ok ? 'Enregistré.' : `Échec de l'enregistrement (${res.status})`);
  };

  const rerunTts = async (): Promise<void> => {
    setState('Voix…');
    const savedFirst = await fetch(`/api/episodes/${episodeId}`, { method: 'PUT', body: JSON.stringify(draft) });
    if (!savedFirst.ok) {
      setState(`Synthèse impossible (${savedFirst.status})`);
      return;
    }
    const res = await fetch(`/api/episodes/${episodeId}/tts`, { method: 'POST' });
    if (!res.ok) {
      setState(`Synthèse impossible (${res.status})`);
      return;
    }
    setTts((await res.json()) as TtsResult);
    setState('Voix mise à jour.');
  };

  // --- Plans tab handlers -------------------------------------------------
  const shotFirsts = new Map(timeline.shots.map((sh) => [sh.id, sh.first]));
  const moveShotAt = (index: number, dir: -1 | 1): void =>
    mutate((d) => ({ ...d, shots: moveShot(d.shots, index, dir) }));
  const setShotKey = (index: number, value: number): void =>
    mutate((d) => ({
      ...d,
      shots: d.shots.map((s, i) => (i === index ? { ...s, key: clampKey(value) } : s)),
    }));
  const setShotPropsRaw = (index: number, raw: string): void => {
    // never apply a broken JSON: the textarea glow already flags it
    try {
      const parsed = JSON.parse(raw) as Shot['archetypeProps'];
      mutate((d) => ({
        ...d,
        shots: d.shots.map((s, i) => (i === index ? { ...s, archetypeProps: parsed ?? undefined } : s)),
      }));
    } catch {
      /* invalid: keep the last valid props */
    }
  };

  // --- Audio tab handlers -------------------------------------------------
  const setVoiceId = (voiceId: string): void =>
    mutate((d) => ({
      ...d,
      voice: voiceId.trim() ? { id: voiceId.trim(), model: d.voice?.model ?? 'sonic-2', settings: d.voice?.settings ?? { stability: 0.5, similarity_boost: 0.75 } } : d.voice,
    }));
  const setMusic = (clip: string): void => mutate((d) => ({ ...d, sound: { ...d.sound, music: { ...d.sound.music, clip } } }));
  const setGain = (which: 'sfx_lu' | 'music_lu', value: number): void =>
    mutate((d) => ({ ...d, sound: { ...d.sound, levels: { ...d.sound.levels, [which]: value } } }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 16, padding: 16, minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>{draft.title.join(' ')}</h1>
        {/* 1920x1080 preview scaled; true 9:16 crop is a post-render job on Lambda (MVP) */}
        <Player
          ref={playerRef}
          component={SaaSEpisode}
          inputProps={{ episode: draft, tts }}
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
            {draft.script.map((b, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, opacity: 0.7 }}>{b.beat}</label>
                <textarea
                  value={b.text}
                  onChange={(e) => mutate((d) => ({ ...d, script: d.script.map((bb, ii) => (ii === i ? { ...bb, text: e.target.value } : bb)) }))}
                  rows={3}
                  style={{ width: '100%', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
            ))}
            <p style={{ fontSize: 12, opacity: 0.6 }}>Enregistrer → version. Voix → re-TTS + recalage des cuts.</p>
          </div>
        ) : tab === 'shots' ? (
          <div>
            {draft.shots.map((s, i) => {
              const info = timeline.shots.find((sh) => sh.id === s.id);
              const archetype = s.archetype ?? '(builtin)';
              return (
                <div key={s.id} style={{ border: '1px solid #EEE', borderRadius: 8, padding: 8, marginBottom: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <b>{s.id}</b>
                    <span style={{ opacity: 0.6 }}>{s.size} · {archetype} · {info ? `${info.len}f` : ''}</span>
                    <span style={{ flex: 1 }} />
                    <button aria-label={`monter ${s.id}`} onClick={() => moveShotAt(i, -1)} disabled={i === 0}>↑</button>
                    <button aria-label={`descendre ${s.id}`} onClick={() => moveShotAt(i, 1)} disabled={i === draft.shots.length - 1}>↓</button>
                    <button onClick={() => shotFirsts.has(s.id) && playerRef.current?.seekTo(shotFirsts.get(s.id) as number)}>
                      ▶ jouer ici
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                    <label style={{ opacity: 0.7 }}>key</label>
                    <input
                      type="number"
                      min={1}
                      value={s.key}
                      onChange={(e) => setShotKey(i, Number(e.target.value))}
                      style={{ width: 80 }}
                    />
                    <label style={{ opacity: 0.7 }}>set</label>
                    <input
                      value={s.set}
                      onChange={(e) => mutate((d) => ({ ...d, shots: d.shots.map((ss, ii) => (ii === i ? { ...ss, set: e.target.value } : ss)) }))}
                      style={{ width: 110 }}
                    />
                  </div>
                  <ShotPropsEditor shot={s} onApply={(raw) => setShotPropsRaw(i, raw)} />
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13 }}>
            <label>Voix (id Cartesia)</label>
            <input
              value={draft.voice?.id ?? ''}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="ex. TX3LPaxmHKxFdv7VOQHJ"
              style={{ width: '100%' }}
            />
            <label style={{ display: 'block', marginTop: 10 }}>Musique (bed déterministe)</label>
            <select value={draft.sound.music.clip} onChange={(e) => setMusic(e.target.value)}>
              {Object.keys(MUSIC).map((tone) => (
                <option key={tone} value={tone}>
                  {tone} — {MUSIC[tone][0].slice(0, 40)}…
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              sfx LU
              <input type="number" step={0.1} value={draft.sound.levels.sfx_lu} onChange={(e) => setGain('sfx_lu', Number(e.target.value))} style={{ width: 70 }} />
              <span style={{ flex: 1 }} />
              music LU
              <input type="number" step={0.1} value={draft.sound.levels.music_lu} onChange={(e) => setGain('music_lu', Number(e.target.value))} style={{ width: 70 }} />
            </label>
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>
              La musique/les effets passent au rendu Lambda ; la voix du Player suit le dernier job re-TTS.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

/** Lazy archetype-props editor: folded JSON textarea, applied on blur, gated by PUT zod. */
const ShotPropsEditor: React.FC<{ shot: Shot; onApply: (raw: string) => void }> = ({ shot, onApply }) => {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState<string>(() => JSON.stringify(shot.archetypeProps ?? {}, null, 2));
  let invalid = false;
  try {
    JSON.parse(raw);
  } catch {
    invalid = raw.trim() !== '';
  }
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ fontSize: 12 }}>
        {open ? 'fermer props' : 'props archétype'}
      </button>
      {open ? (
        <>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => !invalid && onApply(raw)}
            rows={5}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, marginTop: 4, borderColor: invalid ? 'crimson' : '#CCC' }}
          />
          {invalid ? <span style={{ color: 'crimson', fontSize: 11 }}>JSON invalide</span> : null}
        </>
      ) : null}
    </div>
  );
};
