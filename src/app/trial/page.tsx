'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Sparkles,
  Building2,
  Home,
  Mail,
  User,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

type Step = 'form' | 'verifying' | 'verified' | 'onboarding';

export default function TrialPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <TrialPageInner />
    </Suspense>
  );
}

function TrialPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [trialData, setTrialData] = useState<{
    email: string;
    name?: string;
    niche: string;
  } | null>(null);

  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    companyName: '',
    niche: 'pousada' as 'pousada' | 'airbnb',
  });

  // Se chegou com token, verifica automaticamente
  useEffect(() => {
    if (token) {
      setStep('verifying');
      fetch(`/api/ddc/airb-pro/trial?token=${token}`)
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setTrialData(data.data);
            setForm({
              email: data.data.email || '',
              name: data.data.name || '',
              phone: data.data.phone || '',
              companyName: data.data.companyName || '',
              niche: data.data.niche || 'pousada',
            });
            setStep('verified');
          } else {
            toast.error(data.error || 'Token inválido');
            setStep('form');
          }
        })
        .catch(() => {
          toast.error('Erro ao verificar token');
          setStep('form');
        });
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/ddc/airb-pro/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.success) {
        toast.success('Enviamos um link de verificação para seu email!');
        setStep('verified');
        setTrialData({
          email: data.data.email,
          niche: form.niche,
          name: form.name,
        });
      } else if (data.code === 'ALREADY_CONVERTED') {
        toast.info('Você já tem uma conta. Redirecionando para login...');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        toast.error(data.error || 'Erro ao criar trial');
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinishOnboarding() {
    setLoading(true);
    // Simula criação da conta e redireciona para login
    setTimeout(() => {
      toast.success('Conta criada! Faça login para acessar o painel.');
      router.push('/login?trial=completed');
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(16,185,129,0.1),transparent_50%)] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-blue-300">Trial Gratuito — 7 dias</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-blue-100 to-emerald-100 bg-clip-text text-transparent">
            Comece hoje sem falar com ninguém
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Onboarding 100% self-service. Configure em menos de 5 minutos e comece a atender seus hóspedes com IA no WhatsApp.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { id: 'form', label: 'Cadastro', icon: User },
            { id: 'verified', label: 'Verificação', icon: Mail },
            { id: 'onboarding', label: 'Onboarding', icon: Building2 },
          ].map((s, idx) => {
            const isActive = step === s.id || (step === 'verifying' && s.id === 'verified');
            const isPast = ['form', 'verified', 'onboarding'].indexOf(step) > idx;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                  isActive ? 'border-blue-500/50 bg-blue-500/10' : isPast ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'
                }`}>
                  <s.icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : isPast ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span className={`text-xs font-semibold ${isActive ? 'text-blue-300' : isPast ? 'text-emerald-300' : 'text-zinc-500'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < 2 && <div className="w-8 h-px bg-white/10" />}
              </div>
            );
          })}
        </div>

        {/* Main content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto"
        >
          {step === 'form' && (
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-8 backdrop-blur">
              <h2 className="text-xl font-bold mb-1">Crie sua conta trial</h2>
              <p className="text-sm text-zinc-400 mb-6">Sem cartão de crédito. Sem compromisso.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-zinc-400">Tipo de hospedagem</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, niche: 'pousada' }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                          form.niche === 'pousada' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-white/5 text-zinc-400 hover:border-white/10'
                        }`}
                      >
                        <Home className="w-3.5 h-3.5" />
                        Pousada
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, niche: 'airbnb' }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                          form.niche === 'airbnb' ? 'border-rose-500/50 bg-rose-500/10 text-rose-300' : 'border-white/5 text-zinc-400 hover:border-white/10'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        Airbnb
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-xs text-zinc-400">WhatsApp (opcional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+55 11 99999-9999"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="mt-1.5 bg-white/[0.03] border-white/10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs text-zinc-400">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="voce@empresa.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="mt-1.5 bg-white/[0.03] border-white/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="name" className="text-xs text-zinc-400">Seu nome</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="João Silva"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="mt-1.5 bg-white/[0.03] border-white/10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyName" className="text-xs text-zinc-400">Nome do negócio</Label>
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Pousada Recanto"
                      value={form.companyName}
                      onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                      className="mt-1.5 bg-white/[0.03] border-white/10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !form.email}
                  className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando trial...</>
                  ) : (
                    <>Começar Trial Grátis <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>

                <p className="text-xs text-zinc-500 text-center">
                  Ao continuar você concorda com nossos{' '}
                  <Link href="/legal/termos-de-uso" className="text-blue-400 hover:underline">Termos de Uso</Link>
                  {' '}e{' '}
                  <Link href="/legal/politica-de-privacidade" className="text-blue-400 hover:underline">Política de Privacidade</Link>.
                </p>
              </form>
            </div>
          )}

          {step === 'verifying' && (
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 backdrop-blur text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-400" />
              <h2 className="text-xl font-bold mb-2">Verificando seu token...</h2>
              <p className="text-sm text-zinc-400">Aguarde, estamos validando seu acesso.</p>
            </div>
          )}

          {step === 'verified' && trialData && (
            <div className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-8 backdrop-blur">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Email verificado!</h2>
                  <p className="text-sm text-zinc-400">{trialData.email}</p>
                </div>
              </div>

              <p className="text-sm text-zinc-300 mb-6">
                Seu trial de 7 dias está ativo. Complete o onboarding abaixo para começar a usar.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Acesso completo por 7 dias</div>
                    <div className="text-xs text-zinc-500">Todas as features PRO desbloqueadas</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Sem cartão de crédito</div>
                    <div className="text-xs text-zinc-500">Não cobramos após o período de teste</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Setup em 5 minutos</div>
                    <div className="text-xs text-zinc-500">Configure IA, WhatsApp e imóveis rapidamente</div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleFinishOnboarding}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Configurando...</>
                ) : (
                  <>Finalizar e Acessar Painel <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          )}
        </motion.div>

        {/* Features highlights */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Zap, title: 'IA 24/7 no WhatsApp', desc: 'Responde hóspedes automaticamente' },
            { icon: TrendingUp, title: 'Gestão Financeira', desc: 'Fluxo de caixa, DRE, despesas' },
            { icon: Shield, title: 'Operações', desc: 'Limpeza, manutenção, checklists' },
            { icon: CheckCircle2, title: 'Relatórios PDF', desc: 'Mensal, reservas, financeiro' },
          ].map((f, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <f.icon className="w-5 h-5 text-blue-400 mb-3" />
              <div className="text-sm font-semibold mb-1">{f.title}</div>
              <div className="text-xs text-zinc-500">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-zinc-500">
            Já tem uma conta? <Link href="/login" className="text-blue-400 hover:underline">Faça login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
