export const dictionaries = {
  en: {
    languages: {
      en: "English",
      th: "Thai",
    },
    common: {
      brand: "Forecast",
      signOut: "Sign out",
      accountFallback: "Account",
      optional: "Optional",
      optionalDisplayName: "Optional display name",
      saved: "Saved",
      rmse: "RMSE",
      monthsLabel: {
        one: "{{count}} month",
        other: "{{count}} months",
      },
      horizon: {
        one: "Horizon {{count}}",
        other: "Horizon {{count}}",
      },
      csvDownload: "Download CSV",
      runForecastFirst: "Run a forecast before saving.",
      forecastSaved: "Forecast saved to history and ready to export.",
      metadataExtracted: "Metadata extracted from image.",
      forecastExportSaved: "Forecast export saved.",
      loadError: "Unexpected error",
      saving: "Saving…",
      savingAlt: "Saving...",
    },
    nav: {
      forecast: "Forecast",
      history: "History",
      settings: "Settings",
    },
    dashboard: {
      heroBadge: "Auto model switching",
      heroTitle: "Fashion demand forecasting, streamlined.",
      heroDescription:
        "Upload optional sales history and the app will pick the right model automatically—historical when data is present, metadata when it is not.",
      primaryAction: "Go Forecast",
      secondaryAction: "View History",
      selectionTitle: "Current selection",
      selectionDescription:
        "Switches between Historical and No-Historical models based on uploaded data.",
      latestTitle: "Latest forecasts",
      latestSubtitle: "Auto-saved snapshots with metrics and export-ready outputs.",
      browseHistory: "Browse history",
      chartLink: "View chart",
      modelLabel: "Current selection",
      activeModelLabel: "Active model",
      fallbackSku: "Untitled SKU",
    },
    models: {
      historicalShort: "Historical",
      metadataShort: "No-Historical",
      historicalFull: "Historical Model",
      metadataFull: "No-Historical Model",
      historicalDetail: "uses uploaded sales history",
      metadataDetail: "metadata + seasonality",
    },
    login: {
      title: "Welcome to Forecast",
      description:
        "Use your work email to receive a one-time login link. No passwords to remember.",
      emailLabel: "Email",
      emailPlaceholder: "you@company.com",
      sendLink: "Send magic link",
      sendingLink: "Sending link…",
      google: {
        continue: "Continue with Google",
        redirect: "Redirecting to Google…",
      },
      alerts: {
        checkEmail: "Check your inbox for a login link.",
        signedOut: "Signed out successfully.",
      },
      errors: {
        generic: "Sign in failed",
        noEmail: "Email is required",
      },
    },
    forecastForm: {
      heading: "Forecast",
      description:
        "Add the basics about your product. Optional sales history instantly upgrades the model to the historical variant.",
      activeModel: "Active model",
      csv: {
        label: "Recent sales CSV",
        optional: "Optional · adds historical model",
      },
      image: {
        label: "Product image",
        optional: "Optional",
        cta: "Upload or drop an image",
        instructions: "Use a clear product shot to auto-extract metadata.",
        previewAlt: "Product preview",
        extract: "Extract metadata from image",
        extracting: "Extracting…",
      },
      status: {
        forecastSaved: "Forecast saved to history and ready to export.",
        metadataExtracted: "Metadata extracted from image.",
        forecastExportSaved: "Forecast export saved.",
      },
      warnings: {
        colorAiUncertain:
          "AI filled this color automatically. Please double-check before Forecasting.",
      },
      errors: {
        forecastFailed: "Failed to run forecast",
        unexpected: "Unexpected error",
        imageRequired: "Upload an image first to extract metadata.",
        imageUploadFailed: "Image upload failed. Please try again.",
        extractionFailed: "Failed to extract from image",
        saveFailed: "Save failed",
      },
      buttons: {
        run: "Run forecast",
        running: "Forecasting…",
        reset: "Reset",
      },
      fields: {
        horizon: "Forecast horizon (months)",
        sku: "SKU",
        title: "Title",
        category: "Category",
        color: "Color",
        sizes: "Sizes",
        cost: "Cost",
        firstSaleMonth: "First sale month",
      },
      placeholders: {
        sku: "Optional",
        title: "Optional display name",
        sizes: "e.g. XS|S|M|L",
      },
      examples: {
        horizon: "e.g. 6",
        sku: "Optional · e.g. SKU-12345",
        title: "Optional · e.g. Silk Midi Dress",
        category: "e.g. Dresses",
        color: "e.g. Black",
        sizes: "e.g. XS | S | M | L",
        cost: "e.g. 950",
        firstSaleMonth: "e.g. 2024-05",
      },
    },
    forecastResult: {
      heading: "Forecast Result",
      modelSummary: {
        separator: " · ",
      },
      insightHeading: "AI Insight",
      insightLoading: "Generating insight…",
      badges: {
        live: "Live Model",
        heuristic: "Heuristic",
      },
      buttons: {
        save: "Save",
        saving: "Saving...",
        download: "Download CSV",
        preparing: "Preparing...",
      },
      table: {
        month: "Month",
        forecastQty: "Forecast Qty",
        actualQty: "Actual Qty",
      },
    },
    history: {
      emptyTitle: "No forecasts yet",
      emptyDescription:
        "Run your first forecast to see a complete history with metrics, charts, and exports.",
      table: {
        description: "View all past forecasts with complete details and export options.",
        skuTitle: "SKU / Title",
        model: "Model",
        horizon: "Horizon",
        created: "Created",
      },
      detail: {
        fallbackTitle: "Forecast",
        stats: {
          category: "Category",
          color: "Color",
          sizes: "Sizes",
          cost: "Cost",
          firstSale: "First Sale",
        },
        insightHeading: "AI Insight",
        insightEmpty: "Run an insight from the forecast page to capture a summary here.",
      },
      chart: {
        noData: "No forecast data available yet.",
      },
    },
    settings: {
      heading: "Settings",
      description:
        "Update the basics for your workspace profile. API keys live in your deployment environment, so nothing to paste here.",
      fields: {
        displayName: {
          label: "Display name",
          placeholder: "e.g., Merch Operations",
        },
        brandName: {
          label: "Brand name",
          placeholder: "e.g., Fashion Brand Co.",
        },
        timezone: "Timezone",
        currency: "Currency",
        language: "Interface language",
        theme: "Appearance",
      },
      buttons: {
        save: "Save changes",
        saving: "Saving…",
      },
      status: {
        saved: "Saved",
      },
      errors: {
        saveFailed: "Failed to save settings",
      },
      theme: {
        dark: {
          title: "Dark mode",
          description: "Deep glass surfaces with neon accents.",
        },
        light: {
          title: "Light mode",
          description: "Bright panels with soft, airy contrast.",
        },
      },
    },
    validators: {
      categoryRequired: "Category is required",
      colorRequired: "Color is required",
      sizesRequired: "Sizes is required",
      costPositive: "Cost must be positive",
    },
  },
  th: {
    languages: {
      en: "อังกฤษ",
      th: "ไทย",
    },
    common: {
      brand: "Forecast",
      signOut: "ออกจากระบบ",
      accountFallback: "บัญชีผู้ใช้",
      optional: "ไม่บังคับ",
      optionalDisplayName: "ชื่อแสดงผล (ไม่บังคับ)",
      saved: "บันทึกแล้ว",
      rmse: "RMSE",
      monthsLabel: {
        one: "{{count}} เดือน",
        other: "{{count}} เดือน",
      },
      horizon: {
        one: "ระยะคาดการณ์ {{count}} เดือน",
        other: "ระยะคาดการณ์ {{count}} เดือน",
      },
      csvDownload: "ดาวน์โหลด CSV",
      runForecastFirst: "กรุณารันการคาดการณ์ก่อนบันทึก",
      forecastSaved: "บันทึกผลคาดการณ์ไว้ในประวัติและพร้อมดาวน์โหลดแล้ว",
      metadataExtracted: "ดึงข้อมูลจากรูปภาพเรียบร้อย",
      forecastExportSaved: "บันทึกไฟล์ผลคาดการณ์แล้ว",
      loadError: "เกิดข้อผิดพลาด",
      saving: "กำลังบันทึก…",
      savingAlt: "กำลังบันทึก...",
    },
    nav: {
      forecast: "คาดการณ์",
      history: "ประวัติ",
      settings: "การตั้งค่า",
    },
    dashboard: {
      heroBadge: "สลับโมเดลอัตโนมัติ",
      heroTitle: "คาดการณ์ความต้องการแฟชั่นอย่างลื่นไหล",
      heroDescription:
        "ถ้ามียอดขายย้อนหลัง ระบบจะเลือกโมเดล Historical ให้อัตโนมัติ และจะใช้โมเดล Metadata เมื่อไม่มีข้อมูลยอดขาย",
      primaryAction: "เริ่มคาดการณ์",
      secondaryAction: "ดูประวัติ",
      selectionTitle: "โมเดลที่ใช้อยู่",
      selectionDescription:
        "สลับระหว่าง Historical และ No-Historical ตามข้อมูลที่อัปโหลด",
      latestTitle: "ผลคาดการณ์ล่าสุด",
      latestSubtitle: "บันทึกอัตโนมัติพร้อมตัวชี้วัดและไฟล์พร้อมดาวน์โหลด",
      browseHistory: "ดูประวัติทั้งหมด",
      chartLink: "ดูกราฟ",
      modelLabel: "โมเดลที่เลือก",
      activeModelLabel: "โมเดลที่ใช้งาน",
      fallbackSku: "SKU ไม่มีชื่อ",
    },
    models: {
      historicalShort: "Historical",
      metadataShort: "No-Historical",
      historicalFull: "Historical Model",
      metadataFull: "No-Historical Model",
      historicalDetail: "ใช้ยอดขายที่อัปโหลด",
      metadataDetail: "ใช้ข้อมูลสินค้าและฤดูกาล",
    },
    login: {
      title: "ยินดีต้อนรับสู่ Forecast",
      description:
        "กรอกอีเมลองค์กรเพื่อรับลิงก์เข้าใช้งานแบบครั้งเดียว ไม่ต้องจำรหัสผ่าน",
      emailLabel: "อีเมล",
      emailPlaceholder: "you@company.com",
      sendLink: "ส่งลิงก์เข้าสู่ระบบ",
      sendingLink: "กำลังส่งลิงก์…",
      google: {
        continue: "เข้าสู่ระบบด้วย Google",
        redirect: "กำลังนำคุณไปยัง Google…",
      },
      alerts: {
        checkEmail: "กรุณาตรวจอีเมลเพื่อกดลิงก์เข้าสู่ระบบ",
        signedOut: "ออกจากระบบเรียบร้อยแล้ว",
      },
      errors: {
        generic: "เข้าสู่ระบบไม่สำเร็จ",
        noEmail: "กรุณากรอกอีเมล",
      },
    },
    forecastForm: {
      heading: "คาดการณ์",
      description:
        "กรอกข้อมูลพื้นฐานของสินค้า หากเพิ่มยอดขายย้อนหลัง ระบบจะใช้โมเดล Historical ให้ทันที",
      activeModel: "โมเดลที่ใช้งาน",
      csv: {
        label: "ไฟล์ยอดขาย (CSV)",
        optional: "ตัวเลือก · เพิ่มโมเดล Historical",
      },
      image: {
        label: "รูปสินค้า",
        optional: "ตัวเลือก",
        cta: "อัปโหลดหรือวางรูปสินค้า",
        instructions: "เลือกรูปที่ชัดเจนเพื่อให้ระบบช่วยดึงข้อมูลอัตโนมัติ",
        previewAlt: "ตัวอย่างรูปสินค้า",
        extract: "ดึงข้อมูลจากรูปภาพ",
        extracting: "กำลังดึงข้อมูล…",
      },
      status: {
        forecastSaved: "บันทึกผลคาดการณ์ไว้ในประวัติและพร้อมดาวน์โหลดแล้ว",
        metadataExtracted: "ดึงข้อมูลจากรูปภาพเรียบร้อย",
        forecastExportSaved: "บันทึกไฟล์ผลคาดการณ์แล้ว",
      },
      warnings: {
        colorAiUncertain:
          "ระบบ AI กรอกค่าสีให้อัตโนมัติ อาจคลาดเคลื่อน กรุณาตรวจสอบอีกครั้ง",
      },
      errors: {
        forecastFailed: "รันการคาดการณ์ไม่สำเร็จ",
        unexpected: "เกิดข้อผิดพลาด",
        imageRequired: "กรุณาอัปโหลดรูปก่อนดึงข้อมูล",
        imageUploadFailed: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่",
        extractionFailed: "ดึงข้อมูลจากรูปภาพไม่สำเร็จ",
        saveFailed: "บันทึกไม่สำเร็จ",
      },
      buttons: {
        run: "รันการคาดการณ์",
        running: "กำลังคาดการณ์…",
        reset: "เริ่มใหม่",
      },
      fields: {
        horizon: "ช่วงเวลาคาดการณ์ (เดือน)",
        sku: "SKU",
        title: "ชื่อสินค้า",
        category: "หมวดหมู่",
        color: "สี",
        sizes: "ไซส์",
        cost: "ต้นทุน",
        firstSaleMonth: "เดือนที่เริ่มขาย",
      },
      placeholders: {
        sku: "ไม่บังคับ",
        title: "ชื่อแสดงผล (ไม่บังคับ)",
        sizes: "เช่น XS|S|M|L",
      },
      examples: {
        horizon: "เช่น 6",
        sku: "ไม่บังคับ · เช่น SKU-12345",
        title: "ไม่บังคับ · เช่น เดรสซาติน",
        category: "เช่น เดรส",
        color: "เช่น สีดำ",
        sizes: "เช่น XS | S | M | L",
        cost: "เช่น 950",
        firstSaleMonth: "เช่น 2024-05",
      },
    },
    forecastResult: {
      heading: "ผลการคาดการณ์",
      modelSummary: {
        separator: " · ",
      },
      insightHeading: "สรุปเชิงลึกจาก AI",
      insightLoading: "กำลังสร้างสรุป...",
      badges: {
        live: "โมเดลจริง",
        heuristic: "เฮอร์ริสติก",
      },
      buttons: {
        save: "บันทึก",
        saving: "กำลังบันทึก...",
        download: "ดาวน์โหลด CSV",
        preparing: "กำลังเตรียมไฟล์...",
      },
      table: {
        month: "เดือน",
        forecastQty: "ยอดคาดการณ์",
        actualQty: "ยอดจริง",
      },
    },
    history: {
      emptyTitle: "ยังไม่มีผลคาดการณ์",
      emptyDescription:
        "รันการคาดการณ์ครั้งแรกเพื่อดูประวัติพร้อมตัวชี้วัด กราฟ และไฟล์ดาวน์โหลด",
      table: {
        description: "ดูผลคาดการณ์ที่ผ่านมาทั้งหมด พร้อมรายละเอียดและตัวเลือกส่งออก",
        skuTitle: "SKU / ชื่อสินค้า",
        model: "โมเดล",
        horizon: "ช่วงเวลา",
        created: "วันที่สร้าง",
      },
      detail: {
        fallbackTitle: "ผลคาดการณ์",
        stats: {
          category: "หมวดหมู่",
          color: "สี",
          sizes: "ไซส์",
          cost: "ต้นทุน",
          firstSale: "ขายครั้งแรก",
        },
        insightHeading: "สรุปเชิงลึกจาก AI",
        insightEmpty: "สร้างสรุปจากหน้าผลคาดการณ์เพื่อให้แสดงที่นี่",
      },
      chart: {
        noData: "ยังไม่มีข้อมูลคาดการณ์สำหรับกราฟ",
      },
    },
    settings: {
      heading: "การตั้งค่า",
      description:
        "อัปเดตข้อมูลพื้นฐานของโปรไฟล์เวิร์กสเปซ คีย์ API จัดการในสภาพแวดล้อมดีพลอย ไม่ต้องกรอกตรงนี้",
      fields: {
        displayName: {
          label: "ชื่อที่แสดง",
          placeholder: "เช่น ทีมวางแผนสินค้า",
        },
        brandName: {
          label: "ชื่อแบรนด์",
          placeholder: "เช่น Fashion Brand Co.",
        },
        timezone: "เขตเวลา",
        currency: "สกุลเงิน",
        language: "ภาษาอินเทอร์เฟซ",
        theme: "ธีมการแสดงผล",
      },
      buttons: {
        save: "บันทึกการเปลี่ยนแปลง",
        saving: "กำลังบันทึก…",
      },
      status: {
        saved: "บันทึกแล้ว",
      },
      errors: {
        saveFailed: "บันทึกการตั้งค่าไม่สำเร็จ",
      },
      theme: {
        dark: {
          title: "โหมดมืด",
          description: "พื้นผิวสไตล์กระจกเข้มพร้อมแสงนีออน",
        },
        light: {
          title: "โหมดสว่าง",
          description: "โทนสว่างสบายตาพร้อมแผงโปร่ง",
        },
      },
    },
    validators: {
      categoryRequired: "กรุณากรอกหมวดหมู่",
      colorRequired: "กรุณากรอกสี",
      sizesRequired: "กรุณากรอกไซส์",
      costPositive: "ต้นทุนต้องมากกว่า 0",
    },
  },
} as const;

export type Dictionaries = typeof dictionaries;
export type Language = keyof Dictionaries;
export type Dictionary = Dictionaries[Language];

export const availableLanguages = Object.keys(dictionaries) as Language[];
export const defaultLanguage: Language = "en";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in dictionaries;
}

type TranslationNode = string | { [key: string]: TranslationNode };

function getValueFromPath(
  dictionary: TranslationNode,
  path: string
): string | undefined {
  const segments = path.split(".");
  let current: TranslationNode | undefined = dictionary;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return typeof current === "string" ? current : undefined;
}

function formatTemplate(
  value: string,
  params?: Record<string, unknown>
): string {
  if (!params) return value;
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => {
    if (token in params && params[token] != null) {
      return String(params[token]);
    }
    return "";
  });
}

type TranslateParams = {
  count?: number;
  [key: string]: unknown;
};

export function getDictionary(language: Language) {
  return dictionaries[language] ?? dictionaries[defaultLanguage];
}

export function translateFromDictionary(
  dictionary: Dictionary,
  key: string,
  params?: TranslateParams
) {
  const count = params?.count;
  if (typeof count === "number") {
    const pluralKey = `${key}.${count === 1 ? "one" : "other"}`;
    const pluralValue = getValueFromPath(dictionary as TranslationNode, pluralKey);
    if (pluralValue) {
      return formatTemplate(pluralValue, params);
    }
  }

  const direct = getValueFromPath(dictionary as TranslationNode, key);
  if (direct) {
    return formatTemplate(direct, params);
  }

  const fallback = getValueFromPath(
    dictionaries[defaultLanguage] as TranslationNode,
    key
  );
  if (fallback) {
    return formatTemplate(fallback, params);
  }

  return key;
}

export function translate(
  language: Language,
  key: string,
  params?: TranslateParams
) {
  const dictionary = getDictionary(language);
  return translateFromDictionary(dictionary, key, params);
}

export function createTranslator(language: Language) {
  const dictionary = getDictionary(language);
  return {
    language,
    dictionary,
    t: (key: string, params?: TranslateParams) =>
      translateFromDictionary(dictionary, key, params),
  };
}

export type Translator = ReturnType<typeof createTranslator>;

export function resolveLanguage(value?: string | null) {
  if (value && isLanguage(value)) return value;
  return defaultLanguage;
}
