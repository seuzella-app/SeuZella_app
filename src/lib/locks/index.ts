// =============================================================================
// 🔐 SEU ZÉLLA — API pública do módulo de Fechaduras Eletrônicas
// =============================================================================

// Tipos, catálogo e capacidades — seguros para leitura client-side.
export * from './types';
export * from './provider-capabilities';

// Política de autorização — regras puras, sem acesso a DB.
export {
  authorizeLockAccess,
  nextLockAccessState,
  canTellGuestAccessConfirmed,
  LockAuthorizationError,
} from './authorization';

// Gerador criptográfico e derivação de status.
export {
  generateRandomPin,
  generateAlphanumericPin,
  generateTOTP,
  verifyTOTP,
  derivePinStatus,
  calculatePinValidityWindow,
  generateEmergencyPin,
} from './pin-generator';

// Orquestrador — server-only.
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
  remoteUnlock,
} from './orchestrator';

// Entrega — server-only.
export { deliverPinViaWhatsApp, buildPinMessagePreview } from './whatsapp-delivery';
