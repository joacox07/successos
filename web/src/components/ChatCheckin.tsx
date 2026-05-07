import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import type { ChatMessage, ChatResponse } from '@/lib/api';
import { cn } from '@/lib/utils';
import Icon from '@/components/Icon';

// ── Types ──

interface Props {
  onComplete?: () => void;
}

interface LocalMessage {
  id: number | string;
  direction: 'in' | 'out';
  content: string;
  extractedData?: Record<string, any> | null;
  timestamp: string;
  isAudio?: boolean;
  transcription?: string;
}

// ── Data areas for progress ──

const DATA_AREAS = [
  { key: 'sleepQuality', icon: 'sleep' as const, label: 'Sueno' },
  { key: 'mood', icon: 'mood' as const, label: 'Mood' },
  { key: 'energyLevel', icon: 'energy' as const, label: 'Energia' },
  { key: 'exerciseDone', icon: 'exercise' as const, label: 'Ejercicio' },
  { key: 'dietQuality', icon: 'diet' as const, label: 'Dieta' },
  { key: 'focusHours', icon: 'focus' as const, label: 'Foco' },
  { key: 'socialEvent', icon: 'social' as const, label: 'Social' },
  { key: 'vicesDetails', icon: 'vices' as const, label: 'Vicios' },
];

// ── Extraction chip labels ──

function getExtractionChips(data: Record<string, any>): { icon: string; label: string }[] {
  const chips: { icon: string; label: string }[] = [];
  if (data.sleep?.quality) chips.push({ icon: 'sleep', label: `Sueno ${data.sleep.quality}/10` });
  if (data.emotional?.mood) chips.push({ icon: 'mood', label: `Mood ${data.emotional.mood}/10` });
  if (data.energy?.level) chips.push({ icon: 'energy', label: `Energia ${data.energy.level}/10` });
  if (data.exercise?.done !== undefined && data.exercise.done !== null) {
    chips.push({ icon: 'exercise', label: data.exercise.done ? `Gym${data.exercise.duration ? ` ${data.exercise.duration}min` : ''}` : 'Sin ejercicio' });
  }
  if (data.diet?.quality) chips.push({ icon: 'diet', label: `Dieta ${data.diet.quality}/10` });
  if (data.productivity?.focusHours) chips.push({ icon: 'focus', label: `${data.productivity.focusHours}h foco` });
  if (data.productivity?.biggestWin) chips.push({ icon: 'trophy', label: data.productivity.biggestWin });
  if (data.relationships?.socialEvent) chips.push({ icon: 'social', label: data.relationships.socialEvent });
  if (data.sleep?.bedtime) chips.push({ icon: 'moon', label: `Acostado ${data.sleep.bedtime}` });
  if (data.sleep?.wakeTime) chips.push({ icon: 'sun', label: `Despierto ${data.sleep.wakeTime}` });
  return chips;
}

// ── Voice recorder hook ──

function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number>(0);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Try webm first, fallback to whatever browser supports
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : undefined;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
    recorder.start();
    mediaRecorder.current = recorder;
    setRecording(true);
    setDuration(0);
    timer.current = window.setInterval(() => setDuration(d => d + 1), 1000);
  }

  async function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = mediaRecorder.current!;
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        resolve(blob);
      };
      rec.stop();
      rec.stream.getTracks().forEach(t => t.stop());
      clearInterval(timer.current);
      setRecording(false);
      setDuration(0);
    });
  }

  function cancel() {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
    }
    clearInterval(timer.current);
    setRecording(false);
    setDuration(0);
    chunks.current = [];
  }

  return { recording, duration, start, stop, cancel };
}

// ── Typing indicator ──

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

// ═════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════

export default function ChatCheckin({ onComplete }: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<Record<string, any> | null>(null);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();

  // ── Load history on mount ──
  useEffect(() => {
    api.getChatHistory(30).then(res => {
      const localMsgs: LocalMessage[] = res.messages
        .filter(m => {
          // Only show today's messages
          const msgDate = m.timestamp?.split('T')[0];
          const today = new Date().toLocaleDateString('en-CA');
          return msgDate === today;
        })
        .map(m => ({
          id: m.id,
          direction: m.direction,
          content: m.content || '',
          extractedData: m.extractedData,
          timestamp: m.timestamp,
        }));
      setMessages(localMsgs);
      setCurrentEntry(res.currentEntry);
      setStreak(res.streak);
    }).catch(() => {});
  }, []);

  // ── Auto-scroll ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // ── Handle AI response ──
  const handleResponse = useCallback((res: ChatResponse, audioTranscription?: string) => {
    if (res.response) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        direction: 'out',
        content: res.response,
        extractedData: res.extractedData,
        timestamp: new Date().toISOString(),
      }]);
      if (res.currentEntry !== null) setCurrentEntry(res.currentEntry);
      if (res.streak > 0) setStreak(res.streak);
    }
    setSending(false);
  }, []);

  // ── Send text ──
  const sendText = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setError(null);
    setSending(true);

    // Optimistic user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      direction: 'in',
      content: text,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const res = await api.sendChatMessage(text);
      handleResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
      setSending(false);
    }
  }, [input, sending, handleResponse]);

  // ── Send audio ──
  const sendAudio = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setError(null);

    try {
      const blob = await voice.stop();

      // Optimistic user message
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        direction: 'in',
        content: 'Audio...',
        timestamp: new Date().toISOString(),
        isAudio: true,
      }]);

      const res = await api.sendChatAudio(blob);

      // Update user message with transcription
      if (res.transcription) {
        setMessages(prev => prev.map(m =>
          m.isAudio && !m.transcription
            ? { ...m, content: res.transcription!, transcription: res.transcription }
            : m
        ));
      }

      handleResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar audio');
      setSending(false);
    }
  }, [sending, voice, handleResponse]);

  // ── Key handler ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  // ── Progress count ──
  const filledAreas = DATA_AREAS.filter(a => {
    if (!currentEntry) return false;
    const v = currentEntry[a.key];
    return v !== null && v !== undefined;
  }).length;

  // ── Welcome message ──
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* ── Progress bar ── */}
      <div className="flex items-center gap-1.5 px-1 py-2 mb-2">
        {DATA_AREAS.map(area => {
          const filled = currentEntry && currentEntry[area.key] !== null && currentEntry[area.key] !== undefined;
          return (
            <div
              key={area.key}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-all',
                filled
                  ? 'bg-accent-mint/15 scale-105'
                  : 'bg-white/[0.04] opacity-30'
              )}
              title={area.label}
            >
              <Icon name={area.icon} size={16} />
            </div>
          );
        })}
        <span className="text-[10px] text-text-muted font-mono ml-auto">{filledAreas}/8</span>
      </div>

      {/* ── Messages area ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 px-1 pb-2 scrollbar-none"
      >
        {/* Welcome message if no messages today */}
        {!hasMessages && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-white/[0.06] border border-white/[0.08]">
              <p className="text-sm text-text-secondary leading-relaxed">
                Hola! Contame como fue tu dia hoy. Podes escribirme o mandar un audio con todo lo que hiciste, como dormiste, como te sentis...
              </p>
            </div>
          </motion.div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('flex', msg.direction === 'in' ? 'justify-end' : 'justify-start')}
          >
            <div className="max-w-[85%] space-y-1.5">
              {/* Message bubble */}
              <div
                className={cn(
                  'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.direction === 'in'
                    ? 'rounded-tr-sm bg-accent-mint/10 border border-accent-mint/20 text-text-primary'
                    : 'rounded-tl-sm bg-white/[0.06] border border-white/[0.08] text-text-secondary'
                )}
              >
                {msg.isAudio && !msg.transcription && (
                  <span className="text-accent-violet text-xs font-mono mr-2"><Icon name="microphone" size={12} className="inline" /> Audio</span>
                )}
                {msg.content}
              </div>

              {/* Extraction chips (only for AI messages with extracted data) */}
              {msg.direction === 'out' && msg.extractedData && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {getExtractionChips(msg.extractedData).map((chip, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.06] text-[11px] text-text-muted"
                    >
                      <Icon name={chip.icon} size={12} />
                      <span>{chip.label}</span>
                    </motion.span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/[0.08]">
              <TypingDots />
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="text-accent-coral text-xs text-center py-1">{error}</p>
      )}

      {/* ── Input area ── */}
      <div className="pt-3 border-t border-white/[0.06]">
        {/* Recording state */}
        <AnimatePresence>
          {voice.recording && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-between px-4 py-3 mb-2 rounded-2xl bg-accent-coral/10 border border-accent-coral/20"
            >
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-3 h-3 rounded-full bg-accent-coral"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-sm text-accent-coral font-mono">
                  {Math.floor(voice.duration / 60)}:{String(voice.duration % 60).padStart(2, '0')}
                </span>
                <span className="text-xs text-text-muted">Grabando...</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => voice.cancel()}
                  className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                >
                  <Icon name="x" size={14} />
                </button>
                <button
                  onClick={sendAudio}
                  className="w-8 h-8 rounded-full bg-accent-mint/20 flex items-center justify-center text-accent-mint"
                >
                  <Icon name="send" size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text input + buttons */}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Contame tu dia..."
            disabled={sending || voice.recording}
            className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/[0.08] px-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-mint/30 transition-colors disabled:opacity-50"
          />

          {input.trim() ? (
            <button
              onClick={sendText}
              disabled={sending}
              className="w-11 h-11 rounded-full bg-accent-mint/20 border border-accent-mint/30 flex items-center justify-center text-accent-mint hover:bg-accent-mint/30 active:scale-95 transition-all disabled:opacity-50 shrink-0"
            >
              <Icon name="send" size={18} />
            </button>
          ) : (
            <button
              onClick={() => voice.recording ? sendAudio() : voice.start()}
              disabled={sending}
              className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 shrink-0',
                voice.recording
                  ? 'bg-accent-coral/20 border border-accent-coral/30 text-accent-coral'
                  : 'bg-accent-violet/20 border border-accent-violet/30 text-accent-violet hover:bg-accent-violet/30'
              )}
            >
              {voice.recording ? (
                <div className="w-4 h-4 rounded-sm bg-accent-coral" />
              ) : (
                <Icon name="microphone" size={18} />
              )}
            </button>
          )}
        </div>

        {/* Streak display */}
        {streak > 0 && (
          <p className="text-center text-[10px] text-text-muted mt-2 font-mono">
            <Icon name="fire" size={12} className="inline" /> {streak} {streak === 1 ? 'dia' : 'dias'} seguidos
          </p>
        )}
      </div>
    </div>
  );
}
