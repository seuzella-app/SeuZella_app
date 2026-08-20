# ==============================================================================
# SEU ZELLA — Dockerfile de Produção (Multi-Stage Build Otimizado)
# ==============================================================================
# Imagem final: ~120MB | Node 22 Alpine | Next.js Standalone
# ==============================================================================

# ── STAGE 1: Dependências ─────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --ignore-scripts; else npm install --omit=dev --ignore-scripts; fi && \
    npx prisma generate

# ── STAGE 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# DATABASE_URL temporário apenas para o prisma generate no build
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/seuzella_build"
ENV NEXTAUTH_SECRET="build-only-dummy-secret"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NODE_ENV="production"

RUN npx prisma generate && \
    npx next build

# ── STAGE 3: Runner (Produção) ───────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl tini
WORKDIR /app

ENV NODE_ENV="production"
ENV NEXTAUTH_URL="http://localhost:3000"

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 zella && \
    adduser --system --uid 1001 zella

# Copiar standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/.next && chown -R zella:zella /app/.next

USER zella

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# tini como PID 1 para signal handling correto
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "server.js"]
