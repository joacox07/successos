import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Icon from './Icon';

/* ── types ───────────────────────────────────────────────── */
export type MetricType = 'numeric' | 'boolean' | 'duration';

export interface MetricCalendarProps {
  /** Label shown above the calendar */
  label: string;
  /** Icon name from the Icon component */
  icon: string;
  /** Map of date (YYYY-MM-DD) to numeric value */
  data: Record<string, number>;
  /** Type of metric — affects how intensity is computed */
  type?: MetricType;
  /** Max possible value (for numeric metrics). Auto-detected if omitted */
  maxValue?: number;
  /** Accent color as CSS value, e.g. 'rgb(var(--color-accent-primary))' */
  accentColor?: string;
  /** Tailwind class for accent tinting (bg- and text-) */
  accentClass?: string;
  /** Whether the card starts expanded */
  defaultExpanded?: boolean;
  /** Unit label for the average display */
  unit?: string;
}

/* ── calendar utilities ──────────────────────────────────── */
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

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
  let startDow = firstDay.getDay() - 1; // JS 0=Sun, we want 0=Mon
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: Array<{ day: number; date: string } | null> = [];

  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date: dateStr });
  }
  return cells;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/* ── intensity helpers ───────────────────────────────────── */
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
  accentColor = 'rgb(var(--color-accent-primary))',
  accentClass = 'accent-mint',
  defaultExpanded = false,
  unit = '',
}: MetricCalendarProps) {
  const [month, setMonth] = useState(getCurrentMonth);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const todayStr = useMemo(() => getTodayStr(), []);
  const cells = useMemo(() => getCalendarCells(month), [month]);

  /* filter data to current month */
  const monthData = useMemo(() => {
    const filtered: Record<string, number> = {};
    Object.entries(data).forEach(([date, val]) => {
      if (date.startsWith(month)) filtered[date] = val;
    });
    return filtered;
  }, [data, month]);

  /* stats */
  const stats = useMemo(() => {
    const values = Object.values(monthData).filter((v) => v != null && v !== 0);
    if (values.length === 0) return { avg: 0, count: 0, total: 0, trend: 0 };
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / values.length;

    // trend: compare last 7 entries vs prior 7
    const allDates = Object.keys(data).sort();
    const recent = allDates.slice(-7);
    const prior = allDates.slice(-14, -7);
    const recentAvg = recent.length > 0
      ? recent.reduce((s, d) => s + (data[d] ?? 0), 0) / recent.length
      : 0;
    const priorAvg = prior.length > 0
      ? prior.reduce((s, d) => s + (data[d] ?? 0), 0) / prior.length
      : 0;
    const trend = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

    return { avg, count: values.length, total, trend };
  }, [monthData, data]);

  const computedMax = maxValue ?? Math.max(...Object.values(data), 1);

  /* intensity classes using inline styles for the accent color */
  function cellBg(value: number | undefined): string {
    const level = getIntensityLevel(value, computedMax, type);
    if (level === 0) return 'bg-white/[0.03]';
    const map: Record<number, string> = {
      1: `bg-${accentClass}/20`,
      2: `bg-${accentClass}/40`,
      3: `bg-${accentClass}/65`,
      4: `bg-${accentClass}/90`,
    };
    return map[level] || 'bg-white/[0.03]';
  }

  const displayAvg = type === 'boolean'
    ? `${stats.count} dias`
    : `${stats.avg.toFixed(1)}${unit ? ` ${unit}` : ''}`;

  return (
    <motion.div
      layout
      className="rounded-2xl border border-white/[0.06] bg-bg-card overflow-hidden"
    >
      {/* ── Collapsed header ─────────────────────────────── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: accentColor.replace('rgb', 'rgba').replace(')', ' / 0.12)') }}
        >
          <span style={{ color: accentColor }}>
            <Icon name={icon} size={16} />
          </span>
        </div>

        {/* Label + avg */}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{label}</p>
          <p className="text-[11px] text-text-muted">{displayAvg}</p>
        </div>

        {/* Trend indicator */}
        {stats.count > 0 && stats.trend !== 0 && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full',
              stats.trend > 0
                ? 'text-accent-mint bg-accent-mint/10'
                : 'text-accent-coral bg-accent-coral/10',
            )}
          >
            <Icon name={stats.trend > 0 ? 'arrow-up' : 'arrow-down'} size={10} />
            {Math.abs(stats.trend).toFixed(0)}%
          </div>
        )}

        {/* Mini heatmap preview (collapsed) */}
        {!expanded && (
          <div className="flex gap-[2px] shrink-0 ml-1">
            {Array.from({ length: 14 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - 13 + i);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const val = data[dateStr];
              const level = getIntensityLevel(val, computedMax, type);
              return (
                <div
                  key={dateStr}
                  className={cn(
                    'w-1.5 h-3.5 rounded-[2px]',
                    level === 0 && 'bg-white/[0.06]',
                    level === 1 && `bg-${accentClass}/25`,
                    level === 2 && `bg-${accentClass}/45`,
                    level === 3 && `bg-${accentClass}/65`,
                    level === 4 && `bg-${accentClass}/90`,
                  )}
                />
              );
            })}
          </div>
        )}

        {/* Expand chevron */}
        <Icon
          name={expanded ? 'chevron-left' : 'chevron-right'}
          size={14}
          className={cn(
            'text-text-muted transition-transform shrink-0',
            expanded && 'rotate-90',
            !expanded && 'rotate-0',
          )}
        />
      </button>

      {/* ── Expanded calendar — COMPACT ────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 space-y-2">
              {/* Month navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={(e) => { e.stopPropagation(); setMonth((m) => shiftMonth(m, -1)); }}
                  className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                  aria-label="Mes anterior"
                >
                  <Icon name="chevron-left" size={12} className="text-text-secondary" />
                </button>
                <span className="text-[11px] font-medium text-text-primary tracking-wide">
                  {getMonthLabel(month)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setMonth((m) => shiftMonth(m, 1)); }}
                  className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors"
                  aria-label="Mes siguiente"
                >
                  <Icon name="chevron-right" size={12} className="text-text-secondary" />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-[3px]">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="h-4 flex items-center justify-center text-[9px] font-medium text-text-muted/50"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid — compact cells */}
              <div className="grid grid-cols-7 gap-[3px]">
                {cells.map((cell, i) => {
                  if (!cell) return <div key={`e-${i}`} className="h-7" />;
                  const val = monthData[cell.date];
                  const isToday = cell.date === todayStr;
                  const isFuture = cell.date > todayStr;

                  return (
                    <div
                      key={cell.date}
                      className={cn(
                        'h-7 rounded-md flex items-center justify-center text-[9px] font-mono transition-all relative',
                        cellBg(isFuture ? undefined : val),
                        isFuture && 'bg-white/[0.015] text-text-muted/25',
                        !isFuture && val != null && val > 0 && 'text-white/90 font-medium',
                        !isFuture && (val == null || val === 0) && 'text-text-muted/40',
                        isToday && 'ring-1 ring-white/30',
                      )}
                      title={val != null ? `${cell.date}: ${val}` : cell.date}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>

              {/* Legend — compact */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[8px] text-text-muted/40">
                  <span>-</span>
                  {[0, 1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        'w-2 h-2 rounded-[2px]',
                        level === 0 && 'bg-white/[0.03]',
                        level === 1 && `bg-${accentClass}/20`,
                        level === 2 && `bg-${accentClass}/40`,
                        level === 3 && `bg-${accentClass}/65`,
                        level === 4 && `bg-${accentClass}/90`,
                      )}
                    />
                  ))}
                  <span>+</span>
                </div>
                <span className="text-[8px] text-text-muted/30">
                  {stats.count}d
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
