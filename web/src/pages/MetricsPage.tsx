import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api, MetricsData, MetricEntry, HabitsData, HabitCalendarData, InsightsData } from '@/lib/api';
import { cn, areaLabel } from '@/lib/utils';
import Icon from '@/components/Icon';
import MetricCalendar from '@/components/MetricCalendar';

/* ── CSS variable color references ───────────────────────── */
const MINT = 'rgb(var(--color-accent-primary))';
const VIOLET = 'rgb(var(--color-accent-secondary))';
const CORAL = 'rgb(var(--color-accent-tertiary))';

/* ── animation helpers ───────────────────────────────────── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

/* ── tab types ───────────────────────────────────────────── */
type Tab = 'actividades' | 'bienestar' | 'habitos';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'actividades', label: 'Actividades', icon: 'exercise' },
  { key: 'bienestar', label: 'Bienestar', icon: 'heart' },
  { key: 'habitos', label: 'Habitos', icon: 'check' },
];

/* ── skeleton ────────────────────────────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-white/[0.04]', className)} />
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

/* ── summary stat pill ───────────────────────────────────── */
function StatPill({
  icon,
  label,
  value,
  accentColor,
}: {
  icon: string;
  label: string;
  value: string;
  accentColor: string;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-white/[0.06] bg-bg-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: accentColor }}>
          <Icon name={icon} size={14} />
        </span>
        <span className="text-[10px] text-text-muted uppercase tracking-wider truncate">{label}</span>
      </div>
      <p className="text-lg font-bold text-text-primary tracking-tight">{value}</p>
    </div>
  );
}

/* ── helper: extract metric data map from entries ────────── */
function extractMetricMap(entries: MetricEntry[], key: keyof MetricEntry): Record<string, number> {
  const map: Record<string, number> = {};
  entries.forEach((e) => {
    const val = e[key];
    if (val != null && typeof val === 'number') {
      map[e.date] = val;
    } else if (typeof val === 'boolean' && val) {
      map[e.date] = 1;
    }
  });
  return map;
}

function computeAvg(data: Record<string, number>): number {
  const vals = Object.values(data);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/* ═══════════════════════════════════════════════════════════
   MetricsPage
   ═══════════════════════════════════════════════════════════ */
export default function MetricsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('actividades');

  // Fetch full month of data for heatmaps
  const { data: metricsMonth, loading: loadingMetrics } = useApi<MetricsData>(
    () => api.getMetrics('month'),
    [],
  );
  const { data: metricsYear } = useApi<MetricsData>(
    () => api.getMetrics('year'),
    [],
  );
  const { data: habitsData, loading: loadingHabits } = useApi<HabitsData>(
    () => api.getHabits(),
    [],
  );
  const { data: insightsData } = useApi<InsightsData>(() => api.getInsights(), []);

  // Use year data for heatmaps (more data = better heatmap), fallback to month
  const entries = metricsYear?.entries ?? metricsMonth?.entries ?? [];

  /* ── derived metric maps ──────────────────────────────── */
  const moodMap = useMemo(() => extractMetricMap(entries, 'mood'), [entries]);
  const energyMap = useMemo(() => extractMetricMap(entries, 'energyLevel'), [entries]);
  const sleepMap = useMemo(() => extractMetricMap(entries, 'sleepQuality'), [entries]);
  const exerciseMap = useMemo(() => {
    // Combine exerciseDone (boolean) and exerciseDuration (numeric)
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.exerciseDuration != null && e.exerciseDuration > 0) {
        map[e.date] = e.exerciseDuration;
      } else if (e.exerciseDone) {
        map[e.date] = 1;
      }
    });
    return map;
  }, [entries]);
  const focusMap = useMemo(() => extractMetricMap(entries, 'focusHours'), [entries]);
  const dietMap = useMemo(() => extractMetricMap(entries, 'dietQuality'), [entries]);
  const dayRatingMap = useMemo(() => extractMetricMap(entries, 'dayRating'), [entries]);

  /* ── summary stats (this month) ───────────────────────── */
  const monthEntries = metricsMonth?.entries ?? [];
  const summaryStats = useMemo(() => {
    const moodAvg = computeAvg(extractMetricMap(monthEntries, 'mood'));
    const gymDays = monthEntries.filter(
      (e) => e.exerciseDone || (e.exerciseDuration != null && e.exerciseDuration > 0),
    ).length;
    const focusTotal = monthEntries.reduce((s, e) => s + (e.focusHours ?? 0), 0);
    const energyAvg = computeAvg(extractMetricMap(monthEntries, 'energyLevel'));
    return { moodAvg, gymDays, focusTotal, energyAvg };
  }, [monthEntries]);

  /* ── habit calendar data (load per-habit) ─────────────── */
  const habits = habitsData?.habits ?? [];

  const loading = loadingMetrics || loadingHabits;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="min-h-screen px-4 py-8 max-w-3xl mx-auto space-y-5"
    >
      {/* ── Header ──────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          Metricas
        </h1>
        <p className="text-sm text-text-muted mt-1">Calendario de actividad mensual</p>
      </motion.div>

      {/* ── Summary Row ─────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        <StatPill icon="mood" label="Mood" value={summaryStats.moodAvg > 0 ? summaryStats.moodAvg.toFixed(1) : '--'} accentColor={MINT} />
        <StatPill icon="exercise" label="Gym" value={`${summaryStats.gymDays}d`} accentColor={VIOLET} />
        <StatPill icon="focus" label="Foco" value={summaryStats.focusTotal > 0 ? `${summaryStats.focusTotal.toFixed(0)}h` : '--'} accentColor={CORAL} />
        <StatPill icon="energy" label="Energia" value={summaryStats.energyAvg > 0 ? summaryStats.energyAvg.toFixed(1) : '--'} accentColor={MINT} />
      </motion.div>

      {/* ── Tab Selector ────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200',
              activeTab === tab.key
                ? 'bg-accent-mint/15 text-accent-mint shadow-[0_0_12px_rgba(74,222,128,0.1)]'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]',
            )}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* ── Content ─────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* ── Actividades Tab ─────────────────────────── */}
            {activeTab === 'actividades' && (
              <>
                <MetricCalendar
                  label="Gym / Ejercicio"
                  icon="exercise"
                  data={exerciseMap}
                  type={Object.values(exerciseMap).some((v) => v > 1) ? 'duration' : 'boolean'}
                  maxValue={120}
                  accentColor={MINT}
                  accentClass="accent-mint"
                  unit="min"
                  defaultExpanded
                />
                <MetricCalendar
                  label="Horas de Foco"
                  icon="focus"
                  data={focusMap}
                  type="numeric"
                  maxValue={10}
                  accentColor={VIOLET}
                  accentClass="accent-violet"
                  unit="h"
                />
                <MetricCalendar
                  label="Dieta"
                  icon="diet"
                  data={dietMap}
                  type="numeric"
                  maxValue={10}
                  accentColor={CORAL}
                  accentClass="accent-coral"
                  unit="/10"
                />
                {Object.keys(dayRatingMap).length > 0 && (
                  <MetricCalendar
                    label="Rating del Dia"
                    icon="star"
                    data={dayRatingMap}
                    type="numeric"
                    maxValue={10}
                    accentColor={MINT}
                    accentClass="accent-mint"
                    unit="/10"
                  />
                )}
              </>
            )}

            {/* ── Bienestar Tab ──────────────────────────── */}
            {activeTab === 'bienestar' && (
              <>
                <MetricCalendar
                  label="Mood"
                  icon="mood"
                  data={moodMap}
                  type="numeric"
                  maxValue={10}
                  accentColor={MINT}
                  accentClass="accent-mint"
                  unit="/10"
                  defaultExpanded
                />
                <MetricCalendar
                  label="Energia"
                  icon="energy"
                  data={energyMap}
                  type="numeric"
                  maxValue={10}
                  accentColor={VIOLET}
                  accentClass="accent-violet"
                  unit="/10"
                />
                <MetricCalendar
                  label="Calidad de Sueno"
                  icon="sleep"
                  data={sleepMap}
                  type="numeric"
                  maxValue={10}
                  accentColor={CORAL}
                  accentClass="accent-coral"
                  unit="/10"
                />

                {/* Correlations */}
                {insightsData?.correlations?.length ? (
                  <motion.div variants={fadeUp} className="rounded-2xl border border-white/[0.06] bg-bg-card p-4 space-y-3">
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                      <Icon name="sparkle" size={14} className="text-accent-mint" />
                      Correlaciones
                    </h3>
                    <div className="space-y-2">
                      {insightsData.correlations.map((c, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                          <span className="text-xs font-medium text-text-primary">
                            {areaLabel(c.areaA)} — {areaLabel(c.areaB)}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                              c.correlation != null && c.correlation >= 0
                                ? 'text-accent-mint bg-accent-mint/10'
                                : 'text-accent-coral bg-accent-coral/10',
                            )}
                          >
                            {c.correlation != null && c.correlation >= 0 ? 'Positiva' : 'Negativa'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.06] bg-bg-card p-6 text-center">
                    <Icon name="sparkle" size={24} className="text-text-muted/30 mx-auto mb-2" />
                    <p className="text-xs text-text-muted">
                      14+ dias de datos para ver correlaciones
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── Habitos Tab ─────────────────────────────── */}
            {activeTab === 'habitos' && (
              <>
                {habits.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-bg-card p-8 text-center space-y-2">
                    <Icon name="clipboard" size={28} className="text-text-muted/30 mx-auto" />
                    <p className="text-sm text-text-muted">No tenes habitos creados</p>
                    <p className="text-xs text-text-muted/60">Usa el chat para crear habitos</p>
                  </div>
                ) : (
                  habits.map((habit) => (
                    <HabitMetricCard key={habit.id} habit={habit} />
                  ))
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

/* ── Habit card with calendar fetching ───────────────────── */
function HabitMetricCard({ habit }: { habit: { id: number; name: string; emoji: string | null; category: string | null } }) {
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const { data } = useApi<HabitCalendarData>(
    () => api.getHabitCalendar(habit.id, currentMonth),
    [habit.id, currentMonth],
  );

  const habitMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (data?.dates) {
      data.dates.forEach((d) => {
        map[d] = 1;
      });
    }
    return map;
  }, [data]);

  const iconName = habit.category
    ? { salud: 'exercise', personal: 'brain', educacion: 'book', negocio: 'briefcase' }[habit.category] ?? 'clipboard'
    : 'clipboard';

  return (
    <MetricCalendar
      label={habit.name}
      icon={iconName}
      data={habitMap}
      type="boolean"
      accentColor={MINT}
      accentClass="accent-mint"
    />
  );
}
