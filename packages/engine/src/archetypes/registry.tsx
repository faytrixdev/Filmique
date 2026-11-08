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
};

export type CastTypeMap = Record<string, string>;

/** Builds the SaaS ShotMap: every shot that carries an archetype gets a bound component.
 * Throws on unknown archetype names or props that fail the archetype's Zod (the SaaS gate). */
export const buildShotMap = (ep: EpisodeJson): ShotMap => {
  const map: ShotMap = {};
  for (const shot of ep.shots as z.infer<typeof ShotZ>[]) {
    if (!shot.archetype) continue;
    const A = ARCHETYPES[shot.archetype];
    if (!A) throw new Error(`unknown archetype '${shot.archetype}' on shot ${shot.id}`);
    const props = A.PropsZ.parse(shot.archetypeProps ?? {});
    const Comp = A.Component;
    map[shot.id] = (sp: ShotProps) => <Comp {...sp} {...props} uid={shot.id} />;
  }
  return map;
};
