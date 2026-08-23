// =============================================================================
// SEU ZÉLLA METAGPT ENGINE — SOP ORCHESTRATION RUNNER
// =============================================================================

import { MetaRole } from './role';
import { type SOPExecutionLog } from './message';
import { BudgetGuard, DEFAULT_SOP_BUDGET, type BudgetConfig } from './budget-guard';

export interface SOPStep<TIn = any, TOut = any> {
  role: MetaRole;
  actionName: string;
  inputTransformer: (context: Record<string, any>, previousOutput?: any) => TIn;
  outputSaver?: (output: TOut, context: Record<string, any>) => void;
  condition?: (context: Record<string, any>) => boolean;
}

export interface SOPDefinition {
  name: string;
  description: string;
  budgetConfig?: Partial<BudgetConfig>;
  steps: SOPStep[];
}

export class SOPRunner {
  public static async execute<TResult = any>(
    sop: SOPDefinition,
    initialContext: Record<string, any> = {}
  ): Promise<{ success: boolean; result?: TResult; log: SOPExecutionLog; error?: string }> {
    const startedAt = Date.now();
    const guard = new BudgetGuard(sop.budgetConfig || DEFAULT_SOP_BUDGET);
    const context = { ...initialContext };
    
    const log: SOPExecutionLog = {
      sopName: sop.name,
      startedAt,
      status: 'RUNNING',
      totalTokensUsed: 0,
      estimatedCostUsd: 0,
      steps: [],
    };

    let previousOutput: any = undefined;

    try {
      for (let i = 0; i < sop.steps.length; i++) {
        const step = sop.steps[i];

        // Verificar condição de execução do passo
        if (step.condition && !step.condition(context)) {
          log.steps.push({
            stepIndex: i + 1,
            roleName: step.role.name,
            actionName: step.actionName,
            inputSummary: 'Condição não satisfeita',
            outputSummary: 'Passo ignorado',
            tokensUsed: 0,
            durationMs: 0,
            status: 'SKIPPED',
          });
          continue;
        }

        const action = step.role.getAction(step.actionName);
        if (!action) {
          throw new Error(`Ação "${step.actionName}" não encontrada no Role "${step.role.name}"`);
        }

        const stepInput = step.inputTransformer(context, previousOutput);
        const actionResult = await action.run(stepInput, context);

        guard.recordUsage(actionResult.tokensUsed);
        log.totalTokensUsed = guard.getTokensUsed();
        log.estimatedCostUsd = guard.estimateCostUsd();

        if (!actionResult.success) {
          log.steps.push({
            stepIndex: i + 1,
            roleName: step.role.name,
            actionName: step.actionName,
            inputSummary: JSON.stringify(stepInput).slice(0, 100),
            outputSummary: `Erro: ${actionResult.error}`,
            tokensUsed: actionResult.tokensUsed,
            durationMs: actionResult.durationMs,
            status: 'FAILED',
          });
          throw new Error(`Falha no passo ${i + 1} (${step.role.name} / ${step.actionName}): ${actionResult.error}`);
        }

        previousOutput = actionResult.output;
        if (step.outputSaver) {
          step.outputSaver(actionResult.output, context);
        }

        log.steps.push({
          stepIndex: i + 1,
          roleName: step.role.name,
          actionName: step.actionName,
          inputSummary: JSON.stringify(stepInput).slice(0, 100),
          outputSummary: JSON.stringify(actionResult.output).slice(0, 100),
          tokensUsed: actionResult.tokensUsed,
          durationMs: actionResult.durationMs,
          status: 'SUCCESS',
        });
      }

      log.completedAt = Date.now();
      log.durationMs = log.completedAt - startedAt;
      log.status = 'COMPLETED';

      return {
        success: true,
        result: previousOutput as TResult,
        log,
      };
    } catch (err: any) {
      log.completedAt = Date.now();
      log.durationMs = log.completedAt - startedAt;
      log.status = 'FAILED';
      log.error = err?.message || 'SOP execution failed';

      return {
        success: false,
        error: log.error,
        log,
      };
    }
  }
}
