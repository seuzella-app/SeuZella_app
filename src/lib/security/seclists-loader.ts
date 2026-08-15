/**
 * SecLists Loader — Carrega datasets de segurança do SecLists (lazy)
 * =================================================================
 *
 * 5 datasets carregados sob demanda do /public/data/seclists/:
 *   1. jailbreak-prompts.json (1.403 prompts de jailbreak reais)
 *   2. sast-patterns.json (119 strings de código perigoso)
 *   3. malicious-functions.json (94 funções de backdoor)
 *   4. common-passwords.json (10.000 senhas mais comuns)
 *   5. cmd-injection.json (200 payloads de command injection)
 *
 * Fonte: https://github.com/danielmiessler/SecLists (MIT License)
 *
 * Carregamento lazy: só baixa quando a primeira chamada acontece.
 * Cache em memória após primeiro load (não baixa de novo).
 */

// ─────────────────────────────────────────────────────────────────────────────
// CACHE IN-MEMORY
// ─────────────────────────────────────────────────────────────────────────────

let _jailbreakPrompts: string[] | null = null;
let _sastPatterns: string[] | null = null;
let _maliciousFunctions: string[] | null = null;
let _commonPasswords: Set<string> | null = null;
let _cmdInjectionPayloads: string[] | null = null;

const BASE_URL = '/data/seclists';

// ─────────────────────────────────────────────────────────────────────────────
// LOADERS (cada um carrega lazy + cacheia)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carrega 1.403 prompts de jailbreak coletados de comunidades reais.
 * Usado pelo prompt-guard.ts para detectar tentativas de jailbreak
 * em mensagens do hóspede no WhatsApp.
 */
export async function loadJailbreakPrompts(): Promise<string[]> {
  if (_jailbreakPrompts) return _jailbreakPrompts;
  try {
    const res = await fetch(`${BASE_URL}/jailbreak-prompts.json`, { cache: 'force-cache' });
    if (!res.ok) return [];
    _jailbreakPrompts = await res.json();
    return _jailbreakPrompts ?? [];
  } catch {
    return [];
  }
}

/**
 * Carrega 119 strings de código perigoso (api_key, secret, password, token, etc.).
 * Usado pelo night-pentest-service.ts para SAST (complementa os 14 patterns existentes).
 */
export async function loadSastPatterns(): Promise<string[]> {
  if (_sastPatterns) return _sastPatterns;
  try {
    const res = await fetch(`${BASE_URL}/sast-patterns.json`, { cache: 'force-cache' });
    if (!res.ok) return [];
    _sastPatterns = await res.json();
    return _sastPatterns ?? [];
  } catch {
    return [];
  }
}

/**
 * Carrega 94 funções de backdoor/malware (eval, shell_exec, system, etc.).
 * Usado pelo night-pentest-service.ts para detectar web shells injetados.
 */
export async function loadMaliciousFunctions(): Promise<string[]> {
  if (_maliciousFunctions) return _maliciousFunctions;
  try {
    const res = await fetch(`${BASE_URL}/malicious-functions.json`, { cache: 'force-cache' });
    if (!res.ok) return [];
    _maliciousFunctions = await res.json();
    return _maliciousFunctions ?? [];
  } catch {
    return [];
  }
}

/**
 * Carrega 10.000 senhas mais comuns do mundo.
 * Usado pelo self-defense.ts (brute force detection) e signup (password strength).
 * Retorna Set para busca O(1).
 */
export async function loadCommonPasswords(): Promise<Set<string>> {
  if (_commonPasswords) return _commonPasswords;
  try {
    const res = await fetch(`${BASE_URL}/common-passwords.json`, { cache: 'force-cache' });
    if (!res.ok) return new Set();
    const passwords: string[] = await res.json();
    _commonPasswords = new Set(passwords);
    return _commonPasswords;
  } catch {
    return new Set();
  }
}

/**
 * Carrega 200 payloads de command injection (RCE).
 * Usado pelo night-pentest-service.ts para pentest de API routes.
 */
export async function loadCmdInjectionPayloads(): Promise<string[]> {
  if (_cmdInjectionPayloads) return _cmdInjectionPayloads;
  try {
    const res = await fetch(`${BASE_URL}/cmd-injection.json`, { cache: 'force-cache' });
    if (!res.ok) return [];
    _cmdInjectionPayloads = await res.json();
    return _cmdInjectionPayloads ?? [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE VERIFICAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica se uma mensagem contém um jailbreak prompt conhecido.
 * Faz match aproximado (substring) — não precisa de match exato.
 *
 * @param message Mensagem do hóspede no WhatsApp
 * @returns { isJailbreak: boolean, matchedPrompt?: string }
 */
export async function detectJailbreak(message: string): Promise<{
  isJailbreak: boolean;
  matchedPrompt?: string;
  matchType?: 'exact' | 'substring';
}> {
  const prompts = await loadJailbreakPrompts();
  const lower = message.toLowerCase().trim();

  // 1. Match exato (mensagem inteira é um jailbreak prompt)
  for (const prompt of prompts) {
    if (lower === prompt.toLowerCase().trim()) {
      return { isJailbreak: true, matchedPrompt: prompt.slice(0, 100), matchType: 'exact' };
    }
  }

  // 2. Match por substring (primeiros 50 chars do prompt aparecem na mensagem)
  //    Otimização: só verifica prompts com >50 chars (curtos demais = falsos positivos)
  for (const prompt of prompts) {
    const promptLower = prompt.toLowerCase();
    if (promptLower.length > 50) {
      const snippet = promptLower.slice(0, 50);
      if (lower.includes(snippet)) {
        return { isJailbreak: true, matchedPrompt: prompt.slice(0, 100), matchType: 'substring' };
      }
    }
  }

  return { isJailbreak: false };
}

/**
 * Verifica se uma senha está nas 10.000 mais comuns.
 * Busca O(1) via Set.
 */
export async function isCommonPassword(password: string): Promise<{
  isCommon: boolean;
  rank?: number; // 1 = mais comum, 10000 = menos comum
}> {
  const passwords = await loadCommonPasswords();
  const lower = password.toLowerCase().trim();

  if (passwords.has(lower)) {
    // Converte para array para achar o rank (apenas uma vez, depois cacheia o array)
    const arr = Array.from(passwords);
    const rank = arr.indexOf(lower) + 1;
    return { isCommon: true, rank };
  }

  return { isCommon: false };
}

/**
 * Verifica se um trecho de código contém patterns perigosos do SecLists.
 * Usado pelo night-pentest para complementar os 14 patterns existentes.
 */
export async function scanCodeWithSecLists(content: string, filePath: string): Promise<Array<{
  type: string;
  pattern: string;
  line: number;
  source: 'seclists_sast' | 'seclists_malicious';
}>> {
  const findings: Array<{
    type: string;
    pattern: string;
    line: number;
    source: 'seclists_sast' | 'seclists_malicious';
  }> = [];

  const [sastPatterns, maliciousFuncs] = await Promise.all([
    loadSastPatterns(),
    loadMaliciousFunctions(),
  ]);

  const lines = content.split('\n');

  // SAST patterns (api_key, secret, password, etc.)
  for (const pattern of sastPatterns) {
    if (pattern.length < 3) continue;
    const regex = new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'i');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      // Skip se é em comentário ou process.env
      const lineContent = lines[lineNum - 1] || '';
      if (lineContent.includes('process.env') || lineContent.trim().startsWith('//')) continue;
      // Skip falsos positivos (variável com mesmo nome mas uso legítimo)
      if (lineContent.includes('process.env.') && pattern.length < 6) continue;

      findings.push({
        type: 'seclists_sast_pattern',
        pattern,
        line: lineNum,
        source: 'seclists_sast',
      });
      break; // 1 finding por pattern por arquivo
    }
  }

  // Malicious functions (eval, shell_exec, system, etc.)
  for (const func of maliciousFuncs) {
    if (func.length < 3) continue;
    const regex = new RegExp(`\\b${escapeRegex(func)}\\s*\\(`, 'i');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const lineContent = lines[lineNum - 1] || '';
      // Skip se está em comentário
      if (lineContent.trim().startsWith('//') || lineContent.trim().startsWith('*')) continue;

      findings.push({
        type: 'seclists_malicious_function',
        pattern: func,
        line: lineNum,
        source: 'seclists_malicious',
      });
      break;
    }
  }

  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS (para ZCC)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSecListsStats(): Promise<{
  loaded: boolean;
  jailbreakPrompts: number;
  sastPatterns: number;
  maliciousFunctions: number;
  commonPasswords: number;
  cmdInjectionPayloads: number;
  totalDefenseRules: number;
}> {
  const [jp, sp, mf, cp, ci] = await Promise.all([
    loadJailbreakPrompts(),
    loadSastPatterns(),
    loadMaliciousFunctions(),
    loadCommonPasswords(),
    loadCmdInjectionPayloads(),
  ]);

  return {
    loaded: true,
    jailbreakPrompts: jp.length,
    sastPatterns: sp.length,
    maliciousFunctions: mf.length,
    commonPasswords: cp.size,
    cmdInjectionPayloads: ci.length,
    totalDefenseRules: jp.length + sp.length + mf.length + cp.size + ci.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
