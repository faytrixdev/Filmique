'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowIcon } from '@/components/brand';
import { VOICES } from '@/lib/voices';
import {
  CAPTIONS,
  DURATIONS,
  FORMATS,
  NARRATIONS,
  RHYTHMS,
  TONES,
  WORLDS,
  resolveSettings,
  type Captions,
  type Duration,
  type Format,
  type Narration,
  type ProjectSettings,
  type Rhythm,
  type Tone,
  type World,
} from '@what-if/engine/settings';

// The four-screen creation flow: sujet → réglages → script → récap. Nothing is
// hidden behind a spinner without a label, and options the renderer cannot do
// yet (vertical, captions) are visible but disabled — never fake.

type Beat = { beat: string; text: string };
type Script = {
  title: string[];
  accent?: string;
  power?: { word: string; rule: string; look: string };
  script: Beat[];
};

const SUGGESTIONS = [
  'Et si le pain tombait du ciel ?',
  'Et si chaque mensonge devenait visible ?',
  'Et si la Lune s’éloignait d’un mètre par an ?',
  'Et si le silence durait une heure par jour ?',
];

const FORMAT_LABEL: Record<Format, { title: string; sub: string; soon?: boolean }> = {
  '16:9': { title: '16:9', sub: 'YouTube, site, présentation' },
  '9:16': { title: '9:16', sub: 'Reels, TikTok, Shorts', soon: true },
  '1:1': { title: '1:1', sub: 'Feed, carrousel', soon: true },
};

const DURATION_LABEL: Record<Duration, string> = {
  15: '15 s · flash',
  24: '24 s · court',
  30: '30 s · standard',
  45: '45 s · long',
  60: '60 s · max',
};

const WORLD_LABEL: Record<World, { title: string; sub: string }> = {
  urbain: { title: 'Nuit urbaine', sub: 'toits, escaliers, néons' },
  maison: { title: 'Maison', sub: 'cuisine, chambre, bureau' },
  ecole: { title: 'École', sub: 'classe, étude, couloir' },
  cosmos: { title: 'Cosmos', sub: 'schémas, toits, nuit' },
};

const NARRATION_LABEL: Record<Narration, { title: string; sub: string }> = {
  conteur: { title: 'Conteur', sub: 'on raconte, images concrètes' },
  prof: { title: 'Prof', sub: 'tu expliques, analogies simples' },
  pote: { title: 'Pote', sub: 'tu tutoies, humour sec' },
};

const TONE_LABEL: Record<Tone, { title: string; sub: string }> = {
  playful: { title: 'Léger', sub: 'curieux, un peu absurde' },
  tense: { title: 'Tendu', sub: 'cordes graves, inquiétude' },
  warm: { title: 'Chaleureux', sub: 'petit, optimiste' },
};

const RHYTHM_LABEL: Record<Rhythm, { title: string; sub: string }> = {
  pose: { title: 'Posé', sub: '6 à 10 plans' },
  standard: { title: 'Standard', sub: '8 à 16 plans' },
  nerveux: { title: 'Nerveux', sub: '12 à 18 plans' },
};

const CAPTION_LABEL: Record<Captions, { title: string; sub: string; soon?: boolean }> = {
  none: { title: 'Aucun', sub: 'la voix seule' },
  bloc: { title: 'Bloc', sub: 'phrases posées en bas', soon: true },
  mot: { title: 'Mot à mot', sub: 'un mot à la fois', soon: true },
  karaoke: { title: 'Karaoké', sub: 'le mot dit s’allume', soon: true },
};

const STEPS = ['Sujet', 'Réglages', 'Script', 'Récap'];

const RENDER_COST_MICROS = 40_000;

const euros = (micros: number): string => (micros / 1_000_000).toFixed(2).replace('.', ',') + ' €';

const post = async <T,>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; note?: string }> => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, status: res.status, note: typeof data.note === 'string' ? data.note : undefined };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0 };
  }
};

const errorText = (r: { status: number; note?: string }, what: string): string => {
  if (r.status === 0) return 'Connexion impossible. Réessayez.';
  if (r.status === 401) return 'Session expirée : reconnectez-vous.';
  if (r.status === 503) return 'Aucun modèle de langage configuré côté serveur.';
  if (r.status === 400) return what;
  if (r.status === 502) return `Le studio a échoué${r.note ? ` (${r.note.slice(0, 140)})` : ''}. Réessayez.`;
  return `Erreur ${r.status}.`;
};

export const NewFilm = ({ balanceMicros }: { balanceMicros: number }): React.ReactElement => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [suggestion, setSuggestion] = useState(0);
  const [settings, setSettings] = useState<ProjectSettings>(() => resolveSettings({ voiceId: VOICES[0].id }));
  const [script, setScript] = useState<Script | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState<'' | 'script' | 'rewrite' | 'generate'>('');
  const [error, setError] = useState('');
  const [variantsFor, setVariantsFor] = useState<number | null>(null);
  const [variants, setVariants] = useState<string[]>([]);

  const set = <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]): void =>
    setSettings((s) => ({ ...s, [key]: value }));

  const chars = useMemo(() => (script ? script.script.reduce((n, b) => n + b.text.length, 0) : 0), [script]);
  const budget = Math.round(settings.durationS * 8.5);
  const over = chars > budget * 1.25;
  const voice = VOICES.find((v) => v.id === settings.voiceId) ?? VOICES[0];

  const draft = async (): Promise<void> => {
    setStep(2);
    setBusy('script');
    setError('');
    setVariantsFor(null);
    const r = await post<{ script: Script }>('/api/episodes/script', { topic, settings });
    setBusy('');
    if (!r.ok) {
      setError(errorText(r, 'Sujet trop court (8 caractères minimum).'));
      return;
    }
    setScript(r.data.script);
    setLocked(false);
  };

  const rewrite = async (i: number): Promise<void> => {
    if (!script) return;
    setBusy('rewrite');
    setError('');
    setVariantsFor(i);
    setVariants([]);
    const r = await post<{ variants: string[] }>('/api/episodes/rewrite', {
      text: script.script[i].text,
      topic,
      instruction: script.script[i].beat,
      settings,
    });
    setBusy('');
    if (!r.ok) {
      setError(errorText(r, 'Texte trop court.'));
      setVariantsFor(null);
      return;
    }
    setVariants(r.data.variants);
  };

  const editBeat = (i: number, text: string): void => {
    setScript((s) => {
      if (!s) return s;
      const next = s.script.map((b, j) => (j === i ? { ...b, text } : b));
      return { ...s, script: next };
    });
  };

  const removeBeat = (i: number): void => {
    setScript((s) => (s && s.script.length > 4 ? { ...s, script: s.script.filter((_, j) => j !== i) } : s));
    setVariantsFor(null);
  };

  const moveBeat = (i: number, dir: -1 | 1): void => {
    setScript((s) => {
      if (!s) return s;
      const j = i + dir;
      if (j < 0 || j >= s.script.length) return s;
      const next = [...s.script];
      const a = next[i];
      next[i] = next[j];
      next[j] = a;
      return { ...s, script: next };
    });
    setVariantsFor(null);
  };

  const addBeat = (): void => {
    setScript((s) => (s && s.script.length < 12 ? { ...s, script: [...s.script, { beat: 'evidence', text: '' }] } : s));
  };

  const generate = async (): Promise<void> => {
    if (!script) return;
    setBusy('generate');
    setError('');
    const r = await post<{ id: string }>('/api/episodes/generate', { topic, settings, script });
    if (!r.ok) {
      setBusy('');
      setError(errorText(r, 'Script refusé par le studio.'));
      return;
    }
    router.push(`/episodes/${r.data.id}`);
  };

  const canJump = (n: number): boolean => n < step || (n === 2 && script !== null);

  return (
    <div className="wizard">
      <nav className="stepper" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className="stepper__item"
            data-on={i === step}
            data-done={canJump(i) && i !== step}
            onClick={() => (canJump(i) ? setStep(i) : undefined)}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="stepper__num">{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="status" data-busy={busy !== ''} style={{ marginBottom: '1rem' }}>
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <section className="card card--pad wizard__panel">
          <div className="wizard__head">
            <span className="eyebrow">Nouveau film</span>
            <h1 className="wizard__title">Et si… ?</h1>
            <p className="note">Une phrase suffit. Le studio en tire un angle, un ton et une durée.</p>
          </div>
          <div className="field">
            <label htmlFor="topic" className="field__label">
              Votre hypothèse
            </label>
            <textarea
              id="topic"
              className="textarea"
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Et si le pain tombait du ciel ?"
              autoFocus
            />
          </div>
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                const next = SUGGESTIONS[suggestion % SUGGESTIONS.length];
                setTopic(next);
                setSuggestion((n) => n + 1);
              }}
            >
              Surprends-moi
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--primary"
              disabled={topic.trim().length < 8}
              onClick={() => setStep(1)}
            >
              Continuer
              <ArrowIcon />
            </button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="card card--pad wizard__panel">
          <div className="wizard__head">
            <span className="eyebrow">Réglages</span>
            <h1 className="wizard__title">Comment on le raconte</h1>
            <p className="note">Tout a une valeur par défaut. Vous pouvez tout changer plus tard.</p>
          </div>

          <div className="fieldset">
            <div className="fieldset__head">
              <span className="fieldset__label">Format</span>
              <span className="fieldset__hint">le vertical arrive bientôt</span>
            </div>
            <div className="choice-grid">
              {FORMATS.map((f) => {
                const meta = FORMAT_LABEL[f];
                return (
                  <button
                    key={f}
                    type="button"
                    className="choice"
                    data-on={settings.format === f}
                    disabled={meta.soon}
                    onClick={() => set('format', f)}
                    aria-pressed={settings.format === f}
                  >
                    <span className="choice__title">{meta.title}</span>
                    <span className="choice__sub">{meta.sub}</span>
                    {meta.soon ? <span className="choice__tag">Bientôt</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__head">
              <span className="fieldset__label">Durée</span>
              <span className="fieldset__hint">≈ {budget} caractères de script</span>
            </div>
            <div className="choice-grid">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="choice"
                  data-on={settings.durationS === d}
                  onClick={() => set('durationS', d)}
                  aria-pressed={settings.durationS === d}
                >
                  <span className="choice__title">{DURATION_LABEL[d]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__head">
              <span className="fieldset__label">Monde visuel</span>
              <span className="fieldset__hint">décors autorisés pour le storyboard</span>
            </div>
            <div className="choice-grid">
              {WORLDS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className="choice"
                  data-on={settings.world === w}
                  onClick={() => set('world', w)}
                  aria-pressed={settings.world === w}
                >
                  <span className="choice__title">{WORLD_LABEL[w].title}</span>
                  <span className="choice__sub">{WORLD_LABEL[w].sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__head">
              <span className="fieldset__label">Voix</span>
              <span className="fieldset__hint">français, synthèse Cartesia</span>
            </div>
            <div className="choice-grid">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="choice"
                  data-on={settings.voiceId === v.id}
                  onClick={() => set('voiceId', v.id)}
                  aria-pressed={settings.voiceId === v.id}
                >
                  <span className="choice__title">{v.name}</span>
                  <span className="choice__sub">{v.tagline}</span>
                  <span className="choice__tag">{v.accent}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__head">
              <span className="fieldset__label">Narration</span>
            </div>
            <div className="choice-grid">
              {NARRATIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="choice"
                  data-on={settings.narration === n}
                  onClick={() => set('narration', n)}
                  aria-pressed={settings.narration === n}
                >
                  <span className="choice__title">{NARRATION_LABEL[n].title}</span>
                  <span className="choice__sub">{NARRATION_LABEL[n].sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__head">
              <span className="fieldset__label">Ton</span>
              <span className="fieldset__hint">pilote le script et la musique</span>
            </div>
            <div className="choice-grid">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="choice"
                  data-on={settings.tone === t}
                  onClick={() => set('tone', t)}
                  aria-pressed={settings.tone === t}
                >
                  <span className="choice__title">{TONE_LABEL[t].title}</span>
                  <span className="choice__sub">{TONE_LABEL[t].sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__head">
              <span className="fieldset__label">Rythme de montage</span>
            </div>
            <div className="choice-grid">
              {RHYTHMS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="choice"
                  data-on={settings.rhythm === r}
                  onClick={() => set('rhythm', r)}
                  aria-pressed={settings.rhythm === r}
                >
                  <span className="choice__title">{RHYTHM_LABEL[r].title}</span>
                  <span className="choice__sub">{RHYTHM_LABEL[r].sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fieldset">
            <div className="fieldset__head">
              <span className="fieldset__label">Sous-titres</span>
              <span className="fieldset__hint">moteur en préparation</span>
            </div>
            <div className="choice-grid">
              {CAPTIONS.map((c) => {
                const meta = CAPTION_LABEL[c];
                return (
                  <button
                    key={c}
                    type="button"
                    className="choice"
                    data-on={settings.captions === c}
                    disabled={meta.soon}
                    onClick={() => set('captions', c)}
                    aria-pressed={settings.captions === c}
                  >
                    <span className="choice__title">{meta.title}</span>
                    <span className="choice__sub">{meta.sub}</span>
                    {meta.soon ? <span className="choice__tag">Bientôt</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="wizard__nav">
            <button type="button" className="btn btn--ghost" onClick={() => setStep(0)}>
              Retour
            </button>
            <span className="spacer" />
            <button type="button" className="btn btn--primary" onClick={() => void draft()}>
              Écrire le script
              <ArrowIcon />
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="card card--pad wizard__panel">
          {busy === 'script' ? (
            <div className="wizard__head" style={{ padding: '2.5rem 0', textAlign: 'center' }}>
              <span className="eyebrow">Écriture</span>
              <h1 className="wizard__title">
                <span className="spin" />
                Le studio écrit les beats…
              </h1>
              <p className="note">Une dizaine de secondes. Le storyboard vient après votre validation.</p>
            </div>
          ) : script ? (
            <>
              <div className="wizard__head">
                <span className="eyebrow">Script</span>
                <h1 className="wizard__title">{script.title.join(' / ')}</h1>
                <p className="note">
                  Relisez, coupez, reformulez. Rien n’est mis en scène avant votre validation.
                </p>
              </div>

              <div className="budget" data-over={over}>
                <div className="budget__line">
                  <span>
                    {chars} / {budget} caractères
                  </span>
                  <span className="spacer" />
                  <span className="mono faint">
                    {script.script.length} beats · ≈ {Math.round(chars / 8.5)} s
                  </span>
                </div>
                <div className="budget__bar">
                  <div className="budget__fill" style={{ width: `${Math.min(100, (chars / budget) * 100)}%` }} />
                </div>
              </div>

              <div className="beats">
                {script.script.map((b, i) => (
                  <article className="beat" key={`${b.beat}-${i}`} data-locked={locked}>
                    <div className="beat__head">
                      <span className="beat__n">{String(i + 1).padStart(2, '0')}</span>
                      <span className="beat__role">{b.beat}</span>
                      <span className="spacer" />
                      <span className="beat__count">{b.text.length} c.</span>
                      {locked ? null : (
                        <div className="beat__actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={busy === 'rewrite'}
                            onClick={() => void rewrite(i)}
                          >
                            Reformuler
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={i === 0}
                            onClick={() => moveBeat(i, -1)}
                            aria-label="Monter le beat"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={i === script.script.length - 1}
                            onClick={() => moveBeat(i, 1)}
                            aria-label="Descendre le beat"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={script.script.length <= 4}
                            onClick={() => removeBeat(i)}
                            aria-label="Supprimer le beat"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                    <textarea
                      className="textarea"
                      rows={2}
                      value={b.text}
                      readOnly={locked}
                      onChange={(e) => editBeat(i, e.target.value)}
                      aria-label={`Texte du beat ${i + 1}`}
                    />
                    {variantsFor === i && !locked ? (
                      <div className="beat__variants">
                        {busy === 'rewrite' ? (
                          <span className="note">
                            <span className="spin" />
                            Trois variantes…
                          </span>
                        ) : (
                          variants.map((v) => (
                            <button
                              key={v}
                              type="button"
                              className="variant"
                              onClick={() => {
                                editBeat(i, v);
                                setVariantsFor(null);
                              }}
                            >
                              {v}
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              {locked ? null : (
                <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={script.script.length >= 12}
                    onClick={addBeat}
                  >
                    + Ajouter un beat
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busy !== ''} onClick={() => void draft()}>
                    Régénérer tout
                  </button>
                </div>
              )}

              <div className="wizard__nav">
                <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>
                  Réglages
                </button>
                <span className="spacer" />
                {locked ? (
                  <button type="button" className="btn btn--primary" onClick={() => setStep(3)}>
                    Continuer
                    <ArrowIcon />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={chars < 40 || script.script.some((b) => b.text.trim().length === 0)}
                    onClick={() => setLocked(true)}
                  >
                    Valider le script
                    <ArrowIcon />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="empty">
              <span className="eyebrow">Script vide</span>
              <p className="lede" style={{ textAlign: 'center' }}>
                Le script n’a pas pu être écrit.
              </p>
              <button type="button" className="btn btn--primary" onClick={() => void draft()}>
                Réessayer
              </button>
            </div>
          )}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="card card--pad wizard__panel">
          <div className="wizard__head">
            <span className="eyebrow">Récapitulatif</span>
            <h1 className="wizard__title">Tout est prêt</h1>
            <p className="note">Vérifiez, puis lancez la mise en scène et la voix.</p>
          </div>

          <div className="recap">
            <div className="recap__row">
              <span className="recap__k">Sujet</span>
              <span className="recap__v">{topic}</span>
              <button type="button" className="recap__edit" onClick={() => setStep(0)}>
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Format</span>
              <span className="recap__v">
                {settings.format} · {FORMAT_LABEL[settings.format].sub}
              </span>
              <button type="button" className="recap__edit" onClick={() => setStep(1)}>
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Durée</span>
              <span className="recap__v">{DURATION_LABEL[settings.durationS as Duration] ?? `${settings.durationS} s`}</span>
              <button type="button" className="recap__edit" onClick={() => setStep(1)}>
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Monde</span>
              <span className="recap__v">{WORLD_LABEL[settings.world].title}</span>
              <button type="button" className="recap__edit" onClick={() => setStep(1)}>
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Voix</span>
              <span className="recap__v">
                {voice.name} · {voice.tagline}
              </span>
              <button type="button" className="recap__edit" onClick={() => setStep(1)}>
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Narration</span>
              <span className="recap__v">{NARRATION_LABEL[settings.narration].title}</span>
              <button type="button" className="recap__edit" onClick={() => setStep(1)}>
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Ton · rythme</span>
              <span className="recap__v">
                {TONE_LABEL[settings.tone].title} · {RHYTHM_LABEL[settings.rhythm].title}
              </span>
              <button type="button" className="recap__edit" onClick={() => setStep(1)}>
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Sous-titres</span>
              <span className="recap__v">{CAPTION_LABEL[settings.captions].title}</span>
              <button type="button" className="recap__edit" onClick={() => setStep(1)}>
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Script</span>
              <span className="recap__v">
                {script?.script.length ?? 0} beats · {chars} caractères · ≈ {Math.round(chars / 8.5)} s
              </span>
              <button
                type="button"
                className="recap__edit"
                onClick={() => {
                  setLocked(false);
                  setStep(2);
                }}
              >
                Modifier
              </button>
            </div>
            <div className="recap__row">
              <span className="recap__k">Rendu</span>
              <span className="recap__v">
                {euros(RENDER_COST_MICROS)} prélevés à l’export · solde {euros(balanceMicros)}
              </span>
              <span />
            </div>
          </div>

          <div className="wizard__nav">
            <button type="button" className="btn btn--ghost" onClick={() => setStep(2)}>
              Retour
            </button>
            <span className="spacer" />
            <Link className="btn btn--ghost" href="/app">
              Annuler
            </Link>
            <button type="button" className="btn btn--primary btn--lg" disabled={busy === 'generate'} onClick={() => void generate()}>
              {busy === 'generate' ? (
                <>
                  <span className="spin" />
                  Mise en scène…
                </>
              ) : (
                <>
                  Générer le film
                  <ArrowIcon />
                </>
              )}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
};
