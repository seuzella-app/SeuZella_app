# ZCC Digital Twin — Bateria de Testes CI/CD

5 baterias de testes para validar tudo que construímos do **ZCC Digital Twin**:
Universal Adapter Layer, 8 Cortexes, ZGS, Simulation Lab, Synthetic Brazil,
Behavioral Engine, Ads Simulator e National Simulator.

## 🚀 Uso rápido

```bash
# Roda TUDO (recomendado antes de commit/push)
./.zscripts/zcc-battery/run-all.sh

# Pula o build de produção (rápido, para iteração local)
./.zscripts/zcc-battery/run-all.sh --skip-build

# Roda apenas uma bateria específica
./.zscripts/zcc-battery/run-all.sh --only 02
```

## 📋 As 5 Baterias

| # | Bateria | Script | Duração | O que valida |
|---|---------|--------|---------|--------------|
| 01 | Type-check + Lint | `01-typecheck-lint.sh` | ~10s | `tsc --noEmit` + ESLint sem erros no código novo |
| 02 | Testes ZCC Digital Twin | `02-zcc-digital-twin-tests.sh` | ~5s | 18 testes isolados (ZCB, cortexes, behavioral, lab) |
| 03 | Suíte completa (regressão) | `03-full-regression-suite.sh` | ~40s | 185 testes / 35 arquivos — garante zero regressões |
| 04 | Build de produção | `04-production-build.sh` | ~3min | `next build` standalone + rotas `/api/zcc/*` compiladas |
| 05 | Smoke test integrado | `05-integration-soke.sh` | ~30s | Sobe Next.js + 13 chamadas HTTP às rotas ZCC |

## 🎯 Ordem recomendada de execução

```
01 → 02 → 03 → 04 → 05
```

Cada bateria é independente, mas a ordem acima vai do mais rápido/barato
para o mais caro. Se a 01 falhar, não adianta rodar a 04.

## 📊 Saída esperada (sucesso)

```
╔══════════════════════════════════════════════════════════════════╗
║                       DASHBOARD FINAL                           ║
╠══════════════════════════════════════════════════════════════════╣
║ 01-typecheck-lint                              ✅ PASS   10s   ║
║ 02-zcc-digital-twin-tests                      ✅ PASS    5s   ║
║ 03-full-regression-suite                       ✅ PASS   42s   ║
║ 04-production-build                            ✅ PASS  185s   ║
║ 05-integration-smoke                           ✅ PASS   28s   ║
╠══════════════════════════════════════════════════════════════════╣
║ Duração total:                                              270s ║
╚══════════════════════════════════════════════════════════════════╝

🎉 TODAS AS BATERIAS PASSARAM
   ZCC Digital Twin está pronto para deploy
```

## 🔧 Pré-requisitos

- Node.js 20+
- Dependências instaladas: `npm install` ou `bun install`
- `DATABASE_URL` configurado (default fallback: `file:./dev.db`)
- Para a bateria 05: porta 3999 livre (ou setar `PORT=xxxx`)

## 🐳 Uso em CI/CD (Google Cloud Build / GitHub Actions / etc.)

Cada bateria retorna exit code 0 (sucesso) ou 1 (falha), então pode ser
plugada diretamente em qualquer pipeline:

### Google Cloud Build (`cloudbuild.yaml`)

```yaml
steps:
  - name: 'node:20'
    entrypoint: 'bash'
    args: ['./.zscripts/zcc-battery/run-all.sh']
    env:
      - 'DATABASE_URL=file:./dev.db'
      - 'CI=true'
```

### GitHub Actions (workflow existente)

```yaml
- name: ZCC Digital Twin Battery
  run: ./.zscripts/zcc-battery/run-all.sh
  env:
    DATABASE_URL: file:./dev.db
```

### Pipeline paralelo (otimizado)

```yaml
jobs:
  battery-01:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: ./.zscripts/zcc-battery/01-typecheck-lint.sh

  battery-02:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: ./.zscripts/zcc-battery/02-zcc-digital-twin-tests.sh

  battery-03:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: ./.zscripts/zcc-battery/03-full-regression-suite.sh

  battery-04:
    runs-on: ubuntu-latest
    needs: [battery-01]  # só roda se 01 passou
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: ./.zscripts/zcc-battery/04-production-build.sh

  battery-05:
    runs-on: ubuntu-latest
    needs: [battery-04]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: ./.zscripts/zcc-battery/05-integration-smoke.sh
```

## 📝 Notas

- **Bateria 04** é a mais cara (~3min). Em iteração local, use `--skip-build`.
- **Bateria 05** sobe um `next dev` na porta 3999 e mata ao final.
- Todos os scripts são idempotentes — podem ser rodados múltiplas vezes.
- Logs do servidor da bateria 05 ficam em `/tmp/zcc-smoke-server.log`.
