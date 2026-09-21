// [RUN10-W2 10E] Config central de env de IA — fail-closed (ADITIVO; adoção gradual na W3)
// Nomes descobertos pelo RUN10-W1 (RUN10_AI_INVENTORY.json). Nunca logar valores.
export const AI_ENV_KEYS: readonly string[] = [
];
export function getAiEnv(key: string): string | null {
  let found = false;
  for (const k of AI_ENV_KEYS) { if (k === key) { found = true; break; } }
  if (!found) return null;
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
export function requireAiEnv(key: string): string {
  const v = getAiEnv(key);
  if (v === null) { throw new Error("[AI-ENV] variavel obrigatoria ausente ou vazia: " + key); }
  return v;
}
export function aiEnvStatus(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of AI_ENV_KEYS) {
    const raw = process.env[k];
    out[k] = typeof raw === "string" && raw.trim().length > 0;
  }
  return out;
}
export function hasAnyAiEnv(): boolean {
  const s = aiEnvStatus();
  for (const k of Object.keys(s)) { if (s[k]) return true; }
  return false;
}
