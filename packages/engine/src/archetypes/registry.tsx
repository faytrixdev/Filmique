import React from 'react';
import { z } from 'zod';
import type { EpisodeJson, ShotZ } from '../schema';
import type { ShotMap, ShotProps } from '../episode';
import {
  wideRoomZ, WideRoom,
  phoneJumpZ, PhoneJump,
  phoneDrainZ, PhoneDrain,
  phoneRestoreZ, PhoneRestore,
  tagObjectZ, TagObject,
  pilesLandZ, PilesLand,
  objectRainZ, ObjectRain,
  titleRevealZ, TitleReveal,
  lowAngleSkyZ, LowAngleSky,
  cityTurnZ, CityTurn,
  closeUpTurnZ, CloseUpTurn,
  schematicClaimZ, SchematicClaim,
  schematicBarZ, SchematicBar,
  arrivalWalkZ, ArrivalWalk,
} from './components';
import {
  edgeFallZ, EdgeFall,
  smashFloorZ, SmashFloor,
  catchSaveZ, CatchSave,
  tripStumbleZ, TripStumble,
  landedDizzyZ, LandedDizzy,
  stepOverZ, StepOver,
  wrongAnswerZ, WrongAnswer,
} from './actions';
import {
  selectCopyZ, SelectCopy,
  pastePopZ, PastePop,
  copySwarmZ, CopySwarm,
  pasteStackZ, PasteStack,
  selectCharacterZ, SelectCharacter,
  copyCharacterZ, CopyCharacter,
  uneasyCopiesZ, UneasyCopies,
  bitePauseZ, BitePause,
  ghostFlickerZ, GhostFlicker,
  plantGridZ, PlantGrid,
} from './copies';
import { sceneZ, Scene, presentZ, Present, SCENE_SETS } from './scene';

export type Archetype<P = unknown> = {
  Component: React.FC<ShotProps & { uid?: string } & P>;
  PropsZ: z.ZodType<P>;
  /** What the shot actually shows, in one line: the storyboard model reads this to choose. */
  describe: string;
  /** The sets the shot draws. */
  sets: string[];
};

export const ARCHETYPES: Record<string, Archetype<any>> = {
  wideRoom: {
    Component: WideRoom,
    PropsZ: wideRoomZ,
    describe: "un personnage debout dans une cuisine ou un bureau d'etude, un telephone pose sur l'ilot (montant, score, compteur)",
    sets: ['kitchen', 'study'],
  },
  phoneJump: {
    Component: PhoneJump,
    PropsZ: phoneJumpZ,
    describe: "gros plan sur l'ecran d'un telephone pose sur un plan de travail : un nombre saute vers une nouvelle valeur (compteur, montant, score)",
    sets: ['kitchen'],
  },
  phoneDrain: {
    Component: PhoneDrain,
    PropsZ: phoneDrainZ,
    describe: "gros plan sur l'ecran d'un telephone : le nombre descend par paliers, des montants s'affichent (depense, perte, baisse)",
    sets: ['kitchen'],
  },
  phoneRestore: {
    Component: PhoneRestore,
    PropsZ: phoneRestoreZ,
    describe: "gros plan sur l'ecran d'un telephone : le nombre remonte d'un coup, une pastille s'inscrit (gain, record, retour en arrière)",
    sets: ['kitchen'],
  },
  tagObject: {
    Component: TagObject,
    PropsZ: tagObjectZ,
    describe: "gros plan sur un objet pose sur un bureau : une etiquette s'ecrit dessus, avec une coche ou une croix (ticket, facture, dossier, contrat)",
    sets: ['study'],
  },
  pilesLand: {
    Component: PilesLand,
    PropsZ: pilesLandZ,
    describe: "des piles de pieces d'argent tombent sur un bureau et s'empilent (argent, economie, depense)",
    sets: ['study'],
  },
  objectRain: {
    Component: ObjectRain,
    PropsZ: objectRainZ,
    describe: "des pieces d'argent tombent du plafond dans une classe, les eleves se lèvent (argent, gratification, pluie de bonus)",
    sets: ['classroom'],
  },
  titleReveal: {
    Component: TitleReveal,
    PropsZ: titleRevealZ,
    describe: "plan de titre sur un toit au crepuscule, le personnage leve le bras et le titre s'ecrit (deux lignes pleines)",
    sets: ['rooftop'],
  },
  lowAngleSky: {
    Component: LowAngleSky,
    PropsZ: lowAngleSkyZ,
    describe: "contre-plongee sur un toit : le personnage leve le bras vers le ciel etincelant (reve, ambition, vertige)",
    sets: ['rooftop'],
  },
  cityTurn: {
    Component: CityTurn,
    PropsZ: cityTurnZ,
    describe: "sur un toit au crepuscule, la ville vire au rouge et le ciel se fissure (bascule, menace, bascule du monde)",
    sets: ['rooftop'],
  },
  closeUpTurn: {
    Component: CloseUpTurn,
    PropsZ: closeUpTurnZ,
    describe: "gros plan du visage du personnage, la lumiere passe du froid au rouge (doute, bascule, question)",
    sets: ['rooftop', 'classroom'],
  },
  schematicClaim: {
    Component: SchematicClaim,
    PropsZ: schematicClaimZ,
    describe: "schema : une affirmation au centre, une fleche vers son origine, une valeur et une note (chiffre cle, source, comparaison)",
    sets: ['schematic'],
  },
  schematicBar: {
    Component: SchematicBar,
    PropsZ: schematicBarZ,
    describe: "schema : une barre qui se vide dans le temps, avec son unite et le resultat final (evolution, perte, jauge)",
    sets: ['schematic'],
  },
  arrivalWalk: {
    Component: ArrivalWalk,
    PropsZ: arrivalWalkZ,
    describe: "un personnage en costume marche vers le heros sur un toit au crepuscule (autorite, controle, arrivee d'un tiers)",
    sets: ['rooftop'],
  },
  edgeFall: {
    Component: EdgeFall,
    PropsZ: edgeFallZ,
    describe: "un objet glisse et tombe d'un plan de travail (raté, perte, objet qui tombe)",
    sets: ['study'],
  },
  smashFloor: {
    Component: SmashFloor,
    PropsZ: smashFloorZ,
    describe: "l'objet eclate au sol, les debris volent (echec, casse, rupture)",
    sets: ['study'],
  },
  catchSave: {
    Component: CatchSave,
    PropsZ: catchSaveZ,
    describe: "le personnage rattrape l'objet qui tombait (sauvetage, rattrapage, issue)",
    sets: ['study'],
  },
  tripStumble: {
    Component: TripStumble,
    PropsZ: tripStumbleZ,
    describe: "le personnage bute sur le chat dans l'escalier (chute, obstacle, fausse marche)",
    sets: ['stairwell'],
  },
  landedDizzy: {
    Component: LandedDizzy,
    PropsZ: landedDizzyZ,
    describe: "le personnage est au sol dans l'escalier, etourdi, les etoiles tournent (choc, vertige)",
    sets: ['stairwell'],
  },
  stepOver: {
    Component: StepOver,
    PropsZ: stepOverZ,
    describe: "le personnage enjambe le chat dans l'escalier (obstacle franchi, passage)",
    sets: ['stairwell'],
  },
  wrongAnswer: {
    Component: WrongAnswer,
    PropsZ: wrongAnswerZ,
    describe: "au tableau de la classe, une mauvaise reponse et les eleves se moquent (erreur, utopie, absurdite)",
    sets: ['classroom'],
  },
  selectCopy: {
    Component: SelectCopy,
    PropsZ: selectCopyZ,
    describe: "une main selectionne un objet (biscuit, feuille, ticket) sur l'ilot de la cuisine (choix, arbitrage)",
    sets: ['kitchen'],
  },
  pastePop: {
    Component: PastePop,
    PropsZ: pastePopZ,
    describe: "l'objet colle apparait a cote sur le plan de travail (duplication, multiplicite)",
    sets: ['kitchen'],
  },
  copySwarm: {
    Component: CopySwarm,
    PropsZ: copySwarmZ,
    describe: "des tas de copies s'empilent sur l'ilot et la table (multiplication, masse)",
    sets: ['kitchen'],
  },
  pasteStack: {
    Component: PasteStack,
    PropsZ: pasteStackZ,
    describe: "une pile de feuilles apparait sur le bureau (dossier, accumulation)",
    sets: ['study'],
  },
  selectCharacter: {
    Component: SelectCharacter,
    PropsZ: selectCharacterZ,
    describe: "un personnage est designe dans l'escalier (choix, election, designation)",
    sets: ['stairwell'],
  },
  copyCharacter: {
    Component: CopyCharacter,
    PropsZ: copyCharacterZ,
    describe: "son double apparait a cote de lui (copie, clonage, multiplicite)",
    sets: ['stairwell'],
  },
  uneasyCopies: {
    Component: UneasyCopies,
    PropsZ: uneasyCopiesZ,
    describe: "le personnage regarde ses doubles, mal a l'aise (doute, consequences)",
    sets: ['stairwell'],
  },
  bitePause: {
    Component: BitePause,
    PropsZ: bitePauseZ,
    describe: "on mord un biscuit, pause (detente, pause comique)",
    sets: ['rooftop'],
  },
  ghostFlicker: {
    Component: GhostFlicker,
    PropsZ: ghostFlickerZ,
    describe: "une copie fantome apparait et disparait sur le toit (rumeur, illusion)",
    sets: ['rooftop'],
  },
  plantGrid: {
    Component: PlantGrid,
    PropsZ: plantGridZ,
    describe: "schema : la duree de vie d'un objet comparee sur une grille de centrales (duree, energie, comparaison)",
    sets: ['schematic'],
  },
  scene: {
    Component: Scene,
    PropsZ: sceneZ,
    describe:
      "scene libre : un decor, un personnage (debout, qui pointe, qui presente) et des objets etiquetes poses dans l'image (a utiliser quand l'archetype ne peut pas montrer le mot du beat)",
    sets: ['cantine', 'office', 'kitchen', 'study', 'classroom', 'rooftop', 'stairwell', 'bedroom'],
  },
  present: {
    Component: Present,
    PropsZ: presentZ,
    describe: "le personnage presente un objet etiquete a la camera, dans un decor (montrer un objet du beat)",
    sets: ['cantine', 'office', 'kitchen', 'study', 'classroom', 'rooftop', 'stairwell', 'bedroom'],
  },
};

export type CastTypeMap = Record<string, string>;

/** Salvages LLM-written archetype props: schema first, then a coercion pass for
 * common mangling (joined `lines` strings, numbers written as French text), then
 * pure schema defaults, else the shot drops its archetype and renders the
 * generic scene. Never throws. */
const archetypePropsOf = (A: Archetype<any>, shot: z.infer<typeof ShotZ>): Record<string, unknown> | null => {
  const raw = (shot.archetypeProps ?? {}) as Record<string, unknown>;
  const direct = A.PropsZ.safeParse(raw);
  if (direct.success) return direct.data as Record<string, unknown>;
  const salvaged = { ...raw };
  if (typeof salvaged.lines === 'string') {
    const parts = (salvaged.lines as string).split(/\s*[|/]\s*|\n+/).filter((s) => s.trim().length > 0);
    salvaged.lines = parts.length >= 2 ? [parts[0], parts[1]] : [parts[0] ?? '', ''];
  }
  const coerced = A.PropsZ.safeParse(salvaged);
  if (coerced.success) return coerced.data as Record<string, unknown>;
  const numeric = { ...salvaged };
  for (const [key, value] of Object.entries(salvaged)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().replace(/\s/g, '').replace(/ | /g, '');
    if (!/^-?\d+([.,]\d+)?$/.test(trimmed)) continue;
    const n = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(n)) numeric[key] = n;
  }
  const recast = A.PropsZ.safeParse(numeric);
  if (recast.success) return recast.data as Record<string, unknown>;
  const defaults = A.PropsZ.safeParse({});
  return defaults.success ? (defaults.data as Record<string, unknown>) : null;
};

/** Builds the SaaS ShotMap: every shot that carries a known archetype gets a bound
 * component. Unknown names or unsalvageable props degrade to the generic scene -
 * a visible room with the character in it, never a black segment and never another
 * film's content. */
export const buildShotMap = (ep: EpisodeJson): ShotMap => {
  const map: ShotMap = {};
  for (const shot of ep.shots as z.infer<typeof ShotZ>[]) {
    if (!shot.archetype) continue;
    const A = ARCHETYPES[shot.archetype];
    const props = A ? archetypePropsOf(A, shot) : null;
    if (A && props) {
      const Comp = A.Component;
      map[shot.id] = (sp: ShotProps) => <Comp {...sp} {...props} uid={shot.id} />;
      continue;
    }
    const fallback = ARCHETYPES.scene;
    const shotSet = (shot as { set?: string }).set;
    const set = SCENE_SETS.includes(shotSet as (typeof SCENE_SETS)[number]) ? shotSet : undefined;
    const fProps = fallback.PropsZ.safeParse(set ? { set } : {});
    if (!fProps.success) continue;
    const Comp = fallback.Component;
    map[shot.id] = (sp: ShotProps) => <Comp {...sp} {...(fProps.data as Record<string, unknown>)} uid={shot.id} />;
  }
  return map;
};
