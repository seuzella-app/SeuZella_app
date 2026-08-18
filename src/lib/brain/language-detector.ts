/**
 * Detecção Inteligente de Idioma (PT / ES / EN)
 * Especialmente projetada para atender turistas de países vizinhos (Argentina, Uruguai, Chile, etc.)
 * em regiões turísticas como Praia do Rosa, Florianópolis, Balneário Camboriú e Serra Gaúcha.
 */

export type SupportedLanguage = 'pt' | 'es' | 'en';

export interface LanguageDetectionResult {
  detectedLanguage: SupportedLanguage;
  confidence: number;
  isBilingualTarget: boolean; // True if tourist sent Spanish/English
  languageName: string;
}

const spanishKeywords = [
  'hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'gracias', 'por favor',
  'disponibilidad', 'habitacion', 'habitaciones', 'precio', 'cuanto', 'cuánto',
  'cuesta', 'noches', 'personas', 'reserva', 'reservar', 'tienen', 'hay', 'somos',
  'llegada', 'salida', 'estadia', 'estadía', 'pago', 'tarjeta', 'efectivo', 'playa',
  'nosotros', 'ustedes', 'quisiera', 'necesito', 'informacion', 'información'
];

const englishKeywords = [
  'hello', 'hi', 'good morning', 'good evening', 'thank you', 'please',
  'availability', 'room', 'rooms', 'price', 'how much', 'nights', 'people',
  'guests', 'booking', 'book', 'checkin', 'checkout', 'stay', 'payment'
];

export function detectLanguage(message: string): LanguageDetectionResult {
  if (!message || typeof message !== 'string') {
    return { detectedLanguage: 'pt', confidence: 1.0, isBilingualTarget: false, languageName: 'Português' };
  }

  const normalized = message
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const words = normalized.split(/\s+/);
  
  let spanishScore = 0;
  let englishScore = 0;

  for (const word of words) {
    if (spanishKeywords.includes(word)) spanishScore += 1;
    if (englishKeywords.includes(word)) englishScore += 1;
  }

  // Check multi-word phrases
  if (normalized.includes('buenos dias') || normalized.includes('buenas tardes') || normalized.includes('cuanto cuesta') || normalized.includes('por favor')) {
    spanishScore += 2;
  }
  if (normalized.includes('good morning') || normalized.includes('good evening') || normalized.includes('how much')) {
    englishScore += 2;
  }

  if (spanishScore > 0 && spanishScore >= englishScore) {
    return {
      detectedLanguage: 'es',
      confidence: Math.min(0.6 + spanishScore * 0.15, 0.98),
      isBilingualTarget: true,
      languageName: 'Espanhol',
    };
  }

  if (englishScore > 0 && englishScore > spanishScore) {
    return {
      detectedLanguage: 'en',
      confidence: Math.min(0.6 + englishScore * 0.15, 0.98),
      isBilingualTarget: true,
      languageName: 'Inglês',
    };
  }

  return {
    detectedLanguage: 'pt',
    confidence: 0.9,
    isBilingualTarget: false,
    languageName: 'Português',
  };
}
