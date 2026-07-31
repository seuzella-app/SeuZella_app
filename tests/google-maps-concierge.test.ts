import { describe, it, expect } from 'vitest';
import { GoogleMapsService } from '../src/lib/maps/google-maps-service';
import { ZellaSalesBrain } from '../src/lib/cerebro/zella-sales-brain';

describe('GoogleMapsService — Concierge & Guia de Turismo Virtual', () => {
  it('PILAR 1: Normalização de Cidades > deve reconhecer Ubatuba e Campos do Jordão corretamente', () => {
    expect(GoogleMapsService.normalizeCityKey('Tenho pousada em Ubatuba')).toBe('ubatuba');
    expect(GoogleMapsService.normalizeCityKey('Fica em Campos do Jordão')).toBe('campos_do_jordao');
    expect(GoogleMapsService.normalizeCityKey('Pousada em Gramado')).toBe('gramado');
  });

  it('PILAR 2: Recomendação de Pontos de Interesse > deve retornar locais com rating e link do mapa', async () => {
    const places = await GoogleMapsService.getNearbyPlaces('Ubatuba');
    expect(places.length).toBeGreaterThan(0);
    expect(places[0]).toHaveProperty('name');
    expect(places[0]).toHaveProperty('rating');
    expect(places[0]).toHaveProperty('mapsUrl');
  });

  it('PILAR 3: Integração no ZellaSalesBrain > deve incluir dicas locais quando cidade turística for mencionada', async () => {
    const res = await ZellaSalesBrain.processMessage('Minha pousada fica em Ubatuba', []);
    expect(res.success).toBe(true);
    expect(res.reply).toContain('Dicas do Zé em Minha pousada fica em Ubatuba');
  });
});
