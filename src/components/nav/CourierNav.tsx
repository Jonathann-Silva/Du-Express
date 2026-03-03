
'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { List, Wallet, User, MessageSquare } from 'lucide-react';

const navItems = [
  { href: '/courier', label: 'Tarefas', icon: List },
  { href: '/courier/chat', label: 'Chat', icon: MessageSquare },
  { href: '/courier/earnings', label: 'Ganhos', icon: Wallet },
  { href: '/courier/profile', label: 'Perfil', icon: User },
];

export function CourierNav() {
  const pathname = usePathname();

  return (
    <nav className="absolute bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t px-2 pt-3 pb-8 flex justify-around items-center z-10">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/courier' && pathname.startsWith(href));
        return (
          <Link href={href} key={label} className={cn(
            'flex flex-1 flex-col items-center gap-1 transition-colors',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )}>
            <Icon className="size-6" fill={isActive ? 'currentColor' : 'none'} />
            <span className="text-[10px] font-bold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
