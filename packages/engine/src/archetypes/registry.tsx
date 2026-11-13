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

export type Archetype<P = unknown> = {
  Component: React.FC<ShotProps & { uid?: string } & P>;
  PropsZ: z.ZodType<P>;
};

export const ARCHETYPES: Record<string, Archetype<any>> = {
  wideRoom: { Component: WideRoom, PropsZ: wideRoomZ },
  phoneJump: { Component: PhoneJump, PropsZ: phoneJumpZ },
  phoneDrain: { Component: PhoneDrain, PropsZ: phoneDrainZ },
  phoneRestore: { Component: PhoneRestore, PropsZ: phoneRestoreZ },
  tagObject: { Component: TagObject, PropsZ: tagObjectZ },
  pilesLand: { Component: PilesLand, PropsZ: pilesLandZ },
  objectRain: { Component: ObjectRain, PropsZ: objectRainZ },
  titleReveal: { Component: TitleReveal, PropsZ: titleRevealZ },
  lowAngleSky: { Component: LowAngleSky, PropsZ: lowAngleSkyZ },
  cityTurn: { Component: CityTurn, PropsZ: cityTurnZ },
  closeUpTurn: { Component: CloseUpTurn, PropsZ: closeUpTurnZ },
  schematicClaim: { Component: SchematicClaim, PropsZ: schematicClaimZ },
  schematicBar: { Component: SchematicBar, PropsZ: schematicBarZ },
  arrivalWalk: { Component: ArrivalWalk, PropsZ: arrivalWalkZ },
  edgeFall: { Component: EdgeFall, PropsZ: edgeFallZ },
  smashFloor: { Component: SmashFloor, PropsZ: smashFloorZ },
  catchSave: { Component: CatchSave, PropsZ: catchSaveZ },
  tripStumble: { Component: TripStumble, PropsZ: tripStumbleZ },
  landedDizzy: { Component: LandedDizzy, PropsZ: landedDizzyZ },
  stepOver: { Component: StepOver, PropsZ: stepOverZ },
  wrongAnswer: { Component: WrongAnswer, PropsZ: wrongAnswerZ },
  selectCopy: { Component: SelectCopy, PropsZ: selectCopyZ },
  pastePop: { Component: PastePop, PropsZ: pastePopZ },
  copySwarm: { Component: CopySwarm, PropsZ: copySwarmZ },
  pasteStack: { Component: PasteStack, PropsZ: pasteStackZ },
  selectCharacter: { Component: SelectCharacter, PropsZ: selectCharacterZ },
  copyCharacter: { Component: CopyCharacter, PropsZ: copyCharacterZ },
  uneasyCopies: { Component: UneasyCopies, PropsZ: uneasyCopiesZ },
  bitePause: { Component: BitePause, PropsZ: bitePauseZ },
  ghostFlicker: { Component: GhostFlicker, PropsZ: ghostFlickerZ },
  plantGrid: { Component: PlantGrid, PropsZ: plantGridZ },
};

export type CastTypeMap = Record<string, string>;

/** Salvages LLM-written archetype props: schema first, then a coercion pass for
 * common mangling (joined `lines` strings), then pure schema defaults, else the
 * shot drops its archetype and renders the default set. Never throws. */
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
  const defaults = A.PropsZ.safeParse({});
  return defaults.success ? (defaults.data as Record<string, unknown>) : null;
};

/** Builds the SaaS ShotMap: every shot that carries a known archetype gets a bound
 * component. Unknown names or unsalvageable props degrade to the default set —
 * a single bad shot must never kill the editor or the render. */
export const buildShotMap = (ep: EpisodeJson): ShotMap => {
  const map: ShotMap = {};
  for (const shot of ep.shots as z.infer<typeof ShotZ>[]) {
    if (!shot.archetype) continue;
    // unknown name → wideRoom fallback: a visible generic room, never a black segment
    const A = ARCHETYPES[shot.archetype] ?? ARCHETYPES.wideRoom;
    const props = archetypePropsOf(A, shot);
    if (!props) continue;
    const Comp = A.Component;
    map[shot.id] = (sp: ShotProps) => <Comp {...sp} {...props} uid={shot.id} />;
  }
  return map;
};
