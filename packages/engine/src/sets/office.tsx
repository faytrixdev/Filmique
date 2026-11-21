import React from 'react';
import { makeRoom, Box, S3 } from '../room';
import { WallTexture, RoomCorners, LightVeil, Dust, Glow } from '../light';

export const OFF = makeRoom({ x: 940, y: 500 }, { x0: 420, x1: 1460, y0: 280, y1: 750 }, 3.4);

const FileStack: React.FC<{ x: number; y: number; s: number; t: number }> = ({ x, y, s, t }) => {
  const lean = Math.sin(t / 30 + x / 120) * 0.02;
  return (
    <g transform={`translate(${x} ${y}) rotate(${(lean * 180) / Math.PI}) scale(${s})`}>
      <rect x={-60} y={-14} width={120} height={14} rx={4} fill="#C8543F" stroke="#1D2033" strokeWidth={4} />
      <rect x={-56} y={-28} width={112} height={14} rx={4} fill="#4A5A8A" stroke="#1D2033" strokeWidth={4} />
      <rect x={-60} y={-42} width={120} height={14} rx={4} fill="#E9C46A" stroke="#1D2033" strokeWidth={4} />
    </g>
  );
};

const DeskUnit: React.FC<{ u0: number; u1: number; w0: number; w1: number; files?: boolean; lamp?: boolean; monitor?: boolean; panel?: [number, number] }> = ({
  u0,
  u1,
  w0,
  w1,
  files = false,
  lamp = false,
  monitor = false,
  panel = [0.58, 0.7],
}) => {
  const r = OFF;
  const leg = (uu: number, ww: number) => {
    const a = r.P(uu, 0.76, ww);
    const b = r.P(uu, 1, ww);
    return <path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} stroke={S3.metal} strokeWidth={7} />;
  };
  const mid = r.P((u0 + u1) / 2, 0.72, (w0 + w1) / 2);
  const k = r.s((w0 + w1) / 2);
  return (
    <g>
      {leg(u0 + 0.03, w0 + 0.01)}
      {leg(u1 - 0.03, w0 + 0.01)}
      {leg(u0 + 0.03, w1 - 0.01)}
      {leg(u1 - 0.03, w1 - 0.01)}
      <Box r={r} u={[u0, u1]} v={[0.7, 0.78]} w={[w0, w1]} front="#6E5142" top="#856450" side="#543D32" rim />
      <Box r={r} u={[u0 + 0.03, u1 - 0.03]} v={panel} w={[w0 + 0.02, w1 - 0.02]} front="#4A3A34" top="#5A463E" side="#3A2C28" />
      {monitor ? (
        <g transform={`translate(${mid.x} ${mid.y - k * 150}) scale(${k * 1.1})`}>
          <rect x={-52} y={-46} width={104} height={64} rx={6} fill="#16151C" stroke="#1D2033" strokeWidth={4} />
          <rect x={-42} y={-36} width={84} height={44} rx={3} fill="#2A3A52" />
          <path d="M -34 -20 L -6 -20 M -34 -8 L 10 -8" stroke="#8FD4FF" strokeWidth={5} strokeLinecap="round" opacity={0.75} />
          <rect x={-18} y={18} width={36} height={12} fill="#16151C" />
        </g>
      ) : null}
      {lamp ? (
        <g transform={`translate(${mid.x + k * 150} ${mid.y - k * 110}) scale(${k})`}>
          <path d="M -22 0 L 22 0 L 12 -46 L -12 -46 Z" fill="#2A2026" />
          <ellipse cx={0} cy={-46} rx={14} ry={5} fill="#FFE2B0" />
          <rect x={-4} y={0} width={8} height={40} fill="#2A2026" />
        </g>
      ) : null}
      {files ? <FileStack x={mid.x - k * 190} y={mid.y - k * 10} s={k * 0.8} t={0} /> : null}
    </g>
  );
};

export const Office: React.FC<{ t: number; id?: string; veil?: number; desk?: boolean; files?: boolean; monitor?: boolean; lamp?: boolean }> = ({
  t,
  id = 'off',
  veil = 0.34,
  desk = true,
  files = true,
  monitor = true,
  lamp = true,
}) => {
  const r = OFF;
  const { P, Q } = r;
  const boards: React.ReactNode[] = [];
  for (let i = 1; i < 12; i++) {
    const a = P(i / 12, 1, 0);
    const b = P(i / 12, 1, 1);
    boards.push(<path key={`tb${i}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} stroke="#2A2230" strokeWidth={2} />);
  }
  const board = P(0.72, 0.34, 0);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6E86A8" />
          <stop offset="70%" stopColor="#D8B48E" />
          <stop offset="100%" stopColor="#F2CBA0" />
        </linearGradient>
      </defs>
      <polygon points={Q([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]])} fill="#241F2C" />
      <polygon points={Q([[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]])} fill="#453F52" />
      <polygon points={Q([[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]])} fill="#362F42" />
      <polygon points={Q([[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]])} fill="#3E3640" />
      {boards}
      <rect x={420} y={280} width={1040} height={470} fill="#5E5568" />
      <WallTexture rect={[420, 280, 1040, 470]} />
      <WallTexture points={Q([[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]])} />
      <WallTexture points={Q([[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]])} />
      <RoomCorners x0={420} x1={1460} y0={280} y1={750} />
      <rect x={420} y={734} width={1040} height={16} fill={S3.trim} />
      <polygon points={Q([[0.36, 0.16, 0], [0.62, 0.16, 0], [0.62, 0.66, 0], [0.36, 0.66, 0]])} fill={`url(#${id}sky)`} />
      <polygon points={Q([[0.36, 0.16, 0], [0.62, 0.16, 0], [0.62, 0.66, 0], [0.36, 0.66, 0]])} fill="none" stroke="#241E2E" strokeWidth={11} />
      <path d={`M ${P(0.49, 0.16, 0).x} ${P(0.49, 0.16, 0).y} L ${P(0.49, 0.66, 0).x} ${P(0.49, 0.66, 0).y}`} stroke="#241E2E" strokeWidth={8} />
      <polygon points={Q([[0.36, 0.66, 0], [0.62, 0.66, 0], [0.7, 1, 0.42], [0.28, 1, 0.42]])} fill="#FFD9A8" opacity={0.11} style={{ mixBlendMode: 'screen' }} />
      <g>
        <rect x={board.x - 210} y={board.y - 120} width={420} height={240} rx={8} fill="#3E5A50" stroke="#241E2E" strokeWidth={10} />
        {([
          [-120, -60, '#F6EFE3'],
          [-30, -40, '#E9C46A'],
          [90, -70, '#F6EFE3'],
          [-60, 30, '#FF8A3D'],
          [60, 40, '#F6EFE3'],
        ] as [number, number, string][]).map(([dx, dy, c], i) => (
          <rect key={i} x={board.x + dx - 40} y={board.y + dy - 26} width={80} height={52} rx={4} fill={c} opacity={0.9} />
        ))}
      </g>
      <Box r={r} u={[0.04, 0.22]} v={[0.34, 0.92]} w={[0.02, 0.28]} front="#5A4A44" top="#6A584F" side="#463833" />
      {desk ? <DeskUnit u0={0.28} u1={0.66} w0={0.24} w1={0.52} files={files} lamp={lamp} monitor={monitor} /> : null}
      <DeskUnit u0={0.36} u1={0.76} w0={0.64} w1={0.9} files={false} lamp={false} monitor={false} />
      <Glow x={P(0.49, 0.4, 0).x} y={P(0.49, 0.4, 0).y} r={430} o={0.24} />
      <LightVeil id={`${id}veil`} lights={[[P(0.49, 0.4, 0).x, P(0.4, 0.9, 0.2).y, 520]]} o={0.3} />
      <Dust t={t} seed={57} x0={-100} y0={-100} w={2200} h={1100} n={22} o={0.16} />
      {veil > 0 ? <rect x={-1500} y={-1500} width={5000} height={4000} fill="#120E18" opacity={veil} /> : null}
    </g>
  );
};
