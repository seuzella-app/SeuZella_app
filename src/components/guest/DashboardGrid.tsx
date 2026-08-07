/**
 * ============================================================
 * V11 — DashboardGrid (layout primitive for DDC)
 * ============================================================
 * Path: src/components/guest/DashboardGrid.tsx
 *
 * Purpose:
 *   Declarative grid layout for the guest DDC page. Server
 *   Component — no client JS. Mobile-first: single column.
 *   Desktop (lg breakpoint): 3-column grid with named areas.
 *
 * Grid areas (desktop):
 *   ┌──────────┬──────────┬──────────┐
 *   │ primary  │ secondary │ tertiary │
 *   ├──────────┴──────────┴──────────┤
 *   │           aside                │
 *   └────────────────────────────────┘
 *
 * Refs: Volume 6 §Design System, §PPR
 * ============================================================
 */

import * as React from 'react';

interface DashboardGridProps {
  cols?: 1 | 2 | 3;
  children?: React.ReactNode;
}

interface DashboardGridItemProps {
  area: 'primary' | 'secondary' | 'tertiary' | 'aside';
  children?: React.ReactNode;
}

export function DashboardGrid({ cols = 3, children }: DashboardGridProps) {
  return (
    <>
      <style>{`
        .ddc-dashboard-grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1024px) {
          .ddc-dashboard-grid {
            grid-template-columns: repeat(${cols}, minmax(0, 1fr));
            grid-template-areas:
              "primary secondary tertiary"
              "aside aside aside";
          }
          .ddc-dashboard-grid__item--primary   { grid-area: primary; }
          .ddc-dashboard-grid__item--secondary { grid-area: secondary; }
          .ddc-dashboard-grid__item--tertiary  { grid-area: tertiary; }
          .ddc-dashboard-grid__item--aside     { grid-area: aside; }
        }
      `}</style>
      <div
        className="ddc-dashboard-grid grid gap-4 grid-cols-1 lg:grid-cols-3"
        data-cols={cols}
      >
        {children}
      </div>
    </>
  );
}

function DashboardGridItem({ area, children }: DashboardGridItemProps) {
  return (
    <div
      className={`ddc-dashboard-grid__item ddc-dashboard-grid__item--${area}`}
      data-area={area}
    >
      {children}
    </div>
  );
}

DashboardGrid.Item = DashboardGridItem;

export default DashboardGrid;
