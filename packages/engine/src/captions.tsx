import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { clamp } from './anim';
import { FONT } from './font-faces';
import type { Words } from './schema';

// Captions ride on the voice's word track (words.json from the TTS pass, or the
// deterministic demo cadence before it exists). Three modes, all drawn in canvas
// space on top of the picture so a format crop never eats them:
//   bloc    - whole phrases, the quiet social default
//   mot     - one word at a time, big and centred
//   karaoke - the phrase stays, the spoken word lights up
// Grouping is pure and frame-based, so a render is identical on every machine.

export type CaptionMode = 'bloc' | 'mot' | 'karaoke';

export type CaptionWord = { w: string; p?: string; sf: number; ef: number };
export type CaptionLine = { a: number; b: number; words: CaptionWord[] };

const ENDS_PHRASE = /[.!?…:;]$/;

const wordEndsPhrase = (w: { w: string; p?: string }): boolean =>
  ENDS_PHRASE.test((w.p ?? '').trim()) || ENDS_PHRASE.test(w.w);

/** Groups words into readable lines: end of sentence, or a length/time budget. */
export const captionLines = (
  words: Words,
  opts: { fps: number; maxChars?: number; maxS?: number },
): CaptionLine[] => {
  const fps = opts.fps;
  const maxChars = opts.maxChars ?? 34;
  const maxS = opts.maxS ?? 3.4;
  const lines: CaptionLine[] = [];
  let cur: CaptionWord[] = [];
  const flush = (): void => {
    if (cur.length === 0) return;
    const last = cur[cur.length - 1];
    lines.push({ a: cur[0].sf, b: Math.round(last.ef + 0.25 * fps), words: cur });
    cur = [];
  };
  for (const w of words) {
    const sf = Math.round(w.s * fps);
    const ef = Math.max(sf + 1, Math.round(w.e * fps));
    cur.push({ w: w.w, p: w.p, sf, ef });
    const chars = cur.reduce((n, x) => n + x.w.length + 1, 0);
    const span = ef - cur[0].sf;
    if (wordEndsPhrase(w) || chars >= maxChars || span >= maxS * fps) flush();
  }
  flush();
  return lines;
};

/** The line on screen at frame f, plus the word being spoken (or the last one). */
export const captionAt = (lines: CaptionLine[], f: number): { line: CaptionLine; index: number } | null => {
  for (const line of lines) {
    if (f < line.a || f >= line.b) continue;
    let index = 0;
    for (let i = 0; i < line.words.length; i++) {
      if (line.words[i].sf <= f) index = i;
    }
    return { line, index };
  }
  return null;
};

const cubicOut = (p: number): number => 1 - Math.pow(1 - p, 3);

export type CaptionsProps = {
  words: Words;
  mode: CaptionMode;
  fps: number;
  width: number;
  height: number;
  accent?: string;
};

export const CaptionOverlay: React.FC<CaptionsProps> = ({ words, mode, fps, width, height, accent = '#FFD166' }) => {
  const f = useCurrentFrame();
  const lines = React.useMemo(() => captionLines(words, { fps }), [words, fps]);
  const hit = captionAt(lines, f);
  if (!hit) return null;

  const { line, index } = hit;
  const fin = clamp((f - line.a + 1) / 4);
  const fout = clamp((line.b - f) / 4);
  const op = Math.min(fin, fout);
  const rise = (1 - cubicOut(fin)) * 20;

  const unit = Math.min(width, height);
  const size = Math.round(unit * (mode === 'mot' ? 0.08 : 0.054));
  const pad = Math.round(unit * 0.02);
  const bottom = Math.round(height * (height > width ? 0.17 : 0.075));
  const pop = mode === 'mot' ? 1 + (1 - cubicOut(fin)) * 0.06 : 1;

  const shown = mode === 'mot' ? [line.words[index]] : line.words;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: bottom, opacity: op }}>
      <div
        style={{
          transform: `translateY(${rise}px) scale(${pop})`,
          maxWidth: '86%',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'baseline',
          columnGap: `${Math.round(size * 0.28)}px`,
          rowGap: `${Math.round(size * 0.1)}px`,
          padding: `${pad}px ${Math.round(pad * 1.35)}px`,
          borderRadius: Math.round(pad * 0.85),
          background: 'rgba(8,7,16,0.55)',
          boxShadow: '0 12px 44px rgba(0,0,0,0.35)',
          fontFamily: FONT.title,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.14,
          letterSpacing: '-0.01em',
          color: '#FFFFFF',
          textAlign: 'center',
          textShadow: '0 2px 14px rgba(0,0,0,0.55)',
        }}
      >
        {shown.map((w, i) => {
          const at = mode === 'mot' ? 0 : i;
          const spoken = mode === 'karaoke' && at <= index;
          const current = mode === 'karaoke' && at === index;
          return (
            <span
              key={`${w.sf}-${i}`}
              style={{
                color: current ? accent : mode === 'karaoke' && !spoken ? 'rgba(255,255,255,0.5)' : '#FFFFFF',
                transform: current ? 'scale(1.06)' : undefined,
                display: 'inline-block',
              }}
            >
              {w.w}
              {w.p ?? ''}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
