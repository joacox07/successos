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
  // We're replacing emojis with icons globally
  return categoryIcon(category);
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

export function getIconForHabit(name: string, category: string | null): string {
  const nameLower = name.toLowerCase();
  const iconMap: Record<string, string> = {
    gym: 'dumbbell', ejercicio: 'dumbbell', entrenamiento: 'dumbbell',
    running: 'exercise', correr: 'exercise',
    meditar: 'moon', meditación: 'moon', meditacion: 'moon',
    leer: 'book', lectura: 'book',
    agua: 'droplet', hidratación: 'droplet', hidratacion: 'droplet',
    journaling: 'notebook', diario: 'notebook',
    yoga: 'yoga',
    música: 'target', musica: 'target',
    code: 'target', programar: 'target',
    trabajo: 'briefcase',
    estudio: 'book',
    dormir: 'moon', sueño: 'moon', sueno: 'moon',
    socializar: 'user', redes: 'target', social: 'user',
    familia: 'heart',
    compras: 'target', cocinar: 'target', cocina: 'target',
    limpieza: 'target', caminar: 'target', caminata: 'target',
    rezar: 'pray', oración: 'pray', oracion: 'pray', rosario: 'pray',
  };
  for (const [key, icon] of Object.entries(iconMap)) {
    if (nameLower.includes(key)) return icon;
  }
  const categoryMap: Record<string, string> = {
    salud: 'heart', educacion: 'book', espiritual: 'pray',
    personal: 'user', productividad: 'target',
  };
  return categoryMap[category || ''] || 'check';
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
