'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Shield, Scale, CreditCard, Lock, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { ZellaLogoStatic } from '@/components/brand/ZellaLogo';

interface Section {
  heading: string;
  content: string;
}

interface LegalDoc {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  lastUpdated: string;
  badge: string;
  sections: Section[];
  markdownFile: string;
}

const LEGAL_PAGES: Record<string, LegalDoc> = {
  'privacidade-central': {
    title: 'Central de Privacidade',
    subtitle: 'Gerencie suas preferências e entenda como tratamos dados sob a LGPD',
    icon: Shield,
    lastUpdated: '01 de Julho, 2026',
    badge: 'LGPD Lei 13.709/2018',
    markdownFile: '01_CENTRAL_DE_PRIVACIDADE.md',
    sections: [
      {
        heading: '1. Apresentação da Central de Privacidade',
        content: 'A Central de Privacidade da plataforma [NOME FANTASIA - Ex: Seu Zélla] é o portal dedicado à transparência e à gestão de direitos dos titulares de dados pessoais, em cumprimento à Lei Geral de Proteção de Dados Pessoais (LGPD - Lei Federal nº 13.709/2018). Atuamos com o compromisso de proteger a privacidade dos nossos contratantes (pousadas, hotéis boutique e anfitriões de aluguel por temporada) bem como dos seus respectivos hóspedes cujas interações são intermediadas por nossos agentes de Inteligência Artificial.',
      },
      {
        heading: '2. Mapa do Tratamento de Dados Pessoais',
        content: 'Tratamos os dados estritamente necessários para viabilizar os serviços: (i) Dados do Contratante: nome, e-mail, telefone, CPF/CNPJ e endereço da propriedade para faturamento e suporte; (ii) Dados dos Hóspedes: nome, número de telefone (WhatsApp) e preferências de acomodação para atendimento automatizado 24/7; (iii) Dados Financeiros: chaves PIX e histórico de pagamentos via [GATEWAY DE PAGAMENTO - Ex: Mercado Pago]; (iv) Registros de Acesso: IP, data/hora e logs de auditoria com retenção legal de 180 dias.',
      },
      {
        heading: '3. Direitos do Titular (Art. 18 da LGPD)',
        content: 'Como titular dos dados, você tem direito a: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade dos dados em formato estruturado (JSON/CSV); eliminação dos dados tratados com base no consentimento; informação sobre compartilhamento; e revogação do consentimento.',
      },
      {
        heading: '4. Segurança e Criptografia da Informação',
        content: 'Adotamos arquitetura de Zero-Trust Security e controles rígidos de segurança: todas as conexões utilizam HTTPS/TLS 1.3; banco de dados criptografado com algoritmo AES-256-GCM; isolamento multi-tenant estrito entre contas; e expurgo automatizado do histórico de conversas do WhatsApp após [RETENÇÃO DE CONVERSAS - Ex: 90 dias].',
      },
      {
        heading: '5. Contato do Encarregado de Proteção de Dados (DPO)',
        content: 'Para exercer qualquer direito previsto na LGPD ou esclarecer dúvidas, entre em contato diretamente com o nosso DPO pelo e-mail [E-MAIL DPO / PRIVACIDADE - Ex: privacidade@zehla.com.br]. Prazo de resposta oficial: até [PRAZO DE RESPOSTA - Ex: 15 dias úteis].',
      },
    ],
  },
  'termos-uso': {
    title: 'Termos de Uso',
    subtitle: 'Condições gerais de acesso e utilização da plataforma',
    icon: FileText,
    lastUpdated: '01 de Julho, 2026',
    badge: 'Condições de Uso',
    markdownFile: '02_TERMOS_DE_USO.md',
    sections: [
      {
        heading: '1. Aceitação dos Termos',
        content: 'Ao criar uma conta ou utilizar qualquer funcionalidade da plataforma [NOME FANTASIA - Ex: Seu Zélla] ("Plataforma"), o CONTRATANTE (pousada, hotel ou anfitrião) declara ter lido, compreendido e aceito integralmente estes Termos de Uso. Caso não concorde com qualquer disposição, deverá cessar imediatamente o uso.',
      },
      {
        heading: '2. Descrição do Serviço SaaS',
        content: 'A Plataforma é um software fornecido em nuvem na modalidade SaaS (Software as a Service) para automação de hospitalidade, oferecendo: atendimento 24/7 via WhatsApp com Inteligência Artificial, painel de controle operacioanl (DDC), emissão de cobranças via PIX e sincronização de calendários iCal. A [RAZÃO SOCIAL DA EMPRESA LTDA] reserva-se o direito de atualizar e aprimorar as funcionalidades continuamente.',
      },
      {
        heading: '3. Cadastro e Responsabilidade das Contas',
        content: 'É responsabilidade exclusiva do CONTRATANTE manter a confidencialidade de suas credenciais de acesso (e-mail e senha). O CONTRATANTE responde civil e criminalmente por todas as atividades realizadas em sua conta e compromete-se a não utilizar a Plataforma para envio de SPAM ou conteúdo ilícito.',
      },
      {
        heading: '4. Agentes de IA, Intervenção Humana e Disponibilidade',
        content: 'A IA atua como assistente virtual treinada com informações fornecidas pelo CONTRATANTE. O CONTRATANTE pode supervisionar as conversas e acionar o recurso "Assumir Chat" a qualquer momento para assumir o diálogo pelo WhatsApp. A intervenção humana direta não gera abatimento, desconto ou devolução do valor da mensalidade e taxas contratadas. O retorno do atendimento automatizado é restabelecido pelo comando "Zélla assume". A integração com o WhatsApp depende da infraestrutura mantida pela Meta Platforms Inc., não se responsabilizando a Plataforma por indisponibilidades globais dos servidores da Meta.',
      },
      {
        heading: '5. Nível de Serviço (SLA) e Foro',
        content: 'A Plataforma busca manter disponibilidade mensal de [SLA DE DISPONIBILIDADE - Ex: 99,5%]. Para dirimir eventuais controvérsias, as partes elegem o Foro da Comarca de [CIDADE DO FORO DA COMARCA - Ex: Florianópolis/SC].',
      },
    ],
  },
  'politica-privacidade': {
    title: 'Política de Privacidade',
    subtitle: 'Como tratamos, retemos e protegemos suas informações',
    icon: Lock,
    lastUpdated: '01 de Julho, 2026',
    badge: 'Proteção de Dados',
    markdownFile: '03_POLITICA_DE_PRIVACIDADE.md',
    sections: [
      {
        heading: '1. Controlador e Operador dos Dados',
        content: 'A [RAZÃO SOCIAL DA EMPRESA LTDA], inscrita no CNPJ sob o nº [CNPJ Nº XX.XXX.XXX/0001-XX], atua como Controladora dos dados de cadastro e pagamento dos contratantes, e como Operadora dos dados pessoais de hóspedes processados a mando do contratante.',
      },
      {
        heading: '2. Bases Legais (Art. 7º da LGPD)',
        content: 'O tratamento de dados fundamenta-se nas seguintes hipóteses legais: Execução de contrato (art. 7º, V) para prestação dos serviços; Cumprimento de obrigação legal (art. 7º, II) para retenção de logs fiscais e de acesso; Legítimo interesse (art. 7º, IX) para prevenção a fraudes; e Consentimento (art. 7º, I) para envio de comunicados promocionais.',
      },
      {
        heading: '3. Compartilhamento de Dados com Terceiros',
        content: 'Não comercializamos dados pessoais. O compartilhamento ocorre exclusivamente com parceiros operacionais indispensáveis: Meta Platforms Inc. (WhatsApp Business API) para envio de mensagens; [GATEWAY DE PAGAMENTO - Ex: Mercado Pago] para processamento financeiro; e provedores de infraestrutura em nuvem [PROVEDOR DE HOSPEDAGEM - Ex: Vercel / AWS / Upstash].',
      },
      {
        heading: '4. Retenção e Expurgo de Dados',
        content: 'Os dados de cadastro são mantidos durante a vigência do contrato mais [PRAZO FISCAL - Ex: 5 anos] para obrigações tributárias. Históricos de mensagens de atendimento no WhatsApp são retidos por [RETENÇÃO DE CONVERSAS - Ex: 90 dias] e descarte definitivo subsequente. Logs de conexão são guardados por 180 dias nos termos do Marco Civil da Internet.',
      },
      {
        heading: '5. Canal do DPO',
        content: 'Para solicitações relativas a dados pessoais, entre em contato pelo e-mail [E-MAIL DPO / PRIVACIDADE - Ex: privacidade@zehla.com.br].',
      },
    ],
  },
  'politica-cobranca': {
    title: 'Política de Cobrança',
    subtitle: 'Regras de faturamento, trial gratuito e renovações',
    icon: CreditCard,
    lastUpdated: '01 de Julho, 2026',
    badge: 'Faturamento & Reembolso',
    markdownFile: '04_POLITICA_DE_COBRANCA.md',
    sections: [
      {
        heading: '1. Período de Teste Gratuito (Trial 7 Dias)',
        content: 'Oferecemos um período de teste gratuito de [DURAÇÃO DO TRIAL - Ex: 7 dias] sem exigência de cadastro de cartão de crédito. Ao final do trial, o usuário poderá escolher um plano mensal ou anual para continuar utilizando a Plataforma.',
      },
      {
        heading: '2. Formas de Pagamento Aceitas',
        content: 'Aceitamos pagamento via PIX (confirmação instantânea e emissão de QR Code) e Cartão de Crédito recorrente (faturamento mensal ou anual nas bandeiras Visa, Mastercard, Elo e Amex). As notas fiscais (NFS-e) são emitidas em até [PRAZO EMISSÃO NF - Ex: 5 dias úteis] após o pagamento.',
      },
      {
        heading: '3. Inadimplência e Tolerância',
        content: 'Em caso de falha no pagamento da mensalidade, a Plataforma concede [DIAS DE TOLERÂNCIA - Ex: 3 dias úteis] de tolerância para atualização dos dados de pagamento sem pausa do serviço. Transcorrido o prazo, o acesso é suspenso temporariamente até a regularização. Não cobramos multas por atraso.',
      },
      {
        heading: '4. Cancelamento e Direito de Arrependimento',
        content: 'O cancelamento pode ser efetuado a qualquer momento no painel do usuário ou pelo e-mail [E-MAIL DE SUPORTE - Ex: suporte@zehla.com.br]. O serviço permanece ativo até o fim do período faturado. Conforme o Art. 49 do CDC, compras por pessoas físicas possuem garantia de reembolso total em até 7 dias da contratação inicial.',
      },
    ],
  },
  'contrato-saas': {
    title: 'Contrato SaaS',
    subtitle: 'Minuta de contrato de licença de software em nuvem',
    icon: Scale,
    lastUpdated: '01 de Julho, 2026',
    badge: 'Licença de Software',
    markdownFile: '05_CONTRATO_SAAS.md',
    sections: [
      {
        heading: 'CLÁUSULA 1ª — DO OBJETO DO CONTRATO',
        content: 'Licença de uso temporária, não exclusiva e revogável da Plataforma [NOME FANTASIA - Ex: Seu Zélla] (Software as a Service) para automação de atendimento via WhatsApp com IA, gestão de reservas, conciliação PIX e métricas operacionais.',
      },
      {
        heading: 'CLÁUSULA 2ª — DAS OBRIGAÇÕES DA CONTRATADA',
        content: 'Garantir disponibilidade da Plataforma com SLA de [SLA DE DISPONIBILIDADE - Ex: 99,5%], manter sigilo dos dados do CONTRATANTE com criptografia AES-256-GCM e prestar suporte técnico nos canais oficiais.',
      },
      {
        heading: 'CLÁUSULA 3ª — DAS OBRIGAÇÕES DO CONTRATANTE',
        content: 'Manter credenciais seguras, utilizar a Plataforma em observância à legislação vigente, proibir o envio de SPAM e efetuar pontualmente o pagamento dos valores do plano contratado.',
      },
      {
        heading: 'CLÁUSULA 4ª — VIGÊNCIA, RESCISÃO E FORO',
        content: 'Vigência por prazo indeterminado. Rescisão livre a qualquer momento sem incidência de multa para planos mensais. Foro eleito: Comarca de [CIDADE DO FORO DA COMARCA - Ex: Florianópolis/SC].',
      },
    ],
  },
  'programa-amortizacao': {
    title: 'Programa de Amortização por Indicação',
    subtitle: 'Regras oficiais do sistema de créditos que abate a mensalidade de pousadas e anfitriões que indicam o Seu Zélla',
    icon: Scale,
    lastUpdated: '03 de Agosto, 2026',
    badge: 'Programa de Recompensas',
    markdownFile: '06_PROGRAMA_AMORTIZACAO.md',
    sections: [
      {
        heading: '1. Natureza da Recompensa',
        content:
          'O Programa de Amortização por Indicação NÃO paga valores via PIX ao referrer. Toda indicação convertida ' +
          'gera CRÉDITOS que AMORTIZAM (reduzem) o valor da mensalidade do referrer na próxima fatura. Créditos não ' +
          'são conversíveis em dinheiro, transferíveis entre contas, nem acumuláveis com outros programas de afiliados. ' +
          'Esta é uma bonificação de fidelidade, não uma comissão comercial.',
      },
      {
        heading: '2. Elegibilidade por Plano',
        content:
          'Participam plenamente do sistema de amortização: PRO, MAX e PARCEIRO (geram crédito a cada conversão ' +
          'confirmada). LITE participa do programa piloto: tem 60 dias iniciais de Link-in-Bio gratuito e, ao atingir ' +
          '10 indicações pagas, ganha 12 meses adicionais de Link-in-Bio e passa a gerar créditos de amortização. ' +
          'O plano GRATUITO não participa — é necessário assinar no mínimo LITE para ter acesso ao Link-in-Bio rastreado.',
      },
      {
        heading: '3. Valor do Crédito por Conversão',
        content:
          'Por cada novo cliente que assinar um plano pago via sua indicação, o referrer recebe: R$ 30 (LITE), ' +
          'R$ 60 (PRO), R$ 120 (MAX) e R$ 25 (PARCEIRO). Os valores são fixos e referem-se à primeira mensalidade ' +
          'paga pelo novo cliente. Mensalidades subsequentes do mesmo cliente não geram novos créditos. Não há ' +
          'limite máximo de conversões por mês — quanto mais indicações convertidas, mais créditos acumulados.',
      },
      {
        heading: '4. Canais de Rastreamento Válidos',
        content:
          'A indicação é comprovada por um destes três canais oficiais: (a) Link-in-Bio curto no formato ' +
          '/r/CODIGO que grava cookie de 90 dias no navegador do lead; (b) E-mail com token assinado criptograficamente ' +
          'em base64 que prova que o lead veio do seu e-mail específico; (c) Deep link do WhatsApp com código embutido ' +
          'na mensagem. Cliques sem cookie válido não geram crédito. O lead deve usar o mesmo navegador/dispositivo ' +
          'do clique no momento da assinatura, e o cookie deve estar dentro da janela de 90 dias.',
      },
      {
        heading: '5. Mecanismos Anti-Fraude',
        content:
          'Aplicamos fingerprint SHA-256 combinando IP + User-Agent + Accept-Language do visitante. Deduplicação ' +
          'automática de cliques por dispositivo a cada 24 horas (mesmo IP/navegador não conta como clique novo). ' +
          'Auto-indicação é bloqueada: o sistema verifica se o e-mail do novo cliente é diferente do e-mail do ' +
          'referrer, se o tenantId é diferente, e se o fingerprint não corresponde ao do referrer. Conversões exigem: ' +
          'cookie de indicação ativo, assinatura paga confirmada pelo gateway, e-mail do novo cliente diferente do ' +
          'referrer, e pelo menos 24 horas entre o clique e a conversão.',
      },
      {
        heading: '6. Janela de Confirmação (Anti-Chargeback)',
        content:
          'Todo crédito fica em status "pending" por 30 dias após a conversão. Em caso de reembolso, chargeback ' +
          'ou cancelamento do novo cliente dentro desse período, o crédito é estornado (status "reversed") e não ' +
          'amortiza a mensalidade do referrer. Após 30 dias sem chargeback, o crédito passa a "confirmed" e fica ' +
          'disponível para uso imediato. Um job cron diário processa todas as conversões pendentes que completaram ' +
          '30 dias e as confirma automaticamente.',
      },
      {
        heading: '7. Limite Mensal de Amortização',
        content:
          'O referrer pode abater no máximo 50% do valor da própria mensalidade com créditos em cada ciclo. ' +
          'Créditos excedentes permanecem disponíveis para o mês seguinte. Isso garante que sempre haja um pagamento ' +
          'mínimo mensal, impedindo que o sistema vire "assinatura gratuita indefinida" e mantendo a sustentabilidade ' +
          'econômica do programa. Exemplo: mensalidade PRO de R$ 397, máximo de amortização = R$ 198,50.',
      },
      {
        heading: '8. Validade dos Créditos',
        content:
          'Créditos não utilizados expiram 12 meses após a data de confirmação. O sistema aplica automaticamente ' +
          'os créditos mais antigos primeiro (FIFO - First In, First Out) para evitar perda por expiração. ' +
          'Notificações por e-mail são enviadas 30 dias antes da expiração. Créditos expirados não podem ser ' +
          'restaurados sob nenhuma circunstância.',
      },
      {
        heading: '9. Regra Especial LITE — Milestone de 10 Conversões',
        content:
          'O plano LITE tem apenas 60 dias iniciais de Link-in-Bio gratuito. Ao atingir 10 indicações convertidas ' +
          '(qualquer plano: LITE, PRO, MAX ou PARCEIRO), o sistema concede automaticamente: (a) 12 meses adicionais ' +
          'de Link-in-Bio gratuito (totalizando mais 365 dias a partir da data do milestone); (b) acesso permanente ' +
          'ao sistema de amortização (a partir de então, novas conversões geram créditos normalmente). Esta bonificação ' +
          'é definitiva e não é revogada mesmo se o plano mudar para PRO/MAX no futuro. O progresso do milestone é ' +
          'mostrado em tempo real no dashboard.',
      },
      {
        heading: '10. Mudança de Plano',
        content:
          'Se o referrer fizer upgrade de LITE para PRO/MAX antes de atingir o milestone de 10 conversões, passa ' +
          'imediatamente a gerar créditos por novas conversões (antigas continuam contando para o milestone). Os ' +
          'créditos gerados pós-milestone permanecem válidos. Em caso de downgrade para GRATUITO, créditos existentes ' +
          'são preservados mas não podem ser aplicados (gratuito não tem mensalidade para amortizar) — ficam congelados ' +
          'até novo upgrade. Não há perda de créditos por downgrade.',
      },
      {
        heading: '11. Encerramento e Suspensão',
        content:
          'O Seu Zélla reserva-se o direito de suspender ou encerrar contas que tentem burlar o sistema de indicação: ' +
          'auto-indicação, cliques artificiais via bots/proxies, IPs de datacenter conhecidos, farms de contas, e ' +
          'padrões de uso anômalos. Créditos obtidos fraudulentamente são anulados retroativamente. O programa pode ' +
          'ser descontinuado com aviso prévio de 30 dias via e-mail e banner no dashboard, preservando créditos já ' +
          'confirmados para uso até a data de expiração natural.',
      },
      {
        heading: '12. Disposições Finais',
        content:
          'Este Programa é uma bonificação opcional e não constitui obrigação contratual. Modificações nas regras ' +
          'serão comunicadas com 30 dias de antecedência. Caso de dúvida sobre interpretação, prevalece a versão ' +
          'mais favorável ao referrer. Para esclarecimentos, contate suporte@zehla.com.br. Ao utilizar seus links ' +
          'de indicação, você concorda com todas as regras aqui descritas.',
      },
    ],
  },
};

const FALLBACK: LegalDoc = {
  title: 'Documento não encontrado',
  subtitle: 'O documento jurídico solicitado não está disponível',
  icon: FileText,
  lastUpdated: '',
  badge: 'Erro 404',
  markdownFile: '',
  sections: [],
};

const SLUG_LIST = [
  { slug: 'privacidade-central', label: 'Central de Privacidade', icon: Shield },
  { slug: 'termos-uso', label: 'Termos de Uso', icon: FileText },
  { slug: 'politica-privacidade', label: 'Política de Privacidade', icon: Lock },
  { slug: 'politica-cobranca', label: 'Política de Cobrança', icon: CreditCard },
  { slug: 'contrato-saas', label: 'Contrato SaaS', icon: Scale },
  { slug: 'programa-amortizacao', label: 'Programa de Amortização', icon: Scale },
];

export default function LegalDocumentPage() {
  const params = useParams<{ slug: string }>();
  const page = LEGAL_PAGES[params.slug] ?? FALLBACK;
  const Icon = page.icon;
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = () => {
    const fullText = `# ${page.title}\n${page.subtitle}\n\n` + 
      page.sections.map(s => `## ${s.heading}\n${s.content}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#080808]/90 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/legal"
              className="text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/[0.05] flex items-center gap-2 text-xs font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Central Jurídica</span>
            </Link>
            <div className="h-4 w-px bg-white/10 hidden sm:block" />
            <ZellaLogoStatic />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-neutral-300 transition-all"
              title="Copiar texto do documento para a área de transferência"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Copiar Documento</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 sticky top-24">
            <h3 className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest px-3 mb-3">
              Documentos Legais
            </h3>
            <nav className="space-y-1">
              {SLUG_LIST.map((item) => {
                const ItemIcon = item.icon;
                const isActive = params.slug === item.slug;
                return (
                  <Link
                    key={item.slug}
                    href={`/legal/${item.slug}`}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <ItemIcon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 pt-4 border-t border-white/[0.05] px-3">
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Arquivo editável: <strong className="text-neutral-400 font-mono">{page.markdownFile}</strong></span>
              </div>
            </div>
          </div>
        </aside>

        {/* Document Body */}
        <article className="lg:col-span-9">
          
          {/* Header Banner */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 mb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Icon className="w-3.5 h-3.5" />
                <span>{page.badge}</span>
              </div>
              {page.lastUpdated && (
                <span className="text-xs text-neutral-500 font-medium">
                  Última atualização: {page.lastUpdated}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
              {page.title}
            </h1>
            <p className="text-neutral-400 text-sm md:text-base">
              {page.subtitle}
            </p>
          </div>

          {/* Editable Fields Notice */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-8 flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-400">Campos Editáveis:</strong> As expressões contidas entre colchetes como <code className="bg-amber-400/20 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px]">[RAZÃO SOCIAL DA SUA EMPRESA]</code> devem ser personalizadas com os dados reais do seu negócio ao implantar os termos.
            </p>
          </div>

          {/* Sections List */}
          <div className="space-y-6">
            {page.sections.map((section, index) => (
              <section key={index} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 md:p-8 hover:border-white/[0.08] transition-colors">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs flex items-center justify-center font-mono">
                    {index + 1}
                  </span>
                  {section.heading}
                </h2>
                <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </section>
            ))}
          </div>

          {/* Fallback when empty */}
          {page.sections.length === 0 && (
            <div className="text-center py-20 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
              <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Documento não encontrado</h3>
              <p className="text-neutral-400 text-xs mb-6">O documento solicitado não foi localizado no repositório.</p>
              <Link href="/legal" className="text-emerald-400 text-xs font-semibold hover:underline">
                Voltar à Central Jurídica
              </Link>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="mt-12 pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/legal"
              className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ver todos os documentos jurídicos</span>
            </Link>

            <a
              href="mailto:privacidade@zehla.com.br"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
            >
              <span>Dúvidas jurídicas? Fale com nosso suporte</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

        </article>
      </main>
    </div>
  );
}