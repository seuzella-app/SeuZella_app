// ============================================================================
// CRMMock — Digital Twin CRM (RD Station / HubSpot equivalent)
// ----------------------------------------------------------------------------
// Persists leads in-memory, computes lead scores from behavioral signals.
// ============================================================================

import type {
  ICRMAdapter,
  CRMLeadInput,
  CRMLead,
  CRMStageUpdateInput,
  CRMQueryOpts,
} from '../interfaces';
import { mulberry32, seedFromString, beta } from './_stats';

class CRMMock implements ICRMAdapter {
  private leads = new Map<string, CRMLead>();
  private stageHistory: { leadId: string; stage: CRMLead['stage']; at: string; note?: string }[] = [];

  async createLead(input: CRMLeadInput): Promise<CRMLead> {
    const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const lead: CRMLead = {
      leadId,
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      personaId: input.personaId,
      city: input.city,
      state: input.state,
      niche: input.niche,
      stage: 'new',
      score: 30, // initial score
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };
    this.leads.set(leadId, lead);
    return lead;
  }

  async updateStage(input: CRMStageUpdateInput): Promise<CRMLead> {
    const lead = this.leads.get(input.leadId);
    if (!lead) throw new Error(`Lead ${input.leadId} not found`);
    const updated: CRMLead = {
      ...lead,
      stage: input.newStage,
      updatedAt: new Date().toISOString(),
    };
    this.leads.set(input.leadId, updated);
    this.stageHistory.push({
      leadId: input.leadId,
      stage: input.newStage,
      at: updated.updatedAt,
      note: input.note,
    });
    return updated;
  }

  async listLeads(opts: CRMQueryOpts): Promise<CRMLead[]> {
    let results = Array.from(this.leads.values());
    if (opts.tenantId) results = results.filter((l) => l.tenantId === opts.tenantId);
    if (opts.stage) results = results.filter((l) => l.stage === opts.stage);
    if (opts.source) results = results.filter((l) => l.source === opts.source);
    if (opts.from) results = results.filter((l) => l.createdAt >= opts.from!);
    if (opts.to) results = results.filter((l) => l.createdAt <= opts.to!);
    if (opts.limit) results = results.slice(0, opts.limit);
    return results;
  }

  async scoreLead(leadId: string): Promise<number> {
    const lead = this.leads.get(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);
    // Score = base + source lift + stage lift + persona lift.
    const sourceLift: Record<CRMLead['source'], number> = {
      google_ads: 15,
      meta_ads: 10,
      referral: 20,
      organic: 12,
      whatsapp: 18,
      direct: 8,
    };
    const stageLift: Record<CRMLead['stage'], number> = {
      new: 0,
      contacted: 10,
      qualified: 25,
      proposal: 40,
      won: 50,
      lost: -30,
    };
    const personaLift = lead.personaId === 'impulsive' ? 15 :
                        lead.personaId === 'price-only' ? -5 :
                        lead.personaId === 'skeptical' ? -10 :
                        lead.personaId === 'chain' ? 20 :
                        lead.personaId === 'airbnb' ? 5 : 0;

    // Add a small deterministic jitter so scores look organic.
    const jitter = Math.floor(beta(mulberry32(seedFromString(leadId)), 4, 4) * 10 - 5);
    const score = Math.max(0, Math.min(100, 30 + sourceLift[lead.source] + stageLift[lead.stage] + personaLift + jitter));
    const updated = { ...lead, score, updatedAt: new Date().toISOString() };
    this.leads.set(leadId, updated);
    return score;
  }

  isDigitalTwin(): boolean {
    return true;
  }

  /** Test/observability helper. */
  getStageHistory(leadId: string) {
    return this.stageHistory.filter((h) => h.leadId === leadId);
  }
}

export const crmMock = new CRMMock();
