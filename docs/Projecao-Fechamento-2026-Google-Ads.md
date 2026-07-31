# 📊 Projeção de Fechamento 2026 — Campanha Google Ads nos Hotspots Permanentes

> **Documento Interno — SeuZélla.com**
> Gerado em: 31 de Julho de 2026
> Fonte dos dados: [zella-ads-simulator.ts](file:///Users/marciocau/SeuZella_project/src/lib/marketing/zella-ads-simulator.ts)
> Validado por: 167 testes automatizados (33/33 arquivos verdes)
> Commit: `d924bf0` — branch `main`

---

## 1. Resumo Executivo

| Métrica | Valor |
|---------|:-----:|
| **Período** | Setembro → Dezembro 2026 (16 semanas) |
| **Investimento Total em Ads** | **R$ 14.200,00** |
| **Vendas Novas Realizadas** | **178 pousadas/anfitriões** |
| **Clientes Pagantes Ativos em 31/12** | **169** (com churn de 5%/mês) |
| **MRR em 31/12/2026** | **R$ 67.093/mês** |
| **ARR Projetado** | **R$ 805.116/ano** |
| **ROAS sobre MRR** | **4,72x** |

> [!IMPORTANT]
> Para cada R$ 1,00 investido em Google Ads, o SeuZélla gera R$ 4,72 em receita mensal recorrente.
> Os 169 clientes continuam pagando TODO mês, enquanto o investimento em Ads foi pontual.

---

## 2. Regras Absolutas de Marketing

> [!CAUTION]
> **PROIBIDO** o uso das seguintes palavras em qualquer material de marketing:
> - ~~IA~~ | ~~Bot~~ | ~~Inteligência Artificial~~
>
> **USAR SEMPRE:**
> - "Seu Zélla" | "Zelador Virtual" | "Recepcionista no WhatsApp 24h por dia" | "Atendimento para Pousadas"

---

## 3. Investimento Semanal Aprovado pelo Fundador

### 3.1. Orçamento por Semana (16 semanas)

| Mês | Semana | Investimento | Acumulado |
|-----|:------:|:-----------:|:---------:|
| **Setembro** | Sem 1 | R$ 500 | R$ 500 |
| | Sem 2 | R$ 500 | R$ 1.000 |
| | Sem 3 | R$ 600 | R$ 1.600 |
| | Sem 4 | R$ 600 | R$ 2.200 |
| **Subtotal Setembro** | | | **R$ 2.200** |
| **Outubro** | Sem 5 | R$ 600 | R$ 2.800 |
| | Sem 6 | R$ 600 | R$ 3.400 |
| | Sem 7 | R$ 1.000 | R$ 4.400 |
| | Sem 8 | R$ 1.000 | R$ 5.400 |
| **Subtotal Outubro** | | | **R$ 3.200** |
| **Novembro** (+R$200/sem) | Sem 9 | R$ 800 | R$ 6.200 |
| | Sem 10 | R$ 800 | R$ 7.000 |
| | Sem 11 | R$ 1.200 | R$ 8.200 |
| | Sem 12 | R$ 1.200 | R$ 9.400 |
| **Subtotal Novembro** | | | **R$ 4.000** |
| **Dezembro** (+R$200/sem) 🔥 | Sem 13 | R$ 1.000 | R$ 10.400 |
| | Sem 14 | R$ 1.000 | R$ 11.400 |
| | Sem 15 | R$ 1.400 | R$ 12.800 |
| | Sem 16 | R$ 1.400 | R$ 14.200 |
| **Subtotal Dezembro** | | | **R$ 4.800** |
| **TOTAL 16 SEMANAS** | | | **R$ 14.200** |

### 3.2. Lógica do +R$ 200/semana

O aumento progressivo segue o padrão de escada a partir de Outubro:

```
Outubro:   R$ 600  │ R$ 600  │ R$ 1.000  │ R$ 1.000
Novembro:  R$ 800  │ R$ 800  │ R$ 1.200  │ R$ 1.200   ← +R$200 em cada semana
Dezembro:  R$ 1.000│ R$ 1.000│ R$ 1.400  │ R$ 1.400   ← +R$200 em cada semana
```

---

## 4. Premissas de Performance por Mês

| Mês | CPC Médio | Conv. Landing | Conv. Vendas | Justificativa |
|-----|:---------:|:------------:|:------------:|---------------|
| **Setembro** | R$ 3,50 | 14% | 20% | Mês de entrada: construindo audiência, landing nova, sem remarketing. |
| **Outubro** | R$ 3,30 | 16% | 22% | Remarketing ativo (CPC R$1,50 puxa média pra baixo), leads mais aquecidos. |
| **Novembro** | R$ 3,10 | 18% | 25% | Pré-alta temporada (urgência do anfitrião), remarketing maduro, segmentação por dor qualifica mais. |
| **Dezembro** | R$ 3,40 | 20% | 28% | Alta temporada (CPC sobe por competição), mas urgência MÁXIMA antes do Réveillon dispara conversão. |

> [!NOTE]
> **Churn mensal aplicado: 5%** — A cada mês, 5% dos clientes existentes cancelam.
> Esse é o padrão conservador para SaaS B2B hoteleiro no Brasil.

---

## 5. Hotspots Permanentes (Ativos em TODOS os Meses)

As campanhas rodam em **paralelo** nos mesmos destinos todos os meses, maximizando o efeito "boca a boca" entre donos de pousada da mesma região.

| Cluster | Estado | Destinos | Perfil |
|---------|:------:|----------|:------:|
| 🌊 **Litoral Catarinense** | SC | Imbituba, Praia do Rosa, Garopaba, Guarda do Embaú, Florianópolis, Bombinhas, Balneário Camboriú | Híbrido |
| 🏝️ **Ilha do Mel** | PR | Ilha do Mel, Paranaguá | Pousadas |
| 🏖️ **Litoral SP** | SP | Ubatuba, São Sebastião (Maresias, Juquehy, Camburi), Ilhabela, Caraguatatuba, Bertioga, Praia Grande, Santos, Guarujá | Airbnb |
| 🌅 **Região dos Lagos & Costa Verde** | RJ | Saquarema, Arraial do Cabo, Búzios, Paraty, Angra dos Reis | Híbrido |
| 🌴 **Costa do Descobrimento** | BA | Porto Seguro, Trancoso, Arraial d'Ajuda, Itacaré, Morro de São Paulo, Costa do Sauípe | Pousadas |
| ☀️ **Rota das Emoções** | AL/PE/CE | Maragogi, Porto de Galinhas, Preá, Jericoacoara, Pipa | Híbrido |

---

## 6. Os 8 Grupos de Anúncios (Segmentação por Dor)

Cada grupo ataca **UMA dor específica** do anfitrião ou dono de pousada. Todos ativos em todos os hotspots, todos os meses.

| # | Grupo | Dor Atacada | Keyword | Tipo Match | CPC | Categoria |
|---|-------|-------------|---------|:----------:|:---:|:---------:|
| 1 | 🌙 **Madrugada** | Pousada perde reservas enquanto o dono dorme | `perder reservas madrugada pousada` | Phrase | R$ 2,40 | Problem Aware |
| 2 | 🏠 **Distância** | Airbnb gerido a distância sem controle | `gerenciar airbnb a distância whatsapp` | Phrase | R$ 3,60 | High Intention |
| 3 | ❌ **Overbooking** | Confirma quarto que já estava reservado | `evitar overbooking pousada` | Exact | R$ 4,20 | High Intention |
| 4 | 💰 **PIX Manual** | Demora pra copiar e colar a chave PIX | `enviar pix automatico hospede pousada` | Phrase | R$ 3,10 | High Intention |
| 5 | ⚡ **Concorrência** | Hóspede vai pra pousada que responde 1º | `responder hospede antes da concorrência` | Phrase | R$ 2,80 | Problem Aware |
| 6 | 🎉 **Feriado** | WhatsApp lotado em feriados prolongados | `atendimento pousada feriado prolongado` | Phrase | R$ 3,90 | High Intention |
| 7 | 🔐 **Fechadura** | Check-in sem recepção presencial | `check-in remoto pousada fechadura eletrônica` | Phrase | R$ 4,00 | High Intention |
| 8 | 🎯 **Remarketing** | Retargeting de quem visitou a landing | `remarketing_visitantes_landing_seuzella` | Broad | R$ 1,50 | Remarketing |

### 6.1. Extensões de Sitelink

Aparecem abaixo do anúncio principal no Google para aumentar a taxa de cliques:

| Sitelink | Descrição | URL |
|----------|-----------|-----|
| **Planos e Preços** | A partir de R$ 197/mês. Veja qual plano é ideal pro seu tamanho. | `/planos` |
| **Teste ao Vivo no WhatsApp** | Mande uma mensagem agora e veja o Seu Zélla responder em segundos. | `/demo-whatsapp` |
| **Depoimentos de Pousadas** | Veja o que dizem os donos de pousadas que já usam o Seu Zélla. | `/depoimentos` |
| **Como Funciona** | Em 3 minutos você entende tudo. Simples como mandar uma mensagem. | `/como-funciona` |

---

## 7. Projeção Detalhada — Semana a Semana

### 7.1. 🗓️ Setembro 2026 — Mês de Entrada (R$ 2.200)

| Semana | Investimento | Cliques | Leads | Vendas | MRR Gerado |
|:------:|:-----------:|:-------:|:-----:|:------:|:----------:|
| Sem 1 | R$ 500 | 142 | 19 | 3 | R$ 1.191/mês |
| Sem 2 | R$ 500 | 142 | 19 | 3 | R$ 1.191/mês |
| Sem 3 | R$ 600 | 171 | 23 | 4 | R$ 1.588/mês |
| Sem 4 | R$ 600 | 171 | 23 | 4 | R$ 1.588/mês |
| **TOTAL** | **R$ 2.200** | **626** | **84** | **14** | **R$ 5.558/mês** |

| Indicador | Valor |
|-----------|:-----:|
| Vendas Novas | 14 |
| Retidos do mês anterior | 0 |
| Churned (cancelaram) | 0 |
| **Clientes Pagantes Ativos** | **14** |
| **MRR** | **R$ 5.558** |

---

### 7.2. 🗓️ Outubro 2026 — Remarketing Ativo (R$ 3.200)

| Semana | Investimento | Cliques | Leads | Vendas | MRR Gerado |
|:------:|:-----------:|:-------:|:-----:|:------:|:----------:|
| Sem 5 | R$ 600 | 181 | 28 | 6 | R$ 2.382/mês |
| Sem 6 | R$ 600 | 181 | 28 | 6 | R$ 2.382/mês |
| Sem 7 | R$ 1.000 | 303 | 48 | 10 | R$ 3.970/mês |
| Sem 8 | R$ 1.000 | 303 | 48 | 10 | R$ 3.970/mês |
| **TOTAL** | **R$ 3.200** | **968** | **152** | **32** | **R$ 12.704/mês** |

| Indicador | Valor |
|-----------|:-----:|
| Vendas Novas | 32 |
| Retidos do mês anterior | 13 |
| Churned (cancelaram) | 1 |
| **Clientes Pagantes Ativos** | **45** |
| **MRR** | **R$ 17.865** |

---

### 7.3. 🗓️ Novembro 2026 — Pré-Alta Temporada (R$ 4.000) [+R$200/sem]

| Semana | Investimento | Cliques | Leads | Vendas | MRR Gerado |
|:------:|:-----------:|:-------:|:-----:|:------:|:----------:|
| Sem 9 | R$ 800 | 258 | 46 | 11 | R$ 4.367/mês |
| Sem 10 | R$ 800 | 258 | 46 | 11 | R$ 4.367/mês |
| Sem 11 | R$ 1.200 | 387 | 69 | 17 | R$ 6.749/mês |
| Sem 12 | R$ 1.200 | 387 | 69 | 17 | R$ 6.749/mês |
| **TOTAL** | **R$ 4.000** | **1.290** | **230** | **56** | **R$ 22.232/mês** |

| Indicador | Valor |
|-----------|:-----:|
| Vendas Novas | 56 |
| Retidos do mês anterior | 42 |
| Churned (cancelaram) | 3 |
| **Clientes Pagantes Ativos** | **98** |
| **MRR** | **R$ 38.906** |

---

### 7.4. 🗓️ Dezembro 2026 — 🔥 Alta Temporada (R$ 4.800) [+R$200/sem]

| Semana | Investimento | Cliques | Leads | Vendas | MRR Gerado |
|:------:|:-----------:|:-------:|:-----:|:------:|:----------:|
| Sem 13 | R$ 1.000 | 294 | 58 | 16 | R$ 6.352/mês |
| Sem 14 | R$ 1.000 | 294 | 58 | 16 | R$ 6.352/mês |
| Sem 15 | R$ 1.400 | 411 | 82 | 22 | R$ 8.734/mês |
| Sem 16 | R$ 1.400 | 411 | 82 | 22 | R$ 8.734/mês |
| **TOTAL** | **R$ 4.800** | **1.410** | **280** | **76** | **R$ 30.172/mês** |

| Indicador | Valor |
|-----------|:-----:|
| Vendas Novas | 76 |
| Retidos do mês anterior | 93 |
| Churned (cancelaram) | 5 |
| **Clientes Pagantes Ativos** | **169** |
| **MRR** | **R$ 67.093** |

---

## 8. Quadro Consolidado — Evolução Mês a Mês

| Métrica | Setembro | Outubro | Novembro | Dezembro | **TOTAL** |
|---------|:--------:|:-------:|:--------:|:--------:|:---------:|
| **Investimento** | R$ 2.200 | R$ 3.200 | R$ 4.000 | R$ 4.800 | **R$ 14.200** |
| **Cliques** | 626 | 968 | 1.290 | 1.410 | **4.294** |
| **Leads** | 84 | 152 | 230 | 280 | **746** |
| **Vendas Novas** | 14 | 32 | 56 | 76 | **178** |
| **Churned** | 0 | 1 | 3 | 5 | **9** |
| **Clientes Ativos** | 14 | 45 | 98 | **169** | — |
| **MRR** | R$ 5.558 | R$ 17.865 | R$ 38.906 | **R$ 67.093** | — |

---

## 9. Curva de Crescimento

```
Clientes Pagantes Ativos ao Final de Cada Mês:

Set:  ██████████████ 14
Out:  █████████████████████████████████████████████ 45
Nov:  ██████████████████████████████████████████████████████████████████████████████████████████████████ 98
Dez:  ████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████ 169

MRR (Receita Mensal Recorrente):

Set:  ████████ R$ 5.558
Out:  ██████████████████████████ R$ 17.865
Nov:  █████████████████████████████████████████████████████████ R$ 38.906
Dez:  ████████████████████████████████████████████████████████████████████████████████████████████████████ R$ 67.093
```

---

## 10. Fechamento Oficial — 31 de Dezembro de 2026

| Métrica | Valor |
|---------|:-----:|
| **Clientes Pagantes Ativos** | **169** |
| **MRR (Receita Mensal Recorrente)** | **R$ 67.093/mês** |
| **ARR (Receita Anual Recorrente)** | **R$ 805.116/ano** |
| **Total Investido em Ads** | **R$ 14.200** |
| **ROAS sobre MRR** | **4,72x** |

---

## 11. Por que Dezembro Explode?

1. **Urgência MÁXIMA** — Réveillon em 3 semanas. O dono de pousada que não automatizou o atendimento VAI perder reservas de Ano Novo. Ele não pode esperar mais.

2. **CPC sobe (R$ 3,40)** — A competição por anúncios aumenta no fim do ano, mas a **conversão de vendas dispara para 28%** porque o lead está desesperado por uma solução antes do pico.

3. **Base retida forte** — 93 clientes conquistados em Set/Out/Nov continuam pagando (churn de apenas 5 por mês = 5%). Isso é receita RECORRENTE que não precisa de novo investimento.

4. **76 vendas novas** — O maior volume de aquisição de todo o ano, potencializado pela pré-alta temporada e pelo remarketing maduro (12 semanas de dados acumulados).

5. **Efeito boca a boca** — Nos Hotspots Permanentes, os donos de pousada se conhecem. Um usando o Seu Zélla vira vitrine para os vizinhos. Esse efeito NÃO está contabilizado nos números acima (é upside puro).

---

## 12. Planos Oficiais do SeuZélla

| Plano | Preço | Público |
|-------|:-----:|---------|
| **LITE** | R$ 197/mês | 1 a 4 quartos / imóveis |
| **PRO** (Carro Chefe) | R$ 397/mês | 6 a 12 quartos |
| **MAX** | R$ 797/mês | 13 a 20 quartos / múltiplos imóveis |
| **Zélla Parceiro PRO** | R$ 247/mês (24 meses) | 100 primeiras pousadas / anfitriões |

> [!NOTE]
> Toda a projeção deste documento usa o **Plano PRO (R$ 397/mês)** como ticket médio.
> Na prática, vendas de Plano MAX (R$ 797/mês) e a oferta Parceiro PRO (R$ 247/mês) criam um mix que pode variar o MRR real.

---

## 13. Referências Técnicas

| Arquivo | Descrição |
|---------|-----------|
| [zella-ads-simulator.ts](file:///Users/marciocau/SeuZella_project/src/lib/marketing/zella-ads-simulator.ts) | Simulador completo com orçamento semanal, 8 grupos de anúncios, projeção 90 dias e fechamento 2026 |
| [marketing-google-ads-simulation.test.ts](file:///Users/marciocau/SeuZella_project/tests/marketing-google-ads-simulation.test.ts) | 25 testes automatizados cobrindo hotspots, palavras proibidas, orçamento e projeções |
| [zella-sales-brain.ts](file:///Users/marciocau/SeuZella_project/src/lib/cerebro/zella-sales-brain.ts) | Cérebro de vendas treinado com diferenciação Pousada vs Airbnb |
| [Playbook-Interno-de-Estruturacao-Comercial.md](file:///Users/marciocau/SeuZella_project/docs/Playbook-Interno-de-Estruturacao-Comercial.md) | Playbook comercial de 59 páginas convertido em Markdown |

---

> **Documento gerado pelo Cérebro Zélla — Módulo de Inteligência de Marketing**
> Commit: `d924bf0` | Branch: `main` | Repositório: `MarcioCau14/SmartHotel_Zehla`
