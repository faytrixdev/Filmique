import { describe, expect, it } from 'vitest';
import { LOOKS, type CastName } from '../src/rig';
import { THEMES, THEME_IDS, themeById, themeSwatches } from '../src/theme';
import { pictureFilter } from '../src/episode';
import { resolveSettings } from '../src/settings';

describe('film look (themes)', () => {
  it('every theme is complete and distinct from the others', () => {
    const grades = new Set<string>();
    for (const id of THEME_IDS) {
      const t = THEMES[id];
      expect(t.id).toBe(id);
      expect(t.name.length).toBeGreaterThan(1);
      expect(t.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.vignette).toBeGreaterThan(0);
      grades.add(t.grade);
    }
    expect(grades.size).toBe(THEME_IDS.length);
  });

  it('the base theme keeps the house look (no grade, no wash)', () => {
    const base = THEMES.base;
    expect(base.grade).toBe('');
    expect(base.wash).toBeUndefined();
    expect(base.bg).toBe('#0E0C1E');
  });

  it('an unknown theme falls back to the base one', () => {
    expect(themeById('nope').id).toBe('base');
    expect(themeById(undefined).id).toBe('base');
    expect(themeById('nuit').id).toBe('nuit');
  });

  it('every theme shows two swatches', () => {
    for (const id of THEME_IDS) {
      const [a, b] = themeSwatches(THEMES[id]);
      expect(a).toMatch(/^#/);
      expect(b).toMatch(/^#/);
    }
  });

  it('the picture filter stacks the theme grade under the power look', () => {
    expect(pictureFilter(undefined)).toBe('');
    expect(pictureFilter(THEMES.base)).toBe('');
    expect(pictureFilter(THEMES.nuit)).toContain('contrast(1.12)');
    const both = pictureFilter(THEMES.nuit, 'saturate(0.4)');
    expect(both).toContain('contrast(1.12)');
    expect(both).toContain('saturate(0.4)');
  });

  it('the theme is part of the project settings, defaulting to the house look', () => {
    expect(resolveSettings().theme).toBe('base');
    expect(resolveSettings({ theme: 'neon' }).theme).toBe('neon');
  });
});

describe('casting', () => {
  it('the cast grew past the first seven', () => {
    const names = Object.keys(LOOKS) as CastName[];
    expect(names.length).toBeGreaterThanOrEqual(11);
    for (const wanted of ['doc', 'ado', 'meme', 'agent']) {
      expect(names).toContain(wanted);
    }
  });

  it('every look is a complete costume', () => {
    for (const [name, look] of Object.entries(LOOKS)) {
      expect(look.skin, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(look.jacket, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(look.line, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(look.face, name).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
