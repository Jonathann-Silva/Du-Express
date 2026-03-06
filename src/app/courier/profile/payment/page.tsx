
'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Wallet, Landmark, Info, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser, useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function PaymentMethodsPage() {
  const { user, userProfile, loading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  
  // States para os campos
  const [pixType, setPixType] = useState<string>('');
  const [pixKey, setPixKey] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankAgency, setBankAgency] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');

  // Inicializa os campos com os dados do perfil
  useEffect(() => {
    if (userProfile) {
      setPixType(userProfile.pixType || '');
      setPixKey(userProfile.pixKey || '');
      setBankName(userProfile.bankName || '');
      setBankAgency(userProfile.bankAgency || '');
      setBankAccount(userProfile.bankAccount || '');
    }
  }, [userProfile]);

  const handleUpdate = async () => {
    if (!user?.uid || !firestore) return;

    setIsSaving(true);
    try {
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, {
        pixType: pixType || null,
        pixKey: pixKey || null,
        bankName: bankName || null,
        bankAgency: bankAgency || null,
        bankAccount: bankAccount || null,
      });

      toast({
        title: "Dados Atualizados!",
        description: "Suas informações de pagamento foram salvas com sucesso.",
      });

      // Retorna automaticamente para a página anterior
      router.back();
    } catch (error) {
      console.error("Erro ao atualizar pagamento:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar seus dados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <header className="p-4 border-b flex items-center">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-6 w-40 mx-auto" />
        </header>
        <main className="p-4 space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 flex items-center bg-background/80 backdrop-blur-md p-4 border-b">
        <Button asChild variant="ghost" size="icon">
            <Link href="/courier/profile">
                <ArrowLeft />
            </Link>
        </Button>
        <h1 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10 font-headline">
            Métodos de Pagamento
        </h1>
      </header>
      
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="p-4 bg-primary/10 border-b border-primary/20">
            <div className="flex items-start gap-3">
                <Info className="text-primary size-5 mt-0.5 shrink-0"/>
                <p className="text-sm font-medium text-foreground/80">
                    Seus pagamentos são processados toda quarta-feira referente aos ganhos da semana anterior.
                </p>
            </div>
        </div>

        <div className="p-4 space-y-8 mt-6">
            <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 font-headline">
                    <Wallet className="text-primary size-6" />
                    Detalhes do PIX
                </h2>
                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                            Tipo de Chave PIX
                        </Label>
                        <Select value={pixType} onValueChange={setPixType}>
                            <SelectTrigger className="w-full h-14 rounded-xl text-base">
                                <SelectValue placeholder="Selecione o tipo de chave" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cpf">CPF</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Telefone</SelectItem>
                                <SelectItem value="random">Chave Aleatória</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                            Chave PIX
                        </Label>
                        <Input 
                            className="h-14 rounded-xl text-base" 
                            placeholder="Insira sua chave PIX" 
                            value={pixKey}
                            onChange={(e) => setPixKey(e.target.value)}
                        />
                    </div>
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 font-headline">
                        <Landmark className="text-primary size-6" />
                        Conta Bancária
                        <span className="text-xs font-normal text-muted-foreground uppercase ml-2">(Opcional)</span>
                    </h2>
                </div>
                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                            Nome do Banco
                        </Label>
                        <Input 
                            className="h-14 rounded-xl text-base" 
                            placeholder="Ex: Nubank, Itaú" 
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                                Agência
                            </Label>
                            <Input 
                                className="h-14 rounded-xl text-base" 
                                placeholder="0001" 
                                value={bankAgency}
                                onChange={(e) => setBankAgency(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                                Conta
                            </Label>
                            <Input 
                                className="h-14 rounded-xl text-base" 
                                placeholder="12345-6" 
                                value={bankAccount}
                                onChange={(e) => setBankAccount(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </div>
        
        <div className="px-4 py-6">
            <Button 
              className="w-full h-14 font-bold text-base rounded-xl shadow-lg shadow-primary/25 gap-2"
              onClick={handleUpdate}
              disabled={isSaving}
            >
                {isSaving ? <Loader2 className="animate-spin size-5" /> : <CheckCircle2 className="size-5" />}
                {isSaving ? 'Salvando...' : 'Atualizar Informações'}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4 px-6">
                Mantenha seus dados atualizados para evitar atrasos no seu repasse semanal.
            </p>
        </div>
      </main>
    </div>
  );
}
