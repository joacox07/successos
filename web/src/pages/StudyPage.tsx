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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-text-primary">Estudio</h1>
        {todayMinutes > 0 && (
          <p className="text-sm text-text-muted mt-1">
            <span className="font-mono text-accent-mint">{todayMinutes} min</span> de foco hoy
          </p>
        )}
      </motion.div>

      {/* Method selector — horizontal scroll */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none -mx-4 px-4"
      >
        {METHODS.map((m) => {
          const active = method === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all shrink-0',
                'bg-white/[0.04] backdrop-blur-xl border',
                active
                  ? cn(m.activeBorder, 'text-text-primary shadow-lg')
                  : 'border-white/[0.06] text-text-muted hover:text-text-secondary',
              )}
            >
              <Icon name={m.icon} size={16} />
              <span>{m.label}</span>
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
