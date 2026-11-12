import React from 'react';
import { clamp, backOut } from '../anim';
import { Glow } from '../light';
import { SCH } from '../sets/schematic';
import { FONT } from '../font-faces';

// Props promoted from the bespoke episode code (million16) so archetypes can reuse them:
// the bank phone, the gold accents, coins, piles, the birthday cake and the origin balance chip.

export const GOLD = '#E9C46A';
export const GOLD_L = '#FFE9A8';
export const GOLD_D = '#B8862B';

export const fmtEur = (v: number) => Math.max(0, Math.round(v)).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, ' ') + ' €';
export const balCol = (value: string, topped: boolean) => (topped ? GOLD_L : '#F6EFE3');

export const BankPhone: React.FC<{ x: number; y: number; w: number; rot?: number; value: string; glow?: number; label?: string; gold?: boolean }> = ({ x, y, w, rot = 0, value, glow = 1, label = 'SOLDE', gold = false }) => {
  const h = w * 2.05;
  const sz = value.length > 8 ? w * 0.135 : w * 0.17;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-w * 0.44} y={h * 0.5 - 8} width={w * 0.88} height={h * 0.12} rx={w * 0.08} fill="#000" opacity={0.35} />
      <rect x={-w * 0.5} y={-h / 2} width={w} height={h} rx={w * 0.16} fill="#16151C" stroke="#3A3846" strokeWidth={4 * (w / 200)} />
      <rect x={-w * 0.44} y={-h / 2 + w * 0.06} width={w * 0.88} height={h - w * 0.12} rx={w * 0.11} fill="#0B0A10" />
      <Glow x={0} y={0} r={w * 1.6} kind="cool" o={0.42 * glow} />
      {label ? <text y={-h * 0.3} textAnchor="middle" fontFamily={FONT.ui} fontSize={w * 0.13} fill="#7E8DA6" letterSpacing={w * 0.01}>{label}</text> : null}
      <text y={h * 0.08} textAnchor="middle" fontFamily={FONT.ui} fontSize={sz} fill={gold ? GOLD_L : '#F6EFE3'} fontWeight={700}>
        {value}
      </text>
      <rect x={-w * 0.12} y={-h / 2 + w * 0.09} width={w * 0.24} height={w * 0.05} rx={w * 0.025} fill="#000" />
    </g>
  );
};

export const Ring: React.FC<{ x: number; y: number; t: number; color?: string; r0?: number; sx?: number; sy?: number }> = ({ x, y, t, color = GOLD_L, r0 = 70, sx = 1, sy = 0.55 }) => {
  if (t <= 0 || t > 26) return null;
  return <ellipse cx={x} cy={y} rx={(r0 + t * 9) * sx} ry={(r0 + t * 9) * sy} fill="none" stroke={color} strokeWidth={Math.max(2, 7 - t * 0.18)} opacity={clamp(1 - t / 22)} />;
};

export const CoinHead: React.FC<{ x: number; y: number; r: number; rot?: number; sqx?: number; o?: number }> = ({ x, y, r, rot = 0, sqx = 1, o = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${sqx} 1)`} opacity={o}>
    <circle r={r} fill={GOLD} stroke={GOLD_D} strokeWidth={r * 0.09} />
    <circle r={r * 0.64} fill="none" stroke={GOLD_D} strokeWidth={r * 0.06} opacity={0.7} />
    <path d={`M ${-r * 0.16} ${r * 0.38} L ${-r * 0.16} ${-r * 0.38} M ${-r * 0.16} ${-r * 0.4} q ${r * 0.4} ${-r * 0.1} ${r * 0.4} ${r * 0.15} q 0 ${r * 0.26} ${-r * 0.4} ${r * 0.15} M ${-r * 0.38} ${-r * 0.08} L ${-r * 0.08} ${-r * 0.08} M ${-r * 0.38} ${r * 0.08} L ${-r * 0.08} ${r * 0.08}`} stroke="#7A5218" strokeWidth={r * 0.085} fill="none" strokeLinecap="round" />
    <path d={`M ${-r * 0.5} ${-r * 0.55} q ${r * 0.5} ${-r * 0.5} ${r * 1.05} ${-r * 0.12}`} stroke="#FFF3C4" strokeWidth={r * 0.08} fill="none" strokeLinecap="round" opacity={0.6} />
  </g>
);

export const CoinPile: React.FC<{ x: number; y: number; n: number; s?: number; o?: number }> = ({ x, y, n, s = 1, o = 1 }) => (
  <g opacity={o}>
    {Array.from({ length: n - 1 }).map((_, i) => (
      <ellipse key={i} cx={x + Math.sin(i * 1.7) * 4 * s} cy={y - i * 9 * s} rx={30 * s} ry={11 * s} fill={i % 2 ? GOLD_D : GOLD} stroke="#7A5218" strokeWidth={2.4 * s} />
    ))}
    <ellipse cx={x} cy={y - (n - 2) * 9 * s} rx={30 * s} ry={11 * s} fill={GOLD_L} stroke="#7A5218" strokeWidth={2.4 * s} />
  </g>
);

export const Cake: React.FC<{ x: number; y: number; s?: number; t: number; smoke?: number; deadCandle?: number; candles?: string }> = ({ x, y, s = 1, t, smoke = 0, deadCandle = -1, candles = '16' }) => {
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
        {candles}
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

export const BalanceChip: React.FC<{ x: number; y: number; t: number; w?: number; value?: string; caption?: string }> = ({ x, y, t, w = 680, value = '1 000 000 €', caption = 'ORIGINE' }) => {
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
        {value}
      </text>
      <line x1={w / 2 - 250} y1={-34} x2={w / 2 - 250} y2={34} stroke="#7E8DA6" strokeWidth={2} opacity={0.5} />
      <text x={w / 2 - 30} y={-14} textAnchor="end" fontFamily={FONT.ui} fontSize={30} fill="#7E8DA6" letterSpacing={3}>
        {caption}
      </text>
      <text x={w / 2 - 30} y={46} textAnchor="end" fontFamily={FONT.title} fontWeight={800} fontSize={54} fill={SCH.live} opacity={blink}>
        {'?'}
      </text>
    </g>
  );
};
