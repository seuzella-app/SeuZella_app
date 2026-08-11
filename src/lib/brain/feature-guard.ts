import { Plan } from '@prisma/client';

export type Feature =
  | 'IA_PERSONA'
  | 'SUPPLIER_MANAGEMENT'
  | 'ADVANCED_REPORTS'
  | 'WHATSAPP_LEARNING'
  | 'COMMISSION_DISCOUNT';

const PLAN_FEATURES: Record<Plan, Feature[]> = {
  LITE: ['COMMISSION_DISCOUNT'],
  PRO: ['COMMISSION_DISCOUNT', 'IA_PERSONA', 'WHATSAPP_LEARNING', 'ADVANCED_REPORTS'],
  MAX: ['COMMISSION_DISCOUNT', 'IA_PERSONA', 'WHATSAPP_LEARNING', 'ADVANCED_REPORTS', 'SUPPLIER_MANAGEMENT'],
  PARCEIRO: ['COMMISSION_DISCOUNT'],
};

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

export function getPlanName(plan: Plan): string {
  const names: Record<Plan, string> = {
    LITE: 'Secretaria Lite',
    PRO: 'Secretaria Pro',
    MAX: 'Secretaria Max',
    PARCEIRO: 'Parceiro',
  };
  return names[plan];
}
