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
import crypto from 'crypto';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db as any),
  providers: [
    GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '', allowDangerousEmailAccountLinking: false }),
    CredentialsProvider({
      name: 'credentials',
      credentials: { email: { label: 'Login', type: 'text' }, password: { label: 'Senha', type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const cleanEmail = credentials.email.trim().toLowerCase();
          const cleanPassword = credentials.password.trim();

          // Master Admin / ZCC Built-in Access (123 / 123, zella@zella.com.br / 123, admin@seuzella.com.br / Admin@123 ou 123)
          if (
            (cleanEmail === '123' && cleanPassword === '123') ||
            (cleanEmail === 'zella@zella.com.br' && (cleanPassword === '123' || cleanPassword === 'Zella@123')) ||
            (cleanEmail === 'admin@seuzella.com.br' && (cleanPassword === 'Admin@123' || cleanPassword === '123')) ||
            (cleanEmail === 'admin@zehla.com.br' && (cleanPassword === 'Admin@123' || cleanPassword === '123'))
          ) {
            return {
              id: 'zcc-master-admin',
              email: cleanEmail === '123' ? 'admin@seuzella.com.br' : cleanEmail,
              name: 'Administrador ZCC',
              role: 'system_admin',
              tenantId: 'zcc-admin-tenant',
              plan: 'enterprise' as PlanTier,
              niche: 'pousada' as NicheType,
            };
          }

          // Demo Pousada Account
          if (cleanEmail === 'demo@pousada.com.br' && (cleanPassword === 'Demo@123' || cleanPassword === '123')) {
            return {
              id: 'demo-pousada-tenant',
              email: 'demo@pousada.com.br',
              name: 'Pousada Rosa Demo',
              role: 'owner',
              tenantId: 'demo-pousada',
              plan: 'pro' as PlanTier,
              niche: 'pousada' as NicheType,
            };
          }

          // Demo Airbnb Account
          if (cleanEmail === 'demo@airbnb.com.br' && (cleanPassword === 'Demo@123' || cleanPassword === '123')) {
            return {
              id: 'demo-airbnb-tenant',
              email: 'demo@airbnb.com.br',
              name: 'Airbnb Juquehy Demo',
              role: 'owner',
              tenantId: 'demo-airbnb',
              plan: 'pro' as PlanTier,
              niche: 'airbnb' as NicheType,
            };
          }

          if (await isDatabaseAvailable()) {
            const tenant = await db.tenant.findUnique({ where: { email: cleanEmail } });
            if (tenant?.passwordHash && (await bcrypt.compare(cleanPassword, tenant.passwordHash))) {
              if (tenant.status === 'active') {
                return {
                  id: tenant.id,
                  email: tenant.email,
                  name: tenant.name,
                  role: tenant.role || 'owner',
                  tenantId: tenant.id,
                  plan: migratePlanLegacy(tenant.plan),
                  niche: ((tenant as any).niche || 'pousada') as NicheType,
                };
              }
            }
          }
          return null;
        } catch (error) {
          console.error('[auth] authentication database failure', error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          if (!(await isDatabaseAvailable())) return false;
          const existingTenant = await db.tenant.findUnique({ where: { email: user.email } });
          if (!existingTenant) {
            const newTenant = await db.tenant.create({ data: { name: user.name || user.email.split('@')[0], email: user.email, plan: 'lite', status: 'active', niche: 'pousada' } });
            if (user.id) await db.user.update({ where: { id: user.id }, data: { tenant: { connect: { id: newTenant.id } } } });
          } else {
            if (existingTenant.status !== 'active') return false;
            if (user.id) {
              const existingUser = await db.user.findUnique({ where: { id: user.id } });
              if (existingUser && !existingUser.tenantId) await db.user.update({ where: { id: user.id }, data: { tenant: { connect: { id: existingTenant.id } } } });
            }
          }
          return true;
        } catch (error) { console.error('[auth] Google tenant provisioning failed', error); return false; }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) { token.tenantId = (user as any).tenantId; token.role = (user as any).role; token.plan = (user as any).plan; token.niche = (user as any).niche; }
      if (account?.provider === 'google' && user?.email) {
        try {
          const tenant = await db.tenant.findUnique({ where: { email: user.email } });
          if (tenant && tenant.status === 'active') { token.tenantId = tenant.id; token.role = tenant.role; token.plan = migratePlanLegacy(tenant.plan); token.niche = (tenant as any).niche || 'pousada'; }
        } catch (error) { console.error('[auth] Google JWT tenant lookup failed', error); }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) { (session.user as any).tenantId = (token as any).tenantId; (session.user as any).role = (token as any).role; (session.user as any).plan = (token as any).plan; (session.user as any).niche = (token as any).niche; }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try { if (new URL(url, baseUrl).origin === new URL(baseUrl).origin) return url; } catch {}
      return `${baseUrl}/ddc`;
    },
  },
  pages: { signIn: '/login', verifyRequest: '/login?mode=verify' },
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) { if (process.env.NEXT_PHASE?.includes('build')) return crypto.randomUUID(); throw new Error('NEXTAUTH_SECRET environment variable is required'); }
    return secret;
  })(),
  debug: process.env.NODE_ENV === 'development',
};

export async function requireTenant() {
  const session = await getServerSession(authOptions);
  const tenantId = (session?.user as any)?.tenantId;
  if (!session?.user || !tenantId) redirect('/login');
  return tenantId as string;
}

export function verifyRobotToken(req: Request) {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const configured = [process.env.ZEHLA_LOOP_API_KEY, process.env.ZAI_API_KEY].filter((v): v is string => !!v);
  if (!token || configured.length === 0) return false;
  return configured.some(expected => {
    const a = Buffer.from(token); const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}
