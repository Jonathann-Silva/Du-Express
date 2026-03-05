'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc, 
  increment,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatMessage, UserProfile } from '@/lib/types';
import { sendPushNotification } from '@/services/push-notification';

interface ChatInterfaceProps {
  chatId: string;
  recipientId: string;
  recipientProfile?: UserProfile | null;
}

export function ChatInterface({ chatId, recipientId, recipientProfile }: ChatInterfaceProps) {
  const { user, userProfile } = useUser();
  const firestore = useFirestore();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useMemo(() => {
    if (!firestore || !chatId) return null;
    return query(
      collection(firestore, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, chatId]);

  const { data: messages, loading } = useCollection<ChatMessage>(messagesQuery);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (!firestore || !chatId || !userProfile) return;
    const roomRef = doc(firestore, 'chats', chatId);
    const updateData: any = {};
    if (userProfile.role === 'admin') {
      updateData.unreadCountAdmin = 0;
    } else {
      updateData.unreadCountUser = 0;
    }
    updateDoc(roomRef, updateData).catch(() => {});
  }, [firestore, chatId, messages?.length, userProfile]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !userProfile || !firestore) return;

    setSending(true);
    const text = message.trim();
    setMessage('');

    const roomRef = doc(firestore, 'chats', chatId);
    const messagesRef = collection(firestore, 'chats', chatId, 'messages');
    const notifRef = collection(firestore, 'notifications');

    const senderName = userProfile.displayName || (userProfile.role === 'admin' ? 'Admin' : 'Usuário');

    try {
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: senderName,
        text,
        createdAt: serverTimestamp(),
        read: false
      });

      await setDoc(roomRef, {
        id: chatId,
        participants: ['admin', recipientId],
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        unreadCountAdmin: userProfile.role === 'admin' ? 0 : increment(1),
        unreadCountUser: userProfile.role === 'admin' ? increment(1) : 0,
        userName: userProfile.role === 'admin' ? (recipientProfile?.displayName || 'Usuário') : userProfile.displayName,
        userRole: userProfile.role === 'admin' ? recipientProfile?.role : userProfile.role
      }, { merge: true });

      await addDoc(notifRef, {
        userId: recipientId === 'admin' ? 'admin' : recipientId,
        title: `Nova mensagem de ${senderName}`,
        description: text.length > 50 ? text.substring(0, 47) + '...' : text,
        createdAt: serverTimestamp(),
        read: false,
        icon: 'message',
        link: userProfile.role === 'admin' ? (recipientProfile?.role === 'client' ? '/client/chat' : '/courier/chat') : `/admin/chats`
      });

      const recipientDoc = await getDoc(doc(firestore, 'users', recipientId === 'admin' ? 'admin' : recipientId));
      const sub = recipientDoc.data()?.pushSubscription;
      
      if (sub) {
        await sendPushNotification(sub, {
          title: 'Lucas Expresso',
          body: `💬 ${senderName}: ${text}`,
          url: userProfile.role === 'admin' ? (recipientProfile?.role === 'client' ? '/client/chat' : '/courier/chat') : '/admin/chats'
        });
      }

    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {loading && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>}
          {messages?.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                  isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"
                )}>
                  {msg.text}
                </div>
                <span className="text-[9px] text-muted-foreground mt-1 px-1">
                  {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm', { locale: ptBR }) : '...'}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="p-4 border-t bg-muted/10 flex gap-2">
        <Input 
          placeholder="Digite sua mensagem..." 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-xl h-12"
          disabled={sending}
        />
        <Button size="icon" type="submit" className="rounded-xl h-12 w-12 shrink-0" disabled={!message.trim() || sending}>
          {sending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
        </Button>
      </form>
    </div>
  );
}
