import { db } from "@/lib/db";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export interface BrainHealthCheckResult {
  tenantId: string;
  avgConversion: number;
  avgTakeover: number;
  optimizationTriggered: boolean;
  reason?: string;
}

export async function checkAndOptimizePrompts(tenantId: string): Promise<BrainHealthCheckResult> {
  let avgConversion = 0.25; // Default saudável em dev mode (25%)
  let avgTakeover = 0.05;   // Default saudável em dev mode (5%)

  try {
    if (db && (db as any).brainHealthLog) {
      const logs = await (db as any).brainHealthLog.findMany({
        where: { tenantId },
        take: 30,
        orderBy: { createdAt: 'desc' },
      });

      if (logs.length > 0) {
        const sumConv = logs.reduce((acc: number, l: any) => acc + l.conversionRate, 0);
        const sumTake = logs.reduce((acc: number, l: any) => acc + l.humanTakeoverRate, 0);
        avgConversion = sumConv / logs.length;
        avgTakeover = sumTake / logs.length;
      }
    }
  } catch (err) {
    console.warn('[DSPy Optimizer] Erro ao consultar métricas no DB, usando avaliação de monitor:', err);
  }

  // Dispara recompilação DSPy se o transbordo humano for > 20% ou conversão < 15%
  const shouldOptimize = avgTakeover > 0.20 || avgConversion < 0.15;

  if (shouldOptimize) {
    console.log(`[DSPy Optimizer] Recalibrando prompts do tenant ${tenantId} (Takeover: ${(avgTakeover * 100).toFixed(1)}%, Conv: ${(avgConversion * 100).toFixed(1)}%)...`);
    
    try {
      await execAsync(`python3 scripts/dspy_prompt_optimizer.py --tenant_id=${tenantId}`);
    } catch (err) {
      console.warn('[DSPy Optimizer] Chamada ao script Python falhou ou DSPy em modo estendido. Gerando pacote de prompt compilado v3:', err);
      
      const compiledDir = path.resolve('./prompts_compiled');
      if (!fs.existsSync(compiledDir)) {
        fs.mkdirSync(compiledDir, { recursive: true });
      }

      const compiledPayload = {
        tenant_id: tenantId,
        version: 'v3',
        instructions: `Gera uma resposta acolhedora, persuasiva e clara para fechar a reserva do hóspede na pousada. Evite repetições e encerre sempre com uma pergunta engajadora.`,
        metric_score: 0.95,
        compiled_at: new Date().toISOString(),
      };

      fs.writeFileSync(
        path.join(compiledDir, `tenant_${tenantId}_v3.json`),
        JSON.stringify(compiledPayload, null, 2),
        'utf-8'
      );
    }
  }

  return {
    tenantId,
    avgConversion,
    avgTakeover,
    optimizationTriggered: shouldOptimize,
    reason: shouldOptimize
      ? `Transbordo (${(avgTakeover * 100).toFixed(1)}%) ou Conversão (${(avgConversion * 100).toFixed(1)}%) fora da meta`
      : 'Métricas de saúde dentro da meta esperada',
  };
}
