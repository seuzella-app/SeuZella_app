# ZéLLM LEARNING CONTRACT (Fase 15/16/17)

Onda: `feat/meta-zella-foundation`
Módulo: `src/lib/meta/meta-learning.ts`

## Definição

ZéLLM é a **camada cognitiva aprendida** do Cérebro Zélla — **NÃO é um novo
modelo autônomo**. O Cérebro produz artefatos de aprendizado; ZéLLM organiza
esses artefatos pelo RESULTADO real das conversas.

## Artefatos produzidos pelo Cérebro (Fase 15)

1. KnowledgeEntry
2. Verified Pattern
3. Anti-Pattern
4. Persona signal (`WhatsappPersonaLearner`)
5. Intent/outcome
6. Tool outcome
7. Conversation outcome
8. Prompt optimization
9. GraphRAG knowledge
10. CompiledPrompt

## CONTRATO DE APRENDIZAGEM (obrigatório)

```
capture → sanitize → validate → score → promote
```

**NUNCA** treinar com mensagem bruta automaticamente. **Somente padrões
comprovados podem ser promovidos.**

| Etapa | Implementação | Regra |
|---|---|---|
| capture | `recordConversationOutcome()` | evidência de resultado real (reserva, handover, falha) |
| sanitize | `sanitizePatternCandidate()` | PII/credenciais (senha, cartão, CPF) → candidato rejeitado |
| validate | `validatePatternCandidate()` | anti-pattern/handover/falha → NUNCA elegível |
| score | em `promoteVerifiedPattern()` | score = f(ocorrências × resultado); mínimo 0.8 |
| promote | `promoteVerifiedPattern()` | grava `KnowledgeEntry(category='verified_pattern')` |

## Aprendizado por resultado (Fase 16)

**Padrão promovível:**
```
PERGUNTA → RESPOSTA → COTAÇÃO → RESERVA → SUCESSO
```
Cada cadeia bem-sucedida AUMENTA a evidência do padrão.

**Padrão NUNCA promovível:**
```
PERGUNTA → RESPOSTA → HUMANO CORRIGE → FAILURE → ANTI-PATTERN
```
Anti-pattern é registrado apenas como evidência negativa
(`recordAntiPattern`) — nunca vira resposta sugerida.

## Dados Meta no contexto (Fase 17)

`channel`, `source`, `campaign`, `entryPoint`, `intent`, `messageType`,
`metaCategory`, `conversationWindow`, `leadStatus`, `reservationStatus`,
`reservationValue`, `humanHandover`, `outcome`.

Objetivo: aprender **"qual resposta converte melhor"**, não somente
"qual resposta parece boa".

## Feature flag

`META_LEARNING_ENABLED=true` (default). Desligar = sem registros de outcome;
nenhum fluxo de conversa é afetado.

## Testes

`tests/meta/meta-foundation-certification.test.ts` — anti-pattern nunca
promovido; pipeline capture→sanitize→validate→score→promote presente;
sanitização de PII antes de promover.
