import React from 'react';
import {
  LightVeil, Glow, Foreground,
  Hero, Pose, basePose, poseAt, faceAt, kf, clamp, easeOut, easeIn, backOut, rnd, settle, camT, joints, toWorld, walkPose, LOOKS, LEG_LEN, HEAD,
  Kitchen, KitchenIsland, KITCHEN, islandTop, stand, Tabletop, Study, Desk, Classroom, SchoolDesk, Rooftop,
  Schematic, SCH, Arrow, SchLabel, DrawOn,
  OpenBook, Mug, Cat,
  Sparkle, TitleCard, Tag, ShotProps, FONT,
} from '@what-if/engine';

// « Et si tu devenais millionnaire à 16 ans ? » — the balance refills itself to 1 000 000 € no matter what
// is spent. Gold pool of light, a bank UI on the phone, one balance that never drops.

const PIP = LOOKS.pipHood;
const SUIT = LOOKS.suit;

const GOLD = '#E9C46A';
const GOLD_L = '#FFE9A8';
const GOLD_D = '#B8862B';

const fmtEur = (v: number) => Math.max(0, Math.round(v)).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, ' ') + ' €';
const balCol = (v: string) => (v.startsWith('1 ') ? GOLD_L : '#F6EFE3');

// ---------- local props ----------

const BankPhone: React.FC<{ x: number; y: number; w: number; rot?: number; value: string; glow?: number; label?: string }> = ({ x, y, w, rot = 0, value, glow = 1, label = 'SOLDE' }) => {
  const h = w * 2.05;
  const sz = value.length > 8 ? w * 0.135 : w * 0.17;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-w * 0.44} y={h * 0.5 - 8} width={w * 0.88} height={h * 0.12} rx={w * 0.08} fill="#000" opacity={0.35} />
      <rect x={-w * 0.5} y={-h / 2} width={w} height={h} rx={w * 0.16} fill="#16151C" stroke="#3A3846" strokeWidth={4 * (w / 200)} />
      <rect x={-w * 0.44} y={-h / 2 + w * 0.06} width={w * 0.88} height={h - w * 0.12} rx={w * 0.11} fill="#0B0A10" />
      <Glow x={0} y={0} r={w * 1.6} kind="cool" o={0.42 * glow} />
      <text y={-h * 0.3} textAnchor="middle" fontFamily={FONT.ui} fontSize={w * 0.13} fill="#7E8DA6" letterSpacing={w * 0.01} opacity={label ? 1 : 0}>
        SOLDE
      </text>
      <text y={h * 0.08} textAnchor="middle" fontFamily={FONT.ui} fontSize={sz} fill={balCol(value)} fontWeight={700}>
        {value}
      </text>
      <rect x={-w * 0.12} y={-h / 2 + w * 0.09} width={w * 0.24} height={w * 0.05} rx={w * 0.025} fill="#000" />
    </g>
  );
};

const Ring: React.FC<{ x: number; y: number; t: number; color?: string; r0?: number; sx?: number; sy?: number }> = ({ x, y, t, color = GOLD_L, r0 = 70, sx = 1, sy = 0.55 }) => {
  if (t <= 0 || t > 26) return null;
  return <ellipse cx={x} cy={y} rx={(r0 + t * 9) * sx} ry={(r0 + t * 9) * sy} fill="none" stroke={color} strokeWidth={Math.max(2, 7 - t * 0.18)} opacity={clamp(1 - t / 22)} />;
};

const CoinHead: React.FC<{ x: number; y: number; r: number; rot?: number; sqx?: number; o?: number }> = ({ x, y, r, rot = 0, sqx = 1, o = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${sqx} 1)`} opacity={o}>
    <circle r={r} fill={GOLD} stroke={GOLD_D} strokeWidth={r * 0.09} />
    <circle r={r * 0.64} fill="none" stroke={GOLD_D} strokeWidth={r * 0.06} opacity={0.7} />
    <path d={`M ${-r * 0.16} ${r * 0.38} L ${-r * 0.16} ${-r * 0.38} M ${-r * 0.16} ${-r * 0.4} q ${r * 0.4} ${-r * 0.1} ${r * 0.4} ${r * 0.15} q 0 ${r * 0.26} ${-r * 0.4} ${r * 0.15} M ${-r * 0.38} ${-r * 0.08} L ${-r * 0.08} ${-r * 0.08} M ${-r * 0.38} ${r * 0.08} L ${-r * 0.08} ${r * 0.08}`} stroke="#7A5218" strokeWidth={r * 0.085} fill="none" strokeLinecap="round" />
    <path d={`M ${-r * 0.5} ${-r * 0.55} q ${r * 0.5} ${-r * 0.5} ${r * 1.05} ${-r * 0.12}`} stroke="#FFF3C4" strokeWidth={r * 0.08} fill="none" strokeLinecap="round" opacity={0.6} />
  </g>
);

const CoinPile: React.FC<{ x: number; y: number; n: number; s?: number; o?: number }> = ({ x, y, n, s = 1, o = 1 }) => (
  <g opacity={o}>
    {Array.from({ length: n - 1 }).map((_, i) => (
      <ellipse key={i} cx={x + Math.sin(i * 1.7) * 4 * s} cy={y - i * 9 * s} rx={30 * s} ry={11 * s} fill={i % 2 ? GOLD_D : GOLD} stroke="#7A5218" strokeWidth={2.4 * s} />
    ))}
    <ellipse cx={x} cy={y - (n - 2) * 9 * s} rx={30 * s} ry={11 * s} fill={GOLD_L} stroke="#7A5218" strokeWidth={2.4 * s} />
  </g>
);

const Cake: React.FC<{ x: number; y: number; s?: number; t: number; smoke?: number; deadCandle?: number }> = ({ x, y, s = 1, t, smoke = 0, deadCandle = -1 }) => {
  const fl = (i: number) => Math.sin(t * 0.9 + i * 2.1) * 3;
  return (
    <g>
      <ellipse cx={x} cy={y + 4 * s} rx={148 * s} ry={20 * s} fill="#000" opacity={0.3} />
      <ellipse cx={x} cy={y} rx={150 * s} ry={20 * s} fill="#C9BBE0" opacity={0.9} />
      <ellipse cx={x} cy={y - 4 * s} rx={150 * s} ry={20 * s} fill="#E4DAF0" />
      <rect x={x - 96 * s} y={y - 92 * s} width={192 * s} height={88 * s} fill="#6A4358" />
      <path d={`M ${x - 96 * s} ${y - 46 * s} q ${19 * s} ${14 * s} ${38 * s} 0 q ${19 * s} ${14 * s} ${38 * s} 0 q ${19 * s} ${14 * s} ${38 * s} 0 q ${19 * s} ${14 * s} ${38 * s} 0`} fill="none" stroke="#4E3040" strokeWidth={2} opacity={0.5} />
      <rect x={x - 100 * s} y={y - 112 * s} width={200 * s} height={28 * s} rx={13 * s} fill="#F2D8E0" />
      <path d={`M ${x - 100 * s} ${y - 86 * s} q ${22 * s} ${18 * s} ${44 * s} 4 q ${22 * s} ${-14 * s} ${44 * s} 2 q ${22 * s} ${14 * s} ${44 * s} -2 q ${22 * s} ${-16 * s} ${68 * s} -2`} fill="none" stroke="#F2D8E0" strokeWidth={9 * s} strokeLinecap="round" />
      <rect x={x - 100 * s} y={y - 112 * s} width={200 * s} height={4} fill={GOLD} opacity={0.5} />
      <text y={y - 56 * s} x={x} textAnchor="middle" fontFamily={FONT.title} fontWeight={800} fontSize={62 * s} fill="#F6EFE3">
        {'16'}
      </text>
      <path d={`M ${x - 40 * s} ${y - 96 * s} L ${x - 40 * s} ${y - 148 * s}`} stroke="#5A6A8A" strokeWidth={6 * s} strokeLinecap="round" />
      <path d={`M ${x + 44 * s} ${y - 96 * s} L ${x + 44 * s} ${y - 148 * s}`} stroke="#5A6A8A" strokeWidth={6 * s} strokeLinecap="round" />
      {[-40, 44].map((dx, i) =>
        i === deadCandle ? null : (
          <g key={i}>
            <circle cx={x + dx * s} cy={y - 158 * s + fl(i)} r={30 * s} fill="#FFB15A" opacity={0.18} />
            <Glow x={x + dx * s} y={y - 156 * s + fl(i)} r={70 * s} o={0.5} />
            <path d={`M ${x + dx * s} ${y - 152 * s + fl(i)} C ${x + dx * s - 7 * s} ${y - 162 * s + fl(i)} ${x + dx * s - 5 * s} ${y - 170 * s} ${x + dx * s} ${y - 176 * s + fl(i) * 0.4} C ${x + dx * s + 5 * s} ${y - 170 * s} ${x + dx * s + 7 * s} ${y - 162 * s + fl(i)} ${x + dx * s} ${y - 152 * s + fl(i)}`} fill="#FFC24D" />
            <path d={`M ${x + dx * s} ${y - 160 * s + fl(i)} C ${x + dx * s - 3 * s} ${y - 166 * s} ${x + dx * s + 3 * s} ${y - 166 * s} ${x + dx * s} ${y - 172 * s + fl(i) * 0.4} Z`} fill="#FFF3B0" />
          </g>
        ),
      )}
      {smoke > 0 ? (
        <g opacity={smoke}>
          <path d={`M ${x - 40 * s} ${y - 146 * s} q ${12 * s} ${-26 * s} ${-6 * s} ${-52 * s} q ${-14 * s} ${-20 * s} ${8 * s} ${-40 * s}`} stroke="#C9C2CC" strokeWidth={7 * s} fill="none" strokeLinecap="round" opacity={0.5} transform={`translate(${Math.sin(t / 6) * 6} 0)`} />
          <path d={`M ${x - 22 * s} ${y - 172 * s} q ${10 * s} ${-18 * s} ${-4 * s} ${-32 * s}`} stroke="#C9C2CC" strokeWidth={5 * s} fill="none" strokeLinecap="round" opacity={0.35} transform={`translate(${Math.sin(t / 6 + 1) * 5} 0)`} />
        </g>
      ) : null}
    </g>
  );
};

const BalanceChip: React.FC<{ x: number; y: number; t: number; w?: number }> = ({ x, y, t, w = 680 }) => {
  if (t < 0) return null;
  const s = backOut(clamp(t / 8));
  const blink = Math.floor(t / 5) % 2 ? 1 : 0.55;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(2)`}>
      <rect x={-w / 2} y={-64} width={w} height={128} rx={22} fill="#0B0816" opacity={0.78} />
      <rect x={-w / 2} y={-64} width={w} height={128} rx={22} fill="none" stroke={GOLD} strokeWidth={3} opacity={0.8} />
      <text x={-w / 2 + 34} y={-14} fontFamily={FONT.ui} fontSize={30} fill="#7E8DA6" letterSpacing={3}>
        SOLDE
      </text>
      <text x={-w / 2 + 34} y={44} fontFamily={FONT.ui} fontSize={50} fill={GOLD_L} fontWeight={700}>
        {'1 000 000 €'}
      </text>
      <line x1={w / 2 - 250} y1={-34} x2={w / 2 - 250} y2={34} stroke="#7E8DA6" strokeWidth={2} opacity={0.5} />
      <text x={w / 2 - 30} y={-14} textAnchor="end" fontFamily={FONT.ui} fontSize={30} fill="#7E8DA6" letterSpacing={3}>
        ORIGINE
      </text>
      <text x={w / 2 - 30} y={46} textAnchor="end" fontFamily={FONT.title} fontWeight={800} fontSize={54} fill={SCH.live} opacity={blink}>
        {'?'}
      </text>
    </g>
  );
};

// ---------- S1: wide, the kitchen: the birthday, 16 candles, a phone buzzing on the island ----------
const S1_STAND = stand(KITCHEN, 0.38, 0.4);
export const S1: React.FC<ShotProps> = ({ t, len }) => {
  const cake = islandTop(0.68, 0.5);
  const phone = islandTop(0.5, 0.42);
  const pose = poseAt(t, [
    { f: 0, p: { x: S1_STAND.x, y: S1_STAND.y, scale: S1_STAND.scale, yaw: 0.35, look: 0.75, armL: { a: 14, b: -8 }, armR: { a: 22, b: -10 }, headTilt: 0 } },
    { f: 14, p: { headTilt: 6, look: 0.95, armR: { a: 30, b: 30 } }, ease: easeOut },
    { f: 22, p: { headTilt: 9, armR: { a: 26, b: 26 } } },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 930], [len, 955]]), 580, kf(t, [[0, 0.92], [len, 0.99]]))}>
      <Kitchen t={t + 40} id="k1" veil={0.34} />
      <Cat x={1330} y={KITCHEN.P(0.9, 1, 0.7).y} mood="sleep" f={t} />
      <Hero look={PIP} pose={{ ...pose, ...faceAt(t, [[0, 'neutral'], [12, 'happy']]) }} rimId="rimR" shadow={0.6} />
      <KitchenIsland />
      <BankPhone x={phone.x} y={phone.y - 34} w={58} rot={t > 12 ? Math.sin(t * 0.9) * 5 : 0} value={'8,50 €'} glow={0.15} label="SOLDE" />
      <Cake x={cake.x} y={cake.y} s={0.72} t={t + 60} />
      <Foreground blur={10}>
        <ellipse cx={240} cy={1020} rx={340} ry={200} fill="#141019" />
        <ellipse cx={1720} cy={1060} rx={320} ry={180} fill="#100D15" />
      </Foreground>
    </g>
  );
};

// ---------- S2: macro insert, over the island: the balance jumps to a million ----------
export const S2: React.FC<ShotProps> = ({ t, len }) => {
  const roll = 312.44 + (1e6 - 312.44) * easeOut(clamp((t - 5) / 13));
  const value = t < 5 ? '312,44 €' : t < 18 ? fmtEur(roll) : '1 000 000 €';
  const jx = t >= 5 && t < 18 ? (rnd(Math.floor(t), 3) - 0.5) * 6 : 0;
  const hand = { x: kf(t, [[0, 1150], [8, 1080], [12, 1072], [18, 1096]]), y: kf(t, [[0, 240], [8, 330], [12, 338], [18, 318]]) };
  return (
    <g transform={camT(960, kf(t, [[0, 500], [len, 530]]), kf(t, [[0, 1.05], [len, 1.14]]))}>
      <Tabletop edge={880} wood="#7A6A58" grain="#6A5C4C" lip="#5E5446" kind="stone" floor="#26222C" floorLines="#1F1C25" />
      <LightVeil id="s2veil" lights={[[930, 400, 800]]} o={0.55} />
      <Glow x={930} y={380} r={640} o={0.32} />
      <Mug x={1600} y={820} rot={-24} f={t} steam={0.4} />
      <g transform="rotate(-16 200 140)">
        <rect x={-80} y={30} width={560} height={230} fill="#7A4A52" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={-80} y={64 + i * 66} width={560} height={13} fill={GOLD} opacity={0.55} />
        ))}
      </g>
      <circle cx={285} cy={430} r={95} fill="#000" opacity={0.3} />
      <circle cx={275} cy={420} r={88} fill="#B98A5A" />
      <circle cx={275} cy={420} r={70} fill="#8A5A3A" />
      <ellipse cx={930} cy={640} rx={280} ry={36} fill="#000" opacity={0.4} />
      <BankPhone x={930 + jx} y={470} w={230} rot={-7} value={value} glow={t >= 18 ? 1 : 0.35} />
      <Ring x={930} y={470} t={t - 34} sx={2.1} sy={1.2} />
      <g filter="url(#rimR)">
        <path d={`M ${hand.x + 300} ${hand.y - 480} Q ${hand.x + 130} ${hand.y - 130} ${hand.x} ${hand.y}`} stroke={PIP.line} strokeWidth={70} fill="none" strokeLinecap="round" />
        <path d={`M ${hand.x + 300} ${hand.y - 480} Q ${hand.x + 130} ${hand.y - 130} ${hand.x} ${hand.y}`} stroke={PIP.limb} strokeWidth={56} fill="none" strokeLinecap="round" />
      </g>
      <ellipse cx={930} cy={640} rx={280} ry={36} fill="#000" opacity={0.4} />
      <BankPhone x={930 + jx} y={470} w={230} rot={-7} value={value} glow={t >= 18 ? 1 : 0.35} />
      <circle cx={hand.x - 22} cy={hand.y - 30} r={24} fill={PIP.hand} stroke={PIP.line} strokeWidth={7} />
      {t >= 18 ? <Sparkle x={1100} y={330} t={t - 20} s={1.5} /> : null}
    </g>
  );
};

// ---------- S3: medium, the kitchen: Pip cheers, the candles flicker, the balance glows on ----------
const S3_STAND = stand(KITCHEN, 0.46, 0.4);
export const S3: React.FC<ShotProps> = ({ t, len }) => {
  const cake = islandTop(0.68, 0.5);
  const phone = islandTop(0.5, 0.42);
  const pose = poseAt(t, [
    { f: 0, p: { x: S3_STAND.x, y: S3_STAND.y, scale: S3_STAND.scale, yaw: 0.1, look: 0.55, armL: { a: 26, b: 16 }, armR: { a: 26, b: 16 } } },
    { f: 4, p: { squash: 0.05 } },
    { f: 9, p: { armL: { a: 152, b: 8 }, armR: { a: 148, b: 10 }, squash: -0.06, headTilt: -4 }, ease: easeOut },
    { f: 14, p: { armL: { a: 144, b: 16 }, armR: { a: 140, b: 18 }, squash: 0 } },
    { f: 22, p: { armL: { a: 140, b: 18 }, armR: { a: 136, b: 20 } } },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 950], [len, 965]]), 585, kf(t, [[0, 1.62], [len, 1.72]]))}>
      <Kitchen t={t + 70} id="k3" />
      <BankPhone x={phone.x} y={phone.y - 34} w={58} rot={-4} value={'1 000 000 €'} glow={1} />
      <Ring x={phone.x} y={phone.y - 40} t={t - 2} sx={1.4} sy={0.8} />
      <Cake x={cake.x} y={cake.y} s={0.72} t={t + 80} />
      <KitchenIsland />
      <Hero look={PIP} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [20, 'smug']]) }} rimId="rimR" shadow={0} />
      <Foreground blur={6}>
        <ellipse cx={330} cy={1040} rx={330} ry={190} fill="#120F17" />
      </Foreground>
    </g>
  );
};

// ---------- S4: medium, the study: the console on the desk, a PAYÉ tag pops ----------
export const S4: React.FC<ShotProps> = ({ t, len }) => {
  const pose = poseAt(t, [
    { f: 0, p: { x: 870, y: 712, yaw: 0.4, look: 0.6, armL: { a: 12, b: -6 }, armR: { a: 40, b: 40 } } },
    { f: 6, p: { armR: { a: 66, b: 30 }, headTilt: 2 }, ease: easeOut },
    { f: 13, p: { armR: { a: 62, b: 26 } } },
    { f: 19, p: { headTilt: -5 } },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 1000], [len, 1020]]), 605, kf(t, [[0, 1.78], [len, 1.88]]))}>
      <Study t={t + 110} id="st4" />
      <Hero look={PIP} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [19, 'smug']]) }} rimId="rimR" shadow={0} />
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
      <Tag x={1180} y={436} t={t - 8} text="PAYÉ" mark="check" w={172} />
      <Foreground blur={10}>
        <path d="M 320 1030 Q 380 760 330 620 Q 300 800 190 1030 Z" fill="#0E1218" />
      </Foreground>
    </g>
  );
};

// ---------- S5: insert top-down, the study desk: piles of coins land on the wood ----------
const fallY = (t: number, at: number, y: number, off: number, dur = 9) => {
  const k = easeIn(clamp((t - at) / dur));
  const bounce = k >= 1 ? settle(t - at - dur, 8, 1.5, 16) : 0;
  return (1 - k) * (y - off) + y * k + bounce;
};

const S5_PILES: [number, number, number, number][] = [
  [560, 660, 6, 9],
  [860, 600, 7, 13],
  [1140, 720, 4, 17],
  [980, 480, 3, 21],
];
export const S5: React.FC<ShotProps> = ({ t, len }) => {
  const coinFly = clamp((t - 1) / 8.5);
  const coin = { x: 1330 - coinFly * 770, y: 190 + coinFly * 450 - Math.sin(Math.PI * coinFly) * 250 };
  return (
    <g transform={`translate(960 540) rotate(${-1.5 + t * 0.01}) scale(${1 + t * 0.0016}) translate(-960 -540)`}>
      <Tabletop edge={900} />
      <LightVeil id="s5veil" lights={[[980, 430, 820]]} o={0.5} />
      <Glow x={980} y={420} r={760} o={0.3} />
      <g transform="rotate(-14 1560 220)">
        <rect x={1380} y={130} width={420} height={280} rx={14} fill="#2E3A5E" />
        <path d="M 1420 130 L 1420 410 M 1540 130 L 1540 410" stroke={GOLD} strokeWidth={12} opacity={0.85} />
      </g>
      <rect x={120} y={880} width={340} height={16} rx={8} fill={GOLD} transform="rotate(-30 290 888)" />
      <ellipse cx={420} cy={300} rx={120} ry={40} fill="#000" opacity={0.3} />
      <BankPhone x={420} y={300} w={150} rot={-20} value={'1 000 000 €'} glow={0.8} />
      {S5_PILES.map(([x, y, n, at], i) => (
        <CoinPile key={i} x={x} y={fallY(t, at, y, 300, 4)} n={n} s={1.25} o={clamp((t - at) * 4)} />
      ))}
      <CoinHead x={740} y={540} r={26} rot={12} />
      <CoinHead x={1030} y={690} r={22} rot={-30} />
      <CoinHead x={700} y={800} r={20} rot={-40} />
      <CoinHead x={coin.x} y={coin.y} r={44} rot={-40 + coinFly * 260} o={1 - clamp((t - 9) * 8)} />
      <g filter="url(#rimR)">
        <path d="M 1300 220 Q 1280 120 1240 -240" stroke={PIP.line} strokeWidth={120} fill="none" strokeLinecap="round" />
        <path d="M 1300 220 Q 1280 120 1240 -240" stroke={PIP.limb} strokeWidth={102} fill="none" strokeLinecap="round" />
        <g transform="translate(1300 220) rotate(160) scale(4.8)">
          <path d="M -12 -3 Q -15 15 -6 19 L 8 19 Q 15 15 12 -3 Z" fill={PIP.hand} stroke={PIP.line} strokeWidth={2.6} strokeLinejoin="round" />
          <ellipse cx={-11} cy={7} rx={5} ry={7.5} fill={PIP.hand} stroke={PIP.line} strokeWidth={2.4} />
        </g>
      </g>
    </g>
  );
};

// ---------- S6: wide, the classroom: coins rain on the desks, the class roars ----------
const RAIN: [number, number, number, number][] = [
  [220, 0.0, 500, 1],
  [540, 3.5, 520, 1],
  [880, 1.8, 495, 1],
  [1240, 4.6, 530, 1],
  [1560, 2.9, 510, 1],
  [700, 5.2, 505, 1],
  [400, 5.8, 570, 2],
  [760, 7.4, 590, 2],
  [1180, 6.1, 560, 2],
  [1480, 8.2, 585, 2],
  [180, 9.1, 575, 2],
  [300, 9.9, 650, 3],
  [700, 10.6, 672, 3],
  [1080, 9.2, 660, 3],
  [1420, 11.4, 680, 3],
  [980, 12.1, 666, 3],
  [520, 11.9, 655, 3],
  [1600, 12.6, 685, 3],
  [860, 12.9, 668, 3],
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
export const S6: React.FC<ShotProps> = ({ t, len }) => {
  const pose = poseAt(t, [
    { f: 0, p: { x: 1230, y: 755, scale: 0.92, yaw: -0.15, look: -0.3, armL: { a: 30, b: 18 }, armR: { a: 30, b: 18 } } },
    { f: 6, p: { armL: { a: 150, b: 10 }, armR: { a: 154, b: 8 }, squash: -0.05 }, ease: easeOut },
    { f: 12, p: { armL: { a: 142, b: 16 }, armR: { a: 146, b: 14 }, squash: 0.02 } },
    { f: 26, p: { headTilt: -6, look: -0.6 } },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 930], [len, 950]]), kf(t, [[0, 420], [len, 440]]), kf(t, [[0, 1.0], [len, 1.06]]))}>
      <Classroom t={t + 300} id="cls6" laugh={t > 5 ? 1 : 0} />
      {RAIN.filter(([, , , d]) => d < 3).map(([x, ph, y0, d]) => rainCoin(t, x, ph, y0, d))}
      <SchoolDesk x={1230} />
      <Hero look={PIP} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [16, 'smug']]) }} rimId="rimR" shadow={0.4} />
      {RAIN.filter(([, , , d]) => d === 3).map(([x, ph, y0, d]) => rainCoin(t, x, ph, y0, d))}
      <Foreground blur={6}>
        <ellipse cx={180} cy={1020} rx={330} ry={170} fill="#181220" />
        <ellipse cx={1790} cy={1060} rx={280} ry={150} fill="#120E18" />
      </Foreground>
    </g>
  );
};

// ---------- S7: macro insert, a school desk top-down: a pile bounces down, a hand slides it over ----------
export const S7: React.FC<ShotProps> = ({ t, len }) => {
  const land = clamp((t - 3) / 9);
  const py = fallY(t, 3, 640, 300);
  const hand = { x: kf(t, [[0, 1360], [8, 1180], [14, 1080], [22, 1060]]), y: kf(t, [[0, 500], [8, 600], [14, 640], [22, 620]]) };
  return (
    <g transform={`translate(960 540) rotate(${1 + t * 0.012}) scale(${1 + t * 0.0016}) translate(-960 -540)`}>
      <Tabletop edge={1120} wood="#B0A088" grain="#9C8C74" lip="#8E8068" floor="#28242E" floorLines="#201C26" />
      <Glow x={900} y={470} r={700} o={0.28} />
      <LightVeil id="s7veil" lights={[[900, 470, 720]]} o={0.48} />
      <OpenBook x={330} y={360} w={330} rot={-9} />
      <rect x={1180} y={780} width={380} height={52} rx={26} fill="#4A5A7A" transform="rotate(8 1370 806)" />
      <rect x={700} y={300} width={17} height={190} rx={8} fill={GOLD} transform="rotate(-36 708 395)" />
      <ellipse cx={930} cy={680} rx={130} ry={24} fill="#000" opacity={0.35} />
      <CoinPile x={930} y={py} n={7} s={1.35} o={land > 0 ? 1 : 0} />
      <CoinHead x={520} y={430} r={46} rot={12} />
      <CoinHead x={730} y={330} r={38} rot={-24} />
      <CoinHead x={1160} y={300} r={36} rot={40} />
      <CoinHead x={kf(t, [[13, 560], [20, 500], [24, 514]])} y={800} r={40} rot={-20 - t * 3} />
      <g filter="url(#rimR)">
        <path d={`M ${hand.x + 240} ${hand.y + 420} Q ${hand.x + 120} ${hand.y + 180} ${hand.x} ${hand.y}`} stroke={PIP.line} strokeWidth={112} fill="none" strokeLinecap="round" />
        <path d={`M ${hand.x + 240} ${hand.y + 420} Q ${hand.x + 120} ${hand.y + 180} ${hand.x} ${hand.y}`} stroke={PIP.limb} strokeWidth={95} fill="none" strokeLinecap="round" />
        <g transform={`translate(${hand.x} ${hand.y}) rotate(-50) scale(4.8)`}>
          <rect x={-5} y={12} width={10} height={24} rx={5} fill={PIP.hand} stroke={PIP.line} strokeWidth={2.4} />
          <path d="M -12 -3 Q -15 15 -6 19 L 8 19 Q 15 15 12 -3 Z" fill={PIP.hand} stroke={PIP.line} strokeWidth={2.6} strokeLinejoin="round" />
          <ellipse cx={-11} cy={7} rx={5} ry={7.5} fill={PIP.hand} stroke={PIP.line} strokeWidth={2.4} />
        </g>
      </g>
      <Foreground blur={16}>
        <ellipse cx={-120} cy={980} rx={420} ry={260} fill="#181220" />
        <ellipse cx={1950} cy={940} rx={420} ry={280} fill="#140F1A" />
      </Foreground>
    </g>
  );
};

// ---------- S8: macro, the phone: the balance drains with the spending ----------
export const S8: React.FC<ShotProps> = ({ t, len }) => {
  const k = easeIn(clamp((t - 5) / 26));
  const v = 1e6 - (1e6 - 12) * k;
  const value = t < 5 ? '1 000 000 €' : fmtEur(v);
  const bad = t >= 27;
  const drains: [number, string][] = [
    [9, '- 249,99 €'],
    [17, '- 4 800,00 €'],
    [25, '- 12 000,00 €'],
  ];
  return (
    <g transform={camT(960, kf(t, [[0, 520], [len, 545]]), kf(t, [[0, 1.02], [len, 1.1]]))}>
      <Tabletop edge={920} wood="#7A6A58" grain="#6A5C4C" lip="#5E5446" kind="stone" floor="#241F28" floorLines="#1D191F" />
      <LightVeil id="s8veil" lights={[[930, 390, 800]]} o={0.5} />
      <Glow x={930} y={380} r={620} o={0.3} />
      <Mug x={1430} y={600} rot={-12} f={t} steam={0.2} />
      <g transform="rotate(-10 275 810)">
        <rect x={40} y={700} width={470} height={220} rx={16} fill="#2E3A5E" />
        <path d="M 90 700 L 90 920 M 210 700 L 210 920" stroke={GOLD} strokeWidth={11} opacity={0.8} />
      </g>
      <ellipse cx={930} cy={650} rx={280} ry={36} fill="#000" opacity={0.42} />
      <BankPhone x={930} y={470} w={230} rot={-5} value={value} glow={bad ? 0.45 : 0.85} />
      <g transform="translate(930 470)">
        {drains.map(([at, txt], i) => {
          if (t <= at) return null;
          const o = 1 - clamp((t - at - 16) / 8);
          if (o <= 0) return null;
          return (
            <text key={i} y={-140 - (t - at) * 2.2} textAnchor="middle" fontFamily={FONT.ui} fontSize={24} fill="#FF8A6A" opacity={o}>
              {txt}
            </text>
          );
        })}
      </g>
      <g filter="url(#rimR)">
        <path d="M 760 60 Q 850 240 890 400 Q 896 428 902 444" stroke={PIP.line} strokeWidth={64} fill="none" strokeLinecap="round" />
        <path d="M 760 60 Q 850 240 890 400 Q 896 428 902 444" stroke={PIP.limb} strokeWidth={50} fill="none" strokeLinecap="round" />
      </g>
      {bad ? <Sparkle x={1210} y={330} t={t - 28} s={0.7} /> : null}
      <circle cx={890} cy={430} r={26} fill={PIP.hand} stroke={PIP.line} strokeWidth={7} />
    </g>
  );
};

// ---------- S9: extreme close on the screen: it rewrites itself back to a million ----------
export const S9: React.FC<ShotProps> = ({ t, len }) => {
  const snap = clamp((t - 9) / 9);
  const v = t < 9 ? 12 : 12 + (1e6 - 12) * backOut(snap);
  const value = t < 9 ? '12 €' : fmtEur(v);
  const jitter = t >= 9 && t < 21 ? (rnd(Math.floor(t), 4) - 0.5) * 8 : 0;
  const pulse = t >= 21 ? 1 + Math.sin((t - 21) / 4.2) * 0.015 : 1;
  return (
    <g transform={camT(935, 490, kf(t, [[0, 1.55], [len, 1.7]]))}>
      <Tabletop edge={920} wood="#6A5C4C" grain="#5C5044" lip="#504638" kind="stone" floor="#201B24" floorLines="#191520" />
      <LightVeil id="s9veil" lights={[[935, 400, 700]]} o={0.42} />
      <Glow x={935} y={390} r={520} o={0.26} />
      <ellipse cx={930} cy={660} rx={300} ry={40} fill="#000" opacity={0.4} />
      <g transform={`translate(${930 + jitter} 470) scale(${pulse}) rotate(-6)`}>
        <g filter="url(#rimR)">
          <path d="M 150 -430 Q 120 -240 60 -140" stroke={PIP.line} strokeWidth={64} fill="none" strokeLinecap="round" />
          <path d="M 150 -430 Q 120 -240 60 -140" stroke={PIP.limb} strokeWidth={50} fill="none" strokeLinecap="round" />
        </g>
        <rect x={-115} y={-231} width={230} height={472} rx={37} fill="#16151C" stroke="#3A3846" strokeWidth={5} />
        <rect x={-101} y={-217} width={202} height={444} rx={30} fill="#0B0A10" />
        <Glow x={0} y={30} r={260} kind="cool" o={t < 9 ? 0.25 : 0.95} />
        <text y={-112} textAnchor="middle" fontFamily={FONT.ui} fontSize={28} fill="#7E8DA6" letterSpacing={4}>
          SOLDE
        </text>
        <text y={78} textAnchor="middle" fontFamily={FONT.ui} fontSize={t < 9 ? 52 : 38} fontWeight={700} fill={t < 9 ? '#F6EFE3' : GOLD_L}>
          {value}
        </text>
        {t >= 20 ? (
          <text y={140} textAnchor="middle" fontFamily={FONT.ui} fontSize={19} fill="#7E8DA6" letterSpacing={3} opacity={clamp((t - 20) / 5)}>
            {'SOLDE RESTAURÉ'}
          </text>
        ) : null}
        <rect x={-28} y={-207} width={56} height={12} rx={6} fill="#000" />
      </g>
      <Ring x={935} y={500} t={(t - 9) * 1.25} r0={150} sx={1.6} sy={1.15} color={GOLD_L} />
      <Ring x={935} y={500} t={(t - 15) * 1.1} r0={200} sx={1.35} sy={1.05} color={GOLD} />
    </g>
  );
};

// ---------- S10: medium, the kitchen: something does not add up; one candle smokes ----------
const S10_STAND = stand(KITCHEN, 0.38, 0.4);
export const S10: React.FC<ShotProps> = ({ t, len }) => {
  const cake = islandTop(0.68, 0.5);
  const phone = islandTop(0.5, 0.42);
  const pose = poseAt(t, [
    { f: 0, p: { x: S10_STAND.x, y: S10_STAND.y, scale: S10_STAND.scale, yaw: 0.25, look: 0.85, armL: { a: 16, b: -8 }, armR: { a: 26, b: 24 }, headTilt: 5 } },
    { f: 8, p: { headTilt: 11, look: 1, armR: { a: 20, b: 18 } }, ease: easeOut },
    { f: 18, p: { headTilt: 4, armR: { a: 30, b: 22 } }, ease: easeOut },
  ]);
  return (
    <g transform={camT(kf(t, [[0, 940], [len, 960]]), 590, kf(t, [[0, 1.7], [len, 1.82]]))}>
      <Kitchen t={t + 140} id="k10" />
      <BankPhone x={phone.x} y={phone.y - 34} w={58} rot={-3} value={'1 000 000 €'} glow={0.9} />
      <Cake x={cake.x} y={cake.y} s={0.72} t={t + 60} deadCandle={0} smoke={1} />
      <KitchenIsland />
      <Hero look={PIP} pose={{ ...pose, ...faceAt(t, [[0, 'oops'], [9, 'worried']]) }} rimId="rimR" shadow={0} />
      <Foreground blur={10}>
        <ellipse cx={360} cy={1030} rx={340} ry={190} fill="#120F17" />
        <ellipse cx={1680} cy={1070} rx={300} ry={170} fill="#0E0B12" />
      </Foreground>
    </g>
  );
};

// ---------- S11: the title, wide on the rooftop at dusk, the phone held up ----------
const ROOF_FEET = 840;
export const S11: React.FC<ShotProps> = ({ t, len }) => {
  const pose = poseAt(t, [
    { f: 0, p: { x: 960, y: ROOF_FEET - LEG_LEN * 0.62, scale: 0.62, yaw: 0, look: 0.2, armL: { a: 18, b: 6 }, armR: { a: 40, b: 60 }, headTilt: 0 } },
    { f: 10, p: { armR: { a: 138, b: 16 }, look: 0.45, headTilt: -4 }, ease: easeOut },
    { f: 18, p: { armR: { a: 142, b: 10 } } },
  ]);
  const j = joints(pose);
  const ph = toWorld(pose, j.armR.end);
  return (
    <g transform={camT(960, kf(t, [[0, 540], [len, 560]]), kf(t, [[0, 1.0], [len, 1.07]]))}>
      <Rooftop t={t} sunX={960} sunY={700 - 40 * easeOut(clamp(t / 40))} />
      <Cat x={620} y={ROOF_FEET + 6} mood={t > 12 ? 'alert' : 'sleep'} f={t} />
      <Hero look={PIP} pose={{ ...pose, ...faceAt(t, [[0, 'happy'], [22, 'smug']]) }} rimId="rimR" shadow={0.6} />
      <BankPhone x={ph.x + 6} y={ph.y + 6} w={54} rot={-14} value={'1 000 000 €'} glow={1} />
      <Sparkle x={ph.x + 64} y={ph.y - 46} t={t - 16} s={1.2} />
      <TitleCard t={t} lines={['ET SI TU DEVENAIS', 'MILLIONNAIRE À 16 ANS ?']} accent="MILLIONNAIRE" accentT={38} y={170} size={92} />
    </g>
  );
};

// ---------- S12: schematic: a million, and no origin behind it ----------
export const S12: React.FC<ShotProps> = ({ t, len }) => (
  <g transform={`translate(960 540) scale(${kf(t, [[0, 1], [len, 1.05]])}) translate(-960 -540)`}>
    <Schematic t={t} id="sch12" />
    <SchLabel x={430} y={205} t={t} text={'LE SOLDE'} size={40} color={SCH.dim} />
    <g transform="translate(430 420)">
      <circle r={130} fill="none" stroke={SCH.line} strokeWidth={6} opacity={easeOut(clamp(t / 8))} />
      <circle r={84} fill="none" stroke={SCH.line} strokeWidth={4} opacity={0.5} />
      <text y={26} textAnchor="middle" fontFamily={FONT.title} fontWeight={800} fontSize={90} fill={GOLD_L} opacity={easeOut(clamp(t / 8))}>
        {'€'}
      </text>
    </g>
    <SchLabel x={430} y={620} t={t - 4} text={'1 000 000 €'} size={52} color={GOLD_L} />
    <Arrow x0={630} y0={420} x1={880} y1={420} t={t - 10} color={SCH.dim} />
    <SchLabel x={1240} y={280} t={t - 15} text={'ORIGINE'} size={44} color={SCH.dim} />
    {t > 18 ? <rect x={1000} y={330} width={480} height={270} rx={12} fill="none" stroke={SCH.dim} strokeWidth={4} strokeDasharray="18 14" opacity={0.8} /> : null}
    {t > 25 ? (
      <text x={1240} y={530} textAnchor="middle" fontFamily={FONT.title} fontWeight={800} fontSize={200} fill={SCH.live} style={{ filter: `drop-shadow(0 0 18px ${SCH.glow})` }}>
        {'?'}
      </text>
    ) : null}
    <DrawOn d="M 1000 700 L 1480 700" t={t - 29} dur={8} color={SCH.dim} width={3} />
    <SchLabel x={1240} y={772} t={t - 33} text={'AUCUN SALAIRE · AUCUNE VENTE · RIEN'} size={38} color={SCH.dim} />
  </g>
);

// ---------- S13: schematic: what is left of a million after twenty years at 2 % ----------
export const S13: React.FC<ShotProps> = ({ t, len }) => {
  const y = 20 * clamp((t - 10) / 40);
  const v = 1e6 * Math.pow(0.98, y);
  const pct = Math.round((v / 1e6) * 100);
  const w = 540 * (v / 1e6);
  return (
    <g>
      <Schematic t={t + 40} id="sch13" />
      <SchLabel x={200} y={250} t={t - 2} text={"POUVOIR D'ACHAT"} size={40} color={SCH.dim} anchor="start" />
      <rect x={200} y={360} width={540} height={96} rx={14} fill="#ffffff" opacity={0.08} />
      <rect x={200} y={360} width={Math.max(w, 16)} height={96} rx={14} fill={GOLD_L} />
      <text x={200 + Math.max(w, 16) - 16} y={427} textAnchor="end" fontFamily={FONT.ui} fontSize={52} fill="#12182A" fontWeight={700} opacity={t > 12 && w > 140 ? 1 : 0}>
        {`${pct} %`}
      </text>
      <DrawOn d="M 200 560 L 740 560" t={t - 8} dur={10} color={SCH.dim} width={3} />
      <SchLabel x={200} y={612} t={t - 14} text={'0'} size={28} color={SCH.dim} />
      <SchLabel x={470} y={612} t={t - 18} text={'10 ANS'} size={28} color={SCH.dim} />
      <SchLabel x={720} y={612} t={t - 22} text={'20 ANS'} size={28} color={SCH.dim} />
      <SchLabel x={1030} y={215} t={t - 26} text={'2 % PAR AN'} size={46} color={GOLD_L} />
      <Arrow x0={960} y0={280} x1={960} y1={430} t={t - 30} color={SCH.dim} />
      <CoinHead x={860} y={560} r={72} rot={-12} o={t > 26 ? Math.max(0.45, v / 1e6) : 0} />
      {t > 40 ? (
        <text x={1520} y={430} textAnchor="middle" fontFamily={FONT.title} fontWeight={800} fontSize={110} fill={t > 44 ? SCH.live : SCH.dim} style={{ filter: t > 44 ? `drop-shadow(0 0 14px ${SCH.glow})` : 'none' }}>
          {'−33 %'}
        </text>
      ) : null}
      <DrawOn d="M 1240 372 L 1240 520" t={t - 40} dur={6} color={SCH.dim} width={4} />
      <SchLabel x={1520} y={500} t={t - 48} text={'EN 20 ANS'} size={36} color={SCH.dim} />
    </g>
  );
};

// ---------- S14: close-up, « C'est vrai. »: Pip, worried, the light starting to turn ----------
export const S14: React.FC<ShotProps> = ({ t, len }) => {
  const sc = 6.4 * (1 + 0.04 * clamp(t / len));
  const head = { x: 960, y: 720 };
  const red = 0.45 * clamp(t / len);
  const pose: Pose = { ...basePose, x: head.x, y: head.y - HEAD.y * sc, scale: sc, yaw: 0.12, look: 0.1, armL: { a: 14, b: -6 }, armR: { a: 14, b: -6 }, headTilt: kf(t, [[0, 0], [18, 4]]), ...faceAt(t, [[0, 'worried']]) };
  return (
    <g>
      <g filter="url(#blur16)">
        <g transform="translate(-600 -560) scale(2)">
          <Rooftop t={t + 200} sunX={980} sunY={600} red={red} low={180} />
        </g>
      </g>
      <rect x={0} y={0} width={1920} height={1080} fill="#07040C" opacity={0.22} />
      <Hero look={PIP} pose={pose} rimId={t > len * 0.55 ? 'rimRed' : 'rimR'} shadow={0} />
    </g>
  );
};

// ---------- S15: wide, low angle: the suit walks out of the dusk toward him ----------
export const S15: React.FC<ShotProps> = ({ t, len }) => {
  const suitX = kf(t, [[0, 560], [60, 1050]]);
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
      <Hero look={SUIT} pose={{ ...suit, ...faceAt(t, [[0, 'neutral']]) }} rimId="rimR" shadow={0} />
      <Hero look={PIP} pose={{ ...pose, ...faceAt(t, [[0, 'worried'], [50, 'shock']]) }} rimId="rimRed" shadow={0} />
      <BankPhone x={ph.x + 8} y={ph.y + 8} w={40} rot={-10} value={'1 000 000 €'} glow={1} />
      <BalanceChip x={1080} y={210} t={t - 14} />
      <Foreground blur={6}>
        <ellipse cx={130} cy={1010} rx={380} ry={220} fill="#10040C" />
      </Foreground>
    </g>
  );
};
