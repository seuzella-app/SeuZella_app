// ============================================================================
// IWhatsAppAdapter — contract for WhatsApp Business / OpenWA integration
// ============================================================================

export interface WhatsAppMessageInput {
  /** Phone in E.164 format, e.g. +5511999990000. */
  to: string;
  body: string;
  /** Optional media URL (image, audio, document). */
  mediaUrl?: string;
  /** Template name if using a pre-approved WhatsApp template. */
  templateName?: string;
  templateParams?: Record<string, string>;
  /** Correlation id linking this message back to a lead / conversation. */
  correlationId?: string;
}

export interface WhatsAppMessage {
  messageId: string;
  from: string;
  to: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  correlationId?: string;
}

export interface IWhatsAppAdapter {
  /** Send an outbound message. Returns the message record. */
  send(input: WhatsAppMessageInput): Promise<WhatsAppMessage>;

  /**
   * In Real mode, this subscribes to inbound webhook deliveries.
   * In Digital Twin mode, this is invoked by the Behavioral Engine
   * to inject synthetic inbound messages.
   */
  onInbound(handler: (msg: WhatsAppMessage) => void | Promise<void>): () => void;

  /** Fetch recent messages for a phone number (both directions). */
  history(phone: string, limit?: number): Promise<WhatsAppMessage[]>;

  /** Mark a conversation as read. */
  markRead(phone: string): Promise<void>;

  isDigitalTwin(): boolean;
}
