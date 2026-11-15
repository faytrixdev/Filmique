import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import { clamp, lerp } from './anim';
import { CaptionOverlay, type CaptionMode } from './captions';
import { KitDefs } from './kit';
import { SetDefs } from './light';
import type { Words } from './schema';
import { FORMAT_DIMS, type Format } from './settings';
import type { ThemeDef } from './theme';

/** Shots are drawn in one 1920x1080 world; the format only changes the window. */
export const WORLD_W = 1920;
export const WORLD_H = 1080;

/** Cover transform: the world scaled to fill a w x h canvas, cropped around a
 * focal point (0 = left edge, 0.5 = centre, 1 = right edge). */
export const coverTransform = (w: number, h: number, focal = 0.5): { scale: number; x: number; y: number } => {
  const scale = Math.max(w / WORLD_W, h / WORLD_H);
  return { scale, x: (w - WORLD_W * scale) * focal, y: (h - WORLD_H * scale) * 0.5 };
};

/** Where the storyboard said the subject sits, as a crop focal (default: centre). */
export const focalOf = (f?: string): number => (f === 'gauche' ? 0.28 : f === 'droite' ? 0.72 : 0.5);

/** Media sources: local files go through staticFile(), remote URLs (TTS audio
 * served by the API) are passed through untouched - staticFile rejects them. */
export const mediaSrc = (src: string): string =>
  /^https?:\/\//.test(src) ? src : staticFile(src);

// The episode engine. An episode is a set of shots plus a timeline (written by scripts/plan.py from the voice's word
// timings). Each shot is a pure function of its own clock t, so the edit can cut back to a shot, hold it, or play it
// backwards: a segment just says which stretch of the shot's clock it shows.

export type Seg = {
  shot: string; // shot id (S1, S2...)
  a: number; // first global frame
  b: number; // first frame after it
  t0: number; // the shot's clock at a
  t1: number; // the shot's clock at b (smaller than t0 when the segment plays backwards)
  look?: string; // a named power look (rewind, freeze...) the episode defines: grade + overlay while it runs
  line?: string; // the words spoken over it (for the storyboard)
};
export type ShotInfo = { id: string; size: string; key: number; len: number; first: number; line?: string; note?: string; focal?: string };
export type Fx = { f: number; kind: 'flash' | 'shake'; color?: string; o?: number; len?: number; amp?: number };
export type Timeline = {
  slug: string;
  title: string;
  fps: number;
  total: number;
  segments: Seg[];
  shots: ShotInfo[];
  fx: Fx[];
  audio: { voice?: string; sfx?: string; music?: string; voiceVol?: number; sfxVol?: number; musicVol?: number };
};

/** What every shot receives: its own clock t, how long its clock runs (len), and the global frame f. */
export type ShotProps = { t: number; len: number; f: number };
export type ShotMap = Record<string, React.FC<ShotProps>>;

/** A power look: a CSS grade on the picture and an overlay on top while segments with this look run. */
export type LookDef = {
  grade?: (lv: number) => string;
  jitter?: number; // sideways picture jitter in px at full strength
  Overlay?: React.FC<{ f: number; lv: number; p: number; n: number }>; // p: progress through this run, n: which run (0, 1, 2...)
};

const segAt = (tl: Timeline, f: number) => tl.segments.find((s) => f >= s.a && f < s.b) ?? tl.segments[tl.segments.length - 1];
const clockAt = (s: Seg, f: number) => (s.t1 - s.t0 === s.b - s.a ? s.t0 + (f - s.a) : lerp(s.t0, s.t1, (f - s.a) / (s.b - s.a)));

/** Runs of neighbouring segments sharing a look, so a look spanning two shots doesn't blink at the cut. */
const lookRuns = (tl: Timeline) => {
  const runs: { look: string; a: number; b: number; n: number }[] = [];
  const count: Record<string, number> = {};
  for (const s of tl.segments) {
    if (!s.look) continue;
    const last = runs[runs.length - 1];
    if (last && last.look === s.look && last.b === s.a) last.b = s.b;
    else {
      runs.push({ look: s.look, a: s.a, b: s.b, n: count[s.look] ?? 0 });
      count[s.look] = (count[s.look] ?? 0) + 1;
    }
  }
  return runs;
};

const fxAt = (tl: Timeline, f: number) => {
  let flash: { color: string; o: number } | null = null;
  let x = 0;
  let y = 0;
  for (const e of tl.fx) {
    if (e.kind === 'flash') {
      if (f === e.f) flash = { color: e.color ?? '#FFFFFF', o: e.o ?? 0.85 };
      else if (f === e.f + 1) flash = { color: e.color ?? '#FFFFFF', o: (e.o ?? 0.85) * 0.35 };
    } else if (e.kind === 'shake') {
      const len = e.len ?? 8;
      const amp = e.amp ?? 12;
      if (f >= e.f && f < e.f + len) {
        const k = amp * (1 - (f - e.f) / len);
        x += Math.sin(f * 2.9) * k;
        y += Math.cos(f * 3.7) * k * 0.7;
      }
    }
  }
  return { flash, x, y };
};

/** Vignette and a fine grain that changes on twos, to take the vector edge off (the genre's finish). */
const Grade: React.FC<{
  f: number;
  grain: boolean;
  vignette: boolean;
  grainAmount?: number;
  vignetteAmount?: number;
  w: number;
  h: number;
}> = ({ f, grain, vignette, grainAmount = 0.06, vignetteAmount = 0.55, w, h }) => (
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <defs>
      <radialGradient id="epVig" cx="50%" cy="50%" r="75%">
        <stop offset="55%" stopColor="#000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000" stopOpacity={vignetteAmount} />
      </radialGradient>
      <filter id="epGrain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(f / 2) % 97} />
        <feColorMatrix type="matrix" values={`0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${grainAmount} 0`} />
      </filter>
    </defs>
    {vignette ? <rect width={w} height={h} fill="url(#epVig)" /> : null}
    {grain ? <rect width={w} height={h} filter="url(#epGrain)" /> : null}
  </svg>
);

/** The theme's light wash: two colours laid over the picture, soft-light so the
 * drawing keeps its contrast and only changes temperature. */
const Wash: React.FC<{ theme: ThemeDef; w: number; h: number }> = ({ theme, w, h }) => {
  const wash = theme.wash;
  if (!wash) return null;
  const id = `epWash-${theme.id}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={wash.top} />
          <stop offset="100%" stopColor={wash.bottom} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id})`} opacity={wash.alpha} style={{ mixBlendMode: 'soft-light' }} />
    </svg>
  );
};

/** One shot drawn in the shared defs (filters, gradients), in a 1920 x 1080 world. */
export const ShotFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={WORLD_W} height={WORLD_H} viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}>
    <KitDefs />
    <SetDefs />
    {children}
  </svg>
);

/** The picture filter: the theme's grade, then the power look's grade on top. */
export const pictureFilter = (theme: ThemeDef | undefined, lookGrade?: string): string =>
  [theme?.grade, lookGrade].filter(Boolean).join(' ');

/** The drawing world, scaled to cover the canvas: a 9:16 or 1:1 film is a
 * centred crop of the same staging, never a squashed 16:9 frame. */
const World: React.FC<{ w: number; h: number; focal?: number; children: React.ReactNode }> = ({ w, h, focal = 0.5, children }) => {
  const c = coverTransform(w, h, focal);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: WORLD_W,
        height: WORLD_H,
        transform: `translate(${c.x}px, ${c.y}px) scale(${c.scale})`,
        transformOrigin: '0 0',
      }}
    >
      {children}
    </div>
  );
};

export type EpisodeProps = {
  timeline: Timeline;
  shots: ShotMap;
  looks?: Record<string, LookDef>;
  grain?: boolean;
  vignette?: boolean;
  bg?: string;
  theme?: ThemeDef;
  format?: Format;
  captions?: CaptionMode | 'none';
  words?: Words;
};

export const Episode: React.FC<EpisodeProps> = ({
  timeline: tl,
  shots,
  looks = {},
  grain = true,
  vignette = true,
  bg,
  theme,
  format = '16:9',
  captions = 'none',
  words,
}) => {
  const f = useCurrentFrame();
  const seg = segAt(tl, f);
  const Shot = shots[seg.shot];
  const info = tl.shots.find((s) => s.id === seg.shot);
  const run = lookRuns(tl).find((r) => f >= r.a && f < r.b);
  const def = run ? looks[run.look] : undefined;
  const lv = run ? Math.min(clamp((f - run.a + 1) / 2), clamp((run.b - f) / 2)) : 0;
  const jitter = def?.jitter && lv > 0 ? Math.sin(f * 13.7) * def.jitter * lv : 0;
  const { flash, x, y } = fxAt(tl, f);
  const A = tl.audio;
  const stageBg = theme?.bg ?? bg ?? '#0E0C1E';
  const filters = pictureFilter(theme, def?.grade && lv > 0 ? def.grade(lv) : undefined);
  const [W, H] = FORMAT_DIMS[format];
  return (
    <AbsoluteFill style={{ backgroundColor: stageBg }}>
      <AbsoluteFill style={{ transform: `translate(${x + jitter}px, ${y}px) scale(${x || y ? 1.02 : 1})`, filter: filters || undefined }}>
        <World w={W} h={H} focal={focalOf(info?.focal)}>
          <ShotFrame>{Shot ? <Shot t={clockAt(seg, f)} len={info?.len ?? seg.b - seg.a} f={f} /> : null}</ShotFrame>
          {def?.Overlay && run ? (
            <svg
              width={WORLD_W}
              height={WORLD_H}
              viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
              style={{ position: 'absolute', inset: 0, opacity: lv }}
            >
              <def.Overlay f={f} lv={lv} p={clamp((f - run.a) / (run.b - run.a))} n={run.n} />
            </svg>
          ) : null}
        </World>
      </AbsoluteFill>
      {theme ? <Wash theme={theme} w={W} h={H} /> : null}
      <Grade f={f} grain={grain} vignette={vignette} grainAmount={theme?.grain} vignetteAmount={theme?.vignette} w={W} h={H} />
      {captions !== 'none' && words && words.length > 0 ? (
        <CaptionOverlay words={words} mode={captions} fps={tl.fps} width={W} height={H} accent={theme?.accent} />
      ) : null}
      {flash ? <AbsoluteFill style={{ backgroundColor: flash.color, opacity: flash.o }} /> : null}
      {A.voice ? <Audio src={mediaSrc(A.voice)} volume={A.voiceVol ?? 1} /> : null}
      {A.sfx ? <Audio src={mediaSrc(A.sfx)} volume={A.sfxVol ?? 1} /> : null}
      {A.music ? <Audio src={mediaSrc(A.music)} volume={A.musicVol ?? 1} /> : null}
    </AbsoluteFill>
  );
};

/** The storyboard: frame i is shot i at its key frame, no audio, no look. Render it with scripts/stills.mjs. */
export const Board: React.FC<{
  timeline: Timeline;
  shots: ShotMap;
  grain?: boolean;
  vignette?: boolean;
  bg?: string;
  theme?: ThemeDef;
  format?: Format;
}> = ({ timeline: tl, shots, grain = true, vignette = true, bg, theme, format = '16:9' }) => {
  const f = useCurrentFrame();
  const info = tl.shots[Math.min(f, tl.shots.length - 1)];
  const Shot = shots[info.id];
  const [W, H] = FORMAT_DIMS[format];
  return (
    <AbsoluteFill style={{ backgroundColor: theme?.bg ?? bg ?? '#0E0C1E' }}>
      <AbsoluteFill style={{ filter: theme?.grade || undefined }}>
        <World w={W} h={H} focal={focalOf(info.focal)}>
          <ShotFrame>{Shot ? <Shot t={info.key} len={info.len} f={info.first + info.key} /> : null}</ShotFrame>
        </World>
      </AbsoluteFill>
      {theme ? <Wash theme={theme} w={W} h={H} /> : null}
      <Grade f={info.key} grain={grain} vignette={vignette} grainAmount={theme?.grain} vignetteAmount={theme?.vignette} w={W} h={H} />
    </AbsoluteFill>
  );
};

/** Bundle an episode for the registry: the main composition and its storyboard. */
export const defineEpisode = (id: string, p: EpisodeProps) => ({
  id,
  total: p.timeline.total,
  shotCount: p.timeline.shots.length,
  Main: () => <Episode {...p} />,
  Board: () => (
    <Board timeline={p.timeline} shots={p.shots} grain={p.grain} vignette={p.vignette} bg={p.bg} theme={p.theme} format={p.format} />
  ),
});
export type EpisodeDef = ReturnType<typeof defineEpisode>;
