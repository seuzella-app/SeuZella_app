"""
Script de treinamento — Intent Classifier (BERT-lite)
======================================================
Treina um classificador de intenção para mensagens WhatsApp.

Modelo: TextVectorization + Embedding + LSTM + Dense
Input: mensagem PT-BR (string)
Output: 9 classes de intenção

Como treinar (offline, no laptop ou Google Colab):
  python3 train/train_intent.py --data /path/to/messages.csv --output models/intent_classifier.keras

Formato do CSV:
  message,intent
  "qual o preço da diária?",cotacao_reserva
  "qual a senha do wifi?",duvida_geral
  ...

Após treinar, copiar o .keras para deploy/tensorflow-sidecar/models/
"""

import argparse
import os
import sys

import numpy as np
import pandas as pd

# Lazy import TF
def get_tf():
    import tensorflow as tf
    return tf


INTENT_LABELS = [
    "cotacao_reserva", "reserva_direta", "duvida_geral", "suporte_tecnico",
    "checkin_checkout", "cancelamento", "agradecimento",
    "human_handover", "agradecimento_pos",
]
INTENT_TO_IDX = {label: i for i, label in enumerate(INTENT_LABELS)}


def build_model(vocab_size=10000, seq_length=50, embed_dim=64):
    """Constrói o modelo BERT-lite (TextVectorization + LSTM)."""
    tf = get_tf()

    # TextVectorization layer (tokeniza + padding)
    vectorizer = tf.keras.layers.TextVectorization(
        max_tokens=vocab_size,
        output_mode="int",
        output_sequence_length=seq_length,
    )

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(1,), dtype=tf.string),
        vectorizer,
        tf.keras.layers.Embedding(vocab_size, embed_dim),
        tf.keras.layers.LSTM(64, return_sequences=False),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(len(INTENT_LABELS), activation="softmax"),
    ])

    model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model, vectorizer


def train(data_path: str, output_path: str):
    tf = get_tf()

    # Carrega dados
    df = pd.read_csv(data_path)
    messages = df["message"].values
    labels = df["intent"].map(INTENT_TO_IDX).values

    # Split 80/20
    n = len(messages)
    split = int(n * 0.8)
    x_train, x_val = messages[:split], messages[split:]
    y_train, y_val = labels[:split], labels[split:]

    # Constrói modelo
    model, vectorizer = build_model()

    # Adapta vocabulário
    vectorizer.adapt(tf.constant(x_train.reshape(-1, 1)))

    # Treina
    print(f"Training with {len(x_train)} samples...")
    history = model.fit(
        x_train.reshape(-1, 1),
        y_train,
        validation_data=(x_val.reshape(-1, 1), y_val),
        epochs=10,
        batch_size=32,
        verbose=1,
    )

    # Avalia
    loss, acc = model.evaluate(x_val.reshape(-1, 1), y_val, verbose=0)
    print(f"Validation accuracy: {acc:.4f}")

    # Salva
    model.save(output_path)
    print(f"Model saved to {output_path}")

    # Se não tem dados, gera modelo mock
    if n == 0:
        print("WARNING: No training data — saved untrained model")


def generate_mock_data():
    """Gera dataset mock para teste quando não há dados reais."""
    mock_data = [
        ("qual o preço da diária?", "cotacao_reserva"),
        ("quanto custa o pacote de réveillon?", "cotacao_reserva"),
        ("valor da diária para o feriado?", "cotacao_reserva"),
        ("quero reservar via pix", "reserva_direta"),
        ("pode me enviar o pix para pagar?", "reserva_direta"),
        ("qual a senha do wifi?", "duvida_geral"),
        ("que horas é o café da manhã?", "duvida_geral"),
        ("tem estacionamento?", "duvida_geral"),
        ("a fechadura eletrônica não funciona", "suporte_tecnico"),
        ("o ar condicionado quebrou", "suporte_tecnico"),
        ("que horas posso fazer check-in?", "checkin_checkout"),
        ("horário de check-out?", "checkin_checkout"),
        ("preciso cancelar minha reserva", "cancelamento"),
        ("quero reembolso", "cancelamento"),
        ("muito obrigado pela atenção", "agradecimento"),
        ("valeu, foi ótimo!", "agradecimento_pos"),
        ("quero falar com uma pessoa", "human_handover"),
        ("tem alguém para me atender?", "human_handover"),
    ]
    return pd.DataFrame(mock_data, columns=["message", "intent"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, help="Path to training CSV")
    parser.add_argument("--output", type=str, default="models/intent_classifier.keras")
    args = parser.parse_args()

    if args.data and os.path.exists(args.data):
        train(args.data, args.output)
    else:
        # Gera dados mock
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        mock = generate_mock_data()
        mock_path = "/tmp/intent_mock.csv"
        mock.to_csv(mock_path, index=False)
        print(f"Using mock data ({len(mock)} samples)")
        train(mock_path, args.output)
