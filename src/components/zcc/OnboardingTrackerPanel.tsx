'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Mail,
  Smartphone,
  KeyRound,
  Sparkles,
  Building2,
  Home,
  Users,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface TenantOnboardingStatus {
  id: string;
  propertyName: string;
  ownerInitials: string;
  plan: 'lite' | 'pro' | 'max' | 'parceiro';
  niche: 'pousada' | 'airbnb';
  createdAt: string;
  steps: {
    paymentConfirmed: boolean;
    emailSent: boolean;
    magicScanExecuted: boolean;
    whatsappConnected: boolean;
    autoPinActivated: boolean;
  };
  overallProgressPercent: number;
}

export function OnboardingTrackerPanel() {
  const [tenants, setTenants] = useState<TenantOnboardingStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/zcc/onboarding-tracker')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setTenants(json.data.tenants || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fullyOnboardedCount = tenants.filter(t => t.overallProgressPercent === 100).length;
  const onboardingRate = tenants.length ? Math.round((fullyOnboardedCount / tenants.length) * 100) : 0;

  return (
    <div className="space-y-6 text-white">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-[#0d0d14] border border-emerald-500/30 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Lifecycle & Onboarding Tracker ZCC</h2>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-mono">LIVE FEED</Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Monitoramento ponta-a-ponta da jornada pós-compra do cliente (Pagamento → Email → Magic Scan → WhatsApp → Auto-PIN).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-zinc-400 font-mono uppercase block">Taxa de Onboarding</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{onboardingRate}%</span>
          </div>
        </div>
      </div>

      {/* Funnel Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-[#0d0d14] border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Total de Tenants</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold font-mono">{tenants.length}</span>
        </div>

        <div className="p-4 bg-[#0d0d14] border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Emails Enviados</span>
            <Mail className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-blue-400">100%</span>
        </div>

        <div className="p-4 bg-[#0d0d14] border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">WhatsApp Conectado</span>
            <Smartphone className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-400">
            {tenants.length ? Math.round((tenants.filter(t => t.steps.whatsappConnected).length / tenants.length) * 100) : 0}%
          </span>
        </div>

        <div className="p-4 bg-[#0d0d14] border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Auto-PIN Ativo</span>
            <KeyRound className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-amber-400">
            {tenants.length ? Math.round((tenants.filter(t => t.steps.autoPinActivated).length / tenants.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Tenants List */}
      <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
          Progresso de Onboarding por Cliente
        </h3>

        {loading ? (
          <div className="py-8 text-center text-zinc-500 text-xs font-mono">
            Carregando dados de onboarding dos clientes...
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map(t => (
              <div key={t.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold font-mono">
                      {t.ownerInitials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{t.propertyName}</span>
                        <Badge className="bg-white/5 text-zinc-300 text-[10px] uppercase font-mono">{t.niche}</Badge>
                        <Badge className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-mono">{t.plan}</Badge>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">ID: {t.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Progress value={t.overallProgressPercent} className="w-24 h-2 bg-white/10" />
                    <span className="text-xs font-mono font-bold text-emerald-400">{t.overallProgressPercent}%</span>
                  </div>
                </div>

                {/* Steps Indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono pt-1 border-t border-white/5">
                  <div className={`flex items-center gap-1.5 ${t.steps.paymentConfirmed ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1. Pagamento
                  </div>
                  <div className={`flex items-center gap-1.5 ${t.steps.emailSent ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 2. Email Boas-vindas
                  </div>
                  <div className={`flex items-center gap-1.5 ${t.steps.magicScanExecuted ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 3. Magic Scan
                  </div>
                  <div className={`flex items-center gap-1.5 ${t.steps.whatsappConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 4. WhatsApp
                  </div>
                  <div className={`flex items-center gap-1.5 ${t.steps.autoPinActivated ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> 5. Auto-PIN
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
