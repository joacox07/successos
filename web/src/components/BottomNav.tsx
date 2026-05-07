import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

function haptic(style: 'light' | 'medium' = 'light') {
  if ('vibrate' in navigator) {
    navigator.vibrate(style === 'light' ? 1 : 5);
  }
}

const tabs = [
  {
    path: '/',
    label: 'Hoy',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    path: '/diary',
    label: 'Diario',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    path: '/metrics',
    label: 'Métricas',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-10" />
      </svg>
    ),
  },
  {
    path: '/goals',
    label: 'Goals',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    path: '/competitions',
    label: 'Comp',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H5a2 2 0 0 0 0 4h2" />
        <path d="M17 6h2a2 2 0 1 1 0 4h-2" />
      </svg>
    ),
  },
  {
    path: '/study',
    label: 'Estudio',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
  },
  {
    path: '/profile',
    label: 'Perfil',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed left-2 right-2 sm:left-4 sm:right-4 z-40 bg-bg-card backdrop-blur-[30px] border border-border-primary rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.5)] select-none"
      style={{
        bottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div className="flex items-center justify-around h-14 sm:h-16 max-w-lg mx-auto px-1 sm:px-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <motion.button
              key={tab.path}
              onClick={() => { haptic('light'); navigate(tab.path); }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 35 }}
              className={cn(
                'flex flex-col items-center gap-0.5 sm:gap-1 py-1 px-1 sm:px-2 min-w-0 touch-manipulation transition-colors duration-200',
                isActive ? 'text-accent-mint' : 'text-text-secondary',
              )}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <motion.div
                animate={{ opacity: isActive ? 1 : 0.8, scale: isActive ? 1.05 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {tab.icon}
              </motion.div>
              <motion.span
                className="text-[8px] sm:text-[9px] font-bold font-display uppercase tracking-[0.1em] sm:tracking-[0.2em] truncate max-w-full"
                animate={{ opacity: isActive ? 1 : 0.8 }}
                transition={{ duration: 0.2 }}
              >
                {tab.label}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
