import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MobileLayoutProps = {
  children: ReactNode;
  className?: string;
};

export function MobileLayout({ children, className }: MobileLayoutProps) {
  return (
    <div className={cn("relative flex h-dvh w-full flex-col max-w-md mx-auto bg-background shadow-2xl outline-none", className)} tabIndex={-1}>
      {children}
    </div>
  );
}
