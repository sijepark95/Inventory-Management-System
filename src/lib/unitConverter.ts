import { Ingredient } from "../types";
/**
 * Precise weights and volume conversion utilities.
 * Base Storage units are:
 * - Weight: gram (g)
 * - Volume: milliliter (ml)
 * - Counts: pieces (pcs) or packs
 *
 * Pounds (lb) conversion factor: 1 lb = 453.59237 g
 * Ounces (oz) conversion factor: 1 oz = 28.3495231 g
 */

export function getGramsOrMlEquivalent(quantity: number, unit: string): number {
  if (!quantity || isNaN(quantity)) return 0;
  const cleanUnit = (unit || "g").toLowerCase().trim();
  const normalizedUnit = cleanUnit.replace(/\/(pack|case|box|bag|can|bottle|unit|ea|each|pcs|pc|ct)s?$/i, "").trim();
  switch (normalizedUnit) {
    case "kg":
    case "kilogram":
    case "kilograms":
      return quantity * 1000;
    case "l":
    case "liter":
    case "liters":
      return quantity * 1000;
    case "oz":
    case "ounce":
    case "ounces":
      return quantity * 28.3495231;
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return quantity * 453.59237;
    case "gal":
    case "gallon":
    case "gallons":
      return quantity * 3785.41178;
    case "fl oz":
    case "floz":
    case "fluid ounce":
    case "fluid ounces":
      return quantity * 29.5735296;
    case "qt":
    case "quart":
    case "quarts":
      return quantity * 946.352946;
    case "pt":
    case "pint":
    case "pints":
      return quantity * 473.176473;
    case "cup":
    case "cups":
      return quantity * 236.588236;
    case "tbsp":
    case "tablespoon":
    case "tablespoons":
      return quantity * 14.7867648;
    case "tsp":
    case "teaspoon":
    case "teaspoons":
      return quantity * 4.92892159;
    case "g":
    case "gram":
    case "grams":
    case "ml":
    case "milliliter":
    case "milliliters":
    case "pcs":
    case "piece":
    case "pieces":
    case "pack":
    case "bag":
    default:
      return quantity;
  }
}

export function convertFromGrams(grams: number, targetUnit: string): number {
  if (!grams || isNaN(grams)) return 0;
  const cleanUnit = (targetUnit || "g").toLowerCase().trim();
  const normalizedUnit = cleanUnit.replace(/\/(pack|case|box|bag|can|bottle|unit|ea|each|pcs|pc|ct)s?$/i, "").trim();
  switch (normalizedUnit) {
    case "kg":
    case "kilogram":
    case "kilograms":
      return grams / 1000;
    case "l":
    case "liter":
    case "liters":
      return grams / 1000;
    case "oz":
    case "ounce":
    case "ounces":
      return grams / 28.3495231;
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return grams / 453.59237;
    case "gal":
    case "gallon":
    case "gallons":
      return grams / 3785.41178;
    case "fl oz":
    case "floz":
    case "fluid ounce":
    case "fluid ounces":
      return grams / 29.5735296;
    case "qt":
    case "quart":
    case "quarts":
      return grams / 946.352946;
    case "pt":
    case "pint":
    case "pints":
      return grams / 473.176473;
    case "cup":
    case "cups":
      return grams / 236.588236;
    case "tbsp":
    case "tablespoon":
    case "tablespoons":
      return grams / 14.7867648;
    case "tsp":
    case "teaspoon":
    case "teaspoons":
      return grams / 4.92892159;
    default:
      return grams;
  }
}

export function getFormattedBaseUnitInfo(
  grams: number,
  ing: {
    unit: string;
    weightPerCase?: number;
    weightPerCaseUnit?: string;
    packagingUnit?: string;
    pcsPerPound?: number;
  }
): string {
  if (!ing || !grams || grams <= 0) return "";

  const unitClean = (ing.unit || "g").toLowerCase().trim();
  const weightUnit = (ing.weightPerCaseUnit || "lb").toLowerCase().trim();
  const isCount = isPcsUnit(unitClean);

  if (ing.weightPerCase && ing.weightPerCase > 0) {
    const caseGrams = getGramsOrMlEquivalent(ing.weightPerCase, weightUnit);
    if (caseGrams > 0) {
      const numCases = grams / caseGrams;
      const numCasesFormatted =
        numCases % 1 === 0
          ? numCases.toString()
          : numCases < 1
          ? numCases.toFixed(3)
          : numCases.toFixed(2);

      const totalWeight = convertFromGrams(grams, weightUnit);
      const totalWeightFormatted =
        totalWeight % 1 === 0
          ? totalWeight.toString()
          : totalWeight < 1
          ? totalWeight.toFixed(2)
          : totalWeight.toFixed(1);

      const rawPkg = ing.packagingUnit || (["g", "kg", "ml", "l", "oz", "lb", "lbs"].includes(unitClean) ? "box" : unitClean);
      const pkgName = rawPkg === "boxes" ? "box" : rawPkg === "cases" ? "case" : rawPkg === "bags" ? "bag" : rawPkg === "packs" ? "pack" : rawPkg;

      const pluralPkg = pkgName === "box" ? "boxes" : `${pkgName}s`;
      const displayPkg = numCases > 1 ? pluralPkg : pkgName;

      return `${numCasesFormatted} ${displayPkg} (${totalWeightFormatted}${weightUnit})`;
    }
  }

  if (ing.packagingUnit && ing.pcsPerPound && ing.pcsPerPound > 0) {
    const numPacks = grams / ing.pcsPerPound;
    const packsFormatted = numPacks % 1 === 0 ? numPacks.toString() : numPacks.toFixed(2);
    return `${packsFormatted} ${ing.packagingUnit}`;
  }

  if (unitClean !== "g" && !isCount) {
    const qtyInUnit = convertFromGrams(grams, unitClean);
    const qtyFormatted = qtyInUnit % 1 === 0 ? qtyInUnit.toString() : qtyInUnit < 1 ? qtyInUnit.toFixed(3) : qtyInUnit.toFixed(2);
    return `${qtyFormatted} ${ing.unit}`;
  }

  return "";
}

export function extractWeightSpecFromName(name?: string): { weight: number; unit: string } | null {
  if (!name || typeof name !== "string") return null;
  const cleanName = name.trim();
  
  // Match multi-pack patterns like "12x500g", "4x5lb", "6x1gal", "24x12oz", "10x1lb"
  const multiPackMatch = cleanName.match(/(\d+)\s*[xX*]\s*(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|#|kg|kilogram|g|gram|oz|ounce|gal|gallon|l|liter|ml)\b/i);
  if (multiPackMatch) {
    const packCount = parseFloat(multiPackMatch[1]);
    const singleWeight = parseFloat(multiPackMatch[2]);
    const rawUnit = multiPackMatch[3].toLowerCase();
    let normUnit = "lb";
    if (["lb", "lbs", "pound", "pounds", "#"].includes(rawUnit)) normUnit = "lb";
    else if (["kg", "kilogram"].includes(rawUnit)) normUnit = "kg";
    else if (["g", "gram"].includes(rawUnit)) normUnit = "g";
    else if (["oz", "ounce"].includes(rawUnit)) normUnit = "oz";
    else if (["gal", "gallon"].includes(rawUnit)) normUnit = "gal";
    else if (["l", "liter"].includes(rawUnit)) normUnit = "L";
    else if (["ml"].includes(rawUnit)) normUnit = "ml";
    
    if (packCount > 0 && singleWeight > 0) {
      return { weight: packCount * singleWeight, unit: normUnit };
    }
  }

  // Match single weight patterns like "50lb", "50 lbs", "50#", "25kg", "500g", "1 Gallon", "5 Gal", "16 oz", "5L"
  const singleWeightMatch = cleanName.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|#|kg|kilogram|g|gram|oz|ounce|gal|gallon|l|liter|ml)\b/i);
  if (singleWeightMatch) {
    const weightVal = parseFloat(singleWeightMatch[1]);
    const rawUnit = singleWeightMatch[2].toLowerCase();
    let normUnit = "lb";
    if (["lb", "lbs", "pound", "pounds", "#"].includes(rawUnit)) normUnit = "lb";
    else if (["kg", "kilogram"].includes(rawUnit)) normUnit = "kg";
    else if (["g", "gram"].includes(rawUnit)) normUnit = "g";
    else if (["oz", "ounce"].includes(rawUnit)) normUnit = "oz";
    else if (["gal", "gallon"].includes(rawUnit)) normUnit = "gal";
    else if (["l", "liter"].includes(rawUnit)) normUnit = "L";
    else if (["ml"].includes(rawUnit)) normUnit = "ml";
    
    if (weightVal > 0) {
      return { weight: weightVal, unit: normUnit };
    }
  }

  return null;
}

export function calculatePoundData(
  count: number,
  unit: string,
  weightPerCase?: number,
  weightPerCaseUnit?: string,
  pcsPerPound?: number,
  quantity?: number,
  itemName?: string
): { lbs: number; hasWeightSpec: boolean; label: string } {
  if (count === undefined || count === null || isNaN(count)) {
    return { lbs: 0, hasWeightSpec: false, label: "0.00 lbs" };
  }

  const cleanUnit = (unit || "g").toLowerCase().trim();

  // 1. Directly in Pounds
  if (["lb", "lbs", "pound", "pounds"].includes(cleanUnit)) {
    return { lbs: count, hasWeightSpec: true, label: `${count.toFixed(2)} lbs` };
  }

  // 2. Ounces
  if (["oz", "ounce", "ounces"].includes(cleanUnit)) {
    const lbs = count / 16;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs` };
  }

  // 3. Grams
  if (["g", "gram", "grams"].includes(cleanUnit)) {
    const lbs = count / 453.59237;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs` };
  }

  // 4. Kilograms
  if (["kg", "kilogram", "kilograms"].includes(cleanUnit)) {
    const lbs = (count * 1000) / 453.59237;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs` };
  }

  // 5. Volume units (mL, L, fl oz)
  if (["ml", "milliliter", "milliliters"].includes(cleanUnit)) {
    const lbs = count / 453.59237;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs (vol eq.)` };
  }
  if (["l", "liter", "liters"].includes(cleanUnit)) {
    const lbs = (count * 1000) / 453.59237;
    return { lbs, hasWeightSpec: true, label: `${lbs.toFixed(2)} lbs (vol eq.)` };
  }

  // Fallback to extract weight spec from item name if weightPerCase is missing
  let effectiveWeight = weightPerCase;
  let effectiveWeightUnit = weightPerCaseUnit || "lb";
  if ((!effectiveWeight || effectiveWeight <= 0) && itemName) {
    const extracted = extractWeightSpecFromName(itemName);
    if (extracted) {
      effectiveWeight = extracted.weight;
      effectiveWeightUnit = extracted.unit;
    }
  }

  // 6. Pack / Pcs / Case / Box / Bag / Bottle / Can / Container / Each / Ct
  if (effectiveWeight && effectiveWeight > 0) {
    const gramsPerPack = getGramsOrMlEquivalent(effectiveWeight, effectiveWeightUnit || "lb");
    const lbsPerPack = gramsPerPack / 453.59237;
    const totalLbs = count * lbsPerPack;
    return { lbs: totalLbs, hasWeightSpec: true, label: `${totalLbs.toFixed(2)} lbs` };
  }

  if (pcsPerPound && pcsPerPound > 0) {
    // pcsPerPound represents "units per package" (e.g. 30 lbs per pack, or 30 oz per pack)
    const totalUnits = count * pcsPerPound;
    const grams = getGramsOrMlEquivalent(totalUnits, unit);
    const totalLbs = grams / 453.59237;
    return { lbs: totalLbs, hasWeightSpec: true, label: `${totalLbs.toFixed(2)} lbs` };
  }

  return { lbs: 0, hasWeightSpec: false, label: "Unspecified" };
}


export function convertInputToNativeQty(
  qtyNum: number,
  selUnit: string,
  ingredient: Ingredient
): number {
  if (isNaN(qtyNum) || qtyNum <= 0) return 0;
  const selClean = (selUnit || "").toLowerCase().trim();
  const nativeClean = (ingredient.unit || "lbs").toLowerCase().trim();

  // 1. Exact Match
  if (selClean === nativeClean) return qtyNum;

  // 2. Custom Conversions Match FIRST
  if (ingredient.conversions && ingredient.conversions.length > 0) {
    const match = ingredient.conversions.find(c => c.targetUnit && c.targetUnit.toLowerCase().trim() === selClean);
    if (match && match.ratio > 0) {
      return qtyNum * match.ratio;
    }
  }

  // 3. Packaging Unit Match
  if (ingredient.packagingUnit && selClean === ingredient.packagingUnit.toLowerCase().trim()) {
    if (ingredient.pcsPerPound && ingredient.pcsPerPound > 0) {
      return qtyNum * ingredient.pcsPerPound;
    }
  }

  // Semantic groupings
  const isSelBox = ["box", "boxes", "case", "cases"].includes(selClean);
  const isSelPack = ["pack", "packs", "bag", "bags"].includes(selClean);
  const isSelPcs = ["pcs", "piece", "pieces"].includes(selClean);
  const isSelLb = ["lb", "lbs", "pound", "pounds"].includes(selClean);

  const isNativeBox = ["box", "boxes", "case", "cases"].includes(nativeClean);
  const isNativePack = ["pack", "packs", "bag", "bags", "container"].includes(nativeClean);
  const isNativePcs = ["pcs", "piece", "pieces"].includes(nativeClean);
  const isNativeLb = ["lb", "lbs", "pound", "pounds"].includes(nativeClean);

  // If semantically matched the native unit
  if (
    (isSelBox && isNativeBox) ||
    (isSelPack && isNativePack) ||
    (isSelPcs && isNativePcs) ||
    (isSelLb && isNativeLb)
  ) {
    return qtyNum;
  }

  const packsPerBox = ingredient.pcsPerPound && ingredient.pcsPerPound > 0 ? ingredient.pcsPerPound : undefined;
  const lbsPerBoxOrPack = ingredient.weightPerCase && ingredient.weightPerCase > 0 ? ingredient.weightPerCase : undefined;
  
  // Example: 24 lbs per box, 12 packs per box => 2 lbs per pack.
  // wait, weightPerCase is usually lbs per box!
  // pcsPerPound is usually packs per box!
  
  // Selected unit is BOX
  if (isSelBox) {
    if (isNativePack || isNativePcs) {
      const multiplier = packsPerBox || lbsPerBoxOrPack || 1;
      return qtyNum * multiplier;
    }
    if (isNativeLb) {
      const multiplier = lbsPerBoxOrPack || packsPerBox || 1;
      return qtyNum * multiplier;
    }
    const multiplier = packsPerBox || lbsPerBoxOrPack || 1;
    return qtyNum * multiplier;
  }

  // Selected unit is PACK or PCS
  if (isSelPack || isSelPcs) {
    if (isNativeBox) {
      const divisor = packsPerBox || 1;
      return qtyNum / divisor;
    }
    if (isNativeLb) {
      // e.g. Native is lb, selected is pack. 
      // If we have weightPerCase=24 (lbs/box) and packsPerBox=12 (packs/box). 
      // 1 pack = 24/12 = 2 lbs.
      if (lbsPerBoxOrPack && packsPerBox) {
         return qtyNum * (lbsPerBoxOrPack / packsPerBox);
      }
      if (lbsPerBoxOrPack) {
         // We only have lbsPerBox. If native is lbs and selected is pack... maybe weightPerCase is per pack!
         return qtyNum * lbsPerBoxOrPack; 
      }
      if (packsPerBox) {
         return qtyNum / packsPerBox; // fallback...
      }
      return qtyNum;
    }
  }

  // Selected unit is LBS
  if (isSelLb) {
    if (isNativeBox) {
      const divisor = lbsPerBoxOrPack || packsPerBox || 1;
      return qtyNum / divisor;
    }
    if (isNativePack || isNativePcs) {
      if (lbsPerBoxOrPack && packsPerBox) {
        return qtyNum / (lbsPerBoxOrPack / packsPerBox);
      }
      if (lbsPerBoxOrPack) {
        return qtyNum / lbsPerBoxOrPack;
      }
      const lbsPerPack = calculatePoundData(
        1,
        ingredient.unit || "unit",
        ingredient.weightPerCase,
        ingredient.weightPerCaseUnit,
        ingredient.pcsPerPound,
        ingredient.quantity
      ).lbs;
      if (lbsPerPack > 0) {
        return qtyNum / lbsPerPack;
      }
      const divisor = packsPerBox || 1;
      return qtyNum / divisor;
    }
  }

  return qtyNum;
}

export const MASS_VOLUME_UNITS = [
  "g", "kg", "ml", "l", "oz", "lb", "lbs",
  "ounce", "ounces", "pound", "pounds", "gram", "grams",
  "liter", "liters", "milliliter", "milliliters", "kilogram", "kilograms",
  "gal", "gallon", "gallons", "fl oz", "floz", "fluid ounce", "fluid ounces",
  "qt", "quart", "quarts", "pt", "pint", "pints", "cup", "cups",
  "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon", "teaspoons"
];

export const BASE_UNITS = ["lb", "pc", "oz"] as const;
export type StrictBaseUnit = "lb" | "pc" | "oz";

export const PACKAGE_UNIT_OPTIONS = [
  "Box",
  "Case",
  "Bag",
  "Pack",
  "Tub",
  "Bottle",
  "Can",
  "Bucket",
  "Jar",
  "Carton",
  "Tray",
  "Gal",
  "Kg",
  "Bunch",
  "Head",
  "Container",
] as const;

export function normalizeBaseUnit(
  unit?: string,
  ing?: Partial<Ingredient> | null
): StrictBaseUnit {
  const clean = (unit || ing?.unit || "").toLowerCase().trim();
  if (["pc", "pcs", "piece", "pieces", "ea", "each", "ct", "count", "unit"].includes(clean)) {
    return "pc";
  }
  if (["oz", "ounce", "ounces", "fl oz", "floz", "fluid ounce", "fluid ounces"].includes(clean)) {
    return "oz";
  }
  if (["lb", "lbs", "pound", "pounds"].includes(clean)) {
    return "lb";
  }
  if (ing?.weightPerCaseUnit && ["oz", "ounce", "ounces"].includes(ing.weightPerCaseUnit.toLowerCase().trim())) {
    return "oz";
  }
  if (
    ing &&
    ing.pcsPerPound &&
    Number(ing.pcsPerPound) > 0 &&
    (!ing.weightPerCase || Number(ing.weightPerCase) <= 0)
  ) {
    return "pc";
  }
  return "lb";
}

export function isStrictBaseUnit(unit?: string): boolean {
  if (!unit) return false;
  const clean = unit.toLowerCase().trim();
  return [
    "lb", "lbs", "pound", "pounds",
    "pc", "pcs", "piece", "pieces", "ea", "each",
    "oz", "ounce", "ounces", "fl oz", "floz"
  ].includes(clean);
}

// LocalStorage helper for Invoice ↔ Ingredient Naming Match Table
const LOCAL_NAMING_MATCH_KEY = "foodcost_invoice_name_mappings_v1";

export interface InvoiceNameMappingEntry {
  invoiceName: string;
  ingredientId: string;
  ingredientName: string;
  updatedAt: string;
}

export function getSavedNamingMatches(): InvoiceNameMappingEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_NAMING_MATCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalNamingMatch(
  invoiceName: string,
  ingredientId: string,
  ingredientName: string
): InvoiceNameMappingEntry[] {
  const cleanInv = (invoiceName || "").trim();
  if (!cleanInv || !ingredientId) return getSavedNamingMatches();
  const current = getSavedNamingMatches().filter(
    (m) => m.invoiceName.toLowerCase().trim() !== cleanInv.toLowerCase()
  );
  const next: InvoiceNameMappingEntry[] = [
    {
      invoiceName: cleanInv,
      ingredientId,
      ingredientName,
      updatedAt: new Date().toISOString(),
    },
    ...current,
  ];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_NAMING_MATCH_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
  return next;
}

export function removeLocalNamingMatch(invoiceName: string): InvoiceNameMappingEntry[] {
  const cleanInv = (invoiceName || "").toLowerCase().trim();
  const next = getSavedNamingMatches().filter(
    (m) => m.invoiceName.toLowerCase().trim() !== cleanInv
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_NAMING_MATCH_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function findIngredientByNamingTable(
  rawInvoiceItemName: string,
  ingredients: Ingredient[]
): { ingredient: Ingredient; matchedViaAlias: boolean } | null {
  const cleanSearch = (rawInvoiceItemName || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!cleanSearch || !ingredients || ingredients.length === 0) return null;

  // 1. Check exact Ingredient name match first
  const exact = ingredients.find(
    (ing) => ing.name && ing.name.toLowerCase().replace(/\s+/g, " ").trim() === cleanSearch
  );
  if (exact) return { ingredient: exact, matchedViaAlias: false };

  // 2. Check Ingredient.invoiceAliases stored in database
  for (const ing of ingredients) {
    if (Array.isArray(ing.invoiceAliases) && ing.invoiceAliases.length > 0) {
      const hasAlias = ing.invoiceAliases.some(
        (alias) => alias && alias.toLowerCase().replace(/\s+/g, " ").trim() === cleanSearch
      );
      if (hasAlias) {
        return { ingredient: ing, matchedViaAlias: true };
      }
    }
  }

  // 3. Check localStorage Naming Match Table fallback
  const localMappings = getSavedNamingMatches();
  const localHit = localMappings.find(
    (m) => m.invoiceName.toLowerCase().replace(/\s+/g, " ").trim() === cleanSearch
  );
  if (localHit) {
    const targetIng =
      ingredients.find((ing) => ing.id === localHit.ingredientId) ||
      ingredients.find(
        (ing) =>
          ing.name &&
          ing.name.toLowerCase().trim() === (localHit.ingredientName || "").toLowerCase().trim()
      );
    if (targetIng) {
      return { ingredient: targetIng, matchedViaAlias: true };
    }
  }

  // 4. Check partial alias match (if an alias is contained in or contains the invoice name)
  for (const ing of ingredients) {
    if (Array.isArray(ing.invoiceAliases) && ing.invoiceAliases.length > 0) {
      const partialAlias = ing.invoiceAliases.some((alias) => {
        const a = (alias || "").toLowerCase().replace(/\s+/g, " ").trim();
        return a.length >= 3 && (cleanSearch.includes(a) || a.includes(cleanSearch));
      });
      if (partialAlias) {
        return { ingredient: ing, matchedViaAlias: true };
      }
    }
  }

  // 5. Fallback substring match on catalog ingredient name
  const fuzzy = ingredients.find(
    (ing) =>
      ing.name &&
      (ing.name.toLowerCase().includes(cleanSearch) ||
        cleanSearch.includes(ing.name.toLowerCase()))
  );
  if (fuzzy) return { ingredient: fuzzy, matchedViaAlias: false };

  return null;
}

export function saveNamingMatchToStorage(
  invoiceName: string,
  ingredientId: string,
  ingredientName: string = ""
): InvoiceNameMappingEntry[] {
  return saveLocalNamingMatch(invoiceName, ingredientId, ingredientName);
}

export function findIngredientMatchForInvoiceItem(
  rawInvoiceItemName: string,
  ingredients: Ingredient[]
): { match?: Ingredient; matchedViaAlias: boolean } {
  const res = findIngredientByNamingTable(rawInvoiceItemName, ingredients);
  if (!res) return { match: undefined, matchedViaAlias: false };
  return { match: res.ingredient, matchedViaAlias: res.matchedViaAlias };
}

/**
 * Computes the effective Base Unit quantity corresponding to `ing.price`.
 * When `ing.unit` is a strict base unit (lb | pc | oz), `ing.quantity` is the base unit quantity
 * (e.g. 400 lb for $55.60). For legacy records where `ing.unit` was a package unit (e.g. "box")
 * with `weightPerCase` or `pcsPerPound`, it multiplies `ing.quantity * packRatio`.
 */
export function getEffectiveBaseQuantity(ing?: {
  price?: number;
  quantity?: number;
  unit?: string;
  weightPerCase?: number;
  weightPerCaseUnit?: string;
  pcsPerPound?: number;
  conversions?: Array<{ ratio: number; targetUnit: string }>;
  pricePerGram?: number;
} | null): number {
  if (!ing) return 1;
  const rawQty = typeof ing.quantity === "number" && ing.quantity > 0 ? ing.quantity : 1;
  const baseUnit = normalizeBaseUnit(ing.unit, ing as any);
  const packRatio =
    baseUnit === "pc"
      ? (ing.pcsPerPound && ing.pcsPerPound > 0 ? ing.pcsPerPound : (ing.weightPerCase && ing.weightPerCase > 0 ? ing.weightPerCase : 0))
      : (ing.weightPerCase && ing.weightPerCase > 0 ? ing.weightPerCase : (ing.pcsPerPound && ing.pcsPerPound > 0 ? ing.pcsPerPound : 0));

  const cleanUnit = (ing.unit || "").toLowerCase().trim();
  const unitIsBase = isStrictBaseUnit(cleanUnit);

  if (!unitIsBase && packRatio > 0) {
    return Number((rawQty * packRatio).toFixed(4));
  }

  // If unitIsBase and rawQty === 1, check if legacy record stored full package price with quantity=1
  if (unitIsBase && rawQty === 1 && packRatio > 1 && ing.price && ing.price > 0 && ing.pricePerGram && ing.pricePerGram > 0) {
    const gramsPerSingleBase = baseUnit === "pc" ? 1 : getGramsOrMlEquivalent(1, baseUnit);
    const rateIfSingleBase = ing.price / gramsPerSingleBase;
    const rateIfPackBase = ing.price / (packRatio * gramsPerSingleBase);
    if (Math.abs(rateIfPackBase - ing.pricePerGram) < Math.abs(rateIfSingleBase - ing.pricePerGram) * 0.1) {
      return packRatio;
    }
  }

  return rawQty;
}

export function calculateIngredientUnitPrice(ing: {
  price: number;
  quantity: number;
  unit: string;
  packagingUnit?: string;
  weightPerCase?: number;
  weightPerCaseUnit?: string;
  pcsPerPound?: number;
  conversions?: Array<{ ratio: number; targetUnit: string }>;
  pricePerGram?: number;
}): number {
  if (!ing) return 0;
  const price = typeof ing.price === "number" && !isNaN(ing.price) ? ing.price : 0;
  if (price <= 0) return 0;

  const baseUnit = normalizeBaseUnit(ing.unit, ing as any);
  const effectiveBaseQty = getEffectiveBaseQuantity(ing);

  if (baseUnit === "pc") {
    return effectiveBaseQty > 0 ? price / effectiveBaseQty : 0;
  }

  // Base unit is "lb" or "oz" -> convert effectiveBaseQty of baseUnit into grams
  const totalGrams = getGramsOrMlEquivalent(effectiveBaseQty, baseUnit);
  if (totalGrams > 0) {
    return price / totalGrams;
  }

  return ing.pricePerGram || 0;
}

export function isPcsUnit(unit?: string): boolean {
  if (!unit) return false;
  const clean = unit.toLowerCase().trim();
  return ["pcs", "pc", "ea", "each", "piece", "pieces", "pack", "ct", "count"].includes(clean);
}

const MASS_UNITS = ["lb", "lbs", "pound", "pounds", "oz", "ounce", "ounces", "g", "gram", "grams", "kg", "kilogram", "kilograms"];
const VOL_UNITS = ["ml", "milliliter", "milliliters", "l", "liter", "liters", "fl oz", "gal", "gallon", "gallons", "qt", "pt"];
const PIECE_UNITS = ["pcs", "pc", "ea", "each", "piece", "pieces", "ct", "count"];
const PACK_UNITS = ["pack", "packs", "package", "packages", "box", "boxes", "case", "cases", "bag", "bags", "container", "containers", "bottle", "bottles", "can", "cans", "tub", "tubs", "bucket", "buckets", "jar", "jars", "carton", "cartons", "tray", "trays", "bunch", "bunches", "head", "heads"];

function isMassUnit(unit?: string): boolean {
  if (!unit) return false;
  return MASS_UNITS.includes(unit.toLowerCase().trim());
}

function isVolumeUnit(unit?: string): boolean {
  if (!unit) return false;
  return VOL_UNITS.includes(unit.toLowerCase().trim());
}

function isPieceUnit(unit?: string): boolean {
  if (!unit) return false;
  return PIECE_UNITS.includes(unit.toLowerCase().trim());
}

function isPackageUnit(unit?: string): boolean {
  if (!unit) return false;
  return PACK_UNITS.includes(unit.toLowerCase().trim());
}

export function getConsumptionQtyDetail(
  log: { quantity: number; unit?: string },
  ing?: {
    unit: string;
    weightPerCase?: number;
    weightPerCaseUnit?: string;
    pcsPerPound?: number;
    quantity?: number;
    packagingUnit?: string;
    conversions?: Array<{ ratio: number; targetUnit: string }>;
  }
): { primary: string; secondary: string; full: string } {
  const sign = log.quantity > 0 ? "-" : "+";
  const absQty = Math.abs(log.quantity);
  const logUnit = (log.unit || "lb").trim();
  const cleanLogUnit = logUnit.toLowerCase();

  const primary = `${sign}${absQty} ${logUnit}`;

  if (!ing) return { primary, secondary: "", full: primary };

  const cleanIngUnit = (ing.unit || "").trim().toLowerCase();

  const isLogMass = isMassUnit(cleanLogUnit);
  const isLogPcs = isPieceUnit(cleanLogUnit);
  const isLogPkg = isPackageUnit(cleanLogUnit);

  const isBaseMass = isMassUnit(cleanIngUnit);
  const isBasePcs = isPieceUnit(cleanIngUnit);
  const isBasePkg = isPackageUnit(cleanIngUnit);

  const logCategory = isLogMass ? 'mass' : isLogPcs ? 'pcs' : isLogPkg ? 'pkg' : 'unknown';
  const baseCategory = isBaseMass ? 'mass' : isBasePcs ? 'pcs' : isBasePkg ? 'pkg' : 'unknown';

  let secondary = "";

  if (logCategory !== baseCategory && baseCategory !== 'unknown') {
    // Log is different from base, show BASE UNIT
    const qtyInBase = convertInputToNativeQty(absQty, cleanLogUnit, ing as any);
    if (qtyInBase > 0) {
      let formatted = qtyInBase % 1 === 0 ? qtyInBase.toString() : qtyInBase < 1 ? qtyInBase.toFixed(2) : qtyInBase.toFixed(1);
      
      if (isBaseMass) {
         let weightUnit = (ing.unit || "lb").toLowerCase().trim();
         const displayUnit = ["oz", "ounce"].includes(weightUnit) ? "oz" : ["kg", "kilogram"].includes(weightUnit) ? "kg" : "lb";
         let val = qtyInBase;
         if (weightUnit === "lb" && displayUnit === "oz") val *= 16;
         if (weightUnit === "lb" && displayUnit === "kg") val *= 0.45359237;
         formatted = val % 1 === 0 ? val.toString() : val < 1 ? val.toFixed(2) : val.toFixed(2);
         secondary = `(${sign}${formatted}${displayUnit})`;
      } else {
         const baseUnitStr = normalizeBaseUnit(ing.unit, ing as any);
         secondary = `(${sign}${formatted} ${baseUnitStr})`;
      }
    }
  } else {
    // Log category is SAME as base category, show ANOTHER pack size
    if (baseCategory === 'mass' || baseCategory === 'pcs') {
      const pkgUnit = (ing.packagingUnit || "box").toLowerCase().trim();
      let qtyInPkg = 0;
      
      if (baseCategory === 'mass') {
        const baseGrams = getGramsOrMlEquivalent(absQty, cleanLogUnit);
        if (ing.weightPerCase && ing.weightPerCase > 0) {
          const pkgGrams = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
          if (pkgGrams > 0) {
            qtyInPkg = baseGrams / pkgGrams;
          }
        }
      } else if (baseCategory === 'pcs') {
        const pcsPerPkg = ing.pcsPerPound || ing.quantity;
        if (pcsPerPkg && pcsPerPkg > 0) {
          qtyInPkg = absQty / pcsPerPkg;
        }
      }

      if (qtyInPkg > 0) {
        const formatted = qtyInPkg % 1 === 0 ? qtyInPkg.toString() : qtyInPkg < 1 ? qtyInPkg.toFixed(2) : qtyInPkg.toFixed(1);
        secondary = `(${sign}${formatted} ${pkgUnit})`;
      }
    } else if (baseCategory === 'pkg') {
      if (ing.pcsPerPound && ing.pcsPerPound > 0) {
         const qtyInPcs = absQty * ing.pcsPerPound;
         const formatted = qtyInPcs % 1 === 0 ? qtyInPcs.toString() : qtyInPcs.toFixed(1);
         secondary = `(${sign}${formatted} pc)`;
      } else if (ing.weightPerCase && ing.weightPerCase > 0) {
         const caseGrams = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
         let lbs = (caseGrams / 453.59237) * absQty;
         const formatted = lbs % 1 === 0 ? lbs.toString() : lbs < 1 ? lbs.toFixed(2) : lbs.toFixed(2);
         secondary = `(${sign}${formatted}lb)`;
      }
    }
  }

  return { primary, secondary, full: secondary ? `${primary} ${secondary}` : primary };
}

export function getBaseUnitLabel(ing?: { unit?: string } | null): string {
  if (!ing) return "g";
  const u = (ing.unit || "").toLowerCase().trim();
  if (isPcsUnit(u)) return "pc";
  if (["oz", "ounce", "ounces", "ml", "milliliter", "milliliters", "l", "liter", "liters", "fl oz", "gal", "gallon", "gallons", "qt", "pt"].includes(u)) return "ml";
  return "g";
}

/**
 * Checks if a unit represents a physical mass / weight.
 */
export function isWeightUnit(unit: string): boolean {
  if (!unit) return false;
  const clean = unit.toLowerCase().trim().replace(/s$/, "");
  return [
    "g", "gram", "kg", "kilo", "kilogram", "oz", "ounce", "lb", "lbs", "pound", "mg"
  ].includes(clean);
}

/**
 * Converts a weight measurement into pounds (lbs) with clean rounded precision.
 */
export function convertWeightToLbs(
  quantity: number,
  unit: string
): { quantity: number; unit: string; grams: number } {
  const grams = getGramsOrMlEquivalent(quantity, unit);
  if (!grams || grams <= 0) {
    return { quantity, unit: "lb", grams: 0 };
  }
  const lbs = grams / 453.59237;
  let rounded: number;
  if (lbs >= 10) {
    rounded = parseFloat(lbs.toFixed(2));
  } else if (lbs >= 1) {
    rounded = parseFloat(lbs.toFixed(3));
  } else if (lbs >= 0.01) {
    rounded = parseFloat(lbs.toFixed(3));
  } else {
    rounded = parseFloat(lbs.toFixed(4));
  }

  return {
    quantity: rounded > 0 ? rounded : quantity,
    unit: "lb",
    grams: grams,
  };
}

export interface PackSizeSpecItem {
  ratio: number;
  baseUnit: StrictBaseUnit;
  packUnit: string;        // lowercase e.g. "box"
  displayPackUnit: string; // capitalized e.g. "Box"
  label: string;           // e.g. "40lb per box"
}

export interface RegisteredPackSizeResult {
  hasRegisteredPackSize: boolean;
  packSizeUnit: string;        // normalized lowercase package unit (e.g. "box", "case")
  displayPackUnit: string;     // capitalized / clean package unit (e.g. "Box", "Case")
  baseUnit: StrictBaseUnit;    // strictly "lb", "pc", or "oz"
  weightPerCase?: number;
  weightPerCaseUnit?: string;
  pcsPerPound?: number;
  description: string;         // e.g. "40lb per box"
  allPackSizes: PackSizeSpecItem[];
}

export function getRegisteredPackSize(ing?: Partial<Ingredient> | null): RegisteredPackSizeResult {
  const baseUnit = normalizeBaseUnit(ing?.unit, ing);
  if (!ing) {
    return {
      hasRegisteredPackSize: false,
      packSizeUnit: "",
      displayPackUnit: "",
      baseUnit,
      description: "No pack size registered",
      allPackSizes: [],
    };
  }

  const rawPkg = (ing.packagingUnit || "").trim();
  const rawUnit = (ing.unit || "").trim();
  const cleanPkg = rawPkg.toLowerCase();
  const cleanUnit = rawUnit.toLowerCase();

  // Base units are ONLY "lb", "pc", or "oz". All other units are Package Units!
  const containerUnits = [
    "box", "boxes", "case", "cases", "bag", "bags", "pack", "packs", "package", "packages",
    "carton", "cartons", "tub", "tubs", "bucket", "buckets", "tray", "trays",
    "can", "cans", "bottle", "bottles", "jar", "jars", "bundle", "bundles",
    "crate", "crates", "container", "containers", "bunch", "bunches", "head", "heads",
    "gal", "gallon", "gallons", "kg", "kilogram", "kilograms"
  ];

  const normalizePackUnit = (u: string) => {
    const l = u.toLowerCase().trim();
    if (l === "boxes") return "box";
    if (l === "cases") return "case";
    if (l === "bunches") return "bunch";
    if (l.endsWith("s") && containerUnits.includes(l) && l !== "lbs") return l.slice(0, -1);
    return l;
  };

  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

  const formatPackLabel = (ratioVal: number | undefined, bUnit: StrictBaseUnit, pUnitNorm: string) => {
    const cleanP = pUnitNorm.toLowerCase();
    if (ratioVal && ratioVal > 0) {
      return `${ratioVal}${bUnit} per ${cleanP}`;
    }
    return capitalize(cleanP);
  };

  const normPkg = cleanPkg ? normalizePackUnit(cleanPkg) : "";
  const normUnit = cleanUnit ? normalizePackUnit(cleanUnit) : "";
  const primaryRatio =
    baseUnit === "pc"
      ? (ing.pcsPerPound && Number(ing.pcsPerPound) > 0 ? Number(ing.pcsPerPound) : (ing.weightPerCase && Number(ing.weightPerCase) > 0 ? Number(ing.weightPerCase) : undefined))
      : (ing.weightPerCase && Number(ing.weightPerCase) > 0 ? Number(ing.weightPerCase) : (ing.pcsPerPound && Number(ing.pcsPerPound) > 0 ? Number(ing.pcsPerPound) : undefined));

  const hasConversionSpec = Boolean(primaryRatio && primaryRatio > 0);
  const isLegacyUnconfiguredDefaultBox =
    normPkg === "box" &&
    normUnit !== "" &&
    normUnit !== "box" &&
    !containerUnits.includes(cleanUnit) &&
    !hasConversionSpec &&
    (!ing.conversions || ing.conversions.length === 0);

  const allPackSizes: PackSizeSpecItem[] = [];

  // 1. Primary pack size from packagingUnit or legacy container unit or weightPerCase/pcsPerPound
  let primaryPackNorm = "";
  if (cleanPkg && cleanPkg !== "" && !isStrictBaseUnit(cleanPkg) && !isLegacyUnconfiguredDefaultBox) {
    primaryPackNorm = normPkg;
  } else if (containerUnits.includes(cleanUnit) && !isStrictBaseUnit(cleanUnit)) {
    primaryPackNorm = normUnit;
  } else if (hasConversionSpec) {
    primaryPackNorm = "box";
  }

  if (primaryPackNorm) {
    allPackSizes.push({
      ratio: primaryRatio || 0,
      baseUnit,
      packUnit: primaryPackNorm,
      displayPackUnit: capitalize(primaryPackNorm),
      label: formatPackLabel(primaryRatio, baseUnit, primaryPackNorm),
    });
  }

  // 2. Additional pack sizes stored in `ing.conversions`
  if (Array.isArray(ing.conversions) && ing.conversions.length > 0) {
    for (const conv of ing.conversions) {
      if (!conv || !conv.targetUnit) continue;
      const cNorm = normalizePackUnit(conv.targetUnit);
      if (!cNorm || isStrictBaseUnit(cNorm)) continue;
      const cRatio = Number(conv.ratio) > 0 ? Number(conv.ratio) : 0;
      const isDup = allPackSizes.some(
        (existing) => existing.packUnit === cNorm && existing.ratio === cRatio
      );
      if (!isDup) {
        allPackSizes.push({
          ratio: cRatio,
          baseUnit,
          packUnit: cNorm,
          displayPackUnit: capitalize(cNorm),
          label: formatPackLabel(cRatio || undefined, baseUnit, cNorm),
        });
      }
    }
  }

  if (allPackSizes.length > 0) {
    const first = allPackSizes[0];
    return {
      hasRegisteredPackSize: true,
      packSizeUnit: first.packUnit,
      displayPackUnit: first.displayPackUnit,
      baseUnit,
      weightPerCase: baseUnit === "lb" || baseUnit === "oz" ? (first.ratio || ing.weightPerCase) : ing.weightPerCase,
      weightPerCaseUnit: baseUnit === "oz" ? "oz" : "lb",
      pcsPerPound: baseUnit === "pc" ? (first.ratio || ing.pcsPerPound) : ing.pcsPerPound,
      description: first.label,
      allPackSizes,
    };
  }

  // Otherwise, no pack size registered!
  return {
    hasRegisteredPackSize: false,
    packSizeUnit: "",
    displayPackUnit: "",
    baseUnit,
    description: "No pack size registered",
    allPackSizes: [],
  };
}


