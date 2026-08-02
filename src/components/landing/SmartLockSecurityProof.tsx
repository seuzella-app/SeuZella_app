'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Lock, CheckCircle2, Key, Zap, Clock, ShieldAlert, Cpu, AlertTriangle, KeyRound, Radio, Power } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

// =============================================================================
// 🔐 SEU ZÉLLA — Smart Lock Security Proof (versão aperfeiçoada)
// =============================================================================
// Esta versão reflete a realidade técnica da implementação:
// - 5 marcas com API oficial (TTLock, Tuya, Igloohome, Nuki, August)
// - 5 marcas em modo manual (Intelbras, Yale, Papaiz, Philco, Samsung)
// - PINs gerados com CSPRNG (crypto.randomInt) — não mais "Math.random"
// - "Botão de pânico" real = revogação de todos os PINs (não abertura remota
//   impossível — anti-furto dos fabricantes)
// - "Algoritmo offline" mantido apenas para Igloohome (único com PIN offline
//   real via algoritmo do fabricante)
// =============================================================================

export function SmartLockSecurityProof() {
  const { isPousada } = useNiche();

  return (
    <div className="w-full max-w-5xl mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-[#0b0c13] border border-emerald-500/30 text-left relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]">
      {/* Top hairline metallic accent */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
        isPousada ? 'via-emerald-400' : 'via-blue-400'
      } to-transparent shadow-md`} />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase font-mono border ${
              isPousada ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            }`}>
              🔒 TECLADO & FECHADURA ELETRÔNICA SMART
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono border border-white/10">
              Orquestrador de 10 Marcas Brasileiras
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Como o Zélla gerencia suas fechaduras e trata qualquer exceção?
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            O Zélla é um <strong className="text-white">orquestrador inteligente</strong>: integra com APIs oficiais
            de 5 marcas (PIN automático) e orienta o host para 5 marcas sem API (PIN manual).
            PINs temporários com validade rígida, entrega via WhatsApp pós-pagamento e revogação de emergência.
          </p>
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold whitespace-nowrap shadow-lg ${
          isPousada ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' : 'bg-blue-950/80 border-blue-500/40 text-blue-300'
        }`}>
          <ShieldCheck className="w-5 h-5" />
          <span>Selo de Segurança Zélla 99.9%</span>
        </div>
      </div>

      {/* 3 Main Security Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {/* Pillar 1 */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2 hover:border-emerald-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">1. Validade Rígida por Minuto</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            O PIN temporário gerado (ex: <code className="text-emerald-300 font-mono font-bold">🔑 749201#</code>) é ativo estritamente das 14:00 do check-in às 11:00 do check-out.
            Tentar a senha fora do horário é bloqueado pela própria fechadura. Cada reserva tem seu PIN único.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2 hover:border-blue-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">2. PIN Offline para Igloohome</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Para <strong className="text-white">Igloohome</strong> (única marca com PIN offline real), usamos
            o algoritmo do fabricante via API oficial — funciona mesmo sem Wi-Fi na porta.
            Para outras marcas, o PIN é gerado via app oficial e colado no Zélla.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2 hover:border-amber-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">3. Liberação Pós-Pagamento</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            O Zélla só dispara o PIN no WhatsApp após a confirmação real do PIX ou autorização do Cartão.
            Curiosos, contatos sem cadastro ou reservas canceladas nunca recebem o código de entrada.
          </p>
        </div>
      </div>

      {/* EXCEPTION PROTOCOL SECTION */}
      <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-[#0f1019] border border-amber-500/30 space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4" />
          <span>Protocolo de Exceções & Emergências Inteligente Zélla</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Exception 1: Esqueceu Pertences */}
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                Cenário 1: Esqueceu pertence após o check-out?
              </h5>
              <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">
                PIN Emergencial 15 min
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Se o hóspede já fez check-out e percebeu que esqueceu a carteira ou chave do carro, ele manda mensagem no WhatsApp.
              O Zélla reconhece o histórico da reserva recente e emite uma <strong className="text-white">chave de acesso temporária de 15 minutos</strong> via API da fechadura,
              notificando o anfitrião em tempo real no DDC.
            </p>
          </div>

          {/* Exception 2: Hóspede ainda dentro */}
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-400" />
                Cenário 2: Hóspede ainda dentro às 11:00?
              </h5>
              <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold font-mono">
                Abertura Livre + Buffer
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              <strong className="text-white">Ninguém fica trancado dentro do imóvel.</strong> Todas as fechaduras
              abrem por dentro mecanicamente pelo manípulo/maçaneta (egress físico obrigatório por norma anti-pânico).
              Se o hóspede sair 15 min atrasado, o Zélla aplica um <strong className="text-white">Buffer de Tolerância Flexível</strong> e
              notifica o hóspede de forma cortês no WhatsApp.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-white/10">
          <span className="text-zinc-400 text-[11px]">
            ⚡ <strong className="text-white">Botão de Pânico 1-Click:</strong> O anfitrião tem no DDC o botão de emergência que revoga
            <strong className="text-white"> TODOS os PINs ativos</strong> de uma vez, em caso de vazamento suspeito.
            Diferente de "abertura remota" (anti-furto dos fabricantes), revogação em massa funciona em qualquer marca.
          </span>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 whitespace-nowrap">
            100% Protegido contra Imprevistos
          </span>
        </div>
      </div>

      {/* Supported Lock Brands — TWO CATEGORIES */}
      <div className="mt-6 space-y-3">
        {/* Marcas com API */}
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h5 className="text-xs font-bold text-white flex items-center gap-2">
                Marcas com API automática (PIN gerado automaticamente)
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">5 marcas</span>
              </h5>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Integração OAuth2 oficial. O Zélla gera o PIN direto na fechadura — você não precisa abrir o app da marca.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
            <BrandBadge emoji="🔑" name="TTLock" note="Líder MercadoLivre" />
            <BrandBadge emoji="🌐" name="Tuya / Smart Life" note="20-25% do mercado" />
            <BrandBadge emoji="🏔️" name="Igloohome" note="PIN offline real" />
            <BrandBadge emoji="🚪" name="Nuki" note="Premium Airbnb" />
            <BrandBadge emoji="🏠" name="August / Yale Assure 2" note="Yale 2023+" />
          </div>
        </div>

        {/* Marcas manuais */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-zinc-500/10 border border-zinc-500/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex-1">
              <h5 className="text-xs font-bold text-white flex items-center gap-2">
                Marcas em modo manual (PIN colado pelo host)
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300 font-mono">5 marcas</span>
              </h5>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Sem API pública. Você gera o PIN no app oficial da marca e cola no Zélla — que agenda o envio via WhatsApp no horário do check-in.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
            <BrandBadge emoji="🇧🇷" name="Intelbras" note="Líder em pousadas" />
            <BrandBadge emoji="🔐" name="Yale" note="YDM tradicional" />
            <BrandBadge emoji="🛡️" name="Papaiz" note="Brasileira tradicional" />
            <BrandBadge emoji="📺" name="Philco" note="2-5% do mercado" />
            <BrandBadge emoji="📱" name="Samsung" note="Via SmartThings" />
          </div>
        </div>
      </div>

      {/* Bottom callout */}
      <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-blue-950/40 border border-white/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Power className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <h5 className="text-xs font-bold text-white">Revogação de Emergência em 1 Clique</h5>
            <p className="text-[11px] text-zinc-400">
              Suspeita de vazamento? Botão de pânico revoga todos os PINs ativos. Hóspedes são notificados e novos PINs podem ser gerados.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 shrink-0">
          <CheckCircle2 className="w-4 h-4" /> Auditoria LGPD Completa
        </div>
      </div>
    </div>
  );
}

function BrandBadge({ emoji, name, note }: { emoji: string; name: string; note: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <span className="text-base shrink-0">{emoji}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-white truncate">{name}</div>
        <div className="text-[9px] text-zinc-500 truncate">{note}</div>
      </div>
    </div>
  );
}
