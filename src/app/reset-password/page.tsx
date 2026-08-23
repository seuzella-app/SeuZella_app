'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ZellaLogo } from '@/components/brand/ZellaLogo';

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#080b14] flex items-center justify-center text-zinc-400">Carregando...</div>}><ResetPasswordContent /></Suspense>;
}

function ResetPasswordContent() {
  const params = useSearchParams();
  const token = useMemo(() => params.get('token') || '', [params]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (password.length < 12) return setError('Use uma senha com pelo menos 12 caracteres.');
    if (password !== confirmPassword) return setError('As senhas não coincidem.');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password, confirmPassword }) });
      const data = await response.json();
      if (!response.ok) return setError(data.error || 'Não foi possível alterar a senha.');
      setDone(true);
    } catch { setError('Erro de conexão. Tente novamente.'); } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><ZellaLogo size={56} /></div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 sm:p-8 shadow-2xl">
          {done ? (
            <div className="text-center space-y-4"><CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" /><h1 className="text-2xl font-bold">Senha atualizada</h1><p className="text-zinc-400 text-sm">Sua nova senha foi salva. Você já pode acessar o ZCC.</p><Link href="/zcc/login" className="inline-block text-emerald-400 hover:underline text-sm font-semibold">Entrar no ZCC</Link></div>
          ) : (
            <><div className="flex justify-center mb-3"><KeyRound className="w-7 h-7 text-emerald-400" /></div><h1 className="text-2xl font-bold text-center">Crie sua nova senha</h1><p className="text-zinc-400 text-sm text-center mt-2 mb-6">Use pelo menos 12 caracteres. O link é de uso único e expira em 30 minutos.</p><form onSubmit={submit} className="space-y-4"><div className="relative"><Input required minLength={12} maxLength={128} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Nova senha" value={password} onChange={e => setPassword(e.target.value)} className="pr-10 h-12 bg-[#080b14] border-white/[0.08] text-white rounded-xl" /><button type="button" aria-label="Mostrar senha" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div><Input required minLength={12} maxLength={128} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Confirme a nova senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-12 bg-[#080b14] border-white/[0.08] text-white rounded-xl" />{error && <p role="alert" className="text-red-400 text-sm">{error}</p>}<Button type="submit" disabled={loading || !token} className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold">{loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" />Salvando...</> : 'Salvar nova senha'}</Button></form></>
          )}
        </div>
      </div>
    </main>
  );
}
