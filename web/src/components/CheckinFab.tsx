import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/Icon';

type CheckinFabProps = {
  onOpenChat: () => void;
  onOpenQuick: () => void;
  routeKey: string;
};

export function CheckinFab({ onOpenChat, onOpenQuick, routeKey }: CheckinFabProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [routeKey]);

  return (
    <div
      className="fixed right-4 z-[70]"
      style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))' }}
      ref={menuRef}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute bottom-16 right-0 min-w-[190px] rounded-2xl border border-white/[0.12] bg-[#0b0f19]/96 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.45)] p-2"
          >
            <button
              onClick={() => {
                setOpen(false);
                onOpenChat();
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/[0.08] transition-colors"
              aria-label="Abrir Coach en modo chat"
            >
              Coach (chat)
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onOpenQuick();
              }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/[0.08] transition-colors"
              aria-label="Abrir check-in rapido"
            >
              Check-in rapido
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((current) => !current)}
        className="h-14 w-14 rounded-full border bg-[#0b0f19]/95 backdrop-blur-xl shadow-lg flex items-center justify-center active:scale-[0.96] transition-transform"
        style={{
          borderColor: 'rgb(var(--color-accent-primary) / 0.35)',
          boxShadow: '0 0 0 1px rgb(var(--color-accent-primary) / 0.18), 0 12px 24px rgba(0,0,0,0.4), 0 0 24px rgb(var(--color-accent-primary) / 0.24)',
        }}
        aria-label="Abrir menu de check-in"
      >
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgb(var(--color-accent-primary) / 0.14)' }}
        >
          <Icon
            name="target"
            size={21}
            style={{ color: 'rgb(var(--color-accent-primary))' }}
          />
        </div>
      </button>
    </div>
  );
}
