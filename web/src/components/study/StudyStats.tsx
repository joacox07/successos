import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { cn, formatDate } from '../../lib/utils';
import Icon from '../Icon';
import type { StudyStatsData } from '../../lib/api';

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

  if (loading) return <StatSkeleton />;
  if (!data) return null;

  const hours = (data.totalFocusMinutes / 60).toFixed(1);
  const chartData = (data.dailyMinutes ?? []).slice(-7);

  const stats = [
    { label: 'Horas de foco', value: hours, accent: 'text-accent-mint' },
    { label: 'Sesiones', value: String(data.sessionsCount), accent: 'text-accent-violet' },
    { label: 'Calidad promedio', value: data.avgQuality != null ? `${data.avgQuality.toFixed(1)}/10` : '—', accent: 'text-accent-amber' },
    { label: 'Racha', value: String(data.streak), accent: 'text-accent-coral', icon: 'fire' as const },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-5 space-y-5"
    >
      {/* Title */}
      <h3 className="text-sm font-semibold text-text-secondary tracking-wider uppercase">
        Estadisticas
      </h3>

      {/* 2x2 grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-text-muted mb-1">{s.label}</p>
            <p className={cn('text-lg font-mono font-bold flex items-center gap-1', s.accent)}>
              {s.value}
              {'icon' in s && <Icon name="fire" size={16} />}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar
                dataKey="minutes"
                fill="rgb(var(--color-accent-primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
