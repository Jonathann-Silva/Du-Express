
'use client';

import { useState, useMemo } from 'react';
import { MessageSquare, Search, Building, Bike, ArrowLeft } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatRoom, UserProfile } from '@/lib/types';

export default function AdminChatListPage() {
  const { userProfile } = useUser();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);

  // Busca salas de chat existentes para pegar metadados (última msg, unread)
  const chatsQuery = useMemo(() => {
    if (!firestore || userProfile?.role !== 'admin') return null;
    return query(collection(firestore, 'chats'), orderBy('lastMessageAt', 'desc'), limit(100));
  }, [firestore, userProfile]);

  const { data: rooms, loading: loadingRooms } = useCollection<ChatRoom>(chatsQuery);

  // Busca todos os usuários (Lojas e Motoboys) para listar no "WhatsApp"
  const usersQuery = useMemo(() => {
    if (!firestore || userProfile?.role !== 'admin') return null;
    return query(collection(firestore, 'users'), where('role', 'in', ['client', 'courier']));
  }, [firestore, userProfile]);

  const { data: allUsers, loading: loadingUsers } = useCollection<UserProfile>(usersQuery);

  // Unifica a lista: Todos os usuários, ordenados por quem tem mensagem mais recente
  const contactList = useMemo(() => {
    if (!allUsers) return [];
    
    return allUsers.map(user => {
        const room = rooms?.find(r => r.id === `admin_${user.uid}`);
        return {
            user,
            room,
            lastMessageAt: room?.lastMessageAt?.toDate() || new Date(0)
        };
    }).sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }, [allUsers, rooms]);

  const filteredContacts = useMemo(() => {
    return contactList.filter(item => 
      !searchQuery || item.user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [contactList, searchQuery]);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedChatId(`admin_${user.uid}`);
    setSelectedRecipient(user);
  };

  const isLoading = loadingRooms || loadingUsers;

  return (
    <div className="flex h-full bg-background overflow-hidden outline-none">
      {/* Sidebar Estilo WhatsApp */}
      <aside className={cn(
        "w-full md:w-96 border-r flex flex-col bg-card/50 transition-all",
        selectedChatId ? "hidden md:flex" : "flex"
      )}>
        <header className="p-4 space-y-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-headline tracking-tight">Atendimentos</h1>
            <div className="size-10 flex items-center justify-center bg-primary/10 text-primary rounded-full">
                <MessageSquare size={20} />
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input 
              placeholder="Buscar loja ou motoboy..." 
              className="pl-9 h-11 rounded-2xl bg-muted/50 border-none focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-px">
            {isLoading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map(({ user, room }) => {
                const isActive = selectedChatId === `admin_${user.uid}`;
                return (
                  <button
                    key={user.uid}
                    onClick={() => handleSelectUser(user)}
                    className={cn(
                      "w-full p-4 flex items-center gap-4 transition-all border-b border-muted/30 text-left relative",
                      isActive ? "bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />}
                    <Avatar className="size-14 rounded-2xl border border-muted/50 shrink-0">
                      <AvatarImage src={user.photoURL || ''} />
                      <AvatarFallback className="bg-primary/5 text-primary">
                        {user.role === 'client' ? <Building size={24} /> : <Bike size={24} />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-base truncate pr-2">{user.displayName || 'Usuário'}</h4>
                        {room?.lastMessageAt && (
                          <span className="text-[10px] text-muted-foreground font-bold uppercase whitespace-nowrap pt-1">
                            {formatDistanceToNow(room.lastMessageAt.toDate(), { locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className={cn(
                            "text-sm truncate",
                            (room?.unreadCountAdmin ?? 0) > 0 ? "text-foreground font-bold" : "text-muted-foreground"
                        )}>
                            {room?.lastMessage || (user.role === 'client' ? 'Loja cadastrada' : 'Entregador cadastrado')}
                        </p>
                        {(room?.unreadCountAdmin ?? 0) > 0 && (
                          <div className="min-w-5 h-5 px-1.5 bg-primary text-[10px] font-black text-white rounded-full flex items-center justify-center animate-in zoom-in-50">
                            {room.unreadCountAdmin}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-32 px-10 text-center space-y-4">
                <div className="size-20 rounded-[2rem] bg-muted/30 flex items-center justify-center">
                    <Search className="size-10 text-muted-foreground/30" />
                </div>
                <div>
                    <p className="font-bold text-muted-foreground">Nenhum contato encontrado</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        Tente buscar por um nome diferente.
                    </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Janela de Chat Aberta */}
      <main className={cn(
        "flex-1 flex flex-col bg-muted/10 transition-all outline-none",
        !selectedChatId ? "hidden md:flex items-center justify-center" : "flex"
      )}>
        {selectedChatId && selectedRecipient ? (
          <div className="flex flex-col h-full w-full outline-none">
            {/* Cabeçalho Mobile-Only */}
            <div className="p-4 border-b bg-background flex items-center gap-3 md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setSelectedChatId(null)} className="rounded-full">
                <ArrowLeft />
              </Button>
              <Avatar className="size-10 rounded-full">
                <AvatarImage src={selectedRecipient.photoURL || ''} />
                <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedRecipient.role === 'client' ? <Building size={18} /> : <Bike size={18} />}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-sm leading-tight">{selectedRecipient.displayName}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{selectedRecipient.userType}</p>
              </div>
            </div>
            
            <div className="flex-1 p-4 overflow-hidden max-w-5xl mx-auto w-full outline-none">
              <ChatInterface 
                chatId={selectedChatId} 
                recipientId={selectedRecipient.uid}
                recipientProfile={selectedRecipient}
              />
            </div>
          </div>
        ) : (
          <div className="text-center p-12 max-w-sm">
            <div className="size-24 rounded-[2.5rem] bg-primary/5 flex items-center justify-center mx-auto mb-8 shadow-inner">
              <MessageSquare className="size-12 text-primary/20" />
            </div>
            <h2 className="text-2xl font-black font-headline tracking-tight">Atendimento Central</h2>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Selecione um contato na lista à esquerda para visualizar o histórico de mensagens e responder aos usuários.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
