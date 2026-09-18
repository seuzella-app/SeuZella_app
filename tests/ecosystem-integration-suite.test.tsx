import { describe, it, expect } from 'vitest';
import { MOCK_POUSADA_OVERVIEW, MOCK_POUSADA_ROOMS } from '../src/lib/ddc/mock-data-pousada';
import { MOCK_AIRBNB_OVERVIEW, MOCK_AIRBNB_PROPERTIES } from '../src/lib/ddc/mock-data-airbnb';
import { MOCK_SHARED_NOTIFICATIONS, MOCK_SHARED_WHATSAPP_CONVERSATIONS } from '../src/lib/ddc/mock-data-shared';
import { generateWelcomeEmailHtml } from '../src/lib/email-templates/welcome-email';
import { validateCheckoutInput } from '../src/lib/checkout/checkout-validator';
import { generateCheckoutSignature, verifyCheckoutSignature } from '../src/lib/checkout/checkout-security';

// P0 (RUN 4 — Wave 4A): assinaturas de checkout são fail-closed e exigem segredo
// de configuração ≥32 chars. Esta suíte dependia implicitamente do fallback
// inseguro removido; agora define explicitamente um segredo de teste.
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? 'integration-suite-test-secret-0123456789abcdef';

describe('🌐 Ecossistema Seu Zélla — Integration & Ready-to-Replace Data Suite', () => {
  it('should validate Pousada mock data bank with TODO(REAL) integrity', () => {
    expect(MOCK_POUSADA_OVERVIEW.occupancyRate).toBeGreaterThan(0);
    expect(MOCK_POUSADA_OVERVIEW.totalRevenue).toBeGreaterThan(0);
    expect(MOCK_POUSADA_ROOMS.length).toBeGreaterThan(0);
    expect(MOCK_POUSADA_ROOMS[0].dailyRate).toBeDefined();
  });

  it('should validate Airbnb mock data bank with TODO(REAL) integrity', () => {
    expect(MOCK_AIRBNB_OVERVIEW.totalProperties).toBeGreaterThan(0);
    expect(MOCK_AIRBNB_OVERVIEW.totalRevenue).toBeGreaterThan(0);
    expect(MOCK_AIRBNB_PROPERTIES.length).toBeGreaterThan(0);
    expect(MOCK_AIRBNB_PROPERTIES[0].location).toBeDefined();
  });

  it('should validate Shared Notifications and WhatsApp Conversations stream', () => {
    expect(MOCK_SHARED_NOTIFICATIONS.length).toBeGreaterThan(0);
    expect(MOCK_SHARED_NOTIFICATIONS[0].type).toBe('pix');
    expect(MOCK_SHARED_WHATSAPP_CONVERSATIONS.length).toBeGreaterThan(0);
    expect(MOCK_SHARED_WHATSAPP_CONVERSATIONS[0].senderName).toBeDefined();
  });

  it('should generate valid Welcome Email HTML with target DDC links', () => {
    const htmlPousada = generateWelcomeEmailHtml({
      customerName: 'Roberto Silva',
      customerEmail: 'roberto@pousadaserenity.com.br',
      niche: 'pousada',
      planTier: 'pro',
      magicLoginUrl: 'https://smart-hotel-zehla.vercel.app/ddc/pousada',
    });

    expect(htmlPousada).toContain('Roberto Silva');
    expect(htmlPousada).toContain('https://smart-hotel-zehla.vercel.app/ddc/pousada');
    expect(htmlPousada).toContain('Pousada');

    const htmlAirbnb = generateWelcomeEmailHtml({
      customerName: 'Ana Paula',
      customerEmail: 'ana@flats.com',
      niche: 'airbnb',
      planTier: 'max',
      magicLoginUrl: 'https://smart-hotel-zehla.vercel.app/ddc/airbnb',
    });

    expect(htmlAirbnb).toContain('Ana Paula');
    expect(htmlAirbnb).toContain('https://smart-hotel-zehla.vercel.app/ddc/airbnb');
  });

  it('should validate checkout input validation engine', () => {
    const invalidResult = validateCheckoutInput({
      customerName: 'A',
      customerEmail: 'invalid-email',
      customerPhone: '123',
    });

    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.customerName).toBeDefined();
    expect(invalidResult.errors.customerEmail).toBeDefined();

    const validResult = validateCheckoutInput({
      customerName: 'Roberto Silva',
      customerEmail: 'roberto@pousada.com.br',
      customerPhone: '(11) 98765-4321',
      niche: 'pousada',
      planType: 'pro',
    });

    expect(validResult.valid).toBe(true);
    expect(Object.keys(validResult.errors).length).toBe(0);
  });

  it('should generate and verify HMAC checkout security signatures with anti-replay', () => {
    const subId = 'sub_12345';
    const tenantId = 'tenant_9988';
    const timestamp = Date.now();

    const sig = generateCheckoutSignature(subId, tenantId, timestamp);
    expect(sig).toBeDefined();
    expect(sig.length).toBe(64);

    const isValid = verifyCheckoutSignature(subId, tenantId, timestamp, sig);
    expect(isValid).toBe(true);

    // Expired timestamp (older than 30 min)
    const expiredTimestamp = timestamp - 2000000;
    const expiredSig = generateCheckoutSignature(subId, tenantId, expiredTimestamp);
    const isExpiredValid = verifyCheckoutSignature(subId, tenantId, expiredTimestamp, expiredSig);
    expect(isExpiredValid).toBe(false);
  });
});
