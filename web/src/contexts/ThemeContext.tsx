import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Theme = 'dark' | 'nothing';
export type Density = 'normal' | 'compact';

export interface NothingAccentColor {
  label: string;
  rgb: string;
}

export const NOTHING_ACCENT_COLORS: NothingAccentColor[] = [
  { label: 'Rojo', rgb: '215 25 33' },
  { label: 'Blanco', rgb: '255 255 255' },
  { label: 'Azul', rgb: '51 102 255' },
  { label: 'Verde', rgb: '0 200 83' },
  { label: 'Naranja', rgb: '255 149 0' },
  { label: 'Amarillo', rgb: '255 214 10' },
  { label: 'Rosa', rgb: '255 55 95' },
  { label: 'Violeta', rgb: '175 82 222' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
  nothingAccent: string;
  setNothingAccent: (rgb: string) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  density: 'normal',
  setDensity: () => {},
  nothingAccent: '215 25 33',
  setNothingAccent: () => {},
  isFullscreen: false,
  toggleFullscreen: () => {},
});

function applyNothingAccent(rgb: string) {
  document.documentElement.style.setProperty('--color-nothing-accent', rgb);
  // Only apply if currently on nothing theme
  if (document.documentElement.getAttribute('data-theme') === 'nothing') {
    document.documentElement.style.setProperty('--color-accent-primary', rgb);
    document.documentElement.style.setProperty('--color-accent-tertiary', rgb);
  }
}

function clearNothingAccentOverride() {
  document.documentElement.style.removeProperty('--color-accent-primary');
  document.documentElement.style.removeProperty('--color-accent-tertiary');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('successos-theme');
    return (stored === 'nothing' ? 'nothing' : 'dark') as Theme;
  });

  const [density, setDensityState] = useState<Density>(() => {
    const stored = localStorage.getItem('successos-density');
    return stored === 'compact' ? 'compact' : 'normal';
  });

  const [nothingAccent, setNothingAccentState] = useState<string>(() => {
    return localStorage.getItem('successos-nothing-accent') || '215 25 33';
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem('successos-theme', t);
  }

  function setDensity(d: Density) {
    setDensityState(d);
    localStorage.setItem('successos-density', d);
  }

  function setNothingAccent(rgb: string) {
    setNothingAccentState(rgb);
    localStorage.setItem('successos-nothing-accent', rgb);
  }

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  }, []);

  // Sync fullscreen state with browser
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'nothing') {
      applyNothingAccent(nothingAccent);
    } else {
      clearNothingAccentOverride();
    }
  }, [theme, nothingAccent]);

  // Apply density
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  // Auto-enter fullscreen on load if preference stored
  useEffect(() => {
    const pref = localStorage.getItem('successos-fullscreen');
    if (pref === 'true' && !document.fullscreenElement) {
      // Small delay so browser allows it after user interaction
      const handler = () => {
        document.documentElement.requestFullscreen().catch(() => {});
        document.removeEventListener('click', handler);
      };
      document.addEventListener('click', handler, { once: true });
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        density,
        setDensity,
        nothingAccent,
        setNothingAccent,
        isFullscreen,
        toggleFullscreen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
