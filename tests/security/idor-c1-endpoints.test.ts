import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as propertiesRoute from '@/app/api/properties/[id]/route';
import * as targetsRoute from '@/app/api/targets/[id]/route';
import * as conversationsRoute from '@/app/api/ddc/conversations/[id]/route';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { resolveTenantId } from '@/lib/ddc/ddc-mapper';
import { apiRatelimit } from '@/lib/rate-limit';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/ddc/ddc-mapper', () => ({
  resolveTenantId: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRatelimit: {
    limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
  },
  authRatelimit: {
    limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
  },
}));

vi.mock('@/lib/db', () => {
  return {
    db: {
      airBProperty: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      target: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      conversationLog: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe('DELTA-2 / C1 — Multi-Tenant IDOR Protection Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. PROPERTIES ([id])
  // ===========================================================================
  describe('Properties [id] endpoint', () => {
    it('1. GET: blocks unauthenticated requests with 401', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/properties/prop_1');
      const res = await propertiesRoute.GET(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(401);
    });

    it('2. GET: returns property when accessed by authorized tenant', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_A' } } as any);
      vi.mocked(db.airBProperty.findFirst).mockResolvedValueOnce({ id: 'prop_1', tenantId: 'tenant_A', name: 'Casa 1' } as any);

      const req = new NextRequest('http://localhost/api/properties/prop_1');
      const res = await propertiesRoute.GET(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.property.id).toBe('prop_1');
      expect(db.airBProperty.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'prop_1', tenantId: 'tenant_A', status: 'active' }),
        })
      );
    });

    it('3. GET: blocks adversary tenant B accessing property of tenant A with 404', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_B' } } as any);
      vi.mocked(db.airBProperty.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/properties/prop_1');
      const res = await propertiesRoute.GET(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(404);
      expect(db.airBProperty.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'prop_1', tenantId: 'tenant_B', status: 'active' }),
        })
      );
    });

    it('4. PUT: blocks unauthenticated requests with 401', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/properties/prop_1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Hack Name' }),
      });
      const res = await propertiesRoute.PUT(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(401);
    });

    it('5. PUT: allows update by authorized tenant owner', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_A' } } as any);
      vi.mocked(db.airBProperty.findFirst).mockResolvedValueOnce({ id: 'prop_1', tenantId: 'tenant_A' } as any);
      vi.mocked(db.airBProperty.update).mockResolvedValueOnce({ id: 'prop_1', name: 'Novo Nome' } as any);

      const req = new NextRequest('http://localhost/api/properties/prop_1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Novo Nome' }),
      });
      const res = await propertiesRoute.PUT(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(200);
      expect(db.airBProperty.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prop_1' },
          data: expect.objectContaining({ name: 'Novo Nome' }),
        })
      );
    });

    it('6. PUT: blocks cross-tenant update and does NOT mutate resource', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_B' } } as any);
      vi.mocked(db.airBProperty.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/properties/prop_1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Malicious Name' }),
      });
      const res = await propertiesRoute.PUT(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(404);
      expect(db.airBProperty.update).not.toHaveBeenCalled();
    });

    it('7. PUT: ignores forged tenantId injected in body payload', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_A' } } as any);
      vi.mocked(db.airBProperty.findFirst).mockResolvedValueOnce({ id: 'prop_1', tenantId: 'tenant_A' } as any);
      vi.mocked(db.airBProperty.update).mockResolvedValueOnce({ id: 'prop_1' } as any);

      const req = new NextRequest('http://localhost/api/properties/prop_1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Legit', tenantId: 'tenant_FORGED' }),
      });
      const res = await propertiesRoute.PUT(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(200);
      expect(db.airBProperty.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ tenantId: 'tenant_FORGED' }),
        })
      );
    });

    it('8. DELETE: blocks unauthenticated delete with 401', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/properties/prop_1', { method: 'DELETE' });
      const res = await propertiesRoute.DELETE(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(401);
    });

    it('9. DELETE: allows soft delete by authorized tenant', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_A' } } as any);
      vi.mocked(db.airBProperty.findFirst).mockResolvedValueOnce({ id: 'prop_1', tenantId: 'tenant_A' } as any);
      vi.mocked(db.airBProperty.update).mockResolvedValueOnce({ id: 'prop_1', status: 'inactive' } as any);

      const req = new NextRequest('http://localhost/api/properties/prop_1', { method: 'DELETE' });
      const res = await propertiesRoute.DELETE(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(200);
      expect(db.airBProperty.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prop_1' },
          data: { status: 'inactive' },
        })
      );
    });

    it('10. DELETE: blocks cross-tenant deletion with 404 and does not mutate', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_B' } } as any);
      vi.mocked(db.airBProperty.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/properties/prop_1', { method: 'DELETE' });
      const res = await propertiesRoute.DELETE(req, { params: Promise.resolve({ id: 'prop_1' }) });
      expect(res.status).toBe(404);
      expect(db.airBProperty.update).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 2. TARGETS ([id])
  // ===========================================================================
  describe('Targets [id] endpoint', () => {
    it('11. GET: blocks unauthenticated requests with 401', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req = new Request('http://localhost/api/targets/tgt_1');
      const res = await targetsRoute.GET(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(401);
    });

    it('12. GET: returns target when accessed by owner tenant', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_A' } } as any);
      vi.mocked(db.target.findFirst).mockResolvedValueOnce({
        id: 'tgt_1',
        tenantId: 'tenant_A',
        name: 'Target 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const req = new Request('http://localhost/api/targets/tgt_1');
      const res = await targetsRoute.GET(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(200);
      expect(db.target.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tgt_1', tenantId: 'tenant_A' },
        })
      );
    });

    it('13. GET: blocks adversary tenant B with 404', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_B' } } as any);
      vi.mocked(db.target.findFirst).mockResolvedValueOnce(null);

      const req = new Request('http://localhost/api/targets/tgt_1');
      const res = await targetsRoute.GET(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(404);
      expect(db.target.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tgt_1', tenantId: 'tenant_B' },
        })
      );
    });

    it('14. PUT: blocks unauthenticated request with 401', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req = new Request('http://localhost/api/targets/tgt_1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Hacked' }),
      });
      const res = await targetsRoute.PUT(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(401);
    });

    it('15. PUT: allows update by authorized tenant owner', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_A' } } as any);
      vi.mocked(db.target.findFirst).mockResolvedValueOnce({ id: 'tgt_1', tenantId: 'tenant_A' } as any);
      vi.mocked(db.target.update).mockResolvedValueOnce({
        id: 'tgt_1',
        name: 'Atualizado',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const req = new Request('http://localhost/api/targets/tgt_1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Atualizado' }),
      });
      const res = await targetsRoute.PUT(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(200);
      expect(db.target.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tgt_1' },
          data: expect.objectContaining({ name: 'Atualizado' }),
        })
      );
    });

    it('16. PUT: blocks cross-tenant update with 404 and does not mutate', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_B' } } as any);
      vi.mocked(db.target.findFirst).mockResolvedValueOnce(null);

      const req = new Request('http://localhost/api/targets/tgt_1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Malicious' }),
      });
      const res = await targetsRoute.PUT(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(404);
      expect(db.target.update).not.toHaveBeenCalled();
    });

    it('17. DELETE: blocks unauthenticated delete with 401', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      const req = new Request('http://localhost/api/targets/tgt_1', { method: 'DELETE' });
      const res = await targetsRoute.DELETE(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(401);
    });

    it('18. DELETE: allows delete by authorized tenant', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_A' } } as any);
      vi.mocked(db.target.findFirst).mockResolvedValueOnce({ id: 'tgt_1', tenantId: 'tenant_A' } as any);
      vi.mocked(db.target.delete).mockResolvedValueOnce({ id: 'tgt_1' } as any);

      const req = new Request('http://localhost/api/targets/tgt_1', { method: 'DELETE' });
      const res = await targetsRoute.DELETE(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(200);
      expect(db.target.delete).toHaveBeenCalledWith({ where: { id: 'tgt_1' } });
    });

    it('19. DELETE: blocks cross-tenant deletion with 404 and does not delete', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { tenantId: 'tenant_B' } } as any);
      vi.mocked(db.target.findFirst).mockResolvedValueOnce(null);

      const req = new Request('http://localhost/api/targets/tgt_1', { method: 'DELETE' });
      const res = await targetsRoute.DELETE(req, { params: Promise.resolve({ id: 'tgt_1' }) });
      expect(res.status).toBe(404);
      expect(db.target.delete).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 3. CONVERSATIONS ([id])
  // ===========================================================================
  describe('DDC Conversations [id] endpoint', () => {
    it('20. GET: blocks unauthenticated request with 401', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce(null as any);
      const req = new NextRequest('http://localhost/api/ddc/conversations/conv_1');
      const res = await conversationsRoute.GET(req, { params: Promise.resolve({ id: 'conv_1' }) });
      expect(res.status).toBe(401);
    });

    it('21. GET: returns conversation when accessed by owning tenant', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_A');
      vi.mocked(db.conversationLog.findFirst).mockResolvedValueOnce({
        id: 'conv_1',
        tenantId: 'tenant_A',
        messages: [],
      } as any);

      const req = new NextRequest('http://localhost/api/ddc/conversations/conv_1');
      const res = await conversationsRoute.GET(req, { params: Promise.resolve({ id: 'conv_1' }) });
      expect(res.status).toBe(200);
      expect(db.conversationLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_1', tenantId: 'tenant_A' },
        })
      );
    });

    it('22. GET: blocks adversary tenant B with 404', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_B');
      vi.mocked(db.conversationLog.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/ddc/conversations/conv_1');
      const res = await conversationsRoute.GET(req, { params: Promise.resolve({ id: 'conv_1' }) });
      expect(res.status).toBe(404);
      expect(db.conversationLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_1', tenantId: 'tenant_B' },
        })
      );
    });

    it('23. PATCH: blocks unauthenticated request with 401', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce(null as any);
      const req = new NextRequest('http://localhost/api/ddc/conversations/conv_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
      });
      const res = await conversationsRoute.PATCH(req, { params: Promise.resolve({ id: 'conv_1' }) });
      expect(res.status).toBe(401);
    });

    it('24. PATCH: allows update by owning tenant', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_A');
      vi.mocked(db.conversationLog.findFirst).mockResolvedValueOnce({
        id: 'conv_1',
        tenantId: 'tenant_A',
      } as any);
      vi.mocked(db.conversationLog.update).mockResolvedValueOnce({
        id: 'conv_1',
        status: 'resolved',
      } as any);

      const req = new NextRequest('http://localhost/api/ddc/conversations/conv_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
      });
      const res = await conversationsRoute.PATCH(req, { params: Promise.resolve({ id: 'conv_1' }) });
      expect(res.status).toBe(200);
      expect(db.conversationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv_1' },
          data: expect.objectContaining({ status: 'resolved' }),
        })
      );
    });

    it('25. PATCH: blocks cross-tenant modification with 404 and does not mutate', async () => {
      vi.mocked(resolveTenantId).mockResolvedValueOnce('tenant_B');
      vi.mocked(db.conversationLog.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/ddc/conversations/conv_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
      });
      const res = await conversationsRoute.PATCH(req, { params: Promise.resolve({ id: 'conv_1' }) });
      expect(res.status).toBe(404);
      expect(db.conversationLog.update).not.toHaveBeenCalled();
    });
  });
});
