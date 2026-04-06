import { useState, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useApp } from './contexts/AppContext';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useNotificationScheduler } from './hooks/useNotificationScheduler';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import LogsPage from './components/LogsPage';
import Settings from './components/Settings';
import BottomNav from './components/BottomNav';
import LogSupplementModal from './components/LogSupplementModal';
import type { Tab } from './components/BottomNav';
import type { SupplementTimeWindow } from './types';

function AuthenticatedApp() {
  const { supplementDatabase, supplementLogs, notificationPrefs } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [voiceModal, setVoiceModal] = useState<{
    open: boolean;
    prefill?: { name?: string; timeWindow?: SupplementTimeWindow; quantity?: string };
  }>({ open: false });

  const handleVoiceCommand = useCallback((result: { action: string; prefill: { name?: string; timeWindow?: SupplementTimeWindow; quantity?: string } }) => {
    if (result.action === 'LOG_SUPPLEMENT') {
      setVoiceModal({ open: true, prefill: result.prefill });
    }
  }, []);

  useVoiceCommands(
    supplementDatabase.map(e => e.name),
    handleVoiceCommand,
  );

  useNotificationScheduler(supplementDatabase, supplementLogs, notificationPrefs.enabled);

  return (
    <div className="min-h-screen bg-slate-50">
      {activeTab === 'today' && <Dashboard />}
      {activeTab === 'logs' && <LogsPage />}
      {activeTab === 'settings' && <Settings />}
      <BottomNav active={activeTab} onChange={setActiveTab} />

      {voiceModal.open && (
        <LogSupplementModal
          onClose={() => setVoiceModal({ open: false })}
          prefill={voiceModal.prefill}
        />
      )}
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <AuthenticatedApp />;
}
