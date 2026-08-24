'use client';

import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MessageCircle,
  ReceiptText,
  WalletCards,
  Zap,
} from 'lucide-react';
import { useNiche } from '@/contexts/NicheContext';

const modules = [
  {
    icon: WalletCards,
    eyebrow: 'DINHEIRO',
    title: 'Receba e acompanhe pagamentos',
    description:
      'O Zélla organiza cobranças e confirmações no fluxo da reserva, sem exigir que você entenda os bastidores financeiros.',
    points: ['PIX e cartão', 'Confirmação automática', 'Conciliação no histórico'],
  },
  {
    icon: ReceiptText,
    eyebrow: 'FISCAL',
    title: 'Documentos fiscais sem complicação',
    description:
      'Quando a emissão fiscal estiver configurada, o Zélla organiza a emissão de NFS-e para o hóspede e o acompanhamento dos documentos da sua empresa.',
    points: ['Emissão fiscal configurável', 'PDF/XML e status', 'Histórico por operação'],
  },
  {
    icon: MessageCircle,
    eyebrow: 'ATENDIMENTO',
    title: 'Converse com o hóspede pelo WhatsApp',
    description:
      'Mensagens, confirmações e orientações ficam conectadas à operação da hospedagem — sem trocar de sistema a cada tarefa.',
    points: ['Mensagens recebidas', 'Respostas conectadas ao contexto', 'Fila segura para automações'],
  },
  {
    icon: Zap,
    eyebrow: 'OPERAÇÃO',
    title: 'Tudo conversa entre si',
    description:
      'Pagamento, reserva, atendimento, documentos e acessos deixam de ser tarefas soltas e passam a fazer parte do mesmo fluxo.',
    points: ['Menos retrabalho', 'Mais rastreabilidade', 'Uma visão no ZCC'],
  },
];

export function BusinessInfrastructureSection() {
  const { isPousada } = useNiche();
  const audience = isPousada ? 'sua pousada' : 'seu imóvel';

  return (
    <section id="integracoes" className="relative overflow-hidden border-y border-white/[0.06] bg-[#0b0b0e] py-20 sm:py-24">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-emerald-500/[0.06] blur-[100px]" />
        <div className="absolute right-1/4 bottom-0 h-72 w-72 rounded-full bg-sky-500/[0.05] blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Você não precisa cuidar dos bastidores
          </div>

          <h2 className="text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl md:text-5xl">
            Você vê o resultado.
            <span className="block bg-gradient-to-r from-emerald-300 via-sky-300 to-white bg-clip-text text-transparent">
              O Zélla cuida da operação.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            Para você, tudo acontece de forma simples: <strong className="text-white">receber</strong>, <strong className="text-white">confirmar</strong>, <strong className="text-white">emitir</strong> e <strong className="text-white">atender</strong>.
            Por trás, o Zélla conecta os serviços necessários e transforma tarefas espalhadas em um único fluxo para {audience}.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <article
                key={module.title}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.04]"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/90">{module.eyebrow}</div>
                    <h3 className="mt-1 text-xl font-bold tracking-tight text-white">{module.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{module.description}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {module.points.map((point) => (
                    <div key={point} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs font-medium text-zinc-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.03] via-white/[0.02] to-emerald-400/[0.04] px-5 py-5 text-center sm:px-8">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <FileText className="h-5 w-5 text-emerald-300" />
            <p className="text-sm leading-relaxed text-zinc-300 sm:text-base">
              <strong className="text-white">Você não precisa escolher qual serviço usar.</strong> O Zélla organiza o processo e mostra para você o que precisa ser feito — no momento certo.
            </p>
            <ArrowRight className="hidden h-4 w-4 text-zinc-500 sm:block" />
          </div>
        </div>
      </div>
    </section>
  );
}
