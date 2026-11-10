import type { Words } from '@what-if/engine/schema';

// TTS-less demo word track: every script token lands at a fixed 0.35 s cadence.
// Deterministic, so composeTimeline resolves every edit anchor the same way every
// run — until a real Cartesia synthesize replaces it (Task 12 step 2: re-TTS).

const WORD_MS = 350;

const clean = (token: string): string | null => {
  const w = token.replace(/[^\p{L}\p{N}'’-]/gu, '');
  return w || null;
};

export const synthWords = (beats: { text: string }[]): Words => {
  const rawTokens = beats.flatMap((b) => b.text.trim().split(/\s+/).filter(Boolean));
  const tokens = rawTokens.map(clean).filter((t): t is string => t !== null);
  return tokens.map((w, i) => ({ w, s: i * (WORD_MS / 1000), e: (i + 1) * (WORD_MS / 1000), p: '' }));
};
