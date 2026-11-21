import React from 'react';
import { z } from 'zod';
import { backOut, clamp, easeIn, easeOut } from '../anim';
import { FONT } from '../font-faces';

export const OBJECT_KINDS = [
  'ticket',
  'tray',
  'plate',
  'coin',
  'bill',
  'notebook',
  'bell',
  'lunchbox',
  'phone',
  'chart',
  'key',
  'heart',
  'bag',
  'book',
  'cup',
  'apple',
  'cart',
  'meal',
  'sign',
  'bottle',
  'box',
  'screen',
  'clock',
] as const;

export type ObjectKind = (typeof OBJECT_KINDS)[number];

export const objectPropZ = z.object({
  kind: z.enum(OBJECT_KINDS),
  label: z.string().default(''),
  x: z.number().min(0.05).max(0.95).default(0.7),
  y: z.number().min(0.12).max(0.92).default(0.55),
  s: z.number().min(0.4).max(2).default(1),
  rot: z.number().min(-30).max(30).default(0),
  at: z.number().int().nonnegative().default(4),
  anim: z.enum(['pop', 'drop', 'fly', 'rise', 'none']).default('pop'),
});
export type ObjectProp = z.infer<typeof objectPropZ>;

const INK = '#1D2033';
const CREAM = '#F6EFE3';
const ORANGE = '#FF8A3D';
const TEAL = '#2FB7A6';
const GOLD = '#E9C46A';
const ROSE = '#D96A7A';

const Silhouette: React.FC<{ kind: ObjectKind }> = ({ kind }) => {
  switch (kind) {
    case 'ticket':
      return (
        <g>
          <path d="M -66 -36 L 66 -36 L 66 36 L -66 36 Z" fill={CREAM} stroke={INK} strokeWidth={5} />
          <path d="M -18 -36 L -18 36" stroke={INK} strokeWidth={4} strokeDasharray="9 9" />
          <path d="M -56 -18 L -30 -18 M -56 -2 L -30 -2" stroke="#9A8A76" strokeWidth={6} strokeLinecap="round" />
          <circle cx={30} cy={4} r={16} fill="none" stroke={ORANGE} strokeWidth={6} />
        </g>
      );
    case 'tray':
      return (
        <g>
          <path d="M -70 -26 L 70 -26 L 60 40 L -60 40 Z" fill={TEAL} stroke={INK} strokeWidth={5} />
          <path d="M -14 -26 L -10 40 M 16 -26 L 14 40" stroke={INK} strokeWidth={4} opacity={0.6} />
          <path d="M -70 -26 L 70 -26" stroke={CREAM} strokeWidth={6} strokeLinecap="round" />
        </g>
      );
    case 'plate':
      return (
        <g>
          <ellipse cx={0} cy={0} rx={66} ry={30} fill={CREAM} stroke={INK} strokeWidth={5} />
          <ellipse cx={0} cy={0} rx={40} ry={16} fill="#E3D8C6" stroke={INK} strokeWidth={3} />
        </g>
      );
    case 'coin':
      return (
        <g>
          <circle cx={0} cy={0} r={40} fill={GOLD} stroke={INK} strokeWidth={5} />
          <circle cx={0} cy={0} r={26} fill="none" stroke={INK} strokeWidth={3} opacity={0.7} />
          <path d="M -12 0 L -4 -10 L 10 8" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case 'bill':
      return (
        <g>
          <path d="M -76 -34 L 76 -34 L 76 34 L -76 34 Z" fill="#4E8C6A" stroke={INK} strokeWidth={5} />
          <circle cx={0} cy={0} r={20} fill={CREAM} stroke={INK} strokeWidth={4} />
          <path d="M -64 -22 L -34 -22 M 64 22 L 34 22" stroke={CREAM} strokeWidth={6} strokeLinecap="round" opacity={0.8} />
        </g>
      );
    case 'notebook':
      return (
        <g>
          <rect x={-52} y={-44} width={104} height={88} rx={8} fill="#C8543F" stroke={INK} strokeWidth={5} />
          <path d="M -52 0 L 52 0" stroke={INK} strokeWidth={4} opacity={0.5} />
          {[...Array(5)].map((_, i) => (
            <path key={i} d={`M ${-48 + i * 22} -44 L ${-48 + i * 22} 44`} stroke={INK} strokeWidth={4} opacity={0.7} />
          ))}
          <path d="M -20 -18 L 20 -18 M -20 2 L 30 2" stroke={CREAM} strokeWidth={5} strokeLinecap="round" opacity={0.85} />
        </g>
      );
    case 'bell':
      return (
        <g>
          <path d="M -34 26 C -34 -16 -18 -42 0 -42 C 18 -42 34 -16 34 26 Z" fill={GOLD} stroke={INK} strokeWidth={5} />
          <rect x={-44} y={24} width={88} height={14} rx={7} fill={INK} />
          <circle cx={0} cy={44} r={9} fill={INK} />
          <circle cx={0} cy={-46} r={8} fill={ORANGE} stroke={INK} strokeWidth={4} />
        </g>
      );
    case 'lunchbox':
      return (
        <g>
          <rect x={-62} y={-34} width={124} height={68} rx={16} fill={ROSE} stroke={INK} strokeWidth={5} />
          <path d="M -30 -34 C -30 -56 30 -56 30 -34" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <path d="M -18 -8 L 18 -8 M -18 10 L 8 10" stroke={CREAM} strokeWidth={6} strokeLinecap="round" opacity={0.9} />
        </g>
      );
    case 'phone':
      return (
        <g>
          <rect x={-34} y={-58} width={68} height={116} rx={14} fill="#16151C" stroke={INK} strokeWidth={5} />
          <rect x={-25} y={-44} width={50} height={88} rx={6} fill="#2A3A52" />
          <rect x={-12} y={-54} width={24} height={5} rx={2} fill="#4A5570" />
        </g>
      );
    case 'chart':
      return (
        <g>
          <rect x={-62} y={-46} width={124} height={92} rx={8} fill={CREAM} stroke={INK} strokeWidth={5} />
          <rect x={-44} y={6} width={20} height={26} fill={ORANGE} stroke={INK} strokeWidth={3} />
          <rect x={-14} y={-12} width={20} height={44} fill={TEAL} stroke={INK} strokeWidth={3} />
          <rect x={16} y={-30} width={20} height={62} fill={GOLD} stroke={INK} strokeWidth={3} />
        </g>
      );
    case 'key':
      return (
        <g>
          <circle cx={-34} cy={0} r={26} fill="none" stroke={GOLD} strokeWidth={12} />
          <path d="M -10 0 L 62 0 M 38 0 L 38 18 M 54 0 L 54 18" stroke={GOLD} strokeWidth={12} strokeLinecap="round" />
        </g>
      );
    case 'heart':
      return (
        <g>
          <path
            d="M 0 40 C -52 8 -46 -34 -18 -34 C -6 -34 0 -24 0 -24 C 0 -24 6 -34 18 -34 C 46 -34 52 8 0 40 Z"
            fill={ROSE}
            stroke={INK}
            strokeWidth={5}
          />
        </g>
      );
    case 'bag':
      return (
        <g>
          <path d="M -46 -18 L 46 -18 L 58 44 L -58 44 Z" fill="#8A6A4A" stroke={INK} strokeWidth={5} />
          <path d="M -22 -18 C -22 -48 22 -48 22 -18" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <rect x={-20} y={2} width={40} height={16} rx={4} fill={CREAM} opacity={0.75} />
        </g>
      );
    case 'book':
      return (
        <g>
          <rect x={-58} y={-40} width={116} height={80} rx={6} fill="#4A5A8A" stroke={INK} strokeWidth={5} />
          <path d="M 0 -40 L 0 40" stroke={INK} strokeWidth={4} opacity={0.6} />
          <path d="M -46 -14 L -14 -14 M -46 2 L -14 2" stroke={CREAM} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
          <path d="M 14 -14 L 46 -14 M 14 2 L 46 2" stroke={CREAM} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
        </g>
      );
    case 'cup':
      return (
        <g>
          <path d="M -38 -34 L 38 -34 L 30 36 L -30 36 Z" fill={CREAM} stroke={INK} strokeWidth={5} />
          <path d="M 38 -18 C 62 -18 62 12 36 10" fill="none" stroke={INK} strokeWidth={6} />
          <rect x={-44} y={-44} width={88} height={12} rx={6} fill={ORANGE} stroke={INK} strokeWidth={4} />
        </g>
      );
    case 'apple':
      return (
        <g>
          <circle cx={0} cy={4} r={40} fill={ROSE} stroke={INK} strokeWidth={5} />
          <path d="M 0 -34 C 0 -52 6 -58 14 -62" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <path d="M 8 -46 C 26 -56 34 -42 24 -34 C 16 -28 10 -34 8 -46 Z" fill={TEAL} stroke={INK} strokeWidth={4} />
          <path d="M -18 -14 C -28 -6 -28 14 -16 22" fill="none" stroke={CREAM} strokeWidth={6} strokeLinecap="round" opacity={0.6} />
        </g>
      );
    case 'cart':
      return (
        <g>
          <path d="M -76 -18 L 62 -18 L 50 30 L -64 30 Z" fill="#B9C2CC" stroke={INK} strokeWidth={5} />
          <path d="M -76 -18 L -88 -46 L -96 -46" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <path d="M -44 -18 L -44 30 M 0 -18 L 0 30 M 32 -18 L 32 30" stroke={INK} strokeWidth={4} opacity={0.45} />
          <circle cx={-40} cy={44} r={13} fill={INK} />
          <circle cx={28} cy={44} r={13} fill={INK} />
        </g>
      );
    case 'meal':
      return (
        <g>
          <ellipse cx={0} cy={14} rx={68} ry={26} fill={CREAM} stroke={INK} strokeWidth={5} />
          <path d="M -40 8 C -26 -22 4 -26 16 -4 C 24 12 6 20 -8 16 C -22 12 -32 16 -40 8 Z" fill={ORANGE} stroke={INK} strokeWidth={4} />
          <circle cx={34} cy={4} r={11} fill={TEAL} stroke={INK} strokeWidth={4} />
          <path d="M -52 -6 L -34 -6" stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
        </g>
      );
    case 'sign':
      return (
        <g>
          <rect x={-60} y={-38} width={120} height={76} rx={10} fill={CREAM} stroke={INK} strokeWidth={5} />
          <path d="M -38 -8 L 38 -8 M -38 14 L 14 14" stroke={INK} strokeWidth={7} strokeLinecap="round" opacity={0.75} />
          <path d="M 0 38 L 0 62" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        </g>
      );
    case 'bottle':
      return (
        <g>
          <path d="M -20 -52 L 20 -52 L 20 -30 C 34 -22 36 4 30 40 L -30 40 C -36 4 -34 -22 -20 -30 Z" fill="#7FB3D5" stroke={INK} strokeWidth={5} />
          <rect x={-14} y={-62} width={28} height={14} rx={5} fill={TEAL} stroke={INK} strokeWidth={4} />
          <path d="M -22 4 L 22 4" stroke={CREAM} strokeWidth={7} opacity={0.7} />
        </g>
      );
    case 'box':
      return (
        <g>
          <path d="M -64 -24 L 64 -24 L 64 42 L -64 42 Z" fill="#C99A5E" stroke={INK} strokeWidth={5} />
          <path d="M -64 -24 L -40 -44 L 88 -44 L 64 -24" fill="#DDB07A" stroke={INK} strokeWidth={5} />
          <path d="M 64 -24 L 88 -44 L 88 22 L 64 42" fill="#B0834E" stroke={INK} strokeWidth={5} />
          <path d="M -22 -24 L -22 42" stroke={INK} strokeWidth={4} opacity={0.4} />
        </g>
      );
    case 'screen':
      return (
        <g>
          <rect x={-72} y={-46} width={144} height={88} rx={8} fill="#141A26" stroke={INK} strokeWidth={5} />
          <rect x={-62} y={-36} width={124} height={68} rx={4} fill="#2FB7A6" opacity={0.28} />
          <path d="M -44 10 L -22 -8 L -2 2 L 20 -20 L 42 -6" fill="none" stroke={TEAL} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M -26 60 L 26 60" stroke={INK} strokeWidth={8} strokeLinecap="round" />
        </g>
      );
    case 'clock':
      return (
        <g>
          <circle cx={0} cy={0} r={44} fill={CREAM} stroke={INK} strokeWidth={6} />
          <path d="M 0 0 L 0 -28 M 0 0 L 20 12" stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <circle cx={0} cy={0} r={5} fill={ORANGE} />
        </g>
      );
  }
};

const ObjectLabel: React.FC<{ text: string }> = ({ text }) => {
  const size = text.length > 18 ? 24 : text.length > 10 ? 27 : 31;
  const w = text.length * size * 0.62 + 34;
  return (
    <g transform="translate(0 74)">
      <rect x={-w / 2} y={-size * 0.78} width={w} height={size * 1.56} rx={size * 0.78} fill="#0B0816" opacity={0.84} />
      <text y={size * 0.36} textAnchor="middle" fontFamily={FONT.ui} fontSize={size} fill={CREAM} letterSpacing={1}>
        {text}
      </text>
    </g>
  );
};

export const PropObject: React.FC<{ o: ObjectProp; t: number; centered?: boolean }> = ({ o, t, centered = false }) => {
  if (t < o.at) return null;
  const k = clamp((t - o.at) / 8);
  let sx = 1;
  let sy = 1;
  let dx = 0;
  let dy = 0;
  let op = 1;
  if (o.anim === 'pop') {
    const s = backOut(k);
    sx = s;
    sy = s;
  } else if (o.anim === 'drop') {
    const e = easeIn(clamp((t - o.at) / 10));
    dy = -280 * (1 - e);
    sy = 0.88 + 0.12 * e;
  } else if (o.anim === 'fly') {
    dx = -240 * (1 - easeOut(k));
    op = 1 - clamp((t - o.at) / 30) * 0.45;
  } else if (o.anim === 'rise') {
    dy = 110 * (1 - easeOut(k));
    op = clamp(k * 2);
  }
  const label = o.label.trim();
  const tx = (centered ? 0 : o.x * 1920) + dx;
  const ty = (centered ? 0 : o.y * 1080) + dy;
  return (
    <g transform={`translate(${tx} ${ty}) rotate(${o.rot}) scale(${o.s * sx} ${o.s * sy})`} opacity={op}>
      <Silhouette kind={o.kind} />
      {label ? <ObjectLabel text={label} /> : null}
    </g>
  );
};
