/**
 * ============================================================
 * V11 — DdcSkeleton (loading shell for PPR streaming)
 * ============================================================
 * Path: src/components/guest/DdcSkeleton.tsx
 *
 * Purpose:
 *   Server Component used as the <Suspense fallback={...}> for
 *   slow-loading sections of the guest DDC (Dashboard do
 *   Cliente). Designed to render with ZERO client JS — it is
 *   pure HTML+CSS so the device shows meaningful structure
 *   within the first paint, before the dynamic data arrives.
 *
 * Design:
 *   - Uses design tokens from globals.css:
 *       --background, --foreground, --accent, --border, --radius
 *   - All animation via CSS @keyframes (no JS).
 *   - Mobile-first: single column. Desktop: 3-column grid is
 *     handled by the parent <DashboardGrid>.
 *
 * Refs: Volume 6 §PPR + Streaming SSR, §Design Tokens (Apêndice A)
 * ============================================================
 */

import * as React from 'react';

// ---------------------------------------------------------------
// Single skeleton card — used inside DdcSkeleton
// ---------------------------------------------------------------
function SkeletonCard({
  rows = 3,
  ariaLabel,
}: {
  rows?: number;
  ariaLabel: string;
}) {
  return (
    <div
      className="ddc-skeleton-card"
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="ddc-skeleton-card__header" />
      <div className="ddc-skeleton-card__body">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="ddc-skeleton-card__row"
            style={{
              width: i === rows - 1 ? '60%' : '100%',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Main skeleton — renders 4 cards matching the 4 streaming
// sections of the DDC page (tenant header, reservations,
// invoices, concierge message).
// ---------------------------------------------------------------
export function DdcSkeleton() {
  return (
    <>
      <style>{`
        .ddc-skeleton-card {
          border: 1px solid var(--border, hsl(240 5% 90%));
          border-radius: var(--radius, 0.75rem);
          padding: 1rem;
          background: var(--card, hsl(0 0% 100%));
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .ddc-skeleton-card__header {
          height: 1.25rem;
          width: 50%;
          background: linear-gradient(
            90deg,
            hsl(240 5% 88%) 0%,
            hsl(240 5% 94%) 50%,
            hsl(240 5% 88%) 100%
          );
          background-size: 200% 100%;
          animation: ddc-skeleton-pulse 1.5s ease-in-out infinite;
          border-radius: 0.25rem;
        }
        .ddc-skeleton-card__body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .ddc-skeleton-card__row {
          height: 0.875rem;
          background: linear-gradient(
            90deg,
            hsl(240 5% 90%) 0%,
            hsl(240 5% 95%) 50%,
            hsl(240 5% 90%) 100%
          );
          background-size: 200% 100%;
          animation: ddc-skeleton-pulse 1.5s ease-in-out infinite;
          border-radius: 0.25rem;
        }
        @keyframes ddc-skeleton-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ddc-skeleton-card__header,
          .ddc-skeleton-card__row {
            animation: none;
            background: hsl(240 5% 90%);
          }
        }
      `}</style>
      <SkeletonCard rows={2} ariaLabel="Carregando detalhes da hospedagem" />
      <SkeletonCard rows={4} ariaLabel="Carregando reservas ativas" />
      <SkeletonCard rows={3} ariaLabel="Carregando faturas pendentes" />
      <SkeletonCard rows={3} ariaLabel="Carregando mensagem do concierge" />
    </>
  );
}

export default DdcSkeleton;
