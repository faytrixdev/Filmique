// The proven dramatic structure of the shipped episodes: cold open → absurd premise →
// the number that breaks it → the question that leaves you uneasy. Beats are numbered,
// ~8,5 chars/s spoken, every quoted figure must back itself in science (next step).
import { DIRECTOR_SYSTEM } from './system';

export const scriptPrompt = (input: { topic: string; tone?: string; durationS?: number }): { system: string; prompt: string } => {
  const secs = input.durationS ?? 24;
  const chars = Math.round(secs * 8.5);
  return {
    system: DIRECTOR_SYSTEM,
    prompt: `Sujet : ${input.topic}
Ton : ${input.tone ?? 'léger avec un fond d’inquiétude'} — français, oral, familier mais propre.

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
