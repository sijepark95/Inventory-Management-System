import React, { useState, useMemo } from "react";
import {
  Invoice,
  GroceryPurchase,
  Ingredient,
  Recipe,
  DailySale,
} from "../types";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Printer,
  Search,
  ArrowUpDown,
  DollarSign,
  Package,
  Building2,
  Receipt,
  PieChart as PieChartIcon,
  Layers,
  AlertCircle,
  CheckCircle2,
  FileText,
  Eye,
  ShoppingBag,
  ExternalLink,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Upload,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { normalizeBaseUnit, getEffectiveBaseQuantity } from "../lib/unitConverter";
import { processInvoiceFile } from "../lib/fileHelper";

interface ReportCenterViewProps {
  invoices: Invoice[];
  groceryPurchases: GroceryPurchase[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  dailySales?: DailySale[];
  onSwitchSection?: (section: string) => void;
  onDeleteInvoice?: (id: string) => Promise<void>;
  onUpdateInvoice?: (id: string, updates: Partial<Invoice>) => Promise<void>;
  onClearReportCenter?: () => Promise<void>;
  isReadOnly?: boolean;
}

type DatePreset = "7d" | "30d" | "thisMonth" | "90d" | "ytd" | "all" | "custom";
type ActiveReportTab = "ingredients" | "vendors" | "categories" | "foodcost";
type MeatSubType = "all" | "Beef" | "Chicken & Poultry" | "Pork" | "Other Meat";

const CHART_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#64748b", // slate
  "#14b8a6", // teal
];

/**
 * Classifies a meat item into a specific protein sub-group (Beef, Chicken & Poultry, Pork, Other Meat)
 */
export function classifyMeatSubType(itemName: string): Exclude<MeatSubType, "all"> {
  const name = (itemName || "").toLowerCase();
  if (
    /\b(beef|steak|ribeye|sirloin|tenderloin|brisket|wagyu|short rib|chuck|flank|skirt|tri-tip|ground beef|patty|roast beef|filet|ny strip|strip loin|prime rib|oxtail|bulgogi|galbi|kalbi|carne)\b/.test(
      name
    )
  ) {
    return "Beef";
  }
  if (
    /\b(chicken|poultry|turkey|duck|wing|wings|thigh|breast|drumstick|tender|tenders|pollo|fowl|cornish|quail)\b/.test(
      name
    )
  ) {
    return "Chicken & Poultry";
  }
  if (
    /\b(pork|bacon|sausage|ham|prosciutto|pepperoni|salami|chorizo|spare rib|baby back|pork belly|pork chop|pork loin|pork shoulder|butt|carnitas|pancetta|guanciale|bratwurst)\b/.test(
      name
    )
  ) {
    return "Pork";
  }
  return "Other Meat";
}

/**
 * Classifies an ingredient into a canonical Culinary Ingredient Type
 * using its catalog category first, then intelligent culinary keyword matching.
 */
export function classifyIngredientType(
  itemName: string,
  catalogCategory?: string
): string {
  const cleanCat = (catalogCategory || "").trim();
  const lowerCat = cleanCat.toLowerCase();

  if (
    cleanCat &&
    ![
      "unassigned",
      "other",
      "general",
      "general food supply",
      "box",
      "case",
      "bag",
      "pack",
      "unit",
      "lb",
      "oz",
      "pc",
    ].includes(lowerCat)
  ) {
    if (
      lowerCat === "meat" ||
      lowerCat.includes("meat") ||
      lowerCat.includes("poultry") ||
      lowerCat.includes("beef") ||
      lowerCat.includes("pork") ||
      lowerCat.includes("chicken")
    ) {
      return "Meat & Poultry";
    }
    if (lowerCat.includes("seafood") || lowerCat.includes("fish")) {
      return "Seafood & Fish";
    }
    if (
      lowerCat === "vegetables" ||
      lowerCat === "fruit" ||
      lowerCat.includes("produce") ||
      lowerCat.includes("veg")
    ) {
      return "Fresh Produce";
    }
    if (lowerCat.includes("dairy") || lowerCat.includes("egg")) {
      return "Dairy & Eggs";
    }
    if (lowerCat.includes("bread") || lowerCat.includes("bakery")) {
      return "Bakery & Bread";
    }
    if (lowerCat.includes("dry") || lowerCat.includes("pantry") || lowerCat.includes("grain")) {
      return "Dry Goods & Pantry";
    }
    if (lowerCat.includes("beverage") || lowerCat.includes("drink") || lowerCat.includes("bar")) {
      return "Beverages & Bar";
    }
    if (lowerCat.includes("sauce") || lowerCat.includes("oil") || lowerCat.includes("condiment")) {
      return "Oils, Sauces & Condiments";
    }
    return cleanCat;
  }

  const name = (itemName || "").toLowerCase();

  if (
    /\b(chicken|beef|pork|turkey|duck|lamb|veal|mutton|goat|venison|bison|wing|wings|thigh|breast|drumstick|tender|tenders|steak|ribeye|sirloin|tenderloin|brisket|chuck|flank|skirt|tri-tip|bacon|sausage|ham|prosciutto|pepperoni|salami|chorizo|meatball|patty|wagyu|short rib|ribs|pork belly|kalbi|galbi|bulgogi|oxtail|carnitas|pancetta)\b/.test(
      name
    )
  ) {
    return "Meat & Poultry";
  }

  if (
    /\b(salmon|tuna|shrimp|prawn|fish|cod|halibut|bass|snapper|tilapia|crab|lobster|scallop|oyster|clam|mussel|calamari|squid|octopus|anchovy|eel|unagi|hamachi|yellowtail|ikura|tobiko|masago|seafood)\b/.test(
      name
    )
  ) {
    return "Seafood & Fish";
  }

  if (
    /\b(milk|cream|butter|cheese|cheddar|mozzarella|parmesan|provolone|swiss|feta|ricotta|brie|gouda|egg|eggs|yogurt|sour cream|whipping|half & half|half and half|mascarpone|dairy)\b/.test(
      name
    )
  ) {
    return "Dairy & Eggs";
  }

  if (
    /\b(onion|garlic|tomato|potato|lettuce|romaine|spinach|kale|arugula|cabbage|carrot|celery|pepper|jalapeno|bell pepper|cucumber|zucchini|squash|broccoli|cauliflower|asparagus|mushroom|avocado|lemon|lime|orange|apple|berry|strawberry|blueberry|peach|mango|banana|melon|herb|cilantro|parsley|basil|mint|thyme|rosemary|scallion|green onion|ginger|corn|pea|radish|beet|eggplant|sprout|produce)\b/.test(
      name
    )
  ) {
    return "Fresh Produce";
  }

  if (
    /\b(oil|olive oil|canola|vegetable oil|sesame oil|truffle oil|vinegar|soy sauce|tamari|teriyaki|sriracha|hot sauce|ketchup|mustard|mayo|mayonnaise|aioli|dressing|bbq|hoisin|oyster sauce|fish sauce|mirin|ponzu|miso|paste|stock|broth|bouillon|honey|syrup|maple|jam|jelly|relish|pickle|capers|sauce)\b/.test(
      name
    )
  ) {
    return "Oils, Sauces & Condiments";
  }

  if (
    /\b(bread|bun|buns|roll|rolls|brioche|baguette|ciabatta|sourdough|tortilla|pita|naan|croissant|muffin|bagel|toast|crust|dough|pastry|cake|pie)\b/.test(
      name
    )
  ) {
    return "Bakery & Bread";
  }

  if (
    /\b(flour|sugar|salt|rice|pasta|spaghetti|penne|fettuccine|noodle|ramen|udon|soba|bean|black bean|chickpea|lentil|oat|quinoa|barley|cornstarch|starch|panko|breadcrumb|baking|yeast|vanilla|cocoa|chocolate|spice|paprika|cumin|oregano|cinnamon|chili powder|curry|black pepper|sesame|almond|walnut|pecan|peanut|cashew|pistachio|nut|seed)\b/.test(
      name
    )
  ) {
    return "Dry Goods & Pantry";
  }

  if (
    /\b(soda|cola|coke|sprite|juice|coffee|espresso|tea|matcha|water|sparkling|tonic|ginger ale|lemonade|energy drink|wine|beer|sake|soju|beverage)\b/.test(
      name
    )
  ) {
    return "Beverages & Bar";
  }

  if (
    /\b(glove|foil|wrap|film|container|lid|cup|straw|napkin|towel|paper|bag|box|bleach|sanitizer|soap|detergent|sponge|trash|chemical|degreaser)\b/.test(
      name
    )
  ) {
    return "Packaging & Supplies";
  }

  return "Dry Goods & Pantry";
}

export const ReportCenterView: React.FC<ReportCenterViewProps> = ({
  invoices = [],
  groceryPurchases = [],
  ingredients = [],
  recipes = [],
  dailySales = [],
  onSwitchSection,
  onDeleteInvoice,
  onUpdateInvoice,
  onClearReportCenter,
  isReadOnly = false,
}) => {
  // Navigation & report modes
  const [activeTab, setActiveTab] = useState<ActiveReportTab>("ingredients");
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [targetUploadInvoice, setTargetUploadInvoice] = useState<Invoice | null>(null);

  const handleSourceFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetUploadInvoice || !onUpdateInvoice) return;
    setUploadingInvoiceId(targetUploadInvoice.id);
    try {
      const processed = await processInvoiceFile(file);
      await onUpdateInvoice(targetUploadInvoice.id, {
        fileUrl: processed.storageUrl || processed.dataUrl,
        fileName: processed.fileName,
        fileType: processed.mimeType,
        fileSize: processed.size,
      });
    } catch (err) {
      console.error("Failed to upload source document to Firebase Storage:", err);
    } finally {
      setUploadingInvoiceId(null);
      setTargetUploadInvoice(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Date Filtering State
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Source Filter State
  const [sourceFilter, setSourceFilter] = useState<"all" | "invoices" | "catalog" | "grocery">("all");

  // Specific Ingredient Tracker Filter State
  const [selectedIngredientName, setSelectedIngredientName] = useState<string>("all");
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState<string>("");

  // Category Average Price Tracker State (under Category Allocation)
  const [meatSubTypeFilter, setMeatSubTypeFilter] = useState<MeatSubType>("all");
  const [meatVendorFilter, setMeatVendorFilter] = useState<string>("all");
  const [meatSearchQuery, setMeatSearchQuery] = useState<string>("");
  const [selectedMeatItemKey, setSelectedMeatItemKey] = useState<string>("all");
  const [meatSortField, setMeatSortField] = useState<"avgPrice" | "totalCost" | "totalQty" | "count" | "name">("totalCost");
  const [meatSortOrder, setMeatSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Category drill-down state
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Calendar State for Vendor Spending by Calendar
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    // Default to the month of the most recent invoice/grocery/catalog purchase, or current month
    const allDates: string[] = [];
    invoices.forEach((inv) => {
      const d = inv.issueDate || inv.createdAt?.split("T")[0];
      if (d) allDates.push(d);
    });
    groceryPurchases.forEach((gp) => {
      const d = gp.date || gp.createdAt?.split("T")[0];
      if (d) allDates.push(d);
    });
    ingredients.forEach((ing) => {
      const d = ((ing as any).updatedAt || ing.lastUpdated || "")?.split("T")[0];
      if (d) allDates.push(d);
    });
    allDates.sort((a, b) => b.localeCompare(a));
    if (allDates.length > 0) {
      const parsed = new Date(`${allDates[0]}T12:00:00`);
      if (!isNaN(parsed.getTime()) && parsed.getTime() <= Date.now() + 86400000) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      }
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarVendorFilter, setCalendarVendorFilter] = useState<string>("all");

  // Preview Modal for attached invoice documents
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    name: string;
    type?: string;
    size?: number;
    title?: string;
    subtitle?: string;
  } | null>(null);

  // Sorting for transaction table
  const [sortField, setSortField] = useState<"date" | "total" | "price" | "qty">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Lookup map from ingredient ID or normalized name -> Ingredient
  const catalogLookup = useMemo(() => {
    const byId = new Map<string, Ingredient>();
    const byName = new Map<string, Ingredient>();
    ingredients.forEach((ing) => {
      if (ing.id) byId.set(ing.id, ing);
      if (ing.name) byName.set(ing.name.toLowerCase().trim(), ing);
      if (Array.isArray(ing.invoiceAliases)) {
        ing.invoiceAliases.forEach((alias) => {
          if (alias) byName.set(alias.toLowerCase().trim(), ing);
        });
      }
    });
    return { byId, byName };
  }, [ingredients]);

  // Calculate Active Date Range Boundaries
  const dateRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    if (datePreset === "7d") {
      start.setDate(now.getDate() - 7);
    } else if (datePreset === "30d") {
      start.setDate(now.getDate() - 30);
    } else if (datePreset === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (datePreset === "90d") {
      start.setDate(now.getDate() - 90);
    } else if (datePreset === "ytd") {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    } else if (datePreset === "custom") {
      start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(2020, 0, 1);
      const customEnd = customEndDate ? new Date(`${customEndDate}T23:59:59`) : now;
      return { start, end: customEnd };
    } else {
      start = new Date(2020, 0, 1);
    }
    return { start, end };
  }, [datePreset, customStartDate, customEndDate]);

  // Unified Normalization of All Purchase Transactions (Invoices + Catalog Ingredients + Grocery Receipts)
  const allPurchasedItems = useMemo(() => {
    const records: Array<{
      id: string;
      date: string; // YYYY-MM-DD
      timestamp: number;
      createdAtTimestamp?: number;
      sourceType: "invoice" | "grocery" | "catalog";
      documentRef: string;
      vendorOrStore: string;
      itemName: string;
      normalizedName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      totalCost: number;
      category: string;
      invoiceId?: string;
      fileUrl?: string;
      fileType?: string;
      fileSize?: number;
    }> = [];

    // Track which catalog ingredients are already represented in invoices to avoid double counting
    const invoicedIngredientIds = new Set<string>();
    const invoicedIngredientNames = new Set<string>();
    invoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        if (item.targetIngredientId) invoicedIngredientIds.add(item.targetIngredientId);
        if (item.name) {
          const norm = item.name.toLowerCase().trim();
          invoicedIngredientNames.add(norm);
          const matched =
            (item.targetIngredientId ? catalogLookup.byId.get(item.targetIngredientId) : undefined) ||
            catalogLookup.byName.get(norm);
          if (matched?.id) invoicedIngredientIds.add(matched.id);
          if (matched?.name) invoicedIngredientNames.add(matched.name.toLowerCase().trim());
        }
      });
    });

    // 1. Process Invoices
    if (sourceFilter === "all" || sourceFilter === "invoices") {
      invoices.forEach((inv) => {
        const rawDate = inv.issueDate || inv.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0];
        const parsedDate = new Date(`${rawDate.slice(0, 10)}T12:00:00`);
        const dateStr = !isNaN(parsedDate.getTime())
          ? parsedDate.toISOString().split("T")[0]
          : rawDate.slice(0, 10);
        const timeVal = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;
        const createdTimeVal = inv.createdAt ? new Date(inv.createdAt).getTime() : timeVal;

        if (!inv.items || inv.items.length === 0) {
          const fallbackTotal = Number(inv.totalAmount) || 0;
          if (fallbackTotal > 0) {
            const vendorLabel = inv.vendor || inv.vendorName || "Direct Vendor";
            records.push({
              id: `inv-${inv.id || inv.invoiceNumber || "no-id"}-summary`,
              date: dateStr,
              timestamp: timeVal,
              createdAtTimestamp: !isNaN(createdTimeVal) ? createdTimeVal : timeVal,
              sourceType: "invoice",
              documentRef: inv.invoiceNumber
                ? `INV #${inv.invoiceNumber}`
                : inv.fileName || "Vendor Invoice",
              vendorOrStore: vendorLabel,
              itemName: `${vendorLabel} Invoice Summary`,
              normalizedName: `${vendorLabel.toLowerCase().trim()} invoice summary`,
              quantity: 1,
              unit: "invoice",
              unitPrice: fallbackTotal,
              totalCost: fallbackTotal,
              category: "Dry Goods & Grocery",
              invoiceId: inv.id,
              fileUrl: inv.fileUrl,
              fileType: inv.fileType,
              fileSize: inv.fileSize,
            });
          }
          return;
        }

        (inv.items || []).forEach((item, idx) => {
          const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
          const total =
            Number(item.totalPrice) ||
            (Number(item.pricePerUnit) ? Number(item.pricePerUnit) * qty : 0) ||
            (Number((item as any).unitPrice) ? Number((item as any).unitPrice) * qty : 0);
          const unitRate = qty > 0 ? total / qty : total;
          const rawName = item.name || "Unnamed Item";
          const normName = rawName.toLowerCase().trim();

          const matchedIng =
            (item.targetIngredientId ? catalogLookup.byId.get(item.targetIngredientId) : undefined) ||
            catalogLookup.byName.get(normName);

          const resolvedName = matchedIng?.name || rawName;
          const ingredientType = classifyIngredientType(
            resolvedName,
            (item as any).category || matchedIng?.category
          );

          const effectiveUnit =
            qty > 1 && item.baseUnit && Number(item.weightPerCase) === qty
              ? item.baseUnit
              : item.unit || item.packagingUnit || matchedIng?.packagingUnit || matchedIng?.unit || "unit";

          records.push({
            id: `inv-${inv.id || inv.invoiceNumber || "no-id"}-${idx}`,
            date: dateStr,
            timestamp: timeVal,
            createdAtTimestamp: !isNaN(createdTimeVal) ? createdTimeVal : timeVal,
            sourceType: "invoice",
            documentRef: inv.invoiceNumber
              ? `INV #${inv.invoiceNumber}`
              : inv.fileName || "Vendor Invoice",
            vendorOrStore: inv.vendor || inv.vendorName || matchedIng?.vendor || "Direct Vendor",
            itemName: resolvedName,
            normalizedName: resolvedName.toLowerCase().trim(),
            quantity: qty,
            unit: effectiveUnit,
            unitPrice: unitRate,
            totalCost: total,
            category: ingredientType,
            invoiceId: inv.id,
            fileUrl: inv.fileUrl,
            fileType: inv.fileType,
            fileSize: inv.fileSize,
          });
        });
      });
    }

    // 2. Process Catalog Ingredients (includes all ingredients stored in the Ingredient Catalog that are not already in invoices)
    if (sourceFilter === "all" || sourceFilter === "catalog") {
      const nowIso = new Date().toISOString().split("T")[0];
      ingredients.forEach((ing, idx) => {
        const rawName = (ing.name || "").trim();
        if (!rawName) return;
        const normName = rawName.toLowerCase();

        // When viewing "all", skip if this ingredient is already represented in invoice line items
        if (
          sourceFilter === "all" &&
          ((ing.id && invoicedIngredientIds.has(ing.id)) || invoicedIngredientNames.has(normName))
        ) {
          return;
        }

        const total = Number(ing.price) || 0;
        if (total <= 0) return;

        const rawDate =
          ((ing as any).updatedAt || ing.lastUpdated || "")?.slice(0, 10) || nowIso;
        const parsedDate = new Date(`${rawDate}T12:00:00`);
        // Guard against future OCR date typos so catalog items are never hidden by period end boundary
        const isValidPastOrPresent =
          !isNaN(parsedDate.getTime()) && parsedDate.getTime() <= Date.now() + 86400000;
        const effectiveDateStr = isValidPastOrPresent ? rawDate : nowIso;
        const effectiveTimeVal = isValidPastOrPresent
          ? parsedDate.getTime()
          : new Date(`${nowIso}T12:00:00`).getTime();

        const qty = Number(ing.quantity) > 0 ? Number(ing.quantity) : 1;
        const unitRate = qty > 0 ? total / qty : total;
        const unitLabel =
          qty > 1
            ? ing.unit || ing.baseUnit || "lb"
            : ing.packagingUnit || ing.unit || "unit";

        const ingredientType = classifyIngredientType(
          rawName,
          ing.category || (ing as any).type || (ing as any).foodType
        );

        records.push({
          id: `cat-${ing.id || idx}`,
          date: effectiveDateStr,
          timestamp: effectiveTimeVal,
          sourceType: "catalog",
          documentRef: (ing as any).source || "Ingredient Catalog",
          vendorOrStore: ing.vendor || "Catalog Supplier",
          itemName: rawName,
          normalizedName: normName,
          quantity: qty,
          unit: unitLabel,
          unitPrice: unitRate,
          totalCost: total,
          category: ingredientType,
        });
      });
    }

    // 3. Process Grocery / Industrial Receipts (skipping auto-mirrored duplicates of existing invoices)
    if (sourceFilter === "all" || sourceFilter === "grocery") {
      groceryPurchases.forEach((gp) => {
        // Avoid double-counting if this groceryPurchase was auto-generated from an invoice already in `invoices`
        if (sourceFilter === "all" && invoices.length > 0) {
          const isMirroredInvoice = invoices.some(
            (inv) =>
              (inv.invoiceNumber && gp.receiptNumber && inv.invoiceNumber === gp.receiptNumber) ||
              (gp.notes?.startsWith("Parsed via AI Document Parser") &&
                (inv.issueDate === gp.date || inv.vendorName === gp.storeName) &&
                Math.abs(Number(inv.totalAmount || 0) - Number(gp.totalAmount || 0)) < 0.05)
          );
          if (isMirroredInvoice) return;
        }

        const rawDate = gp.date || gp.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0];
        const parsedDate = new Date(`${rawDate.slice(0, 10)}T12:00:00`);
        const dateStr = !isNaN(parsedDate.getTime())
          ? parsedDate.toISOString().split("T")[0]
          : rawDate.slice(0, 10);
        const timeVal = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0;

        (gp.items || []).forEach((item, idx) => {
          const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
          const total = Number(item.price) || 0;
          const unitRate = item.unitPrice || (qty > 0 ? total / qty : total);
          const rawName = item.name || "Unnamed Grocery Item";
          const normName = rawName.toLowerCase().trim();
          const matchedIng = catalogLookup.byName.get(normName);
          const ingredientType = classifyIngredientType(
            rawName,
            item.category || matchedIng?.category
          );

          records.push({
            id: `gro-${gp.id || "no-id"}-${idx}`,
            date: dateStr,
            timestamp: timeVal,
            sourceType: "grocery",
            documentRef: gp.receiptNumber
              ? `REC #${gp.receiptNumber}`
              : gp.storeName || "Store Receipt",
            vendorOrStore: gp.storeName || "Retail Grocery",
            itemName: rawName,
            normalizedName: normName,
            quantity: qty,
            unit: item.unit || "unit",
            unitPrice: unitRate,
            totalCost: total,
            category: ingredientType,
          });
        });
      });
    }

    return records;
  }, [invoices, groceryPurchases, ingredients, sourceFilter, catalogLookup]);

  // Filter Transactions by Date Range (matching either invoice issueDate or upload createdAt)
  const filteredPurchases = useMemo(() => {
    if (datePreset === "all") return allPurchasedItems;
    const { start, end } = dateRange;
    const startMs = start.getTime();
    const endMs = end.getTime();

    const inRange = allPurchasedItems.filter((p) => {
      if (!p.timestamp) return true;
      const matchesIssueDate = p.timestamp >= startMs && p.timestamp <= endMs;
      const matchesCreatedDate = p.createdAtTimestamp
        ? p.createdAtTimestamp >= startMs && p.createdAtTimestamp <= endMs
        : false;
      return matchesIssueDate || matchesCreatedDate;
    });

    if (inRange.length === 0 && allPurchasedItems.length > 0 && datePreset !== "custom") {
      return allPurchasedItems;
    }

    return inRange;
  }, [allPurchasedItems, dateRange, datePreset]);

  // Global Executive Summary Metrics (Always shown at top of Report Center)
  const executiveSummary = useMemo(() => {
    let totalPurchaseSpend = 0;
    let invoiceSpend = 0;
    let catalogSpend = 0;
    let grocerySpend = 0;
    const vendorsSet = new Set<string>();
    const ingredientsSet = new Set<string>();

    filteredPurchases.forEach((p) => {
      totalPurchaseSpend += p.totalCost;
      if (p.sourceType === "grocery") {
        grocerySpend += p.totalCost;
      } else if (p.sourceType === "catalog") {
        catalogSpend += p.totalCost;
      } else {
        invoiceSpend += p.totalCost;
      }
      if (p.vendorOrStore) vendorsSet.add(p.vendorOrStore);
      if (p.normalizedName) ingredientsSet.add(p.normalizedName);
    });

    // Total on-hand inventory asset value
    let totalCatalogSpend = 0;
    ingredients.forEach((ing) => {
      totalCatalogSpend += Number(ing.price) || 0;
    });

    return {
      totalPurchaseSpend,
      invoiceSpend,
      catalogSpend,
      grocerySpend,
      totalCatalogSpend,
      transactionCount: filteredPurchases.length,
      activeVendorsCount: vendorsSet.size,
      uniqueIngredientsPurchased: ingredientsSet.size,
    };
  }, [filteredPurchases, ingredients]);

  // Distinct Unique Ingredients with Purchase Totals, Category, & Price Range
  const distinctIngredients = useMemo(() => {
    const map = new Map<
      string,
      {
        displayName: string;
        count: number;
        totalCost: number;
        totalQty: number;
        unit: string;
        category: string;
        vendor: string;
        minPrice: number;
        maxPrice: number;
        latestPrice: number;
        latestDate: string;
      }
    >();

    filteredPurchases.forEach((p) => {
      const key = p.normalizedName;
      if (!map.has(key)) {
        map.set(key, {
          displayName: p.itemName,
          count: 0,
          totalCost: 0,
          totalQty: 0,
          unit: p.unit,
          category: p.category,
          vendor: p.vendorOrStore,
          minPrice: p.unitPrice > 0 ? p.unitPrice : Infinity,
          maxPrice: p.unitPrice > 0 ? p.unitPrice : 0,
          latestPrice: p.unitPrice,
          latestDate: p.date,
        });
      }
      const item = map.get(key)!;
      item.count += 1;
      item.totalCost += p.totalCost;
      item.totalQty += p.quantity;
      if (p.unitPrice > 0) {
        if (p.unitPrice < item.minPrice) item.minPrice = p.unitPrice;
        if (p.unitPrice > item.maxPrice) item.maxPrice = p.unitPrice;
      }
      if (p.date >= item.latestDate) {
        item.latestDate = p.date;
        item.latestPrice = p.unitPrice;
        item.vendor = p.vendorOrStore || item.vendor;
      }
    });

    const grandTotal = Array.from(map.values()).reduce((sum, v) => sum + v.totalCost, 0);

    return Array.from(map.entries())
      .map(([key, val]) => {
        const avgUnitPrice = val.totalQty > 0 ? val.totalCost / val.totalQty : val.latestPrice;
        const safeMin = val.minPrice === Infinity ? 0 : val.minPrice;
        return {
          key,
          name: val.displayName,
          count: val.count,
          totalCost: val.totalCost,
          totalQty: val.totalQty,
          unit: val.unit,
          category: val.category,
          vendor: val.vendor,
          avgUnitPrice,
          minPrice: safeMin,
          maxPrice: val.maxPrice,
          latestPrice: val.latestPrice,
          latestDate: val.latestDate,
          sharePct: grandTotal > 0 ? (val.totalCost / grandTotal) * 100 : 0,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost || b.count - a.count);
  }, [filteredPurchases, ingredients]);

  // Filtered for currently selected ingredient
  const ingredientTransactions = useMemo(() => {
    let result = filteredPurchases;
    if (selectedIngredientName !== "all") {
      const target = selectedIngredientName.toLowerCase().trim();
      result = result.filter(
        (p) => p.normalizedName.includes(target) || target.includes(p.normalizedName)
      );
    }
    if (ingredientSearchQuery.trim()) {
      const q = ingredientSearchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.itemName.toLowerCase().includes(q) ||
          p.vendorOrStore.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.documentRef.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortField === "date") {
        return sortOrder === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
      }
      if (sortField === "total") {
        return sortOrder === "asc" ? a.totalCost - b.totalCost : b.totalCost - a.totalCost;
      }
      if (sortField === "price") {
        return sortOrder === "asc" ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice;
      }
      if (sortField === "qty") {
        return sortOrder === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity;
      }
      return 0;
    });
  }, [filteredPurchases, selectedIngredientName, ingredientSearchQuery, sortField, sortOrder]);

  // Aggregate Metrics for Selected Ingredient & Period
  const ingredientMetrics = useMemo(() => {
    let totalQty = 0;
    let totalSpend = 0;
    const unitPrices: number[] = [];
    const unitsSet = new Set<string>();
    const vendorsSet = new Set<string>();

    ingredientTransactions.forEach((t) => {
      totalQty += t.quantity;
      totalSpend += t.totalCost;
      if (t.unitPrice > 0) unitPrices.push(t.unitPrice);
      if (t.unit) unitsSet.add(t.unit);
      if (t.vendorOrStore) vendorsSet.add(t.vendorOrStore);
    });

    const avgUnitPrice =
      totalQty > 0
        ? totalSpend / totalQty
        : unitPrices.length > 0
        ? unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length
        : 0;
    const minPrice = unitPrices.length > 0 ? Math.min(...unitPrices) : 0;
    const maxPrice = unitPrices.length > 0 ? Math.max(...unitPrices) : 0;
    const priceVariancePct = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

    return {
      totalQty,
      totalSpend,
      avgUnitPrice,
      minPrice,
      maxPrice,
      priceVariancePct,
      units: Array.from(unitsSet).join(", ") || "units",
      distinctVendorsCount: vendorsSet.size,
      orderCount: ingredientTransactions.length,
    };
  }, [ingredientTransactions]);

  // Timeline / Chart Data for Ingredient Purchase History
  const ingredientTimelineChartData = useMemo(() => {
    const dateMap = new Map<
      string,
      {
        date: string;
        displayDate: string;
        totalSpend: number;
        totalQty: number;
        avgRate: number;
        count: number;
      }
    >();

    const chronological = [...ingredientTransactions].sort((a, b) => a.timestamp - b.timestamp);

    chronological.forEach((t) => {
      const dKey = t.date;
      if (!dateMap.has(dKey)) {
        const parts = dKey.split("-");
        const displayDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : dKey;
        dateMap.set(dKey, {
          date: dKey,
          displayDate,
          totalSpend: 0,
          totalQty: 0,
          avgRate: 0,
          count: 0,
        });
      }
      const entry = dateMap.get(dKey)!;
      entry.totalSpend += t.totalCost;
      entry.totalQty += t.quantity;
      entry.avgRate += t.unitPrice;
      entry.count += 1;
    });

    return Array.from(dateMap.values()).map((e) => ({
      ...e,
      totalSpend: Number(e.totalSpend.toFixed(2)),
      totalQty: Number(e.totalQty.toFixed(1)),
      unitPrice: e.count > 0 ? Number((e.avgRate / e.count).toFixed(2)) : 0,
    }));
  }, [ingredientTransactions]);

  // Vendor Spend Breakdown Data
  const vendorSpendData = useMemo(() => {
    const map = new Map<
      string,
      {
        vendor: string;
        totalSpend: number;
        orderCount: number;
        distinctDays: Set<string>;
        lastOrder: string;
      }
    >();

    filteredPurchases.forEach((p) => {
      const v = p.vendorOrStore || "Direct Supplier";
      if (!map.has(v)) {
        map.set(v, {
          vendor: v,
          totalSpend: 0,
          orderCount: 0,
          distinctDays: new Set<string>(),
          lastOrder: p.date,
        });
      }
      const record = map.get(v)!;
      record.totalSpend += p.totalCost;
      record.orderCount += 1;
      record.distinctDays.add(p.date);
      if (p.date > record.lastOrder) {
        record.lastOrder = p.date;
      }
    });

    const totalAllVendors = Array.from(map.values()).reduce((acc, v) => acc + v.totalSpend, 0);

    return Array.from(map.values())
      .map((v) => ({
        vendor: v.vendor,
        totalSpend: Number(v.totalSpend.toFixed(2)),
        orderCount: v.orderCount,
        deliveryDaysCount: v.distinctDays.size,
        lastOrder: v.lastOrder,
        sharePercentage:
          totalAllVendors > 0 ? Number(((v.totalSpend / totalAllVendors) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [filteredPurchases]);

  // Calendar Data for "Vendor Spending by Calendar"
  const calendarData = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

    // Map YYYY-MM-DD -> { totalSpend, vendorsMap, items }
    const dayMap = new Map<
      string,
      {
        dateStr: string;
        totalSpend: number;
        vendors: Map<string, number>;
        items: typeof allPurchasedItems;
      }
    >();

    allPurchasedItems.forEach((item) => {
      if (!item.date.startsWith(monthPrefix)) return;
      if (
        calendarVendorFilter !== "all" &&
        item.vendorOrStore.toLowerCase() !== calendarVendorFilter.toLowerCase()
      ) {
        return;
      }
      if (!dayMap.has(item.date)) {
        dayMap.set(item.date, {
          dateStr: item.date,
          totalSpend: 0,
          vendors: new Map<string, number>(),
          items: [],
        });
      }
      const entry = dayMap.get(item.date)!;
      entry.totalSpend += item.totalCost;
      entry.vendors.set(
        item.vendorOrStore,
        (entry.vendors.get(item.vendorOrStore) || 0) + item.totalCost
      );
      entry.items.push(item);
    });

    let monthTotalSpend = 0;
    let maxDaySpend = 0;
    let highestDayStr = "—";

    dayMap.forEach((val, dStr) => {
      monthTotalSpend += val.totalSpend;
      if (val.totalSpend > maxDaySpend) {
        maxDaySpend = val.totalSpend;
        highestDayStr = dStr;
      }
    });

    const cells: Array<{
      dayNumber: number | null;
      dateStr: string | null;
      totalSpend: number;
      vendorList: Array<{ vendor: string; spend: number }>;
      items: typeof allPurchasedItems;
    }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        dayNumber: null,
        dateStr: null,
        totalSpend: 0,
        vendorList: [],
        items: [],
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, "0")}`;
      const record = dayMap.get(dateStr);
      const vendorList = record
        ? Array.from(record.vendors.entries())
            .map(([vendor, spend]) => ({ vendor, spend }))
            .sort((a, b) => b.spend - a.spend)
        : [];
      cells.push({
        dayNumber: d,
        dateStr,
        totalSpend: record ? record.totalSpend : 0,
        vendorList,
        items: record ? record.items : [],
      });
    }

    return {
      year,
      month,
      monthLabel: calendarMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      cells,
      monthTotalSpend,
      activeDeliveryDays: dayMap.size,
      maxDaySpend,
      highestDayStr,
    };
  }, [calendarMonth, allPurchasedItems, calendarVendorFilter]);

  // Category Allocation Data (For Ingredient Types)
  const categorySpendData = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        totalSpend: number;
        totalQty: number;
        itemCount: number;
        distinctIngredients: Set<string>;
        catalogCount: number;
        onHandValue: number;
        unitPricesSum: number;
        unitPricesCount: number;
        items: Array<{
          name: string;
          spend: number;
          qty: number;
          unit: string;
          vendor: string;
        }>;
      }
    >();

    // 1. Aggregate Purchase Spend by Ingredient Type
    filteredPurchases.forEach((p) => {
      const cat = p.category || classifyIngredientType(p.itemName);
      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          totalSpend: 0,
          totalQty: 0,
          itemCount: 0,
          distinctIngredients: new Set<string>(),
          catalogCount: 0,
          onHandValue: 0,
          unitPricesSum: 0,
          unitPricesCount: 0,
          items: [],
        });
      }
      const entry = map.get(cat)!;
      entry.totalSpend += p.totalCost;
      entry.totalQty += p.quantity;
      entry.itemCount += 1;
      entry.distinctIngredients.add(p.normalizedName);
      if (p.unitPrice > 0) {
        entry.unitPricesSum += p.unitPrice;
        entry.unitPricesCount += 1;
      }

      const existingItem = entry.items.find(
        (x) => x.name.toLowerCase() === p.itemName.toLowerCase()
      );
      if (existingItem) {
        existingItem.spend += p.totalCost;
        existingItem.qty += p.quantity;
      } else {
        entry.items.push({
          name: p.itemName,
          spend: p.totalCost,
          qty: p.quantity,
          unit: p.unit,
          vendor: p.vendorOrStore,
        });
      }
    });

    // 2. Enrich existing purchased categories with On-Hand Stock Value from matching catalog items
    ingredients.forEach((ing) => {
      const cat = classifyIngredientType(ing.name, ing.category);
      const entry = map.get(cat);
      if (!entry) return;
      entry.catalogCount += 1;
      const baseQty = getEffectiveBaseQuantity(ing);
      const unitRate = baseQty > 0 ? (ing.price || 0) / baseQty : ing.price || 0;
      const onHand = typeof ing.inStock === "number" ? ing.inStock : 0;
      if (onHand > 0 && unitRate > 0) {
        entry.onHandValue += unitRate * onHand;
      }
    });

    const totalBudget = Array.from(map.values()).reduce((acc, c) => acc + c.totalSpend, 0);

    return Array.from(map.values())
      .map((c) => {
        const weightedAvgPrice =
          c.totalQty > 0
            ? c.totalSpend / c.totalQty
            : c.unitPricesCount > 0
            ? c.unitPricesSum / c.unitPricesCount
            : 0;
        const simpleAvgPrice =
          c.unitPricesCount > 0 ? c.unitPricesSum / c.unitPricesCount : weightedAvgPrice;
        return {
          category: c.category,
          totalSpend: Number(c.totalSpend.toFixed(2)),
          totalQty: Number(c.totalQty.toFixed(2)),
          avgUnitPrice: Number(weightedAvgPrice.toFixed(2)),
          simpleAvgUnitPrice: Number(simpleAvgPrice.toFixed(2)),
          itemCount: c.itemCount,
          uniqueIngredientsCount: c.distinctIngredients.size,
          catalogCount: c.catalogCount,
          onHandValue: Number(c.onHandValue.toFixed(2)),
          pct: totalBudget > 0 ? Number(((c.totalSpend / totalBudget) * 100).toFixed(1)) : 0,
          topItems: c.items.sort((a, b) => b.spend - a.spend),
        };
      })
      .sort((a, b) => b.totalSpend - a.totalSpend || b.onHandValue - a.onHandValue);
  }, [filteredPurchases, ingredients]);

  // Day-of-Week Procurement Pattern (Extra insight)
  const dayOfWeekSpend = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const totals = days.map((d) => ({ day: d, spend: 0, orders: 0 }));
    filteredPurchases.forEach((p) => {
      const dt = new Date(`${p.date}T12:00:00`);
      if (!isNaN(dt.getTime())) {
        const idx = dt.getDay();
        totals[idx].spend = Number((totals[idx].spend + p.totalCost).toFixed(2));
        totals[idx].orders += 1;
      }
    });
    return totals;
  }, [filteredPurchases]);

  // Price Volatility & Cost Spike Watchlist (Extra insight)
  const priceVolatilityWatchlist = useMemo(() => {
    return distinctIngredients
      .filter((ing) => ing.count >= 2 && ing.maxPrice > ing.minPrice && ing.minPrice > 0)
      .map((ing) => {
        const variancePct = ((ing.maxPrice - ing.minPrice) / ing.minPrice) * 100;
        const latestDeltaPct = ((ing.latestPrice - ing.avgUnitPrice) / ing.avgUnitPrice) * 100;
        return {
          ...ing,
          variancePct,
          latestDeltaPct,
        };
      })
      .sort((a, b) => b.variancePct - a.variancePct)
      .slice(0, 8);
  }, [distinctIngredients]);

  // Monthly Vendor Spend Trend (Extra insight for Calendar View)
  const monthlySpendTrend = useMemo(() => {
    const map = new Map<string, { monthKey: string; label: string; totalSpend: number; orders: number }>();
    allPurchasedItems.forEach((item) => {
      const mKey = item.date.slice(0, 7); // YYYY-MM
      if (!mKey || mKey.length < 7) return;
      if (calendarVendorFilter !== "all" && item.vendorOrStore.toLowerCase() !== calendarVendorFilter.toLowerCase()) {
        return;
      }
      if (!map.has(mKey)) {
        const dt = new Date(`${mKey}-15T12:00:00`);
        const label = !isNaN(dt.getTime())
          ? dt.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
          : mKey;
        map.set(mKey, { monthKey: mKey, label, totalSpend: 0, orders: 0 });
      }
      const entry = map.get(mKey)!;
      entry.totalSpend = Number((entry.totalSpend + item.totalCost).toFixed(2));
      entry.orders += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [allPurchasedItems, calendarVendorFilter]);

  // Category Average Price Analytics by Item (Under Category Allocation)
  const categoryAvgPriceData = useMemo(() => {
    const itemMap = new Map<
      string,
      {
        key: string;
        name: string;
        category: string;
        subType: Exclude<MeatSubType, "all">;
        vendors: Set<string>;
        primaryVendor: string;
        count: number;
        totalQty: number;
        totalCost: number;
        unit: string;
        unitPrices: number[];
        minPrice: number;
        maxPrice: number;
        firstDate: string;
        firstPrice: number;
        latestDate: string;
        latestPrice: number;
        baseUnitRate?: number;
        baseUnitLabel?: string;
        transactions: typeof filteredPurchases;
      }
    >();

    // Sort chronologically so firstPrice and latestPrice are accurate
    const chronological = [...filteredPurchases].sort(
      (a, b) => a.date.localeCompare(b.date) || a.timestamp - b.timestamp
    );

    chronological.forEach((p) => {
      const key = p.normalizedName;
      const cat = p.category || classifyIngredientType(p.itemName);
      const matchedIng = catalogLookup.byName.get(key);
      if (!itemMap.has(key)) {
        let baseUnitRate: number | undefined;
        let baseUnitLabel: string | undefined;
        if (matchedIng && p.sourceType !== "catalog") {
          const effBaseQty = getEffectiveBaseQuantity(matchedIng);
          const normUnit = normalizeBaseUnit(matchedIng.unit || "lb");
          if (effBaseQty > 1 && p.unitPrice > 0 && normalizeBaseUnit(p.unit) !== normUnit) {
            baseUnitRate = p.unitPrice / effBaseQty;
            baseUnitLabel = normUnit;
          }
        }

        itemMap.set(key, {
          key,
          name: p.itemName,
          category: cat,
          subType: classifyMeatSubType(p.itemName),
          vendors: new Set([p.vendorOrStore]),
          primaryVendor: p.vendorOrStore,
          count: 0,
          totalQty: 0,
          totalCost: 0,
          unit: p.unit,
          unitPrices: [],
          minPrice: p.unitPrice > 0 ? p.unitPrice : Infinity,
          maxPrice: p.unitPrice > 0 ? p.unitPrice : 0,
          firstDate: p.date,
          firstPrice: p.unitPrice,
          latestDate: p.date,
          latestPrice: p.unitPrice,
          baseUnitRate,
          baseUnitLabel,
          transactions: [],
        });
      }

      const entry = itemMap.get(key)!;
      entry.count += 1;
      entry.totalQty += p.quantity;
      entry.totalCost += p.totalCost;
      if (p.vendorOrStore) entry.vendors.add(p.vendorOrStore);
      if (p.unitPrice > 0) {
        entry.unitPrices.push(p.unitPrice);
        if (p.unitPrice < entry.minPrice) entry.minPrice = p.unitPrice;
        if (p.unitPrice > entry.maxPrice) entry.maxPrice = p.unitPrice;
      }
      if (p.date < entry.firstDate) {
        entry.firstDate = p.date;
        entry.firstPrice = p.unitPrice;
      }
      if (p.date >= entry.latestDate) {
        entry.latestDate = p.date;
        entry.latestPrice = p.unitPrice;
        entry.primaryVendor = p.vendorOrStore || entry.primaryVendor;
      }
      entry.transactions.push(p);
    });

    const allEntries = Array.from(itemMap.values());
    const categoryEntries =
      selectedCategoryFilter === "all"
        ? allEntries
        : allEntries.filter((x) => x.category === selectedCategoryFilter);

    const totalCategorySpendAll = categoryEntries.reduce((s, x) => s + x.totalCost, 0);
    const allCategoryVendors = Array.from(
      new Set(categoryEntries.flatMap((x) => Array.from(x.vendors)))
    ).sort();

    const items = categoryEntries
      .map((entry) => {
        const weightedAvgPrice =
          entry.totalQty > 0
            ? entry.totalCost / entry.totalQty
            : entry.unitPrices.length > 0
            ? entry.unitPrices.reduce((a, b) => a + b, 0) / entry.unitPrices.length
            : entry.latestPrice;

        const simpleAvgPrice =
          entry.unitPrices.length > 0
            ? entry.unitPrices.reduce((a, b) => a + b, 0) / entry.unitPrices.length
            : weightedAvgPrice;

        const safeMin = entry.minPrice === Infinity ? 0 : entry.minPrice;
        const spreadPct = safeMin > 0 ? ((entry.maxPrice - safeMin) / safeMin) * 100 : 0;
        const vsAvgPct =
          weightedAvgPrice > 0
            ? ((entry.latestPrice - weightedAvgPrice) / weightedAvgPrice) * 100
            : 0;
        const periodTrendPct =
          entry.firstPrice > 0
            ? ((entry.latestPrice - entry.firstPrice) / entry.firstPrice) * 100
            : 0;

        const matchedIng = catalogLookup.byName.get(entry.key);
        let avgPricePerBaseUnit: number | null = null;
        let baseUnitName: string | null = null;
        if (matchedIng) {
          const effBaseQty = getEffectiveBaseQuantity(matchedIng);
          const normUnit = normalizeBaseUnit(matchedIng.unit || "lb");
          if (effBaseQty > 1 && weightedAvgPrice > 0 && normalizeBaseUnit(entry.unit) !== normUnit) {
            avgPricePerBaseUnit = weightedAvgPrice / effBaseQty;
            baseUnitName = normUnit;
          }
        }

        return {
          key: entry.key,
          name: entry.name,
          category: entry.category,
          subType: entry.subType,
          vendorList: Array.from(entry.vendors),
          primaryVendor: entry.primaryVendor,
          count: entry.count,
          totalQty: entry.totalQty,
          totalCost: entry.totalCost,
          unit: entry.unit,
          weightedAvgPrice,
          simpleAvgPrice,
          minPrice: safeMin,
          maxPrice: entry.maxPrice,
          spreadPct,
          firstDate: entry.firstDate,
          firstPrice: entry.firstPrice,
          latestDate: entry.latestDate,
          latestPrice: entry.latestPrice,
          vsAvgPct,
          periodTrendPct,
          avgPricePerBaseUnit,
          baseUnitName,
          shareOfCategorySpendPct:
            totalCategorySpendAll > 0 ? (entry.totalCost / totalCategorySpendAll) * 100 : 0,
          transactions: [...entry.transactions].sort((a, b) => b.timestamp - a.timestamp),
        };
      })
      .filter((item) => {
        if (
          selectedCategoryFilter === "Meat & Poultry" &&
          meatSubTypeFilter !== "all" &&
          item.subType !== meatSubTypeFilter
        ) {
          return false;
        }
        if (
          meatVendorFilter !== "all" &&
          !item.vendorList.some((v) => v.toLowerCase() === meatVendorFilter.toLowerCase())
        ) {
          return false;
        }
        if (meatSearchQuery.trim()) {
          const q = meatSearchQuery.toLowerCase().trim();
          return (
            item.name.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            item.subType.toLowerCase().includes(q) ||
            item.primaryVendor.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (meatSortField === "name") {
          return meatSortOrder === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        }
        if (meatSortField === "avgPrice") {
          return meatSortOrder === "asc"
            ? a.weightedAvgPrice - b.weightedAvgPrice
            : b.weightedAvgPrice - a.weightedAvgPrice;
        }
        if (meatSortField === "totalQty") {
          return meatSortOrder === "asc"
            ? a.totalQty - b.totalQty
            : b.totalQty - a.totalQty;
        }
        if (meatSortField === "count") {
          return meatSortOrder === "asc" ? a.count - b.count : b.count - a.count;
        }
        return meatSortOrder === "asc"
          ? a.totalCost - b.totalCost
          : b.totalCost - a.totalCost;
      });

    const filteredTotalSpend = items.reduce((s, i) => s + i.totalCost, 0);
    const filteredTotalQty = items.reduce((s, i) => s + i.totalQty, 0);
    const filteredOrderCount = items.reduce((s, i) => s + i.count, 0);
    const overallWeightedAvgPrice =
      filteredTotalQty > 0
        ? filteredTotalSpend / filteredTotalQty
        : items.length > 0
        ? items.reduce((s, i) => s + i.weightedAvgPrice, 0) / items.length
        : 0;
    const overallSimpleAvgPrice =
      items.length > 0
        ? items.reduce((s, i) => s + i.simpleAvgPrice, 0) / items.length
        : 0;

    // Sub-type breakdown when Meat & Poultry is selected
    const meatEntries = allEntries.filter((x) => x.category === "Meat & Poultry");
    const subTypeSummary = (["Beef", "Chicken & Poultry", "Pork", "Other Meat"] as const).map(
      (st) => {
        const group = meatEntries.filter((x) => x.subType === st);
        const spend = group.reduce((s, x) => s + x.totalCost, 0);
        const qty = group.reduce((s, x) => s + x.totalQty, 0);
        const avg = qty > 0 ? spend / qty : 0;
        return {
          subType: st,
          itemCount: group.length,
          spend,
          qty,
          avgPrice: avg,
        };
      }
    );

    return {
      items,
      allCategoryVendors,
      filteredTotalSpend,
      filteredTotalQty,
      filteredOrderCount,
      overallWeightedAvgPrice,
      overallSimpleAvgPrice,
      totalCategorySpendAll,
      categoryShareOfAllFoodPct:
        executiveSummary.totalPurchaseSpend > 0
          ? (filteredTotalSpend / executiveSummary.totalPurchaseSpend) * 100
          : 0,
      subTypeSummary,
    };
  }, [
    filteredPurchases,
    catalogLookup,
    selectedCategoryFilter,
    meatSubTypeFilter,
    meatVendorFilter,
    meatSearchQuery,
    meatSortField,
    meatSortOrder,
    executiveSummary.totalPurchaseSpend,
  ]);

  // Export Category Average Price Report to CSV
  const handleExportCategoryAvgCSV = () => {
    const periodLabel =
      datePreset === "all"
        ? "All_Time"
        : `${dateRange.start.toISOString().split("T")[0]}_to_${dateRange.end.toISOString().split("T")[0]}`;
    const catSlug =
      selectedCategoryFilter === "all"
        ? "all_categories"
        : selectedCategoryFilter.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    const headers = [
      "Period",
      "Category",
      "Item Name",
      "Primary Supplier",
      "Orders in Period",
      "Total Qty Purchased",
      "Unit",
      "Weighted Average Price ($)",
      "Simple Average Price ($)",
      "Lowest Price in Period ($)",
      "Highest Price in Period ($)",
      "Latest Price Paid ($)",
      "Latest Purchase Date",
      "Price Spread (%)",
      "Total Spend ($)",
    ];

    const rows = categoryAvgPriceData.items.map((item) => [
      `"${periodLabel}"`,
      `"${item.category.replace(/"/g, '""')}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.primaryVendor.replace(/"/g, '""')}"`,
      item.count,
      item.totalQty.toFixed(2),
      `"${item.unit}"`,
      item.weightedAvgPrice.toFixed(2),
      item.simpleAvgPrice.toFixed(2),
      item.minPrice.toFixed(2),
      item.maxPrice.toFixed(2),
      item.latestPrice.toFixed(2),
      `"${item.latestDate}"`,
      `${item.spreadPct.toFixed(1)}%`,
      item.totalCost.toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `category_average_price_${catSlug}_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Filtered Records to CSV
  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Source Type",
      "Document Ref",
      "Supplier/Store",
      "Ingredient Category",
      "Item Description",
      "Quantity",
      "Unit",
      "Unit Price ($)",
      "Total Cost ($)",
    ];
    const rows = ingredientTransactions.map((t) => [
      `"${t.date}"`,
      `"${
        t.sourceType === "invoice"
          ? "Vendor Invoice"
          : t.sourceType === "grocery"
          ? "Grocery Store"
          : "Catalog"
      }"`,
      `"${t.documentRef.replace(/"/g, '""')}"`,
      `"${t.vendorOrStore.replace(/"/g, '""')}"`,
      `"${t.category.replace(/"/g, '""')}"`,
      `"${t.itemName.replace(/"/g, '""')}"`,
      t.quantity,
      `"${t.unit}"`,
      t.unitPrice.toFixed(2),
      t.totalCost.toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const activeLabel =
      selectedIngredientName === "all"
        ? "procurement_all_ingredients"
        : selectedIngredientName.replace(/[^a-z0-9]/gi, "_");
    link.setAttribute(
      "download",
      `report_${activeLabel}_${datePreset}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedCalendarCell = useMemo(() => {
    if (!selectedCalendarDate) return null;
    return calendarData.cells.find((c) => c.dateStr === selectedCalendarDate) || null;
  }, [selectedCalendarDate, calendarData.cells]);

  return (
    <div className="space-y-6 text-neutral-900 animate-in fade-in duration-150" id="report-center-view">
      {/* Hidden input for Firebase Storage source document upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleSourceFileSelect}
      />

      {/* HEADER & EXECUTIVE TOOLBAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-neutral-200/90 p-5 sm:p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Report Center
              </h1>
              <p className="text-xs text-neutral-500 font-medium">
                Live procurement ledger &amp; supplier expenditure analytics
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onSwitchSection && (
            <button
              type="button"
              onClick={() => onSwitchSection("parser")}
              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Scan / Upload Invoice
            </button>
          )}
          <button
            type="button"
            onClick={activeTab === "categories" ? handleExportCategoryAvgCSV : handleExportCSV}
            disabled={activeTab === "categories" ? categoryAvgPriceData.items.length === 0 : ingredientTransactions.length === 0}
            className="px-3.5 py-2 bg-white hover:bg-neutral-50 disabled:opacity-40 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export filtered records to spreadsheet (CSV)"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            {activeTab === "categories" ? "Export Category Avg CSV" : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Print or Save PDF report"
          >
            <Printer className="w-3.5 h-3.5 text-neutral-500" />
            Print
          </button>
        </div>
      </div>

      {/* GLOBAL EXECUTIVE SUMMARY KPI BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab("ingredients")}
          className="bg-white border border-neutral-200/90 hover:border-emerald-300 p-5 rounded-2xl shadow-xs cursor-pointer transition-colors group"
          title="Click to view Total Ingredient Purchases"
        >
          <div className="flex items-center justify-between text-neutral-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 group-hover:underline">
              Total Ingredient Purchase
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-700">
            $
            {executiveSummary.totalPurchaseSpend.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-500 mt-1.5 font-mono tabular-nums">
            <span>Invoices: ${executiveSummary.invoiceSpend.toFixed(2)}</span>
            <span aria-hidden="true">·</span>
            <span>Catalog: ${executiveSummary.catalogSpend.toFixed(2)}</span>
            {executiveSummary.grocerySpend > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Grocery: ${executiveSummary.grocerySpend.toFixed(2)}</span>
              </>
            )}
          </div>
        </div>

        <div
          onClick={() => {
            if (onSwitchSection) {
              onSwitchSection("invoices");
            } else {
              setSourceFilter("invoices");
              setActiveTab("ingredients");
            }
          }}
          className="bg-white border border-neutral-200/90 hover:border-blue-300 p-5 rounded-2xl shadow-xs cursor-pointer transition-colors group"
          title="Click to view Invoices"
        >
          <div className="flex items-center justify-between text-neutral-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 group-hover:underline">
              Active Invoices &amp; Receipts
            </span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-neutral-900">
            {invoices.length}{" "}
            <span className="text-xs font-sans font-normal text-neutral-500">
              invoices
            </span>
          </div>
          <div className="text-[11px] text-neutral-500 mt-1.5 font-mono tabular-nums flex items-center justify-between">
            <span>{executiveSummary.uniqueIngredientsPurchased} items · {ingredients.length} catalog</span>
            <span className="text-blue-600 font-sans font-bold">Open Invoices &rarr;</span>
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Top Vendor Spend
            </span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-neutral-900 truncate">
            {vendorSpendData[0]?.vendor || "No Vendors Recorded"}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1.5 font-mono tabular-nums">
            {vendorSpendData[0]
              ? `$${vendorSpendData[0].totalSpend.toFixed(2)} · ${vendorSpendData[0].sharePercentage}% of spend`
              : "0 active suppliers in period"}
          </div>
        </div>

        <div
          onClick={() => setActiveTab("categories")}
          className="bg-white border border-neutral-200/90 hover:border-emerald-300 p-5 rounded-2xl shadow-xs cursor-pointer transition-colors group"
          title="Click to open Category Allocation & Category Average Price"
        >
          <div className="flex items-center justify-between text-neutral-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 group-hover:underline">
              Category Allocation &amp; Avg Price
            </span>
            <PieChartIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-neutral-900">
            ${categoryAvgPriceData.overallWeightedAvgPrice.toFixed(2)}
            <span className="text-xs font-sans font-normal text-neutral-500"> / avg unit</span>
          </div>
          <div className="text-[11px] text-neutral-500 mt-1.5 font-mono tabular-nums flex items-center justify-between">
            <span>
              {categorySpendData.length} categories · {categoryAvgPriceData.items.length} items
            </span>
            <span className="text-emerald-700 font-sans font-bold">Category Avg &rarr;</span>
          </div>
        </div>
      </div>

      {/* ACTIVE INVOICES & SOURCE DOCUMENTS BAR (Quick Source Upload / Preview / Item Drill-down) */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              Recorded Invoices &amp; Source Documents ({invoices.length})
            </h2>
            <p className="text-xs text-neutral-500">
              Click any invoice below to expand its line items right here, or click &ldquo;Open All Invoices&rdquo; to manage Ingredient &amp; Industrial invoices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSourceFilter(sourceFilter === "invoices" ? "all" : "invoices");
                setActiveTab("ingredients");
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                sourceFilter === "invoices"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200"
              }`}
            >
              {sourceFilter === "invoices" ? "Showing Invoice Items Only ✓" : "Filter Report by Invoices"}
            </button>
            {onSwitchSection && (
              <button
                type="button"
                onClick={() => onSwitchSection("invoices")}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Open All Invoices ({invoices.length}) &rarr;
              </button>
            )}
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 text-xs text-neutral-600 flex items-center justify-between">
            <span>No invoices recorded yet in this workspace.</span>
            {onSwitchSection && (
              <button
                type="button"
                onClick={() => onSwitchSection("invoices")}
                className="font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Go to Invoices Manager &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invoices.map((inv) => {
              const isUploading = uploadingInvoiceId === inv.id;
              const isExpanded = expandedInvoiceId === inv.id;
              const vendorDisplay = inv.vendor || inv.vendorName || "Direct Supplier";
              const isIndustrialInv =
                inv.invoiceType === "industrial" ||
                (Array.isArray(inv.items) &&
                  inv.items.length > 0 &&
                  inv.items.every((it) => it.itemTargetType === "industrial"));
              return (
                <div
                  key={inv.id}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isExpanded
                      ? "border-emerald-400 bg-white shadow-xs md:col-span-2"
                      : "border-neutral-200/80 bg-neutral-50/60 hover:bg-white hover:border-emerald-300"
                  }`}
                >
                  <div
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id || null)}
                    className="flex items-center justify-between gap-3 p-3.5 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                          {vendorDisplay}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isIndustrialInv
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isIndustrialInv ? "Industrial Products" : "Ingredient Invoice"}
                        </span>
                        <span className="text-xs font-mono font-bold text-neutral-700">
                          #{inv.invoiceNumber || inv.id?.slice(0, 6)}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 font-mono tabular-nums mt-1 flex flex-wrap items-center gap-2">
                        <span>Issue Date: {inv.issueDate || inv.createdAt?.slice(0, 10) || "—"}</span>
                        <span>·</span>
                        <span className="font-bold text-emerald-700">
                          Total: ${Number(inv.totalAmount || 0).toFixed(2)}
                        </span>
                        <span>·</span>
                        <span className="text-neutral-700 font-semibold">
                          {Array.isArray(inv.items) ? inv.items.length : 0} line items ({isExpanded ? "Hide items ▲" : "Click to view items ▼"})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {inv.fileUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              url: inv.fileUrl!,
                              name: inv.fileName || `Invoice-${inv.invoiceNumber}`,
                              type: inv.fileType,
                              size: inv.fileSize,
                              title: `Invoice #${inv.invoiceNumber} — ${vendorDisplay}`,
                              subtitle: `Date: ${inv.issueDate} · Total: $${Number(inv.totalAmount || 0).toFixed(2)}`,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="View source image or PDF stored in Firebase"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Doc
                        </button>
                      ) : (
                        !isReadOnly &&
                        onUpdateInvoice && (
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => {
                              setTargetUploadInvoice(inv);
                              fileInputRef.current?.click();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title="Upload source image or PDF to Firebase Storage"
                          >
                            {isUploading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                            ) : (
                              <Upload className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                            {isUploading ? "Uploading..." : "Upload PDF/Img"}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {isExpanded && Array.isArray(inv.items) && inv.items.length > 0 && (
                    <div className="border-t border-neutral-200 bg-neutral-50/50 p-3 overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
                          <tr>
                            <th className="py-2 px-3">Item Description</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3 text-center">Qty</th>
                            <th className="py-2 px-3 text-right">Unit Price</th>
                            <th className="py-2 px-3 text-right">Total Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {inv.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-white">
                              <td className="py-2 px-3 font-bold text-neutral-900">{item.name}</td>
                              <td className="py-2 px-3 text-neutral-600">
                                {item.itemTargetType === "industrial" ? "Industrial" : "Ingredient"}
                              </td>
                              <td className="py-2 px-3 text-center font-mono tabular-nums">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums">
                                ${Number(item.pricePerUnit || 0).toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                                ${Number(item.totalPrice || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-neutral-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("ingredients")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === "ingredients"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-t-lg"
          }`}
        >
          <Package className="w-4 h-4" />
          Total Ingredient Purchases
        </button>

        <button
          onClick={() => setActiveTab("vendors")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === "vendors"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-t-lg"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Vendor Spending by Calendar
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === "categories"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-t-lg"
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          Category Allocation (Ingredient Types)
        </button>

        <button
          onClick={() => setActiveTab("foodcost")}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${
            activeTab === "foodcost"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-lg"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-t-lg"
          }`}
        >
          <ChefHat className="w-4 h-4" />
          Recipe Food Cost Margins
        </button>
      </div>

      {/* FILTER & PERIOD SELECTOR BAR */}
      <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" /> Period:
            </span>
            {[
              { key: "7d", label: "Last 7 Days" },
              { key: "30d", label: "Last 30 Days" },
              { key: "thisMonth", label: "This Month" },
              { key: "90d", label: "Last 90 Days" },
              { key: "ytd", label: "Year to Date" },
              { key: "all", label: "All Time" },
              { key: "custom", label: "Custom Range" },
            ].map((preset) => (
              <button
                key={preset.key}
                onClick={() => setDatePreset(preset.key as DatePreset)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  datePreset === preset.key
                    ? "bg-emerald-600 text-white shadow-2xs font-bold"
                    : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Source Toggle */}
          <div className="flex flex-wrap items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                sourceFilter === "all"
                  ? "bg-white text-neutral-900 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              All Sources ({allPurchasedItems.length})
            </button>
            <button
              onClick={() => setSourceFilter("invoices")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                sourceFilter === "invoices"
                  ? "bg-white text-emerald-800 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <FileText className="w-3 h-3 text-emerald-600" />
              Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setSourceFilter("catalog")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                sourceFilter === "catalog"
                  ? "bg-white text-amber-800 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <Package className="w-3 h-3 text-amber-600" />
              Catalog ({ingredients.length})
            </button>
            <button
              onClick={() => setSourceFilter("grocery")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                sourceFilter === "grocery"
                  ? "bg-white text-blue-800 shadow-2xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <ShoppingBag className="w-3 h-3 text-blue-600" />
              Grocery ({groceryPurchases.length})
            </button>
          </div>
        </div>

        {/* Custom Date Range Pickers */}
        {datePreset === "custom" && (
          <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center gap-4 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <label className="font-bold text-neutral-600">Start Date:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-neutral-800 font-mono text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="font-bold text-neutral-600">End Date:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-neutral-800 font-mono text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Specific Ingredient Filter Bar (for Tab 1) */}
        {activeTab === "ingredients" && (
          <div className="pt-3 border-t border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-3">
              <div className="w-full sm:w-72 relative">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  Track Specific Ingredient:
                </label>
                <select
                  value={selectedIngredientName}
                  onChange={(e) => setSelectedIngredientName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">
                    All Ingredients ({distinctIngredients.length} tracked items)
                  </option>
                  {distinctIngredients.map((ing) => (
                    <option key={ing.key} value={ing.key}>
                      {ing.name} ({ing.count} purchases - ${ing.totalCost.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Text Search Filter */}
              <div className="flex-1 relative pt-4">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-7 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by ingredient, supplier, or category..."
                  value={ingredientSearchQuery}
                  onChange={(e) => setIngredientSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
                {ingredientSearchQuery && (
                  <button
                    onClick={() => setIngredientSearchQuery("")}
                    className="absolute right-3 top-7 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Popular Ingredient Quick Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Top Items:
              </span>
              {distinctIngredients.slice(0, 5).map((ing) => (
                <button
                  key={ing.key}
                  onClick={() =>
                    setSelectedIngredientName(selectedIngredientName === ing.key ? "all" : ing.key)
                  }
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer truncate max-w-[130px] ${
                    selectedIngredientName === ing.key
                      ? "bg-emerald-600 text-white font-bold"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                  title={`Filter by ${ing.name}`}
                >
                  {ing.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: TOTAL INGREDIENT PURCHASES & ITEMIZED TRACKER */}
      {/* ===================================================================== */}
      {activeTab === "ingredients" && (
        <div className="space-y-6">
          {/* Selected Filter KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Total Quantity Bought
                </span>
                <Package className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {ingredientMetrics.totalQty.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-sans text-neutral-500">
                  {ingredientMetrics.units}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Across {ingredientMetrics.orderCount} purchase records
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Filtered Purchase Spend
                </span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700">
                $
                {ingredientMetrics.totalSpend.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Total expenditure for selection
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Average Unit Price
                </span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                ${ingredientMetrics.avgUnitPrice.toFixed(2)}
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Weighted cost per {ingredientMetrics.units.split(",")[0] || "unit"}
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Price Range (Min / Max)
                </span>
                <ArrowUpDown className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold font-mono text-neutral-900">
                ${ingredientMetrics.minPrice.toFixed(2)} - ${ingredientMetrics.maxPrice.toFixed(2)}
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {ingredientMetrics.priceVariancePct > 0
                  ? `${ingredientMetrics.priceVariancePct.toFixed(1)}% price spread`
                  : "Consistent unit rate"}
              </div>
            </div>

            <div className="bg-white border border-neutral-200/80 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Suppliers Used
                </span>
                <Building2 className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {ingredientMetrics.distinctVendorsCount}{" "}
                <span className="text-xs font-sans text-neutral-500">vendors</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Active vendor &amp; store sources
              </p>
            </div>
          </div>

          {/* Total Ingredient Purchase Summary Leaderboard (Aggregated by Ingredient) */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  Total Ingredient Purchase Summary by Item ({distinctIngredients.filter((i) => i.totalCost > 0).length} items)
                </h3>
                <p className="text-xs text-neutral-500">
                  Cumulative quantity bought, total dollar spend, ingredient type category, and share of total purchases.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700">
                Grand Total: $
                {executiveSummary.totalPurchaseSpend.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Ingredient Name</th>
                    <th className="py-3 px-4">Ingredient Type</th>
                    <th className="py-3 px-4">Primary Supplier</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-center">Total Qty Purchased</th>
                    <th className="py-3 px-4 text-right">Avg Unit Price</th>
                    <th className="py-3 px-4 text-right">Total Spend ($)</th>
                    <th className="py-3 px-4 text-right">Share of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {distinctIngredients
                    .filter((ing) => ing.totalCost > 0)
                    .map((ing) => (
                      <tr
                        key={ing.key}
                        onClick={() =>
                          setSelectedIngredientName(
                            selectedIngredientName === ing.key ? "all" : ing.key
                          )
                        }
                        className={`hover:bg-neutral-50/90 transition-colors cursor-pointer ${
                          selectedIngredientName === ing.key ? "bg-emerald-50/50" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-neutral-900">
                          {ing.name}
                        </td>
                        <td className="py-3 px-4 text-neutral-600 font-medium">
                          {ing.category}
                        </td>
                        <td className="py-3 px-4 text-neutral-700 font-medium">
                          {ing.vendor}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-neutral-600">
                          {ing.count}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-neutral-800">
                          {ing.totalQty.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[10px] font-normal text-neutral-500">
                            {ing.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-neutral-800">
                          ${ing.avgUnitPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          $
                          {ing.totalCost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-neutral-700">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, ing.sharePct)}%` }}
                              />
                            </div>
                            <span>{ing.sharePct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Price Volatility & Unit Cost Spike Watchlist */}
          {priceVolatilityWatchlist.length > 0 && (
            <div className="bg-white border border-amber-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-amber-100 bg-amber-50/40 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Ingredient Price Volatility &amp; Cost Spike Watchlist
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Ingredients with unit price fluctuations across recent supplier invoices and store receipts.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-800">
                  {priceVolatilityWatchlist.length} items with price variance
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase text-[10px] border-b border-neutral-200/70">
                    <tr>
                      <th className="py-2.5 px-4">Ingredient</th>
                      <th className="py-2.5 px-4">Supplier</th>
                      <th className="py-2.5 px-4 text-right">Lowest Unit Rate</th>
                      <th className="py-2.5 px-4 text-right">Highest Unit Rate</th>
                      <th className="py-2.5 px-4 text-right">Latest Unit Rate</th>
                      <th className="py-2.5 px-4 text-right">Price Spread %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {priceVolatilityWatchlist.map((item) => (
                      <tr
                        key={item.key}
                        onClick={() => setSelectedIngredientName(item.key)}
                        className="hover:bg-amber-50/30 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4 font-bold text-neutral-900">{item.name}</td>
                        <td className="py-2.5 px-4 text-neutral-600">{item.vendor}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-700">
                          ${item.minPrice.toFixed(2)}/{item.unit}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-red-600 font-bold">
                          ${item.maxPrice.toFixed(2)}/{item.unit}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-neutral-900">
                          ${item.latestPrice.toFixed(2)}/{item.unit}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700">
                          +{item.variancePct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Visual Trends Chart */}
          {ingredientTimelineChartData.length > 1 && (
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Purchase Spend &amp; Unit Rate Timeline
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Chronological audit of expenditure ($) and unit price changes across invoices.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500"></span>
                    <span>Total Spend ($)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-blue-500"></span>
                    <span>Unit Price Paid ($)</span>
                  </div>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={ingredientTimelineChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      yAxisId="left"
                      stroke="#10b981"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#3b82f6"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "none",
                        borderRadius: "10px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: string) => [
                        name === "totalSpend"
                          ? `$${Number(val).toFixed(2)}`
                          : `$${Number(val).toFixed(2)}/unit`,
                        name === "totalSpend" ? "Total Spend" : "Unit Rate",
                      ]}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalSpend"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#spendGradient)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="unitPrice"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#3b82f6" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ITEM-BY-ITEM PURCHASE HISTORY TABLE */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Itemized Purchase Transactions ({ingredientTransactions.length})
                </h3>
                <p className="text-xs text-neutral-500">
                  {selectedIngredientName === "all"
                    ? "Showing all ingredient purchases matching current period"
                    : `Showing purchase history for "${selectedIngredientName}"`}
                </p>
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400 font-bold">Sort by:</span>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as any)}
                  className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
                >
                  <option value="date">Date</option>
                  <option value="total">Total Cost</option>
                  <option value="price">Unit Price</option>
                  <option value="qty">Quantity</option>
                </select>
                <button
                  onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  className="p-1.5 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer text-neutral-600"
                  title="Toggle ascending / descending"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {ingredientTransactions.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <Package className="w-10 h-10 mx-auto text-neutral-300 mb-2 stroke-1" />
                <p className="text-sm font-bold text-neutral-700">No purchase records found</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                  Try adjusting the date range preset or select a different ingredient above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Document / Source</th>
                      <th className="py-3 px-4">Supplier / Store</th>
                      <th className="py-3 px-4">Ingredient Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-center">Quantity</th>
                      <th className="py-3 px-4 text-right">Unit Price Paid</th>
                      <th className="py-3 px-4 text-right">Extended Total</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {ingredientTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-50/80 transition-colors group">
                        <td className="py-3 px-4 font-mono font-medium text-neutral-700 whitespace-nowrap">
                          {tx.date}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-neutral-600 font-medium">
                          {tx.documentRef}
                        </td>

                        <td className="py-3 px-4 font-bold text-neutral-900 whitespace-nowrap">
                          {tx.vendorOrStore}
                        </td>

                        <td
                          className="py-3 px-4 font-medium text-neutral-900 max-w-xs truncate"
                          title={tx.itemName}
                        >
                          {tx.itemName}
                        </td>

                        <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                          {tx.category}
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-neutral-800 whitespace-nowrap">
                          {tx.quantity}{" "}
                          <span className="text-[10px] text-neutral-500 font-normal">
                            {tx.unit}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 whitespace-nowrap">
                          ${tx.unitPrice.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          ${tx.totalCost.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {tx.fileUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDoc({
                                    url: tx.fileUrl!,
                                    name: tx.documentRef,
                                    type: tx.fileType,
                                    size: tx.fileSize,
                                    title: `Invoice Document: ${tx.documentRef}`,
                                    subtitle: `Vendor: ${tx.vendorOrStore} · Date: ${tx.date}`,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                title="Preview scanned receipt / invoice image"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Receipt
                              </button>
                            ) : (
                              <span className="text-[10px] text-neutral-300 font-mono">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: VENDOR SPENDING BY CALENDAR & SUPPLIER ANALYTICS */}
      {/* ===================================================================== */}
      {activeTab === "vendors" && (
        <div className="space-y-6">
          {/* Interactive Monthly Vendor Spending Calendar */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/50">
              <div>
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Vendor Spending by Calendar — {calendarData.monthLabel}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Daily supplier expenditure across the calendar month. Click any highlighted day to inspect its invoices and items.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filter calendar by specific supplier */}
                <select
                  value={calendarVendorFilter}
                  onChange={(e) => setCalendarVendorFilter(e.target.value)}
                  className="bg-white border border-neutral-300 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-800 cursor-pointer"
                >
                  <option value="all">All Suppliers</option>
                  {vendorSpendData.map((v) => (
                    <option key={v.vendor} value={v.vendor}>
                      {v.vendor} (${v.totalSpend.toFixed(2)})
                    </option>
                  ))}
                </select>

                {/* Month Navigation */}
                <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                      );
                      setSelectedCalendarDate(null);
                    }}
                    className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 cursor-pointer"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-xs font-bold font-mono text-neutral-900 min-w-[125px] text-center">
                    {calendarData.monthLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                      );
                      setSelectedCalendarDate(null);
                    }}
                    className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 cursor-pointer"
                    title="Next Month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Month Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 border-b border-neutral-200 bg-white">
              <div className="p-3.5 px-5 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">
                  Total Spend in {calendarData.monthLabel}:
                </span>
                <span className="text-sm font-bold font-mono text-emerald-700">
                  $
                  {calendarData.monthTotalSpend.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="p-3.5 px-5 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">
                  Active Delivery / Purchase Days:
                </span>
                <span className="text-sm font-bold font-mono text-neutral-900">
                  {calendarData.activeDeliveryDays} days
                </span>
              </div>
              <div className="p-3.5 px-5 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">
                  Peak Delivery Day:
                </span>
                <span className="text-sm font-bold font-mono text-neutral-900">
                  {calendarData.maxDaySpend > 0
                    ? `${calendarData.highestDayStr} ($${calendarData.maxDaySpend.toFixed(2)})`
                    : "—"}
                </span>
              </div>
            </div>

            {/* 7-Column Calendar Grid */}
            <div className="p-4">
              <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
                  <div
                    key={dayName}
                    className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 py-1"
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarData.cells.map((cell, idx) => {
                  if (cell.dayNumber === null || !cell.dateStr) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="min-h-[96px] rounded-xl bg-neutral-50/50 border border-neutral-100"
                      />
                    );
                  }

                  const hasSpend = cell.totalSpend > 0;
                  const isSelected = selectedCalendarDate === cell.dateStr;

                  return (
                    <button
                      type="button"
                      key={cell.dateStr}
                      onClick={() =>
                        setSelectedCalendarDate(
                          isSelected ? null : cell.dateStr
                        )
                      }
                      className={`min-h-[96px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/70"
                          : hasSpend
                          ? "border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/60"
                          : "border-neutral-200/70 bg-white hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-mono font-bold ${
                            hasSpend ? "text-neutral-900" : "text-neutral-400"
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {hasSpend && (
                          <span className="text-[11px] font-mono font-bold text-emerald-700">
                            ${cell.totalSpend.toFixed(0)}
                          </span>
                        )}
                      </div>

                      {hasSpend ? (
                        <div className="space-y-1 mt-1.5 w-full overflow-hidden">
                          {cell.vendorList.slice(0, 2).map((v) => (
                            <div
                              key={v.vendor}
                              className="text-[10px] leading-tight truncate text-neutral-700 font-medium flex items-center justify-between gap-1"
                              title={`${v.vendor}: $${v.spend.toFixed(2)}`}
                            >
                              <span className="truncate">{v.vendor}</span>
                              <span className="font-mono font-bold text-neutral-900 shrink-0">
                                ${v.spend.toFixed(0)}
                              </span>
                            </div>
                          ))}
                          {cell.vendorList.length > 2 && (
                            <div className="text-[9px] text-neutral-500 font-mono">
                              +{cell.vendorList.length - 2} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-neutral-300 font-mono mt-auto">
                          —
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Calendar Date Drill-down Drawer */}
            {selectedCalendarCell && selectedCalendarCell.dateStr && (
              <div className="p-4 sm:p-5 border-t border-neutral-200 bg-neutral-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900">
                      Deliveries &amp; Vendor Purchases on {selectedCalendarCell.dateStr}
                    </h4>
                    <p className="text-xs text-neutral-500">
                      {selectedCalendarCell.items.length} line items · Total: $
                      {selectedCalendarCell.totalSpend.toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDate(null)}
                    className="text-xs font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                  >
                    Close Day View
                  </button>
                </div>

                {selectedCalendarCell.items.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">
                    No vendor deliveries or grocery purchases recorded on this date.
                  </p>
                ) : (
                  <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase text-[10px] border-b border-neutral-200">
                        <tr>
                          <th className="py-2.5 px-4">Supplier / Store</th>
                          <th className="py-2.5 px-4">Document</th>
                          <th className="py-2.5 px-4">Ingredient</th>
                          <th className="py-2.5 px-4">Category</th>
                          <th className="py-2.5 px-4 text-center">Qty</th>
                          <th className="py-2.5 px-4 text-right">Unit Price</th>
                          <th className="py-2.5 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {selectedCalendarCell.items.map((item) => (
                          <tr key={item.id} className="hover:bg-neutral-50">
                            <td className="py-2.5 px-4 font-bold text-neutral-900">
                              {item.vendorOrStore}
                            </td>
                            <td className="py-2.5 px-4 text-neutral-600">
                              {item.documentRef}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-neutral-900">
                              {item.itemName}
                            </td>
                            <td className="py-2.5 px-4 text-neutral-500">
                              {item.category}
                            </td>
                            <td className="py-2.5 px-4 text-center font-mono">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono">
                              ${item.unitPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                              ${item.totalCost.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Monthly Calendar Spend Comparison Strip */}
          {monthlySpendTrend.length > 1 && (
            <div className="bg-white border border-neutral-200/80 p-4 sm:p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Monthly Vendor Spending Progression
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Click any month below to jump the calendar directly to that billing cycle.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {monthlySpendTrend.map((m) => {
                  const isCurrentCalMonth =
                    `${calendarData.year}-${String(calendarData.month + 1).padStart(2, "0")}` ===
                    m.monthKey;
                  return (
                    <button
                      type="button"
                      key={m.monthKey}
                      onClick={() => {
                        const [yr, mo] = m.monthKey.split("-").map(Number);
                        if (yr && mo) {
                          setCalendarMonth(new Date(yr, mo - 1, 1));
                          setSelectedCalendarDate(null);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isCurrentCalMonth
                          ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500/30"
                          : "border-neutral-200/80 bg-neutral-50/60 hover:bg-neutral-100"
                      }`}
                    >
                      <div className="text-[11px] font-bold text-neutral-500 uppercase">
                        {m.label}
                      </div>
                      <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
                        ${m.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        {m.orders} items
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Vendor Spend Donut Chart */}
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-600" />
                  Supplier Spend Distribution
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Proportion of procurement capital across all vendor accounts.
                </p>
              </div>

              <div className="h-60 w-full my-4">
                {vendorSpendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vendorSpendData}
                        dataKey="totalSpend"
                        nameKey="vendor"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {vendorSpendData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "none",
                          borderRadius: "10px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(val: any) => [
                          `$${Number(val).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}`,
                          "Total Spend",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                    No vendor invoices in this period
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-3 border-t border-neutral-100 max-h-40 overflow-y-auto">
                {vendorSpendData.slice(0, 6).map((v, i) => (
                  <div key={v.vendor} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="font-semibold text-neutral-800 truncate">{v.vendor}</span>
                    </div>
                    <span className="font-mono font-bold text-neutral-600">
                      {v.sharePercentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day-of-Week & Top Supplier Bar Charts */}
            <div className="lg:col-span-2 bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  Top Supplier Spend Volumes &amp; Weekly Delivery Pattern
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Ranked by total purchases in the selected period.
                </p>
              </div>

              <div className="h-64 sm:h-72 w-full pt-4">
                {vendorSpendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={vendorSpendData.slice(0, 8)}
                      layout="vertical"
                      margin={{ left: 20, right: 30, top: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis
                        type="number"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="vendor"
                        stroke="#475569"
                        fontSize={11}
                        tickLine={false}
                        width={110}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "none",
                          borderRadius: "10px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(val: any) => [
                          `$${Number(val).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}`,
                          "Purchased",
                        ]}
                      />
                      <Bar dataKey="totalSpend" fill="#10b981" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                    No supplier records available
                  </div>
                )}
              </div>

              {/* Day-of-week mini summary */}
              <div className="grid grid-cols-7 gap-1.5 pt-3 border-t border-neutral-100">
                {dayOfWeekSpend.map((d) => (
                  <div
                    key={d.day}
                    className="p-2 rounded-lg bg-neutral-50 text-center"
                  >
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">
                      {d.day}
                    </div>
                    <div className="text-xs font-mono font-bold text-neutral-800 mt-0.5">
                      ${d.spend.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Vendor Spend Ledger */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                Supplier Procurement Ledger
              </h3>
              <span className="text-xs font-mono text-neutral-500">
                {vendorSpendData.length} active suppliers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4 text-center">Line Items Purchased</th>
                    <th className="py-3 px-4 text-center">Delivery Days</th>
                    <th className="py-3 px-4 text-center">Latest Purchase Date</th>
                    <th className="py-3 px-4 text-right">Total Purchased ($)</th>
                    <th className="py-3 px-4 text-right">Share of Total Spend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {vendorSpendData.map((v) => (
                    <tr key={v.vendor} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-neutral-900">{v.vendor}</td>
                      <td className="py-3 px-4 text-center font-mono text-neutral-700">
                        {v.orderCount}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-neutral-700">
                        {v.deliveryDaysCount}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-neutral-500">
                        {v.lastOrder}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        $
                        {v.totalSpend.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-800">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${v.sharePercentage}%` }}
                            />
                          </div>
                          <span>{v.sharePercentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CATEGORY ALLOCATION (INGREDIENT TYPES) */}
      {/* ===================================================================== */}
      {activeTab === "categories" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Donut */}
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-emerald-600" />
                Category Allocation by Ingredient Type
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Purchase spend allocation across Meat &amp; Poultry, Seafood, Fresh Produce, Dairy &amp; Eggs, Dry Goods, and Sauces.
              </p>

              <div className="h-64 w-full my-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySpendData}
                      dataKey="totalSpend"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {categorySpendData.map((_, index) => (
                        <Cell
                          key={`cat-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "none",
                        borderRadius: "10px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [
                        `$${Number(val).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}`,
                        "Category Spend",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-neutral-100">
                {categorySpendData.map((c, i) => (
                  <button
                    type="button"
                    key={c.category}
                    onClick={() =>
                      setSelectedCategoryFilter(
                        selectedCategoryFilter === c.category ? "all" : c.category
                      )
                    }
                    className={`flex items-center justify-between text-xs p-2 rounded-lg transition-colors cursor-pointer ${
                      selectedCategoryFilter === c.category
                        ? "bg-emerald-100 border border-emerald-300"
                        : "bg-neutral-50 hover:bg-neutral-100"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="font-semibold text-neutral-800 truncate">
                        {c.category}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-neutral-700">{c.pct}%</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category Performance Breakdown List */}
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Ingredient Type Spending &amp; Inventory Breakdown
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Click any category to filter the itemized ingredient list below.
                </p>
              </div>

              <div className="space-y-4 my-4">
                {categorySpendData.map((c, i) => (
                  <div
                    key={c.category}
                    onClick={() =>
                      setSelectedCategoryFilter(
                        selectedCategoryFilter === c.category ? "all" : c.category
                      )
                    }
                    className="space-y-1.5 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-900 group-hover:text-emerald-700 transition-colors">
                        {c.category}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-neutral-500 font-mono">
                          {c.uniqueIngredientsCount} ingredients · {c.itemCount} purchases
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          ${c.totalSpend.toFixed(2)} ({c.pct}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(2, c.pct)}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Every purchased ingredient is automatically classified into its culinary ingredient type.
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Ingredient Type Category Table */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Ingredient Type Category Allocation Ledger
                </h3>
                <p className="text-xs text-neutral-500">
                  {selectedCategoryFilter === "all"
                    ? "Click any category row below to filter the Category Average Price report by that category"
                    : `Filtered by Category: ${selectedCategoryFilter}`}
                </p>
              </div>
              {selectedCategoryFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter("all")}
                  className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Show All Categories
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Ingredient Category</th>
                    <th className="py-3 px-4 text-center">Unique Items</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-right bg-emerald-50/60 text-emerald-900">
                      Category Avg Price
                    </th>
                    <th className="py-3 px-4">Top Purchased Ingredients in Category</th>
                    <th className="py-3 px-4 text-right">On-Hand Stock Value</th>
                    <th className="py-3 px-4 text-right">Total Purchase Spend</th>
                    <th className="py-3 px-4 text-right">Allocation %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {categorySpendData.map((c) => {
                    const isActiveCat = selectedCategoryFilter === c.category;
                    return (
                      <tr
                        key={c.category}
                        onClick={() =>
                          setSelectedCategoryFilter(isActiveCat ? "all" : c.category)
                        }
                        className={`hover:bg-emerald-50/40 transition-colors cursor-pointer ${
                          isActiveCat ? "bg-emerald-50/70" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-neutral-900">
                          {c.category}
                        </td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-neutral-700">
                          {c.uniqueIngredientsCount}
                        </td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-neutral-700">
                          {c.itemCount}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-800 bg-emerald-50/30">
                          ${c.avgUnitPrice.toFixed(2)}/unit
                        </td>
                        <td className="py-3 px-4 text-neutral-600 max-w-md truncate">
                          {c.topItems
                            .slice(0, 4)
                            .map((it) => `${it.name} ($${it.spend.toFixed(2)})`)
                            .join(" · ") || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-700">
                          ${c.onHandValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                          ${c.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-neutral-900">
                          {c.pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================================================================= */}
          {/* CATEGORY AVERAGE PRICE BY ITEM IN SELECTED PERIOD */}
          {/* ================================================================= */}
          <div className="bg-white border border-neutral-200/80 p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Category Average Price by Item
                  {selectedCategoryFilter !== "all" && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                      {selectedCategoryFilter}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Weighted and simple average unit prices, min/max price range, and total spend for each item by category in the selected period.
                </p>
              </div>

              {/* Direct Period Date Range Pickers */}
              <div className="flex flex-wrap items-center gap-2 bg-neutral-50 border border-neutral-200/80 p-2.5 rounded-xl text-xs">
                <span className="font-bold text-neutral-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Analysis Period:
                </span>
                <input
                  type="date"
                  value={
                    datePreset === "custom"
                      ? customStartDate
                      : dateRange.start.toISOString().split("T")[0]
                  }
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-neutral-900 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <span className="text-neutral-400 font-bold">to</span>
                <input
                  type="date"
                  value={
                    datePreset === "custom"
                      ? customEndDate
                      : dateRange.end.toISOString().split("T")[0]
                  }
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-neutral-900 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleExportCategoryAvgCSV}
                  disabled={categoryAvgPriceData.items.length === 0}
                  className="ml-1 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Category Avg CSV
                </button>
              </div>
            </div>

            {/* Category Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter("all");
                  setMeatSubTypeFilter("all");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedCategoryFilter === "all"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                }`}
              >
                All Categories ({distinctIngredients.length})
              </button>
              {categorySpendData.map((cat) => (
                <button
                  type="button"
                  key={cat.category}
                  onClick={() => {
                    setSelectedCategoryFilter(
                      selectedCategoryFilter === cat.category ? "all" : cat.category
                    );
                    setMeatSubTypeFilter("all");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedCategoryFilter === cat.category
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                  }`}
                >
                  {cat.category} ({cat.uniqueIngredientsCount}) · Avg ${cat.avgUnitPrice.toFixed(2)}
                </button>
              ))}
            </div>

            {/* Optional Sub-Type Filter when Meat & Poultry is selected + Supplier & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
              {selectedCategoryFilter === "Meat & Poultry" ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMeatSubTypeFilter("all")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      meatSubTypeFilter === "all"
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    All Meat Cuts
                  </button>
                  {categoryAvgPriceData.subTypeSummary.map((st) => (
                    <button
                      type="button"
                      key={st.subType}
                      onClick={() =>
                        setMeatSubTypeFilter(
                          meatSubTypeFilter === st.subType ? "all" : st.subType
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        meatSubTypeFilter === st.subType
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      {st.subType} ({st.itemCount})
                      {st.avgPrice > 0 ? ` · Avg $${st.avgPrice.toFixed(2)}` : ""}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-neutral-500 font-medium">
                  Showing average unit prices for{" "}
                  <span className="font-bold text-neutral-800">
                    {selectedCategoryFilter === "all" ? "All Categories" : selectedCategoryFilter}
                  </span>{" "}
                  ({categoryAvgPriceData.items.length} items)
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={meatVendorFilter}
                  onChange={(e) => setMeatVendorFilter(e.target.value)}
                  className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-800 cursor-pointer"
                >
                  <option value="all">
                    All Suppliers ({categoryAvgPriceData.allCategoryVendors.length})
                  </option>
                  {categoryAvgPriceData.allCategoryVendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                <div className="relative min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search item, category, supplier..."
                    value={meatSearchQuery}
                    onChange={(e) => setMeatSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                  {meatSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMeatSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Category Average Price KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-neutral-200/80 p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Category Weighted Avg Price
                </span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-700">
                ${categoryAvgPriceData.overallWeightedAvgPrice.toFixed(2)}
                <span className="text-xs font-sans font-normal text-neutral-500"> / unit</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Total category spend divided by total units purchased
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Category Simple Avg Price
                </span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-neutral-900">
                ${categoryAvgPriceData.overallSimpleAvgPrice.toFixed(2)}
                <span className="text-xs font-sans font-normal text-neutral-500"> / unit</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Mean unit price across {categoryAvgPriceData.items.length} items
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Category Spend in Period
                </span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-neutral-900">
                $
                {categoryAvgPriceData.filteredTotalSpend.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-mono tabular-nums">
                {categoryAvgPriceData.categoryShareOfAllFoodPct.toFixed(1)}% of total ingredient spend
              </p>
            </div>

            <div className="bg-white border border-neutral-200/80 p-5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Total Category Volume Bought
                </span>
                <Package className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-neutral-900">
                {categoryAvgPriceData.filteredTotalQty.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-mono tabular-nums">
                {categoryAvgPriceData.filteredOrderCount} purchases · {categoryAvgPriceData.items.length} distinct items
              </p>
            </div>
          </div>

          {/* Visual Bar Chart Comparing Average Price vs Latest Price for Category Items */}
          {categoryAvgPriceData.items.length > 0 && (
            <div className="bg-white border border-neutral-200/80 p-5 sm:p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    Category Average Unit Price Comparison by Item (
                    {selectedCategoryFilter === "all" ? "All Categories" : selectedCategoryFilter})
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Comparing weighted average unit price against latest unit price for top items in this category.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-600"></span>
                    <span>Weighted Avg Price ($)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-slate-400"></span>
                    <span>Latest Price Paid ($)</span>
                  </div>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryAvgPriceData.items.slice(0, 12).map((it) => ({
                      name: it.name.length > 20 ? `${it.name.slice(0, 18)}…` : it.name,
                      fullName: it.name,
                      weightedAvgPrice: Number(it.weightedAvgPrice.toFixed(2)),
                      latestPrice: Number(it.latestPrice.toFixed(2)),
                      unit: it.unit,
                    }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "none",
                        borderRadius: "10px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: string) => [
                        `$${Number(val).toFixed(2)}`,
                        name === "weightedAvgPrice" ? "Weighted Avg Price" : "Latest Price Paid",
                      ]}
                    />
                    <Bar dataKey="weightedAvgPrice" fill="#059669" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="latestPrice" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Category Item-by-Item Average Price Table */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Category Average Price Ledger by Item ({categoryAvgPriceData.items.length} items)
                </h3>
                <p className="text-xs text-neutral-500">
                  Click any item row below to inspect its chronological purchase history in the selected period.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-400 font-bold">Sort by:</span>
                <select
                  value={meatSortField}
                  onChange={(e) => setMeatSortField(e.target.value as any)}
                  className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer"
                >
                  <option value="totalCost">Total Period Spend</option>
                  <option value="avgPrice">Weighted Average Price</option>
                  <option value="totalQty">Total Quantity Purchased</option>
                  <option value="count">Purchase Count</option>
                  <option value="name">Item Name (A–Z)</option>
                </select>
                <button
                  type="button"
                  onClick={() => setMeatSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  className="p-1.5 border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer text-neutral-600"
                  title="Toggle ascending / descending"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {categoryAvgPriceData.items.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <Package className="w-10 h-10 mx-auto text-neutral-300 mb-2 stroke-1" />
                <p className="text-sm font-bold text-neutral-700">
                  No items found for this category and period
                </p>
                <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                  Try selecting &ldquo;All Categories&rdquo; or expanding the date range above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Ingredient Item</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Supplier(s)</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4 text-center">Total Qty Bought</th>
                      <th className="py-3 px-4 text-right bg-emerald-50/70 text-emerald-900">
                        Weighted Avg Price
                      </th>
                      <th className="py-3 px-4 text-right">Simple Avg Price</th>
                      <th className="py-3 px-4 text-right">Min – Max in Period</th>
                      <th className="py-3 px-4 text-right">Latest Price Paid</th>
                      <th className="py-3 px-4 text-right">Total Spend ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {categoryAvgPriceData.items.map((item) => {
                      const isSelected = selectedMeatItemKey === item.key;
                      return (
                        <tr
                          key={item.key}
                          onClick={() =>
                            setSelectedMeatItemKey(isSelected ? "all" : item.key)
                          }
                          className={`hover:bg-emerald-50/30 transition-colors cursor-pointer ${
                            isSelected ? "bg-emerald-50/60" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-neutral-900">
                            <div>{item.name}</div>
                            {item.avgPricePerBaseUnit && item.baseUnitName && (
                              <div className="text-[10px] font-mono font-normal text-neutral-500 mt-0.5">
                                Est. ${item.avgPricePerBaseUnit.toFixed(2)} / {item.baseUnitName}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-neutral-600 font-medium whitespace-nowrap">
                            <div>{item.category}</div>
                            {item.category === "Meat & Poultry" && (
                              <div className="text-[10px] text-neutral-400">{item.subType}</div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-neutral-700 font-medium">
                            <div>{item.primaryVendor}</div>
                            {item.vendorList.length > 1 && (
                              <div className="text-[10px] text-neutral-400">
                                +{item.vendorList.length - 1} other supplier(s)
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center font-mono tabular-nums text-neutral-700">
                            {item.count}
                          </td>

                          <td className="py-3 px-4 text-center font-mono tabular-nums font-bold text-neutral-800 whitespace-nowrap">
                            {item.totalQty.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            })}{" "}
                            <span className="text-[10px] font-normal text-neutral-500">
                              {item.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50/30 whitespace-nowrap text-sm">
                            ${item.weightedAvgPrice.toFixed(2)}
                            <span className="text-[10px] font-normal text-neutral-500">
                              /{item.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-700 whitespace-nowrap">
                            ${item.simpleAvgPrice.toFixed(2)}
                            <span className="text-[10px] font-normal text-neutral-400">
                              /{item.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-700 whitespace-nowrap">
                            <div>
                              ${item.minPrice.toFixed(2)} – ${item.maxPrice.toFixed(2)}
                            </div>
                            {item.spreadPct > 0 ? (
                              <div className="text-[10px] text-amber-700 font-semibold">
                                {item.spreadPct.toFixed(1)}% spread
                              </div>
                            ) : (
                              <div className="text-[10px] text-neutral-400">Fixed rate</div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                            <div className="font-bold text-neutral-900">
                              ${item.latestPrice.toFixed(2)}/{item.unit}
                            </div>
                            <div className="text-[10px] text-neutral-500">
                              {item.latestDate}
                              {Math.abs(item.vsAvgPct) >= 0.5 && (
                                <span
                                  className={`ml-1 font-bold ${
                                    item.vsAvgPct > 0 ? "text-red-600" : "text-emerald-700"
                                  }`}
                                >
                                  ({item.vsAvgPct > 0 ? "+" : ""}
                                  {item.vsAvgPct.toFixed(1)}% vs avg)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 whitespace-nowrap">
                            $
                            {item.totalCost.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Selected Category Item Drill-Down Purchase History */}
            {selectedMeatItemKey !== "all" &&
              (() => {
                const activeItem = categoryAvgPriceData.items.find(
                  (i) => i.key === selectedMeatItemKey
                );
                if (!activeItem) return null;
                return (
                  <div className="p-4 sm:p-5 border-t border-neutral-200 bg-neutral-50/70 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-900">
                          Period Purchase History for &ldquo;{activeItem.name}&rdquo; ({activeItem.category})
                        </h4>
                        <p className="text-xs text-neutral-500 font-mono tabular-nums">
                          {activeItem.count} orders · Total Qty: {activeItem.totalQty.toFixed(2)}{" "}
                          {activeItem.unit} · Weighted Avg Price:{" "}
                          <span className="font-bold text-emerald-700">
                            ${activeItem.weightedAvgPrice.toFixed(2)}/{activeItem.unit}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedMeatItemKey("all")}
                        className="text-xs font-bold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                      >
                        Close Item Breakdown
                      </button>
                    </div>

                    {activeItem.transactions.length === 0 ? (
                      <p className="text-xs text-neutral-500">
                        Catalog baseline item (no separate invoice transactions recorded in this period).
                      </p>
                    ) : (
                      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase text-[10px] border-b border-neutral-200">
                            <tr>
                              <th className="py-2.5 px-4">Date</th>
                              <th className="py-2.5 px-4">Document / Source</th>
                              <th className="py-2.5 px-4">Supplier</th>
                              <th className="py-2.5 px-4 text-center">Qty Purchased</th>
                              <th className="py-2.5 px-4 text-right">Unit Price Paid</th>
                              <th className="py-2.5 px-4 text-right">Diff vs. Period Avg</th>
                              <th className="py-2.5 px-4 text-right">Line Total</th>
                              <th className="py-2.5 px-4 text-center">Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {activeItem.transactions.map((tx) => {
                              const diffFromAvg = tx.unitPrice - activeItem.weightedAvgPrice;
                              const diffPct =
                                activeItem.weightedAvgPrice > 0
                                  ? (diffFromAvg / activeItem.weightedAvgPrice) * 100
                                  : 0;
                              return (
                                <tr key={tx.id} className="hover:bg-neutral-50">
                                  <td className="py-2.5 px-4 font-mono tabular-nums text-neutral-700">
                                    {tx.date}
                                  </td>
                                  <td className="py-2.5 px-4 text-neutral-600">
                                    {tx.documentRef}
                                  </td>
                                  <td className="py-2.5 px-4 font-bold text-neutral-900">
                                    {tx.vendorOrStore}
                                  </td>
                                  <td className="py-2.5 px-4 text-center font-mono tabular-nums">
                                    {tx.quantity} {tx.unit}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-neutral-900">
                                    ${tx.unitPrice.toFixed(2)}/{tx.unit}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                                    {Math.abs(diffPct) < 0.1 ? (
                                      <span className="text-neutral-400">At Avg</span>
                                    ) : (
                                      <span
                                        className={
                                          diffFromAvg > 0
                                            ? "text-red-600 font-bold"
                                            : "text-emerald-700 font-bold"
                                        }
                                      >
                                        {diffFromAvg > 0 ? "+" : ""}
                                        {diffPct.toFixed(1)}% (${diffFromAvg > 0 ? "+" : ""}
                                        {diffFromAvg.toFixed(2)})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                                    ${tx.totalCost.toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-4 text-center">
                                    {tx.fileUrl ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewDoc({
                                            url: tx.fileUrl!,
                                            name: tx.documentRef,
                                            type: tx.fileType,
                                            size: tx.fileSize,
                                            title: `Invoice Document: ${tx.documentRef}`,
                                            subtitle: `Vendor: ${tx.vendorOrStore} · Date: ${tx.date}`,
                                          })
                                        }
                                        className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Eye className="w-3 h-3" />
                                        View
                                      </button>
                                    ) : (
                                      <span className="text-neutral-300">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: RECIPE FOOD COST MARGINS */}
      {/* ===================================================================== */}
      {activeTab === "foodcost" && (
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-emerald-600" />
                  Culinary Cost Sheets &amp; Menu Margin Health ({recipes.length})
                </h3>
                <p className="text-xs text-neutral-500">
                  Cross-referencing live ingredient purchase costs against menu selling prices.
                </p>
              </div>
              {onSwitchSection && (
                <button
                  onClick={() => onSwitchSection("recipes")}
                  className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Edit Cost Sheets <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {recipes.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <ChefHat className="w-10 h-10 mx-auto text-neutral-300 mb-2 stroke-1" />
                <p className="text-sm font-bold text-neutral-700">No recipes configured</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Add recipes in the Culinary Cost Sheets tab to view food cost margin reports.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-200/70 text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Recipe / Menu Dish</th>
                      <th className="py-3 px-4 text-center">Department</th>
                      <th className="py-3 px-4 text-right">Selling Price</th>
                      <th className="py-3 px-4 text-right">Portion Cost</th>
                      <th className="py-3 px-4 text-right">Gross Profit ($)</th>
                      <th className="py-3 px-4 text-center">Food Cost %</th>
                      <th className="py-3 px-4 text-center">Margin Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {recipes.map((recipe) => {
                      const yieldCount = recipe.expectedYield && recipe.expectedYield > 0 ? recipe.expectedYield : 1;
                      const plateCost =
                        typeof recipe.costPerPortion === "number" && recipe.costPerPortion > 0
                          ? recipe.costPerPortion
                          : (recipe.totalCost || 0) / yieldCount;

                      const sellPrice = recipe.sellingPrice || 0;
                      const profit = sellPrice - plateCost;
                      const foodCostPct = sellPrice > 0 ? (plateCost / sellPrice) * 100 : 0;

                      return (
                        <tr key={recipe.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-neutral-900">{recipe.name}</td>
                          <td className="py-3 px-4 text-center font-medium text-neutral-600">
                            {recipe.department || "Kitchen"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900">
                            ${sellPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-neutral-700">
                            ${plateCost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            ${profit.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-neutral-800">
                            {foodCostPct.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-center font-semibold">
                            {foodCostPct <= 28 ? (
                              <span className="text-emerald-700">Healthy (&le;28%)</span>
                            ) : foodCostPct <= 35 ? (
                              <span className="text-blue-700">Target (28–35%)</span>
                            ) : (
                              <span className="text-red-600">High Cost (&gt;35%)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          fileUrl={previewDoc.url}
          fileName={previewDoc.name}
          fileType={previewDoc.type}
          fileSize={previewDoc.size}
          title={previewDoc.title || `Invoice: ${previewDoc.name}`}
          subtitle={previewDoc.subtitle}
        />
      )}
    </div>
  );
};
