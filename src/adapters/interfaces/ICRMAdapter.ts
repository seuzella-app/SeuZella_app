// ============================================================================
// ICRMAdapter — contract for CRM integrations (RD Station, HubSpot, etc.)
// ============================================================================

export interface CRMLeadInput {
  /** The Zélla tenant this lead belongs to. */
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  source: 'google_ads' | 'meta_ads' | 'organic' | 'referral' | 'whatsapp' | 'direct';
  /** The persona classification assigned by the Behavioral Engine. */
  personaId?: string;
  /** Geo (city, state) used by the Market Intelligence Cortex. */
  city?: string;
  state?: string;
  niche: 'pousada' | 'airbnb' | 'hotel' | 'small-hotel';
  metadata?: Record<string, unknown>;
}

export interface CRMLead {
  leadId: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  source: CRMLeadInput['source'];
  personaId?: string;
  city?: string;
  state?: string;
  niche: CRMLeadInput['niche'];
  stage: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
  score: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CRMStageUpdateInput {
  leadId: string;
  newStage: CRMLead['stage'];
  /** Optional note (e.g. "Demo scheduled for next Tuesday"). */
  note?: string;
}

export interface CRMQueryOpts {
  tenantId?: string;
  stage?: CRMLead['stage'];
  source?: CRMLeadInput['source'];
  from?: string;
  to?: string;
  limit?: number;
}

export interface ICRMAdapter {
  createLead(input: CRMLeadInput): Promise<CRMLead>;
  updateStage(input: CRMStageUpdateInput): Promise<CRMLead>;
  listLeads(opts: CRMQueryOpts): Promise<CRMLead[]>;
  /** Compute a 0-100 lead score based on behavior + firmographics. */
  scoreLead(leadId: string): Promise<number>;
  isDigitalTwin(): boolean;
}
