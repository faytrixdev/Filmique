// Canned compose steps: one valid draft per pipeline call (script, science, storyboard).
// Shared by compose tests and the SaaS canary's offline mode, so both exercise the same gates.

export const SCRIPT_JSON = JSON.stringify({
  title: ['ET SI LE PAIN', 'NOUS OBSERVE?'],
  accent: 'PAIN',
  power: { word: 'Crue', rule: 'le pain pousse sur les toits après chaque orage', look: 'des miches dorées qui glissent sur les immeubles' },
  script: [
    { beat: 'hook', text: 'Une averse éclate au-dessus de la ville.' },
    { beat: 'premise', text: 'Le pain pousse sur les toits depuis ce matin.' },
    { beat: 'evidence', text: "L'INSEE suit la survie des boulangeries chaque automne." },
    { beat: 'evidence', text: 'Un toit parisien couvre 60 mètres carrés.' },
    { beat: 'twist', text: 'Il faudrait 1 000 averses pour nourrir un immeuble.' },
    { beat: 'question', text: 'Mairie? elle taxe le pain?' },
  ],
});

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
