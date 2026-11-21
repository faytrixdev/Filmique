// The proven dramatic structure of the shipped episodes: cold open → absurd premise →
// the number that breaks it → the question that leaves you uneasy. Beats are numbered,
// ~16 chars/s spoken (measured on the shipped voices), every quoted figure must back
// itself in science (next step).
import { DIRECTOR_SYSTEM } from './system';
import { NARRATION_BRIEF, SPEECH_CHARS_PER_SEC, type Narration } from '../settings';

export const scriptPrompt = (input: {
  topic: string;
  tone?: string;
  durationS?: number;
  narration?: Narration;
}): { system: string; prompt: string } => {
  const secs = input.durationS ?? 24;
  const chars = Math.round(secs * SPEECH_CHARS_PER_SEC);
  // A long film needs more beats, or the per-beat word cap keeps the script
  // below the budget the refine enforces. The arithmetic is done for the model:
  // it gets a per-beat size, not just a total it cannot count.
  const beatCount = Math.min(12, Math.max(4, Math.round(secs / 6.5)));
  const perBeat = Math.round(chars / beatCount);
  const mots = Math.max(6, Math.round(perBeat / 6.3));
  const beats = secs > 40 ? `${beatCount} à ${Math.min(12, beatCount + 2)} beats` : '4 à 9 beats';
  const words = secs > 40 ? '≤ 22 mots' : '≤ 18 mots';
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
- ${beats} numérotés (« beat » parmi hook/premise/evidence/twist/question, hook et question obligatoires)
- longueur totale OBLIGATOIRE : ${chars} caractères visés (${secs} s à ${SPEECH_CHARS_PER_SEC} car./s), tolérance ±15 % — soit environ ${perBeat} caractères (≈ ${mots} mots) par beat pour ${beatCount} beats ; si tu écris un autre nombre de beats, garde le total
- chaque texte ${words}, jamais de liste à puces ni de sigles
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
en ~${Math.round(input.budget / SPEECH_CHARS_PER_SEC)} s).

Beat à réécrire :
"""${input.text}"""

Donne exactement 3 variantes distinctes : une plus courte, une plus incarnée, une plus
tranchante. Chaque variante ≤ ${input.budget} caractères.

Réponds EXACTEMENT : {"variants":["...","...","..."]}`;
