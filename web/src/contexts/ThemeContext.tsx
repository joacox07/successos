import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Density = 'normal' | 'compact';
export type Theme = 'dark' | 'light';

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
  accentColor: string;
  setAccentColor: (rgb: string) => void;
  density: Density;
  setDensity: (d: Density) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  glowAlpha: number;
  setGlowAlpha: (v: number) => void;
  customColor: string | null;
  setCustomColor: (rgb: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  accentColor: '215 25 33',
  setAccentColor: () => {},
  density: 'normal',
  setDensity: () => {},
  isFullscreen: false,
  toggleFullscreen: () => {},
  theme: 'dark',
  setTheme: () => {},
  glowAlpha: 0.5,
  setGlowAlpha: () => {},
  customColor: null,
  setCustomColor: () => {},
});

function applyAccentColor(rgb: string, alpha: number) {
  const el = document.documentElement;
  el.style.setProperty('--color-accent-primary', rgb);
  el.style.setProperty('--color-accent-secondary', rgb);
  el.style.setProperty('--color-accent-tertiary', rgb);
  el.style.setProperty('--color-accent-warm', rgb);
  el.style.setProperty('--color-positive', rgb);
  el.style.setProperty('--glow-alpha', String(alpha));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColorState] = useState<string>(() => {
    return localStorage.getItem('successos-accent-color') || '215 25 33';
  });

  const [density, setDensityState] = useState<Density>(() => {
    const stored = localStorage.getItem('successos-density');
    return stored === 'compact' ? 'compact' : 'normal';
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('successos-theme');
    if (stored === 'light') return 'light';
    // Migrar 'nothing' (tema viejo) a 'dark'
    if (stored === 'nothing') {
      localStorage.setItem('successos-theme', 'dark');
      return 'dark';
    }
    return 'dark';
  });

  const [glowAlpha, setGlowAlphaState] = useState<number>(() => {
    return parseFloat(localStorage.getItem('successos-glow-alpha') || '0.5');
  });

  const [customColor, setCustomColorState] = useState<string | null>(() => {
    return localStorage.getItem('successos-custom-color') || null;
  });

  function setAccentColor(rgb: string) {
    setAccentColorState(rgb);
    localStorage.setItem('successos-accent-color', rgb);
  }

  function setDensity(d: Density) {
    setDensityState(d);
    localStorage.setItem('successos-density', d);
  }

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem('successos-theme', t);
  }

  function setGlowAlpha(v: number) {
    setGlowAlphaState(v);
    localStorage.setItem('successos-glow-alpha', String(v));
  }

  function setCustomColor(rgb: string | null) {
    setCustomColorState(rgb);
    if (rgb === null) {
      localStorage.removeItem('successos-custom-color');
    } else {
      localStorage.setItem('successos-custom-color', rgb);
    }
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

  // Apply theme & accent color
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.filter = '';
    const effectiveColor = customColor || accentColor;
    applyAccentColor(effectiveColor, glowAlpha);
  }, [theme, accentColor, customColor, glowAlpha]);

  // Apply density
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  // Auto-enter fullscreen on load if preference stored
  useEffect(() => {
    const pref = localStorage.getItem('successos-fullscreen');
    if (pref === 'true' && !document.fullscreenElement) {
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
        accentColor,
        setAccentColor,
        density,
        setDensity,
        isFullscreen,
        toggleFullscreen,
        theme,
        setTheme,
        glowAlpha,
        setGlowAlpha,
        customColor,
        setCustomColor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
