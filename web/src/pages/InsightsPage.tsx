import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api, type InsightsData } from '@/lib/api';
import { areaLabel } from '@/lib/utils';

function CorrelationBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const abs = Math.abs(value);
  const isPositive = value >= 0;
  const size = abs > 0.7 ? 'text-base px-3 py-1' : abs > 0.4 ? 'text-sm px-2.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`
        rounded-full font-mono font-bold
        ${size}
        ${isPositive ? 'bg-accent-mint/15 text-accent-mint' : 'bg-accent-coral/15 text-accent-coral'}
      `}
    >
      {isPositive ? '+' : ''}{value.toFixed(2)}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-bg-card p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 rounded bg-white/[0.06]" />
          <div className="h-4 w-4 rounded bg-white/[0.06]" />
          <div className="h-4 w-16 rounded bg-white/[0.06]" />
        </div>
        <div className="h-6 w-14 rounded-full bg-white/[0.06]" />
      </div>
      <div className="h-3 w-3/4 rounded bg-white/[0.06]" />
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

export default function InsightsPage() {
  const { data, loading, error } = useApi<InsightsData>(() => api.getInsights());
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setExpanded((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <motion.h1
        className="text-2xl font-bold text-text-primary mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        Insights
      </motion.h1>

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

      {/* Correlations */}
      {data && data.correlations.length > 0 && (
        <motion.div
          className="space-y-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {data.correlations.map((c, idx) => (
            <motion.div
              key={idx}
              variants={item}
              className="rounded-2xl border border-white/[0.06] bg-bg-card backdrop-blur-sm overflow-hidden hover:bg-bg-card-hover transition-colors cursor-pointer"
              onClick={() => toggle(idx)}
            >
              <div className="p-5 space-y-3">
                {/* Areas + correlation */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <span className="font-medium text-text-primary truncate">
                      {areaLabel(c.areaA)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="shrink-0 text-text-muted"
                    >
                      <path
                        d="M3 8h10m0 0L9.5 4.5M13 8l-3.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="font-medium text-text-primary truncate">
                      {areaLabel(c.areaB)}
                    </span>
                  </div>
                  <CorrelationBadge value={c.correlation} />
                </div>

                {/* Description */}
                {c.description && (
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {c.description}
                  </p>
                )}

                {/* Data points + confidence */}
                <div className="flex items-center gap-3 text-[11px] text-text-muted">
                  {c.dataPoints !== null && (
                    <span>{c.dataPoints} datos</span>
                  )}
                  {c.confidence !== null && (
                    <span>Confianza: {Math.round(c.confidence * 100)}%</span>
                  )}
                  <span className="ml-auto">
                    {expanded === idx ? 'Cerrar' : 'Ver mas'}
                  </span>
                </div>
              </div>

              {/* Expanded chart placeholder */}
              <AnimatePresence>
                {expanded === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-2 border-t border-white/[0.06]">
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.04] h-40 flex items-center justify-center">
                        <div className="text-center">
                          <span className="text-2xl block mb-2">📊</span>
                          <p className="text-xs text-text-muted">
                            Grafico de correlacion disponible proximamente
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Empty state */}
      {data && data.correlations.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-white/[0.06] bg-bg-card p-8 text-center"
        >
          <span className="text-3xl block mb-3">🔬</span>
          <p className="text-sm text-text-secondary mb-1">
            Necesitas al menos 14 dias de datos para ver correlaciones
          </p>
          <p className="text-xs text-text-muted">
            Segui logueando tus metricas diarias y el sistema encontrara patrones
          </p>
        </motion.div>
      )}
    </div>
  );
}
