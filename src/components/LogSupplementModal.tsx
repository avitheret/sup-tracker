import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPLEMENT_TIME_WINDOWS, TIME_WINDOW_ORDER } from '../types';
import type { SupplementTimeWindow } from '../types';

interface Props {
  onClose: () => void;
  prefill?: { name?: string; timeWindow?: SupplementTimeWindow; quantity?: string };
}

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    SpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

function fuzzyMatch(spoken: string, names: string[]): string | null {
  const lower = spoken.toLowerCase();
  // Exact match first
  const exact = names.find(n => n.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match
  const partial = names.find(n => lower.includes(n.toLowerCase()) || n.toLowerCase().includes(lower));
  return partial ?? null;
}

function extractQuantity(text: string): string | null {
  // Match patterns like "1000mg", "2 capsules", "500 IU", "one tablet"
  const numberWords: Record<string, string> = {
    one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  };

  const match = text.match(/(\d+)\s*(mg|mcg|iu|ml|capsule[s]?|tablet[s]?|drop[s]?|scoop[s]?|tsp|tbsp)/i);
  if (match) return match[0];

  for (const [word, num] of Object.entries(numberWords)) {
    const wordMatch = text.match(new RegExp(`${word}\\s*(mg|mcg|iu|ml|capsule[s]?|tablet[s]?|drop[s]?|scoop[s]?)`, 'i'));
    if (wordMatch) return `${num}${wordMatch[1]}`;
  }
  return null;
}

function extractTimeFromSpeech(text: string): string | null {
  const lower = text.toLowerCase();
  const timeMatch = lower.match(/at\s+(\d{1,2})\s*(am|pm)/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    if (timeMatch[2] === 'pm' && hour !== 12) hour += 12;
    if (timeMatch[2] === 'am' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00`;
  }
  if (lower.includes('breakfast')) return '08:00';
  if (lower.includes('lunch')) return '12:00';
  if (lower.includes('dinner')) return '18:00';
  if (lower.includes('before bed') || lower.includes('bedtime')) return '22:00';
  if (lower.includes('this morning') || lower.includes('morning')) return '07:00';
  return null;
}

function timeToWindow(time: string): SupplementTimeWindow | null {
  const [h] = time.split(':').map(Number);
  if (h >= 7 && h < 8) return 'morning';
  if (h >= 8 && h < 9) return 'breakfast';
  if (h >= 12 && h < 14) return 'lunch';
  if (h >= 18 && h < 20) return 'dinner';
  if (h >= 21 && h < 23) return 'bed';
  // Best guess for other times
  if (h < 8) return 'morning';
  if (h < 12) return 'breakfast';
  if (h < 18) return 'lunch';
  if (h < 21) return 'dinner';
  return 'bed';
}

export default function LogSupplementModal({ onClose, prefill }: Props) {
  const { supplementDatabase, activePatientId, addSupplementLog } = useApp();
  const [name, setName] = useState(prefill?.name ?? '');
  const [timeWindow, setTimeWindow] = useState<SupplementTimeWindow>(prefill?.timeWindow ?? 'morning');
  const [quantity, setQuantity] = useState(prefill?.quantity ?? '');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [hint, setHint] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokeRef = useRef(false);
  const saveListenerRef = useRef<SpeechRecognitionInstance | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Match name against database
  const matchedEntry = supplementDatabase.find(
    e => e.name.toLowerCase() === name.toLowerCase()
  );

  // Auto-fill from matched entry
  useEffect(() => {
    if (matchedEntry) {
      setQuantity(matchedEntry.quantity);
      setDescription(matchedEntry.description);
      setTimeWindow(matchedEntry.timeWindow);
    } else {
      setDescription('');
    }
  }, [matchedEntry]);

  // Prefill from props
  useEffect(() => {
    if (prefill?.name) {
      const match = supplementDatabase.find(
        e => e.name.toLowerCase() === prefill.name!.toLowerCase()
      );
      if (match) {
        setName(match.name);
        setQuantity(match.quantity);
        setDescription(match.description);
        setTimeWindow(match.timeWindow);
      }
    }
  }, [prefill, supplementDatabase]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;
    await addSupplementLog({
      patientId: activePatientId,
      name: name.trim(),
      quantity: quantity.trim(),
      timeWindow,
      takenAt: new Date(`${date}T${time}`).toISOString(),
      date,
      notes: notes.trim(),
    });
    onClose();
  }, [name, quantity, timeWindow, date, time, notes, activePatientId, addSupplementLog, onClose]);

  // Start save listener for voice save commands
  const startSaveListener = useCallback(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const listener = new SpeechRecognitionClass();
    listener.continuous = true;
    listener.interimResults = false;
    listener.lang = 'en-US';

    listener.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript.toLowerCase().trim();
      if (text.includes('save log') || text.includes('save it') || text.includes('save supplement') || text.includes('submit')) {
        listener.stop();
        handleSubmit();
      }
    };
    listener.onend = () => {
      // Restart if not saved
      try { listener.start(); } catch { /* ignore */ }
    };
    try {
      listener.start();
      saveListenerRef.current = listener;
    } catch { /* ignore */ }
  }, [handleSubmit]);

  // Auto-start dictation on mount
  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    // 15-second no-speech timeout
    noSpeechTimerRef.current = setTimeout(() => {
      if (!hasSpokeRef.current) {
        recognition.stop();
        setIsListening(false);
        setHint('No speech detected. Use the form to log manually.');
      }
    }, 15000);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      hasSpokeRef.current = true;
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);

      // Clear and reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // 5 seconds silence after speech — populate fields
        recognition.stop();
        setIsListening(false);
        populateFromTranscript(finalTranscript);
        setHint('Review your log and say "save log" or tap Save');
        startSaveListener();
      }, 5000);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      /* speech not available */
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
      try { recognition.abort(); } catch { /* ignore */ }
      try { saveListenerRef.current?.abort(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const populateFromTranscript = (text: string) => {
    const dbNames = supplementDatabase.map(e => e.name);
    const matchedName = fuzzyMatch(text, dbNames);
    if (matchedName) {
      setName(matchedName);
    } else {
      // Use first meaningful word as name
      const words = text.trim().split(/\s+/);
      const skipWords = new Set(['i', 'took', 'my', 'take', 'log', 'add', 'had']);
      const meaningful = words.filter(w => !skipWords.has(w.toLowerCase()));
      if (meaningful.length > 0) setName(meaningful.join(' '));
    }

    const qty = extractQuantity(text);
    if (qty) setQuantity(qty);

    const extractedTime = extractTimeFromSpeech(text);
    if (extractedTime) {
      setTime(extractedTime);
      const tw = timeToWindow(extractedTime);
      if (tw) setTimeWindow(tw);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch { /* ignore */ }
    }
  };

  const filteredSuggestions = name.length > 0
    ? supplementDatabase.filter(e => e.name.toLowerCase().includes(name.toLowerCase()))
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Log Supplement</h2>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98]">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Voice status */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleListening}
            className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center active:scale-[0.98] ${isListening ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}
          >
            {isListening ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <div className="flex-1 text-sm text-slate-500">
            {isListening ? (
              <span className="text-red-600">Listening… {transcript && `"${transcript}"`}</span>
            ) : hint ? (
              <span>{hint}</span>
            ) : (
              <span>Tap mic to start voice input</span>
            )}
          </div>
        </div>

        {/* Supplement name */}
        <div className="relative">
          <label className="text-sm font-medium text-slate-700">Supplement</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="e.g., Vitamin D3"
            className="w-full mt-1 px-3 py-3 rounded-xl border border-slate-200 text-slate-900 min-h-[44px]"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg z-10 max-h-40 overflow-y-auto">
              {filteredSuggestions.map(s => (
                <button
                  key={s.id}
                  onMouseDown={() => { setName(s.name); setShowSuggestions(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-violet-50 text-sm text-slate-700"
                >
                  {s.name} — {s.quantity}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Time window chips */}
        <div>
          <label className="text-sm font-medium text-slate-700">Timing</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {TIME_WINDOW_ORDER.map(tw => (
              <button
                key={tw}
                onClick={() => setTimeWindow(tw)}
                className={`px-3 py-2 rounded-full text-sm min-h-[44px] active:scale-[0.98] ${
                  timeWindow === tw
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {SUPPLEMENT_TIME_WINDOWS[tw].label}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-sm font-medium text-slate-700">Qty</label>
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g., 1000mg"
            className="w-full mt-1 px-3 py-3 rounded-xl border border-slate-200 text-slate-900 min-h-[44px]"
          />
        </div>

        {/* Description (read-only) */}
        {description && (
          <div>
            <label className="text-sm font-medium text-slate-700">What For</label>
            <div className="mt-1 px-3 py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 text-sm">
              {description}
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1 px-3 py-3 rounded-xl border border-slate-200 text-slate-900 min-h-[44px]"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-700">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full mt-1 px-3 py-3 rounded-xl border border-slate-200 text-slate-900 min-h-[44px]"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full mt-1 px-3 py-3 rounded-xl border border-slate-200 text-slate-900 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full bg-violet-600 text-white rounded-2xl py-4 font-medium min-h-[44px] active:scale-[0.98] disabled:opacity-50"
        >
          Save Log
        </button>
      </div>
    </div>
  );
}
