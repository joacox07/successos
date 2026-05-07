import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type {
  DayEntriesData,
  ChatMessage,
  GoalSummary,
  StudySession,
  MetricEntry,
} from '@/lib/api';
import { cn, formatDateFull, categoryIcon, categoryColor } from '@/lib/utils';
import Icon from '@/components/Icon';
import DailyCheckin from '@/components/DailyCheckin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return toISODate(date) === toISODate(now);
}

function isEditableDay(date: Date): boolean {
  const today = new Date();
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((anchor.getTime() - target.getTime()) / 86400000);
  return diff >= 0 && diff <= 3;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Skeleton
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

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          <Skeleton className="flex-1 h-20" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------
function CollapsibleSection({ title, count, icon, iconColor, children, defaultOpen = false }: {
  title: string;
  count?: string;
  icon: string;
  iconColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex gap-6 relative">
      {/* Vertical Track */}
      <div className="flex flex-col items-center flex-shrink-0 relative">
        {open && <div className="w-px flex-1 bg-border-primary absolute top-10 bottom-0 left-1/2 -translate-x-1/2" />}
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'w-12 h-12 rounded-none border-2 flex items-center justify-center relative z-10 bg-bg-primary transition-all',
            iconColor?.includes('accent-primary') ? 'border-accent-mint' : 'border-border-primary',
            !open && 'opacity-60',
          )}
        >
          <Icon name={icon} size={20} className={iconColor?.includes('accent-primary') ? 'text-accent-mint' : 'text-text-primary'} />
        </button>
      </div>

      {/* Content Container */}
      <div className="flex-1 pb-12 min-w-0">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-4 mb-4 w-full text-left"
        >
          <h4 className="text-[10px] font-mono tracking-[0.3em] uppercase text-text-muted">
            {title}
            {count && <span className="text-accent-mint ml-2">({count})</span>}
          </h4>
          <div className="h-px flex-1 bg-border-primary" />
          <Icon
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            className="text-text-muted flex-shrink-0"
          />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric pill for the day summary
// ---------------------------------------------------------------------------
function MetricPill({ label, value, icon, suffix }: {
  label: string;
  value: number | null;
  icon: string;
  suffix?: string;
}) {
  if (value == null) return null;
  return (
    <div className="flex flex-col p-4 bg-bg-card hover:bg-bg-primary/60 transition-colors">
      <div className="flex items-center gap-2 mb-2 opacity-50">
        <Icon name={icon} size={12} className="text-accent-mint" />
        <span className="text-[9px] font-mono tracking-widest uppercase">{label}</span>
      </div>
      <div className="font-display text-2xl text-text-primary">
        {value}<span className="text-[10px] font-mono text-accent-mint/50 ml-1">{suffix}</span>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Day Summary Section
// ---------------------------------------------------------------------------
function DaySummarySection({ entry }: { entry: MetricEntry }) {
  const score = entry.overallScore;

  return (
    <CollapsibleSection title="Resumen del dia" icon="clipboard" iconColor="text-accent-mint">
      <div className="bg-white/[0.02] backdrop-blur-[20px] border border-white/[0.1] p-6 rounded-none relative overflow-hidden">
        <div className="flex flex-col gap-6">
          {score != null && (
            <div className="text-right">
              <p className="font-display text-5xl sm:text-6xl text-text-primary leading-none">{score}</p>
              <p className="text-[10px] font-mono text-accent-mint tracking-widest mt-1">Rendimiento</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-px bg-white/[0.05] border border-white/[0.05]">
            <MetricPill label="Sueno" value={entry.sleepQuality} icon="sleep" suffix="/10" />
            <MetricPill label="Mood" value={entry.mood} icon="mood" suffix="/10" />
            <MetricPill label="Energia" value={entry.energyLevel} icon="energy" suffix="/10" />
            <MetricPill label="Foco" value={entry.focusHours} icon="focus" suffix="h" />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Messages Section
// ---------------------------------------------------------------------------
function MessagesSection({ messages }: { messages: ChatMessage[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayMessages = expanded ? messages : messages.slice(0, 4);
  const hasMore = messages.length > 4;

  return (
    <CollapsibleSection title="Mensajes" count={String(messages.length)} icon="message-circle" defaultOpen={false}>
      <div className="bg-white/[0.02] backdrop-blur-[20px] border border-white/[0.1] p-6 rounded-none">
        <div className="space-y-4">
          {displayMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'p-4 rounded-none text-xs leading-relaxed border-l-2 relative overflow-hidden',
                msg.direction === 'in'
                  ? 'bg-white/[0.03] border-white/20 text-text-secondary'
                  : 'bg-accent-mint/5 border-accent-mint text-text-primary',
              )}
            >
              <div className="flex items-center justify-between mb-3 opacity-50">
                <span className="text-[9px] font-mono tracking-widest uppercase">
                  {msg.direction === 'in' ? 'Vos' : 'Coach'} - {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words font-mono text-[11px] tracking-tight">
                {msg.content || (msg.contentType === 'audio' ? '[AUDIO_DATA]' : '[EMPTY]')}
              </p>
            </div>
          ))}
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-6 w-full py-2 border border-white/[0.1] text-[10px] font-mono uppercase tracking-[0.3em] hover:bg-white/[0.05] transition-colors"
          >
            {expanded ? 'Ver menos' : `Ver todos (${messages.length})`}
          </button>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Habits Section
// ---------------------------------------------------------------------------
function HabitsSection({
  habits,
  editable = false,
  busyKey = null,
  onToggle,
}: {
  habits: DayEntriesData['habits'];
  editable?: boolean;
  busyKey?: string | null;
  onToggle?: (habitId: number) => void;
}) {
  const completed = habits.filter((h) => h.completed);

  return (
    <CollapsibleSection title="Habitos" count={`${completed.length}/${habits.length}`} icon="check">
      <div className="bg-white/[0.02] backdrop-blur-[20px] border border-white/[0.1] p-6 rounded-none">
        <div className="grid grid-cols-1 gap-2">
          {habits.map((h) => (
            <button
              key={h.id}
              type="button"
              disabled={!editable || !onToggle || busyKey === `habit-${h.id}`}
              onClick={() => onToggle?.(h.id)}
              className={cn(
                'flex items-center gap-4 group text-left transition-opacity',
                editable && onToggle ? 'hover:opacity-90' : 'cursor-default',
                busyKey === `habit-${h.id}` && 'opacity-50',
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-none border flex items-center justify-center transition-all',
                h.completed
                  ? 'bg-accent-mint border-accent-mint text-bg-primary'
                  : 'bg-transparent border-border-primary text-text-muted',
              )}>
                {h.completed && <Icon name="check" size={14} />}
              </div>
              <span className={cn(
                'text-[12px] font-mono tracking-tight transition-opacity flex items-center',
                h.completed ? 'text-text-primary' : 'text-text-muted opacity-40 line-through',
              )}>
                <Icon
                  name={(h as any).category ? categoryIcon((h as any).category) : 'target'}
                  size={12}
                  className="mr-3 opacity-60"
                />
                {h.name.toUpperCase()}
                {h.isNegative ? (
                  <span className="ml-3 text-[9px] uppercase tracking-[0.16em] text-text-muted">
                    {h.status === 'negative' ? 'Recaída' : 'Limpio'}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

function CompetitionHabitsSection({
  habits,
  editable = false,
  busyKey = null,
  onLog,
  onLogDuration,
}: {
  habits: DayEntriesData['competitionHabits'];
  editable?: boolean;
  busyKey?: string | null;
  onLog?: (competitionId: number, habitId: number, status: 'positive' | 'negative' | 'clear') => void;
  onLogDuration?: (competitionId: number, habitId: number, minutes: number) => void;
}) {
  const [minutesDraft, setMinutesDraft] = useState<Record<string, string>>({});
  if (!habits.length) return null;
  return (
    <CollapsibleSection title="Competencias" count={String(habits.length)} icon="trophy" iconColor="text-accent-mint">
      <div className="space-y-3">
        {habits.map((habit) => (
          <div key={`${habit.competitionId}-${habit.habitId}`} className="bg-white/[0.02] backdrop-blur-[20px] border border-white/[0.1] p-4 rounded-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent-mint">{habit.competitionName}</p>
                <p className="mt-1 text-sm font-semibold text-text-primary">{habit.name}</p>
                {habit.description ? <p className="mt-1 text-xs text-text-secondary">{habit.description}</p> : null}
              </div>
              <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                {habit.status === 'positive' ? 'Éxito' : habit.status === 'negative' ? 'Recaída' : 'Sin registro'}
              </span>
            </div>
            {editable && onLog ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onLog(habit.competitionId, habit.habitId, 'positive')}
                  disabled={busyKey === `competition-${habit.competitionId}-${habit.habitId}-positive`}
                  className="rounded-xl bg-accent-mint/15 px-3 py-2 text-xs text-accent-mint disabled:opacity-40"
                >
                  Éxito
                </button>
                {(habit.scoringMode === 'negative_only' || habit.scoringMode === 'both') ? (
                  <button
                    type="button"
                    onClick={() => onLog(habit.competitionId, habit.habitId, 'negative')}
                    disabled={busyKey === `competition-${habit.competitionId}-${habit.habitId}-negative`}
                    className="rounded-xl bg-accent-coral/15 px-3 py-2 text-xs text-accent-coral disabled:opacity-40"
                  >
                    Recaída
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onLog(habit.competitionId, habit.habitId, 'clear')}
                  disabled={busyKey === `competition-${habit.competitionId}-${habit.habitId}-clear`}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary disabled:opacity-40"
                >
                  Limpiar
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Goals Section
// ---------------------------------------------------------------------------
function GoalsSection({ goals }: { goals: GoalSummary[] }) {
  return (
    <CollapsibleSection title="Objetivos" count={String(goals.length)} icon="target" iconColor="text-accent-mint">
      <div className="bg-white/[0.02] backdrop-blur-[20px] border border-white/[0.1] p-6 rounded-none">
        <div className="space-y-6">
          {goals.map((g) => {
            const pct = Math.min(Math.max(g.progress, 0), 100);
            return (
              <div key={g.id}>
                <div className="flex items-end justify-between mb-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[9px] font-mono text-accent-mint tracking-widest">{g.category?.toUpperCase()}</span>
                    <span className="text-[14px] font-display text-text-primary truncate uppercase">{g.title}</span>
                  </div>
                  <span className="font-display text-2xl text-accent-mint">
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-1 w-full bg-white/[0.05] relative overflow-hidden">
                  <div
                    className="h-full bg-accent-mint transition-all duration-1000"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {g.currentValue && g.targetValue && (
                  <p className="text-[10px] font-mono text-text-muted mt-2 tracking-widest text-right">
                    {g.currentValue} / {g.targetValue}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Study Sessions Section
// ---------------------------------------------------------------------------
function StudySection({ sessions }: { sessions: StudySession[] }) {
  const totalMinutes = sessions.reduce((acc, s) => acc + s.focusMinutes, 0);

  return (
    <CollapsibleSection title="Sesiones de estudio" count={String(sessions.length)} icon="book-open">
      <div className="bg-white/[0.02] backdrop-blur-[20px] border border-white/[0.1] p-6 rounded-none">
        <div className="grid grid-cols-2 gap-px bg-white/[0.05] border border-white/[0.05]">
          <div className="p-4 bg-bg-card">
            <span className="text-[9px] font-mono tracking-widest uppercase opacity-50 block mb-2">Tiempo</span>
            <span className="font-display text-4xl text-white">
              {(totalMinutes / 60).toFixed(1)}<span className="text-xs font-mono ml-1 text-text-muted">H</span>
            </span>
          </div>
          <div className="p-4 bg-bg-card">
            <span className="text-[9px] font-mono tracking-widest uppercase opacity-50 block mb-2">Ciclos</span>
            <span className="font-display text-4xl text-white">
              {sessions.length}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {sessions.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between border-l border-white/20 pl-4 py-1">
              <div className="min-w-0 mr-4">
                <p className="text-[12px] font-display text-text-primary uppercase truncate">{s.subject || s.method}</p>
                <p className="text-[9px] font-mono text-text-muted uppercase tracking-widest mt-1">
                  {s.method || 'General'} - {formatTime(s.startedAt)}
                </p>
              </div>
              <span className="font-mono text-[10px] text-accent-mint whitespace-nowrap">
                +{s.focusMinutes} MIN
              </span>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------
function EmptyState({ date }: { date: Date }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-10 text-center mt-4 rounded-xl border border-dashed border-accent-mint/30 bg-accent-mint/5"
    >
      <div className="w-16 h-16 rounded-full bg-accent-mint/10 flex items-center justify-center mx-auto mb-4">
        <Icon name="inbox" size={32} className="text-accent-mint/50" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-2">
        📭 Sin datos para este día
      </h3>
      <p className="text-xs text-text-muted leading-relaxed max-w-xs mx-auto mb-4">
        {isToday(date)
          ? 'Todavía no registraste nada hoy. Hace tu check-in o mandale un mensaje al coach.'
          : 'No hay registros para este día.'}
      </p>
      {isToday(date) && (
        <div className="flex gap-2 justify-center">
          <a href="/dashboard" className="text-[11px] bg-accent-mint/20 text-accent-mint px-3 py-1 rounded hover:bg-accent-mint/30 transition-colors">
            Check-in
          </a>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main DiaryPage
// ---------------------------------------------------------------------------
export default function DiaryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const [y, m, d] = dateParam.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const dateStr = toISODate(selectedDate);
  const [direction, setDirection] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data, loading, error } = useApi<DayEntriesData>(
    () => api.getDayEntries(dateStr),
    [dateStr, refreshToken],
  );

  const handleDatePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      setDirection(0);
      setSelectedDate(new Date(y, m - 1, d));
      setShowDatePicker(false);
    }
  }, []);

  const goToPrev = useCallback(() => {
    setDirection(-1);
    setSelectedDate((d) => addDays(d, -1));
  }, []);

  const goToNext = useCallback(() => {
    const tomorrow = addDays(new Date(), 1);
    if (addDays(selectedDate, 1) <= tomorrow) {
      setDirection(1);
      setSelectedDate((d) => addDays(d, 1));
    }
  }, [selectedDate]);

  const goToToday = useCallback(() => {
    setDirection(1);
    setSelectedDate(new Date());
  }, []);

  // Check if there's any data at all for the day
  const hasData = useMemo(() => {
    if (!data) return false;
    return (
      data.entry != null ||
      data.messages.length > 0 ||
      data.habits.length > 0 ||
      data.competitionHabits.length > 0 ||
      data.goals.length > 0 ||
      data.studySessions.length > 0
    );
  }, [data]);

  const canGoNext = toISODate(selectedDate) < toISODate(new Date());
  const canEdit = data?.canEdit ?? isEditableDay(selectedDate);

  const refetchDay = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const handleToggleHabit = useCallback(async (habitId: number) => {
    setBusyKey(`habit-${habitId}`);
    try {
      await api.toggleHabit(habitId, dateStr);
      refetchDay();
    } finally {
      setBusyKey(null);
    }
  }, [dateStr, refetchDay]);

  const handleCompetitionLog = useCallback(async (
    competitionId: number,
    habitId: number,
    status: 'positive' | 'negative' | 'clear',
  ) => {
    setBusyKey(`competition-${competitionId}-${habitId}-${status}`);
    try {
      await api.logCompetitionHabit(competitionId, habitId, status, dateStr);
      refetchDay();
    } finally {
      setBusyKey(null);
    }
  }, [dateStr, refetchDay]);

  return (
    <motion.div
      className="px-4 pt-6 pb-28 max-w-lg mx-auto"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="mb-4">
        <h1 className="text-2xl font-display font-bold text-text-primary tracking-tight">Diario</h1>
        <p className="text-xs text-text-muted mt-1">Tu registro dia a dia</p>
      </motion.div>

      {/* ── Date Navigator ─────────────────────────────────── */}
      <motion.div variants={fadeUp} className="bg-bg-card backdrop-blur-[20px] border border-border-primary p-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrev}
            className="w-12 h-12 rounded-none border border-border-primary flex items-center justify-center text-text-secondary hover:bg-bg-card-hover transition-all"
          >
            <Icon name="chevron-left" size={20} />
          </button>

          <button
            onClick={goToToday}
            className="flex flex-col items-center min-w-0 px-4"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={dateStr}
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(10px)' }}
                transition={{ duration: 0.2 }}
                className="text-[14px] font-display text-text-primary uppercase tracking-widest text-center"
              >
                {formatDateFull(dateStr)}
              </motion.span>
            </AnimatePresence>
            {!isToday(selectedDate) && (
              <span className="text-[10px] text-accent-mint mt-0.5">
                Ir a hoy
              </span>
            )}
            {isToday(selectedDate) && (
              <span className="text-[10px] text-text-muted mt-0.5">Hoy</span>
            )}
          </button>

          <div className="flex items-center gap-1">
            {/* Calendar shortcut */}
            <button
              onClick={() => navigate('/calendar')}
              className="w-12 h-12 rounded-none border border-border-primary flex items-center justify-center text-text-secondary hover:bg-bg-card-hover transition-all"
              title="Agenda"
            >
              <Icon name="calendar" size={18} />
            </button>
            {/* Date picker button */}
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="w-12 h-12 rounded-none border border-border-primary flex items-center justify-center text-text-secondary hover:bg-bg-card-hover transition-all"
              title="Buscar fecha"
            >
              <Icon name="search" size={18} />
            </button>
            {showDatePicker && (
              <div className="absolute right-0 top-16 z-50">
                <input
                  type="date"
                  value={dateStr}
                  max={toISODate(new Date())}
                  onChange={handleDatePick}
                  autoFocus
                  onBlur={() => setTimeout(() => setShowDatePicker(false), 200)}
                  className="px-4 py-3 bg-bg-primary border-2 border-accent-mint text-text-primary font-mono text-[12px] uppercase focus:outline-none"
                />
              </div>
            )}

            {/* Next day button */}
            <button
              onClick={goToNext}
              disabled={!canGoNext}
              className={cn(
                'w-12 h-12 rounded-none border border-border-primary flex items-center justify-center transition-all',
                canGoNext
                  ? 'text-text-secondary hover:bg-bg-card-hover'
                  : 'text-text-muted opacity-30 cursor-not-allowed',
              )}
            >
              <Icon name="chevron-right" size={20} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Content ─────────────────────────────────────────── */}
      {canEdit && (
        <motion.div variants={fadeUp} className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className="inline-flex items-center gap-2 rounded-none border border-accent-mint/30 bg-accent-mint/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent-mint"
          >
            <Icon name="edit" size={14} />
            Editar este día
          </button>
          <span className="self-center text-[11px] text-text-muted">Podés corregir hoy y los últimos 3 días.</span>
        </motion.div>
      )}

      <AnimatePresence>
        <motion.div
          key={dateStr}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {error ? (
            <div className="glass-card p-6 text-center mt-4">
              <p className="text-accent-coral text-sm font-medium mb-1">Error cargando datos</p>
              <p className="text-text-muted text-xs">{error}</p>
            </div>
          ) : loading ? (
            <TimelineSkeleton />
          ) : !hasData ? (
            <EmptyState date={selectedDate} />
          ) : (
            <div className="space-y-0">
              {/* Day Summary (entry with metrics) */}
              {data?.entry && (
                <motion.div variants={fadeUp}>
                  <DaySummarySection entry={data.entry} />
                </motion.div>
              )}

              {/* Habits */}
              {data?.habits && data.habits.length > 0 && (
                <motion.div variants={fadeUp}>
                  <HabitsSection habits={data.habits} editable={canEdit} busyKey={busyKey} onToggle={handleToggleHabit} />
                </motion.div>
              )}

              {data?.competitionHabits && data.competitionHabits.length > 0 && (
                <motion.div variants={fadeUp}>
                  <CompetitionHabitsSection
                    habits={data.competitionHabits}
                    editable={canEdit}
                    busyKey={busyKey}
                    onLog={handleCompetitionLog}
                  />
                </motion.div>
              )}

              {/* Goals */}
              {data?.goals && data.goals.length > 0 && (
                <motion.div variants={fadeUp}>
                  <GoalsSection goals={data.goals} />
                </motion.div>
              )}

              {/* Study Sessions */}
              {data?.studySessions && data.studySessions.length > 0 && (
                <motion.div variants={fadeUp}>
                  <StudySection sessions={data.studySessions} />
                </motion.div>
              )}

              {/* Messages */}
              {data?.messages && data.messages.length > 0 && (
                <motion.div variants={fadeUp}>
                  <MessagesSection messages={data.messages} />
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-bg-primary"
          >
            <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
              <div className="sticky top-0 z-20 mb-3 flex items-center justify-between border-b border-white/[0.06] bg-bg-primary/95 pb-3 backdrop-blur-xl">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Editar {formatDateFull(dateStr)}</h2>
                  <p className="mt-1 text-xs text-text-muted">Guardá el check-in completo de ese día.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-text-secondary"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <DailyCheckin
                  targetDate={dateStr}
                  initialData={data?.entry ?? null}
                  initialHabits={(data?.habits ?? []).map((habit) => ({
                    id: habit.id,
                    name: habit.name,
                    emoji: habit.emoji,
                    category: habit.category ?? null,
                    isNegative: !!habit.isNegative,
                    targetMinutes: habit.targetMinutes ?? null,
                    minutesLogged: habit.minutesLogged ?? 0,
                    status: habit.status ?? 'clear',
                    completed: !!habit.completed,
                  }))}
                  onComplete={() => {
                    setShowEditor(false);
                    refetchDay();
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
