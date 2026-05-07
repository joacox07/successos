import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { cn, getIconForHabit } from '@/lib/utils';
import Icon from '@/components/Icon';

// ── Types ──

interface CheckinState {
  sleepQuality: number | null;
  bedtime: string;
  wakeTime: string;
  mood: number | null;
  emotionalNote: string;
  energyLevel: number | null;
  exerciseDone: boolean | null;
  exerciseType: string;
  exerciseDuration: number | null;
  dietQuality: number | null;
  focusHours: number | null;
  biggestWin: string;
  dayRating: number | null;
}

interface HabitItem {
  id: number;
  name: string;
  emoji: string | null;
  category: string | null;
  completed: boolean;
  isNegative?: boolean;
  targetMinutes?: number | null;
  minutesLogged?: number;
  status?: 'positive' | 'negative' | 'clear';
  icon?: string;
}


interface Props {
  onComplete?: () => void;
  initialData?: Record<string, any> | null;
  targetDate?: string;
  initialHabits?: HabitItem[];
  initialStreak?: number;
}

interface StepProps {
  data: CheckinState;
  update: <K extends keyof CheckinState>(key: K, value: CheckinState[K]) => void;
}

const defaultState: CheckinState = {
  sleepQuality: null,
  bedtime: '',
  wakeTime: '',
  mood: null,
  emotionalNote: '',
  energyLevel: null,
  exerciseDone: null,
  exerciseType: '',
  exerciseDuration: null,
  dietQuality: null,
  focusHours: null,
  biggestWin: '',
  dayRating: null,
};

// ── Step definition ──

interface StepDef {
  id: string;
  label: string;
  icon: string;
}

// Core steps always present
const CORE_STEPS: StepDef[] = [
  { id: 'sleep', label: 'Sueño', icon: 'moon' },
  { id: 'mood', label: 'Mood', icon: 'mood' },
  { id: 'energy', label: 'Energía', icon: 'energy' },
  { id: 'exercise', label: 'Ejercicio', icon: 'exercise' },
  { id: 'diet', label: 'Dieta', icon: 'diet' },
  { id: 'productivity', label: 'Productividad', icon: 'target' },
];

// ── Slide animation variants ──

const slideTransition = { duration: 0.3, ease: 'easeInOut' as const };

function getSlideVariants(dir: number) {
  return {
    enter: { x: dir > 0 ? 300 : -300, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: dir > 0 ? -300 : 300, opacity: 0 },
  };
}

// ── Confetti particle ──

function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const x = Math.random() * 100;
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{ left: `${x}%`, top: '-4px', backgroundColor: color }}
      initial={{ y: 0, opacity: 1, scale: 1 }}
      animate={{
        y: [0, -60, 300],
        opacity: [1, 1, 0],
        scale: [1, 1.2, 0.5],
        rotate: [0, 180, 360],
      }}
      transition={{ duration: 1.8, delay, ease: 'easeOut' }}
    />
  );
}

// ═════════════════════════════════════════
// STEP COMPONENTS
// ═════════════════════════════════════════

// ── Step: Sleep ──

function StepSleep({ data, update }: StepProps) {
  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="flex justify-center">
        <Icon name="sleep" size={64} className="text-accent-mint" />
      </div>
      <h2 className="text-2xl font-display text-text-primary uppercase tracking-tight">
        {'¿Cómo dormiste?'}
      </h2>

      <div className="space-y-2">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={data.sleepQuality ?? 5}
          onChange={(e) => update('sleepQuality', Number(e.target.value))}
          className="w-full accent-[#4ade80] h-2 rounded-full appearance-none bg-white/[0.08] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-mint [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(74,222,128,0.4)]"
        />
        <div className="flex justify-between text-xs text-text-muted font-mono">
          <span>1</span>
          <span className="text-accent-mint font-bold text-sm">{data.sleepQuality ?? 5}</span>
          <span>10</span>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-text-muted block mb-1.5">Me acosté</label>
          <input
            type="time"
            value={data.bedtime}
            onChange={(e) => update('bedtime', e.target.value)}
            className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary font-mono focus:outline-none focus:border-accent-mint/40 transition-colors text-center [color-scheme:dark]"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-text-muted block mb-1.5">Me desperté</label>
          <input
            type="time"
            value={data.wakeTime}
            onChange={(e) => update('wakeTime', e.target.value)}
            className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary font-mono focus:outline-none focus:border-accent-mint/40 transition-colors text-center [color-scheme:dark]"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step: Mood ──

function StepMood({ data, update }: StepProps) {
  const options = [
    { icon: 'mood-sad', value: 2 },
    { icon: 'mood-neutral', value: 5 },
    { icon: 'mood', value: 8 },
  ];

  const currentIcon = data.mood
    ? (data.mood <= 3 ? 'mood-sad' : data.mood <= 6 ? 'mood-neutral' : 'mood')
    : 'mood-neutral';

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="flex justify-center">
        <Icon name={currentIcon} size={64} className="text-accent-violet" />
      </div>
      <h2 className="text-2xl font-display text-text-primary uppercase tracking-tight">
        {'¿Cómo te sentís hoy?'}
      </h2>

      <div className="flex justify-center gap-6">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update('mood', opt.value)}
            className={cn(
              'w-16 h-16 rounded-none flex items-center justify-center transition-all',
              data.mood === opt.value
                ? 'bg-accent-violet border-2 border-accent-violet text-black scale-110'
                : 'bg-white/[0.04] border border-white/[0.1] text-text-muted hover:text-white'
            )}
          >
            <Icon name={opt.icon} size={28} />
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-1.5">
          Algo más sobre tu estado emocional?
        </label>
        <input
          type="text"
          value={data.emotionalNote}
          onChange={(e) => update('emotionalNote', e.target.value)}
          placeholder="Opcional..."
          className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-violet/40 transition-colors"
        />
      </div>
    </div>
  );
}

// ── Step: Energy ──

function StepEnergy({ data, update }: StepProps) {
  const levels = [
    { value: 2, label: 'Muerto' },
    { value: 4, label: 'Bajo' },
    { value: 6, label: 'Normal' },
    { value: 8, label: 'Alto' },
    { value: 10, label: 'Full' },
  ];

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="flex justify-center">
        <Icon name="energy" size={64} className="text-accent-amber" />
      </div>
      <h2 className="text-2xl font-display text-text-primary uppercase tracking-tight">
        {'¿Nivel de energía?'}
      </h2>

      <div className="flex justify-center gap-3">
        {levels.map((lvl, i) => {
          const selected = data.energyLevel === lvl.value;
          const bars = i + 1;
          return (
            <button
              key={lvl.value}
              onClick={() => update('energyLevel', lvl.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all min-w-[52px] min-h-[48px]',
                selected
                  ? 'bg-accent-amber/15 border border-accent-amber/40'
                  : 'border border-transparent hover:bg-white/[0.04]'
              )}
            >
              <div
                className="w-7 h-10 rounded-md border-2 relative flex flex-col-reverse gap-0.5 p-0.5"
                style={{ borderColor: selected ? 'rgb(var(--color-accent-warm))' : 'rgba(255,255,255,0.15)' }}
              >
                {Array.from({ length: 5 }).map((_, barIdx) => (
                  <div
                    key={barIdx}
                    className={cn(
                      'w-full flex-1 rounded-[1px] transition-colors',
                      barIdx < bars
                        ? selected ? 'bg-accent-amber' : 'bg-white/[0.2]'
                        : 'bg-white/[0.06]'
                    )}
                  />
                ))}
                <div
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 rounded-t-sm"
                  style={{ backgroundColor: selected ? 'rgb(var(--color-accent-warm))' : 'rgba(255,255,255,0.15)' }}
                />
              </div>
              <span className={cn(
                'text-[10px]',
                selected ? 'text-accent-amber font-semibold' : 'text-text-muted'
              )}>
                {lvl.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step: Exercise ──

function StepExercise({ data, update }: StepProps) {
  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="flex justify-center">
        <Icon name="exercise" size={64} className="text-accent-mint" />
      </div>
      <h2 className="text-2xl font-display text-text-primary uppercase tracking-tight">
        {'¿Hiciste ejercicio hoy?'}
      </h2>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => update('exerciseDone', true)}
          className={cn(
            'flex-1 py-4 rounded-none text-sm font-bold uppercase tracking-widest transition-all',
            data.exerciseDone === true
              ? 'bg-accent-mint text-black border-2 border-accent-mint'
              : 'bg-white/[0.04] border border-white/[0.1] text-text-secondary hover:bg-white/[0.08]'
          )}
        >
          Sí
        </button>
        <button
          onClick={() => {
            update('exerciseDone', false);
            update('exerciseType', '');
            update('exerciseDuration', null);
          }}
          className={cn(
            'flex-1 py-4 rounded-none text-sm font-bold uppercase tracking-widest transition-all',
            data.exerciseDone === false
              ? 'bg-accent-coral text-black border-2 border-accent-coral'
              : 'bg-white/[0.04] border border-white/[0.1] text-text-secondary hover:bg-white/[0.08]'
          )}
        >
          No
        </button>
      </div>

      <AnimatePresence>
        {data.exerciseDone === true && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden space-y-3"
          >
            <div>
              <label className="text-xs text-text-muted block mb-1.5">{'¿Qué hiciste?'}</label>
              <input
                type="text"
                value={data.exerciseType}
                onChange={(e) => update('exerciseType', e.target.value)}
                placeholder="Gym, correr, yoga..."
                className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-mint/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1.5">Duración (minutos)</label>
              <input
                type="number"
                inputMode="numeric"
                value={data.exerciseDuration ?? ''}
                onChange={(e) =>
                  update('exerciseDuration', e.target.value ? Number(e.target.value) : null)
                }
                placeholder="60"
                className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent-mint/40 transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Step: Diet ──

function StepDiet({ data, update }: StepProps) {
  const options = [
    { icon: 'mood-sad', label: 'Mal', value: 2 },
    { icon: 'mood-neutral', label: 'Regular', value: 5 },
    { icon: 'mood', label: 'Bien', value: 8 },
  ];

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="flex justify-center">
        <Icon name="diet" size={64} className="text-accent-mint" />
      </div>
      <h2 className="text-2xl font-display text-text-primary uppercase tracking-tight">
        {'¿Cómo comiste hoy?'}
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update('dietQuality', opt.value)}
            className={cn(
              'border p-4 flex flex-col items-center gap-4 transition-all',
              data.dietQuality === opt.value
                ? 'bg-accent-mint text-black border-accent-mint shadow-[0_0_12px_rgba(74,222,128,0.2)]'
                : 'bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08]'
            )}
          >
            <Icon name={opt.icon} size={24} />
            <span
              className={cn(
                'text-xs font-medium',
                data.dietQuality === opt.value ? 'text-accent-mint' : 'text-text-secondary'
              )}
            >
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step: Productivity ──

function StepProductivity({ data, update }: StepProps) {
  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="flex justify-center">
        <Icon name="target" size={64} className="text-accent-violet" />
      </div>
      <h2 className="text-2xl font-display text-text-primary uppercase tracking-tight">
        {'¿Qué tal la productividad?'}
      </h2>

      <div className="space-y-2">
        <label className="text-xs text-text-muted">Horas de foco</label>
        <input
          type="range"
          min={0}
          max={12}
          step={0.5}
          value={data.focusHours ?? 0}
          onChange={(e) => update('focusHours', Number(e.target.value))}
          className="w-full accent-[#a78bfa] h-2 rounded-full appearance-none bg-white/[0.08] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-violet [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(167,139,250,0.4)]"
        />
        <div className="flex justify-between text-xs text-text-muted font-mono">
          <span>0h</span>
          <span className="text-accent-violet font-bold text-sm">{data.focusHours ?? 0}h</span>
          <span>12h</span>
        </div>
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-1.5">
          {'¿Cuál fue tu mayor logro hoy?'}
        </label>
        <input
          type="text"
          value={data.biggestWin}
          onChange={(e) => update('biggestWin', e.target.value)}
          placeholder="Opcional..."
          className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-violet/40 transition-colors"
        />
      </div>
    </div>
  );
}

// ── Step: Dynamic Habits ──

function StepHabits({
  habits,
  toggleHabit,
  setHabitMinutes,
}: {
  habits: HabitItem[];
  toggleHabit: (id: number) => void;
  setHabitMinutes: (id: number, minutes: number) => void;
}) {
  // Show all habits - don't filter
  // Group by category
  const grouped = habits.reduce<Record<string, HabitItem[]>>((acc, h) => {
    const cat = h.category || 'otros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(h);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    salud: 'SALUD',
    espiritual: 'ESPIRITUAL',
    personal: 'PERSONAL',
    educacion: 'EDUCACIÓN',
    otros: 'OTROS',
  };

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="flex justify-center">
        <Icon name="checklist" size={64} className="text-accent-mint" />
      </div>
      <h2 className="text-2xl font-display text-text-primary uppercase tracking-tight">
        {'¿Qué hiciste hoy?'}
      </h2>
      <p className="text-xs text-text-muted font-mono">Los hábitos de evitación cuentan como limpios salvo recaída</p>

      <div className="space-y-4 text-left">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-[8px] font-mono text-text-muted uppercase tracking-[0.2em] mb-2 opacity-50">
              {categoryLabels[cat] || cat.toUpperCase()}
            </p>
            <div className="space-y-1">
              {items.map((habit) => (
                <div
                  key={habit.id}
                  className={cn(
                    'w-full border px-4 py-3 transition-all',
                    habit.completed
                      ? 'bg-accent-mint/10 border-accent-mint/30'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleHabit(habit.id)}
                      className={cn(
                        'w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all shrink-0',
                        habit.status === 'negative'
                          ? 'bg-accent-coral border-accent-coral'
                          : habit.completed
                            ? 'bg-accent-mint border-accent-mint'
                            : 'border-white/[0.2]'
                      )}
                    >
                      {(habit.completed || habit.status === 'negative') && (
                        <Icon name={habit.status === 'negative' ? 'x' : 'check'} size={14} className="text-black" />
                      )}
                    </button>
                    <Icon name={getIconForHabit(habit.name, habit.category)} size={16} className={cn('shrink-0', habit.completed ? 'text-accent-mint' : 'text-text-muted')} />
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm font-medium transition-colors',
                          habit.status === 'negative' ? 'text-accent-coral' : habit.completed ? 'text-accent-mint' : 'text-text-secondary'
                        )}
                      >
                        {habit.name}
                      </span>
                      {habit.isNegative ? (
                        <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                          {habit.status === 'negative' ? 'Recaida marcada' : 'Limpio por defecto'}
                        </span>
                      ) : habit.targetMinutes ? (
                        <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                          Meta {habit.targetMinutes} min
                        </span>
                      ) : null}
                    </div>
                    {habit.isNegative ? (
                      <button
                        type="button"
                        onClick={() => toggleHabit(habit.id)}
                        className={cn(
                          'rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]',
                          habit.status === 'negative'
                            ? 'bg-accent-mint/15 text-accent-mint'
                            : 'bg-accent-coral/15 text-accent-coral'
                        )}
                      >
                        {habit.status === 'negative' ? 'Limpiar' : 'Recaida'}
                      </button>
                    ) : null}
                  </div>
                  {!habit.isNegative && habit.targetMinutes ? (
                    <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
                      <label className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Minutos</label>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={habit.minutesLogged ?? 0}
                        onChange={(event) => setHabitMinutes(habit.id, Number(event.target.value || 0))}
                        className="h-9 w-24 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 text-sm font-mono text-text-primary outline-none focus:border-accent-mint/40"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step: Day Rating + Summary ──

function StepSummary({
  data,
  update,
  goTo,
  steps,
  habits,
  habitsStepIndex,
}: StepProps & {
  goTo: (step: number) => void;
  steps: StepDef[];
  habits: HabitItem[];
  habitsStepIndex: number | null;
}) {
  const summaryRows: { icon: string; label: string; value: string | null; step: number }[] = [];

  // Build summary from actual steps
  steps.forEach((s, i) => {
    switch (s.id) {
      case 'sleep':
        summaryRows.push({ icon: 'moon', label: 'Sueño', value: data.sleepQuality !== null ? `${data.sleepQuality}/10` : null, step: i });
        break;
      case 'mood':
        summaryRows.push({ icon: 'mood', label: 'Mood', value: data.mood !== null ? `${data.mood}/10` : null, step: i });
        break;
      case 'energy':
        summaryRows.push({ icon: 'energy', label: 'Energía', value: data.energyLevel !== null ? `${data.energyLevel}/10` : null, step: i });
        break;
      case 'exercise':
        summaryRows.push({
          icon: 'exercise', label: 'Ejercicio',
          value: data.exerciseDone !== null
            ? data.exerciseDone ? `Sí${data.exerciseDuration ? ` (${data.exerciseDuration}m)` : ''}` : 'No'
            : null,
          step: i,
        });
        break;
      case 'diet':
        summaryRows.push({ icon: 'diet', label: 'Dieta', value: data.dietQuality !== null ? `${data.dietQuality}/10` : null, step: i });
        break;
      case 'productivity':
        summaryRows.push({ icon: 'target', label: 'Foco', value: data.focusHours !== null ? `${data.focusHours}h` : null, step: i });
        break;
    }
  });

  // Add habits summary
  if (habits.length > 0 && habitsStepIndex !== null) {
    const done = habits.filter((h) => h.completed).length;
    summaryRows.push({
      icon: 'checklist',
      label: 'Hábitos',
      value: `${done}/${habits.length}`,
      step: habitsStepIndex,
    });
  }

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <div className="flex justify-center">
        <Icon name="star" size={64} className="text-accent-amber" />
      </div>
      <h2 className="text-2xl font-display text-text-primary uppercase tracking-tight">
        {'Calificá tu día en general'}
      </h2>

      {/* Star rating 1-10 */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {Array.from({ length: 10 }).map((_, i) => {
          const val = i + 1;
          const filled = data.dayRating !== null && val <= data.dayRating;
          return (
            <button
              key={val}
              onClick={() => update('dayRating', val)}
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                filled ? 'text-accent-amber scale-110' : 'text-white/[0.15] hover:text-white/[0.3]'
              )}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.26 5.06 16.7l.94-5.49-4-3.9 5.53-.8L10 1.5z" />
              </svg>
            </button>
          );
        })}
      </div>
      {data.dayRating !== null && (
        <p className="text-accent-amber font-mono text-sm font-bold">{data.dayRating}/10</p>
      )}

      {/* Summary card */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl divide-y divide-white/[0.06] text-left">
        {summaryRows.map((row) => (
          <button
            key={row.label}
            onClick={() => goTo(row.step)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon name={row.icon} size={16} className="text-text-muted" />
              <span className="text-[12px] font-mono uppercase tracking-widest text-text-secondary">{row.label}</span>
            </div>
            <span
              className={cn(
                'text-sm font-mono',
                row.value ? 'text-text-primary' : 'text-text-muted'
              )}
            >
              {row.value ?? '—'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════

export default function DailyCheckin({ onComplete, initialData, targetDate, initialHabits, initialStreak }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<CheckinState>(() => {
    if (initialData) return { ...defaultState, ...initialData } as CheckinState;
    return { ...defaultState };
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(initialStreak ?? 0);
  const [error, setError] = useState<string | null>(null);

  // Dynamic habits
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [initialHabitState, setInitialHabitState] = useState<Record<number, { completed: boolean; status: string; minutes: number }>>({});
  const [habitsLoaded, setHabitsLoaded] = useState(false);

  // Build dynamic steps list
  const steps: StepDef[] = [...CORE_STEPS];
  const hasHabits = habits.length > 0;
  const habitsStepIndex = hasHabits ? steps.length : null;
  if (hasHabits) {
    steps.push({ id: 'habits', label: 'Hábitos', icon: 'checklist' });
  }
  // Summary is always last
  steps.push({ id: 'summary', label: 'Resumen', icon: 'star' });

  const totalSteps = steps.length;

  // Load existing check-in & habits
  useEffect(() => {
    if (!initialData) {
      const request = targetDate ? api.getCheckinByDate(targetDate) : api.getCheckinToday();
      request
        .then((res) => {
          if (res.entry) setData({ ...defaultState, ...res.entry } as CheckinState);
          setStreak(res.streak);
        })
        .catch(() => {});
    }

    if (initialHabits) {
      setHabits(initialHabits);
      const initState: Record<number, { completed: boolean; status: string; minutes: number }> = {};
      initialHabits.forEach((habit) => {
        initState[habit.id] = { completed: habit.completed, status: habit.status || 'clear', minutes: habit.minutesLogged || 0 };
      });
      setInitialHabitState(initState);
      setHabitsLoaded(true);
      return;
    }

    // Load habits
    api
      .getHabits(targetDate)
      .then((res) => {
        const items: HabitItem[] = res.habits.map((h: any) => ({
          id: h.id,
          name: h.name,
          emoji: h.emoji,
          category: h.category,
          isNegative: !!h.isNegative,
          targetMinutes: h.targetMinutes ?? null,
          minutesLogged: res.minutes?.[h.id] ?? 0,
          status: res.status?.[h.id] ?? 'clear',
          completed: res.today?.[h.id] ?? false,
        }));
        setHabits(items);
        // Track initial state so we only toggle changed habits on save
        const initState: Record<number, { completed: boolean; status: string; minutes: number }> = {};
        items.forEach((h) => { initState[h.id] = { completed: h.completed, status: h.status || 'clear', minutes: h.minutesLogged || 0 }; });
        setInitialHabitState(initState);
        setHabitsLoaded(true);
      })
      .catch(() => setHabitsLoaded(true));
  }, [initialData, initialHabits, targetDate]);

  const update = useCallback(
    <K extends keyof CheckinState>(key: K, value: CheckinState[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleHabit = useCallback((habitId: number) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        if (h.isNegative) {
          const status = h.status === 'negative' ? 'clear' : 'negative';
          return { ...h, status, completed: status !== 'negative' };
        }
        const completed = !h.completed;
        return { ...h, completed, status: completed ? 'positive' : 'clear' };
      })
    );
  }, []);

  const setHabitMinutes = useCallback((habitId: number, minutes: number) => {
    const safeMinutes = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
    setHabits((prev) =>
      prev.map((h) => (h.id === habitId
        ? { ...h, minutesLogged: safeMinutes, completed: safeMinutes > 0, status: safeMinutes > 0 ? 'positive' : 'clear' }
        : h))
    );
  }, []);

  function next() {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }

  function prev() {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }

  function goTo(s: number) {
    setDirection(s > step ? 1 : -1);
    setStep(s);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Save check-in data
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== null && v !== '') payload[k] = v;
      }
      if (targetDate) payload.date = targetDate;
      await api.submitCheckin(payload);

      // Save habit toggles - only for habits whose state changed
      const habitPromises = habits
        .filter((h) => {
          const initial = initialHabitState[h.id] ?? { completed: false, status: 'clear', minutes: 0 };
          return h.completed !== initial.completed || (h.status || 'clear') !== initial.status || (h.minutesLogged || 0) !== initial.minutes;
        })
        .map((h) => {
          if (h.targetMinutes && !h.isNegative) return api.setHabitMinutes(h.id, h.minutesLogged || 0, targetDate, 'set').catch(() => {});
          if (h.isNegative) return api.setHabitStatus(h.id, h.status === 'negative' ? 'negative' : 'clear', targetDate).catch(() => {});
          return api.setHabitStatus(h.id, h.completed ? 'positive' : 'clear', targetDate).catch(() => {});
        });
      await Promise.all(habitPromises);

      setSaved(true);
      try {
        const res = targetDate ? await api.getCheckinByDate(targetDate) : await api.getCheckinToday();
        setStreak(res.streak);
      } catch {}
      setTimeout(() => onComplete?.(), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // ── Success screen ──
  if (saved) {
    const colors = ['rgb(var(--color-accent-primary))', 'rgb(var(--color-accent-secondary))', 'rgb(var(--color-accent-tertiary))', 'rgb(var(--color-accent-warm))', 'rgb(74 164 250)'];
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[60vh] overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <ConfettiParticle key={i} delay={i * 0.05} color={colors[i % colors.length]} />
        ))}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center z-10"
        >
          <div className="flex justify-center mb-8">
            <Icon name="party" size={80} className="text-accent-mint" />
          </div>
          <h2 className="text-3xl font-display text-text-primary uppercase tracking-tighter mb-4">
            {'¡CHECK-IN PROTOCOL COMPLETE!'}
          </h2>
          {streak > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-3 bg-accent-mint/5 border border-accent-mint/20 py-4 px-6"
            >
              <Icon name="fire" size={24} className="text-accent-mint" />
              <p className="text-xl font-display text-accent-mint uppercase tracking-widest">
                {streak} {streak === 1 ? 'DAY' : 'DAYS'} STREAK
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  const variants = getSlideVariants(direction);

  // Render step content based on step ID
  function renderStep(stepDef: StepDef) {
    switch (stepDef.id) {
      case 'sleep': return <StepSleep data={data} update={update} />;
      case 'mood': return <StepMood data={data} update={update} />;
      case 'energy': return <StepEnergy data={data} update={update} />;
      case 'exercise': return <StepExercise data={data} update={update} />;
      case 'diet': return <StepDiet data={data} update={update} />;
      case 'productivity': return <StepProductivity data={data} update={update} />;
      case 'habits': return <StepHabits habits={habits} toggleHabit={toggleHabit} setHabitMinutes={setHabitMinutes} />;
      case 'summary': return (
        <StepSummary
          data={data}
          update={update}
          goTo={goTo}
          steps={steps}
          habits={habits}
          habitsStepIndex={habitsStepIndex}
        />
      );
      default: return null;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header: back button + progress bar ── */}
      <div className="flex items-center gap-3 mb-6">
        {step > 0 ? (
          <button
            onClick={prev}
            className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0"
            aria-label="Anterior"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M11 4L6 9L11 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <div className="w-10" />
        )}

        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-mint to-accent-violet"
            initial={false}
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        <span className="text-xs font-mono text-text-muted shrink-0 w-10 text-right">
          {step + 1}/{totalSteps}
        </span>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 min-h-0 relative overflow-y-auto pb-4">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="flex flex-col items-center px-4 pb-4"
          >
            {renderStep(steps[step])}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer button ── */}
      <div className="sticky bottom-0 z-10 mt-2 border-t border-white/[0.06] bg-bg-primary/95 pt-4 backdrop-blur-xl">
        {error && <p className="text-accent-coral text-sm text-center mb-3">{error}</p>}

        {step < totalSteps - 1 ? (
          <button
            onClick={next}
            className="w-full py-3.5 rounded-2xl bg-accent-mint/20 text-accent-mint font-semibold text-sm font-[Sora] hover:bg-accent-mint/30 active:scale-[0.98] transition-all min-h-[48px]"
          >
            Siguiente
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'w-full py-3.5 rounded-2xl font-semibold text-sm font-[Sora] transition-all min-h-[48px] active:scale-[0.98]',
              saving
                ? 'bg-white/[0.06] text-text-muted cursor-wait'
                : 'bg-gradient-to-r from-accent-mint to-accent-violet text-bg-primary hover:opacity-90'
            )}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </div>
    </div>
  );
}
