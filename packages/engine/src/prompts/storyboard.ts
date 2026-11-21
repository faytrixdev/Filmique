import React from 'react';
import { z } from 'zod';
import { DIRECTOR_SYSTEM } from './system';
import { WORLD_SETS, RHYTHM, type World, type Rhythm, type Format } from '../settings';
import { SCENE_SETS } from '../archetypes/scene';
import { OBJECT_KINDS as OBJECT_LIBRARY } from '../archetypes/objects';

// The storyboard is the only step that must speak the archetype catalogue: the whitelist
// below is generated from the live registry so prompts and code can never drift apart.

type Def = { type?: string; innerType?: Def; values?: unknown; entries?: unknown; items?: unknown } | undefined;

const describeField = (field: unknown): string => {
  let def: Def = (field as { def?: Def })?.def;
  let type = def?.type ?? 'unknown';
  while ((type === 'optional' || type === 'default' || type === 'readonly') && def?.innerType) {
    def = def.innerType;
    type = def?.type ?? 'unknown';
  }
  if (type === 'enum' || type === 'literal') {
    const vals = Array.isArray(def?.values) ? def.values : def?.entries ? Object.keys(def.entries as Record<string, unknown>) : [];
    return vals.length > 0 ? vals.map(String).join('|') : 'string';
  }
  if (type === 'tuple') return 'tuple[2 strings]';
  if (type === 'array') return 'array';
  return type;
};

export const archWhitelist = (ARCHETYPES: Record<string, unknown>): string =>
  Object.entries(ARCHETYPES)
    .map(([name, A]) => {
      const shape = ((((A as { PropsZ?: { shape?: Record<string, unknown> } }).PropsZ) ?? {}).shape ?? {}) as Record<string, unknown>;
      const fields = Object.entries(shape)
        .map(([k, v]) => `${k}: ${describeField(v)}`)
        .join(', ');
      return `  - ${name}(${fields})`;
    })
    .join('\n');

export const archCatalogue = (ARCHETYPES: Record<string, unknown>): string =>
  Object.entries(ARCHETYPES)
    .map(([name, A]) => {
      const a = A as { describe?: string; sets?: string[] };
      return `  - ${name} : ${a.describe ?? ''} [decors : ${(a.sets ?? []).join(', ')}]`;
    })
    .join('\n');

export const OBJECT_KINDS = OBJECT_LIBRARY;

export const storyboardPrompt = (input: {
  topic: string;
  title: string[];
  script: { beat: string; text: string }[];
  science: { claim: string }[];
  durationS?: number;
  world?: World;
  rhythm?: Rhythm;
  cast?: string[];
  format?: Format;
  ARCHETYPES: Record<string, unknown>;
}): { system: string; prompt: string } => {
  const secs = input.durationS ?? 24;
  const frames = Math.round(secs * 30);
  const sets = WORLD_SETS[input.world ?? 'maison'];
  const [minShots, maxShots] = RHYTHM[input.rhythm ?? 'standard'].shots;
  const framing =
    input.format === '9:16'
      ? '\nCadrage VERTICAL 9:16 : un seul sujet centre par plan, l\'action dans le tiers central, rien d\'important sur les bords (le cadre coupe les cotes).'
      : input.format === '1:1'
        ? '\nCadrage CARRE 1:1 : sujet centre, composition compacte, rien d\'important sur les bords gauche et droit.'
        : '';
  return {
    system: DIRECTOR_SYSTEM,
    prompt: `Sujet : ${input.topic}
Titre : ${input.title.join(' / ')}
Script :
${input.script.map((b) => `[${b.beat}] ${b.text}`).join('\n')}
Soutiens scientifiques :
${input.science.map((s) => `- ${s.claim}`).join('\n')}

Découpe le script en ${minShots} à ${maxShots} plans, durée totale ~ ${frames} frames (30 fps, tolérance +-15 %).${framing}

CATALOGUE D'ARCHETYPES - ce que chaque plan dessine vraiment. Choisis le plan dont la description correspond à ce que le beat raconte :
${archCatalogue(input.ARCHETYPES)}

PROPS de chaque archetype (toutes optionnelles sauf celles notées * - une prop sans * doit quand même être filled quand le plan dépend d'elle) :
${archWhitelist(input.ARCHETYPES)}

OBJETS ÉTIQUETÉS (pour "scene" et "present") : ${OBJECT_KINDS.join(' | ')} - chaque objet porte une étiquette de texte libre (ex: "TICKET", "2,50 EUR", "BUDGET").

RÈGLE DE COHÉRENCE - la plus importante : le plan doit MONTRER le beat, pas seulement l'illustrer.
- Le nom concret du beat (l'objet, la personne, le lieu, le chiffre) doit apparaître DANS l'image : soit dans une étiquette d'objet (objects[].label), soit dans un texte de prop (tag, title, value, phone, caption...), soit dans le décor choisi.
- Si aucun archetype ne montre le sujet, utilise "scene" ou "present" avec un objet étiqueté (kind + label) : c'est la façade prévue pour montrer un objet que le script nomme.
- Un plan "scene" ou "present" porte TOUJOURS au moins un objet étiqueté (objects[] ou object) : un decor vide ne montre rien.
- Un objet de "scene" se pose À CÔTÉ du personnage, jamais sur son visage ni sur son torse : x entre 0.66 et 0.84 (ou 0.16 et 0.34), y entre 0.48 et 0.62. Un objet centré sur un personnage centré est illisible.
- Choisis le décor qui parle au sujet : cantine pour la cantine et les repas, office pour le budget et l'administration, classroom pour l'ecole et la classe, kitchen pour la maison et la cuisine, study pour le bureau et le travail, rooftop pour la nuit, la ville et l'ambiance finale, stairwell pour les escaliers, bedroom pour la chambre.
- N'écris jamais un décor que l'archetype ne dessine pas : l'archetype décide du décor, le prop "set" de "scene"/"present" doit valoir un décor de sa liste.
- N'invente pas de chiffres : un montant vient du script ou des soutiens scientifiques, sinon écris le mot ("UN REPAS", "BIENTOT") plutôt qu'un nombre.
- N'invente jamais une source, un organisme ou une étude (champ "origin" ou "footnote") : un champ vide vaut mieux qu'une source fabriquée ("source : étude interne", "selon l'INSEE", "enquête interne" alors que ce n'est pas dans les soutiens).
- "schematicClaim" : "center" est le chiffre ou le mot COURT au centre du cercle (8 caractères max, jamais une phrase), "value" est sa légende sous le cercle, "origin" nomme l'origine en deux ou trois mots.

Pour chaque plan :
- "size" : une courte description de cadrage ("wide", "medium", "macro insert", "close-up", "schematic", "title, wide", ...)
- "set" : ${sets.join(' | ')}
- "key" : durée du plan en frames (8 à 80)
- "note" : une phrase d'intent (français)
- "focal" : où se trouve le sujet du plan dans l'image 16:9 - "gauche", "centre" ou "droite". Sert au recadrage vertical et carré : ne mens pas, regarde ta composition.
- "archetype" + "archetypeProps" : valide contre le catalogue ci-dessus
- au moins 1 plan "titleReveal" pour le titre (les DEUX lignes remplies, jamais une ligne vide), placé en DERNIER plan : le titre tombe comme une signature, jamais en ouverture. Si le script donne un chiffre, 1 plan "schematicClaim" ou "schematicBar" qui l'affiche. Un plan par beat du script.
- pour "scene" et "present", le prop "set" vaut un decor parmi : ${SCENE_SETS.join(' | ')}.

"edit" : un point de coupe par plan, { "shot":"S<n>", "at":"<premiers mots du beat couvert>", "look":"..."? } - "look" = mot d'ambiance ; "million", "red" ou "shock" déclenchent la colorimétrie spéciale.
"fx" : liste sparse de { "at":"s:<x>", "kind":"flash"|"shake", "color"?, "o"? }.
"cast" : sous-liste de ${(input.cast ?? ['pip', 'pipHood', 'mo', 'sis', 'mom', 'suit', 'doc', 'ado', 'meme', 'agent']).join(' | ')}.
"tail" : 0.8 a 1.6 s de respiration finale.

Réponds EXACTEMENT :
{"cast":["pipHood"],"shots":[{"id":"S1","size":"wide","set":"kitchen","key":18,"note":"...","focal":"centre","archetype":"scene","archetypeProps":{"set":"kitchen","cast":"pipHood","action":"stand","objects":[{"kind":"ticket","label":"TICKET","x":0.62,"y":0.55,"s":1,"at":4,"anim":"pop"}],"caption":"2,50 EUR"}}],"edit":[{"shot":"S1","at":"premier mot","look":"million"}],"fx":[{"at":"s:3.2","kind":"flash"}],"tail":1.2}`,
  };
};
