/**
 * Testes do Motor de Diálogo Humanizado (Zélla/Zé)
 * ==================================================
 *
 * Valida:
 *   1. detectarEmocao identifica corretamente 8 emoções
 *   2. gerarPrimeiraResposta nunca produz "Olá, como é bom te ver por aqui"
 *   3. gerarRespostaIdentidade apresenta como Zélla e menciona Zé
 *   4. gerarRespostaObjecaoHumanizada lida com 5+ tipos de objeção
 *   5. Saudações variam (não repetem sempre a mesma)
 *   6. Detecção de hóspede recorrente usa saudação diferenciada
 *   7. Máximo 1 emoji por mensagem
 */

import { describe, it, expect } from 'vitest';
import {
  detectarEmocao,
  gerarPrimeiraResposta,
  gerarRespostaIdentidade,
  gerarRespostaObjecaoHumanizada,
  gerarRespostaDetalhes,
  gerarCotacaoDireta,
  gerarExplicacaoCaucao,
  type HospedeContext,
  type PousadaContext,
} from '@/lib/ai/humanized-dialogue';

// RNG determinístico para testes reproduzíveis
function rngWithSeed(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOSPEDE_PADRAO: HospedeContext = {
  display_name: 'Maria Silva',
  idade_anos: 32,
  genero: 'Mulher',
  estilo_dialogo: 'amigavel_conversador',
  duracao_estadia_dias: 3,
  grupo_tamanho: 2,
};

const POUSADA_PADRAO: PousadaContext = {
  nome: 'Recanto Praia',
  cidade: 'Florianópolis',
  estado: 'SC',
  diariaBase: 350,
  cafeDaManhaIncluso: true,
  temPiscina: true,
  vistaMar: true,
  estacionamento: true,
  checkIn: '14:00',
  checkOut: '11:00',
  caucaoHabilitada: true,
  caucaoPadrao: 200,
  janelaEstornoH: 24,
  mesesOperacao: 36,
  qtdReviews: 120,
  avaliacao: 4.8,
};

describe('Motor de Diálogo Humanizado — detectarEmocao', () => {
  it('detecta entusiasmo em mensagens com !!/emojis/amei', () => {
    const casos = [
      'Amei as fotos!!! Vai ser top!',
      'Que demaaaaais!! 🎉',
      'Vai ser massa demais!!',
    ];
    for (const msg of casos) {
      const result = detectarEmocao(msg);
      expect(result.emocao).toBe('entusiasmo');
      expect(result.confianca).toBeGreaterThan(0.7);
    }
  });

  it('detecta pressa em mensagens com "rápido/urgente/agora"', () => {
    const casos = [
      'Preciso responder rápido, é urgente',
      'Vou viajar hoje, manda agora',
      'Responde rápido por favor',
    ];
    for (const msg of casos) {
      const result = detectarEmocao(msg);
      expect(result.emocao).toBe('pressa');
      expect(result.confianca).toBeGreaterThan(0.85);
    }
  });

  it('detecta desconfiança em mensagens com "CNPJ/golpe/confiável"', () => {
    const casos = [
      'Vocês têm CNPJ? Quero evitar golpe',
      'É confiável mesmo? Já ouvi histórias',
    ];
    for (const msg of casos) {
      const result = detectarEmocao(msg);
      expect(result.emocao).toBe('desconfianca');
    }
  });

  it('detecta ansiedade em mensagens com "e se/medo/preocupad"', () => {
    const casos = [
      'E se eu precisar cancelar? Tenho medo',
      'Tô preocupada com a reserva',
    ];
    for (const msg of casos) {
      const result = detectarEmocao(msg);
      expect(result.emocao).toBe('ansiedade');
    }
  });

  it('detecta curiosidade em mensagens com "como funciona/me conta"', () => {
    const casos = [
      'Como funciona o café da manhã? Me conta mais',
      'Quero saber sobre os passeios',
    ];
    for (const msg of casos) {
      const result = detectarEmocao(msg);
      expect(result.emocao).toBe('curiosidade');
    }
  });

  it('detecta preocupação financeira em "caro/orçamento"', () => {
    const casos = [
      'Achei caro, fora do meu orçamento',
      'Está acima do que eu imaginava',
    ];
    for (const msg of casos) {
      const result = detectarEmocao(msg);
      expect(result.emocao).toBe('preocupacao_fin');
    }
  });

  it('detecta calor em "tudo bem/como vai"', () => {
    const casos = [
      'Oi, tudo bem?',
      'Boa tarde, como vai?',
    ];
    for (const msg of casos) {
      const result = detectarEmocao(msg);
      expect(result.emocao).toBe('calor');
    }
  });

  it('retorna neutro quando não há marcadores emocionais', () => {
    const result = detectarEmocao('Boa tarde. Quero saber sobre a diária.');
    expect(result.emocao).toBe('neutro');
  });
});

describe('Motor de Diálogo Humanizado — gerarPrimeiraResposta', () => {
  it('NUNCA produz "Olá, como é bom te ver por aqui"', () => {
    const rng = rngWithSeed(42);
    for (let i = 0; i < 50; i++) {
      const emocao = { emocao: 'neutro' as const, confianca: 0.5, intensidade: 'leve' as const };
      const result = gerarPrimeiraResposta(HOSPEDE_PADRAO, POUSADA_PADRAO, emocao, rng, false);
      expect(result.content).not.toContain('como é bom te ver por aqui');
      expect(result.content).not.toContain('Que bom ter você aqui');
    }
  });

  it('varia saudações (não repete sempre a mesma)', () => {
    const rng = rngWithSeed(123);
    const emocao = { emocao: 'neutro' as const, confianca: 0.5, intensidade: 'leve' as const };
    const respostas = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = gerarPrimeiraResposta(HOSPEDE_PADRAO, POUSADA_PADRAO, emocao, rng, false);
      respostas.add(result.content.split(' ').slice(0, 4).join(' ')); // primeiras 4 palavras
    }
    // Pelo menos 3 variações diferentes nas primeiras 20 respostas
    expect(respostas.size).toBeGreaterThanOrEqual(3);
  });

  it('usa nome do hóspede na saudação', () => {
    const rng = rngWithSeed(99);
    const emocao = { emocao: 'neutro' as const, confianca: 0.5, intensidade: 'leve' as const };
    const result = gerarPrimeiraResposta(HOSPEDE_PADRAO, POUSADA_PADRAO, emocao, rng, false);
    expect(result.content).toContain('Maria');
  });

  it('introduz identidade Zélla em primeira resposta', () => {
    const rng = rngWithSeed(7);
    const emocao = { emocao: 'neutro' as const, confianca: 0.5, intensidade: 'leve' as const };
    let encontrouIdentidade = false;
    for (let i = 0; i < 30; i++) {
      const result = gerarPrimeiraResposta(HOSPEDE_PADRAO, POUSADA_PADRAO, emocao, rng, false);
      if (result.content.includes('Zélla') || result.content.includes('Zé')) {
        encontrouIdentidade = true;
        break;
      }
    }
    expect(encontrouIdentidade).toBe(true);
  });

  it('hóspede recorrente usa saudação diferenciada (sem "Oi, Maria!" genérico)', () => {
    const rng = rngWithSeed(42);
    const emocao = { emocao: 'neutro' as const, confianca: 0.5, intensidade: 'leve' as const };
    const result = gerarPrimeiraResposta(HOSPEDE_PADRAO, POUSADA_PADRAO, emocao, rng, true);
    expect(result.intent).toBe('saudacao_recorrente');
    // Saudação de recorrente menciona "reserva" ou "tá em dia"
    expect(
      result.content.includes('reserva') ||
      result.content.includes('tá em dia') ||
      result.content.includes('já')
    ).toBe(true);
  });

  it('hóspede com pressa recebe resposta curta', () => {
    const rng = rngWithSeed(33);
    const emocao = { emocao: 'pressa' as const, confianca: 0.9, intensidade: 'forte' as const };
    const result = gerarPrimeiraResposta(HOSPEDE_PADRAO, POUSADA_PADRAO, emocao, rng, false);
    // Resposta para pressa deve ser curta (menos de 120 caracteres)
    expect(result.content.length).toBeLessThan(120);
    expect(result.intent).toBe('primeira_resposta_pressa');
  });

  it('hóspede desconfiado recebe resposta que reforça transparência', () => {
    const rng = rngWithSeed(44);
    const emocao = { emocao: 'desconfianca' as const, confianca: 0.85, intensidade: 'moderada' as const };
    const result = gerarPrimeiraResposta(HOSPEDE_PADRAO, POUSADA_PADRAO, emocao, rng, false);
    expect(result.content.toLowerCase()).toMatch(/transparente|verificar|tirar dúvidas|perguntar/);
  });

  it('máximo 1 emoji por mensagem', () => {
    const rng = rngWithSeed(55);
    const emocao = { emocao: 'neutro' as const, confianca: 0.5, intensidade: 'leve' as const };
    const EMOJIS_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    for (let i = 0; i < 30; i++) {
      const result = gerarPrimeiraResposta(HOSPEDE_PADRAO, POUSADA_PADRAO, emocao, rng, false);
      const emojis = result.content.match(EMOJIS_REGEX) || [];
      expect(emojis.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('Motor de Diálogo Humanizado — gerarRespostaIdentidade', () => {
  it('sempre menciona "Zélla" na identidade', () => {
    const rng = rngWithSeed(11);
    for (let i = 0; i < 20; i++) {
      const result = gerarRespostaIdentidade(HOSPEDE_PADRAO, POUSADA_PADRAO, rng);
      expect(result.content).toMatch(/Zélla|Zé/i);
    }
  });

  it('convida hóspede a chamar de Zé', () => {
    const rng = rngWithSeed(22);
    let encontrouConvite = false;
    for (let i = 0; i < 20; i++) {
      const result = gerarRespostaIdentidade(HOSPEDE_PADRAO, POUSADA_PADRAO, rng);
      if (result.content.toLowerCase().includes('pode me chamar de zé') ||
          result.content.toLowerCase().includes('pode chamar de zé') ||
          result.content.toLowerCase().includes('me chama de zé')) {
        encontrouConvite = true;
        break;
      }
    }
    expect(encontrouConvite).toBe(true);
  });
});

describe('Motor de Diálogo Humanizado — gerarRespostaObjecaoHumanizada', () => {
  it('rebate objeção de preço com desconto PIX', () => {
    const rng = rngWithSeed(1);
    const result = gerarRespostaObjecaoHumanizada(
      'O valor está acima do meu orçamento. Tem desconto?',
      POUSADA_PADRAO,
      HOSPEDE_PADRAO,
      rng,
    );
    expect(result.intent).toBe('rebater_preco');
    expect(result.content).toContain('PIX');
    expect(result.content).toMatch(/10%|desconto/);
  });

  it('rebate objeção de caução com explicação do estorno', () => {
    const rng = rngWithSeed(2);
    const result = gerarRespostaObjecaoHumanizada(
      'Não entendi a caução, vou desistir',
      POUSADA_PADRAO,
      HOSPEDE_PADRAO,
      rng,
    );
    expect(['rebater_caucao', 'rebater_caucao_desligada']).toContain(result.intent);
    // Deve mencionar estorno ou devolução
    expect(result.content.toLowerCase()).toMatch(/estorno|devolv|automático|automático/);
  });

  it('oferece late checkout quando hóspede pede', () => {
    const rng = rngWithSeed(3);
    const result = gerarRespostaObjecaoHumanizada(
      'O check-out é cedo demais. Tem estendido?',
      POUSADA_PADRAO,
      HOSPEDE_PADRAO,
      rng,
    );
    expect(result.intent).toBe('oferecer_late_checkout');
    expect(result.content).toMatch(/R\$ 50|late checkout|estendido/i);
  });

  it('responde sobre pet friendly', () => {
    const rng = rngWithSeed(4);
    // Pousada pet friendly
    const result = gerarRespostaObjecaoHumanizada(
      'Aceitam cachorro?',
      { ...POUSADA_PADRAO, petFriendly: true },
      HOSPEDE_PADRAO,
      rng,
    );
    expect(result.intent).toBe('rebater_pet_ok');
    expect(result.content.toLowerCase()).toContain('pet');
  });

  it('rebate desconfiança em PIX com CNPJ e comprovante', () => {
    const rng = rngWithSeed(5);
    const result = gerarRespostaObjecaoHumanizada(
      'Tenho medo de pagar PIX para desconhecido, pode ser golpe',
      POUSADA_PADRAO,
      HOSPEDE_PADRAO,
      rng,
    );
    expect(['rebater_confianca', 'rebater_credibilidade', 'rebater_caucao']).toContain(result.intent);
  });
});

describe('Motor de Diálogo Humanizado — funções auxiliares', () => {
  it('gerarRespostaDetalhes retorna informações do café da manhã', () => {
    const rng = rngWithSeed(6);
    const result = gerarRespostaDetalhes(POUSADA_PADRAO, HOSPEDE_PADRAO, rng);
    expect(result.content).toContain('Café da manhã');
    expect(result.content).toContain('14:00'); // checkIn
  });

  it('gerarCotacaoDireta calcula valor total corretamente', () => {
    const rng = rngWithSeed(7);
    const hospede = { ...HOSPEDE_PADRAO, duracao_estadia_dias: 4, grupo_tamanho: 2 };
    const result = gerarCotacaoDireta(POUSADA_PADRAO, hospede, rng);
    // 4 diárias × R$ 350 × ceil(2/2) = 1 = R$ 1400
    expect(result.content).toContain('1.400');
  });

  it('gerarExplicacaoCaucao menciona janela de estorno quando caução habilitada', () => {
    const rng = rngWithSeed(8);
    const result = gerarExplicacaoCaucao(POUSADA_PADRAO, HOSPEDE_PADRAO, rng);
    expect(result.intent).toBe('explicar_caucao');
    expect(result.content).toContain('24'); // janelaEstornoH
  });

  it('gerarExplicacaoCaucao diz "não pedimos caução" quando desabilitada', () => {
    const rng = rngWithSeed(9);
    const result = gerarExplicacaoCaucao(
      { ...POUSADA_PADRAO, caucaoHabilitada: false },
      HOSPEDE_PADRAO,
      rng,
    );
    expect(result.intent).toBe('sem_caucao');
    expect(result.content.toLowerCase()).toMatch(/não pedimos|sem caução|confiança total/);
  });
});
