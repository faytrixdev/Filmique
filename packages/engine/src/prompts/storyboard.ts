import { DIRECTOR_SYSTEM } from './system';

// The storyboard is the only step that must speak the archetype catalogue: the whitelist
// below is generated from the live registry so prompts and code can never drift apart.

export const archWhitelist = (ARCHETYPES: Record<string, unknown>): string =>
  Object.entries(ARCHETYPES)
    .map(([name, A]) => {
      const fields = Object.keys((((A as { PropsZ?: { shape?: Record<string, unknown> } }).PropsZ) ?? {}).shape ?? {});
      return `  - ${name}(${fields.join(', ')})`;
    })
    .join('\n');

export const storyboardPrompt = (input: {
  topic: string;
  title: string[];
  script: { beat: string; text: string }[];
  science: { claim: string }[];
  durationS?: number;
  ARCHETYPES: Record<string, unknown>;
}): { system: string; prompt: string } => {
  const secs = input.durationS ?? 24;
  const frames = Math.round(secs * 30);
  return {
    system: DIRECTOR_SYSTEM,
    prompt: `Sujet : ${input.topic}
Titre : ${input.title.join(' / ')}
Script :
${input.script.map((b) => `[${b.beat}] ${b.text}`).join('\n')}
Soutiens scientifiques :
${input.science.map((s) => `- ${s.claim}`).join('\n')}

Découpe le script en 8 à 16 plans, durée totale ≈ ${frames} frames (30 fps, tolérance ±15 %).
Catalogue d'archetypes — SEULS CES NOMS SONT AUTORISÉS, avec les props exactes entre parenthèses (toutes optionnelles sauf celles notées *) :
${archWhitelist(input.ARCHETYPES)}

Pour chaque plan :
- « size » : une courte description de cadrage ("wide", "medium", "macro insert", "close-up", "schematic", "title, wide", ...)
- « set » : kitchen | study | classroom | rooftop | schematic | bedroom
- « key » : durée du plan en frames (8 à 80)
- « note » : une phrase d'intent (français)
- « archetype » + « archetypeProps » : valide contre le catalogue ci-dessus (props par défaut très bien tolérées)
- au moins 1 plan « titleReveal » pour le titre, 1 plan « schematicClaim » ou « schematicBar » pour un fait chiffré, et un plan par beat du script

« edit » : un point de coupe par plan, { "shot":"S<n>", "at":"<premiers mots du beat couvert>", "look":"..."? } — « look » = mot d'ambiance ; « million », « red » ou « shock » declenchent la colorimétrie spéciale.
« fx » : liste sparse de { "at":"s:<x>", "kind":"flash"|"shake", "color"?, "o"? }.
« cast » : sous-liste de pip | pipHood | pipInk | mo | sis | mom | suit.
« tail » : 0.8 à 1.6 s de respiration finale.

Réponds EXACTEMENT :
{"cast":["pipHood"],"shots":[{"id":"S1","size":"wide","set":"kitchen","key":18,"note":"...","archetype":"wideRoom","archetypeProps":{}}],"edit":[{"shot":"S1","at":"premier mot","look":"million"}],"fx":[{"at":"s:3.2","kind":"flash"}],"tail":1.2}`,
  };
};
