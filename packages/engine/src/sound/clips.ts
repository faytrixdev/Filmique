import clipsJson from './clips.json';
import type { EpisodeJson } from '../schema';

export type ClipSpec = readonly [description: string, durationS: number];

/** ~45 pre-validated sound clip descriptions, regrouped from the shipped studio episodes. */
export const CLIPS = clipsJson as unknown as { readonly [name: string]: ClipSpec };

/** Music beds keyed by the episode tone (deterministic pick — no LLM). */
export const MUSIC: Record<string, ClipSpec> = {
  playful: ['playful quirky cartoon background music, pizzicato strings, glockenspiel and soft bass, light and curious, 110 bpm, no vocals', 17],
  tense: ['tense cinematic background music, low pulsing strings, distant piano hits, uneasy but clean, 96 bpm, no vocals', 17],
  warm: ['warm gentle background music, soft ukulele and mallet motifs, hopeful and small, 100 bpm, no vocals', 17],
};

export type ClipName = keyof typeof CLIPS;
export type SoundDraft = EpisodeJson['sound'];
