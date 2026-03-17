import { useState, useMemo, useCallback } from 'react';
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
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
      <Icon name={icon} size={14} className="text-text-muted" />
      <span className="text-xs text-text-secondary font-medium">
        {label}
      </span>
      <span className="font-mono text-xs text-text-primary font-semibold">
        {value}{suffix}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline entry wrapper
// ---------------------------------------------------------------------------
function TimelineEntry({ icon, iconColor, time, children }: {
  icon: string;
  iconColor?: string;
  time?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      {/* Icon circle */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center border border-white/[0.08]',
          iconColor || 'bg-white/[0.04] text-text-muted',
        )}>
          <Icon name={icon} size={16} />
        </div>
        <div className="w-px flex-1 bg-white/[0.06] mt-1" />
      </div>
      {/* Content */}
      <div className="flex-1 pb-5 min-w-0">
        {time && (
          <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
            {time}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Summary Section
// ---------------------------------------------------------------------------
function DaySummarySection({ entry }: { entry: MetricEntry }) {
  const score = entry.overallScore;
  const scoreColor = score != null
    ? score >= 70
      ? 'text-accent-mint'
      : score >= 40
        ? 'text-accent-amber'
        : 'text-accent-coral'
    : 'text-text-muted';

  return (
    <TimelineEntry icon="clipboard" iconColor="bg-accent-mint/15 text-accent-mint">
      <div className="glass-card p-4 mt-1">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-text-primary">Resumen del dia</h4>
          {score != null && (
            <span className={cn('font-mono text-lg font-bold', scoreColor)}>
              {score}<span className="text-xs text-text-muted">/100</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricPill label="Sueno" value={entry.sleepQuality} icon="sleep" suffix="/10" />
          <MetricPill label="Mood" value={entry.mood} icon="mood" suffix="/10" />
          <MetricPill label="Energia" value={entry.energyLevel} icon="energy" suffix="/10" />
          <MetricPill label="Dieta" value={entry.dietQuality} icon="diet" suffix="/10" />
          <MetricPill label="Foco" value={entry.focusHours} icon="focus" suffix="h" />
          {entry.exerciseDone && (
            <MetricPill label="Ejercicio" value={entry.exerciseDuration} icon="exercise" suffix="min" />
          )}
        </div>
      </div>
    </TimelineEntry>
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
    <TimelineEntry icon="message-circle" iconColor="bg-accent-violet/15 text-accent-violet">
      <div className="glass-card p-4 mt-1">
        <h4 className="text-sm font-semibold text-text-primary mb-3">
          Mensajes del dia
          <span className="text-text-muted font-normal ml-2 text-xs">({messages.length})</span>
        </h4>
        <div className="space-y-2">
          {displayMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'px-3 py-2 rounded-xl text-xs leading-relaxed',
                msg.direction === 'in'
                  ? 'bg-white/[0.04] text-text-secondary'
                  : 'bg-accent-mint/[0.08] text-text-primary border border-accent-mint/10',
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-text-muted font-mono">
                  {msg.direction === 'in' ? 'Vos' : 'Coach'} · {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words">
                {msg.content || (msg.contentType === 'audio' ? '[Audio]' : '[Sin contenido]')}
              </p>
            </div>
          ))}
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-accent-violet hover:text-accent-violet/80 transition-colors"
          >
            {expanded ? 'Ver menos' : `Ver todos (${messages.length})`}
          </button>
        )}
      </div>
    </TimelineEntry>
  );
}

// ---------------------------------------------------------------------------
// Habits Section
// ---------------------------------------------------------------------------
function HabitsSection({ habits }: { habits: DayEntriesData['habits'] }) {
  const completed = habits.filter((h) => h.completed);
  const pending = habits.filter((h) => !h.completed);

  return (
    <TimelineEntry icon="check" iconColor="bg-accent-mint/15 text-accent-mint">
      <div className="glass-card p-4 mt-1">
        <h4 className="text-sm font-semibold text-text-primary mb-3">
          Habitos
          <span className="text-text-muted font-normal ml-2 text-xs">
            ({completed.length}/{habits.length})
          </span>
        </h4>
        <div className="space-y-1.5">
          {habits.map((h) => (
            <div key={h.id} className="flex items-center gap-2">
              <div className={cn(
                'w-5 h-5 rounded-md flex items-center justify-center border text-[10px]',
                h.completed
                  ? 'bg-accent-mint/20 border-accent-mint/30 text-accent-mint'
                  : 'bg-white/[0.04] border-white/[0.08] text-text-muted',
              )}>
                {h.completed && <Icon name="check" size={12} />}
              </div>
              <span className={cn(
                'text-sm',
                h.completed ? 'text-text-primary' : 'text-text-muted line-through',
              )}>
                {h.emoji && <span className="mr-1">{h.emoji}</span>}
                {h.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </TimelineEntry>
  );
}

// ---------------------------------------------------------------------------
// Goals Section
// ---------------------------------------------------------------------------
function GoalsSection({ goals }: { goals: GoalSummary[] }) {
  return (
    <TimelineEntry icon="target" iconColor="bg-accent-amber/15 text-accent-amber">
      <div className="glass-card p-4 mt-1">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Objetivos</h4>
        <div className="space-y-3">
          {goals.map((g) => {
            const pct = Math.min(Math.max(g.progress, 0), 100);
            return (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name={categoryIcon(g.category)} size={14} className={categoryColor(g.category)} />
                    <span className="text-xs text-text-primary font-medium truncate">{g.title}</span>
                  </div>
                  <span className={cn('font-mono text-xs font-semibold', categoryColor(g.category))}>
                    {Math.round(pct)}%
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-mint to-accent-violet"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {g.currentValue && g.targetValue && (
                  <p className="text-[10px] text-text-muted mt-1">
                    {g.currentValue} / {g.targetValue}{g.unit ? ` ${g.unit}` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TimelineEntry>
  );
}

// ---------------------------------------------------------------------------
// Study Sessions Section
// ---------------------------------------------------------------------------
function StudySection({ sessions }: { sessions: StudySession[] }) {
  const totalMinutes = sessions.reduce((acc, s) => acc + s.focusMinutes, 0);

  return (
    <TimelineEntry icon="book" iconColor="bg-accent-violet/15 text-accent-violet">
      <div className="glass-card p-4 mt-1">
        <h4 className="text-sm font-semibold text-text-primary mb-3">
          Estudio
          <span className="text-text-muted font-normal ml-2 text-xs">
            ({totalMinutes} min total)
          </span>
        </h4>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04]">
              <div className="min-w-0">
                <p className="text-xs text-text-primary font-medium truncate">
                  {s.subject || s.method}
                </p>
                <p className="text-[10px] text-text-muted">
                  {s.method} · {formatTime(s.startedAt)}
                </p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <span className="font-mono text-sm text-accent-violet font-semibold">
                  {s.focusMinutes}m
                </span>
                {s.quality != null && (
                  <p className="text-[10px] text-text-muted">
                    Calidad: {s.quality}/10
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TimelineEntry>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------
function EmptyState({ date }: { date: Date }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-8 text-center mt-8"
    >
      <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
        <Icon name="inbox" size={28} className="text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">
        Sin registros
      </h3>
      <p className="text-sm text-text-muted leading-relaxed">
        {isToday(date)
          ? 'Todavia no registraste nada hoy. Manda un mensaje al coach o hace tu check-in!'
          : 'No hay datos para este dia.'}
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main DiaryPage
// ---------------------------------------------------------------------------
export default function DiaryPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const dateStr = toISODate(selectedDate);
  const [direction, setDirection] = useState(0); // -1 left, +1 right, for animation
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Try the dedicated endpoint, fall back gracefully
  const { data, loading, error } = useApi<DayEntriesData>(
    () => api.getDayEntries(dateStr).catch(() => {
      // If the endpoint doesn't exist yet, return empty shell
      return {
        date: dateStr,
        entry: null,
        messages: [],
        habits: [],
        goals: [],
        studySessions: [],
      } as DayEntriesData;
    }),
    [dateStr],
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
      data.goals.length > 0 ||
      data.studySessions.length > 0
    );
  }, [data]);

  const canGoNext = toISODate(selectedDate) < toISODate(new Date());

  return (
    <motion.div
      className="px-4 pt-6 pb-28 max-w-lg mx-auto"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Diario</h1>
        <p className="text-xs text-text-muted mt-0.5">
          Tu historial dia por dia
        </p>
      </motion.div>

      {/* ── Date Navigator ─────────────────────────────────── */}
      <motion.div variants={fadeUp} className="glass-card p-3 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrev}
            className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/[0.08] transition-all active:scale-95"
          >
            <Icon name="chevron-left" size={18} />
          </button>

          <button
            onClick={goToToday}
            className="flex flex-col items-center min-w-0 px-4"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={dateStr}
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-semibold text-text-primary capitalize"
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

          <div className="flex items-center gap-1.5">
            {/* Date picker button */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-text-secondary hover:text-accent-mint hover:bg-accent-mint/[0.08] hover:border-accent-mint/20 transition-all active:scale-95"
                title="Buscar fecha"
              >
                <Icon name="search" size={16} />
              </button>
              {showDatePicker && (
                <div className="absolute right-0 top-12 z-50">
                  <input
                    type="date"
                    value={dateStr}
                    max={toISODate(new Date())}
                    onChange={handleDatePick}
                    autoFocus
                    onBlur={() => setTimeout(() => setShowDatePicker(false), 200)}
                    className="px-3 py-2 rounded-xl bg-surface-card border border-white/[0.1] text-text-primary text-sm focus:outline-none focus:border-accent-mint/40"
                  />
                </div>
              )}
            </div>

            {/* Next day button */}
            <button
              onClick={goToNext}
              disabled={!canGoNext}
              className={cn(
                'w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center transition-all active:scale-95',
                canGoNext
                  ? 'text-text-secondary hover:text-text-primary hover:bg-white/[0.08]'
                  : 'text-text-muted/30 cursor-not-allowed',
              )}
            >
              <Icon name="chevron-right" size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Content ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
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
                  <HabitsSection habits={data.habits} />
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
    </motion.div>
  );
}
