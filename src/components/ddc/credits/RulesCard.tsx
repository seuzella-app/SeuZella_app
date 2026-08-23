'use client';

import {
  BookOpen,
  ChevronDown,
  Shield,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PROGRAM_RULES, PROGRAM_SUMMARY } from '@/lib/credits/rules';
import Link from 'next/link';

export function RulesCard() {
  return (
    <Card className="bg-[#0d0d14] border-white/[0.06]">
      <CardHeader>
        <CardTitle className="text-base font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          Regras Oficiais do Programa
        </CardTitle>
        <CardDescription className="text-xs text-zinc-500">
          Documentação completa — espelhada no rodapé do site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="bg-gradient-to-r from-emerald-500/[0.08] to-teal-500/[0.04] border border-emerald-500/15 rounded-lg p-3">
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            <strong className="text-emerald-400">Resumo:</strong> {PROGRAM_SUMMARY}
          </p>
        </div>

        {/* Reward table */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">
            Recompensa por conversão
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { plan: 'LITE', value: 'R$ 30', color: 'text-blue-400 border-blue-500/20 bg-blue-500/10' },
              { plan: 'PRO', value: 'R$ 60', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' },
              { plan: 'MAX', value: 'R$ 120', color: 'text-amber-400 border-amber-500/20 bg-amber-500/10' },
              { plan: 'PARCEIRO', value: 'R$ 25', color: 'text-purple-400 border-purple-500/20 bg-purple-500/10' },
            ].map((row) => (
              <div key={row.plan} className={`rounded-lg border p-2 text-center ${row.color}`}>
                <p className="text-[9px] uppercase tracking-wider font-bold opacity-80">{row.plan}</p>
                <p className="text-sm font-extrabold mt-0.5">{row.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1.5">
            Limite: 50% da sua mensalidade por ciclo. Créditos expiram em 12 meses se não usados.
          </p>
        </div>

        {/* Anti-fraud highlights */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Anti-fraude
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Fingerprint SHA-256, dedup de IP/dispositivo, bloqueio de auto-indicação.
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                Confirmação
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Crédito fica pendente 30 dias (anti-chargeback) antes de ficar disponível.
            </p>
          </div>
        </div>

        {/* Detailed rules accordion */}
        <Accordion type="single" collapsible className="w-full">
          {PROGRAM_RULES.map((rule) => (
            <AccordionItem key={rule.number} value={`rule-${rule.number}`} className="border-white/[0.06]">
              <AccordionTrigger className="text-xs text-zinc-200 hover:text-emerald-400 hover:no-underline py-2.5">
                <div className="flex items-center gap-2 text-left">
                  <span className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono flex items-center justify-center shrink-0">
                    {rule.number}
                  </span>
                  <span className="font-medium">{rule.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-[11px] text-zinc-400 leading-relaxed pb-3 pl-7">
                {rule.description}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Link to full legal doc */}
        <Link
          href="/legal/programa-amortizacao"
          className="flex items-center justify-between gap-2 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Ver documento jurídico completo
          </span>
          <ChevronDown className="w-3 h-3 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}
