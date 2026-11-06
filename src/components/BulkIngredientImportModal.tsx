import React, { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Check,
  X,
  RefreshCw,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  Sparkles,
  FileText,
  AlertCircle,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import { Ingredient, Vendor } from "../types";
import {
  calculateIngredientUnitPrice,
  normalizeBaseUnit,
  PACKAGE_UNIT_OPTIONS,
  getSavedNamingMatches,
} from "../lib/unitConverter";
import { classifyIngredientType } from "./ReportCenterView";
import { recommendUsabilityPercentage } from "./IngredientsView";
import { auth, safeAddDoc, safeUpdateDoc, notifyCloudSqlListeners } from "../lib/firebase";

interface BulkIngredientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  vendors?: Vendor[];
  workspaceOwnerId?: string;
  isReadOnly?: boolean;
}

interface StagedImportRow {
  id: string;
  selected: boolean;
  action: "create" | "update";
  matchedIngredient: Ingredient | null;
  name: string;
  price: string;
  baseUnit: "lb" | "oz" | "pc";
  packRatio: string;
  packagingUnit: string;
  category: string;
  vendor: string;
  inStock: string;
  minStock: string;
  usabilityPercentage: string;
}

interface ColumnMapConfig {
  name: number;
  price: number;
  baseUnit: number;
  packSize: number;
  packageUnit: number;
  category: number;
  vendor: number;
  inStock: number;
  minStock: number;
  yieldPct: number;
}

const CULINARY_CATEGORIES = [
  "Meat & Poultry",
  "Seafood & Fish",
  "Fresh Produce",
  "Dairy & Eggs",
  "Dry Goods & Pantry",
  "Oils, Sauces & Condiments",
  "Bakery & Bread",
  "Beverages & Bar",
  "Packaging & Supplies",
];

const SAMPLE_CSV_LINES = [
  "Ingredient Name,Price ($),Base Unit,Pack Size,Package Unit,Category,Vendor,Stock,Alert (lb),Yield %",
  "Chicken Breast Boneless,84.50,lb,40,Box,Meat & Poultry,Sysco,40,10,90",
  "Atlantic Salmon Fillet,145.00,lb,10,Box,Seafood & Fish,Ocean Pride,20,10,75",
  "Heavy Whipping Cream,68.00,oz,512,Case,Dairy & Eggs,US Foods,512,10,100",
  "Avocado Hass,52.00,pc,48,Box,Fresh Produce,Restaurant Depot,48,10,75",
  'Soy Sauce Kikkoman,36.00,oz,640,Box,"Oils, Sauces & Condiments",JFC,640,10,100',
  'Extra Virgin Olive Oil,92.00,oz,512,Case,"Oils, Sauces & Condiments",Sysco,512,10,100',
  "Yellow Onion Jumbo,24.00,lb,50,Bag,Fresh Produce,Restaurant Depot,50,10,85",
  "Unsalted Butter AA,112.00,lb,36,Case,Dairy & Eggs,US Foods,36,10,100",
];

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(headerLine: string): string {
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const pipeCount = (headerLine.match(/\|/g) || []).length;
  if (tabCount > 0 && tabCount >= commaCount) return "\t";
  if (pipeCount > commaCount && pipeCount > 0) return "|";
  if (semicolonCount > commaCount && semicolonCount > 0) return ";";
  return ",";
}

function extractFirstNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/,/g, "").trim();
  // Check for multiplier pattern like "6x5" or "4 x 10"
  const multMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
  if (multMatch) {
    const a = parseFloat(multMatch[1]);
    const b = parseFloat(multMatch[2]);
    if (!isNaN(a) && !isNaN(b) && a > 0 && b > 0) {
      return Number((a * b).toFixed(4));
    }
  }
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const val = parseFloat(match[0]);
  return isNaN(val) ? null : val;
}

function matchPackageUnitOption(rawStr: string): string | null {
  const clean = (rawStr || "").trim().toLowerCase().replace(/s$/, ""); // strip trailing 's' e.g. Boxes -> Box, Cases -> Case
  if (!clean) return null;
  const aliasMap: Record<string, string> = {
    box: "Box",
    boxe: "Box",
    bx: "Box",
    case: "Case",
    cs: "Case",
    bag: "Bag",
    bg: "Bag",
    pack: "Pack",
    pk: "Pack",
    pkg: "Pack",
    package: "Pack",
    bottle: "Bottle",
    btl: "Bottle",
    can: "Can",
    cn: "Can",
    tub: "Tub",
    bucket: "Bucket",
    pail: "Bucket",
    carton: "Carton",
    ctn: "Carton",
    jar: "Jar",
    gallon: "Gallon",
    gal: "Gallon",
    tray: "Tray",
    roll: "Roll",
    bundle: "Bundle",
    bdl: "Bundle",
    bunch: "Bundle",
    drum: "Bucket",
    sack: "Bag",
  };
  if (aliasMap[clean]) return aliasMap[clean];
  const found = PACKAGE_UNIT_OPTIONS.find(
    (opt) => opt.toLowerCase() === clean || opt.toLowerCase() === (rawStr || "").trim().toLowerCase()
  );
  return found || null;
}

function matchStrictBaseUnit(rawStr: string): "lb" | "oz" | "pc" | null {
  const clean = (rawStr || "")
    .trim()
    .toLowerCase()
    .replace(/^base:\s*/i, "")
    .replace(/\(.*\)/, "")
    .trim();
  if (!clean) return null;
  if (["oz", "ounce", "ounces", "fl oz", "floz", "fluid ounce"].includes(clean)) {
    return "oz";
  }
  if (["pc", "pcs", "piece", "pieces", "ea", "each", "ct", "count", "head", "unit", "units"].includes(clean)) {
    return "pc";
  }
  if (["lb", "lbs", "pound", "pounds", "#", "kg", "g", "kilo", "gram", "grams"].includes(clean)) {
    return "lb";
  }
  return null;
}

function inferPackAndUnitsFromRow(params: {
  rawBaseUnit: string;
  rawPackSize: string;
  rawPkgUnit: string;
  rawName: string;
  matchedIng: Ingredient | null;
}): {
  baseUnit: "lb" | "oz" | "pc";
  packRatio: number;
  packagingUnit: string;
} {
  const { rawBaseUnit, rawPackSize, rawPkgUnit, rawName, matchedIng } = params;

  let detectedBase: "lb" | "oz" | "pc" | null = matchStrictBaseUnit(rawBaseUnit);
  let detectedPkg: string | null = matchPackageUnitOption(rawPkgUnit);
  let detectedRatio: number | null = extractFirstNumber(rawPackSize);

  // What if user put Package Unit inside Base Unit column (e.g., "Box")?
  if (!detectedBase && rawBaseUnit) {
    const pkgInBase = matchPackageUnitOption(rawBaseUnit);
    if (pkgInBase && !detectedPkg) {
      detectedPkg = pkgInBase;
    }
  }

  // What if user put Base Unit inside Package Unit column (e.g., "lb")?
  if (!detectedPkg && rawPkgUnit) {
    const baseInPkg = matchStrictBaseUnit(rawPkgUnit);
    if (baseInPkg && !detectedBase) {
      detectedBase = baseInPkg;
    }
  }

  // What if Pack Size column has combined text like "40 lb Box" or "50lb" or "48 pc" or "Box"?
  if (rawPackSize) {
    if (!detectedBase) {
      if (/\b(oz|ounce|ounces|fl\s*oz)\b/i.test(rawPackSize)) detectedBase = "oz";
      else if (/\b(pc|pcs|piece|pieces|ea|each|ct|count)\b/i.test(rawPackSize)) detectedBase = "pc";
      else if (/\b(lb|lbs|pound|pounds|#)\b/i.test(rawPackSize)) detectedBase = "lb";
    }
    if (!detectedPkg) {
      const words = rawPackSize.split(/[\s\/,-]+/);
      for (const w of words) {
        const p = matchPackageUnitOption(w);
        if (p) {
          detectedPkg = p;
          break;
        }
      }
    }
  }

  // What if user swapped Pack Size and Package Unit columns (e.g. Pack Size = "Box", Package Unit = "40")?
  if (detectedRatio === null && rawPkgUnit) {
    const numInPkgCol = extractFirstNumber(rawPkgUnit);
    if (numInPkgCol !== null && numInPkgCol > 0) {
      detectedRatio = numInPkgCol;
    }
  }

  // Check if Base Unit column also contained a number like "40 lb"
  if (detectedRatio === null && rawBaseUnit) {
    const numInBaseCol = extractFirstNumber(rawBaseUnit);
    if (numInBaseCol !== null && numInBaseCol > 0) {
      detectedRatio = numInBaseCol;
    }
  }

  // Infer from item name if still missing (e.g., "Yellow Onion 50lb Bag")
  if (rawName) {
    if (detectedRatio === null) {
      const nameSpec = rawName.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|oz|pc|pcs|ct|#)\b/i);
      if (nameSpec) {
        detectedRatio = parseFloat(nameSpec[1]);
        if (!detectedBase) {
          detectedBase = matchStrictBaseUnit(nameSpec[2]);
        }
      }
    }
    if (!detectedPkg) {
      const words = rawName.split(/[\s\/,()-]+/);
      for (const w of words) {
        const p = matchPackageUnitOption(w);
        if (p) {
          detectedPkg = p;
          break;
        }
      }
    }
  }

  const finalBaseUnit: "lb" | "oz" | "pc" =
    detectedBase ||
    (matchedIng ? normalizeBaseUnit(matchedIng.unit, matchedIng) : "lb");

  const finalPackRatio =
    detectedRatio !== null && detectedRatio > 0
      ? detectedRatio
      : matchedIng?.weightPerCase && matchedIng.weightPerCase > 0
      ? matchedIng.weightPerCase
      : matchedIng?.pcsPerPound && matchedIng.pcsPerPound > 0
      ? matchedIng.pcsPerPound
      : matchedIng?.quantity && matchedIng.quantity > 0
      ? matchedIng.quantity
      : 1;

  const finalPackagingUnit =
    detectedPkg ||
    (matchedIng?.packagingUnit && matchPackageUnitOption(matchedIng.packagingUnit)) ||
    "Box";

  return {
    baseUnit: finalBaseUnit,
    packRatio: finalPackRatio,
    packagingUnit: finalPackagingUnit,
  };
}

function autoDetectColumnMapping(matrix: string[][]): {
  hasHeader: boolean;
  colIdx: ColumnMapConfig;
} {
  const firstRow = matrix[0] || [];
  const firstRowNorm = firstRow.map((c) =>
    String(c || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
  );

  const headerKeywords = [
    "name",
    "ingredient",
    "item",
    "description",
    "product",
    "price",
    "cost",
    "base unit",
    "pack size",
    "package unit",
    "pkg unit",
    "category",
    "vendor",
    "supplier",
    "stock",
    "on-hand",
    "alert",
    "safety",
    "par",
    "yield",
  ];

  const hasHeader = firstRowNorm.some((cell) =>
    headerKeywords.some((kw) => cell === kw || cell.includes(kw))
  );

  if (!hasHeader) {
    // Default positional mapping for headerless rows
    const sampleRow = matrix[0] || [];
    // Check if it's a 10+ column copy from our own table (where col 0 = Use, col 1 = Action, col 2 = Name, col 3 = Price, etc.)
    if (
      sampleRow.length >= 10 &&
      ["create new", "update existing", "create", "update"].includes(
        String(sampleRow[1] || "").toLowerCase().trim()
      )
    ) {
      return {
        hasHeader: false,
        colIdx: {
          name: 2,
          price: 3,
          baseUnit: 4,
          packSize: 5,
          packageUnit: 6,
          category: 8,
          vendor: 9,
          inStock: 10,
          minStock: 11,
          yieldPct: -1,
        },
      };
    }

    return {
      hasHeader: false,
      colIdx: {
        name: 0,
        price: 1,
        baseUnit: 2,
        packSize: 3,
        packageUnit: 4,
        category: 5,
        vendor: 6,
        inStock: 7,
        minStock: 8,
        yieldPct: 9,
      },
    };
  }

  const colIdx: ColumnMapConfig = {
    name: -1,
    price: -1,
    baseUnit: -1,
    packSize: -1,
    packageUnit: -1,
    category: -1,
    vendor: -1,
    inStock: -1,
    minStock: -1,
    yieldPct: -1,
  };

  // Pass 1: Specific multi-word header matches first so "Package Unit", "Unit Rate", "Min Stock", "Alert (lb)" never collide with "Base Unit" or "Stock" or "Price"
  firstRowNorm.forEach((col, idx) => {
    if (!col) return;
    // Skip "use" or "action" or "unit rate" columns
    if (col === "use" || col === "action" || col.includes("unit rate") || col.includes("avg rate")) {
      return;
    }

    if (
      colIdx.packageUnit === -1 &&
      (col.includes("package unit") ||
        col.includes("pkg unit") ||
        col.includes("pack unit") ||
        col.includes("packaging unit") ||
        col.includes("packaging") ||
        col.includes("container") ||
        col === "package" ||
        col === "pkg")
    ) {
      colIdx.packageUnit = idx;
      return;
    }

    if (
      colIdx.baseUnit === -1 &&
      (col.includes("base unit") ||
        col.includes("base_unit") ||
        col.includes("lb/oz/pc") ||
        col === "uom" ||
        col === "base")
    ) {
      colIdx.baseUnit = idx;
      return;
    }

    if (
      colIdx.packSize === -1 &&
      (col.includes("pack size") ||
        col.includes("pack_size") ||
        col.includes("pack ratio") ||
        col.includes("base qty") ||
        col.includes("case weight") ||
        col.includes("weight per") ||
        col.includes("qty per") ||
        col === "pack" ||
        col === "size")
    ) {
      colIdx.packSize = idx;
      return;
    }

    if (
      colIdx.minStock === -1 &&
      (col.includes("alert") ||
        col.includes("safety") ||
        col.includes("min stock") ||
        col.includes("min_stock") ||
        col.includes("par level") ||
        col === "par" ||
        col.includes("reorder") ||
        col.includes("limit"))
    ) {
      colIdx.minStock = idx;
      return;
    }

    if (
      colIdx.inStock === -1 &&
      (col.includes("on-hand") ||
        col.includes("on hand") ||
        col.includes("in stock") ||
        col.includes("in_stock") ||
        col.includes("current stock") ||
        col.includes("physical") ||
        col === "stock" ||
        col.startsWith("stock "))
    ) {
      colIdx.inStock = idx;
      return;
    }

    if (
      colIdx.price === -1 &&
      (col.includes("price") ||
        col.includes("cost") ||
        col.includes("($)") ||
        col === "$" ||
        col === "amount")
    ) {
      colIdx.price = idx;
      return;
    }

    if (
      colIdx.name === -1 &&
      (col.includes("ingredient") ||
        col.includes("item name") ||
        col.includes("product name") ||
        col === "name" ||
        col === "item" ||
        col === "description" ||
        col === "product")
    ) {
      colIdx.name = idx;
      return;
    }

    if (
      colIdx.category === -1 &&
      (col.includes("category") || col.includes("type") || col.includes("food type") || col === "group")
    ) {
      colIdx.category = idx;
      return;
    }

    if (
      colIdx.vendor === -1 &&
      (col.includes("vendor") ||
        col.includes("supplier") ||
        col.includes("distributor") ||
        col.includes("store") ||
        col.includes("source"))
    ) {
      colIdx.vendor = idx;
      return;
    }

    if (
      colIdx.yieldPct === -1 &&
      (col.includes("yield") || col.includes("usability") || col.includes("usable"))
    ) {
      colIdx.yieldPct = idx;
      return;
    }
  });

  // Pass 2: Fallback for generic headers like "unit", "qty", "quantity", "weight"
  firstRowNorm.forEach((col, idx) => {
    if (!col) return;
    const alreadyAssigned = Object.values(colIdx).includes(idx);
    if (alreadyAssigned) return;

    if (colIdx.baseUnit === -1 && (col === "unit" || col.includes("unit"))) {
      colIdx.baseUnit = idx;
    } else if (
      colIdx.packSize === -1 &&
      (col === "qty" || col === "quantity" || col.includes("weight") || col.includes("qty"))
    ) {
      colIdx.packSize = idx;
    } else if (colIdx.inStock === -1 && col.includes("stock")) {
      colIdx.inStock = idx;
    } else if (colIdx.name === -1 && col.includes("name")) {
      colIdx.name = idx;
    }
  });

  if (colIdx.name === -1) colIdx.name = 0;
  if (colIdx.price === -1 && firstRow.length > 1) colIdx.price = 1;

  return { hasHeader: true, colIdx };
}

export const BulkIngredientImportModal: React.FC<BulkIngredientImportModalProps> = ({
  isOpen,
  onClose,
  ingredients = [],
  vendors = [],
  workspaceOwnerId,
  isReadOnly = false,
}) => {
  const [pasteText, setPasteText] = useState("");
  const [rawMatrix, setRawMatrix] = useState<string[][]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(true);
  const [columnMap, setColumnMap] = useState<ColumnMapConfig>({
    name: 0,
    price: 1,
    baseUnit: 2,
    packSize: 3,
    packageUnit: 4,
    category: 5,
    vendor: 6,
    inStock: 7,
    minStock: 8,
    yieldPct: 9,
  });
  const [showColumnMapper, setShowColumnMapper] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isInputCollapsed, setIsInputCollapsed] = useState<boolean>(false);
  const [stagedRows, setStagedRows] = useState<StagedImportRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{
    created: number;
    updated: number;
  } | null>(null);
  const [defaultVendor, setDefaultVendor] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Build fast lookup map for matching existing catalog ingredients
  const catalogMatcher = useMemo(() => {
    const safeIngredients = Array.isArray(ingredients) ? ingredients : [];
    const byExactName = new Map<string, Ingredient>();
    const byAlias = new Map<string, Ingredient>();
    const savedMatches = getSavedNamingMatches();

    safeIngredients.forEach((ing) => {
      const lower = (ing.name || "").toLowerCase().trim();
      if (lower) byExactName.set(lower, ing);
      if (Array.isArray(ing.invoiceAliases)) {
        ing.invoiceAliases.forEach((alias) => {
          if (alias) byAlias.set(alias.toLowerCase().trim(), ing);
        });
      }
    });

    Object.entries(savedMatches).forEach(([aliasKey, rule]) => {
      const ruleObj = rule as any;
      const targetId = ruleObj.ingredientId || ruleObj.targetIngredientId;
      const targetName = ruleObj.ingredientName || ruleObj.targetIngredientName || "";
      const target =
        safeIngredients.find((i) => i.id === targetId) ||
        byExactName.get(targetName.toLowerCase().trim());
      if (target) {
        byAlias.set(aliasKey.toLowerCase().trim(), target);
      }
    });

    return (rawName: string): Ingredient | null => {
      const key = (rawName || "").toLowerCase().trim();
      if (!key) return null;
      return byExactName.get(key) || byAlias.get(key) || null;
    };
  }, [ingredients]);

  const buildStagedRowsFromMatrix = (
    nonEmptyRows: string[][],
    colIdx: ColumnMapConfig,
    hasHeader: boolean
  ) => {
    const dataStartRow = hasHeader ? 1 : 0;
    const parsedStaged: StagedImportRow[] = [];

    for (let r = dataStartRow; r < nonEmptyRows.length; r++) {
      const row = nonEmptyRows[r];
      const rawName = colIdx.name >= 0 ? String(row[colIdx.name] ?? "").trim() : "";
      if (!rawName) continue;

      const matchedIng = catalogMatcher(rawName);

      // 1. Price ($)
      const rawPriceStr = colIdx.price >= 0 ? String(row[colIdx.price] ?? "") : "";
      const extractedPrice = extractFirstNumber(rawPriceStr);
      const cleanPrice =
        extractedPrice !== null && extractedPrice >= 0
          ? extractedPrice
          : matchedIng?.price ?? 0;

      // 2. Base Unit, Pack Size, Package Unit
      let rawUnitCell = colIdx.baseUnit >= 0 ? String(row[colIdx.baseUnit] ?? "").trim() : "";
      let rawPackSizeCell = colIdx.packSize >= 0 ? String(row[colIdx.packSize] ?? "").trim() : "";
      let rawPkgUnitCell =
        colIdx.packageUnit >= 0 ? String(row[colIdx.packageUnit] ?? "").trim() : "";

      // Handle shorthand 5-column headerless format: Name, Price, PackSize, Unit, Vendor
      if (!hasHeader && row.length <= 5) {
        const cell2 = String(row[2] ?? "").trim();
        const cell3 = String(row[3] ?? "").trim();
        if (extractFirstNumber(cell2) !== null && extractFirstNumber(cell3) === null) {
          rawPackSizeCell = cell2;
          rawUnitCell = cell3 || "lb";
        }
      }

      const { baseUnit, packRatio: cleanPackRatio, packagingUnit: matchedPkg } =
        inferPackAndUnitsFromRow({
          rawBaseUnit: rawUnitCell,
          rawPackSize: rawPackSizeCell,
          rawPkgUnit: rawPkgUnitCell,
          rawName,
          matchedIng,
        });

      // 3. Category
      const rawCategory = colIdx.category >= 0 ? String(row[colIdx.category] ?? "").trim() : "";
      const resolvedCategory = classifyIngredientType(
        rawName,
        rawCategory || matchedIng?.category
      );

      // 4. Vendor
      const rawVendor =
        colIdx.vendor >= 0 ? String(row[colIdx.vendor] ?? "").trim() : "";

      // 5. Stock (inStock)
      const rawInStock = colIdx.inStock >= 0 ? String(row[colIdx.inStock] ?? "").trim() : "";
      const extractedStock = extractFirstNumber(rawInStock);
      const resolvedInStock =
        extractedStock !== null && extractedStock >= 0
          ? extractedStock
          : cleanPackRatio;

      // 6. Alert (lb) (minStock) - Default 10 lb when omitted
      const rawMinStock = colIdx.minStock >= 0 ? String(row[colIdx.minStock] ?? "").trim() : "";
      const extractedMinStock = extractFirstNumber(rawMinStock);
      const resolvedMinStock =
        extractedMinStock !== null && extractedMinStock > 0
          ? extractedMinStock
          : matchedIng?.minStock && matchedIng.minStock > 0
          ? matchedIng.minStock
          : 10;

      // 7. Yield %
      const rawYield = colIdx.yieldPct >= 0 ? String(row[colIdx.yieldPct] ?? "").trim() : "";
      const extractedYield = extractFirstNumber(rawYield);
      const resolvedYield =
        extractedYield !== null && extractedYield > 0 && extractedYield <= 100
          ? extractedYield
          : recommendUsabilityPercentage(rawName).percentage;

      parsedStaged.push({
        id: `bulk-row-${r}-${Date.now()}`,
        selected: true,
        action: matchedIng ? "update" : "create",
        matchedIngredient: matchedIng,
        name: matchedIng ? matchedIng.name : rawName,
        price: cleanPrice.toFixed(2),
        baseUnit,
        packRatio: String(cleanPackRatio),
        packagingUnit: matchedPkg,
        category: resolvedCategory,
        vendor: rawVendor || matchedIng?.vendor || defaultVendor || "Direct Supplier",
        inStock: String(resolvedInStock),
        minStock: String(resolvedMinStock),
        usabilityPercentage: String(resolvedYield),
      });
    }

    if (parsedStaged.length === 0) {
      setErrorMessage("Could not parse any valid rows. Check your column mapping and try again.");
      return;
    }

    setStagedRows(parsedStaged);
  };

  const convertRawRowsToStaged = (rows: string[][]) => {
    setErrorMessage(null);
    setCommitResult(null);

    const nonEmptyRows = rows.filter(
      (r) => r.length > 0 && r.some((cell) => String(cell || "").trim().length > 0)
    );
    if (nonEmptyRows.length === 0) {
      setErrorMessage("No valid ingredient rows found to parse.");
      return;
    }

    const { hasHeader, colIdx } = autoDetectColumnMapping(nonEmptyRows);
    setRawMatrix(nonEmptyRows);
    setHasHeaderRow(hasHeader);
    setColumnMap(colIdx);
    buildStagedRowsFromMatrix(nonEmptyRows, colIdx, hasHeader);
  };

  const handleColumnMapChange = (field: keyof ColumnMapConfig, newColIndex: number) => {
    const updatedMap = { ...columnMap, [field]: newColIndex };
    setColumnMap(updatedMap);
    if (rawMatrix.length > 0) {
      buildStagedRowsFromMatrix(rawMatrix, updatedMap, hasHeaderRow);
    }
  };

  const handleToggleHasHeader = (checked: boolean) => {
    setHasHeaderRow(checked);
    if (rawMatrix.length > 0) {
      buildStagedRowsFromMatrix(rawMatrix, columnMap, checked);
    }
  };

  const handleParsePasteText = (textToParse?: string) => {
    const raw = (textToParse !== undefined ? textToParse : pasteText).trim();
    if (!raw) {
      setErrorMessage("Paste spreadsheet rows or upload a CSV/Excel file first.");
      return;
    }
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const delimiter = detectDelimiter(lines[0]);
    const matrix = lines.map((line) => parseDelimitedLine(line, delimiter));
    convertRawRowsToStaged(matrix);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
          header: 1,
          defval: "",
          raw: false,
        });
        convertRawRowsToStaged(rows);
      } else {
        const text = await file.text();
        setPasteText(text);
        handleParsePasteText(text);
      }
    } catch (err: any) {
      setErrorMessage(`Failed to read file: ${err.message || "Invalid file format"}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = SAMPLE_CSV_LINES.join("\n");
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ingredient_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSampleData = () => {
    const sample = SAMPLE_CSV_LINES.join("\n");
    setPasteText(sample);
    handleParsePasteText(sample);
  };

  const updateRowField = (id: string, field: keyof StagedImportRow, value: any) => {
    setStagedRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removeStagedRow = (id: string) => {
    setStagedRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleCommitBatch = async () => {
    const selectedRows = stagedRows.filter((r) => r.selected && r.name.trim().length > 0);
    if (selectedRows.length === 0) {
      setErrorMessage("Please select at least one ingredient row to import.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const targetOwnerId = workspaceOwnerId || auth.currentUser?.uid || "";
      let createdCount = 0;
      let updatedCount = 0;

      // Track vendors to auto-register any new supplier names
      const existingVendorNames = new Set(
        vendors.map((v) => (v.name || "").toLowerCase().trim()).filter(Boolean)
      );

      for (const row of selectedRows) {
        const cleanName = row.name.trim();
        const numPrice = Math.max(0, parseFloat(row.price) || 0);
        const strictBase = row.baseUnit;
        const numPackRatio = Math.max(0.01, parseFloat(row.packRatio) || 1);
        const cleanPkgUnit = (row.packagingUnit || "Box").trim();
        const cleanCategory = row.category || classifyIngredientType(cleanName);
        const cleanVendor = (row.vendor || defaultVendor || "Direct Supplier").trim();
        const numInStock = Math.max(0, parseFloat(row.inStock) || 0);
        const numMinStock = Math.max(0.1, parseFloat(row.minStock) || 10);
        const numYield = Math.min(100, Math.max(1, parseFloat(row.usabilityPercentage) || 100));

        // Register supplier if brand new
        const vendorKey = cleanVendor.toLowerCase();
        if (
          cleanVendor &&
          cleanVendor !== "Direct Supplier" &&
          cleanVendor !== "Default / Unassigned" &&
          !existingVendorNames.has(vendorKey)
        ) {
          existingVendorNames.add(vendorKey);
          await safeAddDoc(
            "vendors",
            {
              name: cleanVendor,
              normalizedKey: vendorKey,
              contactName: "",
              phone: "",
              email: "",
              address: "",
              note: "Auto-registered via Bulk Ingredient Import",
              isRegistered: true,
              ownerId: targetOwnerId,
              createdAt: new Date().toISOString(),
            },
            { silent: true }
          );
        }

        const pricePerGram = calculateIngredientUnitPrice({
          price: numPrice,
          quantity: numPackRatio,
          unit: strictBase,
          packagingUnit: cleanPkgUnit,
          weightPerCase: strictBase === "lb" || strictBase === "oz" ? numPackRatio : undefined,
          weightPerCaseUnit: strictBase === "oz" ? "oz" : "lb",
          pcsPerPound: strictBase === "pc" ? numPackRatio : undefined,
        });

        const payload: any = {
          name: cleanName,
          price: numPrice,
          quantity: numPackRatio,
          unit: strictBase,
          baseUnit: strictBase,
          packagingUnit: cleanPkgUnit,
          pricePerGram,
          category: cleanCategory,
          vendor: cleanVendor,
          source: `Bulk Import (${cleanVendor})`,
          inStock: numInStock,
          minStock: numMinStock,
          usabilityPercentage: numYield,
          ...(strictBase === "lb" || strictBase === "oz"
            ? {
                weightPerCase: numPackRatio,
                weightPerCaseUnit: strictBase === "oz" ? "oz" : "lb",
              }
            : {}),
          ...(strictBase === "pc" ? { pcsPerPound: numPackRatio } : {}),
          updatedAt: new Date().toISOString(),
        };

        if (row.action === "update" && row.matchedIngredient?.id) {
          await safeUpdateDoc("ingredients", row.matchedIngredient.id, payload, {
            silent: true,
          });
          updatedCount++;
        } else {
          await safeAddDoc(
            "ingredients",
            {
              ...payload,
              ownerId: targetOwnerId,
            },
            { silent: true }
          );
          createdCount++;
        }
      }

      notifyCloudSqlListeners("ingredients");
      notifyCloudSqlListeners("vendors");

      setCommitResult({ created: createdCount, updated: updatedCount });
      setStagedRows([]);
      setRawMatrix([]);
      setPasteText("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to import ingredients.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const detectedColumnsList = useMemo(() => {
    if (rawMatrix.length === 0) return [];
    const maxCols = rawMatrix.reduce((max, r) => Math.max(max, r.length), 0);
    const list: Array<{ index: number; label: string }> = [];
    for (let i = 0; i < maxCols; i++) {
      const headerCell = String(rawMatrix[0]?.[i] ?? "").trim();
      const sampleCell = String(rawMatrix[hasHeaderRow ? 1 : 0]?.[i] ?? "").trim();
      list.push({
        index: i,
        label: hasHeaderRow && headerCell
          ? `Col ${i + 1}: ${headerCell}${sampleCell ? ` (${sampleCell.slice(0, 14)})` : ""}`
          : `Col ${i + 1}${sampleCell ? `: "${sampleCell.slice(0, 18)}"` : ""}`,
      });
    }
    return list;
  }, [rawMatrix, hasHeaderRow]);

  if (!isOpen) return null;

  const selectedCount = stagedRows.filter((r) => r.selected).length;
  const createCount = stagedRows.filter((r) => r.selected && r.action === "create").length;
  const updateCount = stagedRows.filter((r) => r.selected && r.action === "update").length;

  return (
    <div
      className={`fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center overflow-y-auto ${
        isFullScreen ? "p-0" : "p-2 sm:p-4"
      }`}
    >
      <div
        className={`bg-white border border-neutral-200 shadow-2xl overflow-hidden flex flex-col transition-all ${
          isFullScreen
            ? "w-screen h-screen max-w-none max-h-none rounded-none border-0"
            : "w-[96vw] max-w-[1440px] h-[92vh] max-h-[94vh] rounded-2xl"
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/70 shrink-0">
          <div>
            <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Bulk Ingredient Import (CSV / Excel / Spreadsheet Paste)
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Upload a CSV or Excel file or paste spreadsheet rows to create new ingredients and update existing catalog items.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              Download CSV Template
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap border ${
                isFullScreen
                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                  : "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800"
              }`}
              title={isFullScreen ? "Exit Full Screen View" : "Expand to Full Screen View"}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Full Screen View</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-lg transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 flex flex-col">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-500 hover:text-red-800 font-bold"
              >
                ×
              </button>
            </div>
          )}

          {commitResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">Bulk Import Complete!</span> Created{" "}
                  <span className="font-mono font-bold">{commitResult.created}</span> new
                  ingredients and updated{" "}
                  <span className="font-mono font-bold">{commitResult.updated}</span> existing
                  catalog items.
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Collapsible toggle when rows are staged */}
          {stagedRows.length > 0 && (
            <div className="flex items-center justify-between bg-neutral-100/80 border border-neutral-200 rounded-xl px-4 py-2 shrink-0">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-neutral-800">
                  Source Data &amp; Column Detection
                </span>
                <span className="text-neutral-500">
                  ({rawMatrix.length} raw rows loaded)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowColumnMapper((prev) => !prev)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                    showColumnMapper
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{showColumnMapper ? "Hide Column Mapping" : "Adjust Column Mapping"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsInputCollapsed((prev) => !prev)}
                  className="px-3 py-1 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {isInputCollapsed ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Show Upload / Paste Box</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Collapse Upload / Paste Box</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Input Area (Upload or Paste) */}
          {!isInputCollapsed && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 shrink-0">
              {/* File Dropzone & Default Supplier */}
              <div className="lg:col-span-4 flex flex-col justify-between space-y-4 bg-neutral-50/70 border border-neutral-200/80 rounded-xl p-4">
                <div className="space-y-3">
                  <div className="text-xs font-bold text-neutral-900 flex items-center justify-between">
                    <span>1. Upload Spreadsheet File</span>
                    <span className="text-[11px] font-mono text-neutral-500">.csv · .xlsx · .tsv</span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-5 px-4 border-2 border-dashed border-neutral-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold text-neutral-800">
                      Click to select CSV or Excel file
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      Auto-detects Price ($), Base Unit, Pack Size, Package Unit, Stock &amp; Alert (lb)
                    </span>
                  </button>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-neutral-200/70">
                  <label className="block text-[11px] font-bold text-neutral-600">
                    Fallback Supplier (if Vendor column is blank):
                  </label>
                  <input
                    type="text"
                    list="bulk-vendor-datalist"
                    placeholder="e.g., Sysco, US Foods, Restaurant Depot"
                    value={defaultVendor}
                    onChange={(e) => setDefaultVendor(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-1.5 text-xs font-medium text-neutral-900 focus:outline-hidden focus:border-emerald-600"
                  />
                  <datalist id="bulk-vendor-datalist">
                    {vendors.map((v) => (
                      <option key={v.id || v.name} value={v.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Direct Copy-Paste Box */}
              <div className="lg:col-span-8 flex flex-col justify-between bg-neutral-50/70 border border-neutral-200/80 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-neutral-900">
                      2. Or Paste Rows from Excel / Google Sheets / CSV
                    </span>
                    <p className="text-[11px] text-neutral-500">
                      Columns: <code className="font-mono text-neutral-700">Ingredient Name, Price ($), Base Unit (lb/oz/pc), Pack Size, Package Unit, Category, Vendor, Stock, Alert (lb), Yield %</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSampleData}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Load Sample Rows
                  </button>
                </div>

                <textarea
                  rows={stagedRows.length > 0 ? 3 : 5}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Ingredient Name\tPrice ($)\tBase Unit\tPack Size\tPackage Unit\tCategory\tVendor\tStock\tAlert (lb)\nChicken Breast Boneless\t84.50\tlb\t40\tBox\tMeat & Poultry\tSysco\t40\t10\nAtlantic Salmon Fillet\t145.00\tlb\t10\tBox\tSeafood & Fish\tOcean Pride\t20\t10`}
                  className="w-full bg-white border border-neutral-300 rounded-xl p-3 text-xs font-mono text-neutral-800 focus:outline-hidden focus:border-emerald-600 resize-y"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-500">
                    Supports comma (CSV) and tab-separated (Excel/Sheets copy-paste). Default Alert Limit is <strong className="font-mono text-neutral-800">10 lb</strong>.
                  </span>
                  <div className="flex items-center gap-2">
                    {pasteText && (
                      <button
                        type="button"
                        onClick={() => {
                          setPasteText("");
                          setStagedRows([]);
                          setRawMatrix([]);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleParsePasteText()}
                      className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      Preview &amp; Match Rows
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Column Mapping Bar (when user clicks Adjust Column Mapping or when rawMatrix is loaded) */}
          {rawMatrix.length > 0 && showColumnMapper && (
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-neutral-900">
                    Detected Column Mapping (Click any dropdown to re-map columns from your file)
                  </span>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={(e) => handleToggleHasHeader(e.target.checked)}
                    className="rounded text-emerald-600 cursor-pointer"
                  />
                  <span>First row is column headers</span>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
                {(
                  [
                    { key: "name", label: "Ingredient Name" },
                    { key: "price", label: "Price ($)" },
                    { key: "baseUnit", label: "Base Unit" },
                    { key: "packSize", label: "Pack Size" },
                    { key: "packageUnit", label: "Package Unit" },
                    { key: "category", label: "Category" },
                    { key: "vendor", label: "Vendor" },
                    { key: "inStock", label: "Stock" },
                    { key: "minStock", label: "Alert (lb)" },
                  ] as const
                ).map((colDef) => (
                  <div key={colDef.key} className="bg-white p-2 rounded-lg border border-neutral-200">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                      {colDef.label}
                    </label>
                    <select
                      value={columnMap[colDef.key]}
                      onChange={(e) => handleColumnMapChange(colDef.key, Number(e.target.value))}
                      className="w-full text-xs font-bold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded px-1.5 py-1 cursor-pointer"
                    >
                      <option value={-1}>-- Auto / Default --</option>
                      {detectedColumnsList.map((c) => (
                        <option key={c.index} value={c.index}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Interactive Staging & Match Table */}
          {stagedRows.length > 0 && (
            <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white flex-1 flex flex-col min-h-[360px]">
              <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-bold text-neutral-900">
                    Staged Preview ({stagedRows.length} rows)
                  </span>
                  <span className="text-neutral-500 font-mono">
                    Create New: <strong className="text-emerald-700">{createCount}</strong> · Update Existing:{" "}
                    <strong className="text-amber-700">{updateCount}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = stagedRows.every((r) => r.selected);
                      setStagedRows((prev) =>
                        prev.map((r) => ({ ...r, selected: !allSelected }))
                      );
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 cursor-pointer"
                  >
                    {stagedRows.every((r) => r.selected) ? "Deselect All" : "Select All"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStagedRows((prev) => [
                        ...prev,
                        {
                          id: `manual-${Date.now()}`,
                          selected: true,
                          action: "create",
                          matchedIngredient: null,
                          name: "",
                          price: "0.00",
                          baseUnit: "lb",
                          packRatio: "1",
                          packagingUnit: "Box",
                          category: "Meat & Poultry",
                          vendor: defaultVendor || "Direct Supplier",
                          inStock: "1",
                          minStock: "10",
                          usabilityPercentage: "100",
                        },
                      ])
                    }
                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Blank Row
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100/80 text-neutral-600 font-bold uppercase text-[10px] border-b border-neutral-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">Use</th>
                      <th className="py-2.5 px-3 w-36">Action</th>
                      <th className="py-2.5 px-3 min-w-[170px]">Ingredient Name</th>
                      <th className="py-2.5 px-3 w-24 text-right">Price ($)</th>
                      <th className="py-2.5 px-3 w-20 text-center">Base Unit</th>
                      <th className="py-2.5 px-3 w-24 text-right">Pack Size</th>
                      <th className="py-2.5 px-3 w-28">Package Unit</th>
                      <th className="py-2.5 px-3 w-28 text-right">Unit Rate</th>
                      <th className="py-2.5 px-3 min-w-[155px]">Category (Type)</th>
                      <th className="py-2.5 px-3 min-w-[130px]">Vendor</th>
                      <th className="py-2.5 px-3 w-20 text-right">Stock</th>
                      <th className="py-2.5 px-3 w-20 text-right">Alert (lb)</th>
                      <th className="py-2.5 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70">
                    {stagedRows.map((row) => {
                      const numPrice = parseFloat(row.price) || 0;
                      const numPack = Math.max(0.01, parseFloat(row.packRatio) || 1);
                      const unitRate = numPrice / numPack;

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-neutral-50/90 transition-colors ${
                            !row.selected ? "opacity-50 bg-neutral-50" : ""
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => updateRowField(row.id, "selected", !row.selected)}
                              className="text-neutral-700 hover:text-emerald-600 cursor-pointer"
                            >
                              {row.selected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-400" />
                              )}
                            </button>
                          </td>

                          <td className="py-2 px-3">
                            {row.matchedIngredient ? (
                              <select
                                value={row.action}
                                onChange={(e) =>
                                  updateRowField(
                                    row.id,
                                    "action",
                                    e.target.value as "create" | "update"
                                  )
                                }
                                className={`w-full rounded-lg px-2 py-1 text-[11px] font-bold border cursor-pointer ${
                                  row.action === "update"
                                    ? "bg-amber-50 text-amber-800 border-amber-300"
                                    : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                }`}
                              >
                                <option value="update">Update Existing</option>
                                <option value="create">Create New</option>
                              </select>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-700 px-1">
                                Create New
                              </span>
                            )}
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => updateRowField(row.id, "name", e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-bold text-neutral-900 focus:border-emerald-600 focus:outline-hidden"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={row.price}
                              onChange={(e) => updateRowField(row.id, "price", e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-neutral-900 focus:border-emerald-600 focus:outline-hidden"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <select
                              value={row.baseUnit}
                              onChange={(e) =>
                                updateRowField(
                                  row.id,
                                  "baseUnit",
                                  e.target.value as "lb" | "oz" | "pc"
                                )
                              }
                              className="w-full bg-white border border-neutral-200 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-neutral-900 cursor-pointer"
                            >
                              <option value="lb">lb</option>
                              <option value="oz">oz</option>
                              <option value="pc">pc</option>
                            </select>
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={row.packRatio}
                              onChange={(e) => updateRowField(row.id, "packRatio", e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-neutral-900 focus:border-emerald-600 focus:outline-hidden"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <select
                              value={row.packagingUnit}
                              onChange={(e) =>
                                updateRowField(row.id, "packagingUnit", e.target.value)
                              }
                              className="w-full bg-white border border-neutral-200 rounded-lg px-1.5 py-1 text-xs font-medium text-neutral-800 cursor-pointer"
                            >
                              {PACKAGE_UNIT_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            ${unitRate.toFixed(2)} / {row.baseUnit}
                          </td>

                          <td className="py-2 px-3">
                            <select
                              value={row.category}
                              onChange={(e) => updateRowField(row.id, "category", e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-medium text-neutral-800 cursor-pointer"
                            >
                              {CULINARY_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.vendor}
                              onChange={(e) => updateRowField(row.id, "vendor", e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-medium text-neutral-800 focus:border-emerald-600 focus:outline-hidden"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={row.inStock}
                              onChange={(e) => updateRowField(row.id, "inStock", e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono text-right text-neutral-800 focus:border-emerald-600 focus:outline-hidden"
                            />
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={row.minStock}
                              onChange={(e) => updateRowField(row.id, "minStock", e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono text-right text-neutral-800 focus:border-emerald-600 focus:outline-hidden"
                            />
                          </td>

                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeStagedRow(row.id)}
                              className="text-neutral-400 hover:text-red-600 cursor-pointer p-1"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            {stagedRows.length > 0 ? (
              <span>
                Ready to process <strong className="font-mono text-neutral-900">{selectedCount}</strong>{" "}
                selected ingredients ({createCount} new, {updateCount} updates).
              </span>
            ) : (
              <span>Upload a CSV/Excel file or paste spreadsheet rows above to preview.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isReadOnly || isSubmitting || selectedCount === 0}
              onClick={handleCommitBatch}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Import &amp; Sync {selectedCount > 0 ? `${selectedCount} ` : ""}Ingredients</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
