import Link from 'next/link';
import { Shield, FileText, Lock, CreditCard, Scale, Building2, ArrowLeft, ExternalLink, Mail, CheckCircle2 } from 'lucide-react';
import { ZellaLogoStatic } from '@/components/brand/ZellaLogo';

export const metadata = {
  title: 'Central Jurídica e de Privacidade | Seu Zélla',
  description: 'Documentos legais, termos de uso, política de privacidade, política de cobrança e contrato SaaS da plataforma Seu Zélla.',
};

const LEGAL_DOCUMENTS = [
  {
    slug: 'privacidade-central',
    title: 'Central de Privacidade',
    description: 'Gerencie suas preferências de dados, entenda seus direitos sob a LGPD e conheça nossas práticas de proteção de informações.',
    icon: Shield,
    badge: 'LGPD 13.709/2018',
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    slug: 'termos-uso',
    title: 'Termos de Uso',
    description: 'Condições gerais de acesso e utilização da plataforma, deveres das partes, níveis de serviço (SLA) e regras operacionais.',
    icon: FileText,
    badge: 'Uso da Plataforma',
    color: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30',
  },
  {
    slug: 'politica-privacidade',
    title: 'Política de Privacidade',
    description: 'Detalhes sobre coleta, armazenamento, retenção e compartilhamento de dados com fornecedores operacionais como Meta e provedores de pagamento.',
    icon: Lock,
    badge: 'Proteção de Dados',
    color: 'from-purple-500/20 to-violet-500/20 text-purple-400 border-purple-500/30',
  },
  {
    slug: 'politica-cobranca',
    title: 'Política de Cobrança',
    description: 'Regras de faturamento recorrente, período de teste gratuito (trial 7 dias), métodos de pagamento aceitos (PIX/Cartão) e política de reembolso.',
    icon: CreditCard,
    badge: 'Faturamento & Trial',
    color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
  },
  {
    slug: 'contrato-saas',
    title: 'Contrato SaaS',
    description: 'Minuta completa do Contrato de Licença de Uso de Software em Nuvem, vigência, obrigações recíprocas e foro de eleição.',
    icon: Scale,
    badge: 'Minuta Contratual',
    color: 'from-cyan-500/20 to-sky-500/20 text-cyan-400 border-cyan-500/30',
  },
  {
    slug: 'programa-amortizacao',
    title: 'Programa de Amortização por Indicação',
    description: 'Regras completas do sistema de créditos: como indicar, como acumular, anti-fraude, regra especial LITE e muito mais. Documento oficial que rege o programa.',
    icon: Scale,
    badge: 'Programa de Recompensas',
    color: 'from-emerald-500/20 to-cyan-500/20 text-emerald-400 border-emerald-500/30',
  },
];

export default function LegalHubPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#080808]/90 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.05] flex items-center gap-2 text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao início</span>
            </Link>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <ZellaLogoStatic />
          </div>

          <a
            href="mailto:privacidade@zehla.com.br"
            className="hidden sm:flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Falar com o DPO</span>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>Transparência e Conformidade LGPD</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Central Jurídica & de Privacidade
          </h1>
          <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
            Consulte todos os termos contratuais, políticas de privacidade, regras de faturamento e diretrizes de proteção de dados que regem a plataforma <strong className="text-white">Seu Zélla</strong>.
          </p>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {LEGAL_DOCUMENTS.map((doc) => {
            const Icon = doc.icon;
            return (
              <Link
                key={doc.slug}
                href={`/legal/${doc.slug}`}
                className="group relative bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-emerald-500/30 rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${doc.color} border flex items-center justify-center`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white/[0.04] text-neutral-400 border border-white/[0.06]">
                      {doc.badge}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors mb-2">
                    {doc.title}
                  </h2>
                  <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                    {doc.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.04] text-xs font-semibold text-neutral-400 group-hover:text-white transition-colors">
                  <span>Visualizar documento</span>
                  <ExternalLink className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Security & Compliance Highlights */}
        <div className="bg-gradient-to-br from-emerald-950/20 via-neutral-900/40 to-neutral-950 border border-emerald-500/20 rounded-2xl p-8 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Criptografia Ponta a Ponta</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Dados em trânsito protegidos por TLS 1.3 e armazenados com criptografia de alto padrão (AES-256-GCM).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Conformidade LGPD</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Processamento fundado nas hipóteses legais da Lei nº 13.709/2018 com canal direto de atendimento ao titular.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Zero Multas ou Fidelidade</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Planos mensais ou anuais com opção de cancelamento livre a qualquer momento sem taxas surpresa.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Files Download info */}
        <div className="text-center bg-white/[0.01] border border-white/[0.04] rounded-xl p-6">
          <p className="text-xs text-neutral-400">
            Precisa editar os modelos para sua propriedade? Todos os documentos estão disponíveis em formato Markdown editável na pasta <code className="bg-white/10 px-2 py-0.5 rounded text-emerald-300 font-mono text-[11px]">docs/legal/</code> do repositório.
          </p>
        </div>
      </main>
    </div>
  );
}
