'use client';

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF]/;
const ALPHANUMERIC_REGEX = /^[a-z0-9/]+$/i;

const VALUE_ALIASES: Record<string, string> = {
  cc: "CC",
  cod: "COD",
  "cash on delivery": "Cash On Delivery",
  "cash collected (cod)": "Cash Collected (COD)",
  "credit card": "Credit Card",
  "credit-card": "Credit Card",
  "credit_card": "Credit Card",
  "creditcard": "Credit Card",
  riyadh: "Riyadh",
  "riyadh city": "Riyadh",
  "al riyadh": "Riyadh",
  "ar riyadh": "Riyadh",
  makkah: "Makkah",
  "makkah province": "Makkah Province",
  medina: "Medina",
  madinah: "Medina",
  "al madinah": "Medina",
  jeddah: "Jeddah",
  dammam: "Dammam",
};

const CANONICAL_DIMENSION_ALIASES: Record<string, Record<string, string>> = {
  payment_method: {
    cc: "CC",
    "credit card": "CC",
    "credit_card": "CC",
    "credit-card": "CC",
    "creditcard": "CC",
    cod: "COD",
    "cash on delivery": "COD",
    "cash-on-delivery": "COD",
    "cash_on_delivery": "COD",
  },
  destination: {
    riyadh: "Riyadh",
    "riyadh city": "Riyadh",
    "al riyadh": "Riyadh",
    "ar riyadh": "Riyadh",
    "الرياض": "الرياض",
    makkah: "مكة المكرمة",
    "makkah province": "منطقة مكة",
    "مكة": "مكة المكرمة",
    "جدة": "جدة",
    jeddah: "جدة",
    dammam: "الدمام",
    "الدمام": "الدمام",
    medina: "المدينة المنورة",
    "المدينة": "المدينة المنورة",
    "المدينة المنورة": "المدينة المنورة",
  },
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/g)
    .filter((token) => token.length > 0)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const canonicalizePlainValue = (rawValue: string): string => {
  const trimmed = rawValue.replace(/^[\s"'[{(]+|[\s"'[\]})]+$/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }

  const alias = VALUE_ALIASES[trimmed.toLowerCase()];
  if (alias) {
    return alias;
  }

  if (ARABIC_CHAR_REGEX.test(trimmed)) {
    return trimmed;
  }

  if (ALPHANUMERIC_REGEX.test(trimmed) && trimmed.length <= 3) {
    return trimmed.toUpperCase();
  }

  return trimmed.replace(/\b([a-z])([a-z]*)\b/gi, (_, first: string, rest: string) => {
    const token = `${first}${rest}`.toLowerCase();
    if (VALUE_ALIASES[token]) {
      return VALUE_ALIASES[token];
    }
    if (token.length <= 3) {
      return token.toUpperCase();
    }
    return `${first.toUpperCase()}${rest.toLowerCase()}`;
  });
};

export type LabelParts = {
  primary: string;
  secondary?: string;
  combined: string;
};

const parseLocalizationMap = (value: string): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const sanitized = value.trim();
  if (!sanitized) {
    return mapping;
  }

  const normalizedQuotes = sanitized
    .replace(/\\'/g, "__SINGLE_QUOTE__")
    .replace(/'/g, '"')
    .replace(/__SINGLE_QUOTE__/g, "'");
  try {
    const jsonCandidate = normalizedQuotes
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false");
    const parsed = JSON.parse(jsonCandidate);
    if (parsed && typeof parsed === "object") {
      for (const [rawKey, val] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof val !== "string") {
          continue;
        }
        const cleanedKey = rawKey.toLowerCase().replace(/^label[_-]?/, "");
        mapping[cleanedKey] = val.trim();
      }
    }
  } catch (error) {
    // Fallback to regex extraction
    const regex = /["']?(en|ar|label[_-]?en|label[_-]?ar|label)["']?\s*[:=]\s*["']([^"'{}]+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sanitized))) {
      const lang = match[1].toLowerCase().replace(/^label[_-]?/, "");
      const text = match[2].trim();
      if (text) {
        mapping[lang] = text;
      }
    }
  }

  return mapping;
};

const combineLabel = (primary?: string, secondary?: string): LabelParts => {
  const main = primary?.trim() ?? "";
  const secondaryClean = secondary?.trim();
  if (main && secondaryClean && secondaryClean !== main) {
    return {
      primary: main,
      secondary: secondaryClean,
      combined: `${main} (${secondaryClean})`,
    };
  }
  return {
    primary: main,
    secondary: undefined,
    combined: main,
  };
};

export const resolveLabelParts = (primary?: string | null, fallback?: string | null): LabelParts => {
  const candidate = primary ?? fallback ?? "";
  const trimmed = candidate.trim();
  if (!trimmed) {
    return { primary: "", secondary: undefined, combined: "" };
  }

  const localization = parseLocalizationMap(trimmed);
  const ar = localization.ar?.trim();
  const en = localization.en?.trim() ?? localization.label?.trim();

  const canonicalAr = ar ? canonicalizePlainValue(ar) : undefined;
  const canonicalEn = en ? canonicalizePlainValue(en) : undefined;

  if (canonicalAr && canonicalEn && canonicalAr !== canonicalEn) {
    return combineLabel(canonicalAr, canonicalEn);
  }

  if (canonicalAr) {
    return combineLabel(canonicalAr);
  }

  if (canonicalEn) {
    return combineLabel(canonicalEn);
  }

  const normalized = canonicalizePlainValue(trimmed);
  return combineLabel(normalized);
};

export const canonicalizeDimensionValue = (dimensionKey: string, rawValue: string): string => {
  const collapsed = rawValue.trim();
  if (!collapsed) {
    return "";
  }

  const aliasMap = CANONICAL_DIMENSION_ALIASES[dimensionKey];
  if (aliasMap) {
    const lowerValue = collapsed.toLowerCase();
    if (aliasMap[lowerValue]) {
      return aliasMap[lowerValue];
    }
  }

  const genericAlias = VALUE_ALIASES[collapsed.toLowerCase()];
  if (genericAlias) {
    return genericAlias;
  }

  if (ARABIC_CHAR_REGEX.test(collapsed)) {
    return collapsed;
  }

  if (ALPHANUMERIC_REGEX.test(collapsed) && collapsed.length <= 3) {
    return collapsed.toUpperCase();
  }

  if (/^\d+$/.test(collapsed)) {
    return collapsed;
  }

  return titleCase(collapsed);
};

export const normalizeLabelText = (primary?: string | null, fallback?: string | null): string => {
  const parts = resolveLabelParts(primary, fallback);
  return parts.combined;
};

export const formatSourcePath = (path?: string | null): string => {
  if (!path) {
    return "";
  }
  const normalized = path.replace(/\\/g, "/");
  const artifactsIndex = normalized.indexOf("/artifacts/");
  if (artifactsIndex >= 0) {
    return normalized.slice(artifactsIndex + 1);
  }
  const stageIndex = normalized.indexOf("/stage_");
  if (stageIndex >= 0) {
    return normalized.slice(stageIndex + 1);
  }
  return normalized;
};

export const formatBadgeLabel = (value?: string | null) => normalizeLabelText(value);
