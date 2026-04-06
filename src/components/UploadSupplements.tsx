import { useState, useRef } from 'react';
import { read, utils } from 'xlsx';
import { Upload, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import type { SupplementTimeWindow } from '../types';

interface ParsedRow {
  name: string;
  timeWindow: SupplementTimeWindow;
  quantity: string;
  description: string;
}

interface SkippedRow {
  row: number;
  reason: string;
}

function parseTimeWindow(text: string): SupplementTimeWindow | null {
  const lower = text.toLowerCase().trim();
  if (lower.includes('first thing') || lower.includes('morning') || lower.includes('7am')) return 'morning';
  if (lower.includes('breakfast') || lower.includes('8am')) return 'breakfast';
  if (lower.includes('lunch') || lower.includes('12pm')) return 'lunch';
  if (lower.includes('dinner') || lower.includes('6pm')) return 'dinner';
  if (lower.includes('bed') || lower.includes('9pm')) return 'bed';
  return null;
}

export default function UploadSupplements({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { activePatientId, loadSupplementDatabase } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dbNotSetUp, setDbNotSetUp] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  // Safari-safe: wrap FileReader in a Promise rather than using file.arrayBuffer()
  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('Failed to read file as ArrayBuffer'));
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsArrayBuffer(file);
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so the same file can be re-selected after cancel
    e.target.value = '';
    if (!file) return;

    setParsing(true);
    setUploadError(null);

    try {
      const buffer = await readFileAsArrayBuffer(file);
      const workbook = read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = utils.sheet_to_json<string[]>(sheet, { header: 1 });

      const valid: ParsedRow[] = [];
      const skipped: SkippedRow[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const name = String(row[0] ?? '').trim();
        const timeText = String(row[1] ?? '').trim();
        const quantity = String(row[2] ?? '').trim();
        const description = String(row[3] ?? '').trim();

        if (!name) {
          skipped.push({ row: i + 1, reason: 'Missing supplement name (Col A)' });
          continue;
        }
        const timeWindow = parseTimeWindow(timeText);
        if (!timeWindow) {
          skipped.push({ row: i + 1, reason: `Cannot map time window: "${timeText}"` });
          continue;
        }
        if (!quantity) {
          skipped.push({ row: i + 1, reason: 'Missing quantity (Col C)' });
          continue;
        }

        valid.push({ name, timeWindow, quantity, description });
      }

      setValidRows(valid);
      setSkippedRows(skipped);
      setStep('preview');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to read file. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!user) {
      setUploadError('You must be signed in to upload supplements.');
      return;
    }
    if (!activePatientId) {
      setUploadError('No active patient selected. Go to Settings and add a patient first.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const rows = validRows.map(r => ({
        user_id: user.id,
        patient_id: activePatientId,
        name: r.name,
        time_window: r.timeWindow,
        quantity: r.quantity,
        description: r.description,
      }));

      // Delete existing entries for this patient then insert new ones
      const { error: deleteError } = await supabase
        .from('supplement_database')
        .delete()
        .eq('user_id', user.id)
        .eq('patient_id', activePatientId);

      if (deleteError) {
        if (deleteError.message.includes('schema cache') || deleteError.code === 'PGRST205') {
          throw new Error('DATABASE_NOT_SET_UP');
        }
        throw new Error(`Failed to clear old data: ${deleteError.message}`);
      }

      const { error: insertError } = await supabase.from('supplement_database').insert(rows);

      if (insertError) {
        if (insertError.message.includes('schema cache') || insertError.code === 'PGRST205') {
          throw new Error('DATABASE_NOT_SET_UP');
        }
        throw new Error(`Failed to save supplements: ${insertError.message}`);
      }

      setImportedCount(rows.length);
      await loadSupplementDatabase(activePatientId);
      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      if (msg === 'DATABASE_NOT_SET_UP') {
        setDbNotSetUp(true);
      } else {
        setUploadError(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const timeWindowLabels: Record<SupplementTimeWindow, string> = {
    morning: 'Morning',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    bed: 'Before Bed',
  };

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={onBack} className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98]">
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Upload Supplements</h1>
      </div>

      <div className="p-4 space-y-4">
        {dbNotSetUp && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
            <p className="font-semibold text-amber-900">Database tables not set up</p>
            <p className="text-sm text-amber-800">Run this SQL in your Supabase project (SQL Editor → New query):</p>
            <pre className="text-xs bg-amber-100 rounded-xl p-3 overflow-x-auto text-amber-900 whitespace-pre-wrap">{`-- patients
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
alter table patients enable row level security;
drop policy if exists "users manage own patients" on patients;
create policy "users manage own patients" on patients
  for all using (auth.uid() = user_id);

-- supplement_database
create table if not exists supplement_database (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  patient_id text not null,
  name text not null,
  time_window text not null,
  quantity text not null,
  description text not null,
  created_at timestamptz default now()
);
alter table supplement_database enable row level security;
drop policy if exists "users manage own" on supplement_database;
create policy "users manage own" on supplement_database
  for all using (auth.uid() = user_id);

-- supplement_logs
create table if not exists supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  patient_id text not null,
  name text not null,
  quantity text not null,
  time_window text not null,
  taken_at timestamptz default now(),
  date text not null,
  notes text default '',
  created_at timestamptz default now()
);
alter table supplement_logs enable row level security;
drop policy if exists "users manage own logs" on supplement_logs;
create policy "users manage own logs" on supplement_logs
  for all using (auth.uid() = user_id);`}</pre>
            <p className="text-xs text-amber-700">After running the SQL, sign out and sign back in, then try again.</p>
            <button
              onClick={() => setDbNotSetUp(false)}
              className="text-sm text-amber-700 underline min-h-[44px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {step === 'upload' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Excel Format</h2>
              <div className="text-sm text-slate-600 space-y-1">
                <p><strong>Col A:</strong> Supplement name</p>
                <p><strong>Col B:</strong> When to take (e.g., "With Breakfast (8am-9am)")</p>
                <p><strong>Col C:</strong> Quantity (e.g., "1000mg")</p>
                <p><strong>Col D:</strong> What it's used for</p>
              </div>
              <p className="text-xs text-slate-400">Row 1 is treated as header and skipped.</p>
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="w-full bg-violet-600 text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-medium min-h-[44px] active:scale-[0.98] disabled:opacity-50"
            >
              <Upload size={20} />
              {parsing ? 'Reading file…' : 'Choose Excel File'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFile}
            />
            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <h2 className="font-semibold text-slate-900 mb-3">{validRows.length} supplements found</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="pb-2 pr-2">Name</th>
                      <th className="pb-2 pr-2">When</th>
                      <th className="pb-2 pr-2">Qty</th>
                      <th className="pb-2">What For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-2 pr-2 text-slate-900">{r.name}</td>
                        <td className="py-2 pr-2 text-slate-600">{timeWindowLabels[r.timeWindow]}</td>
                        <td className="py-2 pr-2 text-slate-600">{r.quantity}</td>
                        <td className="py-2 text-slate-500">{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {skippedRows.length > 0 && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={18} className="text-amber-600" />
                  <span className="font-medium text-amber-800">{skippedRows.length} rows skipped</span>
                </div>
                {skippedRows.map((s, i) => (
                  <p key={i} className="text-sm text-amber-700">Row {s.row}: {s.reason}</p>
                ))}
              </div>
            )}

            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('upload'); setValidRows([]); setSkippedRows([]); setUploadError(null); }}
                className="flex-1 bg-slate-200 text-slate-700 rounded-2xl py-3 font-medium min-h-[44px] active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={uploading || validRows.length === 0}
                className="flex-1 bg-violet-600 text-white rounded-2xl py-3 font-medium min-h-[44px] active:scale-[0.98] disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Confirm Upload'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center space-y-3">
            <CheckCircle size={48} className="text-green-500 mx-auto" />
            <h2 className="font-semibold text-slate-900">{importedCount} supplements imported</h2>
            <button
              onClick={onBack}
              className="bg-violet-600 text-white rounded-2xl px-6 py-3 font-medium min-h-[44px] active:scale-[0.98]"
            >
              View Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
