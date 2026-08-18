// =============================================================================
// 🔐 SEU ZÉLLA — Barrel exports do módulo de Fechaduras Eletrônicas
// =============================================================================
// Tudo que precisa ser importado de fora vem daqui.
// =============================================================================

// Tipos e catálogo de marcas (seguro para client-side)
export * from './types';

// Gerador de PIN (algumas funções são client-safe)
export {
  generateRandomPin,
  generateAlphanumericPin,
  generateTOTP,
  verifyTOTP,
  derivePinStatus,
  calculatePinValidityWindow,
  generateEmergencyPin,
} from './pin-generator';

// Orquestrador (server-only) — NÃO importar em componentes client
export {
  createLockDevice,
  listLockDevices,
  getLockDevice,
  updateLockDevice,
  deleteLockDevice,
  generatePin,
  listPins,
  revokePin,
  panicRevokeAllPins,
  listLockEvents,
} from './orchestrator';

// Entrega via WhatsApp (server-only)
export { deliverPinViaWhatsApp, buildPinMessagePreview } from './whatsapp-delivery';
