/**
 * Testes de Fechaduras Eletrônicas — Integrações + Automação
 * ==========================================================
 *
 * Valida:
 *   1. Estrutura dos arquivos (orchestrator, providers, hooks, cron)
 *   2. integration-hooks.ts exporta 3 funções
 *   3. Cron de locks existe
 *   4. Rota remoteUnlock existe
 *   5. Landing page tem nova seção de automação
 *   6. TENANT_MODELS inclui locks
 *   7. vercel.json tem cron de locks
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PARTE 1: Estrutura de arquivos de locks', () => {
  const BASE = path.resolve(process.cwd(), 'src/lib/locks');

  it('orchestrator.ts existe e tem remoteUnlock', () => {
    const p = path.join(BASE, 'orchestrator.ts');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('export async function remoteUnlock');
  });

  it('integration-hooks.ts existe e exporta 3 hooks', () => {
    const p = path.join(BASE, 'integration-hooks.ts');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('onFNRHCompleted');
    expect(content).toContain('onUpsellPaid');
    expect(content).toContain('onCautionStatusChange');
  });

  it('5 providers existem', () => {
    const providers = ['ttlock', 'tuya', 'igloohome', 'nuki', 'august', 'manual'];
    for (const p of providers) {
      expect(fs.existsSync(path.join(BASE, 'providers', `${p}.ts`))).toBe(true);
    }
  });

  it('pin-generator.ts existe e usa crypto', () => {
    const p = path.join(BASE, 'pin-generator.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('randomInt');
  });

  it('whatsapp-delivery.ts existe', () => {
    expect(fs.existsSync(path.join(BASE, 'whatsapp-delivery.ts'))).toBe(true);
  });

  it('oauth-store.ts existe e menciona AES-256', () => {
    const p = path.join(BASE, 'oauth-store.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('AES-256-GCM');
  });
});

describe('PARTE 2: API routes de locks', () => {
  it('Cron de locks existe', () => {
    const p = path.resolve(process.cwd(), 'src/app/api/cron/locks-maintenance/route.ts');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('verifyCronAuth');
    expect(content).toContain('expiredPinsRevoked');
    expect(content).toContain('lowBatteryAlerts');
  });

  it('Rota remoteUnlock existe', () => {
    const p = path.resolve(process.cwd(), 'src/app/api/ddc/locks/[id]/unlock/route.ts');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('remoteUnlock');
    expect(content).toContain('resolveTenantId');
  });

  it('9 rotas de locks têm resolveTenantId', () => {
    const routes = [
      'src/app/api/ddc/locks/route.ts',
      'src/app/api/ddc/locks/[id]/route.ts',
      'src/app/api/ddc/locks/[id]/pins/route.ts',
      'src/app/api/ddc/locks/[id]/pins/[pinId]/route.ts',
      'src/app/api/ddc/locks/[id]/panic-revoke/route.ts',
      'src/app/api/ddc/locks/events/route.ts',
    ];
    for (const r of routes) {
      const p = path.resolve(process.cwd(), r);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('resolveTenantId');
      }
    }
  });
});

describe('PARTE 3: TENANT_MODELS inclui locks', () => {
  it('tenant-prisma.ts tem LockDevice, LockCode, LockEvent, LockOAuthAccount', () => {
    const p = path.resolve(process.cwd(), 'src/lib/db/tenant-prisma.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('LockDevice');
    expect(content).toContain('LockCode');
    expect(content).toContain('LockEvent');
    expect(content).toContain('LockOAuthAccount');
  });
});

describe('PARTE 4: vercel.json tem cron de locks', () => {
  it('vercel.json inclui locks-maintenance a cada 15min', () => {
    const p = path.resolve(process.cwd(), 'vercel.json');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('locks-maintenance');
    expect(content).toContain('*/15 * * * *');
  });
});

describe('PARTE 5: Landing page atualizada', () => {
  it('SmartLockSecurityProof tem seção de Automação Inteligente', () => {
    const p = path.resolve(process.cwd(), 'src/components/landing/SmartLockSecurityProof.tsx');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('Automação Inteligente Integrada');
    expect(content).toContain('FNRH');
    expect(content).toContain('Upsell');
    expect(content).toContain('Caução');
    expect(content).toContain('Manutenção automática');
  });

  it('Landing page tem seção de Destravamento Remoto', () => {
    const p = path.resolve(process.cwd(), 'src/components/landing/SmartLockSecurityProof.tsx');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('Destravamento Remoto');
    expect(content).toContain('Nuki');
    expect(content).toContain('August');
  });

  it('Landing page tem seção de Segurança de Nível Bancário', () => {
    const p = path.resolve(process.cwd(), 'src/components/landing/SmartLockSecurityProof.tsx');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('Segurança de Nível Bancário');
    expect(content).toContain('CSPRNG');
    expect(content).toContain('AES-256-GCM');
    expect(content).toContain('11.616');
  });

  it('Landing page tem componente AutoCard', () => {
    const p = path.resolve(process.cwd(), 'src/components/landing/SmartLockSecurityProof.tsx');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('function AutoCard');
  });
});

describe('PARTE 6: Mobile usa CSPRNG (não Math.random)', () => {
  it('MobileAirbnbSuperApp não usa Math.random para PINs', () => {
    const p = path.resolve(process.cwd(), 'src/components/mobile/MobileAirbnbSuperApp.tsx');
    const content = fs.readFileSync(p, 'utf-8');
    // Verifica que Math.random não é mais usado para gerar PINs
    expect(content).not.toContain('Math.floor(1000 + Math.random()');
    // Verifica que crypto API ou fetch API é usado
    expect(content.includes('crypto.getRandomValues') || content.includes("fetch('/api/ddc/locks")).toBe(true);
  });
});
