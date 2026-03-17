import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

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

interface Props {
  onComplete?: () => void;
  initialData?: Record<string, any> | null;
}

interface StepProps {
  data: CheckinState;
  update: <K extends keyof CheckinState>(key: K, value: CheckinState[K]) => void;
}

const TOTAL_STEPS = 7;

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

// ── Step 1: Sleep ──

function StepSleep({ data, update }: StepProps) {
  const emojis = ['😫', '😣', '😕', '😐', '😌', '😊', '😴', '🛏️', '💤', '🌟'];
  const emoji = data.sleepQuality ? emojis[data.sleepQuality - 1] : '😴';

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <span className="text-5xl block">{emoji}</span>
      <h2 className="text-xl font-bold text-text-primary font-[Sora]">
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

// ── Step 2: Mood ──

function StepMood({ data, update }: StepProps) {
  const options = [
    { emoji: '😢', value: 2 },
    { emoji: '😕', value: 4 },
    { emoji: '😐', value: 5 },
    { emoji: '🙂', value: 7 },
    { emoji: '😄', value: 9 },
  ];

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <span className="text-5xl block">
        {data.mood ? (options.find((o) => o.value === data.mood)?.emoji ?? '🙂') : '🙂'}
      </span>
      <h2 className="text-xl font-bold text-text-primary font-[Sora]">
        {'¿Cómo te sentís hoy?'}
      </h2>

      <div className="flex justify-center gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update('mood', opt.value)}
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all min-h-[48px]',
              data.mood === opt.value
                ? 'bg-accent-violet/20 border-2 border-accent-violet scale-110 shadow-[0_0_16px_rgba(167,139,250,0.3)]'
                : 'bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]'
            )}
          >
            {opt.emoji}
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

// ── Step 3: Energy ──

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
      <span className="text-5xl block">{'⚡'}</span>
      <h2 className="text-xl font-bold text-text-primary font-[Sora]">
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

// ── Step 4: Exercise ──

function StepExercise({ data, update }: StepProps) {
  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <span className="text-5xl block">{'🏋️'}</span>
      <h2 className="text-xl font-bold text-text-primary font-[Sora]">
        {'¿Hiciste ejercicio hoy?'}
      </h2>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => update('exerciseDone', true)}
          className={cn(
            'flex-1 max-w-[140px] py-4 rounded-2xl text-lg font-semibold transition-all min-h-[56px]',
            data.exerciseDone === true
              ? 'bg-accent-mint/20 border-2 border-accent-mint text-accent-mint shadow-[0_0_16px_rgba(74,222,128,0.2)]'
              : 'bg-white/[0.04] border border-white/[0.08] text-text-secondary hover:bg-white/[0.08]'
          )}
        >
          {'✅ Sí'}
        </button>
        <button
          onClick={() => {
            update('exerciseDone', false);
            update('exerciseType', '');
            update('exerciseDuration', null);
          }}
          className={cn(
            'flex-1 max-w-[140px] py-4 rounded-2xl text-lg font-semibold transition-all min-h-[56px]',
            data.exerciseDone === false
              ? 'bg-accent-coral/20 border-2 border-accent-coral text-accent-coral shadow-[0_0_16px_rgba(251,113,133,0.2)]'
              : 'bg-white/[0.04] border border-white/[0.08] text-text-secondary hover:bg-white/[0.08]'
          )}
        >
          {'❌ No'}
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

// ── Step 5: Diet ──

function StepDiet({ data, update }: StepProps) {
  const options = [
    { emoji: '🍕', label: 'Mal', value: 2 },
    { emoji: '🍔', label: 'Regular', value: 4 },
    { emoji: '🥗', label: 'Bien', value: 6 },
    { emoji: '🥑', label: 'Muy bien', value: 8 },
    { emoji: '🏆', label: 'Excelente', value: 10 },
  ];

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <span className="text-5xl block">{'🍽️'}</span>
      <h2 className="text-xl font-bold text-text-primary font-[Sora]">
        {'¿Cómo comiste hoy?'}
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update('dietQuality', opt.value)}
            className={cn(
              'rounded-2xl border p-4 flex flex-col items-center gap-2 transition-all min-h-[80px]',
              data.dietQuality === opt.value
                ? 'bg-accent-mint/15 border-accent-mint/40 shadow-[0_0_12px_rgba(74,222,128,0.15)]'
                : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08]'
            )}
          >
            <span className="text-2xl">{opt.emoji}</span>
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

// ── Step 6: Productivity ──

function StepProductivity({ data, update }: StepProps) {
  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <span className="text-5xl block">{'🎯'}</span>
      <h2 className="text-xl font-bold text-text-primary font-[Sora]">
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

// ── Step 7: Day Rating + Summary ──

function StepSummary({
  data,
  update,
  goTo,
}: StepProps & { goTo: (step: number) => void }) {
  const summaryRows: { label: string; value: string | null; step: number }[] = [
    { label: '😴 Sueño', value: data.sleepQuality !== null ? `${data.sleepQuality}/10` : null, step: 0 },
    { label: '🙂 Mood', value: data.mood !== null ? `${data.mood}/10` : null, step: 1 },
    { label: '⚡ Energía', value: data.energyLevel !== null ? `${data.energyLevel}/10` : null, step: 2 },
    {
      label: '🏋️ Ejercicio',
      value:
        data.exerciseDone !== null
          ? data.exerciseDone
            ? `Sí${data.exerciseDuration ? ` (${data.exerciseDuration}min)` : ''}`
            : 'No'
          : null,
      step: 3,
    },
    { label: '🍽️ Dieta', value: data.dietQuality !== null ? `${data.dietQuality}/10` : null, step: 4 },
    { label: '🎯 Foco', value: data.focusHours !== null ? `${data.focusHours}h` : null, step: 5 },
  ];

  return (
    <div className="w-full max-w-sm text-center space-y-6">
      <span className="text-5xl block">{'⭐'}</span>
      <h2 className="text-xl font-bold text-text-primary font-[Sora]">
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
            key={row.step}
            onClick={() => goTo(row.step)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors"
          >
            <span className="text-sm text-text-secondary">{row.label}</span>
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

export default function DailyCheckin({ onComplete, initialData }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<CheckinState>(() => {
    if (initialData) return { ...defaultState, ...initialData } as CheckinState;
    return { ...defaultState };
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load existing check-in for today
  useEffect(() => {
    if (!initialData) {
      api
        .getCheckinToday()
        .then((res) => {
          if (res.entry) setData({ ...defaultState, ...res.entry } as CheckinState);
          setStreak(res.streak);
        })
        .catch(() => {});
    }
  }, [initialData]);

  const update = useCallback(
    <K extends keyof CheckinState>(key: K, value: CheckinState[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  function next() {
    if (step < TOTAL_STEPS - 1) {
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
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== null && v !== '') payload[k] = v;
      }
      await api.submitCheckin(payload);
      setSaved(true);
      try {
        const res = await api.getCheckinToday();
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
          <span className="text-6xl block mb-4">{'🎉'}</span>
          <h2 className="text-2xl font-bold text-text-primary font-[Sora] mb-2">
            {'¡Check-in guardado!'}
          </h2>
          {streak > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-accent-amber font-mono"
            >
              {'🔥'} {streak} {streak === 1 ? 'dia' : 'dias'} seguidos
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  const variants = getSlideVariants(direction);

  return (
    <div className="flex flex-col min-h-[70vh]">
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
            animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        <span className="text-xs font-mono text-text-muted shrink-0 w-10 text-right">
          {step + 1}/{TOTAL_STEPS}
        </span>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="flex flex-col items-center"
          >
            {step === 0 && <StepSleep data={data} update={update} />}
            {step === 1 && <StepMood data={data} update={update} />}
            {step === 2 && <StepEnergy data={data} update={update} />}
            {step === 3 && <StepExercise data={data} update={update} />}
            {step === 4 && <StepDiet data={data} update={update} />}
            {step === 5 && <StepProductivity data={data} update={update} />}
            {step === 6 && <StepSummary data={data} update={update} goTo={goTo} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer button ── */}
      <div className="mt-6 pt-4 border-t border-white/[0.06]">
        {error && <p className="text-accent-coral text-sm text-center mb-3">{error}</p>}

        {step < TOTAL_STEPS - 1 ? (
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
