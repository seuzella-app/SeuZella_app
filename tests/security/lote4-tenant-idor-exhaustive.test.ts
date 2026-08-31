import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('🛡️ LOTE 4: Exhaustive Multi-Tenant IDOR Protection Suite', () => {
  describe('1. Properties Endpoint IDOR Hardening (/api/properties/[id])', () => {
    it('enforces tenantId check in findFirst and binds update/delete to existing.id', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/properties/[id]/route.ts'), 'utf8');
      expect(src).toContain('where: { id, tenantId: session.user.tenantId, status: \'active\' }');
      expect(src).toContain('where: { id, tenantId: session.user.tenantId }');
      expect(src).toContain('where: { id: existing.id }');
      expect(src).not.toMatch(/airBProperty\.update\(\{\s*where:\s*\{\s*id\s*\}\s*,/);
    });
  });

  describe('2. Targets Endpoint IDOR Hardening (/api/targets/[id])', () => {
    it('enforces tenantId check in findFirst and binds update/delete to existing.id', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/targets/[id]/route.ts'), 'utf8');
      expect(src).toContain('where: { id, tenantId: session.user.tenantId }');
      expect(src).toContain('where: { id: existing.id }');
      expect(src).not.toMatch(/target\.update\(\{\s*where:\s*\{\s*id\s*\}\s*,/);
      expect(src).not.toMatch(/target\.delete\(\{\s*where:\s*\{\s*id\s*\}\s*\}\)/);
    });
  });

  describe('3. Campaigns Endpoint IDOR Hardening (/api/campaigns/[id])', () => {
    it('enforces tenantId check in findFirst and binds update/delete to existing.id', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/campaigns/[id]/route.ts'), 'utf8');
      expect(src).toContain('where: { id, tenantId }');
      expect(src).toContain('where: { id: existing.id }');
      expect(src).not.toMatch(/campaign\.update\(\{\s*where:\s*\{\s*id\s*\}\s*,/);
      expect(src).not.toMatch(/campaign\.delete\(\{\s*where:\s*\{\s*id\s*\}\s*\}\)/);
    });
  });

  describe('4. Leads Endpoint IDOR Hardening (/api/leads/[id])', () => {
    it('enforces tenantId check in findFirst and binds update/delete to existing.id', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/leads/[id]/route.ts'), 'utf8');
      expect(src).toContain('where: { id, tenantId }');
      expect(src).toContain('where: { id: existing.id }');
      expect(src).not.toMatch(/lead\.update\(\{\s*where:\s*\{\s*id\s*\}\s*,/);
      expect(src).not.toMatch(/lead\.delete\(\{\s*where:\s*\{\s*id\s*\}\s*\}\)/);
    });
  });

  describe('5. DDC Training Prompt IDOR Hardening (/api/ddc/training/[id])', () => {
    it('enforces tenantId check in findFirst and binds update, delete and test to verified id', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/ddc/training/[id]/route.ts'), 'utf8');
      expect(src).toContain('where: { id, tenantId: g }');
      expect(src).toContain('where: { id: existing.id }');
      expect(src).toContain('where: { id: training.id }');
      expect(src).not.toMatch(/trainingPrompt\.update\(\{\s*where:\s*\{\s*id\s*\}\s*,/);
    });
  });

  describe('6. DDC Guest Guide IDOR Hardening (/api/ddc/guest-guide)', () => {
    it('resolves authenticated tenantId and enforces ownership for all CRUD operations', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/ddc/guest-guide/route.ts'), 'utf8');
      expect(src).toContain('const authenticatedTenantId = await resolveTenantId()');
      expect(src).toContain('where: { id: guideId, tenantId: authenticatedTenantId }');
      expect(src).toContain('where: { id: existing.id }');
      expect(src).toContain('where: { id: guide.id }');
      expect(src).not.toMatch(/guestGuide\.update\(\{\s*where:\s*\{\s*id:\s*guideId\s*\}\s*,/);
      expect(src).not.toMatch(/guestGuide\.delete\(\{\s*where:\s*\{\s*id:\s*guideId\s*\}\s*\}\)/);
    });
  });

  describe('7. DDC Dynamic Pricing IDOR Hardening (/api/ddc/dynamic-pricing)', () => {
    it('verifies tenant ownership before update and delete on dynamic pricing rules', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/ddc/dynamic-pricing/route.ts'), 'utf8');
      expect(src).toContain('where: { id: ruleId, tenantId }');
      expect(src).toContain('where: { id: existing.id }');
      expect(src).toContain('where: { id: rule.id }');
      expect(src).not.toMatch(/dynamicPricingRule\.update\(\{\s*where:\s*\{\s*id:\s*ruleId\s*\}\s*,/);
    });
  });

  describe('8. DDC Notifications IDOR Hardening (/api/ddc/notifications)', () => {
    it('verifies notification belongs to tenantId before updating read status', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/ddc/notifications/route.ts'), 'utf8');
      expect(src).toContain('where: { id: notificationId, tenantId }');
      expect(src).toContain('where: { id: existing.id }');
      expect(src).not.toMatch(/notification\.update\(\{\s*where:\s*\{\s*id:\s*notificationId\s*\}\s*,/);
    });
  });

  describe('9. DDC AirB Onboarding IDOR Hardening (/api/ddc/airb/onboarding)', () => {
    it('verifies property ownership for tenant in all onboarding actions', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/ddc/airb/onboarding/route.ts'), 'utf8');
      expect(src).toContain('where: { id: propertyId, tenantId }');
      expect(src).toContain('where: { id: property.id }');
      expect(src).not.toMatch(/airBProperty\.update\(\{\s*where:\s*\{\s*id:\s*propertyId\s*\}\s*,/);
    });
  });

  describe('10. DDC Conversation Escalation IDOR Hardening (/api/ddc/conversations/[id]/escalate)', () => {
    it('verifies conversation belongs to tenant before escalating', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/app/api/ddc/conversations/[id]/escalate/route.ts'), 'utf8');
      expect(src).toContain('where: { id, tenantId }');
      expect(src).toContain('where: { id: conversation.id }');
      expect(src).not.toContain('findUnique({');
    });
  });
});
