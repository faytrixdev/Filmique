import { z } from 'zod';

// An anchor resolves to a moment in the film. Three grammars, all seen in the studio
// episodes: "f:44" (frame), "s:2.82" (seconds, at the shot's own clock resolution),
// "S2+28" / "S2" (shot-relative frame offset, plain "S2" at the shot's first frame).

export const AnchorZ = z.string().regex(/^(f:\d+|s:\d+(\.\d+)?|[Ss]\d+([+-]\d+)?)$/);

export const ScriptBeatZ = z.object({ beat: z.string(), text: z.string() });

export const ScienceZ = z.object({
  claim: z.string(),
  working: z.string(),
  source: z.string(),
});

export const ShotIdZ = z.string().regex(/^S(?:h)?\d+$/);

export const ShotZ = z.object({
  id: ShotIdZ,
  size: z.string(),
  set: z.string(),
  key: z.number().int().positive(),
  note: z.string().optional(),
  archetype: z.string().optional(),
  archetypeProps: z.record(z.string(), z.unknown()).optional(),
});

export const EditZ = z.object({
  shot: ShotIdZ,
  at: z.string(),
  look: z.string().optional(),
  reverse: z.boolean().optional(),
  from: z.number().optional(),
  to: z.number().optional(),
});

export const FxZ = z.discriminatedUnion('kind', [
  z.object({ at: z.string(), kind: z.literal('flash'), color: z.string().optional(), o: z.number().optional() }),
  z.object({ at: z.string(), kind: z.literal('shake'), len: z.number().optional(), amp: z.number().optional() }),
]);

// events rows: [at, clip, gain] then optional tags — "onset"/"peak" plus the anchor
// where the sound ends, e.g. ["f:52", "rewind", 0.55, "onset", "f:80"].
const EventRowZ = z
  .tuple([AnchorZ, z.string(), z.number()])
  .rest(z.union([z.string(), z.number()]))
  .refine((r) => r.length <= 6, { message: 'event rows carry at most 3 parts after gain' });

export const RepeatZ = z.object({
  at: AnchorZ,
  clip: z.string(),
  n: z.number().int().positive(),
  every: z.number().positive(),
  gain: z.tuple([z.number(), z.number()]),
  pitch: z.tuple([z.number(), z.number()]).optional(),
  note: z.string().optional(),
});

export const SoundZ = z.object({
  clips: z.record(z.string(), z.tuple([z.string(), z.number()])),
  events: z.array(EventRowZ),
  repeats: z.array(RepeatZ).default([]),
  music: z.object({
    clip: z.string(),
    until: z.string(),
    reverse_looks: z.array(z.string()).optional(),
  }),
  levels: z.object({ sfx_lu: z.number(), music_lu: z.number() }),
});

export const VoiceSettingsZ = z.object({
  stability: z.number(),
  similarity_boost: z.number(),
  style: z.number().optional(),
  use_speaker_boost: z.boolean().optional(),
});

export const VoiceZ = z.object({
  id: z.string(),
  model: z.string(),
  settings: VoiceSettingsZ,
});

export const PowerZ = z.object({
  word: z.string(),
  rule: z.string(),
  look: z.string(),
});

export const EpisodeJsonZ = z.object({
  id: z.string(),
  slug: z.string(),
  topic: z.string(),
  title: z.array(z.string().min(1)).min(1).max(2),
  accent: z.string().optional(),
  power: PowerZ.optional(),
  script: z.array(ScriptBeatZ).min(1),
  science: z.array(ScienceZ).default([]),
  voice: VoiceZ.optional(),
  gaps: z.object({ pairs: z.record(z.string(), z.number()).optional() }).loose().optional(),
  cast: z.array(z.string()).default([]),
  shots: z.array(ShotZ).min(2),
  edit: z.array(EditZ).min(1),
  tail: z.number().optional(),
  end: AnchorZ.optional(),
  fx: z.array(FxZ).default([]),
  sound: SoundZ,
});

export const WordZ = z.object({ w: z.string(), s: z.number(), e: z.number(), p: z.string().optional() });
export const WordsZ = z.array(WordZ);

export type EpisodeJson = z.infer<typeof EpisodeJsonZ>;
export type Words = z.infer<typeof WordsZ>;
export type KindOf<T extends z.ZodType> = z.infer<T>;
