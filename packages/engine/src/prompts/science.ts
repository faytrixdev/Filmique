import { DIRECTOR_SYSTEM } from './system';

// Science is mandatory for every quoted figure: the LLM must defend each number with a
// working (the small math + hypotheses) and a verifiable public source (no blogs).

export const sciencePrompt = (script: { beat: string; text: string }[]): { system: string; prompt: string } => ({
  system: DIRECTOR_SYSTEM,
  prompt: `Script beats :
${script.map((b, i) => `${i + 1}. [${b.beat}] ${b.text}`).join('\n')}

Extrait chaque fait chiffré du script et donne son support. Pour chaque fait :
- « claim » : le fait, reformulé en une phrase autonome
- « working » : le calcul simple ou le raisonnement qui le soutient (hypothèses explicitées)
- « source » : une institution ou publication publique vérifiable (INSEE, Banque de France, Eurostat, OMS, etc. — jamais un blog ni une vidéo)

Règle : pas de chiffre non soutenu. Si le script n'a aucun chiffre, renvoie une liste vide.

Réponds EXACTEMENT :
{"science":[{"claim":"...","working":"...","source":"..."}]}`,
});
