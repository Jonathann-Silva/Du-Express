
'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Truck, Wallet, Users, Settings, MessageSquare } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Painel', icon: LayoutDashboard },
  { href: '/admin/deliveries', label: 'Entregas', icon: Truck },
  { href: '/admin/finance', label: 'Finanças', icon: Wallet },
  { href: '/admin/chats', label: 'Chats', icon: MessageSquare },
  { href: '/admin/users', label: 'Usuários', icon: Users },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="absolute bottom-0 w-full flex border-t bg-card/95 backdrop-blur-md px-2 pb-8 pt-3 z-20">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link href={href} key={label} className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )}>
            <Icon className="size-6" strokeWidth={isActive ? 2.5 : 2} />
            <p className={cn(
              'text-[10px] tracking-tight',
              isActive ? 'font-bold' : 'font-medium'
            )}>{label}</p>
          </Link>
        );
      })}
    </nav>
  );
}
