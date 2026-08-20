import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/db';

export interface DpoDatasetItem {
  prompt: string;
  chosen: string;
  rejected: string;
  similarityScore?: number;
}

/**
 * Exports only real pending DPO preference pairs.
 * Synthetic/demo records are deliberately forbidden so they cannot enter a
 * training dataset by accident.
 */
export async function exportDpoDataset(outputPath: string = './dpo_dataset.jsonl'): Promise<number> {
  if (process.env.NODE_ENV === 'production' && process.env.DPO_EXPORT_ENABLED !== 'true') {
    throw new Error('DPO export is disabled in production unless DPO_EXPORT_ENABLED=true');
  }

  const dpoModel = (db as unknown as {
    dpoPreferencePair?: {
      findMany: (args: unknown) => Promise<Array<{
        prompt: string;
        chosen: string;
        rejected: string;
        similarityScore?: number | null;
      }>>;
    };
  }).dpoPreferencePair;

  if (!dpoModel) {
    throw new Error('DPO preference-pair model is unavailable');
  }

  const records = await dpoModel.findMany({
    where: { status: 'pending' },
  });

  const pendingPairs: DpoDatasetItem[] = records.map((record) => ({
    prompt: record.prompt,
    chosen: record.chosen,
    rejected: record.rejected,
    similarityScore: record.similarityScore ?? undefined,
  }));

  if (pendingPairs.length === 0) {
    throw new Error('No pending DPO preference pairs available; refusing to generate synthetic training data');
  }

  const jsonlLines = pendingPairs.map((item) => JSON.stringify({
    prompt: item.prompt,
    chosen: item.chosen,
    rejected: item.rejected,
  }));

  const fullPath = path.resolve(outputPath);
  fs.writeFileSync(fullPath, `${jsonlLines.join('\n')}\n`, 'utf-8');

  return pendingPairs.length;
}

if (require.main === module) {
  exportDpoDataset().catch((error: unknown) => {
    console.error('[DPO-EXPORTER] Export failed:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  });
}
