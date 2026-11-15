import React from 'react';
import {
  Episode,
  THEMES,
  THEME_IDS,
  FORMAT_DIMS,
  type Captions,
  type Format,
  type Timeline,
  type Words,
} from '@what-if/engine';
import { S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15 } from './episodes/million16/shots';
import timelineJson from './episodes/million16/timeline.json';

const timeline = timelineJson as Timeline;
const shots = { S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15 };

// One composition per identity, same film, same frame: flip through them and
// the grade is the only thing that changes. Render with:
//   npx remotion still src/index.ts Look-nuit out/look-nuit.png --frame=180
export const LookEpisode: React.FC<{ themeId: string }> = ({ themeId }) => (
  <Episode timeline={timeline} shots={shots} theme={THEMES[themeId as keyof typeof THEMES]} />
);

export const LOOK_IDS = THEME_IDS;

/** The shipped film has no words.json in the bundle: rebuild a word track from the
 * segments' spoken lines so the caption layer can be seen in the studio. */
const wordsFromSegments = (tl: Timeline): Words =>
  tl.segments.flatMap((s) => {
    const ws = (s.line ?? '').split(/\s+/).filter(Boolean);
    const step = (s.b - s.a) / Math.max(1, ws.length);
    return ws.map((w, i) => ({
      w,
      s: (s.a + i * step) / tl.fps,
      e: (s.a + (i + 1) * step) / tl.fps,
      p: '',
    }));
  });

const words = wordsFromSegments(timeline);

type Focal = 'gauche' | 'centre' | 'droite';

// Format playground: same staging, different window, captions on. Render with:
//   npx remotion still src/index.ts Format-vertical out/fmt-vertical.png --frame=180
export const FormatEpisode: React.FC<{ format: Format; captions: Captions; focal?: Focal }> = ({
  format,
  captions,
  focal,
}) => {
  const tl = focal ? { ...timeline, shots: timeline.shots.map((s) => ({ ...s, focal })) } : timeline;
  return <Episode timeline={tl} shots={shots} format={format} captions={captions} words={words} />;
};

export const FORMAT_DEMOS: { id: string; format: Format; captions: Captions; focal?: Focal }[] = [
  { id: 'Format-vertical', format: '9:16', captions: 'karaoke', focal: 'droite' },
  { id: 'Format-square', format: '1:1', captions: 'bloc' },
];

export const formatDims = FORMAT_DIMS;
