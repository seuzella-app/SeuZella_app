'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ZellaLogo } from '@/components/brand/ZellaLogo';

export default function ZccLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080b14] flex items-center justify-center text-zinc-400">Carregando...</div>}>
      <ZccLoginContent />
    </Suspense>
  );
}

function ZccLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const callbackUrl = searchParams.get('callbackUrl')?.startsWith('/zcc') ? searchParams.get('callbackUrl')! : '/zcc';

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false });
      if (!result?.ok) {
        setError('Login ou senha incorretos. Se este for seu primeiro acesso, use “Criar ou redefinir minha senha”.');
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError('Não foi possível conectar ao serviço de autenticação. Tente novamente.');
    } finally { setLoading(false); }
  }

  async function handlePasswordSetup(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error || 'Não foi possível solicitar o link.'); return; }
      setMessage('Se este e-mail estiver autorizado para o ZCC, enviaremos um link seguro para criar ou redefinir sua senha.');
    } catch { setError('Não foi possível enviar o link. Tente novamente.'); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <ZellaLogo size={58} />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-mono font-bold tracking-[0.18em] text-emerald-400 uppercase">ZCC — Central Control</span>
          </div>
        </div>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-7">
            <h1 className="text-2xl font-bold tracking-tight">Acesso administrativo</h1>
            <p className="text-zinc-500 text-sm mt-2">Entre no Zélla Central Control. Este acesso é separado dos DDCs dos clientes.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail administrativo" className="h-12 pl-10 bg-[#080b14] border-white/[0.08] text-white rounded-xl" />
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="h-12 pl-10 pr-10 bg-[#080b14] border-white/[0.08] text-white rounded-xl" />
              <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
            {message && <p role="status" className="text-emerald-400 text-sm">{message}</p>}
            <Button type="submit" disabled={loading} className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold">
              {loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" />Autenticando...</> : 'Entrar no ZCC'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3"><div className="flex-1 h-px bg-white/[0.06]" /><span className="text-[10px] text-zinc-600 uppercase tracking-wider">senha</span><div className="flex-1 h-px bg-white/[0.06]" /></div>

          <form onSubmit={handlePasswordSetup}>
            <Button type="submit" variant="outline" disabled={loading || !email.includes('@')} className="w-full h-11 border-white/[0.08] bg-transparent hover:bg-white/[0.04] text-zinc-200 rounded-xl">
              {loading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <Mail className="mr-2 w-4 h-4" />}
              Criar ou redefinir minha senha por e-mail
            </Button>
          </form>

          <p className="text-[11px] text-zinc-600 text-center mt-5 leading-relaxed">O link de configuração é de uso único e expira em 30 minutos. DDC Pousada e DDC Airbnb continuam acessíveis separadamente após a autenticação administrativa.</p>
        </section>
      </div>
    </main>
  );
}
