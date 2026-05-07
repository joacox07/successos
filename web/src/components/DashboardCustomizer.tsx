import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import type { GoalSummary } from '@/lib/api';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';
import { cn, categoryIcon, categoryColor, getIconForHabit } from '@/lib/utils';
import Icon from '@/components/Icon';

interface DashboardCustomizerProps {
  goals: GoalSummary[];
  isOpen: boolean;
  onClose: () => void;
}

export function DashboardCustomizer({ goals, isOpen, onClose }: DashboardCustomizerProps) {
  const { config, toggleGoalVisibility, setGoalOrder, toggleHabitPin, isGoalHidden, isHabitPinned } = useDashboardConfig();
  const { data: habitsData } = useApi(() => api.getHabits());
  const [activeTab, setActiveTab] = useState<'goals' | 'habits'>('goals');

  // Local ordered goals for drag-reorder (starts from config order or original order)
  const [orderedGoals, setOrderedGoals] = useState<GoalSummary[]>(() => {
    if (config.goalOrder.length === 0) return goals;
    return [...goals].sort((a, b) => {
      const ia = config.goalOrder.indexOf(a.id);
      const ib = config.goalOrder.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  });

  // Sync if goals prop changes
  useEffect(() => {
    if (goals.length > 0 && orderedGoals.length === 0) {
      setOrderedGoals(goals);
    }
  }, [goals]);

  const handleReorder = (newOrder: GoalSummary[]) => {
    setOrderedGoals(newOrder);
    setGoalOrder(newOrder.map(g => g.id));
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="customizer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Bottom sheet */}
          <motion.div
            key="customizer-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d12] border-t border-white/[0.1] rounded-t-3xl overflow-hidden"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-9 h-1 bg-white/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
              <h2 className="font-display text-base font-semibold text-text-primary">
                Personalizar dashboard
              </h2>
              <button
                onClick={onClose}
                className="text-xs font-semibold text-accent-mint px-3 py-1.5 rounded-xl bg-accent-mint/[0.1] hover:bg-accent-mint/20 transition-colors"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Listo
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 px-5 mb-3 flex-shrink-0">
              <button
                onClick={() => setActiveTab('goals')}
                className={cn(
                  'flex-1 py-2 text-[10px] font-mono uppercase tracking-widest rounded-xl transition-all duration-200',
                  activeTab === 'goals'
                    ? 'bg-accent-mint/[0.15] text-accent-mint'
                    : 'text-text-muted hover:text-text-secondary'
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Objetivos
              </button>
              <button
                onClick={() => setActiveTab('habits')}
                className={cn(
                  'flex-1 py-2 text-[10px] font-mono uppercase tracking-widest rounded-xl transition-all duration-200',
                  activeTab === 'habits'
                    ? 'bg-accent-mint/[0.15] text-accent-mint'
                    : 'text-text-muted hover:text-text-secondary'
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                Hábitos
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-5 pb-6" style={{ WebkitOverflowScrolling: 'touch' } as any}>

              {/* ── Goals tab ── */}
              {activeTab === 'goals' && (
                <div>
                  <p className="text-[10px] text-text-muted mb-3 font-mono">
                    Arrastrá para reordenar · tocá el ojo para ocultar
                  </p>
                  {orderedGoals.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-6">No hay objetivos activos</p>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={orderedGoals}
                      onReorder={handleReorder}
                      className="space-y-2"
                      style={{ listStyle: 'none', padding: 0, margin: 0 }}
                    >
                      {orderedGoals.map(goal => {
                        const hidden = isGoalHidden(goal.id);
                        return (
                          <Reorder.Item
                            key={goal.id}
                            value={goal}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-2xl border cursor-grab active:cursor-grabbing transition-all duration-200',
                              hidden
                                ? 'bg-white/[0.01] border-white/[0.04] opacity-40'
                                : 'bg-white/[0.03] border-white/[0.08]'
                            )}
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                            whileDrag={{ scale: 1.02, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                          >
                            {/* Drag handle */}
                            <div className="text-white/20 flex-shrink-0">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                                <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                              </svg>
                            </div>

                            {/* Category icon */}
                            <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                              <Icon name={categoryIcon(goal.category)} size={14} className={categoryColor(goal.category)} />
                            </div>

                            {/* Goal title */}
                            <span className={cn(
                              'flex-1 text-sm font-medium truncate',
                              hidden ? 'text-text-muted' : 'text-text-primary'
                            )}>
                              {goal.title}
                            </span>

                            {/* Progress */}
                            <span className="text-[10px] font-mono text-text-muted flex-shrink-0">
                              {Math.round(goal.progress)}%
                            </span>

                            {/* Eye toggle */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleGoalVisibility(goal.id); }}
                              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors"
                              style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                              {hidden ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/25">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                  <line x1="1" y1="1" x2="23" y2="23"/>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                              )}
                            </button>
                          </Reorder.Item>
                        );
                      })}
                    </Reorder.Group>
                  )}
                </div>
              )}

              {/* ── Habits tab ── */}
              {activeTab === 'habits' && (
                <div>
                  <p className="text-[10px] text-text-muted mb-3 font-mono">
                    Los hábitos fijados muestran su racha en el dashboard
                  </p>
                  {!habitsData || habitsData.habits.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-6">No hay hábitos configurados</p>
                  ) : (
                    <div className="space-y-2">
                      {habitsData.habits.map(habit => {
                        const pinned = isHabitPinned(habit.id);
                        return (
                          <button
                            key={habit.id}
                            onClick={() => toggleHabitPin(habit.id)}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 text-left',
                              pinned
                                ? 'bg-accent-mint/[0.08] border-accent-mint/30'
                                : 'bg-white/[0.03] border-white/[0.08]'
                            )}
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            <div className="flex-shrink-0 text-accent-mint">
                              <Icon name={getIconForHabit(habit.name, habit.category ?? null)} size={16} />
                            </div>
                            <span className={cn(
                              'flex-1 text-sm font-medium truncate',
                              pinned ? 'text-text-primary' : 'text-text-secondary'
                            )}>
                              {habit.name}
                            </span>
                            <div className={cn(
                              'w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
                              pinned
                                ? 'bg-accent-mint border-accent-mint'
                                : 'border-white/20'
                            )}>
                              {pinned && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
