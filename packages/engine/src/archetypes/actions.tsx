import React from 'react';
import { z } from 'zod';
import type { ShotProps } from '../episode';
import type { Pose } from '../rig';
import { LOOKS, Hero, basePose, poseAt, faceAt, joints, toWorld, reachAngle, LEG_LEN, HEAD, C } from '../rig';
import { kf, clamp, lerp, easeOut, easeIn, rnd, camT } from '../anim';
import { Glow } from '../light';
import { Foreground } from '../kit';
import { Sparkle, Tag, DizzyStars } from '../ui';
import { Study, Desk } from '../sets/study';
import { Stairwell, Banister, stepTop, hipGround } from '../sets/stairwell';
import { Classroom, SchoolDesk } from '../sets/classroom';
import { Cat, Mug } from '../props';
import { BankPhone } from './widgets';

type Arch = ShotProps & { uid?: string };

// ---------- edgeFall: high angle over the desk edge, the object slides and falls away ----------
const EDGE = 640;

const MugTop: React.FC<{ x: number; y: number; r: number; s: number; t: number }> = ({ x, y, r, s, t }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    <ellipse cx={0} cy={0} rx={78} ry={40} fill="#D9D2C6" />
    <rect x={-78} y={-118} width={156} height={118} fill="#F4F1EA" />
    <path d="M -78 -64 Q 0 -28 78 -64 L 78 -40 Q 0 -4 -78 -40 Z" fill={C.orange} />
    <path d="M 74 -96 Q 136 -100 128 -56 Q 120 -22 74 -30" stroke="#F4F1EA" strokeWidth={20} fill="none" />
    <ellipse cx={0} cy={-118} rx={78} ry={40} fill="#E8E2D6" />
    <ellipse cx={0} cy={-116} rx={66} ry={32} fill="#5B3A26" />
    <ellipse cx={-14} cy={-122} rx={22} ry={8} fill="#8A5A3A" opacity={0.7} />
    {r < 5
      ? [0, 1].map((i) => (
          <path key={i} d={`M ${-14 + i * 26} -150 q ${-12 + Math.sin(t / 6 + i) * 6} -20 ${Math.sin(t / 9 + i) * 4} -40 q ${12 + Math.sin(t / 5 + i * 2) * 6} -20 ${Math.sin(t / 8 + i) * 6} -40`} stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.35 + 0.2 * Math.sin(t / 5 + i)} />
        ))
      : null}
  </g>
);

const FallObject: React.FC<{ item: 'mug' | 'phone' | 'plate'; x: number; y: number; rot: number; s: number; t: number }> = ({ item, x, y, rot, s, t }) => {
  if (item === 'phone') return <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}><BankPhone x={0} y={0} w={150} rot={0} value="12,00 €" glow={0.2} /></g>;
  if (item === 'plate') return <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}><ellipse cx={0} cy={0} rx={110} ry={56} fill="#F4F1EA" /><ellipse cx={0} cy={-8} rx={74} ry={34} fill="#E4DCCB" /></g>;
  return <MugTop x={x} y={y} r={rot} s={s} t={t} />;
};

export const edgeFallZ = z.object({
  item: z.enum(['mug', 'phone', 'plate']).default('mug'),
  fallAt: z.number().int().nonnegative().default(9),
  slideTo: z.number().default(1060),
});
export type EdgeFallProps = z.infer<typeof edgeFallZ>;

export const EdgeFall: React.FC<Arch & EdgeFallProps> = ({ t, len, item = 'mug', fallAt = 9, slideTo = 1060 }) => {
  const p = clamp((t - (fallAt - 6)) / 6);
  const slide = { x: lerp(1010, slideTo, easeOut(p)), y: lerp(470, EDGE - 4, easeOut(p)) };
  const dropP = clamp((t - fallAt) / 9);
  const obj =
    t < fallAt
      ? { ...slide, rot: 0, s: 1 }
      : { x: slideTo + 12 * dropP, y: EDGE - 4 + 24 * dropP + 60 * dropP + 360 * dropP * dropP, rot: 75 * easeIn(dropP), s: lerp(1, 0.4, dropP) };
  return (
    <g transform={camT(960, kf(t, [[0, 520], [len, 560]]), kf(t, [[0, 1.0], [len, 1.05]]))}>
      <g filter="url(#blur3)">
        <rect x={-400} y={EDGE} width={2720} height={900} fill="#2E2228" />
        {Array.from({ length: 40 }).map((_, i) => {
          const x = -500 + i * 72;
          return <path key={i} d={`M ${x} ${EDGE + 90} L ${960 + (x - 960) * 1.5} 1400`} stroke="#22181D" strokeWidth={3} />;
        })}
        <path d="M -400 1010 L 760 880 L 900 1400 L -400 1400 Z" fill="#4A2C3A" />
      </g>
      <rect x={-400} y={-400} width={2720} height={EDGE + 400} fill="#6B4B42" />
      {Array.from({ length: 30 }).map((_, i) => {
        const gx = -800 + i * 130;
        return <path key={i} d={`M ${gx} ${EDGE} L ${960 + (gx - 960) * 0.2} -400`} stroke="#5C4038" strokeWidth={i % 3 ? 2 : 4} opacity={0.7} />;
      })}
      <Glow x={1080} y={430} r={620} o={0.32} />
      <g transform="rotate(-6 520 220)">
        <rect x={290} y={70} width={460} height={290} rx={16} fill="#24222E" />
        <rect x={290} y={58} width={460} height={20} rx={8} fill="#17151E" />
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 12 }).map((__, c) => <rect key={`k${r}-${c}`} x={318 + c * 34} y={100 + r * 30} width={28} height={24} rx={4} fill="#33313E" />),
        )}
      </g>
      <rect x={-400} y={EDGE} width={2720} height={24} fill="#7A5747" />
      <rect x={-400} y={EDGE} width={2720} height={3} fill="#FFB46A" opacity={0.7} />
      {t < fallAt ? <ellipse cx={obj.x + 18} cy={obj.y + 8} rx={96} ry={34} fill="#000" opacity={0.3} /> : null}
      <FallObject item={item} x={obj.x} y={obj.y} rot={obj.rot} s={obj.s} t={t} />
    </g>
  );
};

// ---------- smashFloor: the object hits the floor, shards and droplets spread ----------
export const smashFloorZ = z.object({
  item: z.enum(['mug', 'plate']).default('mug'),
  shards: z.number().int().min(4).max(24).default(14),
  impactAt: z.number().int().nonnegative().default(2),
});
export type SmashFloorProps = z.infer<typeof smashFloorZ>;

export const SmashFloor: React.FC<Arch & SmashFloorProps> = ({ t, len, item = 'mug', shards = 14, impactAt = 2 }) => {
  const falling = t < impactAt;
  const dt = Math.max(0, t - impactAt);
  const shardList = Array.from({ length: shards }).map((_, i) => ({
    vx: (rnd(1, i) - 0.5) * 34,
    vy: 6 + rnd(2, i) * 16,
    s: 0.6 + rnd(3, i) * 0.9,
    r0: rnd(4, i) * 360,
    spin: (rnd(5, i) - 0.5) * 90,
    h: rnd(6, i) * 6,
  }));
  const drops = Array.from({ length: 12 }).map((_, i) => ({ vx: (rnd(7, i) - 0.5) * 26, vy: 10 + rnd(8, i) * 14, r: 2 + rnd(9, i) * 4 }));
  return (
    <g transform={camT(960, 640, 1.0)}>
      <g filter="url(#blur10)">
        <Study t={t + 44} id="ar-smash" />
      </g>
      <rect x={-400} y={760} width={2720} height={700} fill="#3A2A2E" />
      {Array.from({ length: 14 }).map((_, i) => (
        <path key={i} d={`M ${960 + (i - 7) * 60} 760 L ${960 + (i - 7) * 420} 1300`} stroke="#22181D" strokeWidth={6} />
      ))}
      <rect x={-400} y={756} width={2720} height={6} fill="#FFB36B" opacity={0.5} />
      {falling ? (
        <g transform="translate(960 0) scale(3) translate(-960 0)">
          {item === 'mug' ? <Mug x={960} y={lerp(-40, 283, t / impactAt)} rot={200 + t * 30} f={t} steam={0} /> : <ellipse cx={960} cy={lerp(-40, 283, t / impactAt)} rx={78} ry={40} fill="#F4F1EA" />}
        </g>
      ) : (
        <g transform="translate(960 850) scale(3) translate(-960 -850)">
          <ellipse cx={960} cy={856} rx={Math.min(150, 26 * dt)} ry={Math.min(26, 5 * dt)} fill="#5B3A26" />
          <ellipse cx={952} cy={853} rx={Math.min(90, 16 * dt)} ry={Math.min(12, 2.4 * dt)} fill="#8A5A3A" opacity={0.6} />
          {drops.map((d, i) => {
            const x = 960 + d.vx * dt;
            const y = 846 - d.vy * dt + 1.9 * dt * dt;
            return y < 858 ? <ellipse key={`d${i}`} cx={x} cy={y} rx={d.r} ry={d.r * 1.3} fill="#6B4228" /> : null;
          })}
          {shardList.map((s, i) => {
            const x = 960 + s.vx * dt;
            const y = Math.min(856 - s.h, 846 - s.vy * dt + 2.2 * dt * dt);
            return <path key={i} transform={`translate(${x} ${y}) rotate(${s.r0 + dt * s.spin}) scale(${s.s})`} d="M -14 -10 L 12 -14 L 16 8 L -8 12 Z" fill={i % 4 === 0 ? C.orange : '#F4F1EA'} stroke={C.ink} strokeWidth={2.4} />;
          })}
        </g>
      )}
    </g>
  );
};

// ---------- catchSave: the hero lunges and catches the falling object ----------
const CATCH_KEYS = [
  { f: 0, p: { x: 860, y: 712, yaw: 0.45, look: 1, armL: { a: 14, b: -6 } } },
  { f: 2, p: { x: 846, tilt: -8, sway: -8 } },
  { f: 6, p: { x: 960, tilt: 24, sway: 14 }, ease: easeOut },
  { f: 8, p: { x: 972, tilt: 30, sway: 10 } },
  { f: 14, p: { x: 920, tilt: 0, yaw: 0.2, look: 0, sway: -6 } },
  { f: 18, p: { sway: 3 } },
  { f: 24, p: { x: 915, sway: 0 } },
];
const CATCH_AIM = { x: 1170, y: 770 };

export const catchSaveZ = z.object({
  item: z.enum(['mug', 'plate']).default('mug'),
  sparkleAt: z.number().int().nonnegative().default(15),
});
export type CatchSaveProps = z.infer<typeof catchSaveZ>;

export const CatchSave: React.FC<Arch & CatchSaveProps> = ({ t, len, item = 'mug', sparkleAt = 15 }) => {
  const lunge = poseAt(t, CATCH_KEYS);
  const catchPoint = (() => {
    const p6 = poseAt(6, CATCH_KEYS);
    const p = { ...p6, armR: { a: reachAngle(p6, CATCH_AIM), b: 0 } };
    const h = toWorld(p, joints(p).armR.end);
    return { x: h.x + 6, y: h.y + 34 };
  })();
  const fallP = clamp(t / 6);
  let armR = { a: reachAngle(lunge, CATCH_AIM), b: 0 };
  let obj = { x: lerp(catchPoint.x + 24, catchPoint.x, fallP), y: lerp(catchPoint.y - 70, catchPoint.y, fallP * fallP), rot: 40 + 30 * fallP };
  if (t >= 6) {
    const k = easeOut(clamp((t - 6) / 8));
    const aim = reachAngle(poseAt(6, CATCH_KEYS), CATCH_AIM);
    armR = { a: lerp(aim, 28, k), b: lerp(0, 118, k) };
    const p2 = { ...lunge, armR };
    const hand = toWorld(p2, joints(p2).armR.end);
    obj = { x: hand.x + 6, y: hand.y + 34, rot: lerp(70, 0, k) };
  }
  const squash = t >= 6 && t < 12 ? 0.09 * Math.sin(((t - 6) / 6) * Math.PI) : 0;
  return (
    <g transform={camT(kf(t, [[0, 1000], [len, 960]]), kf(t, [[0, 600], [len, 580]]), kf(t, [[0, 1.75], [len, 1.95]]))}>
      <Study t={t + 80} id="ar-catch" />
      <Hero look={LOOKS.pipHood} pose={{ ...lunge, armR, squash, ...faceAt(t, [[0, 'shock'], [14, 'smug']]) }} shadow={0} rimId="rimR" />
      <Desk x0={520} x1={Math.round(catchPoint.x) - 10} y={700} lamp={false} />
      {item === 'mug' ? <Mug x={obj.x} y={obj.y} rot={obj.rot} f={t} steam={obj.rot < 5 ? 1 : 0} /> : <ellipse cx={obj.x} cy={obj.y} rx={70} ry={34} fill="#F4F1EA" transform={`rotate(${obj.rot} ${obj.x} ${obj.y})`} />}
      {t >= sparkleAt ? <Sparkle x={1040} y={470} t={t - sparkleAt} s={0.9} /> : null}
      <Foreground blur={10}>
        <rect x={440} y={800} width={220} height={40} rx={6} fill="#120D16" />
        <rect x={452} y={762} width={200} height={40} rx={6} fill="#17111C" />
        <rect x={446} y={724} width={190} height={40} rx={6} fill="#120D16" />
      </Foreground>
    </g>
  );
};

// ---------- tripStumble: the walk that ends in a trip ----------
const TRIP_SC = 0.9;

const walkP = (x: number, phase: number, extra: Partial<Pose> = {}): Pose => {
  const base = { ...basePose, x, y: hipGround(x) - LEG_LEN * TRIP_SC, scale: TRIP_SC };
  return { ...base, ...extra };
};

export const tripStumbleZ = z.object({
  cat: z.boolean().default(true),
  catX: z.number().default(800),
  walkFrom: z.number().default(320),
  tripAt: z.number().int().nonnegative().default(13),
});
export type TripStumbleProps = z.infer<typeof tripStumbleZ>;

export const TripStumble: React.FC<Arch & TripStumbleProps> = ({ t, cat = true, catX = 800, walkFrom = 320, tripAt = 13 }) => {
  const pose: Pose = (() => {
    if (t < tripAt) return { ...walkP(lerp(walkFrom, 700, t / tripAt), t * 0.6), ...faceAt(t, [[0, 'neutral']]) };
    if (t < tripAt + 2) return { ...walkP(700, tripAt * 0.6), tilt: 16, sway: 14, armL: { a: 70, b: 30 }, armR: { a: 60, b: 20 }, ...faceAt(t, [[0, 'shock']]) };
    const p = clamp((t - tripAt - 2) / 23);
    const x = lerp(700, 1320, easeIn(p) * 0.4 + p * 0.6);
    const y0 = hipGround(700) - LEG_LEN * TRIP_SC;
    const y = lerp(y0, 830, p * p) - Math.sin(p * Math.PI) * 50;
    return {
      ...basePose,
      x,
      y,
      scale: TRIP_SC,
      yaw: 1,
      spin: t < tripAt + 9 ? lerp(0, 40, (t - tripAt) / 7) : lerp(40, 420, (t - tripAt - 9) / 16),
      armL: { a: 150, b: 20 },
      armR: { a: 150, b: 20 },
      legL: { a: 40, b: -60 },
      legR: { a: -30, b: -40 },
      ...faceAt(t, [[0, 'neutral'], [14, 'shock']]),
    };
  })();
  const shake = t >= tripAt && t < tripAt + 4 ? Math.sin(t * 3.1) * 7 : 0;
  return (
    <g transform={camT(clamp(pose.x + 80, 760, 1200) + shake, clamp(pose.y - 60, 420, 640), 1.12)}>
      <Stairwell t={t} id="ar-trip" />
      {cat ? <Cat x={catX} y={stepTop(catX)} mood={t >= tripAt ? 'alert' : 'sleep'} f={t} /> : null}
      <Hero look={LOOKS.pipHood} pose={pose} shadow={pose.spin === 0 ? 0.5 : 0} rimId="rimR" />
      <Banister />
    </g>
  );
};

// ---------- landedDizzy: top-down, the landing, the stars ----------
export const landedDizzyZ = z.object({
  cat: z.boolean().default(true),
  impactAt: z.number().int().nonnegative().default(3),
});
export type LandedDizzyProps = z.infer<typeof landedDizzyZ>;

export const LandedDizzy: React.FC<Arch & LandedDizzyProps> = ({ t, cat = true, impactAt = 3 }) => {
  const p = clamp(t / impactAt);
  const landed = t >= impactAt;
  const x = landed ? 960 : lerp(900, 960, p);
  const y = landed ? 620 : lerp(40, 620, easeIn(p));
  const rot = landed ? -24 : lerp(-260, -24, p);
  const pose: Pose = {
    ...basePose,
    x: 0,
    y: 0,
    scale: 1.25,
    squash: landed && t < impactAt + 5 ? 0.12 * (1 - (t - impactAt) / 5) : 0,
    armL: { a: 110, b: 20 },
    armR: { a: 100, b: -16 },
    legL: { a: -24, b: 4 },
    legR: { a: 28, b: 8 },
    ...faceAt(t, [[0, 'shock'], [4, 'dizzy']]),
  };
  const th = (rot * Math.PI) / 180;
  const head = { x: x + 150 * Math.sin(th), y: y - 150 * Math.cos(th) };
  const peek = clamp((t - 10) / 4);
  return (
    <g transform={`translate(960 540) rotate(${t * 0.15}) scale(${1 + t * 0.003}) translate(-960 -540)`}>
      {Array.from({ length: 26 }).map((_, i) => {
        const ty = -400 + i * 74;
        return (
          <g key={i}>
            <rect x={-400} y={ty} width={2720} height={74} fill={['#4E3833', '#47322D', '#4B3631'][i % 3]} />
            <path d={`M -400 ${ty} L 2320 ${ty}`} stroke="#2E211E" strokeWidth={3} />
          </g>
        );
      })}
      <ellipse cx={240} cy={1000} rx={440} ry={310} fill="#4A2C3A" />
      <ellipse cx={240} cy={1000} rx={386} ry={266} fill="none" stroke="#6A4252" strokeWidth={10} />
      <g filter="url(#blur16)">
        <path d="M 1150 180 L 1720 300 L 1560 980 L 990 860 Z" fill="#FFB46A" opacity={0.22} style={{ mixBlendMode: 'screen' }} />
      </g>
      <rect x={-400} y={-400} width={2720} height={500} fill="#6B4B42" />
      <rect x={700} y={-400} width={520} height={500} fill="#6A3644" />
      {cat && peek > 0 ? (
        <g transform={`translate(1380 ${60 + 44 * peek})`}>
          <path d="M -46 -10 L -36 -62 L -12 -30 Z M 46 -10 L 36 -62 L 12 -30 Z" fill="#3A3E57" />
          <ellipse cx={0} cy={0} rx={50} ry={40} fill="#3A3E57" />
          <circle cx={-16} cy={4} r={9} fill="#E8D86A" />
          <circle cx={16} cy={4} r={9} fill="#E8D86A" />
          <circle cx={-16} cy={4} r={3.5} fill="#111" />
          <circle cx={16} cy={4} r={3.5} fill="#111" />
        </g>
      ) : null}
      <g transform={`translate(${x} ${y}) rotate(${rot}) translate(0 70)`}>
        <Hero look={LOOKS.pipHood} pose={pose} shadow={0} rimId="rimR" />
      </g>
      <DizzyStars x={head.x} y={head.y} t={t >= 5 ? t : -1} />
    </g>
  );
};

// ---------- stepOver: the big step over the cat ----------
const STEP_SC = 0.9;

export const stepOverZ = z.object({
  cat: z.boolean().default(true),
  catX: z.number().default(800),
});
export type StepOverProps = z.infer<typeof stepOverZ>;

export const StepOver: React.FC<Arch & StepOverProps> = ({ t, len, cat = true, catX = 800 }) => {
  const walk = (x: number, phase: number, extra: Partial<Pose> = {}): Pose => ({ ...basePose, x, y: hipGround(x) - LEG_LEN * STEP_SC, scale: STEP_SC, ...extra });
  let pose: Pose;
  if (t < 7) {
    pose = walk(lerp(560, 640, clamp(t / 4)), Math.min(t, 4) * 0.6, { headTilt: kf(t, [[3, 0], [7, 18]]), look: 0.6 });
  } else if (t < 27) {
    const p = (t - 7) / 20;
    const lift = Math.sin(p * Math.PI);
    pose = {
      ...walk(lerp(640, 905, easeOut(p)), 0, { headTilt: 10 }),
      y: lerp(hipGround(640), hipGround(905), p) - LEG_LEN * STEP_SC - lift * 30,
      legR: { a: 20 + 75 * lift, b: -85 * lift },
      legL: { a: -12 - 10 * lift, b: -10 },
      armL: { a: 70 * lift, b: 30 },
      armR: { a: -50 * lift, b: 20 },
    };
  } else {
    pose = walk(lerp(905, 1060, (t - 27) / 19), (t - 27) * 0.6, { headTilt: -4 });
  }
  const squash = t >= 27 && t < 32 ? 0.08 * Math.sin(((t - 27) / 5) * Math.PI) : t >= 4 && t < 7 ? 0.06 * Math.sin(((t - 4) / 3) * Math.PI) : 0;
  return (
    <g transform={camT(kf(t, [[0, 700], [len, 960]]), kf(t, [[0, 400], [7, 420], [27, 560], [len, 640]]), 1.75)}>
      <Stairwell t={t + 194} id="ar-step" />
      {cat ? <Cat x={catX} y={stepTop(catX)} mood={t >= 32 ? 'peek' : 'sleep'} f={t} /> : null}
      <Hero look={LOOKS.pipHood} pose={{ ...pose, squash, ...faceAt(t, [[0, 'neutral'], [6, 'smug']]) }} shadow={0.4} rimId="rimR" />
      <Banister />
    </g>
  );
};

// ---------- wrongAnswer: the hand goes up, the board says no ----------
export const wrongAnswerZ = z.object({
  answer: z.string().default('54'),
  mark: z.enum(['x', 'check']).default('x'),
  laughAt: z.number().int().nonnegative().default(27),
});
export type WrongAnswerProps = z.infer<typeof wrongAnswerZ>;

export const WrongAnswer: React.FC<Arch & WrongAnswerProps> = ({ t, len, answer = '54', mark = 'x', laughAt = 27 }) => {
  const pose = poseAt(t, [
    { f: 0, p: { x: 1260, y: 760, yaw: -0.35, armL: { a: 10, b: -8 } } },
    { f: 6, p: { armL: { a: 160, b: -18 }, sway: 10 }, ease: easeOut },
    { f: 9, p: { armL: { a: 150, b: -12 }, sway: -4 } },
    { f: 13, p: { sway: 0 } },
    { f: 35, p: { armL: { a: 12, b: -8 }, headTilt: -8 } },
  ]);
  const laugh = t >= laughAt;
  return (
    <g transform={camT(kf(t, [[0, 1010], [len, 1050]]), kf(t, [[0, 540], [len, 530]]), kf(t, [[0, 1.7], [len, 1.8]]))}>
      <Classroom t={t + 240} solved={false} laugh={laugh ? 1 : 0} id="ar-wrong" />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, 'neutral'], [3, 'happy'], [25, 'oops']]) }} shadow={0} rimId="rimL" />
      <SchoolDesk x={1260} />
      <Tag x={1100} y={430} t={t - 13} text={answer} mark={mark} markT={12} />
      <Foreground blur={16}>
        <path d="M 520 680 Q 540 470 660 440 Q 790 410 840 520 Q 900 560 960 700 Z" fill="#14121C" />
      </Foreground>
    </g>
  );
};
