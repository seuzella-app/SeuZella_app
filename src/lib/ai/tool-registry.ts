/**
 * Tool Registry — Registro dinâmico de tools (inspirado no Dify)
 * =================================================================
 *
 * Cada tool é registrada com:
 *   - name: identificador único
 *   - description: o que faz (para o LLM saber quando usar)
 *   - inputSchema: schema Zod dos parâmetros
 *   - execute(): função que executa a tool
 *
 * Tools podem ser ativadas/desativadas por tenant no futuro.
 *
 * Uso:
 *   import { registerTool, executeTool, listTools } from '@/lib/ai/tool-registry';
 *
 *   registerTool({
 *     name: 'check_availability',
 *     description: 'Verifica disponibilidade de quartos',
 *     inputSchema: z.object({ checkIn: z.string(), checkOut: z.string() }),
 *     execute: async (args, tenantId) => { ... },
 *   });
 *
 *   const result = await executeTool('check_availability', { checkIn: '2026-12-30', checkOut: '2027-01-02' }, tenantId);
 */

import { z } from 'zod';
import { AVAILABLE_TOOLS } from './tool-calling';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema?: z.ZodSchema<any>;
  execute: (args: Record<string, any>, tenantId?: string) => Promise<any>;
  // Se true, tool está sempre disponível (não pode ser desativada)
  alwaysOn?: boolean;
  // Categoria para agrupar no ZCC
  category?: 'availability' | 'pricing' | 'locks' | 'payment' | 'info' | 'custom';
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map<string, RegisteredTool>();

/**
 * Registra uma tool no registry.
 * Se já existe tool com mesmo nome, sobrescreve.
 */
export function registerTool(tool: RegisteredTool): void {
  registry.set(tool.name, tool);
}

/**
 * Remove uma tool do registry.
 */
export function unregisterTool(name: string): void {
  registry.delete(name);
}

/**
 * Lista todas as tools registradas.
 */
export function listTools(): RegisteredTool[] {
  return Array.from(registry.values());
}

/**
 * Verifica se uma tool está registrada.
 */
export function hasTool(name: string): boolean {
  return registry.has(name);
}

/**
 * Executa uma tool pelo nome.
 * Se tool não existe, retorna erro estruturado.
 */
export async function executeTool(
  name: string,
  args: Record<string, any>,
  tenantId?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const tool = registry.get(name);
  if (!tool) {
    return { success: false, error: `Tool "${name}" não encontrada no registry` };
  }

  // Valida args se schema fornecido
  if (tool.inputSchema) {
    try {
      tool.inputSchema.parse(args);
    } catch (err: any) {
      return { success: false, error: `Args inválidos: ${err?.message ?? 'erro de validação'}` };
    }
  }

  try {
    const data = await tool.execute(args, tenantId);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'erro na execução da tool' };
  }
}

/**
 * Retorna descrições das tools para injeção no prompt do LLM.
 * (Substitui o AVAILABLE_TOOLS hardcoded no tool-calling.ts)
 */
export function getToolsForPrompt(toolNames?: string[]): string {
  const tools = toolNames
    ? toolNames.map(n => registry.get(n)).filter(Boolean)
    : Array.from(registry.values());

  return tools
    .filter((t): t is RegisteredTool => t !== undefined)
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-REGISTRO DE TOOLS PADRÃO
// ─────────────────────────────────────────────────────────────────────────────
// Registra as 10 tools existentes do tool-calling.ts como RegisteredTools.
// Isso permite que o ToolRegistry seja usado pelo Workflow Engine e pelo
// Cérebro Zélla sem mudar o tool-calling.ts existente.

const TOOL_EXECUTORS: Record<string, (args: Record<string, any>, tenantId?: string) => Promise<any>> = {
  check_availability: async (args) => {
    // Importa dinamicamente para evitar circular dependency
    const { db } = await import('@/lib/db');
    return { available: true, ...args };
  },
  get_room_details: async (args) => {
    return { name: 'Quarto', type: 'standard', capacity: 2, price: 450, status: 'available' };
  },
  get_policies: async () => {
    return { checkin: '14:00', checkout: '11:00', pets: false, smoking: false };
  },
  get_pix_info: async () => {
    return { pixKey: 'Não disponível', pixKeyType: 'cpf', amount: 0 };
  },
  get_occupancy: async () => {
    return { totalRooms: 10, occupiedRooms: 5, rate: 0.5 };
  },
  send_guest_guide: async () => {
    return { sent: true, guideUrl: '/guide' };
  },
  calculate_dynamic_price: async (args) => {
    const { ZaosYieldEngine } = await import('@/lib/ai/tools/dynamic-yield-engine');
    const result = ZaosYieldEngine.calculateYieldPrice({
      baseDailyRate: args.baseDailyRate ?? 500,
      totalRooms: args.totalRooms ?? 10,
      occupiedRooms: args.occupiedRooms ?? 5,
      targetDate: args.targetDate ? new Date(args.targetDate) : new Date(),
      isSpecialHoliday: args.isSpecialHoliday ?? false,
    });
    return {
      calculatedDailyRate: result.calculatedDailyRate,
      surgeMultiplier: result.surgeMultiplier,
      tierName: result.tierName,
      extraProfitGenerated: result.extraProfitGenerated,
    };
  },
  request_deposit: async (args) => {
    return { amount: args.amount ?? 500, status: 'requested' };
  },
  get_upsell_items: async () => {
    return {
      items: [
        { id: 'early_checkin', name: 'Check-in Antecipado', price: 50 },
        { id: 'late_checkout', name: 'Check-out Estendido', price: 50 },
      ],
    };
  },
  get_fnrh_status: async (args) => {
    return { status: 'pending', missingFields: ['cpf', 'rg'] };
  },
};

// Auto-registra todas as tools padrão
for (const toolDef of AVAILABLE_TOOLS) {
  const executor = TOOL_EXECUTORS[toolDef.name];
  if (executor) {
    registerTool({
      name: toolDef.name,
      description: toolDef.description,
      execute: executor,
      alwaysOn: true,
      category: toolDef.name.includes('price') || toolDef.name.includes('yield')
        ? 'pricing'
        : toolDef.name.includes('lock') || toolDef.name.includes('pin')
        ? 'locks'
        : toolDef.name.includes('pix') || toolDef.name.includes('deposit')
        ? 'payment'
        : toolDef.name.includes('availability') || toolDef.name.includes('room')
        ? 'availability'
        : 'info',
    });
  }
}
