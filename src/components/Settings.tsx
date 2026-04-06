import { useState } from 'react';
import { LogOut, Bell, BellOff, UserPlus, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { APP_VERSION } from '../types';
import UploadSupplements from './UploadSupplements';

export default function Settings() {
  const { signOut } = useAuth();
  const { patients, activePatientId, setActivePatientId, notificationPrefs, setNotificationPrefs, addPatient } = useApp();
  const [showUpload, setShowUpload] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);

  if (showUpload) {
    return <UploadSupplements onBack={() => setShowUpload(false)} />;
  }

  const handleAddPatient = async () => {
    if (!newPatientName.trim()) return;
    await addPatient(newPatientName.trim());
    setNewPatientName('');
    setShowAddPatient(false);
  };

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 z-10">
        <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Patient switcher */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Patient</h3>
          <div className="space-y-2">
            {patients.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePatientId(p.id)}
                className={`w-full text-left px-4 py-3 rounded-xl min-h-[44px] active:scale-[0.98] ${
                  activePatientId === p.id
                    ? 'bg-violet-100 text-violet-700 font-medium'
                    : 'bg-slate-50 text-slate-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {showAddPatient ? (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                placeholder="Patient name"
                className="flex-1 px-3 py-3 rounded-xl border border-slate-200 text-slate-900 min-h-[44px]"
                onKeyDown={(e) => e.key === 'Enter' && handleAddPatient()}
                autoFocus
              />
              <button
                onClick={handleAddPatient}
                className="bg-violet-600 text-white px-4 rounded-xl min-h-[44px] active:scale-[0.98]"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPatient(true)}
              className="mt-3 flex items-center gap-2 text-sm text-violet-600 font-medium min-h-[44px] active:scale-[0.98]"
            >
              <UserPlus size={18} />
              Add Patient
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <button
            onClick={() => setNotificationPrefs({ enabled: !notificationPrefs.enabled })}
            className="w-full flex items-center gap-3 min-h-[44px] active:scale-[0.98]"
          >
            {notificationPrefs.enabled ? (
              <Bell size={22} className="text-violet-600" />
            ) : (
              <BellOff size={22} className="text-slate-400" />
            )}
            <span className="flex-1 text-left text-slate-900 font-medium">
              Notifications
            </span>
            <div className={`w-12 h-7 rounded-full relative transition-colors ${notificationPrefs.enabled ? 'bg-violet-600' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${notificationPrefs.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>

        {/* Manage supplement list */}
        <button
          onClick={() => setShowUpload(true)}
          className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3 min-h-[44px] active:scale-[0.98]"
        >
          <Upload size={22} className="text-violet-600" />
          <span className="text-slate-900 font-medium">Manage Supplement List</span>
        </button>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3 min-h-[44px] active:scale-[0.98]"
        >
          <LogOut size={22} className="text-red-500" />
          <span className="text-red-500 font-medium">Sign Out</span>
        </button>

        <p className="text-center text-xs text-slate-400">SupplementTracker v{APP_VERSION}</p>
      </div>
    </div>
  );
}
