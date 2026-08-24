# M6 — Safe Suspension and Reactivation

## Suspension
Suspension can restrict commercial operations while preserving tenant data, audit history, reservations and fiscal records.

## Reactivation
Reactivation requires:
- valid billing state;
- no unresolved security block;
- explicit audit record;
- restored access to applicable tenant capabilities.

## Safety invariant
A billing suspension must never silently delete tenant data or revoke historical fiscal/payment evidence.
