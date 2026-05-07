import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { Habit } from '@/lib/api';
import { cn, getIconForHabit } from '@/lib/utils';
import Icon from './Icon';

interface HabitStreakWidgetProps {
  habit: Habit;
  onUnpin?: () => void;
}

function getMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getLast30Days(): string[] {
  const today = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });
}

export function HabitStreakWidget({ habit, onUnpin }: HabitStreakWidgetProps) {
  const today = useMemo(() => new Date(), []);
  const currentMonth = useMemo(() => getMonthString(today), [today]);
  const prevMonthDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 1, 1), [today]);
  const prevMonth = useMemo(() => getMonthString(prevMonthDate), [prevMonthDate]);

  const { data: currentCal, error: currentErr } = useApi(() => api.getHabitCalendar(habit.id, currentMonth));
  const { data: prevCal, error: prevErr } = useApi(() => api.getHabitCalendar(habit.id, prevMonth));

  const { completions, streak } = useMemo(() => {
    const allDates = new Set([
      ...(currentCal?.dates ?? []),
      ...(prevCal?.dates ?? []),
    ]);
    const last30 = getLast30Days();
    return {
      completions: last30.map(d => allDates.has(d)),
      streak: currentCal?.streak ?? 0,
    };
  }, [currentCal, prevCal]);

  if (currentErr && prevErr) {
    return (
      <div className="glass-card p-4 text-center">
        <p className="text-accent-coral text-xs">Error al cargar</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 relative overflow-visible"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={getIconForHabit(habit.name, habit.category ?? null)} size={16} className="text-accent-mint" />
          <span className="text-sm font-medium text-text-primary truncate">{habit.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {streak > 0 && (
            <span className="text-xs font-mono text-accent-mint font-semibold">
              <Icon name="fire" size={11} className="inline-block" /> {streak}d
            </span>
          )}
          {onUnpin && (
            <button
              onClick={onUnpin}
              className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Desfijar"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 30-day dots grid — 6 rows × 5 cols or all in a row */}
      <div className="flex gap-[3px] flex-wrap">
        {completions.map((done, i) => (
          <div
            key={i}
            className={cn(
              'rounded-[2px] transition-colors',
              done
                ? 'bg-accent-mint opacity-80'
                : 'bg-white/[0.08]'
            )}
            style={{ width: 7, height: 7 }}
            title={done ? 'Completado' : 'No completado'}
          />
        ))}
      </div>

      {/* Subtle completion rate label */}
      {currentCal && (
        <p className="text-[9px] font-mono text-text-muted mt-2 tracking-widest">
          {currentCal.daysCompleted}/{currentCal.totalDays} este mes · {Math.round(currentCal.completionRate)}%
        </p>
      )}
    </motion.div>
  );
}
