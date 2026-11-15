import { z } from 'zod';
import { THEME_IDS, ThemeIdZ, type ThemeId } from './theme';

// ProjectSettings: every creative decision the user makes before the studio
// writes a single beat. Stored inside the episode (episode.settings), so the
// renderer and the editor read the same contract as the wizard. Format and
// captions are rendered by the engine: a 9:16 or 1:1 film is a centred crop of
// the 1920x1080 staging, captions ride on the voice's word track.

export const FORMATS = ['16:9', '9:16', '1:1'] as const;
export const DURATIONS = [15, 24, 30, 45, 60] as const;
export const TONES = ['playful', 'tense', 'warm'] as const;
export const NARRATIONS = ['conteur', 'prof', 'pote'] as const;
export const RHYTHMS = ['pose', 'standard', 'nerveux'] as const;
export const WORLDS = ['urbain', 'maison', 'ecole', 'cosmos'] as const;
export const CAPTIONS = ['none', 'bloc', 'mot', 'karaoke'] as const;

export type Format = (typeof FORMATS)[number];
export type Duration = (typeof DURATIONS)[number];
export type Tone = (typeof TONES)[number];
export type Narration = (typeof NARRATIONS)[number];
export type Rhythm = (typeof RHYTHMS)[number];
export type World = (typeof WORLDS)[number];
export type Captions = (typeof CAPTIONS)[number];
export type { ThemeId };

export const ProjectSettingsZ = z.object({
  format: z.enum(FORMATS).default('16:9'),
  durationS: z.number().int().min(8).max(90).default(24),
  tone: z.enum(TONES).default('playful'),
  narration: z.enum(NARRATIONS).default('conteur'),
  rhythm: z.enum(RHYTHMS).default('standard'),
  world: z.enum(WORLDS).default('maison'),
  theme: ThemeIdZ.default('base'),
  captions: z.enum(CAPTIONS).default('none'),
  voiceId: z.string().uuid().optional(),
});

export type ProjectSettings = z.infer<typeof ProjectSettingsZ>;

/** Merges defaults: episodes written before settings existed read as defaults. */
export const resolveSettings = (s?: Partial<ProjectSettings> | null): ProjectSettings =>
  ProjectSettingsZ.parse(s ?? {});

/** Pixel dimensions the renderer uses: the composition canvas for each format. */
export const FORMAT_DIMS: Record<Format, [number, number]> = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
};

/** Added to the script prompt: how the narrator talks, not what the film says. */
export const NARRATION_BRIEF: Record<Narration, string> = {
  conteur:
    'Conteur : troisième personne, phrases courtes, images concrètes, une pointe de mystère. On raconte, on ne récite pas.',
  prof: 'Prof : tu expliques à un adulte curieux. Deuxième personne, analogies du quotidien, zéro jargon, une idée par phrase.',
  pote: 'Pote : tu racontes à un ami. Tutoiement, rythme parlé, humour sec, jamais de morale ni de conclusion solennelle.',
};

/** The sets the storyboard may use, per world. Order = preference. */
export const WORLD_SETS: Record<World, string[]> = {
  urbain: ['rooftop', 'stairwell', 'kitchen'],
  maison: ['kitchen', 'bedroom', 'study'],
  ecole: ['classroom', 'study', 'stairwell'],
  cosmos: ['schematic', 'rooftop'],
};

/** Shot-count range per editing rhythm: more cuts = a faster film. */
export const RHYTHM: Record<Rhythm, { shots: [number, number]; label: string }> = {
  pose: { shots: [6, 10], label: 'posé' },
  standard: { shots: [8, 16], label: 'standard' },
  nerveux: { shots: [12, 18], label: 'nerveux' },
};
