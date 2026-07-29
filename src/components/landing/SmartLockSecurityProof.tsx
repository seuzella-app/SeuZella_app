'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Wifi, Smartphone, CheckCircle2, Key, Zap, Clock, ShieldAlert, Cpu, AlertTriangle, KeyRound, Radio } from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

export function SmartLockSecurityProof() {
  const { isPousada } = useNiche();

  return (
    <div className="w-full max-w-5xl mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-[#0b0c13] border border-emerald-500/30 text-left relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]">
      {/* Top Hairline Metallic Accent */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
        isPousada ? 'via-emerald-400' : 'via-blue-400'
      } to-transparent shadow-md`} />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase font-mono border ${
              isPousada ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            }`}>
              🔒 TECLADO & FECHADURA ELETRÔNICA SMART
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono border border-white/10">
              Criptografia AES-128 & Protocolo de Exceção
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Como garantimos 100% de segurança e tratamos qualquer exceção no imóvel?
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Sua fechadura nunca fica desprotegida e seus hóspedes nunca passam sufoco. O Zélla emite senhas temporárias com protocolo automático de emergências e reentrada de pertences esquecidos.
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
            O PIN temporário gerado (ex: <code className="text-emerald-300 font-mono font-bold">🔑 749201#</code>) é ativo estritamente das 14:00 do check-in às 11:00 do check-out. Tentar a senha fora do horário bloqueia o acesso externo.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2 hover:border-blue-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Cpu className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">2. Algoritmo Offline (Sem Wi-Fi)</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Se a internet da praia/serra cair ou faltar luz no bairro, a porta **continua funcionando**. Usamos algoritmo matemático OTP (Time-Based) que valida o PIN offline no microchip da fechadura sem depender de sinal na porta.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2 hover:border-amber-500/30 transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">3. Liberação Pós-Pagamento</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            O Zélla só dispara a senha no WhatsApp após a confirmação real do PIX ou autorização do Cartão. Curiosos, contatos sem cadastro ou reservas canceladas nunca recebem o código de entrada.
          </p>
        </div>
      </div>

      {/* 🚨 SPECIAL EXCEPTION PROTOCOL SECTION (RESPOSTA RÁPIDA A EXCEÇÕES) */}
      <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-[#0f1019] border border-amber-500/30 space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4" />
          <span>Protocolo de Exceções & Emergências Inteligente Zélla</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Exception 1: Esqueceu Pertences Pós Check-out */}
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
              Se o hóspede já fez check-out e percebe que esqueceu a carteira ou chave do carro lá dentro, ele manda mensagem no WhatsApp. O Zélla reconhece o histórico da reserva recente e emite uma <strong className="text-white">chave de acesso temporária de 15 minutos</strong> para resgate, notificando o anfitrião em tempo real no DDC.
            </p>
          </div>

          {/* Exception 2: Hóspede ainda dentro do imóvel no horário do check-out */}
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
              <strong className="text-white">Ninguém fica trancado dentro do imóvel.</strong> Todas as fechaduras abrem por dentro mecanicamente pelo manípulo/maçaneta. Se o hóspede sair 15 min atrasado, o Zélla aplica um <strong className="text-white">Buffer de Tolerância Flexível</strong> e notifica o hóspede de forma cortês no WhatsApp.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-white/10">
          <span className="text-zinc-400 text-[11px]">
            ⚡ <strong className="text-white">Controle Remoto de Emergência 1-Click:</strong> O anfitrião tem no DDC o botão de pânico para abrir a porta remotamente de qualquer lugar do mundo.
          </span>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 whitespace-nowrap">
            100% Protegido contra Imprevistos
          </span>
        </div>
      </div>

      {/* Supported Lock Brands Bar */}
      <div className="mt-6 p-4 rounded-2xl bg-zinc-950/80 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Key className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <h5 className="text-xs font-bold text-white">Compatibilidade Universal (Sua Fechadura Atual Já Funciona)</h5>
            <p className="text-[11px] text-zinc-400">Tuya • Smart Life • TTLock • Intelbras (IFR/FR) • Yale Access • August • Nuki • Igloohome • Papaiz • Samsung Smart</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 shrink-0">
          <CheckCircle2 className="w-4 h-4" /> Conexão em 2 Minutos
        </div>
      </div>
    </div>
  );
}
