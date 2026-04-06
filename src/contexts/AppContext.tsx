import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { SupplementEntry, SupplementLog, Patient, SupplementTimeWindow } from '../types';

interface AppContextType {
  supplementDatabase: SupplementEntry[];
  supplementLogs: SupplementLog[];
  patients: Patient[];
  activePatientId: string;
  notificationPrefs: { enabled: boolean };
  loadSupplementDatabase: (patientId: string) => Promise<void>;
  addSupplementLog: (log: Omit<SupplementLog, 'id'>) => Promise<void>;
  deleteSupplementLog: (id: string) => Promise<void>;
  setActivePatientId: (id: string) => void;
  setNotificationPrefs: (prefs: { enabled: boolean }) => void;
  addPatient: (name: string) => Promise<void>;
  loadLogs: (patientId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [supplementDatabase, setSupplementDatabase] = useState<SupplementEntry[]>([]);
  const [supplementLogs, setSupplementLogs] = useState<SupplementLog[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatientId, setActivePatientIdState] = useState<string>('');
  const [notificationPrefs, setNotificationPrefs] = useState({ enabled: true });

  const loadPatients = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('patients')
      .select('id, name')
      .eq('user_id', user.id);
    if (data && data.length > 0) {
      setPatients(data);
      if (!activePatientId) {
        setActivePatientIdState(data[0].id);
      }
    }
  }, [user, activePatientId]);

  const loadSupplementDatabase = useCallback(async (patientId: string) => {
    if (!user || !patientId) return;
    const { data } = await supabase
      .from('supplement_database')
      .select('*')
      .eq('user_id', user.id)
      .eq('patient_id', patientId);
    if (data) {
      setSupplementDatabase(data.map(d => ({
        id: d.id,
        patientId: d.patient_id,
        name: d.name,
        timeWindow: d.time_window as SupplementTimeWindow,
        quantity: d.quantity,
        description: d.description,
      })));
    }
  }, [user]);

  const loadLogs = useCallback(async (patientId: string) => {
    if (!user || !patientId) return;
    const { data } = await supabase
      .from('supplement_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('patient_id', patientId)
      .order('taken_at', { ascending: false })
      .limit(200);
    if (data) {
      setSupplementLogs(data.map(d => ({
        id: d.id,
        patientId: d.patient_id,
        name: d.name,
        quantity: d.quantity,
        timeWindow: d.time_window as SupplementTimeWindow,
        takenAt: d.taken_at,
        date: d.date,
        notes: d.notes ?? '',
      })));
    }
  }, [user]);

  const addSupplementLog = useCallback(async (log: Omit<SupplementLog, 'id'>) => {
    if (!user) return;
    const { data } = await supabase
      .from('supplement_logs')
      .insert({
        user_id: user.id,
        patient_id: log.patientId,
        name: log.name,
        quantity: log.quantity,
        time_window: log.timeWindow,
        taken_at: log.takenAt,
        date: log.date,
        notes: log.notes,
      })
      .select()
      .single();
    if (data) {
      setSupplementLogs(prev => [{
        id: data.id,
        patientId: data.patient_id,
        name: data.name,
        quantity: data.quantity,
        timeWindow: data.time_window as SupplementTimeWindow,
        takenAt: data.taken_at,
        date: data.date,
        notes: data.notes ?? '',
      }, ...prev]);
    }
  }, [user]);

  const deleteSupplementLog = useCallback(async (id: string) => {
    await supabase.from('supplement_logs').delete().eq('id', id);
    setSupplementLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  const setActivePatientId = useCallback((id: string) => {
    setActivePatientIdState(id);
  }, []);

  const addPatient = useCallback(async (name: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('patients')
      .insert({ user_id: user.id, name })
      .select()
      .single();
    if (data) {
      setPatients(prev => [...prev, { id: data.id, name: data.name }]);
      setActivePatientIdState(data.id);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadPatients();
  }, [user, loadPatients]);

  useEffect(() => {
    if (activePatientId) {
      loadSupplementDatabase(activePatientId);
      loadLogs(activePatientId);
    }
  }, [activePatientId, loadSupplementDatabase, loadLogs]);

  return (
    <AppContext.Provider value={{
      supplementDatabase,
      supplementLogs,
      patients,
      activePatientId,
      notificationPrefs,
      loadSupplementDatabase,
      addSupplementLog,
      deleteSupplementLog,
      setActivePatientId,
      setNotificationPrefs,
      addPatient,
      loadLogs,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
