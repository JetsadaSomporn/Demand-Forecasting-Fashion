README การใช้งานโมเดลให้ตรงกับ “ของที่เทรนจริง” เรียบร้อย ด้านล่างคือเวอร์ชันใช้งานได้เลย (อัปเดตสูตรฟีเจอร์, หมวดหมู่ Categorical, และขั้นตอน Infer ให้ครบ)

---

# 🧠 Fashion Demand Forecast Models — README (Inference, Final)

## โมเดลที่มี

* 🟩 **Historical_LightGBM.pkl** — ใช้เมื่อ **มีประวัติยอดขาย** ของ SKU
* 🟦 **No_Historical_LightGBM.pkl** — ใช้เมื่อ **ไม่มีประวัติ** (SKU ใหม่ / cold-start)

---

## ✅ ข้อจำเป็นร่วม (สำคัญมาก)

* Target ตอนเทรน = `log_qty` ⇒ หลัง `predict()` ต้องทำ **`np.expm1()` เสมอ** เพื่อกลับไปหน่วยจริง
* อินพุตต้อง **ชื่อคอลัมน์ตรง + เรียงลำดับตรงกับ `model.feature_name_`**
* คอลัมน์ **`Category` / `Color` / `Sizes` / `age_bucket`** ต้องเป็น **pandas Categorical** และใช้ลิสต์ categories เดียวกับตอนเทรน
* ค่าที่ไม่รู้/ไม่ตรงให้ใช้ **`"__NA__"`** (สตริง)
* `product_id` ต้อง **คงที่ต่อ SKU** (อย่าใช้ค่าเดียวกันทุกสินค้า)

---

## 📚 Canonical Categories (อิงจากไฟล์เทรน)

> ถ้าตอนเทรนมึงใช้ลิสต์ต่างออกไป ให้แก้ให้ **ตรงกับของเทรนจริง** แล้วบังคับ `pd.Categorical(..., categories=...)` ตอนอินเฟอเรนซ์

```text
Category: ["Children", "Feminine", "Masculine", "__NA__"]

Color:    ["BEIGE","BLACK","BLUE","BURGUNDY","GOLD","GREEN","LILAC","MUSTARD",
           "NEUTRAL","PINK","RED","SILVER","TURQUOISE","WHITE","YELLOW","__NA__"]

Sizes:    ["36|38|40|42","36|38|40|42|44","36|38|40|42|44|46","38|40|42|44",
           "38|40|42|44|46","38|40|42|44|46|48","M|L|XL","M|L|XL|XXL","P|M|G",
           "P|M|G|GG","S|M|L","S|M|L|XL","__NA__"]

age_bucket: ["age_0_2","age_3_5","age_6_11","age_12_23","age_24p","__NA__"]
```

---

## 🧩 ฟีเจอร์ “แกนร่วม” ที่ใช้ทั้งสองโมเดล

### เวลา/ฤดูกาล

* `m` = เดือน (1–12)
* `month_sin = sin(2π * m / 12)`
* `month_cos = cos(2π * m / 12)`
* `month_idx = (YYYY - BASE_YEAR) * 12 + m`

  * **สำคัญ**: ในไฟล์เทรนคำนวณ `BASE_YEAR = min(year ใน training data)`
  * ที่ inference ต้องใช้ **BASE_YEAR เดียวกันกับตอนเทรน** (แนะนำเซฟไว้เป็นพารามฯ)

### อายุสินค้า

* หา `first_sale_month` ของ SKU (เดือนที่เริ่มมี `qty>0` ถ้าไม่มีให้ใช้เดือนเปิดขายที่กำหนด)
* `age_m` = จำนวนเดือนตั้งแต่ `first_sale_month` ถึงเดือนที่พยากรณ์ (ตัดลบเป็น 0 ได้)
* ทำอนุพันธ์:

  * `age_log1p = log1p(age_m)`
  * `age_sqrt = sqrt(age_m)`
  * `is_first_year = 1 ถ้า age_m < 12` ไม่งั้น 0
* `age_bucket` สร้างจาก `pd.cut` ด้วย **bins แบบตอนเทรน**
  Bins: `[0, 3, 6, 12, 24, inf)` → Labels: `["age_0_2","age_3_5","age_6_11","age_12_23","age_24p"]`
  แล้ว **one-hot** ให้ครบ 5 คอลัมน์

### เมตาดาต้า

* `Category`, `Color`, `Sizes` = โหมด/ค่าที่แท้จริงของ SKU (map ให้ตรง canonical)
* `cost_ln = ln(cost)` (อย่าใช้ `log1p`)
* `product_id` = ไอดีตัวเลข/สตริงที่คงที่ต่อ SKU
* (ในบางสคริปต์ใช้ `first_sale_month_num = first_sale_year*12 + first_sale_month` เพื่อเป็นฟีเจอร์เชิงเวลาเพิ่ม)

---

## 🟩 Historical_LightGBM — ใช้เมื่อมีประวัติ (ต้องสร้างฟีเจอร์จากอดีตจริง)

### คอลัมน์ที่ต้องมี (ตามของเทรนจริง)

* เวลา: `m, month_sin, month_cos, month_idx`
* ย้อนหลังยอดขายจาก **ข้อมูลจริงของ SKU**:

  * **Lag**: `lag1_logqty, lag2_logqty, lag3_logqty, lag12_logqty`
    → นิยาม: `panel.groupby(product_id)["log_qty"].shift(L)`
  * **Rolling mean (บน t-1 log_qty)**:
    `roll3_mean_log, roll6_mean_log, roll12_mean_log` (`min_periods=1`)
  * **Rolling std (บน t-1 log_qty)**:
    `roll3_std_log, roll6_std_log` (`min_periods=2`)
  * **Rolling sum (บน t-1 qty)**:
    `roll3_sum_qty, roll6_sum_qty` (`min_periods=1`)
  * **EMA บน t-1 log_qty (adjust=False)**:
    `ema3_log (span=3)`, `ema6_log (span=6)`
  * **Momentum**:
    `mom3 = past_log - ema3_log`, `mom6 = past_log - ema6_log`
    (โดย `past_log = groupby(product_id)["log_qty"].shift(1)`)
* อายุสินค้า:
  `first_sale_month_num, age_m, age_log1p, age_sqrt, age_bucket` + **one-hot** 5 ช่อง + `is_first_year`
* เมตาดาต้า:
  `Category, Color, Sizes, cost_ln, product_id`

> เคล็ดลับ: หลังคำนวณฟีเจอร์กลุ่ม **lag/roll/ema/mom** ให้ `fillna(0.0)` เพื่อกัน NaN ช่วงต้นซีรีส์

### ขั้นตอนใช้งาน (สรุป)

1. เตรียม **panel รายเดือนต่อ SKU** จากทรานแซกชัน

   * groupby `["month","product_id"]` แล้ว sum `qty`
   * `log_qty = log1p(qty)`
   * สร้าง `m, month_sin, month_cos`
   * คำนวณ `BASE_YEAR` จาก **training data** แล้วสร้าง `month_idx`
2. คำนวณ **lag/roll/ema/mom** ตามนิยามข้างบน
3. สร้างฟีเจอร์ **อายุสินค้า** + one-hot buckets
4. ผนวก **เมตาดาต้า** ต่อ SKU (โหมด/ค่าเฉลี่ยตามที่เทรน)
5. บังคับ dtype ของ `Category/Color/Sizes/age_bucket` ให้เป็น **Categorical** ด้วย **categories เดียวกับเทรน**
6. จัดคอลัมน์ให้ตรงกับ `model.feature_name_` (ใส่ค่าดีฟอลต์ให้คอลัมน์ที่หาย: cat=`"__NA__"`, num=`0`)
7. `y_pred = np.expm1(model.predict(X))`

---

## 🟦 No_Historical_LightGBM — ใช้เมื่อไม่มีประวัติ (cold-start)

### คอลัมน์ที่ต้องมี

* เวลา: `m, month_sin, month_cos, month_idx`
* อายุสินค้า: `first_sale_month_num, age_m, age_log1p, age_sqrt, age_bucket` + one-hot + `is_first_year`
* เมตาดาต้า: `Category, Color, Sizes, cost_ln, product_id`

> **ไม่มี** กลุ่มฟีเจอร์ `lag/roll/ema/mom` ในโมเดลนี้

### ขั้นตอนใช้งาน (สรุป)

1. เลือก **ช่วงพยากรณ์** (เช่น 6 เดือนถัดไป) แล้วสร้างแถวข้อมูลอนาคตเดือนละ 1 แถว
2. สร้าง `m, month_sin, month_cos, month_idx` (ใช้ **BASE_YEAR ของโมเดลเทรน**)
3. คำนวณ `age_m` จากเดือนเปิดขาย → เดือนปลายทาง + อนุพันธ์/บัคเก็ต
4. ใส่เมตาดาต้าให้ตรง canonical + `cost_ln = ln(cost)`
5. บังคับ Categorical ให้ตรง categories ของเทรน
6. จัดคอลัมน์ตาม `model.feature_name_` → `y_pred = np.expm1(model.predict(X))`

---

## 🧪 โค้ดตัวอย่าง (สั้น ง่าย ไม่เล่นท่ายาก)

### 1) “บังคับ Categorical + จัดคอลัมน์ให้ตรงโมเดล” (ใช้ได้ทั้ง 2 โมเดล)

```python
import numpy as np, pandas as pd, joblib

def coerce_and_align(X, model, cats_map, cat_cols):
    # บังคับ Categorical ให้ตรงลิสต์ตอนเทรน
    for c in cat_cols:
        if c in X.columns:
            cats = cats_map[c]
            X[c] = X[c].astype("object").fillna("__NA__")
            X.loc[~X[c].isin(cats), c] = "__NA__"
            X[c] = pd.Categorical(X[c], categories=cats)
    # ใส่ค่า default ให้คอลัมน์ที่หาย แล้วเรียงคอลัมน์ตามโมเดล
    feat = list(model.feature_name_)
    for col in feat:
        if col not in X.columns:
            X[col] = "__NA__" if col in cat_cols else 0
    return X[feat]
```

### 2) No-Historical (ตัวอย่าง: พยากรณ์ 6 เดือนถัดไปของ SKU ใหม่ตัวเดียว)

```python
import math
from datetime import datetime

# ควรโหลดจากไฟล์ config ที่เซฟตอนเทรน
BASE_YEAR = 2020
CATS_MAP = {
    "Category": ["Children","Feminine","Masculine","__NA__"],
    "Color": ["BEIGE","BLACK","BLUE","BURGUNDY","GOLD","GREEN","LILAC","MUSTARD",
              "NEUTRAL","PINK","RED","SILVER","TURQUOISE","WHITE","YELLOW","__NA__"],
    "Sizes": ["36|38|40|42","36|38|40|42|44","36|38|40|42|44|46","38|40|42|44",
              "38|40|42|44|46","38|40|42|44|46|48","M|L|XL","M|L|XL|XXL","P|M|G",
              "P|M|G|GG","S|M|L","S|M|L|XL","__NA__"],
    "age_bucket": ["age_0_2","age_3_5","age_6_11","age_12_23","age_24p","__NA__"],
}
CAT_COLS = ["Category","Color","Sizes","age_bucket"]

def month_idx(y, m): return (y - BASE_YEAR)*12 + m

def add_months(y, m, offset):
    y2 = y + (m - 1 + offset)//12
    m2 = (m - 1 + offset)%12 + 1
    return y2, m2

first_sale_year, first_sale_month = 2025, 10
rows = []
for i in range(6):  # 6 เดือนหน้า
    y, m = add_months(first_sale_year, first_sale_month, i+1)
    age_m = i
    bucket = "age_0_2" if i<=2 else "age_3_5" if i<=5 else "age_6_11"
    onehot = {k:int(k==bucket) for k in ["age_0_2","age_3_5","age_6_11","age_12_23","age_24p"]}
    rows.append({
        "product_id": 12345,
        "m": m,
        "month_sin": np.sin(2*np.pi*m/12),
        "month_cos": np.cos(2*np.pi*m/12),
        "month_idx": month_idx(y, m),
        "age_m": age_m,
        "age_log1p": np.log1p(age_m),
        "age_sqrt": np.sqrt(age_m),
        "age_bucket": bucket, **onehot,
        "is_first_year": 1,
        "Category": "Feminine",
        "Color": "PINK",
        "Sizes": "S|M|L",
        "cost_ln": math.log(299),
        "first_sale_month_num": first_sale_year*12 + first_sale_month
    })
X = pd.DataFrame(rows)

model = joblib.load(".../No_Historical_LightGBM.pkl")
X = coerce_and_align(X, model, CATS_MAP, CAT_COLS)
y_pred = np.expm1(model.predict(X))
```

### 3) Historical (โครงสร้างคำนวณฟีเจอร์ยอดขายย้อนหลัง)

```python
# panel = df transactions -> groupby(["month","product_id"]).agg(qty="sum")
panel["log_qty"] = np.log1p(panel["qty"])
panel["m"] = panel["month"].dt.month
panel["month_sin"] = np.sin(2*np.pi*panel["m"]/12.0)
panel["month_cos"] = np.cos(2*np.pi*panel["m"]/12.0)
panel["month_idx"] = (panel["month"].dt.year - BASE_YEAR)*12 + panel["month"].dt.month

# lags
for L in [1,2,3,12]:
    panel[f"lag{L}_logqty"] = panel.groupby("product_id")["log_qty"].shift(L)

g = panel.groupby("product_id")
past_log = g["log_qty"].shift(1)

# rolling means/std on past_log
panel["roll3_mean_log"]  = past_log.rolling(3,  min_periods=1).mean().reset_index(level=0, drop=True)
panel["roll6_mean_log"]  = past_log.rolling(6,  min_periods=1).mean().reset_index(level=0, drop=True)
panel["roll12_mean_log"] = past_log.rolling(12, min_periods=1).mean().reset_index(level=0, drop=True)
panel["roll3_std_log"]   = past_log.rolling(3,  min_periods=2).std().reset_index(level=0, drop=True)
panel["roll6_std_log"]   = past_log.rolling(6,  min_periods=2).std().reset_index(level=0, drop=True)

# rolling sum on past qty
past_qty = g["qty"].shift(1)
panel["roll3_sum_qty"]   = past_qty.rolling(3,  min_periods=1).sum().reset_index(level=0, drop=True)
panel["roll6_sum_qty"]   = past_qty.rolling(6,  min_periods=1).sum().reset_index(level=0, drop=True)

# EMA + momentum
panel["ema3_log"] = past_log.transform(lambda s: s.ewm(span=3, adjust=False).mean())
panel["ema6_log"] = past_log.transform(lambda s: s.ewm(span=6, adjust=False).mean())
panel["mom3"] = (past_log - panel["ema3_log"])
panel["mom6"] = (past_log - panel["ema6_log"])

# age features (ใช้ first_sale_month จากยอดขายจริง)
first_sale = panel.loc[panel["qty"]>0].groupby("product_id")["month"].min()
panel["first_sale_month"] = panel["product_id"].map(first_sale).fillna(panel["month"].min())
panel["age_m"] = ((panel["month"].dt.year - panel["first_sale_month"].dt.year)*12 +
                  (panel["month"].dt.month - panel["first_sale_month"].dt.month)).clip(lower=0)
# ... ทำ age_log1p, age_sqrt, bucket + one-hot, is_first_year (เหมือนด้านบน)
# ... ต่อด้วย meta ต่อ SKU แล้ว cast Categorical + align columns + predict + expm1
```

---

## 🧰 Preflight Checklist ก่อนกด Predict

* [ ] **ชื่อ+ลำดับคอลัมน์** ตรงกับ `model.feature_name_`
* [ ] `Category/Color/Sizes/age_bucket` เป็น **Categorical** ด้วย **categories ของเทรน**
* [ ] `month_idx` ใช้ **BASE_YEAR** เดียวกับตอนเทรน
* [ ] สูตร `age_*`, bucket, one-hot **ถูกต้องครบ 5 ช่อง**
* [ ] `cost_ln = ln(cost)` (ไม่ใช่ `log1p`)
* [ ] เติมค่า default ให้คอลัมน์ที่หาย: cat=`"__NA__"`, num=`0`
* [ ] หลัง `predict()` ต้อง **`np.expm1()`**

---

## 🧯 Troubleshooting (เจอบ่อย)

* **LightGBM Error: categorical_feature do not match**

  * สาเหตุ: categories ตอนอินเฟอไม่ตรงกับตอนเทรน
  * วิธีแก้: บังคับ `pd.Categorical(X[c], categories=TRAIN_CATS[c])` แล้วค่อย predict
* **รูปแบบคอลัมน์ไม่ตรง**

  * ใช้ `model.feature_name_` เป็น single source of truth เรียงคอลัมน์ตามนั้น
* **เดือน/ปีเพี้ยน → seasonality เอ๋อ**

  * เช็ก `BASE_YEAR` ใช้ค่าที่เซฟตอนเทรน (อย่าเผลอเปลี่ยน)
* **ค่าช่วงต้นซีรีส์เป็น NaN**

  * กลุ่ม lag/rolling/EMA ให้ `fillna(0.0)` เหมือนในไฟล์เทรน

---

## 🔍 สรุปความต่างแบบเร็ว

| โมเดล                     | ใช้เมื่อ      | ต้องมี                                   | จุดเด่น                          |
| ------------------------- | ------------- | ---------------------------------------- | -------------------------------- |
| 🟩 Historical_LightGBM    | SKU มีประวัติ | กลุ่มฟีเจอร์ lag/roll/ema/mom + meta ครบ | จับพฤติกรรมเฉพาะ SKU ได้ดี       |
| 🟦 No_Historical_LightGBM | SKU ใหม่      | meta + เวลา/อายุ (ไม่มี lag/roll)        | baseline เสถียรสำหรับ cold-start |

---
