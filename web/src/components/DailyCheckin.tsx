import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '@/components/Icon';
import { api } from '@/lib/api';
import { cn, formatDateFull, getIconForHabit } from '@/lib/utils';

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
}

interface Props {
  onComplete?: () => void;
  initialData?: Record<string, any> | null;
  targetDate?: string;
  initialHabits?: HabitItem[];
  initialStreak?: number;
  mode?: 'quick' | 'edit';
}

interface StepProps {
  data: CheckinState;
  update: <K extends keyof CheckinState>(key: K, value: CheckinState[K]) => void;
}

interface StepDef {
  id: 'habits' | 'productivity' | 'exercise' | 'mood-energy' | 'sleep' | 'summary';
  label: string;
  icon: string;
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

const slideTransition = { duration: 0.28, ease: 'easeInOut' as const };

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return toISODate(yesterday);
}

function getHeaderLabel(mode: 'quick' | 'edit', targetDate?: string) {
  if (!targetDate) return mode === 'edit' ? 'Editando dia' : 'Check-in de hoy';
  if (mode === 'edit') return `Editando ${formatDateFull(targetDate)}`;
  return targetDate === getYesterdayDate() ? 'Check-in de ayer' : `Completando ${formatDateFull(targetDate)}`;
}

function getSlideVariants(dir: number) {
  return {
    enter: { x: dir > 0 ? 240 : -240, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: dir > 0 ? -240 : 240, opacity: 0 },
  };
}

function StepSleep({ data, update }: StepProps) {
  const qualityValue = data.sleepQuality ?? 0;
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center">
        <Icon name="sleep" size={44} className="text-accent-coral" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-2xl font-display uppercase tracking-tight text-text-primary">Sueño</h2>
        <p className="text-xs text-text-muted">Opcional. Podés completarlo mañana.</p>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">Calidad</span>
          <span className="text-sm font-mono text-text-primary">{qualityValue}/10</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={qualityValue}
          onChange={(e) => update('sleepQuality', Number(e.target.value))}
          className="w-full"
          style={{ accentColor: 'rgb(var(--color-accent-primary))' }}
        />
        <div className="flex justify-between text-[11px] font-mono text-text-muted">
          <span>Malo</span>
          <span>Normal</span>
          <span>Excelente</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-left">
        <div className="space-y-1.5">
          <label className="block text-xs font-mono uppercase tracking-widest text-text-secondary">Me acosté (anoche)</label>
          <div className="flex h-12 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3">
            <Icon name="clock" size={16} className="text-text-muted" />
            <input
              type="time"
              value={data.bedtime}
              onChange={(e) => update('bedtime', e.target.value)}
              className="h-10 w-full bg-transparent text-sm text-text-primary outline-none [color-scheme:dark]"
            />
          </div>
          {data.bedtime && (
            <button
              type="button"
              onClick={() => update('bedtime', '')}
              className="text-[11px] font-mono text-text-muted hover:text-text-secondary"
            >
              Limpiar
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-mono uppercase tracking-widest text-text-secondary">Me desperté (hoy)</label>
          <div className="flex h-12 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3">
            <Icon name="clock" size={16} className="text-text-muted" />
            <input
              type="time"
              value={data.wakeTime}
              onChange={(e) => update('wakeTime', e.target.value)}
              className="h-10 w-full bg-transparent text-sm text-text-primary outline-none [color-scheme:dark]"
            />
          </div>
          {data.wakeTime && (
            <button
              type="button"
              onClick={() => update('wakeTime', '')}
              className="text-[11px] font-mono text-text-muted hover:text-text-secondary"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-text-muted text-left">
        Registro nocturno: acostarse anoche y despertarse hoy.
      </p>
    </div>
  );
}

function StepProductivity({ data, update }: StepProps) {
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center"><Icon name="target" size={60} className="text-accent-violet" /></div>
      <h2 className="text-2xl font-display uppercase tracking-tight text-text-primary">Productividad</h2>
      <div className="space-y-2">
        <label className="text-xs text-text-muted">Horas de foco</label>
        <input
          type="range"
          min={0}
          max={12}
          step={0.5}
          value={data.focusHours ?? 0}
          onChange={(e) => update('focusHours', Number(e.target.value))}
          className="w-full accent-[#a78bfa]"
        />
        <div className="flex justify-between text-xs font-mono text-text-muted">
          <span>0h</span>
          <span className="text-accent-violet">{data.focusHours ?? 0}h</span>
          <span>12h</span>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-text-muted">Mayor logro del dia</label>
        <input
          type="text"
          value={data.biggestWin}
          onChange={(e) => update('biggestWin', e.target.value)}
          placeholder="Opcional"
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 text-sm text-text-primary"
        />
      </div>
    </div>
  );
}

function StepExercise({ data, update }: StepProps) {
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center"><Icon name="exercise" size={60} className="text-accent-mint" /></div>
      <h2 className="text-2xl font-display uppercase tracking-tight text-text-primary">Ejercicio</h2>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => update('exerciseDone', true)}
          className={cn('flex-1 rounded-none border px-4 py-4 text-sm font-bold uppercase tracking-widest', data.exerciseDone === true ? 'border-accent-mint bg-accent-mint text-black' : 'border-white/[0.1] bg-white/[0.04] text-text-secondary')}
        >
          Si
        </button>
        <button
          type="button"
          onClick={() => {
            update('exerciseDone', false);
            update('exerciseType', '');
            update('exerciseDuration', null);
          }}
          className={cn('flex-1 rounded-none border px-4 py-4 text-sm font-bold uppercase tracking-widest', data.exerciseDone === false ? 'border-accent-coral bg-accent-coral text-black' : 'border-white/[0.1] bg-white/[0.04] text-text-secondary')}
        >
          No
        </button>
      </div>
      {data.exerciseDone === true && (
        <div className="space-y-3 text-left">
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Que hiciste</label>
            <input
              type="text"
              value={data.exerciseType}
              onChange={(e) => update('exerciseType', e.target.value)}
              placeholder="Gym, correr, caminar"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Duracion (minutos)</label>
            <input
              type="number"
              inputMode="numeric"
              value={data.exerciseDuration ?? ''}
              onChange={(e) => update('exerciseDuration', e.target.value ? Number(e.target.value) : null)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 text-sm text-text-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StepMoodEnergy({ data, update }: StepProps) {
  const moodOptions = [
    { icon: 'mood-sad', value: 2 },
    { icon: 'mood-neutral', value: 5 },
    { icon: 'mood', value: 8 },
  ];
  const energyLevels = [2, 4, 6, 8, 10];

  return (
    <div className="w-full max-w-sm space-y-7 text-center">
      <div className="flex justify-center"><Icon name="mood" size={60} className="text-accent-violet" /></div>
      <div className="space-y-4">
        <h2 className="text-2xl font-display uppercase tracking-tight text-text-primary">Mood</h2>
        <div className="flex justify-center gap-5">
          {moodOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('mood', opt.value)}
              className={cn('flex h-16 w-16 items-center justify-center rounded-none border transition-all', data.mood === opt.value ? 'scale-110 border-accent-violet bg-accent-violet text-black' : 'border-white/[0.1] bg-white/[0.04] text-text-muted')}
            >
              <Icon name={opt.icon} size={28} />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-display uppercase tracking-tight text-text-primary">Energia</h3>
        <div className="flex flex-wrap justify-center gap-2">
          {energyLevels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => update('energyLevel', level)}
              className={cn('min-w-[52px] rounded-xl border px-3 py-2 text-xs', data.energyLevel === level ? 'border-accent-amber bg-accent-amber/15 text-accent-amber' : 'border-white/[0.1] bg-white/[0.04] text-text-muted')}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-text-muted">Nota emocional</label>
        <input
          type="text"
          value={data.emotionalNote}
          onChange={(e) => update('emotionalNote', e.target.value)}
          placeholder="Opcional"
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 text-sm text-text-primary"
        />
      </div>
    </div>
  );
}

function StepHabits({ habits, toggleHabit, setHabitMinutes }: { habits: HabitItem[]; toggleHabit: (id: number) => void; setHabitMinutes: (id: number, minutes: number) => void }) {
  const grouped = habits.reduce<Record<string, HabitItem[]>>((acc, habit) => {
    const key = habit.category || 'otros';
    if (!acc[key]) acc[key] = [];
    acc[key].push(habit);
    return acc;
  }, {});

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center"><Icon name="checklist" size={60} className="text-accent-mint" /></div>
      <div>
        <h2 className="text-2xl font-display uppercase tracking-tight text-text-primary">Habitos</h2>
        <p className="mt-2 text-xs text-text-muted">Los habitos de evitacion cuentan como limpios salvo recaida.</p>
      </div>
      <div className="space-y-4 text-left">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-text-muted">{group}</p>
            <div className="space-y-2">
              {items.map((habit) => (
                <div key={habit.id} className={cn('border px-4 py-3', habit.completed ? 'border-accent-mint/30 bg-accent-mint/10' : 'border-white/[0.06] bg-white/[0.02]')}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleHabit(habit.id)}
                      className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2', habit.status === 'negative' ? 'border-accent-coral bg-accent-coral' : habit.completed ? 'border-accent-mint bg-accent-mint' : 'border-white/[0.2]')}
                    >
                      {(habit.completed || habit.status === 'negative') && <Icon name={habit.status === 'negative' ? 'x' : 'check'} size={14} className="text-black" />}
                    </button>
                    <Icon name={getIconForHabit(habit.name, habit.category)} size={16} className={cn('shrink-0', habit.completed ? 'text-accent-mint' : 'text-text-muted')} />
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm font-medium', habit.status === 'negative' ? 'text-accent-coral' : habit.completed ? 'text-accent-mint' : 'text-text-secondary')}>{habit.name}</div>
                      {habit.isNegative ? <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{habit.status === 'negative' ? 'Recaida marcada' : 'Limpio por defecto'}</div> : null}
                      {!habit.isNegative && habit.targetMinutes ? <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Meta {habit.targetMinutes} min</div> : null}
                    </div>
                    {habit.isNegative ? (
                      <button
                        type="button"
                        onClick={() => toggleHabit(habit.id)}
                        className={cn('rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]', habit.status === 'negative' ? 'bg-accent-mint/15 text-accent-mint' : 'bg-accent-coral/15 text-accent-coral')}
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
                        onChange={(e) => setHabitMinutes(habit.id, Number(e.target.value || 0))}
                        className="h-9 w-24 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 text-sm font-mono text-text-primary"
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

function StepSummary({ data, update, goTo, steps, habits, habitsStepIndex }: StepProps & { goTo: (step: number) => void; steps: StepDef[]; habits: HabitItem[]; habitsStepIndex: number | null }) {
  const summaryRows: Array<{ icon: string; label: string; value: string | null; step: number }> = [];

  steps.forEach((stepDef, index) => {
    switch (stepDef.id) {
      case 'habits': {
        if (habits.length > 0 && habitsStepIndex !== null) {
          const done = habits.filter((habit) => habit.completed).length;
          summaryRows.push({ icon: 'checklist', label: 'Habitos', value: `${done}/${habits.length}`, step: habitsStepIndex });
        }
        break;
      }
      case 'productivity':
        summaryRows.push({ icon: 'target', label: 'Foco', value: data.focusHours !== null ? `${data.focusHours}h` : null, step: index });
        break;
      case 'exercise':
        summaryRows.push({ icon: 'exercise', label: 'Ejercicio', value: data.exerciseDone !== null ? (data.exerciseDone ? `Si${data.exerciseDuration ? ` (${data.exerciseDuration}m)` : ''}` : 'No') : null, step: index });
        break;
      case 'mood-energy':
        summaryRows.push({ icon: 'mood', label: 'Mood y energia', value: data.mood !== null || data.energyLevel !== null ? `${data.mood !== null ? `${data.mood}/10 mood` : 'Sin mood'}${data.energyLevel !== null ? ` · ${data.energyLevel}/10 energia` : ''}` : null, step: index });
        break;
      case 'sleep':
        summaryRows.push({ icon: 'sleep', label: 'Sueno', value: data.sleepQuality !== null ? `${data.sleepQuality}/10` : null, step: index });
        break;
    }
  });

  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center"><Icon name="star" size={60} className="text-accent-amber" /></div>
      <h2 className="text-2xl font-display uppercase tracking-tight text-text-primary">Resumen</h2>
      <div className="flex flex-wrap justify-center gap-1.5">
        {Array.from({ length: 10 }).map((_, index) => {
          const value = index + 1;
          const active = data.dayRating !== null && value <= data.dayRating;
          return (
            <button
              key={value}
              type="button"
              onClick={() => update('dayRating', value)}
              className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-all', active ? 'scale-110 text-accent-amber' : 'text-white/[0.15] hover:text-white/[0.3]')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.26 5.06 16.7l.94-5.49-4-3.9 5.53-.8L10 1.5z" /></svg>
            </button>
          );
        })}
      </div>
      {data.dayRating !== null ? <p className="text-sm font-bold font-mono text-accent-amber">{data.dayRating}/10</p> : null}
      <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.04] text-left backdrop-blur-xl">
        {summaryRows.map((row) => (
          <button key={row.label} type="button" onClick={() => goTo(row.step)} className="flex w-full items-center justify-between px-6 py-4 transition-colors hover:bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <Icon name={row.icon} size={16} className="text-text-muted" />
              <span className="text-[12px] font-mono uppercase tracking-widest text-text-secondary">{row.label}</span>
            </div>
            <span className={cn('text-sm font-mono', row.value ? 'text-text-primary' : 'text-text-muted')}>{row.value ?? '-'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DailyCheckin({ onComplete, initialData, targetDate, initialHabits, initialStreak, mode = 'quick' }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<CheckinState>(() => (initialData ? { ...defaultState, ...initialData } as CheckinState : { ...defaultState }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(initialStreak ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [initialHabitState, setInitialHabitState] = useState<Record<number, { completed: boolean; status: string; minutes: number }>>({});

  const steps = useMemo<StepDef[]>(() => {
    const next: StepDef[] = [];
    if (habits.length > 0) next.push({ id: 'habits', label: 'Habitos', icon: 'checklist' });
    next.push(
      { id: 'productivity', label: 'Productividad', icon: 'target' },
      { id: 'exercise', label: 'Ejercicio', icon: 'exercise' },
      { id: 'mood-energy', label: 'Mood y energia', icon: 'mood' },
      { id: 'sleep', label: 'Sueno', icon: 'sleep' },
      { id: 'summary', label: 'Resumen', icon: 'star' },
    );
    return next;
  }, [habits.length]);

  const habitsStepIndex = habits.length > 0 ? 0 : null;
  const totalSteps = steps.length;

  useEffect(() => {
    const shouldFetchEntry = mode === 'edit' || !initialData;
    if (shouldFetchEntry) {
      const request = targetDate ? api.getCheckinByDate(targetDate) : api.getCheckinToday();
      request.then((res) => {
        if (res.entry) setData({ ...defaultState, ...res.entry } as CheckinState);
        setStreak(res.streak);
      }).catch(() => {});
    }

    if (initialHabits) {
      setHabits(initialHabits);
      const initState: Record<number, { completed: boolean; status: string; minutes: number }> = {};
      initialHabits.forEach((habit) => {
        initState[habit.id] = { completed: habit.completed, status: habit.status || 'clear', minutes: habit.minutesLogged || 0 };
      });
      setInitialHabitState(initState);
    }

    const shouldFetchHabits = mode === 'edit' || !initialHabits;
    if (!shouldFetchHabits) return;

    api.getHabits(targetDate).then((res) => {
      const mapped: HabitItem[] = res.habits.map((habit: any) => ({
        id: habit.id,
        name: habit.name,
        emoji: habit.emoji,
        category: habit.category,
        completed: res.today?.[habit.id] ?? false,
        isNegative: !!habit.isNegative,
        targetMinutes: habit.targetMinutes ?? null,
        minutesLogged: res.minutes?.[habit.id] ?? 0,
        status: res.status?.[habit.id] ?? 'clear',
      }));
      setHabits(mapped);
      const initState: Record<number, { completed: boolean; status: string; minutes: number }> = {};
      mapped.forEach((habit) => {
        initState[habit.id] = { completed: habit.completed, status: habit.status || 'clear', minutes: habit.minutesLogged || 0 };
      });
      setInitialHabitState(initState);
    }).catch(() => {});
  }, [initialData, initialHabits, targetDate, mode]);

  const update = useCallback(<K extends keyof CheckinState>(key: K, value: CheckinState[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleHabit = useCallback((habitId: number) => {
    setHabits((prev) => prev.map((habit) => {
      if (habit.id !== habitId) return habit;
      if (habit.isNegative) {
        const status = habit.status === 'negative' ? 'clear' : 'negative';
        return { ...habit, status, completed: status !== 'negative' };
      }
      const completed = !habit.completed;
      return { ...habit, completed, status: completed ? 'positive' : 'clear' };
    }));
  }, []);

  const setHabitMinutes = useCallback((habitId: number, minutes: number) => {
    const safeMinutes = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
    setHabits((prev) => prev.map((habit) => habit.id === habitId ? { ...habit, minutesLogged: safeMinutes, completed: safeMinutes > 0, status: safeMinutes > 0 ? 'positive' : 'clear' } : habit));
  }, []);

  function next() {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep((current) => current + 1);
    }
  }

  function prev() {
    if (step > 0) {
      setDirection(-1);
      setStep((current) => current - 1);
    }
  }

  function goTo(nextStep: number) {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== '') payload[key] = value;
      }
      if (targetDate) payload.date = targetDate;
      await api.submitCheckin(payload);

      await Promise.all(
        habits
          .filter((habit) => {
            const initial = initialHabitState[habit.id] ?? { completed: false, status: 'clear', minutes: 0 };
            return habit.completed !== initial.completed || (habit.status || 'clear') !== initial.status || (habit.minutesLogged || 0) !== initial.minutes;
          })
          .map((habit) => {
            if (habit.targetMinutes && !habit.isNegative) return api.setHabitMinutes(habit.id, habit.minutesLogged || 0, targetDate, 'set').catch(() => {});
            if (habit.isNegative) return api.setHabitStatus(habit.id, habit.status === 'negative' ? 'negative' : 'clear', targetDate).catch(() => {});
            return api.setHabitStatus(habit.id, habit.completed ? 'positive' : 'clear', targetDate).catch(() => {});
          })
      );

      try {
        const res = await api.getHabits(targetDate);
        const mapped: HabitItem[] = res.habits.map((habit: any) => ({
          id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          category: habit.category,
          completed: res.today?.[habit.id] ?? false,
          isNegative: !!habit.isNegative,
          targetMinutes: habit.targetMinutes ?? null,
          minutesLogged: res.minutes?.[habit.id] ?? 0,
          status: res.status?.[habit.id] ?? 'clear',
        }));
        setHabits(mapped);
        const initState: Record<number, { completed: boolean; status: string; minutes: number }> = {};
        mapped.forEach((habit) => {
          initState[habit.id] = { completed: habit.completed, status: habit.status || 'clear', minutes: habit.minutesLogged || 0 };
        });
        setInitialHabitState(initState);
      } catch {}

      setSaved(true);
      try {
        const res = targetDate ? await api.getCheckinByDate(targetDate) : await api.getCheckinToday();
        if (res.entry) setData({ ...defaultState, ...res.entry } as CheckinState);
        setStreak(res.streak);
      } catch {}
      window.setTimeout(() => onComplete?.(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function renderStep(stepDef: StepDef) {
    switch (stepDef.id) {
      case 'habits':
        return <StepHabits habits={habits} toggleHabit={toggleHabit} setHabitMinutes={setHabitMinutes} />;
      case 'productivity':
        return <StepProductivity data={data} update={update} />;
      case 'exercise':
        return <StepExercise data={data} update={update} />;
      case 'mood-energy':
        return <StepMoodEnergy data={data} update={update} />;
      case 'sleep':
        return <StepSleep data={data} update={update} />;
      case 'summary':
        return <StepSummary data={data} update={update} goTo={goTo} steps={steps} habits={habits} habitsStepIndex={habitsStepIndex} />;
      default:
        return null;
    }
  }

  if (saved) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex justify-center"><Icon name="party" size={72} className="text-accent-mint" /></div>
        <h2 className="text-3xl font-display uppercase tracking-tight text-text-primary">Check-in guardado</h2>
        {streak > 0 ? <p className="mt-3 font-mono text-sm text-accent-mint">Racha actual: {streak}</p> : null}
      </div>
    );
  }

  const variants = getSlideVariants(direction);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 space-y-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-text-muted">{mode === 'edit' ? 'Modo edicion' : 'Check-in rapido'}</p>
          <h3 className="text-sm font-medium text-text-primary">{getHeaderLabel(mode, targetDate)}</h3>
        </div>
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <button onClick={prev} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-text-secondary" aria-label="Anterior">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : <div className="w-10" />}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-accent-mint to-accent-violet" initial={false} animate={{ width: `${((step + 1) / totalSteps) * 100}%` }} transition={{ duration: 0.3, ease: 'easeOut' }} />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-xs text-text-muted">{step + 1}/{totalSteps}</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={steps[step]?.id} variants={variants} initial="enter" animate="center" exit="exit" transition={slideTransition} className="flex flex-col items-center px-4 pb-4">
            {renderStep(steps[step])}
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className="sticky z-10 mt-2 border-t border-white/[0.06] bg-bg-primary/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl"
        style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {error ? <p className="mb-3 text-center text-sm text-accent-coral">{error}</p> : null}
        {step < totalSteps - 1 ? (
          <button onClick={next} className="min-h-[48px] w-full rounded-2xl bg-accent-mint/20 py-3.5 text-sm font-semibold text-accent-mint transition-all hover:bg-accent-mint/30 active:scale-[0.98]">Siguiente</button>
        ) : (
          <button onClick={handleSave} disabled={saving} className={cn('min-h-[48px] w-full rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]', saving ? 'cursor-wait bg-white/[0.06] text-text-muted' : 'bg-gradient-to-r from-accent-mint to-accent-violet text-bg-primary hover:opacity-90')}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </div>
    </div>
  );
}
