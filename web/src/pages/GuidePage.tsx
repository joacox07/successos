import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { api, type InsightsData } from '@/lib/api';
import { cn } from '@/lib/utils';
import Icon from '@/components/Icon';

interface LocalMessage {
  id: number | string;
  direction: 'in' | 'out';
  content: string;
  timestamp: string;
}

function TypingDots() {
  return (
    <div className="flex gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-text-muted"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

export default function GuidePage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCorrelations, setShowCorrelations] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: insightsData } = useApi<InsightsData>(() => api.getInsights(), []);

  const topCorrelations = (insightsData?.correlations ?? [])
    .filter(c => c.description && c.correlation !== null)
    .sort((a, b) => Math.abs(b.correlation ?? 0) - Math.abs(a.correlation ?? 0))
    .slice(0, 5);

  // Load history on mount
  useEffect(() => {
    api.getGuideHistory().then(res => {
      setMessages(res.messages.map(m => ({
        id: m.id,
        direction: m.direction,
        content: m.content ?? '',
        timestamp: m.timestamp,
      })));
    }).catch(() => {});
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const sendText = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setError(null);
    setSending(true);

    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      direction: 'in',
      content: text,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const res = await api.sendGuideMessage(text);
      setMessages(prev => [...prev, {
        id: `guide-${Date.now()}`,
        direction: 'out',
        content: res.response,
        timestamp: new Date().toISOString(),
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-white/[0.06] shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Icon name="chevron-left" size={16} className="text-text-secondary" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-text-primary">Guía de Patrones</h1>
          <p className="text-xs text-text-muted">Análisis de tus datos y correlaciones</p>
        </div>
        {topCorrelations.length > 0 && (
          <button
            onClick={() => setShowCorrelations(v => !v)}
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Icon name="sparkle" size={15} className="text-accent-mint" />
          </button>
        )}
      </div>

      {/* Correlations panel */}
      <AnimatePresence>
        {showCorrelations && topCorrelations.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-b border-white/[0.06] shrink-0"
          >
            <div className="px-4 py-3 space-y-2">
              <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Patrones detectados</p>
              {topCorrelations.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn(
                    'shrink-0 text-xs font-mono font-bold px-2 py-0.5 rounded-full',
                    (c.correlation ?? 0) >= 0
                      ? 'bg-accent-mint/15 text-accent-mint'
                      : 'bg-accent-coral/15 text-accent-coral',
                  )}>
                    {(c.correlation ?? 0) >= 0 ? '+' : ''}{c.correlation?.toFixed(2)}
                  </span>
                  <p className="text-xs text-text-secondary leading-relaxed">{c.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
        {messages.length === 0 && !sending && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-white/[0.06] border border-white/[0.08]">
              <p className="text-sm text-text-secondary leading-relaxed">
                Hola! Soy tu Guía de Patrones. Analizo tus datos para ayudarte a entender qué factores impactan más en tu bienestar y rendimiento.{topCorrelations.length > 0 ? ' Tocá el ✦ para ver los patrones detectados, o preguntame lo que quieras sobre tus datos.' : ' Necesito al menos 14 días de datos para detectar correlaciones. Por ahora podés preguntarme sobre tus métricas o hábitos.'}
              </p>
            </div>
          </motion.div>
        )}

        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('flex', msg.direction === 'in' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.direction === 'in'
                  ? 'rounded-tr-sm bg-accent-mint/10 border border-accent-mint/20 text-text-primary'
                  : 'rounded-tl-sm bg-white/[0.06] border border-white/[0.08] text-text-secondary',
              )}
            >
              {msg.content}
            </div>
          </motion.div>
        ))}

        {sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/[0.08]">
              <TypingDots />
            </div>
          </motion.div>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-accent-coral text-xs text-center py-1 px-4 shrink-0">{error}</p>}

      {/* Input area */}
      <div className="px-4 pt-3 pb-2 border-t border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Preguntame sobre tus patrones..."
            disabled={sending}
            className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/[0.08] px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-mint/30 transition-colors disabled:opacity-50"
          />
          <button
            onClick={sendText}
            disabled={!input.trim() || sending}
            className="w-11 h-11 rounded-full bg-accent-mint/20 border border-accent-mint/30 flex items-center justify-center text-accent-mint hover:bg-accent-mint/30 active:scale-95 transition-all disabled:opacity-30 shrink-0"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
