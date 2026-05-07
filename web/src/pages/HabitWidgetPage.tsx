import { Link } from 'react-router-dom';
import { Background } from '@/components/Background';
import Icon from '@/components/Icon';
import { api, type HabitWidgetSummary } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useDashboardConfig } from '@/hooks/useDashboardConfig';

export default function HabitWidgetPage() {
  const { config } = useDashboardConfig();
  const pinnedIds = config.pinnedHabitIds;
  const { data, loading, error } = useApi<HabitWidgetSummary>(
    () => api.getHabitWidgetSummary(pinnedIds.length > 0 ? pinnedIds : undefined),
    [pinnedIds.join(',')],
  );

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-bg-primary px-4 py-5">
      <Background />
      <div className="relative z-10 mx-auto max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-text-muted">Widget</p>
            <h1 className="mt-1 text-xl font-semibold text-text-primary">Hábitos de hoy</h1>
          </div>
          <Link
            to="/"
            className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary"
          >
            Abrir app
          </Link>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-8 w-24 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-16 animate-pulse rounded-2xl bg-white/[0.06]" />
            </div>
          ) : error ? (
            <div className="space-y-2 text-sm text-accent-coral">
              <p>{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-text-muted">Cumplimiento</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-5xl font-semibold text-text-primary">{data.completionRate}</span>
                    <span className="text-lg text-accent-mint">%</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-accent-mint/20 bg-accent-mint/[0.08] px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-text-muted">Racha</p>
                  <p className="text-xl font-semibold text-accent-mint">{data.streak} días</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-text-muted">Completados</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">
                    {data.completedCount}/{data.totalCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-text-muted">Pendientes</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{data.pendingHabits.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.25em] text-text-muted">Foco de hoy</p>
                {data.pendingHabits.length > 0 ? (
                  data.pendingHabits.slice(0, 3).map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className={habit.isNegative ? 'text-accent-coral' : 'text-accent-amber'}>
                          <Icon name={habit.isNegative ? 'x' : 'target'} size={14} />
                        </span>
                        <span className="text-sm text-text-primary">{habit.name}</span>
                      </div>
                      <span className="text-[11px] text-text-secondary">
                        {habit.isNegative ? 'recaída hoy' : 'pendiente'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-accent-mint/15 bg-accent-mint/[0.08] px-3 py-3 text-sm text-accent-mint">
                    Todo al día. No hay hábitos críticos pendientes.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
