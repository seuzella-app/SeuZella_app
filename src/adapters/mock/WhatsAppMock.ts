// ============================================================================
// WhatsAppMock — Digital Twin WhatsApp Business / Meta Cloud API
// ----------------------------------------------------------------------------
// Records every outbound message with status 'sent'. The Behavioral Engine
// drives inbound messages through `simulateInbound()`.
// ============================================================================

import type {
  IWhatsAppAdapter,
  WhatsAppMessageInput,
  WhatsAppMessage,
} from '../interfaces';

type InboundHandler = (msg: WhatsAppMessage) => void | Promise<void>;

class WhatsAppMock implements IWhatsAppAdapter {
  private messages: WhatsAppMessage[] = [];
  private inboundHandlers: InboundHandler[] = [];

  async send(input: WhatsAppMessageInput): Promise<WhatsAppMessage> {
    const msg: WhatsAppMessage = {
      messageId: `wa_out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from: 'system',
      to: input.to,
      body: input.body,
      direction: 'outbound',
      status: 'sent',
      timestamp: new Date().toISOString(),
      correlationId: input.correlationId,
    };
    this.messages.push(msg);
    // Simulate delivered → read progression.
    setTimeout(() => {
      const updated = { ...msg, status: 'delivered' as const };
      this.messages = this.messages.map((m) => (m.messageId === msg.messageId ? updated : m));
    }, 200);
    setTimeout(() => {
      const updated = { ...msg, status: 'read' as const };
      this.messages = this.messages.map((m) => (m.messageId === msg.messageId ? updated : m));
    }, 800);
    return msg;
  }

  onInbound(handler: InboundHandler): () => void {
    this.inboundHandlers.push(handler);
    return () => {
      this.inboundHandlers = this.inboundHandlers.filter((h) => h !== handler);
    };
  }

  async history(phone: string, limit = 100): Promise<WhatsAppMessage[]> {
    return this.messages
      .filter((m) => m.from === phone || m.to === phone)
      .slice(-limit);
  }

  async markRead(phone: string): Promise<void> {
    this.messages = this.messages.map((m) =>
      m.from === phone && m.direction === 'inbound' ? { ...m, status: 'read' } : m
    );
  }

  isDigitalTwin(): boolean {
    return true;
  }

  /**
   * Test/Behavioral Engine helper: inject an inbound message and dispatch
   * it to all registered handlers. This is how the Digital Twin simulates
   * a customer replying on WhatsApp.
   */
  async simulateInbound(from: string, body: string, correlationId?: string): Promise<WhatsAppMessage> {
    const msg: WhatsAppMessage = {
      messageId: `wa_in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from,
      to: 'system',
      body,
      direction: 'inbound',
      status: 'delivered',
      timestamp: new Date().toISOString(),
      correlationId,
    };
    this.messages.push(msg);
    for (const handler of this.inboundHandlers) {
      try {
        await handler(msg);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[WhatsAppMock] inbound handler failed:', err);
      }
    }
    return msg;
  }

  /** Test/observability helper. */
  allMessages(): WhatsAppMessage[] {
    return [...this.messages];
  }
}

export const whatsappMock = new WhatsAppMock();
