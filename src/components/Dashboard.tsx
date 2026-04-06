import { useState } from 'react';
import { CheckCircle, Circle, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_TIME_WINDOWS, TIME_WINDOW_ORDER } from '../types';
import type { SupplementTimeWindow } from '../types';
import LogSupplementModal from './LogSupplementModal';
import UploadSupplements from './UploadSupplements';

export default function Dashboard() {
  const { supplementDatabase, supplementLogs, deleteSupplementLog } = useApp();
  const [showLogModal, setShowLogModal] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [prefill, setPrefill] = useState<{ name?: string; timeWindow?: SupplementTimeWindow; quantity?: string } | undefined>();
  const [swipingId, setSwipingId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = supplementLogs.filter(l => l.date === today);
  const recentLogs = supplementLogs.slice(0, 10);

  const isLogged = (name: string) =>
    todayLogs.some(l => l.name.toLowerCase() === name.toLowerCase());

  const getLogTime = (name: string) => {
    const log = todayLogs.find(l => l.name.toLowerCase() === name.toLowerCase());
    if (!log) return null;
    return new Date(log.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const groupedByWindow = TIME_WINDOW_ORDER.map(tw => ({
    window: tw,
    label: SUPPLEMENT_TIME_WINDOWS[tw].label,
    entries: supplementDatabase.filter(e => e.timeWindow === tw),
  })).filter(g => g.entries.length > 0);

  if (showUpload) {
    return <UploadSupplements onBack={() => setShowUpload(false)} />;
  }

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg font-semibold text-slate-900">Today's Supplements</h1>
        <button
          onClick={() => { setPrefill(undefined); setShowLogModal(true); }}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-violet-600 rounded-full active:scale-[0.98]"
        >
          <Plus size={22} className="text-white" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {groupedByWindow.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center space-y-3">
            <p className="text-slate-500">No supplements loaded yet.</p>
            <button
              onClick={() => setShowUpload(true)}
              className="bg-violet-600 text-white rounded-2xl px-6 py-3 font-medium min-h-[44px] active:scale-[0.98]"
            >
              Upload Supplement List
            </button>
          </div>
        ) : (
          <>
            {groupedByWindow.map(group => (
              <div key={group.window} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <h3 className="text-sm font-semibold text-violet-600 mb-3">{group.label}</h3>
                <div className="space-y-2">
                  {group.entries.map(entry => {
                    const logged = isLogged(entry.name);
                    const logTime = getLogTime(entry.name);
                    return (
                      <button
                        key={entry.id}
                        onClick={() => {
                          if (!logged) {
                            setPrefill({ name: entry.name, timeWindow: entry.timeWindow, quantity: entry.quantity });
                            setShowLogModal(true);
                          }
                        }}
                        className={`w-full text-left flex items-center gap-3 p-3 rounded-xl min-h-[44px] active:scale-[0.98] ${
                          logged ? 'bg-green-50' : 'bg-slate-50'
                        }`}
                      >
                        {logged ? (
                          <CheckCircle size={22} className="text-green-500 shrink-0" />
                        ) : (
                          <Circle size={22} className="text-slate-300 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className={`font-medium ${logged ? 'text-green-700' : 'text-slate-900'}`}>
                              {entry.name}
                            </span>
                            <span className="text-sm text-slate-400">{entry.quantity}</span>
                          </div>
                          {entry.description && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{entry.description}</p>
                          )}
                        </div>
                        {logTime && (
                          <span className="text-xs text-green-600 shrink-0">{logTime}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowUpload(true)}
              className="w-full text-center text-sm text-violet-600 font-medium py-2 min-h-[44px] active:scale-[0.98]"
            >
              Manage Supplement List
            </button>
          </>
        )}

        {/* Recent logs */}
        {recentLogs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Logs</h3>
            <div className="space-y-1">
              {recentLogs.map(log => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-2 rounded-lg relative overflow-hidden"
                  onTouchStart={(e) => {
                    const startX = e.touches[0].clientX;
                    const el = e.currentTarget;
                    const onMove = (ev: TouchEvent) => {
                      const dx = ev.touches[0].clientX - startX;
                      if (dx < -50) setSwipingId(log.id);
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
                      <span className="text-sm font-medium text-slate-900">{log.name}</span>
                      <span className="text-xs text-slate-400">{log.quantity}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(log.takenAt).toLocaleDateString()} {new Date(log.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {swipingId === log.id && (
                    <button
                      onClick={() => { deleteSupplementLog(log.id); setSwipingId(null); }}
                      className="bg-red-500 text-white p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98]"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLogModal && (
        <LogSupplementModal
          onClose={() => setShowLogModal(false)}
          prefill={prefill}
        />
      )}
    </div>
  );
}
