'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ZellaLogo } from '@/components/brand/ZellaLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Deliberately identical success UI for registered and unknown addresses.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b14] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><ZellaLogo size={56} /></div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 sm:p-8 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h1 className="text-2xl font-bold">Verifique seu e-mail</h1>
              <p className="text-zinc-400 text-sm">Se o endereço estiver cadastrado, enviamos um link seguro para criar uma nova senha. O link expira em 30 minutos.</p>
              <Link href="/login" className="inline-flex items-center gap-2 text-emerald-400 hover:underline text-sm font-semibold"><ArrowLeft className="w-4 h-4" />Voltar para o login</Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-center">Esqueceu sua senha?</h1>
              <p className="text-zinc-400 text-sm text-center mt-2 mb-6">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
              <form onSubmit={submit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <Input required type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-12 bg-[#080b14] border-white/[0.08] text-white rounded-xl" />
                </div>
                <Button type="submit" disabled={loading || !email} className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold">
                  {loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" />Enviando...</> : 'Enviar link para redefinir senha'}
                </Button>
              </form>
              <div className="text-center mt-5"><Link href="/login" className="text-emerald-400 hover:underline text-sm">Voltar para o login</Link></div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
