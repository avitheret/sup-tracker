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
  const lower = text.toLowerCase();
  if (lower.includes('morning') || lower.includes('7am')) return 'morning';
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
  const [importedCount, setImportedCount] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
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
  };

  const handleConfirm = async () => {
    if (!user || !activePatientId) return;
    setUploading(true);

    const rows = validRows.map(r => ({
      user_id: user.id,
      patient_id: activePatientId,
      name: r.name,
      time_window: r.timeWindow,
      quantity: r.quantity,
      description: r.description,
    }));

    // Delete existing entries for this patient then insert new ones
    await supabase
      .from('supplement_database')
      .delete()
      .eq('user_id', user.id)
      .eq('patient_id', activePatientId);

    const { error } = await supabase.from('supplement_database').insert(rows);

    if (!error) {
      setImportedCount(rows.length);
      await loadSupplementDatabase(activePatientId);
      setStep('done');
    }
    setUploading(false);
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
              className="w-full bg-violet-600 text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-medium min-h-[44px] active:scale-[0.98]"
            >
              <Upload size={20} />
              Choose Excel File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFile}
            />
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

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('upload'); setValidRows([]); setSkippedRows([]); }}
                className="flex-1 bg-slate-200 text-slate-700 rounded-2xl py-3 font-medium min-h-[44px] active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={uploading}
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
