import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ══
// MAGIC LINK — Mock Scraper Engine
// ══
// Recebe URL do anúncio, simula delay de scraping e devolve
// dados ricos para hidratar o Dashboard.
//
// ⚠️ MODO MOCK — Quando pronto para produção, substituir por
// chamadas reais ao z-ai-web-dev-sdk (VLM + Web Reader)
// ══

interface MagicLinkRequest {
  url: string;
  niche: 'pousada' | 'airbnb';
  source: 'airbnb' | 'booking' | 'website';
}

interface MagicLinkResponse {
  propertyName: string;
  amenities: string[];
  checkInTime: string;
  checkOutTime: string;
  aiVoiceTone: string;
  source: 'airbnb' | 'booking' | 'website';
  location: string;
  rating: number;
  totalRooms: number;
  description: string;
  priceRange: string;
  policies: string;
  highlights: string[];
}

// ── Mock Data Banks by Source 

const POUSADA_MOCKS: Record<string, MagicLinkResponse> = {
  airbnb: {
    propertyName: 'Pousada Recanto das Águas',
    amenities: ['Piscina com cascata', 'Café da manhã incluso', 'Wi-Fi 200Mbps', 'Estacionamento gratuito'],
    checkInTime: '14:00',
    checkOutTime: '12:00',
    aiVoiceTone: 'Acolhedor e profissional — como um anfitrião que conhece cada cantinho da pousada',
    source: 'airbnb',
    location: 'Paraty, RJ',
    rating: 4.87,
    totalRooms: 12,
    description: 'Pousada encantadora rodeada pela Mata Atlântica, a 5 min do centro histórico. Quartos com varanda e vista para o jardim.',
    priceRange: 'R$ 350 — R$ 780',
    policies: 'Cancelamento gratuito até 48h antes. Após esse prazo, cobrança de 1 diária.',
    highlights: ['Mata Atlântica', 'Centro histórico', 'Café incluso'],
  },
  booking: {
    propertyName: 'Pousada Vila dos Coqueiros',
    amenities: ['Praia privativa', 'Restaurante regional', 'Spa & Massagem', 'Transfer aeroporto'],
    checkInTime: '15:00',
    checkOutTime: '11:00',
    aiVoiceTone: 'Calmo e informativo — como um concierge que antecipa necessidades dos hóspedes',
    source: 'booking',
    location: 'Porto de Galinhas, PE',
    rating: 4.72,
    totalRooms: 18,
    description: 'Refúgio à beira-mar com acesso exclusivo à praia. Ideal para casais e famílias que buscam tranquilidade.',
    priceRange: 'R$ 420 — R$ 950',
    policies: 'Cancelamento gratuito até 72h antes. No-show cobra 100% da estadia.',
    highlights: ['Praia privativa', 'Spa incluso', 'Transfer grátis'],
  },
  website: {
    propertyName: 'Pousada Serra Limpa',
    amenities: ['Trilhas ecológicas', 'Lareira no quarto', 'Café colonial', 'Aceita pets'],
    checkInTime: '14:00',
    checkOutTime: '12:00',
    aiVoiceTone: 'Rústico e acolhedor — como um amigo que ama a serra e compartilha suas descobertas',
    source: 'website',
    location: 'Campos do Jordão, SP',
    rating: 4.91,
    totalRooms: 8,
    description: 'Chalés exclusivos no coração da Serra da Mantiqueira. Experiência mountain com todo conforto.',
    priceRange: 'R$ 550 — R$ 1.200',
    policies: 'Cancelamento gratuito até 7 dias antes. Menos de 7 dias, reembolso de 50%.',
    highlights: ['Serra da Mantiqueira', 'Aceita pets', 'Café colonial'],
  },
};

const AIRBNB_MOCKS: Record<string, MagicLinkResponse> = {
  airbnb: {
    propertyName: 'Flat Copacabana Beach View',
    amenities: ['Vista direta p/ mar', 'Ar-condicionado split', 'Cozinha completa', 'Portaria 24h'],
    checkInTime: '15:00',
    checkOutTime: '11:00',
    aiVoiceTone: 'Moderno e prático — como um anfitrião urbano que valoriza agilidade e clareza',
    source: 'airbnb',
    location: 'Rio de Janeiro, RJ',
    rating: 4.92,
    totalRooms: 2,
    description: 'Studio reformado com vista panorâmica da Praia de Copacabana. Localização privilegiada entre os postos 5 e 6.',
    priceRange: 'R$ 280 — R$ 650',
    policies: 'Cancelamento gratuito até 24h antes. Taxa de limpeza de R$ 80 não reembolsável.',
    highlights: ['Vista p/ mar', 'Copacabana', 'Portaria 24h'],
  },
  booking: {
    propertyName: 'Chalé Montanha & Canela',
    amenities: ['Hidromassagem privativa', 'Fogão a lenha', 'Deck com churrasqueira', 'Cafeteira Nespresso'],
    checkInTime: '16:00',
    checkOutTime: '10:00',
    aiVoiceTone: 'Descontraído e hospitaleiro — como um anfitrião que faz o hóspede se sentir em casa',
    source: 'booking',
    location: 'Gramado, RS',
    rating: 4.85,
    totalRooms: 3,
    description: 'Chalé aconchegante no coração da Serra Gaúcha. Perfeito para lua de mel ou fim de semana romântico.',
    priceRange: 'R$ 480 — R$ 890',
    policies: 'Cancelamento gratuito até 5 dias antes. Taxa de limpeza incluída na diária.',
    highlights: ['Serra Gaúcha', 'Hidromassagem', 'Fogão a lenha'],
  },
  website: {
    propertyName: 'Studio Paulista Design',
    amenities: ['Decoração assinada', 'Smart TV 55"', 'Coworking café no prédio', 'Bicicletário'],
    checkInTime: '14:00',
    checkOutTime: '12:00',
    aiVoiceTone: 'Urbano e eficiente — como um concierge digital que resolve tudo em poucos toques',
    source: 'website',
    location: 'São Paulo, SP',
    rating: 4.78,
    totalRooms: 1,
    description: 'Studio designer na Av. Paulista, próximo ao MASP e metrô. Ideal para viagens de negócios ou turismo urbano.',
    priceRange: 'R$ 220 — R$ 450',
    policies: 'Cancelamento gratuito até 48h antes. Check-in auto com cofre de chaves.',
    highlights: ['Av. Paulista', 'MASP', 'Coworking'],
  },
};

export async function POST(request: NextRequest) {
  try {
    // ── Auth check (optional during onboarding, required for production) 
    // NOTE: Authentication is optional here because this endpoint is used during
    // the onboarding flow before a full session is established. For production,
    // add proper rate-limiting and session enforcement.
    const session = await getServerSession(authOptions);
    if (!session && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: MagicLinkRequest = await request.json();
    const { url, niche, source } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL é obrigatória' },
        { status: 400 }
      );
    }

    // ── Simulate network delay (scraping time) 
    // In production: replace with real VLM + Web Reader SDK calls
    await new Promise(r => setTimeout(r, 4500));

    // ── Select mock data by niche and source 
    const mockBank = niche === 'airbnb' ? AIRBNB_MOCKS : POUSADA_MOCKS;
    const result = mockBank[source] || mockBank.website;

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        scannedUrl: url,
        niche,
        source,
        timestamp: new Date().toISOString(),
        mode: 'mock', // flag para o frontend saber que é mock
      },
    });
  } catch (error) {
    console.error('[Magic Link] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar o link' },
      { status: 500 }
    );
  }
}
