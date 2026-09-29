/**
 * Zélla — Notification Catalog (74 types across 9 categories)
 * Mock Mode — all data is placeholder
 *
 * Each entry declares: type, category, default priority, default plan, source.
 * Producer functions consult this catalog for defaults.
 */

import type {
  NotificationCategory,
  NotificationPriority,
  NotificationSource,
  PlanAvailability,
} from './types';

export interface CatalogEntry {
  type: string;
  category: NotificationCategory;
  defaultPriority: NotificationPriority;
  defaultPlan: PlanAvailability;
  source: NotificationSource;
  titleTemplate: string;
  messageTemplate: string;
  description?: string;
}

// ─── Catalog (74 entries) ──────────────────────────────────────────────────
export const NOTIFICATION_CATALOG: CatalogEntry[] = [
  // ═══ RESERVATIONS (12) ═══════════════════════════════════════════════════
  { type: 'booking.created', category: 'reservations', defaultPriority: 'high', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Nova reserva solicitada', messageTemplate: '{guestName} quer reservar {roomName} ({checkIn} → {checkOut})' },
  { type: 'booking.confirmed', category: 'reservations', defaultPriority: 'high', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Reserva confirmada', messageTemplate: 'Reserva #{bookingId} confirmada para {guestName}' },
  { type: 'booking.cancelled', category: 'reservations', defaultPriority: 'high', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Reserva cancelada', messageTemplate: '{guestName} cancelou a reserva #{bookingId}' },
  { type: 'booking.modified', category: 'reservations', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Reserva modificada', messageTemplate: 'Reserva #{bookingId} teve datas alteradas por {guestName}' },
  { type: 'booking.checkin_today', category: 'reservations', defaultPriority: 'high', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Check-in hoje', messageTemplate: '{guestName} chega hoje no {roomName}' },
  { type: 'booking.checkout_today', category: 'reservations', defaultPriority: 'high', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Check-out hoje', messageTemplate: '{guestName} sai hoje do {roomName} até as 11h' },
  { type: 'booking.checkout_overdue', category: 'reservations', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Check-out atrasado', messageTemplate: '{guestName} ultrapassou o horário de check-out no {roomName}' },
  { type: 'booking.no_show', category: 'reservations', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'No-show registrado', messageTemplate: '{guestName} não compareceu para a reserva #{bookingId}' },
  { type: 'booking.double_booking', category: 'reservations', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Conflito de reservas', messageTemplate: 'Dupla reserva detectada no {roomName} em {date}' },
  { type: 'booking.escalated', category: 'reservations', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Reserva escalonada para humano', messageTemplate: '{guestName} precisa de atenção humana — conversa escalonada' },
  { type: 'booking.waitlist_open', category: 'reservations', defaultPriority: 'medium', defaultPlan: 'PRO', source: 'reservation_flow', titleTemplate: 'Vaga liberada na fila de espera', messageTemplate: 'Uma vaga para {roomName} em {date} foi liberada' },
  { type: 'booking.review_request', category: 'reservations', defaultPriority: 'low', defaultPlan: 'ALL', source: 'reservation_flow', titleTemplate: 'Solicitar avaliação', messageTemplate: 'Pedir avaliação a {guestName} após a estadia' },

  // ═══ FINANCIAL (10) ══════════════════════════════════════════════════════
  { type: 'payment.pix_received', category: 'financial', defaultPriority: 'high', defaultPlan: 'ALL', source: 'webhook_payment', titleTemplate: 'PIX recebido', messageTemplate: 'R$ {amount} confirmado de {guestName}' },
  { type: 'payment.card_received', category: 'financial', defaultPriority: 'high', defaultPlan: 'ALL', source: 'webhook_payment', titleTemplate: 'Pagamento no cartão aprovado', messageTemplate: 'R$ {amount} via cartão de {guestName}' },
  { type: 'payment.pending', category: 'financial', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'webhook_payment', titleTemplate: 'Pagamento pendente', messageTemplate: 'Aguardando confirmação de R$ {amount} de {guestName}' },
  { type: 'payment.overdue', category: 'financial', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'webhook_payment', titleTemplate: 'Pagamento em atraso', messageTemplate: 'R$ {amount} de {guestName} venceu há {days} dias' },
  { type: 'payment.refunded', category: 'financial', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'webhook_payment', titleTemplate: 'Estorno processado', messageTemplate: 'R$ {amount} estornado para {guestName}' },
  { type: 'payment.failed', category: 'financial', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'webhook_payment', titleTemplate: 'Falha no pagamento', messageTemplate: 'Pagamento de R$ {amount} falhou para {guestName}' },
  { type: 'payment.ota_commission', category: 'financial', defaultPriority: 'low', defaultPlan: 'PRO', source: 'webhook_payment', titleTemplate: 'Comissão OTA debitada', messageTemplate: 'Booking.com cobrou R$ {amount} de comissão' },
  { type: 'financial.daily_summary', category: 'financial', defaultPriority: 'low', defaultPlan: 'PRO', source: 'manual', titleTemplate: 'Resumo financeiro do dia', messageTemplate: 'R$ {total} recebidos em {count} transações' },
  { type: 'financial.goal_reached', category: 'financial', defaultPriority: 'high', defaultPlan: 'MAX', source: 'manual', titleTemplate: 'Meta mensal atingida', messageTemplate: 'R$ {total} — meta de R$ {goal} alcançada' },
  { type: 'financial.withdrawal', category: 'financial', defaultPriority: 'medium', defaultPlan: 'PRO', source: 'webhook_payment', titleTemplate: 'Saque processado', messageTemplate: 'Saque de R$ {amount} creditado na conta final {last4}' },

  // ═══ GUESTS (8) ══════════════════════════════════════════════════════════
  { type: 'guest.new_lead', category: 'guests', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'whatsapp', titleTemplate: 'Novo lead recebido', messageTemplate: '{guestName} iniciou conversa via WhatsApp' },
  { type: 'guest.hot_lead', category: 'guests', defaultPriority: 'high', defaultPlan: 'ALL', source: 'whatsapp', titleTemplate: 'Lead quente detectado', messageTemplate: '{guestName} tem alta intenção de reserva' },
  { type: 'guest.returning', category: 'guests', defaultPriority: 'medium', defaultPlan: 'PRO', source: 'whatsapp', titleTemplate: 'Hóspede retornando', messageTemplate: '{guestName} já se hospedou {count}× conosco' },
  { type: 'guest.complaint', category: 'guests', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'whatsapp', titleTemplate: 'Reclamação registrada', messageTemplate: '{guestName} registrou uma reclamação sobre {topic}' },
  { type: 'guest.escalation', category: 'guests', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'whatsapp', titleTemplate: 'Conversa escalonada', messageTemplate: '{guestName} solicitou atendente humano' },
  { type: 'guest.birthday', category: 'guests', defaultPriority: 'low', defaultPlan: 'PRO', source: 'manual', titleTemplate: 'Aniversário do hóspede', messageTemplate: '{guestName} faz aniversário hoje' },
  { type: 'guest.feedback_positive', category: 'guests', defaultPriority: 'low', defaultPlan: 'PRO', source: 'whatsapp', titleTemplate: 'Feedback positivo', messageTemplate: '{guestName} elogiou: "{feedback}"' },
  { type: 'guest.feedback_negative', category: 'guests', defaultPriority: 'high', defaultPlan: 'PRO', source: 'whatsapp', titleTemplate: 'Feedback negativo', messageTemplate: '{guestName} criticou: "{feedback}"' },

  // ═══ AI / Cérebro (10) ═══════════════════════════════════════════════════
  { type: 'ai.online', category: 'ai', defaultPriority: 'low', defaultPlan: 'ALL', source: 'cerebro', titleTemplate: 'IA Cérebro online', messageTemplate: 'Cérebro respondeu {count} conversas hoje' },
  { type: 'ai.offline', category: 'ai', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'cerebro', titleTemplate: 'IA Cérebro offline', messageTemplate: 'Cérebro parou de responder — intervenção necessária' },
  { type: 'ai.pattern_learned', category: 'ai', defaultPriority: 'low', defaultPlan: 'ALL', source: 'cerebro', titleTemplate: 'Novo padrão aprendido', messageTemplate: 'Cérebro aprendeu: "{pattern}"' },
  { type: 'ai.confidence_drop', category: 'ai', defaultPriority: 'high', defaultPlan: 'PRO', source: 'cerebro', titleTemplate: 'Queda de confiança da IA', messageTemplate: 'Confiança caiu para {percent}% em {count} conversas' },
  { type: 'ai.anomaly_response_time', category: 'ai', defaultPriority: 'high', defaultPlan: 'PRO', source: 'cerebro', titleTemplate: 'Tempo de resposta anômalo', messageTemplate: 'Tempo médio subiu para {seconds}s (normal: 8s)' },
  { type: 'ai.anomaly_conversion', category: 'ai', defaultPriority: 'high', defaultPlan: 'MAX', source: 'cerebro', titleTemplate: 'Queda de conversão detectada', messageTemplate: 'Conversão caiu {percent}% nas últimas 24h' },
  { type: 'ai.anomaly_revenue', category: 'ai', defaultPriority: 'urgent', defaultPlan: 'MAX', source: 'cerebro', titleTemplate: 'Anomalia de receita', messageTemplate: 'Receita diária {percent}% abaixo da média' },
  { type: 'ai.training_complete', category: 'ai', defaultPriority: 'low', defaultPlan: 'PRO', source: 'cerebro', titleTemplate: 'Treinamento concluído', messageTemplate: 'Cérebro processou {count} novos conhecimentos' },
  { type: 'ai.escalation_spike', category: 'ai', defaultPriority: 'high', defaultPlan: 'MAX', source: 'cerebro', titleTemplate: 'Pico de escalonamentos', messageTemplate: '{count} conversas escalonadas na última hora' },
  { type: 'ai.cost_alert', category: 'ai', defaultPriority: 'high', defaultPlan: 'MAX', source: 'cerebro', titleTemplate: 'Alerta de custo de IA', messageTemplate: 'Custo de tokens R$ {amount} este mês (limite: R$ {limit})' },

  // ═══ OPERATIONS (8) ══════════════════════════════════════════════════════
  { type: 'ical.sync_success', category: 'operations', defaultPriority: 'low', defaultPlan: 'ALL', source: 'ical', titleTemplate: 'iCal sincronizado', messageTemplate: '{count} atualizações de calendário importadas' },
  { type: 'ical.sync_failed', category: 'operations', defaultPriority: 'high', defaultPlan: 'ALL', source: 'ical', titleTemplate: 'Falha na sincronização iCal', messageTemplate: 'Não foi possível sincronizar o calendário {calendarName}' },
  { type: 'ical.conflict_detected', category: 'operations', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'ical', titleTemplate: 'Conflito de calendário', messageTemplate: 'Datas sobrepostas detectadas no {roomName}' },
  { type: 'ota.booking_sync', category: 'operations', defaultPriority: 'medium', defaultPlan: 'PRO', source: 'ota_booking', titleTemplate: 'Sincronização Booking.com', messageTemplate: '{count} reservas importadas do Booking.com' },
  { type: 'ota.airbnb_sync', category: 'operations', defaultPriority: 'medium', defaultPlan: 'PRO', source: 'ota_airbnb', titleTemplate: 'Sincronização Airbnb', messageTemplate: '{count} reservas importadas do Airbnb' },
  { type: 'ota.token_expired', category: 'operations', defaultPriority: 'high', defaultPlan: 'PRO', source: 'ota_booking', titleTemplate: 'Token OTA expirado', messageTemplate: 'Reconectar {provider} para continuar sincronização' },
  { type: 'ops.maintenance_needed', category: 'operations', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'manual', titleTemplate: 'Manutenção necessária', messageTemplate: '{roomName} reportado com problema: {issue}' },
  { type: 'ops.cleaning_reminder', category: 'operations', defaultPriority: 'medium', defaultPlan: 'PRO', source: 'reservation_flow', titleTemplate: 'Limpeza programada', messageTemplate: '{roomName} precisa de limpeza antes das 14h' },

  // ═══ MARKETING (8) ═══════════════════════════════════════════════════════
  { type: 'ads.google.budget_low', category: 'marketing', defaultPriority: 'medium', defaultPlan: 'PRO', source: 'google_ads', titleTemplate: 'Orçamento Google Ads baixo', messageTemplate: 'Campanha "{campaign}" tem R$ {amount} restante' },
  { type: 'ads.google.budget_exhausted', category: 'marketing', defaultPriority: 'high', defaultPlan: 'PRO', source: 'google_ads', titleTemplate: 'Orçamento Google Ads esgotado', messageTemplate: 'Campanha "{campaign}" parou — sem saldo' },
  { type: 'ads.google.performance', category: 'marketing', defaultPriority: 'low', defaultPlan: 'PRO', source: 'google_ads', titleTemplate: 'Relatório Google Ads', messageTemplate: 'CTR {ctr}% • {clicks} cliques • CPC R$ {cpc}' },
  { type: 'ads.meta.budget_low', category: 'marketing', defaultPriority: 'medium', defaultPlan: 'PRO', source: 'meta_ads', titleTemplate: 'Orçamento Meta Ads baixo', messageTemplate: 'Campanha "{campaign}" tem R$ {amount} restante' },
  { type: 'ads.meta.performance', category: 'marketing', defaultPriority: 'low', defaultPlan: 'PRO', source: 'meta_ads', titleTemplate: 'Relatório Meta Ads', messageTemplate: 'Alcance {reach} • {leads} leads • CPL R$ {cpl}' },
  { type: 'ads.openai.budget_low', category: 'marketing', defaultPriority: 'medium', defaultPlan: 'MAX', source: 'openai_ads', titleTemplate: 'Orçamento OpenAI Ads baixo', messageTemplate: 'Campanha "{campaign}" tem R$ {amount} restante' },
  { type: 'ads.openai.performance', category: 'marketing', defaultPriority: 'low', defaultPlan: 'MAX', source: 'openai_ads', titleTemplate: 'Relatório OpenAI Ads', messageTemplate: 'Impressões {impressions} • {leads} leads' },
  { type: 'ads.cross_platform_savings', category: 'marketing', defaultPriority: 'low', defaultPlan: 'MAX', source: 'manual', titleTemplate: 'Economia cross-plataforma', messageTemplate: 'R$ {amount} economizados vs. OTA este mês' },

  // ═══ SYSTEM (8) ══════════════════════════════════════════════════════════
  { type: 'system.plan_expiring', category: 'system', defaultPriority: 'high', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Plano expira em {days} dias', messageTemplate: 'Renove {plan} para manter todos os recursos' },
  { type: 'system.plan_expired', category: 'system', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Plano expirado', messageTemplate: 'Recursos do plano {plan} foram desativados' },
  { type: 'system.plan_upgraded', category: 'system', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Plano atualizado', messageTemplate: 'Bem-vindo ao plano {plan}!' },
  // F28-C: LITE quota notifications — previously MISSING from the catalog, so
  // notify() silently rejected every plan-limits alert as invalid_input and
  // users NEVER received them (surfaced by the F28 entitlement refactor tests).
  { type: 'plan.lite_guests_limit', category: 'system', defaultPriority: 'high', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Limite de hóspedes se aproximando', messageTemplate: '{count} de {limit} hóspedes atendidos neste mês ({percent}% do plano LITE)' },
  { type: 'plan.lite_messages_limit', category: 'system', defaultPriority: 'high', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Limite de mensagens se aproximando', messageTemplate: '{count} de {limit} mensagens usadas neste mês ({percent}% do plano LITE)' },
  { type: 'plan.lite_exceeded', category: 'system', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Limite do plano LITE excedido', messageTemplate: '{message}' },
  { type: 'plan.upgrade_suggestion', category: 'system', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Hora de considerar o plano PRO', messageTemplate: 'Uso acima de 60% no LITE: hóspedes {guestsPercent}%, mensagens {messagesPercent}% — o PRO é ilimitado' },
  { type: 'system.invoice_ready', category: 'system', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Fatura disponível', messageTemplate: 'Fatura de R$ {amount} referente a {period}' },
  { type: 'system.payment_failed', category: 'system', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Falha no pagamento da assinatura', messageTemplate: 'Cartão final {last4} foi recusado' },
  { type: 'system.security_alert', category: 'system', defaultPriority: 'urgent', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Alerta de segurança', messageTemplate: 'Login suspeito bloqueado de {ip}' },
  { type: 'system.maintenance', category: 'system', defaultPriority: 'low', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Manutenção programada', messageTemplate: 'Sistema indisponível em {date} das {start} às {end}' },
  { type: 'system.feature_released', category: 'system', defaultPriority: 'low', defaultPlan: 'ALL', source: 'plan_system', titleTemplate: 'Novo recurso disponível', messageTemplate: '{feature} agora está disponível no seu plano' },

  // ═══ ACHIEVEMENTS (5 — PARCEIRO ZÉLLA) ══════════════════════════════════
  { type: 'achievement.first_booking', category: 'achievements', defaultPriority: 'medium', defaultPlan: 'PARCEIRO_ZELLA', source: 'achievement_engine', titleTemplate: 'Primeira reserva via Zélla!', messageTemplate: 'Parabéns! Você converteu sua primeira reserva.' },
  { type: 'achievement.milestone_10', category: 'achievements', defaultPriority: 'medium', defaultPlan: 'PARCEIRO_ZELLA', source: 'achievement_engine', titleTemplate: 'Marco: 10 reservas', messageTemplate: 'Você atingiu 10 reservas via Zélla este mês.' },
  { type: 'achievement.milestone_100', category: 'achievements', defaultPriority: 'high', defaultPlan: 'PARCEIRO_ZELLA', source: 'achievement_engine', titleTemplate: 'Marco: 100 reservas', messageTemplate: 'Incrível! 100 reservas via Zélla.' },
  { type: 'achievement.revenue_record', category: 'achievements', defaultPriority: 'high', defaultPlan: 'PARCEIRO_ZELLA', source: 'achievement_engine', titleTemplate: 'Recorde de receita mensal', messageTemplate: 'R$ {amount} — maior receita mensal da história.' },
  { type: 'achievement.partner_level_up', category: 'achievements', defaultPriority: 'high', defaultPlan: 'PARCEIRO_ZELLA', source: 'achievement_engine', titleTemplate: 'Subiu de nível no Programa Parceiro', messageTemplate: 'Agora você é Parceiro {level}!' },

  // ═══ EXTERNAL (5) ════════════════════════════════════════════════════════
  { type: 'external.review_positive', category: 'external', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'ota_booking', titleTemplate: 'Nova avaliação 5 estrelas', messageTemplate: '{guestName} deixou 5 estrelas no Booking.com' },
  { type: 'external.review_negative', category: 'external', defaultPriority: 'high', defaultPlan: 'ALL', source: 'ota_booking', titleTemplate: 'Nova avaliação negativa', messageTemplate: '{guestName} deixou {stars} estrelas — resposta necessária' },
  { type: 'external.review_response', category: 'external', defaultPriority: 'low', defaultPlan: 'PRO', source: 'ota_booking', titleTemplate: 'Resposta à avaliação publicada', messageTemplate: 'Sua resposta a {guestName} foi publicada' },
  { type: 'external.weather_alert', category: 'external', defaultPriority: 'medium', defaultPlan: 'ALL', source: 'manual', titleTemplate: 'Alerta climático', messageTemplate: 'Previsão de {condition} em {date} — avise os hóspedes' },
  { type: 'external.local_event', category: 'external', defaultPriority: 'low', defaultPlan: 'PRO', source: 'manual', titleTemplate: 'Evento local próximo', messageTemplate: '{eventName} em {date} — oportunidade de upsell' },
];

// ─── Lookup map ────────────────────────────────────────────────────────────
export const CATALOG_BY_TYPE: Record<string, CatalogEntry> = NOTIFICATION_CATALOG.reduce(
  (acc, entry) => {
    acc[entry.type] = entry;
    return acc;
  },
  {} as Record<string, CatalogEntry>
);

export function getCatalogEntry(type: string): CatalogEntry | undefined {
  return CATALOG_BY_TYPE[type];
}

export function listCatalogByCategory(category: NotificationCategory): CatalogEntry[] {
  return NOTIFICATION_CATALOG.filter((e) => e.category === category);
}

export function listCatalogBySource(source: NotificationSource): CatalogEntry[] {
  return NOTIFICATION_CATALOG.filter((e) => e.source === source);
}
