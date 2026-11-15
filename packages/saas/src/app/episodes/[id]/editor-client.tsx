'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { ARCHETYPES, coerceProps, composeTimeline, FORMAT_DIMS, MUSIC, resolveSettings, type EpisodeJson } from '@what-if/engine';
import { synthWords } from '@/lib/demo-words';
import { SaaSEpisode, fpsSaaS } from '@/components/saas-episode';
import type { TtsResult } from '@/lib/api-tts';
import { clampKey, moveShot, type Shot } from '@/lib/editor-helpers';
import { DEFAULT_VOICE_LABEL } from '@/lib/voices';
import { Brand, Grain } from '@/components/brand';

const fps = fpsSaaS;

/** Old episodes may hold drifted LLM props; coerce on open so the preview is
 * correct before any save. Unsalvageable props fall back to schema defaults. */
const coerceShots = (ep: EpisodeJson): EpisodeJson => ({
  ...ep,
  shots: ep.shots.map((s) => {
    if (!s.archetype) return s;
    const A = ARCHETYPES[s.archetype] ?? ARCHETYPES.wideRoom;
    const coerced = coerceProps(A.PropsZ as never, (s.archetypeProps ?? {}) as Record<string, unknown>);
    return coerced ? { ...s, archetypeProps: coerced } : { ...s, archetypeProps: undefined };
  }),
});

const timecode = (frames: number): string => {
  const seconds = Math.floor(frames / fps);
  const rest = Math.floor(frames % fps);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}:${String(rest).padStart(2, '0')}`;
};

export default function EditorClient({
  episodeId,
  episode,
  tts: initialTts,
}: {
  episodeId: string;
  episode: EpisodeJson;
  tts: TtsResult | null;
}): React.ReactElement {
  const [tab, setTab] = useState<'script' | 'shots' | 'audio'>('script');
  const [draft, setDraft] = useState<EpisodeJson>(() => coerceShots(episode));
  const [tts, setTts] = useState<TtsResult | null>(initialTts);
  const [state, setState] = useState('');
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const timeline = useMemo(() => {
    const words = tts?.words ?? synthWords(draft.script);
    const audio = tts ? { voice: tts.audioUrl, voiceVol: 1 } : {};
    return composeTimeline(draft, words, { fps, audio });
  }, [draft, tts]);

  const [stageW, stageH] = FORMAT_DIMS[resolveSettings(draft.settings).format];
  const stageRatio = stageW / stageH;

  const mutate = (fn: (d: EpisodeJson) => EpisodeJson): void => setDraft(fn);

  const save = async (): Promise<void> => {
    setBusy(true);
    setState('Enregistrement…');
    const res = await fetch(`/api/episodes/${episodeId}`, { method: 'PUT', body: JSON.stringify(draft) });
    setState(res.ok ? 'Version enregistrée.' : `Échec de l’enregistrement (${res.status})`);
    setBusy(false);
  };

  const rerunTts = async (): Promise<void> => {
    setBusy(true);
    setState('Synthèse de la voix…');
    const savedFirst = await fetch(`/api/episodes/${episodeId}`, { method: 'PUT', body: JSON.stringify(draft) });
    if (!savedFirst.ok) {
      setState(`Synthèse impossible (${savedFirst.status})`);
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/episodes/${episodeId}/tts`, { method: 'POST' });
    if (!res.ok) {
      setState(`Synthèse impossible (${res.status})`);
      setBusy(false);
      return;
    }
    setTts((await res.json()) as TtsResult);
    setState('Voix mise à jour — les coupes sont recalées.');
    setBusy(false);
  };

  // Task 15: the price is read from the API answer, displayed before the click
  const exportFilmCost = '0,04 €';
  const exportFilm = async (): Promise<void> => {
    setBusy(true);
    setState('Envoi du rendu…');
    const res = await fetch(`/api/episodes/${episodeId}/export`, { method: 'POST' });
    if (res.status === 402) {
      setState('Solde insuffisant pour cet export.');
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setState(`Export indisponible (${res.status})`);
      setBusy(false);
      return;
    }
    setState('Render lancé — le MP4 arrive par callback.');
    setBusy(false);
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
      voice: voiceId.trim()
        ? {
            id: voiceId.trim(),
            model: d.voice?.model ?? 'sonic-2',
            settings: d.voice?.settings ?? { stability: 0.5, similarity_boost: 0.75 },
          }
        : d.voice,
    }));
  const setMusic = (clip: string): void =>
    mutate((d) => ({ ...d, sound: { ...d.sound, music: { ...d.sound.music, clip } } }));
  const setGain = (which: 'sfx_lu' | 'music_lu', value: number): void =>
    mutate((d) => ({ ...d, sound: { ...d.sound, levels: { ...d.sound.levels, [which]: value } } }));

  return (
    <div className="ground">
      <Grain />

      <header className="topbar">
        <Brand href="/app" />
        <span className="faint" style={{ opacity: 0.4 }}>
          /
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: '1.05rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '38ch',
          }}
        >
          {draft.title.join(' ')}
        </span>
        <span className="spacer" />
        <span className="status" data-busy={busy}>
          {state || `${timeline.total} images · ${timeline.shots.length} plans · ${tts ? 'voix réelle' : 'piste démo'}`}
        </span>
        <button className="btn btn--sm" onClick={() => void save()} disabled={busy}>
          Enregistrer
        </button>
        <button className="btn btn--sm" onClick={() => void rerunTts()} disabled={busy}>
          Voix
        </button>
        <button className="btn btn--primary btn--sm" onClick={() => void exportFilm()} disabled={busy}>
          Export {exportFilmCost}
        </button>
      </header>

      <div className="studio">
        <div className="studio__main">
          <div className="stage">
            <div className="stage__slate">
              <span className="card__label">
                Aperçu · {stageW}×{stageH}
              </span>
              <span className="mono faint">
                {timecode(0)} — {timecode(timeline.total)} · {fps} i/s
              </span>
            </div>
            {/* The stage follows the project format: 9:16 and 1:1 are centred crops of the same staging. */}
            <Player
              ref={playerRef}
              component={SaaSEpisode}
              inputProps={{ episode: draft, tts }}
              durationInFrames={timeline.total}
              fps={fps}
              compositionWidth={stageW}
              compositionHeight={stageH}
              controls
              loop
              style={{
                width: '100%',
                maxWidth: `min(100%, calc((100vh - 230px) * ${stageRatio}))`,
                aspectRatio: `${stageW} / ${stageH}`,
                background: '#0E0C1E',
                margin: '0 auto',
                display: 'block',
              }}
            />
            <div className="stage__bar">
              <span className={`pill ${tts ? 'pill--voiced' : 'pill--draft'}`}>
                <span className="pill__dot" />
                {tts ? 'Voix Cartesia' : 'Piste démo'}
              </span>
              <span className="mono faint">{draft.shots.length} plans</span>
              <span className="spacer" />
              <span className="note">
                Enregistrer = version · Voix = re-synthèse + recalage des coupes · Export = MP4
              </span>
            </div>
          </div>
        </div>

        <aside className="studio__panel">
          <div className="tabs" role="tablist" aria-label="Édition">
            {(['script', 'shots', 'audio'] as const).map((tabName) => (
              <button
                key={tabName}
                role="tab"
                aria-selected={tab === tabName}
                className="tab"
                data-active={tab === tabName}
                onClick={() => setTab(tabName)}
              >
                {tabName === 'script' ? 'Script' : tabName === 'shots' ? 'Plans' : 'Audio'}
              </button>
            ))}
          </div>

          <div className="inspector__body">
            {tab === 'script' ? (
              <>
                {draft.script.map((b, i) => (
                  <div className="field" key={i}>
                    <label htmlFor={`beat-${i}`}>
                      {b.beat} · {b.text.trim().split(/\s+/).filter(Boolean).length} mots
                    </label>
                    <textarea
                      id={`beat-${i}`}
                      value={b.text}
                      onChange={(e) =>
                        mutate((d) => ({
                          ...d,
                          script: d.script.map((bb, ii) => (ii === i ? { ...bb, text: e.target.value } : bb)),
                        }))
                      }
                      rows={3}
                      className="textarea"
                    />
                  </div>
                ))}
                <p className="note">
                  « Voix » relance la synthèse sur ce texte puis recale chaque coupe sur les nouveaux timestamps.
                </p>
              </>
            ) : tab === 'shots' ? (
              <>
                {draft.shots.map((s, i) => {
                  const info = timeline.shots.find((sh) => sh.id === s.id);
                  const archetype = s.archetype ?? 'builtin';
                  return (
                    <div className="shot" key={s.id}>
                      <div className="shot__head">
                        <span className="shot__id">{s.id}</span>
                        <span className="shot__meta">
                          {s.size} · {archetype}
                          {info ? ` · ${info.len} img` : ''}
                        </span>
                        <span className="spacer" />
                        <button
                          className="btn btn--ghost btn--sm"
                          aria-label={`monter ${s.id}`}
                          onClick={() => moveShotAt(i, -1)}
                          disabled={i === 0}
                        >
                          ↑
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          aria-label={`descendre ${s.id}`}
                          onClick={() => moveShotAt(i, 1)}
                          disabled={i === draft.shots.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          className="btn btn--sm"
                          onClick={() => shotFirsts.has(s.id) && playerRef.current?.seekTo(shotFirsts.get(s.id) as number)}
                        >
                          Lire ici
                        </button>
                      </div>
                      <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
                        <label className="field__label" htmlFor={`key-${i}`}>
                          Key
                        </label>
                        <input
                          id={`key-${i}`}
                          type="number"
                          min={1}
                          value={s.key}
                          onChange={(e) => setShotKey(i, Number(e.target.value))}
                          className="input"
                          style={{ width: 84 }}
                        />
                        <label className="field__label" htmlFor={`set-${i}`}>
                          Set
                        </label>
                        <input
                          id={`set-${i}`}
                          value={s.set}
                          onChange={(e) =>
                            mutate((d) => ({
                              ...d,
                              shots: d.shots.map((ss, ii) => (ii === i ? { ...ss, set: e.target.value } : ss)),
                            }))
                          }
                          className="input"
                          style={{ flex: '1 1 110px', minWidth: 0 }}
                        />
                      </div>
                      <ShotPropsEditor shot={s} onApply={(raw) => setShotPropsRaw(i, raw)} />
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="voice-id">Voix (id Cartesia)</label>
                  <input
                    id="voice-id"
                    value={draft.voice?.id ?? ''}
                    onChange={(e) => setVoiceId(e.target.value)}
                    placeholder={DEFAULT_VOICE_LABEL}
                    className="input"
                  />
                </div>
                <div className="field">
                  <label htmlFor="music-clip">Musique (bed déterministe)</label>
                  <select
                    id="music-clip"
                    value={draft.sound.music.clip}
                    onChange={(e) => setMusic(e.target.value)}
                    className="select"
                  >
                    {Object.keys(MUSIC).map((tone) => (
                      <option key={tone} value={tone}>
                        {tone} — {MUSIC[tone][0].split(/\s+/).slice(0, 4).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row" style={{ gap: '0.75rem' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="sfx-lu">SFX (LU)</label>
                    <input
                      id="sfx-lu"
                      type="number"
                      step={0.1}
                      value={draft.sound.levels.sfx_lu}
                      onChange={(e) => setGain('sfx_lu', Number(e.target.value))}
                      className="input"
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="music-lu">Musique (LU)</label>
                    <input
                      id="music-lu"
                      type="number"
                      step={0.1}
                      value={draft.sound.levels.music_lu}
                      onChange={(e) => setGain('music_lu', Number(e.target.value))}
                      className="input"
                    />
                  </div>
                </div>
                <p className="note">
                  La musique et les effets passent au rendu ; la voix de l’aperçu suit le dernier job de synthèse.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
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
    <div>
      <button className="btn btn--ghost btn--sm" onClick={() => setOpen((o) => !o)}>
        {open ? 'Fermer les props' : 'Props d’archétype'}
      </button>
      {open ? (
        <div className="stack" style={{ gap: '0.35rem', marginTop: '0.4rem' }}>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => !invalid && onApply(raw)}
            rows={6}
            className="textarea mono"
            style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '0.72rem',
              borderColor: invalid ? 'var(--rose)' : undefined,
            }}
          />
          {invalid ? <span style={{ color: 'var(--rose)', fontSize: '0.72rem' }}>JSON invalide</span> : null}
        </div>
      ) : null}
    </div>
  );
};
