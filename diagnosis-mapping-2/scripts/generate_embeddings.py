import os
os.environ["HF_HOME"] = "D:/huggingface_cache"
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
from tqdm import tqdm


# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
OUT_DIR  = os.path.join(BASE_DIR, "..", "output")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Load cleaned CSVs ──────────────────────────────────────────────────────────
print("Loading cleaned CSVs...")
diagnoses = pd.read_csv(os.path.join(DATA_DIR, "diagnoses_clean.csv"))
medicines = pd.read_csv(os.path.join(DATA_DIR, "medicines_clean.csv"))

print(f"  Diagnoses : {len(diagnoses):,}")
print(f"  Medicines : {len(medicines):,}")

# ── Load model ─────────────────────────────────────────────────────────────────
# Biomedical-tuned model — downloads once (~420MB), then cached locally
MODEL_NAME = "all-MiniLM-L6-v2"
print(f"\nLoading model: {MODEL_NAME}")
print("(First run downloads ~420MB — subsequent runs use local cache)")
model = SentenceTransformer(MODEL_NAME)

# ── Generate medicine embeddings ───────────────────────────────────────────────
print("\nGenerating medicine embeddings...")
med_texts = medicines["embed_text"].fillna("").tolist()
med_emb = model.encode(
    med_texts,
    batch_size=64,
    show_progress_bar=True,
    convert_to_numpy=True
)
np.save(os.path.join(OUT_DIR, "medicine_embeddings.npy"), med_emb)
print(f"  Saved medicine_embeddings.npy — shape: {med_emb.shape}")

# ── Generate diagnosis embeddings ──────────────────────────────────────────────
print("\nGenerating diagnosis embeddings...")
diag_texts = diagnoses["searchable_text"].fillna("").tolist()
diag_emb = model.encode(
    diag_texts,
    batch_size=64,
    show_progress_bar=True,
    convert_to_numpy=True
)
np.save(os.path.join(OUT_DIR, "diagnosis_embeddings.npy"), diag_emb)
print(f"  Saved diagnosis_embeddings.npy — shape: {diag_emb.shape}")

print("\n✅ Embeddings complete. Run build_index.py next.")