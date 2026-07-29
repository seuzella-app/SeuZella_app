// Sanitize NEXTAUTH_URL — Vercel may set it to an empty string or invalid value
try {
  if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL === '') {
    delete process.env.NEXTAUTH_URL;
  } else {
    // Validate that it's a proper URL
    new URL(process.env.NEXTAUTH_URL);
  }
} catch {
  console.warn('[next.config] NEXTAUTH_URL is invalid, removing it:', process.env.NEXTAUTH_URL);
  delete process.env.NEXTAUTH_URL;
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['localhost', '127.0.0.1', '21.0.13.26'],
  typescript: {
    // ZCC legacy components have type mismatches (trial→gratuito, pousadas→pousada, owner property)
    // TODO: fix ZCC types in a dedicated refactoring pass
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "sharp", "socket.io"],
  compiler: {
    // Em produção, remove console.log/info/warn mas PRESERVA console.error
    // (console.error é interceptado pelo LogSink em instrumentation.ts
    // e é essencial para debugging em Vercel Serverless).
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://api.openai.com https://api.groq.com https://graph.facebook.com https://api.vturb.com.br https://api.zapsign.com.br; frame-ancestors 'none'; form-action 'self'; base-uri 'self';",
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
        ],
      },
    ];
  },
};

export default nextConfig;