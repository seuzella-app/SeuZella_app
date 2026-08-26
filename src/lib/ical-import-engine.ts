import { db } from '@/lib/db';
import { safeFetchExternalUrl, SafeFetchSSRFError } from '@/lib/security/safe-fetch';

/**
 * ============================================================================
 * 🛡️ iCal Import Engine — Anti-SSRF, DoS Protection & PII Sanitization
 * ============================================================================
 */

export const MAX_ICAL_BYTES = 2 * 1024 * 1024; // 2MB máximo
export const MAX_ICAL_EVENTS = 10000; // Limite de 10000 eventos por sync
export const ICAL_FETCH_TIMEOUT_MS = 10000; // 10 segundos timeout

interface ICalEvent {
  uid: string;
  summary: string;
  startDate: string;
  endDate: string;
  description?: string;
  location?: string;
  status?: string;
}

interface ICalImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details: Array<{ uid: string; action: string; reason?: string }>;
}

/**
 * Import iCal data from a URL with full SSRF and DoS protection
 */
export async function importICal(tenantId: string, icalUrl: string): Promise<ICalImportResult> {
  const result: ICalImportResult = {
    imported: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  try {
    // 1. Safe Fetch com pre-resolution DNS, bloqueio de IP privado, redirect manual e limite de 2MB
    let icalText = '';
    try {
      const response = await safeFetchExternalUrl(icalUrl, {
        headers: { 'Accept': 'text/calendar' },
        maxBytes: MAX_ICAL_BYTES,
        timeoutMs: ICAL_FETCH_TIMEOUT_MS,
      });

      if (response.status < 200 || response.status >= 300) {
        result.errors++;
        result.details.push({ uid: 'fetch', action: 'error', reason: `HTTP ${response.status}` });
        return result;
      }

      icalText = await response.text();
    } catch (err: any) {
      result.errors++;
      result.details.push({
        uid: 'ssrf_or_fetch_blocked',
        action: 'blocked',
        reason: err.message || 'Falha ao buscar feed iCal com proteção SSRF',
      });
      return result;
    }

    const events = parseICal(icalText);
    if (events.length > MAX_ICAL_EVENTS) {
      result.errors++;
      result.details.push({
        uid: 'event_limit_exceeded',
        action: 'error',
        reason: `Feed contém mais de ${MAX_ICAL_EVENTS} eventos (${events.length} encontrados)`,
      });
      return result;
    }

    // 2. Processa cada evento de forma transacional e segura
    for (const event of events) {
      try {
        const checkIn = new Date(`${event.startDate }T14:00:00`);
        const checkOut = new Date(`${event.endDate }T11:00:00`);

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
          result.skipped++;
          result.details.push({ uid: event.uid, action: 'skipped', reason: 'Invalid dates' });
          continue;
        }

        if (checkOut <= checkIn) {
          result.skipped++;
          result.details.push({ uid: event.uid, action: 'skipped', reason: 'Check-out before check-in' });
          continue;
        }

        // Não importa eventos no passado (>30 dias atrás)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (checkOut < thirtyDaysAgo) {
          result.skipped++;
          result.details.push({ uid: event.uid, action: 'skipped', reason: 'Event in the past' });
          continue;
        }

        const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

        // Upsert do booking com proteção de tenantId
        await db.booking.upsert({
          where: {
            tenantId_externalUid: {
              tenantId,
              externalUid: event.uid,
            },
          },
          create: {
            tenantId,
            externalUid: event.uid,
            guestName: 'Hóspede iCal', // Anonimizado
            roomName: event.location || 'Quarto iCal',
            checkIn,
            checkOut,
            nights,
            guests: 1,
            status: event.status?.toLowerCase() === 'cancelled' ? 'cancelled' : 'confirmed',
            totalValue: 0,
            source: 'ical_import',
            metadata: JSON.stringify({ summary: event.summary }),
          },
          update: {
            checkIn,
            checkOut,
            nights,
            status: event.status?.toLowerCase() === 'cancelled' ? 'cancelled' : 'confirmed',
            metadata: JSON.stringify({ summary: event.summary }),
          },
        });

        result.imported++;
        result.details.push({ uid: event.uid, action: 'imported' });
      } catch (eventError: any) {
        result.errors++;
        result.details.push({
          uid: event.uid,
          action: 'error',
          reason: eventError.message || 'Database error',
        });
      }
    }

    // 3. Atualiza timestamp do sync
    await db.bookingSyncConfig.updateMany({
      where: { tenantId },
      data: {
        lastSync: new Date(),
        status: result.errors === 0 ? 'active' : 'error',
      },
    });

    return result;
  } catch (error: any) {
    result.errors++;
    result.details.push({
      uid: 'general_error',
      action: 'error',
      reason: error.message || 'Unknown import error',
    });

    await db.bookingSyncConfig.updateMany({
      where: { tenantId },
      data: {
        lastSync: new Date(),
        status: 'error',
      },
    }).catch(() => {});

    return result;
  }
}

/**
 * Basic iCal (RFC 5545) text parser
 */
export function parseICal(icalContent: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = icalContent
    .replace(/\r\n\s+/g, '') // Unfold multi-line entries
    .split(/\r\n|\n|\r/);

  let inEvent = false;
  let currentEvent: Partial<ICalEvent> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && currentEvent.uid && currentEvent.startDate && currentEvent.endDate) {
        events.push({
          uid: currentEvent.uid,
          summary: currentEvent.summary || 'Reserva iCal',
          startDate: currentEvent.startDate,
          endDate: currentEvent.endDate,
          description: currentEvent.description,
          location: currentEvent.location,
          status: currentEvent.status || 'CONFIRMED',
        });
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const rawKey = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);

    // Extract base property name (strip parameters like ;VALUE=DATE)
    const propName = rawKey.split(';')[0].toUpperCase();

    switch (propName) {
      case 'UID':
        currentEvent.uid = value.trim();
        break;
      case 'SUMMARY':
        currentEvent.summary = value.trim();
        break;
      case 'DTSTART':
        currentEvent.startDate = parseICalDate(value.trim());
        break;
      case 'DTEND':
        currentEvent.endDate = parseICalDate(value.trim());
        break;
      case 'DESCRIPTION':
        currentEvent.description = value.trim();
        break;
      case 'LOCATION':
        currentEvent.location = value.trim();
        break;
      case 'STATUS':
        currentEvent.status = value.trim();
        break;
    }
  }

  return events;
}

/**
 * Parse iCal date format (YYYYMMDD or YYYYMMDDTHHMMSSZ) into YYYY-MM-DD
 */
function parseICalDate(value: string): string {
  const cleaned = value.replace(/[^0-9T]/g, '');

  // YYYYMMDD format
  if (/^\d{8}$/.test(cleaned)) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  }

  // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const dateMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }

  return value;
}

/**
 * Generate iCal export content for a tenant's availability
 * Public feed sanitizado: SEM EXPOSIÇÃO DE DADOS PESSOAIS DO HÓSPEDE (LGPD)
 */
export async function generateICalExport(syncToken: string): Promise<string> {
  const config = await db.bookingSyncConfig.findFirst({
    where: { syncToken },
  });

  if (!config) {
    return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Zella//EN\r\nEND:VCALENDAR\r\n';
  }

  const bookings = await db.booking.findMany({
    where: {
      tenantId: config.tenantId,
      status: { in: ['confirmed', 'checked_in', 'blocked'] },
    },
    orderBy: { checkIn: 'asc' },
  });

  let ical = 'BEGIN:VCALENDAR\r\n';
  ical += 'VERSION:2.0\r\n';
  ical += 'PRODID:-//Zella//GestaoInteligente//PT\r\n';
  ical += 'CALSCALE:GREGORIAN\r\n';
  ical += 'METHOD:PUBLISH\r\n';

  for (const booking of bookings) {
    const checkInStr = formatICalDate(booking.checkIn);
    const checkOutStr = formatICalDate(booking.checkOut);
    const uid = booking.externalUid || `zella-${booking.id}`;

    ical += 'BEGIN:VEVENT\r\n';
    ical += `UID:${uid}\r\n`;
    ical += `DTSTART;VALUE=DATE:${checkInStr}\r\n`;
    ical += `DTEND;VALUE=DATE:${checkOutStr}\r\n`;
    // LGPD Sanitization: Não exporta nomes nem telefones em feeds iCal públicos
    ical += `SUMMARY:Reservado\r\n`;
    ical += `DESCRIPTION:Indisponível - Reserva Confirmada\r\n`;
    ical += `STATUS:CONFIRMED\r\n`;
    ical += 'END:VEVENT\r\n';
  }

  ical += 'END:VCALENDAR\r\n';
  return ical;
}

/**
 * Format a Date object to iCal date format (YYYYMMDD)
 */
function formatICalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
