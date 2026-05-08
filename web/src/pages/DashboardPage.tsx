import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { DashboardData, MetricsData, GoalSummary, MetricEntry, PatternSummary } from '@/lib/api';
import { cn, formatDate, formatDateFull, categoryIcon, categoryColor } from '@/lib/utils';
import Icon from '@/components/Icon';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { HabitStreakWidget } from '@/components/HabitStreakWidget';
import { DashboardCustomizer } from '@/components/DashboardCustomizer';

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

function ScoreModule({ score }: { score: number | null }) {
  const hasScore = score !== null && score !== undefined;
  const displayValue = useCountUp(hasScore ? score : 0, 1400, hasScore);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border-primary bg-bg-card backdrop-blur-[40px] p-8 min-h-[220px] flex flex-col justify-end group">
      {/* Background massive text */}
      <div className="absolute -top-10 -right-10 text-[120px] sm:text-[180px] font-display text-text-primary/[0.03] select-none pointer-events-none tracking-tighter leading-none group-hover:text-accent-mint/[0.05] transition-colors duration-700">
        {hasScore ? displayValue : '0'}
      </div>

      {/* Real content */}
      <div className="relative z-10 flex items-end justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-text-secondary mb-2 block text-glow-dim">
            Score del dia
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-6xl sm:text-7xl text-text-primary tracking-tighter">
              {hasScore ? displayValue : '--'}
            </span>
            <span className="font-mono text-xl text-accent-mint">/100</span>
          </div>
        </div>

        {/* Abstract pattern */}
        <div className="w-12 h-12 border-2 border-dashed border-accent-mint/[0.3] rounded-full flex items-center justify-center animate-spin-slow">
          <div className="w-1 h-1 bg-accent-mint rounded-full absolute top-1" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Metric Card
// ---------------------------------------------------------------------------
const ALL_METRICS: { key: string; label: string; icon: string; suffix: string; field: keyof MetricEntry }[] = [
  { key: 'sleep', label: 'Sueño', icon: 'sleep', suffix: '/10', field: 'sleepQuality' },
  { key: 'mood', label: 'Mood', icon: 'mood', suffix: '/10', field: 'mood' },
  { key: 'energy', label: 'Energía', icon: 'energy', suffix: '/10', field: 'energyLevel' },
  { key: 'exercise', label: 'Ejercicio', icon: 'exercise', suffix: 'min', field: 'exerciseDuration' },
  { key: 'diet', label: 'Dieta', icon: 'diet', suffix: '/10', field: 'dietQuality' },
  { key: 'focus', label: 'Foco', icon: 'target', suffix: 'h', field: 'focusHours' },
  { key: 'rating', label: 'Día', icon: 'star', suffix: '/10', field: 'dayRating' },
];

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
    <div className="relative overflow-hidden p-4 flex flex-col items-start gap-1.5 min-w-0 bg-bg-card backdrop-blur-xl border border-border-primary hover:border-accent-mint/50 transition-colors group">
      <div className="flex w-full items-center justify-between mb-2 opacity-60">
        <Icon name={icon} size={16} />
        <span className="text-[9px] text-text-muted uppercase tracking-widest font-mono">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1 relative z-10 w-full">
        <span className="font-display text-3xl text-text-primary group-hover:text-accent-mint transition-colors">
          {hasValue ? display : '--'}
        </span>
        {hasValue && suffix && (
          <span className="text-[10px] uppercase font-mono text-text-muted">{suffix}</span>
        )}
      </div>
      {/* decorative corner */}
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/[0.1] group-hover:border-accent-mint transition-colors" />
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

      <div className="flex gap-2 justify-between items-end border-b border-white/[0.08] pb-4">
        {entries.map((entry, i) => {
          const isToday = i === entries.length - 1;
          const score = entry.overallScore ?? 0;
          const height = Math.max((score / 100) * 100, 4); // min height 4px

          return (
            <div key={entry.date} className="flex flex-col items-center flex-1 group">
              <div
                className="w-full bg-bg-card-hover relative overflow-hidden group-hover:bg-text-primary/[0.06] transition-colors"
                style={{ height: '80px' }}
              >
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out",
                    isToday ? "bg-accent-mint" : "bg-white/[0.3]"
                  )}
                  style={{ height: `${entry.overallScore !== null ? height : 0}%` }}
                />
              </div>
              <span className={cn(
                'text-[8px] font-mono mt-2 tracking-widest',
                isToday ? 'text-accent-mint' : 'text-text-muted'
              )}>
                {getWeekDayLabel(entry.date)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Weekly stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
        <div className="text-left">
          <p className="font-display text-xl text-text-primary mb-0.5">{avgScore ?? '--'}</p>
          <p className="font-mono text-[8px] uppercase tracking-widest text-text-muted">Score</p>
        </div>
        <div className="text-left border-l border-white/[0.08] pl-2">
          <p className="font-display text-xl text-text-primary mb-0.5">{exerciseDays}</p>
          <p className="font-mono text-[8px] uppercase tracking-widest text-text-muted">Gym (d)</p>
        </div>
        <div className="text-left border-l border-white/[0.08] pl-2">
          <p className="font-display text-xl text-text-primary mb-0.5">{avgMood ?? '--'}</p>
          <p className="font-mono text-[8px] uppercase tracking-widest text-text-muted">Mood</p>
        </div>
        <div className="text-left border-l border-white/[0.08] pl-2">
          <p className="font-display text-xl text-text-primary mb-0.5">{totalFocus.toFixed(1)}</p>
          <p className="font-mono text-[8px] uppercase tracking-widest text-text-muted">Focus (h)</p>
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
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-bg-card-hover">
            <Icon name={categoryIcon(goal.category)} size={16} style={{ color: 'rgb(var(--color-accent-primary))' }} />
          </div>
          <span className="text-sm text-text-primary font-medium truncate">
            {goal.title}
          </span>
        </div>
        <span className="font-mono text-sm font-semibold flex-shrink-0" style={{ color: 'rgb(var(--color-accent-primary))' }}>
          {Math.round(pct)}%
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full bg-text-primary/[0.08] overflow-hidden rounded-full">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: 'rgb(var(--color-accent-primary))' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
      {hasValues && (
        <p className="text-xs text-text-primary opacity-80 mt-1.5 font-medium">
          {mainLabel}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Insight Card
// ---------------------------------------------------------------------------
// ── Time-aware helpers ──
function getTimeSlot(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h >= 5 && h < 13) return 'morning';
  if (h >= 13 && h < 20) return 'afternoon';
  return 'evening';
}

function getGreeting(): string {
  const slot = getTimeSlot();
  if (slot === 'morning') return 'Buenos días';
  if (slot === 'afternoon') return 'Buenas tardes';
  return 'Buenas noches';
}

// ── Habit completion ring ──
function HabitRing({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = done / total;
  const dash = circ * pct;
  const allDone = done === total;

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" className="text-text-primary/[0.06]" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r}
            fill="none"
            stroke="rgb(var(--color-accent-primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl text-text-primary leading-none">{done}</span>
          <span className="text-[9px] font-mono text-text-muted">/{total}</span>
        </div>
      </div>
      <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest">hábitos</span>
    </div>
  );
}

// ── Day Insight (only renders if patterns exist) ──
function DayInsight({ patterns, onTap }: { patterns: PatternSummary[]; onTap: () => void }) {
  if (patterns.length === 0) return null;
  const p = patterns[0];
  const text = p.description || `Correlación detectada entre ${p.areaA} y ${p.areaB}`;

  return (
    <button
      onClick={onTap}
      className="w-full text-left glass-card p-5 border-l-4 border-l-accent-mint rounded-none bg-accent-mint/[0.02] backdrop-blur-[20px] active:scale-[0.98] transition-transform"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon name="sparkle" size={14} className="text-accent-mint" />
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Insight del día</span>
        </div>
        <Icon name="chevron-right" size={12} className="text-accent-mint/60" />
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">{text}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { data, loading, refetch } = useApi<DashboardData>(() => api.getDashboard());
  const { data: metricsData } = useApi<MetricsData>(() => api.getMetrics('week'));
  const { config, toggleHabitPin } = useDashboardConfig();
  const [showCustomizer, setShowCustomizer] = useState(false);
  const { data: habitsData, refetch: refetchHabits } = useApi(() => api.getHabits());
  const navigate = useNavigate();

  // Sync habit data when HabitsList mutates (create/edit/delete)
  const refetchHabitsRef = useRef(refetchHabits);
  refetchHabitsRef.current = refetchHabits;
  useEffect(() => {
    function onHabitsChanged() { refetchHabitsRef.current(); }
    window.addEventListener('habits-changed', onHabitsChanged);
    return () => window.removeEventListener('habits-changed', onHabitsChanged);
  }, []);

  const refetchDashboardRef = useRef(refetch);
  refetchDashboardRef.current = refetch;
  useEffect(() => {
    function onCheckinCompleted() { refetchDashboardRef.current(); }
    window.addEventListener('checkin-completed', onCheckinCompleted);
    return () => window.removeEventListener('checkin-completed', onCheckinCompleted);
  }, []);

  const entry = data?.entry as Record<string, number | null> | null;
  const hasEntryToday = entry && Object.values(entry).some((v) => v !== null);

  // Habit completion counts
  const allHabits = habitsData?.habits ?? [];
  const today = habitsData?.today ?? {};
  const completedCount = allHabits.filter(h => today[h.id]).length;
  const totalCount = allHabits.length;
  const timeSlot = getTimeSlot();
  const greeting = getGreeting();

  // Apply dashboard config: filter hidden goals, sort by saved order
  const configuredGoals = (() => {
    const base = data?.goals ?? [];
    const visible = base.filter(g => !config.hiddenGoalIds.includes(g.id));
    if (config.goalOrder.length === 0) return visible;
    return [...visible].sort((a, b) => {
      const ia = config.goalOrder.indexOf(a.id);
      const ib = config.goalOrder.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  })();

  const pinnedHabits = (habitsData?.habits ?? []).filter(h => config.pinnedHabitIds.includes(h.id));

  return (
    <motion.div
      className="px-4 pt-6 pb-28 max-w-lg mx-auto space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ── Header dinámico ── */}
      <motion.div variants={item}>
        <p className="text-xs text-text-muted font-mono uppercase tracking-widest mb-1">{greeting}</p>
        <h1 className="text-2xl font-bold text-text-primary">Hoy</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {data?.date ? formatDateFull(data.date) : '\u00A0'}
        </p>
      </motion.div>

      {/* ── Score + Habit ring ── */}
      <motion.div variants={item} className="flex items-stretch gap-4">
        <div className="flex-1">
          {loading ? <SkeletonRing /> : <ScoreModule score={data?.score ?? null} />}
        </div>
        {!loading && totalCount > 0 && (
          <button
            onClick={() => navigate('/goals', { state: { tab: 'habitos' } })}
            className="flex items-center justify-center glass-card px-4 active:scale-[0.97] transition-transform"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <HabitRing done={completedCount} total={totalCount} />
          </button>
        )}
      </motion.div>

      {/* ── CTA ── */}
      
      

      {/* ── Pending habits (morning/afternoon, not all done) ── */}
      {!loading && totalCount > 0 && completedCount < totalCount && timeSlot !== 'evening' && (
        <motion.div variants={item}>
          <div className="glass-card p-4 space-y-3">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
              Pendientes hoy
            </p>
            <div className="space-y-2">
              {allHabits
                .filter(h => !today[h.id])
                .slice(0, 4)
                .map(h => (
                  <div key={h.id} className="flex items-center gap-2.5">
                    <div className="w-1 h-1 rounded-full bg-white/[0.2]" />
                    <span className="text-sm text-text-secondary">{h.name}</span>
                  </div>
                ))}
              {allHabits.filter(h => !today[h.id]).length > 4 && (
                <p className="text-[10px] text-text-muted font-mono pl-3">
                  +{allHabits.filter(h => !today[h.id]).length - 4} más
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Coach insight (solo si hay patterns) ── */}
      {!loading && (data?.patterns ?? []).length > 0 && (
        <motion.div variants={item}>
          <DayInsight patterns={data!.patterns} onTap={() => navigate('/guide')} />
        </motion.div>
      )}

      {/* ── Quick metrics (solo los que tienen valor) ── */}
      {!loading && hasEntryToday && (
        <motion.div variants={item}>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory -mx-4 px-4">
            {ALL_METRICS.map((m) => {
              const raw = entry?.[m.field] ?? null;
              const val = typeof raw === 'number' ? raw : (raw === true ? 1 : null);
              if (val === null) return null;
              return (
                <div key={m.key} className="snap-start shrink-0 w-[130px]">
                  <QuickMetric label={m.label} value={val} icon={m.icon} suffix={m.suffix} />
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Pinned habits ── */}
      {pinnedHabits.length > 0 && (
        <motion.div variants={item} className="space-y-3">
          <h3 className="text-xs font-display font-bold text-text-primary tracking-[0.2em] uppercase opacity-80">
            SEGUIMIENTO
          </h3>
          {pinnedHabits.map(habit => (
            <HabitStreakWidget
              key={habit.id}
              habit={habit}
              onUnpin={() => toggleHabitPin(habit.id)}
            />
          ))}
        </motion.div>
      )}

      {/* ── Goals ── */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-display font-bold text-text-primary tracking-[0.2em] uppercase opacity-80 decoration-accent-mint/40 underline underline-offset-8">
            Objetivos activos
          </h3>
          <button
            onClick={() => setShowCustomizer(true)}
            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-lg"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Personalizar dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        </div>
        {loading ? (
          <SkeletonGoals />
        ) : configuredGoals.length > 0 ? (
          <div className="flex flex-col gap-3">
            {configuredGoals.map((g) => (
              <GoalItem key={g.id} goal={g} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-5 text-center">
            <p className="text-sm text-text-muted">No hay objetivos activos todavia</p>
          </div>
        )}
      </motion.div>

      {/* ---- Dashboard Customizer ---- */}
      <DashboardCustomizer
        goals={data?.goals ?? []}
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
      />
    </motion.div>
  );
}

