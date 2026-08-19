/**
 * Motor Dinâmico de Feriados Brasileiros e Oportunidades de UPSELL
 * Calcula automaticamente as datas dos feriados móveis e fixos para o ano corrente (ou próximo ano se já passaram).
 */

export interface DynamicHoliday {
  id: string;
  label: string;
  dataInicio: string; // ISO ou formatado
  dataFim: string;
  periodoFormatado: string;
  diasAteFeriado: number;
  status: 'em_andamento' | 'proximo' | 'futuro';
  statusBadge: string;
  upsellSugerido: number;
  desc: string;
}

// Algoritmo de Meeus/Jones/Butcher para cálculo da data da Páscoa
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexado (2=Março, 3=Abril)
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes, dia);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function fmtDateBR(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getUpcomingHolidays(referenceDate: Date = new Date()): DynamicHoliday[] {
  const anoAtual = referenceDate.getFullYear();
  const hoje = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  const definitions = [
    {
      id: 'reveillon',
      label: '🎆 Pacote Réveillon & Ano Novo',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 11, 28), // 28/Dez
        end: new Date(ano + 1, 0, 2),  // 02/Jan
      }),
      upsellSugerido: 350,
      desc: 'Pico máximo de procura no WhatsApp. Valorização de 80% a 120% da diária por quarto.',
    },
    {
      id: 'ferias_janeiro',
      label: '☀️ Férias de Verão (Janeiro)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 0, 2),
        end: new Date(ano, 0, 31),
      }),
      upsellSugerido: 180,
      desc: 'Alta ocupação diária. Reservas antecipadas fechadas pelo Cérebro Zélla.',
    },
    {
      id: 'carnaval',
      label: '🎭 Pacote Carnaval',
      getDateRange: (ano: number) => {
        const pascoa = calcularPascoa(ano);
        const tercaCarnaval = addDays(pascoa, -47);
        const sextaCarnaval = addDays(tercaCarnaval, -4);
        const quartaCinzas = addDays(tercaCarnaval, 1);
        return { start: sextaCarnaval, end: quartaCinzas };
      },
      upsellSugerido: 280,
      desc: 'Altíssimo fluxo de mensagens e cotações. Tarifa de pacote fechado por quarto.',
    },
    {
      id: 'semana_santa',
      label: '🕊️ Semana Santa & Páscoa',
      getDateRange: (ano: number) => {
        const pascoa = calcularPascoa(ano);
        const quinta = addDays(pascoa, -3);
        return { start: quinta, end: pascoa };
      },
      upsellSugerido: 160,
      desc: 'Feriado prolongado tradicional para casais e famílias com alta conversão.',
    },
    {
      id: 'tiradentes',
      label: '🇧🇷 Feriado Tiradentes (21/Abril)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 3, 21),
        end: new Date(ano, 3, 21),
      }),
      upsellSugerido: 130,
      desc: 'Feriado nacional com grande procura para viagens curtas e escapadas.',
    },
    {
      id: 'dia_trabalho',
      label: '🛠️ Feriado 1º de Maio (Trabalhador)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 4, 1),
        end: new Date(ano, 4, 1),
      }),
      upsellSugerido: 130,
      desc: 'Feriado de alta procura para pousadas em destinos de serra e praia.',
    },
    {
      id: 'corpus_christi',
      label: '✝️ Feriado Corpus Christi',
      getDateRange: (ano: number) => {
        const pascoa = calcularPascoa(ano);
        const quinta = addDays(pascoa, 60);
        const domingo = addDays(quinta, 3);
        return { start: quinta, end: domingo };
      },
      upsellSugerido: 140,
      desc: 'Feriado prolongado clássico de 4 dias de pacote fechado por quarto.',
    },
    {
      id: 'ferias_julho',
      label: '❄️ Férias de Julho (Temporada de Inverno)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 6, 1),
        end: new Date(ano, 6, 31),
      }),
      upsellSugerido: 150,
      desc: 'Férias escolares de inverno e turismo regional de alta demanda.',
    },
    {
      id: 'independencia',
      label: '🇧🇷 7 de Setembro (Independência)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 8, 7),
        end: new Date(ano, 8, 7),
      }),
      upsellSugerido: 140,
      desc: 'Pico de viagens rápidas e turismo local com alta busca de cotações.',
    },
    {
      id: 'nossa_senhora',
      label: '👑 12 de Outubro (Aparecida & Crianças)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 9, 12),
        end: new Date(ano, 9, 12),
      }),
      upsellSugerido: 140,
      desc: 'Feriado familiar com alta ocupação e procura antecipada no WhatsApp.',
    },
    {
      id: 'finados',
      label: '🕯️ 02 de Novembro (Finados)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 10, 2),
        end: new Date(ano, 10, 2),
      }),
      upsellSugerido: 130,
      desc: 'Feriado prolongado de primavera com procura aquecida.',
    },
    {
      id: 'proclamacao',
      label: '🏛️ 15 de Novembro (República)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 10, 15),
        end: new Date(ano, 10, 15),
      }),
      upsellSugerido: 140,
      desc: 'Prévia de verão e altíssima taxa de conversão direta no WhatsApp.',
    },
    {
      id: 'consciencia_negra',
      label: '✊ 20 de Novembro (Consciência Negra)',
      getDateRange: (ano: number) => ({
        start: new Date(ano, 10, 20),
        end: new Date(ano, 10, 20),
      }),
      upsellSugerido: 140,
      desc: 'Feriado nacional oficial consolidado de alta demanda de viagens.',
    },
  ];

  const holidays: DynamicHoliday[] = definitions.map((def) => {
    let { start, end } = def.getDateRange(anoAtual);

    // Se o feriado deste ano já acabou, calcula a data para o próximo ano automaticamente
    if (end < hoje) {
      const nextRange = def.getDateRange(anoAtual + 1);
      start = nextRange.start;
      end = nextRange.end;
    }

    const diffTime = start.getTime() - hoje.getTime();
    const diasAte = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status: 'em_andamento' | 'proximo' | 'futuro' = 'futuro';
    let statusBadge = `Faltam ${diasAte} dias`;

    if (hoje >= start && hoje <= end) {
      status = 'em_andamento';
      statusBadge = '🔥 Acontecendo Agora';
    } else if (diasAte >= 0 && diasAte <= 30) {
      status = 'proximo';
      statusBadge = `🚨 Próximo Feriado (${diasAte} dias)`;
    }

    const periodoFormatado =
      start.getTime() === end.getTime()
        ? fmtDateBR(start)
        : `${fmtDateBR(start)} a ${fmtDateBR(end)}`;

    return {
      id: def.id,
      label: def.label,
      dataInicio: start.toISOString(),
      dataFim: end.toISOString(),
      periodoFormatado,
      diasAteFeriado: Math.max(0, diasAte),
      status,
      statusBadge,
      upsellSugerido: def.upsellSugerido,
      desc: def.desc,
    };
  });

  // Ordena cronologicamente pelo feriado mais próximo
  return holidays.sort((a, b) => a.diasAteFeriado - b.diasAteFeriado);
}
