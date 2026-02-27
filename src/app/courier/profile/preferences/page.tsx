'use client';

import Link from 'next/link';
import { ArrowLeft, Bell, Volume2, Moon, Globe, History, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';

export default function AppPreferencesPage() {
    const { userProfile, loading } = useUser();

    const preferenceItems = [
        { icon: Bell, title: "Enable Notifications", description: "Push alerts for new orders", id: "notifications" },
        { icon: Volume2, title: "Sound Alerts", description: "Audio cue for urgent tasks", id: "sound" },
        { icon: Moon, title: "Dark Mode", description: "Reduce eye strain at night", id: "dark-mode" },
    ];

    const dataItems = [
        { icon: Globe, title: "Language", value: "Português", href: "#" },
        { icon: History, title: "Delivery History", href: "/courier/earnings" },
    ];

    return (
        <div className="flex flex-col h-full">
            <header className="sticky top-0 z-10 flex items-center bg-background/80 backdrop-blur-md p-4 pb-4 justify-between border-b">
                <Button variant="ghost" size="icon" className="rounded-full" asChild>
                    <Link href="/courier/profile">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10 font-headline">Preferências</h1>
            </header>
            <main className="flex-1 overflow-y-auto pb-24">
                <div className="px-4 py-6">
                    <div className="flex items-center gap-4 mb-6">
                        {loading ? (
                            <>
                                <Skeleton className="size-16 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-4 w-40" />
                                </div>
                            </>
                        ) : (
                            <>
                                <Avatar className="size-16 rounded-full border-2 border-primary/20">
                                    {userProfile?.photoURL && <AvatarImage src={userProfile.photoURL} alt={userProfile.displayName || ''} />}
                                    <AvatarFallback className="text-2xl">{userProfile?.displayName?.charAt(0) || 'C'}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-xl font-bold font-headline">{userProfile?.displayName}</h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">{userProfile?.userType}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <section className="mb-8">
                    <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest px-4 pb-3">Configurações do App</h3>
                    <div className="space-y-px bg-card border-y">
                        {preferenceItems.map(item => (
                            <div key={item.id} className="flex items-center gap-4 px-4 py-3 justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 size-10">
                                        <item.icon className="size-5" />
                                    </div>
                                    <div>
                                        <p className="text-base font-medium">{item.title}</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs">{item.description}</p>
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    <Switch id={item.id} defaultChecked={item.id !== 'sound'}/>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="mb-8">
                    <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest px-4 pb-3">Conta e Dados</h3>
                     <div className="space-y-px bg-card border-y">
                        {dataItems.map(item => (
                            <Link href={item.href} key={item.title} className="flex items-center gap-4 px-4 py-4 justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="text-muted-foreground flex items-center justify-center rounded-lg bg-muted shrink-0 size-10">
                                        <item.icon className="size-5" />
                                    </div>
                                    <p className="text-base font-medium">{item.title}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {item.value && <span className="text-muted-foreground text-sm">{item.value}</span>}
                                    <ChevronRight className="text-slate-400 size-4" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
                <div className="px-4 mt-4">
                    <Button variant="outline" className="w-full h-12 font-bold text-destructive hover:text-destructive hover:bg-destructive/10">
                        Sair
                    </Button>
                    <p className="text-center text-slate-500 dark:text-slate-500 text-xs mt-6 mb-8">Version 2.4.1 (Build 108)</p>
                </div>
            </main>
        </div>
    );
}
