// =============================================================================
// 🔐 SEU ZÉLLA — Provider MANUAL de Fechaduras
// =============================================================================
// O provider manual só pode criar um PIN que o host explicitamente forneceu
// ou um PIN CSPRNG para marcas declaradas como manuais. Ele NUNCA mascara uma
// falha de um provider API gerando um PIN local que talvez não seja aceito pela
// fechadura física.
// =============================================================================

import { generateRandomPin } from '../pin-generator';
import { getProviderCapabilities, isManualBrand } from '../provider-capabilities';
import type { LockBrand } from '../types';

export interface ManualGeneratePinInput {
  deviceId: string;
  brand: LockBrand;
  providerType: 'api' | 'manual';
  externalDeviceId?: string | null;
  oauthAccountId?: string | null;
  validFrom: Date;
  validTo: Date;
  manualPin?: string;
  autoGenerate?: boolean;
}

export interface ManualGeneratePinResult {
  pin: string;
  source: 'manual' | 'api';
  codeType: 'online_pin' | 'offline_pin' | 'manual';
  warnings?: string[];
}

export async function generatePin(input: ManualGeneratePinInput): Promise<ManualGeneratePinResult> {
  const capabilities = getProviderCapabilities(input.brand);
  const warnings: string[] = [];

  if (!isManualBrand(input.brand) && input.autoGenerate) {
    throw new Error('API_PROVIDER_MANUAL_FALLBACK_NOT_ALLOWED');
  }

  if (!isManualBrand(input.brand) && input.providerType !== 'manual') {
    throw new Error('API_PROVIDER_REQUIRES_REAL_PROVIDER');
  }

  const usesHashSuffix = input.brand === 'ttlock';
  const suffix = usesHashSuffix ? '#' : '';

  if (input.manualPin && input.manualPin.trim().length >= 4) {
    const pin = input.manualPin.trim();
    if (!/^[0-9A-Za-z#*]+$/.test(pin)) throw new Error('PIN_INVALID_CHARACTERS');
    if (pin.length > 12) throw new Error('PIN_TOO_LONG');

    const finalPin = usesHashSuffix && !pin.endsWith('#') ? `${pin}#` : pin;
    warnings.push(
      isManualBrand(input.brand)
        ? 'PIN fornecido pelo host; confirme que o código foi cadastrado na fechadura antes de enviá-lo ao hóspede.'
        : `PIN fornecido manualmente para ${input.brand}; o Zélla não confirma sua validade no hardware.`,
    );

    return {
      pin: finalPin,
      source: 'manual',
      codeType: capabilities.apiAvailable ? 'online_pin' : 'manual',
      warnings,
    };
  }

  if (input.autoGenerate) {
    const pin = generateRandomPin(6, suffix);
    warnings.push(`PIN gerado automaticamente (${pin}). Cadastre-o fisicamente na fechadura antes da entrega.`);
    return { pin, source: 'manual', codeType: 'manual', warnings };
  }

  throw new Error('MANUAL_PIN_REQUIRED');
}
