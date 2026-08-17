// Sanitize empty string URL env variables — Vercel local pull sets empty strings ""
['NEXTAUTH_URL', 'VERCEL_URL', 'NEXT_PUBLIC_APP_URL', 'DATABASE_URL', 'DIRECT_URL'].forEach((key) => {
  if (process.env[key] === '') {
    delete process.env[key];
  }
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['localhost', '127.0.0.1', '21.0.13.26'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.mercadopago.com https://*.cloudinary.com https://*.asaas.com; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://api.openai.com https://api.groq.com https://graph.facebook.com https://api.vturb.com.br https://api.zapsign.com.br https://*.basemaps.cartocdn.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self';",
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