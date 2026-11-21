import { z } from 'zod';
import { extractJson, type LlmProvider } from './providers';
import { ARCHETYPES } from './archetypes/registry';
import { DIRECTOR_SYSTEM } from './prompts/system';
import { OBJECT_KINDS } from './prompts/storyboard';
import { coerceProps } from './props-coerce';

// Visual binding: the storyboard model picks an archetype and fills its props, but it
// can pick a shot that does not show what the beat talks about. This pass reads the
// plan against its beat, finds the concrete nouns that never reach the picture, and
// asks the model for the props that put them there.

const STOP = new Set([
  'alors', 'apres', 'avant', 'avec', 'avoir', 'cette', 'chaque', 'comme', 'comment', 'dans', 'depuis',
  'devient', 'dire', 'elle', 'elles', 'encore', 'entre', 'etre', 'faire', 'faut', 'ici', 'ils', 'jamais',
  'leur', 'leurs', 'mais', 'meme', 'moins', 'mon', 'notre', 'nous', 'parce', 'parle', 'pas', 'peut',
  'plus', 'pour', 'pourquoi', 'quand', 'que', 'quel', 'quelle', 'sans', 'ses', 'soit', 'son', 'sont',
  'sous', 'sur', 'ta', 'tant', 'tes', 'toujours', 'tous', 'tout', 'toute', 'trop', 'tu', 'un', 'une',
  'vos', 'votre', 'vous', 'y', 'ete', 'etre', 'des', 'les', 'leur', 'donc', 'puis', 'bien', 'peu',
]);

export const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** The concrete words of a beat: the things a picture could show. */
export const contentWords = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of normalize(text).split(/[^a-z]+/)) {
    if (raw.length < 4 || STOP.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= 8) break;
  }
  return out;
};

/** Words a picture cannot show: the gate never demands them, it asks for the
 * concrete noun of the beat instead. */
const ABSTRACT = new Set([
  'prix', 'jour', 'jours', 'fois', 'temps', 'vie', 'monde', 'chose', 'choses', 'truc', 'moment',
  'mois', 'semaine', 'semaines', 'annee', 'annees', 'heure', 'heures', 'matin', 'soir', 'nuit', 'midi',
  'place', 'partie', 'raison', 'resultat', 'probleme', 'solution', 'idee', 'question', 'reponse',
  'debut', 'fin', 'suite', 'niveau', 'etat', 'cas', 'droit', 'avenir', 'gratuite', 'sourire',
  'sourires', 'effort', 'chance', 'envie', 'besoin', 'facon', 'maniere', 'genre', 'sorte', 'type',
  'total', 'moyenne', 'hausse', 'baisse', 'evolution', 'changement', 'difference', 'systeme',
  'mesure', 'projet', 'idee', 'detail', 'exemple', 'histoire', 'verite', 'erreur', 'victoire',
  'yeux', 'visage', 'tete', 'main', 'mains', 'coeur', 'dos', 'bras', 'jambe', 'ventre', 'corps',
  'voix', 'regard', 'figure', 'air', 'fond', 'bord',
]);

const DETERMINERS = new Set([
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'ce', 'cet', 'cette', 'ces', 'chaque', 'chaques',
  'au', 'aux', 'plusieurs', 'certains', 'certaines', 'quelques', 'aucun', 'aucune', 'tout', 'toute', 'tous',
  'toutes', 'leur', 'leurs', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
]);

const CONNECTORS = new Set(['et', 'mais', 'car', 'donc', 'or', 'ni', 'puis', 'quand', 'si', 'que', 'qui', 'alors']);

/** The words a shot has to put on screen: the anchor noun of each clause (the noun
 * phrase the viewer reads first) and every figure the beat gives. Abstract words
 * are dropped: a picture cannot show "le prix" or "le jour". */
export const demandedWords = (text: string): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (w: string) => {
    if (!w || seen.has(w)) return;
    seen.add(w);
    out.push(w);
  };
  const clauses: string[][] = [[]];
  for (const token of normalize(text).split(/[^a-z0-9]+/).filter(Boolean)) {
    if (CONNECTORS.has(token)) clauses.push([]);
    else clauses[clauses.length - 1].push(token);
  }
  const nouns: string[] = [];
  for (const clause of clauses) {
    for (const token of clause) if (/^\d/.test(token)) push(token);
    // determiner-led phrases first: after a connector the clause often opens on a
    // verb ("Qui finira par payer la pizza") and the verb is not a thing to show
    const found: string[] = [];
    for (let i = 0; i < clause.length; i++) {
      const token = clause[i];
      if (/^\d/.test(token) || token.length < 4 || STOP.has(token) || ABSTRACT.has(token)) continue;
      const prev = clause[i - 1] ?? '';
      if (DETERMINERS.has(prev) || prev === 'de' || prev === 'd') found.push(token);
    }
    // a clause with no determiner ("Budget annuel 20 000 €") still has a head noun
    if (found.length === 0) {
      const head = clause.find((t) => t.length >= 4 && !/^\d/.test(t) && !STOP.has(t) && !ABSTRACT.has(t));
      if (head) found.push(head);
    }
    for (const n of found) if (!nouns.includes(n)) nouns.push(n);
  }
  if (nouns.length > 0) out.unshift(nouns[0]);
  nouns.slice(1).forEach(push);
  return out.slice(0, 4);
};

/** Every piece of text a shot puts on screen. */
export const shotText = (props: Record<string, unknown> | undefined): string[] => {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(props ?? {});
  return out;
};

export type BindingIssue = {
  shot: string;
  archetype: string;
  beat: string;
  missing: string[];
};

const describeOf = (archetype: string | undefined): string => {
  const a = archetype ? ARCHETYPES[archetype] : undefined;
  return a ? `${a.describe} ${a.sets.join(' ')}` : '';
};

/** The nouns of the beat that the shot never shows, in the picture or in its archetype. */
export const missingNouns = (beat: string, props: Record<string, unknown> | undefined, archetype: string | undefined): string[] => {
  const nouns = demandedWords(beat);
  if (nouns.length === 0) return [];
  const shown = normalize([...shotText(props), describeOf(archetype)].join(' '));
  return nouns.filter((n) => !shown.includes(n));
};

/** The beat each shot carries. The cut point names the first words of the beat it
 * covers; the plan is read in order, so the pairing never goes backwards. */
export const pairBeats = (
  shots: { id: string }[],
  beats: { beat: string; text: string }[],
  edit: { shot: string; at: string }[],
): Map<string, string> => {
  const map = new Map<string, string>();
  let bi = 0;
  for (const shot of shots) {
    if (beats.length === 0) break;
    const cut = edit.find((e) => e.shot === shot.id);
    const at = cut ? normalize(cut.at).trim() : '';
    let idx = -1;
    if (at.length > 0) {
      const head = at.slice(0, Math.max(8, at.length - 2));
      idx = beats.findIndex((b, i) => i >= bi && normalize(b.text).startsWith(head));
      if (idx < 0) idx = beats.findIndex((b, i) => i >= bi && normalize(b.text).includes(at.slice(0, 12)));
    }
    if (idx < 0) idx = bi;
    map.set(shot.id, beats[idx].text);
    bi = Math.min(beats.length - 1, idx + 1);
  }
  return map;
};

export const findIssues = (
  shots: { id: string; archetype?: string; archetypeProps?: Record<string, unknown> }[],
  beats: { beat: string; text: string }[],
  edit: { shot: string; at: string }[],
): BindingIssue[] => {
  const issues: BindingIssue[] = [];
  const pairs = pairBeats(shots, beats, edit);
  for (const shot of shots) {
    const hit = pairs.get(shot.id);
    if (!hit) continue;
    const missing = missingNouns(hit, shot.archetypeProps, shot.archetype);
    if (missing.length > 0) issues.push({ shot: shot.id, archetype: shot.archetype ?? '', beat: hit, missing });
  }
  return issues;
};

const FixZ = z.object({
  shot: z.string(),
  archetype: z.string().optional(),
  archetypeProps: z.record(z.string(), z.unknown()),
});

// The model sometimes emits one broken entry in an otherwise good list: each fix is
// validated on its own so a stray string never throws the whole repair away.
const PropsDraftZ = z.object({ fixes: z.array(z.unknown()) });

export type VisualFix = { archetype: string; props: Record<string, unknown> };

const bindingPrompt = (issues: BindingIssue[], beats: { beat: string; text: string }[]) => {
  const lines = issues
    .map((i) => {
      const a = ARCHETYPES[i.archetype];
      const props = a ? Object.keys(((a.PropsZ as { shape?: Record<string, unknown> }).shape ?? {})).join(', ') : '';
      return `- plan ${i.shot} (archetype ${i.archetype || 'scene'}, props possibles : ${props})
  beat : ${i.beat}
  mots a montrer qui manquent : ${i.missing.join(', ')}`;
    })
    .join('\n');
  return `Ces plans de storyboard ne montrent pas ce que leur beat raconte. Corrige les props de chaque plan pour que le mot manquant APPARAISSE dans l'image.

${lines}

Pour un archetype "scene" ou "present" : ajoute un objet etiquete (kind + label) dont le label contient le mot manquant, ou mets le mot dans "caption".
Pour un archetype a props textuelles : mets le mot dans la prop qui s'y pret (tag, title, value, phone, label, origin, footnote, chip, unit...).
Pour un schema : mets le mot ou le chiffre dans title / value / origin / footnote / unit / result.
Si l'archetype du plan ne peut PAS montrer ce mot (il dessine autre chose), remplace-le par "archetype":"scene" ou "archetype":"present" et mets un objet etiquete (kind : ${OBJECT_KINDS.join(' | ')}, label : le mot du beat).
N'invente aucun chiffre qui ne soit pas dans le beat. Garde les autres props.

Reponds EXACTEMENT :
{"fixes":[{"shot":"S3","archetypeProps":{...}}]}`;
};

/** One focused call for every plan whose beat is not on screen, then a second
 * round for the plans the first round did not manage to fix. */
export const bindVisuals = async (
  shots: { id: string; archetype?: string; archetypeProps?: Record<string, unknown> }[],
  beats: { beat: string; text: string }[],
  edit: { shot: string; at: string }[],
  llm: LlmProvider,
): Promise<{ fixes: Record<string, VisualFix>; repaired: number; stillMissing: BindingIssue[] }> => {
  const fixes: Record<string, VisualFix> = {};
  let issues = findIssues(shots, beats, edit);
  if (issues.length === 0) return { fixes, repaired: 0, stillMissing: [] };
  for (let round = 0; round < 2 && issues.length > 0; round++) {
    let parsed: z.infer<typeof PropsDraftZ> | null = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        const raw = await llm.generateText(bindingPrompt(issues, beats), {
          system: DIRECTOR_SYSTEM,
          json: true,
          temperature: attempt === 0 ? 0.4 : 0.2,
        });
        const check = PropsDraftZ.safeParse(extractJson(raw));
        if (check.success) parsed = check.data;
        else if (process.env.HF_BIND_DEBUG) console.log('[bind] bad shape', raw.slice(0, 400));
      } catch (e) {
        if (process.env.HF_BIND_DEBUG) console.log('[bind] call failed', e instanceof Error ? e.message : String(e));
        break;
      }
    }
    if (!parsed) break;
    for (const entry of parsed.fixes) {
      const check = FixZ.safeParse(entry);
      if (!check.success) {
        if (process.env.HF_BIND_DEBUG) console.log('[bind] dropped a malformed fix', JSON.stringify(entry).slice(0, 120));
        continue;
      }
      const fix = check.data;
      const shot = shots.find((s) => s.id === fix.shot);
      if (!shot) continue;
      const current = fixes[fix.shot];
      const wanted = fix.archetype ?? current?.archetype ?? shot.archetype ?? 'scene';
      const arch = ARCHETYPES[wanted];
      if (!arch) {
        if (process.env.HF_BIND_DEBUG) console.log('[bind] unknown archetype', wanted);
        continue;
      }
      const merged = { ...(shot.archetypeProps ?? {}), ...(current?.props ?? {}), ...fix.archetypeProps };
      const ok = coerceProps(arch.PropsZ, merged);
      if (!ok) {
        if (process.env.HF_BIND_DEBUG) console.log('[bind] rejected', fix.shot, JSON.stringify(fix.archetypeProps).slice(0, 200));
        continue;
      }
      fixes[fix.shot] = { archetype: wanted, props: ok };
    }
    issues = issues.filter((i) => {
      const fixed = fixes[i.shot];
      if (!fixed) return true;
      return missingNouns(i.beat, fixed.props, fixed.archetype).length > 0;
    });
  }
  return { fixes, repaired: Object.keys(fixes).length, stillMissing: issues };
};
