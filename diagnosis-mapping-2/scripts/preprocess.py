import pandas as pd
import os

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_DIR  = os.path.join(BASE_DIR, "..", "data")
OUT_DIR   = os.path.join(BASE_DIR, "..", "data")   # cleaned files stay in data/

DIAG_CSV  = os.path.join(DATA_DIR, "diagnoses.csv")
MED_CSV   = os.path.join(DATA_DIR, "medicines.csv")

# ── 1. Load ────────────────────────────────────────────────────────────────────
print("Loading CSVs...")
diagnoses = pd.read_csv(DIAG_CSV)
medicines = pd.read_csv(MED_CSV)

print(f"  Diagnoses  : {len(diagnoses):,} rows")
print(f"  Medicines  : {len(medicines):,} rows")

# ── 2. Clean medicines ─────────────────────────────────────────────────────────

# Normalise column names (strip whitespace, lower)
medicines.columns = medicines.columns.str.strip().str.lower().str.replace(r"[^a-z0-9]", "_", regex=True)

# Expected columns after normalisation:
#   id, name, price____, is_discontinued, manufacturer_name, type,
#   pack_size_label, short_composition1, short_composition2

# 2a. Drop discontinued
before = len(medicines)
medicines = medicines[medicines["is_discontinued"] != True].copy()
print(f"\nDropped {before - len(medicines):,} discontinued medicines → {len(medicines):,} remaining")

# 2b. Fill composition nulls
medicines["short_composition1"] = medicines["short_composition1"].fillna("").str.strip()
medicines["short_composition2"] = medicines["short_composition2"].fillna("").str.strip()

# 2c. Build a canonical composition key  (composition1 + " | " + composition2)
medicines["composition_key"] = (
    medicines["short_composition1"] + " | " + medicines["short_composition2"]
).str.strip(" |")

# 2d. Deduplicate — keep one representative brand per unique composition
medicines_deduped = (
    medicines
    .sort_values("name")                          # deterministic representative
    .drop_duplicates(subset="composition_key", keep="first")
    .reset_index(drop=True)
)
print(f"After dedup by composition: {len(medicines_deduped):,} unique drugs")

# 2e. Build embedding text
medicines_deduped["embed_text"] = (
    medicines_deduped["name"].fillna("") + " | " +
    medicines_deduped["composition_key"]
).str.strip(" |")

# ── 3. Clean diagnoses ─────────────────────────────────────────────────────────
diagnoses.columns = diagnoses.columns.str.strip().str.lower().str.replace(r"[^a-z0-9]", "_", regex=True)

# Expected columns: code, description, type, searchable_text
diagnoses["searchable_text"] = diagnoses["searchable_text"].fillna(
    diagnoses["description"].fillna("")
)

# Drop rows with no usable text
diagnoses = diagnoses[diagnoses["searchable_text"].str.strip() != ""].reset_index(drop=True)
print(f"Diagnoses with usable text: {len(diagnoses):,}")

# ── 4. Save cleaned files ──────────────────────────────────────────────────────
diag_out = os.path.join(OUT_DIR, "diagnoses_clean.csv")
med_out  = os.path.join(OUT_DIR, "medicines_clean.csv")

diagnoses.to_csv(diag_out, index=False)
medicines_deduped.to_csv(med_out, index=False)

print(f"\n✅ Saved:")
print(f"   {diag_out}")
print(f"   {med_out}")
print("\nPreprocessing complete. Run generate_embeddings.py next.")