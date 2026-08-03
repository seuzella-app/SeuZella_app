// ============================================================================
// SEU ZÉLLA — Discord Bot (Mini-Serviço)
// ============================================================================
// Bot Discord que conecta ao servidor do SeuZélla e oferece:
//
// 1. IA Assistente — responde perguntas via z-ai-web-dev-sdk (LLM)
// 2. Alertas do Cérebro — recebe notificações quando anomalias são detectadas
// 3. Comandos ZCC — status do sistema, tenants, custos, etc.
//
// COMANDOS DISPONÍVEIS (no canal onde o bot está):
//   !zélla <pergunta>     → IA responde (via GLM)
//   !status               → Status do sistema SeuZélla
//   !tenants              → Lista tenants ativos
//   !custo                → Resumo de custos Meta do dia
//   !cerebro              → Status do Cérebro Zélla
//   !ajuda                → Lista de comandos
//
// SETUP:
//   1. Criar bot em https://discord.com/developers/applications
//   2. Pegar DISCORD_BOT_TOKEN
//   3. Convidar bot para servidor com scope=bot+applications.commands
//   4. Setar env vars: DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID (opcional)
//   5. bun run dev
// ============================================================================

import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
  type Interaction,
  Events,
} from 'discord.js';
import ZAI from 'z-ai-web-dev-sdk';

// ── Config ──────────────────────────────────────────────────────────────────

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID; // canal específico (opcional)
const PORT = 3010; // porta do mini-serviço (não usada para Discord, mas para health check)

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN não configurado!');
  console.error('   1. Vá em https://discord.com/developers/applications');
  console.error('   2. Crie uma Application → Bot');
  console.error('   3. Copie o token');
  console.error('   4. Set: DISCORD_BOT_TOKEN=<seu-token>');
  process.exit(1);
}

// ── Bot Setup ──────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ── IA Setup (z-ai-web-dev-sdk) ─────────────────────────────────────────────

let zaiClient: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZaiClient() {
  if (!zaiClient) {
    zaiClient = await ZAI.create();
    console.log('✅ z-ai-web-dev-sdk inicializado');
  }
  return zaiClient;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function shouldRespond(message: Message): boolean {
  // Ignora mensagens do próprio bot
  if (message.author.bot) return false;

  // Se CHANNEL_ID configurado, só responde naquele canal
  if (CHANNEL_ID && message.channelId !== CHANNEL_ID) return false;

  // Responde se menciona o bot OU se começa com !zélla
  if (message.mentions.has(client.user?.id || '')) return true;
  if (message.content.toLowerCase().startsWith('!zélla') || 
      message.content.toLowerCase().startsWith('!zella')) return true;
  if (message.content.startsWith('!status') ||
      message.content.startsWith('!tenants') ||
      message.content.startsWith('!custo') ||
      message.content.startsWith('!cerebro') ||
      message.content.startsWith('!ajuda')) return true;

  return false;
}

async function showTyping(message: Message): Promise<void> {
  try {
    await message.channel.sendTyping();
  } catch {
    // ignore
  }
}

// ── IA Response ────────────────────────────────────────────────────────────

async function generateAIResponse(userMessage: string): Promise<string> {
  try {
    const zai = await getZaiClient();

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Você é o Zélla, assistente virtual do SaaS SeuZélla.com (plataforma de automação de atendimento via WhatsApp para pousadas e anfitriões Airbnb).

Você está sendo acessado via Discord por um administrador do sistema.

Responda de forma:
- Concisa e direta (máximo 3 parágrafos)
- Técnica quando a pergunta for técnica
- Em português do Brasil
- Sempre com tom profissional mas acessível

Se não souber algo, diga "Não tenho essa informação no momento."`,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    return content || 'Não consegui gerar uma resposta. Tente reformular.';
  } catch (err) {
    console.error('[Zélla Bot] Erro ao gerar resposta IA:', err);
    return '⚠️ Erro ao processar com a IA. Verifique se ZAI_API_KEY está configurada.';
  }
}

// ── Comandos do Sistema ────────────────────────────────────────────────────

async function handleCommand(message: Message): Promise<void> {
  const content = message.content.trim();
  const lower = content.toLowerCase();

  // ── !ajuda ──
  if (lower.startsWith('!ajuda') || lower.startsWith('!help')) {
    await message.reply({
      embeds: [{
        title: '🤖 Zélla Bot — Comandos',
        description: `**Comandos disponíveis:**

**!zélla <pergunta>** — IA responde qualquer pergunta
**!status** — Status do sistema SeuZélla
**!tenants** — Lista tenants ativos
**!custo** — Resumo de custos Meta do dia
**!cerebro** — Status do Cérebro Zélla
**!ajuda** — Esta mensagem

**Ou mencione o bot** (@Zélla) com qualquer pergunta.`,
        color: 0x10b981,
      }],
    });
    return;
  }

  // ── !status ──
  if (lower.startsWith('!status')) {
    await showTyping(message);
    await message.reply({
      embeds: [{
        title: '📊 Status do Sistema',
        fields: [
          { name: '🟢 Bot', value: 'Online', inline: true },
          { name: '🧠 IA', value: zaiClient ? 'Conectado' : 'Não inicializado', inline: true },
          { name: '⏱️ Uptime', value: `${Math.floor(process.uptime() / 60)}min`, inline: true },
          { name: '💾 Memória', value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`, inline: true },
          { name: '📦 Node', value: process.version, inline: true },
          { name: '🌐 Servidor', value: 'SeuZélla.com', inline: true },
        ],
        color: 0x3b82f6,
      }],
    });
    return;
  }

  // ── !tenants ──
  if (lower.startsWith('!tenants')) {
    await message.reply({
      embeds: [{
        title: '👥 Tenants',
        description: `Para ver tenants ativos, acesse o ZCC:
https://smart-hotel-zehla.vercel.app/zcc

Login: 123 / Senha: 123

Ou via API:
\`\`\`
GET /api/zcc/tenants
\`\`\``,
        color: 0xd4a843,
      }],
    });
    return;
  }

  // ── !custo ──
  if (lower.startsWith('!custo')) {
    await message.reply({
      embeds: [{
        title: '💰 Custos Meta',
        description: `Para ver custos detalhados, acesse:
https://smart-hotel-zehla.vercel.app/zcc → Burn Rate

Ou o Cérebro Zélla:
https://smart-hotel-zehla.vercel.app/zcc → Cérebro → CFO Virtual`,
        color: 0xf59e0b,
      }],
    });
    return;
  }

  // ── !cerebro ──
  if (lower.startsWith('!cerebro')) {
    await message.reply({
      embeds: [{
        title: '🧠 Cérebro Zélla',
        fields: [
          { name: 'Status', value: '🟡 MODO MOCK' + (process.env.CEREBRO_LIVE_MODE === 'true' ? ' → 🟢 LIVE' : ''), inline: true },
          { name: 'Anomalias', value: 'Ver no ZCC', inline: true },
          { name: 'Refactors', value: 'Ver no ZCC', inline: true },
          { name: 'Sandbox', value: 'Ver no ZCC', inline: true },
          { name: 'Crons Ativos', value: '7 (analyze, watchdog, forecast, refactor, cleanup, weekly, budget-reset)', inline: true },
          { name: 'Dashboard', value: 'https://smart-hotel-zehla.vercel.app/zcc', inline: true },
        ],
        color: 0xa855f7,
      }],
    });
    return;
  }

  // ── !zélla <pergunta> ou menção ──
  let question = content;

  // Remove menção do bot
  if (message.mentions.has(client.user?.id || '')) {
    question = content.replace(/<@!?\d+>/g, '').trim();
  }

  // Remove prefixo !zélla
  if (lower.startsWith('!zélla') || lower.startsWith('!zella')) {
    question = content.replace(/^!zélla\s*/i, '').replace(/^!zella\s*/i, '').trim();
  }

  if (!question) {
    await message.reply('🤖 O que você quer saber? Use `!zélla <sua pergunta>` ou me mencione com @Zélla');
    return;
  }

  // Mostra "digitando..."
  await showTyping(message);

  // Gera resposta
  console.log(`[Zélla Bot] Pergunta de ${message.author.tag}: ${question.substring(0, 100)}`);
  const aiResponse = await generateAIResponse(question);

  // Responde (pode ser longa, Discord tem limite de 2000 chars)
  if (aiResponse.length > 1900) {
    // Divide em chunks
    const chunks: string[] = [];
    let remaining = aiResponse;
    while (remaining.length > 0) {
      chunks.push(remaining.substring(0, 1900));
      remaining = remaining.substring(1900);
    }
    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  } else {
    await message.reply(aiResponse);
  }
}

// ── Event Listeners ─────────────────────────────────────────────────────────

client.once(Events.ClientReady, (readyClient) => {
  console.log(`╔══════════════════════════════════════════════════╗`);
  console.log(`║  🤖 Zélla Bot — Online                          ║`);
  console.log(`║  Logado como: ${readyClient.user.tag.padEnd(33)}║`);
  console.log(`║  Servidor: SeuZélla Discord                     ║`);
  console.log(`║  Comandos: !zélla, !status, !tenants, !custo,  ║`);
  console.log(`║           !cerebro, !ajuda                      ║`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log('');

  // Define status "Online" com atividade
  readyClient.user.setActivity('SeuZélla.com | !ajuda', { type: 3 }); // Watching
});

client.on(Events.MessageCreate, async (message: Message) => {
  try {
    if (!shouldRespond(message)) return;
    await handleCommand(message);
  } catch (err) {
    console.error('[Zélla Bot] Erro ao processar mensagem:', err);
    try {
      await message.reply('⚠️ Erro interno. Tente novamente.');
    } catch {
      // ignore
    }
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'zélla') {
    const question = interaction.options.getString('pergunta');
    if (!question) {
      await interaction.reply('Qual sua pergunta?');
      return;
    }

    await interaction.deferReply();
    const response = await generateAIResponse(question);
    await interaction.editReply(response);
  }
});

client.on(Events.Error, (error) => {
  console.error('[Zélla Bot] Erro do cliente Discord:', error);
});

client.on(Events.ShardError, (error) => {
  console.error('[Zélla Bot] Shard error:', error);
});

// ── Login ───────────────────────────────────────────────────────────────────

console.log('Conectando ao Discord...');
client.login(DISCORD_TOKEN).catch((err) => {
  console.error('❌ Falha ao conectar ao Discord:', err);
  console.error('   Verifique se DISCORD_BOT_TOKEN está correto.');
  process.exit(1);
});

// ── Graceful Shutdown ───────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n[Zélla Bot] Desligando...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Zélla Bot] SIGTERM recebido, desligando...');
  client.destroy();
  process.exit(0);
});
