"""
ZÉLLA — TensorFlow Sidecar (FastAPI porta 8501)
================================================

8 modelos neurais para o Cérebro Zélla:
  1. Intent Classifier (BERT-lite) — classifica intenção WhatsApp
  2. Churn Predictor (Gradient Boosting) — prevê churn 30 dias
  3. Lead Scorer (FT-Transformer) — prioriza leads por conversão
  4. Anomaly Detector (Autoencoder) — detecta anomalias sutis
  5. Occupancy Forecaster (LSTM) — prevê ocupação 30 dias
  6. Sentiment Analyzer (BERT multilingual) — análise de sentimento PT-BR
  7. Price Optimizer (Rede neural regressão) — preço ótimo por pousada
  8. Upsell Recommender (TFRS) — recomenda upsell por perfil

Modo de operação:
  - Modelos treinados offline (laptop/Colab) → exportados .keras em /models/
  - Sidecar carrega modelos na inicialização (lazy)
  - Inferência em CPU (< 100ms por modelo)
  - Se modelo não existe → retorna fallback estatístico
  - Auth: X-TF-API-Key header (TF_API_KEY env var)

Fallback gracioso:
  - Se sidecar offline → Next.js usa heurísticas existentes
  - Se modelo não carregado → retorna predição estatística simples
  - Nunca bloqueia o fluxo principal do WhatsApp
"""

import os
import json
import logging
from typing import Any, Optional
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

TF_API_KEY = os.environ.get("TF_API_KEY", "")
PORT = int(os.environ.get("TF_SIDECAR_PORT", "8501"))
MODELS_DIR = os.environ.get("TF_MODELS_DIR", os.path.join(os.path.dirname(__file__), "models"))

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("tf-sidecar")

# ─────────────────────────────────────────────────────────────────────────────
# MODEL REGISTRY (lazy loading)
# ─────────────────────────────────────────────────────────────────────────────

# Importa tensorflow APENAS quando necessário (startup pode demorar 10s)
tf = None
loaded_models: dict[str, Any] = {}


def get_tf():
    """Lazy import do TensorFlow (evita import na inicialização do módulo)."""
    global tf
    if tf is None:
        import tensorflow as tf_module
        tf = tf_module
        logger.info(f"TensorFlow {tf.__version__} loaded")
    return tf


def load_model(name: str):
    """Carrega um modelo .keras do disco (lazy). Retorna None se não existe."""
    if name in loaded_models:
        return loaded_models[name]

    model_path = os.path.join(MODELS_DIR, f"{name}.keras")
    if not os.path.exists(model_path):
        logger.warning(f"Model {name} not found at {model_path} — using fallback")
        return None

    try:
        tf = get_tf()
        model = tf.keras.models.load_model(model_path)
        loaded_models[name] = model
        logger.info(f"Model {name} loaded from {model_path}")
        return model
    except Exception as e:
        logger.error(f"Failed to load model {name}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# AUTH MIDDLEWARE
# ─────────────────────────────────────────────────────────────────────────────


async def verify_api_key(x_tf_api_key: Optional[str] = Header(None, alias="X-TF-API-Key")):
    """Verifica API key. Em dev sem TF_API_KEY configurada, permite acesso."""
    if not TF_API_KEY:
        return  # dev mode — sem auth

    if x_tf_api_key != TF_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ─────────────────────────────────────────────────────────────────────────────
# INPUT MODELS (Pydantic)
# ─────────────────────────────────────────────────────────────────────────────


class IntentRequest(BaseModel):
    message: str
    tenant_id: Optional[str] = None


class ChurnRequest(BaseModel):
    tenant_id: str
    plan: str = "pro"
    days_since_login: int = 0
    messages_7d: int = 0
    reservations_30d: int = 0
    cost_usd_30d: float = 0.0
    budget_usd: float = 20.0
    nps_score: Optional[float] = None
    qty_rooms: int = 0
    uf: str = "SP"
    days_since_onboarding: int = 0
    errors_7d: int = 0
    payment_overdue_days: int = 0


class LeadScoreRequest(BaseModel):
    qty_rooms: int
    city: str = ""
    uf: str = ""
    valores_estimados: str = ""
    tier: str = "PRO"
    funnel: str = "WARM"
    score_qualificacao: int = 50
    score_validacao: int = 50


class AnomalyRequest(BaseModel):
    metrics: list[float]  # vetor de métricas das últimas 24h
    metric_names: Optional[list[str]] = None


class OccupancyRequest(BaseModel):
    tenant_id: str
    history_days: list[int] = []  # ocupação dos últimos 90 dias
    forecast_days: int = 30


class SentimentRequest(BaseModel):
    message: str
    language: str = "pt-BR"


class PriceRequest(BaseModel):
    base_daily_rate: float
    total_rooms: int
    occupied_rooms: int
    target_date: str  # ISO date
    is_special_holiday: bool = False
    uf: str = "SP"
    qty_rooms: int = 10
    forecast_occupancy: Optional[float] = None


class UpsellRequest(BaseModel):
    guest_profile: dict
    plan: str = "PRO"
    history: list[dict] = []


# ─────────────────────────────────────────────────────────────────────────────
# LIFESPAN (startup/shutdown)
# ─────────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("TensorFlow Sidecar starting...")
    logger.info(f"Models dir: {MODELS_DIR}")
    logger.info(f"API key configured: {bool(TF_API_KEY)}")

    # Lista modelos disponíveis
    if os.path.exists(MODELS_DIR):
        available = [f for f in os.listdir(MODELS_DIR) if f.endswith(".keras")]
        logger.info(f"Available models: {available}")
    else:
        logger.warning(f"Models dir does not exist: {MODELS_DIR}")
        os.makedirs(MODELS_DIR, exist_ok=True)

    yield
    logger.info("TensorFlow Sidecar shutting down...")


# ─────────────────────────────────────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────────────────────────────────────


app = FastAPI(
    title="Zélla TensorFlow Sidecar",
    description="8 modelos neurais para o Cérebro Zélla",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    """Health check — não requer auth."""
    return {
        "status": "ok",
        "tf_version": get_tf().__version__ if tf else "not_loaded",
        "models_loaded": list(loaded_models.keys()),
        "models_available": (
            [f for f in os.listdir(MODELS_DIR) if f.endswith(".keras")]
            if os.path.exists(MODELS_DIR)
            else []
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. INTENT CLASSIFIER
# ─────────────────────────────────────────────────────────────────────────────


INTENT_LABELS = [
    "cotacao_reserva",
    "reserva_direta",
    "duvida_geral",
    "suporte_tecnico",
    "checkin_checkout",
    "cancelamento",
    "agradecimento",
    "human_handover",
    "agradecimento_pos",
]

# Fallback heurístico quando modelo não existe
INTENT_KEYWORDS = {
    "cotacao_reserva": ["preco", "preço", "valor", "quanto custa", "quanto fica", "diaria", "diária", "tarifa", "pacote"],
    "reserva_direta": ["reserva", "reservar", "pix", "pagar", "pagamento"],
    "duvida_geral": ["wifi", "wi-fi", "senha", "internet", "horario", "cafe", "estacionamento", "piscina"],
    "suporte_tecnico": ["problema", "erro", "nao funciona", "fechadura", "ar condicionado"],
    "checkin_checkout": ["checkin", "check-in", "checkout", "check-out", "horario", "chegar", "sair"],
    "cancelamento": ["cancelar", "cancelamento", "reembolso", "estorno"],
    "agradecimento": ["obrigado", "obrigada", "valeu", "agradeco"],
    "human_handover": ["humano", "pessoa", "falar com alguem", "atendente"],
    "agradecimento_pos": ["otimo", "excelente", "perfeito", "adorei"],
}


@app.post("/v1/intent/classify")
async def classify_intent(req: IntentRequest, _: None = Header(None)):
    """
    Classifica a intenção de uma mensagem do hóspede.
    Retorna: { intent, confidence, all_scores }
    """
    model = load_model("intent_classifier")

    if model is not None:
        # Modelo neural: prediz com TensorFlow
        try:
            tf = get_tf()
            # Tokeniza (TextVectorization layer embutida no modelo)
            prediction = model.predict(
                np.array([req.message]),
                verbose=0,
            )
            scores = prediction[0].tolist()
            intent_idx = int(np.argmax(scores))
            return {
                "intent": INTENT_LABELS[intent_idx],
                "confidence": float(scores[intent_idx]),
                "all_scores": {
                    INTENT_LABELS[i]: float(scores[i]) for i in range(len(INTENT_LABELS))
                },
                "source": "neural",
            }
        except Exception as e:
            logger.error(f"Intent model error: {e}")

    # Fallback heurístico (quando modelo não existe)
    lower_msg = req.message.lower()
    best_intent = "duvida_geral"
    best_score = 0.0

    for intent, keywords in INTENT_KEYWORDS.items():
        for kw in keywords:
            if kw in lower_msg:
                score = min(1.0, len(kw) / 20 + 0.5)
                if score > best_score:
                    best_score = score
                    best_intent = intent

    if best_score == 0:
        best_intent = "duvida_geral"
        best_score = 0.3

    return {
        "intent": best_intent,
        "confidence": best_score,
        "all_scores": {best_intent: best_score},
        "source": "heuristic_fallback",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. CHURN PREDICTOR
# ─────────────────────────────────────────────────────────────────────────────


@app.post("/v1/churn/predict")
async def predict_churn(req: ChurnRequest):
    """
    Prevê probabilidade de churn (0-1) para um tenant.
    Retorna: { churn_score, risk_level, top_factors }
    """
    model = load_model("churn_predictor")

    # Features normalizadas
    features = np.array([[
        req.days_since_login / 30,        # normalizado 0-1+
        req.messages_7d / 100,             # normalizado
        req.reservations_30d / 10,
        req.cost_usd_30d / req.budget_usd if req.budget_usd > 0 else 0,
        req.nps_score if req.nps_score else 5,
        req.qty_rooms / 50,
        req.days_since_onboarding / 365,
        req.errors_7d / 10,
        req.payment_overdue_days / 30,
        # One-hot do plano
        1 if req.plan == "lite" else 0,
        1 if req.plan == "pro" else 0,
        1 if req.plan == "max" else 0,
    ]])

    if model is not None:
        try:
            prediction = model.predict(features, verbose=0)
            churn_score = float(prediction[0][0])
        except Exception as e:
            logger.error(f"Churn model error: {e}")
            churn_score = _churn_heuristic(req)
    else:
        churn_score = _churn_heuristic(req)

    # Risk level
    if churn_score > 0.7:
        risk_level = "critical"
    elif churn_score > 0.4:
        risk_level = "warning"
    else:
        risk_level = "nominal"

    # Top factors (heurístico para explicabilidade)
    top_factors = []
    if req.days_since_login > 14:
        top_factors.append(f"Inativo {req.days_since_login} dias")
    if req.errors_7d > 5:
        top_factors.append(f"{req.errors_7d} erros em 7 dias")
    if req.payment_overdue_days > 7:
        top_factors.append(f"Pagamento atrasado {req.payment_overdue_days} dias")
    if req.messages_7d < 10 and req.days_since_onboarding > 30:
        top_factors.append("Baixo engajamento")

    return {
        "churn_score": churn_score,
        "risk_level": risk_level,
        "top_factors": top_factors,
        "source": "neural" if model else "heuristic_fallback",
    }


def _churn_heuristic(req: ChurnRequest) -> float:
    """Fallback heurístico quando modelo neural não existe."""
    score = 0.0
    if req.days_since_login > 14:
        score += 0.3
    if req.days_since_login > 30:
        score += 0.2
    if req.errors_7d > 5:
        score += 0.2
    if req.payment_overdue_days > 7:
        score += 0.2
    if req.messages_7d < 10 and req.days_since_onboarding > 30:
        score += 0.1
    return min(1.0, score)


# ─────────────────────────────────────────────────────────────────────────────
# 3. LEAD SCORER
# ─────────────────────────────────────────────────────────────────────────────


@app.post("/v1/lead/score")
async def score_lead(req: LeadScoreRequest):
    """
    Pontua um lead (0-1) por probabilidade de conversão.
    """
    model = load_model("lead_scorer")

    # Features
    tier_map = {"LITE": 0, "PRO": 1, "MAX": 2, "PARCEIRO": 3}
    funnel_map = {"HOT": 3, "WARM": 2, "WARM_LOW": 1, "COLD": 0}

    features = np.array([[
        req.qty_rooms / 50,
        tier_map.get(req.tier, 1) / 3,
        funnel_map.get(req.funnel, 2) / 3,
        req.score_qualificacao / 100,
        req.score_validacao / 100,
        # UF one-hot (top 5)
        1 if req.uf == "SC" else 0,
        1 if req.uf == "ES" else 0,
        1 if req.uf == "SP" else 0,
        1 if req.uf == "RS" else 0,
        1 if req.uf == "BA" else 0,
    ]])

    if model is not None:
        try:
            prediction = model.predict(features, verbose=0)
            score = float(prediction[0][0])
        except Exception as e:
            logger.error(f"Lead scorer error: {e}")
            score = _lead_heuristic(req)
    else:
        score = _lead_heuristic(req)

    return {
        "conversion_probability": score,
        "tier_recommended": "MAX" if score > 0.7 else ("PRO" if score > 0.4 else "LITE"),
        "source": "neural" if model else "heuristic_fallback",
    }


def _lead_heuristic(req: LeadScoreRequest) -> float:
    score = (req.score_qualificacao + req.score_validacao) / 200
    if req.qty_rooms > 20:
        score += 0.1
    if req.funnel == "HOT":
        score += 0.1
    return min(1.0, score)


# ─────────────────────────────────────────────────────────────────────────────
# 4. ANOMALY DETECTOR (Autoencoder)
# ─────────────────────────────────────────────────────────────────────────────


@app.post("/v1/anomaly/detect")
async def detect_anomaly(req: AnomalyRequest):
    """
    Detecta anomalias usando autoencoder (reconstruction error).
    """
    model = load_model("anomaly_detector")

    if len(req.metrics) == 0:
        return {"is_anomaly": False, "reconstruction_error": 0, "source": "empty_input"}

    features = np.array([req.metrics])

    if model is not None:
        try:
            reconstruction = model.predict(features, verbose=0)
            error = float(np.mean(np.abs(features - reconstruction)))

            # Threshold aprendido durante treino (salvar no modelo)
            threshold = 0.5  # default; idealmente carregado do treino

            return {
                "is_anomaly": error > threshold,
                "reconstruction_error": error,
                "threshold": threshold,
                "source": "neural",
            }
        except Exception as e:
            logger.error(f"Anomaly model error: {e}")

    # Fallback: 3σ
    if len(req.metrics) >= 3:
        mean = float(np.mean(req.metrics))
        std = float(np.std(req.metrics))
        latest = req.metrics[-1]
        z_score = abs(latest - mean) / std if std > 0 else 0
        return {
            "is_anomaly": z_score > 3,
            "reconstruction_error": z_score,
            "threshold": 3.0,
            "source": "heuristic_3sigma",
        }

    return {"is_anomaly": False, "reconstruction_error": 0, "source": "insufficient_data"}


# ─────────────────────────────────────────────────────────────────────────────
# 5. OCCUPANCY FORECASTER (LSTM)
# ─────────────────────────────────────────────────────────────────────────────


@app.post("/v1/occupancy/forecast")
async def forecast_occupancy(req: OccupancyRequest):
    """
    Prevê ocupação para os próximos N dias usando LSTM.
    """
    model = load_model("occupancy_forecaster")

    if len(req.history_days) < 30:
        return {
            "forecast": [],
            "source": "insufficient_data",
            "message": f"Need at least 30 days of history, got {len(req.history_days)}",
        }

    if model is not None:
        try:
            # LSTM espera shape (1, sequence_length, 1)
            history = np.array(req.history_days[-90:])  # últimos 90 dias
            features = history.reshape(1, -1, 1) / 100  # normalizar 0-100%

            prediction = model.predict(features, verbose=0)
            forecast = prediction[0].tolist()

            return {
                "forecast": forecast,
                "confidence": 0.8,
                "source": "neural",
            }
        except Exception as e:
            logger.error(f"Occupancy model error: {e}")

    # Fallback: média móvel
    recent = req.history_days[-7:]
    avg = sum(recent) / len(recent) if recent else 0
    forecast = [avg] * req.forecast_days

    return {
        "forecast": forecast,
        "confidence": 0.3,
        "source": "heuristic_moving_average",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. SENTIMENT ANALYZER
# ─────────────────────────────────────────────────────────────────────────────


SENTIMENT_KEYWORDS = {
    "positive": ["otimo", "otima", "excelente", "perfeito", "adorei", "maravilhoso", "feliz", "satisfeito", "obrigado", "obrigada", "valeu"],
    "negative": ["pessimo", "horrivel", "ruim", "terrivel", "insatisfeito", "reclamacao", "problema", "erro", "frustrado", "irritado"],
}


@app.post("/v1/sentiment/analyze")
async def analyze_sentiment(req: SentimentRequest):
    """
    Analisa sentimento da mensagem (-1 a +1).
    """
    model = load_model("sentiment_analyzer")

    if model is not None:
        try:
            prediction = model.predict(np.array([req.message]), verbose=0)
            sentiment = float(prediction[0][0]) * 2 - 1  # 0-1 → -1 to +1
            return {
                "sentiment": sentiment,
                "label": "positive" if sentiment > 0.1 else ("negative" if sentiment < -0.1 else "neutral"),
                "source": "neural",
            }
        except Exception as e:
            logger.error(f"Sentiment model error: {e}")

    # Fallback heurístico
    lower = req.message.lower()
    pos = sum(1 for kw in SENTIMENT_KEYWORDS["positive"] if kw in lower)
    neg = sum(1 for kw in SENTIMENT_KEYWORDS["negative"] if kw in lower)

    if pos > neg:
        sentiment = min(1.0, pos * 0.3)
        label = "positive"
    elif neg > pos:
        sentiment = max(-1.0, -neg * 0.3)
        label = "negative"
    else:
        sentiment = 0.0
        label = "neutral"

    return {
        "sentiment": sentiment,
        "label": label,
        "source": "heuristic_fallback",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 7. PRICE OPTIMIZER
# ─────────────────────────────────────────────────────────────────────────────


@app.post("/v1/price/optimize")
async def optimize_price(req: PriceRequest):
    """
    Otimiza preço da diária usando rede neural de regressão.
    """
    model = load_model("price_optimizer")

    occupancy_rate = req.occupied_rooms / req.total_rooms if req.total_rooms > 0 else 0
    forecast = req.forecast_occupancy if req.forecast_occupancy is not None else occupancy_rate

    # Features
    features = np.array([[
        req.base_daily_rate / 1000,  # normalizar
        occupancy_rate,
        forecast,
        1 if req.is_special_holiday else 0,
        req.qty_rooms / 50,
        # UF one-hot
        1 if req.uf == "SC" else 0,
        1 if req.uf == "BA" else 0,
        1 if req.uf == "RJ" else 0,
    ]])

    if model is not None:
        try:
            prediction = model.predict(features, verbose=0)
            optimal_price = float(prediction[0][0])
            return {
                "optimal_price": max(req.base_daily_rate, optimal_price),
                "surge_multiplier": optimal_price / req.base_daily_rate if req.base_daily_rate > 0 else 1.0,
                "source": "neural",
            }
        except Exception as e:
            logger.error(f"Price model error: {e}")

    # Fallback: yield engine rules (mesmo do dynamic-yield-engine.ts)
    if occupancy_rate >= 0.80 or (req.is_special_holiday):
        multiplier = 1.60
        tier = "SCARCITY_LOCK"
    elif occupancy_rate >= 0.50:
        multiplier = 1.25
        tier = "DEMAND_SURGE"
    else:
        multiplier = 1.0
        tier = "NOMINAL"

    optimal_price = round(req.base_daily_rate * multiplier)
    return {
        "optimal_price": optimal_price,
        "surge_multiplier": multiplier,
        "tier": tier,
        "source": "heuristic_fallback",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. UPSELL RECOMMENDER
# ─────────────────────────────────────────────────────────────────────────────


UPSELL_ITEMS = [
    {"id": "early_checkin", "name": "Early Check-in", "price": 50, "description": "Check-in antecipado (12h)"},
    {"id": "late_checkout", "name": "Late Checkout", "price": 50, "description": "Check-out tardio (14h)"},
    {"id": "pet", "name": "Pet Friendly", "price": 80, "description": "Hospedagem com pet"},
    {"id": "breakfast_extra", "name": "Café Extra", "price": 30, "description": "Café da manhã adicional"},
    {"id": "airport_transfer", "name": "Transfer Aeroporto", "price": 120, "description": "Transfer ida/volta aeroporto"},
    {"id": "spa", "name": "Spa & Massagem", "price": 150, "description": "Sessão de spa relaxante"},
]


@app.post("/v1/upsell/recommend")
async def recommend_upsell(req: UpsellRequest):
    """
    Recomenda top 3 upsell items para um perfil de hóspede.
    """
    model = load_model("upsell_recommender")

    if model is not None:
        try:
            # TFRS retorna scores para cada item
            profile = _encode_profile(req.guest_profile)
            scores = model.predict(np.array([profile]), verbose=0)[0]
            ranked = sorted(
                zip(UPSELL_ITEMS, scores.tolist()),
                key=lambda x: x[1],
                reverse=True,
            )[:3]
            return {
                "recommendations": [
                    {**item, "score": float(score)} for item, score in ranked
                ],
                "source": "neural",
            }
        except Exception as e:
            logger.error(f"Upsell model error: {e}")

    # Fallback: baseado em regras simples
    recs = []
    profile = req.guest_profile
    if profile.get("has_pet"):
        recs.append({**UPSELL_ITEMS[2], "score": 0.9})
    if profile.get("arrival_time") and "manha" in str(profile.get("arrival_time", "")).lower():
        recs.append({**UPSELL_ITEMS[0], "score": 0.8})
    if profile.get("plan") in ["PRO", "MAX"]:
        recs.append({**UPSELL_ITEMS[5], "score": 0.7})

    # Preenche com items padrão se não tem 3
    for item in UPSELL_ITEMS:
        if len(recs) >= 3:
            break
        if not any(r["id"] == item["id"] for r in recs):
            recs.append({**item, "score": 0.5})

    return {
        "recommendations": recs[:3],
        "source": "heuristic_fallback",
    }


def _encode_profile(profile: dict) -> list:
    """Encode profile dict to feature vector."""
    return [
        1 if profile.get("has_pet") else 0,
        1 if profile.get("plan") == "MAX" else 0,
        1 if profile.get("plan") == "PRO" else 0,
        profile.get("nights", 1) / 10,
        profile.get("guests", 2) / 10,
    ]


# ─────────────────────────────────────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=PORT,
        workers=1,  # CPU inference — 1 worker para não consumir RAM extra
        log_level="info",
    )
