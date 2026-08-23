// =============================================================================
// 🔐 SEU ZÉLLA — Harness de Teste para Fechaduras Eletrônicas
// =============================================================================
// Este harness provê:
// 1. In-memory DB mock (substitui Prisma) — multitenant, com tenants isolados
// 2. Mock de WhatsApp sender (contador, falhas simuladas)
// 3. Geradores de cenários realistas (pousadas, Airbnb, hóspedes, bookings)
// 4. Helpers de asserção (estatísticas, latências, throughput)
// 5. Utilitários de concorrência (batches, paralelo controlado)
//
// USO:
//   import { LocksTestHarness, generatePousadaScenario } from './helpers/locks-test-harness';
//   const harness = new LocksTestHarness();
//   await harness.seedTenant('pousada-1', 'Pousada Mar Vista', 20);
//   const device = await harness.createDevice('pousada-1', 'suíte-1', 'ttlock');
//   const pin = await harness.generatePin(device.id, { ... });
//
// Os testes que precisam do orquestrador devem usar este harness via vi.mock
// para substituir @/lib/db e @/lib/ddc/auth-utils.
// =============================================================================

import {
  generateRandomPin,
  derivePinStatus,
  calculatePinValidityWindow,
  generateEmergencyPin,
} from '../../src/lib/locks/pin-generator';
import {
  BRAND_CATALOG,
  type LockBrand,
  type LockDeviceData,
  type LockCodeData,
  type LockEventData,
  type CodeStatus,
  type DeviceStatus,
  type ProviderType,
  type CodeType,
  type CodeSource,
  type DeliveryMethod,
} from '../../src/lib/locks/types';

// -----------------------------------------------------------------------------
// Tipos do mock DB
// -----------------------------------------------------------------------------

interface MockLockDevice {
  id: string;
  tenantId: string;
  propertyId: string;
  propertyType: 'pousada' | 'airbnb';
  nickname: string;
  location: string | null;
  brand: LockBrand;
  model: string | null;
  providerType: ProviderType;
  externalDeviceId: string | null;
  oauthAccountId: string | null;
  serialNumber: string | null;
  status: DeviceStatus;
  batteryLevel: number | null;
  online: boolean;
  lastSeenAt: string | null;
  metadata: Record<string, any>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockLockCode {
  id: string;
  deviceId: string;
  tenantId: string;
  guestName: string | null;
  guestPhone: string | null;
  bookingId: string | null;
  code: string;
  codeType: CodeType;
  source: CodeSource;
  validFrom: string;
  validTo: string;
  usedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  deliveredVia: DeliveryMethod | null;
  deliveredAt: string | null;
  status: CodeStatus;
  note: string | null;
  createdAt: string;
}

interface MockLockEvent {
  id: string;
  deviceId: string;
  codeId: string | null;
  tenantId: string;
  eventType: string;
  message: string | null;
  metadata: string;
  createdAt: string;
}

interface MockTenant {
  id: string;
  name: string;
  plan: 'lite' | 'pro' | 'max' | 'parceiro';
  propertyType: 'pousada' | 'airbnb';
  roomCount: number;
  city: string;
  state: string;
}

// -----------------------------------------------------------------------------
// In-memory DB (simula Prisma Client com isolamento por tenant)
// -----------------------------------------------------------------------------

class InMemoryLocksDB {
  tenants: Map<string, MockTenant> = new Map();
  devices: Map<string, MockLockDevice> = new Map();
  codes: Map<string, MockLockCode> = new Map();
  events: Map<string, MockLockEvent> = new Map();
  counters = { device: 0, code: 0, event: 0 };

  reset() {
    this.tenants.clear();
    this.devices.clear();
    this.codes.clear();
    this.events.clear();
    this.counters = { device: 0, code: 0, event: 0 };
  }

  nextId(prefix: 'dev' | 'code' | 'evt'): string {
    if (prefix === 'dev') return `lock-dev-${++this.counters.device}`;
    if (prefix === 'code') return `lock-code-${++this.counters.code}`;
    return `lock-evt-${++this.counters.event}`;
  }
}

// -----------------------------------------------------------------------------
// Mock WhatsApp sender
// -----------------------------------------------------------------------------

interface WhatsAppMockStats {
  sent: number;
  failed: number;
  rateLimited: number;
  invalidPhones: number;
  messages: Array<{ phone: string; text: string; ts: number; tenantId: string }>;
  failureMode: 'none' | 'random-10pct' | 'random-50pct' | 'all-fail' | 'rate-limit-100/sec';
  lastSentWindowStart: number;
  sentInCurrentWindow: number;
}

class WhatsAppMock {
  stats: WhatsAppMockStats = {
    sent: 0,
    failed: 0,
    rateLimited: 0,
    invalidPhones: 0,
    messages: [],
    failureMode: 'none',
    lastSentWindowStart: Date.now(),
    sentInCurrentWindow: 0,
  };

  reset(mode: WhatsAppMockStats['failureMode'] = 'none') {
    this.stats = {
      sent: 0,
      failed: 0,
      rateLimited: 0,
      invalidPhones: 0,
      messages: [],
      failureMode: mode,
      lastSentWindowStart: Date.now(),
      sentInCurrentWindow: 0,
    };
  }

  async send(phone: string, text: string, tenantId: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Validacao basica de telefone
    const clean = phone.replace(/[^\d]/g, '');
    if (clean.length < 10) {
      this.stats.invalidPhones++;
      return { success: false, error: 'Telefone inválido' };
    }

    // Rate limit simulado (100/sec)
    const now = Date.now();
    if (now - this.stats.lastSentWindowStart > 1000) {
      this.stats.lastSentWindowStart = now;
      this.stats.sentInCurrentWindow = 0;
    }
    if (this.stats.failureMode === 'rate-limit-100/sec' && this.stats.sentInCurrentWindow >= 100) {
      this.stats.rateLimited++;
      return { success: false, error: 'Rate limit exceeded (100/sec)' };
    }

    // Failure modes
    if (this.stats.failureMode === 'all-fail') {
      this.stats.failed++;
      return { success: false, error: 'WhatsApp gateway unavailable' };
    }
    if (this.stats.failureMode === 'random-10pct' && Math.random() < 0.1) {
      this.stats.failed++;
      return { success: false, error: 'Random failure (10%)' };
    }
    if (this.stats.failureMode === 'random-50pct' && Math.random() < 0.5) {
      this.stats.failed++;
      return { success: false, error: 'Random failure (50%)' };
    }

    this.stats.sent++;
    this.stats.sentInCurrentWindow++;
    this.stats.messages.push({ phone, text, ts: now, tenantId });

    // Pequeno delay para simular latência realista (5-15ms)
    await new Promise((r) => setTimeout(r, 5 + Math.random() * 10));

    return { success: true, messageId: `wa-msg-${this.stats.sent}` };
  }
}

// -----------------------------------------------------------------------------
// Harness principal
// -----------------------------------------------------------------------------

export class LocksTestHarness {
  db: InMemoryLocksDB = new InMemoryLocksDB();
  whatsapp: WhatsAppMock = new WhatsAppMock();
  activeTenantId: string | null = null;

  /** Reseta o estado do harness para um novo teste. */
  reset(whatsappFailureMode: WhatsAppMockStats['failureMode'] = 'none') {
    this.db.reset();
    this.whatsapp.reset(whatsappFailureMode);
    this.activeTenantId = null;
  }

  /** Define o tenant ativo (simula resolveTenantId). */
  setTenant(tenantId: string) {
    this.activeTenantId = tenantId;
  }

  /** Cria um tenant (pousada ou airbnb) com N quartos/imóveis. */
  seedTenant(
    id: string,
    name: string,
    roomCount: number,
    propertyType: 'pousada' | 'airbnb' = 'pousada',
    plan: MockTenant['plan'] = 'pro',
    city = 'Ubatuba',
    state = 'SP',
  ): MockTenant {
    const tenant: MockTenant = { id, name, plan, propertyType, roomCount, city, state };
    this.db.tenants.set(id, tenant);
    return tenant;
  }

  /** Cria um dispositivo de fechadura associado a um tenant e property. */
  createDevice(
    tenantId: string,
    propertyId: string,
    brand: LockBrand,
    options: {
      propertyType?: 'pousada' | 'airbnb';
      nickname?: string;
      model?: string;
      providerType?: ProviderType;
      batteryLevel?: number;
      online?: boolean;
      status?: DeviceStatus;
      location?: string;
    } = {},
  ): MockLockDevice {
    const tenant = this.db.tenants.get(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not seeded`);
    const info = BRAND_CATALOG[brand];
    if (!info) throw new Error(`Unknown brand: ${brand}`);

    const now = new Date().toISOString();
    const device: MockLockDevice = {
      id: this.db.nextId('dev'),
      tenantId,
      propertyId,
      propertyType: options.propertyType ?? tenant.propertyType,
      nickname: options.nickname ?? `Fechadura ${brand}-${this.db.devices.size + 1}`,
      location: options.location ?? null,
      brand,
      model: options.model ?? info.popularModels[0] ?? null,
      providerType: options.providerType ?? info.providerType,
      externalDeviceId: null,
      oauthAccountId: null,
      serialNumber: `SN-${brand}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: options.status ?? 'active',
      batteryLevel: options.batteryLevel ?? 80 + Math.floor(Math.random() * 20),
      online: options.online ?? true,
      lastSeenAt: now,
      metadata: {},
      notes: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.devices.set(device.id, device);
    return device;
  }

  /** Gera um PIN para um dispositivo — simula o orquestrador real. */
  async generatePin(
    deviceId: string,
    options: {
      guestName?: string;
      guestPhone?: string;
      bookingId?: string;
      checkInDate: string;
      checkOutDate: string;
      checkInTime?: string;
      checkOutTime?: string;
      manualPin?: string;
      autoGenerate?: boolean;
      note?: string;
      sendWhatsApp?: boolean;
    },
  ): Promise<{ code: MockLockCode; delivered: boolean; warnings: string[] }> {
    const device = this.db.devices.get(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);

    const { validFrom, validTo } = calculatePinValidityWindow(
      options.checkInDate,
      options.checkOutDate,
      options.checkInTime ?? '14:00',
      options.checkOutTime ?? '11:00',
    );

    // Gera ou aceita o PIN
    // Ordem de prioridade:
    //   1. manualPin fornecido → usa esse PIN (host já gerou no app da marca)
    //   2. Brand com API disponível → simula chamada de API (source='api')
    //   3. autoGenerate=true → gera PIN criptográfico (source='manual', warning)
    //   4. Caso contrário → erro
    let pin: string;
    let source: CodeSource;
    let codeType: CodeType;
    const warnings: string[] = [];
    const usesHash = ['ttlock', 'igloohome'].includes(device.brand);
    const info = BRAND_CATALOG[device.brand];

    if (options.manualPin && options.manualPin.trim().length >= 4) {
      pin = options.manualPin.trim();
      if (usesHash && !pin.endsWith('#')) pin = `${pin}#`;
      source = 'manual';
      codeType = device.brand === 'igloohome' ? 'offline_pin' : 'manual';
    } else if (info && info.apiAvailable) {
      // Brand tem API → simula chamada de API
      pin = generateRandomPin(6, usesHash ? '#' : '');
      source = 'api';
      codeType = 'online_pin';
    } else if (options.autoGenerate) {
      pin = generateRandomPin(6, usesHash ? '#' : '');
      source = 'manual';
      codeType = device.brand === 'igloohome' ? 'offline_pin' : 'manual';
      warnings.push(`PIN gerado automaticamente (${pin}) — cadastre no app da marca.`);
    } else {
      throw new Error('PIN manual ou autoGenerate obrigatório para marcas sem API');
    }

    const status = derivePinStatus({ validFrom, validTo });
    const now = new Date().toISOString();

    const code: MockLockCode = {
      id: this.db.nextId('code'),
      deviceId,
      tenantId: device.tenantId,
      guestName: options.guestName ?? null,
      guestPhone: options.guestPhone ?? null,
      bookingId: options.bookingId ?? null,
      code: pin,
      codeType,
      source,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      usedAt: null,
      revokedAt: null,
      revokedReason: null,
      deliveredVia: null,
      deliveredAt: null,
      status,
      note: options.note ?? null,
      createdAt: now,
    };
    this.db.codes.set(code.id, code);

    // Evento de auditoria
    this.db.events.set(this.db.nextId('evt'), {
      id: this.db.nextId('evt'),
      deviceId,
      codeId: code.id,
      tenantId: device.tenantId,
      eventType: 'generated',
      message: `PIN ${source === 'api' ? 'gerado via API' : 'gerado manualmente'} para ${options.guestName ?? 'hóspede'}`,
      metadata: JSON.stringify({ validFrom: validFrom.toISOString(), validTo: validTo.toISOString(), codeType, source }),
      createdAt: now,
    });

    // Entrega via WhatsApp
    let delivered = false;
    if (options.sendWhatsApp && options.guestPhone) {
      const result = await this.whatsapp.send(options.guestPhone, `PIN: ${pin}`, device.tenantId);
      delivered = result.success;
      if (delivered) {
        code.deliveredVia = 'whatsapp';
        code.deliveredAt = new Date().toISOString();
        this.db.events.set(this.db.nextId('evt'), {
          id: this.db.nextId('evt'),
          deviceId,
          codeId: code.id,
          tenantId: device.tenantId,
          eventType: 'delivered',
          message: `PIN enviado via WhatsApp para ${options.guestName ?? options.guestPhone}`,
          metadata: JSON.stringify({ method: 'whatsapp' }),
          createdAt: new Date().toISOString(),
        });
      } else {
        warnings.push(`WhatsApp falhou: ${result.error}`);
        this.db.events.set(this.db.nextId('evt'), {
          id: this.db.nextId('evt'),
          deviceId,
          codeId: code.id,
          tenantId: device.tenantId,
          eventType: 'failed',
          message: `Falha no envio WhatsApp: ${result.error}`,
          metadata: JSON.stringify({ error: result.error }),
          createdAt: new Date().toISOString(),
        });
      }
    } else if (options.sendWhatsApp && !options.guestPhone) {
      warnings.push('Hóspede sem telefone — PIN disponível apenas para copiar');
    }

    return { code, delivered, warnings };
  }

  /** Revoga um PIN específico. */
  revokePin(pinId: string, reason: string): boolean {
    const code = this.db.codes.get(pinId);
    if (!code) return false;
    const now = new Date().toISOString();
    code.revokedAt = now;
    code.revokedReason = reason;
    code.status = 'revoked';
    this.db.codes.set(pinId, code);

    this.db.events.set(this.db.nextId('evt'), {
      id: this.db.nextId('evt'),
      deviceId: code.deviceId,
      codeId: pinId,
      tenantId: code.tenantId,
      eventType: 'revoked',
      message: `PIN revogado: ${reason}`,
      metadata: JSON.stringify({ reason }),
      createdAt: now,
    });
    return true;
  }

  /** PÂNICO: revoga TODOS os PINs ativos de um dispositivo. */
  panicRevokeAllPins(deviceId: string, reason: string = 'Pânico acionado'): number {
    const device = this.db.devices.get(deviceId);
    if (!device) return 0;

    let count = 0;
    const now = new Date().toISOString();
    for (const code of Array.from(this.db.codes.values())) {
      if (code.deviceId === deviceId && !code.revokedAt) {
        code.revokedAt = now;
        code.revokedReason = reason;
        code.status = 'revoked';
        this.db.codes.set(code.id, code);
        count++;
      }
    }

    this.db.events.set(this.db.nextId('evt'), {
      id: this.db.nextId('evt'),
      deviceId,
      codeId: null,
      tenantId: device.tenantId,
      eventType: 'panic_revoke',
      message: `PÂNICO: ${count} PIN(s) revogado(s) — ${reason}`,
      metadata: JSON.stringify({ reason, count }),
      createdAt: now,
    });
    return count;
  }

  /** Marca um PIN como usado. */
  markPinUsed(pinId: string): boolean {
    const code = this.db.codes.get(pinId);
    if (!code) return false;
    code.usedAt = new Date().toISOString();
    code.status = 'used';
    this.db.codes.set(pinId, code);

    this.db.events.set(this.db.nextId('evt'), {
      id: this.db.nextId('evt'),
      deviceId: code.deviceId,
      codeId: pinId,
      tenantId: code.tenantId,
      eventType: 'used',
      message: `PIN utilizado na fechadura`,
      metadata: JSON.stringify({}),
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  /** Atualiza status/bateria de um dispositivo (simula sync do provider). */
  updateDeviceStatus(deviceId: string, updates: Partial<Pick<MockLockDevice, 'status' | 'batteryLevel' | 'online'>>): void {
    const device = this.db.devices.get(deviceId);
    if (!device) return;
    if (updates.status !== undefined) device.status = updates.status;
    if (updates.batteryLevel !== undefined) device.batteryLevel = updates.batteryLevel;
    if (updates.online !== undefined) device.online = updates.online;
    device.updatedAt = new Date().toISOString();
    this.db.devices.set(deviceId, device);

    // Dispara evento de bateria fraca
    if (updates.batteryLevel !== undefined && updates.batteryLevel !== null && updates.batteryLevel < 20) {
      this.db.events.set(this.db.nextId('evt'), {
        id: this.db.nextId('evt'),
        deviceId,
        codeId: null,
        tenantId: device.tenantId,
        eventType: 'battery_low',
        message: `Bateria fraca: ${updates.batteryLevel}%`,
        metadata: JSON.stringify({ level: updates.batteryLevel }),
        createdAt: new Date().toISOString(),
      });
    }
  }

  /** Re-deriva o status de todos os PINs (baseado no tempo atual). */
  refreshAllPinStatuses(): void {
    const now = new Date();
    for (const code of Array.from(this.db.codes.values())) {
      if (code.revokedAt) {
        code.status = 'revoked';
      } else if (code.usedAt) {
        code.status = 'used';
      } else if (now < new Date(code.validFrom)) {
        code.status = 'scheduled';
      } else if (now > new Date(code.validTo)) {
        code.status = 'expired';
      } else {
        code.status = 'active';
      }
    }
  }

  /** Conta PINs ativos de um dispositivo (agora está dentro da janela de validade). */
  countActivePins(deviceId: string): number {
    let count = 0;
    const now = new Date();
    for (const code of Array.from(this.db.codes.values())) {
      if (code.deviceId !== deviceId) continue;
      if (code.revokedAt) continue;
      if (now < new Date(code.validFrom) || now > new Date(code.validTo)) continue;
      count++;
    }
    return count;
  }

  /** Conta PINs não-revogados de um dispositivo (independente de scheduled/active/expired). */
  countNonRevokedPins(deviceId: string): number {
    let count = 0;
    for (const code of Array.from(this.db.codes.values())) {
      if (code.deviceId !== deviceId) continue;
      if (code.revokedAt) continue;
      count++;
    }
    return count;
  }

  /** Lista todos os PINs de um tenant (todas as marcas). */
  listPinsByTenant(tenantId: string): MockLockCode[] {
    return Array.from(this.db.codes.values()).filter((c) => c.tenantId === tenantId);
  }

  /** Lista eventos de auditoria de um tenant. */
  listEventsByTenant(tenantId: string, eventType?: string): MockLockEvent[] {
    return Array.from(this.db.events.values())
      .filter((e) => e.tenantId === tenantId && (!eventType || e.eventType === eventType))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
}

// -----------------------------------------------------------------------------
// Geradores de cenários realistas
// -----------------------------------------------------------------------------

const FIRST_NAMES = [
  'João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Juliana', 'Lucas', 'Fernanda',
  'Rafael', 'Camila', 'Bruno', 'Patrícia', 'Marcelo', 'Beatriz', 'Ricardo',
  'Letícia', 'Felipe', 'Amanda', 'Gustavo', 'Carla', 'Rodrigo', 'Vanessa',
  'Eduardo', 'Tatiane', 'Thiago', 'Priscila', 'Marcos', 'Larissa', 'Vinícius', 'Sandra',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira',
  'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Gomes', 'Martins', 'Araújo',
  'Barbosa', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes', 'Cardoso', 'Teixeira',
];

const POUSADA_PREFIXES = [
  'Pousada', 'Recanto', 'Casa', 'Chalé', 'Vila', 'Mirante', 'Aconchego', 'Paraíso',
  'Vista', 'Maré', 'Luar', 'Sol', 'Areia', 'Onda', 'Coqueiro', 'Farol',
];

const POUSADA_SUFFIXES = [
  'do Mar', 'da Serra', 'do Sol', 'da Lua', 'das Conchas', 'do Forno', 'do Pescador',
  'das Águas', 'do Fortim', 'da Praia', 'do Mangue', 'da Pedra', 'da Ilha',
];

const AIRBNB_NAMES: string[] = [
  'Loft Centro', 'Apto Beira Mar', 'Casa de Praia', 'Studio Pinheira', 'Chalé Montanha',
  'Flat Jardins', 'Cobertura Vista', 'Bangalô Imperial', 'Suite Garden', 'Refúgio Verde',
];

const CITIES_BR: Array<{ city: string; state: string }> = [
  { city: 'Ubatuba', state: 'SP' },
  { city: 'Paraty', state: 'RJ' },
  { city: 'Florianópolis', state: 'SC' },
  { city: 'Búzios', state: 'RJ' },
  { city: 'Maragogi', state: 'AL' },
  { city: 'Porto de Galinhas', state: 'PE' },
  { city: 'Jericoacoara', state: 'CE' },
  { city: 'Morro de São Paulo', state: 'BA' },
  { city: 'Trancoso', state: 'BA' },
  { city: 'Campos do Jordão', state: 'SP' },
  { city: 'Gramado', state: 'RS' },
  { city: 'Canela', state: 'RS' },
  { city: 'Capitólio', state: 'MG' },
  { city: 'Maresias', state: 'SP' },
  { city: 'Ilhabela', state: 'SP' },
];

const BRANDS_BY_SEGMENT: Record<'pousada' | 'airbnb', LockBrand[]> = {
  pousada: ['intelbras', 'ttlock', 'papaiz', 'yale', 'philco', 'igloohome'],
  airbnb: ['ttlock', 'igloohome', 'nuki', 'august', 'tuya', 'samsung'],
};

const ALL_BRANDS: LockBrand[] = [
  'ttlock', 'tuya', 'igloohome', 'nuki', 'august',
  'intelbras', 'yale', 'papaiz', 'philco', 'samsung',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone(): string {
  const ddd = randomItem(['11', '21', '31', '41', '51', '61', '71', '81', '85', '19', '22', '24']);
  const part1 = String(Math.floor(Math.random() * 9000) + 1000);
  const part2 = String(Math.floor(Math.random() * 9000) + 1000);
  return `+55${ddd}9${part1}${part2}`;
}

function randomGuestName(): string {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

function randomPousadaName(): string {
  return `${randomItem(POUSADA_PREFIXES)} ${randomItem(POUSADA_SUFFIXES)}`;
}

/** Gera uma data YYYY-MM-DD N dias a partir de hoje. */
function dateFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// Cenários realistas —/devolvem configs prontas para popular o harness
// -----------------------------------------------------------------------------

export interface ScenarioTenant {
  tenant: MockTenant;
  devices: Array<{ device: MockLockDevice; bookings: Array<{ guestName: string; guestPhone: string; checkIn: string; checkOut: string; bookingId: string }> }>;
}

/** Gera um cenário completo de 1 pousada com N quartos, cada um com K bookings futuros. */
export function generatePousadaScenario(
  tenantId: string,
  roomCount: number,
  bookingsPerRoom: number,
  options: { city?: string; state?: string; name?: string; plan?: MockTenant['plan'] } = {},
): ScenarioTenant {
  const cityInfo = randomItem(CITIES_BR);
  const tenant = {
    id: tenantId,
    name: options.name ?? randomPousadaName(),
    plan: options.plan ?? 'pro',
    propertyType: 'pousada' as const,
    roomCount,
    city: options.city ?? cityInfo.city,
    state: options.state ?? cityInfo.state,
  };

  const devices: ScenarioTenant['devices'] = [];
  for (let r = 0; r < roomCount; r++) {
    const brand = randomItem(BRANDS_BY_SEGMENT.pousada);
    const device = makeDeviceRecord(tenantId, `room-${r + 1}`, brand, 'pousada', `Suíte ${String.fromCharCode(65 + (r % 26))}${Math.floor(r / 26) + 1}`);

    const bookings: ScenarioTenant['devices'][0]['bookings'] = [];
    for (let b = 0; b < bookingsPerRoom; b++) {
      const checkInOffset = b * 3 + 1; // 1, 4, 7, 10 dias a partir de hoje
      bookings.push({
        guestName: randomGuestName(),
        guestPhone: randomPhone(),
        checkIn: dateFromNow(checkInOffset),
        checkOut: dateFromNow(checkInOffset + 2), // 2 diárias
        bookingId: `BK-${tenantId}-${r}-${b}`,
      });
    }
    devices.push({ device, bookings });
  }

  return { tenant, devices };
}

/** Gera um cenário completo de 1 host Airbnb com N imóveis, K bookings cada. */
export function generateAirbnbScenario(
  tenantId: string,
  propertyCount: number,
  bookingsPerProperty: number,
): ScenarioTenant {
  const cityInfo = randomItem(CITIES_BR);
  const tenant = {
    id: tenantId,
    name: `Host Airbnb ${tenantId}`,
    plan: 'max' as const,
    propertyType: 'airbnb' as const,
    roomCount: propertyCount,
    city: cityInfo.city,
    state: cityInfo.state,
  };

  const devices: ScenarioTenant['devices'] = [];
  for (let p = 0; p < propertyCount; p++) {
    const brand = randomItem(BRANDS_BY_SEGMENT.airbnb);
    const device = makeDeviceRecord(tenantId, `airbnb-prop-${p + 1}`, brand, 'airbnb', randomItem(AIRBNB_NAMES));

    const bookings: ScenarioTenant['devices'][0]['bookings'] = [];
    for (let b = 0; b < bookingsPerProperty; b++) {
      const checkInOffset = b * 5 + 2;
      bookings.push({
        guestName: randomGuestName(),
        guestPhone: randomPhone(),
        checkIn: dateFromNow(checkInOffset),
        checkOut: dateFromNow(checkInOffset + 3), // 3 diárias
        bookingId: `BK-${tenantId}-${p}-${b}`,
      });
    }
    devices.push({ device, bookings });
  }

  return { tenant, devices };
}

function makeDeviceRecord(
  tenantId: string,
  propertyId: string,
  brand: LockBrand,
  propertyType: 'pousada' | 'airbnb',
  nickname: string,
): MockLockDevice {
  const info = BRAND_CATALOG[brand];
  const now = new Date().toISOString();
  return {
    id: `lock-dev-${tenantId}-${propertyId}-${brand}`,
    tenantId,
    propertyId,
    propertyType,
    nickname,
    location: 'Porta frontal',
    brand,
    model: info.popularModels[0] ?? null,
    providerType: info.providerType,
    externalDeviceId: null,
    oauthAccountId: null,
    serialNumber: `SN-${brand}-${Math.random().toString(36).slice(2, 10)}`,
    status: 'active',
    batteryLevel: 60 + Math.floor(Math.random() * 40),
    online: Math.random() > 0.1,
    lastSeenAt: now,
    metadata: {},
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Popula o harness com um cenário (pousada ou airbnb). */
export function seedScenario(harness: LocksTestHarness, scenario: ScenarioTenant): void {
  harness.db.tenants.set(scenario.tenant.id, scenario.tenant);
  for (const { device } of scenario.devices) {
    harness.db.devices.set(device.id, device);
  }
}

// -----------------------------------------------------------------------------
// Utilitários de concorrência
// -----------------------------------------------------------------------------

/** Executa N tarefas em paralelo com limite de concorrência. */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= tasks.length) break;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Mede latências de um lote de operações. */
export function measureLatencies<T>(results: Array<{ startedAt: number; endedAt: number; result: T }>): {
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
} {
  const latencies = results.map((r) => r.endedAt - r.startedAt).sort((a, b) => a - b);
  const totalMs = latencies.reduce((a, b) => a + b, 0);
  const pick = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];

  return {
    count: latencies.length,
    totalMs,
    avgMs: totalMs / latencies.length,
    minMs: latencies[0] ?? 0,
    maxMs: latencies[latencies.length - 1] ?? 0,
    p50Ms: pick(0.5),
    p95Ms: pick(0.95),
    p99Ms: pick(0.99),
  };
}

/** Calcula throughput (ops/sec). */
export function throughput(count: number, durationMs: number): number {
  if (durationMs === 0) return 0;
  return (count / durationMs) * 1000;
}

// -----------------------------------------------------------------------------
// Exportações utilitárias
// -----------------------------------------------------------------------------

export {
  ALL_BRANDS,
  BRANDS_BY_SEGMENT,
  CITIES_BR,
  randomItem,
  randomPhone,
  randomGuestName,
  randomPousadaName,
  dateFromNow,
};

export type {
  MockTenant,
  MockLockDevice,
  MockLockCode,
  MockLockEvent,
};

// Re-exports para conveniência
export {
  generateRandomPin,
  derivePinStatus,
  calculatePinValidityWindow,
  generateEmergencyPin,
};

export type {
  LockBrand,
  LockDeviceData,
  LockCodeData,
  LockEventData,
  CodeStatus,
  DeviceStatus,
  ProviderType,
  CodeType,
  CodeSource,
  DeliveryMethod,
};
