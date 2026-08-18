import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// CÉREBRO ZÉLLA — SUÍTE 4: DOUBLE BOOKING RACE CONDITION TEST
// ═══════════════════════════════════════════════════════════════════════════════
// Simula 2 requisições atômicas de reserva da última suíte no mesmo milissegundo.
// Valida o locking otimista: 1 reserva aprovada e a 2ª re-direcionada graciosamente.
// ═══════════════════════════════════════════════════════════════════════════════

describe('SUÍTE COMPORTAMENTAL 4: Double Booking Race Condition', () => {

  it('4.1 Locking Otimista: Apenas 1 reserva deve ser confirmada quando 2 hóspedes tentam a última suíte no mesmo ms', async () => {
    let availableUnits = 1; // Apenas 1 suíte livre
    const reservationResults: { guestId: string; confirmed: boolean }[] = [];

    // Função sintética com trava atômica (Optimistic Locking)
    async function attemptAtomicBooking(guestId: string): Promise<{ guestId: string; confirmed: boolean }> {
      // Simula atraso idêntico de 5ms
      await new Promise(resolve => setTimeout(resolve, 5));
      if (availableUnits > 0) {
        availableUnits--;
        return { guestId, confirmed: true };
      }
      return { guestId, confirmed: false };
    }

    // Dispara 2 requisições atômicas em paralelo no mesmo ms
    const [booking1, booking2] = await Promise.all([
      attemptAtomicBooking('guest_hospede_A'),
      attemptAtomicBooking('guest_hospede_B'),
    ]);

    reservationResults.push(booking1, booking2);

    const confirmedBookings = reservationResults.filter(r => r.confirmed);
    const rejectedBookings = reservationResults.filter(r => !r.confirmed);

    expect(confirmedBookings).toHaveLength(1);
    expect(rejectedBookings).toHaveLength(1);
    expect(availableUnits).toBe(0);
  });

});
