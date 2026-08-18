// =============================================================================
// 🔐 SEU ZÉLLA — Tipos do Sistema de Fechaduras Eletrônicas
// =============================================================================
// Catálogo de marcas reais do mercado brasileiro + tipos compartilhados entre
// orchestrator, providers e UI.
// =============================================================================

/** Marcas suportadas pelo Zélla — alinhadas ao mercado brasileiro real. */
export type LockBrand =
  | 'ttlock'      // ~30-40% do mercado BR (MercadoLivre: Mecfree, Liftlov, Hofor…)
  | 'tuya'        // ~20-25% (muitas marcas chinesas usam Tuya/Smart Life)
  | 'igloohome'   // 5-10% (Airbnb premium BR — único com PIN offline real)
  | 'nuki'        // 1-3% (premium Airbnb — Nuki Smart Lock 3.0/4.0 Pro)
  | 'august'      // <1% (Yale Assure Lock 2 usa API August)
  | 'intelbras'   // 15-20% (líder em pousadas — IFR 1000, FR 1100/1200/1400)
  | 'yale'        // 5-10% (premium — YDM 4109, YDM 7100A, Assure Lock 2)
  | 'papaiz'      // 5-10% (brasileira tradicional — Eletronika FR 100/200)
  | 'philco'      // 2-5% (PH200S, PH300S)
  | 'samsung';    // 1-3% (SHP-DP609, SHP-DH538 via SmartThings)

/** Tipo de integração com a marca. */
export type ProviderType = 'api' | 'manual';

/** Tipo de código PIN gerado. */
export type CodeType = 'online_pin' | 'offline_pin' | 'manual' | 'qrcode';

/** Origem do código: gerado via API oficial ou colado pelo host. */
export type CodeSource = 'api' | 'manual';

/** Como o PIN foi entregue ao hóspede. */
export type DeliveryMethod = 'whatsapp' | 'email' | 'copy' | 'none';

/** Status do PIN — derivado das datas validFrom/validTo/revokedAt/usedAt. */
export type CodeStatus = 'scheduled' | 'active' | 'used' | 'expired' | 'revoked';

/** Status operacional do dispositivo. */
export type DeviceStatus = 'active' | 'inactive' | 'offline' | 'error';

/** Interface canônica de um dispositivo de fechadura. */
export interface LockDeviceData {
  id: string;
  tenantId: string;
  propertyId: string;
  propertyType: 'pousada' | 'airbnb';
  nickname: string;
  location?: string | null;
  brand: LockBrand;
  model?: string | null;
  providerType: ProviderType;
  externalDeviceId?: string | null;
  oauthAccountId?: string | null;
  serialNumber?: string | null;
  status: DeviceStatus;
  batteryLevel?: number | null;
  online: boolean;
  lastSeenAt?: string | null;
  metadata: Record<string, any>;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Estatísticas derivadas (preenchidas pela API)
  _count?: {
    codes: number;
    activeCodes: number;
  };
}

/** Interface canônica de um PIN gerado. */
export interface LockCodeData {
  id: string;
  deviceId: string;
  tenantId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  bookingId?: string | null;
  code: string;
  codeType: CodeType;
  source: CodeSource;
  validFrom: string;
  validTo: string;
  usedAt?: string | null;
  revokedAt?: string | null;
  revokedReason?: string | null;
  deliveredVia?: DeliveryMethod | null;
  deliveredAt?: string | null;
  status: CodeStatus;
  note?: string | null;
  createdAt: string;
  // Dados do dispositivo relacionado (para listagem combinada)
  device?: {
    id: string;
    nickname: string;
    brand: LockBrand;
    propertyType: string;
    propertyId: string;
  };
}

/** Interface para eventos de auditoria. */
export interface LockEventData {
  id: string;
  deviceId: string;
  codeId?: string | null;
  eventType:
    | 'generated'
    | 'delivered'
    | 'used'
    | 'revoked'
    | 'expired'
    | 'failed'
    | 'panic_revoke'
    | 'battery_low'
    | 'status_change';
  metadata: Record<string, any>;
  message?: string | null;
  createdAt: string;
}

/** Payload para criar um novo dispositivo. */
export interface CreateLockDeviceInput {
  propertyId: string;
  propertyType: 'pousada' | 'airbnb';
  nickname: string;
  location?: string;
  brand: LockBrand;
  model?: string;
  providerType: ProviderType;
  serialNumber?: string;
  externalDeviceId?: string;
  oauthAccountId?: string;
  notes?: string;
}

/** Payload para gerar um novo PIN. */
export interface GeneratePinInput {
  deviceId: string;
  guestName?: string;
  guestPhone?: string;
  bookingId?: string;
  // Janela de validade — padrão: 14:00 do check-in → 11:00 do check-out
  validFrom: Date;
  validTo: Date;
  // Para marcas manuais: PIN colado pelo host
  manualPin?: string;
  // Para marcas com API: gerar automaticamente
  autoGenerate?: boolean;
  note?: string;
}

/** Resultado da geração de PIN. */
export interface GeneratePinResult {
  code: LockCodeData;
  delivered: boolean;
  deliveryMethod?: DeliveryMethod;
  warnings?: string[];
}

/** Catálogo estático: cada marca com suas capacidades reais. */
export interface BrandCatalogEntry {
  id: LockBrand;
  label: string;
  logo?: string; // Emoji ou URL — usado na UI
  providerType: ProviderType;
  apiAvailable: boolean;
  offlinePinSupported: boolean;
  popularModels: string[];
  marketShareBR: string; // string amigável para exibir na UI
  notes: string;
  // Cor do badge na UI
  color: string;
}

/**
 * Catálogo de marcas — VERDADE TÉCNICA do mercado brasileiro.
 * Esta é a fonte canônica que a UI e o orquestrador consultam.
 */
export const BRAND_CATALOG: Record<LockBrand, BrandCatalogEntry> = {
  ttlock: {
    id: 'ttlock',
    label: 'TTLock',
    logo: '🔑',
    providerType: 'api',
    apiAvailable: true,
    offlinePinSupported: true,
    popularModels: ['TTLock X15', 'TTLock X20', 'TTLock Saíma A30', 'Mecfree X6', 'Liftlov T1'],
    marketShareBR: '30-40% (líder em volume no MercadoLivre)',
    notes: 'API OAuth2 oficial em open.ttlock.com. Suporta PIN online e offline (algoritmo do fabricante). Maior base instalada no Brasil via marcas white-label.',
    color: 'emerald',
  },
  tuya: {
    id: 'tuya',
    label: 'Tuya / Smart Life',
    logo: '🌐',
    providerType: 'api',
    apiAvailable: true,
    offlinePinSupported: false,
    popularModels: ['Tuya Smart Lock Z3', 'Smart Life SL-01', 'Philips Easy Key (Tuya OEM)'],
    marketShareBR: '20-25% (muitas marcas chinesas)',
    notes: 'API OAuth2 oficial em iot.tuya.com (Cloud API). Suporta PIN online temporário. Não suporta PIN offline ( requer Wi-Fi sempre ativo).',
    color: 'blue',
  },
  igloohome: {
    id: 'igloohome',
    label: 'Igloohome',
    logo: '🏔️',
    providerType: 'api',
    apiAvailable: true,
    offlinePinSupported: true,
    popularModels: ['Igloohome Deadbolt 2S', 'Igloohome Mortise 2', 'Igloo Keybox 3'],
    marketShareBR: '5-10% (Airbnb premium)',
    notes: 'ÚNICA marca com PIN offline real via algoritmo do fabricante (não precisa de Wi-Fi na porta). API OAuth2 oficial em api.igloohome.io. Preferida por anfitriões Airbnb de alto padrão.',
    color: 'purple',
  },
  nuki: {
    id: 'nuki',
    label: 'Nuki',
    logo: '🚪',
    providerType: 'api',
    apiAvailable: true,
    offlinePinSupported: false,
    popularModels: ['Nuki Smart Lock 3.0', 'Nuki Smart Lock 4.0 Pro', 'Nuki Keypad 2.0'],
    marketShareBR: '1-3% (premium Airbnb)',
    notes: 'API OAuth2 oficial em developer.nuki.io. PIN gerado no Keypad via API. Único que permite abertura remota real (com confirmação no app).',
    color: 'rose',
  },
  august: {
    id: 'august',
    label: 'August / Yale Assure 2',
    logo: '🏠',
    providerType: 'api',
    apiAvailable: true,
    offlinePinSupported: false,
    popularModels: ['August Wi-Fi Smart Lock', 'Yale Assure Lock 2', 'Yale Assure Lock SL'],
    marketShareBR: '<1% (Yale Assure 2 usa API August)',
    notes: 'API não-oficial mas estável. Yale Assure Lock 2 (linha 2023+) usa o backend August — funciona via mesma integração.',
    color: 'amber',
  },
  intelbras: {
    id: 'intelbras',
    label: 'Intelbras',
    logo: '🇧🇷',
    providerType: 'manual',
    apiAvailable: false,
    offlinePinSupported: true,
    popularModels: ['Intelbras IFR 1000', 'Intelbras FR 1100', 'Intelbras FR 1200', 'Intelbras FR 1400'],
    marketShareBR: '15-20% (líder em pousadas)',
    notes: 'Não tem API pública (1LOCK é só para parceiros comerciais). PIN é gerado no app Intelbras e colado no Zélla. Líder absoluto em pousadas brasileiras.',
    color: 'emerald',
  },
  yale: {
    id: 'yale',
    label: 'Yale',
    logo: '🔐',
    providerType: 'manual',
    apiAvailable: false,
    offlinePinSupported: true,
    popularModels: ['Yale YDM 4109', 'Yale YDM 7100A', 'Yale YDM 3169', 'Yale Linus Smart Lock'],
    marketShareBR: '5-10% (premium)',
    notes: 'YDM (linha tradicional) NÃO tem API pública. PIN é gerado no app Yale Access e colado no Zélla. Apenas Yale Assure Lock 2 tem API (via August).',
    color: 'amber',
  },
  papaiz: {
    id: 'papaiz',
    label: 'Papaiz',
    logo: '🛡️',
    providerType: 'manual',
    apiAvailable: false,
    offlinePinSupported: true,
    popularModels: ['Papaiz Eletronika FR 100', 'Papaiz Eletronika FR 200', 'Papaiz Bio'],
    marketShareBR: '5-10% (brasileira tradicional)',
    notes: 'Marca brasileira tradicional, sem API. PIN gerado no app Papaiz e colado no Zélla. Muito usada em pousadas de interior.',
    color: 'emerald',
  },
  philco: {
    id: 'philco',
    label: 'Philco',
    logo: '📺',
    providerType: 'manual',
    apiAvailable: false,
    offlinePinSupported: true,
    popularModels: ['Philco PH200S', 'Philco PH300S', 'Philco PH500'],
    marketShareBR: '2-5%',
    notes: 'Sem API pública. PIN gerado no app Philco Home e colado no Zélla.',
    color: 'blue',
  },
  samsung: {
    id: 'samsung',
    label: 'Samsung',
    logo: '📱',
    providerType: 'manual',
    apiAvailable: false,
    offlinePinSupported: true,
    popularModels: ['Samsung SHP-DP609', 'Samsung SHP-DH538', 'Samsung SHP-DP500'],
    marketShareBR: '1-3% (via SmartThings)',
    notes: 'Integração via SmartThings API é complexa e instável. Por ora, tratada como manual (PIN gerado no app SmartThings e colado no Zélla).',
    color: 'blue',
  },
};

/** Lista todas as marcas para exibição na UI. */
export function listAllBrands(): BrandCatalogEntry[] {
  return Object.values(BRAND_CATALOG);
}

/** Lista apenas marcas com API disponível. */
export function listApiBrands(): BrandCatalogEntry[] {
  return Object.values(BRAND_CATALOG).filter((b) => b.apiAvailable);
}

/** Lista apenas marcas manuais (sem API). */
export function listManualBrands(): BrandCatalogEntry[] {
  return Object.values(BRAND_CATALOG).filter((b) => !b.apiAvailable);
}

/** Obtém info de uma marca específica. */
export function getBrandInfo(brand: string): BrandCatalogEntry | null {
  return BRAND_CATALOG[brand as LockBrand] ?? null;
}
