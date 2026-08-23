# ZCC Digital Twin — Permanent Simulation Environment

> **Renaming notice.** What was previously called "Mock mode" is now the
> **ZCC Digital Twin**. The word "Mock" suggests something temporary and
> disposable. The Digital Twin is neither. It is a *permanent* asset of the
> project — even after every real integration is live, every new feature
> still passes through the Twin before reaching customers.

This document describes the cognitive architecture built on top of the
existing Zélla codebase: 8 cortexes, a Universal Adapter Layer, a ZCC
Simulation Lab, Synthetic Brazil, a Behavioral Engine, and an Ads
Simulator. All of this runs in-process and never touches an external API.

## Table of contents

1. [Quick start](#quick-start)
2. [Architectural layers](#architectural-layers)
3. [The ZCC Digital Twin philosophy](#the-zcc-digital-twin-philosophy)
4. [Universal Adapter Layer](#universal-adapter-layer)
5. [Cortexes](#cortexes)
6. [ZGS — Zélla Growth Strategy](#zgs--zélla-growth-strategy)
7. [Simulation Lab](#simulation-lab)
8. [Synthetic Brazil](#synthetic-brazil)
9. [Behavioral Engine](#behavioral-engine)
10. [Ads Simulator](#ads-simulator)
11. [National Simulator](#national-simulator)
12. [API surface](#api-surface)
13. [Env vars](#env-vars)
14. [Testing](#testing)

## Quick start

```bash
# Boot the Digital Twin (in-process, no external API calls):
curl -X POST http://localhost:3000/api/zcc/digital-twin/boot \
  -H 'Content-Type: application/json' \
  -d '{"seedSyntheticBrazil": true, "autoStartLab": false}'

# Run a national simulation for Praia Grande:
curl -X POST http://localhost:3000/api/zcc/national-simulator/run \
  -H 'Content-Type: application/json' \
  -d '{"city": "Praia Grande", "leadCount": 1000, "adsDays": 30}'

# Inspect the ZGS's strategic decisions:
curl http://localhost:3000/api/zcc/zgs/decisions

# Run an experiment in the Simulation Lab:
curl -X POST http://localhost:3000/api/zcc/simulation-lab/run \
  -H 'Content-Type: application/json' \
  -d '{
    "experimentId": "exp-001",
    "hypothesis": "Impulsive persona converts > 30%",
    "feature": "behavioral-engine",
    "eventCount": 1000
  }'
```

## Architectural layers

```
┌──────────────────────────────────────────────────────────────────────┐
│                        ZCC (Chief Architect)                          │
│  Boots cortexes, owns operating mode, mediates conflicts, heartbeat  │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         ZCB (Cognitive Bus)                           │
│  Append-only event log. Cortexes never call each other directly.     │
└──────────────────────────────────────────────────────────────────────┘
                                  │
        ┌────────────┬───────────┼───────────┬────────────┐
        ▼            ▼           ▼           ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐
   │ Growth  │ │ Market   │ │ Sales   │ │ Revenue │ │ Success  │
   │ Cortex  │ │ Intel.   │ │ Cortex  │ │ Cortex  │ │ Cortex   │
   └─────────┘ └──────────┘ └─────────┘ └─────────┘ └──────────┘
        │            │           │           │            │
        └────────────┴───────────┼───────────┴────────────┘
                                  ▼
                          ┌──────────────┐
                          │   Learning   │ ← watches the others learn
                          │   Cortex     │
                          └──────────────┘
                                  ▼
                          ┌──────────────┐
                          │  Executive   │ ← synthesises daily brief
                          │   Cortex     │
                          └──────────────┘
                                  ▼
                          ┌──────────────┐
                          │     ZGS      │ ← decides, never acts
                          │ (Strategy)   │
                          └──────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                  Shared Cognitive Memory                              │
│  All cortexes publish validated knowledge here. No isolated stores.  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                Universal Adapter Layer                                │
│  8 interfaces (GoogleAds, MetaAds, Payment, CRM, WhatsApp,            │
│  Analytics, Email, Maps) — each with a Mock + a Real stub.            │
│  Registry picks Mock vs Real per-adapter via env.                     │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────┐
        │     ZCC Digital Twin (the old "Mock" layer)      │
        │  - Synthetic Brazil                              │
        │  - Behavioral Engine                             │
        │  - Ads Simulator (Google + Meta, statistical)    │
        │  - National Simulator                            │
        │  - Simulation Lab (permanent experiment harness) │
        └─────────────────────────────────────────────────┘
```

## The ZCC Digital Twin philosophy

The Digital Twin is **not a throwaway test fixture**. It is a permanent
simulation environment that mirrors the production cognitive stack. Its
invariants:

1. **Identical contracts.** Cortexes call adapters via interfaces. The
   Mock and Real adapters implement the same interface. The cortex cannot
   tell which it is talking to.

2. **Identical events.** Whether a campaign is created in Mock or Real
   mode, the ZCB receives the same `campaign.created` event. Downstream
   cortexes process it identically.

3. **Statistical realism.** Mock metrics are generated from real-world
   distributions:
   - CTR ~ Beta(α, β)
   - CPC ~ LogNormal(μ, σ)
   - Conversion rate ~ Beta(α, β)
   - Time-of-day lift, day-of-week lift, seasonality lift

4. **Deterministic.** Every random number is seeded. Running the same
   experiment twice produces identical results, so the Simulation Lab
   can compare features against the exact same baseline.

5. **Permanent.** The Twin is never removed. Even after production rollout,
   every new feature first runs through the Twin against millions of
   synthetic events. The Lab is the gate.

6. **Free.** No Google Ads spend. No Meta spend. No Stripe fees. The Twin
   teaches the ZGS before a single real account exists.

## Universal Adapter Layer

`src/adapters/interfaces/` defines 8 interfaces:

| Interface | Mock | Real |
|-----------|------|------|
| `IGoogleAdsAdapter` | `GoogleAdsMock` — statistically realistic campaigns | `GoogleAdsReal` — stub (throws) |
| `IMetaAdsAdapter` | `MetaAdsMock` — Meta campaigns | `MetaAdsReal` — stub |
| `IPaymentGatewayAdapter` | `PaymentMock` — PIX + card + boleto, 95% success | `PaymentReal` — stub |
| `ICRMAdapter` | `CRMMock` — leads, stages, scoring | `CRMReal` — stub |
| `IWhatsAppAdapter` | `WhatsAppMock` — outbound + inbound simulation | `WhatsAppReal` — stub |
| `IAnalyticsAdapter` | `AnalyticsMock` — sessions, conversion tracking | `AnalyticsReal` — stub |
| `IEmailAdapter` | `EmailMock` — outbox, 40% open / 8% click rates | `EmailReal` — stub |
| `IMapsAdapter` | `MapsMock` — Brazilian cities catalogue | `MapsReal` — stub |

The Registry (`src/adapters/registry.ts`) builds an `AdapterBundle` based
on env vars. Cortexes receive this bundle on startup — they never resolve
adapters themselves.

When a Real implementation is ready, swap it in by flipping one env var
without touching any cortex code:

```bash
# Move payment to Real, keep everything else on Twin:
ZELLA_ADAPTER_PAYMENT=real
```

## Cortexes

Every cortex extends `CortexBase` and follows the same lifecycle:

```
onStart() → subscribe to ZCB events → process → publish knowledge
```

| Cortex | Responsibility | Subscriptions |
|--------|----------------|---------------|
| **Growth** | Learns CAC, persona conversion, funnel drop-off | `metrics.*`, `lead.*`, `funnel.*` |
| **Market Intelligence** | Observes competitors, seasonality, keywords | `competitor.*`, `seasonality.*`, `keyword.*` |
| **Sales** | Owns the lead-to-customer journey | `lead.*`, `sales.*` |
| **Revenue** | MRR, churn, expansion, LTV | `subscription.*`, `payment.*`, `churn.*` |
| **Success** | Health scores, activation patterns | `tenant.*`, `support.*`, `nps.*` |
| **Learning** | Meta-cortex — watches the others learn | `learning.test`, `knowledge.*` |
| **Executive** | Daily briefs, escalations | All `alert` severity events |
| **ZGS** | Strategic decisions (decides, never acts) | `knowledge.published`, `growth.cac.*`, `revenue.churn` |

### The Learning Pipeline

Every cortex runs the canonical 8-stage cycle:

```
Observation → Inference → Hypothesis → Test
→ Validation → Publication → Versioning → Memory
```

Each stage emits a `learning.<stage>` event on the ZCB so other cortexes
can react. The final publication also emits `knowledge.published` via the
Shared Cognitive Memory.

## ZGS — Zélla Growth Strategy

The ZGS is the strategic decision layer above the Growth Cortex.

> Growth Cortex learns → ZGS decides.

It reads validated knowledge from the Shared Cognitive Memory and emits
`zgs.decision.proposed` events. Decision kinds:

- `budget-reallocation` — move budget between channels based on CAC
- `campaign-creation` — launch a new campaign based on keyword intel
- `pricing-change` — pricing strategy response to competitor moves
- `icp-refinement` — adjust targeting based on persona conversion
- `funnel-intervention` — fix a high-dropoff funnel step

The ZGS does **not** execute decisions directly. A downstream executor
(human or automation) consumes `zgs.decision.proposed` and calls
`PATCH /api/zcc/zgs/decisions` to mark it `approved` / `executed`.

## Simulation Lab

`src/simulation/ZCCSimulationLab.ts` — the permanent experiment harness.

Every new feature must pass through the Lab:

1. Spin up a clean Digital Twin environment (clear ZCB + memory).
2. Generate synthetic events (100k+ by default) using Synthetic Brazil,
   the Behavioral Engine, and the Ads Simulator.
3. Run the feature under test against the synthetic event stream.
4. Collect metrics and compare against the baseline.
5. Return a verdict: `approved` / `rejected` / `inconclusive`.

Only `approved` features are promoted to production.

Lab runs are scheduled:
- On demand via `POST /api/zcc/simulation-lab/run`
- Nightly (cron) for regression detection
- On every PR (CI gate)

## Synthetic Brazil

`src/simulation/SyntheticBrazil/SyntheticBrazil.ts`

A deterministic generator for the full synthetic country:

| Entity | Default count | Notes |
|--------|---------------|-------|
| Federative units | 27 | 26 states + DF |
| Cities | 400 | 80 anchor cities + 320 satellites |
| Pousadas | 15,000 | Distributed by tourism intensity |
| Airbnb properties | 120,000 | 8× pousada count, weighted to coastal |
| Guests | 250,000 | Distributed by city population |
| Competitors | 80 | Distributed across top-30 tourist cities |
| Historical events | 5 years × ~36M events | Computed, not materialised |

The entire Brazil is reproducible from a single seed:

```ts
const brazil = generateSyntheticBrazil({ seed: 42 });
// Same seed → same Brazil.
```

## Behavioral Engine

`src/simulation/BehavioralEngine/BehavioralEngine.ts`

Six personas modelling the major Brazilian hospitality buyer archetypes:

| Persona | Description | Conversion multiplier |
|---------|-------------|----------------------|
| `curious` | Explora, volta, pesquisa, liga, decide | 0.7× |
| `impulsive` | Vê anúncio, clica, compra no mesmo dia | 1.8× |
| `skeptical` | Compara 3 concorrentes, lê reviews | 0.5× |
| `price-only` | Quer o mais barato, pechincha | 0.4× |
| `chain` | Pequena rede (3+ imóveis), decisão longa | 1.4× |
| `airbnb` | Anfitrião Airbnb, dores diferentes | 0.8× |

The engine generates a customer journey as a sequence of cognitive
events (`lead.created`, `funnel.step`, `lead.converted`, etc.) that can
be published on the ZCB so cortexes learn from them.

## Ads Simulator

`src/simulation/AdsSimulator/AdsSimulator.ts`

Wraps the `GoogleAdsMock` and `MetaAdsMock` adapters to run multi-day
campaigns and emit `metrics.googleAds` / `metrics.metaAds` events on the
ZCB. This is what teaches the ZGS about CAC, CTR, CPA **before any real
Google Ads account exists**.

Statistical distributions used:

| Metric | Distribution | Parameters |
|--------|--------------|------------|
| CTR (Google) | Beta | α=2, β=40 (mean ~5%) |
| CTR (Meta) | Beta | α=3, β=50 (mean ~6%) |
| CPC (Google) | LogNormal | μ=-1.2, σ=0.4 (mean ~R$1.50) |
| CPC (Meta) | LogNormal | μ=-1.6, σ=0.5 (mean ~R$0.80) |
| Conversion rate | Beta | α=2, β=80 (mean ~2.5%) |
| Time-of-day lift | Two Gaussians | peaks at 11h and 20h |
| Day-of-week lift | Categorical | weekend 1.6× |
| Seasonal lift | Categorical | Dec/Jan 1.8×, Jul 1.3× |

## National Simulator

`src/simulation/NationalSimulator/NationalSimulator.ts`

Pick a city → generate that city's full ecosystem:

```bash
# Praia Grande → 500 pousadas, 4000 Airbnbs, 30+ competitors
curl -X POST http://localhost:3000/api/zcc/national-simulator/run \
  -d '{"city": "Praia Grande", "leadCount": 1000}'

# Compare cities side-by-side (where should we launch next?)
curl -X POST http://localhost:3000/api/zcc/national-simulator/compare \
  -d '{"cities": ["Praia Grande", "Gramado", "Bonito"]}'
```

## API surface

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/zcc/health` | Cognitive-stack health snapshot |
| GET | `/api/zcc/digital-twin` | Digital Twin status |
| POST | `/api/zcc/digital-twin/boot` | Boot the Digital Twin |
| GET | `/api/zcc/cortex` | All cortexes snapshot |
| GET | `/api/zcc/cortex/growth` | Growth Cortex snapshot |
| GET | `/api/zcc/zgs/decisions` | List ZGS strategic decisions |
| PATCH | `/api/zcc/zgs/decisions` | Update decision status |
| GET | `/api/zcc/simulation-lab` | List experiment results |
| POST | `/api/zcc/simulation-lab/run` | Run a new experiment |
| GET | `/api/zcc/synthetic-brazil` | List anchor cities |
| POST | `/api/zcc/synthetic-brazil/generate` | Generate a Synthetic Brazil slice |
| GET | `/api/zcc/national-simulator` | List available cities |
| POST | `/api/zcc/national-simulator/run` | Run a national simulation |
| POST | `/api/zcc/national-simulator/compare` | Compare multiple cities |
| GET | `/api/zcc/adapters` | Adapter mode map |
| GET | `/api/zcc/cognitive-bus` | Inspect ZCB event log |
| GET | `/api/zcc/cognitive-memory` | Query Shared Cognitive Memory |
| GET | `/api/zcc/personas` | List Behavioral Engine personas |

## Env vars

Every adapter defaults to `digital-twin` mode. Real mode is opt-in,
per adapter, via env:

```bash
# Per-adapter override:
ZELLA_ADAPTER_GOOGLE_ADS=real
ZELLA_ADAPTER_META_ADS=real
ZELLA_ADAPTER_PAYMENT=real
ZELLA_ADAPTER_CRM=real
ZELLA_ADAPTER_WHATSAPP=real
ZELLA_ADAPTER_ANALYTICS=real
ZELLA_ADAPTER_EMAIL=real
ZELLA_ADAPTER_MAPS=real

# Or flip everything to real (still per-adapter overridable):
ZELLA_OPERATING_MODE=production
```

When `ZELLA_ADAPTER_*` is unset, the global `ZELLA_OPERATING_MODE` is
used. When both are unset, the default is `digital-twin`.

## Testing

```bash
# Run the ZCC Digital Twin test suite:
npx vitest run tests/zcc-digital-twin/

# Run the full test suite:
npx vitest run tests/
```

The Digital Twin test suite covers:

- ZCB event routing (subscribe by prefix, filter by source)
- Growth Cortex CAC ingestion + knowledge publication
- Learning Pipeline 8-stage cycle
- Behavioral Engine (impulsive converts > skeptical)
- Simulation Lab verdict computation
- Adapter Registry (Mock by default, Real via env)
- Mock contract compliance (CTR/CPC/spend within plausible ranges)
- Mock reproducibility (same seed → same metrics)
