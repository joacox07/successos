import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { cn, formatDate } from '../../lib/utils';
import Icon from '../Icon';
import type { StudyStatsData } from '../../lib/api';

function readAccentRgb(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-accent-primary').trim();
  if (raw) return `rgb(${raw.replace(/ /g, ', ')})`;
  return 'rgb(0, 200, 83)';
}

function useAccentColor(): string {
  const [color, setColor] = useState(readAccentRgb);
  useEffect(() => {
    // Re-read after mount in case theme applied late
    setColor(readAccentRgb());
    const observer = new MutationObserver(() => setColor(readAccentRgb()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    return () => observer.disconnect();
  }, []);
  return color;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] p-5 space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 rounded bg-white/[0.06]" />
            <div className="h-6 w-12 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="h-24 rounded bg-white/[0.06]" />
    </div>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface TooltipPayload {
  date: string;
  minutes: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TooltipPayload }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl bg-bg-card/90 backdrop-blur-md border border-white/[0.08] px-3 py-2 shadow-xl">
      <p className="text-xs text-text-muted">{formatDate(d.date)}</p>
      <p className="text-sm font-mono font-semibold text-accent-mint">{d.minutes} min</p>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StudyStats() {
  const { data, loading } = useApi<StudyStatsData>(() => api.getStudyStats());
  const accentColor = useAccentColor();

  if (loading) return <StatSkeleton />;
  if (!data) return null;

  const hours = (data.totalFocusMinutes / 60).toFixed(1);
  const chartData = (data.dailyMinutes ?? []).slice(-7);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-l-4 border-l-accent-mint/30 bg-white/[0.01] backdrop-blur-[25px] p-6 space-y-8"
    >
      {/* Title */}
      <h3 className="text-[9px] font-display font-bold tracking-[0.3em] uppercase text-text-primary border-b border-white/5 pb-3">
        STUDY_METRICS_LOG
      </h3>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-px bg-white/[0.05] border border-white/[0.05]">
        <div className="p-5 bg-bg-card">
          <p className="font-mono text-[8px] text-text-muted mb-3 uppercase tracking-[0.2em] opacity-40 italic">FOCUS_TOTAL</p>
          <p className="text-3xl font-display font-bold text-white tracking-tighter uppercase">{hours}<span className="text-[10px] ml-1 text-accent-mint opacity-60">HRS</span></p>
        </div>
        <div className="p-5 bg-bg-card">
          <p className="font-mono text-[8px] text-text-muted mb-3 uppercase tracking-[0.2em] opacity-40 italic">SESSIONS</p>
          <p className="text-3xl font-display font-bold text-white tracking-tighter uppercase">{data.sessionsCount}</p>
        </div>
        <div className="p-5 bg-bg-card">
          <p className="font-mono text-[8px] text-text-muted mb-3 uppercase tracking-[0.2em] opacity-40 italic">AVG_QUAL</p>
          <p className="text-3xl font-display font-bold text-white tracking-tighter uppercase">{data.avgQuality?.toFixed(1) || '--'}</p>
        </div>
        <div className="p-5 bg-bg-card">
          <p className="font-mono text-[8px] text-text-muted mb-3 uppercase tracking-[0.2em] opacity-40 italic">STREAK</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-display font-bold text-accent-mint tracking-tighter uppercase">{data.streak}</p>
            <div className="w-1 h-1 rounded-full bg-accent-mint animate-pulse" />
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="h-28 mt-4">
          <p className="text-[8px] font-mono text-text-muted uppercase tracking-[0.2em] mb-4">DATA_FEED (LAST_7_DAYS)</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="2%">
              <Bar
                dataKey="minutes"
                fill={accentColor}
                radius={0}
                opacity={0.8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
