'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';

export function FinanceGuard({ children }: { children: React.ReactNode }) {
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState(false);
  
  const firestore = useFirestore();
  
  const settingRef = useMemo(() => (
    firestore ? doc(firestore, 'settings', 'finance') : null
  ), [firestore]);

  const { data: financeSetting, loading } = useDoc<{ password?: string }>(settingRef);

  const handleVerify = () => {
    // Busca a senha do banco. Se a coleção/documento não existir, usa a padrão 'admin123'
    const correctPassword = financeSetting?.password || 'admin123';
    
    if (passwordInput === correctPassword) {
      setIsAuthorized(true);
    } else {
      setError(true);
      setPasswordInput('');
      setTimeout(() => setError(false), 2000);
    }
  };

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80dvh] px-6 animate-in fade-in zoom-in-95 duration-300">
      <Card className="w-full max-w-sm p-8 flex flex-col items-center text-center shadow-2xl border-primary/20 rounded-3xl bg-card/50 backdrop-blur-sm">
        <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20 rotate-3">
          <Lock className="text-primary size-10 -rotate-3" />
        </div>
        <h2 className="text-2xl font-black font-headline mb-2 tracking-tight text-foreground">Área Restrita</h2>
        <p className="text-sm text-muted-foreground mb-8 px-4 font-medium leading-tight">
          Esta área contém dados financeiros sensíveis. Insira a senha mestra para continuar.
        </p>
        
        <div className="w-full space-y-4">
          <div className="space-y-1 text-left">
            <Input 
              type="password" 
              placeholder="••••••" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleVerify()}
              disabled={loading}
              className={`h-14 rounded-2xl text-center text-xl tracking-[0.3em] font-bold transition-all ${
                error ? 'border-destructive ring-destructive animate-bounce' : 'focus:ring-primary focus:border-primary'
              }`}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-[10px] text-destructive font-black uppercase tracking-widest animate-in slide-in-from-top-1">
              Senha Incorreta
            </p>
          )}
          <Button 
            className="w-full font-bold h-14 rounded-2xl shadow-xl shadow-primary/20 group active:scale-[0.98] transition-all" 
            onClick={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin size-5" />
            ) : (
              <>
                Desbloquear Finanças
                <ArrowRight className="ml-2 size-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </div>
        <div className="mt-8 flex items-center gap-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
            <ShieldCheck className="size-3" />
            <span>Segurança Lucas-Expresso</span>
        </div>
      </Card>
    </div>
  );
}
