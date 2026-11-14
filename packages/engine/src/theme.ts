import { z } from 'zod';

// The film look: the layer that turns two episodes with the same sets into two
// different films. A theme is a picture grade, a light wash, an accent and the
// stage colours - applied on top of the drawings, never baked into them, so the
// same scene reads differently from one episode to the next.

export const THEME_IDS = ['base', 'aube', 'nuit', 'neon', 'cendre', 'boreal'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const ThemeIdZ = z.enum(THEME_IDS);

export type ThemeDef = {
  id: ThemeId;
  name: string;
  hint: string;
  /** CSS filter applied to the picture. */
  grade: string;
  /** Light wash over the picture: two colours, top to bottom. */
  wash?: { top: string; bottom: string; alpha: number };
  /** The theme's signature colour (titles, HUD, accents). */
  accent: string;
  /** Stage background behind the scene. */
  bg: string;
  /** Vignette and grain strengths (0 = off). */
  vignette: number;
  grain: number;
};

export const THEMES: Record<ThemeId, ThemeDef> = {
  base: {
    id: 'base',
    name: 'Studio',
    hint: 'la signature de la maison',
    grade: '',
    accent: '#E9B44C',
    bg: '#0E0C1E',
    vignette: 0.55,
    grain: 0.06,
  },
  aube: {
    id: 'aube',
    name: 'Aube',
    hint: 'chaud, doré, un peu mélancolique',
    grade: 'sepia(0.14) saturate(1.06) brightness(1.03)',
    wash: { top: '#F2A65A', bottom: '#7A3B2E', alpha: 0.24 },
    accent: '#F2A65A',
    bg: '#1A1018',
    vignette: 0.5,
    grain: 0.07,
  },
  nuit: {
    id: 'nuit',
    name: 'Nuit froide',
    hint: 'bleu profond, contraste net',
    grade: 'saturate(0.92) contrast(1.12) brightness(0.96)',
    wash: { top: '#2A4A8C', bottom: '#0B1030', alpha: 0.3 },
    accent: '#7FA8FF',
    bg: '#070A18',
    vignette: 0.68,
    grain: 0.08,
  },
  neon: {
    id: 'neon',
    name: 'Néon',
    hint: 'saturé, électrique, urbain',
    grade: 'saturate(1.35) contrast(1.08)',
    wash: { top: '#E0409F', bottom: '#12E0C0', alpha: 0.2 },
    accent: '#12E0C0',
    bg: '#120A1E',
    vignette: 0.6,
    grain: 0.05,
  },
  cendre: {
    id: 'cendre',
    name: 'Cendre',
    hint: 'désaturé, documentaire',
    grade: 'saturate(0.55) contrast(1.06)',
    wash: { top: '#8A8A93', bottom: '#2A2A30', alpha: 0.26 },
    accent: '#C9C4B8',
    bg: '#101014',
    vignette: 0.62,
    grain: 0.1,
  },
  boreal: {
    id: 'boreal',
    name: 'Boréal',
    hint: 'froid, vert d’eau, calme',
    grade: 'saturate(0.95) contrast(1.05)',
    wash: { top: '#1F6F6B', bottom: '#07161A', alpha: 0.28 },
    accent: '#7FD1A6',
    bg: '#08110F',
    vignette: 0.58,
    grain: 0.07,
  },
};

export const themeById = (id?: string | null): ThemeDef =>
  (id && (THEMES as Record<string, ThemeDef>)[id]) || THEMES.base;

/** The swatches the wizard shows: two colours per theme. */
export const themeSwatches = (t: ThemeDef): [string, string] =>
  t.wash ? [t.wash.top, t.wash.bottom] : [t.accent, t.bg];
