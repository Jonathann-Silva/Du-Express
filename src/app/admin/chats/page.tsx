'use client';

import { useState, useMemo } from 'react';
import { MessageSquare, Search, Building, Bike, X } from 'lucide-react';
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
import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
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

  // Busca todos os usuários (Lojas e Motoboys)
  const usersQuery = useMemo(() => {
    if (!firestore || userProfile?.role !== 'admin') return null;
    return query(collection(firestore, 'users'), where('role', 'in', ['client', 'courier']));
  }, [firestore, userProfile]);

  const { data: allUsers, loading: loadingUsers } = useCollection<UserProfile>(usersQuery);

  // Unifica a lista
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
    <div className="flex flex-col h-full bg-background outline-none">
      <header className="p-6 space-y-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10 border-b">
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

      <ScrollArea className="flex-1 px-4">
        <div className="flex flex-col gap-2 py-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : filteredContacts.length > 0 ? (
            filteredContacts.map(({ user, room }) => {
              const unreadCount = room?.unreadCountAdmin ?? 0;
              return (
                <button
                  key={user.uid}
                  onClick={() => handleSelectUser(user)}
                  className={cn(
                    "w-full p-4 flex items-center gap-4 transition-all border rounded-2xl text-left relative shadow-sm active:scale-[0.98]",
                    unreadCount > 0 ? "bg-primary/5 border-primary/20 shadow-md ring-1 ring-primary/10" : "bg-card hover:bg-muted/30"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="size-14 rounded-2xl border border-muted/50 shadow-sm">
                      <AvatarImage src={user.photoURL || ''} />
                      <AvatarFallback className="bg-primary/5 text-primary">
                        {user.role === 'client' ? <Building size={24} /> : <Bike size={24} />}
                      </AvatarFallback>
                    </Avatar>
                    {unreadCount > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 size-6 bg-red-500 text-[10px] font-black text-white rounded-full flex items-center justify-center border-2 border-background shadow-lg animate-bounce">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={cn(
                        "font-bold text-base truncate pr-2",
                        unreadCount > 0 ? "text-primary" : "text-foreground"
                      )}>
                        {user.displayName || 'Usuário'}
                      </h4>
                      {room?.lastMessageAt && (
                        <span className={cn(
                          "text-[10px] font-bold uppercase whitespace-nowrap pt-1",
                          unreadCount > 0 ? "text-primary" : "text-muted-foreground"
                        )}>
                          {formatDistanceToNow(room.lastMessageAt.toDate(), { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className={cn(
                          "text-sm truncate",
                          unreadCount > 0 ? "text-foreground font-bold" : "text-muted-foreground font-medium"
                      )}>
                          {room?.lastMessage || (user.role === 'client' ? 'Loja' : 'Entregador')}
                      </p>
                      {unreadCount > 0 && (
                        <div className="min-w-2 h-2 bg-primary rounded-full animate-pulse shrink-0" />
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

      {/* Pop-up de Chat */}
      <Dialog 
        open={!!selectedChatId} 
        onOpenChange={(open) => !open && setSelectedChatId(null)}
      >
        <DialogContent className="max-w-2xl h-[85vh] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl flex flex-col">
          <DialogHeader className="p-6 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="size-10 border-2 border-primary/20">
                <AvatarImage src={selectedRecipient?.photoURL || ''} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedRecipient?.displayName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-base font-bold leading-none">{selectedRecipient?.displayName}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mt-1">
                  {selectedRecipient?.role === 'client' ? 'Loja' : 'Entregador'}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden relative">
            {selectedChatId && selectedRecipient && (
              <ChatInterface 
                chatId={selectedChatId} 
                recipientId={selectedRecipient.uid}
                recipientProfile={selectedRecipient}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
