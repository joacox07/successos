import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { api, type StudySubject } from '../../lib/api';

// ─── Constants ──────────────────────────────────────────────────────────────

const INTERVALS = [1, 3, 7, 14, 30];
const STAGE_LABELS = ['Nuevo', '1d', '3d', '7d', '14d', '30d'];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T00:00:00').getTime();
  const msB = new Date(b + 'T00:00:00').getTime();
  return Math.round((msB - msA) / 86_400_000);
}

type SubjectStatus =
  | { kind: 'new' }
  | { kind: 'today' }
  | { kind: 'overdue'; days: number }
  | { kind: 'future'; days: number };

function getStatus(subject: StudySubject): SubjectStatus {
  if (!subject.nextReview) return { kind: 'new' };
  const diff = daysBetween(todayStr(), subject.nextReview);
  if (diff < 0) return { kind: 'overdue', days: Math.abs(diff) };
  if (diff === 0) return { kind: 'today' };
  return { kind: 'future', days: diff };
}

function statusLabel(status: SubjectStatus): string {
  switch (status.kind) {
    case 'new': return 'Nuevo';
    case 'today': return 'Repasar hoy';
    case 'overdue': return `Atrasado ${status.days}d`;
    case 'future': return `En ${status.days}d`;
  }
}

function statusColor(status: SubjectStatus): string {
  switch (status.kind) {
    case 'new': return 'text-accent-violet';
    case 'today': return 'text-accent-mint';
    case 'overdue': return 'text-accent-coral';
    case 'future': return 'text-text-muted';
  }
}

function statusBadgeBg(status: SubjectStatus): string {
  switch (status.kind) {
    case 'new': return 'bg-accent-violet/15 border-accent-violet/25';
    case 'today': return 'bg-accent-mint/15 border-accent-mint/25';
    case 'overdue': return 'bg-accent-coral/15 border-accent-coral/25';
    case 'future': return 'bg-white/[0.04] border-white/[0.08]';
  }
}

function statusSort(s: StudySubject): number {
  const st = getStatus(s);
  if (st.kind === 'overdue') return 0;
  if (st.kind === 'today') return 1;
  if (st.kind === 'new') return 2;
  return 3 + st.days;
}

function isDueOrOverdue(status: SubjectStatus): boolean {
  return status.kind === 'today' || status.kind === 'overdue' || status.kind === 'new';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SpacedRepetition() {
  const [subjects, setSubjects] = useState<StudySubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchSubjects = useCallback(async () => {
    try {
      const data = await api.getSubjects();
      setSubjects(data.subjects.sort((a, b) => statusSort(a) - statusSort(b)));
    } catch (err) {
      console.error('Error fetching subjects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.createSubject(name);
      if (res.ok && res.subject) {
        setSubjects((prev) =>
          [...prev, res.subject].sort((a, b) => statusSort(a) - statusSort(b)),
        );
        setNewName('');
        setShowAdd(false);
      }
    } catch (err) {
      console.error('Error creating subject:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStudied(id: number) {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      const res = await api.markSubjectStudied(id);
      if (res.ok && res.subject) {
        setSubjects((prev) =>
          prev.map((s) => (s.id === id ? res.subject : s)).sort((a, b) => statusSort(a) - statusSort(b)),
        );
      }
    } catch (err) {
      console.error('Error marking studied:', err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number) {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await api.deleteSubject(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Error deleting subject:', err);
    } finally {
      setBusyId(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const dueCount = subjects.filter((s) => {
    const st = getStatus(s);
    return st.kind === 'today' || st.kind === 'overdue';
  }).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary tracking-wide">
            Repaso Espaciado
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {subjects.length === 0
              ? 'Sin materias'
              : `${subjects.length} materia${subjects.length !== 1 ? 's' : ''}${dueCount > 0 ? ` · ${dueCount} para hoy` : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
            'bg-white/[0.04] backdrop-blur-xl border border-white/[0.06]',
            'text-text-muted hover:text-accent-mint hover:border-accent-mint/30',
            showAdd && 'border-accent-mint/40 text-accent-mint rotate-45',
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="overflow-hidden"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre de la materia..."
                autoFocus
                className={cn(
                  'flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2',
                  'text-sm text-text-primary placeholder:text-text-muted/50',
                  'outline-none focus:border-accent-violet/40 transition-colors',
                )}
              />
              <button
                type="submit"
                disabled={!newName.trim() || submitting}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  'bg-accent-violet/20 border border-accent-violet/30 text-accent-violet',
                  'hover:bg-accent-violet/30 disabled:opacity-30 disabled:cursor-not-allowed',
                )}
              >
                {submitting ? '...' : 'Agregar'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Subject list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-accent-violet/30 border-t-accent-violet rounded-full animate-spin" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] p-8 text-center">
          <p className="text-sm text-text-muted">
            Agrega materias para planificar tus repasos
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {subjects.map((subject) => {
              const status = getStatus(subject);
              const busy = busyId === subject.id;

              return (
                <motion.div
                  key={subject.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] p-4',
                    'flex items-center gap-3 group',
                  )}
                >
                  {/* Study button (left side) */}
                  {isDueOrOverdue(status) ? (
                    <button
                      onClick={() => handleStudied(subject.id)}
                      disabled={busy}
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
                        status.kind === 'overdue'
                          ? 'bg-accent-coral/15 border border-accent-coral/30 text-accent-coral hover:bg-accent-coral/25'
                          : status.kind === 'today'
                            ? 'bg-accent-mint/15 border border-accent-mint/30 text-accent-mint hover:bg-accent-mint/25'
                            : 'bg-accent-violet/15 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/25',
                        busy && 'opacity-50 cursor-not-allowed',
                      )}
                      title="Marcar como estudiado"
                    >
                      {busy ? (
                        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/[0.03] border border-white/[0.04]">
                      <svg className="w-4 h-4 text-text-muted/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {subject.name}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0',
                          statusBadgeBg(status),
                          statusColor(status),
                        )}
                      >
                        {statusLabel(status)}
                      </span>
                    </div>

                    {/* Stage dots + next review info */}
                    <div className="flex items-center gap-3 mt-1.5">
                      {/* Stage dots */}
                      <div className="flex items-center gap-1" title={`Etapa ${subject.reviewStage}/5`}>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              'w-1.5 h-1.5 rounded-full transition-colors',
                              i <= subject.reviewStage
                                ? status.kind === 'overdue'
                                  ? 'bg-accent-coral'
                                  : status.kind === 'today'
                                    ? 'bg-accent-mint'
                                    : status.kind === 'new'
                                      ? 'bg-accent-violet'
                                      : 'bg-text-muted'
                                : 'bg-white/[0.08]',
                            )}
                          />
                        ))}
                      </div>

                      {/* Next review detail */}
                      <span className="text-[10px] font-mono text-text-muted">
                        {subject.nextReview
                          ? `${STAGE_LABELS[subject.reviewStage]} · ${subject.nextReview}`
                          : 'Sin repasos aun'}
                      </span>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(subject.id)}
                    disabled={busy}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      'text-text-muted/30 hover:text-accent-coral/70 hover:bg-accent-coral/10',
                      'opacity-0 group-hover:opacity-100 transition-all',
                      busy && 'opacity-50 cursor-not-allowed',
                    )}
                    title="Eliminar materia"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Legend */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
          {[
            { label: 'Atrasado', color: 'bg-accent-coral' },
            { label: 'Hoy', color: 'bg-accent-mint' },
            { label: 'Nuevo', color: 'bg-accent-violet' },
            { label: 'Futuro', color: 'bg-text-muted' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn('w-2 h-2 rounded-full', color)} />
              <span className="text-[10px] text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
