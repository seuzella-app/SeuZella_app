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

function getConfiguredMasterCredentials() {
  const email = process.env.ZEHLA_MASTER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ZEHLA_MASTER_ADMIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

function isConfiguredZccAdmin(email: string) {
  return (process.env.ZCC_ADMIN_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

const googleAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
);

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db as any),
  providers: [
    ...(googleAuthConfigured ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    })] : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: { email: { label: 'Login', type: 'email' }, password: { label: 'Senha', type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const cleanEmail = credentials.email.trim().toLowerCase();
          const {password} = credentials;
          const master = getConfiguredMasterCredentials();
          if (master && cleanEmail === master.email && password === master.password) {
            return {
              id: 'zcc-master-admin', email: master.email, name: 'Administrador ZCC',
              role: 'system_admin', tenantId: 'zcc-admin-tenant', plan: 'enterprise' as PlanTier,
              niche: 'pousada' as NicheType,
            };
          }
          if (await isDatabaseAvailable()) {
            const tenant = await db.tenant.findUnique({ where: { email: cleanEmail } });
            if (tenant?.passwordHash && (await bcrypt.compare(password, tenant.passwordHash)) && tenant.status === 'active') {
              return {
                id: tenant.id, email: tenant.email, name: tenant.name,
                role: isConfiguredZccAdmin(cleanEmail) ? 'system_admin' : (tenant.role || 'owner'),
                tenantId: tenant.id, plan: migratePlanLegacy(tenant.plan),
                niche: ((tenant as any).niche || 'pousada') as NicheType,
              };
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
          const cleanEmail = user.email.trim().toLowerCase();
          const existingTenant = await db.tenant.findUnique({ where: { email: cleanEmail } });
          if (!existingTenant) {
            const newTenant = await db.tenant.create({ data: { name: user.name || cleanEmail.split('@')[0], email: cleanEmail, plan: 'lite', status: 'active', niche: 'pousada' } });
            if (user.id) await db.user.update({ where: { id: user.id }, data: { tenant: { connect: { id: newTenant.id } } } });
          } else {
            if (existingTenant.status !== 'active') return false;
            // The email is the tenant identity for Google provisioning. If the
            // adapter user already points elsewhere, repair the binding before
            // issuing a JWT so a stale account cannot carry another tenantId.
            if (user.id) {
              const existingUser = await db.user.findUnique({ where: { id: user.id } });
              if (existingUser && existingUser.tenantId !== existingTenant.id) {
                await db.user.update({ where: { id: user.id }, data: { tenant: { connect: { id: existingTenant.id } } } });
              }
            }
          }
          return true;
        } catch (error) { console.error('[auth] Google tenant provisioning failed', error); return false; }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.jti = (token.jti as string) || crypto.randomUUID();
        token.authTime = Math.floor(Date.now() / 1000);
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.plan = (user as any).plan;
        token.niche = (user as any).niche;
      }
      if (account?.provider === 'google' && user?.email) {
        try {
          if (!token.jti) token.jti = crypto.randomUUID();
          token.authTime = token.authTime || Math.floor(Date.now() / 1000);
          const tenant = await db.tenant.findUnique({ where: { email: user.email.trim().toLowerCase() } });
          if (tenant && tenant.status === 'active') {
            token.tenantId = tenant.id;
            token.role = isConfiguredZccAdmin(user.email.toLowerCase()) ? 'system_admin' : tenant.role;
            token.plan = migratePlanLegacy(tenant.plan); token.niche = (tenant as any).niche || 'pousada';
          }
        } catch (error) { console.error('[auth] Google JWT tenant lookup failed', error); }
      }
      return token;
    },
    async session({ session, token }) {
      const jti = (token as any).jti as string | undefined;
      const tenantId = (token as any).tenantId as string | undefined;
      const authTime = (token as any).authTime as number | undefined;

      // ── M-AUTH-002: Invalidação de sessões revogadas (RevokedSession) ──
      if (jti && (await isSessionTokenRevoked(jti))) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() } as any;
      }

      // ── M-AUTH-004 & M-AUTH-005: Revalidação de tenant.status e passwordChangedAt ──
      if (tenantId && tenantId !== 'zcc-admin-tenant' && (await isDatabaseAvailable())) {
        try {
          const tenant = await db.tenant.findUnique({
            where: { id: tenantId },
            select: { status: true, passwordChangedAt: true },
          });

          // Invalida sessão se tenant suspenso/inativo
          if (!tenant || tenant.status !== 'active') {
            return { ...session, user: undefined, expires: new Date(0).toISOString() } as any;
          }

          // Invalida sessão se senha alterada após emissão do token
          if (tenant.passwordChangedAt && authTime) {
            const passwordChangedSec = Math.floor(tenant.passwordChangedAt.getTime() / 1000);
            if (passwordChangedSec > authTime) {
              return { ...session, user: undefined, expires: new Date(0).toISOString() } as any;
            }
          }
        } catch (err) {
          console.error('[auth] session tenant status check failed', err);
        }
      }

      if (session.user) {
        (session.user as any).jti = jti;
        (session.user as any).tenantId = (token as any).tenantId;
        (session.user as any).role = (token as any).role;
        (session.user as any).plan = (token as any).plan;
        (session.user as any).niche = (token as any).niche;
      }
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

/**
 * Invalidate/Revoke a specific session by jti.
 */
export async function revokeSessionToken(jti: string, expiresAt: Date, tenantId?: string, reason?: string) {
  if (!jti || !(await isDatabaseAvailable())) return;
  try {
    await db.revokedSession.upsert({
      where: { jti },
      update: { revokedAt: new Date(), reason },
      create: { jti, tenantId, reason, expiresAt },
    });
  } catch (err) {
    console.error('[auth] failed to revoke session token', err);
  }
}

/**
 * Check whether a session token (jti) has been revoked.
 */
export async function isSessionTokenRevoked(jti: string): Promise<boolean> {
  if (!jti || !(await isDatabaseAvailable())) return false;
  try {
    const revoked = await db.revokedSession.findUnique({ where: { jti } });
    if (!revoked) return false;
    if (revoked.expiresAt < new Date()) {
      // Lazy cleanup of expired entry
      await db.revokedSession.delete({ where: { jti } }).catch(() => undefined);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function requireTenant() {
  const session = await getServerSession(authOptions);
  const tenantId = (session?.user as any)?.tenantId;
  if (!session?.user || !tenantId) redirect('/login');

  // Hardening de autorização em tempo real: verificar se tenant está ativo
  if (tenantId !== 'zcc-admin-tenant' && (await isDatabaseAvailable())) {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (!tenant || tenant.status !== 'active') {
      redirect('/login?error=account_inactive');
    }
  }

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
