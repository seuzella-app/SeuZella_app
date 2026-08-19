// =============================================================================
// SEU ZÉLLA METAGPT ENGINE — ACTION BASE CLASS
// =============================================================================

import { z } from 'zod';

export interface ActionMetadata {
  name: string;
  description: string;
  costEstimateUsd?: number;
}

export abstract class MetaAction<TInput = any, TOutput = any> {
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly inputSchema: z.ZodType<TInput>;
  public abstract readonly outputSchema: z.ZodType<TOutput>;

  /**
   * Executa a ação garantindo validação de schema de entrada e saída.
   */
  public async run(input: TInput, context: Record<string, unknown> = {}): Promise<{
    success: boolean;
    output?: TOutput;
    tokensUsed: number;
    durationMs: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      // 1. Validação de Entrada (Zod Schema)
      const parsedInput = this.inputSchema.parse(input);

      // 2. Execução da Ação Concreta
      const result = await this.execute(parsedInput, context);

      // 3. Validação de Saída (Zod Schema)
      const parsedOutput = this.outputSchema.parse(result.output);

      const durationMs = Date.now() - startTime;
      return {
        success: true,
        output: parsedOutput,
        tokensUsed: result.tokensUsed || 0,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        error: err?.message || 'Action execution failed',
        tokensUsed: 0,
        durationMs,
      };
    }
  }

  /**
   * Implementação concreta do raciocínio ou chamada de ferramenta.
   */
  protected abstract execute(
    input: TInput,
    context: Record<string, unknown>
  ): Promise<{ output: TOutput; tokensUsed?: number }>;
}
