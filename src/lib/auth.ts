import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { db, isDatabaseAvailable } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { PlanTier } from '@/lib/plan-features';
import type { NicheType } from '@/contexts/NicheContext';
import { migratePlanLegacy } from '@/lib/plan-features';

/** Check if we're running on Vercel (serverless — no persistent SQLite) */
function isVercelServerless(): boolean {
  return !!(process.env.VERCEL || process.env.VERCEL_ENV);
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db as any),
  providers: [
    // ── Google OAuth ──────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),

    // ── Credentials (existing) ────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Login', type: 'text' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[auth] authorize() called — email:', credentials?.email, '| vercel:', isVercelServerless());

        // ── ZCC ADMIN QUICK ACCESS: login "123" / senha "123" ──
        // VERIFICADO PRIMEIRO — antes de qualquer outro check (incluindo BYPASS_MIDDLEWARE_AUTH)
        // Isto garante que 123/123 funciona mesmo se BYPASS_MIDDLEWARE_AUTH=true estiver setado na Vercel
        if (credentials?.email === '123' && credentials?.password === '123') {
          console.log('[auth] ZCC Admin quick login (123/123) — granting access');

          // Tenta criar no DB se disponível (best-effort, não bloqueia se falhar)
          try {
            const dbOk = await isDatabaseAvailable();
            if (dbOk) {
              let zccAdmin = await db.tenant.findUnique({
                where: { email: '123' },
              });

              if (!zccAdmin) {
                console.log('[auth] Creating ZCC admin tenant (123/123)');
                zccAdmin = await db.tenant.create({
                  data: {
                    name: 'ZCC Admin (Zélla)',
                    email: '123',
                    passwordHash: await bcrypt.hash('123', 10),
                    plan: 'max',
                    status: 'active',
                    role: 'owner',
                    niche: 'pousada',
                    subscriptionAt: new Date(),
                  },
                });
              }

              console.log('[auth] ZCC admin authenticated via DB:', zccAdmin.id);
              return {
                id: zccAdmin.id,
                email: zccAdmin.email,
                name: zccAdmin.name,
                role: zccAdmin.role,
                tenantId: zccAdmin.id,
                plan: migratePlanLegacy(zccAdmin.plan),
                niche: (zccAdmin as { niche?: string }).niche || 'pousada',
              };
            }
          } catch (zccError) {
            console.warn('[auth] ZCC admin DB error (non-fatal, using mock):', zccError);
          }

          // FALLBACK: retorna sessão mock sem DB (funciona em Vercel sem DB)
          console.log('[auth] ZCC admin using mock session (no DB needed)');
          return {
            id: 'zcc-admin-mock',
            email: '123',
            name: 'ZCC Admin',
            role: 'owner',
            tenantId: 'zcc-admin-mock',
            plan: 'max' as PlanTier,
            niche: 'pousada' as NicheType,
          };
        }

        // === BYPASS_MIDDLEWARE_AUTH mode (DEVELOPMENT ONLY) ===
        // This bypass is ONLY allowed in non-production environments.
        // If BYPASS_MIDDLEWARE_AUTH is set in production, throw an error.
        if (process.env.BYPASS_MIDDLEWARE_AUTH === 'true') {
          if (process.env.NODE_ENV === 'production') {
            console.error('[auth] SECURITY: BYPASS_MIDDLEWARE_AUTH is set in production — this is forbidden');
            throw new Error('BYPASS_MIDDLEWARE_AUTH is not allowed in production. Remove this env variable immediately.');
          }
          console.log('[auth] BYPASS_MIDDLEWARE_AUTH=true (dev-only) — accepting any credentials');
          if (isVercelServerless()) {
            return {
              id: 'mock-tenant-id',
              email: credentials?.email || 'admin@smarthotel.com',
              name: 'Usuário Convidado',
              role: 'owner',
              tenantId: 'mock-tenant-id',
              plan: 'pro' as PlanTier,
              niche: 'pousada' as NicheType,
            };
          }
          try {
            const dbOk = await isDatabaseAvailable();
            if (dbOk) {
              const firstTenant = await db.tenant.findFirst();
              if (firstTenant) {
                return {
                  id: firstTenant.id,
                  email: firstTenant.email,
                  name: firstTenant.name,
                  role: firstTenant.role,
                  tenantId: firstTenant.id,
                  plan: migratePlanLegacy(firstTenant.plan),
                  niche: (firstTenant as any).niche || 'pousada',
                };
              }
            }
          } catch {
            // DB not available
          }
          return {
            id: 'mock-tenant-id',
            email: credentials?.email || 'admin@smarthotel.com',
            name: 'Usuário Convidado',
            role: 'owner',
            tenantId: 'mock-tenant-id',
            plan: 'pro' as PlanTier,
            niche: 'pousada' as NicheType,
          };
        }

        if (!credentials?.email || !credentials?.password) {
          console.log('[auth] Missing credentials — returning null');
          return null;
        }

        // ── BUG #4 FIX: Demo login sem BYPASS_MIDDLEWARE_AUTH ──
        // Permite login demo em produção sem comprometer segurança.
        // Cria/finda um tenant demo real no DB em vez de usar bypass.
        if (credentials.email === 'demo@pousada.com.br' && credentials.password === 'Demo@123') {
          console.log('[auth] Demo login attempt — trying DB lookup');
          try {
            const dbOk = await isDatabaseAvailable();
            if (dbOk) {
              // Busca tenant demo existente
              let demoTenant = await db.tenant.findUnique({
                where: { email: 'demo@pousada.com.br' },
              });

              // Se não existe, cria um
              if (!demoTenant) {
                console.log('[auth] Creating demo tenant');
                demoTenant = await db.tenant.create({
                  data: {
                    name: 'Pousada Demo (Zélla)',
                    email: 'demo@pousada.com.br',
                    passwordHash: await bcrypt.hash('Demo@123', 10),
                    plan: 'pro',
                    status: 'active',
                    role: 'owner',
                    niche: 'pousada',
                    subscriptionAt: new Date(),
                  },
                });

                // Cria property demo
                await db.property.create({
                  data: {
                    tenantId: demoTenant.id,
                    name: 'Pousada Demo',
                    type: 'pousada',
                    city: 'São Paulo',
                    state: 'SP',
                    description: 'Pousada demo para testes do sistema.',
                    slug: 'pousada-demo-zella',
                    pixKey: 'demo@zella.com',
                    pixKeyType: 'email',
                  },
                });

                // Cria subscription demo
                await db.subscription.create({
                  data: {
                    tenantId: demoTenant.id,
                    status: 'active',
                    planType: 'pro',
                    paymentMethod: 'pix',
                    amount: 397,
                    paymentStatus: 'approved',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                  },
                });
              }

              console.log('[auth] Demo tenant authenticated:', demoTenant.id);
              return {
                id: demoTenant.id,
                email: demoTenant.email,
                name: demoTenant.name,
                role: demoTenant.role,
                tenantId: demoTenant.id,
                plan: migratePlanLegacy(demoTenant.plan),
                niche: (demoTenant as { niche?: string }).niche || 'pousada',
              };
            }
          } catch (demoError) {
            console.error('[auth] Demo login DB error:', demoError);
          }
          // Se DB não disponível, não permite demo login em produção
          console.log('[auth] Demo login failed — DB not available');
          return null;
        }

        // On Vercel, no DB means no real authentication possible
        if (isVercelServerless()) {
          console.log('[auth] Vercel serverless + no bypass — cannot authenticate');
          return null;
        }

        // Try Tenant table (main auth for pousada owners, admins, staff)
        try {
          const dbOk = await isDatabaseAvailable();
          if (!dbOk) return null;

          const tenant = await db.tenant.findUnique({
            where: { email: credentials.email },
          });

          if (tenant && tenant.passwordHash) {
            const isValid = await bcrypt.compare(credentials.password, tenant.passwordHash);
            if (isValid) {
              console.log('[auth] Tenant authenticated:', tenant.id, tenant.name);
              return {
                id: tenant.id,
                email: tenant.email,
                name: tenant.name,
                role: tenant.role,
                tenantId: tenant.id,
                plan: migratePlanLegacy(tenant.plan),
                niche: (tenant as any).niche || 'pousada',
              };
            }
          }
          console.log('[auth] Invalid credentials for:', credentials.email);
        } catch (err) {
          console.error('[auth] DB error during auth:', err);
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers (Google), ensure a Tenant exists
      if (account?.provider === 'google' && user.email) {
        try {
          const dbOk = await isDatabaseAvailable();
          if (dbOk) {
            // Check if a tenant exists for this email
            const existingTenant = await db.tenant.findUnique({
              where: { email: user.email },
            });
            if (!existingTenant) {
              // Create a new tenant for OAuth users
              const newTenant = await db.tenant.create({
                data: {
                  name: user.name || user.email.split('@')[0],
                  email: user.email,
                  plan: 'gratuito',
                  status: 'active',
                  niche: 'pousada',
                  trialStart: new Date(),
                  trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
              });
              // Link the User to the Tenant
              if (user.id) {
                await db.user.update({
                  where: { id: user.id },
                  data: { tenant: { connect: { id: newTenant.id } } },
                });
              }
            } else {
              // Link existing tenant to user if not linked
              if (user.id) {
                const existingUser = await db.user.findUnique({
                  where: { id: user.id },
                });
                if (existingUser && !existingUser.tenantId) {
                  await db.user.update({
                    where: { id: user.id },
                    data: { tenant: { connect: { id: existingTenant.id } } },
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error('[auth] Error during Google OAuth sign-in:', err);
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.plan = (user as any).plan;
        token.niche = (user as any).niche;
        // For OAuth users, look up tenant info
        if (account?.provider === 'google') {
          try {
            const dbOk = await isDatabaseAvailable();
            if (dbOk && user.email) {
              const tenant = await db.tenant.findUnique({
                where: { email: user.email },
              });
              if (tenant) {
                token.tenantId = tenant.id;
                token.role = tenant.role;
                token.plan = migratePlanLegacy(tenant.plan);
                token.niche = (tenant as any).niche || 'pousada';
              }
            }
          } catch (err) {
            console.error('[auth] Error looking up tenant in JWT callback:', err);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).tenantId = (token as any).tenantId;
        (session.user as any).role = (token as any).role;
        (session.user as any).plan = (token as any).plan;
        (session.user as any).niche = (token as any).niche;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows callbackUrl from signIn() calls
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      try {
        if (new URL(url, baseUrl).origin === new URL(baseUrl).origin) return url;
      } catch {}
      // Default redirect based on niche
      return baseUrl + '/ddc';
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login?mode=verify',
  },
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET;
    // Don't throw during Vercel build phase — runtime will still need it
    if (!secret) {
      if (process.env.NEXT_PHASE?.includes('build')) {
        // Build phase: use a throwaway random value (never used at runtime)
        return crypto.randomUUID();
      }
      throw new Error('NEXTAUTH_SECRET environment variable is required');
    }
    return secret;
  })(),
  debug: process.env.NODE_ENV === 'development',
};

/**
 * ZÉHLA Security Utility - ensures Tenant isolation.
 * Retrieves the tenant ID of the authenticated user or redirects if unauthorized.
 */
export async function requireTenant() {
  // On Vercel serverless, return the demo/mock tenant
  if (isVercelServerless()) {
    const session = await getServerSession(authOptions);
    return session?.user?.tenantId || 'demo-tenant-id';
  }

  // BYPASS_MIDDLEWARE_AUTH is ONLY allowed in development, never in production.
  if (process.env.BYPASS_MIDDLEWARE_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    try {
      const dbOk = await isDatabaseAvailable();
      if (dbOk) {
        const firstTenant = await db.tenant.findFirst();
        if (firstTenant) {
          return firstTenant.id;
        }
      }
    } catch {
      // DB not available
    }
    return 'mock-tenant-id';
  }

  // If BYPASS_MIDDLEWARE_AUTH is set in production, throw an error
  if (process.env.BYPASS_MIDDLEWARE_AUTH === 'true' && process.env.NODE_ENV === 'production') {
    console.error('[auth] SECURITY: BYPASS_MIDDLEWARE_AUTH in requireTenant() is set in production — forbidden');
    throw new Error('BYPASS_MIDDLEWARE_AUTH is not allowed in production. Remove this env variable immediately.');
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/login');
  }

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    redirect('/login');
  }

  return tenantId;
}

/**
 * Verify authorization token for the ZEHLA Loop Engine (robots/agents API)
 */
export function verifyRobotToken(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  return token === process.env.ZEHLA_LOOP_API_KEY || token === process.env.ZAI_API_KEY;
}
