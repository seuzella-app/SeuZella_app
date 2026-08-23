"""
Script de treinamento — TODOS os 8 modelos em um único script.
Gera modelos .keras prontos para deploy.

Uso:
  cd deploy/tensorflow-sidecar
  python3 train/train_all.py

  # Ou treinar modelos individuais:
  python3 train/train_all.py --models intent churn
"""

import argparse
import os
import sys

def get_tf():
    import tensorflow as tf
    return tf

import numpy as np


def train_intent(output_path):
    """Treina Intent Classifier."""
    tf = get_tf()
    # Reusa a lógica de train_intent.py
    from train_intent import build_model, generate_mock_data, INTENT_TO_IDX
    import pandas as pd

    df = generate_mock_data()
    model, vectorizer = build_model()
    vectorizer.adapt(tf.constant(df["message"].values.reshape(-1, 1)))
    labels = df["intent"].map(INTENT_TO_IDX).values
    model.fit(df["message"].values.reshape(-1, 1), labels, epochs=5, verbose=0)
    model.save(output_path)
    print(f"  ✓ intent_classifier → {output_path}")


def train_churn(output_path):
    """Treina Churn Predictor (Dense neural network)."""
    tf = get_tf()

    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation="relu", input_shape=(13,)),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])

    # Dados mock
    X = np.random.rand(1000, 13)
    y = (X[:, 0] > 0.5).astype(float)  # days_since_login > 15 → churn
    model.fit(X, y, epochs=10, batch_size=32, verbose=0)
    model.save(output_path)
    print(f"  ✓ churn_predictor → {output_path}")


def train_lead(output_path):
    """Treina Lead Scorer."""
    tf = get_tf()

    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation="relu", input_shape=(10,)),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])

    X = np.random.rand(500, 10)
    y = (X[:, 3] + X[:, 4] > 1.0).astype(float)  # score_qual + score_valid alto → converte
    model.fit(X, y, epochs=10, batch_size=32, verbose=0)
    model.save(output_path)
    print(f"  ✓ lead_scorer → {output_path}")


def train_anomaly(output_path):
    """Treina Anomaly Detector (Autoencoder)."""
    tf = get_tf()

    model = tf.keras.Sequential([
        tf.keras.layers.Dense(32, activation="relu", input_shape=(10,)),
        tf.keras.layers.Dense(8, activation="relu"),  # bottleneck
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(10, activation="sigmoid"),  # reconstruction
    ])
    model.compile(optimizer="adam", loss="mse")

    X_normal = np.random.rand(500, 10) * 0.5 + 0.25  # normal range
    model.fit(X_normal, X_normal, epochs=20, batch_size=32, verbose=0)
    model.save(output_path)
    print(f"  ✓ anomaly_detector → {output_path}")


def train_occupancy(output_path):
    """Treina Occupancy Forecaster (LSTM)."""
    tf = get_tf()

    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(64, input_shape=(90, 1), return_sequences=False),
        tf.keras.layers.Dense(30, activation="linear"),  # 30 dias de previsão
    ])
    model.compile(optimizer="adam", loss="mse")

    X = np.random.rand(100, 90, 1)
    y = np.random.rand(100, 30)
    model.fit(X, y, epochs=5, batch_size=16, verbose=0)
    model.save(output_path)
    print(f"  ✓ occupancy_forecaster → {output_path}")


def train_sentiment(output_path):
    """Treina Sentiment Analyzer."""
    tf = get_tf()
    from train_intent import build_model

    # Reusa arquitetura do intent classifier mas com output sigmoid (0-1)
    model, vectorizer = build_model()
    # Substitui última camada
    model.pop()
    model.add(tf.keras.layers.Dense(1, activation="sigmoid"))
    model.compile(optimizer="adam", loss="binary_crossentropy")

    # Mock data
    texts = np.array(["ótimo", "excelente", "perfeito", "ruim", "horrível", "problema", "obrigado", "frustrado"])
    labels = np.array([1, 1, 1, 0, 0, 0, 1, 0])
    vectorizer.adapt(tf.constant(texts.reshape(-1, 1)))
    model.fit(texts.reshape(-1, 1), labels, epochs=5, verbose=0)
    model.save(output_path)
    print(f"  ✓ sentiment_analyzer → {output_path}")


def train_price(output_path):
    """Treina Price Optimizer."""
    tf = get_tf()

    model = tf.keras.Sequential([
        tf.keras.layers.Dense(64, activation="relu", input_shape=(8,)),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(1, activation="linear"),
    ])
    model.compile(optimizer="adam", loss="mse")

    X = np.random.rand(500, 8)
    y = X[:, 0] * 1000 * (1 + X[:, 1] * 0.6)  # preço ≈ base × (1 + occupancy*0.6)
    model.fit(X, y, epochs=20, batch_size=32, verbose=0)
    model.save(output_path)
    print(f"  ✓ price_optimizer → {output_path}")


def train_upsell(output_path):
    """Treina Upsell Recommender."""
    tf = get_tf()

    model = tf.keras.Sequential([
        tf.keras.layers.Dense(32, activation="relu", input_shape=(5,)),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(6, activation="softmax"),  # 6 items de upsell
    ])
    model.compile(optimizer="adam", loss="categorical_crossentropy")

    X = np.random.rand(200, 5)
    y = np.eye(6)[np.random.randint(0, 6, 200)]
    model.fit(X, y, epochs=10, batch_size=32, verbose=0)
    model.save(output_path)
    print(f"  ✓ upsell_recommender → {output_path}")


MODELS = {
    "intent": ("intent_classifier.keras", train_intent),
    "churn": ("churn_predictor.keras", train_churn),
    "lead": ("lead_scorer.keras", train_lead),
    "anomaly": ("anomaly_detector.keras", train_anomaly),
    "occupancy": ("occupancy_forecaster.keras", train_occupancy),
    "sentiment": ("sentiment_analyzer.keras", train_sentiment),
    "price": ("price_optimizer.keras", train_price),
    "upsell": ("upsell_recommender.keras", train_upsell),
}


def main():
    parser = argparse.ArgumentParser(description="Train all 8 TensorFlow models for Cérebro Zélla")
    parser.add_argument("--models", nargs="+", default=list(MODELS.keys()),
                        help="Models to train (default: all)")
    parser.add_argument("--output", type=str, default="models/",
                        help="Output directory for .keras files")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  ZÉLLA — TensorFlow Model Training")
    print(f"  Models: {args.models}")
    print(f"  Output: {args.output}")
    print(f"{'='*60}\n")

    for name in args.models:
        if name not in MODELS:
            print(f"  ✗ Unknown model: {name}")
            continue

        filename, train_fn = MODELS[name]
        output_path = os.path.join(args.output, filename)

        print(f"\n  Training {name}...")
        try:
            train_fn(output_path)
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            continue

    print(f"\n{'='*60}")
    print(f"  Done! Models saved in {args.output}")
    print(f"  Copy to: deploy/tensorflow-sidecar/models/")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
