import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { DashboardData, MetricsData, GoalSummary, MetricEntry } from '@/lib/api';
import { cn, formatDate, formatDateFull, categoryIcon, categoryColor } from '@/lib/utils';
import Icon from '@/components/Icon';
import DailyCheckin from '@/components/DailyCheckin';
import ChatCheckin from '@/components/ChatCheckin';

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------
function useCountUp(target: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, enabled]);

  return value;
}

// ---------------------------------------------------------------------------
// Stagger animation variants
// ---------------------------------------------------------------------------
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Skeleton primitives
// ---------------------------------------------------------------------------
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-white/[0.06]',
        className,
      )}
    />
  );
}

function SkeletonRing() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <Skeleton className="w-48 h-48 rounded-full" />
      <Skeleton className="w-24 h-4 mt-2" />
    </div>
  );
}

function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

function SkeletonChart() {
  return <Skeleton className="h-52 w-full" />;
}

function SkeletonGoals() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Ring
// ---------------------------------------------------------------------------
const RING_RADIUS = 80;
const RING_STROKE = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ScoreRing({ score }: { score: number | null }) {
  const hasScore = score !== null && score !== undefined;
  const displayValue = useCountUp(hasScore ? score : 0, 1400, hasScore);
  const strokeOffset = hasScore
    ? RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * (score ?? 0)) / 100
    : RING_CIRCUMFERENCE;

  // Determine ring color based on score (uses CSS variables for theming)
  const ringColor = hasScore
    ? score! >= 70
      ? 'rgb(var(--color-accent-primary))'
      : score! >= 40
        ? 'rgb(var(--color-accent-warm))'
        : 'rgb(var(--color-accent-tertiary))'
    : 'rgb(var(--color-accent-primary))';

  const glowColor = hasScore
    ? score! >= 70
      ? 'rgb(var(--color-accent-primary) / 0.6)'
      : score! >= 40
        ? 'rgb(var(--color-accent-warm) / 0.6)'
        : 'rgb(var(--color-accent-tertiary) / 0.6)'
    : 'rgb(var(--color-accent-primary) / 0.3)';

  return (
    <div className="relative flex items-center justify-center py-4">
      <svg
        width={2 * (RING_RADIUS + RING_STROKE)}
        height={2 * (RING_RADIUS + RING_STROKE)}
        className="transform -rotate-90"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Background track */}
        <circle
          cx={RING_RADIUS + RING_STROKE}
          cy={RING_RADIUS + RING_STROKE}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={RING_STROKE}
        />
        {/* Animated foreground arc */}
        <motion.circle
          cx={RING_RADIUS + RING_STROKE}
          cy={RING_RADIUS + RING_STROKE}
          r={RING_RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
          animate={{ strokeDashoffset: strokeOffset }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          filter="url(#glow)"
          style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-5xl font-bold text-text-primary text-glow-mint tracking-tight">
          {hasScore ? displayValue : '--'}
        </span>
        <span className="text-xs text-text-muted uppercase tracking-widest mt-1">
          Score del dia
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Metric Card
// ---------------------------------------------------------------------------
const METRIC_ICONS: Record<string, string> = {
  sleep: 'sleep',
  mood: 'mood',
  energy: 'energy',
};

function QuickMetric({
  label,
  value,
  icon,
  suffix,
}: {
  label: string;
  value: number | null;
  icon: string;
  suffix?: string;
}) {
  const hasValue = value !== null && value !== undefined;
  const display = useCountUp(hasValue ? value : 0, 1000, hasValue);

  return (
    <div className="glass-card p-4 flex flex-col items-center gap-1.5 min-w-0">
      <Icon name={icon} size={20} />
      <span className="font-mono text-xl font-semibold text-text-primary">
        {hasValue ? display : '--'}
        {hasValue && suffix && (
          <span className="text-xs text-text-muted ml-0.5">{suffix}</span>
        )}
      </span>
      <span className="text-[11px] text-text-muted uppercase tracking-wider truncate">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly Summary (replaces old bar chart)
// ---------------------------------------------------------------------------
const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getWeekDayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  return WEEK_DAYS[day === 0 ? 6 : day - 1];
}

function scoreColor(score: number | null): string {
  if (score === null) return 'bg-white/[0.04]';
  if (score >= 70) return 'bg-accent-mint';
  if (score >= 40) return 'bg-accent-amber';
  return 'bg-accent-coral';
}

function scoreOpacity(score: number | null): number {
  if (score === null) return 0.3;
  return 0.15 + (score / 100) * 0.85;
}

function WeeklySummary({ entries }: { entries: MetricEntry[] }) {
  // Compute weekly averages
  const withData = entries.filter(e => e.overallScore !== null);
  const avgScore = withData.length > 0
    ? Math.round(withData.reduce((s, e) => s + (e.overallScore ?? 0), 0) / withData.length)
    : null;
  const exerciseDays = entries.filter(e => e.exerciseDone).length;
  const avgMood = (() => {
    const m = entries.filter(e => e.mood !== null);
    return m.length > 0 ? (m.reduce((s, e) => s + (e.mood ?? 0), 0) / m.length).toFixed(1) : null;
  })();
  const totalFocus = entries.reduce((s, e) => s + (e.focusHours ?? 0), 0);

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="text-sm text-text-secondary font-medium">Semana</h3>

      {/* Day grid */}
      <div className="flex gap-1.5 justify-between">
        {entries.map((entry, i) => {
          const isToday = i === entries.length - 1;
          return (
            <div key={entry.date} className="flex flex-col items-center gap-1.5 flex-1">
              <span className={cn(
                'text-[10px] font-medium',
                isToday ? 'text-accent-mint' : 'text-text-muted'
              )}>
                {getWeekDayLabel(entry.date)}
              </span>
              <div
                className={cn(
                  'w-full aspect-square rounded-lg transition-all relative overflow-hidden',
                  entry.overallScore !== null ? scoreColor(entry.overallScore) : 'bg-white/[0.04] border border-dashed border-white/[0.08]',
                  isToday && 'ring-1 ring-accent-mint/40'
                )}
                style={{
                  opacity: entry.overallScore !== null ? scoreOpacity(entry.overallScore) : 1,
                }}
              >
                {entry.overallScore !== null && (
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold text-white" style={{ opacity: 1 }}>
                    {entry.overallScore}
                  </span>
                )}
              </div>
              {/* Activity dots */}
              <div className="flex gap-[3px]">
                {entry.exerciseDone && <div className="w-1.5 h-1.5 rounded-full bg-accent-mint/70" />}
                {entry.mood !== null && <div className="w-1.5 h-1.5 rounded-full bg-accent-violet/70" />}
                {(entry.focusHours ?? 0) > 0 && <div className="w-1.5 h-1.5 rounded-full bg-accent-amber/70" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center">
          <p className="font-mono text-base font-semibold text-text-primary">{avgScore ?? '--'}</p>
          <p className="text-[10px] text-text-muted">Score</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-base font-semibold text-accent-mint">{exerciseDays}/7</p>
          <p className="text-[10px] text-text-muted">Gym</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-base font-semibold text-accent-violet">{avgMood ?? '--'}</p>
          <p className="text-[10px] text-text-muted">Mood</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-base font-semibold text-accent-amber">{totalFocus.toFixed(1)}h</p>
          <p className="text-[10px] text-text-muted">Focus</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal Progress Item (smart metrics: tap to switch count vs frequency)
// ---------------------------------------------------------------------------
function GoalItem({ goal }: { goal: GoalSummary }) {
  const [showAlt, setShowAlt] = useState(false);
  const pct = Math.min(Math.max(goal.progress, 0), 100);

  // Determine if this goal is better shown as frequency (days active) vs absolute count
  // Goals with units like "libros", "books", "cursos" → show days active as alt
  // Goals with numeric targets → show both
  const hasValues = goal.currentValue && goal.targetValue;
  const mainLabel = hasValues
    ? `${goal.currentValue} / ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ''}`
    : `${Math.round(pct)}%`;

  return (
    <div
      className="glass-card p-4 active:scale-[0.98] transition-transform"
      onClick={() => setShowAlt(!showAlt)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            `bg-white/[0.06]`
          )}>
            <Icon name={categoryIcon(goal.category)} size={16} className={categoryColor(goal.category)} />
          </div>
          <span className="text-sm text-text-primary font-medium truncate">
            {goal.title}
          </span>
        </div>
        <span className={cn('font-mono text-sm font-semibold flex-shrink-0', categoryColor(goal.category))}>
          {Math.round(pct)}%
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, rgb(var(--color-accent-primary)), rgb(var(--color-accent-secondary)))`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
      {hasValues && (
        <p className="text-[11px] text-text-muted mt-1.5">
          {mainLabel}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Insight Card
// ---------------------------------------------------------------------------
function DayInsight() {
  return (
    <div className="glass-card shimmer-border p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="sparkle" size={16} />
        <h3 className="text-sm text-text-secondary font-medium">
          Insight del dia
        </h3>
      </div>
      <p className="text-sm text-text-muted leading-relaxed">
        Registra tu dia para ver insights personalizados
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { data, loading, refetch } = useApi<DashboardData>(() => api.getDashboard());
  const { data: metricsData } = useApi<MetricsData>(() => api.getMetrics('week'));
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkinMode, setCheckinMode] = useState<'chat' | 'wizard'>('chat');

  const entry = data?.entry as Record<string, number | null> | null;
  const hasEntryToday = entry && Object.values(entry).some((v) => v !== null);

  return (
    <motion.div
      className="px-4 pt-6 pb-28 max-w-lg mx-auto space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ---- Header ---- */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-text-primary">Hoy</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {data?.date ? formatDateFull(data.date) : '\u00A0'}
        </p>
      </motion.div>

      {/* ---- Score Ring ---- */}
      <motion.div variants={item}>
        {loading ? <SkeletonRing /> : <ScoreRing score={data?.score ?? null} />}
      </motion.div>

      {/* ---- Check-in CTA ---- */}
      {!loading && !hasEntryToday && (
        <motion.div variants={item}>
          <button
            onClick={() => setShowCheckin(true)}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-accent-mint/20 to-accent-violet/20 border border-accent-mint/30 text-text-primary font-semibold text-sm font-[Sora] hover:from-accent-mint/30 hover:to-accent-violet/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Icon name="clipboard" size={18} />
            Registrar mi dia
          </button>
        </motion.div>
      )}
      {!loading && hasEntryToday && (
        <motion.div variants={item}>
          <button
            onClick={() => setShowCheckin(true)}
            className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-text-muted text-xs font-medium hover:bg-white/[0.08] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Icon name="check" size={14} />
            Editar check-in de hoy
          </button>
        </motion.div>
      )}

      {/* ---- Quick Metrics ---- */}
      <motion.div variants={item}>
        {loading ? (
          <SkeletonMetrics />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <QuickMetric
              label="Sueno"
              value={entry?.sleepQuality ?? null}
              icon={METRIC_ICONS.sleep}
              suffix="/10"
            />
            <QuickMetric
              label="Mood"
              value={entry?.mood ?? null}
              icon={METRIC_ICONS.mood}
              suffix="/10"
            />
            <QuickMetric
              label="Energia"
              value={entry?.energyLevel ?? null}
              icon={METRIC_ICONS.energy}
              suffix="/10"
            />
          </div>
        )}
      </motion.div>

      {/* ---- Weekly Chart ---- */}
      <motion.div variants={item}>
        {!metricsData ? (
          <SkeletonChart />
        ) : (
          <WeeklySummary entries={metricsData.entries} />
        )}
      </motion.div>

      {/* ---- Goals ---- */}
      <motion.div variants={item}>
        <h3 className="text-sm text-text-secondary font-medium mb-3">
          Objetivos activos
        </h3>
        {loading ? (
          <SkeletonGoals />
        ) : data?.goals && data.goals.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.goals.map((g) => (
              <GoalItem key={g.id} goal={g} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-5 text-center">
            <p className="text-sm text-text-muted">
              No hay objetivos activos todavia
            </p>
          </div>
        )}
      </motion.div>

      {/* ---- Day Insight ---- */}
      <motion.div variants={item}>
        <DayInsight />
      </motion.div>

      {/* ---- Check-in Overlay (portal to body) ---- */}
      {showCheckin && createPortal(
        <AnimatePresence>
          <motion.div
            key="checkin-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-bg-primary"
          >
            <div className="h-full px-4 pt-4 pb-4 max-w-lg mx-auto w-full flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-text-primary font-[Sora]">
                    {checkinMode === 'chat' ? 'Coach SuccessOS' : 'Check-in diario'}
                  </h2>
                  <button
                    onClick={() => setCheckinMode(checkinMode === 'chat' ? 'wizard' : 'chat')}
                    className="text-[11px] text-accent-violet hover:text-accent-violet/80 transition-colors mt-0.5"
                  >
                    {checkinMode === 'chat' ? 'Cambiar a modo rapido' : 'Cambiar a chat'}
                  </button>
                </div>
                <button
                  onClick={() => setShowCheckin(false)}
                  className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {checkinMode === 'chat' ? (
                  <ChatCheckin
                    onComplete={() => {
                      setShowCheckin(false);
                      refetch();
                    }}
                  />
                ) : (
                  <DailyCheckin
                    onComplete={() => {
                      setShowCheckin(false);
                      refetch();
                    }}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}
