-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "property" TEXT,
    "category" TEXT DEFAULT 'pousada',
    "city" TEXT,
    "state" TEXT DEFAULT 'SC',
    "region" TEXT,
    "googleRating" REAL,
    "score" INTEGER,
    "painPoints" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SECRETARIA_AI',
    "status" TEXT NOT NULL DEFAULT 'PROSPECT',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "scoreValid" INTEGER NOT NULL DEFAULT 0,
    "localPraia" TEXT,
    "observacoes" TEXT,
    "isCanary" BOOLEAN NOT NULL DEFAULT false,
    "estimatedValues" TEXT,
    "intentSignals" TEXT,
    "location" TEXT,
    "phoneSecondary" TEXT,
    "qualification" TEXT,
    "socialMedia" TEXT,
    "site" TEXT,
    "validationScore" INTEGER NOT NULL DEFAULT 0,
    "validationStatus" TEXT NOT NULL DEFAULT 'pendente',
    "conversionScore" INTEGER NOT NULL DEFAULT 0,
    "funnelStage" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "lastInteractionAt" TIMESTAMP(3),
    "behavioralProfile" TEXT,
    "cluster" TEXT NOT NULL DEFAULT 'COLD',
    "previousCluster" TEXT,
    "lastSwipeAction" TEXT,
    "lastSwipeUsedId" TEXT,
    "tierConfidence" REAL,
    "tierSugerido" TEXT,
    "tierSugeridoEm" TIMESTAMP(3),
    "roomsCount" INTEGER NOT NULL DEFAULT 0,
    "instagramFollowers" INTEGER NOT NULL DEFAULT 0,
    "googleReviewsCount" INTEGER NOT NULL DEFAULT 0,
    "otaCommissionLost" REAL NOT NULL DEFAULT 0.0,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "otaDependenceLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "buyingBehavior" TEXT,
    "conversionProbability" REAL NOT NULL DEFAULT 0.0,
    "objectKeywords" TEXT,
    "recommendedPitch" TEXT,
    "leadTier" TEXT NOT NULL DEFAULT 'COLD'
);

-- CreateTable
CREATE TABLE "email_tracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "email_tracking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "intent" TEXT,
    "confidence" REAL,
    "input" TEXT,
    "output" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "security_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "swipe_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "category" TEXT NOT NULL DEFAULT 'saudacao',
    "tone" TEXT NOT NULL DEFAULT 'casual',
    "tier" TEXT NOT NULL DEFAULT 'universal',
    "painType" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "convRate" REAL NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "provenByConversion" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "swipe_usages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "swipeId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "wasUsed" BOOLEAN NOT NULL,
    "converted" BOOLEAN,
    "agentId" TEXT,
    "responseTimeMs" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "swipe_usages_swipeId_fkey" FOREIGN KEY ("swipeId") REFERENCES "swipe_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "swipe_usages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trend_keywords" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "geo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tier" TEXT NOT NULL DEFAULT 'pro',
    "checkFrequencyHours" INTEGER NOT NULL DEFAULT 6,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "trend_data_points" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keywordId" TEXT NOT NULL,
    "interestScore" INTEGER NOT NULL,
    "interestDelta" REAL,
    "volume" INTEGER,
    "geo" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "trend_data_points_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "trend_keywords" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trend_signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "interestScore" INTEGER NOT NULL,
    "deltaPercent" REAL NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'media',
    "geo" TEXT,
    "dateDetected" TIMESTAMP(3) NOT NULL,
    "previousScore" INTEGER,
    "agentsNotified" TEXT NOT NULL DEFAULT '[]',
    "actionTaken" BOOLEAN NOT NULL DEFAULT false,
    "actionDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "funnel_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "variant" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalConverted" INTEGER NOT NULL DEFAULT 0,
    "openRate" REAL NOT NULL DEFAULT 0,
    "clickRate" REAL NOT NULL DEFAULT 0,
    "conversionRate" REAL NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "funnel_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "painCluster" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "funnel_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "funnel_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "funnel_campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "funnel_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "intentScore" INTEGER NOT NULL DEFAULT 0,
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "cluster" TEXT NOT NULL DEFAULT 'COLD',
    "painCluster" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "lastClusterChange" TIMESTAMP(3),
    "previousCluster" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "funnel_scores_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "funnel_campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_phone_key" ON "leads"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_whatsapp_key" ON "leads"("whatsapp");

-- CreateIndex
CREATE INDEX "email_tracking_leadId_idx" ON "email_tracking"("leadId");

-- CreateIndex
CREATE INDEX "email_tracking_campaignId_idx" ON "email_tracking"("campaignId");

-- CreateIndex
CREATE INDEX "agent_logs_agentName_createdAt_idx" ON "agent_logs"("agentName", "createdAt");

-- CreateIndex
CREATE INDEX "security_alerts_tenantId_createdAt_idx" ON "security_alerts"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "security_alerts_severity_createdAt_idx" ON "security_alerts"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "swipe_templates_channel_idx" ON "swipe_templates"("channel");

-- CreateIndex
CREATE INDEX "swipe_templates_category_idx" ON "swipe_templates"("category");

-- CreateIndex
CREATE INDEX "swipe_templates_tier_idx" ON "swipe_templates"("tier");

-- CreateIndex
CREATE INDEX "swipe_templates_painType_idx" ON "swipe_templates"("painType");

-- CreateIndex
CREATE INDEX "swipe_templates_convRate_idx" ON "swipe_templates"("convRate");

-- CreateIndex
CREATE INDEX "swipe_templates_isActive_idx" ON "swipe_templates"("isActive");

-- CreateIndex
CREATE INDEX "swipe_usages_swipeId_idx" ON "swipe_usages"("swipeId");

-- CreateIndex
CREATE INDEX "swipe_usages_leadId_idx" ON "swipe_usages"("leadId");

-- CreateIndex
CREATE INDEX "swipe_usages_converted_idx" ON "swipe_usages"("converted");

-- CreateIndex
CREATE INDEX "swipe_usages_createdAt_idx" ON "swipe_usages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "swipe_usages_swipeId_leadId_key" ON "swipe_usages"("swipeId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "trend_keywords_keyword_key" ON "trend_keywords"("keyword");

-- CreateIndex
CREATE INDEX "trend_keywords_category_idx" ON "trend_keywords"("category");

-- CreateIndex
CREATE INDEX "trend_keywords_tier_idx" ON "trend_keywords"("tier");

-- CreateIndex
CREATE INDEX "trend_data_points_date_idx" ON "trend_data_points"("date");

-- CreateIndex
CREATE INDEX "trend_data_points_keywordId_idx" ON "trend_data_points"("keywordId");

-- CreateIndex
CREATE UNIQUE INDEX "trend_data_points_keywordId_date_source_key" ON "trend_data_points"("keywordId", "date", "source");

-- CreateIndex
CREATE INDEX "trend_signals_type_idx" ON "trend_signals"("type");

-- CreateIndex
CREATE INDEX "trend_signals_severity_idx" ON "trend_signals"("severity");

-- CreateIndex
CREATE INDEX "trend_signals_dateDetected_idx" ON "trend_signals"("dateDetected");

-- CreateIndex
CREATE INDEX "trend_signals_category_idx" ON "trend_signals"("category");

-- CreateIndex
CREATE INDEX "funnel_campaigns_type_idx" ON "funnel_campaigns"("type");

-- CreateIndex
CREATE INDEX "funnel_campaigns_status_idx" ON "funnel_campaigns"("status");

-- CreateIndex
CREATE INDEX "funnel_events_leadId_idx" ON "funnel_events"("leadId");

-- CreateIndex
CREATE INDEX "funnel_events_campaignId_idx" ON "funnel_events"("campaignId");

-- CreateIndex
CREATE INDEX "funnel_events_type_idx" ON "funnel_events"("type");

-- CreateIndex
CREATE INDEX "funnel_events_painCluster_idx" ON "funnel_events"("painCluster");

-- CreateIndex
CREATE INDEX "funnel_events_createdAt_idx" ON "funnel_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_scores_leadId_key" ON "funnel_scores"("leadId");

-- CreateIndex
CREATE INDEX "funnel_scores_cluster_idx" ON "funnel_scores"("cluster");

-- CreateIndex
CREATE INDEX "funnel_scores_painCluster_idx" ON "funnel_scores"("painCluster");

-- CreateIndex
CREATE INDEX "funnel_scores_totalScore_idx" ON "funnel_scores"("totalScore");

-- CreateIndex
CREATE INDEX "webhook_logs_source_idx" ON "webhook_logs"("source");

-- CreateIndex
CREATE INDEX "webhook_logs_eventType_idx" ON "webhook_logs"("eventType");

-- CreateIndex
CREATE INDEX "webhook_logs_processed_idx" ON "webhook_logs"("processed");

-- CreateIndex
CREATE INDEX "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt");
