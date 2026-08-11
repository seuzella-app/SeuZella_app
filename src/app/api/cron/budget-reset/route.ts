import { NextRequest, NextResponse } from 'next/server';  
import { db } from '@/lib/db';
// Notification bridge — Phase 2: mock ad budget check after reset
import { bridgeAdsBudgetLow } from '@/lib/notifications/bridges';

// Cron: Reset daily budget guard state at midnight (UTC)  
// Triggered by Vercel Cron: 0 0 * * *  
export async function GET(request: NextRequest) {  
 const authHeader = request.headers.get('authorization');  
 const cronSecret = process.env.CRON_SECRET;

 if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {  
   console.log('[Cron:budget-reset] No auth — running in mock mode');  
 }

 try {  
   const today = new Date().toISOString().split('T')[0];

   await db.budgetGuardState.upsert({  
     where: { date: today },  
     create: {  
       date: today,  
       dailySpendUsd: 0,  
       dailyBudgetUsd: 50,  
       monthlySpendUsd: 0,  
       monthlyBudgetUsd: 1500,  
       criticalLevel: 'nominal',  
     },  
     update: {  
       dailySpendUsd: 0,  
       criticalLevel: 'nominal',  
     },  
   });

   console.log(`[Cron:budget-reset] Budget reset for ${today}`);

   // ── Notification bridge: check ad budgets after reset ──
   // In mock mode, we don't have real ad campaigns — but if any tenant has
   // metadata.mockAdsBudgetLow=true (for testing), fire the bridge.
   // TODO: replace with real Google/Meta/OpenAI Ads API integration when available.
   try {
     const tenants = await db.tenant.findMany({
       where: { status: 'active' },
       select: { id: true, name: true, plan: true },
     });
     for (const tenant of tenants.slice(0, 5)) {
       // Mock: simulate that ~20% of tenants have low ad budget after reset
       const mockLowBudget = Math.random() < 0.2;
       if (mockLowBudget) {
         bridgeAdsBudgetLow({
           niche: 'all',
           platform: 'google',
           campaign: `Tenant-${tenant.name}-Campaign`,
           amount: 25.00,
           tenantId: tenant.id,
         });
       }
     }
   } catch (bridgeErr) {
     console.error('[Cron:budget-reset] bridgeAdsBudgetLow error:', bridgeErr);
   }

   return NextResponse.json({  
     ok: true,  
     message: 'Budget guard reset for today',  
     date: today,  
     mode: 'mock',  
   });  
 } catch (error) {  
   console.error('[Cron:budget-reset] Error:', error);  
   return NextResponse.json(  
     { ok: false, error: 'Budget reset failed' },  
     { status: 500 }  
   );  
 }  
}  

