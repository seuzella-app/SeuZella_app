# 🤖 Zélla Discord Bot — Setup Guide

## Passo 1: Criar Bot no Discord Developer Portal

1. Acesse: https://discord.com/developers/applications
2. Clique **"New Application"**
3. Nome: `Zélla Bot`
4. Vá em **Bot** → **Add Bot**
5. Copie o **Token** (vai usar no .env)
6. Em **Privileged Gateway Intents**:
   - ✅ Enable **Message Content Intent**
   - ✅ Enable **Server Members Intent**
   - ✅ Enable **Presence Intent**

## Passo 2: Convidar Bot para seu Servidor

Gere URL de convite:
1. Vá em **OAuth2** → **URL Generator**
2. Selecione:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: 
     - Send Messages
     - Read Message History
     - Embed Links
     - Use Slash Commands
     - Send Typing
3. Copie a URL gerada
4. Abra no navegador → selecione seu servidor `SeuZélla`
5. Autorize

## Passo 3: Configurar .env

Crie arquivo `.env` na pasta do bot:

```bash
# Obrigatório
DISCORD_BOT_TOKEN=seu-token-copiado-do-passo-1

# Opcional — se quiser que o bot só responda em um canal específico
# Pegue o ID do canal: Discord → Configurações → Avançado → Modo Desenvolvedor → clique direito no canal → Copiar ID
DISCORD_CHANNEL_ID=123456789012345678

# IA (z-ai-web-dev-sdk) — opcional mas recomendado
# Se não configurar, o bot responde com templates
ZAI_API_KEY=sua-chave-zai
```

## Passo 4: Instalar e Rodar

```bash
cd mini-services/discord-bot
bun install
bun run dev
```

Bot fica online e responde comandos no Discord.

## Passo 5: Testar

No Discord (no canal onde o bot está), envie:

```
!ajuda
```

Deve responder com lista de comandos.

```
!zélla qual o horário de check-in da pousada?
```

IA responde via GLM.

## Comandos Disponíveis

| Comando | Função |
|---------|--------|
| `!zélla <pergunta>` | IA responde qualquer pergunta |
| `!status` | Status do sistema |
| `!tenants` | Como ver tenants ativos |
| `!custo` | Como ver custos Meta |
| `!cerebro` | Status do Cérebro Zélla |
| `!ajuda` | Lista de comandos |
| `@Zélla <pergunta>` | Menção direta para IA |

## Rodar em Background

```bash
cd mini-services/discord-bot
nohup bun run dev > discord-bot.log 2>&1 &
```

## Troubleshooting

### "Token inválido"
- Verifique se copiou o token completo
- Verifique se não há espaços no .env

### "Bot não responde"
- Verifique se **Message Content Intent** está ativo
- Verifique se o bot tem permissão no canal
- Tente `!ajuda` — se não responder, reinicie o bot

### "IA não responde"
- Verifique se `ZAI_API_KEY` está configurado
- Sem key, o bot usa respostas template
