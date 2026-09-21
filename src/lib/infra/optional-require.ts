/**
 * SEUZELLA RUN11-W2 — infraestrutura local com Redis OPCIONAL.
 * optional-require.ts — importação opaca a bundlers.
 *
 * POR QUE new Function: o Next.js analisa estaticamente `import('ioredis')`
 * e o build FALHA se o pacote não estiver instalado. Redis é OPCIONAL por
 * design (cronograma 11A: "fallbacks locais/in-memory, Redis opcional, zero
 * contas externas"). Este helper mantém o build verde com ou sem o pacote.
 *
 * Invariante (suíte run11-w2): NENHUM módulo em src/lib/infra pode importar
 * ioredis estaticamente; a única via permitida é importOptional() daqui.
 */

export function importOptional<T = unknown>(moduleName: string): Promise<T | null> {
  try {
    const opaqueImport = new Function('m', 'return import(m);') as (m: string) => Promise<T>;
    return opaqueImport(moduleName).then(
      (mod) => mod,
      () => null,
    );
  } catch {
    return Promise.resolve(null);
  }
}

/** Aviso estruturado único (não vira log spam; não imprime valores de env). */
export function warnOnce(key: string, message: string, state?: Map<string, boolean>): void {
  if (state && state.get(key)) return;
  if (state) state.set(key, true);
  // eslint-disable-next-line no-console
  console.log(`[SZ-INFRA][WARN] ${key}: ${message}`);
}
