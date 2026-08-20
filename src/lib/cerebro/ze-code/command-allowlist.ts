/**
 * ============================================================================
 * 🛡️ ZÉCODE COMMAND ALLOWLIST — Sandbox de Execução de Comandos
 * ============================================================================
 *
 * Garante que nenhum agente execute comandos shell arbitrários ou destrutivos.
 * Apenas comandos explicitamente cadastrados na allowlist são permitidos.
 * ============================================================================
 */

export const ALLOWED_COMMANDS = new Set([
  'npm run lint',
  'npm run build',
  'npm run typecheck',
  'npx tsc --noEmit',
  'npx vitest run',
  'npm test',
  'git status',
  'git diff',
]);

const DANGEROUS_PATTERNS = [
  /curl/i,
  /wget/i,
  /docker/i,
  /rm\s+-rf/i,
  /eval/i,
  /bash\s+-c/i,
  /sh\s+-c/i,
  /nc\s+-e/i,
  /python\s+-c/i,
  />/i,
  /\|/i,
  /;/i,
  /&&/i,
];

export interface CommandValidationResult {
  allowed: boolean;
  sanitizedCommand?: string;
  reason?: string;
}

/**
 * Valida se um comando shell é estritamente permitido para execução pelo ZéCode
 */
export function validateZeCodeCommand(command: string): CommandValidationResult {
  const trimmed = command.trim();

  if (!trimmed) {
    return { allowed: false, reason: 'Comando vazio.' };
  }

  // 1. Bloqueia caracteres de injeção ou comandos perigosos
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: `Comando contém padrões proibidos ou operadores de encadeamento/redirecionamento (${pattern}).`,
      };
    }
  }

  // 2. Compara contra a allowlist estrita
  if (!ALLOWED_COMMANDS.has(trimmed)) {
    return {
      allowed: false,
      reason: `Comando '${trimmed}' não consta na allowlist autorizada de comandos seguros do ZéCode.`,
    };
  }

  return { allowed: true, sanitizedCommand: trimmed };
}
