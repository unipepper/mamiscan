'use client';

import { Check } from 'lucide-react';

interface HintCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  showHint?: boolean;
  shaking?: boolean;
  className?: string;
}

export function HintCheckbox({ checked, onChange, label, hint, showHint, shaking, className }: HintCheckboxProps) {
  return (
    <div className={className}>
      <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 cursor-pointer w-full text-left">
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-danger-fg border-danger-fg' : showHint ? 'border-danger-fg' : 'border-border-subtle'} ${shaking ? 'animate-shake' : ''}`}>
          {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </span>
        <span className="text-sm text-text-secondary">{label}</span>
      </button>
      {showHint && hint && (
        <p className="text-xs text-danger-fg mt-1 pl-8">{hint}</p>
      )}
    </div>
  );
}
