import { CourseColor } from '@core/api/api.models';

/** Couleurs des cours dans le planning (fonds pastel, texte foncé lisible dessus) */
export const COURSE_COLORS: Record<CourseColor, { bg: string; label: string }> = {
  mint: { bg: '#cfe8e3', label: 'Menthe' },
  peach: { bg: '#fde3c0', label: 'Pêche' },
  lavender: { bg: '#e2dbfb', label: 'Lavande' },
  lime: { bg: '#eef7b8', label: 'Citron' },
  sky: { bg: '#d6e8f7', label: 'Ciel' },
  rose: { bg: '#f8d7dc', label: 'Rose' },
};

export const COLOR_KEYS = Object.keys(COURSE_COLORS) as CourseColor[];

/** Jours de la semaine : 1 = lundi … 7 = dimanche */
export const WEEK_DAYS: [number, string, string][] = [
  [1, 'Lundi', 'Lun'],
  [2, 'Mardi', 'Mar'],
  [3, 'Mercredi', 'Mer'],
  [4, 'Jeudi', 'Jeu'],
  [5, 'Vendredi', 'Ven'],
  [6, 'Samedi', 'Sam'],
  [7, 'Dimanche', 'Dim'],
];

/** « Lun, Mer, Ven 18:00 · Sam 10:00 » : créneaux regroupés par heure */
export function slotSummary(slots: { dayOfWeek: number; startTime: string }[]): string {
  const byTime = new Map<string, number[]>();
  for (const s of [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek)) {
    byTime.set(s.startTime, [...(byTime.get(s.startTime) ?? []), s.dayOfWeek]);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, days]) => `${days.map(d => WEEK_DAYS[d - 1][2]).join(', ')} ${time}`)
    .join(' · ');
}
