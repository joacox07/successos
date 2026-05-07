import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Icon from './Icon';

/* ── types ───────────────────────────────────────────────── */
export type MetricType = 'numeric' | 'boolean' | 'duration';

export interface MetricCalendarProps {
  label: string;
  icon: string;
  data: Record<string, number>;
  type?: MetricType;
  maxValue?: number;
  defaultExpanded?: boolean;
  unit?: string;
  isNegative?: boolean; // true = success when NOT done (e.g. alcohol)
  onDayClick?: (date: string) => void;
}

/* ── calendar utilities ──────────────────────────────────── */
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${year}`;
}

function getCalendarCells(month: string): Array<{ day: number; date: string } | null> {
  const [y, m] = month.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: Array<{ day: number; date: string } | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: `${month}-${String(d).padStart(2, '0')}` });
  }
  return cells;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getIntensityLevel(value: number | undefined, maxVal: number, type: MetricType): number {
  if (value == null || value === 0) return 0;
  if (type === 'boolean') return value > 0 ? 4 : 0;
  const ratio = Math.min(value / maxVal, 1);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/* ── component ───────────────────────────────────────────── */
export default function MetricCalendar({
  label,
  icon,
  data,
  type = 'numeric',
  maxValue,
  defaultExpanded = false,
  unit = '',
  isNegative = false,
  onDayClick,
}: MetricCalendarProps) {
  const [month, setMonth] = useState(getCurrentMonth);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const todayStr = useMemo(() => getTodayStr(), []);
  const cells = useMemo(() => getCalendarCells(month), [month]);

  const monthData = useMemo(() => {
    const filtered: Record<string, number> = {};
    Object.entries(data).forEach(([date, val]) => {
      if (date.startsWith(month)) filtered[date] = val;
    });
    return filtered;
  }, [data, month]);

  const stats = useMemo(() => {
    const values = Object.values(monthData).filter(v => v != null && v !== 0);
    if (values.length === 0) return { avg: 0, count: 0, total: 0, trend: 0 };
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;
    const allDates = Object.keys(data).sort();
    const recent = allDates.slice(-7);
    const prior = allDates.slice(-14, -7);
    const recentAvg = recent.length > 0 ? recent.reduce((s, d) => s + (data[d] ?? 0), 0) / recent.length : 0;
    const priorAvg = prior.length > 0 ? prior.reduce((s, d) => s + (data[d] ?? 0), 0) / prior.length : 0;
    const trend = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;
    return { avg, count: values.length, total, trend };
  }, [monthData, data]);

  const computedMax = maxValue ?? Math.max(...Object.values(data), 1);

  const displayValue = type === 'boolean'
    ? `${stats.count}d`
    : stats.avg > 0 ? `${stats.avg.toFixed(1)}${unit ? ` ${unit}` : ''}` : '--';

  /* ── Mini sparkline: last 14 days ──────────────────────── */
  const sparkline = useMemo(() => {
    const bars = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      bars.push({ date: dateStr, level: getIntensityLevel(data[dateStr], computedMax, type) });
    }
    return bars;
  }, [data, computedMax, type]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* ── Header row (always visible) ──────────────────── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-accent-mint/10 flex items-center justify-center shrink-0">
          <Icon name={icon} size={15} className="text-accent-mint" />
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{label}</p>
        </div>

        {/* Value */}
        <span className="text-sm font-display font-bold text-text-primary tabular-nums">{displayValue}</span>

        {/* Trend */}
        {stats.count > 0 && stats.trend !== 0 && (
          <span className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded',
            stats.trend > 0 ? 'text-accent-mint bg-accent-mint/10' : 'text-status-negative bg-status-negative/10',
          )}>
            {stats.trend > 0 ? '↑' : '↓'}{Math.abs(stats.trend).toFixed(0)}%
          </span>
        )}

        {/* Sparkline (collapsed only) */}
        {!expanded && (
          <div className="flex gap-px items-end h-5 ml-1">
            {sparkline.map((bar, i) => {
              const h = [2, 6, 10, 14, 18];
              const opacityMap = [1, 0.35, 0.55, 0.75, 1];
              return (
                <div
                  key={i}
                  className={cn('w-[3px] rounded-sm', bar.level === 0 ? 'bg-white/[0.06]' : 'bg-accent-mint')}
                  style={{ height: `${h[bar.level]}px`, opacity: opacityMap[bar.level] }}
                />
              );
            })}
          </div>
        )}

        <Icon name="chevron-right" size={12}
          className={cn('text-text-muted shrink-0 transition-transform duration-200', expanded && 'rotate-90')} />
      </button>

      {/* ── Expanded calendar ────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2">
              {/* Month nav */}
              <div className="flex items-center justify-between">
                <button onClick={e => { e.stopPropagation(); setMonth(m => shiftMonth(m, -1)); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/[0.06] transition-colors">
                  <Icon name="chevron-left" size={12} className="text-text-muted" />
                </button>
                <span className="text-xs font-medium text-text-secondary">{getMonthLabel(month)}</span>
                <button onClick={e => { e.stopPropagation(); setMonth(m => shiftMonth(m, 1)); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/[0.06] transition-colors">
                  <Icon name="chevron-right" size={12} className="text-text-muted" />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map(d => (
                  <div key={d} className="h-4 flex items-center justify-center text-[9px] font-medium text-text-muted/50">{d}</div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((cell, i) => {
                  if (!cell) return <div key={`e-${i}`} className="aspect-square rounded-md bg-white/[0.01]" />;
                  const val = monthData[cell.date];
                  const isToday = cell.date === todayStr;
                  const isFuture = cell.date > todayStr;

                  // For negative habits: colored when NOT done (no entry = good)
                  let level: number;
                  if (isFuture) {
                    level = 0;
                  } else if (isNegative && type === 'boolean') {
                    // Negative habit: success = no entry (val is undefined/0)
                    level = (val == null || val === 0) ? 4 : 0;
                  } else {
                    level = getIntensityLevel(val, computedMax, type);
                  }

                  const opacities = ['bg-white/[0.02]', 'bg-accent-mint/25', 'bg-accent-mint/45', 'bg-accent-mint/65', 'bg-accent-mint/85'];

                  return (
                    <div
                      key={cell.date}
                      onClick={() => !isFuture && onDayClick?.(cell.date)}
                      className={cn(
                        'aspect-square rounded-md flex items-center justify-center transition-colors border',
                        isFuture ? 'bg-white/[0.01] border-white/[0.02] opacity-25' : opacities[level],
                        level === 0 && !isFuture && 'border-white/[0.1]',
                        level > 0 && 'border-accent-mint/40',
                        isToday && 'ring-1 ring-accent-mint',
                        !isFuture && onDayClick && 'cursor-pointer hover:ring-1 hover:ring-white/20',
                      )}
                      title={val != null ? `${cell.date}: ${val}` : cell.date}
                    >
                      <span className={cn('text-[8px]', level > 0 ? 'text-white/70' : 'text-white/25')}>{cell.day}</span>
                    </div>
                  );
                })}
              </div>

              {/* Footer stats */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-0.5">
                  {[0,1,2,3,4].map(l => (
                    <div key={l} className={cn('w-2.5 h-2.5 rounded-sm',
                      l === 0 ? 'bg-white/[0.04]' :
                      l === 1 ? 'bg-accent-mint/25' :
                      l === 2 ? 'bg-accent-mint/45' :
                      l === 3 ? 'bg-accent-mint/65' : 'bg-accent-mint/85'
                    )} />
                  ))}
                </div>
                <span className="text-[10px] text-text-muted">{stats.count} dias este mes</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
