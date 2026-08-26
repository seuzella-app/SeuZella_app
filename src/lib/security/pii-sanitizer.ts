import { createHash } from 'crypto';

const SENSITIVE_PATTERNS = {
  cpf: /\b(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}|\d{11})\b/g,
  cnpj: /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}\b/g,
  card: /\b(?:\d[ -\s]*?){13,19}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(?:\+55\s?)?[\(\]?\d{2}[\)]?[\s.-]?(?:9?\d{4}[\s.-]?\d{4}|\d{4}[\s.-]?\d{4})\b/g,
  pixKey: /\b(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})\b/gi,
  fullName: /(?:senhor|senhora|sr\.?|sra\.?|cliente|hóspede|dona?|dr\.?)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:de|da|do|dos|das)?\s*[A-ZÀ-Ú][a-zà-ú]+)+)/gi,
  address: /(?:rua|av\.?|avenida|travessa|al\.?|alameda|estrada|rodovia)\s+[A-ZÀ-Ú][\w\s,.-]+?\d+/gi,
  birthDate: /\b\d{2}[\/\-.]\d{2}[\/\-.]\d{4}\b/g,
};

export interface SanitizationProof {
  sanitized: string;
  valid: boolean;
  detections: Array<{ type: string; count: number; samples: string[] }>;
  hashBefore: string;
  hashAfter: string;
  changed: boolean;
}

export function sanitizePIIWithProof(text: string): SanitizationProof {
  if (!text) return {
    sanitized: '', valid: true, detections: [],
    hashBefore: hash(''), hashAfter: hash(''), changed: false
  };

  const hashBefore = hash(text);
  let sanitized = text;
  const detections: Array<{ type: string; count: number; samples: string[] }> = [];

  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    const matches = [...sanitized.matchAll(pattern)];
    if (matches.length > 0) {
      const samples = matches.slice(0, 3).map(m => `${m[0].slice(0, 20) }...`);
      detections.push({ type, count: matches.length, samples });
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REMOVIDO]`);
    }
  }

  const orphanCpf = /\b\d{11}\b/g;
  const orphanMatches = [...sanitized.matchAll(orphanCpf)];
  if (orphanMatches.length > 0) {
    detections.push({ type: 'orphan_cpf', count: orphanMatches.length, samples: orphanMatches.slice(0, 3).map(m => m[0]) });
    sanitized = sanitized.replace(orphanCpf, '[CPF_REMOVIDO]');
  }

  const hashAfter = hash(sanitized);
  const changed = hashBefore !== hashAfter;
  const valid = detections.length === 0 || changed;

  return { sanitized, valid, detections, hashBefore, hashAfter, changed };
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export function assertSanitized(text: string): string {
  const proof = sanitizePIIWithProof(text);
  if (!proof.valid) {
    throw new Error(
      `PII_SANITIZATION_FAILED: Detectado mas não removido. ` +
      `Tipos: ${proof.detections.map(d => d.type).join(', ')}. ` +
      `Hash antes: ${proof.hashBefore}, depois: ${proof.hashAfter}`
    );
  }
  if (proof.changed) {
    console.log(JSON.stringify({
      level: 'security', event: 'PII_SANITIZED',
      types: proof.detections.map(d => d.type),
      hashBefore: proof.hashBefore, hashAfter: proof.hashAfter,
      timestamp: new Date().toISOString(),
    }));
  }
  return proof.sanitized;
}
