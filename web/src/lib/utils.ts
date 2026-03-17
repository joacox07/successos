import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    negocio: '💼', salud: '💪', personal: '🧠',
    finanzas: '💰', relaciones: '❤️', educacion: '📚',
  };
  return map[category] || '🎯';
}

export function categoryColor(category: string): string {
  const map: Record<string, string> = {
    negocio: 'text-accent-amber',
    salud: 'text-accent-mint',
    personal: 'text-accent-violet',
    finanzas: 'text-accent-amber',
    relaciones: 'text-accent-coral',
    educacion: 'text-accent-violet',
  };
  return map[category] || 'text-accent-mint';
}

export function categoryIcon(category: string): string {
  const map: Record<string, string> = {
    negocio: 'briefcase', salud: 'exercise', personal: 'brain',
    finanzas: 'wallet', relaciones: 'heart', educacion: 'book',
  };
  return map[category] || 'target';
}

export function areaLabel(area: string): string {
  const map: Record<string, string> = {
    sleepQuality: 'Sueño', sleep: 'Sueño',
    mood: 'Mood', emotional: 'Mood',
    energyLevel: 'Energía', energy: 'Energía',
    exerciseDone: 'Ejercicio', exercise: 'Ejercicio',
    focusHours: 'Foco', productivity: 'Productividad',
    dietQuality: 'Dieta', diet: 'Dieta',
    relationships: 'Relaciones',
    vices: 'Vicios',
  };
  return map[area] || area;
}
