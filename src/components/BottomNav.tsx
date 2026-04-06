'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ScanBarcode, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: '홈', path: '/home' },
  { icon: ScanBarcode, label: '스캔', path: '/scan' },
  { icon: Clock, label: '히스토리', path: '/history' },
  { icon: User, label: '내 정보', path: '/settings' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 z-50 border-t border-border-subtle bg-bg-surface">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors',
                isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <Icon className={cn('h-6 w-6', isActive && 'fill-primary/20')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
