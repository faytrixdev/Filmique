import React from 'react';
import { z } from 'zod';
import type { ShotProps } from '../episode';
import type { CastName, Pose } from '../rig';
import { LOOKS, basePose, poseAt, faceAt, joints, toWorld, walkPose, LEG_LEN, HEAD } from '../rig';
import { kf, clamp, easeOut, easeIn, backOut, rnd, settle, wob, camT } from '../anim';
import { Glow, LightVeil } from '../light';
import { Foreground } from '../kit';
import { Cat, Mug, OpenBook, CookieTop, CookieStack } from '../props';
import { Hero } from '../rig';
import { Sparkle, Tag, TitleCard, PasteIn, FocusRings } from '../ui';
import { stand, Tabletop } from '../furnish';
import { FONT } from '../fonts';
import { Kitchen, KitchenIsland, KITCHEN, islandTop } from '../sets/kitchen';
import { Study, Desk } from '../sets/study';
import { Classroom, SchoolDesk } from '../sets/classroom';
import { Rooftop } from '../sets/rooftop';
import { Schematic, SCH, Arrow, SchLabel, DrawOn, CountUp } from '../sets/schematic';
import { BankPhone, Ring, CoinHead, CoinPile, Cake, BalanceChip, GOLD, GOLD_L, fmtEur } from './widgets';

// The archetype catalogue: one component per recurring shot motif. Props are plain
// values (labels, numbers, booleans) the LLM fills in — never raw SVG. Each
// choreography is fixed; the parameters move only what the feed reads. Props carry
// Zod defaults so an empty archetypeProps always parses.

type Arch = ShotProps & { uid?: string };

// ---------- wideRoom (S1/S3/S10): the wide room, the hero by the island, a phone reading ----------
export const wideRoomZ = z.object({
  mood: z.enum(['curious', 'cheer', 'uneasy']).default('curious'),
  room: z.enum(['kitchen', 'study']).default('kitchen'),
  phone: z.string().default(''),
  glow: z.number().min(0).max(1).default(0.6),
  ring: z.boolean().default(false),
  buzz: z.boolean().default(false),
  cake: z.boolean().default(false),
  candles: z.string().default('16'),
  deadCandle: z.boolean().default(false),
});
export type WideRoomProps = z.infer<typeof wideRoomZ>;

const STAND = stand(KITCHEN, 0.4, 0.4);
const WIDE_FACE: Record<WideRoomProps['mood'], [number, Pose['expr']][]> = {
  curious: [[0, 'neutral'], [12, 'happy']],
  cheer: [[0, 'happy'], [20, 'smug']],
  uneasy: [[0, 'oops'], [9, 'worried']],
};

export const WideRoom: React.FC<Arch & WideRoomProps> = ({ t, len, uid = 'wr', mood = 'curious', room = 'kitchen', phone = '', glow = 0.6, ring = false, buzz = false, cake = false, candles = '16', deadCandle = false }) => {
  const study = room === 'study';
  const phonePt = study ? { x: 1180, y: 664 } : islandTop(0.5, 0.42);
  const cakePt = islandTop(0.68, 0.5);
  const standPt = study ? { x: 960, y: 712, scale: STAND.scale } : STAND;
  const pose =
    !study && mood === 'cheer'
      ? poseAt(t, [
          { f: 0, p: { x: STAND.x, y: STAND.y, scale: STAND.scale, yaw: 0.1, look: 0.55, armL: { a: 26, b: 16 }, armR: { a: 26, b: 16 } } },
          { f: 4, p: { squash: 0.05 } },
          { f: 9, p: { armL: { a: 152, b: 8 }, armR: { a: 148, b: 10 }, squash: -0.06, headTilt: -4 }, ease: easeOut },
          { f: 14, p: { armL: { a: 144, b: 16 }, armR: { a: 140, b: 18 }, squash: 0 } },
          { f: 22, p: { armL: { a: 140, b: 18 }, armR: { a: 136, b: 20 } } },
        ])
      : !study && mood === 'uneasy'
        ? poseAt(t, [
            { f: 0, p: { x: STAND.x, y: STAND.y, scale: STAND.scale, yaw: 0.25, look: 0.85, armL: { a: 16, b: -8 }, armR: { a: 26, b: 24 }, headTilt: 5 } },
            { f: 8, p: { headTilt: 11, look: 1, armR: { a: 20, b: 18 } }, ease: easeOut },
            { f: 18, p: { headTilt: 4, armR: { a: 30, b: 22 } }, ease: easeOut },
          ])
        : study
          ? poseAt(t, [
              { f: 0, p: { x: standPt.x, y: standPt.y, scale: standPt.scale, yaw: 0.5, look: 0.6, armL: { a: 14, b: -8 }, armR: { a: 22, b: -10 } } },
              { f: 6, p: { armR: { a: 74, b: 26 }, headTilt: 3 }, ease: easeOut },
              { f: 14, p: { armR: { a: 70, b: 22 } } },
              { f: 22, p: { headTilt: -4 } },
            ])
          : poseAt(t, [
              { f: 0, p: { x: STAND.x, y: STAND.y, scale: STAND.scale, yaw: 0.35, look: 0.75, armL: { a: 14, b: -8 }, armR: { a: 22, b: -10 }, headTilt: 0 } },
              { f: 14, p: { headTilt: 6, look: 0.95, armR: { a: 30, b: 30 } }, ease: easeOut },
              { f: 22, p: { headTilt: 9, armR: { a: 26, b: 26 } } },
            ]);
  if (study)
    return (
      <g transform={camT(kf(t, [[0, 990], [len, 1000]]), 545, kf(t, [[0, 0.86], [len, 0.93]]))}>
        <Study t={t + 110} id={`ar-wr-${uid}`} />
        {phone ? <BankPhone x={phonePt.x} y={phonePt.y - 10} w={66} rot={-5} value={phone} glow={glow} gold={mood === 'cheer'} /> : null}
        {ring && phone ? <Ring x={phonePt.x} y={phonePt.y - 16} t={t - 2} sx={1.4} sy={0.8} /> : null}
        <Desk x0={560} x1={1360} y={700} lamp={false} laptop={false} />
        <g transform={`translate(1120 ${700 + wob(t, 6, 3, 26)})`}>
          <Mug x={0} y={0} rot={wob(t, 12, 1.6, 0) - 20} f={t} steam={0.5} />
        </g>
        <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, WIDE_FACE[mood]) }} rimId="rimR" shadow={0} />
        <Foreground blur={10}>
          <path d="M 320 1030 Q 380 760 330 620 Q 300 800 190 1030 Z" fill="#0E1218" />
          <ellipse cx={1740} cy={1040} rx={300} ry={170} fill="#100D15" />
        </Foreground>
      </g>
    );
  return (
    <g transform={camT(kf(t, [[0, 940], [len, 960]]), 588, kf(t, [[0, 0.98], [len, 1.06]]))}>
      <Kitchen t={t + 40} id="ar-k" veil={mood === 'curious' ? 0.34 : 0.5} />
      {mood === 'curious' ? <Cat x={1330} y={KITCHEN.P(0.9, 1, 0.7).y} mood="sleep" f={t} /> : null}
      {phone ? <BankPhone x={phonePt.x} y={phonePt.y - 34} w={58} rot={buzz && t > 12 ? Math.sin(t * 0.9) * 5 : -4} value={phone} glow={glow} gold={mood === 'cheer'} /> : null}
      {ring && phone ? <Ring x={phonePt.x} y={phonePt.y - 40} t={t - 2} sx={1.4} sy={0.8} /> : null}
      {cake ? <Cake x={cakePt.x} y={cakePt.y} s={0.72} t={t + 60} candles={candles} deadCandle={deadCandle ? 0 : -1} smoke={deadCandle ? 1 : 0} /> : null}
      <KitchenIsland />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, WIDE_FACE[mood]) }} rimId="rimR" shadow={mood === 'curious' ? 0.6 : 0} />
      <Foreground blur={10}>
        {mood === 'curious' ? (
          <>
            <ellipse cx={240} cy={1020} rx={340} ry={200} fill="#141019" />
            <ellipse cx={1720} cy={1060} rx={320} ry={180} fill="#100D15" />
          </>
        ) : mood === 'cheer' ? (
          <ellipse cx={330} cy={1040} rx={330} ry={190} fill="#120F17" />
        ) : (
          <>
            <ellipse cx={360} cy={1030} rx={340} ry={190} fill="#120F17" />
            <ellipse cx={1680} cy={1070} rx={300} ry={170} fill="#0E0B12" />
          </>
        )}
      </Foreground>
    </g>
  );
};

// ---------- phoneJump (S2): macro on the phone, the balance jumps to a new value ----------
export const phoneJumpZ = z.object({
  fromEur: z.number().default(312.44),
  toEur: z.number().max(9999999).default(1000000),
  jumpAt: z.number().int().nonnegative().default(5),
  settleAt: z.number().int().positive().default(18),
  sparkleAt: z.number().int().nonnegative().default(20),
  cake: z.boolean().default(false),
  handc: z.boolean().default(true),
});
export type PhoneJumpProps = z.infer<typeof phoneJumpZ>;

export const PhoneJump: React.FC<Arch & PhoneJumpProps> = ({ t, len, uid = 'pj', fromEur, toEur, jumpAt, settleAt, sparkleAt, cake, handc }) => {
  const roll = fromEur + (toEur - fromEur) * easeOut(clamp((t - jumpAt) / 13));
  const value = t < jumpAt ? fmtEur(fromEur) : t < settleAt ? fmtEur(roll) : fmtEur(toEur);
  const jx = t >= jumpAt && t < settleAt ? (rnd(Math.floor(t), 3) - 0.5) * 6 : 0;
  const hand = { x: kf(t, [[0, 1150], [8, 1080], [12, 1072], [18, 1096]]), y: kf(t, [[0, 240], [8, 330], [12, 338], [18, 318]]) };
  return (
    <g transform={camT(960, kf(t, [[0, 500], [len, 530]]), kf(t, [[0, 1.05], [len, 1.14]]))}>
      <Tabletop edge={880} wood="#7A6A58" grain="#6A5C4C" lip="#5E5446" kind="stone" floor="#26222C" floorLines="#1F1C25" />
      <LightVeil id={`veil-${uid}`} lights={[[930, 400, 800]]} o={0.55} />
      <Glow x={930} y={380} r={640} o={0.32} />
      {cake ? (
        <g transform="rotate(-16 200 140)">
          <rect x={-80} y={30} width={560} height={230} fill="#7A4A52" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={-80} y={64 + i * 66} width={560} height={13} fill={GOLD} opacity={0.55} />
          ))}
          <circle cx={275} cy={420} r={88} fill="#B98A5A" />
          <circle cx={275} cy={420} r={70} fill="#8A5A3A" />
        </g>
      ) : null}
      <ellipse cx={930} cy={640} rx={280} ry={36} fill="#000" opacity={0.4} />
      <BankPhone x={930 + jx} y={470} w={230} rot={-7} value={value} glow={t >= settleAt ? 1 : 0.35} gold={t >= settleAt} />
      <Ring x={930} y={470} t={t - (settleAt - jumpAt * 2 + 4)} sx={2.1} sy={1.2} />
      {handc ? (
        <g>
          <g filter="url(#rimR)">
            <path d={`M ${hand.x + 300} ${hand.y - 480} Q ${hand.x + 130} ${hand.y - 130} ${hand.x} ${hand.y}`} stroke={LOOKS.pipHood.line} strokeWidth={70} fill="none" strokeLinecap="round" />
            <path d={`M ${hand.x + 300} ${hand.y - 480} Q ${hand.x + 130} ${hand.y - 130} ${hand.x} ${hand.y}`} stroke={LOOKS.pipHood.limb} strokeWidth={56} fill="none" strokeLinecap="round" />
          </g>
          <ellipse cx={930} cy={640} rx={280} ry={36} fill="#000" opacity={0.4} />
          <BankPhone x={930 + jx} y={470} w={230} rot={-7} value={value} glow={t >= settleAt ? 1 : 0.35} gold={t >= settleAt} />
          <circle cx={hand.x - 22} cy={hand.y - 30} r={24} fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={7} />
        </g>
      ) : null}
      <Mug x={1600} y={820} rot={-24} f={t} steam={0.4} />
      {t >= sparkleAt ? <Sparkle x={1100} y={330} t={t - sparkleAt} s={1.5} /> : null}
    </g>
  );
};

// ---------- phoneDrain (S8): the balance bleeds out over the purchases ----------
export const phoneDrainZ = z.object({
  fromEur: z.number().default(1000000),
  toEur: z.number().default(12),
  startAt: z.number().int().nonnegative().default(5),
  drains: z.array(z.object({ at: z.number().int().nonnegative(), text: z.string() })).default([{ at: 9, text: '- 249,99 €' }, { at: 17, text: '- 4 800,00 €' }, { at: 25, text: '- 12 000,00 €' }]),
  glowEnd: z.number().min(0).max(1).default(0.45),
  sparkleAt: z.number().int().nonnegative().default(28),
  handIn: z.boolean().default(true),
});
export type PhoneDrainProps = z.infer<typeof phoneDrainZ>;

export const PhoneDrain: React.FC<Arch & PhoneDrainProps> = ({ t, len, uid = 'pd', fromEur, toEur, startAt, drains, glowEnd, sparkleAt, handIn }) => {
  const span = 26;
  const k = easeIn(clamp((t - startAt) / span));
  const v = fromEur - (fromEur - toEur) * k;
  const value = t < startAt ? fmtEur(fromEur) : fmtEur(v);
  const lastDrain = drains.reduce((m, d) => Math.max(m, d.at), 0);
  return (
    <g transform={camT(960, kf(t, [[0, 520], [len, 545]]), kf(t, [[0, 1.02], [len, 1.1]]))}>
      <Tabletop edge={920} wood="#7A6A58" grain="#6A5C4C" lip="#5E5446" kind="stone" floor="#241F28" floorLines="#1D191F" />
      <LightVeil id={`veil-${uid}`} lights={[[930, 390, 800]]} o={0.5} />
      <Glow x={930} y={380} r={620} o={0.3} />
      <Mug x={1430} y={600} rot={-12} f={t} steam={0.2} />
      <g transform="rotate(-10 275 810)">
        <rect x={40} y={700} width={470} height={220} rx={16} fill="#2E3A5E" />
        <path d="M 90 700 L 90 920 M 210 700 L 210 920" stroke={GOLD} strokeWidth={11} opacity={0.8} />
      </g>
      <ellipse cx={930} cy={650} rx={280} ry={36} fill="#000" opacity={0.42} />
      <BankPhone x={930} y={470} w={230} rot={-5} value={value} glow={t >= lastDrain + 2 ? glowEnd : 0.85} gold={t < startAt} />
      <g transform="translate(930 470)">
        {drains.map((d, i) => {
          if (t <= d.at) return null;
          const o = 1 - clamp((t - d.at - 16) / 8);
          if (o <= 0) return null;
          return (
            <text key={i} y={-140 - (t - d.at) * 2.2} textAnchor="middle" fontFamily={FONT.ui} fontSize={24} fill="#FF8A6A" opacity={o}>
              {d.text}
            </text>
          );
        })}
      </g>
      {handIn ? (
        <g>
          <g filter="url(#rimR)">
            <path d="M 760 60 Q 850 240 890 400 Q 896 428 902 444" stroke={LOOKS.pipHood.line} strokeWidth={64} fill="none" strokeLinecap="round" />
            <path d="M 760 60 Q 850 240 890 400 Q 896 428 902 444" stroke={LOOKS.pipHood.limb} strokeWidth={50} fill="none" strokeLinecap="round" />
          </g>
          <circle cx={890} cy={430} r={26} fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={7} />
        </g>
      ) : null}
      {t >= sparkleAt ? <Sparkle x={1210} y={330} t={t - sparkleAt} s={0.7} /> : null}
    </g>
  );
};

// ---------- phoneRestore (S9): extreme close on the screen, it rewrites itself back ----------
export const phoneRestoreZ = z.object({
  fromEur: z.number().default(12),
  toEur: z.number().max(9999999).default(1000000),
  at: z.number().int().nonnegative().default(9),
  pill: z.string().default('SOLDE RESTAURÉ'),
});
export type PhoneRestoreProps = z.infer<typeof phoneRestoreZ>;

export const PhoneRestore: React.FC<Arch & PhoneRestoreProps> = ({ t, len, fromEur, toEur, at, pill }) => {
  const snap = clamp((t - at) / 9);
  const v = t < at ? fromEur : fromEur + (toEur - fromEur) * backOut(snap);
  const value = t < at ? fmtEur(fromEur) : fmtEur(v);
  const jitter = t >= at && t < at + 12 ? (rnd(Math.floor(t), 4) - 0.5) * 8 : 0;
  const pulse = t >= at + 12 ? 1 + Math.sin((t - at - 12) / 4.2) * 0.015 : 1;
  return (
    <g transform={camT(935, 490, kf(t, [[0, 1.55], [len, 1.7]]))}>
      <Tabletop edge={920} wood="#6A5C4C" grain="#5C5044" lip="#504638" kind="stone" floor="#201B24" floorLines="#191520" />
      <LightVeil id="veil-pr" lights={[[935, 400, 700]]} o={0.42} />
      <Glow x={935} y={390} r={520} o={0.26} />
      <ellipse cx={930} cy={660} rx={300} ry={40} fill="#000" opacity={0.4} />
      <g transform={`translate(${930 + jitter} 470) scale(${pulse}) rotate(-6)`}>
        <g filter="url(#rimR)">
          <path d="M 150 -430 Q 120 -240 60 -140" stroke={LOOKS.pipHood.line} strokeWidth={64} fill="none" strokeLinecap="round" />
          <path d="M 150 -430 Q 120 -240 60 -140" stroke={LOOKS.pipHood.limb} strokeWidth={50} fill="none" strokeLinecap="round" />
        </g>
        <rect x={-115} y={-231} width={230} height={472} rx={37} fill="#16151C" stroke="#3A3846" strokeWidth={5} />
        <rect x={-101} y={-217} width={202} height={444} rx={30} fill="#0B0A10" />
        <Glow x={0} y={30} r={260} kind="cool" o={t < at ? 0.25 : 0.95} />
        <text y={-112} textAnchor="middle" fontFamily={FONT.ui} fontSize={28} fill="#7E8DA6" letterSpacing={4}>
          SOLDE
        </text>
        <text y={78} textAnchor="middle" fontFamily={FONT.ui} fontSize={t < at ? 52 : 38} fontWeight={700} fill={t < at ? '#F6EFE3' : GOLD_L}>
          {value}
        </text>
        {t >= at + 11 && pill ? (
          <text y={140} textAnchor="middle" fontFamily={FONT.ui} fontSize={19} fill="#7E8DA6" letterSpacing={3} opacity={clamp((t - at - 11) / 5)}>
            {pill}
          </text>
        ) : null}
        <rect x={-28} y={-207} width={56} height={12} rx={6} fill="#000" />
      </g>
      <Ring x={935} y={500} t={(t - at) * 1.25} r0={150} sx={1.6} sy={1.15} />
      <Ring x={935} y={500} t={(t - at - 6) * 1.1} r0={200} sx={1.35} sy={1.05} color="#E9C46A" />
    </g>
  );
};

// ---------- tagObject (S4): the study desk, the object on it gets a tag ----------
export const tagObjectZ = z.object({
  tag: z.string().default('PAYÉ'),
  mark: z.enum(['x', 'check']).default('check'),
});
export type TagObjectProps = z.infer<typeof tagObjectZ>;

export const TagObject: React.FC<Arch & TagObjectProps> = ({ t, len, tag, mark }) => {
  const pose = poseAt(t, [
    { f: 0, p: { x: 870, y: 712, yaw: 0.4, look: 0.6, armL: { a: 12, b: -6 }, armR: { a: 40, b: 40 } } },
    { f: 6, p: { armR: { a: 66, b: 30 }, headTilt: 2 }, ease: easeOut },
    { f: 13, p: { armR: { a: 62, b: 26 } } },
    { f: 19, p: { headTilt: -5 } },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 1000], [len, 1020]]), 605, kf(t, [[0, 1.78], [len, 1.88]]))}>
      <Study t={t + 110} id="ar-to" />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [19, 'smug']]) }} rimId="rimR" shadow={0} />
      <Desk x0={560} x1={1360} y={700} lamp={false} laptop={false} />
      <g>
        <ellipse cx={1180} cy={692} rx={110} ry={16} fill="#000" opacity={0.35} />
        <path d="M 1120 700 L 1120 540 Q 1120 524 1136 524 L 1224 524 Q 1240 524 1240 540 L 1240 700 Z" fill="#2E3A5E" />
        <path d="M 1120 700 L 1120 540 Q 1120 524 1136 524 L 1224 524 Q 1240 524 1240 540 L 1240 700 Z" fill="none" stroke="#1C2438" strokeWidth={5} />
        <rect x={1104} y={536} width={152} height={26} rx={10} fill="#3E4C74" />
        <path d="M 1128 524 L 1128 700 M 1232 524 L 1232 700" stroke={GOLD} strokeWidth={9} opacity={0.85} />
        <path d="M 1120 610 Q 1180 646 1240 610" stroke={GOLD} strokeWidth={9} opacity={0.85} />
        <ellipse cx={1180} cy={512} rx={44} ry={14} fill="#23211C" />
        <rect x={1136} y={496} width={88} height={22} rx={11} fill="#2C2A24" />
        <circle cx={1160} cy={498} r={7} fill="#7FD4FF" />
        <circle cx={1200} cy={498} r={7} fill="#F1708A" />
      </g>
      <Tag x={1180} y={436} t={t - 8} text={tag} mark={mark} w={172} />
      <Foreground blur={10}>
        <path d="M 320 1030 Q 380 760 330 620 Q 300 800 190 1030 Z" fill="#0E1218" />
      </Foreground>
    </g>
  );
};

// ---------- pilesLand (S5/S7): top-down, piles land on the tabletop, a hand plays ----------
export const pilesLandZ = z.object({
  piles: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), n: z.number().int().min(2).max(9), at: z.number().int().nonnegative() })).default([]),
  slide: z.boolean().default(false),
  book: z.boolean().default(false),
});
export type PilesLandProps = z.infer<typeof pilesLandZ>;

const fallY = (t: number, at: number, y: number, off: number, dur = 9) => {
  const k = easeIn(clamp((t - at) / dur));
  const bounce = k >= 1 ? settle(t - at - dur, 8, 1.5, 16) : 0;
  return (1 - k) * (y - off) + y * k + bounce;
};

export const PilesLand: React.FC<Arch & PilesLandProps> = ({ t, piles, slide, book }) => {
  const piles_ = piles.length
    ? piles
    : slide
      ? [{ x: 930 / 1920, y: 0.35, n: 7, at: 3 }]
      : [
          { x: 560 / 1920, y: 0.72, n: 6, at: 9 },
          { x: 860 / 1920, y: 0.51, n: 7, at: 13 },
          { x: 1140 / 1920, y: 0.86, n: 4, at: 17 },
          { x: 980 / 1920, y: 0.24, n: 3, at: 21 },
        ];
  const xDen = (n: number) => 960 + (n - 0.5) * 880;
  const yDen = (u: number) => 340 + u * 420;
  const coinFly = clamp((t - 1) / 8.5);
  const coin = { x: 1330 - coinFly * 770, y: 190 + coinFly * 450 - Math.sin(Math.PI * coinFly) * 250 };
  return (
    <g transform={`translate(960 540) rotate(${-1.5 + t * 0.01}) scale(${1 + t * 0.0016}) translate(-960 -540)`}>
      <Tabletop edge={slide || book ? 1120 : 900} wood={slide ? '#B0A088' : undefined} grain={slide ? '#9C8C74' : undefined} lip={slide ? '#8E8068' : undefined} />
      <Glow x={900} y={470} r={700} o={0.28} />
      <LightVeil id="veil-pl" lights={[[900, 470, 720]]} o={0.48} />
      {book ? <OpenBook x={330} y={360} w={330} rot={-9} /> : null}
      <g transform="rotate(-14 1560 220)">
        <rect x={1380} y={130} width={420} height={280} rx={14} fill="#2E3A5E" />
        <path d="M 1420 130 L 1420 410 M 1540 130 L 1540 410" stroke={GOLD} strokeWidth={12} opacity={0.85} />
      </g>
      <rect x={120} y={880} width={340} height={16} rx={8} fill={GOLD} transform="rotate(-30 290 888)" />
      {!slide && !book ? (
        <>
          <ellipse cx={420} cy={300} rx={120} ry={40} fill="#000" opacity={0.3} />
          <BankPhone x={420} y={300} w={150} rot={-20} value="1 000 000 €" glow={0.8} gold />
        </>
      ) : null}
      {piles_.map((p, i) => (
        <CoinPile key={i} x={slide || book ? 930 : xDen(p.x)} y={fallY(t, p.at, slide || book ? 640 : yDen(p.y), 300, 4)} n={p.n} s={slide || book ? 1.35 : 1.25} o={clamp((t - p.at) * 4)} />
      ))}
      {book ? (
        <>
          <CoinHead x={520} y={430} r={46} rot={12} />
          <CoinHead x={730} y={330} r={38} rot={-24} />
          <CoinHead x={1160} y={300} r={36} rot={40} />
          <CoinHead x={kf(t, [[13, 560], [20, 500], [24, 514]])} y={800} r={40} rot={-20 - t * 3} />
        </>
      ) : null}
      {!slide && !book ? (
        <>
          <CoinHead x={740} y={540} r={26} rot={12} />
          <CoinHead x={1030} y={690} r={22} rot={-30} />
          <CoinHead x={700} y={800} r={20} rot={-40} />
        </>
      ) : null}
      <CoinHead x={coin.x} y={coin.y} r={44} rot={-40 + coinFly * 260} o={1 - clamp((t - 9) * 8)} />
      <g filter="url(#rimR)">
        <path d="M 1300 220 Q 1280 120 1240 -240" stroke={LOOKS.pipHood.line} strokeWidth={120} fill="none" strokeLinecap="round" />
        <path d="M 1300 220 Q 1280 120 1240 -240" stroke={LOOKS.pipHood.limb} strokeWidth={102} fill="none" strokeLinecap="round" />
        <g transform="translate(1300 220) rotate(160) scale(4.8)">
          <path d="M -12 -3 Q -15 15 -6 19 L 8 19 Q 15 15 12 -3 Z" fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={2.6} strokeLinejoin="round" />
          <ellipse cx={-11} cy={7} rx={5} ry={7.5} fill={LOOKS.pipHood.hand} stroke={LOOKS.pipHood.line} strokeWidth={2.4} />
        </g>
      </g>
      <Foreground blur={16}>
        <ellipse cx={-120} cy={980} rx={420} ry={260} fill="#181220" />
        <ellipse cx={1950} cy={940} rx={420} ry={280} fill="#140F1A" />
      </Foreground>
    </g>
  );
};

// ---------- objectRain (S6): wide set, the objects rain from above while the hero cheers ----------
export const objectRainZ = z.object({});
export type ObjectRainProps = z.infer<typeof objectRainZ>;

const RAIN: [number, number, number, number][] = [
  [220, 0.0, 500, 1], [540, 3.5, 520, 1], [880, 1.8, 495, 1], [1240, 4.6, 530, 1], [1560, 2.9, 510, 1],
  [700, 5.2, 505, 1], [400, 5.8, 570, 2], [760, 7.4, 590, 2], [1180, 6.1, 560, 2], [1480, 8.2, 585, 2],
  [180, 9.1, 575, 2], [300, 9.9, 650, 3], [700, 10.6, 672, 3], [1080, 9.2, 660, 3], [1420, 11.4, 680, 3],
  [980, 12.1, 666, 3], [520, 11.9, 655, 3], [1600, 12.6, 685, 3], [860, 12.9, 668, 3],
];
const RADII = [8, 12, 18];
const rainCoin = (t: number, x: number, ph: number, y0: number, d: number) => {
  const span = 150 + d * 60;
  const fall = (ph / 5 + t * (0.045 + d * 0.01)) % 1;
  return (
    <CoinHead
      key={`${x}-rain-${ph}`}
      x={x + Math.sin(ph * 1.4 + t * 0.05) * 14}
      y={y0 - 180 + fall * (180 + span)}
      r={RADII[d - 1]}
      rot={(ph * 11 + t * (4 + d * 3)) % 360}
      sqx={Math.abs(Math.cos(ph * 2 + t * 0.13 * d)) * 0.62 + 0.38}
      o={clamp(fall * 10) * clamp((1 - fall) * 9)}
    />
  );
};

export const ObjectRain: React.FC<Arch & ObjectRainProps> = ({ t, len }) => {
  const CENTER = stand(KITCHEN, 0.9, 0.4);
  const pose = poseAt(t, [
    { f: 0, p: { x: 1230, y: 755, scale: 0.92, yaw: -0.15, look: -0.3, armL: { a: 30, b: 18 }, armR: { a: 30, b: 18 } } },
    { f: 6, p: { armL: { a: 150, b: 10 }, armR: { a: 154, b: 8 }, squash: -0.05 }, ease: easeOut },
    { f: 12, p: { armL: { a: 142, b: 16 }, armR: { a: 146, b: 14 }, squash: 0.02 } },
    { f: 26, p: { headTilt: -6, look: -0.6 } },
  ]);
  void CENTER;
  return (
    <g transform={camT(kf(t, [[0, 930], [len, 950]]), kf(t, [[0, 420], [len, 440]]), kf(t, [[0, 1.0], [len, 1.06]]))}>
      <Classroom t={t + 300} id="ar-cls" laugh={t > 5 ? 1 : 0} />
      {RAIN.filter(([, , , d]) => d < 3).map(([x, ph, y0, d]) => rainCoin(t, x, ph, y0, d))}
      <SchoolDesk x={1230} />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [16, 'smug']]) }} rimId="rimR" shadow={0.4} />
      {RAIN.filter(([, , , d]) => d === 3).map(([x, ph, y0, d]) => rainCoin(t, x, ph, y0, d))}
      <Foreground blur={6}>
        <ellipse cx={180} cy={1020} rx={330} ry={170} fill="#181220" />
        <ellipse cx={1790} cy={1060} rx={280} ry={150} fill="#120E18" />
      </Foreground>
    </g>
  );
};

// ---------- titleReveal (S11/S16/S20): the wide rooftop at dusk, the hero raises the phone, the title ----------
export const titleRevealZ = z.object({
  lines: z.tuple([z.string(), z.string()]),
  variant: z.enum(['raise', 'cheer']).default('raise'),
  accent: z.string().optional(),
  accentT: z.number().int().nonnegative().default(38),
  phone: z.boolean().default(true),
  cat: z.boolean().default(true),
  sparkle: z.boolean().default(true),
  stacks: z.array(z.object({ x: z.number(), n: z.number().int().min(2).max(12), at: z.number().int().nonnegative().default(6) })).default([]),
  size: z.number().default(92),
  y: z.number().default(170),
});
export type TitleRevealProps = z.infer<typeof titleRevealZ>;
const ROOF_FEET = 840;

export const TitleReveal: React.FC<Arch & TitleRevealProps> = ({ t, len, lines, variant = 'raise', accent, accentT, phone, cat, sparkle, stacks, size, y }) => {
  const cheer = variant === 'cheer';
  const pose = cheer
    ? poseAt(t, [
        { f: 0, p: { x: 960, y: ROOF_FEET - LEG_LEN * 0.62, scale: 0.62, yaw: 0, look: 0.2, armL: { a: 16, b: 8 }, armR: { a: 20, b: 8 } } },
        { f: 21, p: { squash: 0.04, headTilt: -2 }, ease: easeOut },
        { f: 27, p: { armL: { a: 150, b: 10 }, armR: { a: 150, b: 10 }, squash: -0.06, headTilt: -5 }, ease: easeOut },
        { f: 34, p: { squash: 0 } },
      ])
    : poseAt(t, [
        { f: 0, p: { x: 960, y: ROOF_FEET - LEG_LEN * 0.62, scale: 0.62, yaw: 0, look: 0.2, armL: { a: 18, b: 6 }, armR: { a: 40, b: 60 }, headTilt: 0 } },
        { f: 10, p: { armR: { a: 138, b: 16 }, look: 0.45, headTilt: -4 }, ease: easeOut },
        { f: 18, p: { armR: { a: 142, b: 10 } } },
      ]);
  const j = joints(pose);
  const ph = toWorld(pose, j.armR.end);
  const spin = cheer ? (t < 21 ? t * 3 : 63 + (t - 21) * 30 * Math.exp(-(t - 21) / 22)) : undefined;
  return (
    <g transform={camT(960, kf(t, [[0, 540], [len, 560]]), kf(t, [[0, 1.0], [len, 1.07]]))}>
      <Rooftop t={t} sunX={960} sunY={700 - 40 * easeOut(clamp(t / 40))} clock={cheer} spin={spin} />
      {cat ? <Cat x={620} y={ROOF_FEET + 6} mood={t > 12 ? 'alert' : 'sleep'} f={t} /> : null}
      {(stacks ?? []).map((s, i) => {
        if (t < s.at) return null;
        const k2 = easeIn(clamp((t - s.at) / 12));
        return k2 < 1 ? (
          <CookieTop key={i} x={250 + (s.x - 250) * k2} y={160 + (826 - 160) * k2} r={44} rot={k2 * 240} />
        ) : (
          <CookieStack key={i} x={s.x} y={830} n={s.n} s={0.9} />
        );
      })}
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, cheer ? [[0, 'happy'], [27, 'smug']] : [[0, 'happy'], [22, 'smug']]) }} rimId="rimR" shadow={0.6} />
      {!cheer && phone ? <BankPhone x={ph.x + 6} y={ph.y + 6} w={54} rot={-14} value="1 000 000 €" glow={1} gold /> : null}
      {sparkle ? <Sparkle x={ph.x + 64} y={ph.y - 46} t={t - 16} s={1.2} /> : null}
      <TitleCard t={t} lines={lines} accent={accent} accentT={accentT} y={y} size={size} />
    </g>
  );
};

// ---------- lowAngleSky (SH11): a low angle looking up, the hero against the sky ----------
export const lowAngleSkyZ = z.object({
  sparkles: z.boolean().default(true),
  scale: z.number().min(0.5).max(4).default(1.8),
  expr: z.enum(['happy', 'neutral', 'smug']).default('happy'),
});
export type LowAngleSkyProps = z.infer<typeof lowAngleSkyZ>;

export const LowAngleSky: React.FC<Arch & LowAngleSkyProps> = ({ t, len, sparkles, scale, expr = 'happy' }) => {
  const pose = poseAt(t, [
    { f: 0, p: { x: 900, y: 790, scale, yaw: 0.15, armL: { a: 20, b: 6 }, armR: { a: 150, b: 30 } } },
    { f: 29, p: { armR: { a: 160, b: 20 } } },
  ]);
  return (
    <g transform={camT(960, 540, kf(t, [[0, 1.0], [len && len > 0 ? len : 29, 1.03]]))}>
      <Rooftop t={t + 94} sunX={1050} sunY={520} spin={300} low={260} />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, expr as Pose['expr']]]) }} shadow={0} rimId="rimR" />
      {sparkles ? (
        <>
          <Sparkle x={620} y={380} t={t} s={1.5} />
          <Sparkle x={1240} y={300} t={t - 5} s={1.1} />
          <Sparkle x={1160} y={640} t={t - 10} s={0.9} />
        </>
      ) : null}
    </g>
  );
};

// ---------- cityTurn (SH12/S15): the low angle turns: the sky reddens, the sun cracks, the city dies ----------
export const cityTurnZ = z.object({
  redAt: z.number().default(0),
  crackAt: z.number().int().nonnegative().default(18),
  shakeFrom: z.number().int().nonnegative().default(18),
  shakeTo: z.number().int().nonnegative().default(40),
  expr: z.string().default('happy'),
  worriedAt: z.number().int().nonnegative().default(2),
  shockAt: z.number().int().nonnegative().default(18),
  faceAt2: z.string().optional(),
  scale: z.number().default(1.9),
});
export type CityTurnProps = z.infer<typeof cityTurnZ>;

export const CityTurn: React.FC<Arch & CityTurnProps> = ({ t, len, redAt, crackAt, shakeFrom, shakeTo, worriedAt, shockAt, scale }) => {
  const red = easeOut(clamp((t - redAt) / 12));
  const crack = clamp((t - crackAt) / 10);
  const shake = t >= shakeFrom && t < shakeTo ? Math.sin(t * 2.7) * 9 * (1 - (t - shakeFrom) / 22) : 0;
  const pose = poseAt(t, [
    { f: 0, p: { x: 840, y: 800, scale, yaw: -0.2, armL: { a: 18, b: 6 }, armR: { a: 18, b: 6 }, look: 0.6 } },
    { f: 18, p: { look: 1, headTilt: 4 } },
    { f: 75, p: { headTilt: 0 } },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 940], [len, 900]]) + shake, kf(t, [[0, 540], [len, 470]]), kf(t, [[0, 1.0], [18, 1.08], [len, 1.35]]))}>
      <Rooftop t={t + 123} sunX={1180} sunY={470} spin={300} red={red} crack={crack} lightsOut={clamp((t - 20) / 30)} low={260} />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [worriedAt, 'worried'], [shockAt, 'shock']]) }} shadow={0} rimId={red > 0.5 ? 'rimRed' : 'rimR'} />
    </g>
  );
};

// ---------- closeUpTurn (S14/S15): the extreme close-up, the light turns ----------
export const closeUpTurnZ = z.object({
  variant: z.enum(['rooftop', 'classroom']).default('rooftop'),
  expr: z.enum(['worried', 'neutral']).default('worried'),
  red: z.number().min(0).max(1).default(0.45),
  rimSwitch: z.number().min(0).max(1).default(0.55),
  scale: z.number().default(6.4),
  glasses: z.boolean().default(false),
  tag: z.string().default(''),
});
export type CloseUpTurnProps = z.infer<typeof closeUpTurnZ>;

export const CloseUpTurn: React.FC<Arch & CloseUpTurnProps> = ({ t, len, uid = 'cu', variant = 'rooftop', expr, red, rimSwitch, scale, glasses = false, tag = '' }) => {
  // classroom: a different choreography entirely (rewind's solved-board close-up) — only `glasses`/`tag` apply.
  if (variant === 'classroom') {
    const sc = 4.3 * (1 + 0.05 * clamp(t / Math.max(len, 1)));
    const glassesK = glasses ? clamp((t - 6) / 8) : 0;
    const pose: Pose = { ...basePose, x: 1000, y: 640 - HEAD.y * sc, scale: sc, yaw: 0.22, look: 0.1, armL: { a: 14, b: -6 }, armR: { a: 14, b: -6 }, glasses: glassesK, headTilt: kf(t, [[0, 0], [18, 3]]), ...faceAt(t, glassesK > 0.5 ? [[0, 'happy'], [14, 'cool']] : [[0, 'happy'], [14, 'smug']]) };
    return (
      <g>
        <g filter="url(#blur16)">
          <g transform="translate(-590 -452) scale(2.2)">
            <Classroom t={t + 326} solved={t >= 8} id={`ar-cu-${uid}`} />
          </g>
        </g>
        <rect x={0} y={0} width={1920} height={1080} fill="#FFF6E9" opacity={0.12} />
        <Hero look={LOOKS.pipHood} pose={pose} rimId="rimR" shadow={0} />
        {glassesK > 0.5 ? <FocusRings x={1000} y={610} t={t - 6} r0={64} /> : null}
        {glassesK >= 1 ? <Sparkle x={1190} y={430} t={t - 14} s={0.9} /> : null}
        {tag ? (
          <g transform="translate(1330 200) scale(1.35)">
            <Tag x={0} y={0} t={t - 4} text={tag} mark="check" w={150} />
          </g>
        ) : null}
      </g>
    );
  }
  const sc = scale * (1 + 0.04 * clamp(t / len));
  const head = { x: 960, y: 720 };
  const redK = red * clamp(t / len);
  const pose: Pose = { ...basePose, x: head.x, y: head.y - HEAD.y * sc, scale: sc, yaw: 0.12, look: 0.1, armL: { a: 14, b: -6 }, armR: { a: 14, b: -6 }, headTilt: kf(t, [[0, 0], [18, 4]]), ...faceAt(t, [[0, expr]]) };
  return (
    <g>
      <g filter="url(#blur16)">
        <g transform="translate(-600 -560) scale(2)">
          <Rooftop t={t + 200} sunX={980} sunY={600} red={redK} low={180} />
        </g>
      </g>
      <rect x={0} y={0} width={1920} height={1080} fill="#07040C" opacity={0.22} />
      <Hero look={LOOKS.pipHood} pose={pose} rimId={t > len * rimSwitch ? 'rimRed' : 'rimR'} shadow={0} />
    </g>
  );
};

// ---------- schematicClaim (S12): the schematic poses the claim and shows the hole ----------
export const schematicClaimZ = z.object({
  variant: z.enum(['origin', 'formula']).default('origin'),
  title: z.string().default('LE SOLDE'),
  center: z.string().default('€'),
  value: z.string().default('1 000 000 €'),
  origin: z.string().default('ORIGINE'),
  footnote: z.string().default('AUCUN SALAIRE · AUCUNE VENTE · RIEN'),
  formula: z.string().default('E = mc²'),
  chip: z.string().default('1 COOKIE · 30 G'),
  countTo: z.number().default(2.7e15),
  unit: z.string().default("JOULES D'ÉNERGIE"),
});
export type SchematicClaimProps = z.infer<typeof schematicClaimZ>;

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) =>
  String(n)
    .split('')
    .map((d) => SUP[+d] ?? d)
    .join('');

export const SchematicClaim: React.FC<Arch & SchematicClaimProps> = ({ t, len, uid = 'sc', variant = 'origin', title, center, value, origin, footnote, formula, chip, countTo, unit }) => {
  if (variant === 'formula') {
    const ex = Math.floor(Math.log10(Math.abs(countTo) || 1));
    const fmt =
      Math.abs(countTo) >= 1e6
        ? (v: number) => `${(v / Math.pow(10, ex)).toFixed(1).replace('.', ',')} × 10${sup(ex)}`
        : (v: number) => Math.round(v).toLocaleString('fr-FR');
    return (
      <g transform={`translate(960 540) scale(${kf(t, [[0, 1], [len, 1.05]])}) translate(-960 -540)`}>
        <Schematic t={t} id={`ar-schf-${uid}`} />
        <PasteIn x={1440} y={280} t={t} ring={70}>
          <CookieTop x={0} y={0} r={54} />
        </PasteIn>
        <SchLabel x={1440} y={392} t={t - 6} text={chip} size={28} color={SCH.dim} />
        <Arrow x0={1320} y0={300} x1={1140} y1={380} t={t - 8} color={SCH.dim} />
        <SchLabel x={760} y={430} t={t - 10} text={formula} size={104} color={GOLD_L} />
        <DrawOn d="M 540 540 L 980 540" t={t - 16} dur={8} color={SCH.dim} width={3} />
        <CountUp x={760} y={668} t={t - 18} to={countTo} dur={24} size={62} color={SCH.live} format={fmt} />
        <SchLabel x={760} y={790} t={t - 38} text={unit} size={34} color={SCH.dim} />
      </g>
    );
  }
  return (
    <g transform={`translate(960 540) scale(${kf(t, [[0, 1], [len, 1.05]])}) translate(-960 -540)`}>
      <Schematic t={t} id={`ar-sch-${uid}`} />
    <SchLabel x={430} y={205} t={t} text={title} size={40} color={SCH.dim} />
    <g transform="translate(430 420)">
      <circle r={130} fill="none" stroke={SCH.line} strokeWidth={6} opacity={easeOut(clamp(t / 8))} />
      <circle r={84} fill="none" stroke={SCH.line} strokeWidth={4} opacity={0.5} />
      <text y={26} textAnchor="middle" fontFamily={FONT.title} fontWeight={800} fontSize={90} fill={GOLD_L} opacity={easeOut(clamp(t / 8))}>
        {center}
      </text>
    </g>
    <SchLabel x={430} y={620} t={t - 4} text={value} size={52} color={GOLD_L} />
    <Arrow x0={630} y0={420} x1={880} y1={420} t={t - 10} color={SCH.dim} />
    <SchLabel x={1240} y={280} t={t - 15} text={origin} size={44} color={SCH.dim} />
    {t > 18 ? <rect x={1000} y={330} width={480} height={270} rx={12} fill="none" stroke={SCH.dim} strokeWidth={4} strokeDasharray="18 14" opacity={0.8} /> : null}
    {t > 25 ? (
      <text x={1240} y={530} textAnchor="middle" fontFamily={FONT.title} fontWeight={800} fontSize={200} fill={SCH.live} style={{ filter: `drop-shadow(0 0 18px ${SCH.glow})` }}>
        {'?'}
      </text>
    ) : null}
      <DrawOn d="M 1000 700 L 1480 700" t={t - 29} dur={8} color={SCH.dim} width={3} />
      <SchLabel x={1240} y={772} t={t - 33} text={footnote} size={38} color={SCH.dim} />
    </g>
  );
};

// ---------- schematicBar (S13): the schematic bar that shrinks, the annotated result ----------
export const schematicBarZ = z.object({
  title: z.string().default("POUVOIR D'ACHAT"),
  unit: z.string().default('2 % PAR AN'),
  years: z.number().int().positive().default(20),
  rate: z.number().min(0).max(0.5).default(0.02),
  ticks: z.array(z.string()).default(['0', '10 ANS', '20 ANS']),
  result: z.string().default('−33 %'),
});
export type SchematicBarProps = z.infer<typeof schematicBarZ>;

export const SchematicBar: React.FC<Arch & SchematicBarProps> = ({ t, title, unit, years, rate, ticks, result }) => {
  const y = years * clamp((t - 10) / 40);
  const v = Math.pow(1 - rate, y);
  const pct = Math.round(v * 100);
  const w = 540 * v;
  const tk = [ticks[0] ?? '0', ticks[1] ?? '', ticks[2] ?? ''];
  return (
    <g>
      <Schematic t={t + 40} id="ar-sch2" />
      <SchLabel x={200} y={250} t={t - 2} text={title} size={40} color={SCH.dim} anchor="start" />
      <rect x={200} y={360} width={540} height={96} rx={14} fill="#ffffff" opacity={0.08} />
      <rect x={200} y={360} width={Math.max(w, 16)} height={96} rx={14} fill={GOLD_L} />
      <text x={200 + Math.max(w, 16) - 16} y={427} textAnchor="end" fontFamily={FONT.ui} fontSize={52} fill="#12182A" fontWeight={700} opacity={t > 12 && w > 140 ? 1 : 0}>
        {`${pct} %`}
      </text>
      <DrawOn d="M 200 560 L 740 560" t={t - 8} dur={10} color={SCH.dim} width={3} />
      <SchLabel x={200} y={612} t={t - 14} text={tk[0]} size={28} color={SCH.dim} />
      <SchLabel x={470} y={612} t={t - 18} text={tk[1]} size={28} color={SCH.dim} />
      <SchLabel x={720} y={612} t={t - 22} text={tk[2]} size={28} color={SCH.dim} />
      <SchLabel x={1030} y={215} t={t - 26} text={unit} size={46} color={GOLD_L} />
      <Arrow x0={960} y0={280} x1={960} y1={430} t={t - 30} color={SCH.dim} />
      <CoinHead x={860} y={560} r={72} rot={-12} o={t > 26 ? Math.max(0.45, v) : 0} />
      {t > 40 ? (
        <text x={1520} y={430} textAnchor="middle" fontFamily={FONT.title} fontWeight={800} fontSize={110} fill={t > 44 ? SCH.live : SCH.dim} style={{ filter: t > 44 ? `drop-shadow(0 0 14px ${SCH.glow})` : 'none' }}>
          {result}
        </text>
      ) : null}
      <DrawOn d="M 1240 372 L 1240 520" t={t - 40} dur={6} color={SCH.dim} width={4} />
      <SchLabel x={1520} y={500} t={t - 48} text={'EN ' + years + ' ANS'} size={36} color={SCH.dim} />
    </g>
  );
};

// ---------- arrivalWalk (S15): the wide low angle, a figure walks out of the dusk ----------
export const arrivalWalkZ = z.object({
  cast: z.enum(['suit', 'mo', 'sis', 'mom']).default('suit'),
  chip: z.boolean().default(true),
  expression: z.enum(['worried', 'neutral']).default('worried'),
});
export type ArrivalWalkProps = z.infer<typeof arrivalWalkZ>;

export const ArrivalWalk: React.FC<Arch & ArrivalWalkProps> = ({ t, len, cast, chip, expression = 'worried' }) => {
  const suitX = kf(t, [[0, 560], [60, 1050]]);
  const heroShock = expression === 'worried' ? [[0, 'worried'], [50, 'shock']] as [number, Pose['expr']][] : [[0, 'neutral']] as [number, Pose['expr']][];
  const suit = walkPose(suitX, t * 0.42, 905, 0.99, { look: 1 }, 1);
  const pose = poseAt(t, [
    { f: 0, p: { x: 1560, y: 905 - LEG_LEN * 0.66, scale: 0.66, yaw: -0.5, look: -0.9, armL: { a: 60, b: 105 }, armR: { a: 64, b: 100 }, headTilt: 4 } },
    { f: 40, p: { headTilt: 8, look: -0.7 }, ease: easeOut },
  ]);
  const j = joints(pose);
  const ph = toWorld(pose, j.armR.end);
  return (
    <g transform={camT(kf(t, [[0, 1050], [len, 1030]]), kf(t, [[0, 510], [len, 495]]), kf(t, [[0, 1.0], [len, 1.16]]))}>
      <Rooftop t={t + 230} sunX={1000} sunY={620} red={1} low={40} cityLit={2.6} />
      <Hero look={LOOKS[cast]} pose={{ ...suit, ...faceAt(t, [[0, 'neutral']]) }} rimId="rimR" shadow={0} />
      <Hero look={LOOKS.pipHood} pose={{ ...pose, ...faceAt(t, heroShock) }} rimId="rimRed" shadow={0} />
      <BankPhone x={ph.x + 8} y={ph.y + 8} w={40} rot={-10} value="1 000 000 €" glow={1} gold />
      {chip ? <BalanceChip x={1080} y={210} t={t - 14} /> : null}
      <Foreground blur={6}>
        <ellipse cx={130} cy={1010} rx={380} ry={220} fill="#10040C" />
      </Foreground>
    </g>
  );
};
