import { NextRequest, NextResponse } from 'next/server';
import { guardRequest, auditRouteEvent } from '@/lib/infra/wiring';

// ══
// ZELLA SIMULATOR — Message Bundler + One-Shot Resolution
// Mock Mode: simulates the AI response pipeline with
// intelligent message grouping for Meta tariff economy.
// ══

const META_COST_PER_TARIFF = 0.0068; // US$ per Meta conversation tariff

interface SimulateRequest {
  messages: string[];
  propertyData: {
    propertyName?: string;
    location?: string;
    priceRange?: string;
    amenities?: string[];
    aiVoiceTone?: string;
    checkInTime?: string;
    checkOutTime?: string;
    policies?: string;
    description?: string;
    highlights?: string[];
  };
  niche: 'pousada' | 'airbnb';
}

// ── Smart Response Generator (Mock) 

function generateBundledResponse(messages: string[], propertyData: SimulateRequest['propertyData'], niche: 'pousada' | 'airbnb'): string {
  const propertyName = propertyData.propertyName || (niche === 'pousada' ? 'nossa pousada' : 'nosso imóvel');
  const location = propertyData.location || '';
  const priceRange = propertyData.priceRange || '';
  const amenities = propertyData.amenities || [];
  const checkIn = propertyData.checkInTime || '14:00';
  const checkOut = propertyData.checkOutTime || '12:00';
  const highlights = propertyData.highlights || [];

  // Analyze the combined intent of all messages
  const combined = messages.join(' ').toLowerCase();
  const intents: string[] = [];

  if (combined.includes('oi') || combined.includes('olá') || combined.includes('bom dia') || combined.includes('boa tarde') || combined.includes('boa noite') || combined.includes('hello')) {
    intents.push('greeting');
  }
  if (combined.includes('valor') || combined.includes('preço') || combined.includes('quanto') || combined.includes('custa') || combined.includes('tarifa') || combined.includes('rate')) {
    intents.push('pricing');
  }
  if (combined.includes('vaga') || combined.includes('dispon') || combined.includes('reserv') || combined.includes('livre') || combined.includes('available') || combined.includes('book')) {
    intents.push('availability');
  }
  if (combined.includes('check-in') || combined.includes('check in') || combined.includes('entrada') || combined.includes('chegar') || combined.includes('horário')) {
    intents.push('checkin');
  }
  if (combined.includes('check-out') || combined.includes('check out') || combined.includes('saída') || combined.includes('sair')) {
    intents.push('checkout');
  }
  if (combined.includes('wifi') || combined.includes('wi-fi') || combined.includes('internet')) {
    intents.push('wifi');
  }
  if (combined.includes('pet') || combined.includes('animal') || combined.includes('cachorro') || combined.includes('cão')) {
    intents.push('pets');
  }
  if (combined.includes('estacion') || combined.includes('garagem') || combined.includes('parking')) {
    intents.push('parking');
  }
  if (combined.includes('piscina') || combined.includes('pool')) {
    intents.push('pool');
  }
  if (combined.includes('café') || combined.includes('cafe') || combined.includes('breakfast') || combined.includes('café da manhã')) {
    intents.push('breakfast');
  }
  if (combined.includes('cancel') || combined.includes('reembolso') || combined.includes('refund')) {
    intents.push('cancellation');
  }
  if (combined.includes('endereço') || combined.includes('localização') || combined.includes('onde') || combined.includes('como chegar') || combined.includes('location')) {
    intents.push('location');
  }

  // If no specific intent detected, give a general welcoming response
  if (intents.length === 0) {
    intents.push('general');
  }

  // Build contextual response
  const parts: string[] = [];

  // Greeting
  if (intents.includes('greeting') || intents.includes('general')) {
    if (niche === 'pousada') {
      parts.push(`Olá! 😊 Bem-vindo(a) à **${propertyName}**! ${location ? `Ficamos em ${location}. ` : ''}Fico feliz pelo seu interesse!`);
    } else {
      parts.push(`Olá! 😊 Bem-vindo(a) ao **${propertyName}**! ${location ? `Localizado em ${location}. ` : ''}Que bom ter você aqui!`);
    }
  }

  // Pricing + Availability (often asked together)
  if (intents.includes('pricing') || intents.includes('availability')) {
    if (priceRange) {
      parts.push(`💰 Nossos valores variam de **${priceRange}** por noite, dependendo da temporada e tipo de acomodação.`);
    } else {
      parts.push(`💰 Os valores variam conforme a temporada e tipo de acomodação. Posso verificar a melhor tarifa para as suas datas!`);
    }
    parts.push(`📅 Para verificar disponibilidade, me informe as datas desejadas de check-in e check-out que consulto na agenda!`);
  }

  // Check-in
  if (intents.includes('checkin')) {
    parts.push(`🕐 Nosso horário de check-in é a partir das **${checkIn}**. Se precisar de early check-in, podemos verificar a possibilidade sob disponibilidade.`);
  }

  // Check-out
  if (intents.includes('checkout')) {
    parts.push(`🕐 O horário de check-out é até as **${checkOut}**. Late check-out pode ser solicitado na recepção.`);
  }

  // WiFi
  if (intents.includes('wifi')) {
    if (amenities.some(a => a.toLowerCase().includes('wi-fi') || a.toLowerCase().includes('wifi') || a.toLowerCase().includes('internet'))) {
      parts.push(`📶 Sim! Temos **Wi-Fi gratuito** em todas as áreas ${niche === 'pousada' ? 'da pousada' : 'do imóvel'}.`);
    } else {
      parts.push(`📶 Sim, oferecemos Wi-Fi gratuito para todos os hóspedes!`);
    }
  }

  // Pets
  if (intents.includes('pets')) {
    if (amenities.some(a => a.toLowerCase().includes('pet') || a.toLowerCase().includes('animal'))) {
      parts.push(`🐾 Sim, aceitamos pets! 🐶 Temos espaço adequado e pedimos apenas que informe no momento da reserva.`);
    } else {
      parts.push(`🐾 Infelizmente não aceitamos pets no momento. Mas podemos recomendar ótimos pet hotéis na região!`);
    }
  }

  // Parking
  if (intents.includes('parking')) {
    if (amenities.some(a => a.toLowerCase().includes('estacion') || a.toLowerCase().includes('garagem'))) {
      parts.push(`🅿️ Sim! Temos **estacionamento gratuito** para hóspedes.`);
    } else {
      parts.push(`🅿️ Não dispomos de estacionamento próprio, mas há opções de estacionamento próximo ao imóvel.`);
    }
  }

  // Pool
  if (intents.includes('pool')) {
    if (amenities.some(a => a.toLowerCase().includes('piscina'))) {
      parts.push(`🏊 Sim! Temos piscina ${niche === 'pousada' ? 'aquecida' : 'disponível'} para uso dos hóspedes.`);
    } else {
      parts.push(`🏊 Não temos piscina no local, mas há opções próximas!`);
    }
  }

  // Breakfast
  if (intents.includes('breakfast')) {
    if (niche === 'pousada') {
      if (amenities.some(a => a.toLowerCase().includes('café') || a.toLowerCase().includes('breakfast'))) {
        parts.push(`☕ Sim! Servimos **café da manhã incluso** na diária, com opções variadas e produtos regionais!`);
      } else {
        parts.push(`☕ Oferecemos café da manhã como serviço adicional. Consulte os valores na recepção!`);
      }
    } else {
      parts.push(`☕ O imóvel possui cozinha completa para você preparar suas refeições. Não inclui café da manhã.`);
    }
  }

  // Cancellation
  if (intents.includes('cancellation')) {
    parts.push(`📋 Nossa política de cancelamento permite cancelamento gratuito até 48h antes do check-in. Após esse prazo, há cobrança de 1 diária.`);
  }

  // Location
  if (intents.includes('location')) {
    if (location) {
      parts.push(`📍 Estamos localizados em **${location}**. Posso enviar a localização exata por aqui se desejar!`);
    } else {
      parts.push(`📍 Posso enviar a localização exata e instruções de como chegar! Deseja que eu envie?`);
    }
  }

  // Add highlights if available
  if (highlights.length > 0 && intents.length > 1) {
    parts.push(`✨ **Destaques:** ${highlights.slice(0, 3).join(' · ')}`);
  }

  // Closing
  parts.push(`Posso te ajudar com mais alguma informação? 😊`);

  return parts.join('\n\n');
}

// ── Single (non-bundled) Response 

function generateSingleResponse(message: string, propertyData: SimulateRequest['propertyData'], niche: 'pousada' | 'airbnb'): string {
  const propertyName = propertyData.propertyName || (niche === 'pousada' ? 'nossa pousada' : 'nosso imóvel');
  const msg = message.toLowerCase();

  if (msg.includes('oi') || msg.includes('olá') || msg.includes('bom dia') || msg.includes('boa tarde') || msg.includes('boa noite')) {
    return `Olá! 😊 Bem-vindo(a) à **${propertyName}**! Como posso te ajudar hoje?`;
  }

  if (msg.includes('valor') || msg.includes('preço') || msg.includes('quanto') || msg.includes('custa')) {
    const price = propertyData.priceRange || 'consulte nossas tarifas';
    return `💰 Nossos valores variam de **${price}** por noite. Me informe as datas que consulto a disponibilidade!`;
  }

  if (msg.includes('vaga') || msg.includes('dispon') || msg.includes('reserv')) {
    return `📅 Para verificar disponibilidade, me informe as datas desejadas! Posso consultar nossa agenda agora mesmo.`;
  }

  // Default
  return `Obrigado pela mensagem! 😊 Sou a assistente virtual da **${propertyName}** e posso te ajudar com valores, disponibilidade, horários e muito mais. O que gostaria de saber?`;
}

// ── POST Handler 

export async function POST(request: NextRequest) {
  // RUN18-A (W2/MOP-UP): anti-flood fail-closed por IP — 60 req/1min.
  const rlDeny = guardRequest(request, 'zella.simulate', { points: 60, windowMs: 60000 });
  if (rlDeny) return rlDeny;
  // RUN18-A (W2/MOP-UP): trilha de auditoria da entrada da rota (sem payload).
  auditRouteEvent({ who: 'route:zella.simulate', what: 'zella.simulate.entry', resource: 'api', result: 'ALLOW' });
  let body: SimulateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'Corpo da requisição inválido.' },
      { status: 400 }
    );
  }

  const { messages, propertyData, niche } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'MISSING_MESSAGES', message: 'Array de mensagens é obrigatório.' },
      { status: 400 }
    );
  }

  const isBundled = messages.length >= 2;
  const bundledCount = messages.length;

  // Simulate processing delay
  // Bundled messages take longer (simulating the bundling window + AI processing)
  const delayMs = isBundled ? 3000 : 1500;

  await new Promise(resolve => setTimeout(resolve, delayMs));

  // Generate response
  let response: string;
  if (isBundled) {
    response = generateBundledResponse(messages, propertyData || {}, niche || 'pousada');
  } else {
    response = generateSingleResponse(messages[0], propertyData || {}, niche || 'pousada');
  }

  // Calculate economy metrics
  const tariffsUsed = 1; // One-Shot: always 1 tariff regardless of message count
  const tariffsWithoutBundling = bundledCount; // Each message would be a separate conversation
  const economyPercent = isBundled
    ? Math.round(((tariffsWithoutBundling - tariffsUsed) / tariffsWithoutBundling) * 100)
    : 0;
  const metaCostSaved = isBundled
    ? (tariffsWithoutBundling - tariffsUsed) * META_COST_PER_TARIFF
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      response,
      bundling: {
        isBundled,
        bundledCount,
        tariffsUsed,
        tariffsWithoutBundling,
        economyPercent,
        metaCostPerTariff: META_COST_PER_TARIFF,
        metaCostSaved,
        metaCostTotal: tariffsUsed * META_COST_PER_TARIFF,
      },
      meta: {
        mode: 'mock',
        processingTimeMs: delayMs,
        timestamp: new Date().toISOString(),
        niche: niche || 'pousada',
      },
    },
  });
}
