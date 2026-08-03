# scripts/train_dpo.py
"""
Script de Fine-Tuning DPO (Direct Preference Optimization) + LoRA
Treinamento do modelo Qwen 2.5 14B no Ollama da VPS Hostinger
"""

import os
import torch
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import DPOTrainer, DPOConfig
from peft import LoraConfig

def run_dpo():
    model_id = os.getenv("DPO_BASE_MODEL", "Qwen/Qwen2.5-14B-Instruct")
    dataset_file = os.getenv("DPO_DATASET_FILE", "dpo_dataset.jsonl")
    
    print(f"🚀 Iniciando Pipeline DPO para o Cérebro Zélla | Modelo: {model_id}")
    
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    dataset = load_dataset("json", data_files=dataset_file)

    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        bias="none",
        task_type="CAUSAL_LM",
    )

    training_args = DPOConfig(
        output_dir="./dpo_output",
        beta=0.1,
        learning_rate=5e-6,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        max_length=1024,
        max_prompt_length=512,
        num_train_epochs=3,
        logging_steps=10,
        save_strategy="epoch",
    )

    trainer = DPOTrainer(
        model=model_id,
        ref_model=None, # Usa PEFT/LoRA para economizar VRAM na VPS
        args=training_args,
        train_dataset=dataset["train"],
        tokenizer=tokenizer,
        peft_config=peft_config,
    )

    trainer.train()
    trainer.save_model("./final_dpo_adapter")
    print("✅ Fine-tuning DPO concluído com sucesso! Adaptador salvo em ./final_dpo_adapter")

if __name__ == "__main__":
    run_dpo()
