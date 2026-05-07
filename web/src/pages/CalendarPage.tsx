import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api, CalendarEvent } from '@/lib/api';
import { cn } from '@/lib/utils';
import Icon from '@/components/Icon';

/* ── Helpers ─────────────────────────────────────────────── */
const TZ = 'America/Argentina/Buenos_Aires';

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  } catch { return iso; }
}

function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  const tomorrow = (() => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); })();
  if (dateStr === today) return 'Hoy';
  if (dateStr === tomorrow) return 'Mañana';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function eventDateKey(event: CalendarEvent): string {
  if (event.allDay) return event.start.slice(0, 10);
  try { return new Date(event.start).toLocaleDateString('en-CA', { timeZone: TZ }); }
  catch { return event.start.slice(0, 10); }
}

function deduplicateRecurring(events: CalendarEvent[]): CalendarEvent[] {
  const seenBaseIds = new Set<string>();
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const result: CalendarEvent[] = [];
  for (const event of sorted) {
    const id = event.id || '';
    // Google Calendar recurring event IDs have format: baseId_YYYYMMDDTHHmmssZ
    const match = id.match(/^(.+)_(\d{8}T\d{6}Z)$/);
    if (match) {
      const baseId = match[1];
      if (seenBaseIds.has(baseId)) continue;
      seenBaseIds.add(baseId);
    }
    result.push(event);
  }
  return result;
}

function groupByDate(events: CalendarEvent[]): { date: string; events: CalendarEvent[] }[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = eventDateKey(e);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({ date, events }));
}

/* ── Create Event Modal ──────────────────────────────────── */
function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: Parameters<typeof api.createCalendarEvent>[0]) => Promise<void> }) {
  const [summary, setSummary] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!summary.trim() || !date) return;
    setSaving(true);
    try {
      await onCreate({ summary: summary.trim(), date, time: allDay ? undefined : (time || undefined), endTime: allDay ? undefined : (endTime || undefined), allDay });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full sm:w-[90%] sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-white/[0.08] bg-[#0f0f13] shadow-2xl p-5 space-y-4"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <h3 className="text-sm font-bold text-text-primary">Nuevo evento</h3>

        <input
          type="text"
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="Título del evento"
          className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-mint/40 transition-colors"
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono text-text-muted uppercase tracking-wider block mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary focus:outline-none focus:border-accent-mint/40 transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setAllDay(v => !v)}
              className={cn('w-full h-10 rounded-xl border text-xs font-medium transition-all', allDay ? 'bg-accent-mint/15 border-accent-mint/30 text-accent-mint' : 'bg-white/[0.04] border-white/[0.06] text-text-muted')}
            >
              Todo el día
            </button>
          </div>
        </div>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-mono text-text-muted uppercase tracking-wider block mb-1">Desde</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary focus:outline-none focus:border-accent-mint/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-[9px] font-mono text-text-muted uppercase tracking-wider block mb-1">Hasta</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary focus:outline-none focus:border-accent-mint/40 transition-colors"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-text-muted bg-white/[0.04] hover:bg-white/[0.06] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!summary.trim() || !date || saving}
            className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium transition-all', summary.trim() && date ? 'bg-accent-mint/20 text-accent-mint hover:bg-accent-mint/30' : 'bg-white/[0.04] text-text-muted cursor-not-allowed')}
          >
            {saving ? 'Guardando...' : 'Agendar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function CalendarPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(searchParams.get('connected') === '1');
  const [connectError, setConnectError] = useState(searchParams.get('error') === 'auth_failed');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const status = await api.getCalendarStatus();
      setConnected(status.connected);
      if (status.connected) {
        const { events } = await api.getCalendarEvents(undefined, 14);
        setEvents(events);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!justConnected && !connectError) return;
    const timeout = window.setTimeout(() => {
      navigate('/calendar', { replace: true });
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [connectError, justConnected, navigate]);

  async function handleConnect() {
    try {
      const { authUrl } = await api.getCalendarConnectUrl();
      window.location.href = authUrl;
    } catch {
      setConnectError(true);
    }
  }

  async function handleCreate(data: Parameters<typeof api.createCalendarEvent>[0]) {
    await api.createCalendarEvent(data);
    const { events } = await api.getCalendarEvents(undefined, 14);
    setEvents(events);
  }

  async function handleChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);
    try {
      const historyForApi = chatMessages.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
      const result = await api.calendarChat(text, historyForApi) as { response: string; eventCreated?: boolean };
      setChatMessages(prev => [...prev, { role: 'ai', content: result.response }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      if (result.eventCreated) {
        try {
          const { events: freshEvents } = await api.getCalendarEvents(undefined, 14);
          setEvents(freshEvents);
        } catch { /* silent */ }
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Hubo un error. Intentá de nuevo.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.deleteCalendarEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const grouped = groupByDate(deduplicateRecurring(events));

  return (
    <motion.div
      className="px-4 pt-6 pb-28 max-w-lg mx-auto space-y-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Agenda</h1>
          <p className="text-sm text-text-muted mt-0.5">Próximos 14 días</p>
        </div>
        {connected && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-10 h-10 rounded-2xl bg-accent-mint/15 border border-accent-mint/25 flex items-center justify-center"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Icon name="plus" size={18} className="text-accent-mint" />
          </button>
        )}
      </div>

      {/* Just connected banner */}
      <AnimatePresence>
        {justConnected && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-accent-mint/20 bg-accent-mint/[0.06] p-4 flex items-start gap-3"
          >
            <Icon name="check" size={16} className="text-accent-mint mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Google Calendar conectado</p>
              <p className="text-xs text-text-muted mt-0.5">Ya podés ver y crear eventos desde acá y desde WhatsApp.</p>
            </div>
            <button onClick={() => setJustConnected(false)} className="text-text-muted hover:text-text-secondary">
              <Icon name="x" size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {connectError && (
        <div className="rounded-2xl border border-accent-coral/20 bg-accent-coral/[0.05] p-4">
          <p className="text-sm text-accent-coral">Error al conectar el calendario. Intentá de nuevo.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-16 rounded-2xl bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Not connected */}
      {!loading && connected === false && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto">
            <Icon name="calendar" size={32} className="text-text-muted" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">Conectá tu Google Calendar</h2>
            <p className="text-sm text-text-muted mt-2 leading-relaxed">
              Vinculá tu calendario para ver y crear eventos desde acá y hablar con el bot por WhatsApp.
            </p>
          </div>
          <button
            onClick={handleConnect}
            className="w-full py-3 rounded-2xl bg-accent-mint/20 border border-accent-mint/25 text-accent-mint text-sm font-medium hover:bg-accent-mint/30 active:scale-[0.98] transition-all"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            Conectar Google Calendar
          </button>
          <p className="text-xs text-text-muted">También podés conectarlo mandando "conectar calendario" por WhatsApp.</p>
        </div>
      )}

      {/* Events list */}
      {!loading && connected && (
        <>
          {events.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <Icon name="calendar" size={32} className="text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No tenés eventos en los próximos 14 días.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ date, events: dayEvents }) => (
                <div key={date}>
                  <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2 capitalize">
                    {formatDateLabel(date)}
                  </p>
                  <div className="space-y-2">
                    {dayEvents.map(event => (
                      <motion.div
                        key={event.id}
                        layout
                        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-3"
                      >
                        <div className="shrink-0 w-10 text-center pt-0.5">
                          {event.allDay ? (
                            <p className="text-[9px] font-mono text-text-muted uppercase">Todo</p>
                          ) : (
                            <p className="text-xs font-bold text-accent-mint">{formatTime(event.start)}</p>
                          )}
                          {!event.allDay && event.end && (
                            <p className="text-[9px] font-mono text-text-muted">{formatTime(event.end)}</p>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary leading-tight">{event.summary}</p>
                          {event.description && (
                            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{event.description}</p>
                          )}
                        </div>
                        {event.id && (
                          <button
                            onClick={() => handleDelete(event.id!)}
                            disabled={deletingId === event.id}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-accent-coral transition-colors shrink-0"
                          >
                            {deletingId === event.id
                              ? <div className="w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin" />
                              : <Icon name="trash" size={13} />
                            }
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AI Chat */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Preguntale a la IA</p>

            {chatMessages.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-accent-mint/20 text-accent-mint rounded-br-sm'
                        : 'bg-white/[0.06] text-text-primary rounded-bl-sm',
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.06] px-3 py-2 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1 items-center h-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                placeholder="¿Qué tengo mañana? ¿Cómo estuve el lunes?"
                className="flex-1 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-mint/40 transition-colors"
              />
              <button
                onClick={handleChat}
                disabled={!chatInput.trim() || chatLoading}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0',
                  chatInput.trim() && !chatLoading
                    ? 'bg-accent-mint/20 text-accent-mint hover:bg-accent-mint/30'
                    : 'bg-white/[0.04] text-text-muted cursor-not-allowed',
                )}
              >
                <Icon name="send" size={16} />
              </button>
            </div>
          </div>

          {/* Reconnect link */}
          <button
            onClick={handleConnect}
            className="w-full text-center text-xs text-text-muted hover:text-text-secondary transition-colors py-2"
          >
            Reconectar calendario
          </button>
        </>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
