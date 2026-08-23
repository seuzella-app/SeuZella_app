# 🧠 Cérebro Zélla — ML & Self-Defense Test Suites

This directory contains **4 specialized test suites** that verify the critical ML mitigations of the Cérebro Zélla brain were correctly coded and react perfectly to:

1. **Machine Learning** (Thompson Sampling, decay, TF-IDF, DPO filtering)
2. **Anti-hacker Defense** (vulnerability scanner + self-defense immune system)
3. **Bug/Error/Misalignment Identification** (anomaly detector + alert dedup)
4. **Auto-adjustment / Auto-healing** (auto-remediator + knowledge distiller)

## 📊 Test Coverage Summary

| Suite | File | Tests | Focus |
|-------|------|-------|-------|
| 🧬 ML Learning | `cerebro-ml-learning.test.ts` | 40 | Thompson Sampling, posterior decay (non-stationary), TF-IDF cosine similarity, Budget Guard tiers, Churn scoring |
| 🛡️ Anti-Hacker | `cerebro-ml-anti-hacker.test.ts` | 39 | 14+ SAST patterns (secret/sqli/ssrf/eval/crypto/xss), self-defense actions, TTL by severity, IP extraction |
| 🐛 Bug Detection | `cerebro-ml-bug-detection.test.ts` | 39 | Anomaly detector 4 strategies, alert dedup FNV-1a, refactor trigger thresholds, distiller patterns |
| 🔧 Auto-Adjustment | `cerebro-ml-auto-adjustment.test.ts` | 48 | Blocklist (10+ critical files), guardrails (confidence ≥ 0.85, 5/hour), mock mode safety, full loop |
| **Total new** | | **166** | |

Plus the original `cerebro-ml-modules.test.ts` (31 tests) — total **197 Cérebro tests**.

## 🚀 Running Tests

```bash
# Run all 4 specialized suites + existing modules
npm run test:cerebro-ml-all

# Run individually
npm run test:cerebro-ml-learning
npm run test:cerebro-ml-anti-hacker
npm run test:cerebro-ml-bug-detection
npm run test:cerebro-ml-auto-adjustment
```

## 🔁 CI/CD Integration

The workflow `.github/workflows/cerebro-ml-defense.yml` runs **5 parallel jobs** on every push/PR that touches Cérebro files:

1. `ml-learning` — Thompson Sampling + Decay + TF-IDF + Budget + Churn
2. `anti-hacker-defense` — Vuln Scanner + Self-Defense Immune
3. `bug-detection` — Anomaly + Alert Dedup + Orchestrator
4. `auto-adjustment` — Remediator + Distiller + Orchestrator Loop
5. `regression-guard` — Full test suite (364 tests, no regressions)

Each job has its own status badge. Failure in any of the 4 critical mitigation points turns the pipeline red.

## 🎯 Critical Mitigation Points Verified

### 🧬 ML Learning — Machine Learning Reactivity

- ✅ Thompson Sampling updates Beta posterior correctly (α on success, β on failure)
- ✅ Posterior mean converges to true success rate after N samples
- ✅ Discriminative learning (good vs bad providers diverge)
- ✅ Posterior decay (γ-factor) handles non-stationary regimes
- ✅ Decay never goes below prior (preserves baseline confidence)
- ✅ Decay rejects invalid γ values (0, 1, negative, >1)
- ✅ TF-IDF cosine similarity identifies paraphrases
- ✅ DPO pair filtering rejects trivial edits and out-of-context rewrites
- ✅ Budget Guard tiered thresholds (OK → SOFT 50% → HARD 80% → CRITICAL 95%)
- ✅ Churn predictor weights sum to 1.0 (mathematical consistency)

### 🛡️ Anti-Hacker — Defense Reactivity

- ✅ Vulnerability Scanner covers 9 categories (secret, sqli, ssrf, path_traversal, nosql_injection, eval, security_disabled, crypto_weakness, xss)
- ✅ Detects OpenAI keys (sk-...), GitHub PATs (ghp_...), hardcoded passwords
- ✅ Detects Prisma `$queryRaw` with interpolation (SQLi)
- ✅ Detects SSRF (fetch with dynamic URL)
- ✅ Detects `eval()`, `new Function()`, MD5/SHA1 (crypto weaknesses)
- ✅ Detects `ignoreBuildErrors: true`, `--accept-data-loss`
- ✅ Self-Defense takes NO action for non-critical anomalies (info/warning)
- ✅ Self-Defense takes `ip_ban` action for `auth_failure_pattern` critical
- ✅ TTL by severity: emergency=24h, critical=4h, warning=30min, info=5min
- ✅ Throttle and circuit breaker have TTL caps (60min, 30min)
- ✅ IP extracted from evidence context (supports `ip` and `ipAddress` keys)
- ✅ Cost anomaly produces alert_only (no defensive action — just notify)
- ✅ Mock mode returns `would_apply` (never `applied`)

### 🐛 Bug Detection — Identification Reactivity

- ✅ AnomalyDetector has 4 strategies (threshold, statistical 3σ, rate-of-change, pattern matcher)
- ✅ Cooldown tracker (60 min default) prevents alert spam
- ✅ AlertBus cross-channel deduplication (FNV-1a hash, 5 min window, LRU 1000 entries)
- ✅ `getAlertDedupStats` returns top 10 deduplicated alerts (count > 1)
- ✅ RefactorSuggester is importable and exposes singleton
- ✅ KnowledgeDistiller extracts patterns with valid sources (4 types)
- ✅ KnowledgeDistiller archives chunks older than 30 days
- ✅ Orchestrator runs tick with Watch → Defend → Scan → Analyze → Refactor → Remediate → Distill → Churn steps
- ✅ All 3 new cron endpoints exist (orchestrator, churn-predict, distill)
- ✅ ML stats ZCC endpoint exists

### 🔧 Auto-Adjustment — Self-Healing Reactivity

- ✅ AutoRemediator has blocklist with 10+ critical files (auth.ts, db.ts, middleware.ts, schema.prisma, next.config.ts, etc.)
- ✅ NEVER auto-modifies blocklisted files (even with confidence 0.99)
- ✅ autoMode defaults to false (requires human approval)
- ✅ autoConfidenceThreshold defaults to 0.85
- ✅ maxPerHour defaults to 5 (rate limit)
- ✅ validateWithTsc defaults to true (validates compilation)
- ✅ Mock mode NEVER modifies real files (validated=false, status=skipped)
- ✅ Budget Guard auto-fallback: CRITICAL tier blocks all LLM calls
- ✅ Thompson Sampling auto-adjusts provider preference based on feedback
- ✅ Decay allows self-correction when provider regime changes
- ✅ Self-Defense reacts automatically to critical anomalies without human intervention
- ✅ Full loop integration: Budget + Defense + Remediator + Distiller + Churn operate together
- ✅ All modules expose `getStats()` for observability

## 🛡️ Mock Mode Safety Guarantees

All tests verify that in mock mode (default):
- ❌ No real Redis calls (Self-Defense `isIpBanned`/`isTenantThrottled` return false)
- ❌ No real file modifications (AutoRemediator returns `skipped` not `applied`)
- ❌ No real LLM calls (Budget Guard tracks savings instead)
- ❌ No real external API calls (all wrapped in mock mode checks)

To enable live mode: set `CEREBRO_LIVE_MODE=true` + configure Redis + configure alert channels.

## 📈 Scaling Path Verified

These tests verify the Cérebro is ready to scale:
- **Client 1 → 1000**: Thompson Sampling handles 8 providers with non-stationary decay
- **Client 1000 → 3000**: Budget Guard throttles LLM spend (HARD tier 50% throttle)
- **Client 3000 → 5000**: Churn Predictor monitors 5 weighted signals per tenant
- **Path to LLM 32B**: DPO pair filtering (semantic similarity) ensures training data quality
