import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

export interface CompiledPromptConfig {
  tenantId: string;
  version: string;
  instructions: string;
  signature?: string;
}

/**
 * Carrega os prompts otimizados matematicamente pelo DSPy para um tenant.
 */
export async function loadCompiledPrompt(tenantId: string): Promise<CompiledPromptConfig> {
  const filePath = path.resolve(`./prompts_compiled/tenant_${tenantId}_v3.json`);

  // 1. Tentar ler do sistema de arquivos local
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        tenantId,
        version: parsed.version || 'v3',
        instructions: parsed.instructions || parsed.response_instruction || raw,
        signature: 'ZellaGuestResponse',
      };
    } catch (err) {
      console.warn('[PromptCompiler] Erro ao ler arquivo de prompt DSPy:', err);
    }
  }

  // 2. Tentar ler da tabela no banco
  try {
    if (db && (db as any).compiledPrompt) {
      const record = await (db as any).compiledPrompt.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      if (record) {
        return {
          tenantId,
          version: record.version,
          instructions: record.compiledJson,
          signature: 'ZellaGuestResponse',
        };
      }
    }
  } catch (err) {
    console.warn('[PromptCompiler] Erro ao consultar banco de prompts compilados:', err);
  }

  // 3. Fallback Padrão do Sistema
  return {
    tenantId,
    version: 'default_v1',
    instructions: 'Gera uma resposta acolhedora de venda de reserva para o hóspede da pousada com base no histórico e regras.',
  };
}
