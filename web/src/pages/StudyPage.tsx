import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PomodoroTimer from '../components/study/PomodoroTimer';
import FlowTimer from '../components/study/FlowTimer';
import FiveThreeOne from '../components/study/FiveThreeOne';
import Flashcards from '../components/study/Flashcards';
import SpacedRepetition from '../components/study/SpacedRepetition';
import StudyStats from '../components/study/StudyStats';
import { api } from '../lib/api';
import type { CreateStudySession } from '../lib/api';
import { cn } from '../lib/utils';
import Icon from '../components/Icon';

// ─── Types ──────────────────────────────────────────────────────────────────

type StudyMethod = 'pomodoro' | 'flow' | '531' | 'flashcards' | 'repaso';

interface MethodOption {
  key: StudyMethod;
  label: string;
  icon: string;
  activeBorder: string;
}

const METHODS: MethodOption[] = [
  { key: 'pomodoro', label: 'Pomodoro', icon: 'clock', activeBorder: 'border-accent-coral' },
  { key: 'flow', label: 'Flow', icon: 'brain', activeBorder: 'border-accent-mint' },
  { key: '531', label: '5-3-1', icon: 'lightning', activeBorder: 'border-accent-violet' },
  { key: 'flashcards', label: 'Flashcards', icon: 'clipboard', activeBorder: 'border-accent-amber' },
  { key: 'repaso', label: 'Repaso', icon: 'calendar', activeBorder: 'border-accent-mint' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function StudyPage() {
  const [method, setMethod] = useState<StudyMethod>('pomodoro');
  const [todayMinutes, setTodayMinutes] = useState(0);

  // ── Save session to API ─────────────────────────────────────────────────

  const saveSession = useCallback(async (
    methodName: string,
    data: { focusMinutes: number; breakMinutes?: number; cyclesCompleted?: number },
  ) => {
    const session: CreateStudySession = {
      method: methodName,
      focusMinutes: data.focusMinutes,
      breakMinutes: data.breakMinutes,
      cyclesCompleted: data.cyclesCompleted,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    };

    try {
      await api.createStudySession(session);
      setTodayMinutes((prev) => prev + Math.round(data.focusMinutes));
    } catch (err) {
      console.error('Error guardando sesion:', err);
    }
  }, []);

  const handlePomodoroComplete = useCallback(
    (result: { focusMinutes: number; breakMinutes: number; cyclesCompleted: number }) => {
      saveSession('pomodoro', result);
    },
    [saveSession],
  );

  const handleFlowComplete = useCallback(
    (result: { focusMinutes: number }) => {
      saveSession('flow', result);
    },
    [saveSession],
  );

  const handleFiveThreeOneComplete = useCallback(
    (result: { focusMinutes: number }) => {
      saveSession('531', result);
    },
    [saveSession],
  );

  const handleFlashcardsComplete = useCallback(
    (result: { focusMinutes: number; cardsReviewed: number }) => {
      saveSession('flashcards', { focusMinutes: result.focusMinutes });
    },
    [saveSession],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-12"
      >
        <h1 className="text-3xl sm:text-5xl font-display text-text-primary tracking-tighter uppercase leading-none">
          COGNITIVE_HUB
        </h1>
        <div className="flex items-center gap-3 mt-4">
          <div className="h-0.5 w-16 bg-accent-mint" />
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.4em]">NEURAL PERFORMANCE TRACKER</p>
        </div>
        {todayMinutes > 0 && (
          <div className="mt-6 border-l border-accent-mint pl-4">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">SESSION_LOG</p>
            <p className="text-2xl font-display text-white mt-1 uppercase">
              {todayMinutes} MIN <span className="text-xs opacity-40">COMMITTED_TODAY</span>
            </p>
          </div>
        )}
      </motion.div>

      {/* Method selector — sharp grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 sm:grid-cols-5 gap-px bg-white/[0.05] border border-white/[0.05] mb-12"
      >
        {METHODS.map((m) => {
          const active = method === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={cn(
                'flex flex-col items-center justify-center gap-2 py-4 transition-all duration-300 relative group overflow-hidden',
                active
                  ? 'bg-accent-mint text-bg-primary shadow-[0_0_15px_rgba(var(--color-accent-primary),0.3)]'
                  : 'bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-card-hover',
              )}
            >
              <Icon name={m.icon} size={16} />
              <span className="text-[8px] font-mono font-bold tracking-widest uppercase">{m.label}</span>
              {active && (
                <div className="absolute top-0 left-0 w-full h-0.5 bg-text-primary/40" />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Main timer area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={method}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
          className="mb-8"
        >
          {method === 'pomodoro' && (
            <PomodoroTimer onSessionComplete={handlePomodoroComplete} />
          )}

          {method === 'flow' && (
            <FlowTimer onSessionComplete={handleFlowComplete} />
          )}

          {method === '531' && (
            <FiveThreeOne onSessionComplete={handleFiveThreeOneComplete} />
          )}

          {method === 'flashcards' && (
            <Flashcards onSessionComplete={handleFlashcardsComplete} />
          )}

          {method === 'repaso' && (
            <SpacedRepetition />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Study Stats */}
      <StudyStats />
    </div>
  );
}
