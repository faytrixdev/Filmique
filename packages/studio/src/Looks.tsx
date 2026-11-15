import React from 'react';
import { Episode, THEMES, THEME_IDS, type Timeline } from '@what-if/engine';
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
