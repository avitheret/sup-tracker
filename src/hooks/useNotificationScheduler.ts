import { useEffect } from 'react';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';
import type { SupplementEntry, SupplementLog } from '../types';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function useNotificationScheduler(
  database: SupplementEntry[],
  logs: SupplementLog[],
  enabled: boolean,
) {
  // Request notification permission on mount
  useEffect(() => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (database.length === 0) return;

    const check = () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      for (const entry of database) {
        const window = SUPPLEMENT_TIME_WINDOWS[entry.timeWindow];
        const startMin = timeToMinutes(window.start);
        const endMin = timeToMinutes(window.end);

        if (currentMinutes < startMin || currentMinutes > endMin) continue;

        // Check if already logged today
        const logged = logs.some(
          l => l.date === today && l.name.toLowerCase() === entry.name.toLowerCase()
        );
        if (logged) continue;

        // Check if notification already sent
        const notifKey = `st-notif-${today}-${entry.name}-${window.start}`;
        if (localStorage.getItem(notifKey)) continue;

        // Send notification
        new Notification(entry.name, {
          body: `Take ${entry.quantity} — ${window.label}`,
          icon: '/pwa-192x192.png',
          tag: notifKey,
        });
        localStorage.setItem(notifKey, '1');
      }
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [database, logs, enabled]);
}
