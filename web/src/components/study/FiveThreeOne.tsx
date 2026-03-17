import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import Icon from '../Icon';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Phase {
  key: string;
  label: string;
  icon: string;
  durationSeconds: number;
  color: string;        // hex
  accentClass: string;  // tailwind text class
  glowClass: string;    // drop-shadow class
}

interface Props {
  onSessionComplete?: (result: { focusMinutes: number }) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PHASES: Phase[] = [
  {
    key: 'read',
    label: 'LECTURA',
    icon: 'book',
    durationSeconds: 5 * 60,
    color: 'rgb(var(--color-accent-primary))',
    accentClass: 'text-accent-mint',
    glowClass: 'drop-shadow-[0_0_12px_rgba(74,222,128,0.5)]',
  },
  {
    key: 'summarize',
    label: 'RESUMEN',
    icon: 'edit',
    durationSeconds: 3 * 60,
    color: 'rgb(var(--color-accent-secondary))',
    accentClass: 'text-accent-violet',
    glowClass: 'drop-shadow-[0_0_12px_rgba(167,139,250,0.5)]',
  },
  {
    key: 'review',
    label: 'REPASO',
    icon: 'brain',
    durationSeconds: 1 * 60,
    color: 'rgb(var(--color-accent-tertiary))',
    accentClass: 'text-accent-coral',
    glowClass: 'drop-shadow-[0_0_12px_rgba(251,113,133,0.5)]',
  },
];

const RADIUS = 70;
const STROKE = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE) * 2;

// ─── Component ──────────────────────────────────────────────────────────────

export default function FiveThreeOne({ onSessionComplete }: Props) {
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [allDone, setAllDone] = useState(false);

  const startTimeRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const rafRef = useRef<number>(0);

  const currentPhase = PHASES[currentPhaseIdx];

  // ── Tick loop ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const now = Date.now();
      const delta = (now - startTimeRef.current) / 1000;
      const total = elapsedBeforePauseRef.current + delta;
      setElapsed(total);
      rafRef.current = requestAnimationFrame(tick);
    };

    startTimeRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  // ── Phase complete check ──────────────────────────────────────────────────

  const advancePhase = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setRunning(false);

    const newCompleted = [...completedPhases, currentPhaseIdx];
    setCompletedPhases(newCompleted);

    if (currentPhaseIdx < PHASES.length - 1) {
      // Move to next phase after a brief pause
      setElapsed(0);
      elapsedBeforePauseRef.current = 0;
      setTimeout(() => {
        setCurrentPhaseIdx((i) => i + 1);
        startTimeRef.current = Date.now();
        setRunning(true);
      }, 600);
    } else {
      // All done
      setAllDone(true);
      onSessionComplete?.({ focusMinutes: 9 });
    }
  }, [currentPhaseIdx, completedPhases, onSessionComplete]);

  useEffect(() => {
    if (!running) return;
    if (elapsed >= currentPhase.durationSeconds) {
      advancePhase();
    }
  }, [elapsed, running, currentPhase.durationSeconds, advancePhase]);

  // ── Controls ──────────────────────────────────────────────────────────────

  function handleStartPause() {
    if (allDone) {
      // Reset everything
      setAllDone(false);
      setCurrentPhaseIdx(0);
      setCompletedPhases([]);
      setElapsed(0);
      elapsedBeforePauseRef.current = 0;
      return;
    }

    if (running) {
      cancelAnimationFrame(rafRef.current);
      elapsedBeforePauseRef.current = elapsed;
      setRunning(false);
    } else {
      startTimeRef.current = Date.now();
      setRunning(true);
    }
  }

  function handleReset() {
    cancelAnimationFrame(rafRef.current);
    setRunning(false);
    setElapsed(0);
    setCurrentPhaseIdx(0);
    setCompletedPhases([]);
    setAllDone(false);
    elapsedBeforePauseRef.current = 0;
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const dur = currentPhase.durationSeconds;
  const remaining = Math.max(dur - elapsed, 0);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const progress = dur > 0 ? Math.min(elapsed / dur, 1) : 0;
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {PHASES.map((p, i) => (
          <div
            key={p.key}
            className={cn(
              'w-3 h-3 rounded-full transition-all duration-300',
              completedPhases.includes(i)
                ? 'scale-100'
                : i === currentPhaseIdx && running
                  ? 'scale-110 animate-pulse'
                  : 'bg-white/[0.12]',
            )}
            style={
              completedPhases.includes(i)
                ? { backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}60` }
                : i === currentPhaseIdx && (running || elapsed > 0)
                  ? { backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}40` }
                  : undefined
            }
          />
        ))}
      </div>

      {/* Phase cards */}
      <div className="w-full max-w-sm space-y-3">
        <AnimatePresence mode="wait">
          {PHASES.map((p, i) => {
            const isActive = i === currentPhaseIdx && !allDone;
            const isCompleted = completedPhases.includes(i);

            return (
              <motion.div
                key={p.key}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: isActive ? 1 : isCompleted ? 0.6 : 0.3,
                  y: 0,
                  scale: isActive ? 1 : 0.95,
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'rounded-2xl border bg-white/[0.04] backdrop-blur-xl overflow-hidden transition-colors',
                  isActive ? 'border-white/[0.12]' : 'border-white/[0.04]',
                )}
              >
                {/* Phase header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Icon name={p.icon} size={20} />
                  <span
                    className={cn(
                      'text-sm font-semibold tracking-wider',
                      isCompleted ? 'line-through opacity-60' : '',
                      p.accentClass,
                    )}
                  >
                    {p.label}
                  </span>
                  <span className="ml-auto text-xs text-text-muted font-mono">
                    {Math.floor(p.durationSeconds / 60)}:00
                  </span>
                  {isCompleted && (
                    <svg className="w-4 h-4 text-accent-mint" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* Active timer */}
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center pb-5"
                  >
                    {/* Mini ring */}
                    <div className="relative my-2">
                      <svg width={SIZE} height={SIZE} className="rotate-[-90deg]">
                        <circle
                          cx={RADIUS + STROKE}
                          cy={RADIUS + STROKE}
                          r={RADIUS}
                          fill="none"
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth={STROKE}
                        />
                        <motion.circle
                          cx={RADIUS + STROKE}
                          cy={RADIUS + STROKE}
                          r={RADIUS}
                          fill="none"
                          stroke={p.color}
                          strokeWidth={STROKE}
                          strokeLinecap="round"
                          strokeDasharray={CIRCUMFERENCE}
                          strokeDashoffset={offset}
                          style={{ filter: `drop-shadow(0 0 6px ${p.color}40)` }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-3xl font-bold text-text-primary">
                          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                        </span>
                        <span className={cn('text-[10px] font-semibold tracking-widest mt-1', p.accentClass, p.glowClass)}>
                          {p.label}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* All done message */}
      {allDone && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold text-accent-mint drop-shadow-[0_0_12px_rgba(74,222,128,0.4)]"
        >
          Sesion 5-3-1 completada
        </motion.p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleStartPause}
          className={cn(
            'px-8 py-3 rounded-2xl font-semibold text-sm transition-all',
            'bg-white/[0.04] backdrop-blur-xl border',
            running
              ? 'border-accent-amber/30 text-accent-amber'
              : allDone
                ? 'border-accent-mint/30 text-accent-mint'
                : 'border-accent-violet/30 text-accent-violet',
          )}
        >
          {running ? 'Pausar' : allDone ? 'Reiniciar' : elapsed > 0 ? 'Continuar' : 'Empezar'}
        </button>

        {!allDone && (elapsed > 0 || running) && (
          <button
            onClick={handleReset}
            className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.36-5.36M20 15a9 9 0 01-15.36 5.36" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
