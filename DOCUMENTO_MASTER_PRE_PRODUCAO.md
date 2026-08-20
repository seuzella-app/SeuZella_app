Agente sua função aqui é a execução de tudo que temos aqui abaixo. Crie toda a organização para executar tudo EXATAMENTE TUDO que trago aqui abaixo.

Eu fiz uma segunda passada sobre os pontos críticos e encontrei problemas adicionais importantes. Entre eles: o CI atualmente permite que ESLint, build e `npm audit` terminem com erro sem derrubar o pipeline; o CI usa Node 20 enquanto o Docker usa Node 24; existe uma rota de webhook Asaas que pode aceitar requisição sem segredo configurado; existe um `db` que pode retornar um **No-op Proxy** em vez de falhar; e ainda existem caminhos MOCK/BYPASS que precisam ser absolutamente impossibilitados em produção.

Abaixo está o documento que eu recomendo **copiar integralmente para o Google Antigravity**. Ele não manda a IDE simplesmente "corrigir bugs"; ele instrui a IDE a **auditar novamente o código inteiro, implementar as correções, validar cada alteração e não destruir a arquitetura MOCK atual**.

---

# **DOCUMENTO MASTER — PRÉ-PRODUÇÃO SEU ZÉLLA / SMARTHOTEL**

## **ESPECIFICAÇÃO DE EXECUÇÃO PARA GOOGLE ANTIGRAVITY**

**Repositório alvo:** `MarcioCau14/SmartHotel_Zehla`  
**0\. REGRA ABSOLUTA**

Você está operando sobre um projeto que **AINDA ESTÁ EM MODO MOCK**.  
Isso significa:  
**NÃO fazer agora:**

* substituir todos os MOCKs por integrações reais;  
* exigir credenciais reais de Meta;  
* exigir credenciais reais de WhatsApp;  
* exigir credenciais reais de Asaas;  
* exigir credenciais reais de Mercado Pago;  
* exigir credenciais reais de Stripe;  
* exigir credenciais reais de Google;  
* exigir credenciais reais de provedores LLM;  
* exigir Redis real para desenvolvimento;  
* exigir serviços externos que ainda não foram contratados;  
* apagar adapters MOCK;  
* apagar dados demo necessários para desenvolvimento;  
* reescrever o projeto inteiro.

### **FAZER agora:**

Corrigir a arquitetura para que:

MOCK  
  ↓  
interface/contract  
  ↓  
factory/provider  
  ↓  
REAL PROVIDER futuramente

seja uma troca segura e controlada.

O sistema deve permanecer executável em modo MOCK após as correções.

Porém:

MOCK / DEMO / BYPASS / TEST

deve ser **impossível de utilizar inadvertidamente em produção**.

---

# **1\. OBJETIVO FINAL**

Ao terminar esta tarefa, o projeto deverá satisfazer:

npm install  
npm run lint  
npm run typecheck  
npm run test  
npm run build

sem erros.

Além disso:

Prisma validate  
Security tests  
SAST  
Dependency audit  
Mock isolation tests  
Multi-tenant isolation tests  
Authentication tests  
Webhook security tests  
Payment idempotency tests  
Production configuration validation  
Docker build  
Docker runtime  
Healthcheck

também deverão estar funcionando.

O projeto **não será considerado pronto** simplesmente porque `next build` funciona.

---

# **2\. PRINCÍPIO DE SEGURANÇA**

Aplicar em toda a aplicação:

DENY BY DEFAULT  
FAIL CLOSED  
EXPLICIT AUTHORIZATION  
EXPLICIT TENANT CONTEXT  
EXPLICIT ENVIRONMENT  
EXPLICIT PROVIDER  
EXPLICIT ERROR HANDLING

Nunca utilizar:

"se não encontrar, usa demo"  
"se banco falhar, continua"  
"se segredo não existir, aceita"  
"se usuário não estiver autenticado, usa tenant padrão"  
"se API real não funcionar, envia MOCK"

em produção.

---

# **3\. AUDITORIA COMPLETA OBRIGATÓRIA ANTES DAS ALTERAÇÕES**

Antes de editar qualquer arquivo:

1. analisar a árvore inteira do projeto;  
2. identificar todos os `route.ts`;  
3. identificar todos os Server Actions;  
4. identificar todos os Server Components;  
5. identificar todos os Client Components;  
6. identificar todos os módulos de banco;  
7. identificar todos os adapters;  
8. identificar todas as factories;  
9. identificar todos os providers;  
10. identificar todas as integrações externas;  
11. identificar todas as variáveis de ambiente;  
12. identificar todos os mecanismos de autenticação;  
13. identificar todos os mecanismos de autorização;  
14. identificar todos os pontos de resolução de `tenantId`;  
15. identificar todos os webhooks;  
16. identificar todos os cron jobs;  
17. identificar todas as filas;  
18. identificar todos os sockets;  
19. identificar todos os mecanismos de cache;  
20. identificar todos os uploads;  
21. identificar todas as exportações de dados;  
22. identificar todos os pontos de logging;  
23. identificar todos os secrets;  
24. identificar todos os fallbacks;  
25. identificar todos os MOCKs;  
26. identificar todos os DEMO accounts;  
27. identificar todos os `BYPASS`;  
28. identificar todos os `localhost`;  
29. identificar todos os IPs hardcoded;  
30. identificar todas as URLs hardcoded;  
31. identificar `any`;  
32. identificar `@ts-ignore`;  
33. identificar `eslint-disable`;  
34. identificar `catch` vazios;  
35. identificar promises não aguardadas;  
36. identificar queries Prisma sem tenant;  
37. identificar endpoints sem autenticação;  
38. identificar endpoints públicos intencionalmente;  
39. identificar endpoints que deveriam ser privados;  
40. identificar operações financeiras sem idempotência;  
41. identificar operações destrutivas sem autorização;  
42. identificar acesso a arquivos;  
43. identificar possíveis SSRF;  
44. identificar possíveis XSS;  
45. identificar possíveis CSRF;  
46. identificar possíveis injection;  
47. identificar exposição de PII;  
48. identificar exposição de secrets;  
49. identificar logs contendo dados sensíveis.

Não assumir que um arquivo de segurança existente significa que a proteção está correta.

---

# **4\. P0 — AUTENTICAÇÃO**

## **4.1 Remover completamente de produção o login:**

123 / 123

O código atual contém esse caminho de acesso administrativo rápido. Isso é bloqueador de produção.

### **Regra:**

Esse mecanismo pode continuar existindo somente em ambiente explicitamente:

NODE\_ENV=development

ou:

ZELLA\_DEMO\_MODE=true

mas somente se:

NODE\_ENV \!== production

e o sistema deve recusar qualquer tentativa em produção.

---

# **5\. P0 — BYPASS\_MIDDLEWARE\_AUTH**

Localizar todas as ocorrências:

BYPASS\_MIDDLEWARE\_AUTH

O código atualmente possui diversos caminhos dependentes dessa variável.

Implementar:

if NODE\_ENV \=== production:  
    BYPASS\_MIDDLEWARE\_AUTH must be false/undefined

Se estiver configurado como `true` em produção:

FAIL FAST

O servidor deve impedir o startup.

Não apenas ignorar.

---

# **6\. P0 — DEMO ACCOUNTS**

Localizar todas as contas:

demo@  
123  
Demo@123  
zella@zella.com.br  
pousada@zehla.com.br  
airbnb@zehla.com.br

Determinar exatamente onde são utilizadas.

Criar mecanismo central:

isDemoMode()

com regra:

NODE\_ENV \!== production

Nenhum demo login pode funcionar em produção.

Nenhuma sessão MOCK pode ser criada em produção.

---

# **7\. P0 — REQUIRE TENANT**

Auditar:

requireTenant()  
getTenantId()  
requireTenantId()  
auth-utils  
tenant-context  
middleware  
API guards  
server actions

O código já possui `tenant-context` com comportamento correto de não usar tenant hardcoded em produção, mas existem outros caminhos no `auth.ts` que ainda possuem fallback demo.

Unificar.

Regra final:

authenticated session  
        ↓  
validated tenantId  
        ↓  
authorization  
        ↓  
database query

Se qualquer etapa falhar:

401 ou 403

Nunca:

demo tenant  
first tenant  
default tenant

em produção.

---

# **8\. P0 — MULTI-TENANCY / ISOLAMENTO**

Auditar **cada query Prisma**.

Procurar:

findUnique  
findFirst  
findMany  
update  
updateMany  
delete  
deleteMany  
upsert  
create  
createMany  
aggregate  
groupBy  
count

e verificar se a operação respeita o tenant.

Exemplo perigoso:

db.lead.findUnique({  
  where: { id }  
})

quando o objeto é tenant-owned.

Preferir:

db.lead.findFirst({  
  where: {  
    id,  
    tenantId  
  }  
})

ou equivalente seguro.

---

# **9\. P0 — CROSS-TENANT ATTACK TEST**

Criar testes que façam:

Tenant A  
  ↓  
tenta acessar recurso de Tenant B

Para:

* leads;  
* properties;  
* rooms;  
* reservations;  
* guests;  
* campaigns;  
* targets;  
* agent configs;  
* audit logs;  
* transactions;  
* subscriptions;  
* WhatsApp;  
* Airbnb;  
* Booking;  
* dynamic pricing;  
* lock devices;  
* lock codes;  
* upsells;  
* reports;  
* notifications;  
* AI memories;  
* knowledge;  
* vector data.

Resultado obrigatório:

403 ou 404

Nunca retornar dados de B.

---

# **10\. P0 — ROLE / RBAC**

Mapear:

owner  
admin  
staff  
ZCC admin  
system  
agent  
robot  
webhook  
cron

Criar autorização centralizada.

Não confiar em:

role enviado pelo frontend  
tenantId enviado pelo frontend  
plan enviado pelo frontend  
isAdmin enviado pelo frontend

Tudo deve vir de contexto autenticado/confiável.

---

# **11\. P0 — GOOGLE OAUTH**

O código possui:

allowDangerousEmailAccountLinking: true

Auditar profundamente.

Determinar se é realmente necessário.

Se não for indispensável:

remover

Se for indispensável:

* validar ownership;  
* impedir account takeover;  
* garantir tenant correto;  
* testar e-mail já existente;  
* testar conta OAuth conflitante;  
* testar tenant existente;  
* testar usuário sem tenant;  
* testar usuário suspenso.

---

# **12\. P0 — SESSION / JWT**

Auditar:

session strategy  
JWT  
maxAge  
secret  
cookie  
secure  
sameSite  
httpOnly  
domain  
path

Garantir produção:

Secure  
HttpOnly  
SameSite apropriado

Validar expiração.

Validar logout.

Validar invalidação de sessão.

Validar mudança de senha.

Validar suspensão do tenant.

Validar alteração de role.

---

# **13\. P0 — ROBOT TOKENS**

Auditar:

verifyRobotToken()  
ZEHLA\_LOOP\_API\_KEY  
ZAI\_API\_KEY

O sistema não deve considerar apenas:

token válido

como autorização suficiente.

Adicionar:

authentication  
\+  
scope  
\+  
permission  
\+  
tenant context  
\+  
rate limit

Se o token for comprometido, limitar impacto.

---

# **14\. P0 — ENCRYPTION**

O sistema possui AES-256-GCM. Isso é uma boa base.

Mas corrigir o comportamento:

decryptText()

atualmente retorna:

''

em caso de falha de descriptografia.

Isso pode esconder corrupção de dados ou chave incorreta.

Preferir erro explícito e classificável:

ENCRYPTION\_ERROR

sem revelar detalhes ao usuário.

---

# **15\. P0 — ENCRYPTION SECRET**

Em produção:

ENCRYPTION\_SECRET

é obrigatório.

Validar:

* comprimento mínimo;  
* entropia;  
* formato;  
* existência;  
* consistência entre deploys.

Nunca gerar segredo efêmero em produção.

Nunca substituir segredo de produção automaticamente.

Nunca perder capacidade de descriptografar dados após restart.

---

# **16\. P0 — API KEYS**

Auditar `ApiConfig`.

O schema contém:

apiKey  
apiSecret

e o comentário indica armazenamento criptografado. Isso precisa ser garantido pelo código real, não pelo comentário.

Obrigatório:

encrypt before persistence  
decrypt only server-side  
never send plaintext to browser  
never log plaintext  
never include in error  
never include in serialized object  
---

# **17\. P0 — DATABASE FALLBACK**

O `src/lib/db.ts` possui um No-op Proxy que pode retornar `null` para chamadas de banco quando o Prisma não está disponível.

Isso é perigoso.

Em produção:

database unavailable  
        ↓  
FAIL CLOSED

Não:

database unavailable  
        ↓  
return null  
        ↓  
continue

Criar comportamento explícito:

DATABASE\_UNAVAILABLE  
503

para operações que dependem do banco.

---

# **18\. P0 — POSTGRESQL**

O Prisma declara PostgreSQL como datasource.

Eliminar inconsistências SQLite do caminho de produção.

O projeto não deve possuir:

SQLite fallback

em produção.

Se SQLite continuar para testes locais:

explicit test-only

e nunca runtime production.

---

# **19\. P0 — DOCKER**

O Dockerfile atualmente ainda possui conceitos de SQLite:

/app/db  
VOLUME /app/db

apesar do Prisma estar configurado para PostgreSQL.

Remover ou isolar isso.

O container de produção deve ser coerente com:

Next.js  
Prisma  
PostgreSQL externo  
Redis externo  
providers externos  
---

# **20\. P0 — NODE VERSION**

Hoje há divergência:

CI \= Node 20  
Docker \= Node 24

O projeto deve adotar uma única versão suportada e testada.

Definir uma fonte única:

engines  
.nvmrc  
Dockerfile  
GitHub Actions  
local documentation

Tudo igual.

---

# **21\. P0 — TYPESCRIPT**

O `next.config.ts` contém:

ignoreBuildErrors: true

Isso deve ser removido.

Regra:

type error \= build failure  
---

# **22\. P0 — CI/CD**

O pipeline atual possui:

ESLint continue-on-error: true  
Build continue-on-error: true  
npm audit continue-on-error: true

Isso precisa ser corrigido.

Produção:

lint failure → fail  
typecheck failure → fail  
test failure → fail  
build failure → fail  
security failure → fail  
prisma validation failure → fail  
---

# **23\. P0 — NPM AUDIT**

Não aceitar automaticamente:

npm audit

com vulnerabilidades:

high  
critical

sem análise.

Para cada vulnerabilidade:

fix  
upgrade  
replace dependency  
document justified exception

Nenhuma vulnerabilidade crítica conhecida pode ser ignorada sem justificativa explícita.

---

# **24\. P0 — DEPENDENCY AUDIT**

Executar:

npm audit  
npm outdated

Verificar:

* dependências abandonadas;  
* dependências duplicadas;  
* dependências desnecessárias;  
* pacotes com vulnerabilidades;  
* pacotes que executam scripts;  
* supply-chain risk.

Não atualizar tudo indiscriminadamente.

Atualizar de forma compatível.

---

# **25\. P0 — WEBHOOK ASAAS**

O webhook atual verifica:

ASAAS\_WEBHOOK\_SECRET || ASAAS\_ACCESS\_TOKEN

mas a condição de rejeição depende da existência do segredo e do token recebido.

Isso deve ser corrigido.

Produção:

secret ausente → startup/configuration error  
secret ausente → webhook unavailable  
token ausente → 401  
token inválido → 401

Nunca aceitar webhook simplesmente porque o secret não foi configurado.

---

# **26\. P0 — WEBHOOK IDEMPOTENCY**

Todos os webhooks:

* Asaas;  
* Mercado Pago;  
* Stripe;  
* WhatsApp;  
* Booking;  
* GitHub;  
* outros;

devem possuir:

signature validation  
\+  
event ID  
\+  
idempotency key  
\+  
atomic persistence  
\+  
replay protection

Nunca confiar em:

findFirst

sozinho para idempotência.

Criar constraint única no banco quando aplicável.

---

# **27\. P0 — WEBHOOK TRANSACTIONALITY**

Fluxo:

receive event  
↓  
validate signature  
↓  
validate schema  
↓  
check idempotency  
↓  
BEGIN TRANSACTION  
↓  
update business state  
↓  
record event  
↓  
COMMIT

Se falhar:

rollback

Não deixar:

subscription updated  
transaction missing

ou:

transaction created  
subscription not updated

sem mecanismo de recuperação.

---

# **28\. P0 — WEBHOOK PAYLOAD VALIDATION**

Nunca usar:

const payload: any

para dados externos críticos.

Criar schemas Zod.

Validar:

event  
payment  
customer  
amount  
externalReference  
invoice  
timestamps  
IDs

Rejeitar payload inválido.

---

# **29\. P0 — SSRF**

Auditar todos os campos:

url  
baseUrl  
callbackUrl  
webhookUrl  
imageUrl  
website  
redirectUrl  
apiUrl

Criar proteção contra:

localhost  
127.0.0.1  
0.0.0.0  
::1  
169.254.169.254  
private IP ranges  
internal DNS  
file://  
ftp://  
gopher://

quando a aplicação fizer requests server-side.

---

# **30\. P0 — OPEN REDIRECT**

Auditar:

callbackUrl  
redirect  
returnUrl  
next  
continue  
url

Permitir somente:

same-origin  
allowlisted external domains

Nunca confiar diretamente no parâmetro.

---

# **31\. P0 — XSS**

Auditar:

dangerouslySetInnerHTML  
ReactMarkdown  
HTML rendering  
user-generated content  
AI-generated content  
guest messages  
lead data  
campaign text

Nenhum conteúdo de usuário deve ser renderizado como HTML arbitrário.

Se Markdown for necessário:

sanitize  
allowed elements  
allowed attributes  
---

# **32\. P0 — PROMPT INJECTION**

Como o projeto possui múltiplos agentes/LLMs, tratar conteúdo externo como não confiável.

Fontes:

WhatsApp  
e-mail  
website  
reviews  
Booking  
Airbnb  
lead data  
guest messages  
uploaded documents  
web pages  
AI outputs

Nunca permitir que conteúdo externo altere:

system instructions  
tool permissions  
tenant context  
authorization  
billing  
payment  
database access

Criar testes de:

prompt injection  
indirect prompt injection  
tool injection  
cross-tenant prompt injection  
instruction hierarchy attack  
---

# **33\. P0 — AI TOOL PERMISSIONS**

Cada agente deve possuir:

allowed tools  
denied tools  
scope  
tenant  
role  
maximum cost  
maximum execution time  
maximum calls

Um LLM nunca pode decidir sozinho:

"eu posso chamar esta ferramenta"

A aplicação deve decidir.

---

# **34\. P0 — AI COST GUARD**

O sistema possui Meta Cost Guard e diversos providers.

Garantir limites para:

* tokens;  
* requests;  
* mensagens;  
* chamadas externas;  
* retries;  
* loops de agentes;  
* tool calls.

Evitar:

agent loop infinito  
retry storm  
recursive agent call  
---

# **35\. P0 — LLM ROUTER**

Auditar:

llm-router  
cognitive-router  
ZAOS router  
neuro router  
TF client

Garantir:

provider unavailable  
→ controlled fallback

Mas:

real provider unavailable  
→ MOCK

só pode ocorrer se:

development/demo/test

explicitamente.

Nunca silenciosamente em produção.

---

# **36\. P0 — REDIS**

O projeto possui Upstash/Redis.

Produção deve diferenciar:

Redis required  
Redis optional  
Redis unavailable

Para:

* rate limit;  
* queue;  
* locks;  
* cache;  
* idempotency;  
* sessions, se aplicável.

Não deixar cada módulo implementar fallback próprio.

Criar uma política central.

---

# **37\. P0 — RATE LIMIT**

O `rate-limit.ts` já implementa comportamento fail-closed em produção quando Upstash não existe. Isso é bom e deve ser preservado.

Porém, auditar todos os endpoints para confirmar que o rate limiter **é realmente utilizado**.

Não basta existir.

Aplicar a:

login  
signup  
password reset  
OAuth  
webhooks  
public APIs  
AI APIs  
message sending  
bulk operations  
exports  
search  
lead enrichment  
campaigns  
admin  
ZCC  
---

# **38\. P0 — ZCC RATE LIMIT**

O middleware possui outro rate limiter baseado em memória.

Ele não deve ser tratado como proteção distribuída.

Migrar para mecanismo compartilhado ou garantir que ele seja apenas camada adicional.

Não deixar:

memory rate limit

como única defesa de produção.

---

# **39\. P1 — CSP**

Existem políticas CSP em:

next.config.ts  
middleware.ts

Isso cria múltiplas fontes de verdade.

Consolidar.

Validar:

script-src  
style-src  
img-src  
font-src  
connect-src  
frame-src  
form-action  
object-src  
base-uri  
frame-ancestors

Adicionar quando apropriado:

object-src 'none'

e:

upgrade-insecure-requests

somente se compatível.

Não quebrar Stripe/MP/Asaas/Maps.

---

# **40\. P1 — SECURITY HEADERS**

Validar:

HSTS  
X-Content-Type-Options  
X-Frame-Options  
Referrer-Policy  
Permissions-Policy  
CSP

Verificar duplicidade middleware/Next config.

Criar teste automatizado.

---

# **41\. P1 — CORS**

Localizar todos os:

Access-Control-Allow-Origin  
Access-Control-Allow-Credentials

Nunca:

\*

com credenciais.

Criar allowlist.

---

# **42\. P1 — CSRF**

Auditar todas as mutações:

POST  
PUT  
PATCH  
DELETE

especialmente:

* auth;  
* account;  
* billing;  
* payment;  
* admin;  
* settings;  
* WhatsApp;  
* ZCC.

Determinar proteção apropriada para cookies/session.

---

# **43\. P1 — REQUEST BODY LIMITS**

Adicionar limites para:

JSON  
multipart  
file upload  
CSV  
XLSX  
audio  
image  
documents  
webhooks

Impedir payload gigante.

---

# **44\. P1 — FILE UPLOAD SECURITY**

Auditar uploads.

Validar:

MIME  
magic bytes  
extension  
size  
filename  
path traversal  
malware strategy  
storage  
public/private access

Nunca confiar apenas na extensão.

Nunca permitir:

../../

ou path controlado pelo usuário.

---

# **45\. P1 — EXPORTS**

Auditar:

/api/export  
CSV  
XLSX  
PDF  
reports  
lead export  
guest export

Garantir:

authentication  
authorization  
tenant isolation  
rate limit  
pagination  
size limit  
audit  
---

# **46\. P1 — CSV INJECTION**

Como o projeto exporta leads e outros dados:

proteger contra:

\=  
\+  
\-  
@

no início de células exportadas quando o destino puder ser Excel/LibreOffice.

---

# **47\. P1 — LOGGING**

O projeto possui logger e instrumentation.

Centralizar logs.

Nunca registrar:

password  
apiKey  
secret  
token  
authorization header  
cookie  
session token  
CPF completo  
dados bancários  
payload integral de hóspede  
mensagem privada integral

Criar redactor central.

---

# **48\. P1 — ERROR RESPONSES**

Nunca devolver:

error.message  
stack  
SQL error  
provider response  
secret  
internal path

ao cliente.

Criar:

public error  
internal error  
requestId

Exemplo:

{  
  "error": "INTERNAL\_ERROR",  
  "requestId": "..."  
}  
---

# **49\. P1 — REQUEST ID**

O middleware já possui request ID.

Garantir propagação:

request  
→ log  
→ service  
→ external provider  
→ error

sem permitir que usuário injete valores perigosos.

---

# **50\. P1 — AUDIT LOG**

O ZCC possui audit log em memória.

Isso não é suficiente para auditoria de produção.

Persistir eventos críticos:

login  
logout  
failed login  
password change  
role change  
tenant change  
API key change  
payment  
subscription  
webhook  
export  
delete  
admin action  
ZCC access  
security event  
agent tool action  
---

# **51\. P1 — DATABASE INDEXES**

Revisar todos os índices.

Especialmente:

tenantId  
tenantId \+ createdAt  
tenantId \+ status  
tenantId \+ email  
tenantId \+ phone  
externalId  
webhook event ID  
idempotency key  
subscription  
reservation date

Evitar full table scan em operações frequentes.

---

# **52\. P1 — DATABASE CONSTRAINTS**

Não depender somente do código.

Adicionar constraints quando possível:

unique  
foreign key  
check  
not null

especialmente:

external event ID  
payment ID  
tenant scoped identifiers  
---

# **53\. P1 — TRANSACTIONS**

Localizar operações de negócio que precisam ser atômicas.

Exemplos:

booking  
payment  
subscription  
reservation  
room availability  
lock code  
credit  
commission  
upsell  
referral

Usar transação Prisma.

---

# **54\. P1 — DOUBLE BOOKING**

O projeto já possui testes para double booking.

Garantir proteção real no banco/transação, não apenas teste.

Cenário:

request A  
request B  
same room  
same dates

Resultado:

one succeeds  
one fails  
---

# **55\. P1 — CONCURRENCY**

Testar:

Promise.all  
parallel requests  
retries  
duplicate webhook  
duplicate checkout  
duplicate message  
duplicate booking  
---

# **56\. P1 — QUEUES**

Auditar:

queue-service  
BullMQ  
Redis  
workers  
retry  
backoff  
dead-letter

Garantir:

idempotent jobs  
bounded retries  
no infinite retry  
job timeout  
dead-letter strategy  
observability  
---

# **57\. P1 — CRON**

Auditar todos os:

/api/cron/\*

Cada cron deve possuir:

authentication  
secret  
rate protection  
idempotency  
timeout  
tenant scope  
audit

Nunca confiar somente no path.

---

# **58\. P1 — WEB SOCKET**

Auditar:

socket.io

Garantir:

authentication  
tenant authorization  
room authorization  
disconnect on session invalidation  
no cross-tenant rooms

Testar:

Tenant A connects to Tenant B room

deve falhar.

---

# **59\. P1 — WHATSAPP**

Auditar:

webhook  
send  
AI responder  
message bundler  
channel manager

Garantir:

signature/token verification  
tenant resolution  
phone → tenant mapping  
deduplication  
idempotency  
rate limit  
message ordering  
retry  
dead-letter

Nunca aceitar:

tenantId

diretamente do payload do usuário sem validação.

---

# **60\. P1 — WHATSAPP CROSS-TENANT**

Criar teste:

WABA A  
phone A  
tenant A

não pode acessar:

tenant B

Mesmo que alguém altere:

phone  
wabaId  
tenantId  
message metadata  
---

# **61\. P1 — PAYMENTS**

Auditar:

checkout/create  
checkout/webhook  
payment gateway  
gateway factory  
Asaas  
Mercado Pago  
Stripe

Nenhuma rota de pagamento pode confiar no frontend para:

price  
plan  
discount  
tenant  
commission  
amount

O backend deve resolver tudo.

---

# **62\. P1 — PAYMENT AMOUNT TAMPERING**

Teste:

frontend diz R1backenddeveriacobrarR397

Backend deve rejeitar qualquer alteração.

---

# **63\. P1 — PLAN AUTHORIZATION**

O usuário não pode alterar:

plan \= MAX

via:

request  
cookie  
localStorage  
body  
query

Plan deve ser resolvido do banco/contexto confiável.

---

# **64\. P1 — SUBSCRIPTION STATE MACHINE**

Formalizar:

PENDING  
ACTIVE  
PAST\_DUE  
GRACE\_PERIOD  
SUSPENDED  
CANCELLED  
CHURNED

Impedir transições inválidas.

---

# **65\. P1 — MOCK PROVIDERS**

Criar contrato para cada provider:

interface  
mock implementation  
real implementation  
factory  
environment selector

Exemplo:

PaymentProvider  
 ├─ MockPaymentProvider  
 ├─ AsaasPaymentProvider  
 ├─ MercadoPagoPaymentProvider  
 └─ StripePaymentProvider

O mesmo padrão para:

WhatsApp  
Email  
Maps  
Google Ads  
Meta Ads  
CRM  
AI

Não espalhar seleção de provider pelo código.

---

# **66\. P1 — MOCK GUARD**

Criar uma função central:

assertMockAllowed()

Regra:

production \+ mock provider  
→ throw configuration error

Exceto quando um módulo for explicitamente classificado como:

non-critical UI simulation

Mesmo assim, documentar.

---

# **67\. P1 — MOCK TESTS**

Cada adapter MOCK deve possuir testes garantindo:

contract compatibility  
expected output  
error behavior  
latency behavior  
idempotency  
---

# **68\. P1 — ENVIRONMENT SYSTEM**

O projeto possui muitas variáveis.

Criar schema central usando Zod.

Separar:

server-only  
client-public  
development  
test  
production

Nunca permitir secret em:

NEXT\_PUBLIC\_\*  
---

# **69\. P1 — ENV FAIL FAST**

Em produção:

obrigatórias devem ser validadas no startup.

Exemplos:

DATABASE\_URL  
NEXTAUTH\_SECRET  
NEXTAUTH\_URL  
ENCRYPTION\_SECRET

e providers realmente ativados.

Não exigir credenciais de providers que ainda estão MOCK.

---

# **70\. P1 — REMOVE DUMMY PRODUCTION VALUES**

Localizar:

5548999990000  
5548999990001  
localhost  
127.0.0.1  
example.com  
demo@  
123  
password  
secret  
dummy  
test  
mock

Classificar cada ocorrência.

Não apagar automaticamente.

Para cada uma:

dev-only  
test-only  
documentation  
production bug  
legitimate placeholder  
---

# **71\. P1 — PUBLIC WHATSAPP**

Os números default existentes não podem funcionar como fallback em produção.

Produção:

NEXT\_PUBLIC\_WHATSAPP\_COMMERCIAL  
NEXT\_PUBLIC\_WHATSAPP\_SUPPORT

devem ser configurados explicitamente ou o recurso deve ficar indisponível de forma segura.

---

# **72\. P1 — DATABASE MIGRATION**

Não usar:

prisma db push \--accept-data-loss

como mecanismo normal de produção.

O projeto possui isso no `vercel-build`.

Produção deve utilizar:

prisma migrate deploy

com migrations versionadas.

Nunca:

accept-data-loss

no deploy de produção.

---

# **73\. P1 — MIGRATION SAFETY**

Antes de migration:

backup  
schema validation  
migration plan  
rollback strategy

Documentar migrations destrutivas.

---

# **74\. P1 — SEED**

Garantir que:

seed  
seed-beta  
demo data

não sejam executados automaticamente em produção.

---

# **75\. P1 — DOCKER PRODUCTION**

Docker deve:

* usar usuário não-root;  
* manter tini;  
* possuir healthcheck;  
* não conter secrets;  
* não copiar `.env`;  
* não incluir arquivos desnecessários;  
* usar `.dockerignore`;  
* executar apenas build necessário;  
* usar imagem Node definida;  
* não armazenar DB local.

O Dockerfile já usa usuário não-root e healthcheck; preservar isso.

---

# **76\. P1 — DOCKER IMAGE SECURITY**

Adicionar:

npm ci  
lockfile  
non-root  
minimal packages  
no dev dependencies in runtime

Validar imagem final.

---

# **77\. P1 — HOSTINGER VPS**

Preparar documentação operacional para:

Docker  
PostgreSQL  
Redis  
reverse proxy  
TLS  
domain  
firewall  
backup  
monitoring  
logs  
restart policy  
healthcheck  
environment variables  
migration  
rollback

Não colocar credenciais reais no repositório.

---

# **78\. P1 — REVERSE PROXY**

Documentar configuração esperada:

Internet  
 ↓  
HTTPS  
 ↓  
Reverse Proxy  
 ↓  
Docker :3000

Garantir:

HTTP → HTTPS

e forwarding correto:

X-Forwarded-For  
X-Forwarded-Proto  
Host  
---

# **79\. P1 — TRUST PROXY**

Não confiar cegamente em:

x-forwarded-for

para segurança.

Definir corretamente o proxy confiável.

---

# **80\. P1 — HEALTHCHECK**

Separar:

/health  
/readiness

Health:

process alive

Readiness:

DB available  
required infrastructure available

Não expor secrets ou detalhes internos.

---

# **81\. P1 — OBSERVABILITY**

Garantir:

structured logs  
requestId  
error tracking  
latency  
status codes  
provider failures  
queue failures  
database failures  
security events  
---

# **82\. P1 — METRICS**

Criar métricas mínimas:

request count  
5xx  
latency  
DB latency  
LLM latency  
LLM cost  
webhook failures  
queue failures  
payment failures  
WhatsApp failures  
auth failures  
rate-limit blocks  
---

# **83\. P1 — DATA PRIVACY / LGPD**

Mapear PII:

nome  
email  
telefone  
WhatsApp  
CPF  
CNPJ  
endereço  
IP  
user-agent  
guest data  
reservation data  
payment data  
conversation data  
AI memory

Para cada dado:

purpose  
retention  
access  
encryption  
deletion  
export  
audit  
---

# **84\. P1 — LGPD DATA DELETION**

Criar fluxo seguro para:

tenant deletion  
user deletion  
guest deletion  
lead deletion  
conversation deletion

Respeitar:

foreign keys  
audit requirements  
financial retention  
legal retention  
---

# **85\. P1 — AI MEMORY / TRAINING DATA**

O sistema trabalha com dados conversacionais.

Nunca permitir que:

Tenant A conversation

seja usada como contexto para:

Tenant B

sem autorização explícita e anonimização apropriada.

---

# **86\. P1 — VECTOR DATABASE**

Se pgvector estiver sendo utilizado:

verificar:

tenantId  
namespace  
metadata filter  
embedding source  
deletion  
retention

Toda busca vetorial deve possuir filtro de tenant.

---

# **87\. P1 — CACHE ISOLATION**

Auditar Redis/cache keys.

Nunca:

cache:userId

se o recurso depende de tenant.

Preferir:

tenant:{tenantId}:resource:{id}

Testar cross-tenant cache poisoning.

---

# **88\. P1 — CACHE SIGNING**

Auditar:

CACHE\_SIGNING\_SECRET

Garantir:

produção obrigatório quando usado

e nenhuma assinatura possa ser falsificada.

---

# **89\. P1 — CACHE INVALIDATION**

Auditar:

tenant update  
plan change  
role change  
logout  
password reset  
data deletion

e invalidar caches relacionados.

---

# **90\. P1 — AGENTS**

Para cada agente:

documentar:

purpose  
inputs  
outputs  
tools  
permissions  
tenant scope  
cost limit  
timeout  
retry  
fallback  
logging

Nenhum agente deve possuir acesso global por padrão.

---

# **91\. P1 — AGENT LOOP**

Adicionar:

max iterations  
max tool calls  
max wall time  
max tokens  
max cost

Se exceder:

stop safely  
---

# **92\. P1 — AGENT OUTPUT VALIDATION**

Nunca confiar cegamente em saída LLM para:

SQL  
URL  
tool parameters  
payment amount  
tenantId  
role  
status  
database mutation

Validar com Zod/domain rules.

---

# **93\. P1 — SQL INJECTION**

Procurar:

$queryRaw  
$queryRawUnsafe  
$executeRaw  
$executeRawUnsafe

Cada ocorrência deve ser analisada.

Preferir Prisma parametrizado.

---

# **94\. P1 — COMMAND INJECTION**

Procurar:

exec  
spawn  
execSync  
shell  
child\_process

Verificar se inputs externos conseguem chegar nesses pontos.

---

# **95\. P1 — EVAL**

Confirmar ausência de:

eval  
new Function  
Function(...)

ou usos legítimos devidamente isolados.

---

# **96\. P1 — PATH TRAVERSAL**

Procurar:

fs.readFile  
fs.writeFile  
fs.unlink  
path.join  
path.resolve

com input externo.

---

# **97\. P1 — REGEX DOS**

Auditar regex que recebem input externo.

Evitar expressões vulneráveis a:

catastrophic backtracking  
---

# **98\. P1 — PAGINATION**

Todos os:

findMany  
search  
list  
export  
reports  
logs  
messages  
leads  
guests  
reservations

devem possuir paginação ou limites.

Nunca:

findMany()

sem controle em tabelas potencialmente grandes.

---

# **99\. P1 — SORT/FILTER**

Nunca concatenar diretamente:

orderBy  
sort  
filter  
field

vindos do usuário.

Usar allowlist.

---

# **100\. P1 — SEARCH**

Auditar buscas por:

email  
name  
phone  
domain  
website

Evitar queries abusivas.

Aplicar rate limit.

---

# **101\. P1 — BUSINESS LOGIC**

Auditar:

plan limits  
credits  
referrals  
commissions  
upsells  
pricing  
subscriptions  
reservation  
room availability  
yield  
dynamic pricing

Criar testes de boundary:

0  
1  
maximum  
maximum \+ 1  
negative  
null  
undefined  
decimal  
NaN  
Infinity  
---

# **102\. P1 — FLOAT MONEY**

Localizar valores financeiros usando:

Float  
number

Avaliar migração para:

Decimal

ou estratégia consistente de centavos.

Não utilizar floating point para cálculo financeiro crítico sem justificativa.

---

# **103\. P1 — MONEY ROUNDING**

Definir regra central:

rounding  
currency  
decimal places  
tax  
commission  
discount

Não deixar cada módulo calcular de maneira diferente.

---

# **104\. P1 — TIMEZONE**

O sistema é brasileiro.

Auditar:

Date  
new Date()  
toISOString  
date-fns  
reservation  
check-in  
check-out  
cron  
billing  
reports

Definir:

UTC persistence  
business timezone  
display timezone

evitando bugs de virada de dia.

---

# **105\. P1 — CRON TIMEZONE**

Garantir que cron jobs não executem no horário errado.

---

# **106\. P1 — RESERVATION DATE VALIDATION**

Impedir:

checkout \< checkin  
past dates quando proibido  
zero nights  
negative nights  
invalid timezone  
---

# **107\. P1 — FILE / IMAGE URLs**

Auditar Cloudinary e demais providers.

Garantir:

signed upload  
size limits  
content type  
tenant ownership  
deletion  
---

# **108\. P1 — EMAIL**

Auditar:

email sender  
SMTP  
templates  
tracking  
unsubscribe  
PII

Nunca expor SMTP credentials.

---

# **109\. P1 — EMAIL TRACKING**

O modelo `EmailTracking` armazena:

IP  
userAgent  
openedAt

Avaliar:

LGPD  
retention  
necessity  
anonymization  
---

# **110\. P1 — TRACKING LINKS**

Auditar:

/r/\[code\]  
LinkInBio  
campaign tracking  
email tracking

Garantir:

code entropy  
expiration  
tenant association  
redirect validation  
abuse prevention  
---

# **111\. P1 — ADMIN/ZCC**

Auditar profundamente:

/zcc  
/api/zcc/\*

Nenhuma rota administrativa pode ser protegida somente pelo frontend.

Toda autorização deve existir no backend.

---

# **112\. P1 — GOD MODE**

O ZCC possui múltiplos mecanismos:

master key  
godmode param  
godmode cookie  
NextAuth  
nonce

Reduzir complexidade se possível.

Não permitir que um mecanismo secundário contorne o principal.

Especialmente:

URL query token

deve ser tratado como extremamente sensível.

Nunca logar token.

---

# **113\. P1 — GOD MODE REPLAY**

Testar:

old nonce  
reused nonce  
stolen cookie  
expired cookie  
modified cookie  
wrong tenant  
wrong IP  
---

# **114\. P1 — ZCC AUDIT LOG**

Persistir acessos:

success  
failure  
IP  
requestId  
user  
role  
method  
timestamp

com retenção definida.

---

# **115\. P1 — SECURITY TEST SUITE**

Executar todas as suítes existentes.

O `package.json` já possui uma quantidade extensa de testes de segurança, LGPD, agentes, concorrência, subscriptions, RLS etc.

Não considerar apenas o comando:

npm test

como suficiente.

Executar as suítes individuais.

---

# **116\. P1 — TESTES QUE NÃO TESTAM NADA**

Para cada teste:

verificar se existem assertions reais.

Não aceitar:

expect(true).toBe(true)

como teste de segurança.

Não aceitar testes que apenas verificam:

arquivo existe  
função existe  
string existe

quando deveriam validar comportamento.

---

# **117\. P1 — MOCK TEST CONTAMINATION**

Garantir que testes MOCK não mascaram falhas reais.

Criar distinção:

unit mock  
integration real database  
external provider contract mock  
security  
---

# **118\. P1 — E2E**

O projeto possui script que atualmente informa:

No Playwright tests configured yet

para `test:browser`.

Isso precisa ser analisado.

Se Playwright não está realmente configurado:

não fingir que o teste existe

Implementar ou documentar claramente.

---

# **119\. P1 — CI TEST COVERAGE**

O CI atual não executa necessariamente todas as suítes existentes.

Revisar.

Criar pipeline por níveis:

PR:  
lint  
typecheck  
unit  
security  
schema

merge:  
integration  
e2e  
build

release:  
full suite  
security  
migration check  
docker build  
---

# **120\. P1 — CI BUILD**

Remover:

continue-on-error: true

do build.

Build quebrado deve bloquear.

---

# **121\. P1 — CI ESLINT**

Remover:

continue-on-error: true

e configurar warnings aceitáveis explicitamente.

Ideal:

\--max-warnings=0

após limpar o projeto.

---

# **122\. P1 — CI SECURITY**

`npm audit` não deve ser simplesmente ignorado.

Criar política documentada.

---

# **123\. P1 — SECRET SCANNING**

Executar secret scan sobre:

entire git history  
current files  
environment examples  
logs  
fixtures  
tests  
docs

Procurar:

API keys  
tokens  
JWT secrets  
passwords  
private keys  
webhook secrets  
OAuth secrets

Se houver segredo real no histórico:

rotate immediately

e remover do histórico somente se necessário e coordenado.

---

# **124\. P1 — `.env.example`**

Auditar:

.env.example  
deploy/.env.example

Garantir que:

* nenhum secret real exista;  
* todas variáveis necessárias estejam documentadas;  
* nenhuma variável obsoleta continue;  
* nomes coincidam com `env.ts`;  
* produção e desenvolvimento estejam claramente separados.

---

# **125\. P1 — ENV MATRIX**

Criar documentação:

ENVIRONMENT VARIABLE  
DESCRIPTION  
REQUIRED DEV  
REQUIRED TEST  
REQUIRED PROD  
SECRET?  
PUBLIC?  
DEFAULT?  
PROVIDER  
---

# **126\. P1 — DEAD CODE**

Localizar:

unused functions  
unused imports  
unused routes  
legacy files  
deprecated adapters  
old auth  
old pricing  
old plan names  
old fields

Não apagar sem confirmar dependências.

---

# **127\. P1 — LEGACY PLAN MIGRATION**

O sistema possui:

migratePlanLegacy

e o schema possui planos:

LITE  
PRO  
MAX  
PARCEIRO

Auditar todos os lugares onde planos antigos podem continuar existindo.

Garantir uma única fonte da verdade.

---

# **128\. P1 — STRING ENUMS**

O schema contém diversos campos como:

role String  
plan String  
status String  
niche String

Avaliar quais devem ser enums.

Para campos críticos de autorização/estado, preferir enum ou domain validation.

---

# **129\. P1 — API VERSIONING**

O middleware possui:

/api/v1

Mapear todas APIs.

Definir:

public  
internal  
admin  
webhook  
cron  
agent

Não deixar endpoint "sem dono".

---

# **130\. P1 — ROUTE INVENTORY**

Criar tabela automática:

METHOD  
PATH  
PUBLIC?  
AUTH?  
ROLE?  
TENANT?  
RATE LIMIT?  
CSRF?  
VALIDATION?  
IDEMPOTENCY?  
AUDIT?

para absolutamente todas as APIs.

Essa tabela deverá ser entregue como artefato final da IDE.

---

# **131\. P1 — SERVER ACTION INVENTORY**

Fazer a mesma análise para:

'use server'

Server Actions.

---

# **132\. P1 — API INPUT VALIDATION**

Toda entrada externa deve possuir:

Zod

ou validação equivalente.

Campos:

body  
query  
params  
headers  
cookies  
formData  
---

# **133\. P1 — OUTPUT VALIDATION**

Dados sensíveis não devem sair por acidente.

Criar DTOs/selects explícitos.

Evitar:

return db.user.findUnique(...)

sem selecionar campos seguros.

---

# **134\. P1 — PRISMA SELECT**

Revisar retornos de:

passwordHash  
apiKey  
apiSecret  
tokens  
internal metadata  
---

# **135\. P1 — PASSWORDS**

Garantir:

bcrypt  
adequate cost  
never plaintext  
never logs  
never responses

Testar password reset.

---

# **136\. P1 — ACCOUNT LOCKOUT**

Login deve possuir:

rate limit  
brute force detection  
security alert

sem permitir enumeração de usuários.

---

# **137\. P1 — USER ENUMERATION**

Mensagens de login/reset não devem revelar:

email exists  
tenant exists  
account exists

quando isso permitir enumeração.

---

# **138\. P1 — PASSWORD RESET**

Auditar:

token generation  
expiration  
single use  
storage  
hashing  
rate limit  
email  
session invalidation  
---

# **139\. P1 — EMAIL VERIFICATION**

Auditar:

token  
expiration  
single use  
account activation  
---

# **140\. P1 — OAUTH ACCOUNT TAKEOVER**

Testar:

same email  
existing password account  
Google account  
unverified email  
verified email  
---

# **141\. P1 — PUBLIC ROUTES**

A lista pública do middleware inclui webhooks e integração.

Para cada rota pública:

documentar **por que** ela é pública.

---

# **142\. P1 — BLOCKED DEBUG ROUTES**

Confirmar que:

/api/debug-agent  
/api/proxy  
/api/diagnose

não podem ser acessadas em produção. O middleware já possui lista de bloqueio.

Testar diretamente.

---

# **143\. P1 — DEBUG FLAGS**

Procurar:

DEBUG  
VERBOSE  
TRACE  
DEMO  
MOCK  
BYPASS  
GODMODE  
DEV  
TEST

Cada ocorrência deve ser classificada.

---

# **144\. P1 — PRODUCTION ASSERTION**

Criar módulo:

production-safety.ts

ou equivalente.

Validar no boot:

NODE\_ENV  
DATABASE\_URL  
NEXTAUTH\_SECRET  
ENCRYPTION\_SECRET  
APP\_URL  
MOCK providers  
BYPASS flags  
demo flags  
required Redis  
required payment secrets  
required webhook secrets  
---

# **145\. P1 — PROVIDER CONFIGURATION**

Se:

PAYMENT\_PROVIDER=asaas

então:

ASAAS credentials required

Se:

PAYMENT\_PROVIDER=mock

e:

NODE\_ENV=production

→ fail.

---

# **146\. P1 — FEATURE FLAGS**

Centralizar feature flags.

Nunca espalhar:

process.env.X \=== 'true'

por centenas de arquivos.

---

# **147\. P1 — ERROR BOUNDARIES**

Auditar:

error.tsx  
global-error.tsx  
not-found  
loading

Não mostrar stack trace.

---

# **148\. P1 — CLIENT ENV**

Garantir que somente:

NEXT\_PUBLIC\_\*

chegue ao browser.

Nenhuma secret deve aparecer no bundle.

Executar análise de bundle.

---

# **149\. P1 — SOURCE MAPS**

Produção já possui:

productionBrowserSourceMaps: false

preservar.

Avaliar source maps server-side separadamente.

---

# **150\. P1 — CSP NONCE**

Avaliar remoção gradual de:

unsafe-inline

se tecnicamente possível.

Não quebrar Next/Stripe/MP.

---

# **151\. P2 — CODE QUALITY**

Limpar:

any  
unknown excessivo  
eslint disable  
ts-ignore  
duplicated helpers  
duplicated auth  
duplicated env access

somente quando isso não alterar comportamento.

---

# **152\. P2 — ARCHITECTURE**

Criar limites claros:

presentation  
API  
domain  
application  
infrastructure  
providers  
database  
security

Não fazer refactor gigante.

---

# **153\. P2 — CENTRALIZE SECURITY**

Evitar múltiplas implementações independentes de:

auth  
rate limit  
tenant resolution  
env  
encryption  
logging  
---

# **154\. P2 — DOCUMENTAÇÃO**

Criar:

docs/PRODUCTION\_READINESS.md  
docs/SECURITY.md  
docs/DEPLOY-HOSTINGER.md  
docs/ENVIRONMENT.md  
docs/ARCHITECTURE.md  
docs/MOCK-PROVIDERS.md  
docs/DATABASE.md  
docs/WEBHOOKS.md  
docs/INCIDENT-RESPONSE.md  
---

# **155\. P2 — RUNBOOK HOSTINGER**

Documentar exatamente:

1\. provision VPS  
2\. install Docker  
3\. configure PostgreSQL  
4\. configure Redis  
5\. configure environment  
6\. migrate database  
7\. build image  
8\. start containers  
9\. configure reverse proxy  
10\. TLS  
11\. DNS  
12\. healthcheck  
13\. backup  
14\. restore  
15\. rollback  
---

# **156\. P2 — BACKUP**

Documentar:

PostgreSQL backup  
retention  
offsite backup  
encryption  
restore test

Um backup não testado não deve ser considerado confiável.

---

# **157\. P2 — DISASTER RECOVERY**

Definir:

RPO  
RTO  
backup frequency  
restore procedure  
database restore  
Redis recovery  
application redeploy  
secret recovery  
---

# **158\. P2 — DEPLOY ROLLBACK**

Garantir:

previous image  
previous migration awareness  
rollback procedure  
health validation  
---

# **159\. P2 — ZERO-DOWNTIME**

Avaliar se o deploy pode causar:

dropped WebSockets  
failed requests  
migration incompatibility  
queue duplication  
---

# **160\. P2 — PERFORMANCE**

Auditar:

N+1 Prisma  
large queries  
unbounded lists  
serial awaits  
large JSON  
AI latency  
external API calls  
---

# **161\. P2 — DATABASE CONNECTIONS**

Para VPS:

avaliar:

connection pooling  
Prisma connection limits  
PostgreSQL max connections  
workers  
Next processes  
---

# **162\. P2 — MEMORY**

Auditar:

global Maps  
in-memory audit logs  
cache  
large arrays  
file buffers  
CSV/XLSX  
AI responses  
---

# **163\. P2 — EXISTING IN-MEMORY SECURITY STATE**

O middleware mantém estruturas como:

zccAuditLog  
zccRateLimiter  
zccActiveNonces

Essas estruturas devem ser classificadas como:

ephemeral auxiliary

e nunca como fonte definitiva de segurança.

---

# **164\. P2 — NONCE CLEANUP**

Garantir:

expiry  
max size  
restart behavior  
replay prevention  
---

# **165\. P2 — REQUEST TIMEOUTS**

Toda chamada externa importante deve possuir timeout.

Não permitir request infinito.

---

# **166\. P2 — RETRY POLICY**

Toda integração externa deve definir:

retryable errors  
non-retryable errors  
max attempts  
backoff  
jitter  
---

# **167\. P2 — CIRCUIT BREAKER**

Para providers críticos, avaliar:

circuit breaker  
bulkhead  
fallback  
---

# **168\. P2 — EXTERNAL PROVIDERS**

Auditar todos:

OpenAI  
Groq  
Gemini  
Anthropic  
DeepSeek  
Zhipu  
Moonshot  
Kimi  
OpenRouter  
Ollama  
Asaas  
Mercado Pago  
Stripe  
Meta  
Google  
Cloudinary  
Maps  
Email  
Booking  
Airbnb  
GitHub

Cada integração deve possuir:

timeout  
auth  
validation  
retry  
logging  
cost  
rate limit  
failure behavior  
---

# **169\. P2 — API VERSION COMPATIBILITY**

Fixar versões de APIs externas quando necessário.

Não depender de comportamento implícito.

---

# **170\. P2 — WEBHOOK REPLAY**

Criar testes:

same event 2x  
same event 10x  
same event after timeout  
same event after partial failure  
---

# **171\. P2 — SECURITY FUZZING**

Fuzz:

JSON  
query  
headers  
IDs  
UUID  
URLs  
phone  
email  
Markdown  
AI prompts  
webhooks  
---

# **172\. P2 — PROPERTY-BASED TESTS**

Aplicar especialmente em:

pricing  
plans  
reservation  
dates  
money  
rate limits  
permissions  
tenant isolation  
---

# **173\. P2 — SAST**

Expandir SAST para procurar:

secrets  
unsafe SQL  
unsafe shell  
dangerous HTML  
unsafe redirects  
weak crypto  
hardcoded credentials  
tenant bypass  
---

# **174\. P2 — DEPENDENCY LOCK**

Garantir:

package-lock.json

consistente com package.json.

CI deve usar:

npm ci

e não:

npm install \--legacy-peer-deps

como rotina, salvo necessidade documentada.

---

# **175\. P2 — BUILD REPRODUCIBILITY**

O mesmo commit deve produzir build equivalente.

---

# **176\. P2 — DOCKER REPRODUCIBILITY**

Fixar:

Node version  
package lock  
base image strategy  
---

# **177\. P2 — STATIC ASSETS**

Auditar:

public/

para:

secrets  
test files  
internal files  
large assets  
unused files  
---

# **178\. P2 — GIT REPOSITORY**

Auditar:

.env  
.env.local  
\*.pem  
\*.key  
\*.crt  
credentials  
database files  
logs  
\*.db  
\*.sqlite

Garantir `.gitignore`.

---

# **179\. P2 — LOG FILES**

O `package.json` direciona alguns processos para:

dev.log  
server.log

Garantir que isso não gere crescimento infinito em produção.

Usar stdout/stderr e rotação adequada.

---

# **180\. P2 — DATABASE LOGGING**

Produção não deve registrar queries sensíveis desnecessariamente.

---

# **181\. P2 — SECURITY ALERTS**

Rate-limit/security events devem gerar alerta sem bloquear o fluxo crítico quando o sistema de notificação estiver indisponível.

Separar:

security enforcement

de:

security notification  
---

# **182\. P2 — NOTIFICATION FAILURE**

Nunca:

security alert failed  
→ authentication/payment operation fails

a menos que explicitamente necessário.

---

# **183\. P2 — ADMIN ACTIONS**

Toda ação administrativa crítica deve possuir:

actor  
tenant  
action  
target  
before  
after  
timestamp  
requestId

sem armazenar secrets.

---

# **184\. P2 — DESTRUCTIVE ACTIONS**

Para:

delete  
suspend  
cancel  
refund  
remove tenant

exigir autorização adequada.

---

# **185\. P2 — SOFT DELETE**

Avaliar onde:

soft delete

é necessário para auditoria/LGPD.

Não aplicar cegamente.

---

# **186\. P2 — DATA RETENTION**

Criar política por entidade.

---

# **187\. P2 — PII REDACTION**

Criar utilitários para:

maskEmail  
maskPhone  
maskCPF  
maskToken  
maskApiKey

e aplicar nos logs.

---

# **188\. P2 — API ERROR CODES**

Criar códigos consistentes:

UNAUTHORIZED  
FORBIDDEN  
NOT\_FOUND  
VALIDATION\_ERROR  
RATE\_LIMITED  
CONFLICT  
DATABASE\_UNAVAILABLE  
PROVIDER\_UNAVAILABLE  
INTERNAL\_ERROR  
---

# **189\. P2 — HTTP STATUS**

Corrigir usos inadequados de:

200 para erro  
500 para validation  
401 para permission  
403 para authentication  
---

# **190\. P2 — IDEMPOTENCY GENERAL**

Para operações críticas públicas:

Idempotency-Key

quando aplicável.

---

# **191\. P2 — API CONTRACTS**

Documentar contratos de:

request  
response  
error  
auth  
rate limits  
---

# **192\. P2 — OPENAPI**

Avaliar geração de OpenAPI para APIs externas/internas relevantes.

---

# **193\. P2 — FRONTEND SECURITY**

Auditar:

localStorage  
sessionStorage  
cookies  
URL params  
postMessage  
iframe  
window.open

Não armazenar secrets no browser.

---

# **194\. P2 — POSTMESSAGE**

Se existir:

validar:

origin  
message type  
payload  
---

# **195\. P2 — IFRAME**

Auditar:

Stripe  
payment  
external widgets

contra CSP e origin validation.

---

# **196\. P2 — CLIENT-SIDE AUTH**

Nunca considerar:

hidden UI  
disabled button  
route guard

como autorização.

---

# **197\. P2 — PLAN UI**

Mesmo que frontend esconda recurso, backend deve verificar plano.

---

# **198\. P2 — MOBILE/PWA**

Auditar:

service worker  
cache  
offline  
manifest  
push notifications

Garantir que dados privados não sejam armazenados offline sem proteção.

---

# **199\. P2 — SERVICE WORKER**

Não cachear:

API authenticated responses  
private data  
tenant data

sem estratégia segura.

---

# **200\. P2 — FINAL PRODUCTION SCAN**

Depois de todas as correções:

executar novamente a auditoria completa.

Não confiar no primeiro resultado.

---

# **201\. COMANDOS OBRIGATÓRIOS**

A IDE deve executar e registrar:

npm ci  
npm run lint  
npm run typecheck  
npm test  
npm run test:sast  
npm run test:v11-all  
npm run test:cerebro-ml-all  
npm run test:zella-red-teaming  
npm run test:zella-cross-talk  
npm run test:zella-multi-turn-drift  
npm run test:zella-double-booking  
npm run test:zella-confidence-lock  
npm run test:subscription-lifecycle  
npm run test:observability-recovery  
npm run test:data-governance  
npm run test:locks-all  
npm run test:notifs-all  
npm run test:mobile-suite  
npm run build  
npx prisma validate  
npx prisma generate  
npm audit \--audit-level=high

Se algum comando não puder ser executado por depender de infraestrutura externa:

**não fingir que passou.**

Registrar:

BLOCKED  
REASON  
DEPENDENCY  
WHAT WAS VERIFIED  
WHAT REMAINS  
---

# **202\. DOCKER VALIDATION**

Executar:

docker build .

Depois testar:

container starts  
healthcheck passes  
non-root  
database connection  
environment validation  
---

# **203\. PRODUÇÃO MOCK TEST**

Simular:

NODE\_ENV=production

com providers MOCK.

Resultado esperado:

critical MOCK provider → FAIL FAST

mas:

non-critical demo UI

não deve quebrar build.

---

# **204\. PRODUÇÃO SEM DATABASE**

Simular:

DATABASE\_URL inválida

Resultado:

startup/configuration failure

ou:

503

conforme o contexto.

Nunca retornar dados demo.

---

# **205\. PRODUÇÃO SEM NEXTAUTH\_SECRET**

Resultado:

startup failure  
---

# **206\. PRODUÇÃO SEM ENCRYPTION\_SECRET**

Resultado:

startup failure

se o recurso de criptografia estiver habilitado/necessário.

---

# **207\. PRODUÇÃO COM BYPASS**

Simular:

BYPASS\_MIDDLEWARE\_AUTH=true  
NODE\_ENV=production

Resultado:

FAIL FAST  
---

# **208\. PRODUÇÃO COM DEMO**

Simular:

DEMO\_MODE=true  
NODE\_ENV=production

Resultado:

FAIL FAST

se isso habilitar autenticação/demo.

---

# **209\. PRODUÇÃO COM WEBHOOK SECRET AUSENTE**

Para cada webhook:

secret missing

Resultado:

configuration failure

não:

accept webhook  
---

# **210\. CROSS-TENANT RED TEAM**

Criar testes automatizados tentando:

alterar tenantId  
trocar ID  
trocar email  
trocar phone  
trocar WABA  
alterar JWT claims  
alterar role  
alterar plan  
alterar propertyId  
alterar reservationId  
alterar leadId

Resultado:

DENIED  
---

# **211\. AUTH RED TEAM**

Testar:

123/123  
demo  
BYPASS  
expired JWT  
tampered JWT  
wrong tenant  
wrong role  
OAuth collision  
stolen callback  
open redirect  
---

# **212\. PAYMENT RED TEAM**

Testar:

amount manipulation  
plan manipulation  
tenant manipulation  
duplicate webhook  
fake webhook  
replayed webhook  
wrong customer  
wrong subscription  
---

# **213\. AI RED TEAM**

Testar:

prompt injection  
system prompt extraction  
tool escalation  
cross-tenant data extraction  
secret extraction  
SQL generation  
URL manipulation  
infinite loop  
cost exhaustion  
---

# **214\. API RED TEAM**

Testar:

missing auth  
wrong auth  
missing tenant  
wrong tenant  
invalid IDs  
large payload  
rate abuse  
concurrent requests  
unexpected content type  
---

# **215\. WEBHOOK RED TEAM**

Testar:

missing signature  
wrong signature  
replay  
tampered body  
wrong event  
invalid JSON  
huge payload  
duplicate  
---

# **216\. FILE RED TEAM**

Testar:

path traversal  
fake MIME  
large file  
malicious filename  
double extension  
unauthorized tenant file  
deleted file access  
---

# **217\. FINAL ACCEPTANCE GATE**

O projeto só pode ser considerado:

PRODUCTION READY

quando:

### **Código**

typecheck PASS  
lint PASS  
build PASS

### **Testes**

unit PASS  
integration PASS  
security PASS  
E2E PASS  
red team PASS

### **Banco**

Prisma validate PASS  
migrations valid  
tenant isolation PASS

### **Segurança**

no production bypass  
no demo login  
no hardcoded secrets  
no unsafe webhook  
no cross-tenant access  
no critical dependency vulnerability

### **Infraestrutura**

Docker build PASS  
Docker startup PASS  
health PASS  
readiness PASS

### **MOCK**

MOCK works in development  
MOCK cannot accidentally operate critical production flows  
---

# **218\. REGRA DE NÃO DESTRUIR**

A IDE **não deve**:

* recriar o projeto;  
* trocar Next.js sem necessidade;  
* trocar Prisma sem necessidade;  
* trocar banco;  
* remover módulos funcionais;  
* remover testes;  
* remover MOCKs;  
* apagar features;  
* simplificar arquitetura sacrificando segurança;  
* substituir tudo por uma implementação nova;  
* criar um segundo sistema paralelo.

Prioridade:

CORRIGIR  
CONSOLIDAR  
ISOLAR  
VALIDAR  
TESTAR  
---

# **219\. REGRA DE PRESERVAÇÃO**

Quando encontrar:

MOCK

não remover imediatamente.

Classificar:

MOCK-DEV  
MOCK-TEST  
MOCK-DEMO  
MOCK-FALLBACK  
MOCK-PRODUCTION-DANGER

Somente:

MOCK-PRODUCTION-DANGER

deve ser bloqueado/removido do caminho de produção.

---

# **220\. REGRA DE NÃO INVENTAR INTEGRAÇÕES**

Não criar:

API credentials  
webhook URLs  
database credentials  
Redis credentials  
OAuth credentials

Use:

environment variables

e documentação.

---

# **221\. REGRA DE NÃO MASCARAR ERRO**

Nunca corrigir um erro simplesmente fazendo:

catch { return null }

ou:

catch { return demo }

ou:

continue-on-error

ou:

ignoreBuildErrors

sem justificar.

---

# **222\. REGRA DE OBSERVABILIDADE**

Toda correção importante deve possuir:

test  
log seguro  
error handling

quando aplicável.

---

# **223\. REGRA DE MIGRAÇÃO**

Toda mudança de schema deve gerar:

migration

e não apenas:

db push

para produção.

---

# **224\. REGRA DE DOCUMENTAÇÃO**

Toda decisão excepcional deve ser documentada.

Exemplo:

WHY  
RISK  
MITIGATION  
WHEN TO REMOVE  
---

# **225\. RELATÓRIO FINAL OBRIGATÓRIO DA IDE**

Quando terminar, **não apenas diga "feito"**.

Produza um relatório:

## **A. Arquivos alterados**

path  
what changed  
why

## **B. Arquivos criados**

path  
purpose

## **C. Arquivos removidos**

path  
why

## **D. Bugs corrigidos**

ID  
severity  
file  
problem  
fix  
test

## **E. Vulnerabilidades corrigidas**

ID  
severity  
CWE quando aplicável  
file  
attack scenario  
fix  
test

## **F. Multi-tenancy**

Informar:

routes audited  
queries audited  
cross-tenant tests  
result

## **G. Authentication**

Informar:

demo removed/isolated  
bypass removed/isolated  
OAuth  
JWT  
cookies  
RBAC

## **H. MOCK**

Listar:

all MOCK providers  
which remain  
which are blocked in production  
how switching to real provider works

## **I. Database**

Informar:

schema changes  
migrations  
indexes  
constraints  
transactions

## **J. Webhooks**

Tabela:

provider  
signature  
idempotency  
rate limit  
tenant resolution  
status

## **K. CI/CD**

Mostrar:

lint  
typecheck  
tests  
security  
build  
docker

## **L. Testes**

Mostrar:

total  
passed  
failed  
skipped  
blocked

## **M. Remaining issues**

**Não esconder nada.**

Separar:

P0  
P1  
P2  
P3

## **N. Production readiness**

Responder objetivamente:

READY  
NOT READY  
READY WITH CONDITIONS

e explicar exatamente por quê.

---

# **226\. CRITÉRIO FINAL MAIS IMPORTANTE**

Depois de implementar tudo, a IDE deve executar uma segunda auditoria independente procurando especificamente:

"o que ainda pode quebrar este sistema em produção?"

Não assumir que as correções realizadas estão certas.

Reauditar.

---

# **227\. ENTREGA FINAL PARA O RESPONSÁVEL DO PROJETO**

Entregar:

1\. Production Readiness Report  
2\. Security Audit Report  
3\. Multi-Tenant Isolation Report  
4\. Mock/Real Provider Matrix  
5\. Environment Variable Matrix  
6\. API Security Matrix  
7\. Webhook Security Matrix  
8\. Database Migration Report  
9\. Test Execution Report  
10\. CI/CD Report  
11\. Hostinger Deployment Readiness Report  
12\. Remaining Risks  
---

# **228\. DEFINIÇÃO DE "PRONTO"**

Não usar a expressão:

> "Projeto corrigido."

A definição correta é:

> **O código foi auditado, as vulnerabilidades e gaps identificados foram corrigidos, os MOCKs foram preservados onde necessários para desenvolvimento, os caminhos MOCK/DEMO/BYPASS foram isolados de produção, o isolamento multi-tenant foi validado, autenticação/autorização foram endurecidas, webhooks e pagamentos possuem validação/idempotência, banco e migrations estão coerentes, CI/CD bloqueia regressões e os testes de segurança passaram.**

---

## **Observação importante sobre o estado atual**

Alguns dos itens acima **já possuem uma tentativa de implementação no repositório**. Isso não significa que devam ser recriados.

Por exemplo:

* o rate limiter distribuído já existe e inclusive possui fail-closed em produção;  
* o tenant context já possui uma separação correta para bypass somente fora de produção;  
* AES-256-GCM já está implementado;  
* existem diversos testes de segurança;  
* existem adapters MOCK;  
* existe middleware de segurança;  
* existe healthcheck;  
* existe usuário Docker não-root.

Portanto, **a instrução para o Antigravity é melhorar e consolidar o que já existe, e não sair substituindo tudo.**

Também há uma inconsistência particularmente importante no CI: o pipeline declara Node 20, enquanto o Docker usa Node 24, e o pipeline atualmente permite que ESLint, build e `npm audit` falhem sem bloquear o processo.

E o problema do banco é mais sério do que simplesmente "há um fallback": o `db.ts` pode transformar indisponibilidade do Prisma em um proxy que devolve `null`, o que pode fazer determinadas partes da aplicação aparentarem funcionar quando na realidade não possuem persistência.

Por fim, o webhook Asaas merece atenção imediata: **se o segredo esperado não estiver configurado, a lógica atual não deve ser considerada uma autenticação fail-closed**. Isso precisa ser corrigido antes da produção.

### **Minha recomendação para você**

**Não entregue ao Antigravity apenas a lista acima como "faça tudo de uma vez".** Entregue exatamente como um **Master Execution Specification**, mas mande a IDE trabalhar em fases:

FASE 0 — Inventário e snapshot  
FASE 1 — P0 Security / Auth / Tenant  
FASE 2 — Database / Prisma / Transactions  
FASE 3 — APIs / Webhooks / Payments  
FASE 4 — AI / Agents / Tools  
FASE 5 — MOCK isolation  
FASE 6 — CI/CD / Docker / Production config  
FASE 7 — Tests / Red Team  
FASE 8 — Hostinger readiness  
FASE 9 — Independent final audit

**E, principalmente, peça para ela parar ao final de cada fase e apresentar o resultado antes de avançar para a seguinte.** Isso evita que o Antigravity faça um refactor gigantesco, introduza novos problemas e depois você não consiga descobrir qual alteração causou qual regressão.

Quando você trouxer o **relatório de execução do Antigravity \+ diff/lista de arquivos alterados \+ resultados dos testes**, aí sim eu consigo fazer a terceira etapa: **auditoria pós-correção**, confrontando o que a IDE diz ter corrigido com o código efetivamente produzido e procurando os gaps que permaneceram.

