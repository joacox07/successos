import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, type Habit, type HabitCalendarData } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import Icon from './Icon';

interface HabitCalendarProps {
  habit: Habit;
  onBack: () => void;
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${months[parseInt(m, 10) - 1]} ${year}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCalendarDays(month: string): Array<{ day: number; date: string } | null> {
  const [y, m] = month.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  // JS: 0=Sun, we want 0=Mon
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: Array<{ day: number; date: string } | null> = [];

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) cells.push(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date: dateStr });
  }

  return cells;
}

function SkeletonCalendar() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-40 mx-auto rounded bg-white/[0.06]" />
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="w-9 h-9 rounded-lg bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-16 rounded-2xl bg-white/[0.04]" />
    </div>
  );
}

export default function HabitCalendar({ habit, onBack }: HabitCalendarProps) {
  const [month, setMonth] = useState(getCurrentMonth);
  const { data, loading, error, refetch } = useApi<HabitCalendarData>(
    () => api.getHabitCalendar(habit.id, month),
    [habit.id, month],
  );
  const showSkeleton = loading && !data;

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const successSet = useMemo(() => new Set(data?.successDates ?? data?.dates ?? []), [data]);
  const failureSet = useMemo(() => new Set(data?.failureDates ?? []), [data]);
  const cells = useMemo(() => getCalendarDays(month), [month]);

  function isToday(dateStr: string) {
    return dateStr === todayStr;
  }

  function isFuture(dateStr: string) {
    return dateStr > todayStr;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
          aria-label="Volver"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-secondary">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-accent-mint"><Icon name="clipboard" size={20} /></span>
          <h2 className="text-lg font-semibold text-text-primary truncate font-[Sora]">
            {habit.name}
          </h2>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
          aria-label="Mes anterior"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-text-secondary">
            <path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-sm font-medium text-text-primary font-[Sora]">
          {getMonthLabel(month)}
        </span>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
          aria-label="Mes siguiente"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-text-secondary">
            <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Calendar */}
      <AnimatePresence mode="wait">
        <motion.div
          key={month}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {error && !data ? (
            <div className="rounded-2xl border border-accent-coral/20 bg-accent-coral/5 p-5 text-center space-y-3">
              <p className="text-accent-coral text-sm">{error}</p>
              <button onClick={refetch} className="text-xs text-text-muted hover:text-text-primary transition-colors">
                Reintentar
              </button>
            </div>
          ) : showSkeleton ? (
            <SkeletonCalendar />
          ) : (
            <div className="space-y-4">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="h-8 flex items-center justify-center text-[11px] font-medium text-text-muted font-mono"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, i) => {
                  if (!cell) {
                    return <div key={`empty-${i}`} className="aspect-square" />;
                  }

                  const success = successSet.has(cell.date);
                  const failure = failureSet.has(cell.date);
                  const future = isFuture(cell.date);
                  const today = isToday(cell.date);

                  return (
                    <div
                      key={cell.date}
                      className={cn(
                        'aspect-square rounded-md flex items-center justify-center transition-all border',
                        success && 'bg-accent-mint/85 border-accent-mint/60',
                        failure && 'bg-accent-coral/85 border-accent-coral/60',
                        !success && !failure && !future && 'bg-white/[0.02] border-white/[0.1]',
                        future && 'bg-white/[0.01] border-white/[0.02] opacity-25',
                        today && !success && !failure && 'border-accent-mint/40',
                        today && success && 'border-accent-mint',
                        today && failure && 'border-accent-coral'
                      )}
                      style={success ? {
                        boxShadow: 'inset 0 0 8px rgba(var(--color-accent-primary) / 0.3)',
                      } : failure ? {
                        boxShadow: 'inset 0 0 8px rgba(248,113,113,0.28)',
                      } : undefined}
                    >
                      <span className={cn('text-[8px]', success || failure ? 'text-white/90 font-medium' : 'text-white/25')}>{cell.day}</span>
                    </div>
                  );
                })}
              </div>

              {/* Stats */}
              {data && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                      {data.daysCompleted}/{data.totalDays} dias — {data.completionRate}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-accent-coral"><Icon name="fire" size={16} /></span>
                    <span className="text-sm font-medium text-accent-mint font-[Sora]">
                      Racha: {data.streak} dias
                    </span>
                  </div>
                  {habit.isNegative ? (
                    <p className="text-xs text-text-muted">
                      Verde = día limpio. Coral = recaída registrada.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
