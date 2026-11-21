import { describe, expect, it } from 'vitest';
import { MockLlmProvider } from '../src/providers';
import { contentWords, demandedWords, missingNouns, findIssues, bindVisuals, normalize } from '../src/visuals';

describe('visual binding', () => {
  it('keeps the concrete words of a beat and drops the filler', () => {
    const words = contentWords("Le ticket de cantine coûte 2,50 EUR pour tout le monde");
    expect(words).toContain('ticket');
    expect(words).toContain('cantine');
    expect(words).not.toContain('pour');
    expect(words).not.toContain('le');
  });

  it('normalizes accents and case', () => {
    expect(normalize('CANTINE ÉTIQUETÉE')).toBe('cantine etiquetee');
  });

  it('prefers the noun phrase over the verb a clause opens on', () => {
    expect(demandedWords('Qui finira par payer la pizza qui tourne au plafond ?')[0]).toBe('pizza');
    expect(demandedWords('Il ouvre le distributeur, la porte reste bloquée.')[0]).toBe('distributeur');
  });

  it('keeps figures, drops the time words a picture cannot show', () => {
    const words = demandedWords('Or, la cantine dépasse le budget de 300 € chaque mois.');
    expect(words).toContain('cantine');
    expect(words).toContain('budget');
    expect(words).toContain('300');
    expect(words).not.toContain('mois');
  });

  it('demands the figures the beat gives, and only the showable nouns', () => {
    const missing = missingNouns('Le ticket de cantine coûte 2,50 EUR', { tag: 'TICKET CANTINE' }, 'tagObject');
    expect(missing).toContain('2');
    expect(missing).not.toContain('offert');
  });

  it('lists the nouns a shot never shows', () => {
    const missing = missingNouns('Le ticket de cantine est offert', { phone: '8,50 EUR' }, 'wideRoom');
    expect(missing).toContain('ticket');
    expect(missing).toContain('cantine');
  });

  it('finds no issue when the shot already carries the noun', () => {
    const missing = missingNouns('Le ticket de cantine est offert', { tag: 'TICKET CANTINE' }, 'tagObject');
    expect(missing).toEqual([]);
  });

  it('pairs one shot per beat even without cut points', () => {
    const beats = [
      { beat: '1', text: 'Le ticket de cantine est offert' },
      { beat: '2', text: 'Le budget explose chaque année' },
    ];
    const issues = findIssues(
      [
        { id: 'S1', archetype: 'wideRoom', archetypeProps: { phone: '1 EUR' } },
        { id: 'S2', archetype: 'wideRoom', archetypeProps: { phone: '1 EUR' } },
      ],
      beats,
      [{ shot: 'S1', at: 'Le ticket' }],
    );
    expect(issues.map((i) => i.shot)).toEqual(['S1', 'S2']);
    expect(issues[1].beat).toContain('budget');
  });

  it('repairs a shot with one focused call and keeps the valid props', async () => {
    const beats = [{ beat: '1', text: 'Le ticket de cantine est offert' }];
    const shots = [{ id: 'S1', archetype: 'tagObject', archetypeProps: { tag: 'PAYÉ' } }];
    const llm = new MockLlmProvider([
      JSON.stringify({ fixes: [{ shot: 'S1', archetypeProps: { tag: 'TICKET CANTINE' } }] }),
    ]);
    const out = await bindVisuals(shots, beats, [{ shot: 'S1', at: 'Le ticket' }], llm);
    expect(out.repaired).toBe(1);
    expect(out.fixes.S1.props.tag).toBe('TICKET CANTINE');
    expect(out.fixes.S1.archetype).toBe('tagObject');
    expect(out.stillMissing).toEqual([]);
  });

  it('swaps the archetype when the shot cannot show the word at all', async () => {
    const beats = [{ beat: '1', text: 'Le ticket de cantine est offert' }];
    const shots = [{ id: 'S1', archetype: 'edgeFall', archetypeProps: { item: 'mug' } }];
    const llm = new MockLlmProvider([
      JSON.stringify({
        fixes: [
          {
            shot: 'S1',
            archetype: 'present',
            archetypeProps: { object: { kind: 'ticket', label: 'TICKET CANTINE', x: 0.5, y: 0.5, s: 1, rot: 0, at: 0, anim: 'pop' } },
          },
        ],
      }),
    ]);
    const out = await bindVisuals(shots, beats, [{ shot: 'S1', at: 'Le ticket' }], llm);
    expect(out.fixes.S1.archetype).toBe('present');
    expect(out.stillMissing).toEqual([]);
  });

  it('survives a model that answers with garbage', async () => {
    const beats = [{ beat: '1', text: 'Le ticket de cantine est offert' }];
    const shots = [{ id: 'S1', archetype: 'tagObject', archetypeProps: { tag: 'PAYÉ' } }];
    const out = await bindVisuals(shots, beats, [{ shot: 'S1', at: 'Le ticket' }], new MockLlmProvider(['pas du json']));
    expect(out.repaired).toBe(0);
    expect(out.stillMissing.length).toBeGreaterThan(0);
  });

  it('salvages a repair the model typed loosely', async () => {
    const beats = [{ beat: '1', text: 'Le ticket de cantine est offert' }];
    const shots = [{ id: 'S1', archetype: 'tagObject', archetypeProps: { tag: 'PAYÉ' } }];
    const llm = new MockLlmProvider([JSON.stringify({ fixes: [{ shot: 'S1', archetypeProps: { tag: 12 } }] })]);
    const out = await bindVisuals(shots, beats, [{ shot: 'S1', at: 'Le ticket' }], llm);
    expect(out.repaired).toBe(1);
    expect(out.fixes.S1.props.tag).toBe('12');
  });

  it('ignores a repair that names an archetype the catalogue does not have', async () => {
    const beats = [{ beat: '1', text: 'Le ticket de cantine est offert' }];
    const shots = [{ id: 'S1', archetype: 'tagObject', archetypeProps: { tag: 'PAYÉ' } }];
    const llm = new MockLlmProvider([JSON.stringify({ fixes: [{ shot: 'S1', archetype: 'inventedShot', archetypeProps: {} }] })]);
    const out = await bindVisuals(shots, beats, [{ shot: 'S1', at: 'Le ticket' }], llm);
    expect(out.repaired).toBe(0);
    expect(out.stillMissing.length).toBeGreaterThan(0);
  });

  it('does not call the model when every shot already shows its beat', async () => {
    const beats = [{ beat: '1', text: 'Le ticket de cantine est offert' }];
    const shots = [{ id: 'S1', archetype: 'tagObject', archetypeProps: { tag: 'TICKET CANTINE' } }];
    const llm = new MockLlmProvider([]);
    const out = await bindVisuals(shots, beats, [{ shot: 'S1', at: 'Le ticket' }], llm);
    expect(out.repaired).toBe(0);
    expect(llm.queue.length).toBe(0);
  });
});
