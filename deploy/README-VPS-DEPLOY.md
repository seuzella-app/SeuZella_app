# ============================================================================
# SEU ZÉLLA — VPS HOSTINGER MVK 4 DEPLOYMENT GUIDE
# ============================================================================
# Runbook completo para subir o Cérebro Zélla em produção na VPS.
# Tempo estimado: 60-90 minutos (primeiro deploy).
# ============================================================================

## 📋 PRÉ-REQUISITOS

### Recursos da VPS Hostinger MVK 4
- 4 vCPU
- 16 GB RAM
- 200 GB NVMe SSD
- 8 TB bandwidth/mês
- Ubuntu 22.04 ou 24.04 LTS

### Acesso necessário
- SSH root na VPS
- Domínio configurado apontando para o IP da VPS (DNS A record)
- Conta no GitHub com acesso ao repo `MarcioCau14/SmartHotel_Zehla`
- Conta no Upstash Redis (gratuito para começar)
- Conta no Meta for Developers (WhatsApp Cloud API)
- Conta no Mercado Pago (token de produção)
- Conta no Booking.com Partner (para webhook reviews)

---

## 🚀 SETUP INICIAL DA VPS (executar 1 vez)

### Passo 1: Conectar via SSH
```bash
ssh root@IP_DA_SUA_VPS
```

### Passo 2: Atualizar sistema
```bash
apt update && apt upgrade -y
apt install -y curl wget git build-essential nginx ufw fail2ban
```

### Passo 3: Configurar firewall (UFW)
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP
ufw allow 443/tcp       # HTTPS
ufw --force enable
```

### Passo 4: Instalar Node.js 22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version  # deve mostrar v22.x.x
```

### Passo 5: Instalar Bun
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version  # deve mostrar 1.x.x
```

### Passo 6: Instalar PM2 (gerenciador de processos)
```bash
npm install -g pm2
pm2 --version
```

### Passo 7: Instalar PostgreSQL 16
```bash
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Criar database e user
sudo -u postgres psql << EOF
CREATE USER seuzella WITH PASSWORD 'SUA_SENHA_FORTE_AQUI';
CREATE DATABASE seuzella_prod OWNER seuzella;
GRANT ALL PRIVILEGES ON DATABASE seuzella_prod TO seuzella;
ALTER USER seuzella WITH SUPERUSER;  # necessário para migrations
EOF

# Testar conexão
psql -U seuzella -d seuzella_prod -h localhost -c "SELECT version();"
```

### Passo 8: Instalar Certbot (Let's Encrypt)
```bash
apt install -y certbot python3-certbot-nginx
```

### Passo 9: Criar usuário deploy (não usar root para app)
```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /var/www/seuzella
chown -R deploy:deploy /var/www/seuzella
```

---

## 📥 DEPLOY DA APLICAÇÃO

### Passo 1: Clonar repo
```bash
sudo -u deploy git clone https://github.com/MarcioCau14/SmartHotel_Zehla.git /var/www/seuzella
cd /var/www/seuzella
git checkout main
```

### Passo 2: Configurar .env.production
```bash
cp deploy/.env.example .env.production
nano .env.production
# PREENCHER TODAS AS VARIÁVEIS COM VALORES REAIS
```

**Variáveis críticas que PRECISAM ser preenchidas:**
- `DATABASE_URL` → use a senha do PostgreSQL criada acima
- `NEXTAUTH_SECRET` → `openssl rand -base64 32`
- `NEXTAUTH_URL` → `https://seudominio.com.br`
- `CRON_SECRET` → `openssl rand -hex 32`
- `ENCRYPTION_SECRET` → `openssl rand -hex 32`
- `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_ACCESS_TOKEN`
- `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
- `BOOKING_COM_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `ZELLA_M2M_ED25519_PUBLIC_KEY`, `ZELLA_M2M_ED25519_PRIVATE_KEY`

### Passo 3: Gerar par de chaves Ed25519 (para M2M cron auth)
```bash
openssl genpkey -algorithm ed25519 -out /tmp/private.pem
openssl pkey -in /tmp/private.pem -pubout -out /tmp/public.pem

# Copiar conteúdo (sem quebras de linha) para .env.production
echo "PUBLIC KEY (uma linha):"
cat /tmp/public.pem | tr -d '\n'
echo ""
echo "PRIVATE KEY (uma linha):"
cat /tmp/private.pem | tr -d '\n'
```

### Passo 4: Rodar deploy script
```bash
cd /var/www/seuzella
sudo bash deploy/deploy-vps.sh
```

O script vai:
1. ✅ Instalar dependências (`npm install --legacy-peer-deps`)
2. ✅ Gerar Prisma client
3. ✅ Aplicar migrations PostgreSQL (`prisma migrate deploy`)
4. ✅ Build do Next.js (`npm run build`)
5. ✅ Copiar arquivos estáticos para standalone
6. ✅ Iniciar PM2 em cluster mode (2 instâncias)
7. ✅ Configurar nginx reverse proxy
8. ✅ Instalar 17 crons
9. ✅ Solicitar certificado SSL Let's Encrypt
10. ✅ Rodar smoke tests

### Passo 5: Configurar PM2 startup
```bash
pm2 save
pm2 startup systemd
# (executar o comando que ele printar)
```

---

## 🔌 CONFIGURAR WEBHOOKS EXTERNOS

### Meta WhatsApp Cloud API
1. Acesse https://developers.facebook.com/apps
2. Selecione seu app → WhatsApp → Configuration
3. **Callback URL**: `https://seudominio.com.br/api/webhooks/whatsapp`
4. **Verify Token**: o mesmo que colocou em `META_VERIFY_TOKEN`
5. Subscribe fields: `messages`, `message_status`, `message_template_status_update`

### Mercado Pago
1. Acesse https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua app → Webhooks
3. **URL**: `https://seudominio.com.br/api/webhooks/payment`
4. Events: `payment.updated`, `payment.created`, `subscription.canceled`, `invoice.paid`, `invoice.payment_failed`

### Mercado Pago Checkout
1. Mesma app → Preferences → Webhooks
2. **URL**: `https://seudominio.com.br/api/checkout/webhook`

### Booking.com (reviews)
1. Acesse https://admin.booking.com/extranet → Settings → Webhooks
2. **URL**: `https://seudominio.com.br/api/webhooks/booking-com/reviews`
3. **Secret**: o mesmo que `BOOKING_COM_WEBHOOK_SECRET`
4. Events: `review_posted`

---

## ⏰ CRON JOBS (JÁ CONFIGURADOS PELO DEPLOY SCRIPT)

Os 17 crons são instalados em `/etc/cron.d/seuzella`. Para validar:

```bash
cat /etc/cron.d/seuzella
```

Schedules:
| Cron | Schedule | Função |
|---|---|---|
| cerebro-watchdog | `* * * * *` (1 min) | AnomalyDetector em tempo real |
| cerebro-analyze | `*/15 * * * *` | GLM 5.2 análise de anomalias |
| cerebro-orchestrator | `*/5 * * * *` | Master loop |
| cerebro-budget-forecast | `0 6 * * *` | Forecast custo Meta |
| cerebro-churn-predict | `0 7 * * *` | Previsão de churn |
| cerebro-cleanup | `0 2 * * 0` | Limpeza semanal |
| cerebro-distill | `0 23 * * *` | Knowledge consolidation |
| cerebro-refactor-check | `0 */6 * * *` | Sugerir refactor |
| budget-reset | `0 0 * * *` | Reset diário |
| metrics-snapshot | `0 22 * * *` | Métricas diárias |
| weekly-report | `0 10 * * 1` | Relatório semanal |
| ota-token-expiry | `0 * * * *` | OAuth tokens expirando |
| plan-expiry | `0 12 * * *` | Trials/assinaturas expirando |
| booking-daily | `0 9 * * *` | Check-ins/check-outs de hoje |
| payment-overdue | `0 */6 * * *` | Pagamentos atrasados |
| achievements-check | `30 3 * * *` | Milestones PARCEIRO |
| plan-limits-check | `0 11 * * *` | Limites LITE |

---

## 🧠 ATIVAR CÉREBRO LIVE MODE (opcional, quando tiver API key GLM 5.2)

Edite `.env.production`:
```bash
CEREBRO_LIVE_MODE="true"
GLM_5_2_API_KEY="sua_key_do_chat_z_ai"
CEREBRO_MONTHLY_BUDGET_USD="20"  # hard cap
```

Reinicie:
```bash
cd /var/www/seuzella
pm2 reload seuzella
```

Validar:
```bash
# Disparar cron manualmente
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://seudominio.com.br/api/cron/cerebro-analyze | jq .

# Verificar logs
pm2 logs seuzella --lines 50
```

---

## 📊 MONITORAMENTO

### Status dos processos
```bash
pm2 status
pm2 monit
pm2 logs seuzella --lines 100
```

### Logs dos crons
```bash
tail -f /var/log/seuzella/cron/cerebro-watchdog.log
tail -f /var/log/seuzella/cron/errors.log
```

### Health check
```bash
curl https://seudominio.com.br/health
# Esperado: "ok"
```

### Verificar PostgreSQL
```bash
sudo -u postgres psql -d seuzella_prod -c "SELECT count(*) FROM tenants;"
sudo -u postgres psql -d seuzella_prod -c "SELECT count(*) FROM notifications;"
sudo -u postgres psql -d seuzella_prod -c "SELECT count(*) FROM cerebro_analyses;"
```

---

## 🔄 DEPLOY DE ATUALIZAÇÕES

Quando você fizer novo commit no repo GitHub e quiser deployar:

```bash
cd /var/www/seuzella
sudo bash deploy/deploy-vps.sh
```

O script faz **zero-downtime reload** (PM2 cluster mode).

---

## 🚨 TROUBLESHOOTING

### App não responde
```bash
pm2 status                    # processo está online?
pm2 logs seuzella --lines 50  # ver erros
sudo systemctl status nginx   # nginx ok?
curl http://localhost:3000/   # app responde internamente?
```

### Erro 502 Bad Gateway
```bash
pm2 restart seuzella
sudo nginx -t && sudo systemctl reload nginx
```

### Cron não está disparando
```bash
# Verificar se cron service está rodando
sudo systemctl status cron

# Verificar perm do arquivo
ls -la /etc/cron.d/seuzella

# Verificar logs
tail -f /var/log/seuzella/cron/errors.log

# Disparar manualmente para testar
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://seudominio.com.br/api/cron/booking-daily
```

### SSL expirou
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Database cheio
```bash
sudo -u postgres psql -d seuzella_prod << EOF
SELECT schemaname, relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
EOF

# Limpar logs antigos (manter 30 dias)
sudo -u postgres psql -d seuzella_prod -c "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days';"
sudo -u postgres psql -d seuzella_prod -c "DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '30 days';"
```

---

## 📋 CHECKLIST PÓS-DEPLOY

- [ ] `curl https://seudominio.com.br/health` retorna "ok"
- [ ] `curl https://seudominio.com.br/mobile/pousada` retorna 200
- [ ] `curl https://seudominio.com.br/mobile/airbnb` retorna 200
- [ ] `curl https://seudominio.com.br/sw.js | grep seuzella-pwa-v2`
- [ ] `curl -I https://seudominio.com.br/sounds/alert.mp3` retorna 200
- [ ] `pm2 status` mostra seuzella online (2 instâncias)
- [ ] `sudo nginx -t` passa sem erro
- [ ] Cron job de teste disparou (verificar `/var/log/seuzella/cron/`)
- [ ] Webhook Meta configurado e respondendo 200
- [ ] Webhook Mercado Pago configurado
- [ ] Webhook Booking.com configurado
- [ ] SSL certbot ativo (`curl -I https://seudominio.com.br` mostra HTTPS válido)

---

## 🎯 PRÓXIMOS PASSOS PÓS-GO-LIVE

1. **Pilot real**: cadastrar 1 pousada real de testes (Beta)
2. **Monitorar 7 dias**: observar logs, performance, erros
3. **Ativar Cérebro Live Mode**: quando validar mock mode estável
4. **Onboarding de mais pousadas**: gradualmente (5 → 10 → 50)
5. **Backup automático**: configurar pg_dump diário via cron
6. **Sentry**: para error tracking em produção
7. **PostHog**: product analytics
8. **Uptime monitor**: UptimeRobot/BetterUptime monitorando URLs

---

**🧠 Cérebro Zélla está pronto para VPS Hostinger MVK 4.**
