import { useEffect, useRef, useCallback, useState } from 'react';
import type { SupplementTimeWindow } from '../types';

interface VoiceCommandResult {
  action: 'LOG_SUPPLEMENT';
  prefill: { name?: string; timeWindow?: SupplementTimeWindow; quantity?: string };
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

const TIME_WINDOW_KEYWORDS: Record<string, SupplementTimeWindow> = {
  morning: 'morning',
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  bed: 'bed',
  bedtime: 'bed',
};

export function useVoiceCommands(
  supplementNames: string[],
  onCommand: (result: VoiceCommandResult) => void,
) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const wakeDetectedRef = useRef(false);
  const commandBufferRef = useRef('');
  const commandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processCommand = useCallback((text: string) => {
    const lower = text.toLowerCase();
    const prefill: VoiceCommandResult['prefill'] = {};

    // Check for time window keywords
    for (const [keyword, tw] of Object.entries(TIME_WINDOW_KEYWORDS)) {
      if (lower.includes(keyword)) {
        prefill.timeWindow = tw;
        break;
      }
    }

    // Fuzzy match supplement name
    for (const name of supplementNames) {
      if (lower.includes(name.toLowerCase())) {
        prefill.name = name;
        break;
      }
    }

    // If no specific name found, try to extract after common phrases
    if (!prefill.name) {
      const patterns = [
        /took\s+(?:my\s+)?(.+?)(?:\s+\d|\s*$)/i,
        /log\s+(?:my\s+)?(.+?)(?:\s+\d|\s*$)/i,
        /add\s+(.+?)(?:\s+\d|\s*$)/i,
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const extracted = match[1].trim();
          // Fuzzy match extracted text against database
          const dbMatch = supplementNames.find(n =>
            n.toLowerCase().includes(extracted.toLowerCase()) ||
            extracted.toLowerCase().includes(n.toLowerCase())
          );
          if (dbMatch) prefill.name = dbMatch;
          break;
        }
      }
    }

    // Extract quantity
    const qtyMatch = text.match(/(\d+)\s*(mg|mcg|iu|ml|capsule[s]?|tablet[s]?)/i);
    if (qtyMatch) prefill.quantity = qtyMatch[0];

    onCommand({ action: 'LOG_SUPPLEMENT', prefill });
  }, [supplementNames, onCommand]);

  useEffect(() => {
    const SpeechRecognitionClass = (window as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition
      || (window as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const lower = transcript.toLowerCase();

      // Detect wake phrase
      if (!wakeDetectedRef.current) {
        // Exact match
        if (lower.includes('hey tracker')) {
          wakeDetectedRef.current = true;
          // Extract everything after wake phrase
          const afterWake = lower.split('hey tracker').slice(1).join('').trim();
          if (afterWake) {
            commandBufferRef.current = afterWake;
          }
          // Set timer for command processing
          if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
          commandTimerRef.current = setTimeout(() => {
            if (commandBufferRef.current) {
              processCommand(commandBufferRef.current);
            } else {
              // Just wake with no command — check if supplement/vitamin related
              onCommand({ action: 'LOG_SUPPLEMENT', prefill: {} });
            }
            wakeDetectedRef.current = false;
            commandBufferRef.current = '';
          }, 3000);
          return;
        }
        // Fuzzy regex for wake detection
        if (/he+y?\s+track(er)?/i.test(lower)) {
          wakeDetectedRef.current = true;
          if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
          commandTimerRef.current = setTimeout(() => {
            processCommand(commandBufferRef.current || '');
            wakeDetectedRef.current = false;
            commandBufferRef.current = '';
          }, 3000);
          return;
        }
      } else {
        // After wake, accumulate command
        commandBufferRef.current = transcript;
        // Reset timer
        if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
        commandTimerRef.current = setTimeout(() => {
          processCommand(commandBufferRef.current);
          wakeDetectedRef.current = false;
          commandBufferRef.current = '';
        }, 3000);
      }
    };

    recognition.onend = () => {
      // Restart recognition
      setIsListening(false);
      try {
        setTimeout(() => {
          recognition.start();
          setIsListening(true);
        }, 100);
      } catch { /* ignore */ }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch { /* ignore */ }

    return () => {
      if (commandTimerRef.current) clearTimeout(commandTimerRef.current);
      try { recognition.abort(); } catch { /* ignore */ }
    };
  }, [processCommand, onCommand]);

  return { isListening };
}
