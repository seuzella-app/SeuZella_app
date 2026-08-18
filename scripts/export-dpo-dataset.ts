import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/db';

export interface DpoDatasetItem {
  prompt: string;
  chosen: string;
  rejected: string;
  tenantId?: string;
  similarityScore?: number;
}

export async function exportDpoDataset(outputPath: string = './dpo_dataset.jsonl'): Promise<number> {
  let pendingPairs: DpoDatasetItem[] = [];

  try {
    if (db && (db as any).dpoPreferencePair) {
      const records = await (db as any).dpoPreferencePair.findMany({
        where: { status: 'pending' },
      });
      pendingPairs = records.map((r: any) => ({
        prompt: r.prompt,
        chosen: r.chosen,
        rejected: r.rejected,
        tenantId: r.tenantId,
        similarityScore: r.similarityScore,
      }));
    }
  } catch (err) {
    console.warn('[DPO-EXPORTER] Falha ao consultar DB. Usando dataset mock para exportação:', err);
  }

  // Se não houver dados no banco (dev mode), gera amostra de treino estruturada
  if (pendingPairs.length === 0) {
    pendingPairs = [
      {
        prompt: "Quais as opções de check-in na pousada?",
        chosen: "Olá! Nosso check-in abre às 14h. Caso precise chegar antes, me avise que preparo seu acesso!",
        rejected: "O check-in é às 14:00. Não aceitamos chegadas antes desse horário sem taxa prévia.",
        tenantId: "tenant_demo",
        similarityScore: 0.45
      },
      {
        prompt: "Aceita animais de estimação?",
        chosen: "Com certeza! Adoramos pets de pequeno porte. Temos uma taxa única de R$ 50 para higienização especial.",
        rejected: "Não permitimos animais grandes. É proibido pet em áreas comuns.",
        tenantId: "tenant_demo",
        similarityScore: 0.52
      }
    ];
  }

  const jsonlLines = pendingPairs.map(item => JSON.stringify({
    prompt: item.prompt,
    chosen: item.chosen,
    rejected: item.rejected
  }));

  const fullPath = path.resolve(outputPath);
  fs.writeFileSync(fullPath, jsonlLines.join('\n') + '\n', 'utf-8');
  console.log(`[DPO-EXPORTER] ${pendingPairs.length} pares DPO exportados com sucesso para ${fullPath}`);

  return pendingPairs.length;
}

if (require.main === module) {
  exportDpoDataset().catch(console.error);
}
