# LOTE 3 — Auditoria Forense M-PAY-011 + Admin Fallback (Subagent A)

**Task ID:** A (LOTE 3 wave)
**Agente:** GLM Subagent A — M-PAY-011 + Admin Fallback Forensic
**Data:** 2026-09 (sessão LOTE 3)
**Baseline auditada:** HEAD `a0bb1a85` em `main` no clone GLM (`/home/z/my-project/zella`)
**Commits Antigravity declarados:** `ebc54d25` (Fase 0 — fail-closed webhook + remove admin fallback), `2e021a9d` (LOTE 3 — session revocation + tenant status + middleware hardening)
**Status dos patches Antigravity:** ❌ NÃO TRANSFERIDOS para o ambiente GLM (`git cat-file -t ebc54d25` / `2e021a9d` → "Not a valid object name"). Auditoria realizada sobre estado DECLARADO + baseline `a0bb1a85`.

---

## 1. VERDICTO CONSOLIDADO

| Bloco | Veredito |
|---|---|
| M-PAY-011 (fail-closed webhook) | 🟡 **DECLARED_FIXED — INSUFFICIENT EVIDENCE** — baseline `a0bb1a85` já é fail-closed em produção; a regressão M-PAY-011 descrita pelo V5 advém do "Wave 1 patch" (artefato `wave3_pasted_patch.diff`) que **nunca foi aplicado** à árvore de trabalho. Logo, o commit `ebc54d25` é teoricamente redundante neste baseline; não há patch para auditar. |
| Admin Fallback (marciocau14 + system_admin provisioning) | 🔴 **NO-GO — INSUFFICIENT EVIDENCE** — 3 ocorrências de fallback hardcoded continuam presentes no baseline `a0bb1a85`; o commit `ebc54d25` declara "remove admin fallback" mas o patch não foi transferido. Pior: existe **conflito contratual** com `tests/auth/password-reset-flow.test.ts` que EXIGE a literal `'marciocau14@gmail.com'` no source — se o Antigravity realmente removeu o fallback, este teste quebraria, contradizendo a declaração "61/61 PASS". |
| checkout-webhook-mpay011.test.ts (declarado 5 casos) | 🔴 **NO-GO — INSUFFICIENT EVIDENCE** — arquivo NÃO EXISTE no clone GLM; não há como verificar conteúdo, escopo, ou se substitui vs. adiciona `checkout-webhook-regression.test.ts`. |

**Veredito final da task:** 🟡 **DECLARED_FIXED — INSUFFICIENT EVIDENCE** — o baseline `a0bb1a85` por si só já é aderente ao fail-closed declarado, mas o commit Antigravity não pode ser auditado (sem patch transferido). A alegação de "remove admin fallback" entra em conflito direto com um teste source-text existente — demonstração adicional obrigatória.

---

## 2. Auditoria M-PAY-011 (fail-closed webhook)

### 2.1 Estado do baseline `a0bb1a85` — `src/app/api/checkout/webhook/route.ts`

O arquivo (87 linhas) já contém a lógica fail-closed que o commit `ebc54d25` SUPOSTAMENTE restaura:

```typescript
// Linhas 14-19: fail-closed em produção quando secret ausente
const webhookSecret = process.env.MP_WEBHOOK_SECRET || process.env.MERCADOPAGO_WEBHOOK_SECRET;
if (process.env.NODE_ENV === 'production' && !webhookSecret) {
  console.error('[checkout-webhook] CRITICAL: Mercado Pago webhook secret not configured');
  return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 503, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
}

// Linhas 21-38: caminho de produção exige assinatura + verificação
if (process.env.NODE_ENV === 'production') {
  if (!signature) return NextResponse.json({ error: 'SIGNATURE_REQUIRED' }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
  // ... parse data.id, paymentId
  const verification = verifyMercadoPagoWebhook(rawBody, signature, webhookSecret!, paymentId, requestId);
  if (!verification.valid) return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401, headers: { 'X-Security-Shield': 'zero-trust-v2' } });
} else if (webhookSecret && signature) {
  // DEV: verifica só se ambos presentes (skip se faltar)
  // ... retorno de verifyMercadoPagoWebhook é DESCARTADO (ver LOTE3-A-008)
}

// Linhas 46-82: processamento principal (ocorre após verificação em prod)
```

**Observação crítica:** O commit `4f829a13` ("fix: harden checkout Mercado Pago webhook verification", 2026-08-21) — anterior a `a0bb1a85` em `main` — já introduziu o bloqueio fail-closed. Logo, M-PAY-011 (regressão descrita pelo V5) **não está presente no baseline** `a0bb1a85`. A regressão só existiria no patch Wave 1 (`wave3_pasted_patch.diff`) — artefato que **nunca foi aplicado** à árvore de trabalho GLM.

**Conclusão imediata:** O commit `ebc54d25` declarado pelo Antigravity restaura um fail-closed que **já existe no baseline** — é uma mudança no-op OU aborda um aspecto distinto do fail-closed (que precisa ser demonstrado via patch).

### 2.2 Análise adversarial — 14 casos do escopo da task

| # | Caso | Comportamento observado no baseline `a0bb1a85` | Status |
|---|---|---|---|
| 1 | Produção sem `MP_WEBHOOK_SECRET` | Linha 16-19: `NODE_ENV === 'production' && !webhookSecret` → 503 `WEBHOOK_NOT_CONFIGURED` | ✅ FAIL-CLOSED |
| 2 | Produção sem header `x-signature` | Linha 22: `if (!signature) return 401 SIGNATURE_REQUIRED` | ✅ FAIL-CLOSED |
| 3 | Produção com assinatura inválida | Linha 31-37: `verifyMercadoPagoWebhook → !valid` → 401 `SIGNATURE_INVALID` | ✅ FAIL-CLOSED |
| 4 | Produção com assinatura válida | Linha 31-38: `verification.valid` → segue processamento (linha 46+) | ✅ PROCESSADO |
| 5 | Comparação timing-safe | `webhook-verify.ts:11` usa `crypto.timingSafeEqual` em `safeEqualHex`. **Porém** a comparação de length pré-check (`received.length !== expected.length`) é não-timing-safe (leak de comprimento) | 🟡 PARCIAL |
| 6 | Parsing do `x-signature` (`ts=...,v1=...`) | `webhook-verify.ts:35-38`: `split(',').map(trim).find(p => p.startsWith('ts='))` + check `!ts || !v1 || !/^\d+$/.test(ts)`. Robusto contra formato vazio/malformado | ✅ ROBUSTO |
| 7 | Manipulação de `ts` (replay window) | `webhook-verify.ts:39-42`: `MP_MAX_SKEW_MS = 5*60*1000` (5 min) e `MP_MAX_FUTURE_MS = 60*1000` (1 min futuro). **Sem cache de nonces** → mesmo webhook pode ser reprocessado múltiplas vezes dentro da janela de 5 min | 🟡 PARCIAL |
| 8 | `data.id` ausente | Linha 27-30: parse estrito `typeof body.data.id === 'string'` → se faltar, `paymentId = ''` → 400 `MISSING_PAYMENT_ID` | ✅ FAIL-CLOSED |
| 9 | Replay (mesmo webhook enviado 2x) | Sem proteção de idempotência no webhook. Cada replay: re-fetch MP API + write DB (`paymentTransaction.update`, `subscription.update`, `tenant.update`). Não há escala crítica (estado é idempotente via API MP), mas gasta quota MP API e cria ruído de auditoria | 🔴 AUSENTE |
| 10 | Headers `x-signature` duplicados | Next.js (undici) `Headers.get()` retorna valores concatenados por `, ` quando múltiplos headers com mesmo nome. `split(',')` produz `["ts=1","v1=a","ts=2","v1=b"]`; `find(p => p.startsWith('ts='))` retorna a primeira ocorrência. Atacante não consegue injetar manifesto fraudado porque o HMAC depende de `webhookSecret` que ele não tem. Não bypass | ✅ ROBUSTO |
| 11 | `x-signature: ""` (vazio) | `signature = ""` é falsy → linha 22 retorna 401 `SIGNATURE_REQUIRED`. No `verifyMercadoPagoWebhook` também rejeita via `!signatureHeader` | ✅ FAIL-CLOSED |
| 12 | Segredo vazio (`MP_WEBHOOK_SECRET=""`) | `process.env.MP_WEBHOOK_SECRET || process.env.MERCADOPAGO_WEBHOOK_SECRET` → `"" || undefined` → `undefined` → linha 16 falha em produção (503). Se for `" "` (espaço) → truthy mas `strongSecret()` (length < 32) rejeita em produção via `WEAK_WEBHOOK_SECRET` | ✅ FAIL-CLOSED |
| 13 | Verificação `NODE_ENV === 'production'` | Case-sensitive: `NODE_ENV = 'Production'` (capital P) NÃO corresponde → tratado como dev → cai em `else if (webhookSecret && signature)` → pode skipar verificação se segredo/assinatura faltar. **Risco operacional em deploy mal configurado**, mas em prática Vercel/Next.js impõe lowercase | 🟡 PARCIAL |
| 14 | Caminho alternativo sem crypto auth | Produção: NÃO (fail-closed em todos os ramos). **DEV**: SIM — linha 39 `else if (webhookSecret && signature)` apenas chama `verifyMercadoPagoWebhook(...)` mas **descarta o retorno** (LOTE3-A-008); pior: se webhookSecret OU signature faltar, **nenhuma verificação é feita** e o webhook é processado normalmente (linhas 46-82). Atacante em dev/staging sem assinatura consegue disparar `subscription.update`, `tenant.update`, etc. | 🔴 DEV BYPASS |

### 2.3 Conclusão M-PAY-011

- O baseline `a0bb1a85` **não contém a regressão M-PAY-011** descrita no V5, porque o patch Wave 1 (`wave3_pasted_patch.diff`) que a introduziria nunca foi aplicado à árvore de trabalho.
- O commit `ebc54d25` declarado pelo Antigravity é portanto **redundante em relação ao baseline** — ou seja, a "correção" já está presente no código acessível.
- Persistem **3 deficiências menores** (LOTE3-A-005, LOTE3-A-008, LOTE3-A-009) que NÃO correspondem ao escopo M-PAY-011 (são gaps em DEV mode e no leak de length do HMAC) — não foram abordadas pelo commit declarado.
- **Sem o patch transferido** não é possível validar se `ebc54d25` preserva o fail-closed ou introduz regressões adicionais.

---

## 3. Auditoria Admin Fallback

### 3.1 Ocorrências de `marciocau14` em `src/`

| # | Arquivo:linha | Código | Tipo |
|---|---|---|---|
| F1 | `src/app/zcc/login/page.tsx:23` | `const [email, setEmail] = useState('marciocau14@gmail.com');` | 🔴 HARDCODED default email (prepopula form de login ZCC) |
| F2 | `src/app/api/auth/forgot-password/route.ts:10` | `function adminEmails(): Set<string> { return new Set((process.env.ZCC_ADMIN_EMAILS \|\| 'marciocau14@gmail.com').split(',')...) }` | 🔴 FALLBACK literal — se `ZCC_ADMIN_EMAILS` ausente, marciocau14 vira admin |
| F3 | `src/app/api/auth/magic-link/route.ts:34` | `const adminEmails = new Set((process.env.ZCC_ADMIN_EMAILS \|\| 'marciocau14@gmail.com').split(',')...)` | 🔴 FALLBACK literal — idem |
| F4 | `src/app/api/readiness/route.ts:71` | `hint: 'CSV of admin emails (e.g. admin@seuzella.com,marciocau14@seuzella.com)'` | 🟢 Documentação (apenas hint exibido no /readiness) |

### 3.2 Ocorrências de `ZCC_ADMIN_EMAILS` (uso sem fallback)

| Arquivo:linha | Código | Tipo |
|---|---|---|
| `src/lib/zcc-security.ts:151` | `(process.env.ZCC_ADMIN_EMAILS \|\| '').split(',')` | 🟢 Sem fallback (clean) |
| `src/lib/auth.ts:22` | `(process.env.ZCC_ADMIN_EMAILS \|\| '').split(',')` (em `isConfiguredZccAdmin`) | 🟢 Sem fallback |
| `src/middleware.ts:73` | `const envAdmins = (process.env.ZCC_ADMIN_EMAILS \|\| '').split(',')` (em `authorizeZcc`) | 🟢 Sem fallback |
| `src/app/login/page.tsx:208` | `const isZccAdmin = (process.env.ZCC_ADMIN_EMAILS \|\| '').toLowerCase().includes(credentialData.email.toLowerCase())` | 🟢 Sem fallback (mas **usado no cliente** — NextAuth client-side pode ler apenas vars prefixadas `NEXT_PUBLIC_` — verificar se esta env var está exposta ao browser; se sim, é INFORMATION LEAK da lista de admins) |
| `src/app/api/auth/forgot-password/route.ts:10` | (item F2 acima) | 🔴 FALLBACK |
| `src/app/api/auth/magic-link/route.ts:34` | (item F3 acima) | 🔴 FALLBACK |
| `src/app/api/readiness/route.ts:68-69` | `passed: !!process.env.ZCC_ADMIN_EMAILS` | 🟢 Verificação (sem fallback) |

### 3.3 Ocorrências de `system_admin` em `src/`

| Arquivo:linha | Código | Tipo |
|---|---|---|
| `src/middleware.ts:77` | `['owner', 'admin', 'system_admin'].includes(role)` | 🟢 Checagem de role (legítimo) |
| `src/middleware.ts:78` | `envAdmins.includes(email) \|\| role === 'system_admin'` | 🟢 system_admin bypass em middleware (legítimo: role é server-set após auth) |
| `src/lib/zcc-security.ts:153` | `['owner', 'admin', 'system_admin'].includes(role)` | 🟢 Checagem de role (legítimo) |
| `src/lib/auth.ts:53` | `role: 'system_admin'` no retorno do master admin (após `ZEHLA_MASTER_ADMIN_EMAIL` + `ZEHLA_MASTER_ADMIN_PASSWORD` verificados) | 🟢 Provisioning legítimo (env-driven) |
| `src/lib/auth.ts:62` | `isConfiguredZccAdmin(cleanEmail) ? 'system_admin' : (tenant.role \|\| 'owner')` | 🟢 Conditional (env-driven) |
| `src/lib/auth.ts:105` | idem em `jwt()` callback para Google provider | 🟢 Conditional |
| `src/app/api/auth/forgot-password/route.ts:28` | `if (!tenant && adminEmails().has(email)) tenant = await db.tenant.create({ data: { email, name: 'Administrador ZCC', role: 'system_admin', plan: 'enterprise', status: 'active' } });` | 🔴 PROVISIONING system_admin de email fallback (se `ZCC_ADMIN_EMAILS` ausente, qualquer um que descobrir o email `marciocau14@gmail.com` e disparar POST /api/auth/forgot-password com ele cria um tenant system_admin enterprise ativo) |
| `src/app/api/auth/magic-link/route.ts:36` | `if (!tenant && adminEmails.has(email)) tenant = await db.tenant.create({ data: { name: 'Administrador ZCC', email, role: 'system_admin', plan: 'enterprise', status: 'active', niche: 'pousada' } });` | 🔴 PROVISIONING system_admin idem |

### 3.4 Outros paths de admin hardcoded (busca estendida)

Padrões buscados: `admin@`, `master@`, `root@`, `ADMIN_EMAIL`, `MASTER_ADMIN`, `ZEHLA_MASTER`, `ZEHLA_LOOP`, `ZCC_MASTER_KEY`.

| Arquivo:linha | Código | Veredito |
|---|---|---|
| `src/lib/auth.ts:14-19` | `getConfiguredMasterCredentials()` — `ZEHLA_MASTER_ADMIN_EMAIL` + `ZEHLA_MASTER_ADMIN_PASSWORD`. Retorna `null` se ausente. | 🟢 Config-only (sem fallback) |
| `src/lib/zcc-security.ts:140` | `if (process.env.NODE_ENV !== 'production' && masterKey && process.env.ZCC_MASTER_KEY && masterKey === process.env.ZCC_MASTER_KEY) return { allowed: true, ip };` | 🟡 DEV-ONLY master key bypass — fails closed in prod, mas usa `===` (não timing-safe). Aceitável porque em dev. |
| `src/app/api/telemetry/landing/route.ts:52-54` | `configuredKey = process.env.ZCC_MASTER_KEY; providedKey = request.headers.get('x-zcc-master-key'); if (!configuredKey \|\| !providedKey \|\| providedKey.length !== configuredKey.length \|\| !cryptoSafeEqual(providedKey, configuredKey)) return 401;` | 🟢 Fail-closed + custom timing-safe compare |
| `src/app/api/webhooks/payment/route.ts:469-476` | `fetch(.../api/zcc/burn-rate, { headers: { ...(zccMasterKey ? { 'X-ZCC-Master-Key': zccMasterKey } : {}) } })` | 🟡 Passa master key em header — endpoint destino usa `verifyZCCAccessOrReject` que só aceita master key em DEV (zcc-security.ts:140). Em produção, esta chamada falha authorization. Não é bypass, mas telemetria silenciosa não chega em prod. |
| `src/lib/push/push-service.ts:47` | `const VAPID_SUBJECT = process.env.VAPID_SUBJECT \|\| 'mailto:admin@seuzella.com';` | 🟡 Fallback para VAPID subject — não é admin auth, é RFC 8291 subject. Documentado em /readiness? Não verificado. Risco baixo. |
| `src/app/api/zcc/cerebro/anomalies/route.ts:108` | `const acknowledgedBy = \`admin@${ctx.clientIp}\`;` | 🟢 Identificador sintético interno (não autenticador) |
| `src/app/api/zcc/cerebro/refactors/route.ts:134` | `const reviewerEmail = \`admin@${ctx.clientIp}\`;` | 🟢 Identificador sintético interno |
| `src/app/api/zcc/cerebro/runbook/route.ts:132` | `\`CEREBRO_ALERT_EMAILS=admin@seuzella.com\` (CSV)` (em string markdown) | 🟢 Documentação |
| `src/app/api/readiness/route.ts:54-62` | Verifica `ZEHLA_MASTER_ADMIN_EMAIL`, `ZEHLA_MASTER_ADMIN_PASSWORD` (length >= 12), `ZCC_ADMIN_EMAILS` | 🟢 Readiness check |
| `src/app/login/page.tsx:466` | "Administrador master via `ZEHLA_MASTER_ADMIN_EMAIL` / `ZEHLA_MASTER_ADMIN_PASSWORD`" — string em UI | 🟢 Documentação |
| `src/app/login/page.tsx:208` | `const isZccAdmin = (process.env.ZCC_ADMIN_EMAILS \|\| '').toLowerCase().includes(credentialData.email.toLowerCase())` | 🟡 Client-side env access — se env var NÃO tem prefixo `NEXT_PUBLIC_`, Next.js não expõe ao browser e esta linha retorna sempre `false` (broken em produção). Se exposta: vazamento da lista de admins ao browser. Either way: bad pattern. |

### 3.5 Interpretação do commit `ebc54d25` — "remove admin fallback"

A descrição declarada ("remove admin fallback") é **ambígua** e pode significar:

- **(a)** Remover a literal `'marciocau14@gmail.com'` dos defaults em `forgot-password/route.ts:10` e `magic-link/route.ts:34` (substituir por `''`)
- **(b)** Remover o `db.tenant.create({ role: 'system_admin' })` provisioning em `forgot-password/route.ts:28` e `magic-link/route.ts:36`
- **(c)** Remover `useState('marciocau14@gmail.com')` em `zcc/login/page.tsx:23`
- **(d)** Todas as acima

**Sem o patch transferido, é impossível determinar o escopo exato.**

### 3.6 Conflito contratual com `tests/auth/password-reset-flow.test.ts`

O teste existente `tests/auth/password-reset-flow.test.ts` (linhas 31-36) contém:

```typescript
it('bootstraps only the configured ZCC admin email', () => {
  const route = read('src/app/api/auth/forgot-password/route.ts');
  expect(route).toContain('ZCC_ADMIN_EMAILS');
  expect(route).toContain('marciocau14@gmail.com');  // ← EXIGE a literal!
  expect(route).toContain("role: 'system_admin'");
});
```

Este teste source-text **EXIGE** a presença da string literal `'marciocau14@gmail.com'` em `forgot-password/route.ts`.

**Implicação:** Se o commit `ebc54d25` realmente removeu a literal `'marciocau14@gmail.com'` (interpretação (a) acima), este teste FALHARIA. Mas o Antigravity declara "61/61 PASS".

**Discrepância:** Apenas uma destas afirmações é verdadeira:
1. O Antigravity NÃO removeu a literal (declaração de commit é enganosa), OU
2. O Antigravity também MODIFICOU o teste (invalidando o contrato — anti-pattern), OU
3. A interpretação correta é (b) ou (c) — remover apenas o provisioning ou apenas o `useState`, mantendo a literal no `forgot-password`

**Sem o patch, é impossível distinguir.**

---

## 4. Análise dos arquivos de teste

### 4.1 `tests/security/checkout-webhook-regression.test.ts` (3 testes source-text, baseline)

```typescript
const source = fs.readFileSync('src/app/api/checkout/webhook/route.ts', 'utf8');

// Teste 1 (linhas 7-9): exige a literal exata
expect(source).toContain('verifyMercadoPagoWebhook(rawBody, signature, webhookSecret!, paymentId, requestId)');
//   ↑ observa o `webhookSecret!` (non-null assertion)

// Teste 2 (linhas 11-15): exige buffer-size check + PAYLOAD_TOO_LARGE + INVALID_JSON
expect(source).toContain("Buffer.byteLength(rawBody, 'utf8')");
expect(source).toContain('PAYLOAD_TOO_LARGE');
expect(source).toContain('INVALID_JSON');

// Teste 3 (linhas 17-20): não expõe mpError.message + exige PAYMENT_PROVIDER_UNAVAILABLE
expect(source).not.toContain('mpError.message');
expect(source).toContain('PAYMENT_PROVIDER_UNAVAILABLE');
```

### 4.2 Status do teste 1 contra o baseline `a0bb1a85`

O baseline `route.ts:31` contém:
```typescript
const verification = verifyMercadoPagoWebhook(rawBody, signature, webhookSecret!, paymentId, requestId);
```

✅ **O teste 1 PASSA no baseline `a0bb1a85`.** A literal exata está presente.

### 4.3 Status do teste 1 contra um hipotético patch `ebc54d25`

Se o commit `ebc54d25` (fail-closed) MODIFICAR a chamada — por exemplo, remover o `webhookSecret!` non-null assertion porque o secret agora é sempre garantido pelo fail-closed pré-check:

```typescript
// Antes (baseline):
const verification = verifyMercadoPagoWebhook(rawBody, signature, webhookSecret!, paymentId, requestId);

// Depois (hipotético pós-ebc54d25):
const verification = verifyMercadoPagoWebhook(rawBody, signature, webhookSecret, paymentId, requestId);
//                                                                        ↑ sem `!`
```

→ O teste 1 de `checkout-webhook-regression.test.ts` FALHARIA (literal `webhookSecret!` não encontrada).

**Discrepância:** Se o Antigravity declara 61/61 PASS e o commit `ebc54d25` alterou a chamada, então ou:
- O teste foi atualizado junto (alteração contratual) — desejável documentar
- `checkout-webhook-regression.test.ts` foi DELETADO e substituído por `checkout-webhook-mpay011.test.ts`

### 4.4 `tests/security/checkout-webhook-mpay011.test.ts` (5 testes declarados)

- ❌ **NÃO EXISTE** no clone GLM (`find tests -name "checkout-webhook-mpay011*"` retorna vazio).
- Não há como verificar: conteúdo, casos de teste cobertos, ou se é REPLACEMENT (substitui `checkout-webhook-regression.test.ts`) ou ADDITION (mantém o antigo e adiciona mais 5).
- A simples existência declarada não prova que cobre os 14 casos adversariais listados na task do Subagent A.

### 4.5 `tests/security/webhook-verify-regression.test.ts` (3 testes source-text, baseline)

```typescript
// Teste 1: exige MISSING_MANIFEST_IDENTIFIERS + !resourceId || !requestId
expect(source).toContain('MISSING_MANIFEST_IDENTIFIERS');
expect(source).toContain('!resourceId || !requestId');

// Teste 2: exige MP_MAX_SKEW_MS + MP_MAX_FUTURE_MS
expect(source).toContain('MP_MAX_SKEW_MS');
expect(source).toContain('MP_MAX_FUTURE_MS');

// Teste 3: exige crypto.timingSafeEqual
expect(source).toContain('crypto.timingSafeEqual');
```

✅ Todos os 3 PASSAM contra `webhook-verify.ts` baseline (verificado via leitura do source).

### 4.6 `tests/auth/password-reset-flow.test.ts` (5 testes source-text)

- Teste 1 (hash token): ✅ passa — `randomBytes(32)`, `createHash('sha256')`, `30 * 60 * 1000` presentes
- Teste 2 (GENERIC_RESPONSE): ✅ passa — `GENERIC_RESPONSE` e `if (!tenant) return NextResponse.json(GENERIC_RESPONSE)` presentes
- Teste 3 (reset-password): não verificado (arquivo não lido; subentendido passar no baseline)
- Teste 4 (`ZCC_ADMIN_EMAILS` + `marciocau14@gmail.com` + `role: 'system_admin'`): ✅ passa no baseline — todas as 3 literais presentes
- Teste 5 (páginas existe): não verificado

### 4.7 `tests/security/production-auth-canary.test.ts` (5 testes)

- Teste 1 (sem senhas hardcoded em `auth.ts`): ✅ passa
- Teste 3 (sem `'admin@seuzella.com.br'` em `middleware.ts`, exige `NODE_ENV === 'production'`): ✅ passa
- Teste 4 (sem `'demo@pousada.com.br'` em `login/page.tsx`): ✅ passa
- Teste 5 (não usa `@seuzella.com.br`): ✅ passa
- Teste 6 (`.env.example` documenta `ZEHLA_MASTER_ADMIN_EMAIL`, `ZEHLA_MASTER_ADMIN_PASSWORD`, `ZCC_ADMIN_EMAILS`, `ALEXA_JWT_SECRET`): ✅ passa (presumido)

### 4.8 `tests/security-hardening-12-fronts.test.ts` (4 testes, 20 contratos)

- Teste 9-12 (linha 24-27): `expect(magic).toContain('sha256')` — ✅ passa (magic-link usa `hashToken` com sha256). `expect(webhook).toContain('MIN_SECRET_LENGTH')` — ✅ passa em `webhook-verify.ts`.

---

## 5. Findings Estruturados

### LOTE3-A-001 — Patches Antigravity não transferidos
- **Severidade:** P0 BLOCKER (processual)
- **Arquivo:** `commits ebc54d25, 2e021a9d` (Antigravity `wave/8-implementation-v3`)
- **Linha:** N/A
- **Categoria:** Insufficient Evidence
- **Descrição:** Os commits declarados pelo Antigravity não são objetos válidos no clone GLM (`git cat-file -t ebc54d25` → "Not a valid object name"). Não há como auditar o conteúdo do patch.
- **Evidência:** `cd /home/z/my-project/zella && git cat-file -t ebc54d25 2>&1` → `fatal: Not a valid object name ebc54d25`. Idem para `2e021a9d`.
- **Impacto:** Toda declaração de "fix" feita pelo Antigravity não pode ser validada — requer transferência do patch ou merge para `main`.
- **OWASP:** A04:2021 Insecure Design
- **CVSS v3.1:** N/A (processual, não técnico)
- **Remediação:** Transferir patches `ebc54d25` e `2e021a9d` para o ambiente GLM (e.g., `git fetch origin wave/8-implementation-v3 && git checkout <hash>`); reauditar; ou então merge direto para `main` para que o estado declarado vire HEAD acessível.

### LOTE3-A-002 — M-PAY-011 não está presente no baseline `a0bb1a85`
- **Severidade:** Informational (análise de baseline)
- **Arquivo:** `src/app/api/checkout/webhook/route.ts:16-19`
- **Linha:** 16
- **Categoria:** Não-conformidade entre baseline e V5 audit
- **Descrição:** O V5 audit declarou M-PAY-011 como NEW P0 REGRESSION introduzida pelo Wave 1 patch (`wave3_pasted_patch.diff`). No entanto, o baseline `a0bb1a85` no clone GLM **não tem** a regressão — mantém o fail-closed `if (NODE_ENV === 'production' && !webhookSecret) return 503` (linhas 16-19). O patch Wave 1 foi apenas um artefato, nunca aplicado à árvore.
- **Evidência:** Comparação direta das linhas 16-19 de `route.ts` vs. descrição do V5 §3.2.
- **Impacto:** O commit `ebc54d25` declarado restaura um fail-closed que já existe. Pode ser redundante OU pode abranger outro aspecto — apenas o patch pode confirmar.
- **OWASP:** N/A
- **CVSS v3.1:** N/A
- **Remediação:** Antigravity deve demonstrar via diff do `ebc54d25` o que exatamente foi alterado em `route.ts` (e arquivos correlatos).

### LOTE3-A-003 — Admin fallback hardcoded em `forgot-password/route.ts:10`
- **Severidade:** P0 BLOCKER
- **Arquivo:** `src/app/api/auth/forgot-password/route.ts`
- **Linha:** 10
- **Categoria:** Insecure Default / Privilege Escalation
- **Descrição:** `function adminEmails(): Set<string> { return new Set((process.env.ZCC_ADMIN_EMAILS || 'marciocau14@gmail.com').split(',').map(v => v.trim().toLowerCase()).filter(Boolean)); }` — se `ZCC_ADMIN_EMAILS` não estiver setado (default em qualquer ambiente sem .env), `marciocau14@gmail.com` vira o único admin reconhecido.
- **Evidência:** Leitura direta do source baseline.
- **Impacto:** (1) Atacante que descobrir o email `marciocau14@gmail.com` e disparar `POST /api/auth/forgot-password` com este email em um ambiente sem `ZCC_ADMIN_EMAILS` setado → PROVISIONA um tenant `system_admin` enterprise ativo (linha 28). (2) Em produção sem env var configurada (erro de deploy), `marciocau14@gmail.com` vira backdoor automático de admin.
- **OWASP:** A05:2021 Security Misconfiguration + A07:2021 Identification & Auth Failures
- **CVSS v3.1:** 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:L) — exploração remota, sem auth, provisiona system_admin
- **Remediação:** Substituir `|| 'marciocau14@gmail.com'` por `|| ''`. Em produção, falhar com 503 se env var ausente.

### LOTE3-A-004 — Admin fallback hardcoded em `magic-link/route.ts:34`
- **Severidade:** P0 BLOCKER
- **Arquivo:** `src/app/api/auth/magic-link/route.ts`
- **Linha:** 34
- **Categoria:** Insecure Default / Privilege Escalation
- **Descrição:** `const adminEmails = new Set((process.env.ZCC_ADMIN_EMAILS || 'marciocau14@gmail.com').split(',').map(v => v.trim().toLowerCase()).filter(Boolean));` — idem ao LOTE3-A-003.
- **Evidência:** Leitura direta do source baseline.
- **Impacto:** Idem ao LOTE3-A-003 — atacante provisiona system_admin via `POST /api/auth/magic-link` se env var ausente.
- **OWASP:** A05:2021 + A07:2021
- **CVSS v3.1:** 9.1
- **Remediação:** Substituir `|| 'marciocau14@gmail.com'` por `|| ''`.

### LOTE3-A-005 — Hardcoded default email em `zcc/login/page.tsx:23`
- **Severidade:** P2 (UX leak / metadata exposure)
- **Arquivo:** `src/app/zcc/login/page.tsx`
- **Linha:** 23
- **Categoria:** Information Disclosure / Hardcoded Identity
- **Descrição:** `const [email, setEmail] = useState('marciocau14@gmail.com');` — prepopula o formulário de login ZCC com o email do administrador. Qualquer visitante que acessar `/zcc/login` vê o email do admin em tela.
- **Evidência:** Leitura direta do source.
- **Impacto:** Vazamento de identidade do admin fundador — facilita ataques de phishing, enumeração e ataques direcionados. Não é bypass técnico, mas é information disclosure.
- **OWASP:** A04:2021 Insecure Design
- **CVSS v3.1:** 3.7 (AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N)
- **Remediação:** Trocar `useState('marciocau14@gmail.com')` por `useState('')` (form vazio).

### LOTE3-A-006 — Conflito contratual: `password-reset-flow.test.ts` exige literal `marciocau14@gmail.com`
- **Severidade:** P1 BLOCKER (auditoria)
- **Arquivo:** `tests/auth/password-reset-flow.test.ts`
- **Linha:** 34
- **Categoria:** Test Contract Conflict
- **Descrição:** O teste source-text na linha 34 contém `expect(route).toContain('marciocau14@gmail.com')` — exige explicitamente a literal no source de `forgot-password/route.ts`. Se o commit `ebc54d25` removeu a literal (interpretado como "remove admin fallback" tipo (a)), o teste FALHA. Mas Antigravity declara 61/61 PASS.
- **Evidência:** Leitura do teste baseline + análise de consistência lógica.
- **Impacto:** Discrepância de declarações — não é possível determinar qual versão é verdadeira sem o patch. Possíveis cenários:
  - (i) Antigravity não removeu a literal → commit message é enganoso
  - (ii) Antigravity modificou o teste junto → contrato de teste invalidado
  - (iii) Antigravity usou interpretação (b) ou (c) → removido apenas provisioning ou useState, mantida a literal
- **OWASP:** N/A
- **CVSS v3.1:** N/A (processual)
- **Remediação:** Antigravity deve esclarecer a interpretação de "remove admin fallback" via diff do commit `ebc54d25` em todos os arquivos tocados.

### LOTE3-A-007 — Provisioning automático de `system_admin` a partir de fallback de email
- **Severidade:** P0 BLOCKER (ligado ao LOTE3-A-003/004)
- **Arquivo:** `src/app/api/auth/forgot-password/route.ts:28` + `src/app/api/auth/magic-link/route.ts:36`
- **Linha:** 28 / 36
- **Categoria:** Privilege Escalation via Insecure Default
- **Descrição:** Ambas as rotas executam `if (!tenant && adminEmails.has(email)) tenant = await db.tenant.create({ data: { ..., role: 'system_admin', plan: 'enterprise', status: 'active' } });` — quando `adminEmails` contém `marciocau14@gmail.com` (default fallback), qualquer um que submeter este email via POST cria um tenant system_admin enterprise ativo.
- **Evidência:** Leitura direta das linhas 28 e 36.
- **Impacto:** Se `ZCC_ADMIN_EMAILS` ausente: atacante cria conta system_admin em produção com email `marciocau14@gmail.com` (que é o email real do founder MarcioCau14, segundo git log). Mesmo que não consiga acessar o email (não tem a senha), o tenant existe e pode ser usado para exploits futuros (e.g., reset de senha subsequente).
- **OWASP:** A01:2021 Broken Access Control + A05:2021 Security Misconfiguration
- **CVSS v3.1:** 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:L)
- **Remediação:** Remover o auto-provisioning OU guardá-lo atrás de um flag explícito (e.g., `if (process.env.ZCC_ALLOW_BOOTSTRAP_ADMIN === '1' && adminEmails.has(email))`) — NUNCA com fallback de email hardcoded.

### LOTE3-A-008 — Resultado de `verifyMercadoPagoWebhook` descartado em DEV
- **Severidade:** P2
- **Arquivo:** `src/app/api/checkout/webhook/route.ts`
- **Linha:** 43
- **Categoria:** Dead Code / Verification Bypass
- **Descrição:** Linha 43: `if (paymentId) verifyMercadoPagoWebhook(rawBody, signature, webhookSecret, paymentId, requestId);` — chama a função mas **não usa o retorno**. Mesmo que a verificação retorne `{ valid: false, reason: 'SIGNATURE_MISMATCH' }`, o webhook é processado normalmente (linhas 46+).
- **Evidência:** Leitura direta do source baseline.
- **Impacto:** Em DEV, a verificação de assinatura é cosmética — não bloqueia nada. Atacante com qualquer assinatura (válida ou não) em ambiente DEV/Staging consegue disparar `subscription.update`, `tenant.update`, etc.
- **OWASP:** A07:2021 Identification & Auth Failures
- **CVSS v3.1:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L) — limitado a ambientes DEV/Staging expostos
- **Remediação:** Atribuir o retorno: `const verification = verifyMercadoPagoWebhook(...); if (!verification.valid) return 401 SIGNATURE_INVALID;`. Ou eliminar a chamada se a intenção é "DEV não verifica".

### LOTE3-A-009 — DEV mode permite processar webhook sem assinatura quando `webhookSecret` ausente
- **Severidade:** P1 (produção-safe, dev/staging-exposed)
- **Arquivo:** `src/app/api/checkout/webhook/route.ts`
- **Linha:** 39
- **Categoria:** Authentication Bypass in DEV
- **Descrição:** Linha 39: `else if (webhookSecret && signature) { ... }` — se `webhookSecret` OU `signature` faltar em DEV, **nenhuma verificação ocorre** e o fluxo continua para as linhas 46-82 (processamento completo). Atacante em ambiente DEV/Staging exposto sem `MP_WEBHOOK_SECRET` configurado pode enviar webhook sem assinatura e causar ativação de subscription.
- **Evidência:** Leitura direta do source baseline.
- **Impacto:** Em staging exposto (e.g., Vercel preview deploy sem env var), webhook malicioso consegue ativar subscription sem qualquer autenticação.
- **OWASP:** A07:2021 + A05:2021
- **CVSS v3.1:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N) — limitado a staging
- **Remediação:** Em qualquer ambiente, exigir assinatura + verificar. OU: fail-closed mesmo em DEV se `webhookSecret` ausente.

### LOTE3-A-010 — `NODE_ENV === 'production'` é case-sensitive
- **Severidade:** P2 (deploy foot-gun)
- **Arquivo:** `src/app/api/checkout/webhook/route.ts:16, 21` + `src/lib/security/webhook-verify.ts:24, 32, 34, 51, 71` + `src/middleware.ts:41, 87`
- **Linha:** (múltiplos)
- **Categoria:** Configuration Misinterpretation
- **Descrição:** Verificações `process.env.NODE_ENV === 'production'` são case-sensitive. Se deploy setar `NODE_ENV='Production'` (capital P), todas as proteções fail-closed são desativadas — tratado como dev.
- **Evidência:** Padrão observado em 8+ arquivos do codebase.
- **Impacto:** Em deploy mal-configurado (e.g., Docker `ENV NODE_ENV=Production`), webhook perde fail-closed, `strongSecret` não é checado, master key bypass se ativa em "produção".
- **OWASP:** A05:2021
- **CVSS v3.1:** 4.0 (AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:L) — depender de erro de deploy
- **Remediação:** Normalizar via `const isProd = process.env.NODE_ENV?.toLowerCase() === 'production'` em helper centralizado.

### LOTE3-A-010b — `process.env.ZCC_ADMIN_EMAILS` acessado no client `login/page.tsx:208`
- **Severidade:** P2 (information leak ou código morto)
- **Arquivo:** `src/app/login/page.tsx`
- **Linha:** 208
- **Categoria:** Information Disclosure / Dead Code
- **Descrição:** `const isZccAdmin = (process.env.ZCC_ADMIN_EMAILS || '').toLowerCase().includes(credentialData.email.toLowerCase());` — código client-side tentando ler env var server-only. Em Next.js, env vars sem prefixo `NEXT_PUBLIC_` não são expostas ao browser — então `process.env.ZCC_ADMIN_EMAILS` é `undefined` no client e `isZccAdmin` é sempre `false`. Se a env var fosse acidentalmente prefixada `NEXT_PUBLIC_`, vaza a lista completa de admin emails ao browser.
- **Evidência:** Análise do source.
- **Impacto:** (1) Funcionalidade quebrada — redirect para `/zcc` nunca acontece via este caminho. (2) Risco latente de leak se renomeada para `NEXT_PUBLIC_ZCC_ADMIN_EMAILS`.
- **OWASP:** A04:2021
- **CVSS v3.1:** 3.1 (AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N)
- **Remediação:** Mover a checagem para o servidor (e.g., retorno do `signIn` callback).

### LOTE3-A-011 — Comparação de length pré-check em `safeEqualHex` não é timing-safe
- **Severidade:** P3 (timing leak teórico)
- **Arquivo:** `src/lib/security/webhook-verify.ts`
- **Linha:** 10-12
- **Categoria:** Timing Side-Channel (minor)
- **Descrição:** `function safeEqualHex(received: string, expected: string): boolean { if (!/^[0-9a-f]+$/i.test(received) || received.length !== expected.length) return false; try { return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex')); } catch { return false; } }` — o early-return em `received.length !== expected.length` leaks info sobre o comprimento do hash esperado. Em prática, o atacante já sabe o algoritmo (HMAC-SHA256 = 64 hex chars), então leak é zero-practical.
- **Evidência:** Leitura direta do source.
- **Impacto:** Negligenciável — algoritmo é conhecido.
- **OWASP:** A02:2021
- **CVSS v3.1:** 2.0 (AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N)
- **Remediação:** Padding para tamanho fixo antes de comparar.

### LOTE3-A-012 — Master key em DEV usa comparação `===` (não timing-safe)
- **Severidade:** P3 (DEV-only)
- **Arquivo:** `src/lib/zcc-security.ts`
- **Linha:** 140
- **Categoria:** Timing Side-Channel (DEV-only)
- **Descrição:** `if (process.env.NODE_ENV !== 'production' && masterKey && process.env.ZCC_MASTER_KEY && masterKey === process.env.ZCC_MASTER_KEY)` — usa `===` (não timing-safe). Comparação curto-circuita em `masterKey && process.env.ZCC_MASTER_KEY` antes de `===`.
- **Evidência:** Leitura direta do source.
- **Impacto:** Limitado a DEV — não exploração em produção.
- **OWASP:** A02:2021
- **CVSS v3.1:** 2.0 (DEV-only)
- **Remediação:** Usar `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` com length check prévio.

### LOTE3-A-013 — Ausência de proteção contra replay no webhook
- **Severidade:** P2
- **Arquivo:** `src/app/api/checkout/webhook/route.ts` + `src/lib/security/webhook-verify.ts`
- **Linha:** N/A (ausência de feature)
- **Categoria:** Replay Attack Window
- **Descrição:** Não há cache de nonces / ids de webhooks já processados. A janela de 5 min (`MP_MAX_SKEW_MS`) permite que o mesmo webhook seja reprocessado múltiplas vezes. O estado é idempotente (via MP API fetch retorna status atual), mas gasta quota MP API e cria ruído de auditoria.
- **Evidência:** Leitura direta — não há `db.paymentWebhookEvent` ou cache Redis de `ts:v1` em lugar algum.
- **Impacto:** DoS via replay, abuso de quota MP API, poluição de auditoria. Não escala para comprometimento de dados.
- **OWASP:** A07:2021
- **CVSS v3.1:** 4.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L)
- **Remediação:** Persistir `(paymentId, ts, v1)` hash em DB ou Redis com TTL de 5 min + 10%; rejeitar duplicatas.

### LOTE3-A-014 — Falta `checkout-webhook-mpay011.test.ts` no clone GLM
- **Severidade:** P1 BLOCKER (auditoria)
- **Arquivo:** `tests/security/checkout-webhook-mpay011.test.ts` (declarado, ausente)
- **Linha:** N/A
- **Categoria:** Insufficient Evidence
- **Descrição:** Antigravity declara 5 testes novos neste arquivo — arquivo não existe no clone GLM. Não há como verificar: casos cobertos, escopo, se REPLACEMENT ou ADDITION ao `checkout-webhook-regression.test.ts`.
- **Evidência:** `find tests -name "checkout-webhook-mpay011*"` retorna vazio.
- **Impacto:** Impossível auditar cobertura de testes para M-PAY-011.
- **OWASP:** N/A
- **CVSS v3.1:** N/A
- **Remediação:** Transferir o arquivo `tests/security/checkout-webhook-mpay011.test.ts` do clone Antigravity para GLM.

---

## 6. Validation Gaps

A auditoria foi incapaz de validar os seguintes pontos por ausência de patches/arquivos:

| Gap | Artefato faltante | Impacto na auditoria |
|---|---|---|
| Conteúdo do commit `ebc54d25` (Fase 0) | Patch não transferido | Impossível determinar escopo de "fail-closed Mercado Pago webhook" — se alterou `route.ts`, `webhook-verify.ts`, ou outro arquivo. Impossível verificar se o teste `checkout-webhook-regression.test.ts` (que exige a literal `webhookSecret!`) ainda passa após a refactor. |
| Conteúdo do commit `2e021a9d` (LOTE 3) | Patch não transferido | Impossível verificar "session revocation, tenant status invalidation, middleware hardening" — escopo real desconhecido. |
| Arquivo `tests/security/checkout-webhook-mpay011.test.ts` | Arquivo ausente no GLM | Não há como auditar os 5 casos declarados. |
| Teste source-text `password-reset-flow.test.ts:34` vs. refactor `ebc54d25` | Conflito contratual | Se o commit removeu a literal `marciocau14@gmail.com`, este teste quebra — mas Antigravity declara 61/61. Discrepância a esclarecer. |
| Execução real de testes (sem `node_modules`) | Ambiente sem deps | Não foi possível executar `vitest run` para validar empiricamente o 61/61 declarado. Análise baseada em leitura estática do source. |
| Diff entre `ebc54d25` e `a0bb1a85` em `src/app/api/checkout/webhook/route.ts` | Patch não disponível | Não há como saber se o refactor preserva a literal exata `verifyMercadoPagoWebhook(rawBody, signature, webhookSecret!, paymentId, requestId)` — se não, o teste source-text falha. |

---

## 7. Veredito Final + Demos Necessárias

### 7.1 Veredito

🟡 **DECLARED_FIXED — INSUFFICIENT EVIDENCE** (com dois subscores técnicos)

- **M-PAY-011:** ✅ baseline `a0bb1a85` já é fail-closed em produção. A regressão M-PAY-011 descrita pelo V5 advém do patch Wave 1 que **nunca foi aplicado** à árvore GLM. O commit `ebc54d25` declarado é teoricamente redundante OU cobre outro aspecto que não pode ser confirmado sem o patch.
- **Admin Fallback:** 🔴 3 ocorrências de fallback hardcoded (`marciocau14@gmail.com`) continuam presentes no baseline. Sem o patch, não há como validar a declaração de remoção. Há também **conflito contratual** com `tests/auth/password-reset-flow.test.ts:34` que EXIGE a literal.

### 7.2 O que o Antigravity precisa demonstrar

Para que a auditoria possa elevar o veredito a **VERIFIED**, o Antigravity deve fornecer:

1. **Diff completo do commit `ebc54d25`** em todos os arquivos tocados (especialmente `src/app/api/checkout/webhook/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/magic-link/route.ts`, `src/app/zcc/login/page.tsx`, `tests/auth/password-reset-flow.test.ts`, `tests/security/checkout-webhook-regression.test.ts`, `tests/security/checkout-webhook-mpay011.test.ts`).

2. **Conteúdo do arquivo `tests/security/checkout-webhook-mpay011.test.ts`** — os 5 casos declarados, em fonte.

3. **Confirmação explícita da interpretação de "remove admin fallback"** — qual dos sub-casos (a/b/c/d) foi implementado:
   - (a) Remover literal `'marciocau14@gmail.com'` dos defaults de env
   - (b) Remover `db.tenant.create({ role: 'system_admin' })` provisioning
   - (c) Remover `useState('marciocau14@gmail.com')` da UI
   - (d) Todas

4. **Se (a) foi implementado:** esclarecer como o teste `tests/auth/password-reset-flow.test.ts:34` (`expect(route).toContain('marciocau14@gmail.com')`) ainda passa — foi modificado, deletado, ou mantido?

5. **Saída de execução dos testes** — log real do `vitest run` com 61/61 declarados (com `node_modules` instalado), evidenciando quais testes passaram/falharam após o patch.

6. **Esclarecimento sobre o Wave 1 patch** — o patch `wave3_pasted_patch.diff` deve ser descartado/explicitamente revertido, ou declarado como superseded por `ebc54d25`? Sem isso, há ambiguidade sobre qual estado é o "correto" do webhook.

7. **Para o commit `2e021a9d` (LOTE 3):** diff em `src/middleware.ts`, `src/lib/zcc-security.ts`, `src/lib/auth.ts` e arquivos de session/tenant/status — escopo real do hardening.

Sem estes itens, o veredito permanece **INSUFFICIENT EVIDENCE** para M-PAY-011 e **NO-GO** para Admin Fallback (devido ao conflito contratual com teste existente + 3 fallbacks hardcoded ainda presentes no baseline).

---

## 8. Anexos

### 8.1 Hashes e referências

- Baseline HEAD: `a0bb1a85` (em `main`)
- Commit fail-closed original: `4f829a13` (2026-08-21, "fix: harden checkout Mercado Pago webhook verification")
- Commits Antigravity declarados: `ebc54d25` (Fase 0), `2e021a9d` (LOTE 3) — não presentes no clone GLM
- Artefato Wave 1 patch: `/home/z/my-project/scripts/wave3_pasted_patch.diff` (declarado em V5, não aplicado à árvore)

### 8.2 Arquivos lidos (baseline)

| Arquivo | Linhas | SHA256 (aprox) |
|---|---|---|
| `src/app/api/checkout/webhook/route.ts` | 87 | — |
| `src/lib/security/webhook-verify.ts` | 93 | — |
| `src/app/api/auth/magic-link/route.ts` | 101 | — |
| `src/app/api/auth/forgot-password/route.ts` | 52 | — |
| `src/lib/auth.ts` | 147 | — |
| `src/middleware.ts` | 148 | — |
| `src/lib/zcc-security.ts` | 176 | — |
| `src/app/zcc/login/page.tsx` | 111 | — |
| `tests/security/checkout-webhook-regression.test.ts` | 21 | — |
| `tests/security/webhook-verify-regression.test.ts` | 20 | — |
| `tests/auth/password-reset-flow.test.ts` | 42 | — |
| `tests/security/production-auth-canary.test.ts` | 64 | — |
| `tests/security-hardening-12-fronts.test.ts` | 42 | — |

### 8.3 Mapa de evidência por sub-claim do Antigravity

| Declaração Antigravity | Status | Evidência |
|---|---|---|
| `ebc54d25`: "fail-closed Mercado Pago webhook" | 🟡 DECLARED_FIXED | Baseline `a0bb1a85` já é fail-closed (linhas 16-19, 21-38); patch não transferido para validar diferenças |
| `ebc54d25`: "remove admin fallback" | 🔴 NO-GO | 3 fallbacks hardcoded ainda presentes no baseline; teste existente `password-reset-flow.test.ts:34` exige a literal — conflito contratual |
| `2e021a9d`: "session revocation, tenant status invalidation, middleware hardening" | 🔴 INSUFFICIENT EVIDENCE | Patch não transferido; escopo real desconhecido |
| "61/61 tests PASS" | 🟡 DECLARED — não reproduzível | Sem `node_modules` no clone GLM; análise estática não contradiz, mas conflito LOTE3-A-006 sugere discrepância |

---

**Fim do relatório.**
