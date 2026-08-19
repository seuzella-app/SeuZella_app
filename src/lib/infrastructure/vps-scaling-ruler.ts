/**
 * VPS Scaling Ruler — Régua de Dimensionamento & Telemetria de Infraestrutura Hostinger
 * ===================================================================================
 * Monitora o crescimento de pousadas ativas e avalia a latência estimada da VPS,
 * fornecendo recomendações de migração em tempo real para o ZéCode e ZCC.
 */

export type HostingerTier = 'KVM_1' | 'KVM_2' | 'KVM_4' | 'KVM_8' | 'DEDICATED_CLUSTER';

export interface VpsTierSpec {
  id: HostingerTier;
  name: string;
  vCpu: number;
  ramGb: number;
  diskGb: number;
  bandwidthTb: number;
  monthlyCostBrl: number;
  idealMinPousadas: number;
  idealMaxPousadas: number;
  warningThresholdPousadas: number;
  criticalThresholdPousadas: number;
  estimatedBaselineLatencyMs: number;
}

export const HOSTINGER_VPS_TIERS: Record<HostingerTier, VpsTierSpec> = {
  KVM_1: {
    id: 'KVM_1',
    name: 'Hostinger VPS KVM 1',
    vCpu: 1,
    ramGb: 4,
    diskGb: 50,
    bandwidthTb: 4,
    monthlyCostBrl: 29.99,
    idealMinPousadas: 0,
    idealMaxPousadas: 25,
    warningThresholdPousadas: 30,
    criticalThresholdPousadas: 40,
    estimatedBaselineLatencyMs: 25,
  },
  KVM_2: {
    id: 'KVM_2',
    name: 'Hostinger VPS KVM 2',
    vCpu: 2,
    ramGb: 8,
    diskGb: 100,
    bandwidthTb: 8,
    monthlyCostBrl: 39.99,
    idealMinPousadas: 26,
    idealMaxPousadas: 90,
    warningThresholdPousadas: 105,
    criticalThresholdPousadas: 130,
    estimatedBaselineLatencyMs: 30,
  },
  KVM_4: {
    id: 'KVM_4',
    name: 'Hostinger VPS KVM 4 (Atual)',
    vCpu: 4,
    ramGb: 16,
    diskGb: 200,
    bandwidthTb: 16,
    monthlyCostBrl: 59.99,
    idealMinPousadas: 91,
    idealMaxPousadas: 280,
    warningThresholdPousadas: 300,
    criticalThresholdPousadas: 350,
    estimatedBaselineLatencyMs: 35,
  },
  KVM_8: {
    id: 'KVM_8',
    name: 'Hostinger VPS KVM 8',
    vCpu: 8,
    ramGb: 32,
    diskGb: 400,
    bandwidthTb: 32,
    monthlyCostBrl: 119.99,
    idealMinPousadas: 281,
    idealMaxPousadas: 750,
    warningThresholdPousadas: 800,
    criticalThresholdPousadas: 950,
    estimatedBaselineLatencyMs: 30,
  },
  DEDICATED_CLUSTER: {
    id: 'DEDICATED_CLUSTER',
    name: 'Dedicated Multi-Node Cluster',
    vCpu: 16,
    ramGb: 64,
    diskGb: 1000,
    bandwidthTb: 64,
    monthlyCostBrl: 349.99,
    idealMinPousadas: 751,
    idealMaxPousadas: 3000,
    warningThresholdPousadas: 3200,
    criticalThresholdPousadas: 4000,
    estimatedBaselineLatencyMs: 20,
  },
};

export interface InfraScalingEvaluation {
  currentTier: VpsTierSpec;
  activePousadas: number;
  currentEstimatedLatencyMs: number;
  cpuUsagePercentage: number;
  ramUsageGb: number;
  ramUsagePercentage: number;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
  statusMessage: string;
  recommendation: {
    action: 'MAINTAIN' | 'PREPARE_UPGRADE' | 'MIGRATE_NOW' | 'DOWNGRADE_POSSIBLE';
    suggestedTier: VpsTierSpec;
    reason: string;
    headroomPousadasRemaining: number;
    estimatedCostImpactBrl: number;
  };
  latencyRulerCurve: Array<{
    pousadas: number;
    projectedLatencyMs: number;
    zone: 'green' | 'yellow' | 'red';
  }>;
}

/**
 * Calcula a curva de latência e saúde de infraestrutura para uma dada quantidade de pousadas.
 */
export function evaluateVpsScaling(
  activePousadas: number,
  currentTierId: HostingerTier = 'KVM_4'
): InfraScalingEvaluation {
  const currentTier = HOSTINGER_VPS_TIERS[currentTierId];

  // Modelagem empírica de carga:
  // - Cada pousada ativa consome ~0.018 vCPU em média (picos com webhooks e IA)
  // - Cada pousada consome ~25 MB de RAM (estado de sessões, cache e pooling)
  // - Base fixa do sistema (Next.js + Postgres + Redis): 1.8 GB RAM + 0.3 vCPU
  const estimatedRamGb = 1.8 + (activePousadas * 25) / 1024;
  const estimatedCpuLoad = 0.3 + activePousadas * 0.018;

  const ramUsagePercentage = Math.min(100, Math.round((estimatedRamGb / currentTier.ramGb) * 100));
  const cpuUsagePercentage = Math.min(100, Math.round((estimatedCpuLoad / currentTier.vCpu) * 100));

  // Cálculo da latência simulada (degradação não-linear após 70% de capacidade)
  let latencyMultiplier = 1.0;
  if (activePousadas > currentTier.warningThresholdPousadas) {
    const overflow = activePousadas - currentTier.warningThresholdPousadas;
    latencyMultiplier = 1.0 + Math.pow(overflow / 20, 1.8);
  }
  const currentEstimatedLatencyMs = Math.round(
    currentTier.estimatedBaselineLatencyMs * latencyMultiplier
  );

  // Determina status
  let status: 'OPTIMAL' | 'WARNING' | 'CRITICAL' = 'OPTIMAL';
  let statusMessage = `Infraestrutura operando com folga (${ramUsagePercentage}% RAM / ${cpuUsagePercentage}% CPU). Latência média de ${currentEstimatedLatencyMs}ms.`;

  if (activePousadas >= currentTier.criticalThresholdPousadas || currentEstimatedLatencyMs > 180) {
    status = 'CRITICAL';
    statusMessage = `ALERTA CRÍTICO: Limite de latência excedido (${currentEstimatedLatencyMs}ms). Risco de timeout em reservas noturnas.`;
  } else if (activePousadas >= currentTier.warningThresholdPousadas || currentEstimatedLatencyMs > 85) {
    status = 'WARNING';
    statusMessage = `ZONA DE ATENÇÃO: Pousadas ativas (${activePousadas}) próximas do limite seguro da ${currentTier.name}. Latência subindo para ${currentEstimatedLatencyMs}ms.`;
  }

  // Define recomendação e próximo tier
  let recommendedTier: VpsTierSpec = currentTier;
  let action: 'MAINTAIN' | 'PREPARE_UPGRADE' | 'MIGRATE_NOW' | 'DOWNGRADE_POSSIBLE' = 'MAINTAIN';
  let reason = 'A VPS atual atende com estabilidade máxima para o volume de pousadas.';

  if (status === 'CRITICAL') {
    action = 'MIGRATE_NOW';
    recommendedTier = getNextTier(currentTierId);
    reason = `Migração imediata para ${recommendedTier.name} necessária para restaurar a latência para ~${recommendedTier.estimatedBaselineLatencyMs}ms.`;
  } else if (status === 'WARNING') {
    action = 'PREPARE_UPGRADE';
    recommendedTier = getNextTier(currentTierId);
    reason = `Planejar migração para ${recommendedTier.name} antes de atingir ${currentTier.criticalThresholdPousadas} pousadas.`;
  }

  const headroomPousadasRemaining = Math.max(0, currentTier.warningThresholdPousadas - activePousadas);
  const estimatedCostImpactBrl = recommendedTier.monthlyCostBrl - currentTier.monthlyCostBrl;

  // Curva de projeção da régua de 10 a 500 pousadas
  const checkpoints = [10, 25, 50, 100, 185, 255, 300, 350, 400, 500];
  const latencyRulerCurve = checkpoints.map((pCount) => {
    let mult = 1.0;
    if (pCount > currentTier.warningThresholdPousadas) {
      const over = pCount - currentTier.warningThresholdPousadas;
      mult = 1.0 + Math.pow(over / 20, 1.8);
    }
    const lat = Math.round(currentTier.estimatedBaselineLatencyMs * mult);
    let zone: 'green' | 'yellow' | 'red' = 'green';
    if (lat > 180 || pCount >= currentTier.criticalThresholdPousadas) zone = 'red';
    else if (lat > 75 || pCount >= currentTier.warningThresholdPousadas) zone = 'yellow';

    return {
      pousadas: pCount,
      projectedLatencyMs: lat,
      zone,
    };
  });

  return {
    currentTier,
    activePousadas,
    currentEstimatedLatencyMs,
    cpuUsagePercentage,
    ramUsageGb: Math.round(estimatedRamGb * 10) / 10,
    ramUsagePercentage,
    status,
    statusMessage,
    recommendation: {
      action,
      suggestedTier: recommendedTier,
      reason,
      headroomPousadasRemaining,
      estimatedCostImpactBrl,
    },
    latencyRulerCurve,
  };
}

function getNextTier(current: HostingerTier): VpsTierSpec {
  switch (current) {
    case 'KVM_1':
      return HOSTINGER_VPS_TIERS.KVM_2;
    case 'KVM_2':
      return HOSTINGER_VPS_TIERS.KVM_4;
    case 'KVM_4':
      return HOSTINGER_VPS_TIERS.KVM_8;
    case 'KVM_8':
    default:
      return HOSTINGER_VPS_TIERS.DEDICATED_CLUSTER;
  }
}
