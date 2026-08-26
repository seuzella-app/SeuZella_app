// src/lib/intelligence/competitive/attack-strategy.ts
// Generates attack strategies based on competitor gaps and lead profile

import { CompetitorGap, COMPETITOR_GAPS } from './gap-mapper';

export interface AttackStrategy {
  primaryGap: CompetitorGap;
  secondaryGaps: CompetitorGap[];
  pitch: string;
  proofPoints: string[];
  urgency: 'high' | 'medium' | 'low';
}

export function generateAttackStrategy(
  leadProfile: {
    city?: string | null;
    state?: string | null;
    roomsCount?: number | null;
    tier?: string | null;
    currentPMS?: string | null;
    painCluster?: string | null;
  }
): AttackStrategy | null {
  const currentPMS = leadProfile.currentPMS?.toLowerCase();

  let relevantGaps: CompetitorGap[] = [];

  if (currentPMS?.includes('silbeck')) {
    relevantGaps = COMPETITOR_GAPS.filter(g => g.competitor === 'Silbeck');
  } else if (currentPMS?.includes('innotel')) {
    relevantGaps = COMPETITOR_GAPS.filter(g => g.competitor === 'Innotel');
  } else if (currentPMS?.includes('cloudbeds')) {
    relevantGaps = COMPETITOR_GAPS.filter(g => g.competitor === 'Cloudbeds');
  } else if (currentPMS?.includes('simples')) {
    relevantGaps = COMPETITOR_GAPS.filter(g => g.competitor === 'SimplesHotel');
  } else if (currentPMS?.includes('quarto')) {
    relevantGaps = COMPETITOR_GAPS.filter(g => g.competitor === 'QuartoVerde');
  } else {
    relevantGaps = COMPETITOR_GAPS.filter(g => g.priority >= 8);
  }

  if (relevantGaps.length === 0) return null;

  const sorted = [...relevantGaps].sort((a, b) => b.priority - a.priority);
  const primary = sorted[0];
  const secondary = sorted.slice(1, 4);

  const pitch = buildPitch(primary, secondary, leadProfile);
  const proofPoints = buildProofPoints(primary, leadProfile);

  const urgency = primary.impact === 'ALTO' ? 'high' : primary.impact === 'MEDIO' ? 'medium' : 'low';

  return { primaryGap: primary, secondaryGaps: secondary, pitch, proofPoints, urgency };
}

function buildPitch(
  primary: CompetitorGap,
  secondary: CompetitorGap[],
  profile: { roomsCount?: number | null; city?: string | null }
): string {
  const rooms = profile.roomsCount ? `${profile.roomsCount} quartos` : 'sua pousada';
  const city = profile.city ? ` em ${profile.city}` : '';

  return `Pousadas com ${rooms}${city} que usam sistemas tradicionais perdem tempo com ${primary.description.toLowerCase()}. ` +
    `O ZEHLA resolve isso com ${primary.zehlaModule} — ${primary.zehlAttack}. ${ 
    secondary.map(s => `Além disso, ${s.zehlAttack.toLowerCase()}.`).join(' ')}`;
}

function buildProofPoints(
  primary: CompetitorGap,
  profile: { roomsCount?: number | null }
): string[] {
  const points: string[] = [];

  if (primary.zehlaModule === 'hermes') {
    points.push('WhatsApp respondido em < 30s com IA');
    points.push('Atendimento 24h sem equipe extra');
  }

  if (primary.zehlaModule === 'brain') {
    points.push('IA que prevê preferências do hóspede');
    points.push('Upsell automático baseado em histórico');
  }

  if (primary.zehlaModule === 'revenue') {
    points.push('Precificação dinâmica em tempo real');
    points.push('Revenue management sem consultor');
  }

  if (primary.zehlaModule === 'pms') {
    points.push('Tudo em 3 cliques');
    points.push('Onboarding em 5 minutos');
  }

  if (profile.roomsCount && profile.roomsCount > 20) {
    points.push(`Ideal para pousadas com ${profile.roomsCount}+ quartos`);
  }

  return points;
}
