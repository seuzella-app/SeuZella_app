# 🟢 GO-LIVE CHECKLIST & QUADRO DE PRONTIDÃO — SEU ZÉLLA (VPS HOSTINGER MVK4)

Este documento é o **quadro vivo de controle de prontidão para o lançamento oficial em produção**. Conforme cada etapa for concluída, marcamos o checkbox correspondente `[X]` até atingir **100% de aprovação e o Sinal Verde de Lançamento**.

---

## 🚦 STATUS ATUAL DO SINAL DE LANÇAMENTO

```
 📊 PROGRESSO DA PRONTIDÃO: [ 4 / 16 ] ETAPAS CONCLUÍDAS (25%)
 🟡 SINAL ATUAL: AMARELO (Fase de Preparação de Infraestrutura & Domínio)
```

---

## 📋 FASE 1: INFRAESTRUTURA DE MARCA, DOMÍNIO & GITHUB CORPORATIVO

- [ ] **1.1 Compra do Domínio Oficial**
  * **Ação**: Registrar `seuzella.com` no painel da Hostinger.
  * **Status**: ⏳ Pendente

- [ ] **1.2 Criação dos E-mails Corporativos**
  * **Ação**: Criar `contato@seuzella.com` e `suporte@seuzella.com` na Hostinger com chave SPF e DKIM ativas.
  * **Status**: ⏳ Pendente

- [ ] **1.3 Criação do GitHub Corporativo & Transferência**
  * **Ação**: Criar conta/organização GitHub com `contato@seuzella.com` e transferir o repositório (`Settings ➔ Options ➔ Transfer Repository`).
  * **Status**: ⏳ Pendente

- [ ] **1.4 Configuração de Registros de DNS na Hostinger**
  * **Ação**: Apontar registros tipo `A` para o IP público fixo da VPS MVK4 (`seuzella.com`, `app.seuzella.com`, `zcc.seuzella.com`).
  * **Status**: ⏳ Pendente

---

## 🔐 FASE 2: VARIÁVEIS DE AMBIENTE & CREDENCIAIS DE PRODUÇÃO (`.env.production`)

- [ ] **2.1 MercadoPago Token de Produção**
  * **Ação**: Inserir credenciais `APP_USR-...` de produção no `.env.production` da VPS.
  * **Status**: ⏳ Pendente

- [ ] **2.2 Asaas API Key de Produção**
  * **Ação**: Inserir chave de produção do Asaas para emissão de PIX/Boleto no `.env.production`.
  * **Status**: ⏳ Pendente

- [ ] **2.3 Stripe Live Secret Key**
  * **Ação**: Inserir chave secreta de produção (`sk_live_...`) no `.env.production`.
  * **Status**: ⏳ Pendente

- [ ] **2.4 Provedores de IA Multi-Cloud (OpenAI / Gemini / Groq / DeepSeek / Claude)**
  * **Ação**: Configurar chaves de API com faturamento e cotas ativas no `.env.production`.
  * **Status**: ⏳ Pendente

- [ ] **2.5 Instância Oficial do WhatsApp Business**
  * **Ação**: Conectar gateway de produção ao número oficial do WhatsApp do Seu Zélla.
  * **Status**: ⏳ Pendente

- [ ] **2.6 Chave Secreta de Sessão (`NEXTAUTH_SECRET`)**
  * **Ação**: Gerar string aleatória de 32+ caracteres e definir `NEXTAUTH_URL="https://seuzella.com"`.
  * **Status**: ⏳ Pendente

---

## 🛡️ FASE 3: ESTEIRA DE CI/CD & TESTES AUTOMATIZADOS (GITHUB ACTIONS)

- [x] **3.1 Workflows de Fechaduras Eletrônicas & IoT (194 cenários)**
  * **Ação**: `smart-locks-ci.yml` e `locks-stress-ci.yml` validados com 100% de sucesso.
  * **Status**: ✅ Concluído (Verde 🟢)

- [x] **3.2 Workflows de Inteligência ML & Autodefesa**
  * **Ação**: `cerebro-ml-defense.yml` testando autodefesa, DSPy e antiauto-hack.
  * **Status**: ✅ Concluído (Verde 🟢)

- [x] **3.3 Workflows de Isolamento Multi-Tenant & RLS**
  * **Ação**: `ci-multitenant-rls-guard.yml` impedindo vazamento de dados entre pousadas.
  * **Status**: ✅ Concluído (Verde 🟢)

- [x] **3.4 Workflows de Resiliência de IA, Cobranças e Build de Produção**
  * **Ação**: `ci-auth-rbac-guard.yml`, `ci-llm-failover-resilience.yml`, `ci-credits-billing-audit.yml`, `ci-production-build-smoke.yml` salvos e validados.
  * **Status**: ✅ Concluído (Verde 🟢)

---

## 🚀 FASE 4: DEPLOYMENT EM 1-CLIQUE NA VPS HOSTINGER MVK4

- [ ] **4.1 Configuração PM2 Cluster**
  * **Ação**: Arquivo `ecosystem.config.js` pronto na raiz para reinício gracioso sem downtime.
  * **Status**: ⏳ Aguardando Fase 1 e 2

- [ ] **4.2 Script de Deploy & Rollback Automatizado**
  * **Ação**: Script `scripts/deploy-mvk4.sh` com permissão de execução e verificação `/api/health`.
  * **Status**: ⏳ Aguardando Fase 1 e 2

- [ ] **4.3 Disparo do Deploy em Produção (Sinal Verde 🟢)**
  * **Ação**: Executar o comando na VPS:
    ```bash
    bash /var/www/seuzella/scripts/deploy-mvk4.sh
    ```
  * **Status**: ⏳ Aguardando Conclusão de Todos os Itens

---

## 🎯 HISTÓRICO DE ATUALIZAÇÕES DO QUADRO DE PRONTIDÃO

* **2026-08-03**: Criação do Quadro de Controle com as 4 suítes de CI/CD automatizadas e 100% aprovadas (Fase 3 concluída).
