import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, type Habit, type HabitsData } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, categoryIcon } from '@/lib/utils';
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
  const [newIsNegative, setNewIsNegative] = useState(false);
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

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState('');
  const [editIsNegative, setEditIsNegative] = useState(false);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);
  const [menuHabitId, setMenuHabitId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuHabitId(null);
    }
    if (menuHabitId !== null) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuHabitId]);

  function notifyHabitsChanged() {
    window.dispatchEvent(new CustomEvent('habits-changed'));
  }

  async function handleCreate() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await api.createHabit({
        name: newName.trim(),
        isNegative: newIsNegative,
      });
      setNewName('');
      setNewIsNegative(false);
      setShowForm(false);
      setLocalToday(null);
      refetch();
      notifyHabitsChanged();
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  }

  async function handleEditSave() {
    if (!editingHabit || !editName.trim()) return;
    try {
      await api.updateHabit(editingHabit.id, { name: editName.trim(), isNegative: editIsNegative });
      setEditingHabit(null);
      setEditName('');
      setLocalToday(null);
      refetch();
      notifyHabitsChanged();
    } catch {
      // silently fail
    }
  }

  async function handleDelete() {
    if (!deletingHabit) return;
    try {
      await api.deleteHabit(deletingHabit.id);
      setDeletingHabit(null);
      setLocalToday(null);
      refetch();
      notifyHabitsChanged();
    } catch {
      // silently fail
    }
  }

  return (
    <div className="space-y-4">
      {/* Loading (only first load) */}
      {loading && !data && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !data && (
        <div className="rounded-2xl border border-accent-coral/20 bg-accent-coral/5 p-5 text-center space-y-3">
          <p className="text-accent-coral text-sm">{error}</p>
          <button onClick={refetch} className="text-xs text-text-muted hover:text-text-primary transition-colors">
            Reintentar
          </button>
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
                className="glass-card rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.07] transition-colors group"
                onClick={() => onSelectHabit(habit)}
              >
                {/* Emoji */}
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', habit.isNegative ? 'bg-accent-coral/10' : 'bg-white/[0.04]')}>
                  <Icon
                    name={habit.isNegative ? 'x' : (habit.category ? categoryIcon(habit.category) : 'target')}
                    size={20}
                    className={habit.isNegative ? 'text-accent-coral' : 'text-accent-mint'}
                  />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate font-[Sora]">
                    {habit.name}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {habit.isNegative ? 'Evitación · ' : ''}{habit.frequency === 'daily' ? 'Diario' : habit.frequency}
                  </p>
                </div>

                {/* Actions menu */}
                <div className="relative shrink-0 flex items-center gap-1">
                  {/* Trash — always visible */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingHabit(habit);
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-accent-coral transition-all"
                    aria-label="Eliminar habito"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuHabitId(menuHabitId === habit.id ? null : habit.id);
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Opciones"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <circle cx="7" cy="3" r="1.2" />
                      <circle cx="7" cy="7" r="1.2" />
                      <circle cx="7" cy="11" r="1.2" />
                    </svg>
                  </button>
                  <AnimatePresence>
                    {menuHabitId === habit.id && (
                      <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-white/[0.08] bg-bg-card backdrop-blur-xl shadow-xl overflow-hidden"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingHabit(habit);
                            setEditName(habit.name);
                            setEditIsNegative(!!habit.isNegative);
                            setMenuHabitId(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-text-secondary hover:bg-white/[0.04] hover:text-text-primary transition-colors"
                        >
                          <Icon name="edit" size={14} />
                          Editar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingHabit(habit);
                            setMenuHabitId(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-accent-coral hover:bg-accent-coral/5 transition-colors"
                        >
                          <Icon name="trash" size={14} />
                          Eliminar
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Toggle circle */}
                <button
                  onClick={(e) => handleToggle(e, habit.id)}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200',
                    completed
                      ? habit.isNegative
                        ? 'bg-accent-coral shadow-[0_0_10px_rgba(248,113,113,0.3)]'
                        : 'bg-accent-mint shadow-[0_0_10px_rgba(74,222,128,0.3)]'
                      : 'bg-white/[0.06] border border-white/[0.12] hover:border-white/[0.2]'
                  )}
                  aria-label={completed ? 'Limpiar registro' : (habit.isNegative ? 'Marcar recaída' : 'Marcar éxito')}
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
                  <div className={cn('w-12 h-10 rounded-xl border border-white/[0.08] flex items-center justify-center shrink-0', newIsNegative ? 'bg-accent-coral/10 text-accent-coral' : 'bg-white/[0.06] text-accent-mint')}>
                    <Icon name={newIsNegative ? 'x' : 'clipboard'} size={18} />
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
                <button
                  type="button"
                  onClick={() => setNewIsNegative(v => !v)}
                  className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all', newIsNegative ? 'bg-accent-coral/10 text-accent-coral border border-accent-coral/20' : 'bg-white/[0.04] text-text-muted border border-white/[0.06] hover:text-text-secondary')}
                >
                  <Icon name={newIsNegative ? 'check' : 'x'} size={12} />
                  {newIsNegative ? 'Hábito de evitación (marcar = recaída)' : 'Marcar como hábito de evitación'}
                </button>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setNewName('');
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

      {/* Edit Modal */}
      <AnimatePresence>
        {editingHabit && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingHabit(null)} />
            <motion.div
              className="relative w-[90%] max-w-sm rounded-2xl border border-white/[0.08] bg-bg-card backdrop-blur-xl shadow-2xl p-5 space-y-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <h3 className="text-sm font-bold text-text-primary">Editar habito</h3>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-mint/40 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setEditIsNegative(v => !v)}
                className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all', editIsNegative ? 'bg-accent-coral/10 text-accent-coral border border-accent-coral/20' : 'bg-white/[0.04] text-text-muted border border-white/[0.06] hover:text-text-secondary')}
              >
                <Icon name={editIsNegative ? 'check' : 'x'} size={12} />
                {editIsNegative ? 'Hábito de evitación (marcar = recaída)' : 'Marcar como hábito de evitación'}
              </button>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingHabit(null)}
                  className="px-4 py-2 rounded-xl text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={!editName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-accent-mint/20 text-accent-mint hover:bg-accent-mint/30 transition-all"
                >
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deletingHabit && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingHabit(null)} />
            <motion.div
              className="relative w-[90%] max-w-sm rounded-2xl border border-white/[0.08] bg-bg-card backdrop-blur-xl shadow-2xl p-5 space-y-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-coral/15 flex items-center justify-center">
                  <Icon name="trash" size={18} className="text-accent-coral" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Eliminar habito</h3>
                  <p className="text-xs text-text-muted mt-0.5">{deletingHabit.name}</p>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                Se desactivara el habito y no aparecera mas en tu lista.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingHabit(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] text-text-secondary hover:bg-white/[0.08] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent-coral/20 text-accent-coral hover:bg-accent-coral/30 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
