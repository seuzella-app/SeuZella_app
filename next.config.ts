// Sanitize empty string URL env variables — Vercel local pull sets empty strings ""
['NEXTAUTH_URL', 'VERCEL_URL', 'NEXT_PUBLIC_APP_URL', 'DATABASE_URL', 'DIRECT_URL'].forEach((key) => {
  if (process.env[key] === '') {
    delete process.env[key];
  }
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // FASE 02B (FRENTE 47): git-applier.ts usa process.cwd() (join(cwd, path),
  // simpleGit(cwd)) — NFT não consegue restringir o traçado e inclui o projeto
  // inteiro (.git, tests, docs, migrations) como dependência potencial da rota
  // /api/zcc/ze-code/apply → infla o pico de memória do build (amplificador do
  // OOM em runners pequenos). Exclusão limitada a ESTA rota (server-only).
  outputFileTracingExcludes: {
    '/api/zcc/ze-code/apply': [
      './.git/**/*',
      './tests/**/*',
      './docs/**/*',
      './prisma/migrations/**/*',
      './coverage/**/*',
    ],
  },
  allowedDevOrigins: process.env.NODE_ENV === 'development' ? ['localhost', '127.0.0.1'] : undefined,
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "sharp", "socket.io"],
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error'] }
        : false,
  },
  async redirects() {
    return [
      {
        source: '/ddc/pousadas',
        destination: '/ddc/pousada',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.mercadopago.com https://*.cloudinary.com https://*.asaas.com; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://api.openai.com https://api.groq.com https://graph.facebook.com https://api.vturb.com.br https://api.zapsign.com.br https://*.basemaps.cartocdn.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none';",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
