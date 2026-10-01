-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PROSPECT', 'QUALIFIED', 'TRIAL_STARTED', 'CONVERTED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('LITE', 'PRO', 'MAX', 'PARCEIRO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "phoneAlt" TEXT,
    "whatsappPhoneNumber" TEXT,
    "whatsappBusinessId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "plan" TEXT NOT NULL DEFAULT 'lite',
    "status" TEXT NOT NULL DEFAULT 'active',
    "subscriptionAt" TIMESTAMP(3),
    "domain" TEXT,
    "clerkOrgId" TEXT,
    "subscriptionId" TEXT,
    "niche" TEXT NOT NULL DEFAULT 'pousada',
    "isTestTenant" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "street" TEXT NOT NULL DEFAULT '',
    "number" TEXT NOT NULL DEFAULT '',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "zipCode" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "type" TEXT NOT NULL DEFAULT 'pousada',
    "website" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "services" TEXT NOT NULL DEFAULT '[]',
    "paymentMethods" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT,
    "pixKey" TEXT,
    "pixKeyType" TEXT NOT NULL DEFAULT 'cpf',
    "bankName" TEXT,
    "bankAgency" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" TEXT,
    "bankCpf" TEXT,
    "slug" TEXT NOT NULL,
    "linkinbioSubtitle" TEXT NOT NULL DEFAULT '',
    "linkinbioAvatarUrl" TEXT,
    "linkinbioBackgroundUrl" TEXT,
    "linkinbioAccentColor" TEXT NOT NULL DEFAULT '#10b981',
    "linkinbioInstagram" TEXT,
    "linkinbioRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "linkinbioReviewCount" INTEGER NOT NULL DEFAULT 0,
    "linkinbioIsActive" BOOLEAN NOT NULL DEFAULT true,
    "linkinbioPlanStart" TIMESTAMP(3),
    "linkinbioPlanExpires" TIMESTAMP(3),
    "linkinbioBetaEnd" TIMESTAMP(3),
    "linkinbioIsBetaPartner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'standard',
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "status" TEXT NOT NULL DEFAULT 'disponivel',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL DEFAULT '',
    "apiSecret" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "usageLimit" INTEGER NOT NULL DEFAULT 0,
    "usageCurrent" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "customKnowledge" TEXT NOT NULL DEFAULT '[]',
    "learnedPatterns" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "decisor" TEXT NOT NULL DEFAULT '',
    "cargo" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "setor" TEXT NOT NULL DEFAULT 'hospitalidade',
    "porte" TEXT NOT NULL DEFAULT 'pequeno',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "hook" TEXT NOT NULL DEFAULT '',
    "socialFootprint" TEXT NOT NULL DEFAULT '{}',
    "targetId" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "property" TEXT,
    "category" TEXT DEFAULT 'pousada',
    "city" TEXT,
    "state" TEXT DEFAULT 'SC',
    "region" TEXT,
    "googleRating" DOUBLE PRECISION,
    "score" INTEGER DEFAULT 0,
    "painPoints" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SECRETARIA_AI',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "scoreValid" INTEGER NOT NULL DEFAULT 0,
    "localPraia" TEXT,
    "observacoes" TEXT,
    "isCanary" BOOLEAN NOT NULL DEFAULT false,
    "estimatedValues" TEXT,
    "intentSignals" TEXT,
    "location" TEXT,
    "phoneSecondary" TEXT,
    "qualification" TEXT,
    "socialMedia" TEXT NOT NULL DEFAULT '{}',
    "site" TEXT,
    "validationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validationStatus" TEXT NOT NULL DEFAULT 'pendente',
    "conversionScore" INTEGER NOT NULL DEFAULT 0,
    "funnelStage" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "lastInteractionAt" TIMESTAMP(3),
    "behavioralProfile" TEXT,
    "cluster" TEXT NOT NULL DEFAULT 'COLD',
    "previousCluster" TEXT,
    "lastSwipeAction" TEXT,
    "lastSwipeUsedId" TEXT,
    "tierConfidence" DOUBLE PRECISION,
    "tierSugerido" TEXT,
    "tierSugeridoEm" TIMESTAMP(3),
    "roomsCount" INTEGER NOT NULL DEFAULT 0,
    "instagramFollowers" INTEGER NOT NULL DEFAULT 0,
    "googleReviewsCount" INTEGER NOT NULL DEFAULT 0,
    "otaCommissionLost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "otaDependenceLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "buyingBehavior" TEXT,
    "conversionProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "objectKeywords" TEXT,
    "recommendedPitch" TEXT,
    "leadTier" TEXT NOT NULL DEFAULT 'COLD',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_tracking" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "email_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "website" TEXT,
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentId" TEXT NOT NULL DEFAULT 'lessie',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorMsg" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "agentName" TEXT,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "input" TEXT,
    "output" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_alerts" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "alertType" TEXT,
    "metadata" TEXT,

    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swipe_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "category" TEXT NOT NULL DEFAULT 'prospecção',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "tone" TEXT NOT NULL DEFAULT 'casual',
    "tier" TEXT NOT NULL DEFAULT 'universal',
    "painType" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "convRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "provenByConversion" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,

    CONSTRAINT "swipe_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swipe_usages" (
    "id" TEXT NOT NULL,
    "swipeId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "wasUsed" BOOLEAN NOT NULL,
    "converted" BOOLEAN,
    "agentId" TEXT,
    "responseTimeMs" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swipe_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'whatsapp',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetAudience" TEXT NOT NULL DEFAULT 'all',
    "messageTemplate" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalRead" INTEGER NOT NULL DEFAULT 0,
    "totalReplied" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "variant" TEXT,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalConverted" INTEGER NOT NULL DEFAULT 0,
    "openRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clickRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_keywords" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'hotelaria',
    "geo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tier" TEXT NOT NULL DEFAULT 'pro',
    "checkFrequencyHours" INTEGER NOT NULL DEFAULT 6,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'google_trends',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trend" TEXT NOT NULL DEFAULT 'stable',

    CONSTRAINT "trend_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_data_points" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestScore" INTEGER NOT NULL DEFAULT 0,
    "interestDelta" DOUBLE PRECISION,
    "volume" INTEGER,
    "geo" TEXT,

    CONSTRAINT "trend_data_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_signals" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "interestScore" INTEGER NOT NULL,
    "deltaPercent" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'media',
    "geo" TEXT,
    "dateDetected" TIMESTAMP(3) NOT NULL,
    "previousScore" INTEGER,
    "agentsNotified" TEXT NOT NULL DEFAULT '[]',
    "actionTaken" BOOLEAN NOT NULL DEFAULT false,
    "actionDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "trend_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_events" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "painCluster" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_scores" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "funnel_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "document" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "avatar" TEXT,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastContact" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "room" TEXT,
    "aiScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "conversationCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "bsuid" TEXT,
    "realPhone" TEXT,
    "realEmail" TEXT,
    "leadCapturedAt" TIMESTAMP(3),
    "optInAt" TIMESTAMP(3),
    "optInMethod" TEXT,
    "optOutAt" TIMESTAMP(3),
    "optOutMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'DIRECT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "router_providers" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT '3',
    "alpha" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "beta" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "circuitStatus" TEXT NOT NULL DEFAULT 'closed',
    "lastFailureAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "costPer1kInput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPer1kOutput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supportsJson" BOOLEAN NOT NULL DEFAULT false,
    "supportsTools" BOOLEAN NOT NULL DEFAULT false,
    "maxContextTokens" INTEGER NOT NULL DEFAULT 8192,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "router_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_guard_state" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dailySpendUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyBudgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "monthlySpendUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyBudgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "criticalLevel" TEXT NOT NULL DEFAULT 'nominal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_guard_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "bucket" TEXT NOT NULL DEFAULT 'general',
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "circuitState" TEXT,
    "budgetLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentId" TEXT,
    "paymentStatus" TEXT,
    "checkoutUrl" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "lastProrateAmount" DOUBLE PRECISION,
    "lastProrateDate" TIMESTAMP(3),
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "type" TEXT,
    "externalId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_messages" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'text',
    "sentiment" TEXT,
    "intent" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT,
    "guestName" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "roomId" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "guests" INTEGER NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT NOT NULL DEFAULT 'none',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "externalUid" TEXT,
    "externalSource" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_activity_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "guestName" TEXT,
    "roomName" TEXT,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'success',
    "duration" INTEGER,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "usage" INTEGER NOT NULL DEFAULT 0,
    "effectiveness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdFor" TEXT NOT NULL DEFAULT 'both',
    "lastUsed" TIMESTAMP(3),
    "embeddingJson" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_prompts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "aiResponseTime" DOUBLE PRECISION NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL,
    "guestSatisfaction" DOUBLE PRECISION NOT NULL,
    "occupancyRate" DOUBLE PRECISION NOT NULL,
    "revenueGrowth" DOUBLE PRECISION NOT NULL,
    "aiAutonomy" DOUBLE PRECISION NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL,
    "totalBookings" INTEGER NOT NULL,
    "aiConversations" INTEGER NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_actions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "shortcut" TEXT,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ddc',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zellador_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zellador_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_syncs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "otaName" TEXT NOT NULL,
    "syncUrl" TEXT NOT NULL,
    "syncToken" TEXT NOT NULL,
    "lastSync" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "syncCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bsuid_mappings" (
    "id" TEXT NOT NULL,
    "bsuid" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bsuid_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "evidence" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lgpd_delete_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deletedTables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificateUrl" TEXT,
    "dpoNotifiedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lgpd_delete_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lgpd_incidents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedGuests" INTEGER NOT NULL DEFAULT 0,
    "anpdReportId" TEXT,
    "anpdNotifiedAt" TIMESTAMP(3),
    "guestNotifiedAt" TIMESTAMP(3),
    "dpoNotifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lgpd_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_findings" (
    "id" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "file" TEXT,
    "line" INTEGER,
    "cwe" TEXT,
    "cvss" DOUBLE PRECISION,
    "exploitPayload" TEXT,
    "remediation" TEXT,
    "autoFixAttempted" BOOLEAN NOT NULL DEFAULT false,
    "autoFixPrUrl" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_cost_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "guestId" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "messageType" TEXT NOT NULL,
    "intent" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "billable" BOOLEAN,
    "currency" TEXT,
    "rate" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'send_accepted',

    CONSTRAINT "meta_cost_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "wabaId" TEXT,
    "businessAccountId" TEXT,
    "phoneNumberId" TEXT,
    "instagramAccountId" TEXT,
    "displayPhoneNumber" TEXT,
    "connectionStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "businessAgentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastWebhookAt" TIMESTAMP(3),
    "lastDeliveryAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_webhook_events" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_attribution_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "guestPhone" TEXT,
    "messageId" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adId" TEXT,
    "entryPointType" TEXT NOT NULL DEFAULT 'unknown',
    "entryPointSource" TEXT,
    "entryPointSourceUrl" TEXT,
    "entryPointStartedAt" TIMESTAMP(3) NOT NULL,
    "entryPointExpiresAt" TIMESTAMP(3) NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'UNATTRIBUTED',
    "leadId" TEXT,
    "reservationId" TEXT,
    "reservationValue" DOUBLE PRECISION,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_attribution_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkinbio_links" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🔗',
    "isHighlight" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkinbio_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_properties" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "airbnbId" TEXT,
    "airbnbUrl" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "propertyType" TEXT NOT NULL DEFAULT 'apartment',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bedrooms" INTEGER NOT NULL DEFAULT 1,
    "bathrooms" INTEGER NOT NULL DEFAULT 1,
    "maxGuests" INTEGER NOT NULL DEFAULT 2,
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "houseRules" TEXT NOT NULL DEFAULT '[]',
    "checkinTime" TEXT NOT NULL DEFAULT '15:00',
    "checkoutTime" TEXT NOT NULL DEFAULT '11:00',
    "wifiName" TEXT,
    "wifiPassword" TEXT,
    "lockProvider" TEXT,
    "lockCode" TEXT,
    "hostKnowledge" TEXT NOT NULL DEFAULT '[]',
    "neighborhoodTips" TEXT NOT NULL DEFAULT '[]',
    "emergencyContacts" TEXT NOT NULL DEFAULT '[]',
    "imageUrl" TEXT,
    "pricePerNight" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'active',
    "scrapedAt" TIMESTAMP(3),
    "scrapingSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "guestBsuid" TEXT,
    "platformContext" TEXT NOT NULL DEFAULT 'unknown',
    "mode" TEXT NOT NULL DEFAULT 'post_booking',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastIntent" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airb_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_regional_knowledge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distance" DOUBLE PRECISION,
    "walkingTimeMin" INTEGER,
    "drivingTimeMin" INTEGER,
    "address" TEXT,
    "rating" DOUBLE PRECISION,
    "googlePlaceId" TEXT,
    "description" TEXT,
    "embeddingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_regional_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_scraping_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "airbnbUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" TEXT,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "idempotencyKey" TEXT NOT NULL,
    "scrapingSource" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_scraping_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "propertyLimit" INTEGER NOT NULL,
    "currentPropertyCount" INTEGER NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "subscriptionId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airb_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zcc_access_logs" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "method" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "country" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zcc_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_message_costs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageTemplate" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0068,
    "costBrl" DOUBLE PRECISION,
    "bundled" BOOLEAN NOT NULL DEFAULT false,
    "bundleId" TEXT,
    "conversationId" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "intent" TEXT,
    "oneShot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_bundles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originalMessageCount" INTEGER NOT NULL,
    "finalMessageCount" INTEGER NOT NULL DEFAULT 1,
    "savingsUsd" DOUBLE PRECISION NOT NULL,
    "bufferMs" INTEGER NOT NULL DEFAULT 3000,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "message_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airbnb_webhook_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "airbnbReservationId" TEXT,
    "airbnbListingId" TEXT,
    "payload" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "mockTriggered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airbnb_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airbnb_oauth_tokens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresIn" INTEGER NOT NULL,
    "scope" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airbnb_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_pricing_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'seasonal',
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "minOccupancy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxOccupancy" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "daysOfWeek" TEXT NOT NULL DEFAULT '[]',
    "minDaysBefore" INTEGER NOT NULL DEFAULT 0,
    "modifierType" TEXT NOT NULL DEFAULT 'multiplier',
    "modifierValue" DOUBLE PRECISION NOT NULL,
    "minPrice" DOUBLE PRECISION,
    "maxPrice" DOUBLE PRECISION,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "revenueImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_calculations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT,
    "airbPropertyId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "calculatedPrice" DOUBLE PRECISION NOT NULL,
    "modifierBreakdown" TEXT NOT NULL DEFAULT '[]',
    "occupancyAtCalc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysBeforeCheckIn" INTEGER NOT NULL DEFAULT 0,
    "appliedRulesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_dates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'national',
    "name" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_date_suggestions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "specialDateId" TEXT NOT NULL,
    "propertyId" TEXT,
    "roomId" TEXT,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "suggestedPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "impactEstimate" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_date_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_overrides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "roomId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "suggestionId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'owner',
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_program_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maxSlotsInitial" INTEGER NOT NULL DEFAULT 100,
    "maxSlotsCeiling" INTEGER NOT NULL DEFAULT 200,
    "claimedSlots" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 247.0,
    "contractMonths" INTEGER NOT NULL DEFAULT 24,
    "activeBatch" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_program_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_claims" (
    "id" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "pousadaName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 247.0,
    "contractMonths" INTEGER NOT NULL DEFAULT 24,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "badgeActive" BOOLEAN NOT NULL DEFAULT true,
    "batch" INTEGER NOT NULL DEFAULT 1,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_waitlist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "pousadaName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "roomCount" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_guides" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "airbPropertyId" TEXT,
    "propertyId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "welcomeMessage" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "qrCodeUrl" TEXT,
    "sections" TEXT NOT NULL DEFAULT '[]',
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_sync_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "airbPropertyId" TEXT,
    "hotelId" TEXT,
    "icalExportUrl" TEXT,
    "icalImportUrl" TEXT,
    "syncToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSync" TIMESTAMP(3),
    "syncCount" INTEGER NOT NULL DEFAULT 0,
    "bookingsImported" INTEGER NOT NULL DEFAULT 0,
    "bookingsExported" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_sync_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "revoked_sessions" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "tenantId" TEXT,
    "reason" TEXT,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revoked_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cerebro_analyses" (
    "id" TEXT NOT NULL,
    "analysisType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "actionTaken" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cerebro_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_events" (
    "id" TEXT NOT NULL,
    "anomalyType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "observed" DOUBLE PRECISION NOT NULL,
    "baseline" DOUBLE PRECISION NOT NULL,
    "deviation" DOUBLE PRECISION NOT NULL,
    "detectionMethod" TEXT NOT NULL DEFAULT 'statistical',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgeNotes" TEXT,

    CONSTRAINT "anomaly_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refactor_suggestions" (
    "id" TEXT NOT NULL,
    "sourceErrorHash" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "lineRange" TEXT NOT NULL,
    "currentCode" TEXT NOT NULL,
    "proposedCode" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "confidence" DOUBLE PRECISION NOT NULL,
    "reviewNotes" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "refactor_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_reviews" (
    "id" TEXT NOT NULL,
    "reviewMode" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "highLevelSummary" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "stats" TEXT NOT NULL DEFAULT '{}',
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL DEFAULT 'running',
    "triggeredBy" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "code_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_review_comments" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "startLine" INTEGER,
    "endLine" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'code_quality',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedCode" TEXT,
    "currentCode" TEXT,
    "rationale" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_findings" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "filePath" TEXT NOT NULL,
    "lineRange" TEXT NOT NULL,
    "gapType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currentCode" TEXT,
    "suggestedCode" TEXT,
    "rationale" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "detectedBy" TEXT NOT NULL DEFAULT 'heuristic',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "prUrl" TEXT,
    "prBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gap_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bottleneck_findings" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "filePath" TEXT NOT NULL,
    "lineRange" TEXT NOT NULL,
    "bottleneckType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currentCode" TEXT,
    "suggestedCode" TEXT,
    "rationale" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "detectedBy" TEXT NOT NULL DEFAULT 'heuristic',
    "estimatedImpact" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "prUrl" TEXT,
    "prBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bottleneck_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_deliveries" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "filePath" TEXT,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_credentials" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "encryptedPat" TEXT NOT NULL,
    "patFingerprint" TEXT NOT NULL,
    "scopes" TEXT[],
    "repositoryAccess" TEXT[],
    "githubAppId" TEXT,
    "githubClientId" TEXT,
    "installationId" TEXT,
    "webhookSecret" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedFromId" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pat_audit_logs" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "apiEndpoint" TEXT,
    "apiMethod" TEXT,
    "repository" TEXT,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pat_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zcc_audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "path" TEXT NOT NULL,
    "notes" TEXT,
    "deploymentId" TEXT,

    CONSTRAINT "zcc_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cerebro_telemetry_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '{}',
    "tenantId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deploymentId" TEXT,

    CONSTRAINT "cerebro_telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dpo_preference_pairs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "chosen" TEXT NOT NULL,
    "rejected" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "dpo_preference_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_nodes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_edges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "priorityWeight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_health_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL,
    "humanTakeoverRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brain_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compiled_prompts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "niche" TEXT,
    "version" TEXT NOT NULL,
    "compiledJson" TEXT NOT NULL,
    "promptText" TEXT,
    "accuracyScore" DOUBLE PRECISION,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compiled_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'linkinbio',
    "label" TEXT,
    "clicksCount" INTEGER NOT NULL DEFAULT 0,
    "conversionsCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_clicks" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "deviceType" TEXT,
    "country" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_conversions" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "clickId" TEXT NOT NULL,
    "newTenantId" TEXT,
    "newTenantEmail" TEXT NOT NULL,
    "newTenantPlan" TEXT NOT NULL,
    "paymentAmount" DOUBLE PRECISION NOT NULL,
    "creditAmountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amortization_credits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReferralId" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "appliedToSubscriptionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amortization_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lite_milestones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paidReferralsCount" INTEGER NOT NULL DEFAULT 0,
    "achievedAt" TIMESTAMP(3),
    "linkinbioExtendedUntil" TIMESTAMP(3),
    "convertedEmailsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lite_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lock_devices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'pousada',
    "nickname" TEXT NOT NULL,
    "location" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "providerType" TEXT NOT NULL DEFAULT 'manual',
    "externalDeviceId" TEXT,
    "oauthAccountId" TEXT,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "batteryLevel" INTEGER,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lock_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lock_codes" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tenantId" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "bookingId" TEXT,
    "code" TEXT NOT NULL,
    "codeType" TEXT NOT NULL DEFAULT 'online_pin',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "deliveredVia" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "note" TEXT,
    "externalCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lock_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lock_events" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "codeId" TEXT,
    "tenantId" TEXT,
    "eventType" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lock_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lock_oauth_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lock_oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT,
    "reservationId" TEXT,
    "guestId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "comissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.07,
    "comissionAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "suggestedByZehla" BOOLEAN NOT NULL DEFAULT true,
    "feriado" TEXT,
    "temporada" TEXT,
    "yieldMultiplier" DOUBLE PRECISION DEFAULT 1.0,
    "notes" TEXT NOT NULL DEFAULT '',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "acceptCount" INTEGER NOT NULL DEFAULT 0,
    "removeCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "totalSalesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "triggerCartMin" DOUBLE PRECISION,
    "triggerCartMax" DOUBLE PRECISION,
    "triggerCategories" TEXT,
    "triggerProducts" TEXT,
    "triggerSeasons" TEXT,
    "triggerFeriados" TEXT,
    "triggerWeekdays" TEXT,
    "triggerHourStart" INTEGER,
    "triggerHourEnd" INTEGER,
    "triggerOncePerGuest" BOOLEAN NOT NULL DEFAULT true,
    "offerActive" BOOLEAN NOT NULL DEFAULT true,
    "offerStartAt" TIMESTAMP(3),
    "offerEndAt" TIMESTAMP(3),
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "offerTitle" TEXT,
    "offerDescription" TEXT,
    "offerImage" TEXT,
    "offerUrgencyText" TEXT,
    "offerBackgroundColor" TEXT DEFAULT '#10b981',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_expenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recurrence" TEXT NOT NULL DEFAULT 'one_time',
    "document" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_operation_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "assignedTo" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedMin" INTEGER NOT NULL DEFAULT 60,
    "actualMin" INTEGER,
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_operation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_goals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'BRL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_commissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "partnerEmail" TEXT,
    "partnerPhone" TEXT,
    "partnerCode" TEXT,
    "referralType" TEXT NOT NULL DEFAULT 'affiliate',
    "rule" TEXT NOT NULL DEFAULT 'percentage',
    "rate" DOUBLE PRECISION NOT NULL,
    "basisAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_trial_signups" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "companyName" TEXT,
    "niche" TEXT NOT NULL DEFAULT 'pousada',
    "source" TEXT NOT NULL DEFAULT 'organic',
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "utmMedium" TEXT,
    "status" TEXT NOT NULL DEFAULT 'started',
    "magicToken" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "abandonReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airb_trial_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airb_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "fileName" TEXT NOT NULL,
    "fileSizeKb" INTEGER NOT NULL DEFAULT 0,
    "generatedBy" TEXT NOT NULL DEFAULT 'system',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airb_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entry_point" TEXT NOT NULL,
    "input_hash" TEXT,
    "matched_rule" TEXT,
    "matched_pattern" TEXT,
    "redacted_output" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yield_profit_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "airbPropertyId" TEXT,
    "reservationId" TEXT,
    "roomId" TEXT,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "yieldRate" DOUBLE PRECISION NOT NULL,
    "extraProfit" DOUBLE PRECISION NOT NULL,
    "surgeMultiplier" DOUBLE PRECISION NOT NULL,
    "tierName" TEXT NOT NULL DEFAULT 'NOMINAL',
    "bonusShareBrl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusShareRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "triggerReason" TEXT NOT NULL DEFAULT 'occupancy',
    "isSpecialHoliday" BOOLEAN NOT NULL DEFAULT false,
    "holidayName" TEXT,
    "yieldHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yield_profit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_pings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT,
    "niche" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "isMobile" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT NOT NULL,
    "userAgent" TEXT,
    "viewport" TEXT,
    "tabName" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pingCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "device_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "night_audit_reports" (
    "id" TEXT NOT NULL,
    "auditDate" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "summary" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vulnFindings" TEXT NOT NULL DEFAULT '[]',
    "vulnCountCritical" INTEGER NOT NULL DEFAULT 0,
    "vulnCountHigh" INTEGER NOT NULL DEFAULT 0,
    "vulnCountMedium" INTEGER NOT NULL DEFAULT 0,
    "vulnCountLow" INTEGER NOT NULL DEFAULT 0,
    "vulnCountInfo" INTEGER NOT NULL DEFAULT 0,
    "metricsJson" TEXT NOT NULL DEFAULT '{}',
    "llmAnalysis" TEXT NOT NULL DEFAULT '{}',
    "llmTokensInput" INTEGER NOT NULL DEFAULT 0,
    "llmTokensOutput" INTEGER NOT NULL DEFAULT 0,
    "llmCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "night_audit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_vulnerabilities" (
    "id" TEXT NOT NULL,
    "auditReportId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "line" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "cwe" TEXT,
    "httpRequest" TEXT,
    "httpStatus" INTEGER,
    "httpResponseBody" TEXT,
    "exploitProof" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesDetected" INTEGER NOT NULL DEFAULT 1,
    "fixedAt" TIMESTAMP(3),
    "fixedBy" TEXT,
    "detectionSource" TEXT NOT NULL DEFAULT 'sast',

    CONSTRAINT "code_vulnerabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "night_pulse_logs" (
    "id" TEXT NOT NULL,
    "pulseType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "resultJson" TEXT NOT NULL DEFAULT '{}',
    "triggeredAlert" BOOLEAN NOT NULL DEFAULT false,
    "alertMessage" TEXT,
    "llmTokensInput" INTEGER NOT NULL DEFAULT 0,
    "llmTokensOutput" INTEGER NOT NULL DEFAULT 0,
    "llmCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mode" TEXT NOT NULL DEFAULT 'mock',

    CONSTRAINT "night_pulse_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "night_activity_events" (
    "id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "thresholdValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "auditReportId" TEXT,
    "investigatedAt" TIMESTAMP(3),
    "investigatedBy" TEXT,
    "resolutionNotes" TEXT,

    CONSTRAINT "night_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cerebro_knowledge_facts" (
    "id" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "context" TEXT NOT NULL DEFAULT '{}',
    "tags" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "auditDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cerebro_knowledge_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cerebro_workflows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodesJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cerebro_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_call_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "feedback" TEXT,
    "promptHash" TEXT,
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_idempotency" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "response" TEXT NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_whatsappPhoneNumber_key" ON "tenants"("whatsappPhoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_whatsappBusinessId_key" ON "tenants"("whatsappBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_clerkOrgId_key" ON "tenants"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "properties_tenantId_key" ON "properties"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "api_configs_tenantId_provider_key" ON "api_configs"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_tenantId_agentId_key" ON "agent_configs"("tenantId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_tenantId_idx" ON "leads"("tenantId");

-- CreateIndex
CREATE INDEX "email_tracking_leadId_idx" ON "email_tracking"("leadId");

-- CreateIndex
CREATE INDEX "email_tracking_campaignId_idx" ON "email_tracking"("campaignId");

-- CreateIndex
CREATE INDEX "targets_tenantId_idx" ON "targets"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "targets_tenantId_domain_key" ON "targets"("tenantId", "domain");

-- CreateIndex
CREATE INDEX "agent_logs_agentName_createdAt_idx" ON "agent_logs"("agentName", "createdAt");

-- CreateIndex
CREATE INDEX "agent_logs_tenantId_idx" ON "agent_logs"("tenantId");

-- CreateIndex
CREATE INDEX "security_alerts_tenantId_createdAt_idx" ON "security_alerts"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "security_alerts_severity_createdAt_idx" ON "security_alerts"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "swipe_templates_tenantId_idx" ON "swipe_templates"("tenantId");

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
CREATE INDEX "campaigns_tenantId_idx" ON "campaigns"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "trend_keywords_keyword_key" ON "trend_keywords"("keyword");

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

-- CreateIndex
CREATE INDEX "guests_tenantId_idx" ON "guests"("tenantId");

-- CreateIndex
CREATE INDEX "guests_tenantId_status_idx" ON "guests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "guests_tenantId_source_idx" ON "guests"("tenantId", "source");

-- CreateIndex
CREATE INDEX "guests_bsuid_idx" ON "guests"("bsuid");

-- CreateIndex
CREATE INDEX "guests_realPhone_idx" ON "guests"("realPhone");

-- CreateIndex
CREATE INDEX "guests_realEmail_idx" ON "guests"("realEmail");

-- CreateIndex
CREATE UNIQUE INDEX "guests_tenantId_bsuid_key" ON "guests"("tenantId", "bsuid");

-- CreateIndex
CREATE UNIQUE INDEX "guests_tenantId_phone_key" ON "guests"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "reservations_tenantId_idx" ON "reservations"("tenantId");

-- CreateIndex
CREATE INDEX "reservations_guestId_idx" ON "reservations"("guestId");

-- CreateIndex
CREATE INDEX "reservations_roomId_idx" ON "reservations"("roomId");

-- CreateIndex
CREATE INDEX "transactions_tenantId_idx" ON "transactions"("tenantId");

-- CreateIndex
CREATE INDEX "transactions_reservationId_idx" ON "transactions"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "router_providers_provider_key" ON "router_providers"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "budget_guard_state_date_key" ON "budget_guard_state"("date");

-- CreateIndex
CREATE INDEX "cost_logs_tenantId_idx" ON "cost_logs"("tenantId");

-- CreateIndex
CREATE INDEX "cost_logs_createdAt_idx" ON "cost_logs"("createdAt");

-- CreateIndex
CREATE INDEX "cost_logs_provider_idx" ON "cost_logs"("provider");

-- CreateIndex
CREATE INDEX "payment_transactions_subscriptionId_idx" ON "payment_transactions"("subscriptionId");

-- CreateIndex
CREATE INDEX "payment_transactions_externalId_idx" ON "payment_transactions"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_paymentMethod_externalId_key" ON "payment_transactions"("paymentMethod", "externalId");

-- CreateIndex
CREATE INDEX "guest_messages_guestId_idx" ON "guest_messages"("guestId");

-- CreateIndex
CREATE INDEX "guest_messages_timestamp_idx" ON "guest_messages"("timestamp");

-- CreateIndex
CREATE INDEX "bookings_tenantId_status_idx" ON "bookings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "bookings_tenantId_checkIn_idx" ON "bookings"("tenantId", "checkIn");

-- CreateIndex
CREATE INDEX "bookings_guestId_idx" ON "bookings"("guestId");

-- CreateIndex
CREATE INDEX "bookings_roomId_idx" ON "bookings"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_tenantId_externalUid_key" ON "bookings"("tenantId", "externalUid");

-- CreateIndex
CREATE INDEX "ai_activity_logs_tenantId_timestamp_idx" ON "ai_activity_logs"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "ai_activity_logs_type_idx" ON "ai_activity_logs"("type");

-- CreateIndex
CREATE INDEX "conversation_logs_tenantId_status_idx" ON "conversation_logs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "conversation_logs_guestId_idx" ON "conversation_logs"("guestId");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_idx" ON "conversation_messages"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_messages_timestamp_idx" ON "conversation_messages"("timestamp");

-- CreateIndex
CREATE INDEX "knowledge_entries_tenantId_category_idx" ON "knowledge_entries"("tenantId", "category");

-- CreateIndex
CREATE INDEX "knowledge_entries_priority_idx" ON "knowledge_entries"("priority");

-- CreateIndex
CREATE INDEX "training_prompts_tenantId_type_idx" ON "training_prompts"("tenantId", "type");

-- CreateIndex
CREATE INDEX "training_prompts_isActive_idx" ON "training_prompts"("isActive");

-- CreateIndex
CREATE INDEX "notifications_tenantId_read_idx" ON "notifications"("tenantId", "read");

-- CreateIndex
CREATE INDEX "notifications_priority_idx" ON "notifications"("priority");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "performance_snapshots_tenantId_date_idx" ON "performance_snapshots"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "performance_snapshots_tenantId_date_key" ON "performance_snapshots"("tenantId", "date");

-- CreateIndex
CREATE INDEX "quick_actions_tenantId_category_idx" ON "quick_actions"("tenantId", "category");

-- CreateIndex
CREATE INDEX "quick_actions_isActive_idx" ON "quick_actions"("isActive");

-- CreateIndex
CREATE INDEX "feedbacks_tenantId_idx" ON "feedbacks"("tenantId");

-- CreateIndex
CREATE INDEX "feedbacks_conversationId_idx" ON "feedbacks"("conversationId");

-- CreateIndex
CREATE INDEX "feedbacks_messageId_idx" ON "feedbacks"("messageId");

-- CreateIndex
CREATE INDEX "feedbacks_tenantId_createdAt_idx" ON "feedbacks"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "zellador_messages_tenantId_conversationId_idx" ON "zellador_messages"("tenantId", "conversationId");

-- CreateIndex
CREATE INDEX "zellador_messages_conversationId_createdAt_idx" ON "zellador_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_syncs_syncToken_key" ON "calendar_syncs"("syncToken");

-- CreateIndex
CREATE INDEX "calendar_syncs_tenantId_status_idx" ON "calendar_syncs"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_syncs_roomId_otaName_key" ON "calendar_syncs"("roomId", "otaName");

-- CreateIndex
CREATE UNIQUE INDEX "bsuid_mappings_bsuid_key" ON "bsuid_mappings"("bsuid");

-- CreateIndex
CREATE INDEX "bsuid_mappings_guestId_idx" ON "bsuid_mappings"("guestId");

-- CreateIndex
CREATE INDEX "consent_logs_tenantId_guestId_idx" ON "consent_logs"("tenantId", "guestId");

-- CreateIndex
CREATE INDEX "consent_logs_type_idx" ON "consent_logs"("type");

-- CreateIndex
CREATE INDEX "lgpd_delete_requests_tenantId_status_idx" ON "lgpd_delete_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lgpd_delete_requests_guestEmail_idx" ON "lgpd_delete_requests"("guestEmail");

-- CreateIndex
CREATE INDEX "lgpd_delete_requests_status_requestedAt_idx" ON "lgpd_delete_requests"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "lgpd_incidents_tenantId_status_idx" ON "lgpd_incidents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "lgpd_incidents_severity_status_idx" ON "lgpd_incidents"("severity", "status");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenantId_isActive_idx" ON "push_subscriptions"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "security_findings_severity_status_idx" ON "security_findings"("severity", "status");

-- CreateIndex
CREATE INDEX "security_findings_scanType_scannedAt_idx" ON "security_findings"("scanType", "scannedAt");

-- CreateIndex
CREATE INDEX "meta_cost_logs_tenantId_createdAt_idx" ON "meta_cost_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "meta_cost_logs_conversationId_idx" ON "meta_cost_logs"("conversationId");

-- CreateIndex
CREATE INDEX "meta_cost_logs_messageId_idx" ON "meta_cost_logs"("messageId");

-- CreateIndex
CREATE INDEX "meta_cost_logs_source_idx" ON "meta_cost_logs"("source");

-- CreateIndex
CREATE INDEX "meta_connections_tenantId_idx" ON "meta_connections"("tenantId");

-- CreateIndex
CREATE INDEX "meta_connections_connectionStatus_idx" ON "meta_connections"("connectionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "meta_connections_tenantId_wabaId_phoneNumberId_key" ON "meta_connections"("tenantId", "wabaId", "phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_webhook_events_eventKey_key" ON "meta_webhook_events"("eventKey");

-- CreateIndex
CREATE INDEX "meta_webhook_events_kind_externalEventId_idx" ON "meta_webhook_events"("kind", "externalEventId");

-- CreateIndex
CREATE INDEX "meta_webhook_events_status_idx" ON "meta_webhook_events"("status");

-- CreateIndex
CREATE INDEX "meta_attribution_events_tenantId_createdAt_idx" ON "meta_attribution_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "meta_attribution_events_conversationId_idx" ON "meta_attribution_events"("conversationId");

-- CreateIndex
CREATE INDEX "meta_attribution_events_campaignId_idx" ON "meta_attribution_events"("campaignId");

-- CreateIndex
CREATE INDEX "meta_attribution_events_entryPointExpiresAt_idx" ON "meta_attribution_events"("entryPointExpiresAt");

-- CreateIndex
CREATE INDEX "linkinbio_links_propertyId_idx" ON "linkinbio_links"("propertyId");

-- CreateIndex
CREATE INDEX "airb_properties_tenantId_idx" ON "airb_properties"("tenantId");

-- CreateIndex
CREATE INDEX "airb_properties_airbnbId_idx" ON "airb_properties"("airbnbId");

-- CreateIndex
CREATE INDEX "airb_conversations_tenantId_idx" ON "airb_conversations"("tenantId");

-- CreateIndex
CREATE INDEX "airb_conversations_propertyId_idx" ON "airb_conversations"("propertyId");

-- CreateIndex
CREATE INDEX "airb_conversations_status_idx" ON "airb_conversations"("status");

-- CreateIndex
CREATE INDEX "airb_messages_conversationId_idx" ON "airb_messages"("conversationId");

-- CreateIndex
CREATE INDEX "airb_messages_createdAt_idx" ON "airb_messages"("createdAt");

-- CreateIndex
CREATE INDEX "airb_regional_knowledge_tenantId_idx" ON "airb_regional_knowledge"("tenantId");

-- CreateIndex
CREATE INDEX "airb_regional_knowledge_propertyId_idx" ON "airb_regional_knowledge"("propertyId");

-- CreateIndex
CREATE INDEX "airb_regional_knowledge_category_idx" ON "airb_regional_knowledge"("category");

-- CreateIndex
CREATE UNIQUE INDEX "airb_scraping_jobs_idempotencyKey_key" ON "airb_scraping_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "airb_scraping_jobs_tenantId_idx" ON "airb_scraping_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "airb_scraping_jobs_status_idx" ON "airb_scraping_jobs"("status");

-- CreateIndex
CREATE INDEX "airb_scraping_jobs_idempotencyKey_idx" ON "airb_scraping_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "airb_subscriptions_tenantId_idx" ON "airb_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "airb_subscriptions_status_idx" ON "airb_subscriptions"("status");

-- CreateIndex
CREATE INDEX "airb_transactions_tenantId_idx" ON "airb_transactions"("tenantId");

-- CreateIndex
CREATE INDEX "airb_transactions_subscriptionId_idx" ON "airb_transactions"("subscriptionId");

-- CreateIndex
CREATE INDEX "zcc_access_logs_method_idx" ON "zcc_access_logs"("method");

-- CreateIndex
CREATE INDEX "zcc_access_logs_success_idx" ON "zcc_access_logs"("success");

-- CreateIndex
CREATE INDEX "zcc_access_logs_createdAt_idx" ON "zcc_access_logs"("createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_message_costs_tenantId_idx" ON "whatsapp_message_costs"("tenantId");

-- CreateIndex
CREATE INDEX "whatsapp_message_costs_createdAt_idx" ON "whatsapp_message_costs"("createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_message_costs_bundleId_idx" ON "whatsapp_message_costs"("bundleId");

-- CreateIndex
CREATE INDEX "message_bundles_tenantId_idx" ON "message_bundles"("tenantId");

-- CreateIndex
CREATE INDEX "message_bundles_status_idx" ON "message_bundles"("status");

-- CreateIndex
CREATE INDEX "consent_records_tenantId_idx" ON "consent_records"("tenantId");

-- CreateIndex
CREATE INDEX "consent_records_guestPhone_idx" ON "consent_records"("guestPhone");

-- CreateIndex
CREATE INDEX "consent_records_status_idx" ON "consent_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_tenantId_guestPhone_consentType_key" ON "consent_records"("tenantId", "guestPhone", "consentType");

-- CreateIndex
CREATE INDEX "airbnb_webhook_events_tenantId_idx" ON "airbnb_webhook_events"("tenantId");

-- CreateIndex
CREATE INDEX "airbnb_webhook_events_eventType_idx" ON "airbnb_webhook_events"("eventType");

-- CreateIndex
CREATE INDEX "airbnb_webhook_events_processed_idx" ON "airbnb_webhook_events"("processed");

-- CreateIndex
CREATE INDEX "airbnb_oauth_tokens_tenantId_idx" ON "airbnb_oauth_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "airbnb_oauth_tokens_expiresAt_idx" ON "airbnb_oauth_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "airbnb_oauth_tokens_tenantId_key" ON "airbnb_oauth_tokens"("tenantId");

-- CreateIndex
CREATE INDEX "dynamic_pricing_rules_tenantId_status_idx" ON "dynamic_pricing_rules"("tenantId", "status");

-- CreateIndex
CREATE INDEX "dynamic_pricing_rules_tenantId_type_idx" ON "dynamic_pricing_rules"("tenantId", "type");

-- CreateIndex
CREATE INDEX "dynamic_pricing_rules_startDate_endDate_idx" ON "dynamic_pricing_rules"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "pricing_calculations_tenantId_date_idx" ON "pricing_calculations"("tenantId", "date");

-- CreateIndex
CREATE INDEX "pricing_calculations_tenantId_roomId_idx" ON "pricing_calculations"("tenantId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_calculations_tenantId_roomId_date_key" ON "pricing_calculations"("tenantId", "roomId", "date");

-- CreateIndex
CREATE INDEX "special_dates_tenantId_date_idx" ON "special_dates"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "special_dates_tenantId_date_type_key" ON "special_dates"("tenantId", "date", "type");

-- CreateIndex
CREATE INDEX "special_date_suggestions_tenantId_status_idx" ON "special_date_suggestions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "special_date_suggestions_specialDateId_idx" ON "special_date_suggestions"("specialDateId");

-- CreateIndex
CREATE INDEX "price_overrides_tenantId_date_idx" ON "price_overrides"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "price_overrides_tenantId_roomId_date_key" ON "price_overrides"("tenantId", "roomId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "partner_claims_slotNumber_key" ON "partner_claims"("slotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "partner_claims_tenantId_key" ON "partner_claims"("tenantId");

-- CreateIndex
CREATE INDEX "partner_claims_status_idx" ON "partner_claims"("status");

-- CreateIndex
CREATE INDEX "partner_claims_tenantId_idx" ON "partner_claims"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_waitlist_email_key" ON "partner_waitlist"("email");

-- CreateIndex
CREATE INDEX "partner_waitlist_status_idx" ON "partner_waitlist"("status");

-- CreateIndex
CREATE UNIQUE INDEX "guest_guides_slug_key" ON "guest_guides"("slug");

-- CreateIndex
CREATE INDEX "guest_guides_tenantId_status_idx" ON "guest_guides"("tenantId", "status");

-- CreateIndex
CREATE INDEX "guest_guides_slug_idx" ON "guest_guides"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "booking_sync_configs_syncToken_key" ON "booking_sync_configs"("syncToken");

-- CreateIndex
CREATE INDEX "booking_sync_configs_tenantId_status_idx" ON "booking_sync_configs"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "booking_sync_configs_tenantId_propertyId_key" ON "booking_sync_configs"("tenantId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_sync_configs_tenantId_airbPropertyId_key" ON "booking_sync_configs"("tenantId", "airbPropertyId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "revoked_sessions_jti_key" ON "revoked_sessions"("jti");

-- CreateIndex
CREATE INDEX "revoked_sessions_jti_idx" ON "revoked_sessions"("jti");

-- CreateIndex
CREATE INDEX "revoked_sessions_tenantId_idx" ON "revoked_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "cerebro_analyses_analysisType_createdAt_idx" ON "cerebro_analyses"("analysisType", "createdAt");

-- CreateIndex
CREATE INDEX "cerebro_analyses_severity_createdAt_idx" ON "cerebro_analyses"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "cerebro_analyses_scope_createdAt_idx" ON "cerebro_analyses"("scope", "createdAt");

-- CreateIndex
CREATE INDEX "anomaly_events_anomalyType_detectedAt_idx" ON "anomaly_events"("anomalyType", "detectedAt");

-- CreateIndex
CREATE INDEX "anomaly_events_scope_detectedAt_idx" ON "anomaly_events"("scope", "detectedAt");

-- CreateIndex
CREATE INDEX "anomaly_events_acknowledged_detectedAt_idx" ON "anomaly_events"("acknowledged", "detectedAt");

-- CreateIndex
CREATE INDEX "refactor_suggestions_status_createdAt_idx" ON "refactor_suggestions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "refactor_suggestions_filePath_idx" ON "refactor_suggestions"("filePath");

-- CreateIndex
CREATE INDEX "refactor_suggestions_sourceErrorHash_idx" ON "refactor_suggestions"("sourceErrorHash");

-- CreateIndex
CREATE INDEX "code_reviews_status_createdAt_idx" ON "code_reviews"("status", "createdAt");

-- CreateIndex
CREATE INDEX "code_reviews_scope_idx" ON "code_reviews"("scope");

-- CreateIndex
CREATE INDEX "code_review_comments_reviewId_idx" ON "code_review_comments"("reviewId");

-- CreateIndex
CREATE INDEX "code_review_comments_filePath_idx" ON "code_review_comments"("filePath");

-- CreateIndex
CREATE INDEX "code_review_comments_status_idx" ON "code_review_comments"("status");

-- CreateIndex
CREATE INDEX "gap_findings_status_createdAt_idx" ON "gap_findings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "gap_findings_filePath_idx" ON "gap_findings"("filePath");

-- CreateIndex
CREATE INDEX "gap_findings_gapType_idx" ON "gap_findings"("gapType");

-- CreateIndex
CREATE INDEX "gap_findings_jobId_idx" ON "gap_findings"("jobId");

-- CreateIndex
CREATE INDEX "bottleneck_findings_status_createdAt_idx" ON "bottleneck_findings"("status", "createdAt");

-- CreateIndex
CREATE INDEX "bottleneck_findings_filePath_idx" ON "bottleneck_findings"("filePath");

-- CreateIndex
CREATE INDEX "bottleneck_findings_bottleneckType_idx" ON "bottleneck_findings"("bottleneckType");

-- CreateIndex
CREATE INDEX "bottleneck_findings_jobId_idx" ON "bottleneck_findings"("jobId");

-- CreateIndex
CREATE INDEX "alert_deliveries_status_createdAt_idx" ON "alert_deliveries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "alert_deliveries_channel_createdAt_idx" ON "alert_deliveries"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "knowledge_chunks_source_createdAt_idx" ON "knowledge_chunks"("source", "createdAt");

-- CreateIndex
CREATE INDEX "knowledge_chunks_filePath_idx" ON "knowledge_chunks"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "github_credentials_label_key" ON "github_credentials"("label");

-- CreateIndex
CREATE INDEX "github_credentials_patFingerprint_idx" ON "github_credentials"("patFingerprint");

-- CreateIndex
CREATE INDEX "github_credentials_isActive_idx" ON "github_credentials"("isActive");

-- CreateIndex
CREATE INDEX "github_credentials_expiresAt_idx" ON "github_credentials"("expiresAt");

-- CreateIndex
CREATE INDEX "github_credentials_authType_idx" ON "github_credentials"("authType");

-- CreateIndex
CREATE INDEX "pat_audit_logs_credentialId_createdAt_idx" ON "pat_audit_logs"("credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "pat_audit_logs_action_createdAt_idx" ON "pat_audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "pat_audit_logs_success_createdAt_idx" ON "pat_audit_logs"("success", "createdAt");

-- CreateIndex
CREATE INDEX "pat_audit_logs_repository_createdAt_idx" ON "pat_audit_logs"("repository", "createdAt");

-- CreateIndex
CREATE INDEX "zcc_audit_logs_ip_timestamp_idx" ON "zcc_audit_logs"("ip", "timestamp");

-- CreateIndex
CREATE INDEX "zcc_audit_logs_success_timestamp_idx" ON "zcc_audit_logs"("success", "timestamp");

-- CreateIndex
CREATE INDEX "zcc_audit_logs_path_timestamp_idx" ON "zcc_audit_logs"("path", "timestamp");

-- CreateIndex
CREATE INDEX "cerebro_telemetry_events_type_timestamp_idx" ON "cerebro_telemetry_events"("type", "timestamp");

-- CreateIndex
CREATE INDEX "cerebro_telemetry_events_module_timestamp_idx" ON "cerebro_telemetry_events"("module", "timestamp");

-- CreateIndex
CREATE INDEX "cerebro_telemetry_events_severity_timestamp_idx" ON "cerebro_telemetry_events"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "cerebro_telemetry_events_tenantId_timestamp_idx" ON "cerebro_telemetry_events"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "dpo_preference_pairs_tenantId_status_idx" ON "dpo_preference_pairs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "graph_nodes_tenantId_entityType_idx" ON "graph_nodes"("tenantId", "entityType");

-- CreateIndex
CREATE INDEX "graph_edges_tenantId_sourceNodeId_idx" ON "graph_edges"("tenantId", "sourceNodeId");

-- CreateIndex
CREATE INDEX "graph_edges_tenantId_targetNodeId_idx" ON "graph_edges"("tenantId", "targetNodeId");

-- CreateIndex
CREATE INDEX "brain_health_logs_tenantId_createdAt_idx" ON "brain_health_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "compiled_prompts_tenantId_version_idx" ON "compiled_prompts"("tenantId", "version");

-- CreateIndex
CREATE INDEX "compiled_prompts_niche_active_successRate_idx" ON "compiled_prompts"("niche", "active", "successRate");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "referral_codes_tenantId_idx" ON "referral_codes"("tenantId");

-- CreateIndex
CREATE INDEX "referral_codes_code_idx" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "referral_clicks_referralCodeId_idx" ON "referral_clicks"("referralCodeId");

-- CreateIndex
CREATE INDEX "referral_clicks_fingerprint_idx" ON "referral_clicks"("fingerprint");

-- CreateIndex
CREATE INDEX "referral_clicks_status_idx" ON "referral_clicks"("status");

-- CreateIndex
CREATE INDEX "referral_clicks_createdAt_idx" ON "referral_clicks"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "referral_conversions_clickId_key" ON "referral_conversions"("clickId");

-- CreateIndex
CREATE INDEX "referral_conversions_referralCodeId_idx" ON "referral_conversions"("referralCodeId");

-- CreateIndex
CREATE INDEX "referral_conversions_newTenantEmail_idx" ON "referral_conversions"("newTenantEmail");

-- CreateIndex
CREATE INDEX "referral_conversions_status_idx" ON "referral_conversions"("status");

-- CreateIndex
CREATE INDEX "amortization_credits_tenantId_idx" ON "amortization_credits"("tenantId");

-- CreateIndex
CREATE INDEX "amortization_credits_status_idx" ON "amortization_credits"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lite_milestones_tenantId_key" ON "lite_milestones"("tenantId");

-- CreateIndex
CREATE INDEX "lock_devices_tenantId_idx" ON "lock_devices"("tenantId");

-- CreateIndex
CREATE INDEX "lock_devices_propertyId_idx" ON "lock_devices"("propertyId");

-- CreateIndex
CREATE INDEX "lock_devices_propertyType_idx" ON "lock_devices"("propertyType");

-- CreateIndex
CREATE INDEX "lock_devices_brand_idx" ON "lock_devices"("brand");

-- CreateIndex
CREATE INDEX "lock_codes_deviceId_idx" ON "lock_codes"("deviceId");

-- CreateIndex
CREATE INDEX "lock_codes_tenantId_idx" ON "lock_codes"("tenantId");

-- CreateIndex
CREATE INDEX "lock_codes_bookingId_idx" ON "lock_codes"("bookingId");

-- CreateIndex
CREATE INDEX "lock_codes_status_idx" ON "lock_codes"("status");

-- CreateIndex
CREATE INDEX "lock_codes_validFrom_idx" ON "lock_codes"("validFrom");

-- CreateIndex
CREATE INDEX "lock_codes_validTo_idx" ON "lock_codes"("validTo");

-- CreateIndex
CREATE UNIQUE INDEX "lock_codes_deviceId_code_validFrom_key" ON "lock_codes"("deviceId", "code", "validFrom");

-- CreateIndex
CREATE INDEX "lock_events_deviceId_idx" ON "lock_events"("deviceId");

-- CreateIndex
CREATE INDEX "lock_events_codeId_idx" ON "lock_events"("codeId");

-- CreateIndex
CREATE INDEX "lock_events_tenantId_idx" ON "lock_events"("tenantId");

-- CreateIndex
CREATE INDEX "lock_events_eventType_idx" ON "lock_events"("eventType");

-- CreateIndex
CREATE INDEX "lock_events_createdAt_idx" ON "lock_events"("createdAt");

-- CreateIndex
CREATE INDEX "lock_oauth_accounts_tenantId_idx" ON "lock_oauth_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "lock_oauth_accounts_provider_idx" ON "lock_oauth_accounts"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "lock_oauth_accounts_tenantId_provider_externalAccountId_key" ON "lock_oauth_accounts"("tenantId", "provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "upsell_records_tenantId_idx" ON "upsell_records"("tenantId");

-- CreateIndex
CREATE INDEX "upsell_records_tenantId_status_idx" ON "upsell_records"("tenantId", "status");

-- CreateIndex
CREATE INDEX "upsell_records_tenantId_createdAt_idx" ON "upsell_records"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "upsell_records_tenantId_type_idx" ON "upsell_records"("tenantId", "type");

-- CreateIndex
CREATE INDEX "upsell_records_roomId_idx" ON "upsell_records"("roomId");

-- CreateIndex
CREATE INDEX "upsell_records_reservationId_idx" ON "upsell_records"("reservationId");

-- CreateIndex
CREATE INDEX "upsell_records_status_paidAt_idx" ON "upsell_records"("status", "paidAt");

-- CreateIndex
CREATE INDEX "upsell_records_offerActive_idx" ON "upsell_records"("offerActive");

-- CreateIndex
CREATE INDEX "upsell_records_isSandbox_idx" ON "upsell_records"("isSandbox");

-- CreateIndex
CREATE INDEX "airb_expenses_tenantId_status_idx" ON "airb_expenses"("tenantId", "status");

-- CreateIndex
CREATE INDEX "airb_expenses_tenantId_category_idx" ON "airb_expenses"("tenantId", "category");

-- CreateIndex
CREATE INDEX "airb_expenses_tenantId_dueDate_idx" ON "airb_expenses"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "airb_operation_tasks_tenantId_status_idx" ON "airb_operation_tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "airb_operation_tasks_tenantId_type_idx" ON "airb_operation_tasks"("tenantId", "type");

-- CreateIndex
CREATE INDEX "airb_operation_tasks_tenantId_scheduledFor_idx" ON "airb_operation_tasks"("tenantId", "scheduledFor");

-- CreateIndex
CREATE INDEX "airb_goals_tenantId_status_idx" ON "airb_goals"("tenantId", "status");

-- CreateIndex
CREATE INDEX "airb_goals_tenantId_type_period_idx" ON "airb_goals"("tenantId", "type", "period");

-- CreateIndex
CREATE INDEX "airb_goals_tenantId_endDate_idx" ON "airb_goals"("tenantId", "endDate");

-- CreateIndex
CREATE INDEX "airb_commissions_tenantId_status_idx" ON "airb_commissions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "airb_commissions_tenantId_partnerCode_idx" ON "airb_commissions"("tenantId", "partnerCode");

-- CreateIndex
CREATE UNIQUE INDEX "airb_trial_signups_email_key" ON "airb_trial_signups"("email");

-- CreateIndex
CREATE UNIQUE INDEX "airb_trial_signups_magicToken_key" ON "airb_trial_signups"("magicToken");

-- CreateIndex
CREATE INDEX "airb_trial_signups_status_idx" ON "airb_trial_signups"("status");

-- CreateIndex
CREATE INDEX "airb_trial_signups_email_idx" ON "airb_trial_signups"("email");

-- CreateIndex
CREATE INDEX "airb_trial_signups_createdAt_idx" ON "airb_trial_signups"("createdAt");

-- CreateIndex
CREATE INDEX "airb_reports_tenantId_type_createdAt_idx" ON "airb_reports"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "airb_reports_tenantId_period_idx" ON "airb_reports"("tenantId", "period");

-- CreateIndex
CREATE INDEX "policy_audit_tenantId_created_at_idx" ON "policy_audit"("tenantId", "created_at");

-- CreateIndex
CREATE INDEX "policy_audit_policyId_severity_idx" ON "policy_audit"("policyId", "severity");

-- CreateIndex
CREATE INDEX "policy_audit_entry_point_created_at_idx" ON "policy_audit"("entry_point", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "yield_profit_records_yieldHash_key" ON "yield_profit_records"("yieldHash");

-- CreateIndex
CREATE INDEX "yield_profit_records_tenantId_targetDate_idx" ON "yield_profit_records"("tenantId", "targetDate");

-- CreateIndex
CREATE INDEX "yield_profit_records_tenantId_status_idx" ON "yield_profit_records"("tenantId", "status");

-- CreateIndex
CREATE INDEX "yield_profit_records_tenantId_isSpecialHoliday_idx" ON "yield_profit_records"("tenantId", "isSpecialHoliday");

-- CreateIndex
CREATE INDEX "yield_profit_records_tenantId_createdAt_idx" ON "yield_profit_records"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "device_pings_deviceId_key" ON "device_pings"("deviceId");

-- CreateIndex
CREATE INDEX "device_pings_tenantId_lastSeen_idx" ON "device_pings"("tenantId", "lastSeen");

-- CreateIndex
CREATE INDEX "device_pings_niche_isMobile_lastSeen_idx" ON "device_pings"("niche", "isMobile", "lastSeen");

-- CreateIndex
CREATE INDEX "device_pings_isMobile_lastSeen_idx" ON "device_pings"("isMobile", "lastSeen");

-- CreateIndex
CREATE INDEX "device_pings_route_lastSeen_idx" ON "device_pings"("route", "lastSeen");

-- CreateIndex
CREATE INDEX "device_pings_lastSeen_idx" ON "device_pings"("lastSeen");

-- CreateIndex
CREATE INDEX "night_audit_reports_status_createdAt_idx" ON "night_audit_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "night_audit_reports_severity_createdAt_idx" ON "night_audit_reports"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "night_audit_reports_auditDate_idx" ON "night_audit_reports"("auditDate");

-- CreateIndex
CREATE UNIQUE INDEX "night_audit_reports_auditDate_key" ON "night_audit_reports"("auditDate");

-- CreateIndex
CREATE UNIQUE INDEX "code_vulnerabilities_fingerprint_key" ON "code_vulnerabilities"("fingerprint");

-- CreateIndex
CREATE INDEX "code_vulnerabilities_status_severity_idx" ON "code_vulnerabilities"("status", "severity");

-- CreateIndex
CREATE INDEX "code_vulnerabilities_fingerprint_idx" ON "code_vulnerabilities"("fingerprint");

-- CreateIndex
CREATE INDEX "code_vulnerabilities_file_idx" ON "code_vulnerabilities"("file");

-- CreateIndex
CREATE INDEX "code_vulnerabilities_severity_lastDetectedAt_idx" ON "code_vulnerabilities"("severity", "lastDetectedAt");

-- CreateIndex
CREATE INDEX "code_vulnerabilities_detectionSource_lastDetectedAt_idx" ON "code_vulnerabilities"("detectionSource", "lastDetectedAt");

-- CreateIndex
CREATE INDEX "night_pulse_logs_pulseType_startedAt_idx" ON "night_pulse_logs"("pulseType", "startedAt");

-- CreateIndex
CREATE INDEX "night_pulse_logs_status_startedAt_idx" ON "night_pulse_logs"("status", "startedAt");

-- CreateIndex
CREATE INDEX "night_pulse_logs_triggeredAlert_startedAt_idx" ON "night_pulse_logs"("triggeredAlert", "startedAt");

-- CreateIndex
CREATE INDEX "night_activity_events_surface_detectedAt_idx" ON "night_activity_events"("surface", "detectedAt");

-- CreateIndex
CREATE INDEX "night_activity_events_severity_detectedAt_idx" ON "night_activity_events"("severity", "detectedAt");

-- CreateIndex
CREATE INDEX "night_activity_events_eventType_detectedAt_idx" ON "night_activity_events"("eventType", "detectedAt");

-- CreateIndex
CREATE INDEX "cerebro_knowledge_facts_factType_confidence_idx" ON "cerebro_knowledge_facts"("factType", "confidence");

-- CreateIndex
CREATE INDEX "cerebro_knowledge_facts_source_idx" ON "cerebro_knowledge_facts"("source");

-- CreateIndex
CREATE INDEX "cerebro_knowledge_facts_auditDate_idx" ON "cerebro_knowledge_facts"("auditDate");

-- CreateIndex
CREATE INDEX "cerebro_knowledge_facts_confidence_idx" ON "cerebro_knowledge_facts"("confidence");

-- CreateIndex
CREATE INDEX "cerebro_workflows_tenantId_status_idx" ON "cerebro_workflows"("tenantId", "status");

-- CreateIndex
CREATE INDEX "cerebro_workflows_status_updatedAt_idx" ON "cerebro_workflows"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "llm_call_logs_tenantId_createdAt_idx" ON "llm_call_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "llm_call_logs_model_createdAt_idx" ON "llm_call_logs"("model", "createdAt");

-- CreateIndex
CREATE INDEX "llm_call_logs_success_createdAt_idx" ON "llm_call_logs"("success", "createdAt");

-- CreateIndex
CREATE INDEX "llm_call_logs_source_createdAt_idx" ON "llm_call_logs"("source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "billing_idempotency_key_key" ON "billing_idempotency"("key");

-- CreateIndex
CREATE INDEX "billing_idempotency_provider_eventId_idx" ON "billing_idempotency"("provider", "eventId");

-- CreateIndex
CREATE INDEX "billing_idempotency_status_idx" ON "billing_idempotency"("status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_configs" ADD CONSTRAINT "api_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_tracking" ADD CONSTRAINT "email_tracking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_templates" ADD CONSTRAINT "swipe_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_usages" ADD CONSTRAINT "swipe_usages_swipeId_fkey" FOREIGN KEY ("swipeId") REFERENCES "swipe_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_usages" ADD CONSTRAINT "swipe_usages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trend_data_points" ADD CONSTRAINT "trend_data_points_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "trend_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_scores" ADD CONSTRAINT "funnel_scores_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_messages" ADD CONSTRAINT "guest_messages_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_syncs" ADD CONSTRAINT "calendar_syncs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_syncs" ADD CONSTRAINT "calendar_syncs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bsuid_mappings" ADD CONSTRAINT "bsuid_mappings_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lgpd_delete_requests" ADD CONSTRAINT "lgpd_delete_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lgpd_incidents" ADD CONSTRAINT "lgpd_incidents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_attribution_events" ADD CONSTRAINT "meta_attribution_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linkinbio_links" ADD CONSTRAINT "linkinbio_links_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_properties" ADD CONSTRAINT "airb_properties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_conversations" ADD CONSTRAINT "airb_conversations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "airb_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_messages" ADD CONSTRAINT "airb_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "airb_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_regional_knowledge" ADD CONSTRAINT "airb_regional_knowledge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "airb_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_scraping_jobs" ADD CONSTRAINT "airb_scraping_jobs_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "airb_properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_subscriptions" ADD CONSTRAINT "airb_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_transactions" ADD CONSTRAINT "airb_transactions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "airb_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_pricing_rules" ADD CONSTRAINT "dynamic_pricing_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_calculations" ADD CONSTRAINT "pricing_calculations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_dates" ADD CONSTRAINT "special_dates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_date_suggestions" ADD CONSTRAINT "special_date_suggestions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_date_suggestions" ADD CONSTRAINT "special_date_suggestions_specialDateId_fkey" FOREIGN KEY ("specialDateId") REFERENCES "special_dates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_overrides" ADD CONSTRAINT "price_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_overrides" ADD CONSTRAINT "price_overrides_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "special_date_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_claims" ADD CONSTRAINT "partner_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_guides" ADD CONSTRAINT "guest_guides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_sync_configs" ADD CONSTRAINT "booking_sync_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_review_comments" ADD CONSTRAINT "code_review_comments_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "code_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "cerebro_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pat_audit_logs" ADD CONSTRAINT "pat_audit_logs_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "github_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_clicks" ADD CONSTRAINT "referral_clicks_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "referral_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_conversions" ADD CONSTRAINT "referral_conversions_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "referral_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_conversions" ADD CONSTRAINT "referral_conversions_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "referral_clicks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amortization_credits" ADD CONSTRAINT "amortization_credits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lite_milestones" ADD CONSTRAINT "lite_milestones_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lock_devices" ADD CONSTRAINT "lock_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lock_codes" ADD CONSTRAINT "lock_codes_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "lock_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lock_codes" ADD CONSTRAINT "lock_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lock_events" ADD CONSTRAINT "lock_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "lock_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lock_events" ADD CONSTRAINT "lock_events_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "lock_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lock_events" ADD CONSTRAINT "lock_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lock_oauth_accounts" ADD CONSTRAINT "lock_oauth_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_records" ADD CONSTRAINT "upsell_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_expenses" ADD CONSTRAINT "airb_expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_operation_tasks" ADD CONSTRAINT "airb_operation_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_goals" ADD CONSTRAINT "airb_goals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_commissions" ADD CONSTRAINT "airb_commissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airb_reports" ADD CONSTRAINT "airb_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yield_profit_records" ADD CONSTRAINT "yield_profit_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_pings" ADD CONSTRAINT "device_pings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
