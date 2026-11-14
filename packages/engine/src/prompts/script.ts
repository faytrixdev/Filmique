// The proven dramatic structure of the shipped episodes: cold open → absurd premise →
// the number that breaks it → the question that leaves you uneasy. Beats are numbered,
// ~8,5 chars/s spoken, every quoted figure must back itself in science (next step).
import { DIRECTOR_SYSTEM } from './system';
import { NARRATION_BRIEF, type Narration } from '../settings';

export const scriptPrompt = (input: {
  topic: string;
  tone?: string;
  durationS?: number;
  narration?: Narration;
}): { system: string; prompt: string } => {
  const secs = input.durationS ?? 24;
  const chars = Math.round(secs * 8.5);
  return {
    system: DIRECTOR_SYSTEM,
    prompt: `Sujet : ${input.topic}
Ton : ${input.tone ?? 'léger avec un fond d’inquiétude'} — français, oral, familier mais propre.
Voix : ${NARRATION_BRIEF[input.narration ?? 'conteur']}

Écris le script du short. Structure dramatique éprouvée, dans cet ordre :
1. "hook" (ouvert à froid) — une action concrète du perso, pas de salut, pas de mise en place
2. "premise" (prémisse) — la règle absurde posée en une phrase claire
3. "evidence" — un ou deux faits concrets, chacun avec un chiffre défendable
4. "twist" (retournement chiffré) — le chiffre qui casse la prémisse
5. "question" (question menaçante) — la dernière phrase laisse le spectateur soulagé puis inquiet

Contraintes :
- 4 à 9 beats numérotés (« beat » parmi hook/premise/evidence/twist/question, hook et question obligatoires)
- longueur totale du script ≈ ${chars} caractères (${secs} s à 8,5 car./s), tolérance ±25 %
- chaque texte ≤ 18 mots, jamais de liste à puces ni de sigles
- le titre : 1 à 2 lignes MAJUSCULES de 2 à 5 mots ; « accent » = le mot clef de la première ligne
- « power » : le mot qui casse la règle (word), la règle en une phrase (rule), l’effet visuel signature (look)

    Réponds EXACTEMENT :
{"title":["..."],"accent":"...","power":{"word":"...","rule":"...","look":"..."},"script":[{"beat":"hook","text":"..."}]}`,
  };
};

/** One beat, three alternatives: shorter, more incarnated, sharper. */
export const rewritePrompt = (input: {
  text: string;
  topic: string;
  instruction?: string;
  narration?: Narration;
  budget: number;
}): string => `Sujet du film : ${input.topic}
Rôle du beat : ${input.instruction ?? 'libre'}
Voix : ${NARRATION_BRIEF[input.narration ?? 'conteur']}

Réécris CE beat, et seulement lui. Garde son rôle dramatique, garde les faits et les chiffres
qu'il contient, ne rajoute aucune information. Maximum ${input.budget} caractères (un beat se dit
en ~${Math.round(input.budget / 8.5)} s).

Beat à réécrire :
"""${input.text}"""

Donne exactement 3 variantes distinctes : une plus courte, une plus incarnée, une plus
tranchante. Chaque variante ≤ ${input.budget} caractères.

Réponds EXACTEMENT : {"variants":["...","...","..."]}`;
