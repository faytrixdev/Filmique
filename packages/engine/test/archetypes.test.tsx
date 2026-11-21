import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { EpisodeJsonZ } from '../src/schema';
import { ARCHETYPES, buildShotMap } from '../src/archetypes';
import { ShotFrame } from '../src/episode';

const million = EpisodeJsonZ.parse(
  JSON.parse(readFileSync(resolve(__dirname, 'fixtures/million16-episode.json'), 'utf8')),
);

// The props an archetype cannot render without: the ones that carry the story's own
// content. Everything else has a neutral default, so a bare archetype never shows
// another film's text.
const MIN_PROPS: Record<string, Record<string, unknown>> = {
  titleReveal: { lines: ['ET SI TU', 'DEVENAIS RICHE ?'] },
  phoneJump: { from: 12, to: 1200 },
  phoneDrain: { from: 1200, to: 12 },
  phoneRestore: { from: 12, to: 1200 },
  tagObject: { tag: 'TICKET' },
};

describe('archetype registry', () => {
  it('has the 33 catalogue archetypes', () => {
    expect(Object.keys(ARCHETYPES).sort()).toEqual(
      [
        'arrivalWalk', 'bitePause', 'catchSave', 'cityTurn', 'closeUpTurn', 'copyCharacter', 'copySwarm', 'edgeFall',
        'ghostFlicker', 'landedDizzy', 'lowAngleSky', 'objectRain', 'pastePop', 'pasteStack', 'pilesLand',
        'phoneDrain', 'phoneJump', 'phoneRestore', 'plantGrid', 'present', 'scene', 'selectCharacter', 'selectCopy',
        'schematicBar', 'schematicClaim', 'smashFloor', 'stepOver', 'tagObject', 'titleReveal', 'tripStumble',
        'uneasyCopies', 'wideRoom', 'wrongAnswer',
      ].sort(),
    );
  });

  it('describes every archetype and names the sets it draws', () => {
    for (const [name, A] of Object.entries(ARCHETYPES)) {
      expect(A.describe.length, name).toBeGreaterThan(10);
      expect(A.sets.length, name).toBeGreaterThan(0);
    }
  });

  it('keeps the catalogue free of the money film\'s default content', () => {
    for (const [name, A] of Object.entries(ARCHETYPES)) {
      const defaults = A.PropsZ.parse(MIN_PROPS[name] ?? {});
      const text = JSON.stringify(defaults);
      for (const leak of ['SOLDE', 'PAY\u00c9', '1 000 000', 'ORIGINE', 'LE SOLDE', 'POUVOIR']) {
        expect(text.includes(leak), `${name} leaks ${leak}`).toBe(false);
      }
    }
  });

  for (const [name, A] of Object.entries(ARCHETYPES)) {
    it(`parses empty props for ${name}`, () => {
      expect(() => A.PropsZ.parse(MIN_PROPS[name] ?? {})).not.toThrow();
    });
    it(`renders a frame of ${name} at t=0 and mid`, () => {
      const props = A.PropsZ.parse(MIN_PROPS[name] ?? {});
      for (const t of [0, 30]) {
        const html = renderToStaticMarkup(React.createElement(ShotFrame, null as never, React.createElement(A.Component as React.FC<Record<string, unknown>>, { t, len: 60, f: t, ...props, uid: 'test' })));
        expect(html).toContain('<svg');
        expect(html.length).toBeGreaterThan(200);
      }
    });
  }
});

describe('choreography variants', () => {
  const CASES: [string, string, Record<string, unknown>][] = [
    ['wideRoom study', 'wideRoom', { room: 'study', mood: 'cheer', phone: '42 €' }],
    ['titleReveal cheer', 'titleReveal', { lines: ['A', 'B'], variant: 'cheer', stacks: [{ x: 1400, n: 5, at: 6 }] }],
    ['schematicClaim formula', 'schematicClaim', { variant: 'formula' }],
    ['closeUpTurn classroom', 'closeUpTurn', { variant: 'classroom', glasses: true, tag: 'RÉSOLU' }],
  ];
  for (const [label, key, raw] of CASES) {
    it(`renders ${label} at t=0 and mid`, () => {
      const A = ARCHETYPES[key];
      const props = A.PropsZ.parse(raw);
      for (const t of [0, 12, 30]) {
        const html = renderToStaticMarkup(React.createElement(ShotFrame, null as never, React.createElement(A.Component as React.FC<Record<string, unknown>>, { t, len: 60, f: t, ...props, uid: 'test' })));
        expect(html).toContain('<svg');
      }
    });
  }

  it('renders differently from the default variant', () => {
    const render = (key: string, raw: Record<string, unknown>) => {
      const A = ARCHETYPES[key];
      const props = A.PropsZ.parse({ ...(MIN_PROPS[key] ?? {}), ...raw });
      return renderToStaticMarkup(React.createElement(ShotFrame, null as never, React.createElement(A.Component as React.FC<Record<string, unknown>>, { t: 12, len: 60, f: 12, ...props, uid: 'test' })));
    };
    expect(render('wideRoom', { room: 'study' })).not.toEqual(render('wideRoom', {}));
    expect(render('titleReveal', { variant: 'cheer' })).not.toEqual(render('titleReveal', {}));
    expect(render('schematicClaim', { variant: 'formula' })).not.toEqual(render('schematicClaim', {}));
    expect(render('closeUpTurn', { variant: 'classroom' })).not.toEqual(render('closeUpTurn', {}));
  });

  it('rejects an out-of-enum variant', () => {
    expect(() => ARCHETYPES.wideRoom.PropsZ.parse({ room: 'attic' })).toThrow();
    expect(() => ARCHETYPES.closeUpTurn.PropsZ.parse({ variant: 'studio' })).toThrow();
  });
});

describe('buildShotMap', () => {
  it('maps only the shots annotated with archetypes', () => {
    const stripped = million.shots.map(({ archetype: _a, archetypeProps: _p, ...rest }) => rest);
    const annotated = {
      ...million,
      shots: stripped.map((s, i) =>
        i === 0
          ? { ...s, archetype: 'wideRoom', archetypeProps: { mood: 'curious', phone: '8,50 €', glow: 0.15, buzz: true, cake: true } }
          : i === 11
            ? { ...s, archetype: 'schematicClaim', archetypeProps: {} }
            : s,
      ),
    };
    const map = buildShotMap(annotated);
    expect(Object.keys(map)).toEqual(['S1', 'S12']);
  });

  it('binds an unknown archetype to the generic scene instead of dropping it', () => {
    const bad = { ...million, shots: [{ ...million.shots[0], archetype: 'nonexistent' }] };
    const map = buildShotMap(bad);
    expect(Object.keys(map)).toEqual(['S1']);
  });

  it('falls back to the generic scene when props fail the archetype schema, never throws', () => {
    const bad = { ...million, shots: [{ ...million.shots[0], archetype: 'wideRoom', archetypeProps: { mood: 'furious' } }] };
    const map = buildShotMap(bad);
    expect(Object.keys(map)).toEqual(['S1']);
  });

  it('salvages a joined lines string for titleReveal', () => {
    const bad = { ...million, shots: [{ ...million.shots[0], archetype: 'titleReveal', archetypeProps: { lines: 'PAIN DU CIEL | 2,4 KG PAR JOUR' } }] };
    const map = buildShotMap(bad);
    expect(Object.keys(map)).toEqual(['S1']);
  });
});
