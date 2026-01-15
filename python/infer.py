#!/usr/bin/env python3
import base64
import csv
import hashlib
import json
import math
import sys
import traceback
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

import numpy as np
import pandas as pd

# Lazy import joblib to save startup time if not needed immediately, 
# but for persistent server it's better to import at top.
try:
    import joblib
except ImportError:
    joblib = None

# Constants
MODEL_PATHS = {
    "lgbm_full": Path("usable_model/Historical_LightGBM.pkl"),
    "lgbm_meta": Path("usable_model/No_Historical_LightGBM.pkl"),
}

CATEGORY_MAP = {
    "Category": ["FEMININE", "MASCULINE", "CHILDREN", "__NA__"],
    "Color": ["BLACK", "WHITE", "PINK", "RED", "BLUE", "GREEN", "BEIGE", "GRAY", "PURPLE", "__NA__"],
    "Sizes": [
        "S|M|L|XL", "XS|S|M", "M|L", "S|M|L", "XS|S|M|L|XL",
        "M|L|XL", "L|XL", "XS|S", "S|M", "L|XL|XXL",
        "S", "M", "L", "XL", "XS", "XXL",
        "__NA__"
    ],
    "age_bucket": ["age_0_2", "age_3_5", "age_6_11", "age_12_23", "age_24p", "__NA__"],
}

USE_COLS = [
    'product_id', 'm', 'month_sin', 'month_cos', 'month_idx',
    'age_m', 'age_log1p', 'age_sqrt', 'age_bucket',
    'age_0_2', 'age_3_5', 'age_6_11', 'age_12_23', 'age_24p',
    'is_first_year', 'Category', 'Color', 'Sizes',
    'cost_ln', 'first_sale_month_num'
]

# Weights for heuristic fallback
CATEGORY_WEIGHTS = {"feminine": 12, "menswear": 15, "outerwear": 18, "athleisure": 10, "denim": 14, "footwear": 16}
COLOR_WEIGHTS = {"black": 10, "white": 6, "beige": 5, "blue": 8, "green": 7, "pink": 5, "purple": 6, "red": 9, "gray": 6}

# Mappings for coercion optimization
CATEGORY_NORMALIZATION = {
    "FEMININE": "FEMININE", "MASCULINE": "MASCULINE", "CHILDREN": "CHILDREN",
    "MUSCULINE": "MASCULINE", "MASCULIN": "MASCULINE", "FEMININ": "FEMININE",
    "WOMEN": "FEMININE", "WOMAN": "FEMININE", "FEMALE": "FEMININE", "LADIES": "FEMININE",
    "MEN": "MASCULINE", "MENS": "MASCULINE", "MALE": "MASCULINE", "MENSWEAR": "MASCULINE",
    "KIDS": "CHILDREN", "CHILD": "CHILDREN", "BABY": "CHILDREN",
}

SIZE_NORMALIZATION = {
    "XS|S|M|L|XL": "XS|S|M|L|XL", "S|M|L|XL": "S|M|L|XL", "S|M|L": "S|M|L",
    "M|L|XL": "M|L|XL", "M|L": "M|L", "XS|S|M": "XS|S|M",
    "S": "S", "M": "M", "L": "L", "XL": "XL", "XS": "XS", "XXL": "XXL",
}

# Global cache
_MODEL_CACHE = {}

def add_months(start: datetime, offset: int) -> datetime:
    year = start.year + (start.month - 1 + offset) // 12
    month = (start.month - 1 + offset) % 12 + 1
    return datetime(year, month, 1)

def parse_month(value: str) -> datetime:
    try:
        return datetime.strptime(str(value)[:7], "%Y-%m")
    except Exception:
        return datetime.utcnow().replace(day=1)

def decode_csv_content(content: Optional[str]) -> List[Dict[str, Any]]:
    if not content:
        return []
    try:
        payload = content.split(",", 1)[1] if content.startswith("data:") else content
        decoded = base64.b64decode(payload)
        buffer = StringIO(decoded.decode("utf-8"))
        reader = csv.DictReader(buffer)
        
        # Optimize aggregation using dictionary direct access
        aggregated: Dict[str, float] = {}
        
        for row in reader:
            month_raw = row.get("month") or row.get("date") or row.get("period")
            if not month_raw: continue
            
            # Fast month parsing
            try:
                # Assuming YYYY-MM format usually
                m_str = str(month_raw)[:7] 
                # Validate simple format to avoid strptime if possible
                if len(m_str) == 7 and m_str[4] == '-':
                    month_str = m_str
                else:
                    month_str = parse_month(m_str).strftime("%Y-%m")
            except:
                continue

            qty_val = row.get("qty") or row.get("quantity") or row.get("value")
            qty = 0.0
            if qty_val is not None:
                if isinstance(qty_val, (int, float)):
                    qty = float(qty_val)
                else:
                    try:
                        qty = float(str(qty_val).replace(" ", "").replace(",", ""))
                    except:
                        pass
            
            if qty > 0:
                aggregated[month_str] = aggregated.get(month_str, 0.0) + qty

        # Sort by key (month)
        return [{"month": m, "qty": q} for m, q in sorted(aggregated.items())]
    except Exception as e:
        print(f"[Python] CSV Decode Error: {e}", file=sys.stderr)
        return []

def load_model(model_key: str):
    if model_key in _MODEL_CACHE:
        return _MODEL_CACHE[model_key]
    
    if not joblib:
        return None
        
    path = MODEL_PATHS.get(model_key)
    if not path or not path.exists():
        return None
        
    try:
        print(f"[Python] Loading model {model_key}...", file=sys.stderr)
        model = joblib.load(path)
        _MODEL_CACHE[model_key] = model
        return model
    except Exception as e:
        print(f"[Python] Model load failed: {e}", file=sys.stderr)
        return None

def coerce_categories(df: pd.DataFrame) -> pd.DataFrame:
    # Vectorized string operations
    for col in ["Category", "Color", "Sizes"]:
        if col in df.columns:
            # Combined fillna+astype+strip+upper
            df[col] = df[col].fillna("__NA__").astype(str).str.strip().str.upper()

    # Apply fast mapping
    if "Category" in df.columns:
        df["Category"] = df["Category"].map(CATEGORY_NORMALIZATION).fillna(df["Category"])
    
    if "Sizes" in df.columns:
        df["Sizes"] = df["Sizes"].map(SIZE_NORMALIZATION).fillna(df["Sizes"])

    # Categorical enforcement
    for col, cats in CATEGORY_MAP.items():
        if col in df.columns:
            # Efficient where: keep if in cats, else __NA__
            # Note: isin is fast on categorical data, but here we have strings
            df[col] = df[col].where(df[col].isin(cats), "__NA__")
            df[col] = pd.Categorical(df[col], categories=cats)
            
    return df

def map_age_bucket_vectorized(age_m_series: pd.Series) -> pd.Series:
    # Vectorized cut is much faster than apply
    return pd.cut(
        age_m_series, 
        bins=[-np.inf, 2, 5, 11, 23, np.inf], 
        labels=["age_0_2", "age_3_5", "age_6_11", "age_12_23", "age_24p"]
    ).astype(str)

def create_features_vectorized(payload: Dict[str, Any], model_key: str, horizon: int, history_rows: List[Dict]) -> pd.DataFrame:
    product = payload.get("product", {}) or {}
    
    # 1. Parse Inputs
    category = str(product.get("category") or "").strip().upper()
    color = str(product.get("color") or "").strip().upper()
    sizes = str(product.get("sizes") or "").strip().upper()
    cost = float(product.get("cost") or 290.0)
    cost_ln = math.log(cost) if cost > 0 else 0.0
    
    first_sale = product.get("first_sale_month", "2025-01")
    try:
        first_sale_dt = datetime.strptime(first_sale[:7], "%Y-%m")
    except:
        first_sale_dt = datetime.now().replace(day=1)
    
    first_sale_month_num = first_sale_dt.year * 12 + first_sale_dt.month
    start_dt = add_months(first_sale_dt, 1)

    # 2. Build Date Range (Vectorized)
    # Create list of prediction dates
    pred_dates = [add_months(start_dt, i) for i in range(horizon)]
    
    # Initialize DataFrame
    df = pd.DataFrame({
        "date": pred_dates,
        "m": [d.month for d in pred_dates],
        "year": [d.year for d in pred_dates],
    })
    
    # 3. Vectorized Feature Calculation
    
    # Seasonality
    # 2*pi*m/12
    rads = 2 * np.pi * df["m"] / 12.0
    df["month_sin"] = np.sin(rads)
    df["month_cos"] = np.cos(rads)
    
    # Month Index
    # (year * 12 + month) - (2000 * 12) - 1
    df["month_idx"] = (df["year"] * 12 + df["m"]) - 24001 # 2000*12 + 1
    
    # Age Features
    # age in months from first_sale
    df["age_m"] = (df["year"] - first_sale_dt.year) * 12 + (df["m"] - first_sale_dt.month)
    df["age_log1p"] = np.log1p(df["age_m"])
    df["age_sqrt"] = np.sqrt(np.maximum(df["age_m"], 0))
    df["first_sale_month_num"] = first_sale_month_num
    
    # Age Bucket & OHE
    df["age_bucket"] = map_age_bucket_vectorized(df["age_m"])
    # One-hot encode age_bucket manually to ensure columns exist
    for bucket in CATEGORY_MAP["age_bucket"]:
        if bucket != "__NA__":
            df[bucket] = (df["age_bucket"] == bucket).astype(int)
    
    df["is_first_year"] = (df["age_m"] < 12).astype(int)
    
    # Product Metadata (Constant columns)
    df["Category"] = category
    df["Color"] = color
    df["Sizes"] = sizes
    df["cost_ln"] = cost_ln
    
    # Product ID Hash
    product_signature = f"{category}|{color}|{sizes}|{int(cost)}"
    product_id = int(hashlib.md5(product_signature.encode()).hexdigest(), 16) % 1000000
    df["product_id"] = product_id
    
    # 4. Historical Features (Lag/Roll) - Only for lgbm_full
    if model_key == "lgbm_full":
        # Convert history to Series indexed by date for fast lookup
        if history_rows:
            hist_df = pd.DataFrame(history_rows)
            hist_df["dt"] = pd.to_datetime(hist_df["month"] + "-01")
            hist_df["log_qty"] = np.log1p(hist_df["qty"])
            hist_series = hist_df.set_index("dt")["log_qty"]
        else:
            hist_series = pd.Series(dtype=float)

        # Pre-calculate all needed lags
        # We need lags 1, 2, 3, 12 relative to EACH prediction date
        # Since horizon is small (12), we can just iterate or use reindexing
        # For a truly vectorized approach with larger horizons, we'd merge, but loop is fine for N=12
        
        lags_needed = [1, 2, 3, 12]
        
        # We also need rolling windows 3, 6, 12
        # Logic: for each pred_date, get values at [date-window...date-1]
        
        feature_data = []
        for d in pred_dates:
            row_feats = {}
            
            # Helper to get value at offset
            def get_val(offset):
                target = add_months(d, -offset)
                # Lookup in history series
                if target in hist_series.index:
                    return float(hist_series.at[target])
                # If prediction depends on previous prediction (recursive), we assume 0 here 
                # because this is a direct forecast model, not recursive step-by-step
                # Note: If model was trained recursively, we'd need to predict step-by-step.
                # Assuming direct strategy or history availability.
                return 0.0

            # Lags
            l1 = get_val(1)
            l3 = get_val(3)
            l6 = get_val(6)
            
            row_feats["lag1_logqty"] = l1
            row_feats["lag2_logqty"] = get_val(2)
            row_feats["lag3_logqty"] = l3
            row_feats["lag12_logqty"] = get_val(12)
            
            # Rolling Means (manual calculation is fast for small windows)
            # collect last 12 values once
            last_12 = [get_val(k) for k in range(1, 13)]
            
            row_feats["roll3_mean_log"] = np.mean(last_12[:3]) if last_12 else 0.0
            row_feats["roll6_mean_log"] = np.mean(last_12[:6]) if last_12 else 0.0
            row_feats["roll12_mean_log"] = np.mean(last_12) if last_12 else 0.0
            
            # Momentum
            row_feats["mom3"] = l1 - l3
            row_feats["mom6"] = l1 - l6
            
            # EMA (Exponential Moving Average)
            # This matches the Python implementation logic
            def calc_ema(values):
                if not values: return 0.0
                alpha = 2 / (len(values) + 1)
                ema = values[-1] # oldest
                for v in reversed(values[:-1]): # iterate oldest to newest
                    ema = alpha * v + (1 - alpha) * ema
                return ema

            # The python version used [offset for offset in range(window, 0, -1)] which is oldest -> newest
            # last_12 is [lag1, lag2...] (newest -> oldest)
            # so last_12[:3][::-1] is [lag3, lag2, lag1] (oldest -> newest)
            row_feats["ema3_log"] = calc_ema(last_12[:3])
            row_feats["ema6_log"] = calc_ema(last_12[:6])
            
            feature_data.append(row_feats)
            
        feat_df = pd.DataFrame(feature_data)
        df = pd.concat([df, feat_df], axis=1)

    # 5. Final Coercion & Selection
    df = coerce_categories(df)
    
    # Ensure columns and types
    final_cols = USE_COLS[:]
    if model_key == "lgbm_full":
         final_cols += [
            "lag1_logqty", "lag2_logqty", "lag3_logqty", "lag12_logqty",
            "roll3_mean_log", "roll6_mean_log", "roll12_mean_log",
            "ema3_log", "ema6_log", "mom3", "mom6",
        ]
    
    # Fill missing and select
    for c in final_cols:
        if c not in df.columns:
            df[c] = 0.0 # Default fill
    
    return df[final_cols]

def heuristic_prediction(payload: Dict, history_rows: List[Dict]) -> Dict:
    # Optimized heuristic without re-parsing CSV
    model_key = payload.get("model", "lgbm_meta")
    horizon = int(payload.get("horizon", 6))
    product = payload.get("product", {}) or {}
    
    # Inputs
    sku = (product.get("sku") or "SKU").upper()
    cost = float(product.get("cost") or 1.0)
    category = str(product.get("category") or "").lower()
    color = str(product.get("color") or "").lower()
    sizes = str(product.get("sizes") or "")
    
    first_sale = product.get("first_sale_month", "")
    try:
        first_sale_dt = datetime.strptime(str(first_sale)[:7], "%Y-%m")
    except:
        first_sale_dt = datetime.now().replace(day=1)

    # History plotting data
    history_months = [r["month"] for r in history_rows[-6:]]
    history_values = [r["qty"] for r in history_rows[-6:]]

    base_start = datetime.now().replace(day=1)
    if history_rows:
        try:
            last_dt = datetime.strptime(history_rows[-1]["month"], "%Y-%m")
            base_start = add_months(last_dt, 1)
        except: pass

    # Calculations
    seasonal_scale = 12 if model_key == "lgbm_full" else 10
    base_level = 110 if model_key == "lgbm_full" else 85
    
    cat_w = CATEGORY_WEIGHTS.get(category, 5)
    col_w = COLOR_WEIGHTS.get(color, 4)
    sz_count = sizes.count("|") + 1 if sizes else 0
    sz_w = sz_count * 4
    cost_w = math.log1p(cost) * (6 if model_key == "lgbm_meta" else 8)
    
    # SKU offset
    sku_val = (sum(ord(c) for c in sku) % 17) - 8
    
    predictions = []
    months = []
    
    for i in range(horizon):
        target_month = add_months(base_start, i)
        months.append(f"{target_month.year:04d}-{target_month.month:02d}")
        
        age = (target_month.year - first_sale_dt.year)*12 + (target_month.month - first_sale_dt.month)
        age = max(0, age)
        age_decay = max(0, age - 12) * 1.8
        
        # Fast seasonality
        seasonal = math.sin(2 * math.pi * target_month.month / 12.0)
        trend = i * (2.5 if model_key == "lgbm_full" else 1.5)
        
        est = base_level + cost_w + cat_w + col_w + sz_w + (seasonal * seasonal_scale) + trend + sku_val - age_decay
        predictions.append(max(0.0, round(est, 2)))

    return {
        "model": model_key,
        "horizon": horizon,
        "used_model": False,
        "y_pred": predictions,
        "y_true": None,
        "months": months,
        "plot": {
            "months": months,
            "seed": {"months": history_months, "values": history_values}
        }
    }

def run_forecast(payload: Dict) -> Dict:
    model_key = payload.get("model", "lgbm_meta")
    horizon = int(payload.get("horizon", 6))
    
    # 1. Parse CSV Once
    history_rows = decode_csv_content(payload.get("salesCsvContent"))
    
    # 2. Load Model
    model = load_model(model_key)
    if not model:
        return heuristic_prediction(payload, history_rows)

    try:
        # 3. Create Features
        X = create_features_vectorized(payload, model_key, horizon, history_rows)
        
        # 4. Align Columns
        if hasattr(model, "feature_name_"):
            # Fast alignment with reindexing
            # This fills missing with NaN (which we fill with 0) and drops extras
            X = X.reindex(columns=model.feature_name_, fill_value=0)
            
            # Explicitly fill categoricals with __NA__ if they were missing and reindexed
            cat_cols = ["Category", "Color", "Sizes", "age_bucket"]
            for c in cat_cols:
                if c in X.columns and (X[c] == 0).all(): # simplistic check if filled by reindex
                   X[c] = "__NA__" # Should be handled by reindex logic if we passed fill_value?
                   # Reindex fill_value applies to everything. 
                   # Better to fill 0 generally, then fix cats.
                   pass 

        # 5. Patch Categoricals
        if hasattr(model, "_Booster"):
            # LightGBM requires the category list to match training
            # We construct this list safely
            cat_feats = ["Category", "Color", "Sizes", "age_bucket"]
            model._Booster.pandas_categorical = [
                 list(X[c].cat.categories) if (c in X.columns and hasattr(X[c], "cat")) else []
                 for c in cat_feats
            ]

        # 6. Predict
        y_pred_log = model.predict(X)
        predictions = np.expm1(y_pred_log)
        # Fast rounding
        predictions = np.maximum(0, np.round(predictions)).astype(int).tolist()
        
        # 7. Response
        months = X["m"].astype(str).tolist() # Simplified, need full dates
        # Reconstruct date strings from create_features logic? 
        # Easier to just regenerate or pull from X if we kept it.
        # X doesn't keep date object. Re-generate:
        
        product = payload.get("product", {}) or {}
        first_sale = product.get("first_sale_month", "2025-01")
        try:
             first_sale_dt = datetime.strptime(first_sale[:7], "%Y-%m")
        except:
             first_sale_dt = datetime.now()
        start_dt = add_months(first_sale_dt, 1)
        month_labels = [
            f"{add_months(start_dt, i).year:04d}-{add_months(start_dt, i).month:02d}"
            for i in range(horizon)
        ]

        history_months = [r["month"] for r in history_rows[-6:]]
        history_values = [r["qty"] for r in history_rows[-6:]]

        return {
            "model": model_key,
            "horizon": horizon,
            "used_model": True,
            "y_pred": predictions,
            "y_true": None,
            "months": month_labels,
            "plot": {
                "months": month_labels,
                "seed": {"months": history_months, "values": history_values}
            }
        }

    except Exception as e:
        print(f"[Python] Forecast Failed: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return heuristic_prediction(payload, history_rows)

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data: return
        payload = json.loads(input_data)
    except Exception:
        print(json.dumps({"error": "Invalid JSON"}))
        return

    result = run_forecast(payload)
    print(json.dumps(result))

if __name__ == "__main__":
    main()