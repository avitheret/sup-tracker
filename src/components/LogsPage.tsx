import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_TIME_WINDOWS } from '../types';

export default function LogsPage() {
  const { supplementLogs, deleteSupplementLog } = useApp();
  const [swipingId, setSwipingId] = useState<string | null>(null);

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 z-10">
        <h1 className="text-lg font-semibold text-slate-900">Log History</h1>
      </div>

      <div className="p-4 space-y-2">
        {supplementLogs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
            <p className="text-slate-500">No logs yet. Log your first supplement!</p>
          </div>
        ) : (
          supplementLogs.map(log => (
            <div
              key={log.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3"
              onTouchStart={(e) => {
                const startX = e.touches[0].clientX;
                const el = e.currentTarget;
                const onMove = (ev: TouchEvent) => {
                  if (ev.touches[0].clientX - startX < -50) setSwipingId(log.id);
                };
                const onEnd = () => {
                  el.removeEventListener('touchmove', onMove);
                  el.removeEventListener('touchend', onEnd);
                };
                el.addEventListener('touchmove', onMove);
                el.addEventListener('touchend', onEnd);
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-slate-900">{log.name}</span>
                  <span className="text-sm text-slate-400">{log.quantity}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                    {SUPPLEMENT_TIME_WINDOWS[log.timeWindow]?.label ?? log.timeWindow}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(log.takenAt).toLocaleDateString()} {new Date(log.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {log.notes && (
                  <p className="text-xs text-slate-400 mt-1">{log.notes}</p>
                )}
              </div>
              {swipingId === log.id && (
                <button
                  onClick={() => { deleteSupplementLog(log.id); setSwipingId(null); }}
                  className="bg-red-500 text-white p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98] shrink-0"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
