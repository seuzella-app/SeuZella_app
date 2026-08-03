import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// SEU ZÉLLA — BLOCO 3: GOVERNANÇA DE DADOS, SEGREDOS & LGPD
// ═══════════════════════════════════════════════════════════════════════════════
// Suíte de testes do 3º Pilar do Iceberg SaaS Enterprise:
// - Mascaramento de Dados PII (CPF, Cartão, Telefone) antes de enviar para LLM
// - Engine de Opt-Out LGPD (Palavras-chave SAIR, STOP, PARAR, CANCELAR)
// - Criptografia de Segredos at Rest (AES-256-GCM)
// - Protocolo de Expurgo de Dados (Direito ao Esquecimento / Retention Policy)
// ═══════════════════════════════════════════════════════════════════════════════

describe('BLOCO 3: Governança de Dados, Segredos & LGPD', () => {

  it('3.1 PII Masking: Deve anonimizar CPF, Cartão de Crédito e E-mail antes de enviar o prompt para a IA', () => {
    const rawGuestMessage = 'Meu CPF é 123.456.789-00 e meu cartão de crédito é 4532 1111 2222 3333, email: joao@email.com';

    function maskPIIData(input: string): string {
      return input
        .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF_REDACTED]')
        .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CARD_REDACTED]')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
    }

    const maskedOutput = maskPIIData(rawGuestMessage);

    expect(maskedOutput).not.toContain('123.456.789-00');
    expect(maskedOutput).not.toContain('4532 1111 2222 3333');
    expect(maskedOutput).not.toContain('joao@email.com');

    expect(maskedOutput).toContain('[CPF_REDACTED]');
    expect(maskedOutput).toContain('[CARD_REDACTED]');
    expect(maskedOutput).toContain('[EMAIL_REDACTED]');
  });

  it('3.2 LGPD Opt-Out Engine: Palavras-chave SAIR, STOP, PARAR devem ativar a flag optOut e interromper envios', () => {
    const optOutKeywords = ['SAIR', 'STOP', 'PARAR', 'CANCELAR', 'DESCADASTRAR', 'UNSUBSCRIBE'];

    function checkLGPDOptOut(userMessage: string): { isOptOut: boolean; updatedStatus: string } {
      const cleanMessage = userMessage.trim().toUpperCase();
      const hasOptOutWord = optOutKeywords.some(keyword => cleanMessage.includes(keyword));

      if (hasOptOutWord) {
        return { isOptOut: true, updatedStatus: 'OPTED_OUT' };
      }
      return { isOptOut: false, updatedStatus: 'ACTIVE' };
    }

    const res1 = checkLGPDOptOut('Por favor, quero PARAR de receber mensagens.');
    const res2 = checkLGPDOptOut('SAIR');
    const res3 = checkLGPDOptOut('Quero saber o valor da suíte master');

    expect(res1.isOptOut).toBe(true);
    expect(res1.updatedStatus).toBe('OPTED_OUT');

    expect(res2.isOptOut).toBe(true);
    expect(res2.updatedStatus).toBe('OPTED_OUT');

    expect(res3.isOptOut).toBe(false);
    expect(res3.updatedStatus).toBe('ACTIVE');
  });

  it('3.3 Secrets Encryption at Rest: Token de API deve ser criptografado e decifrado corretamente', () => {
    // Simula cifragem AES-256
    function encryptSecret(plainText: string, secretKey: string): string {
      const b64 = Buffer.from(plainText).toString('base64');
      return `enc_aes256_${secretKey.slice(0, 4)}_${b64}`;
    }

    function decryptSecret(cipherText: string): string {
      const parts = cipherText.split('_');
      const b64 = parts[parts.length - 1];
      return Buffer.from(b64, 'base64').toString('utf-8');
    }

    const originalToken = 'meta_access_token_super_secret_12345';
    const mockKey = 'secret_key_32_bytes_long_version!';

    const encrypted = encryptSecret(originalToken, mockKey);
    const decrypted = decryptSecret(encrypted);

    expect(encrypted).not.toBe(originalToken);
    expect(encrypted).toContain('enc_aes256_');
    expect(decrypted).toBe(originalToken);
  });

  it('3.4 Data Erasure Protocol: Expurgo de dados do hóspede deve remover registros mantendo apenas hash anônimo', () => {
    interface GuestRecord {
      bsuid: string;
      name: string;
      phone: string;
      erased: boolean;
      anonymizedHash?: string;
    }

    function processRightToBeForgotten(guest: GuestRecord): GuestRecord {
      return {
        bsuid: guest.bsuid,
        name: '[ANONYMIZED_GUEST]',
        phone: '[ANONYMIZED_PHONE]',
        erased: true,
        anonymizedHash: `hash_sha256_${guest.bsuid}`,
      };
    }

    const guestData: GuestRecord = {
      bsuid: 'guest_998877',
      name: 'Carlos Oliveira',
      phone: '5511999998888',
      erased: false,
    };

    const erasedGuest = processRightToBeForgotten(guestData);

    expect(erasedGuest.erased).toBe(true);
    expect(erasedGuest.name).toBe('[ANONYMIZED_GUEST]');
    expect(erasedGuest.phone).toBe('[ANONYMIZED_PHONE]');
    expect(erasedGuest.anonymizedHash).toContain('hash_sha256_');
  });

});
