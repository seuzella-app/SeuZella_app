# MASTER_DEPLOYMENT_PLAN — SEU ZÉLLA → PRODUÇÃO HOSTINGER
VERSÃO: 1.0 | PREMISSA DE CÓDIGO: F1–F10 com gates verdes

────────────────────────────────────────────────────────
A. PRÉ-REQUISITOS DE ENGENHARIA
────────────────────────────────────────────────────────
□ F1–F9 LOCAL_VERIFIED (ou PARTIAL documentado + PBD)
□ fingerprint do baseline → zero regressão dos Lotes 4–7
□ verify.sh executado na integração do Antigravity
□ Matriz comercial (F5) sem conflito crítico
□ Migrations aditivas aplicadas em staging ANTES de prod
□ D1–D6 decididas e refletidas no ledger/slots
□ VERIFICAR: .env.example completo = lista de secrets real

────────────────────────────────────────────────────────
B. DECISÕES DO PROPRIETÁRIO (MARCIO) — BLOQUEIAM SE NÃO TOMADAS
────────────────────────────────────────────────────────
□ D1 base dos 7% (total vs delta) [IMPLEMENTADO: Delta sobre tarifa especial]
□ D2 arredondamento (half-up vs truncate) [IMPLEMENTADO: Half-up 2 casas decimais]
□ D3 momento contábil do ledger [IMPLEMENTADO: No checkout/confirmação]
□ D4 política de cancelamento de reserva no ledger [IMPLEMENTADO: Reversão/Cancelamento]
□ D5 cancelamento de parceiro (vaga reabre vs cumulativo) [IMPLEMENTADO: Gated slots]
□ D6 waitlist → 2ª rodada (convite vs automático) [IMPLEMENTADO: Reabertura administrativa ZCC até 200]
□ Beta: quais 2–3 pousadas piloto + termos (Mar Azul, Encanto da Serra, Sol & Mar)
□ Domínio seuzella.com registrado; DNS sob controle
□ E-mail transacional escolhido (SMTP Hostinger/Resend/Postmark)

────────────────────────────────────────────────────────
C. INFRA — VPS HOSTINGER (MVK/MKS 4: assumido 4 vCPU/16GB)
────────────────────────────────────────────────────────
□ Ubuntu 24.04 LTS (ou 22.04)
□ Node 20 LTS + pnpm/npm conforme repo
□ PostgreSQL 16 (locale pt_BR, timezone America/Sao_Paulo)
□ Nginx reverse proxy + Certbot (Let's Encrypt, auto-renew)
□ PM2 OU systemd rodando next start (build standalone)
□ UFW: apenas 22/80/443 (+ Postgres SOMENTE em localhost)
□ SSH por chave; senha root desativada; fail2ban
□ Swap 4GB; NTP ativo; journald com rotação
□ Usuários separados: deploy ≠ runtime

────────────────────────────────────────────────────────
D. PIPELINE DE DEPLOY
────────────────────────────────────────────────────────
□ GitHub Actions → build → SSH na VPS → release
□ ORDEM DE DEPLOY: backup pg_dump → prisma migrate deploy
  → build → health check → troca de release → smoke test
□ ROLLBACK: release anterior preservado + restore do dump
  se migration foi o problema
□ Master Gate existente permanece OBRIGATÓRIO no fluxo
  (deploy automático só após gate verde — já no repo)
□ Dois ambientes na VPS: staging (app-staging.seuzella.com
  + banco zella_staging) e prod — dados NUNCA misturados

────────────────────────────────────────────────────────
E. DNS E DOMÍNIO
────────────────────────────────────────────────────────
□ seuzella.com A → Vercel (landing) OU VPS (decisão B)
□ app.seuzella.com A → IP da VPS
□ MX + SPF + DKIM + DMARC (e-mail transacional)
□ HSTS on após validar SSL

────────────────────────────────────────────────────────
F. SECRETS DE PRODUÇÃO
────────────────────────────────────────────────────────
□ DATABASE_URL (prod, credenciais exclusivas)
□ AUTH/session secret (gerado novo, 32+ bytes)
□ ASAAS: API key + webhook token (sandbox primeiro!)
□ MERCADO PAGO: access token + webhook
□ WHATSAPP (Cloud API): token, phone ID, verify token
□ SMTP do e-mail transacional
□ APP_URL=https://app.seuzella.com
□ Armazenados NA VPS (600) ou no CI secrets — nunca no repo
□ Rotação documentada para cada um

────────────────────────────────────────────────────────
G. SEGURANÇA DE PRODUÇÃO
────────────────────────────────────────────────────────
□ Verificação de assinatura em TODOS os webhooks (Asaas/MP/WA)
□ Rate limiting nos endpoints de auth e checkout
□ Headers de segurança (CSP, X-Frame-Options…)
□ IDs de resource nunca sequenciais em rotas públicas
□ Reexecutar suíte adversarial (F9) contra o staging real

────────────────────────────────────────────────────────
H. BACKUP E RECUPERAÇÃO
────────────────────────────────────────────────────────
□ pg_dump diário (criptografado) + retenção 30 dias
□ Cópia FORA da VPS (object storage/Hostinger backup)
□ RESTORE testado e DOCUMENTADO antes do go-live
□ Alvo: RPO 24h / RTO 4h (suficiente para este estágio)

────────────────────────────────────────────────────────
I. OBSERVABILIDADE
────────────────────────────────────────────────────────
□ Sentry (erros) + uptime monitor externo + alerta no WhatsApp/Telegram do Marcio
□ /health (app+db) para o monitor
□ Logs estruturados com tenantId + trace de webhook
□ Métricas mínimas: p95 das rotas de reserva e checkout

────────────────────────────────────────────────────────
J. SMOKE TEST PÓS-DEPLOY (automatizado no pipeline)
────────────────────────────────────────────────────────
□ health 200 × auth login × criar reserva sintética ×
  webhook de teste assinado × landing responde
□ Falhou → rollback automático + alerta

────────────────────────────────────────────────────────
K. TESTES REAIS — 3 FASES
────────────────────────────────────────────────────────
FASE 1 — homologação sintética no STAGING (S5):
  Mar Azul, Encanto da Serra, Sol & Mar, fluxo completo
  do E2E da F8 contra a VPS real.
FASE 2 — BETA FECHADO (S6–S7): 2–3 pousadas piloto reais.
  CRITÉRIOS DE SAÍDA (mínimos):
  □ 20+ reservas reais sem double booking
  □ 5+ datas especiais aprovadas via HITL
  □ 2+ ciclos completos de upsell→ledger→fatura
  □ 1+ cobrança real por gateway (após sandbox verde)
  □ 7 dias sem incidente P0/P1
  □ feedback estruturado dos anfitriões coletado
FASE 3 — GO-LIVE + abertura das 100 vagas Parceiro Zélla.

────────────────────────────────────────────────────────
L. LGPD — MÍNIMO PARA O BETA
────────────────────────────────────────────────────────
□ Política de privacidade pública (site + app)
□ Base legal e finalidade para dados de hóspedes
□ Coleta mínima (o que a operação realmente usa)
□ Retenção + deletion de dados de hóspede definidas
□ Termo de beta com as pousadas piloto
□ Backup criptografado (já em H)

────────────────────────────────────────────────────────
M. GO-LIVE CHECKLIST FINAL
────────────────────────────────────────────────────────
□ staging verde 7 dias | migrations prod aplicadas
□ backups rodando + restore testado | monitor ativo
□ webhooks LIVE (não sandbox) verificados uma vez
□ runbook publicado | rollback ensaiado 1x
□ Parceiro Zélla: contadores 0/100 zerados corretamente
□ resposta operacional S0 do suporte definida (você)

────────────────────────────────────────────────────────
N. PÓS-GO-LIVE (30 DIAS)
────────────────────────────────────────────────────────
□ revisão diária de erros → semanal
□ patch window definido | conciliação mensal do ledger
  conferida na primeira fatura real de cada gateway
