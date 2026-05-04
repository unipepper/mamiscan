'use client';

import { Button } from '@/components/ui/button';

interface EscapeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function EscapeButton({ onClick, disabled, children, className }: EscapeButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={`text-sm text-text-tertiary hover:text-text-secondary font-normal ${className ?? 'w-full'}`}
    >
      {children}
    </Button>
  );
}
