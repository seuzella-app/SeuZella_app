# MG07VPS PROVAS DE FOGO — SZ_MG07_VPS_PREP_V1

> Ordem obrigatória: **fogo técnico (automatizado) → fogo de negócio (manual) → 24h de
> monitoramento**. Só então o sistema é considerado "em produção de verdade".

## 1. FOGO TÉCNICO (automatizado — 10 segundos)

```bash
bash SZ_VPS_DEPLOY.sh --fogo
```

O que ele prova (6 provas):

| # | Prova | Verde quando |
|---|-------|--------------|
| 1 | Serviço | `pm2 pid` responde PID vivo |
| 2 | Home | `GET /` → 2xx/3xx |
| 3 | Health | rota de health → 2xx (4xx = aviso de allowlist) |
| 4 | Contrato de erro | `POST /api/checkout/create` com `{}` → 4xx (endpoint vivo, erro tratado) |
| 5 | **PROVA MG-07** | token `ACCOUNT_EXISTS` presente no `.next/server` em serviço |
| 6 | `.env` | `shared/.env` presente |

rc=127 se qualquer prova FALHAR → resolva (FAQ runbook 13) antes de prosseguir.

## 2. FOGO DE NEGÓCIO (manual — 20–30 min, guia passo a passo)

Rode **por trás do domínio real** (ou IP), com gateway em **sandbox**. Registre cada item:
OK / problema (descreva) / N/A.

### 2.1 Ciclo de vida do tenant (o coração do produto)
- [ ] Cadastro de novo tenant com e-mail NOVO → cria conta, entra no painel
- [ ] **GATE MG-07 REAL:** guest checkout com e-mail de tenant JÁ EXISTENTE → deve retornar
      **409 ACCOUNT_EXISTS** com mensagem "Este e-mail já possui uma conta. Faça login para
      continuar." (é exatamente o comportamento restaurado pelo fix — é o teste de fogo do MG-07)
- [ ] Login com o tenant criado → sessão ok
- [ ] Logout → sessão encerrada; rota protegida depois do logout → redireciona

### 2.2 Reservas (regra de ouro do negócio)
- [ ] Criar reserva nova → aparece no calendário/agenda
- [ ] Tentar reserva no MESMO horário (conflito) → bloqueada com mensagem clara
- [ ] Editar e cancelar reserva → estado consistente

### 2.3 Billing / checkout (gateway em SANDBOX)
- [ ] Checkout com cartão de teste do gateway → aprovado
- [ ] `POST` de webhook do gateway (ferramenta de sandbox do provedor) → status da transação
      atualiza; webhook repetido (mesma chave/idempotência) → NÃO duplica efeito
- [ ] Falha de pagamento simulada → estado tratado, mensagem ao usuário
- [ ] Transações aparecem na área financeira do tenant

### 2.4 E-mails e integrações
- [ ] E-mail transacional dispara (cadastro/reserva) — caixa de entrada real
- [ ] Nenhum e-mail cai em quarentena por SPF/DKIM (se domínio novo, configure antes do GO)

### 2.5 Segurança rápida (smoke)
- [ ] `https://` com cadeado válido; http:// redireciona para https
- [ ] Tentar rota admin como tenant comum → bloqueada
- [ ] `.env` não acessível pela web (`curl https://dominio/.env` → 404/403)
- [ ] Porta 3000 FECHADA de fora (`curl http://SEU_IP:3000` de fora → timeout)

## 3. CRITÉRIO GO / NO-GO

**GO** = fogo técnico 6/6 + negócio sem item "problema" nas seções 2.1/2.2/2.3 + monitoramento
24h sem restart anômalo.
**NO-GO** = qualquer falha em 2.1/2.2/2.3 → `bash SZ_VPS_DEPLOY.sh --rollback` + diagnóstico
(colar logs no chat). O rollback é rápido e não perde a release boa — ela volta a servir imediatamente.

## 4. MONITORAMENTO 24H (3× ao dia, 2 min cada)

```bash
pm2 status && curl -fsS http://127.0.0.1:3000/api/health && df -h / && pm2 logs seuzella --lines 30 --nostream
```

Sinais de alerta: restart count crescendo; RAM subindo até `max_memory_restart` repetidamente;
5xx nos logs; disco caindo (logs sem rotação — configure `pm2 install pm2-logrotate`).
