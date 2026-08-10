import type { NicheType } from '@/contexts/NicheContext';

// ─── PAIN POINTS ───────────────────────────────────────────────
export interface PainCard {
  icon: string;
  title: string;
  desc: string;
  stat?: { val: string; label: string };
  color: string;
  size: 'lg' | 'sm';
}

// ─── HOW IT WORKS ──────────────────────────────────────────────
export interface StepData {
  num: string;
  icon: string;
  title: string;
  subtitle: string;
  desc: string;
  color: string;
  highlights: string[];
  fields?: string[];
}

// ─── FEATURES ──────────────────────────────────────────────────
export interface FeatureData {
  icon: string;
  badge: string;
  heroStat: { val: string; label: string; gradient: string };
  headline: string;
  subtitle: string;
  desc: string;
  stats: { val: string; label: string; sublabel?: string; icon: string }[];
  pills: { text: string; accent?: boolean }[];
  bottomLine: string;
  mockup: 'whatsapp' | 'linkinbio' | 'airbnb-import';
  reverse: boolean;
}

// ─── DASHBOARD ─────────────────────────────────────────────────
export interface DashboardConfig {
  badge: string;
  headline: string;
  headlineAccent: string;
  desc: string;
  pains: { icon: string; title: string; desc: string }[];
  stats: { label: string; val: string; title: string; color: string }[];
  recentActivity: { color: string; text: string; time: string }[];
  footerLeft: { icon: string; label: string; value: string };
  footerRight: { icon: string; label: string; value: string };
  chatConversation: { sender: 'user' | 'bot'; name?: string; text: string; confidence?: string; actions?: string }[];
}

// ─── TESTIMONIALS ──────────────────────────────────────────────
export interface Testimonial {
  name: string;
  role: string;
  location: string;
  text: string;
  avatar: string;
  rating: number;
}

// ─── PRICING ───────────────────────────────────────────────────
export interface PricingCopy {
  focusLabel: string;
  focusDesc: string;
}

// ─── FAQ ───────────────────────────────────────────────────────
export interface FAQItem {
  question: string;
  answer: string;
}

// ─── NICHE SWITCHER ────────────────────────────────────────────
export interface SwitcherContent {
  headline: string;
  subheadline: string;
  heroStat: { val: string; label: string };
  backgroundImage: string;
  ctaText: string;
  accentColor: string;
  glowColor: string;
}

// ─── FULL NICHE CONTENT ────────────────────────────────────────
export interface NicheContent {
  switcher: SwitcherContent;
  painCards: PainCard[];
  steps: StepData[];
  features: FeatureData[];
  dashboard: DashboardConfig;
  testimonials: Testimonial[];
  pricing: PricingCopy;
  faqs: FAQItem[];
}

// ═══════════════════════════════════════════════════════════════
// POUSADA CONTENT — Zélla Pousadas
// Terminologia exclusiva: pousada, quarto, diária, hóspede, reserva direta, OTA
// NUNCA usar: imóvel, anúncio, Airbnb, anfitrião
// ═══════════════════════════════════════════════════════════════
const pousadaContent: NicheContent = {
  switcher: {
    headline: 'Transforme o WhatsApp da sua Pousada na sua Recepção Digital 24 horas.',
    subheadline: 'Atenda interessados no WhatsApp a qualquer hora, receba o pagamento das diárias na hora no PIX sem pagar de 15% a 20% de comissão para sites de reserva, e entregue a senha do quarto automaticamente.',
    heroStat: { val: '0% Taxa', label: 'comissão em reservas no PIX Direto' },
    backgroundImage: '/images/niche-pousadas-bg.jpg',
    ctaText: 'Ver Planos para Pousadas',
    accentColor: 'emerald',
    glowColor: 'rgba(16, 185, 129, 0.08)',
  },

  painCards: [
    {
      icon: 'Clock',
      title: 'Nunca mais perca uma reserva',
      desc: 'Enquanto você descansa, o assistente inteligente do Zélla atende cada hóspede em até 8 segundos — respondendo sobre disponibilidade, preços e enviando sua chave PIX cadastrada. Madrugada, feriado, domingo de chuva: sempre online.',
      stat: { val: '24/7', label: 'Atendimento ininterrupto' },
      color: 'emerald',
      size: 'lg',
    },
    {
      icon: 'MessageSquare',
      title: 'Mensagens agrupadas',
      desc: 'O Zélla agrupa mensagens e responde tudo de uma vez — mais profissional para o hóspede e menos custo para você.',
      stat: { val: '1', label: 'Balão com tudo incluído' },
      color: 'blue',
      size: 'lg',
    },
    {
      icon: 'Users',
      title: 'Responde tudo de uma vez',
      desc: 'Uma resposta densa que resolve todas as perguntas do hóspede — sem vai-e-volta de mensagens.',
      color: 'sky',
      size: 'sm',
    },
    {
      icon: 'BarChart3',
      title: 'Painel de controle em tempo real',
      desc: 'Reservas geradas, receita do dia, taxa de ocupação — tudo num dashboard que se atualiza ao vivo. Relatórios semanais automáticos por e-mail para decisões sem achismo.',
      color: 'amber',
      size: 'sm',
    },
    {
      icon: 'ShieldCheck',
      title: 'Economia no WhatsApp',
      desc: 'A Meta vai cobrar por mensagem em 2026. O Zélla já agrupa mensagens e responde tudo de uma vez para reduzir esse custo em até 80% — você economiza mais.',
      color: 'violet',
      size: 'sm',
    },
    {
      icon: 'DollarSign',
      title: 'Zero comissão de OTA',
      desc: 'Cada reserva que sai pelo WhatsApp é 15% da Booking ou Decolar que fica no seu bolso. O Zélla converte hóspedes em reservas diretas — sem intermediário, sem comissão, sem perder o controle.',
      color: 'pink',
      size: 'sm',
    },
  ],

  steps: [
    {
      num: '01',
      icon: 'UserPlus',
      title: 'Cadastre sua pousada & conecte via QR Code',
      subtitle: '5 minutos é tudo que você precisa (Zero taxas de mensagem)',
      desc: 'Informe nome, quantidade de quartos e aponte a câmera do seu celular para o QR Code na tela. O Zélla se conecta ao seu WhatsApp instantaneamente sem burocracia, clona seu tom de voz e personaliza as respostas com suas regras e chave PIX.',
      color: 'emerald',
      highlights: ['Conexão Instantânea via QR Code', 'Zero Taxas Meta por Conversa', 'Clone Digital de Tom de Voz'],
      fields: ['Conexão por QR Code', 'Nome da pousada', 'WhatsApp oficial', 'Endereço completo', 'Qtd. de quartos', 'Chave PIX (opcional)', 'Regras da pousada'],
    },
    {
      num: '02',
      icon: 'MessageSquare',
      title: 'O assistente atende por você no seu estilo',
      subtitle: 'Seu WhatsApp vira ponto de venda 24/7 com o seu tom de voz',
      desc: 'O assistente inteligente responde perguntas, mostra disponibilidade, negocia preços e envia a chave PIX cadastrada — tudo automaticamente, no tom de voz exato do anfitrião. O primeiro hóspede atendido costuma chegar em menos de 24 horas.',
      color: 'blue',
      highlights: ['Resposta em até 8 segundos', 'Tom de voz clonado', 'Chave PIX automática'],
    },
    {
      num: '03',
      icon: 'BarChart3',
      title: 'Acompanhe e otimize',
      subtitle: 'Dados que guiam suas decisões',
      desc: 'No painel de controle, veja em tempo real as reservas geradas, a receita do mês, a taxa de ocupação e sugestões inteligentes para vender mais. Relatórios semanais automáticos no seu e-mail.',
      color: 'violet',
      highlights: ['Dashboard em tempo real', 'Relatórios semanais', 'Sugestões de preço'],
    },
  ],

  features: [
    {
      icon: 'MessageSquare',
      badge: 'WhatsApp Inteligente 24/7 + QR Code Instantâneo',
      heroStat: { val: '8s', label: 'tempo médio de resposta', gradient: 'from-emerald-400 to-cyan-400' },
      headline: 'Seu hóspede pergunta. O Zélla reserva com o seu tom de voz.',
      subtitle: 'Não é só chat — é um motor de reservas automático e humanizado.',
      desc: 'Cada mensagem que seu hóspede manda é uma oportunidade de reserva que o Zélla não deixa escapar. Conecte via QR Code em 5 segundos, sem pagar nada de tarifas Meta. O Zélla clona seu tom de voz e entrega disponibilidade, preço e sua chave PIX num único balão denso.',
      stats: [
        { val: '24/7', label: 'Atendimento ininterrupto', sublabel: 'Sem folga, sem férias', icon: 'Clock' },
        { val: '+35%', label: 'Aumento em reservas', sublabel: 'Média nos primeiros 90 dias', icon: 'TrendingUp' },
      ],
      pills: [
        { text: 'Conexão instantânea via QR Code (Zero Taxas)', accent: true },
        { text: 'Clone Digital de Tom de Voz' },
        { text: '1 balão = tudo resolvido' },
        { text: 'Chave PIX cadastrada enviada automaticamente' },
        { text: 'PT / ES — dois idiomas' },
      ],
      bottomLine: 'Deixe o software fazer o trabalho do software. Você cuide dos hóspedes.',
      mockup: 'whatsapp',
      reverse: false,
    },
    {
      icon: 'Wifi',
      badge: 'Link-in-Bio Profissional',
      heroStat: { val: '2', label: 'cliques para reservar', gradient: 'from-blue-400 to-violet-400' },
      headline: 'Bonito ganha elogios. Inteligente ganha reservas.',
      subtitle: 'Seu Instagram vira máquina de conversão.',
      desc: 'Cada seguidor no seu Instagram é uma reserva que não aconteceu ainda. O Link-in-Bio do Zélla transforma sua bio numa página de conversão — com galeria, reservas diretas e avaliações reais.',
      stats: [
        { val: '0%', label: 'Comissão de OTA', sublabel: 'Receita 100% direta', icon: 'Shield' },
        { val: '+20%', label: 'Receita por diária', sublabel: 'Com reservas diretas', icon: 'TrendingUp' },
      ],
      pills: [
        { text: 'Reservas diretas sem intermediário', accent: true },
        { text: 'Galeria de fotos otimizada' },
        { text: 'Avaliações reais de hóspedes' },
        { text: 'SEO + análise de tráfego' },
      ],
      bottomLine: 'Menos cliques para o hóspede. Mais receita direta para você. (PRO e MAX)',
      mockup: 'linkinbio',
      reverse: true,
    },
  ],

  dashboard: {
    badge: 'Centro de Comando Operacional',
    headline: 'Veja cada reserva acontecer,',
    headlineAccent: 'em tempo real.',
    desc: 'O Diário de Conversas dá controle absoluto sobre o atendimento. Monitore as conversas em tempo real, veja o que o hóspede precisa e assuma o chat com apenas um clique para manter o toque humano personalizado.',
    pains: [
      { icon: 'Activity', title: 'Acompanhamento ao Vivo', desc: 'Acompanhe as respostas automáticas em tempo real. Veja com clareza a segurança do assistente e garanta um atendimento livre de falhas.' },
      { icon: 'Hand', title: 'Assuma quando Quiser', desc: 'Se o hóspede solicitar algo muito específico, pause o assistente e assuma a conversa na hora. A transição é imperceptível para o hóspede.' },
      { icon: 'DollarSign', title: 'Métricas de Faturamento e Economia', desc: 'Acompanhe a receita de reservas diretas convertidas e visualize a economia de taxas de comissão (Booking, Decolar) salvas pelo assistente.' },
    ],
    stats: [
      { label: 'Média das pousadas parceiras', val: '24/7', title: 'Atendimento inteligente', color: 'text-emerald-400' },
      { label: 'Média dos primeiros 90 dias', val: '+35%', title: 'Aumento em reservas', color: 'text-blue-400' },
      { label: 'Sua chave PIX cadastrada', val: 'PIX', title: 'Pagamento integrado', color: 'text-amber-400' },
      { label: 'Sem surpresas no fim do mês', val: 'R$ 197', title: 'A partir de /mês', color: 'text-zinc-300' },
    ],
    recentActivity: [
      { color: 'bg-blue-400', text: 'Reserva recebida (Maria)', time: 'agora' },
      { color: 'bg-emerald-400', text: 'Resposta completa enviada', time: '3m' },
      { color: 'bg-amber-400', text: 'PIX confirmado', time: '12m' },
    ],
    footerLeft: { icon: 'DollarSign', label: 'Total Convertido pelo assistente:', value: 'R$ 8.940,00' },
    footerRight: { icon: 'CheckCircle2', label: 'Taxa Booking Economizada:', value: 'R$ 1.341,00' },
    chatConversation: [
      { sender: 'user', name: 'Bernardo Silva', text: 'Olá! Gostaria de saber o valor da diária para casal no feriado de 7 de setembro.' },
      { sender: 'bot', confidence: '98%', actions: 'Calendário verificado — disponível', text: 'Olá, Bernardo! A diária do Quarto Casal Premium para o feriado de 7 de Setembro é R$ 447. Temos disponibilidade! Deseja que eu gere o link de reserva PIX?' },
      { sender: 'user', name: 'Bernardo Silva', text: 'Sim, por favor! Pode gerar.' },
    ],
  },

  testimonials: [
    {
      name: 'Carla Mendes',
      role: 'Proprietária',
      location: 'Pousada Serenity — Ubatuba, SP',
      text: 'O Zélla transformou nosso WhatsApp. Antes perdíamos reservas pela madrugada. Agora o assistente atende, negocia e manda o PIX sozinho. Minha receita subiu 40% em 3 meses.',
      avatar: '/avatar-serenity.jpg',
      rating: 5,
    },
    {
      name: 'Roberto Almeida',
      role: 'Gerente',
      location: 'Chalé da Montanha — Monte Verde, MG',
      text: 'Nossos hóspedes elogiam a rapidez. Eles nem percebem que é automático. O painel de controle é sensacional — vejo tudo em tempo real.',
      avatar: '/pousada-chale.jpg',
      rating: 5,
    },
    {
      name: 'Fernanda Costa',
      role: 'Proprietária',
      location: 'Pousada Sol & Mar — Florianópolis, SC',
      text: 'Eu gastava 3 horas por dia no WhatsApp. Agora o Zélla resolve 90% das conversas. Eu só intervenho quando precisa de toque humano. Libertador!',
      avatar: '/pousada-vista.jpg',
      rating: 5,
    },
  ],

  pricing: {
    focusLabel: 'Volume de reservas',
    focusDesc: 'Quanto mais cotações o assistente atende, mais reservas diretas você fecha. Sem comissão de OTA, sem intermediário.',
  },

  faqs: [
    { question: 'Como funciona a conexão por QR Code e o Clone de Tom de Voz?', answer: 'Você conecta o WhatsApp da sua pousada em 5 segundos simplesmente apontando a câmera do celular para o QR Code no painel. O Zélla analisa o histórico de mensagens antigas e clona seu tom de voz, gírias e expressões — atendendo com a sua personalidade exata, sem burocracia e com ZERO custo por mensagem!' },
    { question: 'O Zélla funciona com o WhatsApp Business da minha pousada?', answer: 'Sim! O Zélla se conecta ao seu WhatsApp Business oficial ou pessoal via QR Code. Seu número continua o mesmo, e você mantém acesso total ao histórico de conversas.' },
    { question: 'Como o hóspede recebe a chave PIX?', answer: 'O Zélla envia automaticamente a chave PIX cadastrada no momento certo da conversa — quando o hóspede confirma interesse na reserva. Tudo em um único balão, sem fragmentação.' },
    { question: 'Posso intervir na conversa quando quiser?', answer: 'Sim! O painel mostra todas as conversas em tempo real. Com um clique você pausa o assistente e assume o atendimento. A transição é imperceptível para o hóspede.' },
    { question: 'O Zélla funciona com calendário de disponibilidade?', answer: 'Sim. O Zélla consulta seu calendário em tempo real antes de confirmar qualquer reserva. Não há risco de overbooking.' },
    { question: 'O WhatsApp vai ficar mais caro?', answer: 'Com a conexão por QR Code do Zélla, você não paga nenhuma tarifa da Meta por mensagem. O Zélla agrupa mensagens e responde tudo de uma vez, reduzindo o custo de operação a zero.' },
    { question: 'Qual o custo por mensagem?', answer: 'Nossos planos começam em R$ 197/mês com tudo incluído. Não cobramos por mensagem individual — o envio via QR Code é ilimitado e livre de taxas por mensagem.' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// AIRBNB CONTENT — Zélla AirB
// Terminologia exclusiva: imóvel, anúncio, Airbnb, anfitrião, Superhost, comissão
// NUNCA usar: pousada, quarto, diária
// Conceitos do documento: Inbox Sync, Calendar Sync, Lifecycle Hooks, Review Engine, PIX Gatekeeper
// ═══════════════════════════════════════════════════════════════
const airbnbContent: NicheContent = {
  switcher: {
    headline: 'Transforme o WhatsApp dos seus Imóveis no seu maior canal de Reservas Diretas.',
    subheadline: 'Responda interessados 24 horas por dia, feche reservas no PIX com 0% de taxa de intermediação e entregue a senha da fechadura eletrônica automaticamente para o hóspede.',
    heroStat: { val: '95%', label: 'redução no tempo de atendimento' },
    backgroundImage: '/images/niche-anfitrioes-bg.jpg',
    ctaText: 'Ver Planos para Anfitriões',
    accentColor: 'blue',
    glowColor: 'rgba(65, 105, 225, 0.08)',
  },

  painCards: [
    {
      icon: 'Key',
      title: 'Check-in sem sua presença',
      desc: 'O hóspede fecha a reserva e recebe automaticamente as instruções de acesso com código da fechadura inteligente. Você nem precisa pegar no celular — nem de madrugada, nem no feriado.',
      stat: { val: '0 min', label: 'Tempo do anfitrião' },
      color: 'blue',
      size: 'lg',
    },
    {
      icon: 'Bot',
      title: 'O assistente que conhece seu imóvel como você',
      desc: 'O Magic Onboarding importa as regras, fotos, localização, amenidades e políticas direto do seu anúncio Airbnb — preenchendo 78% do painel automaticamente. O Zélla responde no WhatsApp com informações precisas sobre o imóvel e a vizinhança como um anfitrião local que mora ali.',
      stat: { val: '78%', label: 'Auto-preenchido pelo assistente' },
      color: 'emerald',
      size: 'lg',
    },
    {
      icon: 'ShieldAlert',
      title: 'Proteção contra banimento no Airbnb',
      desc: 'O Zélla detecta em tempo real se a conversa pertence a um hóspede originado do Airbnb e bloqueia automaticamente o envio de chaves PIX. Seu anfitrião nunca corre risco de banimento na plataforma por desvio de pagamento.',
      stat: { val: '100%', label: 'Proteção automática' },
      color: 'rose',
      size: 'lg',
    },
    {
      icon: 'Building2',
      title: 'Escale sem contratar equipe',
      desc: 'De 2 para 10 imóveis sem aumentar equipe. O Zélla atende todos simultaneamente, com respostas personalizadas para cada propriedade e sua vizinhança específica.',
      color: 'sky',
      size: 'sm',
    },
    {
      icon: 'Star',
      title: 'Caminho garantido para Superhost',
      desc: 'Respostas rápidas e precisas aumentam sua taxa de resposta — métrica crucial para o selo Superhost. O hóspede sente que está sendo cuidado por alguém que conhece o imóvel. Avaliações 5 estrelas viram consequência.',
      color: 'amber',
      size: 'sm',
    },
    {
      icon: 'DollarSign',
      title: 'Reservas diretas = mais receita',
      desc: 'Cada reserva via WhatsApp é uma comissão de 15% da Airbnb que fica no seu bolso. O Zélla converte hóspedes em clientes diretos recorrentes. Um hóspede que volta pelo WhatsApp nunca mais paga comissão.',
      stat: { val: '15%', label: 'Comissão Airbnb eliminada' },
      color: 'violet',
      size: 'sm',
    },
    {
      icon: 'TrendingUp',
      title: 'Preços Inteligentes — nunca mais alugue barato no feriado',
      desc: 'O Zélla calcula automaticamente o preço ideal por noite baseado em feriados, demanda e época do ano. O feriadão que você alugou por R$390? O Zélla teria cobrado R$680. Diária parada = dinheiro invisível que você não vê.',
      stat: { val: '+47%', label: 'mais receita com preços inteligentes' },
      color: 'emerald',
      size: 'lg',
    },
    {
      icon: 'Building2',
      title: 'Airbnb + Booking.com no mesmo calendário',
      desc: 'Sincronize reservas de Airbnb e Booking.com automaticamente. Uma reserva em qualquer plataforma bloqueia a data em todas. Zero conflito, zero overbooking. Escale para mais plataformas sem estresse.',
      stat: { val: '2+', label: 'OTAs sincronizadas' },
      color: 'sky',
      size: 'sm',
    },
    {
      icon: 'CreditCard',
      title: 'Guia Digital — o hóspede resolve sozinho',
      desc: 'Wi-Fi, regras, check-in, restaurantes próximos, contatos de emergência — tudo em um link com QR Code. O hóspede acessa pelo celular sem baixar nada. Acabou a ligação no meio da noite. O Zélla envia o link automaticamente.',
      stat: { val: '-80%', label: 'chamadas do hóspede' },
      color: 'amber',
      size: 'sm',
    },
  ],

  steps: [
    {
      num: '01',
      icon: 'Link',
      title: 'Cole a URL do seu anúncio',
      subtitle: 'O Magic Onboarding faz o resto',
      desc: 'Basta colar o link do seu anúncio Airbnb. O Zélla AirB importa automaticamente as fotos, regras, preços, amenidades, localização, políticas e informações da vizinhança — 78% do painel preenchido sem você digitar nada. Em 5 minutos está pronto para atender.',
      color: 'blue',
      highlights: ['Importação automática (78%)', 'Zero digitação', 'Revisão guiada'],
      fields: ['URL do anúncio Airbnb', 'Chave PIX', 'WhatsApp do anfitrião', 'Código da fechadura', 'Instruções de check-in', 'Regras da casa'],
    },
    {
      num: '02',
      icon: 'Bot',
      title: 'O Cérebro AirB atende no seu lugar',
      subtitle: 'WhatsApp 24/7 + Sincroniza Airbnb',
      desc: 'O Zélla responde perguntas sobre o imóvel, envia fotos, confirma disponibilidade, entrega as chaves virtuais e informa sobre a redondeza — tudo baseado no que aprendeu do seu anúncio. Mensagens automáticas na hora certa: regras da casa após reserva, senha no check-in, pedido de avaliação no checkout.',
      color: 'emerald',
      highlights: ['Respostas baseadas no anúncio', 'Mensagens automáticas na hora certa', 'Chaves virtuais automáticas'],
    },
    {
      num: '03',
      icon: 'BarChart3',
      title: 'Escale, lucre mais e gaste menos',
      subtitle: 'Preços inteligentes + Booking.com + Guia Digital',
      desc: 'O Zélla calcula o preço ideal automaticamente e conecta Airbnb + Booking.com. Economia no WhatsApp reduz 80% dos custos. Tudo automático. Você cresce sem contratar ninguém — e lucra mais em cada diária.',
      color: 'violet',
      highlights: ['Preços inteligentes automáticos', 'Booking.com iCal sync', 'Guia Digital com QR Code', 'Economia no WhatsApp (80% menos custo)', 'Alertas de avaliação'],
    },
  ],

  features: [
    {
      icon: 'Key',
      badge: 'Check-in Virtual Automático',
      heroStat: { val: '0', label: 'toques necessários', gradient: 'from-blue-400 to-indigo-400' },
      headline: 'O hóspede reserva. A chave já está lá.',
      subtitle: 'Fechadura inteligente + WhatsApp = check-in autônomo.',
      desc: 'Quando o hóspede confirma a reserva pelo WhatsApp, o Zélla envia automaticamente as instruções de acesso com o código da fechadura. Check-in autônomo, sem sua interação — nem de madrugada, nem no feriado. O hóspede chega e entra com a sensação de que tudo foi pensado para ele.',
      stats: [
        { val: '0 min', label: 'Tempo do anfitrião', sublabel: 'Check-in 100% automático', icon: 'Clock' },
        { val: '4.8★', label: 'Avaliação média', sublabel: 'Hóspedes adoram a autonomia', icon: 'Star' },
      ],
      pills: [
        { text: 'Código enviado automaticamente', accent: true },
        { text: 'Instruções de acesso passo a passo' },
        { text: 'Compatível com fechaduras smart' },
        { text: 'Suporte PT / ES' },
      ],
      bottomLine: 'Seu hóspede chega e entra. Você nem precisa acordar.',
      mockup: 'whatsapp',
      reverse: false,
    },
    {
      icon: 'Link',
      badge: 'Magic Onboarding — Importação Airbnb 1-Click',
      heroStat: { val: '1', label: 'URL para configurar', gradient: 'from-amber-400 to-rose-400' },
      headline: 'Cole o link. O Zélla se configura.',
      subtitle: 'Seu anúncio vira a base de conhecimento do assistente — incluindo a vizinhança.',
      desc: 'Não preencha formulários intermináveis. Cole a URL do seu anúncio Airbnb e o Magic Onboarding extrai tudo: fotos, regras, localização, preços, políticas, amenidades e pontos de interesse ao redor. 78% dos campos preenchidos automaticamente. Ele revisa e você só confirma — em 5 minutos está pronto para atender.',
      stats: [
        { val: '5 min', label: 'Tempo de setup', sublabel: 'Da URL ao atendimento ativo', icon: 'Zap' },
        { val: '78%', label: 'Auto-preenchido', sublabel: 'Campos importados do anúncio', icon: 'Sparkles' },
      ],
      pills: [
        { text: 'Importação automática via URL', accent: true },
        { text: 'Revisão guiada dos dados' },
        { text: 'Múltiplos anúncios, uma conta' },
        { text: 'Informações de vizinhança incluídas' },
      ],
      bottomLine: 'Sem configuração manual. O assistente aprende com o seu anúncio. (PRO e MAX)',
      mockup: 'airbnb-import',
      reverse: true,
    },
  ],

  dashboard: {
    badge: 'Portfólio Inteligente',
    headline: 'Todos os seus imóveis,',
    headlineAccent: 'um único painel.',
    desc: 'Acompanhe reservas, ocupação e avaliações de todo o seu portfólio em tempo real. Exportação iCal disponível para sincronizar disponibilidade com Airbnb e Booking — conexão direta via API em desenvolvimento. Receba notificações quando o Zélla detectar intenção de reserva e aprove com um toque.',
    pains: [
      { icon: 'Building2', title: 'Visão de Portfólio Completa', desc: 'Acompanhe ocupação, receita e avaliação de todos os seus imóveis em um único painel. Relatórios consolidados para decisões estratégicas sobre crescimento.' },
      { icon: 'Bell', title: 'Notificação de Fechamento', desc: 'Quando o Zélla detecta intenção de reserva, ele te notifica com resumo da conversa e perfil do hóspede. Você aprova com um toque — sem abrir o WhatsApp.' },
      { icon: 'DollarSign', title: 'Receita Direta Maximizada', desc: 'Cada reserva via WhatsApp elimina a comissão de 15% da Airbnb. Veja quanto você está economizando em taxas e quantos hóspedes se tornaram clientes diretos recorrentes.' },
    ],
    stats: [
      { label: 'Sem tocar no celular', val: '24/7', title: 'Atendimento inteligente', color: 'text-blue-400' },
      { label: 'Economia em comissões', val: '15%', title: 'Receita direta', color: 'text-emerald-400' },
      { label: 'Do anúncio para o assistente', val: '1 URL', title: 'Setup instantâneo', color: 'text-amber-400' },
      { label: 'Sem contratar equipe', val: '∞', title: 'Imóveis simultâneos', color: 'text-zinc-300' },
    ],
    recentActivity: [
      { color: 'bg-blue-400', text: 'Check-in virtual enviado (André)', time: 'agora' },
      { color: 'bg-emerald-400', text: 'Reserva detectada — aguardando aprovação', time: '5m' },
      { color: 'bg-amber-400', text: 'Avaliação 5★ recebida', time: '1h' },
    ],
    footerLeft: { icon: 'DollarSign', label: 'Receita Direta do Mês:', value: 'R$ 12.450,00' },
    footerRight: { icon: 'CheckCircle2', label: 'Comissões Airbnb Economizadas:', value: 'R$ 1.867,00' },
    chatConversation: [
      { sender: 'user', name: 'André Oliveira', text: 'Boa noite! Qual o valor para o apartamento de 2 quartos no feriado? Tem estacionamento próximo?' },
      { sender: 'bot', confidence: '97%', actions: 'Anúncio + localização consultados', text: 'Boa noite, André! O apartamento de 2 quartos está disponível para o feriado. Valor: R$ 380/noite. Sim, há estacionamento coberto a 2 quadras (R$ 25/dia). Posso enviar as instruções de check-in com o código da fechadura?' },
      { sender: 'user', name: 'André Oliveira', text: 'Perfeito! Quero reservar para 2 noites.' },
    ],
  },

  testimonials: [
    {
      name: 'Marcos Ferreira',
      role: 'Anfitrião Multi-Property',
      location: '5 apartamentos — São Paulo, SP',
      text: 'Com 5 apartamentos, eu não dava conta do WhatsApp. O Zélla importou tudo da Airbnb e agora atende sozinho — inclusive sobre a vizinhança. Minhas avaliações subiram porque o hóspede nunca fica sem resposta.',
      avatar: '/avatar-serenity.jpg',
      rating: 5,
    },
    {
      name: 'Patrícia Lopes',
      role: 'Anfitriã',
      location: '2 flats — Rio de Janeiro, RJ',
      text: 'O check-in virtual mudou minha vida. O hóspede recebe o código da fechadura e entra sozinho. Eu nem preciso estar na cidade. Isso é escalar de verdade — e o hóspede se sente seguro.',
      avatar: '/pousada-vista.jpg',
      rating: 5,
    },
    {
      name: 'Lucas Tanaka',
      role: 'Anfitrião',
      location: '3 chalés — Campos do Jordão, SP',
      text: 'A importação do anúncio é genial. Colei a URL e em 5 minutos o Zélla já estava respondendo com detalhes do imóvel e da redondeza. Antes eu gastava 2 horas por dia no WhatsApp, agora são 10 minutos de revisão.',
      avatar: '/pousada-chale.jpg',
      rating: 5,
    },
  ],

  pricing: {
    focusLabel: 'Escala de imóveis',
    focusDesc: 'Mais imóveis, mesma equipe zero. O Zélla atende todos simultaneamente e cada reserva direta elimina 15% de comissão Airbnb.',
  },

  faqs: [
    { question: 'Como funciona a conexão do meu WhatsApp e o Clone de Tom de Voz?', answer: 'Você conecta o WhatsApp do seu imóvel em 5 segundos simplesmente apontando a câmera do celular para o QR Code no painel. O Zélla analisa seu histórico recente de conversas e clona seu tom de voz, estilo de escrita e expressões locais — atendendo seus hóspedes como se fosse você mesmo, sem burocracia e com ZERO custo por mensagem!' },
    { question: 'O Zélla AirB importa mesmo tudo do meu anúncio Airbnb?', answer: 'Sim! O Magic Onboarding extrai fotos, regras, localização, preços, amenidades e políticas automaticamente — preenchendo 78% do painel sem você digitar nada. Você revisa e confirma em 5 minutos.' },
    { question: 'Como funciona o check-in virtual?', answer: 'Quando o hóspede confirma a reserva, o Zélla envia automaticamente as instruções de acesso com o código da fechadura inteligente. Tudo pelo WhatsApp, sem sua interação — nem de madrugada.' },
    { question: 'Como o Zélla me protege de banimento no Airbnb?', answer: 'O Zélla detecta em tempo real se a conversa pertence a um hóspede do Airbnb e bloqueia automaticamente o envio de chaves PIX — protegendo você contra banimento na plataforma por desvio de pagamento.' },
    { question: 'O Zélla envia mensagens automáticas na hora certa?', answer: 'Sim! Minutos após a reserva, o Zélla envia as regras da casa; na manhã do check-in, a senha da fechadura; após o check-out, um agradecimento e pedido de avaliação. Tudo automático, sem você aprovar.' },
    { question: 'O Zélla sabe informar sobre a vizinhança?', answer: 'Sim! Com base na localização do seu imóvel, o Zélla responde sobre restaurantes, praias, pontos turísticos, farmácias e transporte próximos. Tudo automático, sem configuração.' },
    { question: 'Quanto economizo em comissões?', answer: 'Cada reserva que o Zélla converte pelo WhatsApp elimina a comissão da Airbnb (cerca de 15%). Em um portfólio de 5 imóveis, isso pode representar mais de R$ 2.000/mês em economia. Hóspedes que voltam pelo WhatsApp nunca mais pagam comissão.' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// CONTENT RESOLVER
// ═══════════════════════════════════════════════════════════════
const contentMap: Record<NicheType, NicheContent> = {
  pousada: pousadaContent,
  airbnb: airbnbContent,
};

export function getNicheContent(niche: NicheType): NicheContent {
  return contentMap[niche];
}
