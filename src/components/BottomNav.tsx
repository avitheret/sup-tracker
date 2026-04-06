import { FlaskConical, ClipboardList, Settings } from 'lucide-react';

export type Tab = 'today' | 'logs' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: typeof FlaskConical }[] = [
  { id: 'today', label: 'Today', icon: FlaskConical },
  { id: 'logs', label: 'Logs', icon: ClipboardList },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex flex-col items-center py-2 min-h-[44px] active:scale-[0.98] ${
            active === id ? 'text-violet-600' : 'text-slate-400'
          }`}
        >
          <Icon size={22} />
          <span className="text-xs mt-0.5">{label}</span>
        </button>
      ))}
    </nav>
  );
}
