import type { Words } from '@what-if/engine/schema';

// Beat stitching: each beat is synthesized on its own 0 clock (the provider has no
// cross-beat view), then re-anchored onto one global timeline with a small breath
// between beats. Returns the global word track and each beat's start offset.

export const BEAT_GAP_S = 0.25;

export const stitchBeats = (
  beatWords: Words[],
  gapS = BEAT_GAP_S,
): { words: Words; offsets: number[] } => {
  const words: Words = [];
  const offsets: number[] = [];
  let at = 0;
  for (const beat of beatWords) {
    offsets.push(at);
    const beatLen = beat.length > 0 ? beat[beat.length - 1].e : 0;
    for (const w of beat) {
      words.push({ ...w, s: at + w.s, e: at + w.e });
    }
    at = beatLen > 0 ? at + beatLen + gapS : at;
  }
  return { words, offsets };
};

export const episodeText = (script: { text: string }[]): string => script.map((b) => b.text.trim()).join(' ');
