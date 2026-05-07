import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { playTone, unlockAudio, notify, requestNotificationPermission } from '../../lib/audio';

// ─── Sound ───────────────────────────────────────────────────────────────────

const SOUND_FOCUS_DONE = () => playTone([
  { freq: 880, duration: 0.35 },
  { freq: 660, duration: 0.35, delay: 0.3 },
  { freq: 550, duration: 0.5, delay: 0.6 },
]);

const SOUND_BREAK_DONE = () => playTone([
  { freq: 550, duration: 0.3 },
  { freq: 880, duration: 0.5, delay: 0.25 },
]);

const SOUND_SESSION_DONE = () => playTone([
  { freq: 440, duration: 0.3 },
  { freq: 550, duration: 0.3, delay: 0.25 },
  { freq: 660, duration: 0.3, delay: 0.5 },
  { freq: 880, duration: 0.6, delay: 0.75 },
]);

// ─── Types ──────────────────────────────────────────────────────────────────

type TimerPhase = 'IDLE' | 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  totalCycles: number;
}

interface SessionResult {
  focusMinutes: number;
  breakMinutes: number;
  cyclesCompleted: number;
}

interface Props {
  onSessionComplete?: (result: SessionResult) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULTS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  totalCycles: 4,
};

const STORAGE_KEY = 'pomodoro_settings';
const RADIUS = 90;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE) * 2;

function loadSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function saveSettings(s: PomodoroSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PomodoroTimer({ onSessionComplete }: Props) {
  const [settings, setSettings] = useState<PomodoroSettings>(loadSettings);
  const [draftSettings, setDraftSettings] = useState<Record<string, string>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [phase, setPhase] = useState<TimerPhase>('IDLE');
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(1);
  const [elapsed, setElapsed] = useState(0);

  // Accumulated totals for the session
  const totalFocusRef = useRef(0);
  const totalBreakRef = useRef(0);

  // Date.now() delta pattern
  const startTimeRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);
  const rafRef = useRef<number>(0);
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phaseDuration = useCallback(() => {
    switch (phase) {
      case 'FOCUS': return settings.focusMinutes * 60;
      case 'SHORT_BREAK': return settings.shortBreakMinutes * 60;
      case 'LONG_BREAK': return settings.longBreakMinutes * 60;
      default: return settings.focusMinutes * 60;
    }
  }, [phase, settings]);

  // ── Tick loop using Date.now() delta ──────────────────────────────────────

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

  // ── Check if phase is complete ────────────────────────────────────────────

  useEffect(() => {
    if (!running) return;
    const dur = phaseDuration();
    if (elapsed >= dur) {
      advancePhase();
    }
  }, [elapsed, running]);

  const advancePhase = useCallback(() => {
    const dur = phaseDuration();

    if (phase === 'FOCUS') {
      SOUND_FOCUS_DONE();
      notify('¡Pomodoro terminado!', 'Tomá un descanso merecido.');
      totalFocusRef.current += dur / 60;
      if (cycle >= settings.totalCycles) {
        resetTimerState();
        setPhase('LONG_BREAK');
        setRunning(true);
        startTimeRef.current = Date.now();
        elapsedBeforePauseRef.current = 0;
        scheduleNotif(settings.longBreakMinutes * 60 * 1000, '¡Descanso largo terminado!', 'Sesión completa. Excelente trabajo.');
      } else {
        resetTimerState();
        setPhase('SHORT_BREAK');
        setRunning(true);
        startTimeRef.current = Date.now();
        elapsedBeforePauseRef.current = 0;
        scheduleNotif(settings.shortBreakMinutes * 60 * 1000, '¡Descanso terminado!', 'A focalizarse.');
      }
    } else if (phase === 'SHORT_BREAK') {
      SOUND_BREAK_DONE();
      notify('¡Descanso terminado!', 'A focalizarse.');
      totalBreakRef.current += dur / 60;
      resetTimerState();
      setCycle((c) => c + 1);
      setPhase('FOCUS');
      setRunning(true);
      startTimeRef.current = Date.now();
      elapsedBeforePauseRef.current = 0;
      scheduleNotif(settings.focusMinutes * 60 * 1000, '¡Pomodoro terminado!', 'Tomá un descanso merecido.');
    } else if (phase === 'LONG_BREAK') {
      SOUND_SESSION_DONE();
      notify('¡Sesión completa!', 'Excelente trabajo hoy.');
      cancelNotif();
      totalBreakRef.current += dur / 60;
      setRunning(false);
      cancelAnimationFrame(rafRef.current);
      onSessionComplete?.({
        focusMinutes: totalFocusRef.current,
        breakMinutes: totalBreakRef.current,
        cyclesCompleted: settings.totalCycles,
      });
      resetAll();
    }
  }, [phase, cycle, settings, phaseDuration, onSessionComplete]);

  function scheduleNotif(msRemaining: number, title: string, body: string) {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    notifTimeoutRef.current = setTimeout(() => notify(title, body), msRemaining);
  }

  function cancelNotif() {
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
  }

  function resetTimerState() {
    cancelAnimationFrame(rafRef.current);
    setElapsed(0);
    elapsedBeforePauseRef.current = 0;
  }

  function resetAll() {
    cancelAnimationFrame(rafRef.current);
    setRunning(false);
    setElapsed(0);
    setPhase('IDLE');
    setCycle(1);
    elapsedBeforePauseRef.current = 0;
    totalFocusRef.current = 0;
    totalBreakRef.current = 0;
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  function handlePlayPause() {
    unlockAudio();
    requestNotificationPermission();
    if (phase === 'IDLE') {
      setPhase('FOCUS');
      setElapsed(0);
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = Date.now();
      setRunning(true);
      scheduleNotif(settings.focusMinutes * 60 * 1000, '¡Pomodoro terminado!', 'Tomá un descanso merecido.');
    } else if (running) {
      // Pause
      cancelAnimationFrame(rafRef.current);
      elapsedBeforePauseRef.current = elapsed;
      setRunning(false);
      cancelNotif();
    } else {
      // Resume
      startTimeRef.current = Date.now();
      setRunning(true);
      scheduleNotif((phaseDuration() - elapsed) * 1000, '¡Tiempo!', 'El timer terminó.');
    }
  }

  function handleSkip() {
    if (phase === 'IDLE') return;
    advancePhase();
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const dur = phaseDuration();
  const remaining = Math.max(dur - elapsed, 0);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const progress = dur > 0 ? Math.min(elapsed / dur, 1) : 0;
  const offset = CIRCUMFERENCE * (1 - progress);

  const ringColor = phase === 'FOCUS' || phase === 'IDLE'
    ? 'rgb(var(--color-accent-primary))'
    : phase === 'SHORT_BREAK'
      ? 'rgb(var(--color-accent-secondary))'
      : 'rgb(var(--color-accent-tertiary))';

  const phaseLabel = phase === 'FOCUS' ? 'FOCO'
    : phase === 'SHORT_BREAK' ? 'DESCANSO'
    : phase === 'LONG_BREAK' ? 'DESCANSO LARGO'
    : 'LISTO';

  const phaseGlow = phase === 'FOCUS' || phase === 'IDLE'
    ? 'text-accent-mint drop-shadow-[0_0_12px_rgba(74,222,128,0.5)]'
    : phase === 'SHORT_BREAK'
      ? 'text-accent-violet drop-shadow-[0_0_12px_rgba(167,139,250,0.5)]'
      : 'text-accent-coral drop-shadow-[0_0_12px_rgba(251,113,133,0.5)]';

  const buttonBorder = phase === 'SHORT_BREAK'
    ? 'border-accent-violet/40 shadow-[0_0_16px_rgba(167,139,250,0.15)]'
    : phase === 'LONG_BREAK'
      ? 'border-accent-coral/40 shadow-[0_0_16px_rgba(251,113,133,0.15)]'
      : 'border-accent-mint/40 shadow-[0_0_16px_rgba(74,222,128,0.15)]';

  const buttonIconColor = phase === 'SHORT_BREAK'
    ? 'text-accent-violet'
    : phase === 'LONG_BREAK'
      ? 'text-accent-coral'
      : 'text-accent-mint';

  function handleSettingChange(key: keyof PomodoroSettings, val: string) {
    setDraftSettings((d) => ({ ...d, [key]: val }));
  }

  function handleSettingBlur(key: keyof PomodoroSettings) {
    const raw = draftSettings[key];
    if (raw === undefined) return;
    const num = parseInt(raw, 10);
    const next = { ...settings, [key]: num >= 1 ? num : settings[key] };
    setSettings(next);
    saveSettings(next);
    setDraftSettings((d) => { const c = { ...d }; delete c[key]; return c; });
  }

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
            stroke="currentColor"
            className="text-border-primary"
            strokeWidth={STROKE}
          />
          {/* Progress ring */}
          <motion.circle
            cx={RADIUS + STROKE}
            cy={RADIUS + STROKE}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 8px ${ringColor}40)` }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-bold text-text-primary tracking-tight">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span className={cn('text-[10px] font-display font-bold tracking-[0.2em] mt-2', phaseGlow)}>
            {phaseLabel}
          </span>
        </div>
      </div>

      {/* Cycle counter */}
      <p className="text-xs text-text-muted font-display font-medium tracking-wide uppercase">
        Ciclo {cycle}/{settings.totalCycles}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Play / Pause */}
        <button
          onClick={handlePlayPause}
          className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center transition-all',
            'bg-bg-card backdrop-blur-xl border border-border-primary shadow-sm shadow-border-primary',
            running && buttonBorder,
          )}
        >
          {running ? (
            <svg className={cn('w-6 h-6', buttonIconColor)} fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className={cn('w-6 h-6', buttonIconColor)} fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={resetAll}
          className="w-12 h-12 rounded-2xl flex items-center justify-center bg-bg-card backdrop-blur-xl border border-border-primary text-text-secondary hover:text-text-primary transition-colors hover:bg-bg-card-hover"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115.36-5.36M20 15a9 9 0 01-15.36 5.36" />
          </svg>
        </button>

        {/* Skip */}
        <button
          onClick={handleSkip}
          disabled={phase === 'IDLE'}
          className="w-12 h-12 rounded-2xl flex items-center justify-center bg-bg-card backdrop-blur-xl border border-border-primary text-text-secondary hover:text-text-primary transition-colors hover:bg-bg-card-hover disabled:opacity-30"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 4l10 8-10 8V4zM19 5v14h-2V5h2z" />
          </svg>
        </button>

        {/* Settings gear */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center bg-bg-card backdrop-blur-xl border border-border-primary text-text-secondary hover:text-text-primary transition-colors hover:bg-bg-card-hover',
            showSettings && 'border-accent-violet/40 text-accent-violet',
          )}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="w-full max-w-xs rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-text-secondary tracking-wider uppercase">
            Configuracion
          </p>
          {([
            ['focusMinutes', 'Foco (min)'],
            ['shortBreakMinutes', 'Descanso corto (min)'],
            ['longBreakMinutes', 'Descanso largo (min)'],
            ['totalCycles', 'Ciclos'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-text-muted">{label}</span>
              <input
                type="text"
                inputMode="numeric"
                value={key in draftSettings ? draftSettings[key] : String(settings[key])}
                onChange={(e) => handleSettingChange(key, e.target.value)}
                onBlur={() => handleSettingBlur(key)}
                className="w-16 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1 text-sm text-text-primary font-mono text-center outline-none focus:border-accent-mint/40"
              />
            </label>
          ))}
        </motion.div>
      )}
    </div>
  );
}
