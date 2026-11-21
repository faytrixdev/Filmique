import React from 'react';
import { makeRoom, Box, S3 } from '../room';
import { WallTexture, RoomCorners, LightVeil, Dust, Glow } from '../light';
import { C } from '../rig';

export const CAN = makeRoom({ x: 900, y: 500 }, { x0: 320, x1: 1520, y0: 250, y1: 760 }, 3.4);

export type CanteenKid = { hair: 'pony' | 'short' | 'curly' | 'bun' | 'cap'; hairC: string; top: string };
export const CAN_KIDS: CanteenKid[] = [
  { hair: 'pony', hairC: '#3A2420', top: '#6A8A9A' },
  { hair: 'short', hairC: '#2A1C18', top: '#9A6A5A' },
  { hair: 'curly', hairC: '#1E1418', top: '#7A7A4A' },
  { hair: 'bun', hairC: '#5A3A28', top: '#6A5A8A' },
  { hair: 'cap', hairC: '#C9925A', top: '#4A6A5A' },
];

const CanteenKid: React.FC<{ x: number; y: number; s: number; look: CanteenKid; turn?: number; t?: number }> = ({ x, y, s, look, turn = 0, t = 0 }) => {
  const bob = Math.sin(t / 22 + x / 90) * 2.4;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${s})`} filter="url(#rimL)">
      <path d="M -62 0 Q -64 -96 0 -100 Q 64 -96 62 0 Z" fill={look.top} />
      <path d="M -62 0 Q -64 -96 0 -100 L 0 0 Z" fill="#000" opacity={0.12} />
      <g transform={`translate(0 -150)`}>
        <circle r={52} fill={turn > 0.3 ? C.skin : look.hairC} />
        {turn > 0.3 ? (
          <g>
            <path d="M -52 0 A 52 52 0 0 1 30 -42 Q 6 -10 -40 30 Z" fill={look.hairC} />
            <circle cx={26} cy={-4} r={5} fill={C.ink} />
            <path d="M 18 22 L 38 20" stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
          </g>
        ) : null}
        {look.hair === 'bun' ? <circle cx={0} cy={-56} r={22} fill={look.hairC} /> : null}
        {look.hair === 'pony' ? <path d="M -6 -20 Q -30 40 -10 70 Q 4 40 6 -20 Z" fill={look.hairC} /> : null}
        {look.hair === 'cap' ? <path d="M -54 -6 Q -50 -60 0 -62 Q 50 -60 54 -6 Z M 30 -20 L 86 -14 L 86 -6 L 30 -8 Z" fill="#B0463A" /> : null}
        {look.hair === 'curly' ? [-40, -20, 0, 20, 40].map((cx, i) => <circle key={i} cx={cx} cy={-40 + Math.abs(cx) * 0.4} r={20} fill={look.hairC} />) : null}
      </g>
    </g>
  );
};

const Table: React.FC<{ u0: number; u1: number; w0: number; w1: number; trays?: number }> = ({ u0, u1, w0, w1, trays = 0 }) => {
  const r = CAN;
  const leg = (uu: number, ww: number) => {
    const a = r.P(uu, 0.78, ww);
    const b = r.P(uu, 1, ww);
    return <path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} stroke={S3.metal} strokeWidth={7} />;
  };
  return (
    <g>
      {leg(u0 + 0.03, w0 + 0.01)}
      {leg(u1 - 0.03, w0 + 0.01)}
      {leg(u0 + 0.03, w1 - 0.01)}
      {leg(u1 - 0.03, w1 - 0.01)}
      <Box r={r} u={[u0, u1]} v={[0.7, 0.78]} w={[w0, w1]} front="#8A6A4E" top="#A07F5E" side="#6A4E38" rim />
      <Box r={r} u={[u0 - 0.02, u1 + 0.02]} v={[0.79, 0.84]} w={[w0 + 0.03, w1 - 0.03]} front="#5E4634" top="#6A5040" side="#4A3527" />
      {Array.from({ length: trays }).map((_, i) => {
        const u = u0 + ((i + 0.5) / trays) * (u1 - u0);
        const p = r.P(u, 0.7, (w0 + w1) / 2);
        const k = r.s((w0 + w1) / 2) * 90;
        return (
          <g key={`tr${i}`} transform={`translate(${p.x} ${p.y - k * 0.12}) rotate(-4)`}>
            <rect x={-k * 0.5} y={-k * 0.16} width={k} height={k * 0.32} rx={k * 0.06} fill="#2FB7A6" stroke="#1D2033" strokeWidth={4} />
            <rect x={-k * 0.34} y={-k * 0.1} width={k * 0.26} height={k * 0.2} rx={k * 0.04} fill="#F6EFE3" opacity={0.85} />
            <circle cx={k * 0.24} cy={0} r={k * 0.09} fill="#E9C46A" stroke="#1D2033" strokeWidth={3} />
          </g>
        );
      })}
    </g>
  );
};

export const Cantine: React.FC<{ t: number; id?: string; veil?: number; kids?: number; trays?: number; warm?: number }> = ({
  t,
  id = 'can',
  veil = 0.34,
  kids = 5,
  trays = 3,
  warm = 1,
}) => {
  const r = CAN;
  const { P, Q } = r;
  const tiles: React.ReactNode[] = [];
  for (let i = 1; i < 12; i++) {
    const a = P(i / 12, 1, 0);
    const b = P(i / 12, 1, 1);
    tiles.push(<path key={`ta${i}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} stroke="#2A2230" strokeWidth={2} />);
  }
  for (let j = 1; j < 10; j++) {
    const w = j / 10;
    const a = P(0, 1, w);
    const b = P(1, 1, w);
    tiles.push(<path key={`tb${j}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} stroke="#2A2230" strokeWidth={2} />);
  }
  const counter = P(0.08, 0.62, 0.42);
  const counterK = r.s(0.42);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7FA8C8" />
          <stop offset="70%" stopColor="#E8C48E" />
          <stop offset="100%" stopColor="#FFD9A8" />
        </linearGradient>
      </defs>
      <polygon points={Q([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]])} fill="#2A2530" />
      <polygon points={Q([[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]])} fill="#4A4458" />
      <polygon points={Q([[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]])} fill="#3A3444" />
      <polygon points={Q([[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]])} fill="#4A4048" />
      {tiles}
      <rect x={320} y={250} width={1200} height={510} fill="#6A5F6E" />
      <WallTexture rect={[320, 250, 1200, 510]} />
      <WallTexture points={Q([[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]])} />
      <WallTexture points={Q([[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]])} />
      <RoomCorners x0={320} x1={1520} y0={250} y1={760} />
      <rect x={320} y={744} width={1200} height={16} fill={S3.trim} />
      {[
        [0.34, 0.52],
        [0.56, 0.74],
      ].map(([u0, u1], i) => (
        <g key={`wn${i}`}>
          <polygon points={Q([[u0, 0.14, 0], [u1, 0.14, 0], [u1, 0.62, 0], [u0, 0.62, 0]])} fill={`url(#${id}sky)`} />
          <polygon points={Q([[u0, 0.14, 0], [u1, 0.14, 0], [u1, 0.62, 0], [u0, 0.62, 0]])} fill="none" stroke="#241E2E" strokeWidth={11} />
          <path d={`M ${P((u0 + u1) / 2, 0.14, 0).x} ${P((u0 + u1) / 2, 0.14, 0).y} L ${P((u0 + u1) / 2, 0.62, 0).x} ${P((u0 + u1) / 2, 0.62, 0).y}`} stroke="#241E2E" strokeWidth={8} />
          <path d={`M ${P(u0, 0.38, 0).x} ${P(u0, 0.38, 0).y} L ${P(u1, 0.38, 0).x} ${P(u1, 0.38, 0).y}`} stroke="#241E2E" strokeWidth={8} />
          <polygon points={Q([[u0, 0.62, 0], [u1, 0.62, 0], [u1 + 0.1, 1, 0.4], [u0 - 0.1, 1, 0.4]])} fill="#FFD9A8" opacity={0.1 * warm} style={{ mixBlendMode: 'screen' }} />
        </g>
      ))}
      <Box r={r} u={[0.02, 0.2]} v={[0.55, 0.72]} w={[0.3, 0.66]} front="#7A6A5A" top="#8E7C68" side="#5E5144" rim />
      <Box r={r} u={[0.02, 0.2]} v={[0.44, 0.56]} w={[0.32, 0.64]} front="#5E5144" top="#6E6050" side="#4A4038" />
      <Glow x={counter.x} y={counter.y - counterK * 60} r={300 * counterK} o={0.3 * warm} />
      <Table u0={0.28} u1={0.66} w0={0.2} w1={0.5} trays={trays} />
      <Table u0={0.34} u1={0.74} w0={0.58} w1={0.92} trays={Math.max(1, trays - 1)} />
      <Box r={r} u={[0.76, 0.96]} v={[0.62, 0.76]} w={[0.2, 0.56]} front="#6A5F4E" top="#7E705C" side="#52483C" rim />
      {Array.from({ length: kids }).map((_, i) => {
        const look = CAN_KIDS[i % CAN_KIDS.length];
        const p = P(0.3 + i * 0.11, 0.72, 0.18);
        return <CanteenKid key={`k${i}`} x={p.x} y={p.y} s={r.s(0.18) * 0.62} look={look} turn={i === 1 ? 1 : 0} t={t} />;
      })}
      <LightVeil
        id={`${id}veil`}
        lights={[
          [P(0.43, 0.38, 0).x, P(0.43, 0.38, 0).y, 420],
          [P(0.65, 0.38, 0).x, P(0.65, 0.38, 0).y, 420],
        ]}
        o={0.26 * warm}
      />
      <Dust t={t} seed={31} x0={-200} y0={-100} w={2400} h={1100} n={26} o={0.18} />
      {veil > 0 ? <rect x={-1500} y={-1500} width={5000} height={4000} fill="#120E18" opacity={veil} /> : null}
    </g>
  );
};
