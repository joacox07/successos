import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api, type GoalsData, type Habit } from '@/lib/api';
import { cn, categoryIcon, categoryColor } from '@/lib/utils';
import Icon from '@/components/Icon';
import HabitsList from '@/components/HabitsList';
import HabitCalendar from '@/components/HabitCalendar';

type Tab = 'objetivos' | 'habitos';
type GoalStatus = 'active' | 'paused' | 'completed';

const CATEGORIES = [
  { value: 'negocio', label: 'Negocio' },
  { value: 'salud', label: 'Salud' },
  { value: 'personal', label: 'Personal' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'relaciones', label: 'Relaciones' },
  { value: 'educacion', label: 'Educacion' },
] as const;

const PRIORITIES = [1, 2, 3, 4, 5] as const;

interface GoalFormData {
  title: string;
  category: string;
  description: string;
  metric: string;
  targetValue: string;
  unit: string;
  deadline: string;
  priority: number;
}

const emptyForm: GoalFormData = {
  title: '',
  category: 'personal',
  description: '',
  metric: '',
  targetValue: '',
  unit: '',
  deadline: '',
  priority: 3,
};

type GoalFull = GoalsData['goals'][number];

function StatusBadge({ status, onClick }: { status: string | null; onClick?: () => void }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: 'Activo', bg: 'bg-accent-mint/15', text: 'text-accent-mint' },
    paused: { label: 'Pausado', bg: 'bg-accent-amber/15', text: 'text-accent-amber' },
    completed: { label: 'Completado', bg: 'bg-accent-violet/15', text: 'text-accent-violet' },
  };
  const s = map[status ?? 'active'] ?? map.active;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={cn(
        'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all',
        s.bg, s.text,
        onClick && 'hover:brightness-125 cursor-pointer'
      )}
    >
      {s.label}
    </button>
  );
}

function ProgressBar({ progress, category }: { progress: number; category: string }) {
  const colorMap: Record<string, { from: string; to: string }> = {
    negocio: { from: 'from-accent-amber', to: 'to-accent-amber/50' },
    salud: { from: 'from-accent-mint', to: 'to-accent-mint/50' },
    personal: { from: 'from-accent-violet', to: 'to-accent-violet/50' },
    finanzas: { from: 'from-accent-amber', to: 'to-accent-amber/50' },
    relaciones: { from: 'from-accent-coral', to: 'to-accent-coral/50' },
    educacion: { from: 'from-accent-violet', to: 'to-accent-violet/50' },
  };
  const c = colorMap[category] ?? { from: 'from-accent-mint', to: 'to-accent-mint/50' };
  const clamped = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full bg-gradient-to-r', c.from, c.to)}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-bg-card p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
          <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-white/[0.06]" />
      <div className="flex justify-between">
        <div className="h-3 w-16 rounded bg-white/[0.06]" />
        <div className="h-5 w-14 rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/* ─── Status Cycle Menu ─── */
function StatusMenu({ currentStatus, onSelect, onClose }: {
  currentStatus: string | null;
  onSelect: (s: GoalStatus) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const statuses: { key: GoalStatus; label: string; icon: string }[] = [
    { key: 'active', label: 'Activo', icon: 'energy' },
    { key: 'paused', label: 'Pausado', icon: 'moon' },
    { key: 'completed', label: 'Completado', icon: 'check' },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-8 z-50 w-40 rounded-xl border border-white/[0.08] bg-bg-card backdrop-blur-xl shadow-xl overflow-hidden"
    >
      {statuses.map((s) => (
        <button
          key={s.key}
          onClick={() => { onSelect(s.key); onClose(); }}
          className={cn(
            'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors',
            (currentStatus ?? 'active') === s.key
              ? 'bg-white/[0.06] text-text-primary'
              : 'text-text-secondary hover:bg-white/[0.04] hover:text-text-primary'
          )}
        >
          <Icon name={s.icon} size={14} />
          {s.label}
        </button>
      ))}
    </motion.div>
  );
}

/* ─── Goal Form Modal ─── */
function GoalFormModal({ goal, onClose, onSaved }: {
  goal: GoalFull | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = goal !== null;
  const [form, setForm] = useState<GoalFormData>(() => {
    if (goal) {
      return {
        title: goal.title,
        category: goal.category,
        description: goal.description ?? '',
        metric: goal.metric ?? '',
        targetValue: goal.targetValue ?? '',
        unit: goal.unit ?? '',
        deadline: goal.deadline ? goal.deadline.slice(0, 10) : '',
        priority: goal.priority ?? 3,
      };
    }
    return { ...emptyForm };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof GoalFormData>(key: K, value: GoalFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('El titulo es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.metric.trim()) payload.metric = form.metric.trim();
      if (form.targetValue) payload.targetValue = form.targetValue;
      if (form.unit.trim()) payload.unit = form.unit.trim();
      if (form.deadline) payload.deadline = form.deadline;

      if (isEdit) {
        await api.updateGoal(goal.id, payload);
      } else {
        await api.createGoal(payload as any);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-mint/40 focus:border-accent-mint/40 transition-colors';
  const labelClass = 'block text-xs font-medium text-text-secondary mb-1.5';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/[0.08] bg-bg-card backdrop-blur-xl shadow-2xl"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">
              {isEdit ? 'Editar objetivo' : 'Nuevo objetivo'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* Title */}
          <div>
            <label className={labelClass}>Titulo *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ej: Facturar $5,000 USD"
              className={inputClass}
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Categoria</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => set('category', cat.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
                    form.category === cat.value
                      ? 'border-accent-mint/40 bg-accent-mint/10 text-accent-mint'
                      : 'border-white/[0.08] bg-white/[0.03] text-text-secondary hover:bg-white/[0.06]'
                  )}
                >
                  <Icon name={categoryIcon(cat.value)} size={14} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Descripcion</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Detalle opcional sobre tu objetivo..."
              rows={2}
              className={cn(inputClass, 'resize-none')}
            />
          </div>

          {/* Metric + Target + Unit row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={labelClass}>Metrica</label>
              <input
                type="text"
                value={form.metric}
                onChange={(e) => set('metric', e.target.value)}
                placeholder="Ej: ingresos"
                className={inputClass}
              />
            </div>
            <div className="col-span-1">
              <label className={labelClass}>Meta</label>
              <input
                type="number"
                value={form.targetValue}
                onChange={(e) => set('targetValue', e.target.value)}
                placeholder="5000"
                className={inputClass}
              />
            </div>
            <div className="col-span-1">
              <label className={labelClass}>Unidad</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder="USD, kg..."
                className={inputClass}
              />
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className={labelClass}>Fecha limite</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
              className={cn(inputClass, 'appearance-none')}
            />
          </div>

          {/* Priority */}
          <div>
            <label className={labelClass}>Prioridad: {form.priority}</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('priority', p)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                    form.priority === p
                      ? 'bg-accent-mint/20 text-accent-mint border border-accent-mint/30'
                      : 'bg-white/[0.04] text-text-muted border border-white/[0.06] hover:bg-white/[0.06]'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-accent-coral bg-accent-coral/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className={cn(
              'w-full py-3 rounded-xl font-semibold text-sm transition-all',
              saving
                ? 'bg-accent-mint/20 text-accent-mint/50 cursor-wait'
                : 'bg-accent-mint/20 text-accent-mint hover:bg-accent-mint/30 active:scale-[0.98]'
            )}
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear objetivo'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ─── Delete Confirm ─── */
function DeleteConfirm({ goalTitle, onConfirm, onCancel }: {
  goalTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
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
            <h3 className="text-sm font-bold text-text-primary">Eliminar objetivo</h3>
            <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
              {goalTitle}
            </p>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          Estas seguro? Esta accion no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] text-text-secondary hover:bg-white/[0.08] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-accent-coral/20 text-accent-coral hover:bg-accent-coral/30 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Goals Content ─── */
function GoalsContent() {
  const { data, loading, error, refetch } = useApi<GoalsData>(() => api.getGoals());
  const [editingGoal, setEditingGoal] = useState<GoalFull | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState<GoalFull | null>(null);
  const [statusMenuGoalId, setStatusMenuGoalId] = useState<number | null>(null);

  async function handleStatusChange(goalId: number, newStatus: GoalStatus) {
    try {
      await api.updateGoal(goalId, { status: newStatus });
      refetch();
    } catch {
      // silently fail, user can retry
    }
  }

  async function handleDelete() {
    if (!deletingGoal) return;
    try {
      await api.deleteGoal(deletingGoal.id);
      setDeletingGoal(null);
      refetch();
    } catch {
      setDeletingGoal(null);
    }
  }

  return (
    <>
      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-accent-coral/20 bg-accent-coral/5 p-5 text-center">
          <p className="text-accent-coral text-sm">{error}</p>
        </div>
      )}

      {/* Goal Cards */}
      {data && (
        <motion.div
          className="space-y-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {data.goals.map((goal) => (
            <motion.div
              key={goal.id}
              variants={item}
              layout
              className="rounded-2xl border border-white/[0.06] bg-bg-card backdrop-blur-sm p-5 space-y-3 hover:bg-bg-card-hover transition-colors cursor-pointer group"
              onClick={() => setEditingGoal(goal)}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-lg shrink-0',
                    categoryColor(goal.category)
                  )}>
                    <Icon name={categoryIcon(goal.category)} size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                        {goal.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="relative shrink-0">
                  <StatusBadge
                    status={goal.status}
                    onClick={() => setStatusMenuGoalId(
                      statusMenuGoalId === goal.id ? null : goal.id
                    )}
                  />
                  <AnimatePresence>
                    {statusMenuGoalId === goal.id && (
                      <StatusMenu
                        currentStatus={goal.status}
                        onSelect={(s) => handleStatusChange(goal.id, s)}
                        onClose={() => setStatusMenuGoalId(null)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Progress bar */}
              <ProgressBar progress={goal.progress} category={goal.category} />

              {/* Bottom row */}
              <div className="flex items-center justify-between text-xs">
                <span className={cn('font-mono font-medium', categoryColor(goal.category))}>
                  {goal.currentValue ?? '0'} / {goal.targetValue ?? '?'}{' '}
                  {goal.unit && (
                    <span className="text-text-muted font-sans">{goal.unit}</span>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  {goal.deadline && (
                    <span className="text-text-muted">
                      {new Date(goal.deadline).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}

                  {/* Delete button (visible on hover / always on mobile) */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeletingGoal(goal); }}
                    className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-text-muted hover:text-accent-coral hover:bg-accent-coral/10 transition-all opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    style={{ opacity: undefined }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Empty state */}
          {data.goals.length === 0 && (
            <motion.div
              variants={item}
              className="rounded-2xl border border-white/[0.06] bg-bg-card p-10 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-accent-mint/10 flex items-center justify-center mx-auto">
                <Icon name="target" size={32} className="text-accent-mint" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  Todavia no tenes objetivos
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Crea tu primer objetivo y empeza a trackear tu progreso
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-mint/20 text-accent-mint text-sm font-semibold hover:bg-accent-mint/30 transition-colors"
              >
                <Icon name="plus" size={16} />
                Crear objetivo
              </button>
            </motion.div>
          )}

          {/* Suggested goal placeholder */}
          <motion.div
            variants={item}
            className="rounded-2xl border-2 border-dashed border-white/[0.08] p-5 text-center"
          >
            <span className="text-2xl block mb-2"><Icon name="sparkle" size={24} /></span>
            <p className="text-sm text-text-muted">
              El sistema detectara patrones y te sugerira nuevos objetivos
            </p>
          </motion.div>
        </motion.div>
      )}

      {/* FAB - Create button (when goals exist) */}
      {data && data.goals.length > 0 && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', damping: 20 }}
          onClick={() => setShowCreate(true)}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-accent-mint/20 border border-accent-mint/30 text-accent-mint flex items-center justify-center shadow-lg hover:bg-accent-mint/30 active:scale-95 transition-all z-40"
        >
          <Icon name="plus" size={24} />
        </motion.button>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <GoalFormModal
            goal={null}
            onClose={() => setShowCreate(false)}
            onSaved={refetch}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingGoal && (
          <GoalFormModal
            goal={editingGoal}
            onClose={() => setEditingGoal(null)}
            onSaved={refetch}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingGoal && (
          <DeleteConfirm
            goalTitle={deletingGoal.title}
            onConfirm={handleDelete}
            onCancel={() => setDeletingGoal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function GoalsPage() {
  const [tab, setTab] = useState<Tab>('objetivos');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <motion.h1
        className="text-2xl font-bold text-text-primary mb-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {tab === 'habitos' && selectedHabit ? 'Habito' : 'Progreso'}
      </motion.h1>

      {/* Tab toggle - hidden when viewing calendar */}
      {!(tab === 'habitos' && selectedHabit) && (
        <motion.div
          className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-6"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          {([
            { key: 'objetivos' as Tab, label: 'Objetivos' },
            { key: 'habitos' as Tab, label: 'Habitos' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setSelectedHabit(null);
              }}
              className={cn(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200',
                tab === key
                  ? 'bg-accent-mint/20 text-accent-mint'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'objetivos' && (
          <motion.div
            key="objetivos"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            <GoalsContent />
          </motion.div>
        )}

        {tab === 'habitos' && !selectedHabit && (
          <motion.div
            key="habitos-list"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
          >
            <HabitsList onSelectHabit={setSelectedHabit} />
          </motion.div>
        )}

        {tab === 'habitos' && selectedHabit && (
          <motion.div
            key={`habit-calendar-${selectedHabit.id}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
          >
            <HabitCalendar
              habit={selectedHabit}
              onBack={() => setSelectedHabit(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
