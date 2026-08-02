// =============================================================================
// 🔐 SEU ZÉLLA — Provider MANUAL de Fechaduras
// =============================================================================
// Este é o provider padrão para TODAS as marcas que não têm API conectada:
// - Intelbras (líder em pousadas, sem API pública)
// - Yale (YDM tradicional, sem API)
// - Papaiz (brasileira, sem API)
// - Philco (sem API)
// - Samsung (via SmartThings — complexo, tratado como manual por ora)
// - Marcas com API mas sem credenciais OAuth configuradas no .env
//
// FLUXO REAL para marcas manuais:
// 1. Host gera PIN no app oficial da marca (Intelbras, Yale Access, etc.)
// 2. Host cola esse PIN no campo "PIN manual" do Zélla
// 3. Zélla agenda o envio via WhatsApp no horário do check-in
// 4. O PIN real que abre a porta é o que está na fechadura (gerado pelo app)
//
// FLUXO ALTERNATIVO (auto-gerar):
// Se o host marcar "Gerar PIN criptográfico", o Zélla gera um PIN aleatório
// CSPRNG que o host deve CADASTRAR manualmente na fechadura. Útil para
// fechaduras que aceitam qualquer PIN (Intelbras FR 1100+ permite isso).
// =============================================================================


import { generateRandomPin } from '../pin-generator';
import type { LockBrand } from '../types';

export interface ManualGeneratePinInput {
  deviceId: string;
  brand: LockBrand;
  providerType: 'api' | 'manual';
  externalDeviceId?: string | null;
  oauthAccountId?: string | null;
  validFrom: Date;
  validTo: Date;
  /** PIN que o host colou (já gerado no app oficial da marca). */
  manualPin?: string;
  /** Se true e manualPin vazio, gera PIN criptográfico automaticamente. */
  autoGenerate?: boolean;
}

export interface ManualGeneratePinResult {
  pin: string;
  source: 'manual' | 'api';
  codeType: 'online_pin' | 'offline_pin' | 'manual';
  warnings?: string[];
}

/**
 * Gera (ou aceita) um PIN no modo manual.
 *
 * Comportamento:
 * - Se `manualPin` for fornecido → usa esse PIN (host já gerou no app da marca)
 * - Senão, se `autoGenerate` for true → gera PIN criptográfico CSPRNG
 * - Senão → erro (precisa de um dos dois)
 *
 * Sufixo `#`:
 * - TTLock, Igloohome: exigem `#` ao final (ex: `4821#`)
 * - Intelbras, Yale, Papaiz: sem sufixo (ex: `4821`)
 * - Nuki, August, Samsung: PIN no keypad, sem sufixo
 */
export async function generatePin(input: ManualGeneratePinInput): Promise<ManualGeneratePinResult> {
  const warnings: string[] = [];

  // Determina se a marca usa sufixo `#`
  const usesHashSuffix = ['ttlock', 'igloohome'].includes(input.brand);
  const suffix = usesHashSuffix ? '#' : '';

  // Caso 1: host colou PIN manualmente
  if (input.manualPin && input.manualPin.trim().length >= 4) {
    const pin = input.manualPin.trim();
    // Validação básica
    if (!/^[0-9A-Za-z#*]+$/.test(pin)) {
      throw new Error('PIN contém caracteres inválidos. Use apenas dígitos, #, * ou letras.');
    }
    if (pin.length > 12) {
      throw new Error('PIN muito longo (máximo 12 caracteres).');
    }

    // Adiciona sufixo `#` se a marca exigir e o host não colocou
    const finalPin = usesHashSuffix && !pin.endsWith('#') ? `${pin}#` : pin;

    return {
      pin: finalPin,
      source: 'manual',
      codeType: input.brand === 'igloohome' ? 'offline_pin' : 'manual',
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Caso 2: auto-gerar PIN criptográfico
  if (input.autoGenerate) {
    const pin = generateRandomPin(6, suffix);
    warnings.push(
      `PIN gerado automaticamente (${pin}). Você precisa cadastrá-lo manualmente no app oficial da marca (${getBrandLabel(input.brand)}).`,
    );
    return {
      pin,
      source: 'manual',
      codeType: input.brand === 'igloohome' ? 'offline_pin' : 'manual',
      warnings,
    };
  }

  // Caso 3: nenhum PIN fornecido
  throw new Error(
    'Você precisa fornecer um PIN manual (gerado no app da marca) ou marcar "Gerar PIN automaticamente".',
  );
}

/** Retorna o nome amigável da marca. */
function getBrandLabel(brand: LockBrand): string {
  const labels: Record<LockBrand, string> = {
    ttlock: 'TTLock',
    tuya: 'Tuya / Smart Life',
    igloohome: 'Igloohome',
    nuki: 'Nuki',
    august: 'August / Yale Assure 2',
    intelbras: 'Intelbras',
    yale: 'Yale Access',
    papaiz: 'Papaiz',
    philco: 'Philco Home',
    samsung: 'SmartThings',
  };
  return labels[brand] ?? brand;
}
