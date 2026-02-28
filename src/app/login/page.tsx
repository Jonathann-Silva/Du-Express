'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Bike, Loader2, Mail, Lock } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { auth } = useAuth();
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const handleLogin = async () => {
    if (!auth || !firestore) {
      toast({ title: 'Firebase não está pronto', variant: 'destructive' });
      return;
    }
    if (!email || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha o email e a senha.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDocRef = doc(firestore, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const userRoleInDb = userData.role;

        if (['admin', 'client', 'courier'].includes(userRoleInDb)) {
            toast({
                title: 'Login bem-sucedido!',
                description: `Redirecionando para o painel de ${userRoleInDb}...`,
            });
            const redirectTo = searchParams.get('redirectTo') || `/${userRoleInDb}`;
            router.push(redirectTo);
        } else {
          toast({
              title: 'Perfil Inválido',
              description: 'Seu perfil não tem uma função válida. Por favor, contate o administrador.',
              variant: 'destructive',
          });
          await auth.signOut();
        }
      } else {
        toast({
            title: 'Usuário não configurado',
            description: 'Seu perfil não foi encontrado no banco de dados. Por favor, contate o administrador.',
            variant: 'destructive',
        });
        await auth.signOut();
      }
    } catch (error: any) {
        let description = "Ocorreu um erro desconhecido. Tente novamente.";
        if (error.code === 'auth/invalid-credential') {
            description = "As credenciais fornecidas estão incorretas. Verifique seu e-mail e senha.";
        } else if (error.code === 'auth/too-many-requests') {
            description = "O acesso a esta conta foi temporariamente desativado devido a muitas tentativas de login. Tente novamente mais tarde.";
        } else {
            console.error("Login failed with unexpected error:", error);
        }

        toast({
            title: "Falha na Autenticação",
            description: description,
            variant: "destructive",
        });
    } finally {
      setLoading(false);
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  }

  return (
    <div className="bg-background font-body text-foreground min-h-dvh flex flex-col justify-between">
      <header className="flex items-center justify-between p-6">
        <Bike className="text-primary size-8" />
      </header>

      <main className="flex-1 flex flex-col justify-center px-8 max-w-md mx-auto w-full">
        <div className="mb-10 text-center">
            <h1 className="font-headline text-4xl font-bold tracking-tight">
                Bem-vindo
            </h1>
            <p className="font-headline text-2xl font-bold text-primary mt-1">Lucas Expresso</p>
            <p className="text-muted-foreground mt-2">Faça login para continuar.</p>
        </div>
        
        <form onSubmit={handleFormSubmit} className="space-y-4">
            
            <div className="space-y-3 pt-4 animate-in fade-in-50">
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                    <Input 
                        type="email" 
                        placeholder="Email"
                        className="pl-10 h-12"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        />
                </div>
                    <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-5" />
                    <Input 
                        type="password" 
                        placeholder="Senha"
                        className="pl-10 h-12"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full font-bold py-6 text-base rounded-xl">
                {loading ? <Loader2 className="animate-spin" /> : <span>Entrar</span>}
                {!loading && <ArrowRight className="size-5" />}
            </Button>
        </form>
        
        <p className="text-center text-xs text-muted-foreground mt-4 px-6">
            Insira suas credenciais para acessar o painel. O acesso é liberado por um administrador.
        </p>

      </main>

      <footer className="p-8 pb-12">
        <p className="text-center text-xs text-muted-foreground">Versão do App 0.0.9 (teste)</p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}