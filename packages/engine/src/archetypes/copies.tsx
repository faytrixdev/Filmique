import React from 'react';
import { z } from 'zod';
import type { ShotProps } from '../episode';
import type { Pose } from '../rig';
import { LOOKS, Hero, basePose, faceAt, joints, toWorld, reachAngle, LEG_LEN, HEAD, poseAt } from '../rig';
import { kf, clamp, easeOut, easeIn, rnd, settle, camT } from '../anim';
import { Glow, LightVeil } from '../light';
import { Foreground } from '../kit';
import { Sparkle, Marquee, PasteIn, Dial } from '../ui';import { Cat, Cookie, CookieTop, CookieStack, Plate, PlateTop, Paper, PaperStack } from '../props';
import { stand, Tabletop } from '../furnish';
import { Kitchen, KitchenIsland, KITCHEN, islandTop } from '../sets/kitchen';
import { Study, Desk } from '../sets/study';
import { Stairwell } from '../sets/stairwell';
import { Rooftop } from '../sets/rooftop';
import { Schematic, SCH, Arrow, SchLabel, DrawOn, PlantIcon } from '../sets/schematic';

type Arch = ShotProps & { uid?: string };

const CYAN = '#7FD4FF';

// ---------- selectCopy: the hero points at a thing, the selection box draws round it ----------
export const selectCopyZ = z.object({
  item: z.enum(['cookie', 'paper']).default('cookie'),
  copyAt: z.number().int().nonnegative().default(8),
});
export type SelectCopyProps = z.infer<typeof selectCopyZ>;

export const SelectCopy: React.FC<Arch & SelectCopyProps> = ({ t, len, uid = 'sc', item = 'cookie', copyAt = 8 }) => {
  if (item === 'paper') {
    const hand = { x: kf(t, [[0, 1020], [6, 930], [10, 945]]), y: kf(t, [[0, -60], [6, 150], [10, 132]]) };
    return (
      <g transform={`translate(960 540) rotate(${-2 + t * 0.05}) scale(${1 + t * 0.002}) translate(-960 -540)`}>
        <Tabletop edge={1400} />
        <Glow x={1100} y={420} r={720} o={0.3} />
        <g transform="rotate(-8 200 140)">
          <rect x={-60} y={-80} width={520} height={330} rx={18} fill="#24222E" />
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 10 }).map((__, c) => <rect key={`k${r}-${c}`} x={-36 + c * 44} y={-50 + r * 40} width={36} height={32} rx={5} fill="#33313E" />),
          )}
        </g>
        <rect x={1420} y={820} width={300} height={14} rx={7} fill="#E9C46A" transform="rotate(-28 1570 827)" />
        <rect x={160} y={900} width={380} height={40} fill="#D9C8A8" transform="rotate(-10 350 920)" />
        <Paper x={720} y={560} w={330} rot={-5} done />
        <Paper x={1220} y={560} w={330} rot={4} done={false} />
        <Marquee x={530} y={330} w={380} h={460} t={t - copyAt} color={CYAN} />
        <g filter="url(#rimR)">
          <path d={`M ${hand.x + 50} ${hand.y - 60} L ${hand.x + 300} ${hand.y - 520}`} stroke={LOOKS.pipHood.line} strokeWidth={128} strokeLinecap="round" />
          <path d={`M ${hand.x + 50} ${hand.y - 60} L ${hand.x + 300} ${hand.y - 520}`} stroke={LOOKS.pipHood.limb} strokeWidth={110} strokeLinecap="round" />
          <circle cx={hand.x} cy={hand.y} r={26} fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={6} />
        </g>
      </g>
    );
  }
  const cookiePt = islandTop(0.6, 0.45);
  const standPt = stand(KITCHEN, 0.42, 0.4);
  const base: Partial<Pose> = { x: standPt.x, y: standPt.y, scale: standPt.scale, yaw: 0.5, look: 0.8, armL: { a: 12, b: -8 } };
  const aimPose = { ...basePose, ...base };
  const aim = reachAngle(aimPose, { x: cookiePt.x, y: cookiePt.y - 30 });
  const pose = poseAt(t, [
    { f: 0, p: { ...base, armR: { a: 20, b: -10 } } },
    { f: 4, p: { armR: { a: aim - 8, b: -4 }, headTilt: 4 }, ease: easeOut },
    { f: 7, p: { armR: { a: aim + 3, b: 0 } } },
    { f: 10, p: { armR: { a: aim, b: 0 } } },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 990], [len, 1000]]), 600, kf(t, [[0, 1.85], [len, 1.95]]))}>
      <Kitchen t={t + 40} id={`ar-selc-${uid}`} />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, 'neutral'], [8, 'smug']]) }} rimId="rimR" shadow={0} />
      <KitchenIsland />
      <Plate x={cookiePt.x} y={cookiePt.y} s={0.7} />
      <Cookie x={cookiePt.x - 4} y={cookiePt.y - 8} s={0.85} />
      <Marquee x={cookiePt.x - 46} y={cookiePt.y - 50} w={88} h={50} t={t - copyAt} color={CYAN} />
      <Foreground blur={10}>
        <path d="M 1260 1000 Q 1300 760 1420 700 Q 1380 820 1400 1000 Z" fill="#0E1610" />
      </Foreground>
    </g>
  );
};

// ---------- pastePop: macro insert, the copy pops in with a cyan ring ----------
export const pastePopZ = z.object({
  item: z.enum(['cookie', 'paper']).default('cookie'),
  pasteAt: z.number().int().nonnegative().default(12),
});
export type PastePopProps = z.infer<typeof pastePopZ>;

export const PastePop: React.FC<Arch & PastePopProps> = ({ t, len, uid = 'pp', item = 'cookie', pasteAt = 12 }) => {
  const hand = { x: kf(t, [[0, 1300], [7, 1225], [11, 1210], [15, 1250]]), y: kf(t, [[0, 60], [7, 128], [11, 140], [15, 112]]) };
  return (
    <g transform={camT(960, kf(t, [[0, 520], [len, 540]]), kf(t, [[0, 1.0], [len, 1.06]]))}>
      <Tabletop edge={900} wood="#A89C8A" grain="#968A78" lip="#8E8474" kind="stone" floor="#2C2A30" floorLines="#232127" />
      <LightVeil id={`veil-${uid}`} lights={[[930, 430, 760]]} o={0.55} />
      <Glow x={930} y={400} r={620} o={0.35} />
      <circle cx={1470} cy={660} r={96} fill="#000" opacity={0.3} />
      <circle cx={1460} cy={650} r={88} fill="#C9D6DE" opacity={0.9} />
      <circle cx={1460} cy={650} r={70} fill="#F6F4EE" />
      <g transform="rotate(-14 240 160)">
        <rect x={-60} y={40} width={520} height={250} fill="#7A4A52" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={-60} y={70 + i * 70} width={520} height={14} fill="#E9C46A" opacity={0.7} />
        ))}
      </g>
      <PlateTop x={930} y={470} r={260} />
      {item === 'cookie' ? (
        <>
          <CookieTop x={820 - Math.max(0, settle(t - pasteAt, 10, 1.6, 4))} y={440} r={100} rot={20 + settle(t - pasteAt, 6, 1.6, 5)} />
          <PasteIn x={1050} y={520} t={t - pasteAt} color={CYAN} ring={120}>
            <CookieTop x={1050} y={520} r={100} rot={20} />
          </PasteIn>
        </>
      ) : (
        <>
          <Paper x={820} y={440} w={280} rot={-8} done={false} />
          <PasteIn x={1060} y={520} t={t - pasteAt} color={CYAN} ring={120}>
            <Paper x={1060} y={520} w={280} rot={6} done />
          </PasteIn>
        </>
      )}
      <Sparkle x={1140} y={420} t={t - pasteAt - 3} s={1.6} />
      <g filter="url(#rimR)">
        <path d={`M ${hand.x + 40} ${hand.y - 40} Q ${hand.x + 160} ${hand.y - 220} ${hand.x + 380} -360`} stroke={LOOKS.pipHood.line} strokeWidth={118} fill="none" strokeLinecap="round" />
        <path d={`M ${hand.x + 40} ${hand.y - 40} Q ${hand.x + 160} ${hand.y - 220} ${hand.x + 380} -360`} stroke={LOOKS.pipHood.limb} strokeWidth={100} fill="none" strokeLinecap="round" />
        <circle cx={hand.x} cy={hand.y} r={24} fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={6} />
      </g>
    </g>
  );
};

// ---------- copySwarm: wide kitchen, copies paste themselves along the counters, the hero cheers ----------
export const copySwarmZ = z.object({
  counterPiles: z.number().int().min(2).max(12).default(8),
  islandPiles: z.number().int().min(2).max(12).default(7),
});
export type CopySwarmProps = z.infer<typeof copySwarmZ>;

export const CopySwarm: React.FC<Arch & CopySwarmProps> = ({ t, len, uid = 'cs', counterPiles = 8, islandPiles = 7 }) => {
  const standPt = stand(KITCHEN, 0.5, 0.4);
  const counter = Array.from({ length: counterPiles }).map((_, i) => ({ p: KITCHEN.P(0.04 + (i * 0.66) / Math.max(1, counterPiles - 1), 0.7, 0.075), at: 2 + i * 3, n: 3 + ((i * 5) % 4) }));
  const island = Array.from({ length: islandPiles }).map((_, i) => ({ p: islandTop(0.31 + (i * 0.26) / Math.max(1, islandPiles - 1), 0.55), at: 4 + i * 3, n: 3 + ((i * 3) % 4) }));
  const pose = poseAt(t, [
    { f: 0, p: { x: standPt.x, y: standPt.y, scale: standPt.scale, yaw: 0, armL: { a: 30, b: 20 }, armR: { a: 30, b: 20 } } },
    { f: 4, p: { squash: 0.06 } },
    { f: 9, p: { armL: { a: 150, b: 10 }, armR: { a: 150, b: 10 }, squash: -0.05 }, ease: easeOut },
    { f: 13, p: { armL: { a: 142, b: 16 }, armR: { a: 142, b: 16 }, squash: 0 } },
  ]);
  const cat = KITCHEN.P(0.86, 1, 0.66);
  return (
    <g transform={camT(960, kf(t, [[0, 560], [len, 570]]), kf(t, [[0, 0.98], [len, 1.03]]))}>
      <Kitchen t={t + 70} id={`ar-sw-${uid}`} veil={0.36} />
      {counter.map((c, i) => (
        <PasteIn key={`c${i}`} x={c.p.x} y={c.p.y - 20} t={t - c.at} color={CYAN} ring={40}>
          <CookieStack x={c.p.x} y={c.p.y} n={c.n} s={0.68} />
        </PasteIn>
      ))}
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, 'happy']]) }} rimId="rimR" shadow={0} />
      <KitchenIsland />
      {island.map((c, i) => (
        <PasteIn key={`i${i}`} x={c.p.x} y={c.p.y - 20} t={t - c.at} color={CYAN} ring={50}>
          <CookieStack x={c.p.x} y={c.p.y} n={c.n} s={0.95} />
        </PasteIn>
      ))}
      <Cat x={cat.x} y={cat.y} mood={t > 6 ? 'alert' : 'sleep'} f={t} />
    </g>
  );
};

// ---------- pasteStack: the study desk, a stack of finished work pops in ----------
export const pasteStackZ = z.object({
  item: z.enum(['paper', 'cookie']).default('paper'),
  n: z.number().int().min(2).max(14).default(9),
  pasteAt: z.number().int().nonnegative().default(12),
  leanAt: z.number().int().nonnegative().default(25),
});
export type PasteStackProps = z.infer<typeof pasteStackZ>;

export const PasteStack: React.FC<Arch & PasteStackProps> = ({ t, len, item = 'paper', n = 9, pasteAt = 12, leanAt = 25 }) => {
  const pose = poseAt(t, [
    { f: 0, p: { x: 900, y: 712, yaw: 0.4, look: 0.7, armL: { a: 14, b: -6 }, armR: { a: 50, b: 30 } } },
    { f: leanAt, p: { tilt: 3 } },
    { f: leanAt + 7, p: { tilt: -11, headTilt: -6, armL: { a: 160, b: 120 }, armR: { a: 160, b: 120 }, look: 0.2 }, ease: easeOut },
    { f: leanAt + 12, p: { tilt: -8 } },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 990], [len, 970]]), 590, kf(t, [[0, 1.8], [len, 1.9]]))}>
      <Study t={t + 120} id="ar-pstack" />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [leanAt - 1, 'smug']]) }} rimId="rimR" shadow={0} />
      <Desk x0={560} x1={1360} y={700} lamp={false} />
      <PasteIn x={1110} y={680} t={t - pasteAt} color={CYAN} ring={90}>
        {item === 'paper' ? <PaperStack x={1110} y={698} n={n} w={200} /> : <CookieStack x={1110} y={690} n={n} s={0.8} />}
      </PasteIn>
      <Sparkle x={1190} y={600} t={t - pasteAt - 4} s={0.9} />
      <Foreground blur={10}>
        <path d="M 1500 1000 Q 1380 800 1430 600 Q 1470 800 1580 980 Z" fill="#0E1610" />
      </Foreground>
    </g>
  );
};

// ---------- selectCharacter: over the shoulder, someone waves and the box selects them ----------
export const selectCharacterZ = z.object({
  cast: z.enum(['mo', 'suit', 'mom', 'sis', 'doc', 'ado', 'meme', 'agent']).default('mo'),
  selectAt: z.number().int().nonnegative().default(10),
});
export type SelectCharacterProps = z.infer<typeof selectCharacterZ>;

export const SelectCharacter: React.FC<Arch & SelectCharacterProps> = ({ t, len, cast = 'mo', selectAt = 10 }) => {
  const LANDING = 420;
  const MO_X = 300;
  const wave = Math.sin(t / 3) * 14;
  const mo = { ...basePose, x: MO_X, y: LANDING - LEG_LEN * 0.9, scale: 0.9, yaw: 0.25, look: 0.6, armR: { a: 150 + wave, b: 20 }, armL: { a: 10, b: -8 } };
  return (
    <g transform={camT(kf(t, [[0, 330], [len, 320]]), 270, kf(t, [[0, 1.55], [len, 1.62]]))}>
      <Stairwell t={t + 200} id="ar-selch" />
      <Hero look={LOOKS[cast]} pose={{ ...mo, ...faceAt(t, [[0, 'happy']]) }} rimId="rimL" shadow={0.5} />
      <Marquee x={MO_X - 92} y={50} w={184} h={380} t={t - selectAt} color={CYAN} />
      <Foreground blur={10}>
        <path d="M 520 680 Q 540 470 660 440 Q 790 410 840 520 Q 900 560 960 700 Z" fill="#14121C" />
        <circle cx={700} cy={400} r={120} fill="#1A1724" />
        <path d="M 580 380 Q 600 260 700 260 Q 800 260 820 380" stroke="#FFB46A" strokeWidth={5} fill="none" opacity={0.35} />
      </Foreground>
    </g>
  );
};

// ---------- copyCharacter: a second copy pops in, they turn and stare at each other ----------
export const copyCharacterZ = z.object({
  cast: z.enum(['mo', 'suit', 'mom', 'sis', 'doc', 'ado', 'meme', 'agent']).default('mo'),
  popAt: z.number().int().nonnegative().default(11),
  turnAt: z.number().int().nonnegative().default(15),
});
export type CopyCharacterProps = z.infer<typeof copyCharacterZ>;

export const CopyCharacter: React.FC<Arch & CopyCharacterProps> = ({ t, len, cast = 'mo', popAt = 11, turnAt = 15 }) => {
  const LANDING = 420;
  const mk = (x: number) => ({ ...basePose, x, y: LANDING - LEG_LEN * 0.9, scale: 0.9 });
  const turn = clamp((t - turnAt) / 5);
  const mo1 = poseAt(t, [
    { f: 0, p: { ...mk(330), yaw: 0.25, look: 0.6, armR: { a: 140, b: 20 } } },
    { f: turnAt - 1, p: {} },
    { f: turnAt + 4, p: { yaw: -0.55, look: -1, armR: { a: 40, b: 40 }, armL: { a: 40, b: 40 } }, ease: easeOut },
  ]);
  const mo2 = poseAt(t, [
    { f: 0, p: { ...mk(110), yaw: 0.25, look: 0.6, armR: { a: 140, b: 20 } } },
    { f: turnAt - 1, p: {} },
    { f: turnAt + 4, p: { yaw: 0.55, look: 1, armR: { a: 40, b: 40 }, armL: { a: 40, b: 40 } }, ease: easeOut },
  ]);
  const f = faceAt(t, [[0, 'happy'], [turnAt + 1, 'shock']]);
  return (
    <g transform={camT(kf(t, [[0, 230], [len, 225]]), 270, kf(t, [[0, 1.6], [len, 1.66]]))}>
      <Stairwell t={t + 241} id="ar-cch" />
      <Hero look={LOOKS[cast]} pose={{ ...mo1, ...f }} rimId="rimL" shadow={0.5} />
      <PasteIn x={110} y={250} t={t - popAt} color={CYAN} ring={140}>
        <Hero look={LOOKS[cast]} pose={{ ...mo2, ...f }} rimId="rimR" shadow={0.5} />
      </PasteIn>
      {turn > 0 ? <Sparkle x={220} y={70} t={t - popAt - 6} s={0.7} /> : null}
    </g>
  );
};

// ---------- uneasyCopies: close-up, the hero uneasy, the copies soft behind ----------
export const uneasyCopiesZ = z.object({
  copies: z.number().int().min(1).max(3).default(2),
  cast: z.enum(['mo', 'suit', 'mom', 'sis', 'doc', 'ado', 'meme', 'agent']).default('mo'),
  startAt: z.number().int().nonnegative().default(16),
});
export type UneasyCopiesProps = z.infer<typeof uneasyCopiesZ>;

export const UneasyCopies: React.FC<Arch & UneasyCopiesProps> = ({ t, len, uid = 'uc', copies = 2, cast = 'mo', startAt = 16 }) => {
  const sc = 3.6 * (1 + 0.04 * clamp(t / len));
  const head = { x: 1180, y: 560 };
  const pose: Pose = { ...basePose, x: head.x, y: head.y - HEAD.y * sc, scale: sc, yaw: -0.3, look: -0.7, armL: { a: 14, b: -6 }, armR: { a: 14, b: -6 }, headTilt: kf(t, [[0, 0], [10, -6]]), ...faceAt(t, [[0, 'oops'], [startAt, 'worried']]) };
  const mk = (x: number): Pose => ({ ...basePose, x, y: 420 - LEG_LEN * 0.9, scale: 0.9, yaw: 0.6, look: 1, armL: { a: 30, b: 30 }, armR: { a: 30, b: 30 } });
  const behind = [110, -80, 260].slice(0, copies);
  return (
    <g>
      <g filter="url(#blur16)">
        <g transform="translate(420 -40) scale(1.9)">
          <Stairwell t={t + 266} id={`ar-uc-${uid}`} />
          {behind.map((bx, i) => (
            <Hero key={i} look={LOOKS[cast]} pose={mk(bx)} rimId="rimR" shadow={0} />
          ))}
        </g>
      </g>
      <rect x={0} y={0} width={1920} height={1080} fill="#07040C" opacity={0.25} />
      <Hero look={LOOKS.pipHood} pose={pose} rimId="rimL" shadow={0} />
    </g>
  );
};

// ---------- bitePause: low angle on the roof, he stops mid-bite and looks at the cookie ----------
export const bitePauseZ = z.object({
  bite: z.number().min(0).max(2).default(1),
});
export type BitePauseProps = z.infer<typeof bitePauseZ>;

export const BitePause: React.FC<Arch & BitePauseProps> = ({ t, len, bite = 1 }) => {
  const pose = poseAt(t, [
    { f: 0, p: { x: 900, y: 790, scale: 1.8, yaw: 0.3, look: 0.4, armL: { a: 16, b: 6 }, armR: { a: 140, b: 115 }, headTilt: 4 } },
    { f: 8, p: { armR: { a: 118, b: 100 }, look: 0.9, headTilt: 10 }, ease: easeOut },
  ]);
  const j = joints(pose);
  const h = toWorld(pose, j.armR.end);
  return (
    <g transform={camT(960, 540, kf(t, [[0, 1.0], [len, 1.05]]))}>
      <Rooftop t={t + 66} sunX={1250} sunY={560} low={260} />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [6, 'neutral']]) }} rimId="rimR" shadow={0} />
      <Cookie x={h.x + 6} y={h.y + 30} s={2.2} rot={-14} bite={bite} seed={10} />
    </g>
  );
};

// ---------- ghostFlicker: macro, the outline flickers like an unstable copy ----------
const BigCookie: React.FC<{ x: number; y: number; id: string }> = ({ x, y, id }) => (
  <g>
    <defs>
      <mask id={id}>
        <rect x={x - 400} y={y - 300} width={800} height={600} fill="#fff" />
        <circle cx={x + 250} cy={y - 60} r={80} fill="#000" />
        <circle cx={x + 200} cy={y - 140} r={60} fill="#000" />
      </mask>
    </defs>
    <g mask={`url(#${id})`}>
      <ellipse cx={x} cy={y + 34} rx={280} ry={150} fill="#9A6234" />
      <g transform={`translate(${x} ${y}) scale(1 0.52)`}>
        <CookieTop x={0} y={0} r={280} rot={10} />
      </g>
    </g>
  </g>
);

export const ghostFlickerZ = z.object({
  item: z.enum(['cookie']).default('cookie'),
  warn: z.boolean().default(true),
});
export type GhostFlickerProps = z.infer<typeof ghostFlickerZ>;

export const GhostFlicker: React.FC<Arch & GhostFlickerProps> = ({ t, len, item = 'cookie', warn = true }) => {
  void item;
  const g = Math.floor(t / 2);
  const jx = (rnd(g, 1) - 0.5) * 22;
  const jy = (rnd(g, 2) - 0.5) * 10;
  const on = rnd(g, 3) > 0.4;
  const c = { x: 940, y: 520 };
  return (
    <g transform={camT(960, 540, kf(t, [[0, 1.0], [len, 1.08]]))}>
      <g filter="url(#blur16)">
        <g transform="translate(-700 -500) scale(1.9)">
          <Rooftop t={t + 93} sunX={1100} sunY={560} low={200} />
        </g>
      </g>
      <rect x={-400} y={-400} width={2720} height={1880} fill="#07040C" opacity={0.25} />
      <g filter="url(#rimR)">
        <path d="M 1180 1400 Q 1080 1060 1000 820" stroke={LOOKS.pipHood.line} strokeWidth={190} fill="none" strokeLinecap="round" />
        <path d="M 1180 1400 Q 1080 1060 1000 820" stroke={LOOKS.pipHood.limb} strokeWidth={164} fill="none" strokeLinecap="round" />
        <ellipse cx={960} cy={700} rx={230} ry={120} fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={10} />
      </g>
      <g opacity={on ? 0.45 : 0.15} style={{ mixBlendMode: 'screen' }}>
        <g transform={`translate(${jx + 14} ${jy})`}>
          <BigCookie x={c.x} y={c.y} id="s11ghost" />
        </g>
      </g>
      <BigCookie x={c.x} y={c.y} id="s11bite" />
      <g filter="url(#rimR)">
        <ellipse cx={720} cy={560} rx={60} ry={96} fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={10} transform="rotate(30 720 560)" />
        {[[1150, 600, -20], [1185, 660, -35], [1170, 722, -50]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={46} ry={34} fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={9} transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
      {on ? <rect x={600 + jx} y={330 + jy} width={680} height={400} fill="none" stroke={CYAN} strokeWidth={7} strokeDasharray="26 16" opacity={0.9} /> : null}
      {warn ? <rect x={600 - jx * 0.6} y={330} width={680} height={400} fill="none" stroke="#FF5A6A" strokeWidth={4} strokeDasharray="26 16" opacity={on ? 0.4 : 0} /> : null}
    </g>
  );
};

// ---------- plantGrid: the schematic, every power plant lights up, the dial runs over ten minutes ----------
export const plantGridZ = z.object({
  title: z.string().default(''),
  maxMinutes: z.number().positive().default(0),
  unit: z.string().default(''),
  over: z.string().default(''),
  runAt: z.number().int().nonnegative().default(14),
  span: z.number().int().positive().default(66),
});
export type PlantGridProps = z.infer<typeof plantGridZ>;

export const PlantGrid: React.FC<Arch & PlantGridProps> = ({ t, title = '', maxMinutes = 0, unit = '', over = '', runAt = 14, span = 66 }) => {
  const KINDS: ('tower' | 'wind' | 'solar' | 'dam' | 'factory')[] = ['tower', 'wind', 'solar', 'dam', 'factory'];
  const mins = maxMinutes * Math.pow(easeIn(clamp((t - runAt) / span)), 0.6);
  const read = `${String(Math.floor(mins)).padStart(2, '0')}:${String(Math.floor((mins % 1) * 60 + 0.01)).padStart(2, '0')}`;
  const p = maxMinutes > 0 ? clamp(mins / maxMinutes) : 0;
  return (
    <g>
      <Schematic t={t + 62} id="ar-schpg" />
      <SchLabel x={620} y={160} t={t - 2} text={title} size={50} />
      {Array.from({ length: 15 }).map((_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const order = (col * 3 + row * 7) % 15;
        return <PlantIcon key={i} x={220 + col * 200} y={330 + row * 230} kind={KINDS[(i + row) % 5]} on={clamp((t - 4 - order * 3) / 6)} t={t} s={0.95} />;
      })}
      <Dial x={1500} y={500} p={p} readout={read} r={210} size={92} />
      <SchLabel x={1500} y={800} t={t - 10} text={unit} size={36} color={SCH.dim} />
      {mins > Math.max(10, maxMinutes * 0.8) ? <SchLabel x={1500} y={220} t={t - runAt - span} text={over} size={50} color={SCH.live} /> : null}
    </g>
  );
};
