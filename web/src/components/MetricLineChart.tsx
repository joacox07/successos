import { useState } from 'react';

interface DataPoint {
  date: string;
  value: number | null;
}

interface MetricLineChartProps {
  data: DataPoint[];
  height?: number;
}

const W = 1000;
const H = 220;
const PAD_Y = 24;

export function MetricLineChart({ data, height = 140 }: MetricLineChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const valid = data.filter(d => d.value !== null);
  if (valid.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-text-muted" style={{ height }}>
        No hay suficientes datos aún
      </div>
    );
  }

  const n = data.length;
  const vals = valid.map(d => d.value as number);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const pts = data.map((d, i) => ({
    x: n === 1 ? W / 2 : (i / (n - 1)) * W,
    y: d.value !== null ? H - PAD_Y - ((d.value - min) / range) * (H - PAD_Y * 2) : null,
    value: d.value,
    date: d.date,
  }));

  const validPts = pts.filter(p => p.y !== null) as { x: number; y: number; value: number; date: string }[];

  const lineD = validPts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaD = validPts.length > 1
    ? `${lineD} L ${validPts[validPts.length - 1].x.toFixed(1)} ${H} L ${validPts[0].x.toFixed(1)} ${H} Z`
    : '';

  const activePt = active !== null ? pts[active] : null;

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id="mlcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-accent-primary))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(var(--color-accent-primary))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="rgba(255,255,255,0.06)" strokeWidth="2" />

        {/* Area */}
        {areaD && <path d={areaD} fill="url(#mlcGrad)" />}

        {/* Line */}
        <path
          d={lineD}
          fill="none"
          stroke="rgb(var(--color-accent-primary))"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {validPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="10" fill="rgb(var(--color-accent-primary))" opacity="0.7" />
        ))}

        {/* Active dot highlight */}
        {activePt?.y !== null && activePt && (
          <circle cx={activePt.x} cy={activePt.y!} r="16" fill="rgb(var(--color-accent-primary))" opacity="0.9" />
        )}

        {/* Touch/hover targets — invisible rects per data point */}
        {pts.map((p, i) => {
          const segW = W / n;
          return (
            <rect
              key={i}
              x={(i / n) * W}
              y={0}
              width={segW}
              height={H}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onTouchStart={() => setActive(i)}
              onTouchEnd={() => setTimeout(() => setActive(null), 800)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {active !== null && pts[active]?.value !== null && (
        <div
          className="absolute pointer-events-none bg-bg-card border border-white/[0.12] rounded-xl px-3 py-1.5 text-xs z-10 whitespace-nowrap shadow-xl"
          style={{
            left: `${(active / (n - 1)) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -110%)',
          }}
        >
          <span className="font-mono font-bold text-accent-mint">
            {pts[active].value?.toFixed(1)}
          </span>
          <span className="text-text-muted ml-1.5">
            {pts[active].date.slice(5).replace('-', '/')}
          </span>
        </div>
      )}
    </div>
  );
}
