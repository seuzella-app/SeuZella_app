export interface ICapabilityVector {
  readonly reasoning: number; // [0, 1]
  readonly conversation: number; // [0, 1]
  readonly code: number; // [0, 1]
  readonly json: number; // [0, 1]
  readonly creative: number; // [0, 1]
  readonly multilingual: number; // [0, 1]
  readonly safety: number; // [0, 1]
}

export class ProviderCapabilityProfile {
  private constructor(
    public readonly name: string,
    public readonly tier: 1 | 2 | 3,
    public readonly costInputPer1M: number,
    public readonly costOutputPer1M: number,
    public readonly capabilities: Readonly<ICapabilityVector>,
    public readonly slaLatencyMs: number,
    public readonly maxContextTokens: number,
  ) {}

  static create(params: {
    name: string;
    tier: 1 | 2 | 3;
    costInputPer1M: number;
    costOutputPer1M: number;
    capabilities: Readonly<ICapabilityVector>;
    slaLatencyMs: number;
    maxContextTokens: number;
  }): ProviderCapabilityProfile {
    return new ProviderCapabilityProfile(
      params.name,
      params.tier,
      params.costInputPer1M,
      params.costOutputPer1M,
      Object.freeze({ ...params.capabilities }),
      params.slaLatencyMs,
      params.maxContextTokens,
    );
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens / 1_000_000) * this.costInputPer1M
         + (outputTokens / 1_000_000) * this.costOutputPer1M;
  }

  get capabilityScore(): number {
    const c = this.capabilities;
    return (c.reasoning + c.conversation + c.code + c.json + c.creative + c.multilingual + c.safety) / 7;
  }
}
