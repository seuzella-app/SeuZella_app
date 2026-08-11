/**
 * ZEHLA — Database Seed Script for 6 Beta Pousadas
 * Popula o banco com dados realistas da Pousada Serenity (client-001),
 * Pousada Demo e das 6 Pousadas Beta parceiras.
 *
 * EXECUÇÃO: bun prisma/seed-beta.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60), 0, 0);
  return d;
};

const minutesAgo = (n: number) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n, 0, 0);
  return d;
};

// Dados das 6 Pousadas Beta
const betaPousadas = [
  {
    id: 'beta-solemar-id',
    name: 'Pousada Sol e Mar',
    city: 'Ubatuba',
    state: 'SP',
    email: 'contato@pousadasolemar.com.br',
    phone: '12987654321',
    passwordText: 'Solemar@123',
    rooms: [
      { name: 'Suíte Vista Mar', type: 'suite', capacity: 2, price: 400, status: 'disponivel' },
      { name: 'Quarto Família Lateral', type: 'standard', capacity: 4, price: 300, status: 'disponivel' },
    ],
    faqs: [
      { category: 'policies', question: 'Qual o horário de check-in?', answer: 'Check-in a partir das 14h, checkout até 11h30.' },
      { category: 'amenities', question: 'Tem estacionamento?', answer: 'Temos estacionamento rotativo gratuito no local.' },
      { category: 'food', question: 'Tem almoço no local?', answer: 'Servimos petiscos e porções no deck da praia sob demanda até as 18h.' }
    ]
  },
  {
    id: 'beta-recanto-id',
    name: 'Pousada Recanto da Serra',
    city: 'Monte Verde',
    state: 'MG',
    email: 'contato@recantodaserra.com.br',
    phone: '35987654321',
    passwordText: 'Recanto@123',
    rooms: [
      { name: 'Chalé Master com Hidro', type: 'chale', capacity: 2, price: 650, status: 'disponivel' },
      { name: 'Chalé Standard Lareira', type: 'chale', capacity: 2, price: 450, status: 'disponivel' },
    ],
    faqs: [
      { category: 'policies', question: 'Como funciona a lareira?', answer: 'Fornecemos um cesto de lenha por dia gratuitamente. Cestas extras custam R$ 25.' },
      { category: 'amenities', question: 'Aceitam pet?', answer: 'Aceitamos pets de pequeno porte apenas nos chalés standard mediante taxa de R$ 50/diária.' }
    ]
  },
  {
    id: 'beta-casapraia-id',
    name: 'Pousada Casa da Praia',
    city: 'Florianópolis',
    state: 'SC',
    email: 'contato@casadapraia.com.br',
    phone: '48987654321',
    passwordText: 'Casapraia@123',
    rooms: [
      { name: 'Suíte Ocean Premium', type: 'suite', capacity: 2, price: 550, status: 'disponivel' },
      { name: 'Quarto Superior Casal', type: 'standard', capacity: 2, price: 320, status: 'disponivel' },
    ],
    faqs: [
      { category: 'policies', question: 'Fornecem guarda-sol e cadeiras?', answer: 'Sim, fornecemos gratuitamente cadeiras e guarda-sol para uso na praia da Joaquina.' },
      { category: 'food', question: 'Como funciona o café da manhã?', answer: 'O café da manhã é servido das 8h às 10h30 com opções sem glúten e sem lactose.' }
    ]
  },
  {
    id: 'beta-chale-id',
    name: 'Chalé Boutique',
    city: 'Gramado',
    state: 'RS',
    email: 'contato@chaleboutique.com.br',
    phone: '54987654321',
    passwordText: 'Chale@123',
    rooms: [
      { name: 'Cabana Alpina A-Frame', type: 'chale', capacity: 2, price: 800, status: 'disponivel' },
      { name: 'Chalé Suíço Família', type: 'chale', capacity: 5, price: 1200, status: 'disponivel' },
    ],
    faqs: [
      { category: 'policies', question: 'O aquecimento está incluso?', answer: 'Sim, todas as cabanas possuem calefação e ar-condicionado quente/frio inclusos.' },
      { category: 'amenities', question: 'Tem adega no quarto?', answer: 'Sim, dispomos de uma mini-adega climatizada com vinhos da Serra Gaúcha pagos sob consumo.' }
    ]
  },
  {
    id: 'beta-vilaverde-id',
    name: 'Pousada Vila Verde',
    city: 'Jericoacoara',
    state: 'CE',
    email: 'contato@pousadavilaverde.com.br',
    phone: '88987654321',
    passwordText: 'Vilaverde@123',
    rooms: [
      { name: 'Bangalô Jardim Central', type: 'chale', capacity: 3, price: 480, status: 'disponivel' },
      { name: 'Suíte Standard Piscina', type: 'suite', capacity: 2, price: 380, status: 'disponivel' },
    ],
    faqs: [
      { category: 'location', question: 'Fica longe da Duna do Pôr do Sol?', answer: 'Estamos a apenas 10 minutos a pé da Duna do Pôr do Sol e do centro da Vila.' },
      { category: 'policies', question: 'Têm serviço de transfer?', answer: 'Indicamos cooperativas credenciadas de UTV/Hilux 4x4 a partir de Jijoca. Consulte recepção.' }
    ]
  },
  {
    id: 'beta-refugio-id',
    name: 'Pousada Refúgio Tropical',
    city: 'Paraty',
    state: 'RJ',
    email: 'contato@refugiotropical.com.br',
    phone: '24987654321',
    passwordText: 'Refugio@123',
    rooms: [
      { name: 'Suíte Real Imperial', type: 'suite', capacity: 2, price: 500, status: 'disponivel' },
      { name: 'Apartamento Jardim Familiar', type: 'standard', capacity: 4, price: 380, status: 'disponivel' },
    ],
    faqs: [
      { category: 'amenities', question: 'A piscina é aquecida?', answer: 'Nossa piscina externa não é aquecida, mas temos uma jacuzzi térmica integrada ao spa.' },
      { category: 'policies', question: 'Como funciona o check-in tardio?', answer: 'Nossa portaria funciona 24 horas. Check-ins após a meia-noite devem ser notificados previamente.' }
    ]
  }
];

async function main() {
  console.log('🧹 Limpando dados antigos do banco para o Seed Beta...');
  await prisma.feedback.deleteMany({});
  await prisma.performanceSnapshot.deleteMany({});
  await prisma.quickAction.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.trainingPrompt.deleteMany({});
  await prisma.knowledgeEntry.deleteMany({});
  await prisma.conversationMessage.deleteMany({});
  await prisma.conversationLog.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.guest.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 1. Criar Tenant Principal de demonstração (Pousada Serenity)
  console.log('1. Criando Tenant Principal Pousada Serenity (client-001)...');
  const serenityPassword = await bcrypt.hash('zehla2024', 12);
  const serenityTenant = await prisma.tenant.create({
    data: {
      id: 'client-001',
      name: 'Pousada Serenity',
      email: 'contato@pousadaserenity.com.br',
      passwordHash: serenityPassword,
      phone: '11987654321',
      phoneAlt: '11987654321',
      plan: 'max',
      status: 'active',
      role: 'owner',
      property: {
        create: {
          name: 'Pousada Serenity',
          slug: 'pousadaserenity',
          type: 'pousada',
          city: 'Paraty',
          state: 'RJ',
          pixKey: 'contato@pousadaserenity.com.br',
          pixKeyType: 'email',
          description: 'Um refúgio tranquilo e acolhedor em Paraty.',
        }
      },
      agentConfigs: {
        create: {
          agentId: 'agent-1',
          agentName: 'Recepcionista ZÉLLA',
          systemPrompt: 'Você é a recepcionista virtual da Pousada Serenity. Seja simpática e atenciosa.',
          temperature: 0.7,
        }
      },
      apiConfigs: {
        create: {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          isActive: true,
        }
      },
      subscriptions: {
        create: {
          planType: 'max',
          status: 'active',
          amount: 697.00,
          paymentMethod: 'pix',
        }
      }
    }
  });

  await prisma.user.create({
    data: {
      email: 'contato@pousadaserenity.com.br',
      name: 'Proprietário Serenity',
    }
  });

  // 2. Criar os 6 Tenants Beta
  console.log('2. Criando 6 Tenants Beta parceiros...');
  for (const bp of betaPousadas) {
    const hashedPass = await bcrypt.hash(bp.passwordText, 12);
    const tenant = await prisma.tenant.create({
      data: {
        id: bp.id,
        name: bp.name,
        email: bp.email,
        passwordHash: hashedPass,
        phone: bp.phone,
        phoneAlt: bp.phone,
        plan: 'pro',
        status: 'active',
        role: 'owner',
        property: {
          create: {
            name: bp.name,
            slug: bp.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''),
            type: 'pousada',
            city: bp.city,
            state: bp.state,
            pixKey: bp.email,
            pixKeyType: 'email',
            description: `Aconchegante estabelecimento em ${bp.city} - ${bp.state}.`,
            rooms: {
              create: bp.rooms.map(r => ({
                name: r.name,
                type: r.type,
                capacity: r.capacity,
                price: r.price,
                status: r.status,
              }))
            }
          }
        },
        agentConfigs: {
          create: {
            agentId: 'agent-1',
            agentName: `Recepcionista AI - ${bp.name}`,
            systemPrompt: `Você é a recepcionista virtual de ${bp.name}. Responda de forma atenciosa em português brasileiro.`,
            temperature: 0.7,
          }
        },
        apiConfigs: {
          create: {
            provider: 'groq',
            model: 'llama-3.3-70b-versatile',
            isActive: true,
          }
        },
        subscriptions: {
          create: {
            planType: 'pro',
            status: 'active',
            amount: 397.00,
            paymentMethod: 'pix',
          }
        }
      }
    });

    // Criar User NextAuth
    await prisma.user.create({
      data: {
        email: bp.email,
        name: `Proprietário ${bp.name}`,
      }
    });

    // Inserir FAQs
    await prisma.knowledgeEntry.createMany({
      data: bp.faqs.map(f => ({
        tenantId: tenant.id,
        category: f.category,
        question: f.question,
        answer: f.answer,
      }))
    });

    // Inserir Calendar Syncs Mock para teste de integração iCal
    const createdRooms = await prisma.room.findMany({
      where: { property: { tenantId: tenant.id } }
    });

    for (const r of createdRooms) {
      await prisma.calendarSync.createMany({
        data: [
          {
            tenantId: tenant.id,
            roomId: r.id,
            otaName: 'airbnb',
            syncUrl: `https://www.airbnb.com.br/calendar/ical/${r.id}.ics`,
            syncToken: crypto.randomUUID().replace(/-/g, ''),
            status: 'active'
          },
          {
            tenantId: tenant.id,
            roomId: r.id,
            otaName: 'booking',
            syncUrl: `https://ical.booking.com/v1/sync?id=${r.id}`,
            syncToken: crypto.randomUUID().replace(/-/g, ''),
            status: 'active'
          }
        ]
      });
    }

    // Inserir FAQs comuns genéricas
    await prisma.knowledgeEntry.createMany({
      data: [
        { tenantId: tenant.id, category: 'policies', question: 'Qual a voltagem das tomadas?', answer: 'A voltagem padrão no local é 110V. Dispomos de transformadores na recepção sob solicitação.' },
        { tenantId: tenant.id, category: 'amenities', question: 'Tem Wi-Fi gratuito?', answer: 'Sim, a rede Wi-Fi é gratuita e cobre todas as áreas comuns e quartos.' }
      ]
    });

    // Criar hóspedes, conversas e feedbacks fictícios para cada pousada
    const guestNames = ['Bernardo Silva', 'Juliana Lima', 'Felipe Santos'];
    const guestPhones = [`${bp.phone.substring(0, bp.phone.length - 1)}1`, `${bp.phone.substring(0, bp.phone.length - 1)}2`, `${bp.phone.substring(0, bp.phone.length - 1)}3`];

    for (let k = 0; k < guestNames.length; k++) {
      const guest = await prisma.guest.create({
        data: {
          tenantId: tenant.id,
          name: guestNames[k],
          phone: guestPhones[k],
          status: k === 0 ? 'booked' : k === 1 ? 'hot' : 'warm',
          source: 'whatsapp',
          conversationCount: 1,
        }
      });

      const conversation = await prisma.conversationLog.create({
        data: {
          tenantId: tenant.id,
          guestId: guest.id,
          guestName: guest.name,
          guestPhone: guest.phone || '',
          status: 'active',
          aiConfidence: 90,
        }
      });

      const guestMsg = await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          from: 'guest',
          content: 'Olá! Gostaria de fazer uma pergunta sobre reservas.',
          timestamp: daysAgo(1),
        }
      });

      const aiMsg = await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          from: 'ai',
          content: `Olá, ${guest.name}! Sou a recepcionista virtual de ${bp.name}. Como posso te ajudar hoje?`,
          timestamp: daysAgo(1),
        }
      });

      // Criar feedbacks variados
      await prisma.feedback.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          messageId: aiMsg.id,
          rating: 4 + (k % 2), // 4 ou 5 estrelas
          notes: k === 0 ? 'IA educada e rápida' : 'Respondeu bem às regras',
          source: 'ddc',
        }
      });

      // Criar reservas (Bookings) para o hóspede booked
      if (k === 0) {
        const roomObj = await prisma.room.findFirst({
          where: {
            name: bp.rooms[0].name,
            property: { tenantId: tenant.id }
          }
        });

        await prisma.booking.create({
          data: {
            tenantId: tenant.id,
            guestId: guest.id,
            guestName: guest.name,
            roomName: bp.rooms[0].name,
            roomId: roomObj?.id ?? null,
            checkIn: daysAgo(-2),
            checkOut: daysAgo(2),
            nights: 4,
            guests: 2,
            totalValue: bp.rooms[0].price * 4,
            status: 'confirmed',
            paymentMethod: 'pix',
            paymentStatus: 'paid',
            source: 'whatsapp_ai',
            aiGenerated: true,
            metadata: '{}',
          }
        });
      }
    }
  }

  // 3. Criar Demo Tenant original (`demo-tenant-id`)
  console.log('3. Criando Tenant de demonstração (Pousada Paraíso Demo)...');
  const demoPassword = await bcrypt.hash('Demo@123', 12);
  await prisma.tenant.create({
    data: {
      id: 'demo-tenant-id',
      name: 'Pousada Paraíso Demo',
      email: 'demo@pousada.com.br',
      passwordHash: demoPassword,
      phone: '11999999999',
      phoneAlt: '11999999999',
      plan: 'pro',
      status: 'active',
      role: 'owner',
      property: {
        create: {
          name: 'Pousada Paraíso Demo',
          slug: 'pousadaparaisodemo',
          type: 'pousada',
          city: 'Paraty',
          state: 'RJ',
          pixKey: 'demo@pousada.com.br',
          pixKeyType: 'email',
          rooms: {
            create: [
              { name: 'Suíte Master', type: 'suite', capacity: 2, price: 350, status: 'disponivel' },
              { name: 'Quarto Standard', type: 'standard', capacity: 2, price: 200, status: 'disponivel' },
              { name: 'Chalé Luxo', type: 'chale', capacity: 4, price: 500, status: 'disponivel' },
            ],
          },
        },
      },
      agentConfigs: {
        create: {
          agentId: 'agent-1',
          agentName: 'Recepcionista Demo',
          systemPrompt: 'Você é a recepcionista virtual da Pousada Paraíso.',
          temperature: 0.7,
        }
      },
      apiConfigs: {
        create: {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          isActive: true,
        }
      },
      subscriptions: {
        create: {
          planType: 'pro',
          status: 'active',
          amount: 397.00,
          paymentMethod: 'pix',
        }
      }
    }
  });

  await prisma.user.create({
    data: {
      email: 'demo@pousada.com.br',
      name: 'Proprietário Demo',
    }
  });

  console.log('\n✅ Seed Beta completo! Banco populado com 8 Tenants de forma atômica e consistente.');
}

main()
  .catch((e) => {
    console.error('❌ Seed Beta failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
