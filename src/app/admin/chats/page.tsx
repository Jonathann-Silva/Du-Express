
'use client';

import { useState, useMemo, useEffect } from 'react';
import { MessageSquare, Search, Building, Bike, Loader2, ArrowLeft, UserPlus, MoreVertical, CheckCheck } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatRoom, UserProfile } from '@/lib/types';

export default function AdminChatListPage() {
  const { userProfile } = useUser();
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  // Busca salas de chat existentes ordenadas pela última mensagem
  const chatsQuery = useMemo(() => {
    if (!firestore || userProfile?.role !== 'admin') return null;
    return query(collection(firestore, 'chats'), orderBy('lastMessageAt', 'desc'), limit(50));
  }, [firestore, userProfile]);

  const { data: rooms, loading } = useCollection<ChatRoom>(chatsQuery);

  // Busca todos os usuários para o "Novo Chat"
  const usersQuery = useMemo(() => {
    if (!firestore || userProfile?.role !== 'admin') return null;
    return query(collection(firestore, 'users'), where('role', 'in', ['client', 'courier']));
  }, [firestore, userProfile]);

  const { data: allUsers, loading: loadingUsers } = useCollection<UserProfile>(usersQuery);

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter(r => 
      !searchQuery || r.userName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rooms, searchQuery]);

  const filteredContacts = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      !contactSearch || u.displayName?.toLowerCase().includes(contactSearch.toLowerCase())
    );
  }, [allUsers, contactSearch]);

  const handleSelectRoom = async (room: ChatRoom) => {
    setSelectedChatId(room.id);
    
    // Tenta buscar o perfil completo do usuário para o cabeçalho do chat
    const userId = room.id.replace('admin_', '');
    if (firestore) {
        const userRef = doc(firestore, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            setSelectedRecipient({ ...userSnap.data(), uid: userId } as UserProfile);
        } else {
            setSelectedRecipient({
                uid: userId,
                displayName: room.userName,
                role: room.userRole as any,
                photoURL: null,
            } as UserProfile);
        }
    }
  };

  const handleStartNewChat = (contact: UserProfile) => {
    setSelectedChatId(`admin_${contact.uid}`);
    setSelectedRecipient(contact);
    setIsNewChatOpen(false);
  };

  return (
    <div className="flex h-full bg-background overflow-hidden outline-none">
      {/* Sidebar de Histórico de Mensagens */}
      <aside className={cn(
        "w-full md:w-96 border-r flex flex-col bg-card/50 transition-all",
        selectedChatId ? "hidden md:flex" : "flex"
      )}>
        <header className="p-4 space-y-4 shrink-0 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-headline tracking-tight">Conversas</h1>
            
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 text-primary">
                  <UserPlus size={22} />
                </Button>
              </DialogTrigger>
              <DialogContent className="p-0 overflow-hidden max-w-sm rounded-[2rem] border-none shadow-2xl">
                <DialogHeader className="p-6 bg-primary text-primary-foreground">
                  <DialogTitle className="font-headline text-xl">Novo Atendimento</DialogTitle>
                </DialogHeader>
                <div className="p-4 border-b bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
                    <Input 
                      placeholder="Buscar por nome..." 
                      className="pl-9 bg-background border-none h-11 rounded-xl shadow-sm"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                    />
                  </div>
                </div>
                <ScrollArea className="h-96">
                  <div className="p-2 space-y-1">
                    {loadingUsers ? (
                      <div className="p-4 space-y-4">
                        <Skeleton className="h-14 w-full rounded-2xl" />
                        <Skeleton className="h-14 w-full rounded-2xl" />
                        <Skeleton className="h-14 w-full rounded-2xl" />
                      </div>
                    ) : filteredContacts.length > 0 ? (
                      filteredContacts.map((contact) => (
                        <button
                          key={contact.uid}
                          onClick={() => handleStartNewChat(contact)}
                          className="w-full p-3 flex items-center gap-4 hover:bg-primary/5 rounded-2xl transition-all text-left group"
                        >
                          <Avatar className="size-12 rounded-2xl border-2 border-transparent group-hover:border-primary/20">
                            <AvatarImage src={contact.photoURL || ''} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {contact.role === 'client' ? <Building size={20} /> : <Bike size={20} />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{contact.displayName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">
                              {contact.role === 'client' ? 'Loja' : 'Motoboy'} • {contact.userType}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <p className="text-sm font-medium">Nenhum contato encontrado</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
            <Input 
              placeholder="Pesquisar conversas..." 
              className="pl-9 h-11 rounded-2xl bg-muted/50 border-none focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-px">
            {loading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : filteredRooms.length > 0 ? (
              filteredRooms.map((room) => {
                const isActive = selectedChatId === room.id;
                return (
                  <button
                    key={room.id}
                    onClick={() => handleSelectRoom(room)}
                    className={cn(
                      "w-full p-4 flex items-center gap-4 transition-all border-b border-muted/30 text-left relative",
                      isActive ? "bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />}
                    <Avatar className="size-14 rounded-2xl border border-muted/50 shrink-0">
                      <AvatarFallback className="bg-primary/5 text-primary">
                        {room.userRole === 'client' ? <Building size={24} /> : <Bike size={24} />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-base truncate pr-2">{room.userName || 'Usuário'}</h4>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase whitespace-nowrap pt-1">
                          {room.lastMessageAt ? formatDistanceToNow(room.lastMessageAt.toDate(), { locale: ptBR }) : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className={cn(
                            "text-sm truncate",
                            room.unreadCountAdmin > 0 ? "text-foreground font-bold" : "text-muted-foreground"
                        )}>
                            {room.lastMessage}
                        </p>
                        {room.unreadCountAdmin > 0 && (
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
                    <MessageSquare className="size-10 text-muted-foreground/30" />
                </div>
                <div>
                    <p className="font-bold text-muted-foreground">Sem histórico de mensagens</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                        Inicie um novo atendimento clicando no botão superior.
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
