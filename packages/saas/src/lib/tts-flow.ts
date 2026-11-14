import type { Words } from '@what-if/engine/schema';

// Beat stitching: each beat is synthesized on its own 0 clock (the provider has no
// cross-beat view), then re-anchored onto one global timeline with a small breath
// between beats. Returns the global word track and each beat's start offset.
//
// beatDurations are the measured audio lengths (seconds). When they are known
// they drive the offsets, so the words stay aligned with the audio that is
// actually played - the last word's end is often earlier than the audio (trailing
// silence) and using it would drift every following beat.

export const BEAT_GAP_S = 0.25;

export const stitchBeats = (
  beatWords: Words[],
  gapS = BEAT_GAP_S,
  beatDurations?: number[],
): { words: Words; offsets: number[] } => {
  const words: Words = [];
  const offsets: number[] = [];
  let at = 0;
  for (const [index, beat] of beatWords.entries()) {
    offsets.push(at);
    const measured = beatDurations?.[index];
    const spoken = beat.length > 0 ? beat[beat.length - 1].e : 0;
    const beatLen = typeof measured === 'number' && measured > 0 ? measured : spoken;
    for (const w of beat) {
      words.push({ ...w, s: at + w.s, e: at + w.e });
    }
    at = beatLen > 0 ? at + beatLen + gapS : at;
  }
  return { words, offsets };
};

export const episodeText = (script: { text: string }[]): string => script.map((b) => b.text.trim()).join(' ');
