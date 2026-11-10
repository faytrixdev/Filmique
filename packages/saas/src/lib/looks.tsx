import React from 'react';
import type { LookDef } from '@what-if/engine';
import { Dial, FONT, HudChip, TapeLines } from '@what-if/engine';

// The three golden episodes' power looks, ported from the studio sources
// (rewind/million16/copy-paste index.tsx) so the SaaS player grades like the films.
// LLM-composed episodes may reference looks not defined here — they simply won't grade.

export const REWIND: LookDef = {
  grade: (lv) => `saturate(${1 - 0.45 * lv}) contrast(${1 + 0.1 * lv}) hue-rotate(${-14 * lv}deg)`,
  jitter: 5,
  Overlay: ({ f, p, n }) => {
    const secs = 10 * (1 - p);
    const read = `-${String(Math.floor(secs)).padStart(2, '0')}.${String(Math.floor((secs % 1) * 100)).padStart(2, '0')}`;
    return (
      <g>
        <TapeLines f={f} />
        <HudChip f={f} label="REWIND" icon="rewind" />
        <Dial p={1 - p} readout={read} />
        <text x={1820} y={1010} textAnchor="end" fontFamily={FONT.ui} fontSize={28} fill="#F6EFE3" opacity={0.6}>
          {`TAKE ${n + 2}`}
        </text>
      </g>
    );
  },
};

export const MILLION: LookDef = {
  grade: (lv) => `saturate(${1 + 0.12 * lv}) sepia(${0.14 * lv}) brightness(${1 + 0.05 * lv})`,
  Overlay: ({ f }) => <HudChip f={f} label="MILLION" icon="dot" />,
};

export const COPY: LookDef = {
  grade: (lv) => `saturate(${1 - 0.12 * lv}) hue-rotate(${-8 * lv}deg) brightness(${1 + 0.04 * lv})`,
  Overlay: ({ f }) => <HudChip f={f} label="COPY" icon="copy" />,
};

export const PASTE: LookDef = {
  Overlay: ({ f }) => <HudChip f={f} label="PASTE" icon="paste" />,
};

export const STUDIO_LOOKS: Record<string, LookDef> = { rewind: REWIND, million: MILLION, copy: COPY, paste: PASTE };
