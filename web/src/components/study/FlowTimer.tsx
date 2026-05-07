import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { playTone, unlockAudio, notify, requestNotificationPermission } from '../../lib/audio';

// ─── Sound ───────────────────────────────────────────────────────────────────

const SOUND_MILESTONE = () => playTone([{ freq: 880, duration: 0.5 }]);

const SOUND_COMPLETE = () => playTone([
  { freq: 440, duration: 0.3 },
  { freq: 550, duration: 0.3, delay: 0.25 },
  { freq: 660, duration: 0.3, delay: 0.5 },
  { freq: 880, duration: 0.6, delay: 0.75 },
]);

// ─── Constants ──────────────────────────────────────────────────────────────

const RADIUS = 90;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE) * 2;
const TARGET_MINUTES = 90;
const TARGET_SECONDS = TARGET_MINUTES * 60;

const MILESTONES = [
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '60m' },
  { minutes: 90, label: '90m' },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  onSessionComplete?: (result: { focusMinutes: number }) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FlowTimer({ onSessionComplete }: Props) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [finished, setFinished] = useState(false);

  const startTimeRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const rafRef = useRef<number>(0);
  const reachedMilestonesRef = useRef(new Set<number>());

  // ── visibilitychange: sync elapsed when returning from background ─────────

  useEffect(() => {
    const onVisible = () => {
      if (document.hidden || !running) return;
      const total = elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current) / 1000;
      setElapsed(total);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [running]);

  // ── Tick loop using Date.now() delta ──────────────────────────────────────

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const now = Date.now();
      const delta = (now - startTimeRef.current) / 1000;
      const total = elapsedBeforePauseRef.current + delta;
      setElapsed(total);

      // Check milestones
      for (const m of MILESTONES) {
        const thresholdSecs = m.minutes * 60;
        if (total >= thresholdSecs && !reachedMilestonesRef.current.has(m.minutes)) {
          reachedMilestonesRef.current.add(m.minutes);
          if (m.minutes === TARGET_MINUTES) {
            SOUND_COMPLETE();
            notify('¡90 minutos de flow!', 'Increíble. Tomá un descanso.');
          } else {
            SOUND_MILESTONE();
            notify(`¡${m.minutes} minutos de flow!`, 'Seguí así.');
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    startTimeRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  // ── Controls ──────────────────────────────────────────────────────────────

  function handleStart() {
    unlockAudio();
    requestNotificationPermission();
    if (finished) {
      // Reset for new session
      setFinished(false);
      setElapsed(0);
      elapsedBeforePauseRef.current = 0;
      reachedMilestonesRef.current = new Set();
    }
    startTimeRef.current = Date.now();
    setRunning(true);
  }

  function handleStop() {
    cancelAnimationFrame(rafRef.current);
    elapsedBeforePauseRef.current = elapsed;
    setRunning(false);
    setFinished(true);
  }

  function handleSave() {
    const focusMinutes = Math.round((elapsed / 60) * 10) / 10;
    onSessionComplete?.({ focusMinutes });
    // Reset
    setElapsed(0);
    setFinished(false);
    elapsedBeforePauseRef.current = 0;
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const progress = Math.min(elapsed / TARGET_SECONDS, 1);
  const offset = CIRCUMFERENCE * (1 - progress);

  const MINT = 'rgb(var(--color-accent-primary))';

  return (
    <div className="flex flex-col items-center gap-6">
      {/* SVG Ring */}
      <div className="relative">
        <svg width={SIZE} height={SIZE} className="rotate-[-90deg]">
          {/* Background ring */}
          <circle
            cx={RADIUS + STROKE}
            cy={RADIUS + STROKE}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
          />

          {/* Milestone markers */}
          {MILESTONES.map((m) => {
            const angle = (m.minutes / TARGET_MINUTES) * 360;
            const rad = (angle * Math.PI) / 180;
            const cx = RADIUS + STROKE + Math.cos(rad) * RADIUS;
            const cy = RADIUS + STROKE + Math.sin(rad) * RADIUS;
            const reached = elapsed >= m.minutes * 60;
            return (
              <circle
                key={m.minutes}
                cx={cx}
                cy={cy}
                r={4}
                fill={reached ? MINT : 'rgba(255,255,255,0.15)'}
                style={reached ? { filter: `drop-shadow(0 0 4px ${MINT}60)` } : undefined}
              />
            );
          })}

          {/* Progress ring */}
          <motion.circle
            cx={RADIUS + STROKE}
            cy={RADIUS + STROKE}
            r={RADIUS}
            fill="none"
            stroke={MINT}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 8px ${MINT}40)` }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-bold text-text-primary tracking-tight">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span className="text-[10px] font-display font-bold tracking-[0.2em] mt-2 text-accent-mint drop-shadow-[0_0_12px_rgba(74,222,128,0.3)] uppercase">
            MODO FLOW
          </span>
        </div>
      </div>

      {/* Milestone labels */}
      <div className="flex items-center gap-4">
        {MILESTONES.map((m) => {
          const reached = elapsed >= m.minutes * 60;
          return (
            <span
              key={m.minutes}
              className={cn(
                'text-[10px] font-mono font-bold tracking-widest transition-colors',
                reached ? 'text-accent-mint' : 'text-text-muted/40',
              )}
            >
              {m.label}
            </span>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!running && !finished && (
          <button
            onClick={handleStart}
            className={cn(
              'px-8 py-3 rounded-2xl font-semibold text-sm transition-all',
              'bg-white/[0.04] backdrop-blur-xl border border-accent-mint/30',
              'text-accent-mint hover:border-accent-mint/50',
              'shadow-[0_0_16px_rgba(74,222,128,0.1)]',
            )}
          >
            Empezar
          </button>
        )}

        {running && (
          <button
            onClick={handleStop}
            className={cn(
              'px-8 py-3 rounded-2xl font-semibold text-sm transition-all',
              'bg-white/[0.04] backdrop-blur-xl border border-accent-coral/30',
              'text-accent-coral hover:border-accent-coral/50',
            )}
          >
            Parar
          </button>
        )}

        {finished && !running && (
          <motion.button
            onClick={handleSave}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'px-8 py-3 rounded-2xl font-semibold text-sm transition-all',
              'bg-accent-mint/10 backdrop-blur-xl border border-accent-mint/30',
              'text-accent-mint hover:bg-accent-mint/20',
              'shadow-[0_0_20px_rgba(74,222,128,0.15)]',
            )}
          >
            Termine — Guardar
          </motion.button>
        )}
      </div>
    </div>
  );
}
