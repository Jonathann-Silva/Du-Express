
'use client';

import { useState, useMemo } from 'react';
import { MessageSquare, Search, Building, Bike, Loader2, ArrowLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatRoom, UserProfile } from '@/lib/types';

export default function AdminChatListPage() {
  const { userProfile } = useUser();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);

  const chatsQuery = useMemo(() => {
    if (!firestore || userProfile?.role !== 'admin') return null;
    return query(collection(firestore, 'chats'), orderBy('lastMessageAt', 'desc'), limit(50));
  }, [firestore, userProfile]);

  const { data: rooms, loading } = useCollection<ChatRoom>(chatsQuery);

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter(r => 
      !searchQuery || r.userName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rooms, searchQuery]);

  // Prepara o recipientProfile para o ChatInterface
  const recipientProfile = useMemo(() => {
    if (!selectedChat) return null;
    const userId = selectedChat.id.replace('admin_', '');
    return {
      uid: userId,
      displayName: selectedChat.userName,
      role: selectedChat.userRole,
      photoURL: null, // ChatRoom doesn't store photo, we could fetch but for MVP fallback is ok
    } as UserProfile;
  }, [selectedChat]);

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Sidebar de Chats */}
      <aside className={cn(
        "w-full md:w-80 border-r flex flex-col transition-all",
        selectedChat ? "hidden md:flex" : "flex"
      )}>
        <header className="p-4 border-b shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold font-headline">Conversas</h1>
            <MessageSquare className="text-primary size-5" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input 
              placeholder="Buscar chat..." 
              className="pl-9 h-10 rounded-xl bg-muted/30 border-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : filteredRooms.length > 0 ? (
            filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedChat(room)}
                className={cn(
                  "w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b text-left",
                  selectedChat?.id === room.id && "bg-primary/5 border-l-4 border-l-primary"
                )}
              >
                <Avatar className="size-12 rounded-xl">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {room.userRole === 'client' ? <Building size={20} /> : <Bike size={20} />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h4 className="font-bold text-sm truncate">{room.userName || 'Usuário'}</h4>
                    <span className="text-[9px] text-muted-foreground uppercase font-medium">
                      {room.lastMessageAt ? formatDistanceToNow(room.lastMessageAt.toDate(), { locale: ptBR }) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{room.lastMessage}</p>
                </div>
                {room.unreadCountAdmin > 0 && (
                  <div className="size-5 bg-primary text-[10px] font-black text-white rounded-full flex items-center justify-center">
                    {room.unreadCountAdmin}
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <MessageSquare className="size-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">Nenhum chat encontrado</p>
            </div>
          )}
        </div>
      </aside>

      {/* Janela de Chat */}
      <main className={cn(
        "flex-1 flex flex-col bg-muted/10 transition-all",
        !selectedChat ? "hidden md:flex items-center justify-center" : "flex"
      )}>
        {selectedChat ? (
          <div className="flex flex-col h-full w-full">
            <div className="p-4 border-b bg-background flex items-center gap-2 md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)}><ArrowLeft /></Button>
              <h3 className="font-bold text-sm">{selectedChat.userName}</h3>
            </div>
            <div className="flex-1 p-4 overflow-hidden max-w-4xl mx-auto w-full">
              <ChatInterface 
                chatId={selectedChat.id} 
                recipientId={selectedChat.id.replace('admin_', '')}
                recipientProfile={recipientProfile}
              />
            </div>
          </div>
        ) : (
          <div className="text-center p-8">
            <div className="size-20 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="size-10 text-primary opacity-20" />
            </div>
            <h2 className="text-2xl font-bold font-headline">Selecione uma conversa</h2>
            <p className="text-muted-foreground mt-2">Escolha uma loja ou entregador para iniciar o atendimento.</p>
          </div>
        )}
      </main>
    </div>
  );
}
