import type { z } from 'zod';
import type { ShotZ } from '@what-if/engine/schema';

export type Shot = z.infer<typeof ShotZ>;

/** Moving a shot card up/down swaps neighbouring entries in ep.shots (presentational order). */
export const moveShot = (shots: Shot[], index: number, dir: -1 | 1): Shot[] => {
  const target = index + dir;
  if (index < 0 || index >= shots.length || target < 0 || target >= shots.length) return shots;
  const next = [...shots];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** key is an int >= 1 (ShotZ); clamps before the user's draft hits the gate. */
export const clampKey = (value: number): number => Math.max(1, Math.round(value) || 1);
