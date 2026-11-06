import React, { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { IndustrialProduct, Ingredient, ParsedInvoiceItem, Recipe } from "../../src/types";
import { recommendUsabilityPercentage } from "./IngredientsView";
import { 
  Upload, 
  Loader2, 
  Sparkles, 
  Plus, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  AlertTriangle,
  Play,
  FolderOpen,
  Layers,
  ArrowDownToLine,
  Maximize,
  Minimize,
  DollarSign,
  Tag,
  Check,
  Filter,
  Info,
  ShieldCheck,
  RefreshCw,
  UtensilsCrossed,
  SlidersHorizontal,
  FileSpreadsheet,
  ArrowRightLeft,
  CheckSquare,
  Square,
  Shield,
  Camera,
  Trash2,
  Paperclip,
  Eye,
  Download,
  FileText,
  Image as ImageIcon,
  X,
  Link2
} from "lucide-react";
import { CameraScanner } from "./CameraScanner";
import {
  calculateIngredientUnitPrice,
  getRegisteredPackSize,
  normalizeBaseUnit,
  PACKAGE_UNIT_OPTIONS,
  findIngredientMatchForInvoiceItem,
  saveNamingMatchToStorage,
  getSavedNamingMatches,
} from "../lib/unitConverter";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { IngredientNameMatchModal } from "./IngredientNameMatchModal";
import { processInvoiceFile, isImageFile, formatFileSize, downloadFile, createDemoInvoiceSvg } from "../lib/fileHelper";
import { safeAddDoc, safeUpdateDoc } from "../lib/firebase";

export const FOOD_CATEGORY_OPTIONS = [
  { value: "Meat", label: "🥩 Meat & Poultry" },
  { value: "Seafood", label: "🐟 Seafood & Fish" },
  { value: "Vegetables", label: "🥦 Vegetables & Produce" },
  { value: "Fruit", label: "🍎 Fruit" },
  { value: "Dairy", label: "🧀 Dairy & Eggs" },
  { value: "Bread", label: "🍞 Bread & Bakery" },
  { value: "Dry Goods", label: "🌾 Dry Goods & Pantry" },
  { value: "Sauces & Condiments", label: "🫙 Sauces, Oils & Condiments" },
  { value: "Beverages", label: "🥤 Beverages & Bar" },
  { value: "Packaging & Supplies", label: "📦 Packaging & Supplies" },
  { value: "Other", label: "🍽️ Other" },
] as const;

export const INDUSTRIAL_CATEGORY_OPTIONS = [
  { value: "Packaging & Containers", label: "📦 Packaging & Containers" },
  { value: "Paper & Disposables", label: "🧻 Paper & Disposables" },
  { value: "Cleaning & Chemicals", label: "🧼 Cleaning & Chemicals" },
  { value: "Gloves & Safety", label: "🧤 Gloves & Safety" },
  { value: "Kitchen Smallwares", label: "🔪 Kitchen Smallwares" },
  { value: "Equipment & Maintenance", label: "🔧 Equipment & Maintenance" },
  { value: "Other Industrial", label: "🏭 Other Industrial" },
] as const;

export function recommendIndustrialCategory(itemName: string, aiHint?: string): string {
  const name = `${itemName || ""} ${aiHint || ""}`.toLowerCase();
  if (/\b(glove|nitrile|vinyl|latex|apron|hairnet|mask|safety|first aid|goggle)\b/.test(name)) {
    return "Gloves & Safety";
  }
  if (/\b(bleach|sanitizer|detergent|soap|degreaser|chemical|rinse|disinfectant|cleaner|wash|sponge|scour|pad|mop|broom|brush)\b/.test(name)) {
    return "Cleaning & Chemicals";
  }
  if (/\b(napkin|towel|roll|tissue|receipt paper|thermal|filter paper|parchment|wax paper|straw|toothpick|skewer|chopstick|fork|knife|spoon|cutlery|utensil)\b/.test(name)) {
    return "Paper & Disposables";
  }
  if (/\b(container|lid|cup|dome|tray|clam|clamshell|bag|tote|foil|wrap|film|box|carton|deli|ramen bowl|soup bowl|takeout|to-go|packaging)\b/.test(name)) {
    return "Packaging & Containers";
  }
  if (/\b(pan|pot|tong|ladle|spatula|whisk|board|cambro|hotel pan|insert|thermometer|scale|strainer|smallware)\b/.test(name)) {
    return "Kitchen Smallwares";
  }
  if (/\b(bulb|filter|hose|gasket|valve|rack|cart|shelving|equipment|part|fuel|chafing|butane)\b/.test(name)) {
    return "Equipment & Maintenance";
  }
  return "Packaging & Containers";
}

export function matchParsedItemWithIndustrialCatalog(
  parsedItem: any,
  industrialProducts: IndustrialProduct[] = [],
  idx: number = 0
): ParsedInvoiceItem {
  const rawName = (
    parsedItem.name ||
    parsedItem.itemName ||
    parsedItem.item_name ||
    parsedItem.description ||
    parsedItem.item ||
    parsedItem.product ||
    parsedItem.rawText ||
    `Line Item ${idx + 1}`
  )
    .toString()
    .trim();

  const qty = Number(parsedItem.quantity) > 0 ? Number(parsedItem.quantity) : 1;
  const totalCost =
    Number(parsedItem.totalPrice) >= 0
      ? Number(parsedItem.totalPrice)
      : Number(parsedItem.pricePerUnit)
      ? Number(parsedItem.pricePerUnit) * qty
      : Number(parsedItem.price) || 0;
  const unitRate = qty > 0 ? totalCost / qty : totalCost;
  const rawDocUnit = (parsedItem.originalDocUnit || parsedItem.unit || "")
    .toString()
    .trim();
  const cleanUnit =
    rawDocUnit && rawDocUnit !== "No unit in document" ? rawDocUnit : "case";

  const match = industrialProducts.find(
    (p) => p.name && p.name.toLowerCase().trim() === rawName.toLowerCase()
  );

  const aiRecCat = recommendIndustrialCategory(
    rawName,
    parsedItem.category || parsedItem.aiRecommendedCategory
  );
  const resolvedCategory = match?.category || aiRecCat;
  const indRatio = Number(match?.pcsPerPack || match?.pcsPerPound || parsedItem.pcsPerPound || 0);
  const indPkgUnit =
    match?.packagingUnit ||
    parsedItem.packagingUnit ||
    (cleanUnit.toLowerCase() !== "pc"
      ? cleanUnit.charAt(0).toUpperCase() + cleanUnit.slice(1).toLowerCase()
      : "Case");
  const indRegPack =
    match?.registeredPackSize ||
    parsedItem.registeredPackSize ||
    (indRatio > 0 ? `${indRatio}pc per ${indPkgUnit.toLowerCase()}` : undefined);

  return {
    ...parsedItem,
    name: rawName,
    itemTargetType: "industrial",
    category: resolvedCategory,
    aiRecommendedCategory: aiRecCat,
    quantity: qty,
    totalPrice: totalCost,
    pricePerUnit: unitRate,
    baseUnit: "pc",
    unit: (match?.packagingUnit || cleanUnit || "case").toLowerCase(),
    packagingUnit: indPkgUnit,
    pcsPerPound: indRatio > 0 ? indRatio : undefined,
    conversions: match?.conversions || parsedItem.conversions || undefined,
    originalDocUnit: rawDocUnit || "case",
    matchAction: match ? ("map" as const) : ("create" as const),
    targetIndustrialId: match?.id || "",
    targetIngredientId: "",
    needsPackSizeRegistration: false,
    registeredPackSize: indRegPack,
  };
}

export function recommendFoodCategory(itemName: string, aiHint?: string): string {
  const cleanHint = (aiHint || "").trim();
  if (cleanHint) {
    const exact = FOOD_CATEGORY_OPTIONS.find(
      (opt) =>
        opt.value.toLowerCase() === cleanHint.toLowerCase() ||
        opt.label.toLowerCase().includes(cleanHint.toLowerCase())
    );
    if (exact && exact.value !== "Other") {
      return exact.value;
    }
    const lowerHint = cleanHint.toLowerCase();
    if (lowerHint.includes("meat") || lowerHint.includes("poultry") || lowerHint.includes("beef") || lowerHint.includes("pork") || lowerHint.includes("chicken")) return "Meat";
    if (lowerHint.includes("seafood") || lowerHint.includes("fish") || lowerHint.includes("shellfish")) return "Seafood";
    if (lowerHint.includes("veg") || lowerHint.includes("produce") || lowerHint.includes("herb")) return "Vegetables";
    if (lowerHint.includes("fruit") || lowerHint.includes("berry") || lowerHint.includes("citrus")) return "Fruit";
    if (lowerHint.includes("dairy") || lowerHint.includes("egg") || lowerHint.includes("cheese") || lowerHint.includes("milk")) return "Dairy";
    if (lowerHint.includes("bread") || lowerHint.includes("bakery") || lowerHint.includes("pastry")) return "Bread";
    if (lowerHint.includes("sauce") || lowerHint.includes("oil") || lowerHint.includes("condiment") || lowerHint.includes("dressing")) return "Sauces & Condiments";
    if (lowerHint.includes("dry") || lowerHint.includes("pantry") || lowerHint.includes("grain") || lowerHint.includes("spice")) return "Dry Goods";
    if (lowerHint.includes("beverage") || lowerHint.includes("drink") || lowerHint.includes("bar")) return "Beverages";
    if (lowerHint.includes("packaging") || lowerHint.includes("supply") || lowerHint.includes("supplies") || lowerHint.includes("paper")) return "Packaging & Supplies";
  }

  const name = (itemName || "").toLowerCase();
  if (/\b(chicken|beef|pork|turkey|duck|lamb|veal|wing|wings|thigh|breast|steak|ribeye|sirloin|tenderloin|brisket|bacon|sausage|ham|prosciutto|pepperoni|salami|chorizo|meatball|patty|wagyu|short rib|ribs|chuck|ground beef)\b/.test(name)) {
    return "Meat";
  }
  if (/\b(salmon|tuna|shrimp|prawn|fish|cod|halibut|bass|snapper|tilapia|crab|lobster|scallop|oyster|clam|mussel|calamari|squid|octopus|anchovy|eel|unagi|hamachi|yellowtail|ikura|tobiko|masago|seafood|fillet)\b/.test(name)) {
    return "Seafood";
  }
  if (/\b(lemon|lime|orange|apple|berry|strawberry|blueberry|raspberry|blackberry|peach|mango|banana|melon|watermelon|pineapple|grape|grapefruit|pear|plum|cherry|kiwi|pomegranate|fruit)\b/.test(name)) {
    return "Fruit";
  }
  if (/\b(onion|garlic|tomato|potato|lettuce|romaine|spinach|kale|arugula|cabbage|carrot|celery|pepper|jalapeno|bell pepper|cucumber|zucchini|squash|broccoli|cauliflower|asparagus|mushroom|avocado|herb|cilantro|parsley|basil|mint|thyme|rosemary|scallion|green onion|ginger|corn|pea|radish|beet|eggplant|sprout|produce|bok choy|daikon|edamame)\b/.test(name)) {
    return "Vegetables";
  }
  if (/\b(milk|cream|butter|cheese|cheddar|mozzarella|parmesan|provolone|swiss|feta|ricotta|brie|gouda|egg|eggs|yogurt|sour cream|whipping|half & half|half and half|mascarpone|dairy)\b/.test(name)) {
    return "Dairy";
  }
  if (/\b(bread|bun|buns|roll|rolls|brioche|baguette|ciabatta|sourdough|tortilla|pita|naan|croissant|muffin|bagel|toast|crust|dough|pastry|cake|pie)\b/.test(name)) {
    return "Bread";
  }
  if (/\b(oil|olive oil|canola|vegetable oil|sesame oil|truffle oil|vinegar|soy sauce|tamari|teriyaki|sriracha|hot sauce|ketchup|mustard|mayo|mayonnaise|aioli|dressing|bbq|hoisin|oyster sauce|fish sauce|mirin|ponzu|miso|paste|stock|broth|bouillon|honey|syrup|maple|jam|jelly|relish|pickle|capers|sauce)\b/.test(name)) {
    return "Sauces & Condiments";
  }
  if (/\b(soda|cola|coke|sprite|juice|coffee|espresso|tea|matcha|water|sparkling|tonic|ginger ale|lemonade|energy drink|wine|beer|sake|soju|beverage)\b/.test(name)) {
    return "Beverages";
  }
  if (/\b(glove|foil|wrap|film|container|lid|cup|straw|napkin|towel|paper|bleach|sanitizer|soap|detergent|sponge|trash|chemical|degreaser|to-go|takeout)\b/.test(name)) {
    return "Packaging & Supplies";
  }
  if (/\b(flour|sugar|salt|rice|pasta|spaghetti|penne|fettuccine|noodle|ramen|udon|soba|bean|black bean|chickpea|lentil|oat|quinoa|barley|cornstarch|starch|panko|breadcrumb|baking|yeast|vanilla|cocoa|chocolate|spice|paprika|cumin|oregano|cinnamon|chili powder|curry|black pepper|sesame|almond|walnut|pecan|peanut|cashew|pistachio|nut|seed|nori|seaweed|tempura)\b/.test(name)) {
    return "Dry Goods";
  }
  return "Dry Goods";
}

export function matchParsedItemWithCatalog(
  parsedItem: any,
  existingIngredients: Ingredient[],
  idx: number = 0
): ParsedInvoiceItem {
  const rawName = (
    parsedItem.name || 
    parsedItem.itemName || 
    parsedItem.item_name || 
    parsedItem.description || 
    parsedItem.item || 
    parsedItem.product || 
    parsedItem.rawText || 
    `Line Item ${idx + 1}`
  ).toString().trim();

  const qty = Number(parsedItem.quantity) > 0 ? Number(parsedItem.quantity) : 1;
  const totalCost = Number(parsedItem.totalPrice) >= 0 
    ? Number(parsedItem.totalPrice) 
    : (Number(parsedItem.pricePerUnit) ? Number(parsedItem.pricePerUnit) * qty : (Number(parsedItem.price) || 0));
  const unitRate = qty > 0 ? totalCost / qty : totalCost;

  const rawDocUnit = (parsedItem.unit || "").toString().trim();
  const { match, matchedViaAlias } = findIngredientMatchForInvoiceItem(rawName, existingIngredients);

  const fallbackWeight = match?.weightPerCase;
  const fallbackWeightUnit = match?.weightPerCaseUnit || "lb";
  const fallbackUsability = match?.usabilityPercentage;

  const itemWeight = (parsedItem.weightPerCase !== undefined && parsedItem.weightPerCase > 0) ? parsedItem.weightPerCase : fallbackWeight;
  const itemWeightUnit = parsedItem.weightPerCaseUnit || fallbackWeightUnit;
  
  const recommendedYield = recommendUsabilityPercentage(rawName).percentage;
  const finalUsability = fallbackUsability !== undefined ? fallbackUsability : recommendedYield;

  const aiRecCategory = recommendFoodCategory(rawName, parsedItem.category || parsedItem.aiRecommendedCategory);
  const resolvedCategory =
    match?.category && match.category !== "Other" && match.category !== "Unassigned"
      ? recommendFoodCategory(rawName, match.category)
      : aiRecCategory;

  if (match) {
    const packInfo = getRegisteredPackSize(match);
    if (packInfo.hasRegisteredPackSize) {
      // The unit ALWAYS has to match with what the user registered!
      const isMismatch = !rawDocUnit || rawDocUnit.toLowerCase() !== packInfo.packSizeUnit;
      return {
        ...parsedItem,
        name: rawName,
        category: resolvedCategory,
        aiRecommendedCategory: aiRecCategory,
        quantity: qty,
        totalPrice: totalCost,
        pricePerUnit: unitRate,
        unit: packInfo.packSizeUnit, // Strictly matched to registered pack size!
        baseUnit: packInfo.baseUnit,
        packagingUnit: packInfo.displayPackUnit,
        matchAction: "map" as const,
        targetIngredientId: match.id,
        weightPerCase: itemWeight,
        weightPerCaseUnit: itemWeightUnit,
        usabilityPercentage: finalUsability,
        pcsPerPound: match.pcsPerPound,
        originalDocUnit: rawDocUnit || "No unit in document",
        unitMatchedToPackSize: isMismatch,
        registeredPackSize: packInfo.description || packInfo.displayPackUnit,
        needsPackSizeRegistration: false,
        matchedViaAlias,
      };
    } else {
      // The ingredient has NO pack size registered - user must register pack size!
      return {
        ...parsedItem,
        name: rawName,
        category: resolvedCategory,
        aiRecommendedCategory: aiRecCategory,
        quantity: qty,
        totalPrice: totalCost,
        pricePerUnit: unitRate,
        unit: "",
        baseUnit: packInfo.baseUnit,
        packagingUnit: match.packagingUnit,
        matchAction: "map" as const,
        targetIngredientId: match.id,
        weightPerCase: itemWeight,
        weightPerCaseUnit: itemWeightUnit,
        usabilityPercentage: finalUsability,
        originalDocUnit: rawDocUnit || "No unit in document",
        unitMatchedToPackSize: false,
        registeredPackSize: undefined,
        needsPackSizeRegistration: true,
        matchedViaAlias,
      };
    }
  } else {
    // New item to create: NOT registered in catalog yet, so user MUST register package size!
    return {
      ...parsedItem,
      name: rawName,
      category: resolvedCategory,
      aiRecommendedCategory: aiRecCategory,
      quantity: qty,
      totalPrice: totalCost,
      pricePerUnit: unitRate,
      unit: "",
      baseUnit: "lb",
      matchAction: "create" as const,
      targetIngredientId: "",
      weightPerCase: itemWeight,
      weightPerCaseUnit: itemWeightUnit,
      usabilityPercentage: finalUsability,
      originalDocUnit: rawDocUnit || "No unit in document",
      unitMatchedToPackSize: false,
      registeredPackSize: undefined,
      needsPackSizeRegistration: true,
      matchedViaAlias: false,
    };
  }
}

export function formatToDateInputValue(dateStr?: string): string {
  if (!dateStr) {
    return new Date().toISOString().split("T")[0];
  }
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  const mdy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) {
    const month = mdy[1].padStart(2, "0");
    const day = mdy[2].padStart(2, "0");
    const year = mdy[3];
    return `${year}-${month}-${day}`;
  }
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

interface AIParserViewProps {
  existingIngredients: Ingredient[];
  industrialProducts?: IndustrialProduct[];
  existingInvoices: any[];
  vendors?: any[];
  recipes?: Recipe[];
  onApplyParsedItems: (
    itemsToApply: Array<{
      action: "create" | "map" | "skip";
      parsedItem: ParsedInvoiceItem;
      targetIngredientId?: string;
    }>,
    vendor: string,
    invoiceNumber: string,
    date: string,
    fileName?: string,
    isPriceCorrectionOnly?: boolean,
    fileAttachment?: {
      fileUrl?: string;
      fileType?: string;
      fileSize?: number;
    }
  ) => Promise<void>;
  onNavigateToCatalog?: () => void;
  onNavigateToIndustrial?: () => void;
  userId: string;
  isReadOnly?: boolean;
}

export interface QueueItem {
  id: string;
  file: File | null; // null if demo data
  fileName: string;
  fileSize?: number;
  fileDataUrl?: string; // Stored image or document data URL
  fileType?: string;    // MIME type
  status: "pending" | "parsing" | "parsed" | "failed";
  error?: string;
  vendor: string;
  invoiceNumber: string;
  date: string;
  items: ParsedInvoiceItem[];
  isDemo?: boolean;
  documentType?: "invoice" | "price_correction";
  defaultTargetType?: "ingredient" | "industrial";
}

interface SearchableMatchSelectProps {
  value: string;
  onChange: (value: string) => void;
  ingredients: Ingredient[];
  placeholder?: string;
}

function SearchableMatchSelect({
  value,
  onChange,
  ingredients,
  placeholder = "-- Select Ingredient --"
}: SearchableMatchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedIng = ingredients.find((ing) => ing.id === value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const terms = query.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean);
  const filtered = ingredients.filter((ing) => {
    if (terms.length === 0) return true;
    return terms.some(
      (t) =>
        (ing.name || "").toLowerCase().includes(t) ||
        (ing.source || "").toLowerCase().includes(t) ||
        (ing.vendor || "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="relative w-full min-w-[220px] max-w-[270px]" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setQuery("");
        }}
        className={`w-full text-xs sm:text-[13px] font-bold py-2 px-3 rounded-xl border text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
          value
            ? "text-neutral-900 bg-white border-neutral-300 hover:bg-neutral-50"
            : "text-amber-950 bg-amber-50 border-amber-300 hover:bg-amber-100/70"
        }`}
      >
        <span className="truncate">
          {selectedIng ? (
            <span>
              {selectedIng.name}{" "}
              <span className="text-[11px] font-mono opacity-70">
                (${selectedIng.price?.toFixed(2)}/{selectedIng.unit})
              </span>
            </span>
          ) : (
            <span className="opacity-60 font-normal">{placeholder}</span>
          )}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[260px] bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-neutral-100">
            <input
              type="text"
              autoFocus
              placeholder="Search by ingredient name, vendor..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs font-bold px-2 py-1.5 bg-neutral-100 border-transparent rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-xs font-bold text-neutral-400">No matching ingredients</div>
            ) : (
              filtered.map((ing) => (
                <button
                  key={ing.id}
                  onClick={() => {
                    onChange(ing.id!);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex flex-col ${
                    value === ing.id ? "bg-emerald-50 text-emerald-900" : "hover:bg-neutral-50 text-neutral-700"
                  }`}
                >
                  <span className="font-bold truncate">{ing.name}</span>
                  <div className="flex items-center gap-1.5 opacity-60 text-[10px] mt-0.5">
                    <span className="font-mono font-bold text-emerald-700">
                      ${ing.price?.toFixed(2)} / {ing.quantity} {ing.unit}
                    </span>
                    <span>•</span>
                    <span className="truncate max-w-[100px]">{ing.vendor || "Master Item"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIParserView({ 
  existingIngredients, 
  industrialProducts = [],
  existingInvoices, 
  vendors = [], 
  recipes = [],
  onApplyParsedItems, 
  onNavigateToCatalog,
  onNavigateToIndustrial,
  userId, 
  isReadOnly = false,
  queue,
  setQueue,
  activeQueueId,
  setActiveQueueId,
  parsingAll,
  setParsingAll
}: AIParserViewProps & {
  queue: QueueItem[];
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  activeQueueId: string | null;
  setActiveQueueId: React.Dispatch<React.SetStateAction<string | null>>;
  parsingAll: boolean;
  setParsingAll: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [defaultUploadTarget, setDefaultUploadTarget] = useState<"ingredient" | "industrial">("ingredient");
  const [preserveStockCounts, setPreserveStockCounts] = useState<boolean>(false);
  const [priceFilter, setPriceFilter] = useState<"all" | "increases" | "decreases" | "changes" | "mapped" | "unmapped">("all");
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDuplicatePrompt, setShowDuplicatePrompt] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewModalItem, setPreviewModalItem] = useState<QueueItem | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showNamingMatchModal, setShowNamingMatchModal] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Register Pack Size Modal State (Strict Base Unit: lb | pc | oz, rest are Package Units)
  const [packSizeModal, setPackSizeModal] = useState<{
    isOpen: boolean;
    queueId?: string;
    itemIndex: number;
    ingredientName: string;
    targetIngredientId?: string;
    targetIndustrialId?: string;
    itemTargetType?: "ingredient" | "industrial";
    baseUnit: "lb" | "pc" | "oz";
    packUnit: string;
    weightAmount: string;
    weightUnit: string;
    countAmount: string;
    extraPacks: Array<{ ratio: string; targetUnit: string }>;
  } | null>(null);

  const openPackSizeModal = (itemIndex: number, item: ParsedInvoiceItem) => {
    if (item.itemTargetType === "industrial") {
      const matchedInd =
        (item.targetIndustrialId
          ? industrialProducts.find((p) => p.id === item.targetIndustrialId)
          : undefined) ||
        industrialProducts.find(
          (p) =>
            p.name &&
            item.name &&
            p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
        );
      const rawDocU =
        item.originalDocUnit && item.originalDocUnit !== "No unit in document"
          ? item.originalDocUnit.trim()
          : "";
      const rawSuggested =
        matchedInd?.packagingUnit ||
        item.packagingUnit ||
        (rawDocU ? rawDocU.charAt(0).toUpperCase() + rawDocU.slice(1).toLowerCase() : "Case");
      const isBaseU = ["lb", "lbs", "pound", "pounds", "pc", "pcs", "piece", "pieces", "each", "ea", "oz", "ounce", "ounces"].includes(
        (rawSuggested || "").toLowerCase()
      );
      const suggestedPackUnit = isBaseU ? "Case" : rawSuggested || "Case";
      const existingConvs = (
        item.conversions && item.conversions.length > 0
          ? item.conversions
          : matchedInd?.conversions || []
      ).map((c) => ({
        ratio: c.ratio != null ? String(c.ratio) : "",
        targetUnit: c.targetUnit
          ? c.targetUnit.charAt(0).toUpperCase() + c.targetUnit.slice(1).toLowerCase()
          : "Box",
      }));
      const indCountRatio =
        item.pcsPerPound || matchedInd?.pcsPerPack || matchedInd?.pcsPerPound || 100;

      setPackSizeModal({
        isOpen: true,
        queueId: activeQueueId || queue[0]?.id || undefined,
        itemIndex,
        ingredientName: item.name || matchedInd?.name || "Industrial Product",
        targetIndustrialId: item.targetIndustrialId || matchedInd?.id,
        itemTargetType: "industrial",
        baseUnit: "pc",
        packUnit: suggestedPackUnit,
        weightAmount: "40",
        weightUnit: "lb",
        countAmount: String(indCountRatio),
        extraPacks: existingConvs,
      });
      return;
    }

    const { match: matched } = item.targetIngredientId
      ? { match: existingIngredients.find((ing) => ing.id && ing.id === item.targetIngredientId) }
      : findIngredientMatchForInvoiceItem(item.name || "", existingIngredients);
    const packInfo = getRegisteredPackSize(matched);
    const rawDocU =
      item.originalDocUnit && item.originalDocUnit !== "No unit in document"
        ? item.originalDocUnit.trim()
        : "";
    const rawSuggested = packInfo.hasRegisteredPackSize
      ? packInfo.displayPackUnit
      : item.packagingUnit ||
        (rawDocU ? rawDocU.charAt(0).toUpperCase() + rawDocU.slice(1).toLowerCase() : "Box");
    const isBaseU = ["lb", "lbs", "pound", "pounds", "pc", "pcs", "piece", "pieces", "each", "ea", "oz", "ounce", "ounces"].includes(
      (rawSuggested || "").toLowerCase()
    );
    const suggestedPackUnit = isBaseU ? "Box" : rawSuggested || "Box";
    const resolvedBaseUnit: "lb" | "pc" | "oz" =
      item.baseUnit ||
      (matched ? normalizeBaseUnit(matched.unit, matched) : normalizeBaseUnit(rawDocU, item));

    const existingConvs = (item.conversions && item.conversions.length > 0
      ? item.conversions
      : matched?.conversions || []
    ).map((c) => ({
      ratio: c.ratio != null ? String(c.ratio) : "",
      targetUnit: c.targetUnit ? c.targetUnit.charAt(0).toUpperCase() + c.targetUnit.slice(1).toLowerCase() : "Box",
    }));

    setPackSizeModal({
      isOpen: true,
      queueId: activeQueueId || queue[0]?.id || undefined,
      itemIndex,
      ingredientName: item.name || matched?.name || "Ingredient",
      targetIngredientId: item.targetIngredientId || matched?.id,
      itemTargetType: "ingredient",
      baseUnit: resolvedBaseUnit,
      packUnit: suggestedPackUnit,
      weightAmount: matched?.weightPerCase
        ? String(matched.weightPerCase)
        : item.weightPerCase
        ? String(item.weightPerCase)
        : "40",
      weightUnit: resolvedBaseUnit === "oz" ? "oz" : "lb",
      countAmount: matched?.pcsPerPound
        ? String(matched.pcsPerPound)
        : item.pcsPerPound
        ? String(item.pcsPerPound)
        : "24",
      extraPacks: existingConvs,
    });
  };

  const handleSavePackSize = async () => {
    if (!packSizeModal) return;
    const {
      queueId,
      itemIndex,
      targetIngredientId,
      targetIndustrialId,
      itemTargetType,
      baseUnit,
      packUnit,
      weightAmount,
      countAmount,
      extraPacks,
      ingredientName,
    } = packSizeModal;
    const isIndustrialModal = itemTargetType === "industrial";
    const strictBaseUnit: "lb" | "pc" | "oz" = isIndustrialModal
      ? "pc"
      : baseUnit === "pc"
      ? "pc"
      : baseUnit === "oz"
      ? "oz"
      : "lb";
    const targetQId = queueId || activeQueueId || queue[0]?.id;
    const rawCleanPack = (packUnit || (isIndustrialModal ? "Case" : "Box")).trim();
    // Ensure Package Unit is never lb, pc, or oz
    const cleanPackUnit = ["lb", "lbs", "pound", "pounds", "pc", "pcs", "piece", "pieces", "oz", "ounce", "ounces"].includes(
      rawCleanPack.toLowerCase()
    )
      ? isIndustrialModal
        ? "Case"
        : "Box"
      : rawCleanPack;
    const normPackUnit = cleanPackUnit.toLowerCase();
    const numWeight = (strictBaseUnit === "lb" || strictBaseUnit === "oz") ? parseFloat(weightAmount) : NaN;
    const numCount = strictBaseUnit === "pc" ? parseFloat(countAmount) : NaN;
    const packRatio =
      strictBaseUnit === "pc"
        ? (!isNaN(numCount) && numCount > 0 ? numCount : 0)
        : (!isNaN(numWeight) && numWeight > 0 ? numWeight : 0);

    let formattedDesc = cleanPackUnit;
    if (packRatio > 0) {
      formattedDesc = `${packRatio}${strictBaseUnit} per ${normPackUnit}`;
    } else {
      formattedDesc = `${cleanPackUnit} (Base: ${strictBaseUnit})`;
    }

    const cleanedExtraConvs = (extraPacks || [])
      .map((ep) => ({
        ratio: parseFloat(ep.ratio) || 0,
        targetUnit: (ep.targetUnit || "Box").trim().toLowerCase(),
      }))
      .filter((ep) => ep.ratio > 0 && ep.targetUnit && !["lb", "pc", "oz"].includes(ep.targetUnit));

    const normTargetName = (ingredientName || "").toLowerCase().trim();
    const matchedIng =
      (targetIngredientId
        ? existingIngredients.find((i) => i.id === targetIngredientId)
        : undefined) ||
      findIngredientMatchForInvoiceItem(ingredientName, existingIngredients).match;
    const effectiveTargetId = targetIngredientId || matchedIng?.id;

    // 1. Update queue items immediately so UI reflects the registered pack size right away
    setQueue((prev) =>
      prev.map((q) => {
        const updatedItems = q.items.map((cur, idx) => {
          const isDirectTarget = q.id === targetQId && idx === itemIndex;
          const isSameMappedIngredient = Boolean(
            effectiveTargetId && cur.targetIngredientId === effectiveTargetId
          );
          const isSameName =
            normTargetName && (cur.name || "").toLowerCase().trim() === normTargetName;

          if (!isDirectTarget && !isSameMappedIngredient && !isSameName) {
            return cur;
          }

          return {
            ...cur,
            unit: normPackUnit,
            baseUnit: strictBaseUnit,
            packagingUnit: cleanPackUnit,
            registeredPackSize: formattedDesc,
            unitMatchedToPackSize: true,
            needsPackSizeRegistration: false,
            conversions: cleanedExtraConvs,
            ...(effectiveTargetId && !cur.targetIngredientId
              ? { targetIngredientId: effectiveTargetId, matchAction: "map" as const }
              : {}),
            weightPerCase:
              (strictBaseUnit === "lb" || strictBaseUnit === "oz") && packRatio > 0 ? packRatio : undefined,
            weightPerCaseUnit: strictBaseUnit === "oz" ? "oz" : "lb",
            pcsPerPound:
              strictBaseUnit === "pc" && packRatio > 0 ? packRatio : undefined,
          };
        });
        return { ...q, items: updatedItems };
      })
    );

    setErrorMsg("");
    setSuccessMsg(
      `Registered Pack Size "${formattedDesc}" (Base Unit: ${strictBaseUnit}) for "${ingredientName}"!`
    );
    setPackSizeModal(null);

    // 2. Persist pack size registration to catalog immediately
    const sourceQueue = queue.find((q) => q.id === targetQId) || activeItem;
    const sourceItem = sourceQueue?.items?.[itemIndex];
    const invoicePkgQty = Number(sourceItem?.quantity) > 0 ? Number(sourceItem?.quantity) : 1;
    const invoiceTotalCost = Number(sourceItem?.totalPrice) > 0 ? Number(sourceItem?.totalPrice) : 0;
    const computedBaseQty = packRatio > 0 ? Number((invoicePkgQty * packRatio).toFixed(4)) : invoicePkgQty;

    if (isIndustrialModal || sourceItem?.itemTargetType === "industrial") {
      const matchedInd =
        (targetIndustrialId
          ? industrialProducts.find((p) => p.id === targetIndustrialId)
          : undefined) ||
        industrialProducts.find(
          (p) => (p.name || "").toLowerCase().trim() === normTargetName
        );
      const effectiveIndId = targetIndustrialId || matchedInd?.id;
      const effectivePrice = invoiceTotalCost > 0 ? invoiceTotalCost : Number(matchedInd?.price || 0);
      const effectivePcs =
        invoiceTotalCost > 0
          ? computedBaseQty
          : packRatio > 0
          ? packRatio
          : Number(matchedInd?.quantity || 1);
      const unitRatePerPc = effectivePcs > 0 ? Number((effectivePrice / effectivePcs).toFixed(6)) : 0;

      if (effectiveIndId && matchedInd) {
        try {
          await safeUpdateDoc("industrialProducts", effectiveIndId, {
            ...matchedInd,
            price: effectivePrice,
            quantity: effectivePcs,
            unit: "pc",
            baseUnit: "pc",
            packagingUnit: cleanPackUnit,
            pcsPerPack: packRatio > 0 ? packRatio : matchedInd.pcsPerPack || 1,
            pcsPerPound: packRatio > 0 ? packRatio : matchedInd.pcsPerPound || 1,
            registeredPackSize: formattedDesc,
            conversions: cleanedExtraConvs.length > 0 ? cleanedExtraConvs : matchedInd.conversions || [],
            unitPrice: unitRatePerPc,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Failed to update industrial product pack size:", err);
        }
      } else if (userId && ingredientName) {
        try {
          const docRef = await safeAddDoc("industrialProducts", {
            ownerId: userId,
            name: ingredientName,
            category:
              sourceItem?.category ||
              recommendIndustrialCategory(ingredientName),
            vendor: sourceQueue?.vendor || "Supplier",
            price: effectivePrice,
            quantity: effectivePcs,
            unit: "pc",
            baseUnit: "pc",
            packagingUnit: cleanPackUnit,
            pcsPerPack: packRatio > 0 ? packRatio : 1,
            pcsPerPound: packRatio > 0 ? packRatio : 1,
            registeredPackSize: formattedDesc,
            conversions: cleanedExtraConvs,
            unitPrice: unitRatePerPc,
            inStock: 0,
            minStock: packRatio > 0 ? packRatio : 5,
            source: "Pack Size Registration",
            updatedAt: new Date().toISOString(),
          });
          if (docRef?.id) {
            setQueue((prev) =>
              prev.map((q) => ({
                ...q,
                items: q.items.map((cur, idx) => {
                  const isDirectTarget = q.id === targetQId && idx === itemIndex;
                  const isSameName =
                    normTargetName && (cur.name || "").toLowerCase().trim() === normTargetName;
                  if (!isDirectTarget && !isSameName) return cur;
                  return {
                    ...cur,
                    targetIndustrialId: docRef.id,
                    matchAction: "map" as const,
                  };
                }),
              }))
            );
          }
        } catch (err) {
          console.error("Failed to create industrial product with pack size:", err);
        }
      }
      return;
    }

    if (effectiveTargetId && matchedIng) {
      try {
        const effectivePrice = invoiceTotalCost > 0 ? invoiceTotalCost : (Number(matchedIng.price) || 0);
        const effectiveBaseQty =
          invoiceTotalCost > 0
            ? computedBaseQty
            : (Number(matchedIng.quantity) > 1 ? Number(matchedIng.quantity) : (packRatio > 0 ? packRatio : 1));

        const updatedPricePerGram = calculateIngredientUnitPrice({
          price: effectivePrice,
          quantity: effectiveBaseQty,
          unit: strictBaseUnit,
          weightPerCase:
            (strictBaseUnit === "lb" || strictBaseUnit === "oz") && packRatio > 0 ? packRatio : undefined,
          weightPerCaseUnit: strictBaseUnit === "oz" ? "oz" : "lb",
          pcsPerPound:
            strictBaseUnit === "pc" && packRatio > 0 ? packRatio : undefined,
          conversions: cleanedExtraConvs.length > 0 ? cleanedExtraConvs : matchedIng.conversions,
        });

        await safeUpdateDoc("ingredients", effectiveTargetId, {
          ...matchedIng,
          price: effectivePrice,
          quantity: effectiveBaseQty,
          packagingUnit: cleanPackUnit,
          unit: strictBaseUnit,
          baseUnit: strictBaseUnit,
          pricePerGram: updatedPricePerGram,
          weightPerCase:
            (strictBaseUnit === "lb" || strictBaseUnit === "oz") && packRatio > 0 ? packRatio : null,
          weightPerCaseUnit: strictBaseUnit === "oz" ? "oz" : "lb",
          pcsPerPound:
            strictBaseUnit === "pc" && packRatio > 0 ? packRatio : null,
          conversions: cleanedExtraConvs.length > 0 ? cleanedExtraConvs : (matchedIng.conversions || []),
          updatedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error("Failed to save pack size to catalog:", err);
      }
    } else if (userId && ingredientName) {
      try {
        const recommendedYield = recommendUsabilityPercentage(ingredientName).percentage;
        const finalYield =
          sourceItem?.usabilityPercentage !== undefined
            ? sourceItem.usabilityPercentage
            : recommendedYield;
        const pricePerGram = calculateIngredientUnitPrice({
          price: invoiceTotalCost,
          quantity: computedBaseQty,
          unit: strictBaseUnit,
          weightPerCase:
            (strictBaseUnit === "lb" || strictBaseUnit === "oz") && packRatio > 0 ? packRatio : undefined,
          weightPerCaseUnit: strictBaseUnit === "oz" ? "oz" : "lb",
          pcsPerPound:
            strictBaseUnit === "pc" && packRatio > 0 ? packRatio : undefined,
          conversions: cleanedExtraConvs,
        });

        const docRef = await safeAddDoc("ingredients", {
          ownerId: userId,
          name: ingredientName,
          price: invoiceTotalCost,
          quantity: computedBaseQty,
          unit: strictBaseUnit,
          baseUnit: strictBaseUnit,
          packagingUnit: cleanPackUnit,
          pricePerGram,
          source: "Pack Size Registration",
          vendor: sourceQueue?.vendor || "Document Parsed",
          inStock: 0,
          minStock: 10,
          usabilityPercentage: finalYield,
          ...((strictBaseUnit === "lb" || strictBaseUnit === "oz") && packRatio > 0
            ? { weightPerCase: packRatio, weightPerCaseUnit: strictBaseUnit === "oz" ? "oz" : "lb" }
            : {}),
          ...(strictBaseUnit === "pc" && packRatio > 0
            ? { pcsPerPound: packRatio }
            : {}),
          ...(cleanedExtraConvs.length > 0 ? { conversions: cleanedExtraConvs } : {}),
          updatedAt: new Date().toISOString(),
        });

        if (docRef?.id) {
          setQueue((prev) =>
            prev.map((q) => ({
              ...q,
              items: q.items.map((cur, idx) => {
                const isDirectTarget = q.id === targetQId && idx === itemIndex;
                const isSameName =
                  normTargetName && (cur.name || "").toLowerCase().trim() === normTargetName;
                if (!isDirectTarget && !isSameName) return cur;
                return {
                  ...cur,
                  targetIngredientId: docRef.id,
                  matchAction: "map" as const,
                };
              }),
            }))
          );
        }
      } catch (err: any) {
        console.error("Failed to create catalog ingredient with registered pack size:", err);
      }
    }
  };

  // Automatically sync parsed queue items when master catalog ingredients have their pack size or naming match registered/updated
  useEffect(() => {
    if (!existingIngredients || existingIngredients.length === 0) return;
    setQueue((prev) => {
      let changed = false;
      const next = prev.map((q) => {
        if (q.status !== "parsed" || !q.items || q.items.length === 0) return q;
        let qChanged = false;
        const updatedItems = q.items.map((item) => {
          if (item.itemTargetType === "industrial") return item;
          const aliasLookup = findIngredientMatchForInvoiceItem(
            item.name || "",
            existingIngredients
          );
          const matched =
            (item.targetIngredientId
              ? existingIngredients.find((ing) => ing.id === item.targetIngredientId)
              : undefined) || aliasLookup.match;
          if (!matched) return item;
          const packInfo = getRegisteredPackSize(matched);
          const nextDesc = packInfo.description || packInfo.displayPackUnit;
          const needsTargetSync = !item.targetIngredientId && Boolean(matched.id);
          const needsPackSync =
            packInfo.hasRegisteredPackSize &&
            (item.needsPackSizeRegistration ||
              item.unit !== packInfo.packSizeUnit ||
              item.registeredPackSize !== nextDesc);

          if (needsTargetSync || needsPackSync) {
            qChanged = true;
            changed = true;
            return {
              ...item,
              targetIngredientId: item.targetIngredientId || matched.id,
              matchAction: "map" as const,
              matchedViaAlias: item.matchedViaAlias || aliasLookup.matchedViaAlias,
              baseUnit: packInfo.baseUnit,
              ...(packInfo.hasRegisteredPackSize
                ? {
                    unit: packInfo.packSizeUnit,
                    packagingUnit: packInfo.displayPackUnit,
                    registeredPackSize: nextDesc,
                    needsPackSizeRegistration: false,
                    unitMatchedToPackSize:
                      !item.originalDocUnit ||
                      item.originalDocUnit.toLowerCase() !== packInfo.packSizeUnit,
                    weightPerCase: matched.weightPerCase ?? item.weightPerCase,
                    weightPerCaseUnit: matched.weightPerCaseUnit || item.weightPerCaseUnit || "lb",
                    pcsPerPound: matched.pcsPerPound ?? item.pcsPerPound,
                  }
                : {}),
            };
          }
          return item;
        });
        return qChanged ? { ...q, items: updatedItems } : q;
      });
      return changed ? next : prev;
    });
  }, [existingIngredients, setQueue]);

  const handleCancelParsing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setParsingAll(false);
    setQueue(prev => prev.map(q => {
      if (q.status === "parsing") {
        return { ...q, status: "pending", error: "Canceled by user" };
      }
      return q;
    }));
    setErrorMsg("Parsing job was canceled.");
  };

  // Strict suppliers list from vendors collection only
  const supplierList = useMemo(() => {
    const set = new Set<string>();
    (vendors || []).forEach((v: any) => {
      if (v.name && v.name.trim()) set.add(v.name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const activeItem = queue.find(q => q.id === activeQueueId);

  // Sync selected indices and stock preservation mode when active document ID changes
  const prevActiveQueueIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeItem && activeItem.items) {
      if (prevActiveQueueIdRef.current !== activeQueueId) {
        prevActiveQueueIdRef.current = activeQueueId;
        // By default, select all items that are not skipped
        const nonSkipped = activeItem.items
          .map((item, idx) => (item.matchAction !== "skip" ? idx : -1))
          .filter(idx => idx !== -1);
        setSelectedIndices(nonSkipped);

        // Default to Stock Intake mode (preserveStockCounts = false) so applying an invoice increases on-hand stock in Inventory
        setPreserveStockCounts(activeItem.documentType === "price_correction");
      }
    } else {
      prevActiveQueueIdRef.current = null;
      setSelectedIndices([]);
    }
  }, [activeQueueId, activeItem]);

  // Helper to find recipes impacted by an ingredient
  const getImpactedRecipes = (ingredientId?: string, ingredientName?: string) => {
    if (!recipes || recipes.length === 0) return [];
    return recipes.filter(r => {
      return r.ingredients.some(ing => {
        if (ingredientId && ing.ingredientId === ingredientId) return true;
        if (ingredientName && ing.name && ing.name.toLowerCase().trim() === ingredientName.toLowerCase().trim()) return true;
        return false;
      });
    });
  };

  // Helper to compute unit price delta and metrics
  const getItemPriceComparison = (item: ParsedInvoiceItem) => {
    if (item.itemTargetType === "industrial") {
      const matchedInd =
        (item.targetIndustrialId
          ? industrialProducts.find((p) => p.id === item.targetIndustrialId)
          : undefined) ||
        industrialProducts.find(
          (p) =>
            p.name &&
            item.name &&
            p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
        );
      const newUnitPrice =
        item.quantity > 0 ? item.totalPrice / item.quantity : 0;
      if (!matchedInd) {
        return {
          matchedIng: null,
          oldUnitPrice: null,
          newUnitPrice,
          diff: null,
          percent: null,
          isIncrease: false,
          isDecrease: false,
          isUnchanged: false,
        };
      }
      const oldUnitPrice = matchedInd.price / (matchedInd.quantity || 1);
      const diff = newUnitPrice - oldUnitPrice;
      const percent = oldUnitPrice > 0 ? (diff / oldUnitPrice) * 100 : 0;
      const isIncrease = diff > 0.005;
      const isDecrease = diff < -0.005;
      const isUnchanged = Math.abs(diff) <= 0.005;
      return {
        matchedIng: matchedInd as any,
        oldUnitPrice,
        newUnitPrice,
        diff,
        percent,
        isIncrease,
        isDecrease,
        isUnchanged,
      };
    }

    const matchedIng =
      (item.targetIngredientId
        ? existingIngredients.find(ing => ing.id === item.targetIngredientId)
        : undefined) ||
      existingIngredients.find(
        ing => ing.name && item.name && ing.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
    const newUnitPrice = item.quantity > 0 ? (item.totalPrice / item.quantity) : 0;
    
    if (!matchedIng) {
      return { 
        matchedIng: null, 
        oldUnitPrice: null, 
        newUnitPrice, 
        diff: null, 
        percent: null, 
        isIncrease: false, 
        isDecrease: false, 
        isUnchanged: false 
      };
    }

    const oldUnitPrice = matchedIng.price / (matchedIng.quantity || 1);
    const diff = newUnitPrice - oldUnitPrice;
    const percent = oldUnitPrice > 0 ? (diff / oldUnitPrice) * 100 : 0;
    const isIncrease = diff > 0.005;
    const isDecrease = diff < -0.005;
    const isUnchanged = Math.abs(diff) <= 0.005;

    return {
      matchedIng,
      oldUnitPrice,
      newUnitPrice,
      diff,
      percent,
      isIncrease,
      isDecrease,
      isUnchanged
    };
  };

  // Compute active document price statistics
  const activeStats = useMemo(() => {
    if (!activeItem || !activeItem.items) {
      return { increases: 0, decreases: 0, unchanged: 0, mapped: 0, unmapped: 0, avgIncrease: 0, avgDecrease: 0, impactedRecipesCount: 0 };
    }

    let incSum = 0;
    let incCount = 0;
    let decSum = 0;
    let decCount = 0;
    let unchCount = 0;
    let mapCount = 0;
    let unmapCount = 0;
    const impactedRecipeSet = new Set<string>();

    activeItem.items.forEach(item => {
      const comp = getItemPriceComparison(item);
      if (comp.matchedIng) {
        mapCount++;
        const impacted = getImpactedRecipes(comp.matchedIng.id, comp.matchedIng.name);
        impacted.forEach(r => impactedRecipeSet.add(r.id || r.name));

        if (comp.isIncrease) {
          incCount++;
          incSum += comp.percent || 0;
        } else if (comp.isDecrease) {
          decCount++;
          decSum += Math.abs(comp.percent || 0);
        } else if (comp.isUnchanged) {
          unchCount++;
        }
      } else {
        unmapCount++;
      }
    });

    return {
      increases: incCount,
      decreases: decCount,
      unchanged: unchCount,
      mapped: mapCount,
      unmapped: unmapCount,
      avgIncrease: incCount > 0 ? incSum / incCount : 0,
      avgDecrease: decCount > 0 ? decSum / decCount : 0,
      impactedRecipesCount: impactedRecipeSet.size
    };
  }, [activeItem, existingIngredients, recipes]);

  // Load interactive demo batch for Price Correction
  const handleLoadPriceCorrectionDemo = () => {
    setErrorMsg("");
    setSuccessMsg("Loaded vendor price change notice & market update sheet for instant price correction!");
    setPreserveStockCounts(true);

    const priceCorrectionNotice: QueueItem = {
      id: "demo-price-correction",
      file: null,
      fileName: "USFoods_Price_Adjustment_Notice.svg",
      fileSize: 38400,
      fileDataUrl: createDemoInvoiceSvg("US Foods", "PRC-2026-Q3", new Date().toLocaleDateString(), [
        { name: "Organic Bread Flour 50lb", quantity: 1, totalPrice: 24.50 },
        { name: "Unsalted Butter 1lb blocks", quantity: 1, totalPrice: 3.75 },
        { name: "Granulated Sugar bulk", quantity: 1, totalPrice: 21.50 },
        { name: "USDA Choice Ribeye Subprimal", quantity: 1, totalPrice: 225.00 },
        { name: "Whole Milk 1 Gallon", quantity: 1, totalPrice: 4.00 }
      ]),
      fileType: "image/svg+xml",
      status: "parsed",
      vendor: "US Foods",
      invoiceNumber: "PRC-2026-Q3",
      date: new Date().toLocaleDateString(),
      isDemo: true,
      documentType: "price_correction",
      items: [
        {
          name: "Organic Bread Flour 50lb",
          unit: "case",
          quantity: 1,
          totalPrice: 24.50, // Price hike: $22.00 -> $24.50 (+11.4%)
          pricePerUnit: 24.50,
          weightPerCase: 50,
          weightPerCaseUnit: "lb",
        },
        {
          name: "Unsalted Butter 1lb blocks",
          unit: "case",
          quantity: 1,
          totalPrice: 3.75, // Savings / Drop: $4.00 -> $3.75 (-6.2%)
          pricePerUnit: 3.75,
          weightPerCase: 36,
          weightPerCaseUnit: "lb",
        },
        {
          name: "Granulated Sugar bulk",
          unit: "case",
          quantity: 1,
          totalPrice: 21.50, // Price hike: $20.00 -> $21.50 (+7.5%)
          pricePerUnit: 21.50,
          weightPerCase: 50,
          weightPerCaseUnit: "lb",
        },
        {
          name: "USDA Choice Ribeye Subprimal",
          unit: "case",
          quantity: 1,
          totalPrice: 225.00, // Price hike: $210.00 -> $225.00 (+7.1%)
          pricePerUnit: 225.00,
          weightPerCase: 14,
          weightPerCaseUnit: "lb",
        },
        {
          name: "Whole Milk 1 Gallon",
          unit: "case",
          quantity: 1,
          totalPrice: 4.00, // Unchanged: $4.00 (0.0%)
          pricePerUnit: 4.00,
          weightPerCase: 8.6,
          weightPerCaseUnit: "lb",
        }
      ].map((item, idx) => matchParsedItemWithCatalog(item, existingIngredients, idx))
    };

    setQueue(prev => [priceCorrectionNotice, ...prev.filter(q => q.id !== "demo-price-correction")]);
    setActiveQueueId("demo-price-correction");
  };

  // Load interactive demo batch of 3 invoices for delivery intake
  const handleLoadDemoBatch = () => {
    setErrorMsg("");
    setSuccessMsg("Loaded 3 mock vendor invoices into batch workspace for instant delivery review & stock intake!");
    
    const demoInvoices: QueueItem[] = [
      {
        id: "demo-sysco",
        file: null,
        fileName: "Sysco_Food_Invoice_98214.svg",
        fileSize: 45200,
        fileDataUrl: createDemoInvoiceSvg("Sysco Food Services", "SYS-98214", new Date().toLocaleDateString(), [
          { name: "Unsalted Butter 1lb blocks", quantity: 36, totalPrice: 144.00 },
          { name: "Organic Bread Flour 50lb", quantity: 5, totalPrice: 110.00 },
          { name: "Whole Milk 1 Gallon", quantity: 12, totalPrice: 48.00 },
          { name: "Granulated Sugar bulk", quantity: 4, totalPrice: 80.00 },
          { name: "Heavy Cream 36% 1 Quart", quantity: 24, totalPrice: 96.00 }
        ]),
        fileType: "image/svg+xml",
        status: "parsed",
        vendor: "Sysco Food Services",
        invoiceNumber: "SYS-98214",
        date: new Date().toLocaleDateString(),
        isDemo: true,
        documentType: "invoice",
        items: [
          {
            name: "Unsalted Butter 1lb blocks",
            unit: "case",
            quantity: 36,
            totalPrice: 144.00,
            pricePerUnit: 4.00,
            weightPerCase: 36,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Organic Bread Flour 50lb",
            unit: "case",
            quantity: 5,
            totalPrice: 110.00,
            pricePerUnit: 22.00,
            weightPerCase: 50,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Whole Milk 1 Gallon",
            unit: "case",
            quantity: 12,
            totalPrice: 48.00,
            pricePerUnit: 4.00,
            weightPerCase: 8.6,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Granulated Sugar bulk",
            unit: "case",
            quantity: 4,
            totalPrice: 80.00,
            pricePerUnit: 20.00,
            weightPerCase: 50,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Heavy Cream 36% 1 Quart",
            unit: "case",
            quantity: 24,
            totalPrice: 96.00,
            pricePerUnit: 4.00,
            weightPerCase: 2.0,
            weightPerCaseUnit: "lb",
          }
        ].map((item, idx) => matchParsedItemWithCatalog(item, existingIngredients, idx))
      },
      {
        id: "demo-usfoods",
        file: null,
        fileName: "USF_Produce_And_Seafood.svg",
        fileSize: 124300,
        fileDataUrl: createDemoInvoiceSvg("US Foods", "USF-33412", new Date().toLocaleDateString(), [
          { name: "Fresh Peaches - Premium Red", quantity: 2, totalPrice: 58.00 },
          { name: "Yukon Gold Potatoes", quantity: 4, totalPrice: 48.00 },
          { name: "Fresh Atlantic Sea Bass Fillet", quantity: 1, totalPrice: 195.00 },
          { name: "Asparagus Bunches Large", quantity: 10, totalPrice: 45.00 },
          { name: "Shrimp Tempura", quantity: 5, totalPrice: 125.00 }
        ]),
        fileType: "image/svg+xml",
        status: "parsed",
        vendor: "US Foods",
        invoiceNumber: "USF-33412",
        date: new Date().toLocaleDateString(),
        isDemo: true,
        documentType: "invoice",
        items: [
          {
            name: "Fresh Peaches - Premium Red",
            unit: "case",
            quantity: 2,
            totalPrice: 58.00,
            pricePerUnit: 29.00,
            weightPerCase: 20,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Yukon Gold Potatoes",
            unit: "case",
            quantity: 4,
            totalPrice: 48.00,
            pricePerUnit: 12.00,
            weightPerCase: 50,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Fresh Atlantic Sea Bass Fillet",
            unit: "case",
            quantity: 1,
            totalPrice: 195.00,
            pricePerUnit: 195.00,
            weightPerCase: 15,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Asparagus Bunches Large",
            unit: "case",
            quantity: 10,
            totalPrice: 45.00,
            pricePerUnit: 4.50,
            weightPerCase: 1.0,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Shrimp Tempura",
            unit: "case",
            quantity: 5,
            totalPrice: 125.00,
            pricePerUnit: 25.00,
            weightPerCase: 10,
            weightPerCaseUnit: "lb",
          }
        ].map((item, idx) => matchParsedItemWithCatalog(item, existingIngredients, idx))
      },
      {
        id: "demo-chefs",
        file: null,
        fileName: "ChefsWarehouse_CW-45892.svg",
        fileSize: 8500,
        fileDataUrl: createDemoInvoiceSvg("Chef's Warehouse", "CW-45892", new Date().toLocaleDateString(), [
          { name: "USDA Choice Ribeye Subprimal", quantity: 2, totalPrice: 420.00 },
          { name: "Fresh Mint Leaves", quantity: 15, totalPrice: 30.00 },
          { name: "Organic Clover Honey Bulks", quantity: 1, totalPrice: 65.00 }
        ]),
        fileType: "image/svg+xml",
        status: "parsed",
        vendor: "Chef's Warehouse",
        invoiceNumber: "CW-45892",
        date: new Date().toLocaleDateString(),
        isDemo: true,
        documentType: "invoice",
        items: [
          {
            name: "USDA Choice Ribeye Subprimal",
            unit: "case",
            quantity: 2,
            totalPrice: 420.00,
            pricePerUnit: 210.00,
            weightPerCase: 14,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Fresh Mint Leaves",
            unit: "case",
            quantity: 15,
            totalPrice: 30.00,
            pricePerUnit: 2.00,
            weightPerCase: 0.5,
            weightPerCaseUnit: "lb",
          },
          {
            name: "Organic Clover Honey Bulks",
            unit: "case",
            quantity: 1,
            totalPrice: 65.00,
            pricePerUnit: 65.00,
            weightPerCase: 12,
            weightPerCaseUnit: "lb",
          }
        ].map((item, idx) => matchParsedItemWithCatalog(item, existingIngredients, idx))
      }
    ];

    setQueue(demoInvoices);
    setActiveQueueId("demo-sysco");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
      e.target.value = "";
    }
  };

  const handleFilesAdded = (files: FileList) => {
    const newItems: QueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];
      const newItemId = `batch-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;
      newItems.push({
        id: newItemId,
        file: currentFile,
        fileName: currentFile.name,
        fileSize: currentFile.size,
        fileType: currentFile.type || "application/octet-stream",
        status: "pending",
        vendor: "",
        invoiceNumber: "",
        date: "",
        items: [],
        documentType: "invoice",
        defaultTargetType: defaultUploadTarget
      });

      // Pre-process and optimize file in background for instant preview and archiving
      processInvoiceFile(currentFile).then(processed => {
        setQueue(prev => prev.map(q => q.id === newItemId ? {
          ...q,
          fileDataUrl: processed.dataUrl,
          fileType: processed.mimeType,
          fileSize: processed.size
        } : q));
      }).catch(err => {
        console.warn("Pre-process invoice file error:", err);
      });
    }

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems]);
      setActiveQueueId(prev => prev || newItems[0].id);
      setSuccessMsg(`Added ${newItems.length} file(s) to the batch queue. Click "Parse Pending Documents" to process them with AI!`);
    }
  };

  // Parse a specific individual item in the queue
  const parseQueueItem = async (item: QueueItem, signal?: AbortSignal): Promise<QueueItem> => {
    if ((!item.file && !item.fileDataUrl) || item.status === "parsed") {
      return item;
    }

    try {
      let fileDataUrl = item.fileDataUrl;
      let fileMime = item.fileType || item.file?.type;
      let fileSize = item.fileSize || item.file?.size || 0;

      if (!fileDataUrl && item.file) {
        const processed = await processInvoiceFile(item.file);
        fileDataUrl = processed.dataUrl;
        fileMime = processed.mimeType;
        fileSize = processed.size;
      }

      if (!fileDataUrl) {
        throw new Error("No file content or preview available to process.");
      }

      const base64Data = fileDataUrl.includes(",") ? fileDataUrl.split(",")[1] : fileDataUrl;

      const fileName = item.fileName || item.file?.name || "document";
      let detectedMime = fileMime;
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (!detectedMime || detectedMime === "application/octet-stream") {
        if (ext === "csv") detectedMime = "text/csv";
        else if (ext === "txt" || ext === "tsv") detectedMime = "text/plain";
        else if (ext === "pdf") detectedMime = "application/pdf";
        else if (ext === "png") detectedMime = "image/png";
        else if (ext === "jpg" || ext === "jpeg") detectedMime = "image/jpeg";
        else if (ext === "webp") detectedMime = "image/webp";
        else if (ext === "svg") detectedMime = "image/svg+xml";
      }

      const response = await fetch("/api/parse-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: detectedMime || "application/octet-stream",
          fileName: fileName,
        }),
        signal,
      });

      if (!response.ok) {
        let errBody: any;
        try {
          errBody = await response.json();
        } catch (e) {
          errBody = { error: `Server responded with ${response.status} ${response.statusText}` };
        }
        throw new Error(errBody.message || errBody.error || "The server failed to parse the document.");
      }

      const data = await response.json();

      // Auto-match vendor with one of the registered suppliers!
      let extractedVendor = data.vendor || "";
      if (extractedVendor) {
        const matched = supplierList.find(s => 
          s.toLowerCase().trim() === extractedVendor.toLowerCase().trim() ||
          extractedVendor.toLowerCase().includes(s.toLowerCase().trim()) ||
          s.toLowerCase().includes(extractedVendor.toLowerCase().trim())
        );
        if (matched) {
          extractedVendor = matched;
        }
      } else if (supplierList.length > 0) {
        extractedVendor = supplierList[0];
      }
      
      const targetMode = item.defaultTargetType || defaultUploadTarget || "ingredient";
      // Map parsed keys with master ingredient catalog or industrial products catalog
      const parsedItems: ParsedInvoiceItem[] = (data.items || []).map((parsedItem: any, idx: number) => 
        targetMode === "industrial"
          ? matchParsedItemWithIndustrialCatalog(parsedItem, industrialProducts, idx)
          : matchParsedItemWithCatalog(parsedItem, existingIngredients, idx)
      );

      return {
        ...item,
        fileDataUrl,
        fileType: detectedMime,
        fileSize,
        status: "parsed",
        vendor: extractedVendor || "Unknown Vendor",
        invoiceNumber: data.invoiceNumber || `PRC-${Math.floor(1000 + Math.random() * 9000)}`,
        date: data.issueDate || new Date().toLocaleDateString(),
        defaultTargetType: targetMode,
        items: parsedItems,
      };

    } catch (err: any) {
      console.error("Item parse failure:", err);
      if (err.name === 'AbortError') {
        return {
          ...item,
          status: "pending",
          error: "Canceled by user"
        };
      }
      return {
        ...item,
        status: "failed",
        error: err.message || "Failed to process document with Gemini AI."
      };
    }
  };

  // Trigger single item extraction with immediate loading state & feedback
  const handleExtractSingleItem = async (targetItem: QueueItem) => {
    if (isReadOnly) return;
    setErrorMsg("");
    setSuccessMsg("");
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setQueue(prev => prev.map(q => q.id === targetItem.id ? { ...q, status: "parsing", error: undefined } : q));
    const updated = await parseQueueItem({ ...targetItem, status: "pending" }, signal);
    setQueue(prev => prev.map(q => q.id === targetItem.id ? updated : q));
    
    if (!signal.aborted) {
      if (updated.status === "failed") {
        setErrorMsg(updated.error || `Failed to extract line items from ${updated.fileName}.`);
      } else if (updated.status === "parsed") {
        setSuccessMsg(`Extracted ${updated.items.length} items from "${updated.fileName}"!`);
      }
    }
  };

  // Run all pending items in the queue concurrently
  const handleParseAll = async () => {
    const pendingItems = queue.filter(q => q.status === "pending" || q.status === "failed");
    if (pendingItems.length === 0) {
      setErrorMsg("No pending documents remain in your upload queue.");
      return;
    }

    setParsingAll(true);
    setErrorMsg("");
    setSuccessMsg("");
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setQueue(prev => prev.map(q => {
      if (q.status === "pending" || q.status === "failed") {
        return { ...q, status: "parsing" };
      }
      return q;
    }));

    const promises = pendingItems.map(async (item) => {
      const updated = await parseQueueItem(item, signal);
      setQueue(prev => prev.map(q => q.id === item.id ? updated : q));
      return updated;
    });

    await Promise.all(promises);
    if (!signal.aborted) {
      setParsingAll(false);
      setSuccessMsg(`Extracted line items, prices, and vendor data concurrently for all queued documents!`);
    }
  };

  // Delete an item from the queue
  const handleRemoveFromQueue = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setQueue(prev => prev.filter(q => q.id !== id));
    setActiveQueueId(prev => {
      if (prev === id) {
        const remaining = queue.filter(q => q.id !== id);
        return remaining[0]?.id || null;
      }
      return prev;
    });
  };

  // Update attributes of items currently in active review
  const updateItemField = (index: number, field: keyof ParsedInvoiceItem, value: any) => {
    if (!activeQueueId) return;
    setQueue(prev => prev.map(q => {
      if (q.id !== activeQueueId) return q;
      const updatedItems = [...q.items];
      const curItem = { ...updatedItems[index], [field]: value };
      
      let newName = field === "name" ? value : curItem.name;
      let newTargetId = curItem.targetIngredientId;
      let newAction = curItem.matchAction;

      // If user typed a new name, check if it matches a catalog ingredient and update AI category recommendation
      if (field === "name" && typeof value === "string") {
        const recCat = recommendFoodCategory(value);
        const prevRec = curItem.aiRecommendedCategory;
        curItem.aiRecommendedCategory = recCat;
        if (!curItem.category || curItem.category === prevRec) {
          curItem.category = recCat;
        }
        const searchName = value.toLowerCase().trim();
        const autoMatch = existingIngredients.find(
          ing => ing.name && ing.name.toLowerCase().trim() === searchName
        );
        if (autoMatch) {
          newTargetId = autoMatch.id;
          newAction = "map";
          if (autoMatch.category && autoMatch.category !== "Other") {
            curItem.category = recommendFoodCategory(value, autoMatch.category);
          }
          const packInfo = getRegisteredPackSize(autoMatch);
          if (packInfo.hasRegisteredPackSize) {
            curItem.unit = packInfo.packSizeUnit;
            curItem.packagingUnit = packInfo.displayPackUnit;
            curItem.registeredPackSize = packInfo.displayPackUnit;
            curItem.unitMatchedToPackSize = !curItem.originalDocUnit || curItem.originalDocUnit.toLowerCase() !== packInfo.packSizeUnit;
            curItem.needsPackSizeRegistration = false;
          } else {
            curItem.unit = autoMatch.unit || "";
            curItem.registeredPackSize = undefined;
            curItem.unitMatchedToPackSize = false;
            curItem.needsPackSizeRegistration = !autoMatch.unit;
          }
          if (autoMatch.weightPerCase) {
            curItem.weightPerCase = autoMatch.weightPerCase;
            curItem.weightPerCaseUnit = autoMatch.weightPerCaseUnit || "lb";
          }
          if (autoMatch.pcsPerPound) {
            curItem.pcsPerPound = autoMatch.pcsPerPound;
          }
        }
      }

      // If user manually changed unit, check if it matches registered pack size
      if (field === "unit" && typeof value === "string") {
        const cleanVal = value.toLowerCase().trim();
        if (curItem.registeredPackSize) {
          curItem.unitMatchedToPackSize = cleanVal !== (curItem.packagingUnit || curItem.registeredPackSize).toLowerCase();
        }
      }

      updatedItems[index] = { 
        ...curItem, 
        name: newName,
        targetIngredientId: newTargetId,
        matchAction: newAction
      };
      return { ...q, items: updatedItems };
    }));
  };

  // Switch entire active document between Ingredient and Industrial Products
  const handleSwitchDocumentTargetType = (targetType: "ingredient" | "industrial") => {
    if (!activeQueueId) return;
    setQueue(prev =>
      prev.map(q => {
        if (q.id !== activeQueueId) return q;
        const remapped = (q.items || []).map((it, idx) =>
          targetType === "industrial"
            ? matchParsedItemWithIndustrialCatalog(it, industrialProducts, idx)
            : {
                ...matchParsedItemWithCatalog(it, existingIngredients, idx),
                itemTargetType: "ingredient" as const,
              }
        );
        return {
          ...q,
          defaultTargetType: targetType,
          items: remapped,
        };
      })
    );
    setSuccessMsg(
      targetType === "industrial"
        ? "Switched document destination to Industrial Products! Line items will be saved to the Industrial Products catalog."
        : "Switched document destination to Ingredients (Culinary)! Line items will be saved to Master Ingredient Prices & Inventory."
    );
  };

  // Switch an individual line item between Ingredient and Industrial Products
  const handleSwitchLineItemTargetType = (index: number, targetType: "ingredient" | "industrial") => {
    if (!activeQueueId) return;
    setQueue(prev =>
      prev.map(q => {
        if (q.id !== activeQueueId) return q;
        const updatedItems = [...q.items];
        const cur = updatedItems[index];
        if (!cur) return q;
        updatedItems[index] =
          targetType === "industrial"
            ? matchParsedItemWithIndustrialCatalog(cur, industrialProducts, index)
            : {
                ...matchParsedItemWithCatalog(cur, existingIngredients, index),
                itemTargetType: "ingredient" as const,
              };
        return { ...q, items: updatedItems };
      })
    );
  };

  const handleApplyAllAiCategories = () => {
    if (!activeQueueId) return;
    setQueue(prev => prev.map(q => {
      if (q.id !== activeQueueId) return q;
      const updatedItems = q.items.map(it => {
        const rec = it.itemTargetType === "industrial"
          ? recommendIndustrialCategory(it.name, it.category)
          : (it.aiRecommendedCategory || recommendFoodCategory(it.name, it.category));
        return {
          ...it,
          aiRecommendedCategory: rec,
          category: rec,
        };
      });
      return { ...q, items: updatedItems };
    }));
    setSuccessMsg("Applied AI-recommended categories to all line items in this document!");
  };

  const handleAddNewRow = () => {
    if (!activeQueueId) return;
    setQueue(prev => prev.map(q => {
      if (q.id !== activeQueueId) return q;
      const isInd = q.defaultTargetType === "industrial";
      const newItem: ParsedInvoiceItem = isInd
        ? {
            name: "",
            itemTargetType: "industrial",
            category: "Packaging & Containers",
            aiRecommendedCategory: "Packaging & Containers",
            quantity: 1,
            unit: "case",
            totalPrice: 0,
            pricePerUnit: 0,
            matchAction: "create",
            targetIndustrialId: "",
            targetIngredientId: "",
            needsPackSizeRegistration: false,
          }
        : {
            name: "",
            itemTargetType: "ingredient",
            category: "Meat",
            aiRecommendedCategory: "Meat",
            quantity: 1,
            unit: "",
            totalPrice: 0,
            pricePerUnit: 0,
            matchAction: "create",
            targetIngredientId: "",
            weightPerCase: undefined,
            weightPerCaseUnit: "lb",
            usabilityPercentage: 100,
            registeredPackSize: undefined,
            needsPackSizeRegistration: true
          };
      const updatedItems = [...q.items, newItem];
      return { ...q, items: updatedItems };
    }));
    setSelectedIndices(prev => [...prev, (activeItem?.items.length || 0)]);
  };

  const handleDeleteRow = (index: number) => {
    if (!activeQueueId) return;
    setQueue(prev => prev.map(q => {
      if (q.id !== activeQueueId) return q;
      const updatedItems = q.items.filter((_, idx) => idx !== index);
      return { ...q, items: updatedItems };
    }));
    setSelectedIndices(prev => prev.filter(i => i !== index).map(i => (i > index ? i - 1 : i)));
  };

  const updateItemAction = (index: number, action: "create" | "map" | "skip") => {
    if (!activeQueueId) return;
    setQueue(prev => prev.map(q => {
      if (q.id !== activeQueueId) return q;
      const itemsCopy = [...q.items];
      const targetId = action === "map" ? (itemsCopy[index].targetIngredientId || existingIngredients[0]?.id || "") : "";
      const match = existingIngredients.find(ing => ing.id === targetId);

      const updatedLine = {
        ...itemsCopy[index],
        matchAction: action,
        targetIngredientId: targetId
      };

      if (action === "map" && match) {
        const packInfo = getRegisteredPackSize(match);
        if (packInfo.hasRegisteredPackSize) {
          updatedLine.unit = packInfo.packSizeUnit;
          updatedLine.packagingUnit = packInfo.displayPackUnit;
          updatedLine.registeredPackSize = packInfo.description || packInfo.displayPackUnit;
          updatedLine.unitMatchedToPackSize = !updatedLine.originalDocUnit || updatedLine.originalDocUnit.toLowerCase() !== packInfo.packSizeUnit;
          updatedLine.needsPackSizeRegistration = false;
        } else {
          updatedLine.unit = match.unit || "";
          updatedLine.registeredPackSize = undefined;
          updatedLine.unitMatchedToPackSize = false;
          updatedLine.needsPackSizeRegistration = !match.unit;
        }
        updatedLine.weightPerCase = match.weightPerCase !== undefined ? match.weightPerCase : updatedLine.weightPerCase;
        updatedLine.weightPerCaseUnit = match.weightPerCaseUnit || updatedLine.weightPerCaseUnit || "lb";
        updatedLine.usabilityPercentage = match.usabilityPercentage !== undefined ? match.usabilityPercentage : updatedLine.usabilityPercentage;
        updatedLine.pcsPerPound = match.pcsPerPound !== undefined ? match.pcsPerPound : updatedLine.pcsPerPound;
      } else if (action === "create") {
        if (!updatedLine.registeredPackSize) {
          updatedLine.unit = "";
          updatedLine.needsPackSizeRegistration = true;
        }
      }

      itemsCopy[index] = updatedLine;
      return { ...q, items: itemsCopy };
    }));
  };

  const updateItemTargetId = (index: number, id: string) => {
    if (!activeQueueId) return;
    const match = existingIngredients.find(ing => ing.id === id);
    const currentItem = activeItem?.items?.[index];

    // If the invoice item name differs from the selected master ingredient name,
    // automatically save it to the Naming Match Table so future invoices match automatically!
    if (
      match &&
      currentItem?.name &&
      currentItem.name.trim() &&
      currentItem.name.toLowerCase().trim() !== match.name.toLowerCase().trim()
    ) {
      const cleanAlias = currentItem.name.trim();
      saveNamingMatchToStorage(cleanAlias, match.id);
      const existingAliases = Array.isArray(match.invoiceAliases) ? match.invoiceAliases : [];
      if (!existingAliases.some(a => a.toLowerCase().trim() === cleanAlias.toLowerCase())) {
        safeUpdateDoc("ingredients", match.id, {
          ...match,
          invoiceAliases: [...existingAliases, cleanAlias],
          updatedAt: new Date().toISOString(),
        }).catch(err => console.warn("Could not save invoice alias to ingredient doc:", err));
      }
    }

    setQueue(prev => prev.map(q => {
      if (q.id !== activeQueueId) return q;
      const itemsCopy = [...q.items];
      const updatedLine = {
        ...itemsCopy[index],
        targetIngredientId: id,
        matchAction: "map" as const,
        matchedViaAlias: Boolean(
          match &&
          itemsCopy[index].name &&
          itemsCopy[index].name.toLowerCase().trim() !== match.name.toLowerCase().trim()
        ),
      };

      if (match) {
        const packInfo = getRegisteredPackSize(match);
        updatedLine.baseUnit = packInfo.baseUnit;
        if (packInfo.hasRegisteredPackSize) {
          updatedLine.unit = packInfo.packSizeUnit;
          updatedLine.packagingUnit = packInfo.displayPackUnit;
          updatedLine.registeredPackSize = packInfo.description || packInfo.displayPackUnit;
          updatedLine.unitMatchedToPackSize = !updatedLine.originalDocUnit || updatedLine.originalDocUnit.toLowerCase() !== packInfo.packSizeUnit;
          updatedLine.needsPackSizeRegistration = false;
        } else {
          updatedLine.unit = match.unit || "";
          updatedLine.registeredPackSize = undefined;
          updatedLine.unitMatchedToPackSize = false;
          updatedLine.needsPackSizeRegistration = !match.unit;
        }
        updatedLine.weightPerCase = match.weightPerCase !== undefined ? match.weightPerCase : updatedLine.weightPerCase;
        updatedLine.weightPerCaseUnit = match.weightPerCaseUnit || updatedLine.weightPerCaseUnit || "lb";
        updatedLine.usabilityPercentage = match.usabilityPercentage !== undefined ? match.usabilityPercentage : updatedLine.usabilityPercentage;
        updatedLine.pcsPerPound = match.pcsPerPound !== undefined ? match.pcsPerPound : updatedLine.pcsPerPound;
      }

      itemsCopy[index] = updatedLine;
      return { ...q, items: itemsCopy };
    }));
  };

  // Selection toggle handlers
  const toggleSelectAll = () => {
    if (!activeItem) return;
    if (selectedIndices.length === activeItem.items.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(activeItem.items.map((_, idx) => idx));
    }
  };

  const selectPriceChangesOnly = () => {
    if (!activeItem) return;
    const changeIndices = activeItem.items
      .map((item, idx) => {
        const comp = getItemPriceComparison(item);
        return (comp.isIncrease || comp.isDecrease || !comp.matchedIng) ? idx : -1;
      })
      .filter(idx => idx !== -1);
    setSelectedIndices(changeIndices);
  };

  const toggleItemSelection = (index: number) => {
    setSelectedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Check if invoice is duplicate
  const isDuplicateInvoice = activeItem?.vendor && activeItem?.invoiceNumber && activeItem?.date ? existingInvoices.some(inv => {
    const v1 = (inv.vendor || "").toLowerCase().replace(/\s+/g, " ").trim();
    const v2 = activeItem.vendor.toLowerCase().replace(/\s+/g, " ").trim();
    const i1 = (inv.invoiceNumber || "").toLowerCase().replace(/\s+/g, " ").replace(/^#/, "").trim();
    const i2 = activeItem.invoiceNumber.toLowerCase().replace(/\s+/g, " ").replace(/^#/, "").trim();
    const d1 = (inv.issueDate || "").trim();
    const d2 = activeItem.date.trim();
    return v1 === v2 && i1 === i2 && d1 === d2;
  }) : false;

  // Resolve parsed item unit/pack size before applying to catalog
  const resolveItemForApply = (item: ParsedInvoiceItem) => {
    if (item.itemTargetType === "industrial") {
      const matchedInd =
        (item.targetIndustrialId
          ? industrialProducts.find((p) => p.id === item.targetIndustrialId)
          : undefined) ||
        industrialProducts.find(
          (p) =>
            p.name &&
            item.name &&
            p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
        );
      const rawDocU =
        item.originalDocUnit && item.originalDocUnit !== "No unit in document"
          ? item.originalDocUnit.trim()
          : "";
      const indRatio = Number(
        item.pcsPerPound || matchedInd?.pcsPerPack || matchedInd?.pcsPerPound || 0
      );
      const resolvedPkgUnit =
        item.packagingUnit ||
        matchedInd?.packagingUnit ||
        (item.unit && item.unit.toLowerCase() !== "pc"
          ? item.unit.charAt(0).toUpperCase() + item.unit.slice(1)
          : rawDocU || "Case");
      const resolvedUnit = (resolvedPkgUnit || "case").toLowerCase();
      const resolvedRegPack =
        item.registeredPackSize ||
        matchedInd?.registeredPackSize ||
        (indRatio > 0 ? `${indRatio}pc per ${resolvedUnit}` : resolvedPkgUnit);
      return {
        resolvedItem: {
          ...item,
          itemTargetType: "industrial" as const,
          baseUnit: "pc" as const,
          unit: resolvedUnit,
          packagingUnit: resolvedPkgUnit,
          pcsPerPound: indRatio > 0 ? indRatio : undefined,
          registeredPackSize: resolvedRegPack,
          conversions: item.conversions || matchedInd?.conversions,
          needsPackSizeRegistration: false,
          targetIndustrialId: item.targetIndustrialId || matchedInd?.id || "",
          matchAction:
            item.matchAction === "skip"
              ? ("skip" as const)
              : matchedInd?.id
              ? ("map" as const)
              : item.matchAction || ("create" as const),
        },
        hasExplicitOrCatalogUnit: true,
      };
    }

    const matched =
      (item.targetIngredientId
        ? existingIngredients.find((ing) => ing.id === item.targetIngredientId)
        : undefined) ||
      existingIngredients.find(
        (ing) =>
          ing.name &&
          item.name &&
          ing.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      ) ||
      findIngredientMatchForInvoiceItem(item.name || "", existingIngredients).match;
    const packInfo = getRegisteredPackSize(matched);
    const rawDocU =
      item.originalDocUnit && item.originalDocUnit !== "No unit in document"
        ? item.originalDocUnit.trim().toLowerCase()
        : "";
    const resolvedUnit =
      item.unit ||
      (packInfo.hasRegisteredPackSize ? packInfo.packSizeUnit : "") ||
      matched?.unit ||
      (item.packagingUnit ? item.packagingUnit.toLowerCase() : "") ||
      rawDocU ||
      "box";
    const resolvedPackagingUnit =
      item.packagingUnit ||
      (packInfo.hasRegisteredPackSize ? packInfo.displayPackUnit : "") ||
      matched?.packagingUnit ||
      (resolvedUnit ? resolvedUnit.charAt(0).toUpperCase() + resolvedUnit.slice(1) : "Box");
    const resolvedRegisteredPackSize =
      item.registeredPackSize ||
      (packInfo.hasRegisteredPackSize ? packInfo.description || packInfo.displayPackUnit : "") ||
      resolvedPackagingUnit;

    return {
      resolvedItem: {
        ...item,
        unit: resolvedUnit,
        baseUnit: item.baseUnit || packInfo.baseUnit || (matched ? normalizeBaseUnit(matched.unit, matched) : "lb"),
        packagingUnit: resolvedPackagingUnit,
        registeredPackSize: resolvedRegisteredPackSize,
        weightPerCase: item.weightPerCase ?? packInfo.weightPerCase ?? matched?.weightPerCase,
        weightPerCaseUnit: item.weightPerCaseUnit || packInfo.weightPerCaseUnit || matched?.weightPerCaseUnit || "lb",
        pcsPerPound: item.pcsPerPound ?? packInfo.pcsPerPound ?? matched?.pcsPerPound,
        needsPackSizeRegistration: false,
        targetIngredientId: item.targetIngredientId || matched?.id || "",
        matchAction: item.matchAction === "skip" ? ("skip" as const) : (matched?.id ? ("map" as const) : (item.matchAction || ("create" as const))),
      },
      hasExplicitOrCatalogUnit: Boolean(
        item.registeredPackSize ||
        item.unit ||
        packInfo.hasRegisteredPackSize ||
        matched?.unit ||
        rawDocU ||
        preserveStockCounts
      ),
    };
  };

  // Apply active document to catalog
  const handleApplyActiveItem = async (forceDuplicate: boolean = false) => {
    if (!activeItem || activeItem.status !== "parsed" || isApplying) return;

    // When preserving on-hand stock counts (price correction mode), allow applying price updates even if an invoice number was seen before
    if (isDuplicateInvoice && !forceDuplicate && !preserveStockCounts) {
      setShowDuplicatePrompt(true);
      return;
    }

    try {
      setIsApplying(true);
      setErrorMsg("");

      // Check if any selected item genuinely lacks any unit/pack size when piling physical stock
      if (!preserveStockCounts) {
        const unregisteredItemEntry = activeItem.items
          .map((item, idx) => ({ item, idx, resolved: resolveItemForApply(item) }))
          .find(
            ({ item, idx, resolved }) =>
              selectedIndices.includes(idx) &&
              item.matchAction !== "skip" &&
              !resolved.hasExplicitOrCatalogUnit
          );

        if (unregisteredItemEntry) {
          setErrorMsg(
            `Package Size Registration Required: "${unregisteredItemEntry.item.name}" does not have a registered package size. Please register its package size in the modal.`
          );
          openPackSizeModal(unregisteredItemEntry.idx, unregisteredItemEntry.item);
          setIsApplying(false);
          return;
        }
      }

      // Filter by selected indices; unselected are skipped
      const itemsToApply = activeItem.items.map((item, idx) => {
        const isSelected = selectedIndices.includes(idx);
        const { resolvedItem } = resolveItemForApply(item);
        return {
          action: isSelected ? (resolvedItem.matchAction || "create") : ("skip" as const),
          parsedItem: resolvedItem,
          targetIngredientId: resolvedItem.targetIngredientId
        };
      });

      const appliedCount = itemsToApply.filter(i => i.action !== "skip").length;
      if (appliedCount === 0) {
        setErrorMsg("Please select at least one line item to apply.");
        setIsApplying(false);
        return;
      }

      const isPriceCorr = preserveStockCounts;

      const fileAttachment = activeItem.fileDataUrl ? {
        fileUrl: activeItem.fileDataUrl,
        fileType: activeItem.fileType || "application/octet-stream",
        fileSize: activeItem.fileSize || 0
      } : undefined;

      await onApplyParsedItems(
        itemsToApply, 
        activeItem.vendor || "Vendor", 
        activeItem.invoiceNumber || (isPriceCorr ? "PRICE-CORR" : "INV"), 
        activeItem.date || new Date().toLocaleDateString(), 
        activeItem.file?.name || activeItem.fileName,
        isPriceCorr,
        fileAttachment
      );

      const msg = isPriceCorr 
        ? `Applied price corrections for ${appliedCount} items from "${activeItem.fileName}"! Catalog rates and recipe margins synchronized with on-hand stock counts preserved.`
        : `Applied invoice #${activeItem.invoiceNumber} (${activeItem.vendor}) for ${appliedCount} items! Stock counts and rates updated.`;
      
      setSuccessMsg(msg);
      setShowDuplicatePrompt(false);

      // Remove applied invoice from batch queue, assign next or navigate to Ingredient Prices catalog
      const remainingQueue = queue.filter(q => q.id !== activeItem.id);
      const nextParsed = remainingQueue.find(q => q.status === "parsed") || remainingQueue[0];
      setQueue(remainingQueue);
      setActiveQueueId(nextParsed?.id || null);

      const nonSkippedApplied = itemsToApply.filter(i => i.action !== "skip");
      const allIndustrial =
        nonSkippedApplied.length > 0 &&
        nonSkippedApplied.every(i => i.parsedItem.itemTargetType === "industrial");

      if (allIndustrial && onNavigateToIndustrial) {
        setTimeout(() => {
          onNavigateToIndustrial();
        }, 350);
      } else if (onNavigateToCatalog) {
        setTimeout(() => {
          onNavigateToCatalog();
        }, 350);
      }

    } catch (err: any) {
      console.error("Apply Active Item error:", err);
      setErrorMsg(err.message || "Error applying corrections to database.");
    } finally {
      setIsApplying(false);
    }
  };

  // Bulk Apply ALL ready documents in queue
  const handleApplyAllReady = async () => {
    const readyItems = queue.filter(q => q.status === "parsed");
    if (readyItems.length === 0) return;

    // Enforce registered package size across all ready items when piling physical stock
    if (!preserveStockCounts) {
      for (const qItem of readyItems) {
        const missingIdx = qItem.items.findIndex(
          (ai) =>
            ai.matchAction !== "skip" &&
            !resolveItemForApply(ai).hasExplicitOrCatalogUnit
        );
        if (missingIdx !== -1) {
          const missingItem = qItem.items[missingIdx];
          setActiveQueueId(qItem.id);
          setErrorMsg(
            `Package Size Registration Required in "${qItem.fileName}": "${missingItem.name}" does not have a registered package size. Please register its package size before applying.`
          );
          openPackSizeModal(missingIdx, missingItem);
          return;
        }
      }
    }

    setParsingAll(true);
    setErrorMsg("");
    setSuccessMsg("");
    let appliedCount = 0;

    const isPriceCorr = preserveStockCounts;

    try {
      for (const item of readyItems) {
        const itemsToApply = item.items.map(ai => {
          const { resolvedItem } = resolveItemForApply(ai);
          return {
            action: resolvedItem.matchAction || "create",
            parsedItem: resolvedItem,
            targetIngredientId: resolvedItem.targetIngredientId
          };
        });

        const fileAttachment = item.fileDataUrl ? {
          fileUrl: item.fileDataUrl,
          fileType: item.fileType || "application/octet-stream",
          fileSize: item.fileSize || 0
        } : undefined;

        await onApplyParsedItems(
          itemsToApply, 
          item.vendor || "Vendor", 
          item.invoiceNumber || (isPriceCorr ? "PRICE-BATCH" : "INV-BATCH"), 
          item.date || new Date().toLocaleDateString(), 
          item.file?.name || item.fileName,
          isPriceCorr,
          fileAttachment
        );
        appliedCount++;
      }

      setSuccessMsg(`Successfully batch applied all ${appliedCount} ready document(s)! ${isPriceCorr ? "Master prices & recipe food costs synchronized with inventory stock preserved." : "Inventory & recipes updated."}`);
      
      const remainingQueue = queue.filter(q => q.status !== "parsed");
      setQueue(remainingQueue);
      setActiveQueueId(remainingQueue[0]?.id || null);

      if (onNavigateToCatalog) {
        setTimeout(() => {
          onNavigateToCatalog();
        }, 400);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Applied ${appliedCount} documents before encountering error: ${err.message || err}`);
    } finally {
      setParsingAll(false);
    }
  };

  // Queue counts
  const pendingCount = queue.filter(q => q.status === "pending").length;
  const parsingCount = queue.filter(q => q.status === "parsing").length;
  const parsedCount = queue.filter(q => q.status === "parsed").length;
  const failedCount = queue.filter(q => q.status === "failed").length;

  // Filter items in active table
  const filteredActiveItems = useMemo(() => {
    if (!activeItem || !activeItem.items) return [];
    return activeItem.items.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => {
      const comp = getItemPriceComparison(item);
      if (priceFilter === "increases") return comp.isIncrease;
      if (priceFilter === "decreases") return comp.isDecrease;
      if (priceFilter === "changes") return comp.isIncrease || comp.isDecrease;
      if (priceFilter === "mapped") return !!comp.matchedIng;
      if (priceFilter === "unmapped") return !comp.matchedIng;
      return true;
    });
  }, [activeItem, priceFilter, existingIngredients]);

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm" id="ai-batch-parser-view">
      {/* Top Header & Mode Toggle Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-neutral-100 pb-5">
        <div className="text-left max-w-2xl">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2 tracking-tight">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              AI Batch Document Parser
            </h2>
          </div>
          <p className="text-neutral-500 text-[13px] mt-1 leading-relaxed">
            Extract line items from delivery invoices, match invoice item names to your master catalog, and update rates using strict <strong>lb</strong> or <strong>pc</strong> Base Units and Package Units.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Default Upload Destination Selector */}
          <div className="inline-flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-2.5">
              Target Tab:
            </span>
            <button
              type="button"
              onClick={() => {
                setDefaultUploadTarget("ingredient");
                if (activeQueueId) handleSwitchDocumentTargetType("ingredient");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                (activeItem?.defaultTargetType || defaultUploadTarget) !== "industrial"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Ingredient</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDefaultUploadTarget("industrial");
                if (activeQueueId) handleSwitchDocumentTargetType("industrial");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                (activeItem?.defaultTargetType || defaultUploadTarget) === "industrial"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Industrial Products</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNamingMatchModal(true)}
            className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all font-bold text-xs shadow-2xs cursor-pointer"
            title="Open Naming Match Table to map Invoice Item Names to Master Ingredient Names"
          >
            <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
            <span>Naming Match Table</span>
          </button>
        </div>
      </div>

      {/* Queue Stats Bar */}
      {queue.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-neutral-50 p-3 rounded-xl border border-neutral-200 mb-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">Queue Status:</span>
            <span className="font-bold text-neutral-900">{queue.length} Documents</span>
            <span className="text-neutral-300">|</span>
            <span className="font-bold text-amber-700">{pendingCount} Pending</span>
            <span className="text-neutral-300">|</span>
            <span className="font-bold text-blue-700">{parsingCount} Parsing</span>
            <span className="text-neutral-300">|</span>
            <span className="font-bold text-emerald-700">{parsedCount} Ready to Apply</span>
            {failedCount > 0 && (
              <>
                <span className="text-neutral-300">|</span>
                <span className="font-bold text-red-700">{failedCount} Failed</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {parsingAll && (
              <button
                onClick={handleCancelParsing}
                className="bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Parsing</span>
              </button>
            )}
            {pendingCount > 0 && !parsingAll && (
              <button
                onClick={handleParseAll}
                disabled={isReadOnly}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Parse All Pending ({pendingCount})</span>
              </button>
            )}
            {parsedCount > 0 && (
              <button
                onClick={handleApplyAllReady}
                disabled={parsingAll || isReadOnly}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                <span>Batch Apply All ({parsedCount})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Drag & Drop Zone when queue is empty */}
      {queue.length === 0 && (
        <div className="max-w-4xl mx-auto w-full mb-8 mt-2">
          <div
            onDragEnter={isReadOnly ? undefined : handleDrag}
            onDragOver={isReadOnly ? undefined : handleDrag}
            onDragLeave={isReadOnly ? undefined : handleDrag}
            onDrop={isReadOnly ? undefined : handleDrop}
            className={`border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-all duration-200 ${
              isReadOnly
                ? "border-neutral-300 bg-neutral-50 cursor-not-allowed opacity-60"
                : dragActive 
                ? "border-emerald-500 bg-emerald-50 scale-[1.01]" 
                : "border-neutral-300 hover:border-emerald-400 hover:bg-emerald-50/20 bg-neutral-50/50"
            }`}
          >
            <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center bg-white shadow-sm border border-neutral-200 text-emerald-600">
              <Upload className="h-8 w-8 text-emerald-600" strokeWidth={1.75} />
            </div>
            
            <h3 className="text-xl font-bold text-neutral-900 mb-1.5 tracking-tight">
              Drag & drop vendor invoices or delivery receipts
            </h3>
            <p className="text-neutral-500 text-xs mb-6 font-medium">
              Supports PDF, PNG, JPG, CSV, XLSX, and TXT files for batch OCR extraction
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.csv,.txt,.tsv,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={isReadOnly}
              className="hidden"
            />
            
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isReadOnly}
                className="px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <FolderOpen className="w-4 h-4" /> Select Document Files
              </button>
              <button 
                onClick={() => setShowCamera(true)}
                disabled={isReadOnly}
                className="px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-emerald-600" /> Camera OCR Scan
              </button>
            </div>
            
            <div className="mt-6 flex items-center gap-2 text-[11px] text-neutral-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure processing. Master catalog and recipe margins update automatically.
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="p-4 rounded-xl border border-neutral-200 bg-white text-left shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 font-bold">
                <Tag className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-neutral-900">Price Variance Audit</h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Automatically identifies cost increases, vendor savings, and contract rate variations per unit.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200 bg-white text-left shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2 font-bold">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-neutral-900">Live Menu Margin Recalc</h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Instantly tracks which recipes utilize modified ingredients and updates target profit margins.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200 bg-white text-left shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-2 font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-neutral-900">Zero Stock Inflation</h4>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Price correction mode safely updates rates without altering physical on-hand inventory counts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Batch Workspace: Queue Sidebar + Review Table */}
      {queue.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 w-full">
          {/* Left Column: Batch Queue Navigation */}
          <div className="xl:col-span-2 border-b xl:border-b-0 xl:border-r border-neutral-200/80 pb-4 xl:pb-0 xl:pr-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Queued Files</span>
              <div className="flex gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                  title="Add more files"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.csv,.txt,.tsv,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              disabled={isReadOnly}
              className="hidden"
            />

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {queue.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveQueueId(item.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border text-left relative group ${
                    activeQueueId === item.id
                      ? "bg-white border-emerald-500 shadow-sm ring-1 ring-emerald-500/30"
                      : "bg-neutral-50/60 border-neutral-200/80 hover:border-neutral-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 overflow-hidden">
                      {item.status === "pending" && <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                      {item.status === "parsing" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0 mt-0.5" />}
                      {item.status === "parsed" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                      {item.status === "failed" && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                      
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${activeQueueId === item.id ? "text-neutral-900" : "text-neutral-700"}`}>
                          {item.fileName}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-neutral-500 truncate mt-0.5">
                          <span>{item.vendor || "Pending vendor"}</span>
                          {item.items.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-mono font-bold text-neutral-700">{item.items.length} items</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {(item.status === "pending" || item.status === "failed") && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveQueueId(item.id);
                            handleExtractSingleItem(item);
                          }}
                          disabled={isReadOnly}
                          className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200 transition-colors cursor-pointer"
                          title="Extract Document"
                        >
                          Extract
                        </button>
                      )}
                      <button
                        onClick={(e) => handleRemoveFromQueue(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 p-1 rounded-md transition-opacity cursor-pointer"
                        title="Remove from batch"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Active Document Review & Price Correction Controls */}
          <div className="xl:col-span-10 min-w-0">
            {(() => {
              const activeDocumentNode = activeItem ? (
                <div
                  className={
                    isFullscreen
                      ? "fixed inset-0 w-screen h-screen z-[99999] bg-white overflow-y-auto p-4 sm:p-6"
                      : "border border-neutral-200 p-5 sm:p-6 rounded-2xl relative bg-white shadow-sm min-h-[560px] w-full"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-neutral-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                      <span className="text-sm font-bold text-neutral-900">
                        Active Document Workspace: {activeItem.fileName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
                        isFullscreen
                          ? "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800 shadow-sm"
                          : "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 shadow-2xs"
                      }`}
                      title={isFullscreen ? "Exit Full Screen" : "Expand to Real Full Screen"}
                    >
                      {isFullscreen ? (
                        <>
                          <Minimize className="w-4 h-4" />
                          <span>Exit Full Screen</span>
                        </>
                      ) : (
                        <>
                          <Maximize className="w-4 h-4 text-emerald-700" />
                          <span>Full Screen View</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Pending State */}
                  {activeItem.status === "pending" && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <Sparkles className="h-10 w-10 text-amber-500 mb-3 animate-pulse" />
                      <p className="text-sm font-bold text-neutral-800">Ready to Parse: {activeItem.fileName}</p>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm">Click "Extract & Audit Document" below to run OCR extraction.</p>
                      <button
                        onClick={() => handleExtractSingleItem(activeItem)}
                        disabled={isReadOnly}
                        className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                      >
                        <Sparkles className="w-4 h-4" /> Extract & Audit Document
                      </button>
                    </div>
                  )}

                  {/* Failed State */}
                  {activeItem.status === "failed" && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                      <p className="text-sm font-bold text-neutral-800">Extraction Failed: {activeItem.fileName}</p>
                      <div className="text-xs text-red-700 mt-2 max-w-md font-mono bg-red-50 p-3 rounded-xl border border-red-200 text-left">
                        <span className="font-bold block mb-1">Details:</span>
                        {activeItem.error || "Unable to extract items from this document. Please check the document format or try again."}
                      </div>
                      <button
                        onClick={() => handleExtractSingleItem(activeItem)}
                        disabled={isReadOnly}
                        className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                      >
                        <RefreshCw className="w-4 h-4" /> Retry Extract & Audit Document
                      </button>
                    </div>
                  )}

                  {/* Parsing State */}
                  {activeItem.status === "parsing" && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <Loader2 className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
                      <h3 className="text-base font-bold text-neutral-900">Analyzing Document with AI...</h3>
                      <p className="text-xs text-neutral-500 font-mono mt-1">Extracting line items and unit prices from {activeItem.fileName}</p>
                      <button
                        onClick={handleCancelParsing}
                        className="mt-6 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <X className="w-4 h-4" /> Cancel Parsing
                      </button>
                    </div>
                  )}

                  {/* Parsed & Ready for Audit / Price Correction */}
                  {activeItem.status === "parsed" && (
                    <div className="space-y-6 text-left">
                      {/* Document Overview Metadata */}
                      <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl space-y-3">
                        <div className="flex flex-wrap justify-between items-center gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-xs font-bold text-neutral-900">
                              Active Document: {activeItem.fileName}
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                              {activeItem.items.length} Line Items Extracted
                            </span>
                          </div>

                          {/* Document-level Destination Toggle (Ingredient vs Industrial Products) */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center bg-white p-1 rounded-xl border border-neutral-300 shadow-2xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 px-2">
                                Store In:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSwitchDocumentTargetType("ingredient")}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                  (activeItem.defaultTargetType || "ingredient") !== "industrial"
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "text-neutral-600 hover:bg-neutral-100"
                                }`}
                              >
                                <UtensilsCrossed className="w-3.5 h-3.5" />
                                <span>Ingredient</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSwitchDocumentTargetType("industrial")}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                  activeItem.defaultTargetType === "industrial"
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-neutral-600 hover:bg-neutral-100"
                                }`}
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Industrial Products</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="text-[10px] font-bold text-neutral-500 block">Vendor / Supplier:</label>
                            <div className="mt-1 space-y-1">
                              <select 
                                value={supplierList.includes(activeItem.vendor) ? activeItem.vendor : (activeItem.vendor ? "__custom__" : "")} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== "__custom__") {
                                    setQueue(prev => prev.map(q => q.id === activeItem.id ? { ...q, vendor: val } : q));
                                  }
                                }}
                                className="font-bold text-neutral-900 block w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-xs cursor-pointer" 
                              >
                                <option value="">-- Select from Registered Suppliers --</option>
                                {supplierList.map(sup => (
                                  <option key={sup} value={sup}>{sup}</option>
                                ))}
                                {activeItem.vendor && !supplierList.includes(activeItem.vendor) && (
                                  <option value="__custom__">{activeItem.vendor} (Detected)</option>
                                )}
                              </select>
                              {activeItem.vendor && !supplierList.includes(activeItem.vendor) && (
                                <div className="flex items-center justify-between text-[10px] bg-amber-50 text-amber-900 px-2 py-1 rounded border border-amber-200">
                                  <span className="truncate">Not in suppliers: <strong>{activeItem.vendor}</strong></span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await safeAddDoc("vendors", {
                                          name: activeItem.vendor.trim(),
                                          ownerId: userId || "default",
                                          createdAt: new Date().toISOString(),
                                          isRegistered: true
                                        });
                                        setSuccessMsg(`Added "${activeItem.vendor}" to registered suppliers!`);
                                      } catch (err) {
                                        console.error("Failed to add vendor:", err);
                                      }
                                    }}
                                    className="font-bold text-emerald-700 hover:text-emerald-800 underline ml-2 shrink-0 cursor-pointer"
                                  >
                                    + Add
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-neutral-500 block">Reference # / Notice ID:</label>
                            <input 
                              type="text" 
                              value={activeItem.invoiceNumber} 
                              onChange={(e) => {
                                setQueue(prev => prev.map(q => q.id === activeItem.id ? { ...q, invoiceNumber: e.target.value } : q));
                              }}
                              className="font-bold text-neutral-900 mt-1 block w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-xs" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-neutral-500 block">Effective Date:</label>
                            <input 
                              type="date" 
                              value={formatToDateInputValue(activeItem.date)} 
                              onChange={(e) => {
                                setQueue(prev => prev.map(q => q.id === activeItem.id ? { ...q, date: e.target.value } : q));
                              }}
                              className="font-bold text-neutral-900 mt-1 block w-full bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-xs cursor-pointer" 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Saved Source Document & Archive Status */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {activeItem.fileDataUrl && isImageFile(activeItem.fileType, activeItem.fileName) ? (
                            <button
                              type="button"
                              onClick={() => setPreviewModalItem(activeItem)}
                              className="w-12 h-12 rounded-lg border border-emerald-300 overflow-hidden shrink-0 bg-white shadow-2xs hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer relative group"
                              title="Click to zoom / preview image"
                            >
                              <img
                                src={activeItem.fileDataUrl}
                                alt="Source invoice"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                              <FileText className="w-6 h-6" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-900 truncate max-w-xs">
                                {activeItem.fileName}
                              </span>
                              {activeItem.fileSize ? (
                                <span className="text-[10px] text-neutral-500 font-mono">
                                  ({formatFileSize(activeItem.fileSize)})
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-emerald-800 flex items-center gap-1.5 mt-0.5 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Original document will be saved permanently to your Invoices archive upon applying.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {activeItem.fileDataUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewModalItem(activeItem)}
                              className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              Preview Document
                            </button>
                          )}
                          {activeItem.fileDataUrl && (
                            <button
                              type="button"
                              onClick={() => downloadFile(activeItem.fileDataUrl!, activeItem.fileName)}
                              className="p-1.5 text-neutral-600 hover:text-emerald-700 hover:bg-white border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                              title="Download document"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Price Variance Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl">
                          <div className="flex items-center justify-between text-red-700 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Price Increases</span>
                            <TrendingUp className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-lg font-bold text-red-900 font-mono">{activeStats.increases} Items</div>
                          <div className="text-[10px] text-red-700 font-medium">
                            {activeStats.increases > 0 ? `+${activeStats.avgIncrease.toFixed(1)}% avg hike` : "No price hikes"}
                          </div>
                        </div>

                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                          <div className="flex items-center justify-between text-emerald-700 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Price Savings</span>
                            <TrendingDown className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-lg font-bold text-emerald-900 font-mono">{activeStats.decreases} Items</div>
                          <div className="text-[10px] text-emerald-700 font-medium">
                            {activeStats.decreases > 0 ? `-${activeStats.avgDecrease.toFixed(1)}% avg savings` : "No price drops"}
                          </div>
                        </div>

                        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                          <div className="flex items-center justify-between text-neutral-600 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Stable Rates</span>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-lg font-bold text-neutral-900 font-mono">{activeStats.unchanged} Items</div>
                          <div className="text-[10px] text-neutral-500 font-medium">0.0% variance</div>
                        </div>

                        <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                          <div className="flex items-center justify-between text-purple-700 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Menu Impact</span>
                            <UtensilsCrossed className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-lg font-bold text-purple-900 font-mono">{activeStats.impactedRecipesCount} Recipes</div>
                          <div className="text-[10px] text-purple-700 font-medium">Margins recalculated</div>
                        </div>
                      </div>

                      {/* Filter Bar & Quick Select Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-neutral-400 text-[11px] font-bold mr-1 flex items-center gap-1">
                            <Filter className="w-3 h-3" /> Filter:
                          </span>
                          <button
                            type="button"
                            onClick={() => setPriceFilter("all")}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                              priceFilter === "all" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                            }`}
                          >
                            All ({activeItem.items.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPriceFilter("changes")}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                              priceFilter === "changes" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                            }`}
                          >
                            ⚡ Price Changes ({activeStats.increases + activeStats.decreases})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPriceFilter("increases")}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                              priceFilter === "increases" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            📈 Increases ({activeStats.increases})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPriceFilter("decreases")}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                              priceFilter === "decreases" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            📉 Savings ({activeStats.decreases})
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={handleApplyAllAiCategories}
                            className="text-indigo-700 hover:text-indigo-900 font-bold px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer flex items-center gap-1 border border-indigo-200"
                            title="Apply AI-recommended food category to every item in this document"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Apply All AI Categories
                          </button>
                          <button
                            type="button"
                            onClick={handleAddNewRow}
                            className="text-emerald-700 hover:text-emerald-900 font-bold px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer flex items-center gap-1 border border-emerald-200"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Line Item
                          </button>
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-neutral-600 hover:text-neutral-900 font-bold px-2 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors cursor-pointer"
                          >
                            {selectedIndices.length === activeItem.items.length ? "Deselect All" : "Select All"}
                          </button>
                          <button
                            type="button"
                            onClick={selectPriceChangesOnly}
                            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                          >
                            Select Changes Only
                          </button>
                        </div>
                      </div>

                      {/* Missing Pack Size Alert Notice if any culinary ingredient items need registration */}
                      {activeItem?.items && activeItem.items.some(i => i.itemTargetType !== "industrial" && (i.needsPackSizeRegistration || (!i.unit && !i.registeredPackSize))) && (
                        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                              ⚠️
                            </div>
                            <div>
                              <p className="font-bold text-sm text-amber-950">Missing Registered Pack Size Notice</p>
                              <p className="text-amber-800 text-xs mt-0.5">
                                The unit always has to match with what you registered as the pack size (e.g. <strong>Box</strong>, <strong>Case</strong>, etc.). Items below without a registered pack size need to be registered so your catalog units stay 100% consistent!
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {activeItem.items.map((it, idx) => {
                              if (it.itemTargetType === "industrial") return null;
                              if (!it.needsPackSizeRegistration && (it.unit || it.registeredPackSize)) return null;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => openPackSizeModal(idx, it)}
                                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                  <span>+ Register {it.name ? (it.name.length > 14 ? it.name.slice(0, 14) + "..." : it.name) : `Item #${idx + 1}`} Pack Size</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Items Verification & Price Correction Table */}
                      <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-md bg-white">
                        <div className={`overflow-x-auto overflow-y-auto ${isFullscreen ? "min-h-[65vh]" : "min-h-[560px] max-h-[82vh]"}`}>
                          <table className="min-w-full divide-y divide-neutral-200 text-sm text-neutral-900 bg-white">
                            <thead className="bg-neutral-100/90 text-neutral-700 font-bold text-xs uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                              <tr>
                                <th className="px-4 py-4 w-12 text-center">
                                  <input 
                                    type="checkbox"
                                    checked={activeItem.items.length > 0 && selectedIndices.length === activeItem.items.length}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                                  />
                                </th>
                                <th className="px-5 py-4 text-left min-w-[220px]">Document Item Name</th>
                                <th className="px-4 py-4 text-left min-w-[210px]">Food Category (AI Recommended)</th>
                                <th className="px-4 py-4 text-right w-32">Total Cost ($)</th>
                                <th className="px-4 py-4 text-left w-40">Pkg Qty / Unit</th>
                                <th className="px-4 py-4 text-right w-32">New Unit Rate</th>
                                <th className="px-4 py-4 text-right w-32">Current Master Rate</th>
                                <th className="px-4 py-4 text-center w-40">Price Delta / Variance</th>
                                <th className="px-5 py-4 text-left min-w-[180px]">Recipe Impact</th>
                                <th className="px-5 py-4 text-left min-w-[240px]">Matched Catalog Item</th>
                                <th className="px-4 py-4 text-center w-32">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-150">
                              {filteredActiveItems.map(({ item, originalIndex }) => {
                                const comp = getItemPriceComparison(item);
                                const isSelected = selectedIndices.includes(originalIndex);
                                const impactedRecipes = getImpactedRecipes(comp.matchedIng?.id, comp.matchedIng?.name);
                                const aiRecCat = item.aiRecommendedCategory || recommendFoodCategory(item.name || "", item.category);
                                const selectedCategory = item.category || aiRecCat;

                                return (
                                  <tr 
                                    key={originalIndex} 
                                    className={`transition-colors ${
                                      !isSelected 
                                        ? "bg-neutral-50/60 opacity-60" 
                                        : comp.isIncrease 
                                        ? "bg-red-50/30 hover:bg-red-50/50" 
                                        : comp.isDecrease 
                                        ? "bg-emerald-50/30 hover:bg-emerald-50/50" 
                                        : "hover:bg-neutral-50"
                                    }`}
                                  >
                                    {/* Selection Checkbox */}
                                    <td className="px-4 py-4 text-center">
                                      <input 
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleItemSelection(originalIndex)}
                                        className="w-4 h-4 rounded text-emerald-600 cursor-pointer"
                                      />
                                    </td>

                                    {/* Item Name Input + Per-Item Destination Override */}
                                    <td className="px-5 py-4 font-bold">
                                      <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <select
                                            value={item.itemTargetType === "industrial" ? "industrial" : "ingredient"}
                                            onChange={(e) =>
                                              handleSwitchLineItemTargetType(
                                                originalIndex,
                                                e.target.value as "ingredient" | "industrial"
                                              )
                                            }
                                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer shrink-0 ${
                                              item.itemTargetType === "industrial"
                                                ? "bg-blue-50 text-blue-800 border-blue-300"
                                                : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                            }`}
                                            title="Choose destination tab for this item"
                                          >
                                            <option value="ingredient">Ingredient</option>
                                            <option value="industrial">Industrial Product</option>
                                          </select>
                                          <input
                                            type="text"
                                            value={item.name || ""}
                                            placeholder="Item name from document"
                                            onChange={(e) => updateItemField(originalIndex, "name", e.target.value)}
                                            className="bg-neutral-50/80 border border-neutral-200 hover:border-neutral-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden w-full rounded-lg px-2.5 py-1 transition-all font-bold text-sm text-neutral-900 shadow-2xs"
                                          />
                                        </div>

                                        {item.itemTargetType === "industrial" ? (
                                          <div className="flex flex-col gap-1">
                                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-blue-700 font-medium">
                                              <span>Routes to: <strong>Food Cost → Industrial Products</strong></span>
                                              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[10px]">
                                                Base: pc
                                              </span>
                                            </div>
                                            {item.registeredPackSize ? (
                                              <div className="flex items-center gap-1.5 mt-0.5 bg-blue-50 border border-blue-200 text-blue-900 px-2 py-0.5 rounded-lg text-[11px]">
                                                <span className="font-bold">📦 Pack Size:</span>
                                                <span className="font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-blue-300 text-blue-800">
                                                  {item.registeredPackSize}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => openPackSizeModal(originalIndex, item)}
                                                  className="ml-auto text-blue-700 hover:text-blue-950 underline text-[10px] font-bold cursor-pointer shrink-0"
                                                >
                                                  Edit Pack Size
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1.5 mt-0.5">
                                                <button
                                                  type="button"
                                                  onClick={() => openPackSizeModal(originalIndex, item)}
                                                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded text-[10px] shadow-2xs cursor-pointer flex items-center gap-1"
                                                >
                                                  + Add Pack Size (pc per pack)
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <>
                                            {comp.matchedIng && (
                                              <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-xs text-neutral-500 flex items-center gap-1 font-mono">
                                                  Linked to: <strong className="text-neutral-800 font-semibold">{comp.matchedIng.name}</strong>
                                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                                                    Base: {normalizeBaseUnit(comp.matchedIng.unit, comp.matchedIng)}
                                                  </span>
                                                </span>
                                                {(item.matchedViaAlias || (item.name && comp.matchedIng.name && item.name.toLowerCase().trim() !== comp.matchedIng.name.toLowerCase().trim())) && (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold font-mono">
                                                    <Link2 className="w-3 h-3" /> Name Match Rule Active
                                                  </span>
                                                )}
                                              </div>
                                            )}

                                            {/* Pack Size Matching / Missing Notice */}
                                            {item.needsPackSizeRegistration || (!item.unit && !item.registeredPackSize) ? (
                                              <div className="flex items-center gap-1.5 mt-0.5 bg-amber-50 border border-amber-300 text-amber-900 px-2 py-1 rounded-lg text-xs font-semibold">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                <span className="truncate">No pack size registered</span>
                                                <button
                                                  type="button"
                                                  onClick={() => openPackSizeModal(originalIndex, item)}
                                                  className="ml-auto bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-0.5 rounded text-[10px] shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                                >
                                                  + Register Pack Size
                                                </button>
                                              </div>
                                            ) : item.registeredPackSize ? (
                                              <div className="flex items-center gap-1.5 mt-0.5 bg-emerald-50 border border-emerald-200 text-emerald-900 px-2 py-0.5 rounded-lg text-[11px]">
                                                <span className="font-bold flex items-center gap-1">
                                                  <span>📦</span>
                                                  <span>Unit matched to pack size:</span>
                                                </span>
                                                <span className="font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-emerald-300 text-emerald-800">
                                                  {item.registeredPackSize}
                                                </span>
                                                {item.originalDocUnit && item.originalDocUnit.toLowerCase() !== item.unit?.toLowerCase() && (
                                                  <span className="text-neutral-500 font-mono text-[10px] truncate">
                                                    (Doc read: "{item.originalDocUnit}")
                                                  </span>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => openPackSizeModal(originalIndex, item)}
                                                  className="ml-auto text-emerald-700 hover:text-emerald-950 underline text-[10px] font-bold cursor-pointer shrink-0"
                                                >
                                                  Change
                                                </button>
                                              </div>
                                            ) : null}
                                          </>
                                        )}
                                      </div>
                                    </td>

                                    {/* Category Selector + AI Recommendation */}
                                    <td className="px-4 py-4 text-left">
                                      <div className="flex flex-col gap-1.5">
                                        {item.itemTargetType === "industrial" ? (
                                          <select
                                            value={item.category || recommendIndustrialCategory(item.name || "")}
                                            onChange={(e) => updateItemField(originalIndex, "category", e.target.value)}
                                            className="bg-white border border-blue-300 hover:border-blue-500 focus:border-blue-600 focus:outline-hidden rounded-lg px-2.5 py-1.5 text-xs font-bold text-neutral-900 cursor-pointer w-full shadow-2xs"
                                          >
                                            {INDUSTRIAL_CATEGORY_OPTIONS.map((catOpt) => (
                                              <option key={catOpt.value} value={catOpt.value}>
                                                {catOpt.label}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <>
                                            <select
                                              value={selectedCategory}
                                              onChange={(e) => updateItemField(originalIndex, "category", e.target.value)}
                                              className="bg-white border border-neutral-300 hover:border-emerald-500 focus:border-emerald-600 focus:outline-hidden rounded-lg px-2.5 py-1.5 text-xs font-bold text-neutral-900 cursor-pointer w-full shadow-2xs"
                                            >
                                              {FOOD_CATEGORY_OPTIONS.map((catOpt) => (
                                                <option key={catOpt.value} value={catOpt.value}>
                                                  {catOpt.label}
                                                </option>
                                              ))}
                                            </select>
                                            <div className="flex items-center justify-between gap-1 text-[10px]">
                                              <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-semibold">
                                                <Sparkles className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                                <span>AI Rec: <strong>{aiRecCat}</strong></span>
                                              </span>
                                              {selectedCategory !== aiRecCat && (
                                                <button
                                                  type="button"
                                                  onClick={() => updateItemField(originalIndex, "category", aiRecCat)}
                                                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer shrink-0"
                                                  title={`Apply AI recommendation: ${aiRecCat}`}
                                                >
                                                  Use AI
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </td>

                                    {/* Total Cost Input */}
                                    <td className="px-4 py-4 text-right font-mono font-bold">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <span className="text-neutral-400 font-semibold text-sm">$</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={item.totalPrice}
                                          onChange={(e) => updateItemField(originalIndex, "totalPrice", parseFloat(e.target.value) || 0)}
                                          className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm font-bold font-mono text-right w-24 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                        />
                                      </div>
                                    </td>

                                    {/* Pkg Qty, Base Unit (lb | pc | oz), and Registered Pack Size */}
                                    <td className="px-4 py-4 font-mono">
                                      {item.itemTargetType === "industrial" ? (
                                        <div>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <input
                                              type="number"
                                              step="any"
                                              min="0.01"
                                              value={item.quantity}
                                              onChange={(e) => updateItemField(originalIndex, "quantity", parseFloat(e.target.value) || 1)}
                                              className="bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-sm font-bold text-right w-16 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            />
                                            <span className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-2 py-1.5 text-xs font-bold whitespace-nowrap" title="Industrial Products use pc (Piece) as the base unit">
                                              Base: pc
                                            </span>
                                            {item.registeredPackSize ? (
                                              <button
                                                type="button"
                                                onClick={() => openPackSizeModal(originalIndex, item)}
                                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                                title="Click to edit pack size (pc per pack)"
                                              >
                                                <span>📦 {item.registeredPackSize}</span>
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => openPackSizeModal(originalIndex, item)}
                                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer whitespace-nowrap"
                                                title="Add pack size (e.g. 1000 pc per case)"
                                              >
                                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                                <span>Add Pack Size</span>
                                              </button>
                                            )}
                                          </div>
                                          {(() => {
                                            const indRatio = Number(item.pcsPerPound || 0);
                                            const totalPcs = indRatio > 0 ? Number(((Number(item.quantity) || 1) * indRatio).toFixed(2)) : null;
                                            if (!totalPcs) return null;
                                            return (
                                              <div className="text-[10px] text-blue-800 font-mono mt-1 font-semibold flex flex-wrap items-center gap-1">
                                                <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded">
                                                  Total Base: {totalPcs.toLocaleString()}pc (${Number(item.totalPrice || 0).toFixed(2)} / {totalPcs.toLocaleString()}pc)
                                                </span>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      ) : (
                                        <>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <input
                                              type="number"
                                              step="0.1"
                                              value={item.quantity}
                                              onChange={(e) => updateItemField(originalIndex, "quantity", parseFloat(e.target.value) || 1)}
                                              className="bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-sm font-bold text-right w-16 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                            <select
                                              value={item.baseUnit || (comp.matchedIng ? normalizeBaseUnit(comp.matchedIng.unit, comp.matchedIng) : "lb")}
                                              onChange={(e) => updateItemField(originalIndex, "baseUnit", e.target.value as "lb" | "pc" | "oz")}
                                              className="bg-neutral-50 border border-neutral-300 rounded-lg px-2 py-1.5 text-xs font-bold text-neutral-800 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                                              title="Base Unit (Default: lb, or choose pc / oz)"
                                            >
                                              <option value="lb">Base: lb</option>
                                              <option value="pc">Base: pc</option>
                                              <option value="oz">Base: oz</option>
                                            </select>
                                            {item.needsPackSizeRegistration || !item.registeredPackSize || !item.unit ? (
                                              <button
                                                type="button"
                                                onClick={() => openPackSizeModal(originalIndex, item)}
                                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer whitespace-nowrap"
                                                title="Unit must be a registered package size — click to register"
                                              >
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                <span>Register Pack Size</span>
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => openPackSizeModal(originalIndex, item)}
                                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                                title="Registered package size (click to modify)"
                                              >
                                                <span>📦 {item.registeredPackSize}</span>
                                              </button>
                                            )}
                                          </div>
                                          {(() => {
                                            const activeBase = item.baseUnit || (comp.matchedIng ? normalizeBaseUnit(comp.matchedIng.unit, comp.matchedIng) : "lb");
                                            const ratio = activeBase === "pc"
                                              ? (item.pcsPerPound || comp.matchedIng?.pcsPerPound || 0)
                                              : (item.weightPerCase || comp.matchedIng?.weightPerCase || 0);
                                            const totalBase = ratio > 0 ? Number(((Number(item.quantity) || 1) * ratio).toFixed(2)) : null;
                                            if (item.needsPackSizeRegistration || !item.registeredPackSize || !item.unit) {
                                              return (
                                                <div className="text-[10px] text-amber-700 font-sans mt-1 font-semibold">
                                                  Required before applying
                                                </div>
                                              );
                                            }
                                            return (
                                              <div className="text-[10px] text-emerald-800 font-mono mt-1 font-semibold flex flex-wrap items-center gap-1">
                                                <span>✓ {item.registeredPackSize}</span>
                                                {totalBase && totalBase > 0 ? (
                                                  <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded">
                                                    Total Base: {totalBase}{activeBase} (${Number(item.totalPrice || 0).toFixed(2)} / {totalBase}{activeBase})
                                                  </span>
                                                ) : null}
                                              </div>
                                            );
                                          })()}
                                        </>
                                      )}
                                    </td>

                                    {/* New Unit Rate */}
                                    <td className="px-4 py-4 text-right font-mono font-bold text-neutral-900">
                                      <span className="text-sm font-bold">${comp.newUnitPrice.toFixed(2)}</span>
                                      <span className="text-xs text-neutral-400 font-normal">/{item.unit || "unit"}</span>
                                    </td>

                                    {/* Current Master Rate */}
                                    <td className="px-4 py-4 text-right font-mono text-neutral-600">
                                      {comp.oldUnitPrice !== null ? (
                                        <div>
                                          <span className="font-bold text-sm">${comp.oldUnitPrice.toFixed(2)}</span>
                                          <span className="text-xs text-neutral-400">/{comp.matchedIng?.unit || item.unit}</span>
                                        </div>
                                      ) : (
                                        <span className="text-neutral-400 italic text-xs">New item</span>
                                      )}
                                    </td>

                                    {/* Price Delta & Variance Badge */}
                                    <td className="px-4 py-4 text-center">
                                      {comp.oldUnitPrice !== null && comp.diff !== null ? (
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1 rounded-lg ${
                                          comp.isIncrease 
                                            ? "bg-red-100 text-red-800 border border-red-200" 
                                            : comp.isDecrease 
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                                            : "bg-neutral-100 text-neutral-600"
                                        }`}>
                                          {comp.isIncrease && <TrendingUp className="w-3.5 h-3.5 text-red-600" />}
                                          {comp.isDecrease && <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />}
                                          <span>
                                            {comp.diff > 0 ? "+" : ""}${comp.diff.toFixed(2)} ({comp.diff > 0 ? "+" : ""}{comp.percent?.toFixed(1)}%)
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                          + New Catalog Item
                                        </span>
                                      )}
                                    </td>

                                    {/* Recipe Impact Tag */}
                                    <td className="px-5 py-4 text-left">
                                      {item.itemTargetType === "industrial" ? (
                                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                          Industrial Supply
                                        </span>
                                      ) : impactedRecipes.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                          <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md w-max border border-purple-200">
                                            Affects {impactedRecipes.length} Recipe{impactedRecipes.length > 1 ? "s" : ""}
                                          </span>
                                          <span className="text-xs text-neutral-500 truncate max-w-[180px]" title={impactedRecipes.map(r => r.name).join(", ")}>
                                            {impactedRecipes.map(r => r.name).slice(0, 2).join(", ")}
                                            {impactedRecipes.length > 2 ? "..." : ""}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-neutral-400 italic">No menu recipes linked</span>
                                      )}
                                    </td>

                                    {/* Matched Catalog Item Select */}
                                    <td className="px-5 py-4 text-left">
                                      {item.itemTargetType === "industrial" ? (
                                        item.matchAction === "map" ? (
                                          <select
                                            value={item.targetIndustrialId || ""}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const found = industrialProducts.find(p => p.id === val);
                                              updateItemField(originalIndex, "targetIndustrialId", val);
                                              if (found?.unit) updateItemField(originalIndex, "unit", found.unit);
                                              if (found?.category) updateItemField(originalIndex, "category", found.category);
                                            }}
                                            className="w-full text-xs font-bold py-2 px-3 rounded-xl border border-blue-300 bg-white text-neutral-900 cursor-pointer"
                                          >
                                            <option value="">-- Select Industrial Product --</option>
                                            {industrialProducts.map(prod => (
                                              <option key={prod.id} value={prod.id}>
                                                {prod.name} (${Number(prod.price || 0).toFixed(2)}/{prod.unit || "case"})
                                              </option>
                                            ))}
                                          </select>
                                        ) : item.matchAction === "create" ? (
                                          <span className="text-blue-700 text-xs sm:text-sm font-bold flex items-center gap-1.5">
                                            <Plus className="h-4 w-4" /> Add New Industrial Product
                                          </span>
                                        ) : (
                                          <span className="text-neutral-400 italic text-xs">Skip from catalog</span>
                                        )
                                      ) : item.matchAction === "map" ? (
                                        <SearchableMatchSelect
                                          value={item.targetIngredientId || ""}
                                          onChange={(val) => updateItemTargetId(originalIndex, val)}
                                          ingredients={existingIngredients}
                                        />
                                      ) : item.matchAction === "create" ? (
                                        <span className="text-emerald-700 text-xs sm:text-sm font-bold flex items-center gap-1.5">
                                          <Plus className="h-4 w-4" /> Add New Master Item
                                        </span>
                                      ) : (
                                        <span className="text-neutral-400 italic text-xs">Skip from catalog</span>
                                      )}
                                    </td>

                                    {/* Match Action Toggle */}
                                    <td className="px-4 py-4 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <select
                                          value={item.matchAction || "create"}
                                          onChange={(e) => {
                                            if (item.itemTargetType === "industrial") {
                                              updateItemField(originalIndex, "matchAction", e.target.value as any);
                                            } else {
                                              updateItemAction(originalIndex, e.target.value as any);
                                            }
                                          }}
                                          className="bg-neutral-50 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-hidden cursor-pointer hover:bg-white"
                                        >
                                          <option value="map">Update Rate</option>
                                          <option value="create">Add New</option>
                                          <option value="skip">Skip</option>
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteRow(originalIndex)}
                                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                          title="Delete row"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Application Settings & Trigger Actions */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                        <div className="space-y-1">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-neutral-800">
                            <input 
                              type="checkbox"
                              checked={preserveStockCounts}
                              onChange={(e) => setPreserveStockCounts(e.target.checked)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <span>Preserve on-hand inventory stock counts</span>
                              <span className="text-neutral-400 font-normal font-mono text-[11px]">(Update catalog rates only)</span>
                            </span>
                          </label>
                          <div className="text-[11px] font-sans pl-6">
                            {preserveStockCounts ? (
                              <span className="text-amber-700 font-medium">
                                ⚠️ <strong>Price-only mode:</strong> Stock counts in the Stocktake Count Sheet will remain unchanged.
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-medium">
                                📦 <strong>Stock Intake mode:</strong> Quantities will pile directly onto On-Hand Stock (Pounds / lbs) in the Stocktake Count Sheet.
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApplyActiveItem(false)}
                            disabled={isReadOnly || selectedIndices.length === 0 || isApplying}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isApplying ? (
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-200" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                            )}
                            <span>
                              {isApplying
                                ? "Applying Items to Catalog..."
                                : `Apply Active Invoice (${selectedIndices.length} items)`}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Duplicate Invoice Warning Notice */}
                      {isDuplicateInvoice && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Duplicate Invoice Detected</p>
                              <p className="text-amber-800 text-[11px] mt-0.5">
                                An invoice with #{activeItem.invoiceNumber} for {activeItem.vendor} dated {activeItem.date} already exists in your records.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyActiveItem(true)}
                            disabled={isApplying || isReadOnly}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xs shrink-0 cursor-pointer"
                          >
                            Apply Anyway
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-dashed border-neutral-200 p-12 text-center text-neutral-400 font-medium text-xs rounded-2xl">
                  No document selected in the batch queue. Add files or load the sandbox demo above to begin.
                </div>
              );

              if (isFullscreen && activeItem && typeof document !== "undefined") {
                return createPortal(activeDocumentNode, document.body);
              }
              return activeDocumentNode;
            })()}
          </div>
        </div>
      )}

      {/* Camera OCR Scanner Modal */}
      {showCamera && (
        <CameraScanner
          isProcessing={false}
          language="en"
          onCapture={(base64Image) => {
            setShowCamera(false);
            fetch(base64Image)
              .then(res => res.blob())
              .then(blob => {
                const fileName = `camera_scan_${Date.now()}.png`;
                const file = new File([blob], fileName, { type: "image/png" });
                const newItemId = `batch-${Date.now()}-cam`;
                const newItem: QueueItem = {
                  id: newItemId,
                  file,
                  fileName,
                  fileSize: blob.size,
                  fileDataUrl: base64Image,
                  fileType: "image/png",
                  status: "pending",
                  vendor: "",
                  invoiceNumber: "",
                  date: new Date().toLocaleDateString(),
                  items: [],
                  documentType: "invoice"
                };
                setQueue(prev => [...prev, newItem]);
                setActiveQueueId(newItemId);
                setSuccessMsg("Camera capture saved and attached to queue! Click 'Extract & Audit Document' to process with AI.");
              })
              .catch(err => {
                console.error("Failed to convert camera capture to file", err);
              });
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Document Lightbox Preview Modal */}
      {previewModalItem && previewModalItem.fileDataUrl && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewModalItem(null)}
          fileUrl={previewModalItem.fileDataUrl}
          fileName={previewModalItem.fileName}
          fileType={previewModalItem.fileType}
          fileSize={previewModalItem.fileSize}
          title={`Document Source: ${previewModalItem.fileName}`}
          subtitle={previewModalItem.vendor ? `Vendor: ${previewModalItem.vendor}` : undefined}
        />
      )}

      {/* Duplicate Invoice Confirmation Modal */}
      {showDuplicatePrompt && activeItem && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 text-left space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Duplicate Invoice Warning</h3>
              <p className="text-xs text-neutral-600 mt-1">
                An invoice matching vendor <strong>"{activeItem.vendor}"</strong>, invoice number <strong>"{activeItem.invoiceNumber}"</strong>, and date <strong>"{activeItem.date}"</strong> has already been recorded in your system.
              </p>
            </div>
            <p className="text-xs text-neutral-500 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              Applying this document will update ingredient prices and log an additional invoice record.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDuplicatePrompt(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicatePrompt(false);
                  handleApplyActiveItem(true);
                }}
                disabled={isApplying}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isApplying ? "Applying..." : "Apply Invoice Anyway"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register / Update Pack Size Modal (Strict Base Unit: lb | pc | oz, rest are Package Units) */}
      {packSizeModal && packSizeModal.isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-neutral-200 text-left space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  📦
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Register Base Unit & Pack Sizes
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    {packSizeModal.ingredientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPackSizeModal(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-900">
              <p className="font-semibold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Unit Hierarchy Rule:</span>
              </p>
              <p className="text-[11px] text-emerald-800 mt-1">
                Default <strong>Base Unit</strong> is <strong>lb</strong> (users can choose <strong>lb</strong>, <strong>pc</strong>, or <strong>oz</strong>). All other units (<strong>Box, Case, Bag, Pack, Tub, Bottle, Can</strong>, etc.) are <strong>Package Units</strong>.
              </p>
            </div>

            <div className="space-y-4">
              {/* 1. Strict Base Unit Selector (lb, pc, or oz) */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  1. Base Unit (Default: lb, or choose pc / oz) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPackSizeModal((prev) =>
                        prev ? { ...prev, baseUnit: "lb" } : null
                      )
                    }
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      packSizeModal.baseUnit === "lb"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                    }`}
                  >
                    <span>⚖️ lb (Pound)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPackSizeModal((prev) =>
                        prev ? { ...prev, baseUnit: "pc" } : null
                      )
                    }
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      packSizeModal.baseUnit === "pc"
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                    }`}
                  >
                    <span>🔢 pc (Piece)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPackSizeModal((prev) =>
                        prev ? { ...prev, baseUnit: "oz" } : null
                      )
                    }
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      packSizeModal.baseUnit === "oz"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                    }`}
                  >
                    <span>🧪 oz (Ounce)</span>
                  </button>
                </div>
              </div>

              {/* 2. Primary Package Unit & Conversion */}
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
                <label className="block text-xs font-bold text-neutral-800">
                  2. Primary Pack Size (e.g. 40{packSizeModal.baseUnit} per box) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 40"
                    value={packSizeModal.baseUnit === "pc" ? packSizeModal.countAmount : packSizeModal.weightAmount}
                    onChange={(e) =>
                      setPackSizeModal((prev) =>
                        prev
                          ? prev.baseUnit === "pc"
                            ? { ...prev, countAmount: e.target.value }
                            : { ...prev, weightAmount: e.target.value }
                          : null
                      )
                    }
                    className="w-28 bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="bg-emerald-100 text-emerald-900 px-2.5 py-2 rounded-xl text-xs font-bold font-mono shrink-0">
                    {packSizeModal.baseUnit} per
                  </span>
                  <select
                    value={
                      PACKAGE_UNIT_OPTIONS.includes(packSizeModal.packUnit as any)
                        ? packSizeModal.packUnit
                        : "Custom"
                    }
                    onChange={(e) => {
                      if (e.target.value !== "Custom") {
                        setPackSizeModal((prev) =>
                          prev ? { ...prev, packUnit: e.target.value } : null
                        );
                      }
                    }}
                    className="bg-white border border-neutral-300 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {PACKAGE_UNIT_OPTIONS.map((pkgOpt) => (
                      <option key={pkgOpt} value={pkgOpt}>
                        {pkgOpt}
                      </option>
                    ))}
                    <option value="Custom">Custom...</option>
                  </select>
                  <input
                    type="text"
                    placeholder="e.g. Box"
                    value={packSizeModal.packUnit}
                    onChange={(e) =>
                      setPackSizeModal((prev) =>
                        prev ? { ...prev, packUnit: e.target.value } : null
                      )
                    }
                    className="w-24 bg-white border border-neutral-300 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Additional Pack Sizes (Unlimited) */}
                {packSizeModal.extraPacks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-neutral-200">
                    <span className="block text-[11px] font-bold text-neutral-600">
                      Additional Pack Sizes:
                    </span>
                    {packSizeModal.extraPacks.map((ep, epIdx) => (
                      <div key={epIdx} className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Qty"
                          value={ep.ratio}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPackSizeModal((prev) => {
                              if (!prev) return null;
                              const next = [...prev.extraPacks];
                              next[epIdx] = { ...next[epIdx], ratio: val };
                              return { ...prev, extraPacks: next };
                            });
                          }}
                          className="w-24 bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-hidden"
                        />
                        <span className="bg-neutral-200 text-neutral-800 px-2 py-1.5 rounded-lg text-xs font-bold font-mono shrink-0">
                          {packSizeModal.baseUnit} per
                        </span>
                        <select
                          value={
                            PACKAGE_UNIT_OPTIONS.some(
                              (opt) => opt.toLowerCase() === (ep.targetUnit || "").toLowerCase()
                            )
                              ? PACKAGE_UNIT_OPTIONS.find(
                                  (opt) => opt.toLowerCase() === (ep.targetUnit || "").toLowerCase()
                                )
                              : "Box"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            setPackSizeModal((prev) => {
                              if (!prev) return null;
                              const next = [...prev.extraPacks];
                              next[epIdx] = { ...next[epIdx], targetUnit: val };
                              return { ...prev, extraPacks: next };
                            });
                          }}
                          className="bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-hidden cursor-pointer flex-1"
                        >
                          {PACKAGE_UNIT_OPTIONS.map((pkgOpt) => (
                            <option key={pkgOpt} value={pkgOpt}>
                              {pkgOpt}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setPackSizeModal((prev) => {
                              if (!prev) return null;
                              const next = [...prev.extraPacks];
                              next.splice(epIdx, 1);
                              return { ...prev, extraPacks: next };
                            })
                          }
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Remove pack size"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setPackSizeModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            extraPacks: [...prev.extraPacks, { ratio: "", targetUnit: "Bag" }],
                          }
                        : null
                    )
                  }
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 pt-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another pack size</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs flex items-center justify-between">
              <span className="text-neutral-500 font-medium">Preview Registration:</span>
              <span className="font-mono font-bold text-neutral-800">
                Base: <strong className="text-emerald-700">{packSizeModal.baseUnit}</strong> | Pack:{" "}
                <strong>
                  {(packSizeModal.baseUnit === "pc"
                    ? parseFloat(packSizeModal.countAmount)
                    : parseFloat(packSizeModal.weightAmount)) > 0
                    ? `${
                        packSizeModal.baseUnit === "pc"
                          ? packSizeModal.countAmount
                          : packSizeModal.weightAmount
                      }${packSizeModal.baseUnit} per ${(packSizeModal.packUnit || "box").toLowerCase()}`
                    : (packSizeModal.packUnit || "box").toLowerCase()}
                </strong>
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setPackSizeModal(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePackSize}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Base & Pack Sizes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Naming Match Table Modal */}
      <IngredientNameMatchModal
        isOpen={showNamingMatchModal}
        onClose={() => setShowNamingMatchModal(false)}
        ingredients={existingIngredients}
        invoices={existingInvoices}
        queuedItems={queue.flatMap((q) => q.items || [])}
        onEditIngredient={async (id, updates) => {
          const target = existingIngredients.find((i) => i.id === id);
          if (target) {
            await safeUpdateDoc("ingredients", id, {
              ...target,
              ...updates,
              updatedAt: new Date().toISOString(),
            });
          }
        }}
      />

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 mt-6 bg-emerald-50 border border-emerald-300 text-neutral-900 text-xs rounded-xl flex items-start gap-2.5 text-left animate-in fade-in" id="parser-success">
          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-xs font-mono text-emerald-900">Operation Successful</p>
            <p className="text-emerald-800 font-medium mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-4 mt-6 bg-red-50 border border-red-300 text-neutral-900 text-xs rounded-xl flex items-start gap-2.5 text-left animate-in fade-in" id="parser-error">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="w-full">
            <p className="font-bold text-xs font-mono text-red-900">Workspace Notice</p>
            <p className="text-red-800 font-mono mt-0.5 whitespace-pre-wrap">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
