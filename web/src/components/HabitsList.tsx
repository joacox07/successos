import { useState } from 'react';
import { motion } from 'framer-motion';
import { api, type Habit, type HabitsData } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import Icon from './Icon';

interface HabitsListProps {
  onSelectHabit: (habit: Habit) => void;
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-4 flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
        <div className="h-3 w-1/3 rounded bg-white/[0.06]" />
      </div>
      <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
    </div>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export default function HabitsList({ onSelectHabit }: HabitsListProps) {
  const { data, loading, error, refetch } = useApi<HabitsData>(() => api.getHabits());
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [creating, setCreating] = useState(false);

  // Optimistic local state for today's completions
  const [localToday, setLocalToday] = useState<Record<number, boolean> | null>(null);
  const today = localToday ?? data?.today ?? {};

  // Sync localToday when data arrives
  if (data && localToday === null) {
    // Will be set on first toggle
  }

  async function handleToggle(e: React.MouseEvent, habitId: number) {
    e.stopPropagation();
    if (togglingIds.has(habitId)) return;

    // Optimistic update
    const current = today[habitId] ?? false;
    setLocalToday({ ...today, [habitId]: !current });
    setTogglingIds((prev) => new Set(prev).add(habitId));

    try {
      await api.toggleHabit(habitId);
    } catch {
      // Revert on error
      setLocalToday({ ...today, [habitId]: current });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  }

  async function handleCreate() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await api.createHabit({
        name: newName.trim(),
        emoji: newEmoji.trim() || undefined,
      });
      setNewName('');
      setNewEmoji('');
      setShowForm(false);
      setLocalToday(null);
      refetch();
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-accent-coral/20 bg-accent-coral/5 p-5 text-center">
          <p className="text-accent-coral text-sm">{error}</p>
        </div>
      )}

      {/* Habit rows */}
      {data && (
        <motion.div
          className="space-y-3"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {data.habits.map((habit) => {
            const completed = today[habit.id] ?? false;
            return (
              <motion.div
                key={habit.id}
                variants={item}
                className="glass-card rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.07] transition-colors"
                onClick={() => onSelectHabit(habit)}
              >
                {/* Emoji */}
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 text-accent-mint">
                  <Icon name="clipboard" size={20} />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate font-[Sora]">
                    {habit.name}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {habit.frequency === 'daily' ? 'Diario' : habit.frequency}
                  </p>
                </div>

                {/* Toggle circle */}
                <button
                  onClick={(e) => handleToggle(e, habit.id)}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200',
                    completed
                      ? 'bg-accent-mint shadow-[0_0_10px_rgba(74,222,128,0.3)]'
                      : 'bg-white/[0.06] border border-white/[0.12] hover:border-white/[0.2]'
                  )}
                  aria-label={completed ? 'Desmarcar' : 'Marcar como hecho'}
                >
                  {completed && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="text-bg-primary"
                    >
                      <path
                        d="M2.5 7.5L5.5 10.5L11.5 3.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </motion.div>
            );
          })}

          {/* Empty state */}
          {data.habits.length === 0 && (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-8 text-center"
            >
              <div className="flex justify-center mb-3 text-accent-mint"><Icon name="refresh" size={32} /></div>
              <p className="text-sm text-text-secondary">
                Todavia no tenes habitos. Agrega uno para empezar a trackear.
              </p>
            </motion.div>
          )}

          {/* Add habit button / form */}
          <motion.div variants={item}>
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full rounded-2xl border-2 border-dashed border-white/[0.08] p-4 text-center hover:border-white/[0.15] transition-colors"
              >
                <span className="text-sm text-text-muted">+ Agregar habito</span>
              </button>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="w-12 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-accent-mint shrink-0">
                    <Icon name="clipboard" size={18} />
                  </div>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre del habito..."
                    className="flex-1 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-mint/40 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setNewName('');
                      setNewEmoji('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                    className={cn(
                      'px-4 py-2 rounded-xl text-xs font-medium transition-all',
                      newName.trim()
                        ? 'bg-accent-mint/20 text-accent-mint hover:bg-accent-mint/30'
                        : 'bg-white/[0.04] text-text-muted cursor-not-allowed'
                    )}
                  >
                    {creating ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
