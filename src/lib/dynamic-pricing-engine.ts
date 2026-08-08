/**
 * ZÉLLA — Dynamic Pricing Engine (Precificação Dinâmica)
 *
 * Calculates optimal prices for daily rates based on:
 * - Demand (occupancy rate)
 * - Brazilian holidays (national + state)
 * - Seasonality (high/low season periods)
 * - Days before check-in (urgency pricing)
 * - Day of week (weekend pricing)
 *
 * Applies rules from DynamicPricingRule model in priority order,
 * then caches results in PricingCalculation model.
 *
 * Uses `db` from `@/lib/db` for all database operations.
 */

import { db } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────

export interface BrazilianHoliday {
  date: string;       // YYYY-MM-DD
  name: string;
  type: 'national' | 'state' | 'municipal';
  state?: string;     // ISO state code (SP, RJ, BA, etc.) for state holidays
}

export interface ModifierBreakdownEntry {
  ruleId: string;
  ruleName: string;
  modifierType: string;
  modifierValue: number;
  priceBefore: number;
  priceAfter: number;
}

export interface PricingCalculationResult {
  basePrice: number;
  calculatedPrice: number;
  modifierBreakdown: ModifierBreakdownEntry[];
  appliedRulesCount: number;
  occupancyAtCalc: number;
  daysBeforeCheckIn: number;
  isHoliday: boolean;
  holidayName?: string;
  seasonLabel: string;
  dayOfWeekLabel: string;
}

export interface SeasonPeriod {
  label: string;
  startMonth: number;  // 1-12
  startDay: number;
  endMonth: number;
  endDay: number;
  defaultMultiplier: number;
}

// ── Easter Calculation (Computus — Butcher's Method) ──────────────────

/**
 * Calculates Easter Sunday date for a given year.
 * Uses the anonymous Gregorian algorithm (aka Butcher's method).
 * Returns a Date object for Easter Sunday.
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);  // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Format a Date to YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add days to a Date and return a new Date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ── Brazilian Holiday Calendar ────────────────────────────────────────

/**
 * Returns all Brazilian holidays for a given year (national + major state holidays).
 *
 * Fixed national holidays:
 * - Confraternização Universal (Jan 1)
 * - Tiradentes (Apr 21)
 * - Dia do Trabalho (May 1)
 * - Independência do Brasil (Sep 7)
 * - Nossa Senhora Aparecida (Oct 12)
 * - Finados (Nov 2)
 * - Proclamação da República (Nov 15)
 * - Natal (Dec 25)
 *
 * Variable holidays (based on Easter):
 * - Carnaval (Monday and Tuesday, 48 and 47 days before Easter)
 * - Sexta-feira Santa (Good Friday, 2 days before Easter)
 * - Corpus Christi (60 days after Easter)
 *
 * State holidays:
 * - São Paulo: Revolução Constitucionalista (Jul 9)
 * - Rio de Janeiro: Dia de São Sebastião (Jan 20) + São George (Apr 23)
 * - Bahia/Salvador: Independência da Bahia (Jul 2)
 * - Minas Gerais: Tiradentes already national (Apr 21)
 * - Rio Grande do Sul: Revolução Farroupilha (Sep 20)
 * - Amazonas: Elevação do Amazonas à Categoria de Província (Sep 5)
 * - Ceará: Data Magna do Ceará (Mar 25)
 * - Pernambuco: Data Magna de Pernambuco (Jun 24)
 * - Paraná: Dia do Paraná (Dec 19)
 * - Santa Catarina: Dia de Santa Catarina (Aug 11)
 * - Acre: Evolução Política do Acre (Jun 15) + Autonomia do Acre (Nov 5)
 * - Alagoas: Data Magna de Alagoas (Sep 16)
 */
export function getBrazilianHolidays(year: number): BrazilianHoliday[] {
  const holidays: BrazilianHoliday[] = [];
  const easter = calculateEaster(year);

  // ── Fixed National Holidays ──
  holidays.push({ date: `${year}-01-01`, name: 'Confraternização Universal', type: 'national' });
  holidays.push({ date: `${year}-04-21`, name: 'Tiradentes', type: 'national' });
  holidays.push({ date: `${year}-05-01`, name: 'Dia do Trabalho', type: 'national' });
  holidays.push({ date: `${year}-09-07`, name: 'Independência do Brasil', type: 'national' });
  holidays.push({ date: `${year}-10-12`, name: 'Nossa Senhora Aparecida', type: 'national' });
  holidays.push({ date: `${year}-11-02`, name: 'Finados', type: 'national' });
  holidays.push({ date: `${year}-11-15`, name: 'Proclamação da República', type: 'national' });
  holidays.push({ date: `${year}-12-25`, name: 'Natal', type: 'national' });

  // ── Variable National Holidays (based on Easter) ──
  // Carnaval Monday (48 days before Easter)
  holidays.push({ date: formatDate(addDays(easter, -48)), name: 'Carnaval (Segunda)', type: 'national' });
  // Carnaval Tuesday (47 days before Easter)
  holidays.push({ date: formatDate(addDays(easter, -47)), name: 'Carnaval (Terça)', type: 'national' });
  // Sexta-feira Santa (Good Friday, 2 days before Easter)
  holidays.push({ date: formatDate(addDays(easter, -2)), name: 'Sexta-feira Santa', type: 'national' });
  // Corpus Christi (60 days after Easter)
  holidays.push({ date: formatDate(addDays(easter, 60)), name: 'Corpus Christi', type: 'national' });

  // ── State Holidays ──
  // São Paulo
  holidays.push({ date: `${year}-07-09`, name: 'Revolução Constitucionalista de 1932', type: 'state', state: 'SP' });

  // Rio de Janeiro (city)
  holidays.push({ date: `${year}-01-20`, name: 'Dia de São Sebastião (Rio)', type: 'state', state: 'RJ' });
  holidays.push({ date: `${year}-04-23`, name: 'Dia de São George (Rio)', type: 'state', state: 'RJ' });

  // Bahia / Salvador
  holidays.push({ date: `${year}-07-02`, name: 'Independência da Bahia', type: 'state', state: 'BA' });

  // Rio Grande do Sul
  holidays.push({ date: `${year}-09-20`, name: 'Revolução Farroupilha', type: 'state', state: 'RS' });

  // Ceará
  holidays.push({ date: `${year}-03-25`, name: 'Data Magna do Ceará', type: 'state', state: 'CE' });

  // Pernambuco
  holidays.push({ date: `${year}-06-24`, name: 'Data Magna de Pernambuco', type: 'state', state: 'PE' });

  // Amazonas
  holidays.push({ date: `${year}-09-05`, name: 'Elevação do Amazonas à Província', type: 'state', state: 'AM' });

  // Paraná
  holidays.push({ date: `${year}-12-19`, name: 'Dia do Paraná', type: 'state', state: 'PR' });

  // Santa Catarina
  holidays.push({ date: `${year}-08-11`, name: 'Dia de Santa Catarina', type: 'state', state: 'SC' });

  // Minas Gerais — Tiradentes already covered (Apr 21)
  // Alagoas
  holidays.push({ date: `${year}-09-16`, name: 'Data Magna de Alagoas', type: 'state', state: 'AL' });

  // Acre
  holidays.push({ date: `${year}-06-15`, name: 'Aniversário do Acre', type: 'state', state: 'AC' });
  holidays.push({ date: `${year}-11-05`, name: 'Autonomia do Acre', type: 'state', state: 'AC' });

  // ── Municipal holidays (major cities) ──
  // São Paulo city
  holidays.push({ date: `${year}-01-25`, name: 'Aniversário de São Paulo (cidade)', type: 'municipal', state: 'SP' });
  // Rio de Janeiro city
  holidays.push({ date: `${year}-04-23`, name: 'São George (Rio cidade)', type: 'municipal', state: 'RJ' }); // duplicate of state, but municipal also

  // Sort by date
  holidays.sort((a, b) => a.date.localeCompare(b.date));

  return holidays;
}

/**
 * Checks if a given date string (YYYY-MM-DD) is a Brazilian holiday.
 * Returns the holiday object if found, null otherwise.
 * Optionally filters by state for state/municipal holidays.
 */
export function isBrazilianHoliday(
  dateStr: string,
  state?: string,
): BrazilianHoliday | null {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const holidays = getBrazilianHolidays(year);

  const matching = holidays.filter(h => {
    if (h.date !== dateStr) return false;
    // National holidays apply everywhere
    if (h.type === 'national') return true;
    // State/municipal holidays only apply if state matches or no state filter
    if (!state) return true;
    return h.state === state;
  });

  // Prefer national over state/municipal
  if (matching.length === 0) return null;
  const national = matching.find(h => h.type === 'national');
  return national ?? matching[0];
}

// ── Seasonality Definitions ───────────────────────────────────────────

/**
 * Brazilian tourism seasonality periods.
 * These are applied as default modifiers when no explicit rules exist.
 *
 * High season: Summer vacation (Dec-Feb), Carnaval period, July winter break
 * Low season: March-June (except holidays), September-November (except holidays)
 */
const SEASON_PERIODS: SeasonPeriod[] = [
  {
    label: 'Alta Season — Verão',
    startMonth: 12, startDay: 20,
    endMonth: 2, endDay: 28,
    defaultMultiplier: 1.3,
  },
  {
    label: 'Alta Season — Carnaval',
    startMonth: 2, startDay: 1,
    endMonth: 3, endDay: 5,
    defaultMultiplier: 1.5,
  },
  {
    label: 'Alta Season — Julho',
    startMonth: 7, startDay: 1,
    endMonth: 7, endDay: 31,
    defaultMultiplier: 1.25,
  },
  {
    label: 'Media Season — Reveillon',
    startMonth: 12, startDay: 28,
    endMonth: 1, endDay: 5,
    defaultMultiplier: 1.4,
  },
  {
    label: 'Baixa Season',
    startMonth: 3, startDay: 6,
    endMonth: 6, endDay: 30,
    defaultMultiplier: 0.85,
  },
  {
    label: 'Baixa Season',
    startMonth: 9, startDay: 8,
    endMonth: 11, endDay: 29,
    defaultMultiplier: 0.85,
  },
];

/**
 * Determines the season for a given date.
 * Returns the matching SeasonPeriod or a default "Normal" season.
 */
function getSeasonForDate(date: Date): SeasonPeriod & { label: string; defaultMultiplier: number } {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const season of SEASON_PERIODS) {
    // Handle seasons that span across years (e.g., Dec 20 - Feb 28)
    if (season.startMonth > season.endMonth) {
      // Cross-year season: matches if date is after start OR before end
      const afterStart = (month === season.startMonth && day >= season.startDay) || month > season.startMonth;
      const beforeEnd = (month === season.endMonth && day <= season.endDay) || month < season.endMonth;
      if (afterStart || beforeEnd) return season;
    } else {
      // Same-year season
      const afterStart = (month === season.startMonth && day >= season.startDay) || month > season.startMonth;
      const beforeEnd = (month === season.endMonth && day <= season.endDay) || month < season.endMonth;
      if (afterStart && beforeEnd) return season;
    }
  }

  // Default: normal season (no modifier)
  return { label: 'Season Normal', defaultMultiplier: 1.0, startMonth: 1, startDay: 1, endMonth: 12, endDay: 31 };
}

// ── Day of Week Labels ────────────────────────────────────────────────

const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

// ── Get Applicable Rules ──────────────────────────────────────────────

/**
 * Fetches pricing rules from the database that apply to the given context.
 * Rules are filtered by:
 * - tenantId (tenant ownership)
 * - status = 'active'
 * - date range (startDate/endDate overlap)
 * - occupancy range (minOccupancy/maxOccupancy)
 * - days of week
 * - days before check-in
 *
 * Rules are sorted by priority (highest first).
 */
export async function getApplicableRules(
  tenantId: string,
  date: Date,
  occupancyRate: number,
  daysBeforeCheckIn: number,
) {
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

  const rules = await db.dynamicPricingRule.findMany({
    where: {
      tenantId,
      status: 'active',
      // Date range: rule covers the target date
      OR: [
        { startDate: null, endDate: null },  // Always active
        { startDate: null, endDate: { gte: date } },  // No start, ends after target
        { startDate: { lte: date }, endDate: null },  // Starts before, no end
        { startDate: { lte: date }, endDate: { gte: date } },  // Fully covers
      ],
      // Occupancy range
      minOccupancy: { lte: occupancyRate },
      maxOccupancy: { gte: occupancyRate },
      // Days before check-in
      minDaysBefore: { lte: daysBeforeCheckIn },
    },
    orderBy: { priority: 'desc' },
  });

  // Additional filtering: daysOfWeek is stored as JSON array
  const filtered = rules.filter((rule: any) => {
    try {
      const daysOfWeekArr: number[] = JSON.parse(rule.daysOfWeek);
      // Empty array means all days
      if (daysOfWeekArr.length === 0) return true;
      return daysOfWeekArr.includes(dayOfWeek);
    } catch {
      // If JSON parse fails, treat as all days
      return true;
    }
  });

  return filtered;
}

// ── Apply a Single Rule ───────────────────────────────────────────────

/**
 * Applies a single pricing rule to a base price.
 * Returns the new price and a breakdown entry.
 *
 * Modifier types:
 * - multiplier: price * modifierValue (e.g., 1.5 = 50% increase)
 * - fixed: price = modifierValue (e.g., 250 = R$250)
 * - percent_increase: price * (1 + modifierValue/100) (e.g., 30 = +30%)
 * - percent_decrease: price * (1 - modifierValue/100) (e.g., 20 = -20%)
 */
export function applyRule(
  basePrice: number,
  rule: {
    id: string;
    name: string;
    modifierType: string;
    modifierValue: number;
    minPrice?: number | null;
    maxPrice?: number | null;
  },
): { newPrice: number; breakdown: ModifierBreakdownEntry } {
  let newPrice = basePrice;

  switch (rule.modifierType) {
    case 'multiplier':
      newPrice = basePrice * rule.modifierValue;
      break;
    case 'fixed':
      newPrice = rule.modifierValue;
      break;
    case 'percent_increase':
      newPrice = basePrice * (1 + rule.modifierValue / 100);
      break;
    case 'percent_decrease':
      newPrice = basePrice * (1 - rule.modifierValue / 100);
      break;
    default:
      // Unknown modifier type — treat as multiplier
      newPrice = basePrice * rule.modifierValue;
  }

  // Apply floor (minPrice) and cap (maxPrice)
  if (rule.minPrice && newPrice < rule.minPrice) {
    newPrice = rule.minPrice;
  }
  if (rule.maxPrice && newPrice > rule.maxPrice) {
    newPrice = rule.maxPrice;
  }

  // Round to 2 decimal places
  newPrice = Math.round(newPrice * 100) / 100;

  // ── Notification bridge: alert when modifier is significant (>15% in absolute terms) ──
  // Non-blocking: never break the pricing engine.
  try {
    const modifierPercent =
      rule.modifierType === 'multiplier'
        ? (rule.modifierValue - 1) * 100
        : rule.modifierType === 'percent_increase'
          ? rule.modifierValue
          : rule.modifierType === 'percent_decrease'
            ? -rule.modifierValue
            : 0;
    if (Math.abs(modifierPercent) > 15) {
      // Dynamic import to avoid circular dependency at module load time
      import('@/lib/notifications/bridges')
        .then(({ bridgeDynamicPricingAlert }) =>
          bridgeDynamicPricingAlert({
            niche: 'pousada',
            ruleName: rule.name,
            roomName: rule.id,
            basePrice,
            calculatedPrice: newPrice,
            modifier: modifierPercent,
          })
        )
        .catch((e) => console.error('[dynamic-pricing-engine] bridgeDynamicPricingAlert error:', e));
    }
  } catch (bridgeErr) {
    console.error('[dynamic-pricing-engine] bridge wrapper error:', bridgeErr);
  }

  const breakdown: ModifierBreakdownEntry = {
    ruleId: rule.id,
    ruleName: rule.name,
    modifierType: rule.modifierType,
    modifierValue: rule.modifierValue,
    priceBefore: basePrice,
    priceAfter: newPrice,
  };

  return { newPrice, breakdown };
}

// ── Get Occupancy Rate ────────────────────────────────────────────────

/**
 * Calculates the occupancy rate for a tenant on a given date.
 * Returns the rate as a percentage (0-100).
 */
async function getOccupancyRate(tenantId: string, _date: Date): Promise<number> {
  const property = await db.property.findFirst({
    where: { tenantId },
    include: { rooms: true },
  });

  if (!property || property.rooms.length === 0) return 0;

  const totalRooms = property.rooms.length;
  const occupiedRooms = property.rooms.filter(
    r => r.status === 'ocupado' || r.status === 'reservado'
  ).length;

  return Math.round((occupiedRooms / totalRooms) * 100);
}

// ── Get Base Price ────────────────────────────────────────────────────

/**
 * Gets the base price for a room. Falls back to the room's price field,
 * or a default of 150 if not set.
 */
async function getBasePriceForRoom(roomId: string): Promise<number> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { price: true },
  });
  return room?.price ?? 150;
}

/**
 * Gets the base price for an Airbnb property. Uses a default of 200
 * since AirBProperty doesn't have a price field.
 */
async function getBasePriceForAirBProperty(airbPropertyId: string): Promise<number> {
  const property = await db.airBProperty.findUnique({
    where: { id: airbPropertyId },
    select: { id: true },
  });
  // AirBProperty doesn't have a basePrice field — use default
  return property ? 200 : 150;
}

// ── Main Calculation ──────────────────────────────────────────────────

/**
 * Calculates the dynamic price for a daily rate.
 *
 * Algorithm:
 * 1. Start with basePrice (from room or AirBProperty)
 * 2. Check if the date is a Brazilian holiday → add holiday premium
 * 3. Determine seasonality → add season modifier
 * 4. Check day of week → weekend premium for Friday/Saturday
 * 5. Calculate days before check-in → urgency pricing (last-minute discount or early-bird premium)
 * 6. Get occupancy rate → demand-based pricing
 * 7. Apply all applicable DynamicPricingRule from DB (in priority order)
 * 8. Cache result in PricingCalculation model
 *
 * @param tenantId   - Tenant ID for rule lookup
 * @param roomId     - Room ID (optional, for pousada rooms)
 * @param airbPropertyId - AirBProperty ID (optional, for Airbnb listings)
 * @param date       - Target date for the daily rate
 * @param basePrice  - Override base price (optional; if null, fetched from room/property)
 * @param occupancyRate - Override occupancy rate (optional; if null, calculated from DB)
 */
export async function calculateDynamicPrice(
  tenantId: string,
  roomId: string | null,
  airbPropertyId: string | null,
  date: Date,
  basePrice?: number | null,
  occupancyRate?: number | null,
): Promise<PricingCalculationResult> {
  // ── 1. Resolve base price ──
  let resolvedBasePrice = basePrice;
  if (resolvedBasePrice == null) {
    if (roomId) {
      resolvedBasePrice = await getBasePriceForRoom(roomId);
    } else if (airbPropertyId) {
      resolvedBasePrice = await getBasePriceForAirBProperty(airbPropertyId);
    } else {
      // No room/property specified — use tenant's average room price
      const property = await db.property.findFirst({
        where: { tenantId },
        include: { rooms: true },
      });
      if (property && property.rooms.length > 0) {
        const avgPrice = property.rooms.reduce((sum, r) => sum + r.price, 0) / property.rooms.length;
        resolvedBasePrice = Math.round(avgPrice * 100) / 100;
      } else {
        resolvedBasePrice = 150;
      }
    }
  }

  // ── 2. Resolve occupancy rate ──
  const resolvedOccupancy = occupancyRate ?? await getOccupancyRate(tenantId, date);

  // ── 3. Calculate days before check-in ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const daysBefore = Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // ── 4. Check Brazilian holiday ──
  // Try to determine state from property location
  const property = await db.property.findFirst({
    where: { tenantId },
    select: { state: true },
  });
  const propertyState = property?.state || undefined;

  const holiday = isBrazilianHoliday(formatDate(date), propertyState);

  // ── 5. Determine season ──
  const season = getSeasonForDate(date);

  // ── 6. Determine day of week ──
  const dayOfWeek = date.getDay();
  const dayLabel = DAY_OF_WEEK_LABELS[dayOfWeek] ?? 'Desconhecido';

  // ── 7. Start with base price and apply built-in modifiers ──
  let currentPrice = resolvedBasePrice;
  const breakdown: ModifierBreakdownEntry[] = [];

  // Holiday premium (built-in: +40% for national, +25% for state)
  if (holiday) {
    const holidayMultiplier = holiday.type === 'national' ? 1.4 : 1.25;
    const priceBefore = currentPrice;
    currentPrice = Math.round(currentPrice * holidayMultiplier * 100) / 100;
    breakdown.push({
      ruleId: 'builtin_holiday',
      ruleName: `Feriado: ${holiday.name}`,
      modifierType: 'multiplier',
      modifierValue: holidayMultiplier,
      priceBefore,
      priceAfter: currentPrice,
    });
  }

  // Seasonality modifier (built-in)
  if (season.defaultMultiplier !== 1.0) {
    const priceBefore = currentPrice;
    currentPrice = Math.round(currentPrice * season.defaultMultiplier * 100) / 100;
    breakdown.push({
      ruleId: 'builtin_season',
      ruleName: `Season: ${season.label}`,
      modifierType: 'multiplier',
      modifierValue: season.defaultMultiplier,
      priceBefore,
      priceAfter: currentPrice,
    });
  }

  // Weekend premium (built-in: +15% for Friday and Saturday nights)
  if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday=5, Saturday=6
    const priceBefore = currentPrice;
    currentPrice = Math.round(currentPrice * 1.15 * 100) / 100;
    breakdown.push({
      ruleId: 'builtin_weekend',
      ruleName: `Weekend Premium (${dayLabel})`,
      modifierType: 'multiplier',
      modifierValue: 1.15,
      priceBefore,
      priceAfter: currentPrice,
    });
  }

  // Urgency pricing (built-in: last-minute discount or early-bird)
  if (daysBefore <= 3 && daysBefore > 0) {
    // Last-minute: slight discount to fill rooms (-10%)
    const priceBefore = currentPrice;
    currentPrice = Math.round(currentPrice * 0.90 * 100) / 100;
    breakdown.push({
      ruleId: 'builtin_lastminute',
      ruleName: `Last-Minute Discount (${daysBefore}d antes)`,
      modifierType: 'multiplier',
      modifierValue: 0.90,
      priceBefore,
      priceAfter: currentPrice,
    });
  } else if (daysBefore >= 30) {
    // Early-bird: small premium for advance booking (+5%)
    const priceBefore = currentPrice;
    currentPrice = Math.round(currentPrice * 1.05 * 100) / 100;
    breakdown.push({
      ruleId: 'builtin_earlybird',
      ruleName: `Early-Bird Premium (${daysBefore}d antes)`,
      modifierType: 'multiplier',
      modifierValue: 1.05,
      priceBefore,
      priceAfter: currentPrice,
    });
  }

  // High-demand pricing (built-in: +20% if occupancy > 80%)
  if (resolvedOccupancy > 80) {
    const priceBefore = currentPrice;
    const demandMultiplier = 1 + (resolvedOccupancy - 80) / 100; // progressive: 80% → 1.0x, 100% → 1.2x
    currentPrice = Math.round(currentPrice * demandMultiplier * 100) / 100;
    breakdown.push({
      ruleId: 'builtin_highdemand',
      ruleName: `High Demand (${resolvedOccupancy}% ocupação)`,
      modifierType: 'multiplier',
      modifierValue: demandMultiplier,
      priceBefore,
      priceAfter: currentPrice,
    });
  }

  // ── 8. Apply tenant-specific rules from DB ──
  const applicableRules = await getApplicableRules(tenantId, date, resolvedOccupancy, daysBefore);

  for (const rule of applicableRules) {
    const result = applyRule(currentPrice, rule);
    currentPrice = result.newPrice;
    breakdown.push(result.breakdown);
  }

  // ── 9. Cache result in PricingCalculation ──
  try {
    const calculationData = {
      tenantId,
      roomId: roomId ?? null,
      airbPropertyId: airbPropertyId ?? null,
      date,
      basePrice: resolvedBasePrice,
      calculatedPrice: currentPrice,
      modifierBreakdown: JSON.stringify(breakdown),
      occupancyAtCalc: resolvedOccupancy,
      daysBeforeCheckIn: daysBefore,
      appliedRulesCount: applicableRules.length,
    };

    // Upsert: create or update if already exists for this tenant+room+date
    if (roomId) {
      await db.pricingCalculation.upsert({
        where: {
          tenantId_roomId_date: {
            tenantId,
            roomId,
            date,
          },
        },
        create: calculationData,
        update: calculationData,
      });
    } else {
      // No unique constraint without roomId — just create
      await db.pricingCalculation.create({ data: calculationData });
    }
  } catch (cacheError) {
    // Cache failure shouldn't break pricing — log and continue
    console.error('[DynamicPricing] Cache write failed:', cacheError);
  }

  // ── 10. Update rule stats (appliedCount, revenueImpact) ──
  for (const rule of applicableRules) {
    try {
      await db.dynamicPricingRule.update({
        where: { id: rule.id },
        data: {
          appliedCount: { increment: 1 },
          revenueImpact: { increment: currentPrice - resolvedBasePrice },
        },
      });
    } catch {
      // Non-critical — skip
    }
  }

  return {
    basePrice: resolvedBasePrice,
    calculatedPrice: currentPrice,
    modifierBreakdown: breakdown,
    appliedRulesCount: applicableRules.length,
    occupancyAtCalc: resolvedOccupancy,
    daysBeforeCheckIn: daysBefore,
    isHoliday: holiday !== null,
    holidayName: holiday?.name,
    seasonLabel: season.label,
    dayOfWeekLabel: dayLabel,
  };
}

// ── Batch Calculation ─────────────────────────────────────────────────

/**
 * Calculates dynamic prices for all rooms over a date range.
 * Returns a map of roomId → date → PricingCalculationResult.
 *
 * @param tenantId  - Tenant ID
 * @param startDate - Start of the range
 * @param endDate   - End of the range (inclusive)
 */
export async function batchCalculatePrices(
  tenantId: string,
  startDate: Date,
  endDate: Date,
): Promise<Record<string, Record<string, PricingCalculationResult>>> {
  const property = await db.property.findFirst({
    where: { tenantId },
    include: { rooms: true },
  });

  if (!property || property.rooms.length === 0) {
    return {};
  }

  const results: Record<string, Record<string, PricingCalculationResult>> = {};
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Get occupancy rate once (use current rate as approximation for all dates)
  const occupancyRate = await getOccupancyRate(tenantId, startDate);

  for (const room of property.rooms) {
    results[room.id] = {};

    for (let i = 0; i < days; i++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + i);

      const calculation = await calculateDynamicPrice(
        tenantId,
        room.id,
        null,
        targetDate,
        room.price,
        occupancyRate,
      );

      results[room.id][formatDate(targetDate)] = calculation;
    }
  }

  return results;
}

// ── Pricing Insights ─────────────────────────────────────────────────

/**
 * Returns pricing insights for a tenant: upcoming holidays, current season,
 * average price changes, and rule summaries.
 */
export async function getPricingInsights(tenantId: string): Promise<{
  upcomingHolidays: BrazilianHoliday[];
  currentSeason: string;
  averagePriceModifier: number;
  activeRulesCount: number;
  rulesByType: Record<string, number>;
  recentCalculationsCount: number;
  lastCalculationDate: string | null;
}> {
  const today = new Date();
  const next30Days = addDays(today, 30);

  // Get upcoming holidays in next 30 days
  const year = today.getFullYear();
  const nextYear = year + 1;
  const holidaysThisYear = getBrazilianHolidays(year);
  const holidaysNextYear = getBrazilianHolidays(nextYear);
  const allHolidays = [...holidaysThisYear, ...holidaysNextYear];

  const todayStr = formatDate(today);
  const next30Str = formatDate(next30Days);
  const upcomingHolidays = allHolidays.filter(h => h.date >= todayStr && h.date <= next30Str);

  // Current season
  const currentSeason = getSeasonForDate(today);

  // Active rules
  const activeRules = await db.dynamicPricingRule.findMany({
    where: { tenantId, status: 'active' },
  });

  // Rules by type
  const rulesByType: Record<string, number> = {};
  for (const rule of activeRules) {
    rulesByType[rule.type] = (rulesByType[rule.type] || 0) + 1;
  }

  // Average modifier from active rules
  const averagePriceModifier = activeRules.length > 0
    ? activeRules.reduce((sum: number, r: any) => sum + r.modifierValue, 0) / activeRules.length
    : 1.0;

  // Recent calculations
  const recentCalc = await db.pricingCalculation.findMany({
    where: {
      tenantId,
      createdAt: { gte: addDays(today, -7) },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const recentCalcCount = await db.pricingCalculation.count({
    where: {
      tenantId,
      createdAt: { gte: addDays(today, -7) },
    },
  });

  return {
    upcomingHolidays,
    currentSeason: currentSeason.label,
    averagePriceModifier,
    activeRulesCount: activeRules.length,
    rulesByType,
    recentCalculationsCount: recentCalcCount,
    lastCalculationDate: recentCalc.length > 0 ? formatDate(recentCalc[0].createdAt) : null,
  };
}
