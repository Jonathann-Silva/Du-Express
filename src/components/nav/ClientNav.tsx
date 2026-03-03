
'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Home, PlusSquare, History, MessageSquare } from 'lucide-react';

const navItems = [
  { href: '/client', label: 'Início', icon: Home },
  { href: '/client/request', label: 'Novo Pedido', icon: PlusSquare },
  { href: '/client/chat', label: 'Chat', icon: MessageSquare },
  { href: '/client/history', label: 'Histórico', icon: History },
];

export function ClientNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t pb-safe-area-inset-bottom">
        <div className="flex items-center justify-around max-w-md mx-auto h-20">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link href={href} key={label} className={cn(
                'flex flex-col items-center gap-1',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                <Icon className="size-6" fill={isActive ? 'currentColor' : 'none'} />
                <span className={cn(
                  'text-[10px]',
                  isActive ? 'font-bold' : 'font-medium'
                )}>{label}</span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
