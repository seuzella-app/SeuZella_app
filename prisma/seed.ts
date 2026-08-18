/**
 * ZEHLA — Database Seed Script
 * Popula o banco com dados realistas da Pousada Serenity (tenant client-001)
 *
 * EXECUÇÃO: bunx prisma db seed
 * LIMPEZA: Apagar db/custom.db e rodar bun run db:push antes de re-seedar
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TENANT_ID = 'client-001';
const PROPERTY_NAME = 'Pousada Serenity';

// Helper: data relativa à hoje
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0, 0);
  return d;
};

const hoursAgo = (n: number) => {
  const d = new Date();
  d.setHours(d.getHours() - n, Math.floor(Math.random() * 60), 0, 0);
  return d;
};

const minutesAgo = (n: number) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n, 0, 0);
  return d;
};

// ============================================================================
// DADOS DE HÓSPEDES (20 hóspedes com statuses variados)
// ============================================================================

const guests = [
  { name: 'Maria Silva', phone: '11987654321', email: 'maria@email.com', status: 'booked', score: 92, source: 'whatsapp', lastMessage: 'Reserva confirmada para o fim de semana!', value: 1800, checkIn: daysAgo(-2), checkOut: daysAgo(1), room: 'Suíte Lua Cheia', convCount: 8 },
  { name: 'João Santos', phone: '21999887766', email: 'joao@empresa.com', status: 'hot', score: 88, source: 'instagram', lastMessage: 'Qual valor para 3 noites em dezembro?', value: 3200, convCount: 5 },
  { name: 'Ana Oliveira', phone: '31976543210', email: null, status: 'warm', score: 72, source: 'whatsapp', lastMessage: 'Vocês aceitam pet?', value: 950, convCount: 3 },
  { name: 'Carlos Mendes', phone: '41988776655', email: 'carlos@gmail.com', status: 'booked', score: 95, source: 'booking', lastMessage: 'Pagamento via PIX realizado', value: 2400, checkIn: daysAgo(-1), checkOut: daysAgo(3), room: 'Quarto Jardim', convCount: 12 },
  { name: 'Patrícia Costa', phone: '51977665544', email: 'patricia@uol.com', status: 'hot', score: 85, source: 'whatsapp', lastMessage: 'Perfeito! Quero reservar para o feriado', value: 2800, convCount: 6 },
  { name: 'Roberto Lima', phone: '61966554433', email: null, status: 'new', score: 45, source: 'whatsapp', lastMessage: 'Olá, boa tarde! Gostaria de saber os preços', value: 0, convCount: 1 },
  { name: 'Fernanda Souza', phone: '71955443322', email: 'fernanda.souza@gmail.com', status: 'staying', score: 90, source: 'direct', lastMessage: 'O café da manhã estava maravilhoso!', value: 3500, checkIn: daysAgo(-3), checkOut: daysAgo(2), room: 'Suíte Oceano', convCount: 15 },
  { name: 'Lucas Almeida', phone: '81944332211', email: 'lucas.a@outlook.com', status: 'warm', score: 68, source: 'airbnb', lastMessage: 'Vocês têm estacionamento?', value: 1200, convCount: 2 },
  { name: 'Camila Rocha', phone: '11933221100', email: 'camila.r@gmail.com', status: 'booked', score: 91, source: 'whatsapp', lastMessage: 'Reserva para o aniversário do meu marido', value: 4500, checkIn: daysAgo(-5), checkOut: daysAgo(-2), room: 'Chalé Premium', convCount: 18 },
  { name: 'Diego Ferreira', phone: '21922110099', email: null, status: 'cold', score: 30, source: 'whatsapp', lastMessage: 'Vou verificar e retorno', value: 0, convCount: 2 },
  { name: 'Juliana Martins', phone: '31911009988', email: 'juliana.m@gmail.com', status: 'hot', score: 87, source: 'whatsapp', lastMessage: 'Fazem café da manhã vegano?', value: 2100, convCount: 7 },
  { name: 'Marcos Pereira', phone: '41900998877', email: 'marcos.p@empresa.com', status: 'checked_out', score: 93, source: 'booking', lastMessage: 'Obrigado pela estadia incrível!', value: 2800, checkIn: daysAgo(10), checkOut: daysAgo(7), room: 'Suíte Lua Cheia', convCount: 20 },
  { name: 'Isabela Rodrigues', phone: '51999887700', email: 'isabela.r@gmail.com', status: 'warm', score: 65, source: 'instagram', lastMessage: 'Quais atividades vocês recomendam?', value: 1500, convCount: 4 },
  { name: 'Rafael Barbosa', phone: '61988776600', email: null, status: 'new', score: 40, source: 'whatsapp', lastMessage: 'Oi, vocês têm vaga para carnaval?', value: 0, convCount: 1 },
  { name: 'Bruna Cardoso', phone: '71977665500', email: 'bruna.c@gmail.com', status: 'booked', score: 89, source: 'whatsapp', lastMessage: 'Reserva corporativa para 5 pessoas', value: 8500, checkIn: daysAgo(-4), checkOut: daysAgo(-1), room: 'Suíte Família', convCount: 22 },
  { name: 'Thiago Nascimento', phone: '81966554400', email: 'thiago.n@outlook.com', status: 'hot', score: 83, source: 'direct', lastMessage: 'Podem confirmar a reserva?', value: 1900, convCount: 9 },
  { name: 'Larissa Santos', phone: '11955443300', email: 'larissa.s@gmail.com', status: 'inactive', score: 15, source: 'whatsapp', lastMessage: 'Vou pensar e aviso', value: 0, convCount: 1 },
  { name: 'Gustavo Oliveira', phone: '21944332200', email: 'gustavo.o@gmail.com', status: 'booked', score: 94, source: 'airbnb', lastMessage: 'Chegaremos às 16h, tudo certo?', value: 3200, checkIn: daysAgo(0), checkOut: daysAgo(4), room: 'Suíte Oceano', convCount: 14 },
  { name: 'Amanda Ribeiro', phone: '31933221100', email: null, status: 'warm', score: 70, source: 'whatsapp', lastMessage: 'Qual a melhor época para visitar?', value: 0, convCount: 3 },
  { name: 'Pedro Henrique', phone: '41922110000', email: 'pedro.h@gmail.com', status: 'lost', score: 20, source: 'whatsapp', lastMessage: 'Encontrei outro lugar mais barato', value: 0, convCount: 4 },
];

// ============================================================================
// CONVERSAS DE WHATSAPP (12 conversas ativas com mensagens realistas)
// ============================================================================

const conversations = [
  {
    guestIdx: 0, // Maria Silva
    status: 'resolved' as const,
    aiConfidence: 95,
    messages: [
      { from: 'guest' as const, content: 'Boa tarde! Gostaria de saber sobre disponibilidade para o próximo fim de semana.', minutesAgo: 180 },
      { from: 'ai' as const, content: 'Boa tarde, Maria! 🌟 Que prazer recebê-la na Pousada Serenity! Temos disponibilidade sim para o fim de semana. Para qual data exata você gostaria?', minutesAgo: 179 },
      { from: 'guest' as const, content: 'Para sexta a domingo, 2 pessoas', minutesAgo: 175 },
      { from: 'ai' as const, content: 'Perfeito! Para sexta a domingo (2 noites), temos a Suíte Lua Cheia disponível por R$ 900/noite. Total: R$ 1.800. Inclui café da manhã artesanal, Wi-Fi e estacionamento. Deseja que eu reserve agora? 😊', minutesAgo: 174 },
      { from: 'guest' as const, content: 'Aceito! Como faço o pagamento?', minutesAgo: 170 },
      { from: 'ai' as const, content: 'Maravilha, Maria! ✅ A reserva da Suíte Lua Cheia está confirmada para sexta a domingo. Para o pagamento, aceitamos PIX (com 5% de desconto) ou cartão. Nosso PIX: pousada.serenity@banco.com.br. Valor com desconto: R$ 1.710. Enviarei a confirmação por aqui assim que o pagamento for identificado!', minutesAgo: 169 },
      { from: 'guest' as const, content: 'Reserva confirmada para o fim de semana!', minutesAgo: 60 },
      { from: 'ai' as const, content: 'Excelente! Sua reserva está 100% confirmada. 🎉 Aproveite cada momento na Pousada Serenity! Se precisar de qualquer coisa durante a estadia, é só chamar. Até sexta! 🌙', minutesAgo: 59 },
    ],
  },
  {
    guestIdx: 1, // João Santos
    status: 'active' as const,
    aiConfidence: 88,
    messages: [
      { from: 'guest' as const, content: 'Olá, vi vocês no Instagram. Qual valor para 3 noites em dezembro?', minutesAgo: 45 },
      { from: 'ai' as const, content: 'Olá, João! 😊 Que bom que nos encontrou! Em dezembro temos tarifas especiais a partir de R$ 850/noite. Para 3 noites seriam R$ 2.550. Qual a data exata que você tem em mente?', minutesAgo: 44 },
      { from: 'guest' as const, content: 'Pensando em vir entre 15 e 18 de dezembro. Tem suíte com vista?', minutesAgo: 30 },
      { from: 'ai' as const, content: 'Excelente escolha de datas, João! A Suíte Oceano tem vista panorâmica para o mar — perfeita para essa época do ano! R$ 1.050/noite, total R$ 3.150 para 3 noites. Inclui café da manhã com vista, piscina aquecida e late check-out às 14h. Quer que eu verifique disponibilidade?', minutesAgo: 29 },
      { from: 'guest' as const, content: 'Qual valor para 3 noites em dezembro?', minutesAgo: 15 },
    ],
  },
  {
    guestIdx: 3, // Carlos Mendes
    status: 'active' as const,
    aiConfidence: 97,
    messages: [
      { from: 'guest' as const, content: 'Bom dia! Preciso de um quarto para hoje e mais 3 noites', minutesAgo: 240 },
      { from: 'ai' as const, content: 'Bom dia, Carlos! Temos o Quarto Jardim disponível, com vista para nosso jardim tropical. R$ 600/noite, 4 noites = R$ 2.400. Café da manhã incluso. Gostaria de reservar?', minutesAgo: 239 },
      { from: 'guest' as const, content: 'Perfeito, reservar!', minutesAgo: 235 },
      { from: 'ai' as const, content: '✅ Reserva confirmada! Quarto Jardim por 4 noites (hoje até 4 dias). Total: R$ 2.400. Nosso PIX: pousada.serenity@banco.com.br. Com desconto PIX: R$ 2.280. Qual a forma de pagamento preferida?', minutesAgo: 234 },
      { from: 'guest' as const, content: 'Pagamento via PIX realizado', minutesAgo: 200 },
      { from: 'ai' as const, content: '🎉 Pagamento identificado! Obrigado, Carlos. Seu check-in é hoje a partir das 14h. À chegada, apresente o comprovante do PIX na recepção. Qualquer dúvida, estou aqui! 🌿', minutesAgo: 199 },
    ],
  },
  {
    guestIdx: 4, // Patrícia Costa
    status: 'active' as const,
    aiConfidence: 82,
    messages: [
      { from: 'guest' as const, content: 'Oi! Vocês têm espaço para o feriado de Natal?', minutesAgo: 90 },
      { from: 'ai' as const, content: 'Olá, Patrícia! 🎄 Temos sim! Para o feriado de Natal (24 a 26/12), temos pacote especial: 2 noites na Suíte Lua Cheia por R$ 1.400 (R$ 700/noite). Inclui ceia de Natal, café da manhã especial e passeio de barco. Interesse?', minutesAgo: 89 },
      { from: 'guest' as const, content: 'Nossa, que incrível! E para 4 pessoas?', minutesAgo: 60 },
      { from: 'ai' as const, content: 'Para 4 pessoas, a Suíte Família é ideal! 2 ambientes, varanda com rede. Pacote Natal: R$ 1.800 (2 noites). Inclui tudo que mencionei + late check-out. Desejo reservar? 🌟', minutesAgo: 59 },
      { from: 'guest' as const, content: 'Perfeito! Quero reservar para o feriado', minutesAgo: 30 },
    ],
  },
  {
    guestIdx: 5, // Roberto Lima (novo lead)
    status: 'active' as const,
    aiConfidence: 75,
    messages: [
      { from: 'guest' as const, content: 'Olá, boa tarde! Gostaria de saber os preços', minutesAgo: 5 },
      { from: 'ai' as const, content: 'Boa tarde! 👋 Bem-vindo à Pousada Serenity! Nossas tarifas variam por época: Low Season (mar-jun): R$ 350-500/ noite | High Season (jul-ago, dez): R$ 700-1.050/noite | Eventos: a partir de R$ 850/noite. Para qual data você planeja visitar?', minutesAgo: 4 },
    ],
  },
  {
    guestIdx: 7, // Lucas Almeida
    status: 'active' as const,
    aiConfidence: 70,
    messages: [
      { from: 'guest' as const, content: 'Vocês têm estacionamento?', minutesAgo: 120 },
      { from: 'ai' as const, content: 'Sim, Lucas! Temos estacionamento gratuito coberto para todos os hóspedes. Além disso, oferecemos transfer (aeroporto/pousada) por R$ 80. Precisa de alguma informação sobre quartos ou disponibilidade? 🚗', minutesAgo: 119 },
      { from: 'guest' as const, content: 'Legal! E qual o preço de uma suíte para 2 noites em novembro?', minutesAgo: 60 },
      { from: 'ai' as const, content: 'Em novembro (baixa temporada), nossas suítes estão a partir de R$ 450/noite. Para 2 noites: R$ 900. Com café da manhã incluso e late check-out. Qual a data exata para eu verificar disponibilidade? 📅', minutesAgo: 59 },
    ],
  },
  {
    guestIdx: 10, // Juliana Martins
    status: 'active' as const,
    aiConfidence: 85,
    messages: [
      { from: 'guest' as const, content: 'Boa noite! Fazem café da manhã vegano?', minutesAgo: 50 },
      { from: 'ai' as const, content: 'Boa noite, Juliana! 🌱 Sim, nosso café da manhã é 70% orgânico e temos opções completas veganas: pão sem glúten, tofu mexido, frutas da estação, granola caseira, sucos naturais e café especial. Alguns hóspedes veganos nos deram nota 5/5! Quer conhecer nossos quartos? 😊', minutesAgo: 49 },
      { from: 'guest' as const, content: 'Fazem café da manhã vegano?', minutesAgo: 20 },
    ],
  },
  {
    guestIdx: 14, // Thiago Nascimento
    status: 'escalated' as const,
    aiConfidence: 45,
    messages: [
      { from: 'guest' as const, content: 'Preciso cancelar minha reserva, tive um imprevisto familiar', minutesAgo: 150 },
      { from: 'ai' as const, content: 'Sinto muito pelo imprevisto, Thiago. 😔 Para cancelamentos com menos de 48h, nossa política prevê 50% do valor. Posso verificar se sua reserva tem cancelamento flexível? Qual o nome completo e data da reserva?', minutesAgo: 149 },
      { from: 'guest' as const, content: 'Mas isso é um absurdo! Eu paguei antecipado e agora perco metade?', minutesAgo: 140 },
      { from: 'ai' as const, content: 'Entendo sua frustração, Thiago. Essa é uma situação que requer atenção especial. Vou encaminhar para nosso gerente que poderá avaliar seu caso com mais flexibilidade. Um momento, por favor.', minutesAgo: 139 },
    ],
  },
  {
    guestIdx: 6, // Fernanda Souza (hospedada)
    status: 'active' as const,
    aiConfidence: 92,
    messages: [
      { from: 'guest' as const, content: 'Onde fica a trilha que vocês mencionaram?', minutesAgo: 15 },
      { from: 'ai' as const, content: 'A Trilha da Sereia fica a 800m da pousada, pela estrada de terra à direita. São 40 min de caminhada leve até uma cachoeira natural. Leve água e tênis confortável. Volto a informar: aberta até às 17h. Quer que eu avise quando estiver próximo do horário de fechamento? 🥾', minutesAgo: 14 },
      { from: 'guest' as const, content: 'O café da manhã estava maravilhoso!', minutesAgo: 300 },
      { from: 'ai' as const, content: 'Fico feliz que gostou, Fernanda! 🥐 Nosso café é preparado com produtos locais. Amanhã teremos bolo de banana caseiro e tapioca fresca. Alguma restrição alimentar que devamos saber? 😊', minutesAgo: 299 },
    ],
  },
  {
    guestIdx: 12, // Isabela Rodrigues
    status: 'active' as const,
    aiConfidence: 78,
    messages: [
      { from: 'guest' as const, content: 'Quais atividades vocês recomendam?', minutesAgo: 35 },
      { from: 'ai' as const, content: 'Ótima pergunta, Isabela! 🌊 Aqui na região: 1) Trilha da Sereia (gratuita, 40 min), 2) Passeio de barco pelo mangue (R$ 120/pessoa), 3) Aula de stand-up paddle (R$ 80/pessoa), 4) Visita ao vilarejo de pescadores (gratuita), 5) Observação de aves ao amanhecer (guiada, R$ 60). Posso agendar alguma para você?', minutesAgo: 34 },
    ],
  },
  {
    guestIdx: 17, // Gustavo Oliveira
    status: 'active' as const,
    aiConfidence: 90,
    messages: [
      { from: 'guest' as const, content: 'Chegaremos às 16h, tudo certo?', minutesAgo: 10 },
      { from: 'ai' as const, content: 'Perfeito, Gustavo! ✅ Check-in a partir das 14h, então 16h está ótimo. Suíte Oceano reservada. À chegada: estacionamento à esquerda da recepção. Leve o comprovante de pagamento. Precisa de algo especial? Champanhe, flores, decoração? 🍾', minutesAgo: 9 },
    ],
  },
];

// ============================================================================
// BOOKINGS (reservas)
// ============================================================================

const bookings = [
  { guestIdx: 0, room: 'Suíte Lua Cheia', checkIn: daysAgo(-2), checkOut: daysAgo(1), nights: 3, guestsCount: 2, totalValue: 1800, status: 'confirmed', paymentStatus: 'paid', source: 'whatsapp_ai', aiGenerated: true },
  { guestIdx: 3, room: 'Quarto Jardim', checkIn: daysAgo(-1), checkOut: daysAgo(3), nights: 4, guestsCount: 1, totalValue: 2400, status: 'confirmed', paymentStatus: 'paid', source: 'whatsapp_ai', aiGenerated: true },
  { guestIdx: 6, room: 'Suíte Oceano', checkIn: daysAgo(-3), checkOut: daysAgo(2), nights: 5, guestsCount: 2, totalValue: 3500, status: 'checked_in', paymentStatus: 'paid', source: 'direct', aiGenerated: false },
  { guestIdx: 8, room: 'Chalé Premium', checkIn: daysAgo(-5), checkOut: daysAgo(-2), nights: 3, guestsCount: 2, totalValue: 4500, status: 'checked_out', paymentStatus: 'paid', source: 'whatsapp_ai', aiGenerated: true },
  { guestIdx: 11, room: 'Suíte Lua Cheia', checkIn: daysAgo(10), checkOut: daysAgo(7), nights: 3, guestsCount: 2, totalValue: 2800, status: 'checked_out', paymentStatus: 'paid', source: 'booking', aiGenerated: false },
  { guestIdx: 14, room: 'Suíte Família', checkIn: daysAgo(-4), checkOut: daysAgo(-1), nights: 3, guestsCount: 5, totalValue: 8500, status: 'checked_out', paymentStatus: 'paid', source: 'whatsapp_ai', aiGenerated: true },
  { guestIdx: 17, room: 'Suíte Oceano', checkIn: daysAgo(0), checkOut: daysAgo(4), nights: 4, guestsCount: 2, totalValue: 3200, status: 'confirmed', paymentStatus: 'paid', source: 'airbnb', aiGenerated: false },
  // Reservas passadas (últimos 30 dias)
  { guestIdx: 0, room: 'Suíte Lua Cheia', checkIn: daysAgo(25), checkOut: daysAgo(23), nights: 2, guestsCount: 2, totalValue: 1800, status: 'checked_out', paymentStatus: 'paid', source: 'whatsapp_ai', aiGenerated: true },
  { guestIdx: 3, room: 'Quarto Jardim', checkIn: daysAgo(20), checkOut: daysAgo(18), nights: 2, guestsCount: 1, totalValue: 1200, status: 'checked_out', paymentStatus: 'paid', source: 'whatsapp_ai', aiGenerated: true },
  { guestIdx: 11, room: 'Suíte Lua Cheia', checkIn: daysAgo(15), checkOut: daysAgo(12), nights: 3, guestsCount: 3, totalValue: 2700, status: 'checked_out', paymentStatus: 'paid', source: 'whatsapp_human', aiGenerated: false },
  { guestIdx: 8, room: 'Chalé Premium', checkIn: daysAgo(30), checkOut: daysAgo(28), nights: 2, guestsCount: 2, totalValue: 3000, status: 'checked_out', paymentStatus: 'paid', source: 'booking', aiGenerated: false },
  // Semana passada
  { guestIdx: 0, room: 'Suíte Oceano', checkIn: daysAgo(12), checkOut: daysAgo(9), nights: 3, guestsCount: 2, totalValue: 3150, status: 'checked_out', paymentStatus: 'paid', source: 'whatsapp_ai', aiGenerated: true },
  { guestIdx: 3, room: 'Quarto Jardim', checkIn: daysAgo(11), checkOut: daysAgo(8), nights: 3, guestsCount: 2, totalValue: 1800, status: 'checked_out', paymentStatus: 'paid', source: 'whatsapp_ai', aiGenerated: true },
];

// ============================================================================
// NOTIFICAÇÕES
// ============================================================================

const notifications = [
  { type: 'escalation_needed', title: '⚠️ Escalonamento Necessário', message: 'Conversa com Thiago Nascimento sobre cancelamento requer atenção humana', priority: 'urgent' as const },
  { type: 'booking_created', title: 'Nova Reserva Confirmada', message: 'Gustavo Oliveira reservou Suíte Oceano - R$ 3.200', priority: 'high' as const },
  { type: 'payment_received', title: 'Pagamento Recebido', message: 'PIX de R$ 1.800 confirmado - Maria Silva', priority: 'normal' as const },
  { type: 'new_guest', title: 'Novo Hóspede', message: 'Roberto Lima entrou em contato via WhatsApp', priority: 'normal' as const },
  { type: 'ai_offline', title: 'IA Offline Momentaneamente', message: 'Reconexão automática em 30 segundos', priority: 'low' as const },
  { type: 'booking_created', title: 'Check-in Hoje', message: 'Gustavo Oliveira chegará às 16h', priority: 'high' as const },
  { type: 'payment_received', title: 'Pagamento Recebido', message: 'PIX de R$ 8.500 confirmado - Bruna Cardoso', priority: 'high' as const },
  { type: 'new_guest', title: 'Novo Contato', message: 'Rafael Barbosa perguntou sobre vaga para carnaval', priority: 'normal' as const },
];

// ============================================================================
// TRAINING PROMPTS
// ============================================================================

const trainingPrompts = [
  { name: 'Recepção Inicial', type: 'persona', content: 'Você é a recepcionista virtual da Pousada Serenity. Seja calorosa, profissional e eficiente. Use emojis com moderação. Sempre ofereça opções de reserva quando detectar intenção de compra. Responda em português brasileiro.', isActive: true, successRate: 94, usageCount: 342 },
  { name: 'Consulta de Disponibilidade', type: 'response', content: 'Quando o hóspede perguntar sobre disponibilidade: 1) Confirme datas 2) Ofereça 2-3 opções de quartos 3) Informe preços 4) Inclua diferenciais (café, estacionamento, vista). Sempre pergunte o número de hóspedes.', isActive: true, successRate: 89, usageCount: 156 },
  { name: 'Tratamento de Objeção de Preço', type: 'response', content: 'Se o hóspede achar caro: 1) Valide a percepção 2) Mostre valor incluído (café artesanal R$80/pessoa, estacionamento R$50/dia, late check-out) 3) Ofereça desconto PIX de 5% 4) Mencione pacotes de temporada. Nunca barganhe agressivamente.', isActive: true, successRate: 76, usageCount: 89 },
  { name: 'Escalonamento de Reclamações', type: 'escalation', content: 'Detecte sinais de insatisfação: palavras como "absurdo", "enganação", "direito do consumidor", "advogado". Quando detectar, demonstre empatia, não discuta e transfira imediatamente para um humano com contexto completo da conversa.', isActive: true, successRate: 100, usageCount: 12 },
  { name: 'Proação Pós-Check-in', type: 'proactive', content: '2 horas após check-in, enviar mensagem de boas-vindas perguntando se está tudo bem. No dia seguinte, sugerir atividades locais. Na véspera do check-out, oferecer late check-out e perguntar sobre a experiência.', isActive: true, successRate: 88, usageCount: 45 },
];

// ============================================================================
// KNOWLEDGE ENTRIES
// ============================================================================

const knowledgeEntries = [
  { category: 'pricing', question: 'Qual o preço das suítes?', answer: 'Suíte Lua Cheia: R$ 900/noite. Suíte Oceano: R$ 1.050/noite. Chalé Premium: R$ 1.500/noite. Suíte Família: R$ 1.200/noite. Quarto Jardim: R$ 600/noite. Desconto PIX: 5%.', priority: 'high', effectiveness: 95 },
  { category: 'rooms', question: 'Quais quartos têm vista para o mar?', answer: 'Suíte Oceano e Chalé Premium têm vista panorâmica para o mar. Suíte Lua Cheia tem vista parcial.', priority: 'medium', effectiveness: 82 },
  { category: 'amenities', question: 'O que está incluído no preço?', answer: 'Café da manhã artesanal (7h-10h), Wi-Fi fibra, estacionamento coberto, piscina, acesso à trilha, late check-out às 14h (quando disponível).', priority: 'high', effectiveness: 91 },
  { category: 'policies', question: 'Qual o horário de check-in e check-out?', answer: 'Check-in: 14h às 22h. Check-out: até 12h. Late check-out até 14h (grátis, sujeito a disponibilidade). Early check-in: R$ 80.', priority: 'high', effectiveness: 96 },
  { category: 'location', question: 'Como chegar na pousada?', answer: 'A 45 min do aeroporto. Rodovia BR-101, km 234. GPS: Rua das Conchas, s/n. Transfer: R$ 80 (agendar com antecedência).', priority: 'medium', effectiveness: 78 },
  { category: 'activities', question: 'Quais atividades estão disponíveis?', answer: 'Trilha da Sereia (gratuita, 40min), passeio de barco (R$120/pessoa), stand-up paddle (R$80/pessoa), observação de aves guiada (R$60/pessoa), vilarejo de pescadores (gratuita).', priority: 'medium', effectiveness: 85 },
  { category: 'food', question: 'Têm opções veganas no café?', answer: 'Sim! 70% orgânico com opções veganas completas: pão sem glúten, tofu mexido, frutas, granola caseira, sucos naturais, café especial.', priority: 'high', effectiveness: 90 },
  { category: 'policies', question: 'Qual a política de cancelamento?', answer: 'Até 7 dias: reembolso integral. 3-7 dias: 50%. Menos de 48h: sem reembolso. Cancelamento flexível disponível (+15% no valor). Casos especiais avaliados pela gerência.', priority: 'critical', effectiveness: 88 },
];

// ============================================================================
// PERFORMANCE SNAPSHOTS (últimos 30 dias)
// ============================================================================

function generateSnapshots() {
  const snapshots: any[] = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isToday = i === 0;

    snapshots.push({
      date: dateStr,
      aiResponseTime: +(1.8 + Math.random() * 1.5).toFixed(1),
      conversionRate: isWeekend ? +(24 + Math.random() * 8).toFixed(1) : +(18 + Math.random() * 10).toFixed(1),
      guestSatisfaction: +(4.3 + Math.random() * 0.6).toFixed(1),
      occupancyRate: isWeekend ? +(85 + Math.random() * 12).toFixed(1) : +(60 + Math.random() * 25).toFixed(1),
      revenueGrowth: isToday ? +(22 + Math.random() * 6).toFixed(1) : +(5 + Math.random() * 20).toFixed(1),
      aiAutonomy: +(85 + Math.random() * 12).toFixed(1),
      totalRevenue: isToday ? +(6000 + Math.random() * 5000).toFixed(2) : isWeekend ? +(8000 + Math.random() * 6000).toFixed(2) : +(3000 + Math.random() * 5000).toFixed(2),
      totalBookings: isToday ? Math.floor(8 + Math.random() * 8) : isWeekend ? Math.floor(5 + Math.random() * 8) : Math.floor(2 + Math.random() * 6),
      aiConversations: isToday ? Math.floor(35 + Math.random() * 20) : Math.floor(20 + Math.random() * 30),
    });
  }
  return snapshots;
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('🌱 ZEHLA Seed — Populando banco de dados...\n');

  console.log('🧹 Limpando dados de semente antigos...');
  await prisma.feedback.deleteMany({});
  await prisma.performanceSnapshot.deleteMany({});
  await prisma.quickAction.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.trainingPrompt.deleteMany({});
  await prisma.knowledgeEntry.deleteMany({});
  await prisma.conversationMessage.deleteMany({});
  await prisma.conversationLog.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.guest.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.property.deleteMany({});
  
  // 1. Criar Tenant
  console.log('1. Criando Tenant (Pousada Serenity)...');
  const ownerPassword = await bcrypt.hash('zehla2024', 12);
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: PROPERTY_NAME,
      email: 'contato@pousadaserenity.com.br',
      passwordHash: ownerPassword,
      phone: '11999887766',
      role: 'owner',
      plan: 'professional',
      status: 'active',
    },
  });

  // 2. Criar Property
  console.log('2. Criando Property...');
  const property = await prisma.property.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      name: PROPERTY_NAME,
      slug: 'pousadaserenity',
      document: '12.345.678/0001-90',
      street: 'Rua das Conchas',
      number: 's/n',
      neighborhood: 'Praia do Rosa',
      city: 'Imbituba',
      state: 'SC',
      zipCode: '88780-000',
      type: 'pousada',
      website: 'www.pousadaserenity.com.br',
      description: 'Pousada encantada à beira-mar com suítes temáticas, café artesanal e trilha ecológica privada.',
      services: '["wifi","parking","pool","breakfast","trail","boat-tour","late-checkout"]',
      paymentMethods: '["pix","credit_card","debit_card","cash"]',
      pixKey: 'pousada.serenity@banco.com.br',
      pixKeyType: 'email',
    },
  });

  // 3. Criar Quartos
  console.log('3. Criando Quartos...');
  const roomsData = [
    { name: 'Suíte Lua Cheia', type: 'suite', capacity: 2, price: 900 },
    { name: 'Suíte Oceano', type: 'suite', capacity: 2, price: 1050 },
    { name: 'Suíte Família', type: 'suite', capacity: 5, price: 1200 },
    { name: 'Chalé Premium', type: 'chale', capacity: 2, price: 1500 },
    { name: 'Quarto Jardim', type: 'standard', capacity: 2, price: 600 },
    { name: 'Quarto Mirante', type: 'standard', capacity: 3, price: 750 },
  ];

  for (const room of roomsData) {
    await prisma.room.upsert({
      where: { id: `${TENANT_ID}-${room.name.toLowerCase().replace(/\s/g, '-')}` },
      update: {},
      create: {
        id: `${TENANT_ID}-${room.name.toLowerCase().replace(/\s/g, '-')}`,
        propertyId: property.id,
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        price: room.price,
        status: room.name === 'Quarto Mirante' ? 'manutencao' : 'disponivel',
      },
    });
  }

  // 4. Criar Hóspedes
  console.log('4. Criando Hóspedes...');
  const guestRecords: any[] = [];
  for (const g of guests) {
    const record = await prisma.guest.create({
      data: {
        tenantId: tenant.id,
        name: g.name,
        phone: g.phone,
        email: g.email,
        status: g.status,
        avatar: null,
        source: g.source,
        value: g.value,
        lastContact: hoursAgo(Math.floor(Math.random() * 12)),
        checkIn: g.checkIn || null,
        checkOut: g.checkOut || null,
        room: g.room || null,
        aiScore: g.score,
        notes: null,
        conversationCount: g.convCount,
        metadata: '{}',
      },
    });
    guestRecords.push(record);
  }

  // 5. Criar Conversas + Mensagens
  console.log('5. Criando Conversas e Mensagens...');
  const aiMessages: Array<{ conversationId: string; messageId: string }> = [];

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    const guest = guestRecords[conv.guestIdx];

    const convRecord = await prisma.conversationLog.create({
      data: {
        tenantId: tenant.id,
        guestId: guest.id,
        guestName: guest.name,
        guestPhone: guest.phone,
        status: conv.status,
        lastUpdate: minutesAgo(conv.messages[conv.messages.length - 1].minutesAgo),
        aiConfidence: conv.aiConfidence,
        metadata: '{}',
      },
    });

    for (const msg of conv.messages) {
      const msgRecord = await prisma.conversationMessage.create({
        data: {
          conversationId: convRecord.id,
          from: msg.from,
          content: msg.content,
          timestamp: minutesAgo(msg.minutesAgo),
          read: true,
          metadata: '{}',
        },
      });

      if (msg.from === 'ai') {
        aiMessages.push({
          conversationId: convRecord.id,
          messageId: msgRecord.id,
        });
      }
    }
  }

  // 5.5 Criar Feedbacks de exemplo
  console.log('5.5. Criando Feedbacks de exemplo...');
  const feedbackData = [
    { rating: 5, notes: 'Resposta perfeita sobre horários' },
    { rating: 4, notes: 'Atendeu bem, mas demorou um pouco na simulação' },
    { rating: 5, notes: 'Passou a senha do Wi-Fi corretamente' },
    { rating: 3, notes: 'IA foi um pouco repetitiva na resposta' },
    { rating: 5, notes: 'Confirmou reserva com sucesso' },
  ];

  for (let i = 0; i < Math.min(feedbackData.length, aiMessages.length); i++) {
    const f = feedbackData[i];
    const msg = aiMessages[i];
    await prisma.feedback.create({
      data: {
        tenantId: tenant.id,
        conversationId: msg.conversationId,
        messageId: msg.messageId,
        rating: f.rating,
        notes: f.notes,
        source: 'ddc',
        metadata: '{}',
      },
    });
  }

  // 6. Criar Reservas
  console.log('6. Criando Reservas...');
  for (const b of bookings) {
    const guest = guestRecords[b.guestIdx];
    await prisma.booking.create({
      data: {
        tenantId: tenant.id,
        guestId: guest.id,
        guestName: guest.name,
        roomName: b.room,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        nights: b.nights,
        guests: b.guestsCount,
        totalValue: b.totalValue,
        status: b.status,
        paymentMethod: 'pix',
        paymentStatus: b.paymentStatus,
        source: b.source,
        aiGenerated: b.aiGenerated,
        metadata: '{}',
      },
    });
  }

  // 7. Criar Notificações
  console.log('7. Criando Notificações...');
  for (let i = 0; i < notifications.length; i++) {
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        type: notifications[i].type,
        priority: notifications[i].priority,
        title: notifications[i].title,
        message: notifications[i].message,
        actionUrl: null,
        actionLabel: null,
        read: i >= 3, // Primeiras 3 não lidas
        metadata: '{}',
      },
    });
  }

  // 8. Criar Training Prompts
  console.log('8. Criando Training Prompts...');
  for (const tp of trainingPrompts) {
    await prisma.trainingPrompt.create({
      data: {
        tenantId: tenant.id,
        name: tp.name,
        type: tp.type,
        content: tp.content,
        variables: '[]',
        isActive: tp.isActive,
        successRate: tp.successRate,
        usageCount: tp.usageCount,
        lastUsed: new Date(),
        metadata: '{}',
      },
    });
  }

  // 9. Criar Knowledge Entries
  console.log('9. Criando Knowledge Entries...');
  for (const ke of knowledgeEntries) {
    await prisma.knowledgeEntry.create({
      data: {
        tenantId: tenant.id,
        category: ke.category,
        question: ke.question,
        answer: ke.answer,
        priority: ke.priority,
        usage: Math.floor(Math.random() * 50) + 5,
        effectiveness: ke.effectiveness,
        createdFor: 'both',
        lastUsed: new Date(),
        metadata: '{}',
      },
    });
  }

  // 10. Criar Performance Snapshots
  console.log('10. Criando Performance Snapshots (31 dias)...');
  const snapshots = generateSnapshots();
  for (const snap of snapshots) {
    await prisma.performanceSnapshot.create({
      data: {
        tenantId: tenant.id,
        date: snap.date,
        aiResponseTime: snap.aiResponseTime,
        conversionRate: snap.conversionRate,
        guestSatisfaction: snap.guestSatisfaction,
        occupancyRate: snap.occupancyRate,
        revenueGrowth: snap.revenueGrowth,
        aiAutonomy: snap.aiAutonomy,
        totalRevenue: +snap.totalRevenue,
        totalBookings: snap.totalBookings,
        aiConversations: snap.aiConversations,
        metadata: '{}',
      },
    });
  }

  // 11. Criar Activity Logs de IA
  console.log('11. Criando AI Activity Logs...');
  const activityTypes = ['message', 'booking', 'escalation', 'learning', 'alert'];
  const activityDescriptions = [
    'Atendeu mensagem sobre disponibilidade',
    'Criou reserva via WhatsApp',
    'Escalonou conversa sobre cancelamento',
    'Aprendeu novo padrão de resposta',
    'Alerta: tempo de resposta acima de 5s',
  ];
  for (let i = 0; i < 25; i++) {
    const typeIdx = Math.floor(Math.random() * activityTypes.length);
    await prisma.aIActivityLog.create({
      data: {
        tenantId: tenant.id,
        type: activityTypes[typeIdx],
        guestName: guests[Math.floor(Math.random() * guests.length)].name,
        roomName: roomsData[Math.floor(Math.random() * roomsData.length)].name,
        message: activityDescriptions[typeIdx],
        timestamp: hoursAgo(Math.floor(Math.random() * 24)),
        status: Math.random() > 0.1 ? 'success' : 'warning',
        duration: Math.floor(800 + Math.random() * 2000),
        metadata: '{}',
      },
    });
  }

  // 12. Criar Quick Actions
  console.log('12. Criando Quick Actions...');
  const quickActions = [
    { category: 'booking', label: 'Nova Reserva', icon: 'CalendarPlus', action: 'create-booking', order: 0 },
    { category: 'communication', label: 'Enviar Mensagem', icon: 'MessageSquare', action: 'send-message', order: 1 },
    { category: 'analytics', label: 'Ver Relatório', icon: 'BarChart3', action: 'view-report', order: 2 },
    { category: 'settings', label: 'Configurar IA', icon: 'Bot', action: 'config-ai', order: 3 },
    { category: 'emergency', label: 'Modo Manual', icon: 'AlertTriangle', action: 'manual-mode', requiresConfirmation: true, order: 4 },
  ];
  for (const qa of quickActions) {
    await prisma.quickAction.create({
      data: {
        tenantId: tenant.id,
        category: qa.category,
        label: qa.label,
        icon: qa.icon,
        action: qa.action,
        shortcut: null,
        requiresConfirmation: (qa as any).requiresConfirmation || false,
        isActive: true,
        order: qa.order,
      },
    });
  }

  // Seeding credentials requested by user
  console.log('\n🔐 Criando contas de demonstração NextAuth...');

  // ── ZCC Admin Demo (login 123 / senha 123) ──
  const zccAdminEmail = 'zella@zella.com.br';
  const zccAdminPassword = await bcrypt.hash('123', 12);
  const zccAdmin = await prisma.tenant.upsert({
    where: { email: zccAdminEmail },
    update: { passwordHash: zccAdminPassword, role: 'admin' },
    create: {
      id: 'zcc-admin-id',
      name: 'Zélla Central Control',
      email: zccAdminEmail,
      passwordHash: zccAdminPassword,
      phone: '11999999999',
      role: 'admin',
      plan: 'business',
      niche: 'pousada',
      status: 'active',
    },
  });
  console.log(`   ZCC Admin Demo criado: ${zccAdmin.email} (senha: 123) ← Acesso rápido ao ZCC`);

  await prisma.property.upsert({
    where: { tenantId: zccAdmin.id },
    update: {},
    create: {
      tenantId: zccAdmin.id,
      name: 'Zélla Headquarters',
      slug: 'zellahq',
      type: 'pousada',
    },
  });

  const admin1Email = 'admin@zehla.ai';
  const admin1Password = await bcrypt.hash('zehla2024', 12);
  const admin1 = await prisma.tenant.upsert({
    where: { email: admin1Email },
    update: { passwordHash: admin1Password },
    create: {
      id: 'admin-ai-id',
      email: admin1Email,
      name: 'ZEHLA Admin AI',
      passwordHash: admin1Password,
      role: 'admin',
      plan: 'business',
      status: 'active',
    },
  });
  console.log(`   Admin (AI) Tenant criado: ${admin1.email} (senha: zehla2024)`);

  await prisma.property.upsert({
    where: { tenantId: admin1.id },
    update: {},
    create: {
      tenantId: admin1.id,
      name: 'ZEHLA Admin AI - Propriedade',
      slug: 'zehla-admin-ai-propriedade',
      type: 'pousada',
    },
  });

  const admin2Email = 'admin@zehla.com.br';
  const admin2Password = await bcrypt.hash('Admin@123', 12);
  const admin2 = await prisma.tenant.upsert({
    where: { email: admin2Email },
    update: { passwordHash: admin2Password },
    create: {
      id: 'admin-br-id',
      email: admin2Email,
      name: 'ZEHLA Admin BR',
      passwordHash: admin2Password,
      role: 'admin',
      plan: 'business',
      status: 'active',
    },
  });
  console.log(`   Admin (BR) Tenant criado: ${admin2.email} (senha: Admin@123)`);

  await prisma.property.upsert({
    where: { tenantId: admin2.id },
    update: {},
    create: {
      tenantId: admin2.id,
      name: 'ZEHLA Admin BR - Propriedade',
      slug: 'zehla-admin-br-propriedade',
      type: 'pousada',
    },
  });

  const demoEmail = 'demo@pousada.com.br';
  const demoPassword = await bcrypt.hash('Demo@123', 12);
  const demoTenant = await prisma.tenant.upsert({
    where: { email: demoEmail },
    update: { passwordHash: demoPassword },
    create: {
      id: 'demo-tenant-id',
      name: 'Pousada Paraíso Demo',
      email: demoEmail,
      passwordHash: demoPassword,
      phone: '11999999999',
      plan: 'pro',
      status: 'active',
      property: {
        create: {
          name: 'Pousada Paraíso Demo',
          slug: 'pousadaparaisodemo',
          type: 'pousada',
          city: 'Paraty',
          state: 'RJ',
          pixKey: '12345678901',
          pixKeyType: 'cpf',
          rooms: {
            create: [
              { name: 'Suíte Master', type: 'suite', capacity: 2, price: 350, status: 'disponivel' },
              { name: 'Quarto Standard', type: 'standard', capacity: 2, price: 200, status: 'disponivel' },
              { name: 'Chalé Luxo', type: 'chale', capacity: 4, price: 500, status: 'disponivel' },
            ],
          },
        },
      },
    },
  });
  console.log(`   Demo Tenant criado: ${demoTenant.email} (senha: Demo@123)`);

  console.log('\n✅ Seed completo! Banco populado com dados da Pousada Serenity e contas de demonstração.');
  console.log(`   Tenant: ${tenant.id}`);
  console.log(`   Hóspedes: ${guestRecords.length}`);
  console.log(`   Conversas: ${conversations.length}`);
  console.log(`   Reservas: ${bookings.length}`);
  console.log(`   Notificações: ${notifications.length}`);
  console.log(`   Snapshots: ${snapshots.length} dias`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });