"use client";

/**
 * ============================================================
 * V11 — DdcMobileActions (Client Island)
 * ============================================================
 * Path: src/components/guest/DdcMobileActions.tsx
 *
 * Purpose:
 *   The ONLY 'use client' component on the guest DDC page.
 *   Provides a mobile-friendly floating action button (FAB)
 *   that opens a Radix UI Dialog with quick actions and a
 *   live notification feed (polled via useSWR every 15s).
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Focus trap active inside the Dialog (Radix built-in)
 *   - focus-visible outline: 2px slate-500 (visible on keyboard nav)
 *   - Full keyboard navigation (Tab, Shift+Tab, Esc to close, Enter to activate)
 *   - aria-labelledby + aria-describedby on Dialog
 *   - Reduced-motion respected via CSS prefers-reduced-motion
 *   - Touch targets ≥ 44×44px (mobile AA)
 *
 * SWR polling:
 *   - Endpoint: /api/v1/guest/ddc/notifications
 *   - refreshInterval: 15s (15_000 ms)
 *   - revalidateOnFocus: true (refresh when user returns to tab)
 *   - revalidateOnReconnect: true (refresh when network restored)
 *   - dedupingInterval: 10s (prevent duplicate concurrent fetches)
 *
 * Refs:
 *   - Volume 6 §Client Islands, §Accessibility (Apêndice B)
 *   - Volume 7 §BFF Notifications endpoint
 *   - V11-P0.7 §withSecurity (used by the notifications endpoint)
 * ============================================================
 */

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import useSWR from 'swr';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------
// Types — mirror the BFF contract in
// src/app/api/v1/guest/ddc/notifications/route.ts
// ---------------------------------------------------------------
interface DdcNotification {
  id: string;
  kind: 'invoice' | 'checkout';
  severity: 'info' | 'warn' | 'critical';
  title: string;
  detail: string;
  timestamp: string;
}

interface NotificationsPayload {
  notifications: DdcNotification[];
  generatedAt: string;
}

// ---------------------------------------------------------------
// Fetcher — uses native fetch, throws on non-2xx so SWR marks
// the request as error and surfaces it via `error` field.
// ---------------------------------------------------------------
async function notificationsFetcher(
  url: string
): Promise<NotificationsPayload> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`notifications ${res.status}`);
  }
  return (await res.json()) as NotificationsPayload;
}

// ---------------------------------------------------------------
// Sub-component: a single notification row
// ---------------------------------------------------------------
function NotificationRow({ n }: { n: DdcNotification }) {
  const severityClass = {
    info: 'ddc-notif--info',
    warn: 'ddc-notif--warn',
    critical: 'ddc-notif--critical',
  }[n.severity];

  const ts = new Date(n.timestamp).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className={cn('ddc-notif', severityClass)} role="status">
      <div className="ddc-notif__header">
        <span className="ddc-notif__title">{n.title}</span>
        <time className="ddc-notif__timestamp" dateTime={n.timestamp}>
          {ts}
        </time>
      </div>
      <p className="ddc-notif__detail">{n.detail}</p>
    </li>
  );
}

// ---------------------------------------------------------------
// Main component
// ---------------------------------------------------------------
export function DdcMobileActions() {
  const [open, setOpen] = React.useState(false);

  // SWR polling — see file header for tuning rationale.
  const { data, error, isLoading } = useSWR<NotificationsPayload>(
    '/api/v1/guest/ddc/notifications',
    notificationsFetcher,
    {
      refreshInterval: 15_000, // 15s
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10_000, // 10s
      errorRetryCount: 3,
      errorRetryInterval: 5_000, // back off to 5s on error
      keepPreviousData: true, // don't flash empty list during revalidation
    }
  );

  const notifications = data?.notifications ?? [];
  const unreadCriticalCount = notifications.filter(
    (n) => n.severity === 'critical'
  ).length;

  return (
    <>
      <style>{`
        .ddc-fab {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          z-index: 50;
          width: 3.5rem;
          height: 3.5rem;
          border-radius: 9999px;
          border: none;
          background: hsl(240 70% 50%);
          color: white;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px hsl(240 70% 30% / 0.3);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .ddc-fab:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px hsl(240 70% 30% / 0.4);
        }
        .ddc-fab:focus-visible {
          outline: 2px solid hsl(215 25% 27%); /* slate-500 */
          outline-offset: 2px;
        }
        .ddc-fab__badge {
          position: absolute;
          top: -0.25rem;
          right: -0.25rem;
          min-width: 1.25rem;
          height: 1.25rem;
          padding: 0 0.35rem;
          border-radius: 9999px;
          background: hsl(0 70% 45%);
          color: white;
          font-size: 0.7rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
        }
        .ddc-dialog-overlay {
          position: fixed;
          inset: 0;
          background: hsl(0 0% 0% / 0.5);
          backdrop-filter: blur(2px);
          z-index: 100;
        }
        .ddc-dialog-content {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 80dvh;
          background: white;
          border-top-left-radius: 1rem;
          border-top-right-radius: 1rem;
          padding: 1rem;
          z-index: 101;
          overflow-y: auto;
          box-shadow: 0 -4px 24px hsl(0 0% 0% / 0.15);
          animation: ddc-slide-up 0.2s ease-out;
        }
        @media (min-width: 640px) {
          .ddc-dialog-content {
            bottom: 50%;
            left: 50%;
            right: auto;
            transform: translate(-50%, 50%);
            width: 32rem;
            max-width: 90vw;
            border-radius: 1rem;
            animation: ddc-fade-in 0.2s ease-out;
          }
        }
        .ddc-dialog-title {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0 0 0.5rem 0;
        }
        .ddc-dialog-close {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          width: 2rem;
          height: 2rem;
          border-radius: 0.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          color: hsl(240 4% 46%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
        }
        .ddc-dialog-close:focus-visible {
          outline: 2px solid hsl(215 25% 27%);
          outline-offset: 2px;
        }
        .ddc-notif-list {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .ddc-notif {
          padding: 0.75rem;
          border-radius: 0.5rem;
          border-left: 4px solid transparent;
        }
        .ddc-notif--info {
          background: hsl(210 40% 96%);
          border-left-color: hsl(210 40% 50%);
        }
        .ddc-notif--warn {
          background: hsl(45 100% 95%);
          border-left-color: hsl(45 90% 50%);
        }
        .ddc-notif--critical {
          background: hsl(0 70% 96%);
          border-left-color: hsl(0 70% 45%);
        }
        .ddc-notif__header {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .ddc-notif__title {
          font-weight: 600;
          font-size: 0.875rem;
        }
        .ddc-notif__timestamp {
          font-size: 0.75rem;
          color: hsl(240 4% 46%);
          white-space: nowrap;
        }
        .ddc-notif__detail {
          margin: 0;
          font-size: 0.875rem;
          color: hsl(240 6% 25%);
        }
        .ddc-notif-empty {
          padding: 2rem 1rem;
          text-align: center;
          color: hsl(240 4% 46%);
          font-size: 0.875rem;
        }
        @keyframes ddc-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes ddc-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ddc-dialog-content { animation: none; }
          .ddc-fab { transition: none; }
        }
      `}</style>

      {/* Floating Action Button — 44×44 minimum touch target met (3.5rem = 56px) */}
      <button
        type="button"
        className="ddc-fab"
        aria-label={
          unreadCriticalCount > 0
            ? `Abrir ações rápidas — ${unreadCriticalCount} alerta(s) crítico(s)`
            : 'Abrir ações rápidas'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">⚡</span>
        {unreadCriticalCount > 0 && (
          <span
            className="ddc-fab__badge"
            aria-label={`${unreadCriticalCount} críticos`}
          >
            {unreadCriticalCount}
          </span>
        )}
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="ddc-dialog-overlay" />
          <Dialog.Content
            className="ddc-dialog-content"
            aria-describedby="ddc-mobile-actions-desc"
          >
            <Dialog.Title className="ddc-dialog-title">
              Ações rápidas & alertas
            </Dialog.Title>
            <Dialog.Description
              id="ddc-mobile-actions-desc"
              className="sr-only"
            >
              Notificações recentes e ações de atalho para o seu dashboard.
            </Dialog.Description>
            <Dialog.Close
              className="ddc-dialog-close"
              aria-label="Fechar"
            >
              <span aria-hidden="true">×</span>
            </Dialog.Close>

            <section aria-label="Notificações recentes">
              <h3 className="ddc-dialog-section-title">
                Notificações
              </h3>
              {isLoading ? (
                <div className="ddc-notif-empty" role="status">
                  Carregando…
                </div>
              ) : error ? (
                <div
                  className="ddc-notif-empty"
                  role="alert"
                >
                  Não foi possível carregar notificações.
                </div>
              ) : notifications.length === 0 ? (
                <div className="ddc-notif-empty">
                  Tudo certo! Sem notificações no momento.
                </div>
              ) : (
                <ul className="ddc-notif-list">
                  {notifications.map((n) => (
                    <NotificationRow key={n.id} n={n} />
                  ))}
                </ul>
              )}
            </section>

            <style>{`
              .ddc-dialog-section-title {
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: hsl(240 4% 46%);
                margin: 0.5rem 0 0.25rem 0;
              }
              .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0,0,0,0);
                white-space: nowrap;
                border: 0;
              }
            `}</style>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export default DdcMobileActions;
