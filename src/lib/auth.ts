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

function isVercelServerless(): boolean { return !!(process.env.VERCEL || process.env.VERCEL_ENV); }

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db as any),
  providers: [
    GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '', allowDangerousEmailAccountLinking: false }),
    CredentialsProvider({
      name: 'credentials',
      credentials: { email: { label: 'Login', type: 'text' }, password: { label: 'Senha', type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const isDev = process.env.NODE_ENV !== 'production';

        if (isDev && credentials.email === '123' && credentials.password === '123') {
          try {
            if (await isDatabaseAvailable()) {
              let tenant = await db.tenant.findUnique({ where: { email: '123' } });
              if (!tenant) tenant = await db.tenant.create({ data: { name: 'ZCC Admin (Zélla)', email: '123', passwordHash: await bcrypt.hash('123', 10), plan: 'max', status: 'active', role: 'owner', niche: 'pousada', subscriptionAt: new Date() } });
              return { id: tenant.id, email: tenant.email, name: tenant.name, role: tenant.role, tenantId: tenant.id, plan: migratePlanLegacy(tenant.plan), niche: (tenant as any).niche || 'pousada' };
            }
          } catch (error) { console.warn('[auth] dev quick-login DB unavailable', error); }
          return { id: 'zcc-admin-mock', email: '123', name: 'ZCC Admin', role: 'owner', tenantId: 'zcc-admin-mock', plan: 'max' as PlanTier, niche: 'pousada' as NicheType };
        }

        if (isDev && process.env.BYPASS_MIDDLEWARE_AUTH === 'true') {
          const isAirbnb = credentials.email.includes('airbnb');
          return { id: isAirbnb ? 'demo-airbnb-tenant-id' : 'demo-pousada-tenant-id', email: credentials.email, name: isAirbnb ? 'Airbnb Demo (Zélla)' : 'Pousada Demo (Zélla)', role: 'owner', tenantId: isAirbnb ? 'demo-airbnb-tenant-id' : 'demo-pousada-tenant-id', plan: 'pro' as PlanTier, niche: (isAirbnb ? 'airbnb' : 'pousada') as NicheType };
        }

        if (isDev) {
          const demoPousada = ['demo@pousada.com.br', 'pousada@zehla.com.br'].includes(credentials.email);
          const demoAirbnb = ['demo@airbnb.com.br', 'airbnb@zehla.com.br'].includes(credentials.email);
          const demoZella = credentials.email === 'zella@zella.com.br';
          const validDemoPassword = ['Demo@123', '123'].includes(credentials.password);
          if ((demoPousada || demoAirbnb || demoZella) && validDemoPassword) {
            const niche: NicheType = demoAirbnb ? 'airbnb' : 'pousada';
            const tenantId = demoAirbnb ? 'demo-airbnb-tenant-id' : 'demo-pousada-tenant-id';
            return { id: tenantId, email: credentials.email, name: demoAirbnb ? 'Airbnb Demo' : 'Pousada Demo', role: 'owner', tenantId, plan: 'pro' as PlanTier, niche };
          }
        }

        try {
          if (!(await isDatabaseAvailable())) return null;
          const tenant = await db.tenant.findUnique({ where: { email: credentials.email } });
          if (!tenant?.passwordHash || !(await bcrypt.compare(credentials.password, tenant.passwordHash))) return null;
          return { id: tenant.id, email: tenant.email, name: tenant.name, role: tenant.role, tenantId: tenant.id, plan: migratePlanLegacy(tenant.plan), niche: (tenant as any).niche || 'pousada' };
        } catch (error) { console.error('[auth] authentication database failure', error); return null; }
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
          } else if (user.id) {
            const existingUser = await db.user.findUnique({ where: { id: user.id } });
            if (existingUser && !existingUser.tenantId) await db.user.update({ where: { id: user.id }, data: { tenant: { connect: { id: existingTenant.id } } } });
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
          if (tenant) { token.tenantId = tenant.id; token.role = tenant.role; token.plan = migratePlanLegacy(tenant.plan); token.niche = (tenant as any).niche || 'pousada'; }
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
  if (process.env.NODE_ENV === 'production') {
    if (!session?.user || !(session.user as any).tenantId) redirect('/login');
    return (session.user as any).tenantId;
  }
  if (session?.user && (session.user as any).tenantId) return (session.user as any).tenantId;
  if (process.env.BYPASS_MIDDLEWARE_AUTH === 'true') return 'demo-pousada-tenant-id';
  if (isVercelServerless()) return 'demo-tenant-id';
  redirect('/login');
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
