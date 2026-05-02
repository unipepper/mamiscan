import { ChevronRight } from 'lucide-react';

interface SectionLinkButtonProps {
  label: string;
  onClick: () => void;
}

export function SectionLinkButton({ label, onClick }: SectionLinkButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-0.5 text-sm text-text-secondary hover:text-primary transition-colors py-0"
    >
      {label}
      <ChevronRight className="w-4 h-4" />
    </button>
  );
}
