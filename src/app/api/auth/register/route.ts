import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  phone: z.string().optional(),
  pousadaName: z.string().min(2, 'Nome da propriedade é obrigatório'),
  cnpjOrCpf: z.string().optional(),
  niche: z.enum(['pousada', 'airbnb']).default('pousada'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const existingTenant = await db.tenant.findUnique({
      where: { email: data.email },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 409 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    // Determine the default agent name and prompt based on niche
    const agentConfig = data.niche === 'airbnb'
      ? {
          agentId: 'agent-1',
          agentName: 'Anfitrião ZÉLLA',
          systemPrompt: 'Você é o anfitrião virtual do imóvel Airbnb. Seja simpático, profissional e use emojis moderados. Ajude hóspedes com check-in, regras da casa e dicas locais. Responda em português brasileiro.',
        }
      : {
          agentId: 'agent-1',
          agentName: 'Recepcionista ZÉLLA',
          systemPrompt: 'Você é a recepcionista virtual da pousada. Seja simpática, profissional e use emojis moderados. Responda em português brasileiro.',
        };

    // Executamos todo o onboarding em uma única transação garantindo integridade
    const result = await db.$transaction(async (tx) => {
      // 1. Criar o Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          passwordChangedAt: new Date(),
          phone: data.phone,
          plan: 'lite',
          status: 'active',
          niche: data.niche,
          property: {
            create: {
              name: data.pousadaName,
              slug: data.pousadaName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''),
            },
          },
          agentConfigs: {
            create: {
              agentId: agentConfig.agentId,
              agentName: agentConfig.agentName,
              systemPrompt: agentConfig.systemPrompt,
              temperature: 0.7,
              isActive: true,
            },
          },
          apiConfigs: {
            create: {
              provider: 'groq',
              model: 'llama-3.3-70b-versatile',
              isActive: true,
              notes: 'Configuração padrão mock. Altere para provedor real quando disponível.',
            },
          },
          subscriptions: {
            create: {
              planType: 'lite',
              status: 'active',
              amount: 197,
              paymentMethod: 'pix',
            },
          },
        },
      });

      // 2. Criar os 8 KnowledgeEntry padrão de FAQ para o Tenant
      const faqs = [
        {
          question: 'Qual é a senha do Wi-Fi?',
          answer: 'A rede Wi-Fi é "Zehla_Guest" e a senha de acesso é "zehla2026".',
          category: 'geral',
        },
        {
          question: 'Qual o horário de check-in e check-out?',
          answer: 'O check-in inicia a partir das 14:00 e o check-out deve ser efetuado até as 12:00.',
          category: 'politicas',
        },
        {
          question: 'Qual o horário do café da manhã?',
          answer: 'O café da manhã é servido diariamente das 07:30 às 10:00.',
          category: 'servicos',
        },
        {
          question: 'Possui estacionamento?',
          answer: 'Sim, dispomos de estacionamento privativo e gratuito, sem necessidade de reserva prévia.',
          category: 'geral',
        },
        {
          question: 'Aceita animais de estimação?',
          answer: 'Aceitamos pets de pequeno porte mediante aviso prévio e taxa de higienização de R$ 50 por estadia.',
          category: 'politicas',
        },
        {
          question: 'Qual a política de cancelamento?',
          answer: 'O cancelamento é gratuito se realizado em até 7 dias antes da data de check-in programada.',
          category: 'politicas',
        },
        {
          question: 'Quais as formas de pagamento aceitas?',
          answer: 'Aceitamos pagamentos via PIX, cartões de crédito e débito (Visa, Mastercard, Elo).',
          category: 'financeiro',
        },
        {
          question: 'Qual a voltagem das tomadas?',
          answer: 'A voltagem padrão em todas as tomadas é 220V.',
          category: 'geral',
        },
      ];

      await tx.knowledgeEntry.createMany({
        data: faqs.map((faq) => ({
          tenantId: tenant.id,
          category: faq.category,
          question: faq.question,
          answer: faq.answer,
        })),
      });

      return { tenant };
    });

    return NextResponse.json({
      success: true,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        email: result.tenant.email,
        plan: result.tenant.plan,
        niche: (result.tenant as any).niche,
      },
      userId: result.tenant.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
