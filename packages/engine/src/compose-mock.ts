// Canned compose steps: one valid draft per pipeline call (script, science, storyboard).
// Shared by compose tests and the SaaS canary's offline mode, so both exercise the same gates.

// Sized for the default 24 s budget: scriptCharBudget(24) = 336 chars, window ±15%.
export const SCRIPT_JSON = JSON.stringify({
  title: ['ET SI LE PAIN', 'NOUS OBSERVE?'],
  accent: 'PAIN',
  power: { word: 'Crue', rule: 'le pain pousse sur les toits après chaque orage', look: 'des miches dorées qui glissent sur les immeubles' },
  script: [
    { beat: 'hook', text: 'Une averse éclate au-dessus de la ville, en plein soleil.' },
    { beat: 'premise', text: 'Le pain pousse sur les toits depuis ce matin, sans un mot.' },
    { beat: 'evidence', text: "L'INSEE y voit le signe de la fin des boulangeries de quartier." },
    { beat: 'evidence', text: 'Un toit parisien moyen couvre exactement 60 mètres carrés.' },
    { beat: 'twist', text: 'Il faudrait 1 000 averses pour nourrir un immeuble de 300 âmes.' },
    { beat: 'question', text: 'Et si la mairie taxait le pain tombé du ciel ?' },
  ],
});

/** Fills the last beat until the script totals ~target chars, so the same draft
 *  passes the length gate at any duration (24 s = 336, 45 s = 672, 60 s = 912). */
export const padScript = <T extends { script: { text: string }[] }>(draft: T, target: number): T => {
  const script = draft.script.map((b) => ({ ...b }));
  const last = script[script.length - 1];
  const filler = ' Le quartier retient son souffle à chaque nouvelle averse.';
  let chars = script.reduce((n, b) => n + b.text.length, 0);
  while (chars < target) {
    last.text += filler;
    chars += filler.length;
  }
  return { ...draft, script } as T;
};

export const SCIENCE_JSON = JSON.stringify({
  science: [
    { claim: 'Un toit parisien couvre 60 mètres carrés.', working: 'un immeuble haussmannien moyen, 20 m sur 3', source: 'Atelier Parisien d’Urbanisme' },
  ],
});

export const STORYBOARD_JSON = JSON.stringify({
  cast: ['pipHood', 'suit'],
  shots: [
    { id: 'S1', size: 'title, wide', set: 'kitchen', key: 60, note: 'le titre', archetype: 'titleReveal', archetypeProps: { lines: ['ET SI LE PAIN', 'NOUS OBSERVE?'], accent: 'PAIN' } },
    { id: 'S2', size: 'wide', set: 'kitchen', key: 40, note: 'la ville se réveille', archetype: 'wideRoom', archetypeProps: { mood: 'curious' } },
    { id: 'S3', size: 'close-up', set: 'rooftop', key: 45, note: 'il comprend', archetype: 'closeUpTurn', archetypeProps: {} },
    { id: 'S4', size: 'schematic', set: 'schematic', key: 50, note: 'un chiffre', archetype: 'schematicBar', archetypeProps: {} },
    { id: 'S5', size: 'wide, low angle', set: 'rooftop', key: 40, note: 'la foule', archetype: 'arrivalWalk', archetypeProps: { cast: 'suit' } },
    { id: 'S6', size: 'insert top-down', set: 'study', key: 36, note: 'les miches atterrissent', archetype: 'pilesLand', archetypeProps: {} },
  ],
  edit: [
    { shot: 'S1', at: 'Une', look: 'million' },
    { shot: 'S9', at: 'mairie' },
  ],
  fx: [{ at: 's:2.2', kind: 'flash' }],
  tail: 1.0,
});

/** One queue for MockLlmProvider: exactly the three answers composeEpisode consumes. */
export const composeMockQueue = (): string[] => [SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON];
