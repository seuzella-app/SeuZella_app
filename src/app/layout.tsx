import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import './hud-tokens.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Seu Zélla — Assistente Inteligente para Pousadas | WhatsApp 24/7, Reservas Automáticas',
  description:
    'Assistente inteligente que atende seus hóspedes no WhatsApp 24 horas por dia. Responde, vende e gera reservas automaticamente. PIX integrado, preços inteligentes, Booking.com sincronizado. Teste grátis por 7 dias.',
  keywords: [
    'assistente inteligente pousada', 'assistente inteligente hotel', 'chatbot WhatsApp hotelaria', 'automacao reservas pousada',
    'WhatsApp atendimento 24 horas', 'atendimento automático hóspedes', 'SmartHotel', 'Seu Zella', 'ZEHLA',
    'pousada Brasil', 'reservas WhatsApp', 'link in bio pousada', 'sistema pousada',
    'preços inteligentes pousada', 'economia WhatsApp', 'reservas Booking.com',
    'atendimento inteligente pousada', 'hospitalidade inteligente', 'chatbot hotel',
    'pousada Florianópolis', 'pousada Ubatuba', 'pousada litoral',
  ],
  authors: [{ name: 'Seu Zélla', url: 'https://zehla.com.br' }],
  creator: 'Seu Zélla',
  metadataBase: new URL('https://zehla.com.br'),
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://zehla.com.br',
    siteName: 'Seu Zélla',
    title: 'Seu Zélla — Assistente Inteligente para Pousadas | WhatsApp 24/7 + Reservas Automáticas',
    description: 'Atenda seus hóspedes no WhatsApp 24h com assistente inteligente. Reservas, PIX, preços inteligentes e Booking.com sincronizado. Feito para pousadas brasileiras. 7 dias grátis.',
    images: [{ url: '/og-image.png', width: 1344, height: 768, alt: 'Seu Zélla — Assistente Inteligente para Pousadas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seu Zélla — Assistente Inteligente para Pousadas | WhatsApp 24/7',
    description: 'Atenda seus hóspedes no WhatsApp 24h com assistente inteligente. Reservas automáticas, PIX integrado, preços inteligentes. 7 dias grátis.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'Seu Zélla',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Assistente inteligente de automação de reservas e atendimento 24/7 para pousadas e hotéis brasileiros.',
      url: 'https://zehla.com.br',
      offers: [
        { '@type': 'Offer', name: 'Gratuito (Trial)', price: '0', priceCurrency: 'BRL', description: '7 dias grátis para testar' },
        { '@type': 'Offer', name: 'LITE', price: '197', priceCurrency: 'BRL', description: 'WhatsApp assistente inteligente 24/7, PIX integrado, dashboard completo' },
        { '@type': 'Offer', name: 'PRO', price: '397', priceCurrency: 'BRL', description: 'Mensagens ilimitadas, campanhas automatizadas, link-in-bio profissional' },
        { '@type': 'Offer', name: 'MAX', price: '797', priceCurrency: 'BRL', description: 'Suporte VIP, consultoria personalizada, integrações customizadas' },
        { '@type': 'Offer', name: 'Link-in-Bio Standalone', price: '47', priceCurrency: 'BRL', description: 'Link-in-Bio profissional sem assistente inteligente — página seusella.com personalizada' },
      ],
      aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '98', bestRating: '5', worstRating: '1' },
    },
    {
      '@type': 'Organization',
      name: 'Seu Zélla',
      url: 'https://zehla.com.br',
      logo: 'https://zehla.com.br/logo.svg',
      description: 'Plataforma inteligente para pousadas e hotéis brasileiros — organiza, ajuda a lucrar mais e gastar menos.',
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', availableLanguage: 'Portuguese' },
      sameAs: ['https://instagram.com/seuzella', 'https://youtube.com/@seuzella', 'https://linkedin.com/company/seuzella'],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'O que é o Seu Zélla?',
          acceptedAnswer: { '@type': 'Answer', text: 'O Seu Zélla é um assistente inteligente que atende seus hóspedes no WhatsApp 24 horas por dia. Ele responde perguntas, verifica disponibilidade, negocia preços e gera PIX de pagamento automaticamente.' },
        },
        {
          '@type': 'Question',
          name: 'Quanto custa o Seu Zélla?',
          acceptedAnswer: { '@type': 'Answer', text: 'O plano LITE custa R$197/mês (PIX), o PRO R$397/mês e o MAX R$797/mês. Há também o Link-in-Bio Standalone por R$47/mês e um trial grátis de 7 dias sem necessidade de cartão de crédito.' },
        },
        {
          '@type': 'Question',
          name: 'Funciona com o WhatsApp Business?',
          acceptedAnswer: { '@type': 'Answer', text: 'Sim! O Zélla integra diretamente com a WhatsApp Cloud API da Meta para envio e recebimento de mensagens em tempo real, com respostas em menos de 8 segundos.' },
        },
      ],
    },
    {
      '@type': 'WebPage',
      '@id': 'https://zehla.com.br/#webpage',
      url: 'https://zehla.com.br',
      name: 'Seu Zélla — Assistente Inteligente para Pousadas e Hotéis',
      isPartOf: { '@id': 'https://zehla.com.br/#website' },
      about: { '@id': 'https://zehla.com.br/#organization' },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://zehla.com.br/#website',
      url: 'https://zehla.com.br',
      name: 'Seu Zélla',
      inLanguage: 'pt-BR',
    },
  ],
};

const jsonLdScript = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}