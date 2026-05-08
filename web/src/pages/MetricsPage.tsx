import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { api, type Habit, type HabitCalendarData, type HabitsData, type InsightsData, type MetricEntry, type MetricsData } from '@/lib/api';
import { cn, categoryIcon, formatDate } from '@/lib/utils';
import Icon from '@/components/Icon';

type MetricsRange = 'week' | 'month' | 'total';
type MetricKey = 'overallScore' | 'sleepQuality' | 'energyLevel' | 'mood' | 'exerciseDuration' | 'dietQuality' | 'focusHours';
type MetricsView = 'metrics' | 'habits';

interface MetricConfig {
  key: MetricKey;
  label: string;
  helper: string;
  icon: string;
  unit: string;
  color: string;
}

const METRICS: MetricConfig[] = [
  { key: 'overallScore', label: 'Score general', helper: 'Promedio sintÃ©tico de cÃ³mo saliÃ³ el dÃ­a.', icon: 'star', unit: '/100', color: '#2dd4bf' },
  { key: 'sleepQuality', label: 'SueÃ±o', helper: 'Calidad subjetiva del descanso.', icon: 'sleep', unit: '/10', color: '#60a5fa' },
  { key: 'energyLevel', label: 'EnergÃ­a', helper: 'Nivel de energÃ­a percibido.', icon: 'energy', unit: '/10', color: '#f59e0b' },
  { key: 'mood', label: 'Ãnimo', helper: 'CÃ³mo te sentiste en general.', icon: 'mood', unit: '/10', color: '#a78bfa' },
  { key: 'exerciseDuration', label: 'Ejercicio', helper: 'Minutos de ejercicio cargados.', icon: 'dumbbell', unit: 'min', color: '#f97316' },
  { key: 'dietQuality', label: 'Dieta', helper: 'QuÃ© tan bien comiste.', icon: 'diet', unit: '/10', color: '#38bdf8' },
  { key: 'focusHours', label: 'Foco', helper: 'Horas de foco profundo registradas.', icon: 'focus', unit: 'h', color: '#fb7185' },
];

const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

function getDatePartsInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function getCurrentMonthInTimezone(timezone: string) {
  const parts = getDatePartsInTimezone(timezone);
  return parts ? `${parts.year}-${parts.month}` : new Date().toISOString().slice(0, 7);
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-3xl border border-white/[0.08] bg-bg-card p-4 md:p-5', className)}>{children}</div>;
}

function HeaderBlock({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.22em] text-text-muted">{title}</p>
      {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
    </div>
  );
}

function RangeTabs({ value, onChange }: { value: MetricsRange; onChange: (range: MetricsRange) => void }) {
  return (
    <div className="inline-flex rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
      {([
        ['week', 'Semana'],
        ['month', 'Mes'],
        ['total', 'Total'],
      ] as Array<[MetricsRange, string]>).map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
            value === id ? 'bg-accent-mint/15 text-accent-mint' : 'text-text-muted hover:text-text-primary',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ViewTabs({ value, onChange }: { value: MetricsView; onChange: (view: MetricsView) => void }) {
  return (
    <div className="inline-flex rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
      {([
        ['metrics', 'MÃ©tricas'],
        ['habits', 'HÃ¡bitos'],
      ] as Array<[MetricsView, string]>).map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
            value === id ? 'bg-accent-mint/15 text-accent-mint' : 'text-text-muted hover:text-text-primary',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({ label, value, helper, tone = 'default' }: { label: string; value: string; helper: string; tone?: 'default' | 'mint' | 'coral' }) {
  const toneClass = tone === 'mint' ? 'text-accent-mint' : tone === 'coral' ? 'text-accent-coral' : 'text-text-primary';
  return (
    <Card className="bg-white/[0.03]">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted" title={helper}>{label}</p>
        <p className={cn('text-3xl font-bold tracking-tight', toneClass)}>{value}</p>
        <p className="text-xs text-text-secondary">{helper}</p>
      </div>
    </Card>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed border-white/[0.12] bg-white/[0.02]">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-secondary">{body}</p>
    </Card>
  );
}

function metricValue(entry: MetricEntry, key: MetricKey) {
  const value = entry[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function computeSleepDuration(entry: MetricEntry) {
  if (!entry.bedtime || !entry.wakeTime) return null;
  const [bh, bm] = entry.bedtime.split(':').map(Number);
  const [wh, wm] = entry.wakeTime.split(':').map(Number);
  let minutes = wh * 60 + wm - (bh * 60 + bm);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 10) / 10;
}

function computeEntryStreak(entries: MetricEntry[]) {
  const dates = new Set(entries.filter((entry) => entry.overallScore !== null).map((entry) => entry.date));
  if (!dates.size) return 0;
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }) + 'T12:00:00');
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const probe = new Date(today);
    probe.setDate(probe.getDate() - offset);
    const key = probe.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak += 1;
  }
  return streak;
}

function completionRateFromCalendar(data: HabitCalendarData | null) {
  if (!data || !data.totalDays) return 0;
  return Math.round(data.completionRate * 100);
}

function buildHabitProgressSeries(data: HabitCalendarData | null) {
  if (!data) return [];
  const completed = new Set(data.dates);
  return Array.from({ length: data.totalDays }).map((_, index) => {
    const day = index + 1;
    const date = data.dates[0]?.slice(0, 8)
      ? `${data.dates[0].slice(0, 8)}${String(day).padStart(2, '0')}`
      : `${getCurrentMonthInTimezone(AR_TIMEZONE)}-${String(day).padStart(2, '0')}`;
    return {
      date,
      completado: completed.has(date) ? 1 : 0,
      acumulado: Array.from({ length: day }).reduce<number>((sum, __, innerIndex) => {
        const innerDate = date.slice(0, 8) + String(innerIndex + 1).padStart(2, '0');
        return sum + (completed.has(innerDate) ? 1 : 0);
      }, 0),
    };
  });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const title = typeof label === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(label) ? formatDate(label) : label;
  return (
    <div className="rounded-2xl border border-white/[0.1] bg-bg-card px-3 py-2 shadow-xl">
      <p className="text-xs font-semibold text-text-primary">{title || 'Dato'}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="font-mono text-text-primary">{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<MetricsRange>('month');
  const [view, setView] = useState<MetricsView>('metrics');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [selectedHabitCalendar, setSelectedHabitCalendar] = useState<HabitCalendarData | null>(null);
  const [habitCalendars, setHabitCalendars] = useState<Record<number, HabitCalendarData | null>>({});

  const metricsQuery = useApi<MetricsData>(() => api.getMetrics(range), [range]);
  const habitsQuery = useApi<HabitsData>(() => api.getHabits(), []);
  const insightsQuery = useApi<InsightsData>(() => api.getInsights(), []);

  const entries = metricsQuery.data?.entries ?? [];
  const habits = habitsQuery.data?.habits ?? [];
  const topInsight = useMemo(() => {
    const readable = (insightsQuery.data?.correlations ?? [])
      .filter((item) => item.description && !item.description.includes('r='))
      .sort((a, b) => Math.abs(b.correlation ?? 0) - Math.abs(a.correlation ?? 0));
    return readable[0]?.description ?? null;
  }, [insightsQuery.data]);

  useEffect(() => {
    let cancelled = false;
    const month = getCurrentMonthInTimezone(AR_TIMEZONE);
    async function loadHabitCalendars() {
      if (!habits.length) {
        setHabitCalendars({});
        return;
      }
      const results = await Promise.all(
        habits.slice(0, 8).map(async (habit) => {
          try {
            const calendar = await api.getHabitCalendar(habit.id, month);
            return [habit.id, calendar] as const;
          } catch {
            return [habit.id, null] as const;
          }
        }),
      );
      if (!cancelled) {
        setHabitCalendars(Object.fromEntries(results));
      }
    }
    loadHabitCalendars();
    return () => {
      cancelled = true;
    };
  }, [habits]);

  useEffect(() => {
    if (!selectedHabit) {
      setSelectedHabitCalendar(null);
      return;
    }
    const month = getCurrentMonthInTimezone(AR_TIMEZONE);
    api.getHabitCalendar(selectedHabit.id, month)
      .then(setSelectedHabitCalendar)
      .catch(() => setSelectedHabitCalendar(null));
  }, [selectedHabit]);

  const daysRecorded = entries.filter((entry) => entry.overallScore !== null).length;
  const streak = useMemo(() => computeEntryStreak(entries), [entries]);
  const bestDay = useMemo(() => {
    return [...entries]
      .filter((entry) => entry.overallScore !== null)
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))[0] ?? null;
  }, [entries]);
  const avgScore = average(entries.map((entry) => entry.overallScore));
  const avgFocus = average(entries.map((entry) => entry.focusHours));
  const avgMood = average(entries.map((entry) => entry.mood));
  const avgSleep = average(entries.map(computeSleepDuration));
  const avgEnergy = average(entries.map((entry) => entry.energyLevel));

  const trendSeries = useMemo(() => {
    return entries.map((entry) => ({
      date: entry.date,
      'Score general': entry.overallScore,
      'Ãnimo': entry.mood,
      'EnergÃ­a': entry.energyLevel,
      'Foco': entry.focusHours,
    }));
  }, [entries]);

  const distributionSeries = useMemo(() => {
    return METRICS.map((metric) => ({
      metric: metric.label,
      value: average(entries.map((entry) => metricValue(entry, metric.key))) ?? 0,
      fullMark: metric.key === 'overallScore' ? 100 : metric.key === 'exerciseDuration' ? 120 : 10,
    }));
  }, [entries]);

  const barSeries = useMemo(() => {
    return METRICS.map((metric) => ({
      name: metric.label,
      promedio: Number((average(entries.map((entry) => metricValue(entry, metric.key))) ?? 0).toFixed(1)),
      color: metric.color,
    }));
  }, [entries]);

  const habitSeries = useMemo(() => {
    return habits.slice(0, 8).map((habit) => ({
      id: habit.id,
      name: habit.name,
      completion: completionRateFromCalendar(habitCalendars[habit.id] ?? null),
      streak: habitCalendars[habit.id]?.streak ?? 0,
      doneToday: habitsQuery.data?.today?.[habit.id] ? 1 : 0,
      isNegative: !!habit.isNegative,
    }));
  }, [habitCalendars, habits, habitsQuery.data]);

  const selectedHabitProgress = useMemo(() => buildHabitProgressSeries(selectedHabitCalendar), [selectedHabitCalendar]);

  const metricCards = METRICS.map((metric) => {
    const latest = [...entries].reverse().find((entry) => metricValue(entry, metric.key) !== null);
    const currentValue = latest ? metricValue(latest, metric.key) : null;
    const avgValue = average(entries.map((entry) => metricValue(entry, metric.key)));
    return {
      ...metric,
      currentValue,
      avgValue,
    };
  });

  return (
    <div className="px-4 pb-28 pt-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">MÃ©tricas</h1>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              MirÃ¡ tendencia, distribuciÃ³n y consistencia con mÃ¡s contexto visual. Cada nÃºmero intenta decirte quÃ© pasÃ³, no solo cuÃ¡nto dio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RangeTabs value={range} onChange={setRange} />
            <ViewTabs value={view} onChange={setView} />
          </div>
        </div>

        {entries.length === 0 && !metricsQuery.loading ? (
          <EmptyState title="TodavÃ­a no hay datos suficientes" body="Cuando registres algunos dÃ­as, esta pantalla va a mostrar evoluciÃ³n, mÃ©tricas y consistencia." />
        ) : null}

        <div className="grid gap-3 md:grid-cols-5">
          <KpiCard label="DÃ­as registrados" value={`${daysRecorded}`} helper="Cantidad de dÃ­as con informaciÃ³n Ãºtil en el perÃ­odo." />
          <KpiCard label="Score promedio" value={avgScore !== null ? avgScore.toFixed(1) : 'â€”'} helper="Promedio del score general en el perÃ­odo." tone="mint" />
          <KpiCard label="Foco promedio" value={avgFocus !== null ? `${avgFocus.toFixed(1)}h` : 'â€”'} helper="Horas promedio de foco profundo." />
          <KpiCard label="SueÃ±o promedio" value={avgSleep !== null ? `${avgSleep.toFixed(1)}h` : 'â€”'} helper="DuraciÃ³n promedio de sueÃ±o usando hora de dormir y despertar." />
          <KpiCard label="Racha de registros" value={`${streak}`} helper="DÃ­as consecutivos con entrada registrada." tone="mint" />
        </div>

        {view === 'metrics' ? (
          <>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <Card>
            <HeaderBlock title="EvoluciÃ³n general" subtitle="CÃ³mo viene cambiando el perÃ­odo en las mÃ©tricas mÃ¡s importantes." />
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendSeries}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDate} stroke="rgba(255,255,255,0.38)" />
                  <YAxis stroke="rgba(255,255,255,0.38)" />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="Score general" stroke="#2dd4bf" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Ãnimo" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="EnergÃ­a" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Foco" stroke="#fb7185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="space-y-4">
            <HeaderBlock title="Lectura rÃ¡pida" subtitle="QuÃ© significa el estado general sin entrar todavÃ­a al detalle." />
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-text-primary">Mejor dÃ­a del perÃ­odo</p>
                <p className="mt-1 text-2xl font-bold text-accent-mint">
                  {bestDay?.overallScore !== null && bestDay?.overallScore !== undefined ? bestDay.overallScore : 'â€”'}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {bestDay ? `${formatDate(bestDay.date)} Â· Ã¡nimo ${bestDay.mood ?? 'â€”'} Â· energÃ­a ${bestDay.energyLevel ?? 'â€”'}` : 'TodavÃ­a no hay un mejor dÃ­a claro.'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-text-primary">Balance actual</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {avgMood !== null && avgEnergy !== null
                    ? `Tu promedio de Ã¡nimo va en ${avgMood.toFixed(1)}/10 y la energÃ­a en ${avgEnergy.toFixed(1)}/10.`
                    : 'AÃºn no hay suficientes datos para leer balance emocional y energÃ©tico.'}
                </p>
              </div>
              <button
                onClick={() => navigate('/guide')}
                className="w-full rounded-2xl border border-accent-mint/20 bg-accent-mint/[0.05] p-4 text-left transition-colors hover:bg-accent-mint/[0.08]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="sparkle" size={14} className="text-accent-mint" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-mint">GuÃ­a de patrones</span>
                  </div>
                  <Icon name="arrow-right" size={14} className="text-accent-mint" />
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  {topInsight ?? 'AbrÃ­ la guÃ­a para entender correlaciones y patrones de tus semanas.'}
                </p>
              </button>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card>
            <HeaderBlock title="Mapa de promedios" subtitle="Sirve para ver quÃ© Ã¡reas estÃ¡n quedando atrÃ¡s." />
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={distributionSeries}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }} />
                  <Radar dataKey="value" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.28} />
                  <Tooltip content={<ChartTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <HeaderBlock title="Promedio por mÃ©trica" subtitle="ComparaciÃ³n directa entre Ã¡reas, con nombres claros." />
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barSeries}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.38)" />
                  <YAxis stroke="rgba(255,255,255,0.38)" />
                  <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="promedio" radius={[8, 8, 0, 0]}>
                  {barSeries.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="space-y-4">
          <HeaderBlock title="Detalle por mÃ©trica" subtitle="QuÃ© mide cada bloque y cÃ³mo viene ahora mismo." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((metric) => (
              <div key={metric.key} className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05]">
                    <Icon name={metric.icon} size={18} className="text-accent-mint" />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">{metric.label}</span>
                </div>
                <p className="mt-4 text-3xl font-bold text-text-primary">
                  {metric.currentValue !== null && metric.currentValue !== undefined ? `${metric.currentValue.toFixed(1)}${metric.unit}` : 'â€”'}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{metric.helper}</p>
                <p className="mt-3 text-xs text-text-muted">
                  Promedio del perÃ­odo: {metric.avgValue !== null ? `${metric.avgValue.toFixed(1)}${metric.unit}` : 'â€”'}
                </p>
              </div>
            ))}
          </div>
        </Card>
          </>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <HeaderBlock
              title={view === 'habits' ? 'ProgresiÃ³n de hÃ¡bitos' : 'HÃ¡bitos'}
              subtitle={view === 'habits'
                ? 'CambiÃ¡ a esta vista para leer progreso, racha y consistencia de cada hÃ¡bito.'
                : 'Consistencia visible sin mezclar todavÃ­a lo personal con lo social.'}
            />
            {habitSeries.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Sin hÃ¡bitos" body="CreÃ¡ hÃ¡bitos para empezar a ver consistencia y rachas." />
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {view === 'habits' ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={habitSeries}>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.38)" />
                        <YAxis stroke="rgba(255,255,255,0.38)" />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="completion" name="Cumplimiento %" fill="#2dd4bf" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="streak" name="Racha" fill="#ff6b00" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                {habitSeries.map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => setSelectedHabit(habits.find((row) => row.id === habit.id) ?? null)}
                    className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05]">
                        <Icon
                          name={(() => {
                            const sourceHabit = habits.find((row) => row.id === habit.id);
                            return sourceHabit?.category ? categoryIcon(sourceHabit.category) : 'target';
                          })()}
                          size={18}
                          className="text-accent-mint"
                        />
                      </div>
                      <span className={cn('text-xs font-semibold uppercase tracking-[0.16em]', habit.doneToday ? 'text-accent-mint' : 'text-text-muted')}>
                        {habit.doneToday ? 'Hoy hecho' : 'Hoy pendiente'}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold text-text-primary">{habit.name}</p>
                    <p className="mt-2 text-xs text-text-secondary">
                      Cumplimiento del mes: {habit.completion}% Â· Racha: {habit.streak} dÃ­as
                    </p>
                    {habit.isNegative ? <p className="mt-2 text-xs text-accent-coral">HÃ¡bito con lÃ³gica negativa</p> : null}
                  </button>
                ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <HeaderBlock title="HÃ¡bito seleccionado" subtitle="Detalle rÃ¡pido del hÃ¡bito personal que estÃ¡s mirando." />
            {!selectedHabit ? (
              <EmptyState title="ElegÃ­ un hÃ¡bito" body="TocÃ¡ uno de la lista para ver consistencia y contexto." />
            ) : (
              <>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-text-primary">{selectedHabit.name}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {selectedHabit.category || 'Sin categorÃ­a'} Â· {selectedHabit.isNegative ? 'Seguimiento negativo' : 'Seguimiento positivo'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <KpiCard label="Este mes" value={selectedHabitCalendar ? `${selectedHabitCalendar.daysCompleted}/${selectedHabitCalendar.totalDays}` : 'â€”'} helper="DÃ­as completados en el mes." />
                  <KpiCard label="Cumplimiento" value={selectedHabitCalendar ? `${Math.round(selectedHabitCalendar.completionRate * 100)}%` : 'â€”'} helper="Porcentaje de cumplimiento del mes." tone="mint" />
                  <KpiCard label="Racha" value={selectedHabitCalendar ? `${selectedHabitCalendar.streak}` : 'â€”'} helper="Racha actual de ese hÃ¡bito." />
                </div>
                {view === 'habits' ? (
                  <Card className="bg-white/[0.03]">
                    <HeaderBlock title="Progreso del mes" subtitle="PodÃ©s ver tanto avance acumulado como dÃ­as sin completar." />
                    <div className="mt-4 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedHabitProgress}>
                          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={formatDate} stroke="rgba(255,255,255,0.38)" />
                          <YAxis stroke="rgba(255,255,255,0.38)" />
                          <Tooltip content={<ChartTooltip />} />
                          <Line type="monotone" dataKey="acumulado" name="Progreso acumulado" stroke="#2dd4bf" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="completado" name="DÃ­a completado" stroke="#fb7185" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                ) : null}
              </>
            )}
          </Card>
        </div>
      </motion.div>
    </div>
  );
}

