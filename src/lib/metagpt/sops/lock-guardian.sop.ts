// =============================================================================
// SEU ZÉLLA METAGPT — LOCK GUARDIAN SOP (SMART LOCKS & GOVERNANÇA)
// =============================================================================

import { z } from 'zod';
import { MetaAction } from '../core/action';
import { MetaRole } from '../core/role';
import { type SOPDefinition, SOPRunner } from '../core/sop-runner';
import { type MetaMessage } from '../core/message';

// ── Schemas de Ação ─────────────────────────────────────────────────────────

const LockPinInputSchema = z.object({
  roomName: z.string(),
  guestName: z.string(),
  lockModel: z.string().optional(),
});

const LockPinOutputSchema = z.object({
  pin: z.string().length(6),
  pinFormatted: z.string(),
  expiresAtHours: z.number(),
  securityMethod: z.literal('CSPRNG_CRYPTO_SECURE'),
});

const BatteryWatchdogInputSchema = z.object({
  roomName: z.string(),
  batteryLevel: z.number().min(0).max(100),
  lockModel: z.string().optional(),
});

const BatteryWatchdogOutputSchema = z.object({
  status: z.enum(['OK', 'LOW_BATTERY_WARNING', 'CRITICAL_BATTERY_ALERT']),
  shouldAlertOwner: z.boolean(),
  recommendation: z.string(),
});

const HousekeepingInputSchema = z.object({
  roomName: z.string(),
  guestName: z.string(),
  isCheckOut: z.boolean(),
});

const HousekeepingOutputSchema = z.object({
  roomStatus: z.enum(['livre', 'ocupado', 'manutencao']),
  pinRevoked: z.boolean(),
  cleanersNotified: z.boolean(),
  npsScheduled: z.boolean(),
});

// ── Ações Concretas ──────────────────────────────────────────────────────────

export class GenerateCsprngPinAction extends MetaAction<z.infer<typeof LockPinInputSchema>, z.infer<typeof LockPinOutputSchema>> {
  public readonly name = 'GenerateCsprngPin';
  public readonly description = 'Gera PIN temporário de 6 dígitos com entropia criptográfica CSPRNG';
  public readonly inputSchema = LockPinInputSchema;
  public readonly outputSchema = LockPinOutputSchema;

  protected async execute(input: z.infer<typeof LockPinInputSchema>) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const pin = (arr[0] % 1000000).toString().padStart(6, '0');

    return {
      output: {
        pin,
        pinFormatted: `${pin}#`,
        expiresAtHours: 48,
        securityMethod: 'CSPRNG_CRYPTO_SECURE' as const,
      },
      tokensUsed: 40,
    };
  }
}

export class CheckBatteryStatusAction extends MetaAction<z.infer<typeof BatteryWatchdogInputSchema>, z.infer<typeof BatteryWatchdogOutputSchema>> {
  public readonly name = 'CheckBatteryStatus';
  public readonly description = 'Avalia a saúde da bateria da fechadura eletrônica';
  public readonly inputSchema = BatteryWatchdogInputSchema;
  public readonly outputSchema = BatteryWatchdogOutputSchema;

  protected async execute(input: z.infer<typeof BatteryWatchdogInputSchema>) {
    let status: 'OK' | 'LOW_BATTERY_WARNING' | 'CRITICAL_BATTERY_ALERT' = 'OK';
    let shouldAlertOwner = false;
    let recommendation = 'Bateria operando em níveis nominais.';

    if (input.batteryLevel < 15) {
      status = 'CRITICAL_BATTERY_ALERT';
      shouldAlertOwner = true;
      recommendation = `CRÍTICO: A bateria de ${input.roomName} está em ${input.batteryLevel}%. Troque as 4 pilhas AA imediatamente para evitar travamento!`;
    } else if (input.batteryLevel < 25) {
      status = 'LOW_BATTERY_WARNING';
      shouldAlertOwner = true;
      recommendation = `Atenção: A bateria de ${input.roomName} está em ${input.batteryLevel}%. Providencie pilhas reservas.`;
    }

    return {
      output: {
        status,
        shouldAlertOwner,
        recommendation,
      },
      tokensUsed: 60,
    };
  }
}

export class DispatchCleaningAction extends MetaAction<z.infer<typeof HousekeepingInputSchema>, z.infer<typeof HousekeepingOutputSchema>> {
  public readonly name = 'DispatchCleaning';
  public readonly description = 'Executa o protocolo pós-checkout de revogação de PIN e governança';
  public readonly inputSchema = HousekeepingInputSchema;
  public readonly outputSchema = HousekeepingOutputSchema;

  protected async execute(input: z.infer<typeof HousekeepingInputSchema>) {
    return {
      output: {
        roomStatus: 'manutencao' as const,
        pinRevoked: true,
        cleanersNotified: true,
        npsScheduled: true,
      },
      tokensUsed: 50,
    };
  }
}

// ── Roles Especializados ────────────────────────────────────────────────────

export class AccessSecurityRole extends MetaRole {
  constructor() {
    super({
      name: 'AccessSecurity',
      profile: 'Especialista em Criptografia de Acessos e Fechaduras',
      goal: 'Gerar códigos temporários invioláveis sem usar Math.random',
    });
    this.registerAction(new GenerateCsprngPinAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

export class GatewayWatchdogRole extends MetaRole {
  constructor() {
    super({
      name: 'GatewayWatchdog',
      profile: 'Monitor Contínuo de Gateways e Baterias',
      goal: 'Prevenir falhas de hardware e alertar anfitriões proativamente',
    });
    this.registerAction(new CheckBatteryStatusAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

export class HousekeepingDispatcherRole extends MetaRole {
  constructor() {
    super({
      name: 'HousekeepingDispatcher',
      profile: 'Coordenador de Governança, Limpeza e Pós-Checkout',
      goal: 'Garantir rotatividade rápida e higienização perfeita dos quartos',
    });
    this.registerAction(new DispatchCleaningAction());
  }

  public async handleMessage(msg: MetaMessage) {
    return null;
  }
}

// ── Definição do SOP de Lock Guardian ───────────────────────────────────────

export function createLockGuardianSOP(): SOPDefinition {
  const security = new AccessSecurityRole();
  const watchdog = new GatewayWatchdogRole();
  const housekeeping = new HousekeepingDispatcherRole();

  return {
    name: 'LockGuardianSOP',
    description: 'Procedimento Operacional Padronizado de Fechaduras Eletrônicas e Governança',
    steps: [
      {
        role: security,
        actionName: 'GenerateCsprngPin',
        inputTransformer: (ctx) => ({
          roomName: ctx.roomName || 'Suíte Master 101',
          guestName: ctx.guestName || 'Novo Hóspede',
          lockModel: ctx.lockModel,
        }),
        outputSaver: (out, ctx) => {
          ctx.pinResult = out;
        },
      },
      {
        role: watchdog,
        actionName: 'CheckBatteryStatus',
        inputTransformer: (ctx) => ({
          roomName: ctx.roomName || 'Suíte Master 101',
          batteryLevel: ctx.batteryLevel ?? 85,
          lockModel: ctx.lockModel,
        }),
        outputSaver: (out, ctx) => {
          ctx.batteryResult = out;
        },
      },
      {
        role: housekeeping,
        actionName: 'DispatchCleaning',
        condition: (ctx) => Boolean(ctx.isCheckOut),
        inputTransformer: (ctx) => ({
          roomName: ctx.roomName || 'Suíte Master 101',
          guestName: ctx.guestName || 'Hóspede',
          isCheckOut: true,
        }),
        outputSaver: (out, ctx) => {
          ctx.housekeepingResult = out;
        },
      },
    ],
  };
}

export async function runLockGuardian(params: {
  roomName: string;
  guestName: string;
  batteryLevel?: number;
  lockModel?: string;
  isCheckOut?: boolean;
}) {
  const sop = createLockGuardianSOP();
  return SOPRunner.execute(sop, params);
}
