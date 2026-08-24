# ALEXA SECURITY GATE SPEC — Onda 0

## Objetivo

Transformar a camada de segurança Alexa existente em uma fronteira obrigatória do endpoint `/api/alexa/smart-home`.

## Pipeline obrigatório

1. Ler bearer token / endpoint token.
2. Verificar JWT e extrair `tenantId`, `userId`, `jti`, `iat`, `scope`.
3. Validar payload: `sub`, `tenantId`, `scope=smart_home:locks`, `jti`, `iat` dentro da janela.
4. Aplicar rate limit distribuído por tenant.
5. Consultar replay store por `jti`.
6. Rejeitar JTI repetido.
7. Encaminhar somente diretivas autorizadas ao handler.
8. Executar mutation/consulta escopada ao tenant.
9. Marcar JTI como utilizado após processamento bem-sucedido.
10. Emitir telemetria sem armazenar token bruto.

## Estado atual confirmado

`src/lib/locks/alexa-security.ts` já possui rate limit, replay cache, `validateAlexaJwtPayload` e `markJtiUsed`. O endpoint atual verifica o JWT, mas não chama esse gate completo.

## Critérios de aceite

- JWT sem JTI: 401/403.
- JWT expirado: 401/403.
- JWT futuro além da tolerância: 401/403.
- scope incorreto: 403.
- tenant ausente: 403.
- mesmo JTI duas vezes: segunda tentativa rejeitada.
- >60 requisições/min/tenant: bloqueio.
- diretiva válida de tenant A nunca opera lock de tenant B.
- em produção, o estado de replay/rate limit deve ser distribuído via Redis antes do gate M5.
