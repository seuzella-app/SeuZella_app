/**  
 * Tool Calling System — Native Function Calling para o Cérebro ZÉLLA  
 *  
 * Implementa o loop de tool calling usando function calling NATIVO das APIs
 * (Groq, DeepSeek, Gemini, OpenRouter, Zhipu, Moonshot) em vez de
 * JSON-in-text + regex parsing (abordagem anterior).
 *  
 * Fluxo:  
 * 1. Envia mensagem + tools nativas ao LLM via `router.generateWithTools()`  
 * 2. Se o LLM retorna tool_calls estruturados → executa cada ferramenta localmente  
 * 3. Alimenta os resultados de volta ao LLM como mensagens 'tool'  
 * 4. Repete até o LLM responder com texto final  
 *  
 * Fallback: se nenhum provider com tool support estiver disponível
 * (todos em mock mode ou circuit breaker aberto), usa a abordagem
 * JSON-in-text original como fallback.
 *  
 * Ferramentas disponíveis:  
 *   - check_availability: Consulta disponibilidade real de quartos  
 *   - get_room_details: Detalhes de todos os quartos  
 *   - get_policies: Políticas da pousada  
 *   - get_pix_info: Chave PIX para pagamento de reservas  
 *   - get_occupancy: Taxa de ocupação atual da pousada  
 *  
 * Arquitetura: o loop de tool calling é ORTOGONAL ao ZaosNeuroRouter.  
 * O router seleciona o provider; o tool calling loop gerencia a execução.  
 */

import { db } from '@/lib/db';  
import { getNeuroRouter } from './zaos-neuro-router';  
import type { LLMResponse, LLMToolResponse } from './zaos-neuro-router';
import type { AdapterMessage, AdapterToolDef, AdapterToolCallDef } from './llm-adapters';
import { calculateDynamicPrice } from '@/lib/dynamic-pricing-engine';

// ── Tipos ───────────────────────────────────────────────────────────

/** Definição de uma ferramenta (Function Calling) */  
export interface ToolDefinition {  
  name: string;  
  description: string;  
  parameters: {  
    type: 'object';  
    properties: Record<string, ToolParameterDef>;  
    required: string[];  
  };  
}

interface ToolParameterDef {  
  type: string;  
  description: string;  
  enum?: string[];  
}

/** Resultado da execução de uma ferramenta */  
export interface ToolResult {  
  toolName: string;  
  success: boolean;  
  data: unknown;  
  executionTimeMs: number;  
}

/** Configuração do loop de tool calling */  
export interface ToolCallingConfig {  
  /** Ferramentas disponíveis para esta chamada */  
  tools: ToolDefinition[];  
  /** Número máximo de iterações (evita loop infinito) */  
  maxIterations?: number;  
  /** ID do tenant para consultas ao banco */  
  tenantId: string;  
  /** Prompt do sistema (persona) */  
  systemPrompt: string;  
}

/** Resposta completa do loop de tool calling */  
export interface ToolCallingResponse extends LLMResponse {  
  /** Ferramentas que foram chamadas e seus resultados */  
  toolCalls: Array<{  
    toolName: string;  
    arguments: Record<string, unknown>;  
    result: ToolResult;  
  }>;  
  /** Número de iterações do loop */  
  iterations: number;  
}

// ── Ferramentas disponíveis ──────────────────────────────────────────

export const AVAILABLE_TOOLS: ToolDefinition[] = [  
  {  
    name: 'check_availability',  
    description: 'Consulta a disponibilidade e preços de quartos para um intervalo de datas. Retorna quartos disponíveis com preço por noite.',  
    parameters: {  
      type: 'object',  
      properties: {  
        checkInDate: { type: 'string', description: 'Data de check-in no formato YYYY-MM-DD' },  
        checkOutDate: { type: 'string', description: 'Data de check-out no formato YYYY-MM-DD' },  
        guestCount: { type: 'number', description: 'Número de hóspedes' },  
      },  
      required: ['checkInDate', 'checkOutDate', 'guestCount'],  
    },  
  },  
  {  
    name: 'get_room_details',  
    description: 'Retorna detalhes de todos os quartos da pousada (nome, tipo, capacidade, preço, status).',  
    parameters: {  
      type: 'object',  
      properties: {},  
      required: [],  
    },  
  },  
  {  
    name: 'get_policies',  
    description: 'Retorna as políticas da pousada: check-in, check-out, cancelamento, crianças, pets.',  
    parameters: {  
      type: 'object',  
      properties: {},  
      required: [],  
    },  
  },  
  {
    name: 'get_pix_info',
    description: 'Retorna a chave PIX da pousada para pagamento de reservas. Use esta ferramenta quando o hóspede pedir informações de pagamento ou quando for enviar dados de reserva.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'request_deposit',
    description: 'Solicita depósito (depósito de segurança) do hóspede via PIX. Use quando uma reserva for confirmada e a pousada exigir depósito.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Valor da depósito em reais (default: 200)' },
      },
      required: [],
    },
  },
  {
    name: 'get_upsell_items',
    description: 'Retorna a lista de serviços extras disponíveis (early check-in, late check-out, taxa pet, etc.) com preços.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_fnrh_status',
    description: 'Verifica se o hóspede já preencheu a FNRH (Ficha Nacional de Registro de Hóspedes). Retorna status e campos faltantes.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_occupancy',
    description: 'Retorna a taxa de ocupação atual da pousada: total de quartos, quartos ocupados, quartos disponíveis, e taxa de ocupação em %.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'send_guest_guide',
    description: 'Retorna o link e QR Code do Guia Digital do Hóspede para enviar ao hóspede. O guia contém Wi-Fi, check-in, regras, restaurantes próximos e contatos de emergência.',
    parameters: {
      type: 'object',
      properties: {
        propertyId: { type: 'string', description: 'ID da Property (pousada) — opcional' },
        airbPropertyId: { type: 'string', description: 'ID da AirBProperty (Airbnb) — opcional' },
      },
      required: [],
    },
  },
  {
    name: 'calculate_dynamic_price',
    description: 'Calcula o preço dinâmico ideal para uma diária baseado em demanda, feriados, seasonality e dias antes do check-in. Retorna preço base, preço calculado e breakdown das regras aplicadas.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Data da diária no formato YYYY-MM-DD' },
        roomId: { type: 'string', description: 'ID do quarto (opcional — se omitido, usa média da pousada)' },
        airbPropertyId: { type: 'string', description: 'ID da propriedade Airbnb (opcional)' },
        basePrice: { type: 'number', description: 'Preço base override (opcional — se omitido, usa preço do quarto)' },
      },
      required: ['date'],
    },
  },
];

// ── Executores de ferramentas ────────────────────────────────────────

/**  
 * Executa a ferramenta `check_availability`:  
 * - Busca quartos do tenant  
 * - Verifica reservas conflitantes no intervalo de datas  
 * - Calcula preço total (noites × preço por noite)  
 */  
async function executeCheckAvailability(  
  tenantId: string,  
  args: { checkInDate: string; checkOutDate: string; guestCount: number },  
): Promise<ToolResult> {  
  const startTime = Date.now();

  try {  
    const checkIn = new Date(`${args.checkInDate }T14:00:00`);  
    const checkOut = new Date(`${args.checkOutDate }T11:00:00`);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {  
      return {  
        toolName: 'check_availability',  
        success: false,  
        data: { error: 'Datas inválidas. Use o formato YYYY-MM-DD.' },  
        executionTimeMs: Date.now() - startTime,  
      };  
    }

    if (checkIn >= checkOut) {  
      return {  
        toolName: 'check_availability',  
        success: false,  
        data: { error: 'Check-out deve ser posterior ao check-in.' },  
        executionTimeMs: Date.now() - startTime,  
      };  
    }

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Buscar propriedade do tenant  
    const property = await db.property.findFirst({  
      where: { tenantId },  
      include: { rooms: true },  
    });

    if (!property || property.rooms.length === 0) {  
      return {  
        toolName: 'check_availability',  
        success: false,  
        data: { error: 'Nenhum quarto cadastrado para esta pousada.' },  
        executionTimeMs: Date.now() - startTime,  
      };  
    }

    // Buscar reservas conflitantes (que se sobrepõem ao intervalo solicitado)  
    const conflictingBookings = await db.booking.findMany({  
      where: {  
        tenantId,  
        status: { in: ['confirmed', 'checked_in'] },  
        AND: [  
          { checkIn: { lt: checkOut } },  
          { checkOut: { gt: checkIn } },  
        ],  
      },  
      select: { roomId: true },  
    });

    const occupiedRoomIds = new Set(  
      conflictingBookings  
        .filter(b => b.roomId)  
        .map(b => b.roomId!),  
    );

    // Filtrar quartos disponíveis  
    const availableRooms = property.rooms  
      .filter(room => {  
        if (room.status === 'manutencao' || room.status === 'sujo') return false;  
        if (occupiedRoomIds.has(room.id)) return false;  
        if (room.capacity < args.guestCount) return false;  
        return true;  
      })  
      .map(room => ({  
        name: room.name,  
        type: room.type,  
        capacity: room.capacity,  
        pricePerNight: room.price,  
        totalPrice: room.price * nights,  
        status: room.status,  
      }));

    return {  
      toolName: 'check_availability',  
      success: true,  
      data: {  
        property: property.name,  
        checkIn: args.checkInDate,  
        checkOut: args.checkOutDate,  
        nights,  
        guestCount: args.guestCount,  
        availableRooms,  
        totalRoomCount: property.rooms.length,  
      },  
      executionTimeMs: Date.now() - startTime,  
    };  
  } catch (error) {  
    return {  
      toolName: 'check_availability',  
      success: false,  
      data: { error: `Erro interno: ${error instanceof Error ? error.message : 'desconhecido'}` },  
      executionTimeMs: Date.now() - startTime,  
    };  
  }  
}

/**  
 * Executa a ferramenta `get_room_details`.  
 */  
async function executeGetRoomDetails(tenantId: string): Promise<ToolResult> {  
  const startTime = Date.now();

  try {  
    const property = await db.property.findFirst({  
      where: { tenantId },  
      include: { rooms: { orderBy: { price: 'asc' } } },  
    });

    if (!property) {  
      return {  
        toolName: 'get_room_details',  
        success: false,  
        data: { error: 'Propriedade não encontrada.' },  
        executionTimeMs: Date.now() - startTime,  
      };  
    }

    const rooms = property.rooms.map(r => ({  
      name: r.name,  
      type: r.type,  
      capacity: r.capacity,  
      pricePerNight: r.price,  
      status: r.status,  
    }));

    return {  
      toolName: 'get_room_details',  
      success: true,  
      data: { property: property.name, rooms },  
      executionTimeMs: Date.now() - startTime,  
    };  
  } catch (error) {  
    return {  
      toolName: 'get_room_details',  
      success: false,  
      data: { error: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` },  
      executionTimeMs: Date.now() - startTime,  
    };  
  }  
}

/**  
 * Executa a ferramenta `get_policies`.  
 */  
async function executeGetPolicies(tenantId: string): Promise<ToolResult> {  
  const startTime = Date.now();

  try {  
    const policies = await db.knowledgeEntry.findMany({  
      where: { tenantId, category: 'policies' },  
      select: { question: true, answer: true },  
      take: 10,  
    });

    return {  
      toolName: 'get_policies',  
      success: true,  
      data: {  
        policies: policies.map(p => ({ question: p.question, answer: p.answer })),  
      },  
      executionTimeMs: Date.now() - startTime,  
    };  
  } catch (error) {  
    return {  
      toolName: 'get_policies',  
      success: false,  
      data: { error: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` },  
      executionTimeMs: Date.now() - startTime,  
    };  
  }  
}

/**  
 * Executa a ferramenta `get_pix_info`.  
 */  
async function executeGetPixInfo(tenantId: string): Promise<ToolResult> {  
  const startTime = Date.now();

  try {  
    const property = await db.property.findFirst({  
      where: { tenantId },  
      select: {  
        name: true,  
        pixKey: true,  
        pixKeyType: true,  
        document: true,  
      },  
    });

    if (!property) {  
      return {  
        toolName: 'get_pix_info',  
        success: false,  
        data: { error: 'Propriedade não encontrada.' },  
        executionTimeMs: Date.now() - startTime,  
      };  
    }

    if (!property.pixKey) {  
      return {  
        toolName: 'get_pix_info',  
        success: true,  
        data: {  
          hasPix: false,  
          message: 'Chave PIX não configurada. O hóspede deve entrar em contato diretamente com a pousada para pagamento.',  
        },  
        executionTimeMs: Date.now() - startTime,  
      };  
    }

    return {  
      toolName: 'get_pix_info',  
      success: true,  
      data: {  
        hasPix: true,  
        pixKey: property.pixKey,  
        pixKeyType: property.pixKeyType || 'cpf',  
        beneficiary: property.name,  
        document: property.document || undefined,  
      },  
      executionTimeMs: Date.now() - startTime,  
    };  
  } catch (error) {  
    return {  
      toolName: 'get_pix_info',  
      success: false,  
      data: { error: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` },  
      executionTimeMs: Date.now() - startTime,  
    };  
  }  
}

/**  
 * Executa a ferramenta `calculate_dynamic_price`.  
 * Calls the dynamic pricing engine to calculate optimal price for a daily rate.  
 */  
async function executeCalculateDynamicPrice(  
  tenantId: string,  
  args: { date: string; roomId?: string; airbPropertyId?: string; basePrice?: number },  
): Promise<ToolResult> {  
  const startTime = Date.now();

  try {
    const date = new Date(`${args.date }T12:00:00`);
    if (isNaN(date.getTime())) {
      return {
        toolName: 'calculate_dynamic_price',
        success: false,
        data: { error: 'Data inválida. Use o formato YYYY-MM-DD.' },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const result = await calculateDynamicPrice(
      tenantId,
      args.roomId ?? null,
      args.airbPropertyId ?? null,
      date,
      args.basePrice ?? null,
    );

    return {
      toolName: 'calculate_dynamic_price',
      success: true,
      data: {
        date: args.date,
        basePrice: result.basePrice,
        calculatedPrice: result.calculatedPrice,
        priceChangePercent: Math.round(((result.calculatedPrice - result.basePrice) / result.basePrice) * 100),
        modifierBreakdown: result.modifierBreakdown,
        appliedRulesCount: result.appliedRulesCount,
        occupancyAtCalc: result.occupancyAtCalc,
        daysBeforeCheckIn: result.daysBeforeCheckIn,
        isHoliday: result.isHoliday,
        holidayName: result.holidayName,
        seasonLabel: result.seasonLabel,
        dayOfWeekLabel: result.dayOfWeekLabel,
      },
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      toolName: 'calculate_dynamic_price',
      success: false,
      data: { error: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**  
 * Executa a ferramenta `get_occupancy`.  
 */  
async function executeGetOccupancy(tenantId: string): Promise<ToolResult> {  
  const startTime = Date.now();

  try {  
    const property = await db.property.findFirst({  
      where: { tenantId },  
      include: { rooms: true },  
    });

    if (!property || property.rooms.length === 0) {  
      return {  
        toolName: 'get_occupancy',  
        success: false,  
        data: { error: 'Nenhum quarto cadastrado.' },  
        executionTimeMs: Date.now() - startTime,  
      };  
    }

    const totalRooms = property.rooms.length;  
    const occupiedRooms = property.rooms.filter(  
      r => r.status === 'ocupado' || r.status === 'reservado'  
    ).length;  
    const maintenanceRooms = property.rooms.filter(  
      r => r.status === 'manutencao'  
    ).length;  
    const availableRooms = totalRooms - occupiedRooms - maintenanceRooms;  
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return {  
      toolName: 'get_occupancy',  
      success: true,  
      data: {  
        property: property.name,  
        totalRooms,  
        occupiedRooms,  
        availableRooms,  
        maintenanceRooms,  
        occupancyRate,  
      },  
      executionTimeMs: Date.now() - startTime,  
    };  
  } catch (error) {  
    return {  
      toolName: 'get_occupancy',  
      success: false,  
      data: { error: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` },  
      executionTimeMs: Date.now() - startTime,  
    };  
  }  
}

/**
 * Executa a ferramenta `send_guest_guide`.
 * Finds the active guest guide for the property and returns the public URL + QR code URL.
 */
async function executeSendGuestGuide(
  tenantId: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const propertyId = (args.propertyId as string) || undefined;
    const airbPropertyId = (args.airbPropertyId as string) || undefined;

    // Find the active guest guide
    let guide;

    if (airbPropertyId) {
      guide = await db.guestGuide.findFirst({
        where: {
          tenantId,
          airbPropertyId,
          status: 'active',
        },
      });
    } else if (propertyId) {
      guide = await db.guestGuide.findFirst({
        where: {
          tenantId,
          propertyId,
          status: 'active',
        },
      });
    } else {
      // Find any active guide for the tenant
      guide = await db.guestGuide.findFirst({
        where: {
          tenantId,
          status: 'active',
        },
      });
    }

    if (!guide) {
      return {
        toolName: 'send_guest_guide',
        success: false,
        data: {
          error: 'Guia Digital do Hóspede não encontrado. O anfitrião precisa criar o guia primeiro no painel DDC.',
          hint: 'Acesse o DDC > Guia Digital para criar um guia para a propriedade.',
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    const publicUrl = `https://seuzella.com/guide/${guide.slug}`;

    return {
      toolName: 'send_guest_guide',
      success: true,
      data: {
        guideId: guide.id,
        title: guide.title,
        publicUrl,
        qrCodeUrl: guide.qrCodeUrl,
        slug: guide.slug,
        message: `📱 Link do Guia Digital: ${publicUrl}\n\nO guia contém: Wi-Fi, horários de check-in/check-out, regras da casa, restaurantes próximos, supermercados, atrações, contatos de emergência e FAQ.`,
      },
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      toolName: 'send_guest_guide',
      success: false,
      data: { error: `Erro: ${error instanceof Error ? error.message : 'desconhecido'}` },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

// ── Dispatch de ferramentas ──────────────────────────────────────────

const TOOL_EXECUTORS: Record<string, (tenantId: string, args: Record<string, unknown>) => Promise<ToolResult>> = {  
  check_availability: async (tenantId, args) =>  
    executeCheckAvailability(tenantId, args as { checkInDate: string; checkOutDate: string; guestCount: number }),  
  get_room_details: async (tenantId) =>  
    executeGetRoomDetails(tenantId),  
  get_policies: async (tenantId) =>  
    executeGetPolicies(tenantId),  
  get_pix_info: async (tenantId) =>  
    executeGetPixInfo(tenantId),  
  get_occupancy: async (tenantId) =>  
    executeGetOccupancy(tenantId),  
  send_guest_guide: async (tenantId, args) =>  
    executeSendGuestGuide(tenantId, args),  
  calculate_dynamic_price: async (tenantId, args) =>  
    executeCalculateDynamicPrice(tenantId, args as { date: string; roomId?: string; airbPropertyId?: string; basePrice?: number }),  
};

// ── Executa uma única ferramenta pelo nome ────────────────────────────

/**
 * Executa uma única ferramenta pelo nome, usando o dispatch TABLE TOOL_EXECUTORS.
 * Útil para wrappers de compatibilidade (ex: zehla-tools.ts) que precisam
 * chamar ferramentas Phase 2 individualmente sem o loop completo.
 *
 * @param toolName  Nome da ferramenta (ex: 'check_availability')
 * @param tenantId  ID do tenant
 * @param args      Argumentos da ferramenta
 * @returns Resultado da execução
 */
export async function executeSingleTool(
  toolName: string,
  tenantId: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const executor = TOOL_EXECUTORS[toolName];
  if (!executor) {
    return {
      toolName,
      success: false,
      data: { error: `Ferramenta "${toolName}" não existe. Disponíveis: ${Object.keys(TOOL_EXECUTORS).join(', ')}` },
      executionTimeMs: 0,
    };
  }
  return executor(tenantId, args);
}

// ── Conversão de formatos ────────────────────────────────────────────

/** Converte ToolDefinition (ZÉLLA) para AdapterToolDef (formato OpenAI-compatible) */
function toAdapterTools(tools: ToolDefinition[]): AdapterToolDef[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object' as const,
        properties: t.parameters.properties as Record<string, unknown>,
        required: t.parameters.required,
      },
    },
  }));
}

/** Verifica se há pelo menos um provider com API key real disponível para tool calling */
function hasToolProviderAvailable(): boolean {
  const toolApiKeys = [
    process.env.GROQ_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.DEEPSEEK_API_KEY,
    process.env.OPENROUTER_API_KEY,
    process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY,
    process.env.KIMI_K2_6_API_KEY || process.env.MOONSHOT_API_KEY,
  ];

  return toolApiKeys.some(key => key && key !== 'sk-mock' && !key.startsWith('sk-mock'));
}

// ── Prompt do sistema (usado no fallback JSON-in-text) ───────────────

function buildToolCallingSystemPrompt(baseSystemPrompt: string, tools: ToolDefinition[]): string {  
  const toolDescriptions = tools.map(t =>  
    `- ${t.name}: ${t.description}\n  Parâmetros: ${JSON.stringify(t.parameters.properties)}`  
  ).join('\n');

  return `${baseSystemPrompt}

Você tem acesso às seguintes ferramentas para consultar dados reais da pousada:

${toolDescriptions}

INSTRUÇÕES IMPORTANTES:  
1. Quando o hóspede perguntar sobre disponibilidade, preços ou quartos, SEMPRE use a ferramenta check_availability com as datas mencionadas.  
2. Se o hóspede não mencionar datas, pergunte ANTES de usar qualquer ferramenta.  
3. Após receber o resultado da ferramenta, formule uma resposta natural e amigável em português.  
4. NUNCA invente preços ou disponibilidade — use SEMPRE os dados reais das ferramentas.  
5. Quando quiser usar uma ferramenta, responda APENAS com JSON no formato: {"tool": "nome_da_ferramenta", "arguments": {"param1": "valor1"}}  
6. Quando tiver a resposta final para o hóspede, responda normalmente em português (sem JSON).`;  
}

// ── Loop principal de Tool Calling (NATIVO) ──────────────────────────

/**  
 * Executa o loop completo de tool calling usando function calling NATIVO.
 *  
 * Fluxo:  
 * 1. Envia mensagem + tools ao LLM via router.generateWithTools()
 * 2. Se resposta tem tool_calls → executa cada ferramenta → alimenta resultado → volta ao passo 1  
 * 3. Se resposta é texto normal → retorna  
 * 4. Fallback para JSON-in-text se nenhum provider com tools disponível
 *  
 * @param message - Mensagem do hóspede
 * @param config - Configuração do loop de tool calling
 */  
export async function executeToolCallingLoop(  
  message: string,  
  config: ToolCallingConfig,  
): Promise<ToolCallingResponse> {  
  const { tools, maxIterations = 3, tenantId, systemPrompt } = config;  
  const router = await getNeuroRouter();

  const toolCallsLog: ToolCallingResponse['toolCalls'] = [];  

  // Try native function calling first
  if (hasToolProviderAvailable()) {
    return await executeNativeToolLoop(router, message, tools, systemPrompt, tenantId, maxIterations, toolCallsLog);
  }

  // Fallback: JSON-in-text via regex (original approach)
  console.warn('[ToolCalling] No tool-capable providers available, falling back to JSON-in-text');
  return await executeRegexToolLoop(router, message, tools, systemPrompt, tenantId, maxIterations, toolCallsLog);
}

/**
 * Native function calling loop — uses structured tool_calls from the LLM API.
 */
async function executeNativeToolLoop(
  router: Awaited<ReturnType<typeof getNeuroRouter>>,
  message: string,
  tools: ToolDefinition[],
  systemPrompt: string,
  tenantId: string,
  maxIterations: number,
  toolCallsLog: ToolCallingResponse['toolCalls'],
): Promise<ToolCallingResponse> {
  // Build initial messages
  const messages: AdapterMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: message });

  // Convert tools to adapter format
  const adapterTools = toAdapterTools(tools);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const result: LLMToolResponse = await router.generateWithTools({
      messages,
      tools: adapterTools,
      tier: 2,
      tenantId,
    });

    // If LLM returned tool calls, execute them and continue
    if (result.toolCalls && result.toolCalls.length > 0) {
      // Add assistant message with tool_calls to conversation
      const assistantMsg: AdapterMessage = {
        role: 'assistant',
        content: result.response || '',
        tool_calls: result.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
      messages.push(assistantMsg);

      // Execute each tool and add results
      for (const tc of result.toolCalls) {
        const executor = TOOL_EXECUTORS[tc.name];
        if (!executor) {
          // Unknown tool — return error as tool result
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: `Ferramenta "${tc.name}" não existe. Disponíveis: ${tools.map(t => t.name).join(', ')}` }),
            tool_call_id: tc.id,
          });
          continue;
        }

        const toolResult = await executor(tenantId, tc.arguments);
        toolCallsLog.push({
          toolName: tc.name,
          arguments: tc.arguments,
          result: toolResult,
        });

        // Add tool result to conversation
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult.data),
          tool_call_id: tc.id,
        });
      }

      continue; // Next iteration to let the LLM process tool results
    }

    // No tool calls — final text response
    return {
      ...result,
      response: result.response,
      toolCalls: toolCallsLog,
      iterations: iteration + 1,
    };
  }

  // Exceeded maxIterations — return last response
  const lastResult = await router.generateWithTools({
    messages,
    tools: adapterTools,
    tier: 2,
    tenantId,
  });

  return {
    ...lastResult,
    response: lastResult.response,
    toolCalls: toolCallsLog,
    iterations: maxIterations,
  };
}

/**
 * Fallback: JSON-in-text loop via regex (original approach).
 * Used when no provider with native tool support is available.
 */
async function executeRegexToolLoop(
  router: Awaited<ReturnType<typeof getNeuroRouter>>,
  message: string,
  tools: ToolDefinition[],
  systemPrompt: string,
  tenantId: string,
  maxIterations: number,
  toolCallsLog: ToolCallingResponse['toolCalls'],
): Promise<ToolCallingResponse> {
  const currentMessage = message;
  let currentContext = '';
  let lastLlmResponse: LLMResponse | null = null;

  for (let iteration = 0; iteration < maxIterations; iteration++) {  
    const fullPrompt = `${buildToolCallingSystemPrompt(systemPrompt, tools)  
      + (currentContext ? `\n\nResultado das ferramentas:\n${currentContext}\n\n` : '')  
       }\nMensagem do hóspede: ${currentMessage}${  
       iteration > 0 ? '\n\nAgora, com base nos dados acima, responda ao hóspede em português de forma natural.' : ''}`;

    const result = await router.generate({  
      message: fullPrompt,  
      tier: 2,  
      noCache: true,  
    });

    lastLlmResponse = result;  
    const response = result.response.trim();

    // Try to parse as tool call JSON  
    let toolCall: { tool: string; arguments: Record<string, unknown> } | null = null;  
    try {  
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/(\{[\s\S]*\})/);  
      if (jsonMatch) {  
        const parsed = JSON.parse(jsonMatch[1]);  
        if (parsed.tool && typeof parsed.tool === 'string') {  
          toolCall = {  
            tool: parsed.tool,  
            arguments: parsed.arguments || parsed.params || {},  
          };  
        }  
      }  
    } catch {  
      // Not JSON — final response  
    }

    if (!toolCall) {  
      return {  
        ...result,  
        response,  
        toolCalls: toolCallsLog,  
        iterations: iteration + 1,  
      };  
    }

    // Execute the tool  
    const executor = TOOL_EXECUTORS[toolCall.tool];  
    if (!executor) {  
      currentContext += `\n[Erro] Ferramenta "${toolCall.tool}" não existe. Disponíveis: ${tools.map(t => t.name).join(', ')}`;  
      continue;  
    }

    const toolResult = await executor(tenantId, toolCall.arguments);  
    toolCallsLog.push({  
      toolName: toolCall.tool,  
      arguments: toolCall.arguments,  
      result: toolResult,  
    });  

    if (toolResult.success) {  
      currentContext += `\n[${toolCall.tool}] Sucesso:\n${JSON.stringify(toolResult.data, null, 2)}`;  
    } else {  
      currentContext += `\n[${toolCall.tool}] Erro: ${JSON.stringify(toolResult.data)}`;  
    }  
  }

  // Exceeded maxIterations  
  return {  
    ...lastLlmResponse!,  
    toolCalls: toolCallsLog,  
    iterations: maxIterations,  
  };  
}