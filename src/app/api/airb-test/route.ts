import { checkRateLimit, rateLimitResponse } from '../../../lib/cerebro/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { processAirBMessage, SAMPLE_AIRBNB_CONTEXT, classifyAirBIntent, ZellaAirBStrategy, type OperatingMode } from '@/lib/strategies/ZellaAirBStrategy';

function unavailableInProduction() {
  return process.env.NODE_ENV === 'production'
    ? NextResponse.json({ error: 'NOT_AVAILABLE_IN_PRODUCTION' }, { status: 404 })
    : null;
}

export async function POST(request: NextRequest) {
  // [RUN10-W2 10B] rate-limit fail-closed (in-memory; Redis opcional no RUN11)
  {
    const __rl = checkRateLimit(request, 'api/airb-test#POST');
    if (!__rl.ok) return rateLimitResponse(__rl);
  }

  const blocked = unavailableInProduction();
  if (blocked) return blocked;
  try {
    const body = await request.json();
    const { message, context } = body as { message: string; context?: typeof SAMPLE_AIRBNB_CONTEXT };
    if (!message || typeof message !== 'string' || message.length > 10000) return NextResponse.json({ error: 'INVALID_MESSAGE' }, { status: 400 });
    const result = await processAirBMessage(message, context || SAMPLE_AIRBNB_CONTEXT);
    return NextResponse.json({ success: true, mode: 'airbnb' as OperatingMode, classification: { intent: result.intent, confidence: result.confidence }, prompts: { system: result.systemPrompt, user: result.userPrompt }, toolResults: result.toolResults, readyForLLM: result.readyForLLM }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[airb-test]', error);
    return NextResponse.json({ error: 'AIRB_TEST_FAILED' }, { status: 500 });
  }
}

export async function GET() {
  const blocked = unavailableInProduction();
  if (blocked) return blocked;
  const strategy = new ZellaAirBStrategy();
  const testMessages = [
    { message: 'Cheguei! Como faço pra entrar?', expectedIntent: 'SELF_CHECK_IN' },
    { message: 'Qual a senha do wifi?', expectedIntent: 'WIFI_INFO' },
    { message: 'Posso ter visita?', expectedIntent: 'HOUSE_RULES' },
    { message: 'Como liga o ar do quarto?', expectedIntent: 'EQUIPMENT_HELP' },
    { message: 'Tem padaria perto?', expectedIntent: 'NEIGHBORHOOD_TIPS' },
    { message: 'Onde estaciono?', expectedIntent: 'PARKING_INFO' },
    { message: 'Vazou água na cozinha!', expectedIntent: 'EMERGENCY' },
    { message: 'Oi!', expectedIntent: 'HOST_GREETING' },
    { message: 'Obrigado por tudo!', expectedIntent: 'HOST_FAREWELL' },
    { message: 'Posso ficar mais um dia?', expectedIntent: 'EXTEND_STAY' },
    { message: 'Preciso de toalhas limpas', expectedIntent: 'CLEANING_REQUEST' },
    { message: 'O chuveiro não esquenta', expectedIntent: 'MAINTENANCE_ISSUE' },
    { message: 'O que fazer por aqui?', expectedIntent: 'LOCAL_RECOMMENDATION' },
    { message: 'Quero falar com o dono', expectedIntent: 'HUMAN_HANDOVER' },
    { message: 'Quanto custa a diária?', expectedIntent: 'UNKNOWN' },
  ] as const;
  const classificationResults = testMessages.map(({ message, expectedIntent }) => { const result = classifyAirBIntent(message); return { message, expectedIntent, classifiedIntent: result.intent, confidence: result.confidence, method: result.method, correct: result.intent === expectedIntent }; });
  return NextResponse.json({ mode: strategy.mode, shouldIncludeSalesCTA: strategy.shouldIncludeSalesCTA(), sampleContext: { name: SAMPLE_AIRBNB_CONTEXT.name, type: SAMPLE_AIRBNB_CONTEXT.type, city: SAMPLE_AIRBNB_CONTEXT.city, hostKnowledgeCount: SAMPLE_AIRBNB_CONTEXT.hostKnowledge.length, neighborhoodTipsCount: SAMPLE_AIRBNB_CONTEXT.neighborhoodTips.length, equipmentCount: SAMPLE_AIRBNB_CONTEXT.equipment.length }, classificationTests: classificationResults, accuracy: classificationResults.filter(r => r.correct).length / classificationResults.length }, { headers: { 'Cache-Control': 'no-store' } });
}
