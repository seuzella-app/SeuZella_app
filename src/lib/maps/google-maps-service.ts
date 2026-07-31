/**
 * Google Maps Platform & Regional Concierge Service
 * Suporta Places API (Nearby Search), Geocoding e Banco de Resiliência Regional.
 */

export interface PointOfInterest {
  name: string;
  category: 'restaurant' | 'pharmacy' | 'beach' | 'bakery' | 'tourist_attraction';
  rating?: number;
  address?: string;
  distanceDescription?: string;
  mapsUrl?: string;
}

const REGIONAL_KNOWLEDGE_BASE: Record<string, PointOfInterest[]> = {
  ubatuba: [
    { name: 'Praia do Tenório', category: 'beach', rating: 4.8, distanceDescription: 'a 5 min da praia', mapsUrl: 'https://maps.google.com/?q=Praia+do+Tenório+Ubatuba' },
    { name: 'Quiosque Rei do Peixe', category: 'restaurant', rating: 4.7, distanceDescription: 'a 3 min a pé', mapsUrl: 'https://maps.google.com/?q=Quiosque+Rei+do+Peixe+Ubatuba' },
    { name: 'Padaria Alentejana', category: 'bakery', rating: 4.6, distanceDescription: 'na av. principal', mapsUrl: 'https://maps.google.com/?q=Padaria+Alentejana+Ubatuba' },
  ],
  campos_do_jordao: [
    { name: 'Vila Capivari', category: 'tourist_attraction', rating: 4.9, distanceDescription: 'no centro turístico', mapsUrl: 'https://maps.google.com/?q=Vila+Capivari+Campos+do+Jordao' },
    { name: 'Restaurante Baden Baden', category: 'restaurant', rating: 4.8, distanceDescription: 'a 200m da praça', mapsUrl: 'https://maps.google.com/?q=Baden+Baden+Campos+do+Jordao' },
    { name: 'Teleférico do Morro do Elefante', category: 'tourist_attraction', rating: 4.7, distanceDescription: 'próximo ao parque', mapsUrl: 'https://maps.google.com/?q=Teleferico+Campos+do+Jordao' },
  ],
  gramado: [
    { name: 'Rua Coberta', category: 'tourist_attraction', rating: 4.9, distanceDescription: 'no centro de Gramado', mapsUrl: 'https://maps.google.com/?q=Rua+Coberta+Gramado' },
    { name: 'Lago Negro', category: 'tourist_attraction', rating: 4.8, distanceDescription: 'a 5 min de carro', mapsUrl: 'https://maps.google.com/?q=Lago+Negro+Gramado' },
    { name: 'Cantina Pastasciutta', category: 'restaurant', rating: 4.7, distanceDescription: 'gastronomia típica italiana', mapsUrl: 'https://maps.google.com/?q=Cantina+Pastasciutta+Gramado' },
  ],
  caldas_novas: [
    { name: 'Parque das Fontes', category: 'tourist_attraction', rating: 4.8, distanceDescription: 'águas termais naturais', mapsUrl: 'https://maps.google.com/?q=Caldas+Novas+Parque' },
    { name: 'Feira do Luar', category: 'tourist_attraction', rating: 4.6, distanceDescription: 'no centro da cidade', mapsUrl: 'https://maps.google.com/?q=Feira+do+Luar+Caldas+Novas' },
  ],
  paraty: [
    { name: 'Centro Histórico de Paraty', category: 'tourist_attraction', rating: 4.9, distanceDescription: 'ruas de pedra pé-de-moleque', mapsUrl: 'https://maps.google.com/?q=Centro+Historico+Paraty' },
    { name: 'Praia do Jabaquara', category: 'beach', rating: 4.7, distanceDescription: 'a 10 min a pé', mapsUrl: 'https://maps.google.com/?q=Praia+Jabaquara+Paraty' },
  ],
  buzios: [
    { name: 'Rua das Pedras', category: 'tourist_attraction', rating: 4.9, distanceDescription: 'orla e gastronomia', mapsUrl: 'https://maps.google.com/?q=Rua+das+Pedras+Buzios' },
    { name: 'Praia de Geribá', category: 'beach', rating: 4.8, distanceDescription: 'excelente para surf e banho', mapsUrl: 'https://maps.google.com/?q=Praia+Geriba+Buzios' },
  ],
};

export class GoogleMapsService {
  /**
   * Converte nome da cidade/endereço em chave regional ou busca real.
   */
  static normalizeCityKey(locationQuery: string): string {
    const norm = locationQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('ubatuba')) return 'ubatuba';
    if (norm.includes('campos') || norm.includes('jordao')) return 'campos_do_jordao';
    if (norm.includes('gramado') || norm.includes('canela')) return 'gramado';
    if (norm.includes('caldas')) return 'caldas_novas';
    if (norm.includes('paraty') || norm.includes('parati')) return 'paraty';
    if (norm.includes('buzios')) return 'buzios';
    return 'default';
  }

  /**
   * Obtém pontos de interesse próximos baseados na localização ou cidade.
   */
  static async getNearbyPlaces(locationQuery: string): Promise<PointOfInterest[]> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const cityKey = this.normalizeCityKey(locationQuery);

    // Se houver chave do Google Maps e não for chave de teste/vazia, tenta Places API
    if (apiKey && apiKey !== 'mock_key' && !apiKey.startsWith('AIzaSyMock')) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
            locationQuery
          )}&key=${apiKey}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            return data.results.slice(0, 3).map((r: any) => ({
              name: r.name,
              category: 'tourist_attraction',
              rating: r.rating || 4.5,
              address: r.formatted_address,
              distanceDescription: 'próximo ao local',
              mapsUrl: `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
            }));
          }
        }
      } catch (err) {
        console.warn('[GoogleMapsService] Fallback ativado por erro de rede:', err);
      }
    }

    // Fallback de resiliência com base de dados regional
    if (cityKey !== 'default' && REGIONAL_KNOWLEDGE_BASE[cityKey]) {
      return REGIONAL_KNOWLEDGE_BASE[cityKey];
    }

    // Fallback padrão genérico para qualquer outra localização
    return [
      { name: 'Restaurante Típico da Região', category: 'restaurant', rating: 4.8, distanceDescription: 'a 5 min a pé', mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(locationQuery)}` },
      { name: 'Padaria e Café Central', category: 'bakery', rating: 4.7, distanceDescription: 'no centro comercial', mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(locationQuery)}` },
    ];
  }

  /**
   * Formatador amigável das recomendações do Seu Zélla.
   */
  static formatPlacesResponse(places: PointOfInterest[], cityName: string): string {
    if (places.length === 0) return '';

    let res = `\n\n📌 *Dicas do Zé em ${cityName}:*\n`;
    places.forEach((p) => {
      res += `• *${p.name}* (${p.distanceDescription}) — ⭐ ${p.rating || '4.8'}\n`;
    });
    return res;
  }
}
