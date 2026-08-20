import { db } from '@/lib/db';
import { validateUrlSafeForSsrf } from '@/lib/security/ssrf-protection';

/**
 * ============================================================================
 * 🛡️ iCal Import Engine — Anti-SSRF, DoS Protection & PII Sanitization
 * ============================================================================
 */

const MAX_ICAL_BYTES = 5 * 1024 * 1024; // 5MB máximo
const MAX_ICAL_EVENTS = 2000;           // Limite de 2000 eventos por sync
const ICAL_FETCH_TIMEOUT_MS = 15000;    // 15 segundos timeout

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
    // 1. SSRF Gate: Validação estrita de DNS e IPs privados/loopback
    const ssrfCheck = await validateUrlSafeForSsrf(icalUrl);
    if (!ssrfCheck.safe) {
      result.errors++;
      result.details.push({
        uid: 'ssrf_blocked',
        action: 'blocked',
        reason: `URL rejeitada por política de segurança SSRF: ${ssrfCheck.reason}`,
      });
      return result;
    }

    // 2. Fetch com timeout rígido e redirect manual
    const response = await fetch(icalUrl, {
      headers: { 'Accept': 'text/calendar' },
      signal: AbortSignal.timeout(ICAL_FETCH_TIMEOUT_MS),
      redirect: 'manual',
    });

    if (!response.ok) {
      result.errors++;
      result.details.push({ uid: 'fetch', action: 'error', reason: `HTTP ${response.status}` });
      return result;
    }

    // 3. Validação de tamanho de payload (DoS protection)
    const icalText = await response.text();
    if (Buffer.byteLength(icalText, 'utf8') > MAX_ICAL_BYTES) {
      result.errors++;
      result.details.push({
        uid: 'payload_too_large',
        action: 'error',
        reason: `Feed iCal excede o limite máximo de ${MAX_ICAL_BYTES / (1024 * 1024)}MB`,
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

    // 4. Processa cada evento de forma transacional e segura
    for (const event of events) {
      try {
        const checkIn = new Date(event.startDate + 'T14:00:00');
        const checkOut = new Date(event.endDate + 'T11:00:00');

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
          result.skipped++;
          result.details.push({ uid: event.uid, action: 'skipped', reason: 'Invalid dates' });
          continue;
        }

        // Sanitiza o resumo (removendo prefixos de bloqueio)
        const guestName = event.summary?.replace(/^(Reserved|Blocked|Not available)\s*:?\s*/i, '').trim() || 'Booking.com Guest';

        // Check for existing booking with same external UID
        const existing = await db.booking.findFirst({
          where: {
            tenantId,
            externalUid: event.uid,
            source: 'booking',
          },
        });

        if (existing) {
          // Update if dates changed
          if (existing.checkIn.getTime() !== checkIn.getTime() || existing.checkOut.getTime() !== checkOut.getTime()) {
            await db.booking.update({
              where: { id: existing.id },
              data: { checkIn, checkOut, status: event.status === 'CANCELLED' ? 'cancelled' : 'confirmed' },
            });
            result.details.push({ uid: event.uid, action: 'updated' });
          } else {
            result.skipped++;
            result.details.push({ uid: event.uid, action: 'skipped', reason: 'Already exists' });
          }
          continue;
        }

        // Calculate nights and price (sem fallback arbitrário de R$150)
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const property = await db.property.findFirst({ where: { tenantId } });
        const room = property ? await db.room.findFirst({ where: { propertyId: property.id } }) : null;
        const pricePerNight = room?.price ?? 0;

        // Create booking
        await db.booking.create({
          data: {
            tenantId,
            roomId: room?.id || null,
            roomName: room?.name || 'Standard Room',
            guestName,
            checkIn,
            checkOut,
            nights: Math.max(1, nights),
            guests: 1,
            totalValue: pricePerNight * Math.max(1, nights),
            status: event.status === 'CANCELLED' ? 'cancelled' : 'confirmed',
            source: 'booking',
            externalUid: event.uid,
            externalSource: 'booking',
          },
        });

        result.imported++;
        result.details.push({ uid: event.uid, action: 'imported' });
      } catch (eventError: any) {
        result.errors++;
        result.details.push({ uid: event.uid, action: 'error', reason: eventError?.message || 'DB error' });
      }
    }
  } catch (fetchError: any) {
    result.errors++;
    result.details.push({ uid: 'fetch', action: 'error', reason: fetchError?.message || 'Network error' });
  }

  return result;
}

/**
 * Parse raw iCal text into structured event objects
 */
function parseICal(icalText: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = icalText.split(/\r?\n/);

  let currentEvent: Partial<ICalEvent> | null = null;
  let currentKey = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle line unfolding (continuation lines start with space or tab)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].slice(1);
      i++;
    }

    line = line.trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.uid && currentEvent.startDate && currentEvent.endDate) {
        events.push(currentEvent as ICalEvent);
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) continue;

    // Parse KEY;PARAMS:VALUE or KEY:VALUE
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const keyPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Extract property name (ignore parameters like ;VALUE=DATE)
    const semicolonIdx = keyPart.indexOf(';');
    const propName = (semicolonIdx !== -1 ? keyPart.slice(0, semicolonIdx) : keyPart).toUpperCase();

    switch (propName) {
      case 'UID':
        currentEvent.uid = value.slice(0, 256); // Proteção de tamanho de UID
        break;
      case 'SUMMARY':
        currentEvent.summary = value;
        break;
      case 'DTSTART':
        currentEvent.startDate = parseICalDate(value);
        break;
      case 'DTEND':
        currentEvent.endDate = parseICalDate(value);
        break;
      case 'DESCRIPTION':
        currentEvent.description = value.slice(0, 1024);
        break;
      case 'LOCATION':
        currentEvent.location = value.slice(0, 256);
        break;
      case 'STATUS':
        currentEvent.status = value.toUpperCase();
        break;
    }
  }

  return events;
}

/**
 * Parse iCal date string (YYYYMMDD or YYYYMMDDTHHMMSSZ) into YYYY-MM-DD
 */
function parseICalDate(value: string): string {
  const cleaned = value.replace(/^VALUE=DATE:/, '');

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
