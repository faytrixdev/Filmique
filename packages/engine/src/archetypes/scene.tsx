import React from 'react';
import { z } from 'zod';
import type { ShotProps } from '../episode';
import { LOOKS, poseAt, faceAt, toWorld, joints, type CastName, type Expr, type Pose } from '../rig';
import { kf, clamp, easeOut, backOut, camT, wob } from '../anim';
import { Hero } from '../rig';
import { FONT } from '../font-faces';
import { stand } from '../furnish';
import { Kitchen, KitchenIsland, KITCHEN, islandTop } from '../sets/kitchen';
import { Study, Desk } from '../sets/study';
import { Classroom } from '../sets/classroom';
import { Cantine, CAN } from '../sets/cantine';
import { Office, OFF } from '../sets/office';
import { Rooftop } from '../sets/rooftop';
import { Stairwell } from '../sets/stairwell';
import { Bedroom } from '../sets/bedroom';
import { objectPropZ, PropObject, type ObjectProp } from './objects';

type Arch = ShotProps & { uid?: string };

export const SCENE_SETS = ['cantine', 'office', 'kitchen', 'study', 'classroom', 'rooftop', 'stairwell', 'bedroom'] as const;
export type SceneSet = (typeof SCENE_SETS)[number];

export const sceneZ = z.object({
  set: z.enum(SCENE_SETS).default('kitchen'),
  cast: z.enum(['pip', 'pipHood', 'pipInk', 'mo', 'sis', 'mom', 'suit', 'doc', 'ado', 'meme', 'agent']).default('pipHood'),
  mood: z.enum(['neutral', 'happy', 'smug', 'shock', 'worried', 'oops', 'cool', 'dizzy', 'tired']).default('neutral'),
  action: z.enum(['stand', 'point', 'present', 'reach', 'shrug']).default('stand'),
  x: z.number().min(0.12).max(0.88).default(0.42),
  scale: z.number().min(0.5).max(1.8).default(1),
  objects: z.array(objectPropZ).default([]),
  caption: z.string().default(''),
  captionAt: z.number().int().nonnegative().default(6),
});
export type SceneProps = z.infer<typeof sceneZ>;

export const presentZ = z.object({
  set: z.enum(SCENE_SETS).default('kitchen'),
  cast: z.enum(['pip', 'pipHood', 'pipInk', 'mo', 'sis', 'mom', 'suit', 'doc', 'ado', 'meme', 'agent']).default('pipHood'),
  mood: z.enum(['neutral', 'happy', 'smug', 'shock', 'worried', 'oops', 'cool', 'dizzy', 'tired']).default('neutral'),
  object: objectPropZ.default({ kind: 'ticket', label: '', x: 0.5, y: 0.5, s: 1, rot: 0, at: 0, anim: 'pop' }),
  x: z.number().min(0.12).max(0.88).default(0.45),
  scale: z.number().min(0.5).max(1.8).default(1),
  caption: z.string().default(''),
  captionAt: z.number().int().nonnegative().default(6),
});
export type PresentProps = z.infer<typeof presentZ>;

const GROUND: Record<SceneSet, { x: number; y: number; scale: number }> = {
  kitchen: { x: 0, y: 0, scale: 0 },
  study: { x: 0, y: 0, scale: 0 },
  classroom: { x: 0, y: 0, scale: 0 },
  cantine: { x: 0, y: 0, scale: 0 },
  office: { x: 0, y: 0, scale: 0 },
  rooftop: { x: 900, y: 742, scale: 1.5 },
  stairwell: { x: 900, y: 742, scale: 1 },
  bedroom: { x: 900, y: 720, scale: 1.05 },
};

const groundAt = (set: SceneSet): { x: number; y: number; scale: number } => {
  switch (set) {
    case 'kitchen': {
      const p = stand(KITCHEN, 0.36, 0.62);
      return { x: p.x, y: p.y, scale: p.scale };
    }
    case 'study': {
      const p = stand(KITCHEN, 0.36, 0.62);
      return { x: 960, y: p.y + 30, scale: p.scale };
    }
    case 'classroom':
      return { x: 880, y: 812, scale: 0.92 };
    case 'cantine': {
      const p = stand(CAN, (CAN.vp.x - CAN.back.x0) / (CAN.back.x1 - CAN.back.x0), 0.7);
      return { x: p.x, y: p.y, scale: p.scale };
    }
    case 'office': {
      const p = stand(OFF, (OFF.vp.x - OFF.back.x0) / (OFF.back.x1 - OFF.back.x0), 0.7);
      return { x: p.x, y: p.y, scale: p.scale };
    }
    default:
      return GROUND[set];
  }
};

const Backdrop: React.FC<{ set: SceneSet; t: number; id: string }> = ({ set, t, id }) => {
  switch (set) {
    case 'cantine':
      return <Cantine t={t} id={`${id}cn`} />;
    case 'office':
      return <Office t={t} id={`${id}of`} />;
    case 'kitchen':
      return (
        <g>
          <Kitchen t={t + 40} id={`${id}kt`} veil={0.4} />
          <KitchenIsland />
        </g>
      );
    case 'study':
      return (
        <g>
          <Study t={t + 110} id={`${id}st`} veil={0.4} />
          <Desk x0={560} x1={1360} y={700} lamp={false} laptop={false} />
        </g>
      );
    case 'classroom':
      return <Classroom t={t + 300} id={`${id}cl`} laugh={0} />;
    case 'rooftop':
      return <Rooftop t={t} sunX={1050} sunY={520} spin={300} low={260} />;
    case 'stairwell':
      return <Stairwell t={t} id={`${id}sw`} />;
    case 'bedroom':
      return <Bedroom t={t} id={`${id}bd`} />;
  }
};

const MOOD_FACE: Record<string, [number, Expr][]> = {
  neutral: [[0, 'neutral']],
  happy: [[0, 'happy']],
  smug: [[0, 'smug']],
  shock: [[0, 'shock']],
  worried: [[0, 'worried']],
  oops: [[0, 'oops']],
  cool: [[0, 'cool']],
  dizzy: [[0, 'dizzy']],
  tired: [[0, 'tired']],
};

type ActionKey = { f: number; p: Partial<Pose>; ease?: (k: number) => number };

const ACTION_POSE = (action: string, base: { x: number; y: number; scale: number }): ActionKey[] => {
  const p = { x: base.x, y: base.y, scale: base.scale, yaw: 0.25, look: 0.5, armL: { a: 14, b: -8 }, armR: { a: 22, b: -10 } };
  switch (action) {
    case 'point':
      return [
        { f: 0, p },
        { f: 8, p: { armR: { a: 78, b: 4 }, handR: 'point', look: 0.9, headTilt: -3 }, ease: easeOut },
        { f: 18, p: { armR: { a: 74, b: 6 }, look: 0.85 } },
      ];
    case 'present':
      return [
        { f: 0, p },
        { f: 9, p: { armR: { a: 58, b: 26 }, armL: { a: 52, b: 24 }, look: 0.55, headTilt: 2 }, ease: easeOut },
        { f: 20, p: { armR: { a: 60, b: 24 }, armL: { a: 54, b: 22 } } },
      ];
    case 'reach':
      return [
        { f: 0, p },
        { f: 10, p: { armR: { a: 146, b: 12 }, look: 0.85, headTilt: -6 }, ease: easeOut },
        { f: 20, p: { armR: { a: 150, b: 8 }, look: 0.9 } },
      ];
    case 'shrug':
      return [
        { f: 0, p },
        { f: 10, p: { armL: { a: 46, b: 30 }, armR: { a: 44, b: 32 }, look: 0.7, headTilt: 4 }, ease: easeOut },
        { f: 20, p: { armL: { a: 44, b: 28 }, armR: { a: 42, b: 30 } } },
      ];
    default:
      return [
        { f: 0, p },
        { f: 14, p: { headTilt: 5, look: 0.75, armR: { a: 28, b: 26 } }, ease: easeOut },
        { f: 24, p: { headTilt: 8, look: 0.9, armR: { a: 26, b: 24 } } },
      ];
  }
};

const Caption: React.FC<{ text: string; t: number; at: number }> = ({ text, t, at }) => {
  if (!text || t < at) return null;
  const s = backOut(clamp((t - at) / 8));
  const size = text.length > 22 ? 44 : text.length > 14 ? 54 : 64;
  const w = text.length * size * 0.6 + 70;
  return (
    <g transform={`translate(960 190) scale(${s})`}>
      <rect x={-w / 2} y={-size * 0.82} width={w} height={size * 1.5} rx={size * 0.75} fill="#0B0816" opacity={0.82} />
      <text y={size * 0.34} textAnchor="middle" fontFamily={FONT.title} fontWeight={700} fontSize={size} fill="#F6EFE3" letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

const SceneFrame: React.FC<{
  set: SceneSet;
  cast: CastName;
  mood: string;
  action: string;
  x: number;
  scale: number;
  caption: string;
  captionAt: number;
  t: number;
  len: number;
  id: string;
  handObject?: ObjectProp;
}> = ({ set, cast, mood, action, x, scale, caption, captionAt, t, len, id, handObject }) => {
  const base = groundAt(set);
  const shift = (x - 0.42) * 900;
  const pos = { x: base.x + shift, y: base.y, scale: base.scale * scale };
  const pose = poseAt(t, ACTION_POSE(action, pos) as never);  const face = faceAt(t, MOOD_FACE[mood] ?? MOOD_FACE.neutral);
  const zoom = kf(t, [[0, 1], [Math.max(len, 1), 1.06]]);
  const camX = pos.x + wob(t, 40, 0.6, 0) * 0;
  const camY = set === 'rooftop' ? 640 : 620;
  const hand = handObject ? toWorld(pose, joints(pose).armR.end) : null;
  return (
    <g transform={camT(camX, camY, zoom)}>
      <Backdrop set={set} t={t} id={id} />
      {hand && handObject ? (
        <g transform={`translate(${hand.x} ${hand.y}) scale(${handObject.s})`}>
          <PropObject o={{ ...handObject, x: 0.5, y: 0.5, at: 0, anim: 'none' }} t={t} centered />
        </g>
      ) : null}
      <Hero look={LOOKS[cast]} pose={{ ...pose, ...face }} rimId="rimR" shadow={0.7} />
    </g>
  );
};

export const Scene: React.FC<Arch & SceneProps> = ({ t, len, uid = 'sc', set = 'kitchen', cast = 'pipHood', mood = 'neutral', action = 'stand', x = 0.42, scale = 1, objects = [], caption = '', captionAt = 6 }) => (
  <g>
    <SceneFrame set={set} cast={cast as CastName} mood={mood} action={action} x={x} scale={scale} caption={caption} captionAt={captionAt} t={t} len={len} id={`ar-sc-${uid}`} />
    {objects.map((o, i) => (
      <PropObject key={i} o={o.x > x - 0.16 && o.x < x + 0.16 ? { ...o, x: o.x >= 0.5 ? Math.min(0.88, x + 0.34) : Math.max(0.12, x - 0.34) } : o} t={t} />
    ))}
    <Caption text={caption} t={t} at={captionAt} />
  </g>
);

export const Present: React.FC<Arch & PresentProps> = ({ t, len, uid = 'pr', set = 'kitchen', cast = 'pipHood', mood = 'neutral', object, x = 0.45, scale = 1, caption = '', captionAt = 6 }) => (
  <g>
    <SceneFrame
      set={set}
      cast={cast as CastName}
      mood={mood}
      action="present"
      x={x}
      scale={scale}
      caption={caption}
      captionAt={captionAt}
      t={t}
      len={len}
      id={`ar-pr-${uid}`}
      handObject={object}
    />
    <Caption text={caption} t={t} at={captionAt} />
  </g>
);
