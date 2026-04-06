export const APP_VERSION = '1.0.0';

export const SUPPLEMENT_TIME_WINDOWS = {
  morning:   { label: 'First thing in the morning', start: '07:00', end: '08:00' },
  breakfast: { label: 'With Breakfast',             start: '08:00', end: '09:00' },
  lunch:     { label: 'With Lunch',                 start: '12:00', end: '14:00' },
  dinner:    { label: 'With Dinner',                start: '18:00', end: '20:00' },
  bed:       { label: 'Before Bed',                 start: '21:00', end: '23:00' },
} as const;
export type SupplementTimeWindow = keyof typeof SUPPLEMENT_TIME_WINDOWS;

export const TIME_WINDOW_ORDER: SupplementTimeWindow[] = ['morning', 'breakfast', 'lunch', 'dinner', 'bed'];

export interface SupplementEntry {
  id: string;
  patientId: string;
  name: string;
  timeWindow: SupplementTimeWindow;
  quantity: string;
  description: string;
}

export interface SupplementLog {
  id: string;
  patientId: string;
  name: string;
  quantity: string;
  timeWindow: SupplementTimeWindow;
  takenAt: string;
  date: string;
  notes: string;
}

export interface Patient {
  id: string;
  name: string;
}
