import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { 
  Package, 
  ClipboardList, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  Plus, 
  Minus, Loader2,  
  Save, 
  PlusCircle, 
  History, 
  Calendar, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2, 
  Search, 
  FileText, 
  FileJson,
  Printer,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Check,
  X,
  Download,
  Sparkles,
  Edit2,
  DollarSign,
  CalendarRange,
  FileSpreadsheet
} from "lucide-react";
import { Ingredient, ConsumptionLog, Recipe, Department, Employee } from "../types";
import { db, safeAddDoc, safeUpdateDoc, safeDeleteDoc, subscribeWorkspaceCollection } from "../lib/firebase";
import { getNormalizedVendorKey } from "../lib/vendorUtils";
import { getIngredientStandardRate } from "./IngredientsView";
import { getGramsOrMlEquivalent, calculatePoundData, convertInputToNativeQty, calculateIngredientUnitPrice, getConsumptionQtyDetail, extractWeightSpecFromName, convertFromGrams } from "../lib/unitConverter";
import TabletConsumptionPOS from "./TabletConsumptionPOS";
import { ConsumptionDateRangeCalendar } from "./ConsumptionDateRangeCalendar";
import { BulkIngredientImportModal } from "./BulkIngredientImportModal";

interface InventoryViewProps {
  ingredients: Ingredient[];
  recipes: Recipe[];
  vendors?: any[];
  departments?: Department[];
  employees?: Employee[];
  onAddIngredient: (ing: Partial<Ingredient>) => Promise<void>;
  onEditIngredient: (id: string, edits: Partial<Ingredient>) => Promise<void>;
  onDeleteIngredient: (id: string) => Promise<void>;
  isReadOnly: boolean;
  user: any;
  workspaceOwnerId: string | null;
}

export interface StocktakeLog {
  id: string;
  date: string;
  totalValue: number;
  totalPounds?: number;
  totalItemsCount: number;
  lowStockCount: number;
  vendorFilter: string;
  items: {
    ingredientId: string;
    name: string;
    inStock: number;
    unit: string;
    price: number;
    unitRate?: number;
    rateUnit?: string;
    value: number;
    totalPounds?: number;
    hasWeightSpec?: boolean;
    weightPerCase?: number;
    weightPerCaseUnit?: string;
    pcsPerPound?: number;
  }[];
  ownerId: string;
  createdAt: string;
}

const PRESET_LOCATIONS = [
  "Walk-In Cooler",
  "Freezer",
  "Dry Storage",
  "Bar Storage",
  "Bakery Rack",
  "Line Station"
];

const getLocationIcon = (loc: string) => {
  switch (loc) {
    case "Walk-In Cooler": return "❄️";
    case "Freezer": return "🥶";
    case "Dry Storage": return "📦";
    case "Bar Storage": return "🍹";
    case "Bakery Rack": return "🥖";
    case "Line Station": return "🍳";
    case "Unassigned": return "🗂️";
    default: return "🏠";
  }
};

const MASS_VOLUME_UNITS_SET = [
  "g", "kg", "ml", "l", "oz", "lb", "lbs", "ounce", "ounces", 
  "pound", "pounds", "gram", "grams", "liter", "liters", 
  "milliliter", "milliliters", "kilogram", "kilograms"
];

export function getItemAssetValue(
  item: {
    name?: string;
    unit: string;
    price: number;
    quantity: number;
    pricePerGram: number;
    weightPerCase?: number;
    weightPerCaseUnit?: string;
    pcsPerPound?: number;
  },
  currentCount: number | undefined,
  overrideWeightPerCase?: number,
  overrideWeightPerCaseUnit?: string,
  overridePcsPerPound?: number
): number {
  if (currentCount === undefined || currentCount === null || isNaN(currentCount) || currentCount <= 0) {
    return 0;
  }

  const rateInfo = getIngredientStandardRate(item);
  const rateVal = rateInfo.rateVal || 0;
  const cleanRateUnit = (rateInfo.unitLabel || "pcs").toLowerCase().trim();
  const cleanStockUnit = (item.unit || "pcs").toLowerCase().trim();

  // 1. If rate unit is discrete (e.g., pcs, box, case, pack, unit) OR rate unit matches stock unit directly
  const isRateMassVol = MASS_VOLUME_UNITS_SET.includes(cleanRateUnit);

  if (!isRateMassVol || cleanStockUnit === cleanRateUnit) {
    return rateVal * currentCount;
  }

  // 2. Rate unit IS a mass/volume unit (lb, kg, oz, g, L, ml), but stock unit differs (e.g. oz stock vs lb rate, or case stock with weightPerCase)
  const wPerCase = overrideWeightPerCase !== undefined ? overrideWeightPerCase : item.weightPerCase;
  const wPerCaseUnit = overrideWeightPerCaseUnit !== undefined ? overrideWeightPerCaseUnit : (item.weightPerCaseUnit || "lb");
  const pcsRatio = overridePcsPerPound !== undefined ? overridePcsPerPound : item.pcsPerPound;

  const poundInfo = calculatePoundData(
    currentCount,
    item.unit,
    wPerCase,
    wPerCaseUnit,
    pcsRatio,
    item.quantity,
    item.name
  );

  if (poundInfo.lbs > 0) {
    if (["lb", "lbs", "pound", "pounds"].includes(cleanRateUnit)) {
      return rateVal * poundInfo.lbs;
    } else if (["kg", "kilogram", "kilograms"].includes(cleanRateUnit)) {
      const onHandKg = (poundInfo.lbs * 453.59237) / 1000;
      return rateVal * onHandKg;
    } else if (["oz", "ounce", "ounces"].includes(cleanRateUnit)) {
      const onHandOz = poundInfo.lbs * 16;
      return rateVal * onHandOz;
    } else if (["g", "gram", "grams"].includes(cleanRateUnit)) {
      const onHandGrams = poundInfo.lbs * 453.59237;
      return rateVal * onHandGrams;
    } else if (["l", "liter", "liters"].includes(cleanRateUnit)) {
      const onHandL = (poundInfo.lbs * 453.59237) / 1000;
      return rateVal * onHandL;
    } else if (["ml", "milliliter", "milliliters"].includes(cleanRateUnit)) {
      const onHandMl = poundInfo.lbs * 453.59237;
      return rateVal * onHandMl;
    }
  }

  return rateVal * currentCount;
}

const DEFAULT_RESTAURANTS = [
  "UMAI FISH",
  "TWO GEESE BAKERY",
  "TG SANDWICH & DRINKS",
  "TG BREAKFAST",
  "BUON CIBO",
  "SAL ANTHONY'S",
  "CHICKEN N BUNS",
  "NARI EXPRESS",
  "CEBICHELSEA",
  "EAT WELL",
  "MOMO CURRY",
  "SAMMY'S TAQUERIA"
];

const UNIT_TO_GRAMS: { [key: string]: number } = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  lb: 453.59237,
  lbs: 453.59237,
  pound: 453.59237,
  pounds: 453.59237,
  oz: 28.3495231,
  ounce: 28.3495231,
  ounces: 28.3495231,
};

function getPageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: number[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push(-1);
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push(1);
    pages.push(-1);
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push(-1);
    pages.push(current - 1);
    pages.push(current);
    pages.push(current + 1);
    pages.push(-1);
    pages.push(total);
  }
  return pages;
}

export default function InventoryView({
  ingredients,
  recipes,
  vendors = [],
  departments = [],
  employees = [],
  onAddIngredient,
  onEditIngredient,
  onDeleteIngredient,
  isReadOnly,
  user,
  workspaceOwnerId
}: InventoryViewProps) {
  // Navigation & Sub-tabs
  const [subTab, setSubTab] = useState<"count" | "history" | "consumptions">("count");

  // AI Batch Document Parser state
  const [showAIBatchParser, setShowAIBatchParser] = useState(false);
  const [batchInputText, setBatchInputText] = useState("");
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiInventoryItems, setAiInventoryItems] = useState<any[]>([]);
  const [batchTargetDept, setBatchTargetDept] = useState("AUTO");
  const [batchTargetVendor, setBatchTargetVendor] = useState("");
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");

  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("ALL_VENDORS");
  const [selectedLocation, setSelectedLocation] = useState("ALL_LOCATIONS");
  const [selectedCategory, setSelectedCategory] = useState("ALL_CATEGORIES");
  const [isUncategorizedDismissed, setIsUncategorizedDismissed] = useState(() => localStorage.getItem("isUncategorizedDismissed") === "true");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [untrackedOnly, setUntrackedOnly] = useState(false);
  const [hasStockOnly, setHasStockOnly] = useState(false);

  // Sorting state
  
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // In-line counts draft editing state (id -> value)
  const [draftCounts, setDraftCounts] = useState<{ [id: string]: number }>({});
  const [draftNames, setDraftNames] = useState<{ [id: string]: string }>({});
  const [draftPars, setDraftPars] = useState<{ [id: string]: number }>({});
  const [draftLocations, setDraftLocations] = useState<{ [id: string]: string }>({});
  const [draftVendors, setDraftVendors] = useState<{ [id: string]: string }>({});
  const [draftCategories, setDraftCategories] = useState<{ [id: string]: string }>({});
  const [draftUnits, setDraftUnits] = useState<{ [id: string]: string }>({});
  const [draftPcsPerPound, setDraftPcsPerPound] = useState<{ [id: string]: number }>({});
  const [draftWeightPerCase, setDraftWeightPerCase] = useState<{ [id: string]: number }>({});
  const [draftWeightPerCaseUnit, setDraftWeightPerCaseUnit] = useState<{ [id: string]: string }>({});
  const [draftPackagingUnit, setDraftPackagingUnit] = useState<{ [id: string]: string }>({});
  const [draftConversions, setDraftConversions] = useState<{ [id: string]: { ratio: number; targetUnit: string }[] }>({});
  const [showSecondaryConversion, setShowSecondaryConversion] = useState<{ [id: string]: boolean }>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteHistoryId, setConfirmDeleteHistoryId] = useState<string | null>(null);
  const [confirmDeleteConsumptionId, setConfirmDeleteConsumptionId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  // Table pagination state for Inventory / Stocktake list
  const [inventoryPage, setInventoryPage] = useState<number>(1);
  const [inventoryPageSize, setInventoryPageSize] = useState<number | "ALL">(50);

  // Historical stocktakes
  const [history, setHistory] = useState<StocktakeLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFetchLimit, setHistoryFetchLimit] = useState<number>(15);
  const [hasMoreHistory, setHasMoreHistory] = useState<boolean>(true);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<StocktakeLog | null>(null);

  // Vendor consumptions
  const [consumptions, setConsumptions] = useState<ConsumptionLog[]>([]);
  const [loadingConsumptions, setLoadingConsumptions] = useState(false);
  const [consumptionPage, setConsumptionPage] = useState(1);
  const [ledgerFetchLimit, setLedgerFetchLimit] = useState<number>(100);
  const [manualFetchTrigger, setManualFetchTrigger] = useState<number>(0);
  const [lastFetchedTime, setLastFetchedTime] = useState<string | null>(null);

  // Search & Filter states for Consumption Ledger
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");
  const [ledgerFilterRestaurant, setLedgerFilterRestaurant] = useState("ALL");
  const [ledgerFilterRecordedBy, setLedgerFilterRecordedBy] = useState("ALL");
  const [ledgerFilterDate, setLedgerFilterDate] = useState("");
  const [ledgerDatePreset, setLedgerDatePreset] = useState<"ALL" | "TODAY" | "YESTERDAY" | "7DAYS" | "30DAYS" | "CUSTOM">("ALL");
  const [ledgerCustomStartDate, setLedgerCustomStartDate] = useState("");
  const [ledgerCustomEndDate, setLedgerCustomEndDate] = useState("");
  const [ledgerQtyFilter, setLedgerQtyFilter] = useState<"ALL" | "DEDUCTION" | "ADDITION">("ALL");
  const [showLedgerCalendar, setShowLedgerCalendar] = useState(false);
  const [isLedgerCalendarPinned, setIsLedgerCalendarPinned] = useState(false);
  const calendarDropdownRef = useRef<HTMLDivElement | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement | null>(null);

  const [showInventoryExportDropdown, setShowInventoryExportDropdown] = useState(false);
  const inventoryExportDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close export & calendar dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
      if (inventoryExportDropdownRef.current && !inventoryExportDropdownRef.current.contains(event.target as Node)) {
        setShowInventoryExportDropdown(false);
      }
      if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(event.target as Node)) {
        setShowLedgerCalendar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Edit ingredient unit state in stocktake sheet
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitVal, setEditingUnitVal] = useState<string>("");

  // Consumption Form states
  const [isTabletMode, setIsTabletMode] = useState(false);
  const [consumptionDate, setConsumptionDate] = useState(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
  });
  const [consumptionVendor, setConsumptionVendor] = useState("");
  const [isCustomVendor, setIsCustomVendor] = useState(false);
  const [customVendorName, setCustomVendorName] = useState("");
  const [selectedIngredientId, setSelectedIngredientId] = useState("");

  // Add Item modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("0");
  const [newItemUnit, setNewItemUnit] = useState("lb");
  const [newItemVendor, setNewItemVendor] = useState("unassigned");
  const [newItemLocation, setNewItemLocation] = useState(PRESET_LOCATIONS[0]);
  const [newItemCategory, setNewItemCategory] = useState("Meat");
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState("");
  const [consumedQty, setConsumedQty] = useState<string>("");
  const [recordedBy, setRecordedBy] = useState("");
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);
  const [submittingConsumption, setSubmittingConsumption] = useState(false);
  const [consumptionMessage, setConsumptionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dynamic unit conversion & dropdown states
  const [consumptionUnit, setConsumptionUnit] = useState<string>("lbs");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // AI Auto-Categorization Helper States & Function
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [aiCategorizeStatus, setAiCategorizeStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const uncategorizedItems = useMemo(() => {
    return ingredients.filter(ing => !ing.category || ing.category.trim() === "" || ing.category === "Other");
  }, [ingredients]);

  const handleAutoCategorize = async () => {
    if (uncategorizedItems.length === 0) return;
    setIsCategorizing(true);
    setAiCategorizeStatus(null);
    try {
      const payload = {
        items: uncategorizedItems.map(i => ({ id: i.id, name: i.name }))
      };
      const res = await fetch("/api/auto-categorize-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to auto-categorize. Please try again.");
      }
      const data = await res.json();
      if (data.categories && Array.isArray(data.categories)) {
        let count = 0;
        await Promise.all(data.categories.map(async (mapping: any) => {
          if (mapping.id && mapping.category) {
            const updates: any = { category: mapping.category };
            const existing = ingredients.find(i => i.id === mapping.id);
            if (existing) {
              const catLower = mapping.category.toLowerCase();
              const isPackCat = ["beverages", "dairy", "other"].includes(catLower) || 
                                catLower.includes("milk") || 
                                catLower.includes("beverage") || 
                                catLower.includes("dairy");
              const isLbsUnit = existing.unit && (existing.unit.toLowerCase().trim() === "lbs" || existing.unit.toLowerCase().trim() === "pound" || existing.unit.toLowerCase().trim() === "");
              if (isPackCat && isLbsUnit) {
                updates.unit = "pack";
              }
            }
            await onEditIngredient(mapping.id, updates);
            count++;
          }
        }));
        setAiCategorizeStatus({
          type: "success",
          text: `Successfully categorized ${count} ingredients using Gemini AI!`
        });
        setTimeout(() => setAiCategorizeStatus(null), 5000);
      } else {
        throw new Error("Invalid response format from server.");
      }
    } catch (err: any) {
      console.error("Auto-categorize error:", err);
      setAiCategorizeStatus({
        type: "error",
        text: err.message || "Failed to auto-categorize items."
      });
    } finally {
      setIsCategorizing(false);
    }
  };

  const selectedIng = useMemo(() => {
    return ingredients.find((i) => i.id === selectedIngredientId) || null;
  }, [ingredients, selectedIngredientId]);

  const availableUnits = useMemo(() => {
    if (!selectedIng) return ["lb"];
    const nativeUnit = selectedIng.unit || "lb";
    
    const unitsSet = new Set<string>();
    unitsSet.add(nativeUnit);

    if (selectedIng.packagingUnit && selectedIng.pcsPerPound && selectedIng.pcsPerPound > 0) {
      unitsSet.add(selectedIng.packagingUnit);
    }

    if (selectedIng.conversions && selectedIng.conversions.length > 0) {
      selectedIng.conversions.forEach(c => {
        if (c.targetUnit) unitsSet.add(c.targetUnit);
      });
    }

    return Array.from(unitsSet);
  }, [selectedIng]);

  // When selected ingredient changes, default unit to lbs (if weight-based) or packs
  useEffect(() => {
    if (selectedIng) {
      setConsumptionUnit(selectedIng.unit || "lb");
    }
  }, [selectedIng]);

  // Auto-set default unit based on selected category when adding a new catalog item
  useEffect(() => {
    const cat = newItemCategory.toLowerCase();
    if (["meat", "vegetables", "seafood"].includes(cat)) {
      setNewItemUnit("lbs");
    } else if (["beverages", "dairy", "other"].includes(cat) || cat.includes("milk") || cat.includes("beverage") || cat.includes("dairy")) {
      setNewItemUnit("pack");
    }
  }, [newItemCategory]);

  const filteredFormIngredients = useMemo(() => {
    const visible = ingredients.filter(ing => !ing.isHiddenFromInventory);
    if (!ingredientSearchQuery.trim()) return visible;
    const q = ingredientSearchQuery.toLowerCase();
    return visible.filter(ing => 
      ing.name.toLowerCase().includes(q) || 
      (ing.vendor && ing.vendor.toLowerCase().includes(q)) ||
      (ing.location && ing.location.toLowerCase().includes(q))
    );
  }, [ingredients, ingredientSearchQuery]);

  const calculation = useMemo(() => {
    const qtyNum = parseFloat(consumedQty);
    if (!selectedIng || isNaN(qtyNum) || qtyNum <= 0) {
      return { packagesToDeduct: 0, displayCost: 0 };
    }

    const normalizedSelected = consumptionUnit.toLowerCase().trim();
    const normalizedIngUnit = selectedIng.unit.toLowerCase().trim();

    // 1. Whole packages (packs)
    if (normalizedSelected === "packs" || normalizedSelected === "pack" || normalizedSelected === "packages" || normalizedSelected === "package") {
      const packagesToDeduct = qtyNum;
      const displayCost = packagesToDeduct * selectedIng.price;
      return { packagesToDeduct, displayCost };
    }

    const packSize = (selectedIng.pcsPerPound && selectedIng.pcsPerPound > 0) ? selectedIng.pcsPerPound : selectedIng.quantity;

    // 2. Exact match (e.g. lb to lb, pcs to pcs)
    if (normalizedSelected === normalizedIngUnit) {
      const packagesToDeduct = qtyNum / packSize;
      const displayCost = packagesToDeduct * selectedIng.price;
      return { packagesToDeduct, displayCost };
    }

    // 3. Weight conversion (e.g., oz or g to lbs)
    const selectedInGrams = UNIT_TO_GRAMS[normalizedSelected];
    const ingInGrams = UNIT_TO_GRAMS[normalizedIngUnit];

    if (selectedInGrams !== undefined && ingInGrams !== undefined) {
      const totalGrams = qtyNum * selectedInGrams;
      let packageGrams = packSize * ingInGrams;
      if (selectedIng.weightPerCase && selectedIng.weightPerCase > 0) {
         const wUnit = selectedIng.weightPerCaseUnit || "lb";
         packageGrams = selectedIng.weightPerCase * (UNIT_TO_GRAMS[wUnit.toLowerCase().trim()] || 453.592);
      }
      const packagesToDeduct = totalGrams / packageGrams;
      const displayCost = packagesToDeduct * selectedIng.price;
      return { packagesToDeduct, displayCost };
    }

    // 4. Count-based conversion (e.g. pieces)
    const countUnits = ["pcs", "piece", "pieces", "each", "count", "ct"];
    const isSelectedCount = countUnits.includes(normalizedSelected);
    const isIngCount = countUnits.includes(normalizedIngUnit);

    if (isSelectedCount && isIngCount) {
      const packagesToDeduct = qtyNum / packSize;
      const displayCost = packagesToDeduct * selectedIng.price;
      return { packagesToDeduct, displayCost };
    }

    // Fallback: direct packages
    return {
      packagesToDeduct: qtyNum,
      displayCost: qtyNum * selectedIng.price,
      warning: `Cannot convert between ${consumptionUnit} and ${selectedIng.unit}. Recording as raw ${qtyNum} packs instead.`
    };
  }, [selectedIng, consumedQty, consumptionUnit]);

  // Group processed/filtered ingredients by storage location for display
  const groupedIngredients = useMemo(() => {
    const groups: { [location: string]: Ingredient[] } = {};
    filteredFormIngredients.forEach(ing => {
      const loc = ing.location || "Unassigned";
      if (!groups[loc]) groups[loc] = [];
      groups[loc].push(ing);
    });
    // Sort locations, but keep "Unassigned" at the end if it exists
    return Object.keys(groups).sort((a, b) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    }).reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {} as { [location: string]: Ingredient[] });
  }, [filteredFormIngredients]);

  // Real-time listener for historical stocktakes from Cloud SQL
  useEffect(() => {
    if (!user || !workspaceOwnerId) return;

    const unsubscribe = subscribeWorkspaceCollection<StocktakeLog>(
      "inventory_counts",
      { ownerId: workspaceOwnerId },
      (items) => {
        const logs = [...items];
        logs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setHistory(logs);
        setLoadingHistory(false);
      },
      (error) => {
        console.error("Error loading historical stocktakes:", error);
        setLoadingHistory(false);
      }
    );

    return () => unsubscribe();
  }, [user, workspaceOwnerId]);

  // Helper to extract timestamp or ISO date string for strict recent order sorting
  const getConsumptionSortKey = (log: ConsumptionLog) => {
    if (log.createdAt) {
      if (typeof log.createdAt === "string") return log.createdAt;
      if (typeof (log.createdAt as any).toDate === "function") return (log.createdAt as any).toDate().toISOString();
      if ((log.createdAt as any).seconds) return new Date((log.createdAt as any).seconds * 1000).toISOString();
    }
    if (log.date) {
      return `${log.date}T23:59:59.999Z`;
    }
    return "";
  };

  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getYesterdayISO = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getNDaysAgoISO = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Helper to extract ISO date (YYYY-MM-DD) from createdAt or date
  const getLogDateISO = (log: ConsumptionLog) => {
    if (log.createdAt) {
      if (typeof log.createdAt === "string") return log.createdAt.slice(0, 10);
      if (typeof (log.createdAt as any).toDate === "function") {
        return (log.createdAt as any).toDate().toISOString().slice(0, 10);
      }
      if ((log.createdAt as any).seconds) {
        return new Date((log.createdAt as any).seconds * 1000).toISOString().slice(0, 10);
      }
    }
    return log.date || "";
  };

  // Helper to format date and time for display
  const formatLogDateTime = (log: ConsumptionLog) => {
    if (log.createdAt) {
      try {
        let dateObj: Date | null = null;
        if (typeof log.createdAt === "string") {
          dateObj = new Date(log.createdAt);
        } else if (typeof (log.createdAt as any).toDate === "function") {
          dateObj = (log.createdAt as any).toDate();
        } else if ((log.createdAt as any).seconds) {
          dateObj = new Date((log.createdAt as any).seconds * 1000);
        }
        if (dateObj && !isNaN(dateObj.getTime())) {
          return `${dateObj.toLocaleDateString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })} ${dateObj.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}`;
        }
      } catch (e) {
        // fallback
      }
    }
    return log.date || "";
  };

  // Real-time listener for vendor ingredient consumption logs from Cloud SQL
  useEffect(() => {
    if (!user || !workspaceOwnerId) return;
    if (subTab !== "consumptions") return;

    setLoadingConsumptions(true);

    const unsubscribe = subscribeWorkspaceCollection<ConsumptionLog>(
      "inventory_consumptions",
      { ownerId: workspaceOwnerId },
      (items) => {
        const isAiParserLog = (log: ConsumptionLog) => {
          const rec = (log.recordedBy || "").toLowerCase().trim();
          const op = (log.operatorName || "").toLowerCase().trim();
          const ven = (log.vendorName || "").toLowerCase().trim();
          return (
            rec.includes("ai document parser") ||
            rec.includes("ai invoice") ||
            op.includes("ai invoice reader") ||
            op.includes("ai document parser") ||
            ven === "ai invoice import"
          );
        };

        // Clean up any legacy AI document parser entries in the background so only POS restocks & POS usage remain
        const aiLogsToPurge = items.filter((item) => item.id && isAiParserLog(item));
        if (aiLogsToPurge.length > 0) {
          aiLogsToPurge.forEach((legacyLog) => {
            safeDeleteDoc("inventory_consumptions", legacyLog.id).catch(() => {});
          });
        }

        const logs = items.filter((item) => !isAiParserLog(item));
        logs.sort((a, b) => {
          const keyA = getConsumptionSortKey(a);
          const keyB = getConsumptionSortKey(b);
          if (keyA && keyB && keyA !== keyB) {
            return keyB.localeCompare(keyA);
          }
          const dateA = a.date || "";
          const dateB = b.date || "";
          if (dateA !== dateB) {
            return dateB.localeCompare(dateA);
          }
          return (b.id || "").localeCompare(a.id || "");
        });
        setConsumptions(logs);
        setLoadingConsumptions(false);
        setLastFetchedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      },
      (error) => {
        console.error("Error loading consumption logs:", error);
        setLoadingConsumptions(false);
      }
    );

    return () => unsubscribe();
  }, [user, workspaceOwnerId, subTab, ledgerFetchLimit, manualFetchTrigger]);

  // Unique restaurants / vendors for consumption filter
  const uniqueRestaurants = useMemo(() => {
    const set = new Set<string>();
    consumptions.forEach(c => {
      if (c.vendorName && c.vendorName.trim()) set.add(c.vendorName.trim());
    });
    vendors?.forEach(v => {
      if (v.name && v.name.trim()) set.add(v.name.trim());
    });
    return Array.from(set).sort();
  }, [consumptions, vendors]);

  // Unique recordedBy users for consumption filter
  const uniqueRecordedBy = useMemo(() => {
    const set = new Set<string>();
    consumptions.forEach(c => {
      if (c.recordedBy && c.recordedBy.trim()) set.add(c.recordedBy.trim());
    });
    return Array.from(set).sort();
  }, [consumptions]);

  // Filtered consumption logs based on search query, restaurant, recordedBy, and date
  const filteredConsumptions = useMemo(() => {
    return consumptions.filter(log => {
      const logDate = getLogDateISO(log);
      const logDateTimeStr = formatLogDateTime(log);

      // 1. Universal Search Query (matches Recorded By, Ingredient Item, Restaurant, or Date)
      if (ledgerSearchQuery.trim()) {
        const q = ledgerSearchQuery.toLowerCase().trim();
        const matchIngredient = (log.ingredientName || "").toLowerCase().includes(q);
        const matchRestaurant = (log.vendorName || "").toLowerCase().includes(q);
        const matchRecordedBy = (log.recordedBy || "").toLowerCase().includes(q);
        const matchDate = logDate.toLowerCase().includes(q) || logDateTimeStr.toLowerCase().includes(q);
        if (!matchIngredient && !matchRestaurant && !matchRecordedBy && !matchDate) {
          return false;
        }
      }

      // 2. Restaurant Filter
      if (ledgerFilterRestaurant !== "ALL") {
        if ((log.vendorName || "").toLowerCase().trim() !== ledgerFilterRestaurant.toLowerCase().trim()) {
          return false;
        }
      }

      // 3. Recorded By Filter
      if (ledgerFilterRecordedBy !== "ALL") {
        if ((log.recordedBy || "").toLowerCase().trim() !== ledgerFilterRecordedBy.toLowerCase().trim()) {
          return false;
        }
      }

      // 4. Preset Date Range Filter
      if (ledgerCustomStartDate && logDate < ledgerCustomStartDate) return false;
      if (ledgerCustomEndDate && logDate > ledgerCustomEndDate) return false;

      if (!ledgerCustomStartDate && !ledgerCustomEndDate) {
        if (ledgerDatePreset === "TODAY") {
          const todayStr = getTodayISO();
          if (logDate !== todayStr) return false;
        } else if (ledgerDatePreset === "YESTERDAY") {
          const yesterdayStr = getYesterdayISO();
          if (logDate !== yesterdayStr) return false;
        } else if (ledgerDatePreset === "7DAYS") {
          const cutoff = getNDaysAgoISO(7);
          if (logDate < cutoff) return false;
        } else if (ledgerDatePreset === "30DAYS") {
          const cutoff = getNDaysAgoISO(30);
          if (logDate < cutoff) return false;
        }
      }

      // 5. Specific Date Picker Filter
      if (ledgerFilterDate) {
        if (logDate !== ledgerFilterDate) return false;
      }

      // 6. Qty Used (+ or -) Filter
      if (ledgerQtyFilter === "DEDUCTION") {
        if (!(log.quantity > 0)) return false;
      } else if (ledgerQtyFilter === "ADDITION") {
        if (!(log.quantity < 0)) return false;
      }

      return true;
    }).sort((a, b) => {
      const keyA = getConsumptionSortKey(a);
      const keyB = getConsumptionSortKey(b);
      if (keyA && keyB && keyA !== keyB) {
        return keyB.localeCompare(keyA);
      }
      const dateA = a.date || "";
      const dateB = b.date || "";
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return (b.id || "").localeCompare(a.id || "");
    });
  }, [
    consumptions, 
    ledgerSearchQuery, 
    ledgerFilterRestaurant, 
    ledgerFilterRecordedBy, 
    ledgerFilterDate, 
    ledgerDatePreset, 
    ledgerCustomStartDate, 
    ledgerCustomEndDate,
    ledgerQtyFilter
  ]);

  // Dates with records for calendar dot indicators
  const datesWithRecords = useMemo(() => {
    const map = new Map<string, number>();
    consumptions.forEach(log => {
      const d = getLogDateISO(log);
      if (d) {
        map.set(d, (map.get(d) || 0) + 1);
      }
    });
    return map;
  }, [consumptions]);

  // Overall counts for + / - quantities
  const qtyCounts = useMemo(() => {
    let deductions = 0;
    let additions = 0;
    consumptions.forEach(c => {
      if (c.quantity > 0) deductions++;
      else if (c.quantity < 0) additions++;
    });
    return { total: consumptions.length, deductions, additions };
  }, [consumptions]);

  const handleResetLedgerFilters = () => {
    setLedgerSearchQuery("");
    setLedgerFilterRestaurant("ALL");
    setLedgerFilterRecordedBy("ALL");
    setLedgerFilterDate("");
    setLedgerDatePreset("ALL");
    setLedgerCustomStartDate("");
    setLedgerCustomEndDate("");
    setLedgerQtyFilter("ALL");
    setConsumptionPage(1);
  };

  const handleDownloadConsumptionCSV = () => {
    if (filteredConsumptions.length === 0) return;
    
    const headers = ["Created At", "Restaurant / Vendor", "Ingredient", "Quantity Used", "Unit", "Detail Used", "Unit Cost", "Total Cost", "Recorded By", "Operator"];
    
    const csvRows = [headers.join(",")];
    
    filteredConsumptions.forEach(log => {
      const ing = ingredients.find(i => i.id === log.ingredientId || i.name.toLowerCase() === (log.ingredientName || "").toLowerCase());
      const qtyDetail = getConsumptionQtyDetail(log, ing);
      const row = [
        `"${formatLogDateTime(log).replace(/"/g, '""')}"`,
        `"${(log.vendorName || "").replace(/"/g, '""')}"`,
        `"${(log.ingredientName || "").replace(/"/g, '""')}"`,
        log.quantity || 0,
        `"${(log.unit || "").replace(/"/g, '""')}"`,
        `"${qtyDetail.full.replace(/"/g, '""')}"`,
        (log.totalCost && log.quantity && log.quantity !== 0) ? (log.totalCost / Math.abs(log.quantity)).toFixed(2) : "0.00",
        log.totalCost?.toFixed(2) || "0.00",
        `"${(log.recordedBy || "").replace(/"/g, '""')}"`,
        `"${(log.operatorName || log.recordedBy || "").replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(","));
    });
    
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `consumption_ledger_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadConsumptionJSON = () => {
    if (filteredConsumptions.length === 0) return;
    
    const dataToExport = filteredConsumptions.map(log => {
      const ing = ingredients.find(i => i.id === log.ingredientId || i.name.toLowerCase() === (log.ingredientName || "").toLowerCase());
      const qtyDetail = getConsumptionQtyDetail(log, ing);
      return {
        id: log.id,
        date: log.date || "",
        restaurantOrVendor: log.vendorName || "",
        ingredientName: log.ingredientName || "",
        quantityUsed: log.quantity || 0,
        unit: log.unit || "",
        detailUsed: qtyDetail.full,
        unitCost: (log.totalCost && log.quantity && log.quantity !== 0) ? Number((log.totalCost / Math.abs(log.quantity)).toFixed(4)) : 0,
        totalCost: log.totalCost || 0,
        recordedBy: log.recordedBy || "",
        operatorName: log.operatorName || log.recordedBy || "",
        createdAt: log.createdAt || null
      };
    });

    const jsonContent = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `consumption_ledger_${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Set default recordedBy name when user object is loaded
  useEffect(() => {
    if (user) {
      setRecordedBy(user.displayName || user.email || "System Operator");
    }
  }, [user]);

  // A map of normalized lowercase vendor name -> exact spelling / casing (registered vendors take precedence)
  const normalizedVendorMap = useMemo(() => {
    const map = new Map<string, string>();
    
    // 1. Registered vendors have highest priority for casing
    vendors.forEach(v => {
      if (v.name && v.name.trim().length > 0) {
        const trimmed = v.name.trim();
        const key = getNormalizedVendorKey(trimmed);
        if (key) {
          map.set(key, trimmed);
        }
      }
    });

    // 2. Ingredients vendors have second priority
    ingredients.forEach(ing => {
      let rawVendor = "";
      if (ing.vendor && ing.vendor.trim().length > 0) {
        rawVendor = ing.vendor.trim();
      } else if (ing.source && ing.source.includes("(")) {
        const parts = ing.source.split("(");
        if (parts.length > 1) {
          const v = parts[1].replace(")", "").trim();
          if (v) rawVendor = v;
        }
      }

      if (rawVendor) {
        const key = getNormalizedVendorKey(rawVendor);
        if (key && !map.has(key)) {
          map.set(key, rawVendor);
        }
      }
    });

    return map;
  }, [ingredients, vendors]);

  // Extract vendors and locations helper
  const vendorsList = useMemo(() => {
    const list = new Set<string>();
    if (vendors && Array.isArray(vendors)) {
      vendors.forEach(v => {
        if (v.name && v.name.trim()) {
          list.add(v.name.trim());
        }
      });
    }
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [vendors]);

  const locationsList = useMemo(() => {
    const list = new Set<string>(PRESET_LOCATIONS);
    ingredients.forEach(ing => {
      if (ing.location && ing.location.trim().length > 0) {
        list.add(ing.location.trim());
      }
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [ingredients]);

  const categoriesList = useMemo(() => {
    const list = new Set<string>();
    ingredients.forEach(ing => {
      if (ing.category && ing.category.trim().length > 0) {
        list.add(ing.category.trim());
      }
    });
    const defaults = ["Meat", "Vegetables", "Fruit", "Bread", "Seafood", "Dairy", "Dry Goods", "Beverages", "Other"];
    defaults.forEach(c => list.add(c));
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [ingredients]);

  // Compute vendor string helper
  const getIngredientVendor = (ing: Ingredient) => {
    let rawVendor = "";
    if (ing.vendor && ing.vendor.trim().length > 0) {
      rawVendor = ing.vendor.trim();
    } else if (ing.source && ing.source.includes("(")) {
      const parts = ing.source.split("(");
      if (parts.length > 1) {
        const v = parts[1].replace(")", "").trim();
        if (v) rawVendor = v;
      }
    }

    if (!rawVendor) {
      return "Unknown / Manual";
    }

    const normalizedKey = getNormalizedVendorKey(rawVendor);
    const normalized = normalizedVendorMap.get(normalizedKey);
    return normalized || rawVendor;
  };

  // List of processed ingredients with stock values computed
  const processedIngredients = useMemo(() => {
    return ingredients.filter(ing => !ing.isHiddenFromInventory).map(ing => {
      const vendorName = getIngredientVendor(ing);
      const stock = ing.inStock !== undefined ? ing.inStock : undefined;
      const minStock = ing.minStock !== undefined && ing.minStock > 0 ? ing.minStock : 10;
      const location = ing.location || "Unassigned";
      
      let status: "good" | "low" | "out" | "untracked" = "untracked";
      if (stock !== undefined) {
        if (stock === 0) status = "out";
        else if (stock <= minStock) status = "low";
        else status = "good";
      }

      // Financial stock value calculated using standard ingredient unit rate and on-hand stock
      const value = stock !== undefined ? getItemAssetValue(ing, stock) : 0;

      return {
        ...ing,
        vendorName,
        stock,
        minStock,
        location,
        status,
        value
      };
    });
  }, [ingredients]);

  // Filter list
  const filteredList = useMemo(() => {
    return processedIngredients.filter(ing => {
      // 1. Search term (name, vendor, location)
      const queryStr = searchTerm.toLowerCase().trim();
      const matchSearch = 
        ing.name.toLowerCase().includes(queryStr) ||
        ing.vendorName.toLowerCase().includes(queryStr) ||
        ing.location.toLowerCase().includes(queryStr);

      // 2. Vendor filter
      let matchVendor = true;
      if (selectedVendor !== "ALL_VENDORS") {
        if (selectedVendor === "UNKNOWN_VENDOR") {
          matchVendor = ing.vendorName === "Unknown / Manual";
        } else {
          matchVendor = ing.vendorName.toLowerCase().trim() === selectedVendor.toLowerCase().trim();
        }
      }

      // 3. Location filter
      let matchLocation = true;
      if (selectedLocation !== "ALL_LOCATIONS") {
        if (selectedLocation === "UNASSIGNED") {
          matchLocation = ing.location === "Unassigned";
        } else {
          matchLocation = ing.location.toLowerCase().trim() === selectedLocation.toLowerCase().trim();
        }
      }

      // 3.5 Category filter
      let matchCategory = true;
      if (selectedCategory !== "ALL_CATEGORIES") {
        if (selectedCategory === "UNCATEGORIZED") {
          matchCategory = !ing.category || ing.category.trim() === "" || ing.category === "Other" || ing.category === "unassigned";
        } else {
          matchCategory = ing.category?.toLowerCase().trim() === selectedCategory.toLowerCase().trim();
        }
      }

      // 4. Low stock filter
      const matchLowStock = !lowStockOnly || ing.status === "low" || ing.status === "out";

      // 5. Untracked filter
      const matchUntracked = !untrackedOnly || ing.status === "untracked";

      // 6. Has stock filter
      const matchHasStock = !hasStockOnly || (ing.stock !== undefined && ing.stock > 0);

      return matchSearch && matchVendor && matchLocation && matchCategory && matchLowStock && matchUntracked && matchHasStock;
    });
  }, [processedIngredients, searchTerm, selectedVendor, selectedLocation, selectedCategory, lowStockOnly, untrackedOnly, hasStockOnly]);

  // Sorted list
  const sortedList = useMemo(() => {
    const list = [...filteredList];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "stock") {
        const valA = a.stock !== undefined ? a.stock : -1;
        const valB = b.stock !== undefined ? b.stock : -1;
        comparison = valA - valB;
      } else if (sortBy === "value") {
        comparison = a.value - b.value;
      } else if (sortBy === "vendor") {
        comparison = a.vendorName.localeCompare(b.vendorName);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
    return list;
  }, [filteredList, sortBy, sortOrder]);

  // Reset page when filters, sorting, or page size change
  useEffect(() => {
    setInventoryPage(1);
  }, [searchTerm, selectedVendor, selectedLocation, selectedCategory, lowStockOnly, untrackedOnly, hasStockOnly, sortBy, sortOrder, inventoryPageSize]);

  // Total pages
  const totalInventoryPages = useMemo(() => {
    if (inventoryPageSize === "ALL") return 1;
    return Math.max(1, Math.ceil(sortedList.length / inventoryPageSize));
  }, [sortedList.length, inventoryPageSize]);

  // Ensure current page is within valid bounds
  const safeInventoryPage = useMemo(() => {
    return Math.min(Math.max(1, inventoryPage), totalInventoryPages);
  }, [inventoryPage, totalInventoryPages]);

  // Current paginated slice of inventory items
  const paginatedInventoryList = useMemo(() => {
    if (inventoryPageSize === "ALL") return sortedList;
    const start = (safeInventoryPage - 1) * inventoryPageSize;
    return sortedList.slice(start, start + inventoryPageSize);
  }, [sortedList, safeInventoryPage, inventoryPageSize]);

  // All unsaved draft item count across all pages
  const unsavedCount = useMemo(() => {
    return Array.from(new Set([
      ...Object.keys(draftCounts),
      ...Object.keys(draftNames),
      ...Object.keys(draftPars),
      ...Object.keys(draftLocations),
      ...Object.keys(draftVendors),
      ...Object.keys(draftCategories),
      ...Object.keys(draftPcsPerPound),
      ...Object.keys(draftWeightPerCase),
      ...Object.keys(draftWeightPerCaseUnit),
      ...Object.keys(draftPackagingUnit),
      ...Object.keys(draftUnits),
      ...Object.keys(draftConversions)
    ])).length;
  }, [draftCounts, draftNames, draftPars, draftLocations, draftVendors, draftCategories, draftPcsPerPound, draftWeightPerCase, draftWeightPerCaseUnit, draftPackagingUnit, draftUnits, draftConversions]);

  // Current page item IDs
  const currentPageItemIds = useMemo(() => {
    return new Set(paginatedInventoryList.map(item => item.id));
  }, [paginatedInventoryList]);

  // Unsaved draft edits on other pages
  const unsavedCountAcrossOtherPages = useMemo(() => {
    const allUnsavedIds = Array.from(new Set([
      ...Object.keys(draftCounts),
      ...Object.keys(draftNames),
      ...Object.keys(draftPars),
      ...Object.keys(draftLocations),
      ...Object.keys(draftVendors),
      ...Object.keys(draftCategories),
      ...Object.keys(draftPcsPerPound),
      ...Object.keys(draftWeightPerCase),
      ...Object.keys(draftWeightPerCaseUnit),
      ...Object.keys(draftPackagingUnit),
      ...Object.keys(draftUnits),
      ...Object.keys(draftConversions)
    ]));
    return allUnsavedIds.filter(id => !currentPageItemIds.has(id)).length;
  }, [draftCounts, draftNames, draftPars, draftLocations, draftVendors, draftCategories, draftPcsPerPound, draftWeightPerCase, draftWeightPerCaseUnit, draftPackagingUnit, draftUnits, draftConversions, currentPageItemIds]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalValue = 0;
    let totalPounds = 0;
    let trackedCount = 0;
    let lowStockCount = 0;
    const trackedVendors = new Set<string>();

    processedIngredients.forEach(ing => {
      if (ing.stock !== undefined) {
        trackedCount++;

        const currentCnt = draftCounts[ing.id!] !== undefined ? draftCounts[ing.id!] : ing.stock;
        const wPerCase = draftWeightPerCase[ing.id!] !== undefined ? draftWeightPerCase[ing.id!] : ing.weightPerCase;
        const wPerCaseUnit = draftWeightPerCaseUnit[ing.id!] !== undefined ? draftWeightPerCaseUnit[ing.id!] : (ing.weightPerCaseUnit || "lb");
        const pcsRatio = draftPcsPerPound[ing.id!] !== undefined ? draftPcsPerPound[ing.id!] : ing.pcsPerPound;

        const itemVal = getItemAssetValue(ing, currentCnt, wPerCase, wPerCaseUnit, pcsRatio);
        totalValue += itemVal;

        const pInfo = calculatePoundData(currentCnt, ing.unit, wPerCase, wPerCaseUnit, pcsRatio, ing.quantity, ing.name);
        totalPounds += pInfo.lbs;

        if (ing.stock <= ing.minStock || ing.stock === 0) {
          lowStockCount++;
        }
        trackedVendors.add(ing.vendorName);
      }
    });

    return {
      totalValue,
      totalPounds,
      trackedCount,
      lowStockCount,
      vendorCount: trackedVendors.size
    };
  }, [processedIngredients, draftCounts, draftWeightPerCase, draftWeightPerCaseUnit, draftPcsPerPound]);

  // Handlers for quick count inputs
  const handleDraftChange = (id: string, valStr: string) => {
    const num = valStr === "" ? 0 : parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      setDraftCounts(prev => ({ ...prev, [id]: num }));
    }
  };

  const handleDraftParChange = (id: string, valStr: string) => {
    const num = valStr === "" ? 0 : parseFloat(valStr);
    if (!isNaN(num) && num >= 0) {
      setDraftPars(prev => ({ ...prev, [id]: num }));
    }
  };

  const adjustStock = (id: string, currentVal: number | undefined, delta: number) => {
    const base = draftCounts[id] !== undefined ? draftCounts[id] : (currentVal !== undefined ? currentVal : 0);
    const updated = Math.max(0, base + delta);
    setDraftCounts(prev => ({ ...prev, [id]: parseFloat(updated.toFixed(2)) }));
  };

  // Individual save count to Firestore
  const saveSingleCount = async (id: string) => {
    if (isReadOnly || !workspaceOwnerId) return;
    setSavingId(id);
    try {
      const updates: Partial<Ingredient> = {};
      if (draftCounts[id] !== undefined) updates.inStock = draftCounts[id];
      if (draftNames[id] !== undefined && draftNames[id].trim().length > 0) updates.name = draftNames[id].trim();
      if (draftPars[id] !== undefined) updates.minStock = draftPars[id];
      if (draftLocations[id] !== undefined) updates.location = draftLocations[id];
      if (draftVendors[id] !== undefined) updates.vendor = draftVendors[id];
      if (draftCategories[id] !== undefined) updates.category = draftCategories[id];
      if (draftUnits[id] !== undefined) updates.unit = draftUnits[id];
      if (draftWeightPerCase[id] !== undefined) {
        if (draftWeightPerCase[id] > 0) {
          updates.weightPerCase = draftWeightPerCase[id];
          updates.pcsPerPound = null as any;
        } else {
          updates.weightPerCase = null as any;
        }
      }
      if (draftPcsPerPound[id] !== undefined && !(updates.weightPerCase && updates.weightPerCase > 0)) {
        updates.pcsPerPound = draftPcsPerPound[id] > 0 ? draftPcsPerPound[id] : null as any;
      }
      if (draftWeightPerCaseUnit[id] !== undefined) updates.weightPerCaseUnit = draftWeightPerCaseUnit[id];
      if (draftPackagingUnit[id] !== undefined) updates.packagingUnit = draftPackagingUnit[id];
      if (draftConversions[id] !== undefined) updates.conversions = draftConversions[id].map(c => ({ ratio: parseFloat(c.ratio as any) || 0, targetUnit: c.targetUnit })).filter(c => c.ratio > 0 && c.targetUnit);

      updates.updatedAt = new Date().toISOString();

      await onEditIngredient(id, updates);
      
      // Clean up drafts for this item
      setDraftCounts(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftNames(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftPars(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftLocations(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftVendors(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftCategories(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftPcsPerPound(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftWeightPerCase(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftWeightPerCaseUnit(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftPackagingUnit(prev => { const next = { ...prev }; delete next[id]; return next; });
      setDraftConversions(prev => { const next = { ...prev }; delete next[id]; return next; });

    } catch (err) {
      console.error("Failed to save inventory item updates:", err);
    } finally {
      setSavingId(null);
    }
  };

  // Bulk Save all unsaved counts
  const saveAllDrafts = async () => {
    if (isReadOnly || !workspaceOwnerId) return;
    
    const countKeys = Object.keys(draftCounts);
    const nameKeys = Object.keys(draftNames);
    const parKeys = Object.keys(draftPars);
    const locKeys = Object.keys(draftLocations);
    const venKeys = Object.keys(draftVendors);
    const catKeys = Object.keys(draftCategories);
    const pKeys = Object.keys(draftPcsPerPound);
    const wKeys = Object.keys(draftWeightPerCase);
    const wuKeys = Object.keys(draftWeightPerCaseUnit);
    const puKeys = Object.keys(draftPackagingUnit);
    const cKeys = Object.keys(draftConversions);
    
    const uKeys = Object.keys(draftUnits);
    const uniqueIds = Array.from(new Set([...countKeys, ...nameKeys, ...parKeys, ...locKeys, ...venKeys, ...catKeys, ...uKeys, ...pKeys, ...wKeys, ...wuKeys, ...puKeys, ...cKeys]));
    
    if (uniqueIds.length === 0) return;
    
    setBulkSaving(true);
    try {
      for (const id of uniqueIds) {
        const updates: Partial<Ingredient> = {};
        if (draftCounts[id] !== undefined) updates.inStock = draftCounts[id];
        if (draftNames[id] !== undefined && draftNames[id].trim().length > 0) updates.name = draftNames[id].trim();
        if (draftPars[id] !== undefined) updates.minStock = draftPars[id];
        if (draftLocations[id] !== undefined) updates.location = draftLocations[id];
        if (draftVendors[id] !== undefined) updates.vendor = draftVendors[id];
        if (draftCategories[id] !== undefined) updates.category = draftCategories[id];
        if (draftUnits[id] !== undefined) updates.unit = draftUnits[id];
        if (draftPackagingUnit[id] !== undefined) updates.packagingUnit = draftPackagingUnit[id];
        if (draftWeightPerCase[id] !== undefined) {
          if (draftWeightPerCase[id] > 0) {
            updates.weightPerCase = draftWeightPerCase[id];
            updates.pcsPerPound = null as any;
          } else {
            updates.weightPerCase = null as any;
          }
        }
        if (draftPcsPerPound[id] !== undefined && !(updates.weightPerCase && updates.weightPerCase > 0)) {
          updates.pcsPerPound = draftPcsPerPound[id] > 0 ? draftPcsPerPound[id] : null as any;
        }
        if (draftWeightPerCaseUnit[id] !== undefined) {
          updates.weightPerCaseUnit = draftWeightPerCaseUnit[id];
        }
        if (draftPackagingUnit[id] !== undefined) {
          updates.packagingUnit = draftPackagingUnit[id];
        }
        if (draftConversions[id] !== undefined) {
          updates.conversions = draftConversions[id]
            .map(c => ({ ratio: parseFloat(c.ratio as any) || 0, targetUnit: c.targetUnit }))
            .filter(c => c.ratio > 0 && c.targetUnit);
        }

        updates.updatedAt = new Date().toISOString();
        await onEditIngredient(id, updates);
      }

      setDraftCounts({});
      setDraftNames({});
      setDraftPars({});
      setDraftLocations({});
      setDraftVendors({});
      setDraftCategories({});
      setDraftUnits({});
      setDraftPcsPerPound({});
      setDraftWeightPerCase({});
      setDraftWeightPerCaseUnit({});
      setDraftPackagingUnit({});
      setDraftConversions({});
    } catch (err) {
      console.error("Failed to apply bulk stock adjustments:", err);
    } finally {
      setBulkSaving(false);
    }
  };

  // Trigger quick initialization to start tracking stock
  const initializeTracking = async (id: string) => {
    if (isReadOnly) return;
    await onEditIngredient(id, {
      inStock: 0,
      minStock: 10,
      location: "Dry Storage",
      updatedAt: new Date().toISOString()
    });
  };

  // Finalize full physical stocktake and log history
  const finalizeStocktake = async () => {
    if (isReadOnly || !workspaceOwnerId || !user) return;
    
    const hasUnsaved = 
    Object.keys(draftCounts).length > 0 || 
    Object.keys(draftNames).length > 0 ||
    Object.keys(draftPars).length > 0 ||
    Object.keys(draftLocations).length > 0 ||
    Object.keys(draftVendors).length > 0 ||
    Object.keys(draftCategories).length > 0 ||
    Object.keys(draftWeightPerCase).length > 0 || 
    Object.keys(draftWeightPerCaseUnit).length > 0 || 
    Object.keys(draftPackagingUnit).length > 0 || 
    Object.keys(draftUnits).length > 0 || 
    Object.keys(draftConversions).length > 0 || 
    Object.keys(draftPcsPerPound).length > 0;

    if (hasUnsaved) {
      await saveAllDrafts();
    }

    // Refresh active list metrics
    const trackedItems = processedIngredients.filter(ing => ing.stock !== undefined);
    if (trackedItems.length === 0) {
      console.warn("No active stock items are currently tracked.");
      return;
    }

    try {
      const stocktakeItems = trackedItems.map(item => {
        const currentCnt = draftCounts[item.id!] !== undefined ? draftCounts[item.id!] : (item.stock ?? 0);
        const wPerCase = draftWeightPerCase[item.id!] !== undefined ? draftWeightPerCase[item.id!] : item.weightPerCase;
        const wPerCaseUnit = draftWeightPerCaseUnit[item.id!] !== undefined ? draftWeightPerCaseUnit[item.id!] : (item.weightPerCaseUnit || "lb");
        const pcsRatio = draftPcsPerPound[item.id!] !== undefined ? draftPcsPerPound[item.id!] : item.pcsPerPound;

        const pInfo = calculatePoundData(currentCnt, item.unit, wPerCase, wPerCaseUnit, pcsRatio, item.quantity);
        const rateInfo = getIngredientStandardRate(item);
        const itemVal = getItemAssetValue(item, currentCnt, wPerCase, wPerCaseUnit, pcsRatio);

        return {
          ingredientId: item.id || "",
          name: draftNames[item.id!] !== undefined ? draftNames[item.id!] : item.name,
          category: draftCategories[item.id!] !== undefined ? draftCategories[item.id!] : (item.category || "Unassigned"),
          inStock: currentCnt,
          unit: item.unit,
          price: item.price,
          unitRate: rateInfo.rateVal,
          rateUnit: rateInfo.unitLabel,
          value: itemVal,
          totalPounds: pInfo.lbs,
          hasWeightSpec: pInfo.hasWeightSpec,
          weightPerCase: wPerCase,
          weightPerCaseUnit: wPerCaseUnit,
          pcsPerPound: pcsRatio
        };
      });

      await safeAddDoc("inventory_counts", {
        date: new Date().toLocaleDateString(),
        totalValue: summaryMetrics.totalValue,
        totalPounds: summaryMetrics.totalPounds,
        totalItemsCount: trackedItems.length,
        lowStockCount: summaryMetrics.lowStockCount,
        vendorFilter: selectedVendor === "ALL_VENDORS" ? "All Suppliers" : selectedVendor,
        items: stocktakeItems,
        ownerId: workspaceOwnerId,
        createdAt: new Date().toISOString(),
        recordedBy: user.displayName || user.email || "System Operator"
      });

      setSubTab("history");
    } catch (err: any) {
      console.error("Failed to post stocktake log:", err);
    }
  };

  // Delete a historical log
  const deleteHistoryLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    
    try {
      await safeDeleteDoc("inventory_counts", id);
      if (selectedHistoryItem?.id === id) {
        setSelectedHistoryItem(null);
      }
    } catch (err: any) {
      console.error("Failed to remove historical log:", err);
    }
  };

  // Print sheet or export checklist
  const printChecklist = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const rowsHtml = sortedList.map((item, index) => {
      const location = item.location || "Unassigned";
      const vendorName = item.vendorName || "Unknown / Manual";
      const poundInfo = calculatePoundData(item.stock || 0, item.unit, item.weightPerCase, item.weightPerCaseUnit, item.pcsPerPound, item.quantity);
      const poundDisplay = poundInfo.hasWeightSpec ? `${poundInfo.lbs.toFixed(2)} lbs` : "-";

      return `
        <tr style="border-bottom: 1px solid #141414;">
          <td style="padding: 10px 8px; border-right: 1px solid #141414; font-size: 11px; text-align: center;">${index + 1}</td>
          <td style="padding: 10px 8px; border-right: 1px solid #141414; font-size: 12px; font-weight: bold;">${item.name}</td>
          <td style="padding: 10px 8px; border-right: 1px solid #141414; font-size: 11px;">${location}</td>
          <td style="padding: 10px 8px; border-right: 1px solid #141414; font-size: 11px;">${vendorName}</td>
          <td style="padding: 10px 8px; border-right: 1px solid #141414; font-size: 11px; font-family: monospace;">${item.quantity} ${item.unit}</td>
          <td style="padding: 10px 8px; border-right: 1px solid #141414; font-size: 11px; text-align: center; font-family: monospace;">${item.stock !== undefined ? item.stock : "-"}</td>
          <td style="padding: 10px 8px; border-right: 1px solid #141414; font-size: 11px; text-align: center; font-family: monospace; font-weight: bold; color: #065f46;">${poundDisplay}</td>
          <td style="padding: 10px 8px; border-right: 1px solid #141414; font-size: 11px; text-align: center; font-family: monospace;">${item.minStock !== undefined ? item.minStock : "-"}</td>
          <td style="padding: 10px 8px; width: 100px; border-right: 1px solid #141414;"></td>
        </tr>
      `;
    }).join("");

    const dateStr = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Inventory Checklist</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 20px;
            color: #141414;
            background: #fff;
          }
          .header {
            text-align: left;
            margin-bottom: 25px;
            border-bottom: 3px solid #141414;
            padding-bottom: 12px;
          }
          .header h1 {
            margin: 0;
            font-size: 22px;
            text-transform: ;
            font-family: "Courier New", Courier, monospace;
            font-weight: 900;
            letter-spacing: 1px;
          }
          .header p {
            margin: 6px 0 0 0;
            font-size: 11px;
            text-transform: ;
            font-family: monospace;
            font-weight: bold;
            color: #555;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            border: 3px solid #141414;
          }
          th {
            background-color: #f0efeb;
            font-size: 10px;
            text-transform: ;
            font-weight: 900;
            font-family: monospace;
            letter-spacing: 0.5px;
            padding: 10px 8px;
            border: 2px solid #141414;
            text-align: left;
          }
          td {
            border: 1px solid #141414;
          }
          @media print {
            body {
              margin: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INVENTORY COUNT CHECKLIST</h1>
          <p>Generated on ${dateStr} | Filtered by Location: ${selectedLocation === "ALL_LOCATIONS" ? "All" : selectedLocation} | Vendor: ${selectedVendor === "ALL_VENDORS" ? "All" : selectedVendor}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Item Name</th>
              <th style="width: 140px;">Storage Location</th>
              <th style="width: 140px;">Supplier / Vendor</th>
              <th style="width: 100px;">Pack Size</th>
              <th style="width: 70px; text-align: center;">Current (Pks)</th>
              <th style="width: 90px; text-align: center; color: #065f46;">Pound Data (lbs)</th>
              <th style="width: 60px; text-align: center;">Par (Pks)</th>
              <th style="width: 110px; text-align: center; background-color: #e5e5e5;">Physical Count</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Download filtered inventory as a CSV spreadsheet
  const downloadCSV = () => {
    const headers = [
      "Item Name", 
      "Category",
      "Storage Location", 
      "Supplier/Vendor", 
      "Price Per Pack ($)", 
      "Pack Size Amount", 
      "Pack Size Unit", 
      "In Stock (Packs)",
      "Total Weight (Pounds / lbs)", 
      "Min Stock (Packs)", 
      "On-Hand Value ($)"
    ];
    
    // Sort primarily by Category, then by Item Name
    const csvSortedList = [...sortedList].sort((a, b) => {
      const catA = a.category || "Unassigned";
      const catB = b.category || "Unassigned";
      const catCompare = catA.localeCompare(catB);
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    });

    const rows = csvSortedList.map(item => {
      const poundInfo = calculatePoundData(item.stock || 0, item.unit, item.weightPerCase, item.weightPerCaseUnit, item.pcsPerPound, item.quantity);
      const poundVal = poundInfo.hasWeightSpec ? poundInfo.lbs.toFixed(2) : "Unspecified";

      return [
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${(item.category || "Unassigned").replace(/"/g, '""')}"`,
        `"${(item.location || "Unassigned").replace(/"/g, '""')}"`,
        `"${(item.vendorName || "Unknown / Manual").replace(/"/g, '""')}"`,
        item.price || 0,
        item.quantity || 0,
        `"${(item.unit || "").replace(/"/g, '""')}"`,
        item.stock !== undefined ? item.stock : "",
        `"${poundVal}"`,
        item.minStock !== undefined ? item.minStock : "",
        item.stock !== undefined ? (item.stock * item.price).toFixed(2) : "0.00"
      ];
    });

    const csvString = [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download filtered inventory as JSON
  const downloadJSON = () => {
    const csvSortedList = [...sortedList].sort((a, b) => {
      const catA = a.category || "Unassigned";
      const catB = b.category || "Unassigned";
      const catCompare = catA.localeCompare(catB);
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    });

    const jsonItems = csvSortedList.map(item => {
      const poundInfo = calculatePoundData(item.stock || 0, item.unit, item.weightPerCase, item.weightPerCaseUnit, item.pcsPerPound, item.quantity);
      return {
        id: item.id,
        name: item.name || "",
        category: item.category || "Unassigned",
        location: item.location || "Unassigned",
        vendorName: item.vendorName || "Unknown / Manual",
        pricePerPack: item.price || 0,
        packSizeAmount: item.quantity || 0,
        packSizeUnit: item.unit || "",
        inStockPacks: item.stock !== undefined ? item.stock : 0,
        totalWeightPounds: poundInfo.hasWeightSpec ? Number(poundInfo.lbs.toFixed(2)) : null,
        minStockPacks: item.minStock !== undefined ? item.minStock : 0,
        onHandValue: item.stock !== undefined ? Number((item.stock * item.price).toFixed(2)) : 0
      };
    });

    const jsonString = JSON.stringify(jsonItems, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_report_${new Date().toISOString().slice(0, 10)}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit ingredient consumption entry
  const handleSaveConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    // allow staff (isReadOnly) to submit consumption logs
    // if (isReadOnly) return;
    if (!selectedIngredientId) {
      setConsumptionMessage({ type: "error", text: "Please select an ingredient item." });
      return;
    }
    const qtyNum = parseFloat(consumedQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setConsumptionMessage({ type: "error", text: "Please enter a valid positive quantity." });
      return;
    }
    const vendorName = isCustomVendor ? customVendorName.trim() : consumptionVendor;
    if (!vendorName.trim()) {
      setConsumptionMessage({ type: "error", text: "Please specify a restaurant name." });
      return;
    }

    const selectedIng = ingredients.find(i => i.id === selectedIngredientId);
    if (!selectedIng) {
      setConsumptionMessage({ type: "error", text: "Selected ingredient not found in catalog." });
      return;
    }

    const currentStock = selectedIng.inStock !== undefined ? selectedIng.inStock : 0;
    const { packagesToDeduct, displayCost, warning } = calculation;

    if (warning) {
      console.warn("Conversion warning:", warning);
    }

    setSubmittingConsumption(true);
    setConsumptionMessage(null);

    try {
      const consumptionRecord: Omit<ConsumptionLog, "id"> = {
        date: consumptionDate,
        vendorName: vendorName,
        ingredientId: selectedIngredientId,
        ingredientName: selectedIng.name,
        quantity: qtyNum,
        unit: consumptionUnit,
        pricePerPack: selectedIng.price,
        totalCost: displayCost,
        recordedBy: recordedBy.trim() || "System Operator",
        ownerId: workspaceOwnerId!,
        createdAt: new Date().toISOString()
      };

      // 1. Add to Firestore inventory_consumptions collection
      await safeAddDoc("inventory_consumptions", consumptionRecord);

      // 2. Automatically update (deduct) from current in-stock physical count
      if (autoUpdateStock) {
        const newStock = Math.max(0, parseFloat((currentStock - packagesToDeduct).toFixed(4)));
        await onEditIngredient(selectedIngredientId, {
          inStock: newStock
        });
      }

      setConsumptionMessage({
        type: "success",
        text: `Successfully recorded consumption of ${qtyNum} ${consumptionUnit} of ${selectedIng.name} for restaurant ${vendorName}!`
      });

      // Clear part of the form
      setSelectedIngredientId("");
      setConsumedQty("");
      setConsumptionVendor("");
      setIsCustomVendor(false);
      setCustomVendorName("");
      setConsumptionPage(1);
    } catch (err: any) {
      console.error("Error saving consumption log:", err);
      setConsumptionMessage({
        type: "error",
        text: `Error registering consumption: ${err.message || err}`
      });
    } finally {
      setSubmittingConsumption(false);
    }
  };

  // Delete vendor consumption entry
  const handleDeleteConsumptionLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    
    try {
      const log = consumptions.find(c => c.id === id);
      if (log) {
        const ingredient = ingredients.find(ing => ing.id === log.ingredientId);
        if (ingredient) {
          const currentStock = ingredient.inStock !== undefined ? ingredient.inStock : 0;
          const nativeQty = convertInputToNativeQty(Math.abs(log.quantity), log.unit, ingredient);
          const adjustment = log.quantity > 0 ? nativeQty : -nativeQty;
          const newStock = Math.max(0, parseFloat((currentStock + adjustment).toFixed(4)));
          await onEditIngredient(ingredient.id!, {
            inStock: newStock
          });
        }
      }
      await safeDeleteDoc("inventory_consumptions", id);
    } catch (err: any) {
      console.error("Error deleting consumption log:", err);
    }
  };

  const handleSaveUnit = async (item: Ingredient) => {
    if (isReadOnly) return;
    try {
      const pricePerGram = calculateIngredientUnitPrice({
        price: item.price,
        quantity: item.quantity,
        unit: editingUnitVal,
        weightPerCase: item.weightPerCase,
        weightPerCaseUnit: item.weightPerCaseUnit,
        pcsPerPound: item.pcsPerPound,
        conversions: item.conversions,
      });

      await onEditIngredient(item.id!, { 
        unit: editingUnitVal, 
        pricePerGram 
      });
      setEditingUnitId(null);
    } catch (err) {
      console.error("Error saving unit:", err);
    }
  };

  const handleClearAll = () => {
    if (isReadOnly) return;
    setShowClearConfirm(true);
  };

  const handleClearAllConfirm = async () => {
    if (isReadOnly) return;
    
    for (const item of ingredients) {
      if (item.id) {
        await onDeleteIngredient(item.id);
      }
    }
    setShowClearConfirm(false);
  };

  const handleSeedData = async () => {
    if (isReadOnly) return;
    const seedData = [
      { vendor: "NEBRASKA", items: ["PORK", "BACON", "PORK BUTT", "PORK LOIN", "SPARE RIB", "CHORIZO (PORK)", "PORK BELLY SKINLESS", "BEEF", "FLANK STEAK (40LB PER CASE)", "SHANK (AROUND 70-80 LB PER CASE)", "BEEF CHUCK ROLL", "CHICKEN", "CHICKEN BREAST", "CHICKEN THIGH", "CHICKEN WING", "VEGAN", "IMPOSSIBLE BURGER (4OZ)"] },
      { vendor: "FANCY FOODS", items: ["SPICY PORK", "BULGOGI", "LA GALBI", "SHORT RIB 1.5\"", "PORK BELLY (SKINLESS)", "SHORT RIB WHOLE", "BEEF BONE"] },
      { vendor: "PLYMOUTH BEEF", items: ["GROUND BEEF", "BURGER PATTY (8OZ)"] },
      { vendor: "LILY PRODUCE", items: ["ARGULA", "FUJI RED APPLE", "BASIL", "GREEN APPLE", "BEETS LOOSE", "BANANA - YELLOW", "CROWN BROCCOLI", "PLAINTAIN -YELLOW", "CABBAGE GREEN", "STRAWBERRY DRISCOL", "CABBAGE RED", "BLUEBERRY", "CAULIFLOWER", "BLACK BERRY", "CARROTS LOOSE", "RASPBERRY", "CARROTS CELLO", "CHERRY", "CELERY", "GREEN GRAPE SEEDLESS", "CORN YELLOW", "RED GRAPE SEEDLESS", "CUCUMBER SUPER", "KIWI BASKET", "CUCUMBER HOT HOUSE(ENGLISH)", "LEMON", "GARLIC PEEL", "LIME", "GINGER", "MANGO MEX", "HERB - MINT", "CANTALOUPE 12", "HERB - ROSEMARY", "HONEYDEW", "HERB - AMERICAN CHIVE", "WATERMELON SEEDLESS", "HERB - PARSLEY ITALIAN", "PIINEAPPLE", "HERB - CILANTRO", "JUICE ORANGE", "CHINESE CHIVE", "KOREAN PEAR", "ICEBERG LETTUCE", "TOMATO 5X6", "GREEN LEAF LETTUCE", "GRAPE TOMATO", "RED LEAF LETTUCE", "CHERRY TOMATO", "ROMAINE HEARTS LETTUCE", "PLUM TOMATO", "MESCLUN (SPRING MIX)", "TOMATILLO", "MUSHROOM 10LBS LG", "SWEET POTATO", "OYSTER MUSHROOM", "SERRANO PEPPER", "ENOKI MUSHROOM", "KOREAN FRESH RED PEPPER", "ONION RED", "FINGERING POTATO", "SPANISH ONION", "KOREAN SWEET POTATO (KOIMO)", "BOKCHOY", "SCALLION", "BABY BOKCHOY", "BABY SPINACH", "NAPA CABBAGE", "SPINACH BUSHEL", "KOREAN RADISH", "SQUASH GREEN", "RED RADISH LOOSE", "SQUASH YELLOW", "PEPPER GREEN", "KABOCHA", "PEPPER RED", "BEAN SPROUTS", "YELLOW PEPPER", "SOY BEAN SPROUTS", "JALAPENO LARGE", "HASS AVOCADO", "IDAHO POTATO 80", "EGG"] },
      { vendor: "OUT OF THE BLUE", items: ["ATLANTIC WHOLE SALMON", "POLLOCK FILLET", "ATLANTIC SALMON FILLET", "FROZEN OCTOPUS", "CHERRY STONE CLAMS", "FROZEN SWAI"] },
      { vendor: "SYSCO", items: ["DURUM FLOUR", "ALL TRUMP FLOUR", "PESTO SAUCE", "FRENCH FRIES", "TORTILLA 4 CORN", "TORTILLA 6 CORN", "TORTILLA 10 FLOUR", "TORTILLA 12 FLOUR", "OYSTER CRACKER", "DRIED GUAJILLO", "CREAM CHEESE(PHILA BLOCK)", "QUESO FRESCO", "FONTINA CHEESE", "BURRATA CHEESE 8/2 OZ", "GOAT CHEESE", "BRIE CHEESE", "BLUE CHEESE CRUMB", "RICOTTA", "MASCARPONE", "ACHIOTE (AMAZON)", "HARISSA", "GARLIC FLAKES", "FRESH YEAST", "CROUTON", "AL PASTOR", "PANCETTA", "SHRIMP 13/15", "SHRIMP 16/20", "POLAND SPRING 0.5L", "POLAND SPRING SPORTS CAP", "POLAND SPRING 1L", "POLAND SPRING 1.5L", "PENNE RIOATE", "SPAGHETTI THIN", "DRIED FETTUCINI", "LINGUINI FINI", "FUSILLI", "GNOCCHI", "LEMON BLUEBERRY COOKIE", "REESE'S PEANUT BUTTER COOKIE", "TRIPLE CHOCOLATE COOKIE", "COOKIE'S AND CREAM COOKIE"] },
      { vendor: "BARTLETT DAIRY", items: ["WHOLE MILK", "FAT FREE MILK", "ALMOND MILK", "OAT MILK", "SOY MILK", "HEAVY CREAM", "HALF&HALF", "EGG WHITE", "EGG YOLK", "SOUR CREAM", "VANILLA SYRUP", "HAZELNUT SYRUP", "CARAMEL SYRUP", "STRAWBERRY PUREE", "MANGO PUREE"] },
      { vendor: "PEIMCO", items: ["AJI AMARILLO", "ROCOTO", "AJI PANCA SALSA", "MAIZ MORADO", "MAIZ CHULPE", "ACEITUNAS DE BOTIJA", "PRUVIAN PISCO", "CHICHA JORA", "CHOCLO DESGRANADO", "INKA KOLA"] },
      { vendor: "OMEGA FISH", items: ["SALMON", "FLUKE", "SHIRMP TEMPURA", "EEL", "KANI STICK", "EDAMAME", "KAMABOKO", "BLOCK TUNA", "CHOPPED TUNA", "POKE TUNA", "TAMAGO", "SD51", "WHITE GINGER", "VEGGIE GYOZA", "UDON", "SUSHI RICE", "MASAGO", "SEAWEED SALAD", "SHUMAI", "EEL SAUCE", "TSUYU SAUCE", "SHIRO DASHI", "KATSUOBUSHI DASHI", "DASHI KOMBU", "LOBSTER SALAD", "UNI", "KAMPACHI", "HAMACHI", "INARI", "TOGO SOY SAUCE", "WAKAME", "SHICHIMI", "KIZAMI NORI", "WASABI", "SHIME SABA", "PICKLED DAIKON", "NORI (HALF SIZE)", "NORI (FULL SIZE)", "SOBA", "SWEET EBI", "#6, #8, #15 CONTAINER", "DONBURI BOWL", "FURIKAKE", "LUNCH BOX", "SUSHI SHRIMP", "CRUNCHY", "MISO", "SUSHI GLOVES", "IKURA", "HOT SAUCE"] },
      { vendor: "ALL BREAD", items: ["HERO", "ROLL", "WHITE SLICED BREAD", "WHOLE WHEAT SLICED BREAD", "MULTI GRAIN SLICED BREAD", "CROISSANT", "PLAIN BAGEL (5 DZN PER BOX)", "WHOLE WHEAT BAGEL (5 DZN PER BOX)", "EVERYTHING BAGEL (5 DZN PER BOX)", "SESAME BAGEL (5 DZN PER BOX)", "CINNAMON RAISIN BAGEL (5 DZN PER BOX)", "ONION BAGEL (5 DZN PER BOX)", "BRIOCHE BURGER BUN", "DINNER ROLL", "CIABATTA", "WHOLE BRIOCHE", "SOUR DOUGH 1LB", "CHOCOLATE", "DOUBLE CHOCOLATE", "CHOCOLATE CHIP", "BLUEBERRY", "MARBLE", "BANANA", "CORN", "WALNUT", "CRANBERRY", "PISTACHIO", "CARROT", "RAISIN BRAN", "CINNAMON BUN", "CINNAMON HORN", "CHOCOLATE HORN", "APPLE TURNOVER", "CHEESE DANISH", "ALMOND CROISSANT", "CHOCOLATE CROISSANT"] },
      { vendor: "GIANT LIST", items: ["ITALIAN DRESSING", "HELLMAN MAYO", "CONWAY SESAME GINGER", "KRAFT BLUE CHEESE DRESSING", "KRAFT GOLDEN ITALIAN", "KRAFT CAESAR", "TAHINI SAUCE", "NUTELLA", "JASMIN RICE", "WHITE RICE", "PAR BOILED RICE", "BROWN RICE", "PANKO", "AP FLOUR", "00 FLOUR", "GRANOLA", "PANCAKE MIX", "CORN STARCH", "RED QUINOA", "WHITE QUINOA", "SLICED ALMOND", "DRIED CRANBERRIES", "RAISIN", "WALNUT", "RICE FLOUR", "PINE NUTS 5# BAG", "SOY SAUCE", "OYSTER SAUCE", "HOISIN SAUCE", "ALTA CUCINA WHOLE TOMATO", "OIL", "POMACE OLIVE OIL", "EXTRA VIRGIN OLIVE OIL", "SESAME OIL", "TRUFFLE OIL", "BROWN SUGAR", "WHITE SUGAR", "CHICKEN STOCK FLAVORED SOUP BASE POWDER", "SALT", "BLACK PEPPER", "GROUND TURMERIC", "CORN SYRUP", "MAPLE SYRUP", "SAFFRON FILAMENTS", "DASHIDA", "GOCHUGARU FINE", "GOCHUGARU COURSE", "GOCHUJANG", "TZATZIKI", "LOTTE MIRIM", "FISHCAKE", "RICE CAKE", "SHIN RAMYUN", "WHITE COOKING WINE", "WHITE VINEGAR", "APPLE VINEGAR", "BALSAMIC VINAIGRETTE", "TERIYAKI GLAZE", "HONEY BLEND", "LEMON JUICE", "GRAVY MASTER", "KETCHUP", "YELLOW MUSTARD", "BBQ SAUCE", "SWEET CHILI SAUCE", "TONKATSU SAUCE", "WORCESTERSHIRE SAUCE", "SAZON GOYA", "MSG", "SUSHI VINEGAR", "HONDASHI", "ADOBO", "CAYNENNE PEPPER", "WHITE PEPPER", "WHOLE CLOVES", "CHILI POWDER", "GROUND CUMIN", "RED CAYENNE PEPPER", "SPANISH PAPRIKA", "SHELLED EDAMAME", "RED WINE VINEGAR", "SOUR CREAM", "LEE&GIANT CHEESE", "FETA", "GRATED PARM", "SH MONTEREY CHEDDAR", "SH MOZZ", "AMERICAN CHEESE", "CHEDDAR CHEESE", "MOZZARELLA CHEESE", "PEPPER JACK CHEESE", "PROVOLONE CHEESE", "SWISS CHEESE", "FRESH MOZZARELLA CHEESE", "PORK DUMPLING", "VEGGIE DUMPLING", "BREADED SHRIMP", "SPRING ROLL", "MOZZARELLA STICKS", "TATER TOTS", "HASH BROWN", "BACON", "SHIN RAMEN", "KIMCHI", "GLASS NOODLE", "PEAR JUICE", "BUTTER BLEND", "ITALIAN SWEET SAUSAGE", "PEPPERONI", "PICKLE", "SAUSAGE PATTY", "BEEF SAUSAGE", "HOTDOG SAUSAGE (LONG)", "TURKEY SAUSAGE", "TURKEY BACON", "CHIPOTLE MORITA", "CORN KERNEL", "CAN TUNA", "CHICK PEAS", "PINTO BEANS", "ROASTED RED PEPPER", "SLICED JALAPENO (JAR)", "ARTICHOKE HEARTS", "TOMATO PASTE", "POMODORO SAM MALZANNO", "PIZZA SAUCE", "RED KIDNEY BEANS", "BLACK BEANS", "CANNELLINI BEANS", "SLICED BLACK OLIVES", "CHUNK PINEAPPLE", "KALAMATA OLIVES", "POTATO CROQUETTE", "TOFU FIRM", "SILKEN TOFU", "FROZEN MIXED VEGETABLES", "FIG JAM (AMAZON)", "SWISS MISS MILK CHOCOLATE POWDER", "WHOLE BAY LEAVES", "THYME LEAVES", "GROUND GINGER", "ONION POWDER", "GARLIC POWDER", "PACKET MAYO", "PACKET MUSTARD", "PACKET KETCHUP", "PACKET HOT SAUCE", "PACKET SOY SAUCE", "PACKET SALT", "PACKET BLACK PEPPER", "S&B CURRY", "GROUND OREGANO", "BROWN SUGAR PACKET", "WHITE SUGAR PACKET", "SPLENDA PACKET", "SWEET N LOW PACKET", "PARSELEY FLAKES", "CRUSHED RED PEPPER", "LOMEIN NOODLE", "SESAME SEEDS"] }
    ];

    for (const group of seedData) {
      for (const itemName of group.items) {
        const existing = ingredients.find(i => i.name.toLowerCase() === itemName.toLowerCase() && i.vendor === group.vendor);
        if (!existing) {
          await onAddIngredient({
            name: itemName,
            price: 0,
            unit: "lbs",
            vendor: group.vendor,
            location: "Walk-In Cooler",
            inStock: 0,
            minStock: 0,
            quantity: 1,
            pricePerGram: 0,
            source: "Manual Inventory Ledger"
          });
        }
      }
    }
  };


  const handleRunAiBatchParser = async () => {
    if (!batchInputText.trim()) return;
    setIsAiParsing(true);
    setApiError("");
    setApiSuccess("");
    try {
      const depts = departments.map(d => d.name);
      
      const response = await fetch("/api/parse-inventory-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: batchInputText,
          departments: depts,
          targetDepartment: batchTargetDept,
          targetVendor: batchTargetVendor
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.items && Array.isArray(data.items)) {
        setAiInventoryItems(data.items);
        if (data.items.length > 0) {
          setApiSuccess(`Parsed ${data.items.length} items successfully.`);
        } else {
          setApiError("No items were extracted from the document.");
        }
      } else {
        setApiError("Invalid response format from AI.");
      }
    } catch (err: any) {
      setApiError(err.message || "Failed to parse document.");
    } finally {
      setIsAiParsing(false);
    }
  };
  
  const handleImportAllItems = async () => {
    setApiError("");
    setApiSuccess("");
    
    let imported = 0;
    const errors: string[] = [];
    const targetOwnerId = workspaceOwnerId || user?.uid || "";
    const localIngredientsMap = new Map<string, any>();
    
    for (const item of aiInventoryItems) {
      try {
        const rawQtyStr = String(item.quantity || "").replace(/[^0-9.]/g, '');
        const qty = Number(rawQtyStr) || 1;
        const rawPriceStr = String(item.price || "").replace(/[^0-9.]/g, '');
        const price = Number(rawPriceStr) || 0;
        const effectiveVendor = (item.vendor && item.vendor.trim()) || (batchTargetVendor && batchTargetVendor.trim()) || "AI Document Parser";
        const effectiveDepartment = (item.department && item.department.trim()) || (batchTargetDept && batchTargetDept !== "AUTO" ? batchTargetDept : "Dry Goods");

        // Find in local map by name first, then fallback to original ingredients list
        const itemNameLower = (item.name || "").toLowerCase().trim();
        let matchingIng: any = undefined;
        
        for (const localIng of localIngredientsMap.values()) {
          if (localIng.name && localIng.name.toLowerCase().trim() === itemNameLower) {
            matchingIng = localIng;
            break;
          }
        }
        
        if (!matchingIng) {
          matchingIng = ingredients.find(ing => (ing.name || "").toLowerCase().trim() === itemNameLower);
        }
        
        let targetId = "";
        
        // Extract weight specs from item name if available
        const nameSpec = extractWeightSpecFromName(item.name);
        const effectiveWpc = nameSpec?.weight;
        const effectiveWpcUnit = nameSpec?.unit || "lb";

        if (matchingIng && matchingIng.id) {
          // Determine target unit and incoming unit
          const targetUnit = (matchingIng.unit || item.unit || "ea").toLowerCase().trim();
          const incomingUnit = (item.unit || targetUnit).toLowerCase().trim();
          const matchingWpc = matchingIng.weightPerCase || effectiveWpc;
          const matchingWpcUnit = matchingIng.weightPerCaseUnit || effectiveWpcUnit || "lb";

          let addedStock = qty;
          if (incomingUnit !== targetUnit) {
            const incomingPounds = calculatePoundData(qty, incomingUnit, matchingWpc, matchingWpcUnit, matchingIng.pcsPerPound, undefined, item.name).lbs;
            if (["lb", "lbs", "pound", "pounds"].includes(targetUnit) && incomingPounds > 0) {
              addedStock = incomingPounds;
            } else if (["oz", "ounce", "ounces"].includes(targetUnit) && incomingPounds > 0) {
              addedStock = incomingPounds * 16;
            } else if (["kg", "kilogram", "kilograms"].includes(targetUnit) && incomingPounds > 0) {
              addedStock = incomingPounds * 0.45359237;
            } else if (["g", "gram", "grams"].includes(targetUnit) && incomingPounds > 0) {
              addedStock = incomingPounds * 453.59237;
            } else if (["case", "cases", "box", "boxes", "bag", "bags", "pack", "packs"].includes(targetUnit) && matchingWpc && matchingWpc > 0) {
              const caseLbs = calculatePoundData(1, targetUnit, matchingWpc, matchingWpcUnit).lbs;
              if (caseLbs > 0) addedStock = incomingPounds / caseLbs;
            } else {
              const gEq = getGramsOrMlEquivalent(qty, incomingUnit);
              if (gEq > 0) {
                const converted = convertFromGrams(gEq, targetUnit);
                if (converted > 0) addedStock = converted;
              }
            }
          }

          // Update existing ingredient to pile stock
          const currentStock = typeof matchingIng.inStock === "number" ? matchingIng.inStock : 0;
          const newStock = currentStock + addedStock;
          const newPrice = price > 0 ? (price / (addedStock > 0 ? addedStock : 1)) : matchingIng.price;
          
          await safeUpdateDoc("ingredients", matchingIng.id, {
            inStock: newStock,
            price: newPrice,
            ...(matchingWpc && matchingWpc > 0 ? {
              weightPerCase: matchingWpc,
              weightPerCaseUnit: matchingWpcUnit
            } : {}),
            updatedAt: new Date().toISOString()
          });
          
          localIngredientsMap.set(matchingIng.id, {
            ...matchingIng,
            inStock: newStock,
            price: newPrice,
            ...(matchingWpc && matchingWpc > 0 ? {
              weightPerCase: matchingWpc,
              weightPerCaseUnit: matchingWpcUnit
            } : {})
          });
          
          targetId = matchingIng.id;
        } else {
          // Create new ingredient
          const newDocRef = await safeAddDoc("ingredients", {
            name: item.name,
            department: effectiveDepartment,
            vendor: effectiveVendor,
            unit: item.unit || "ea",
            price: price,
            quantity: 1,
            inStock: qty,
            ownerId: targetOwnerId,
            ...(effectiveWpc && effectiveWpc > 0 ? {
              weightPerCase: effectiveWpc,
              weightPerCaseUnit: effectiveWpcUnit
            } : {}),
            createdAt: new Date().toISOString()
          });
          targetId = newDocRef.id;
          
          // Track the newly created ingredient so subsequent items with the exact same name pile onto it instead of recreating
          localIngredientsMap.set(targetId, {
            id: targetId,
            name: item.name,
            inStock: qty,
            price: price,
            unit: item.unit || "ea",
            ...(effectiveWpc && effectiveWpc > 0 ? {
              weightPerCase: effectiveWpc,
              weightPerCaseUnit: effectiveWpcUnit
            } : {})
          });
        }
        
        imported++;

        // Record inbound receiving in Restaurant Ingredient Consumption Log
        if (qty > 0 && targetOwnerId) {
          try {
            const consumptionRecord: Omit<ConsumptionLog, "id"> = {
              date: new Date().toISOString().slice(0, 10),
              vendorName: effectiveVendor,
              ingredientId: targetId,
              ingredientName: matchingIng ? matchingIng.name : item.name,
              quantity: -Math.abs(qty), // Negative quantity represents addition / restock
              unit: matchingIng?.unit || item.unit || "ea",
              pricePerPack: price > 0 ? price : (matchingIng?.price || 0),
              totalCost: -Math.abs((price > 0 ? price : (matchingIng?.price || 0)) * qty), // Negative cost represents inbound delivery
              recordedBy: "AI Batch Parser",
              operatorName: user?.displayName || user?.email || "AI Batch Parser",
              ownerId: targetOwnerId,
              createdAt: new Date().toISOString()
            };
            await safeAddDoc("inventory_consumptions", consumptionRecord);
          } catch (consErr) {
            console.error("Failed to log consumption for batch parsed item:", consErr);
          }
        }
      } catch (err: any) {
        errors.push(`Failed to import ${item.name}: ${err.message}`);
      }
    }
    
    if (imported > 0) {
      // Also register an invoice record so it appears in the Invoices tab
      if (targetOwnerId) {
        try {
          const totalAmount = aiInventoryItems.reduce((acc, it) => acc + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);
          const effectiveVendor = (batchTargetVendor && batchTargetVendor.trim()) || "AI Document Parser";
          await safeAddDoc("invoices", {
            fileName: "Batch Inventory Parser Import",
            invoiceNumber: `BATCH-${Date.now().toString().slice(-6)}`,
            vendor: effectiveVendor,
            issueDate: new Date().toISOString().slice(0, 10),
            type: "standard_invoice",
            items: aiInventoryItems.map(it => ({
              name: it.name || "Item",
              unit: it.unit || "ea",
              quantity: Number(it.quantity) || 1,
              totalPrice: (Number(it.price) || 0) * (Number(it.quantity) || 1),
              pricePerUnit: Number(it.price) || 0
            })),
            totalAmount,
            status: "applied",
            ownerId: targetOwnerId,
            createdAt: new Date().toISOString()
          });
        } catch (invErr) {
          console.warn("Could not register invoice record for batch import:", invErr);
        }
      }

      setApiSuccess(`Successfully imported ${imported} items!`);
      setAiInventoryItems([]);
      setShowAIBatchParser(false);
      setBatchInputText("");
    }
    if (errors.length > 0) {
      setApiError(errors.join(" | "));
    }
  };


  const handleOpenAddModal = () => {
    if (vendorsList.length > 0) {
      setNewItemVendor(vendorsList[0]);
    } else {
      setNewItemVendor("Unassigned");
    }
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || newItemPrice === "" || isReadOnly) return;

    try {
      await onAddIngredient({
        name: newItemName.trim(),
        price: parseFloat(newItemPrice) || 0,
        unit: newItemUnit.trim() || "lbs",
        vendor: newItemVendor || (vendorsList.length > 0 ? vendorsList[0] : "Unassigned"),
        location: newItemLocation,
        category: newItemCategory,
        inStock: 0,
        minStock: 0,
        quantity: 1, // default quantity per case
        pricePerGram: parseFloat(newItemPrice) || 0, // baseline placeholder
        source: "Manual Inventory Ledger"
      });

      setShowAddModal(false);
      setNewItemName("");
      setNewItemPrice("0");
      setNewItemUnit("lbs");
      setNewItemVendor(vendorsList.length > 0 ? vendorsList[0] : "Unassigned");
      setNewItemCategory("Meat");
    } catch (err: any) {
      if (err.message === "DUPLICATE_ENTRY") {
        alert("An item with the exact same name, supplier, unit, and price already exists in your catalog.");
      } else {
        alert("Failed to add ingredient: " + (err.message || "Unknown error"));
      }
    }
  };

  // Reusable pagination controller for the inventory list
  const renderPaginationBar = (position: "top" | "bottom") => {
    if (sortedList.length === 0) return null;

    const startIdx = (safeInventoryPage - 1) * (inventoryPageSize === "ALL" ? sortedList.length : inventoryPageSize) + 1;
    const endIdx = inventoryPageSize === "ALL" ? sortedList.length : Math.min(safeInventoryPage * (inventoryPageSize as number), sortedList.length);

    return (
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 bg-[#fbfbfa] ${position === "top" ? "border-b" : "border-t"} border-neutral-200 text-xs font-sans select-none`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-mono text-neutral-600">
            Showing <span className="font-bold text-neutral-900">{startIdx}</span>–<span className="font-bold text-neutral-900">{endIdx}</span> of <span className="font-bold text-neutral-900">{sortedList.length}</span> items
          </span>

          <div className="flex items-center gap-1.5 border-l border-neutral-300 pl-3">
            <span className="text-[10px] font-mono text-neutral-500 font-bold">Rows:</span>
            <select
              value={inventoryPageSize}
              onChange={(e) => {
                const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                setInventoryPageSize(val);
                setInventoryPage(1);
              }}
              className="bg-white border border-neutral-300 rounded px-2 py-0.5 text-[11px] font-mono font-bold text-neutral-800 focus:outline-none focus:border-neutral-900 cursor-pointer shadow-2xs"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value="ALL">All ({sortedList.length})</option>
            </select>
          </div>

          {unsavedCountAcrossOtherPages > 0 && (
            <span className="text-[10px] font-mono text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300 font-bold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              {unsavedCountAcrossOtherPages} unsaved on other pages
            </span>
          )}
        </div>

        {totalInventoryPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeInventoryPage <= 1}
              onClick={() => setInventoryPage(1)}
              className="p-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white text-neutral-700 cursor-pointer disabled:cursor-not-allowed shadow-2xs"
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={safeInventoryPage <= 1}
              onClick={() => setInventoryPage(prev => Math.max(1, prev - 1))}
              className="px-2.5 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white text-[11px] font-mono font-bold text-neutral-700 flex items-center gap-0.5 cursor-pointer disabled:cursor-not-allowed shadow-2xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>

            <div className="flex items-center gap-1 px-1">
              {getPageNumbers(safeInventoryPage, totalInventoryPages).map((p, idx) => (
                p === -1 ? (
                  <span key={`ellipsis-${position}-${idx}`} className="px-1 text-neutral-400 font-mono text-[11px]">...</span>
                ) : (
                  <button
                    key={`page-${position}-${p}`}
                    type="button"
                    onClick={() => setInventoryPage(p)}
                    className={`min-w-[28px] h-6 px-1.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer shadow-2xs ${
                      safeInventoryPage === p 
                        ? "bg-neutral-900 text-white border border-neutral-900" 
                        : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {p}
                  </button>
                )
              ))}
            </div>

            <button
              type="button"
              disabled={safeInventoryPage >= totalInventoryPages}
              onClick={() => setInventoryPage(prev => Math.min(totalInventoryPages, prev + 1))}
              className="px-2.5 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white text-[11px] font-mono font-bold text-neutral-700 flex items-center gap-0.5 cursor-pointer disabled:cursor-not-allowed shadow-2xs"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={safeInventoryPage >= totalInventoryPages}
              onClick={() => setInventoryPage(totalInventoryPages)}
              className="p-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-white text-neutral-700 cursor-pointer disabled:cursor-not-allowed shadow-2xs"
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200/15 pb-5">
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-600 text-[#f0efeb] text-[10px] font-bold px-2 py-0.5 font-mono">
              Workspace Core
            </span>
            <span className="text-xs text-neutral-500 font-mono font-medium">
              Real-time Stock Audits
            </span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1">
            Physical Inventory Ledger
          </h1>
          <p className="text-xs text-neutral-600 font-sans mt-0.5 mb-2">
            Audit actual stock volumes, track critical par alerts, and analyze capital assets tied up in raw food storage.
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-1.5 border border-neutral-200 p-1 bg-[#f0efeb]">
          <button
            onClick={() => setSubTab("count")}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "count"
                ? "bg-emerald-600 text-white"
                : "text-neutral-900/70 hover:text-black hover:bg-white/40"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Stocktake count sheet
          </button>
          <button
            onClick={() => setSubTab("consumptions")}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "consumptions"
                ? "bg-emerald-600 text-white"
                : "text-neutral-900/70 hover:text-black hover:bg-white/40"
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5 text-red-700" />
            Restaurant Consumption Ledger
            {consumptions.length > 0 && (
              <span className="ml-1 text-[8px] font-mono bg-red-100 text-red-800 px-1.5 py-0.2 border border-red-200 font-bold">
                {consumptions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSubTab("history")}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === "history"
                ? "bg-emerald-600 text-white"
                : "text-neutral-900/70 hover:text-black hover:bg-white/40"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Stocktake Audit Logs
            {history.length > 0 && (
              <span className="ml-1 text-[8px] font-mono bg-neutral-200 text-neutral-900 px-1 py-0.2 border border-neutral-300 font-bold">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </div>


      {/* AI Batch Document Parser Area */}
      {showAIBatchParser && (
        <div className="bg-[#fcf8f2] border border-amber-450 rounded-xl p-6 mb-8 text-left" id="ai-batch-parser-area">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-200">
            <h3 className="font-bold text-neutral-900 flex items-center gap-2 text-xs font-sans">
              <Sparkles className="h-4.5 w-4.5 text-amber-700 animate-pulse fill-amber-700" />
              AI Inventory Document Parser
            </h3>
            <button
              onClick={() => {
                setShowAIBatchParser(false);
                setBatchInputText("");
                setAiInventoryItems([]);
                setApiError("");
                setApiSuccess("");
              }}
              className="text-neutral-400 hover:text-black cursor-pointer bg-white p-1.5 rounded border border-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {(apiError || apiSuccess) && (
            <div className="mb-4 space-y-2">
              {apiError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-200">
                  {apiError}
                </div>
              )}
              {apiSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                  {apiSuccess}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Target Department (Optional)
                </label>
                <select
                  value={batchTargetDept}
                  onChange={(e) => setBatchTargetDept(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-hidden"
                >
                  <option value="AUTO">Auto-detect from context</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Target Vendor (Optional)
                </label>
                <select
                  value={batchTargetVendor}
                  onChange={(e) => setBatchTargetVendor(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-hidden"
                >
                  <option value="">Auto-detect / Leave blank</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 block">
                Paste Invoice, Prep List, or Spreadsheet Text
              </label>
              <textarea
                value={batchInputText}
                onChange={(e) => setBatchInputText(e.target.value)}
                placeholder="Paste your document here..."
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-3 text-xs font-bold font-mono focus:outline-hidden h-40 resize-y"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunAiBatchParser}
                disabled={isAiParsing || !batchInputText.trim()}
                className="px-5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[10px] border border-amber-450 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer transition-all"
              >
                {isAiParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Parsing Document...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Parse Document</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Extracted Items Review */}
          {aiInventoryItems.length > 0 && (
            <div className="mt-8 pt-6 border-t border-amber-200">
              <h4 className="text-[10px] font-bold text-neutral-900 flex items-center gap-1.5 mb-3">
                <FileText className="h-4 w-4 text-amber-700" />
                Review Extracted Items ({aiInventoryItems.length})
              </h4>
              
              <div className="border border-neutral-200 rounded-xl overflow-x-auto bg-white mb-4">
                <table className="min-w-full divide-y divide-[#141414] text-xs text-neutral-900 text-left">
                  <thead className="bg-[#f0efeb] text-neutral-900/75 font-bold text-[9px]">
                    <tr>
                      <th className="px-3 py-2 border-r border-neutral-200 w-16">#</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Name</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Department</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Vendor</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Quantity</th>
                      <th className="px-3 py-2 border-r border-neutral-200">Unit</th>
                      <th className="px-3 py-2 text-right border-r border-neutral-200">Price</th>
                      <th className="px-3 py-2">Raw Text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/10">
                    {aiInventoryItems.map((item, index) => (
                      <tr key={index} className="hover:bg-neutral-50/50">
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-mono text-[9px] text-neutral-400">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-bold">
                          {item.name}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 text-[10px]">
                          <span className="bg-neutral-100 px-2 py-0.5 rounded font-mono">{item.department}</span>
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 text-[10px]">
                          {item.vendor || "-"}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-mono">
                          {item.quantity}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-mono">
                          {item.unit}
                        </td>
                        <td className="px-3 py-2 border-r border-neutral-200/10 font-mono text-right font-bold">
                          ${parseFloat(item.price || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-[8px] font-mono text-neutral-400 max-w-[150px] truncate" title={item.rawText}>
                          {item.rawText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleImportAllItems}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Import {aiInventoryItems.length} Items to Inventory</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI AUTO-CATEGORIZATION PROMPT BANNER */}
      {!isReadOnly && !isUncategorizedDismissed && uncategorizedItems.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm text-left">
          <div className="flex items-start gap-3.5">
            <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl mt-0.5 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-900 font-sans">
                Uncategorized Ingredients Detected ({uncategorizedItems.length})
              </h3>
              <p className="text-[11px] text-neutral-600 mt-1 font-sans leading-relaxed max-w-2xl">
                You have ingredients currently uncategorized (unassigned or marked as "Other"). Gemini AI can analyze their names and auto-assign them to correct categories (Meat, Vegetables, Bread, Seafood, Dairy, etc.) instantly.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleAutoCategorize}
              disabled={isCategorizing}
              className="whitespace-nowrap px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-xl transition-all shadow-sm border border-emerald-700 flex items-center gap-2 cursor-pointer"
            >
              {isCategorizing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Categorizing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
                  Auto-Categorize All
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsUncategorizedDismissed(true);
                localStorage.setItem("isUncategorizedDismissed", "true");
              }}
              className="whitespace-nowrap px-4 py-2.5 bg-white hover:bg-neutral-100 text-neutral-700 text-[11px] font-bold rounded-xl transition-all border border-neutral-300 shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 text-neutral-500" />
              Keep Uncategorized / Dismiss
            </button>
          </div>
        </div>
      )}

      {aiCategorizeStatus && (
        <div className={`p-4 rounded-xl text-xs font-bold text-left shadow-sm ${
          aiCategorizeStatus.type === "success" 
            ? "bg-emerald-900 text-emerald-50 border border-emerald-800" 
            : "bg-red-900 text-red-50 border border-red-800"
        }`}>
          {aiCategorizeStatus.text}
        </div>
      )}

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="inventory-kpis">
        <div className="bg-white border border-neutral-200 p-4 flex items-center space-x-4">
          <div className="bg-[#f0efeb] border border-neutral-200 p-3 text-neutral-900">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="text-left">
            <span className="text-[9px] text-neutral-900/50 font-bold block font-mono">
              On-Hand Asset Value
            </span>
            <p className="text-xl font-bold font-mono text-neutral-900 leading-tight">
              ${summaryMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-white border border-amber-300/80 bg-amber-50/20 p-4 flex items-center space-x-4">
          <div className="bg-amber-100 border border-amber-300 p-3 text-amber-950 font-mono font-bold text-xs">
            lbs
          </div>
          <div className="text-left">
            <span className="text-[9px] text-amber-900/70 font-bold block font-mono">
              Total Stock Weight (lbs)
            </span>
            <p className="text-xl font-bold font-mono text-amber-950 leading-tight">
              {summaryMetrics.totalPounds.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs text-amber-800 font-sans font-normal">lbs</span>
            </p>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 p-4 flex items-center space-x-4">
          <div className="bg-neutral-100 border border-neutral-300 p-3 text-neutral-800">
            <Package className="h-5 w-5" />
          </div>
          <div className="text-left">
            <span className="text-[9px] text-neutral-900/50 font-bold block font-mono">
              Items Monitored
            </span>
            <p className="text-xl font-bold font-mono text-neutral-900 leading-tight">
              {summaryMetrics.trackedCount} / {processedIngredients.length} <span className="text-[10px] text-neutral-500 font-sans">({((summaryMetrics.trackedCount / (processedIngredients.length || 1)) * 100).toFixed(0)}%)</span>
            </p>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 p-4 flex items-center space-x-4">
          <div className={`p-3 border ${summaryMetrics.lowStockCount > 0 ? "bg-red-50 border-red-300 text-red-900 animate-pulse" : "bg-[#f0efeb] border-neutral-200 text-neutral-900"}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="text-left">
            <span className="text-[9px] text-neutral-900/50 font-bold block font-mono">
              Low Stock Warnings
            </span>
            <p className={`text-xl font-bold font-mono leading-tight ${summaryMetrics.lowStockCount > 0 ? "text-red-700" : "text-neutral-900"}`}>
              {summaryMetrics.lowStockCount} items
            </p>
          </div>
        </div>
      </div>

      {subTab === "count" ? (
        <div className="space-y-4">
          
          {/* SEARCH & FILTER CONTROLS BAR */}
          <div className="bg-[#f0efeb] border border-neutral-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Search query input */}
              <div className="md:col-span-3 relative text-left">
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Search Ingredients
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, location, supplier..."
                    className="w-full bg-white border border-neutral-200 pl-9 pr-4 py-2 text-xs font-medium placeholder-neutral-400 rounded-xl focus:outline-none focus:border-black"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-black font-bold font-mono"
                    >
                      CLEAR
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter */}
              <div className="md:col-span-3 text-left">
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Filter by Category
                </label>
                <select
                  id="category-filter-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                >
                  <option value="ALL_CATEGORIES">📁 ALL CATEGORIES</option>
                  
                  {categoriesList.map((cat, i) => (
                    <option key={i} value={cat}>
                      🏷️ {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor supplier filter */}
              <div className="md:col-span-2 text-left">
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Filter by Supplier (Vendor)
                </label>
                <select
                  id="vendor-filter-select"
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                >
                  <option value="ALL_VENDORS">🔍 ALL SUPPLIERS</option>
                  {vendorsList.map((vendor, i) => (
                    <option key={i} value={vendor}>
                      🚚 {vendor}
                    </option>
                  ))}
                  <option value="UNKNOWN_VENDOR">❓ UNKNOWN VENDORS</option>
                </select>
              </div>

              {/* Storage location filter */}
              <div className="md:col-span-2 text-left">
                <label className="block text-[10px] font-bold text-neutral-700 mb-1 font-mono">
                  Filter by Location
                </label>
                <select
                  id="location-filter-select"
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-800 rounded-xl focus:outline-none focus:ring-0"
                >
                  <option value="ALL_LOCATIONS">📦 ALL LOCATIONS</option>
                  {locationsList.map((loc, i) => (
                    <option key={i} value={loc}>
                      🏠 {loc}
                    </option>
                  ))}
                  <option value="UNASSIGNED">🗂️ UNASSIGNED</option>
                </select>
              </div>

              {/* Quick Options / Print Buttons */}
              <div className="md:col-span-2 flex flex-row md:flex-col justify-end items-stretch gap-2">
                <button
                  type="button"
                  onClick={printChecklist}
                  className="flex-1 bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-200 py-2 text-[10px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Print Stocktaking Checklist"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Checklist
                </button>
                <div className="relative flex-1" ref={inventoryExportDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowInventoryExportDropdown(prev => !prev)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-2.5 text-[10px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Download Inventory Report"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${showInventoryExportDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showInventoryExportDropdown && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl z-30 py-1 divide-y divide-neutral-100 font-sans">
                      <div className="px-3 py-1.5 text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                        Export Inventory
                      </div>
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            downloadCSV();
                            setShowInventoryExportDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <div>
                            <div className="font-bold">CSV Spreadsheet</div>
                            <div className="text-[9px] text-neutral-400">Excel / Google Sheets</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            downloadJSON();
                            setShowInventoryExportDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-sky-50 hover:text-sky-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <FileJson className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                          <div>
                            <div className="font-bold">JSON File</div>
                            <div className="text-[9px] text-neutral-400">Structured data object</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Checkbox Options panel */}
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-neutral-200/10 text-left">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="w-3.5 h-3.5 border border-neutral-200 text-neutral-900 rounded-xl focus:ring-0"
                />
                <span className="text-[10px] font-bold text-red-800 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Only Show Low Stock / Warnings
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={untrackedOnly}
                  onChange={(e) => setUntrackedOnly(e.target.checked)}
                  className="w-3.5 h-3.5 border border-neutral-200 text-neutral-900 rounded-xl focus:ring-0"
                />
                <span className="text-[10px] font-bold text-neutral-600 flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  Only Show Untracked Items
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasStockOnly}
                  onChange={(e) => setHasStockOnly(e.target.checked)}
                  className="w-3.5 h-3.5 border border-neutral-200 text-neutral-900 rounded-xl focus:ring-0"
                />
                <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Only Show In-Stock Items
                </span>
              </label>

              <div className="ml-auto text-[10px] font-bold text-neutral-500 font-mono">
                Found {sortedList.length} items
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS: BATCH SAVE AND COMPLETE STOCKTAKE */}
          {unsavedCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 p-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-amber-900 rounded-xl gap-3 animate-none text-left">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-bold font-sans">
                    You have unsaved stock adjustments!
                  </p>
                  <p className="text-[11px] text-amber-800/80 font-mono mt-0.5">
                    Currently tracking modifications for <span className="font-bold underline">{unsavedCount} items</span> in your workspace draft sheet.
                    {unsavedCountAcrossOtherPages > 0 && (
                      <span className="ml-1 text-amber-900 font-bold">
                        ({unsavedCountAcrossOtherPages} items on other pages)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setDraftCounts({});
                    setDraftNames({});
                    setDraftPars({});
                    setDraftLocations({});
                    setDraftVendors({});
                    setDraftCategories({});
                    setDraftPcsPerPound({});
                    setDraftWeightPerCase({});
                    setDraftWeightPerCaseUnit({});
                    setDraftPackagingUnit({});
                  }}
                  className="flex-1 sm:flex-initial px-3 py-2 border border-neutral-300 bg-white hover:bg-neutral-50 text-[10px] font-bold text-neutral-700 cursor-pointer"
                >
                  Discard Drafts
                </button>
                <button
                  disabled={bulkSaving || isReadOnly}
                  onClick={saveAllDrafts}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-black text-white text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {bulkSaving ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save All Changes ({unsavedCount})
                </button>
              </div>
            </div>
          )}

          {/* STOCKTAKE SHEETS */}
          <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
            {renderPaginationBar("top")}
            <div className="overflow-x-auto" id="inventory-table-container">
              <table className="min-w-full divide-y divide-[#141414] text-xs text-neutral-900 text-left bg-white">
                <thead className="bg-[#f0efeb] text-neutral-900 font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3 border-r border-neutral-200">Ingredient details</th>
                    <th className="px-4 py-3 border-r border-neutral-200 text-center w-36">Storage Location</th>
                    <th className="px-4 py-3 border-r border-neutral-200 text-center w-40">Supplier / Vendor</th>
                    <th className="px-4 py-3 border-r border-neutral-200 text-center w-28">Safety Alert Limit</th>
                    <th className="px-4 py-3 border-r border-neutral-200 text-center w-60">On-Hand Stock (Pounds / lbs)</th>
                    <th className="px-4 py-3 text-right border-r border-neutral-200 w-28">Current Asset Val</th>
                    <th className="px-4 py-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]">
                  {sortedList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 font-sans">
                        <Package className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
                        <p className="font-bold tracking-wide text-xs">No ingredients match your active filters</p>
                        <p className="text-[11px] text-neutral-400 mt-1">Try resetting search parameters or verify that tracking is initialized.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedInventoryList.map((item) => {
                      const isDrafted = 
    draftCounts[item.id!] !== undefined || 
    draftNames[item.id!] !== undefined ||
    draftPars[item.id!] !== undefined ||
    draftLocations[item.id!] !== undefined ||
    draftVendors[item.id!] !== undefined ||
    draftCategories[item.id!] !== undefined ||
    draftPcsPerPound[item.id!] !== undefined ||
    draftWeightPerCase[item.id!] !== undefined ||
    draftWeightPerCaseUnit[item.id!] !== undefined ||
    draftPackagingUnit[item.id!] !== undefined ||
    draftUnits[item.id!] !== undefined ||
    draftConversions[item.id!] !== undefined;

                      const currentName = draftNames[item.id!] !== undefined
                        ? draftNames[item.id!]
                        : item.name;

                      const currentCount = draftCounts[item.id!] !== undefined 
                        ? draftCounts[item.id!] 
                        : (item.stock !== undefined ? item.stock : 0);

                      const currentPar = draftPars[item.id!] !== undefined 
                        ? draftPars[item.id!] 
                        : item.minStock;

                      const currentLocation = draftLocations[item.id!] !== undefined 
                        ? draftLocations[item.id!] 
                        : item.location;

                      const currentVendor = draftVendors[item.id!] !== undefined 
                        ? draftVendors[item.id!] 
                        : item.vendorName;

                      const currentCategory = draftCategories[item.id!] !== undefined
                        ? draftCategories[item.id!]
                        : (item.category || "Unassigned");

                      const currentWeightPerCase = draftWeightPerCase[item.id!] !== undefined
                        ? draftWeightPerCase[item.id!]
                        : item.weightPerCase;

                      const currentWeightPerCaseUnit = draftWeightPerCaseUnit[item.id!] !== undefined
                        ? draftWeightPerCaseUnit[item.id!]
                        : (item.weightPerCaseUnit || "lb");

                      const currentPcsPerPound = draftPcsPerPound[item.id!] !== undefined
                        ? draftPcsPerPound[item.id!]
                        : item.pcsPerPound;

                      const effectivePackRatio =
                        draftPcsPerPound[item.id!] !== undefined
                          ? draftPcsPerPound[item.id!]
                          : draftWeightPerCase[item.id!] !== undefined
                          ? draftWeightPerCase[item.id!]
                          : (item.pcsPerPound && item.pcsPerPound > 0
                              ? item.pcsPerPound
                              : (item.weightPerCase && item.weightPerCase > 0 ? item.weightPerCase : 0));

                      const nameInferredSpec = extractWeightSpecFromName(currentName);
                      const effectiveWeightPerCase = (currentWeightPerCase && currentWeightPerCase > 0)
                        ? currentWeightPerCase
                        : nameInferredSpec?.weight;
                      const effectiveWeightPerCaseUnit = (currentWeightPerCase && currentWeightPerCase > 0)
                        ? currentWeightPerCaseUnit
                        : (nameInferredSpec?.unit || "lb");

                      const poundInfo = calculatePoundData(
                        currentCount,
                        item.unit,
                        effectiveWeightPerCase,
                        effectiveWeightPerCaseUnit,
                        currentPcsPerPound,
                        item.quantity,
                        currentName
                      );

                      const rateInfo = getIngredientStandardRate(item);
                      const displayAssetVal = item.stock !== undefined 
                        ? getItemAssetValue(item, currentCount, currentWeightPerCase, currentWeightPerCaseUnit, currentPcsPerPound)
                        : 0;

                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-[#f0efeb]/40 border-b border-neutral-200/10 transition-colors ${
                            isDrafted ? "bg-amber-50/40" : ""
                          }`}
                        >
                          {/* Ingredient Details */}
                          <td className="px-4 py-3 border-r border-neutral-200 text-left">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={currentName}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftNames(prev => ({ ...prev, [item.id!]: val }));
                                }}
                                className={`font-bold text-neutral-900 font-sans bg-transparent hover:bg-neutral-100/80 focus:bg-white focus:outline-none focus:ring-1 focus:ring-black px-1.5 py-0.5 rounded text-sm transition-colors border border-transparent focus:border-neutral-300 min-w-[140px] ${
                                  draftNames[item.id!] !== undefined && draftNames[item.id!] !== item.name ? "bg-amber-100/90 border-amber-300" : ""
                                }`}
                                title="Click to edit ingredient name"
                              />
                              <select
                                value={currentCategory}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "__NEW__") {
                                    const customCat = window.prompt("Enter new category name:");
                                    if (customCat && customCat.trim()) {
                                      setDraftCategories(prev => ({ ...prev, [item.id!]: customCat.trim() }));
                                    }
                                  } else {
                                    setDraftCategories(prev => ({ ...prev, [item.id!]: val }));
                                  }
                                }}
                                className="bg-amber-100/90 hover:bg-amber-200 text-amber-950 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase border border-amber-300/80 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer shadow-2xs transition-colors shrink-0"
                                title="Click to change ingredient category"
                              >
                                {categoriesList.map((cat) => (
                                  <option key={cat} value={cat}>📁 {cat}</option>
                                ))}
                                {!categoriesList.includes("Unassigned") && (
                                  <option value="Unassigned">📁 Unassigned</option>
                                )}
                                <option value="__NEW__">➕ Custom Category...</option>
                              </select>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[9px] text-neutral-900/60">
                              <span className="bg-neutral-100 border border-neutral-200/10 px-1.5 py-0.5 flex items-center gap-1">
                                {editingUnitId === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      value={editingUnitVal}
                                      onChange={(e) => setEditingUnitVal(e.target.value)}
                                      className="bg-white border border-neutral-300 rounded text-[9px] font-bold text-neutral-800 focus:outline-none py-0 px-0.5 cursor-pointer"
                                    >
                                      {!["lb","g","gram","gal","ml","oz","pcs"].includes(editingUnitVal) && editingUnitVal && (
                                        <option value={editingUnitVal}>{editingUnitVal}</option>
                                      )}
                                      <option value="lb">lb</option>
                                          <option value="g">gram</option>
                                          <option value="gal">gal</option>
                                          <option value="ml">ml</option>
                                          <option value="oz">oz</option>
                                          <option value="pcs">pcs</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await handleSaveUnit(item);
                                      }}
                                      className="text-emerald-700 hover:text-emerald-900 font-bold p-0.5 cursor-pointer"
                                      title="Save Unit"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingUnitId(null);
                                      }}
                                      className="text-red-700 hover:text-red-900 font-bold p-0.5 cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span>{item.unit}</span>
                                    {!isReadOnly && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingUnitId(item.id!);
                                          setEditingUnitVal(item.unit || "");
                                        }}
                                        className="text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer p-0.5"
                                        title="Edit ingredient unit"
                                      >
                                        <Edit2 className="h-2.5 w-2.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </span>
                              <span className="bg-neutral-100 border border-neutral-200/10 px-1 py-0.5">
                                rate: ${rateInfo.rateVal.toFixed(5)}/{rateInfo.unitLabel}
                              </span>
                            </div>
                          </td>

                          {/* Location Dropdown/Edit */}
                          <td className="px-3 py-3 border-r border-neutral-200 text-center font-sans font-bold text-neutral-800">
                            {item.stock === undefined ? (
                              <span className="text-neutral-400 font-mono text-[10px]">-</span>
                            ) : (
                              <select
                                id={`location-select-${item.id}`}
                                value={currentLocation}
                                disabled={isReadOnly}
                                onChange={(e) => setDraftLocations(prev => ({ ...prev, [item.id!]: e.target.value }))}
                                className="w-full bg-transparent border-0 font-bold text-[11px] text-center text-neutral-700 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                              >
                                {locationsList.filter(l => l !== "Unassigned" && l !== "unassigned").map((loc) => (
                                  <option key={loc} value={loc}>
                                    {getLocationIcon(loc)} {loc}
                                  </option>
                                ))}
                                <option value="Unassigned">🗂️ Unassigned</option>
                              </select>
                            )}
                          </td>

                          {/* Supplier / Vendor */}
                          <td className="px-3 py-3 border-r border-neutral-200 text-center font-sans font-medium text-neutral-700">
                            {item.stock === undefined ? (
                              <span className="text-[10px] text-neutral-400 font-mono truncate max-w-[120px] block">{item.vendorName}</span>
                            ) : (
                              <select
                                value={currentVendor}
                                disabled={isReadOnly}
                                onChange={(e) => setDraftVendors(prev => ({ ...prev, [item.id!]: e.target.value }))}
                                className="w-full bg-transparent border-b border-transparent text-center font-bold text-[11px] text-neutral-700 py-0.5 focus:border-black focus:outline-none focus:bg-white cursor-pointer"
                              >
                                <option value="">-- No Supplier --</option>
                                {vendorsList.map(v => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                            )}
                          </td>

                          {/* Min stock safety alert level */}
                          <td className="px-3 py-3 border-r border-neutral-200 text-center font-mono">
                            {item.stock === undefined ? (
                              <span className="text-neutral-400 font-mono text-[10px]">-</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={currentPar}
                                  disabled={isReadOnly}
                                  onChange={(e) => handleDraftParChange(item.id!, e.target.value)}
                                  className="w-12 bg-white/70 border border-neutral-200/30 text-center text-xs font-bold font-mono py-1 rounded-xl focus:outline-none focus:ring-0 focus:border-black"
                                />
                                <span className="text-[9px] text-neutral-500 font-bold font-sans">{item.unit}</span>
                              </div>
                            )}
                          </td>

                          {/* On-Hand Stock Counts & Pound Data */}
                          <td className="px-4 py-3 border-r border-neutral-200 text-center">
                            {item.stock === undefined ? (
                              <button
                                onClick={() => initializeTracking(item.id!)}
                                className="bg-emerald-600 hover:bg-black text-white text-[9px] font-bold px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1 border border-black cursor-pointer transition-all"
                              >
                                <PlusCircle className="h-3 w-3" />
                                Start Stock Tracking
                              </button>
                            ) : (
                              <div className="space-y-1.5 max-w-[220px] mx-auto">
                                <div className="flex items-center justify-between gap-1.5">
                                  {/* Decrement btn */}
                                  <button
                                    type="button"
                                    disabled={isReadOnly || currentCount <= 0}
                                    onClick={() => adjustStock(item.id!, item.stock, -1)}
                                    className="h-7 w-7 border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center shrink-0 rounded-xl cursor-pointer disabled:opacity-40"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  
                                  {/* Direct quantity input */}
                                  <div className="flex-1 relative">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={currentCount}
                                      disabled={isReadOnly}
                                      onChange={(e) => handleDraftChange(item.id!, e.target.value)}
                                      className="w-full bg-white border border-neutral-200 text-center text-xs font-bold font-mono py-1 rounded-xl focus:outline-none focus:ring-0 focus:border-black"
                                    />
                                  </div>

                                  {/* Increment btn */}
                                  <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => adjustStock(item.id!, item.stock, 1)}
                                    className="h-7 w-7 border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center shrink-0 rounded-xl cursor-pointer disabled:opacity-40"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>

                                  {/* Package Specification tag */}
                                  <span className="text-[9px] text-neutral-500 font-bold font-sans shrink-0 min-w-[24px] text-left">{item.unit}</span>
                                </div>

                                {/* POUND DATA DISPLAY BADGE & WEIGHT SPEC HELPER */}
                                <div className="p-1.5 bg-[#fcfbf9] border border-amber-300/80 rounded-lg text-left text-[9px] font-sans space-y-1 shadow-2xs">
                                  <div className="flex items-center justify-between gap-1 bg-amber-50/80 p-1 rounded border border-amber-200/70 font-mono">
                                    <span className="font-bold text-amber-950 flex items-center gap-0.5 text-[8.5px]">
                                      ⚖️ Pound Data:
                                    </span>
                                    <span className={`font-extrabold text-[9.5px] ${poundInfo.hasWeightSpec ? "text-emerald-900" : "text-amber-800 font-sans italic"}`}>
                                      {poundInfo.hasWeightSpec ? `${poundInfo.lbs.toFixed(2)} lbs` : "Needs weight spec"}
                                    </span>
                                  </div>

                                  {/* Inline Weight Converter / Spec Editor for box, pack, & discrete units */}
                                  <div className="pt-1 border-t border-neutral-200/60 space-y-1.5 text-[8.5px]">

                                    {/* Row 2: Secondary packaging conversion */}
                                    {showSecondaryConversion[item.id!] || effectivePackRatio > 0 ? (
                                      <div className="flex flex-wrap items-center justify-between gap-1">
                                        <span className="text-[9px] font-bold text-neutral-500 whitespace-nowrap">Pack Size:</span>
                                        <div className="flex items-center gap-0.5">
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0"
                                            value={effectivePackRatio || ""}
                                            disabled={isReadOnly}
                                            onChange={(e) => {
                                              const v = parseFloat(e.target.value);
                                              const numVal = isNaN(v) ? 0 : v;
                                              const cleanUnit = (draftUnits[item.id!] || item.unit || "lb").toLowerCase().trim();
                                              if (cleanUnit === "pc" || cleanUnit === "pcs") {
                                                setDraftPcsPerPound(prev => ({ ...prev, [item.id!]: numVal }));
                                              } else {
                                                setDraftWeightPerCase(prev => ({ ...prev, [item.id!]: numVal }));
                                                setDraftWeightPerCaseUnit(prev => ({ ...prev, [item.id!]: cleanUnit === "oz" ? "oz" : "lb" }));
                                              }
                                            }}
                                            className="w-12 bg-white border border-neutral-300 rounded text-center text-[9px] font-bold font-mono py-0.5 px-1 focus:outline-none focus:border-black"
                                          />
                                          <span className="text-[9px] text-neutral-600 font-bold mx-0.5 px-1 bg-neutral-100 rounded truncate max-w-[40px] text-center" title="Default Unit">{item.unit || "unit"}</span>
                                          <span className="text-neutral-500 mx-0.5">per</span>
                                          <select
                                            value={(draftPackagingUnit[item.id!] !== undefined ? draftPackagingUnit[item.id!] : (item.packagingUnit || "box")).toLowerCase()}
                                            disabled={isReadOnly}
                                            onChange={(e) => setDraftPackagingUnit(prev => ({ ...prev, [item.id!]: e.target.value }))}
                                            className="bg-white border border-neutral-300 rounded text-[9px] py-0.5 px-1 focus:outline-none font-bold text-center cursor-pointer"
                                          >
                                            <option value="" disabled>Select...</option>
                                          <optgroup label="Weight">
                                            <option value="lb">Pounds (lb)</option>
                                            <option value="lbs">Pounds (lbs)</option>
                                            <option value="oz">Ounces (oz)</option>
                                            <option value="g">Grams (g)</option>
                                            <option value="kg">Kilograms (kg)</option>
                                          </optgroup>
                                          <optgroup label="Volume">
                                            <option value="gal">Gallons (gal)</option>
                                            <option value="fl oz">Fluid Ounces (fl oz)</option>
                                            <option value="L">Liters (L)</option>
                                            <option value="ml">Milliliters (ml)</option>
                                          </optgroup>
                                          <optgroup label="Count / Packaging">
                                            <option value="pcs">Pieces (pcs)</option>
                                            <option value="pack">Pack</option>
                                            <option value="box">Box</option>
                                            <option value="case">Case</option>
                                            <option value="bag">Bag</option>
                                            <option value="can">Can</option>
                                            <option value="bottle">Bottle</option>
                                            <option value="jar">Jar</option>
                                            <option value="bunch">Bunch</option>
                                            <option value="head">Head</option>
                                            <option value="unit">Unit</option>
                                          </optgroup>
                                          </select>
                                          <button
                                            type="button"
                                            disabled={isReadOnly}
                                            onClick={() => {
                                              setDraftPcsPerPound(prev => ({ ...prev, [item.id!]: 0 }));
                                              setDraftWeightPerCase(prev => ({ ...prev, [item.id!]: 0 }));
                                              setShowSecondaryConversion(prev => ({ ...prev, [item.id!]: false }));
                                            }}
                                            className="text-red-500 hover:text-red-700 ml-1 disabled:opacity-50"
                                            title="Remove Pack Size"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => setShowSecondaryConversion(prev => ({ ...prev, [item.id!]: true }))}
                                        className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                                      >
                                        <Plus className="h-2 w-2" />
                                        Add packaging (e.g. per Box)
                                      </button>
                                    )}
                                    {(() => {
                                      const convs = draftConversions[item.id!] !== undefined ? draftConversions[item.id!] : (item.conversions || []);
                                      return (
                                        <>
                                          {convs.map((conv, idx) => (
                                            <div key={idx} className="flex flex-wrap items-center justify-between gap-1 mt-1">
                                              <span className="text-[9px] font-bold text-neutral-500 whitespace-nowrap">Pack Size:</span>
                                              <div className="flex items-center gap-0.5">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0"
                                                  value={conv.ratio || ""}
                                                  disabled={isReadOnly}
                                                  onChange={(e) => {
                                                    const newConvs = [...convs];
                                                    newConvs[idx].ratio = parseFloat(e.target.value) || 0;
                                                    setDraftConversions(prev => ({ ...prev, [item.id!]: newConvs }));
                                                  }}
                                                  className="w-12 bg-white border border-neutral-300 rounded text-center text-[9px] font-bold font-mono py-0.5 px-1 focus:outline-none focus:border-black"
                                                />
                                                <span className="text-[9px] text-neutral-600 font-bold mx-0.5 px-1 bg-neutral-100 rounded truncate max-w-[40px] text-center" title="Default Unit">{item.unit || "unit"}</span>
                                                <span className="text-neutral-500 mx-0.5">per</span>
                                                <select
                                                  value={conv.targetUnit || ""}
                                                  disabled={isReadOnly}
                                                  onChange={(e) => {
                                                    const newConvs = [...convs];
                                                    newConvs[idx].targetUnit = e.target.value;
                                                    setDraftConversions(prev => ({ ...prev, [item.id!]: newConvs }));
                                                  }}
                                                  className="bg-white border border-neutral-300 rounded text-[9px] py-0.5 px-1 focus:outline-none font-bold text-center cursor-pointer"
                                                >
                                                  <option value="" disabled>Select...</option>
                                                  <optgroup label="Weight">
                                            <option value="lb">Pounds (lb)</option>
                                            <option value="lbs">Pounds (lbs)</option>
                                            <option value="oz">Ounces (oz)</option>
                                            <option value="g">Grams (g)</option>
                                            <option value="kg">Kilograms (kg)</option>
                                          </optgroup>
                                          <optgroup label="Volume">
                                            <option value="gal">Gallons (gal)</option>
                                            <option value="fl oz">Fluid Ounces (fl oz)</option>
                                            <option value="L">Liters (L)</option>
                                            <option value="ml">Milliliters (ml)</option>
                                          </optgroup>
                                          <optgroup label="Count / Packaging">
                                            <option value="pcs">Pieces (pcs)</option>
                                            <option value="pack">Pack</option>
                                            <option value="box">Box</option>
                                            <option value="case">Case</option>
                                            <option value="bag">Bag</option>
                                            <option value="can">Can</option>
                                            <option value="bottle">Bottle</option>
                                            <option value="jar">Jar</option>
                                            <option value="bunch">Bunch</option>
                                            <option value="head">Head</option>
                                            <option value="unit">Unit</option>
                                          </optgroup>
                                                </select>
                                                <button
                                                  type="button"
                                                  disabled={isReadOnly}
                                                  onClick={() => {
                                                    const newConvs = convs.filter((_, i) => i !== idx);
                                                    setDraftConversions(prev => ({ ...prev, [item.id!]: newConvs }));
                                                  }}
                                                  className="text-red-500 hover:text-red-700 disabled:opacity-50 ml-0.5 cursor-pointer"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                          {showSecondaryConversion[item.id!] || currentPcsPerPound > 0 || convs.length > 0 ? (
                                            <div className="mt-1 flex justify-end">
                                              <button
                                                type="button"
                                                disabled={isReadOnly}
                                                onClick={() => {
                                                  const newConvs = [...convs, { ratio: 0, targetUnit: "" }];
                                                  setDraftConversions(prev => ({ ...prev, [item.id!]: newConvs }));
                                                }}
                                                className="text-[9px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                                              >
                                                <Plus className="h-2 w-2" />
                                                Add more packaging
                                              </button>
                                            </div>
                                          ) : null}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Asset Value */}
                          <td className="px-4 py-3 border-r border-neutral-200 text-right font-mono font-bold text-neutral-800">
                            {item.stock === undefined ? (
                              <span className="text-neutral-300 font-mono">-</span>
                            ) : (
                              <div className="leading-none">
                                <div>${displayAssetVal.toFixed(2)}</div>
                                <div className="text-[8px] text-neutral-400 font-normal mt-0.5">
                                  (${rateInfo.rateVal.toFixed(5)} /{rateInfo.unitLabel})
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Row Actions */}
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.stock === undefined ? (
                                <span className="text-neutral-300 text-xs mr-2">-</span>
                              ) : (
                                <>
                                  {/* Alert Status Indicator Badge */}
                                  {item.stock === 0 && (
                                    <span className="bg-red-100 text-red-900 border border-red-300 px-1.5 py-0.5 text-[8.5px] font-bold font-sans tracking-wide">
                                      OUT
                                    </span>
                                  )}
                                  {item.stock > 0 && item.stock <= item.minStock && (
                                    <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 text-[8.5px] font-bold font-sans tracking-wide">
                                      LOW
                                    </span>
                                  )}
                                  {item.stock > item.minStock && (
                                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 text-[8.5px] font-bold font-sans tracking-wide">
                                      OK
                                    </span>
                                  )}

                                  {/* Row Edit Save Button */}
                                  {isDrafted && (
                                    <button
                                      onClick={() => saveSingleCount(item.id!)}
                                      disabled={savingId === item.id || isReadOnly}
                                      className="bg-emerald-800 hover:bg-emerald-950 text-white p-1 rounded-xl border border-emerald-900 cursor-pointer transition-colors"
                                      title="Save changes for this ingredient"
                                    >
                                      {savingId === item.id ? (
                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Check className="h-3 w-3" />
                                      )}
                                    </button>
                                  )}
                                </>
                              )}
                              
                              {!isReadOnly && (
                                <div className="flex items-center gap-1">
                                  {/* Edit / Save Icon Button */}
                                  <button
                                    onClick={() => {
                                      if (isDrafted) {
                                        saveSingleCount(item.id!);
                                      } else {
                                        setDraftNames(prev => ({ ...prev, [item.id!]: item.name }));
                                      }
                                    }}
                                    disabled={savingId === item.id}
                                    className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                                      isDrafted 
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700" 
                                        : "text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-transparent hover:border-blue-200"
                                    }`}
                                    title={isDrafted ? "Save changes for this ingredient" : "Edit ingredient"}
                                  >
                                    {savingId === item.id ? (
                                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    ) : isDrafted ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : (
                                      <Edit2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>

                                  {/* Delete / Remove Icon Button */}
                                  {confirmDeleteId === item.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={async () => {
                                          setConfirmDeleteId(null);
                                          await onDeleteIngredient(item.id!);
                                        }}
                                        className="p-1 text-white bg-red-600 hover:bg-red-700 transition-colors text-[9px] font-bold px-2 rounded-xl cursor-pointer"
                                        title="Confirm Delete"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="p-1 text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDeleteId(item.id!)}
                                      className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-colors cursor-pointer"
                                      title="Delete item"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {renderPaginationBar("bottom")}

            {/* Bottom summary and ledger finalize */}
            {sortedList.length > 0 && (
              <div className="bg-[#f0efeb] border-t border-neutral-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4 font-sans text-xs text-neutral-900">
                <div className="text-left">
                  <p className="font-bold text-[10px]">
                    Ledger Summary for this Selection ({selectedVendor === "ALL_VENDORS" ? "All Suppliers" : selectedVendor})
                  </p>
                  <p className="font-mono text-[11px] text-neutral-700 mt-0.5">
                    Total Monitored Items: <span className="font-bold">{filteredList.length}</span> | 
                    Total Selected Asset Value: <span className="font-bold text-emerald-800">${filteredList.reduce((acc, ing) => {
                      if (ing.stock === undefined) return acc;
                      const currentCnt = draftCounts[ing.id!] !== undefined ? draftCounts[ing.id!] : ing.stock;
                      const wPerCase = draftWeightPerCase[ing.id!] !== undefined ? draftWeightPerCase[ing.id!] : ing.weightPerCase;
                      const wPerCaseUnit = draftWeightPerCaseUnit[ing.id!] !== undefined ? draftWeightPerCaseUnit[ing.id!] : (ing.weightPerCaseUnit || "lb");
                      const pcsRatio = draftPcsPerPound[ing.id!] !== undefined ? draftPcsPerPound[ing.id!] : ing.pcsPerPound;
                      return acc + getItemAssetValue(ing, currentCnt, wPerCase, wPerCaseUnit, pcsRatio);
                    }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                </div>
                
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={finalizeStocktake}
                  className="w-full md:w-auto bg-emerald-600 hover:bg-black text-white px-5 py-2.5 text-[10px] font-bold border border-black transition-colors rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4" />
                  Post Physical Stocktake to Ledger
                </button>
              </div>
            )}
          </div>
        </div>
      ) : subTab === "history" ? (
        /* HISTORY TAB */
        <div className="space-y-6">
          {/* Audit Log Explanation Banner */}
          <div className="border border-neutral-200 bg-[#f0efeb] p-5 text-left flex items-start gap-4">
            <div className="bg-emerald-600 text-white p-2.5 shrink-0">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-neutral-900 font-mono">
                What is Stocktake Audit Logs & History?
              </h4>
              <p className="text-[11px] text-neutral-600 font-sans mt-1.5 leading-relaxed">
                Whenever you perform a full physical count of your raw food storage in the <strong>Stocktake Count Sheet</strong> tab and click the <strong>"Post Physical Stocktake to Ledger"</strong> button, a permanent, point-in-time snapshot of your entire inventory is archived in our cloud database.
              </p>
              <p className="text-[11px] text-neutral-600 font-sans mt-1 leading-relaxed">
                This <strong>Audit Logs History</strong> serves as your official record of historical valuations, stock discrepancies, and operator activity. Select any archived stocktake sheet in the panel below to inspect exactly what quantities were physically on hand, their precise asset valuations, and which operator certified the physical count.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* List of historical stocktakes */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-bold text-neutral-600 border-b border-neutral-200 pb-2 text-left">
              Archived Stocktake Sheets ({history.length})
            </h3>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12 bg-white border border-neutral-200">
                <RefreshCw className="h-5 w-5 animate-spin text-neutral-500 mr-2" />
                <span className="text-xs font-mono">Loading Cloud Ledger History...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="bg-white border border-neutral-200 p-8 text-center text-neutral-500 font-sans">
                <History className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
                <p className="font-bold tracking-wide text-xs">No stocktakes archived</p>
                <p className="text-[11px] text-neutral-400 mt-1">Complete a stocktake in the Count Sheet to store audits permanently.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {history.map((log) => {
                  const isSelected = selectedHistoryItem?.id === log.id;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedHistoryItem(log)}
                      className={`border p-4 bg-white cursor-pointer text-left transition-all relative ${
                        isSelected 
                          ? "border-neutral-200 bg-[#f0efeb]/40 ring-1 ring-[#141414]" 
                          : "border-neutral-200/15 hover:border-neutral-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-neutral-900 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 ">
                          Sheet #{log.id.slice(-5).toUpperCase()}
                        </span>
                        <span className="text-neutral-500 text-[10px] font-mono flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {log.date}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[9px] text-neutral-400 font-bold font-mono">Total Assets Checked</p>
                          <p className="text-sm font-bold font-mono text-emerald-800">${log.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-neutral-400 font-bold font-mono">Supplier Scope</p>
                          <p className="font-semibold text-neutral-700 truncate max-w-[120px]" title={log.vendorFilter}>{log.vendorFilter}</p>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-200 flex items-center justify-between text-[10px] text-neutral-500">
                        <span>Items Counted: <strong>{log.totalItemsCount}</strong></span>
                        {log.lowStockCount > 0 && (
                          <span className="text-red-700 font-bold flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> {log.lowStockCount} low
                          </span>
                        )}
                      </div>

                      {/* Delete log button (for admins) */}
                      {!isReadOnly && (
                        <div className="absolute right-2 bottom-2 flex items-center gap-1">
                          {confirmDeleteHistoryId === log.id ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteHistoryId(null);
                                  deleteHistoryLog(log.id, e);
                                }}
                                className="text-white bg-red-600 hover:bg-red-700 p-1 text-[9px] font-bold "
                              >
                                Confirm
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteHistoryId(null);
                                }}
                                className="text-neutral-500 hover:text-neutral-900 p-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteHistoryId(log.id);
                              }}
                              className="text-neutral-300 hover:text-red-700 p-1.5 transition-colors"
                              title="Delete historical count log"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {hasMoreHistory && (
                  <button
                    type="button"
                    onClick={() => setHistoryFetchLimit(prev => prev + 15)}
                    className="w-full py-2.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-mono font-bold border border-neutral-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-neutral-500" />
                    Load More Audits (+15)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Historical Stocktake Sheet Details */}
          <div className="lg:col-span-7">
            {selectedHistoryItem ? (
              <div className="border border-neutral-200 bg-white p-5 text-left space-y-4 shadow-sm">
                <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 font-mono">
                      Stocktake Ledger Sheet Details
                    </h3>
                    <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
                      Unique Entry ID: {selectedHistoryItem.id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedHistoryItem(null)}
                    className="p-1 text-neutral-400 hover:text-black transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Metadata card info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-neutral-50 border border-neutral-200 p-3.5 font-mono text-xs">
                  <div>
                    <p className="text-[8.5px] text-neutral-400 font-bold">Logged Date</p>
                    <p className="font-bold text-neutral-800">{selectedHistoryItem.date}</p>
                  </div>
                  <div>
                    <p className="text-[8.5px] text-neutral-400 font-bold">Monitored Items</p>
                    <p className="font-bold text-neutral-800">{selectedHistoryItem.totalItemsCount} rows</p>
                  </div>
                  <div>
                    <p className="text-[8.5px] text-neutral-400 font-bold">Total Capital</p>
                    <p className="font-bold text-emerald-800">${selectedHistoryItem.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[8.5px] text-neutral-400 font-bold">Operator</p>
                    <p className="font-bold text-neutral-800 truncate" title={(selectedHistoryItem as any).recordedBy || "Unknown"}>
                      {(selectedHistoryItem as any).recordedBy || "System Operator"}
                    </p>
                  </div>
                </div>

                {/* List of items inside this stocktake */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-neutral-500">
                    Calculated Asset Details ({selectedHistoryItem.items?.length || 0} Ingredients)
                  </span>

                  <div className="border border-neutral-200 max-h-[350px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-neutral-200 text-xs text-neutral-800 text-left bg-white font-mono">
                      <thead className="bg-neutral-50 text-[10px] font-bold text-neutral-600 border-b border-neutral-200">
                        <tr>
                          <th className="px-3 py-2">Ingredient Item</th>
                          <th className="px-3 py-2 text-center w-28">Physical count</th>
                          <th className="px-3 py-2 text-center w-28">Pound Data (lbs)</th>
                          <th className="px-3 py-2 text-right w-32">Unit Rate</th>
                          <th className="px-3 py-2 text-right w-28">Financial Asset</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {selectedHistoryItem.items && selectedHistoryItem.items.map((logItem, i) => {
                          const pData = logItem.totalPounds !== undefined
                            ? logItem.totalPounds
                            : calculatePoundData(logItem.inStock, logItem.unit, logItem.weightPerCase, logItem.weightPerCaseUnit, logItem.pcsPerPound).lbs;

                          return (
                            <tr key={i} className="hover:bg-neutral-50/50">
                              <td className="px-3 py-2 font-bold font-sans">{logItem.name}</td>
                              <td className="px-3 py-2 text-center font-bold">
                                {logItem.inStock} <span className="text-[9px] text-neutral-400 font-normal">({logItem.unit})</span>
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-emerald-800">
                                {pData.toFixed(2)} lbs
                              </td>
                              <td className="px-3 py-2 text-right text-neutral-600 font-mono">
                                {logItem.unitRate !== undefined ? `$${logItem.unitRate.toFixed(4)} /${logItem.rateUnit || logItem.unit}` : `$${logItem.price.toFixed(2)}`}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-neutral-900">${logItem.value.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-200 flex justify-end">
                  <button
                    onClick={() => {
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        const itemsHtml = selectedHistoryItem.items.map(item => {
                          const pData = item.totalPounds !== undefined
                            ? item.totalPounds
                            : calculatePoundData(item.inStock, item.unit, item.weightPerCase, item.weightPerCaseUnit, item.pcsPerPound).lbs;

                          return `
                            <tr>
                              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: left;">${item.name}</td>
                              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.inStock} (${item.unit})</td>
                              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold; color: #065f46;">${pData.toFixed(2)} lbs</td>
                              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.unitRate !== undefined ? `${item.unitRate.toFixed(4)} /${item.rateUnit || item.unit}` : `${item.price.toFixed(2)}`}</td>
                              <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">$${item.value.toFixed(2)}</td>
                            </tr>
                          `;
                        }).join("");

                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Culinary Cost Intelligence - Stocktake Sheet #${selectedHistoryItem.id.slice(-5).toUpperCase()}</title>
                              <style>
                                body { font-family: sans-serif; padding: 20px; color: #141414; }
                                h1, h2 { text-transform: ; margin-bottom: 5px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                th { background-color: #f0efeb; text-align: left; padding: 8px; border-bottom: 2px solid #141414; }
                              </style>
                            </head>
                            <body onload="window.print()">
                              <h2>CULINARY COST INTELLIGENCE</h2>
                              <h3>Stocktake Ledger Details (Sheet #${selectedHistoryItem.id.slice(-5).toUpperCase()})</h3>
                              <p><strong>Date:</strong> ${selectedHistoryItem.date}</p>
                              <p><strong>Suppliers:</strong> ${selectedHistoryItem.vendorFilter}</p>
                              <p><strong>Operator:</strong> ${(selectedHistoryItem as any).recordedBy || "System Operator"}</p>
                              <p><strong>Total Asset Value:</strong> $${selectedHistoryItem.totalValue.toFixed(2)}</p>
                              
                              <table>
                                <thead>
                                  <tr>
                                    <th>Ingredient</th>
                                    <th style="text-align: center;">Physical Count</th>
                                    <th style="text-align: right;">Rate / Pack</th>
                                    <th style="text-align: right;">Total On-Hand Val</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${itemsHtml}
                                </tbody>
                              </table>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 font-mono text-[10px] font-bold tracking-wide cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Print / Export PDF Record
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-neutral-200/30 h-full min-h-[300px] flex flex-col items-center justify-center text-neutral-500 font-sans p-6 bg-neutral-50/30">
                <History className="h-10 w-10 text-neutral-300 mb-2" />
                <p className="font-bold text-xs text-neutral-700">No Stocktake Selected</p>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-sm text-center">
                  Select a historical stocktake sheet from the sidebar list to inspect the recorded quantities, exact financial asset valuations, and operator audit metadata.
                </p>
              </div>
            )}
          </div>
        </div>
        </div>
      ) : null}

      {subTab === "consumptions" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Record Consumption Form (Left Side - 4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="border border-neutral-200 bg-white p-5 text-left">
              <div className="border-b border-neutral-200 pb-3 mb-4">
                <h3 className="text-xs font-bold text-neutral-900 font-mono flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-800" />
                  Record Ingredient Consumption
                </h3>
                <p className="text-[10px] text-neutral-500 font-sans mt-0.5">
                  Log ingredient consumption/usage to accurately update inventory on-hand balances.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setIsTabletMode(true)}
                    className="w-full bg-emerald-600 hover:bg-neutral-800 text-white flex items-center justify-center gap-2 py-3 px-4 rounded text-xs font-bold transition-colors shadow-lg"
                  >
                    <Package className="h-4 w-4" />
                    Open Tablet POS Mode
                  </button>
                </div>
              </div>


            </div>
          </div>

          {/* Consumption Logs Ledger (Right Side - 8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Header & On-Demand Fetch Controls */}
            <div className="bg-white border border-neutral-200 rounded-xl p-3.5 shadow-xs space-y-3 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold text-neutral-800 flex items-center gap-2">
                    <span>Restaurant Ingredient Consumption Log</span>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                      {filteredConsumptions.length} {filteredConsumptions.length !== consumptions.length ? `of ${consumptions.length}` : ""} entries
                    </span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    POS Consumption &amp; Restock Ledger (recorded exclusively via Tablet POS Mode). Filter by staff, ingredient, restaurant, or date.
                  </p>
                </div>

                {/* Database Fetch On Demand Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Calendar Date Period Quick Button */}
                  <button
                    type="button"
                    onClick={() => setShowLedgerCalendar(prev => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                      ledgerCustomStartDate || ledgerCustomEndDate || showLedgerCalendar
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30 shadow-xs"
                        : "bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                    }`}
                    title="Open calendar to drag and select a date range"
                  >
                    <CalendarRange className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span>
                      {ledgerCustomStartDate && ledgerCustomEndDate ? (
                        ledgerCustomStartDate === ledgerCustomEndDate ? (
                          ledgerCustomStartDate === getTodayISO() ? "Today" : ledgerCustomStartDate
                        ) : (
                          `${ledgerCustomStartDate} → ${ledgerCustomEndDate}`
                        )
                      ) : ledgerDatePreset === "TODAY" ? (
                        `Today (${getTodayISO()})`
                      ) : ledgerDatePreset === "YESTERDAY" ? (
                        "Yesterday"
                      ) : ledgerDatePreset === "7DAYS" ? (
                        "7 Days"
                      ) : ledgerDatePreset === "30DAYS" ? (
                        "30 Days"
                      ) : (
                        "All Time"
                      )}
                    </span>
                    <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showLedgerCalendar ? "rotate-180" : ""}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoadingConsumptions(true);
                      setTimeout(() => setManualFetchTrigger(t => t + 1), 600);
                    }}
                    disabled={loadingConsumptions}
                    className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                    title="Fetch latest data on demand from cloud database"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingConsumptions ? 'animate-spin' : ''}`} />
                    <span>{loadingConsumptions ? 'Fetching...' : 'Fetch'}</span>
                  </button>
                  
                  {/* Query limit selector */}
                  <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1" title="Query fetch limit from database">
                    <span className="text-[9px] font-mono font-bold text-neutral-500">Limit:</span>
                    <select
                      value={ledgerFetchLimit}
                      onChange={(e) => setLedgerFetchLimit(Number(e.target.value))}
                      className="bg-transparent text-[10px] font-mono font-bold text-neutral-800 focus:outline-none cursor-pointer"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={250}>250</option>
                      <option value={0}>All</option>
                    </select>
                  </div>
                  
                  {/* Export Dropdown Menu (CSV & JSON) */}
                  <div className="relative" ref={exportDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowExportDropdown(prev => !prev)}
                      disabled={filteredConsumptions.length === 0}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                      title="Download consumption ledger records"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                      <ChevronDown className={`h-3 w-3 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showExportDropdown && filteredConsumptions.length > 0 && (
                      <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-neutral-200 rounded-xl shadow-xl z-30 py-1 divide-y divide-neutral-100 font-sans">
                        <div className="px-3 py-1.5 text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                          Export Format
                        </div>
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadConsumptionCSV();
                              setShowExportDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <div>
                              <div className="font-bold">CSV Spreadsheet</div>
                              <div className="text-[9px] text-neutral-400">Excel / Google Sheets</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handleDownloadConsumptionJSON();
                              setShowExportDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-sky-50 hover:text-sky-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <FileJson className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                            <div>
                              <div className="font-bold">JSON File</div>
                              <div className="text-[9px] text-neutral-400">Structured data object</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Search Bar & Filter Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2">
                {/* 1. Universal Search Input */}
                <div className="lg:col-span-4 relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    value={ledgerSearchQuery}
                    onChange={(e) => { setLedgerSearchQuery(e.target.value); setConsumptionPage(1); }}
                    placeholder="Search Staff, Ingredient, Restaurant..."
                    className="w-full bg-neutral-50 border border-neutral-200 pl-8 pr-7 py-1.5 text-xs text-neutral-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                  />
                  {ledgerSearchQuery && (
                    <button 
                      type="button"
                      onClick={() => setLedgerSearchQuery("")}
                      className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* 2. Restaurant Filter */}
                <div className="lg:col-span-3">
                  <select
                    value={ledgerFilterRestaurant}
                    onChange={(e) => { setLedgerFilterRestaurant(e.target.value); setConsumptionPage(1); }}
                    className="w-full bg-neutral-50 border border-neutral-200 px-2 py-1.5 text-xs text-neutral-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-sans truncate"
                  >
                    <option value="ALL">🍽️ All Restaurants</option>
                    {uniqueRestaurants.map((res) => (
                      <option key={res} value={res}>🍽️ {res}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Recorded By Filter */}
                <div className="lg:col-span-2">
                  <select
                    value={ledgerFilterRecordedBy}
                    onChange={(e) => { setLedgerFilterRecordedBy(e.target.value); setConsumptionPage(1); }}
                    className="w-full bg-neutral-50 border border-neutral-200 px-2 py-1.5 text-xs text-neutral-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-sans truncate"
                  >
                    <option value="ALL">👤 All Staff</option>
                    {uniqueRecordedBy.map((staff) => (
                      <option key={staff} value={staff}>👤 {staff}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Qty Used (+ or -) Separate Filter */}
                <div className="lg:col-span-3">
                  <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg p-0.5 text-xs h-[30px]">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-1.5 shrink-0">
                      Qty:
                    </span>
                    <button
                      type="button"
                      onClick={() => { setLedgerQtyFilter("ALL"); setConsumptionPage(1); }}
                      className={`flex-1 h-full rounded text-[10px] font-bold transition-colors text-center flex items-center justify-center ${
                        ledgerQtyFilter === "ALL"
                          ? "bg-white text-neutral-900 shadow-xs border border-neutral-200 font-extrabold"
                          : "text-neutral-500 hover:text-neutral-900"
                      }`}
                      title="Show both positive (+) and negative (-) quantities"
                    >
                      All (±)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLedgerQtyFilter("DEDUCTION"); setConsumptionPage(1); }}
                      className={`flex-1 h-full rounded text-[10px] font-bold transition-colors text-center flex items-center justify-center gap-0.5 ${
                        ledgerQtyFilter === "DEDUCTION"
                          ? "bg-red-50 text-red-800 shadow-xs border border-red-200 font-extrabold"
                          : "text-neutral-500 hover:text-red-700"
                      }`}
                      title="Show only consumed / deducted quantities (-)"
                    >
                      <span className="text-red-600 font-bold">−</span> Used ({qtyCounts.deductions})
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLedgerQtyFilter("ADDITION"); setConsumptionPage(1); }}
                      className={`flex-1 h-full rounded text-[10px] font-bold transition-colors text-center flex items-center justify-center gap-0.5 ${
                        ledgerQtyFilter === "ADDITION"
                          ? "bg-emerald-50 text-emerald-800 shadow-xs border border-emerald-200 font-extrabold"
                          : "text-neutral-500 hover:text-emerald-700"
                      }`}
                      title="Show only restocked / added quantities (+)"
                    >
                      <span className="text-emerald-600 font-bold">+</span> Added ({qtyCounts.additions})
                    </button>
                  </div>
                </div>
              </div>

              {/* Date Period Calendar Drag-to-Select Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-neutral-50/70 border border-neutral-200 rounded-xl text-xs relative">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-neutral-700 font-bold text-xs">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px]">Period:</span>
                  </div>

                  {/* Calendar Popover Trigger */}
                  <div className="relative" ref={calendarDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowLedgerCalendar(prev => !prev)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                        ledgerCustomStartDate || ledgerCustomEndDate || showLedgerCalendar
                          ? "bg-white text-emerald-900 border-emerald-300 ring-1 ring-emerald-400/30 shadow-xs"
                          : "bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-100"
                      }`}
                      title="Open Calendar to drag and select a custom date period"
                    >
                      <CalendarRange className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>
                        {ledgerCustomStartDate && ledgerCustomEndDate ? (
                          ledgerCustomStartDate === ledgerCustomEndDate ? (
                            ledgerCustomStartDate === getTodayISO() ? "Today" : ledgerCustomStartDate
                          ) : (
                            `${ledgerCustomStartDate} → ${ledgerCustomEndDate}`
                          )
                        ) : ledgerDatePreset === "TODAY" ? (
                          `Today (${getTodayISO()})`
                        ) : ledgerDatePreset === "YESTERDAY" ? (
                          "Yesterday"
                        ) : ledgerDatePreset === "7DAYS" ? (
                          "Last 7 Days"
                        ) : ledgerDatePreset === "30DAYS" ? (
                          "Last 30 Days"
                        ) : (
                          "All Time (Drag on Calendar)"
                        )}
                      </span>
                      <ChevronDown className={`h-3 w-3 text-neutral-400 transition-transform ${showLedgerCalendar ? "rotate-180" : ""}`} />
                    </button>

                    {/* Popover Calendar */}
                    {showLedgerCalendar && !isLedgerCalendarPinned && (
                      <div className="absolute left-0 top-full mt-2 z-40 shadow-2xl">
                        <ConsumptionDateRangeCalendar
                          startDate={ledgerCustomStartDate || (ledgerDatePreset === "TODAY" ? getTodayISO() : "")}
                          endDate={ledgerCustomEndDate || (ledgerDatePreset === "TODAY" ? getTodayISO() : "")}
                          onSelectRange={(start, end) => {
                            setLedgerDatePreset("CUSTOM");
                            setLedgerCustomStartDate(start);
                            setLedgerCustomEndDate(end);
                            setLedgerFilterDate("");
                            setConsumptionPage(1);
                          }}
                          onClear={() => {
                            setLedgerDatePreset("ALL");
                            setLedgerCustomStartDate("");
                            setLedgerCustomEndDate("");
                            setLedgerFilterDate("");
                            setConsumptionPage(1);
                          }}
                          datesWithRecords={datesWithRecords}
                          onClose={() => setShowLedgerCalendar(false)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Inline/Pinned Calendar toggle button */}
                  <button
                    type="button"
                    onClick={() => setIsLedgerCalendarPinned(prev => !prev)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors flex items-center gap-1 border ${
                      isLedgerCalendarPinned
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                    }`}
                    title={isLedgerCalendarPinned ? "Collapse inline calendar" : "Keep calendar expanded on screen"}
                  >
                    <CalendarRange className="w-3 h-3" />
                    <span>{isLedgerCalendarPinned ? "Hide Calendar" : "Expand Calendar"}</span>
                  </button>

                  {/* Quick Preset Chips */}
                  <div className="hidden sm:flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const t = getTodayISO();
                        setLedgerDatePreset("CUSTOM");
                        setLedgerCustomStartDate(t);
                        setLedgerCustomEndDate(t);
                        setConsumptionPage(1);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        ledgerCustomStartDate === getTodayISO() && ledgerCustomEndDate === getTodayISO()
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = getYesterdayISO();
                        setLedgerDatePreset("CUSTOM");
                        setLedgerCustomStartDate(y);
                        setLedgerCustomEndDate(y);
                        setConsumptionPage(1);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100"
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const end = getTodayISO();
                        const start = getNDaysAgoISO(6);
                        setLedgerDatePreset("CUSTOM");
                        setLedgerCustomStartDate(start);
                        setLedgerCustomEndDate(end);
                        setConsumptionPage(1);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100"
                    >
                      7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerDatePreset("ALL");
                        setLedgerCustomStartDate("");
                        setLedgerCustomEndDate("");
                        setConsumptionPage(1);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        !ledgerCustomStartDate && !ledgerCustomEndDate && ledgerDatePreset === "ALL"
                          ? "bg-neutral-900 text-white"
                          : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100"
                      }`}
                    >
                      All Time
                    </button>
                  </div>
                </div>

                {/* Reset Filters button */}
                {(ledgerSearchQuery || ledgerFilterRestaurant !== "ALL" || ledgerFilterRecordedBy !== "ALL" || ledgerFilterDate || ledgerCustomStartDate || ledgerCustomEndDate || ledgerQtyFilter !== "ALL" || ledgerDatePreset !== "ALL") && (
                  <button
                    type="button"
                    onClick={handleResetLedgerFilters}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-800 cursor-pointer ml-auto"
                  >
                    <X className="h-3 w-3" />
                    <span>Clear Filters</span>
                  </button>
                )}
              </div>

              {/* Inline Calendar when expanded */}
              {isLedgerCalendarPinned && (
                <div className="pt-1">
                  <ConsumptionDateRangeCalendar
                    isInline={true}
                    startDate={ledgerCustomStartDate || (ledgerDatePreset === "TODAY" ? getTodayISO() : "")}
                    endDate={ledgerCustomEndDate || (ledgerDatePreset === "TODAY" ? getTodayISO() : "")}
                    onSelectRange={(start, end) => {
                      setLedgerDatePreset("CUSTOM");
                      setLedgerCustomStartDate(start);
                      setLedgerCustomEndDate(end);
                      setLedgerFilterDate("");
                      setConsumptionPage(1);
                    }}
                    onClear={() => {
                      setLedgerDatePreset("ALL");
                      setLedgerCustomStartDate("");
                      setLedgerCustomEndDate("");
                      setLedgerFilterDate("");
                      setConsumptionPage(1);
                    }}
                    datesWithRecords={datesWithRecords}
                    onClose={() => setIsLedgerCalendarPinned(false)}
                  />
                </div>
              )}

              {lastFetchedTime && (
                <div className="text-[10px] text-neutral-400 text-right font-mono pt-0.5">
                  Last database request: {lastFetchedTime} • Loaded {consumptions.length} logs ({filteredConsumptions.length} matching)
                </div>
              )}
            </div>

            {loadingConsumptions ? (
              <div className="flex items-center justify-center py-16 bg-white border border-neutral-200 rounded-xl">
                <RefreshCw className="h-5 w-5 animate-spin text-neutral-500 mr-2" />
                <span className="text-xs font-mono">Fetching consumption records from database...</span>
              </div>
            ) : filteredConsumptions.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center text-neutral-500 font-sans">
                <TrendingDown className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
                <p className="font-bold tracking-wide text-xs">
                  {consumptions.length === 0 ? "No consumptions logged yet" : "No entries match your search/filter criteria"}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {consumptions.length === 0 
                    ? "Use the form on the left to record daily raw food ingredient usage." 
                    : "Try clearing search filters or adjusting the date range."}
                </p>
                {consumptions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetLedgerFilters}
                    className="mt-3 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reset All Search Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#141414] text-xs text-neutral-900 text-left bg-white font-mono">
                    <thead className="bg-[#f0efeb] text-neutral-900 font-bold text-[9px] border-b border-neutral-200">
                      <tr>
                        <th className="px-3 py-2.5 border-r border-neutral-200">Created At</th>
                        <th className="px-3 py-2.5 border-r border-neutral-200">Restaurant</th>
                        <th className="px-3 py-2.5 border-r border-neutral-200">Ingredient Item</th>
                        <th className="px-3 py-2.5 border-r border-neutral-200 text-center w-36">
                          <div className="flex items-center justify-center gap-1">
                            <span>Qty Used</span>
                            {ledgerQtyFilter !== "ALL" && (
                              <span className={`text-[8px] px-1 py-0.2 rounded font-mono font-bold ${
                                ledgerQtyFilter === "DEDUCTION" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                              }`}>
                                {ledgerQtyFilter === "DEDUCTION" ? "− Used" : "+ Added"}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-3 py-2.5 border-r border-neutral-200 text-right w-28">Total Cost</th>
                        <th className="px-3 py-2.5 border-r border-neutral-200 w-28">Recorded By</th>
                        {!isReadOnly && <th className="px-2 py-2.5 text-center w-12"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {(() => {
                        const itemsPerPage = 10;
                        const totalPages = Math.ceil(filteredConsumptions.length / itemsPerPage);
                        const validPage = Math.min(consumptionPage, Math.max(1, totalPages));
                        const startIndex = (validPage - 1) * itemsPerPage;
                        const paginatedList = filteredConsumptions.slice(startIndex, startIndex + itemsPerPage);
                        return paginatedList.map((log) => {
                          const ing = ingredients.find(i => i.id === log.ingredientId || i.name.toLowerCase() === (log.ingredientName || "").toLowerCase());
                          const detail = getConsumptionQtyDetail(log, ing);
                          return (
                            <tr key={log.id} className="hover:bg-neutral-50/70">
                              {/* Created At */}
                              <td className="px-3 py-2.5 border-r border-neutral-200 whitespace-nowrap text-neutral-700 font-bold">
                                {formatLogDateTime(log)}
                              </td>
                              {/* Restaurant */}
                              <td className="px-3 py-2.5 border-r border-neutral-200 text-neutral-900 font-semibold font-sans truncate max-w-[120px]" title={log.vendorName}>
                                🍽️ {log.vendorName}
                              </td>
                              {/* Ingredient */}
                              <td className="px-3 py-2.5 border-r border-neutral-200 text-neutral-800 font-bold font-sans">
                                {log.ingredientName}
                              </td>
                              {/* Qty Consumed */}
                              <td className={`px-3 py-2.5 border-r border-neutral-200 text-center font-bold ${log.quantity > 0 ? "text-red-700" : "text-emerald-700"}`}>
                                <div className="flex flex-col items-center justify-center font-mono">
                                  <span className="whitespace-nowrap font-bold text-xs">
                                    {detail.primary} {detail.secondary && <span className="text-[10px] font-bold italic opacity-90 ml-0.5">{detail.secondary}</span>}
                                  </span>
                                </div>
                              </td>
                            {/* Total Cost */}
                            <td className={`px-3 py-2.5 border-r border-neutral-200 text-right font-bold ${log.quantity > 0 ? "text-red-800" : "text-emerald-800"}`}>
                              {log.quantity > 0 ? "-" : "+"}${Math.abs(log.totalCost || 0).toFixed(2)}
                            </td>
                            {/* Recorded By */}
                            <td className="px-3 py-2.5 border-r border-neutral-200 text-neutral-600 truncate max-w-[100px]" title={log.recordedBy}>
                              {log.recordedBy}
                            </td>
                            {/* Delete Action */}
                            {!isReadOnly && (
                              <td className="px-2 py-2.5 text-center">
                                {confirmDeleteConsumptionId === log.id ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteConsumptionId(null);
                                        handleDeleteConsumptionLog(log.id, e);
                                      }}
                                      className="text-white bg-red-600 hover:bg-red-700 px-1 py-0.5 text-[8px] font-bold cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteConsumptionId(null);
                                      }}
                                      className="text-neutral-500 hover:text-neutral-900 p-0.5 cursor-pointer"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteConsumptionId(log.id);
                                    }}
                                    className="text-neutral-300 hover:text-red-700 p-1 transition-colors cursor-pointer"
                                    title="Delete consumption entry"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })()}
                    </tbody>
                  </table>
                </div>

                {/* Consumptions summary bar */}
                {(() => {
                  const totalDeductedCost = filteredConsumptions.filter(r => r.quantity > 0).reduce((sum, r) => sum + Math.abs(r.totalCost || 0), 0);
                  const totalAddedCost = filteredConsumptions.filter(r => r.quantity < 0).reduce((sum, r) => sum + Math.abs(r.totalCost || 0), 0);
                  const netCost = totalDeductedCost - totalAddedCost;

                  return (
                    <div className="bg-[#f0efeb] border-t border-neutral-200 p-3 flex flex-wrap justify-between items-center gap-2 text-[10px] font-sans font-bold text-neutral-900">
                      <div className="flex items-center gap-3">
                        <span>CONSUMPTION LEDGER SUMMARY</span>
                        <span className="text-neutral-500 font-normal">
                          ({filteredConsumptions.length} entries shown)
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        {totalAddedCost > 0 && (
                          <span className="text-emerald-800 font-bold">
                            RESTOCKED (+): +${totalAddedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        <span className="text-red-800 font-bold">
                          CONSUMED (−): -${totalDeductedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        {totalAddedCost > 0 && (
                          <span className="text-neutral-900 font-bold border-l border-neutral-300 pl-3">
                            NET: ${netCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Pagination Controls */}
                {(() => {
                  const itemsPerPage = 10;
                  const totalPages = Math.ceil(filteredConsumptions.length / itemsPerPage);
                  if (totalPages <= 1) return null;
                  
                  const validPage = Math.min(consumptionPage, Math.max(1, totalPages));
                  const startIndex = (validPage - 1) * itemsPerPage;
                  const endIndex = Math.min(startIndex + itemsPerPage, filteredConsumptions.length);

                  return (
                    <div className="bg-neutral-50 border-t border-neutral-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-sans font-bold text-neutral-600">
                      <div className="text-[10px] text-neutral-500 font-bold">
                        Showing <span className="font-mono">{startIndex + 1}</span> to <span className="font-mono">{endIndex}</span> of <span className="font-mono">{filteredConsumptions.length}</span> entries
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono">
                        <button
                          type="button"
                          disabled={validPage === 1}
                          onClick={() => setConsumptionPage(p => Math.max(1, p - 1))}
                          className="px-2 py-1 bg-white border border-neutral-200 text-[10px] font-bold hover:bg-neutral-100 disabled:opacity-40 transition-colors cursor-pointer rounded"
                        >
                          Prev
                        </button>
                        {Array.from({ length: totalPages }).map((_, i) => {
                          const pageNum = i + 1;
                          const isNear = Math.abs(validPage - pageNum) <= 1;
                          const isFirstOrLast = pageNum === 1 || pageNum === totalPages;
                          
                          if (!isNear && !isFirstOrLast) {
                            if (pageNum === 2 && validPage > 3) {
                              return <span key="ellipsis-prev" className="px-1 text-neutral-400 select-none">...</span>;
                            }
                            if (pageNum === totalPages - 1 && validPage < totalPages - 2) {
                              return <span key="ellipsis-next" className="px-1 text-neutral-400 select-none">...</span>;
                            }
                            return null;
                          }

                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setConsumptionPage(pageNum)}
                              className={`px-2.5 py-1 border border-neutral-200 font-bold text-[10px] transition-colors cursor-pointer rounded ${
                                validPage === pageNum
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-neutral-900 hover:bg-neutral-100"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          disabled={validPage === totalPages}
                          onClick={() => setConsumptionPage(p => Math.min(totalPages, p + 1))}
                          className="px-2 py-1 bg-white border border-neutral-200 text-[10px] font-bold hover:bg-neutral-100 disabled:opacity-40 transition-colors cursor-pointer rounded"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Add Manual Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-emerald-600/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-neutral-200 w-full max-w-2xl shadow-2xl relative rounded-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center p-4 border-b border-neutral-200 bg-[#f0efeb]">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg text-neutral-900">Add Inventory Item</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowBulkImportModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Switch to Bulk Import (CSV / Paste)
                </button>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-900/50 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414] rounded-xl font-mono"
                  placeholder="e.g. Ground Beef 80/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Price ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414] rounded-xl font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Unit
                  </label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414] rounded-xl font-mono cursor-pointer"
                  >
                    <option value="" disabled>Select unit...</option>
                    <option value="lb">lb</option>
                                          <option value="g">gram</option>
                                          <option value="gal">gal</option>
                                          <option value="ml">ml</option>
                                          <option value="oz">oz</option>
                                          <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Vendor / Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={newItemVendor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__NEW_VENDOR__") {
                        const customVendor = window.prompt("Enter supplier/vendor name to assign:");
                        if (customVendor && customVendor.trim()) {
                          setNewItemVendor(customVendor.trim());
                        }
                      } else {
                        setNewItemVendor(val);
                      }
                    }}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414] rounded-xl cursor-pointer font-sans font-medium"
                  >
                    <option value="">-- Select Registered Supplier --</option>
                    {vendorsList.map((v) => (
                      <option key={v} value={v}>
                        🏢 {v}
                      </option>
                    ))}
                    <option value="Unassigned">Default / Unassigned Supplier</option>
                    <option value="__NEW_VENDOR__">➕ Custom Supplier...</option>
                  </select>
                  {newItemVendor && !vendorsList.includes(newItemVendor) && newItemVendor !== "unassigned" && newItemVendor !== "Unassigned" && (
                    <p className="text-[10px] text-amber-800 font-mono mt-1">
                      Selected supplier: <span className="font-bold">{newItemVendor}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-900 mb-1">
                    Storage Location
                  </label>
                  <select
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414] rounded-xl cursor-pointer"
                  >
                    {PRESET_LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-900 mb-1">
                  Item Category <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#141414] rounded-xl cursor-pointer"
                >
                  <option value="Meat">🥩 Meat</option>
                  <option value="Vegetables">🥦 Vegetables</option>
                  <option value="Fruit">🍎 Fruit</option>
                  <option value="Bread">🍞 Bread</option>
                  <option value="Seafood">🐟 Seafood</option>
                  <option value="Dairy">🥛 Dairy</option>
                  <option value="Dry Goods">🌾 Dry Goods</option>
                  <option value="Beverages">🥤 Beverages</option>
                  <option value="Other">🍽️ Other / Something else</option>
                </select>
              </div>

              <div className="pt-4 mt-2 flex justify-end gap-2 border-t border-neutral-200/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-transparent hover:bg-neutral-100 text-neutral-900 text-xs font-bold transition-colors border border-transparent rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-black text-[#f0efeb] text-xs font-bold transition-colors shadow-sm rounded-xl"
                >
                  Save Item
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isTabletMode && (
        <TabletConsumptionPOS
          ingredients={ingredients}
          vendors={vendors}
          departments={departments}
          employees={employees}
          workspaceOwnerId={workspaceOwnerId}
          user={user}
          onClose={() => setIsTabletMode(false)}
          onEditIngredient={onEditIngredient}
          onAddIngredient={onAddIngredient}
          isReadOnly={isReadOnly}
        />
      )}

      <BulkIngredientImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        ingredients={ingredients}
        vendors={vendors}
        workspaceOwnerId={workspaceOwnerId || undefined}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}
