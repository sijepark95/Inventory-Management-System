import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  ClipboardList,
  CheckCircle2,
  Plus,
  Minus,
  Save,
  History,
  Calendar,
  Trash2,
  Search,
  AlertTriangle,
  MapPin,
  Check,
  X,
  Download,
  Edit3,
  DollarSign,
  Layers,
  Store,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { IndustrialProduct, Vendor, Department, Employee } from "../types";
import {
  safeAddDoc,
  safeDeleteDoc,
  subscribeWorkspaceCollection,
} from "../lib/firebase";
import { INDUSTRIAL_CATEGORIES } from "./GroceryView";

const INDUSTRIAL_LOCATIONS = [
  "Dry Storage",
  "Supply Closet",
  "Packaging Station",
  "Dish Pit / Chemical Rack",
  "Backroom Rack",
  "Front Counter",
  "Walk-In / Utility",
] as const;

const INDUSTRIAL_PACKAGE_UNITS = [
  "Case",
  "Box",
  "Pack",
  "Bag",
  "Roll",
  "Sleeve",
  "Bundle",
  "Bottle",
  "Gallon",
  "Pail",
  "Drum",
  "Carton",
] as const;

export interface IndustrialStocktakeLog {
  id: string;
  date: string;
  totalValue: number;
  totalPieces: number;
  totalItemsCount: number;
  lowStockCount: number;
  items: {
    productId: string;
    name: string;
    category: string;
    vendor?: string;
    inStock: number;
    baseUnit: string;
    packagingUnit?: string;
    pcsPerPack?: number;
    registeredPackSize?: string;
    packPrice: number;
    unitRatePerPc: number;
    value: number;
  }[];
  ownerId: string;
  createdAt: string;
}

export interface IndustrialConsumptionLog {
  id?: string;
  productId: string;
  productName: string;
  category: string;
  department: string;
  quantityInput: number;
  unitInput: string; // "pc" or packagingUnit (e.g. "Case")
  totalPiecesDeducted: number;
  unitRatePerPc: number;
  totalCost: number;
  date: string;
  recordedBy?: string;
  notes?: string;
  ownerId: string;
  createdAt: string;
}

interface IndustrialInventoryViewProps {
  industrialProducts: IndustrialProduct[];
  vendors?: Vendor[];
  departments?: Department[];
  employees?: Employee[];
  onAddIndustrialProduct?: (
    product: Omit<IndustrialProduct, "id" | "ownerId" | "updatedAt">
  ) => Promise<void>;
  onUpdateIndustrialProduct?: (
    id: string,
    edits: Partial<IndustrialProduct>
  ) => Promise<void>;
  onDeleteIndustrialProduct?: (id: string) => Promise<void>;
  isReadOnly?: boolean;
  user?: any;
  workspaceOwnerId?: string | null;
}

export function getIndustrialRatePerPc(item: IndustrialProduct): number {
  const pcsRatio = Number(item.pcsPerPack || item.pcsPerPound || 0);
  const rawQty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const totalPcs = pcsRatio > 0 && rawQty < pcsRatio ? rawQty * pcsRatio : rawQty;
  const price = Number(item.price) || 0;
  if (totalPcs > 0 && price > 0) {
    return price / totalPcs;
  }
  if (pcsRatio > 0 && price > 0) {
    return price / pcsRatio;
  }
  return Number(item.unitPrice) || price || 0;
}

export default function IndustrialInventoryView({
  industrialProducts = [],
  vendors = [],
  departments = [],
  employees = [],
  onAddIndustrialProduct,
  onUpdateIndustrialProduct,
  onDeleteIndustrialProduct,
  isReadOnly = false,
  user,
  workspaceOwnerId,
}: IndustrialInventoryViewProps) {
  const [subTab, setSubTab] = useState<"count" | "usage" | "history">("count");

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedVendor, setSelectedVendor] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  // Draft editing states for inline stocktake table
  const [draftStockPcs, setDraftStockPcs] = useState<Record<string, number>>({});
  const [draftMinPar, setDraftMinPar] = useState<Record<string, number>>({});
  const [draftLocation, setDraftLocation] = useState<Record<string, string>>({});
  const [countInputMode, setCountInputMode] = useState<Record<string, "pc" | "pack">>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Add / Edit Product & Pack Size Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IndustrialProduct | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState<string>(INDUSTRIAL_CATEGORIES[0]);
  const [prodVendor, setProdVendor] = useState("");
  const [prodLocation, setProdLocation] = useState<string>(INDUSTRIAL_LOCATIONS[0]);
  const [prodPrice, setProdPrice] = useState<string>("");
  const [prodPackQty, setProdPackQty] = useState<string>("1");
  const [prodPackUnit, setProdPackUnit] = useState<string>("Case");
  const [prodPcsPerPack, setProdPcsPerPack] = useState<string>("100");
  const [prodExtraPacks, setProdExtraPacks] = useState<
    Array<{ ratio: string; targetUnit: string }>
  >([]);
  const [prodInStock, setProdInStock] = useState<string>("100");
  const [prodMinStock, setProdMinStock] = useState<string>("100");
  const [prodNotes, setProdNotes] = useState("");
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Stocktake History & Usage Logs from Firestore
  const [stocktakeHistory, setStocktakeHistory] = useState<IndustrialStocktakeLog[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [usageLogs, setUsageLogs] = useState<IndustrialConsumptionLog[]>([]);

  // Usage form states
  const [usageProductId, setUsageProductId] = useState("");
  const [usageDept, setUsageDept] = useState("");
  const [usageQty, setUsageQty] = useState("1");
  const [usageUnitMode, setUsageUnitMode] = useState<"pack" | "pc">("pack");
  const [usageDate, setUsageDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [usageRecordedBy, setUsageRecordedBy] = useState("");
  const [usageNotes, setUsageNotes] = useState("");
  const [isSubmittingUsage, setIsSubmittingUsage] = useState(false);

  const effectiveOwnerId = workspaceOwnerId || user?.uid || "default";

  useEffect(() => {
    if (!effectiveOwnerId) return;
    const unsubHistory = subscribeWorkspaceCollection(
      "industrialStocktakes",
      effectiveOwnerId,
      (docs) => {
        const sorted = (docs as IndustrialStocktakeLog[]).sort((a, b) =>
          (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || "")
        );
        setStocktakeHistory(sorted);
      }
    );
    const unsubUsage = subscribeWorkspaceCollection(
      "industrialConsumptions",
      effectiveOwnerId,
      (docs) => {
        const sorted = (docs as IndustrialConsumptionLog[]).sort((a, b) =>
          (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || "")
        );
        setUsageLogs(sorted);
      }
    );
    return () => {
      unsubHistory();
      unsubUsage();
    };
  }, [effectiveOwnerId]);

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.name?.trim()) set.add(v.name.trim());
    });
    industrialProducts.forEach((p) => {
      if (p.vendor?.trim()) set.add(p.vendor.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vendors, industrialProducts]);

  const filteredProducts = useMemo(() => {
    return industrialProducts
      .filter((item) => {
        const q = searchTerm.trim().toLowerCase();
        const matchSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.vendor && item.vendor.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          (item.location && item.location.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q));

        const matchCat =
          selectedCategory === "ALL" ||
          (item.category || "Other Industrial") === selectedCategory;

        const matchVendor =
          selectedVendor === "ALL" ||
          (item.vendor || "").toLowerCase() === selectedVendor.toLowerCase();

        const itemLoc =
          (item.id && draftLocation[item.id]) ||
          item.location ||
          "Dry Storage";
        const matchLoc =
          selectedLocation === "ALL" || itemLoc === selectedLocation;

        const currentStock =
          item.id && draftStockPcs[item.id] !== undefined
            ? draftStockPcs[item.id]
            : Number(item.inStock ?? 0);
        const pcsRatio = Number(item.pcsPerPack || item.pcsPerPound || 0);
        const currentPar =
          item.id && draftMinPar[item.id] !== undefined
            ? draftMinPar[item.id]
            : Number(item.minStock ?? (pcsRatio > 0 ? pcsRatio : 5));

        if (lowStockOnly && currentStock > currentPar) return false;
        if (inStockOnly && currentStock <= 0) return false;

        return matchSearch && matchCat && matchVendor && matchLoc;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [
    industrialProducts,
    searchTerm,
    selectedCategory,
    selectedVendor,
    selectedLocation,
    lowStockOnly,
    inStockOnly,
    draftStockPcs,
    draftMinPar,
    draftLocation,
  ]);

  // Inventory Summary KPIs
  const inventoryKpis = useMemo(() => {
    let totalValuation = 0;
    let totalPieces = 0;
    let lowStockCount = 0;
    let inStockItemsCount = 0;

    industrialProducts.forEach((item) => {
      const id = item.id || "";
      const stockPcs =
        id && draftStockPcs[id] !== undefined
          ? draftStockPcs[id]
          : Number(item.inStock ?? 0);
      const pcsRatio = Number(item.pcsPerPack || item.pcsPerPound || 0);
      const minPar =
        id && draftMinPar[id] !== undefined
          ? draftMinPar[id]
          : Number(item.minStock ?? (pcsRatio > 0 ? pcsRatio : 5));
      const ratePerPc = getIndustrialRatePerPc(item);

      totalPieces += stockPcs;
      totalValuation += stockPcs * ratePerPc;
      if (stockPcs <= minPar) lowStockCount++;
      if (stockPcs > 0) inStockItemsCount++;
    });

    return {
      totalValuation,
      totalPieces,
      lowStockCount,
      inStockItemsCount,
      totalSkus: industrialProducts.length,
    };
  }, [industrialProducts, draftStockPcs, draftMinPar]);

  const hasUnsavedChanges =
    Object.keys(draftStockPcs).length > 0 ||
    Object.keys(draftMinPar).length > 0 ||
    Object.keys(draftLocation).length > 0;

  const handleSaveSingleRow = async (item: IndustrialProduct) => {
    if (!item.id || !onUpdateIndustrialProduct || isReadOnly) return;
    setSavingRowId(item.id);
    try {
      const nextStock =
        draftStockPcs[item.id] !== undefined
          ? draftStockPcs[item.id]
          : Number(item.inStock ?? 0);
      const nextPar =
        draftMinPar[item.id] !== undefined
          ? draftMinPar[item.id]
          : Number(item.minStock ?? 5);
      const nextLoc =
        draftLocation[item.id] !== undefined
          ? draftLocation[item.id]
          : item.location || "Dry Storage";

      await onUpdateIndustrialProduct(item.id, {
        inStock: Math.max(0, Number(nextStock.toFixed(2))),
        minStock: Math.max(0, Number(nextPar.toFixed(2))),
        location: nextLoc,
      });

      setDraftStockPcs((prev) => {
        const copy = { ...prev };
        delete copy[item.id!];
        return copy;
      });
      setDraftMinPar((prev) => {
        const copy = { ...prev };
        delete copy[item.id!];
        return copy;
      });
      setDraftLocation((prev) => {
        const copy = { ...prev };
        delete copy[item.id!];
        return copy;
      });

      setStatusBanner({
        type: "success",
        text: `Saved inventory count for "${item.name}" (${nextStock.toLocaleString()} pc).`,
      });
      setTimeout(() => setStatusBanner(null), 3500);
    } catch (err) {
      console.error("Failed to update industrial inventory row:", err);
      setStatusBanner({
        type: "error",
        text: "Failed to save row update.",
      });
    } finally {
      setSavingRowId(null);
    }
  };

  const handleSaveAllAndSnapshot = async () => {
    if (isReadOnly || !onUpdateIndustrialProduct) return;
    setIsSavingAll(true);
    try {
      // 1. Save all modified draft rows to industrialProducts
      const modifiedIds = new Set([
        ...Object.keys(draftStockPcs),
        ...Object.keys(draftMinPar),
        ...Object.keys(draftLocation),
      ]);

      for (const id of modifiedIds) {
        const item = industrialProducts.find((p) => p.id === id);
        if (!item) continue;
        const nextStock =
          draftStockPcs[id] !== undefined
            ? draftStockPcs[id]
            : Number(item.inStock ?? 0);
        const nextPar =
          draftMinPar[id] !== undefined
            ? draftMinPar[id]
            : Number(item.minStock ?? 5);
        const nextLoc =
          draftLocation[id] !== undefined
            ? draftLocation[id]
            : item.location || "Dry Storage";

        await onUpdateIndustrialProduct(id, {
          inStock: Math.max(0, Number(nextStock.toFixed(2))),
          minStock: Math.max(0, Number(nextPar.toFixed(2))),
          location: nextLoc,
        });
      }

      // 2. Record Stocktake Snapshot in industrialStocktakes
      const snapshotItems = industrialProducts.map((item) => {
        const id = item.id || "";
        const inStock =
          id && draftStockPcs[id] !== undefined
            ? draftStockPcs[id]
            : Number(item.inStock ?? 0);
        const ratePerPc = getIndustrialRatePerPc(item);
        const value = inStock * ratePerPc;
        const pcsRatio = Number(item.pcsPerPack || item.pcsPerPound || 0);
        const pkgUnit =
          item.packagingUnit ||
          (item.unit && item.unit.toLowerCase() !== "pc" ? item.unit : "Case");

        return {
          productId: id,
          name: item.name,
          category: item.category || "Other Industrial",
          vendor: item.vendor || "Supplier",
          inStock,
          baseUnit: "pc",
          packagingUnit: pkgUnit,
          pcsPerPack: pcsRatio > 0 ? pcsRatio : 1,
          registeredPackSize:
            item.registeredPackSize ||
            (pcsRatio > 0 ? `${pcsRatio}pc per ${pkgUnit.toLowerCase()}` : undefined),
          packPrice: Number(item.price) || 0,
          unitRatePerPc: ratePerPc,
          value,
        };
      });

      const totalVal = snapshotItems.reduce((s, i) => s + i.value, 0);
      const totalPcs = snapshotItems.reduce((s, i) => s + i.inStock, 0);

      await safeAddDoc("industrialStocktakes", {
        date: new Date().toISOString().slice(0, 10),
        totalValue: Number(totalVal.toFixed(2)),
        totalPieces: Number(totalPcs.toFixed(2)),
        totalItemsCount: snapshotItems.length,
        lowStockCount: inventoryKpis.lowStockCount,
        items: snapshotItems,
        ownerId: effectiveOwnerId,
        createdAt: new Date().toISOString(),
      });

      setDraftStockPcs({});
      setDraftMinPar({});
      setDraftLocation({});
      setStatusBanner({
        type: "success",
        text: `Saved all industrial stock counts and logged stocktake snapshot ($${totalVal.toFixed(2)} across ${totalPcs.toLocaleString()} pc)!`,
      });
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err) {
      console.error("Failed to save industrial stocktake:", err);
      setStatusBanner({
        type: "error",
        text: "Failed to save stocktake snapshot.",
      });
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setProdName("");
    setProdCategory(INDUSTRIAL_CATEGORIES[0]);
    setProdVendor("");
    setProdLocation(INDUSTRIAL_LOCATIONS[0]);
    setProdPrice("");
    setProdPackQty("1");
    setProdPackUnit("Case");
    setProdPcsPerPack("100");
    setProdExtraPacks([]);
    setProdInStock("100");
    setProdMinStock("100");
    setProdNotes("");
    setShowProductModal(true);
  };

  const handleOpenEditModal = (item: IndustrialProduct) => {
    setEditingProduct(item);
    setProdName(item.name || "");
    setProdCategory(item.category || INDUSTRIAL_CATEGORIES[0]);
    setProdVendor(item.vendor || "");
    setProdLocation(item.location || INDUSTRIAL_LOCATIONS[0]);
    setProdPrice(String(item.price ?? 0));
    const ratio = Number(item.pcsPerPack || item.pcsPerPound || 0);
    const totalQty = Number(item.quantity ?? 1);
    const pkgQty =
      ratio > 0 && totalQty >= ratio ? Number((totalQty / ratio).toFixed(2)) : 1;
    setProdPackQty(String(pkgQty));
    const pkgUnitRaw =
      item.packagingUnit ||
      (item.unit && item.unit.toLowerCase() !== "pc" ? item.unit : "Case");
    setProdPackUnit(pkgUnitRaw.charAt(0).toUpperCase() + pkgUnitRaw.slice(1));
    setProdPcsPerPack(
      ratio > 0 ? String(ratio) : totalQty > 1 ? String(totalQty) : "100"
    );
    setProdExtraPacks(
      Array.isArray(item.conversions)
        ? item.conversions.map((c) => ({
            ratio: String(c.ratio ?? ""),
            targetUnit: c.targetUnit
              ? c.targetUnit.charAt(0).toUpperCase() + c.targetUnit.slice(1)
              : "Box",
          }))
        : []
    );
    setProdInStock(String(item.inStock ?? 0));
    setProdMinStock(String(item.minStock ?? (ratio > 0 ? ratio : 5)));
    setProdNotes(item.notes || "");
    setShowProductModal(true);
  };

  const handleSubmitProductModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    setIsSubmittingModal(true);
    try {
      const numPrice = Math.max(0, parseFloat(prodPrice) || 0);
      const numPackCount = Math.max(0.01, parseFloat(prodPackQty) || 1);
      const numPcsPerPack = Math.max(1, parseFloat(prodPcsPerPack) || 1);
      const cleanPackUnitRaw = prodPackUnit.trim() || "Case";
      const cleanPackUnit =
        cleanPackUnitRaw.toLowerCase() === "pc" ||
        cleanPackUnitRaw.toLowerCase() === "pcs"
          ? "Case"
          : cleanPackUnitRaw;
      const totalPcs = Number((numPackCount * numPcsPerPack).toFixed(2));
      const pricePerPc =
        totalPcs > 0 ? Number((numPrice / totalPcs).toFixed(6)) : 0;
      const numInStock = Math.max(0, parseFloat(prodInStock) || 0);
      const numMinStock = Math.max(0, parseFloat(prodMinStock) || 0);

      const cleanedExtraConvs = prodExtraPacks
        .map((ep) => ({
          ratio: parseFloat(ep.ratio) || 0,
          targetUnit: (ep.targetUnit || "Box").trim().toLowerCase(),
        }))
        .filter((ep) => ep.ratio > 0 && ep.targetUnit && ep.targetUnit !== "pc");

      const registeredPackDesc = `${numPcsPerPack}pc per ${cleanPackUnit.toLowerCase()}`;

      const payload: Omit<IndustrialProduct, "id" | "ownerId" | "updatedAt"> = {
        name: prodName.trim(),
        category: prodCategory || INDUSTRIAL_CATEGORIES[0],
        vendor: prodVendor.trim() || "General Supplier",
        location: prodLocation || INDUSTRIAL_LOCATIONS[0],
        price: numPrice,
        quantity: totalPcs,
        unit: "pc",
        baseUnit: "pc",
        packagingUnit: cleanPackUnit,
        pcsPerPack: numPcsPerPack,
        pcsPerPound: numPcsPerPack,
        registeredPackSize: registeredPackDesc,
        conversions: cleanedExtraConvs,
        unitPrice: pricePerPc,
        inStock: numInStock,
        minStock: numMinStock,
        source: editingProduct?.source || "Industrial Inventory",
        notes: prodNotes.trim() || undefined,
      };

      if (editingProduct?.id && onUpdateIndustrialProduct) {
        await onUpdateIndustrialProduct(editingProduct.id, payload);
      } else if (onAddIndustrialProduct) {
        await onAddIndustrialProduct(payload);
      }
      setShowProductModal(false);
    } catch (err) {
      console.error("Failed to save industrial product:", err);
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleLogUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usageProductId || isReadOnly) return;
    const targetProd = industrialProducts.find((p) => p.id === usageProductId);
    if (!targetProd || !targetProd.id) return;

    setIsSubmittingUsage(true);
    try {
      const qtyInput = Math.max(0.01, parseFloat(usageQty) || 1);
      const pcsRatio = Number(targetProd.pcsPerPack || targetProd.pcsPerPound || 1);
      const pkgUnit =
        targetProd.packagingUnit ||
        (targetProd.unit && targetProd.unit.toLowerCase() !== "pc"
          ? targetProd.unit
          : "Case");
      const totalPiecesDeducted =
        usageUnitMode === "pack"
          ? Number((qtyInput * pcsRatio).toFixed(2))
          : Number(qtyInput.toFixed(2));
      const ratePerPc = getIndustrialRatePerPc(targetProd);
      const totalCost = Number((totalPiecesDeducted * ratePerPc).toFixed(2));

      // Deduct from industrialProducts stock
      const prevStock = Number(targetProd.inStock ?? 0);
      const nextStock = Math.max(0, Number((prevStock - totalPiecesDeducted).toFixed(2)));
      if (onUpdateIndustrialProduct) {
        await onUpdateIndustrialProduct(targetProd.id, {
          inStock: nextStock,
        });
      }

      // Save usage log
      await safeAddDoc("industrialConsumptions", {
        productId: targetProd.id,
        productName: targetProd.name,
        category: targetProd.category || "Other Industrial",
        department: usageDept || "General Operations",
        quantityInput: qtyInput,
        unitInput: usageUnitMode === "pack" ? pkgUnit : "pc",
        totalPiecesDeducted,
        unitRatePerPc: ratePerPc,
        totalCost,
        date: usageDate,
        recordedBy: usageRecordedBy.trim() || undefined,
        notes: usageNotes.trim() || undefined,
        ownerId: effectiveOwnerId,
        createdAt: new Date().toISOString(),
      });

      setUsageQty("1");
      setUsageNotes("");
      setStatusBanner({
        type: "success",
        text: `Logged usage of ${totalPiecesDeducted.toLocaleString()} pc of "${targetProd.name}" (Remaining stock: ${nextStock.toLocaleString()} pc).`,
      });
      setTimeout(() => setStatusBanner(null), 4000);
    } catch (err) {
      console.error("Failed to log industrial usage:", err);
    } finally {
      setIsSubmittingUsage(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "Product Name",
      "Category",
      "Supplier",
      "Location",
      "Base Unit",
      "Registered Pack Size",
      "Pcs Per Pack",
      "Pack Price ($)",
      "Rate Per Pc ($)",
      "On-Hand Stock (pc)",
      "Min Par (pc)",
      "Asset Value ($)",
    ];
    const rows = filteredProducts.map((item) => {
      const id = item.id || "";
      const stockPcs =
        id && draftStockPcs[id] !== undefined
          ? draftStockPcs[id]
          : Number(item.inStock ?? 0);
      const pcsRatio = Number(item.pcsPerPack || item.pcsPerPound || 1);
      const minPar =
        id && draftMinPar[id] !== undefined
          ? draftMinPar[id]
          : Number(item.minStock ?? pcsRatio);
      const loc =
        (id && draftLocation[id]) || item.location || "Dry Storage";
      const pkgUnit =
        item.packagingUnit ||
        (item.unit && item.unit.toLowerCase() !== "pc" ? item.unit : "Case");
      const packSizeDesc =
        item.registeredPackSize || `${pcsRatio}pc per ${pkgUnit.toLowerCase()}`;
      const ratePerPc = getIndustrialRatePerPc(item);
      const assetVal = stockPcs * ratePerPc;

      return [
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${(item.category || "").replace(/"/g, '""')}"`,
        `"${(item.vendor || "").replace(/"/g, '""')}"`,
        `"${loc.replace(/"/g, '""')}"`,
        "pc",
        `"${packSizeDesc}"`,
        pcsRatio,
        (Number(item.price) || 0).toFixed(2),
        ratePerPc.toFixed(4),
        stockPcs,
        minPar,
        assetVal.toFixed(2),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `industrial_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
                Industrial Products Inventory
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Base Unit: pc (Piece)
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Physical stock counts in <strong>pc</strong> & registered package sizes, storage locations, par alerts, usage deductions, and stocktake snapshots.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Add Industrial Item</span>
              </button>

              <button
                type="button"
                disabled={isSavingAll || industrialProducts.length === 0}
                onClick={handleSaveAllAndSnapshot}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
                  hasUnsavedChanges
                    ? "bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-500/30"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {isSavingAll
                    ? "Saving Snapshot..."
                    : hasUnsavedChanges
                    ? `Save Counts & Snapshot (${Object.keys(draftStockPcs).length} edited)`
                    : "Log Stocktake Snapshot"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Notification */}
      {statusBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            statusBanner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1 hover:bg-black/5 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Industrial Asset Value
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-neutral-900">
              $
              {inventoryKpis.totalValuation.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              Calculated from pc stock × $/pc
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Total On-Hand Pieces
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-blue-700">
              {inventoryKpis.totalPieces.toLocaleString()} <span className="text-sm">pc</span>
            </span>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              Across {inventoryKpis.inStockItemsCount} stocked items
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Tracked Industrial SKUs
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-neutral-900">
              {inventoryKpis.totalSkus}
            </span>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              Packaging, chemicals & supplies
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">
              Low Stock Alerts
            </span>
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                inventoryKpis.lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {inventoryKpis.lowStockCount} items
            </span>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              At or below minimum pc par
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-6 border-b border-neutral-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab("count")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === "count"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Physical Stock Count ({industrialProducts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("usage")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === "usage"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Supply Usage & Deduction ({usageLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("history")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === "history"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stocktake History ({stocktakeHistory.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: PHYSICAL STOCK COUNT SHEET */}
      {subTab === "count" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search industrial product, supplier, location..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-medium text-neutral-700 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Categories</option>
                {INDUSTRIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-medium text-neutral-700 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Suppliers</option>
                {supplierOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 font-medium text-neutral-700 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Locations</option>
                {INDUSTRIAL_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  lowStockOnly
                    ? "bg-amber-100 border-amber-300 text-amber-900"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                Low Stock Only
              </button>

              <button
                type="button"
                onClick={() => setInStockOnly(!inStockOnly)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  inStockOnly
                    ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                In Stock Only
              </button>
            </div>
          </div>

          {/* Inventory Count Table */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-neutral-800">
                No Industrial Inventory Items Found
              </h3>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Add industrial products (packaging, paper goods, cleaning supplies, gloves) or parse an Industrial Products invoice in AI Document Parser.
              </p>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Industrial Item</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-3.5 px-4">Industrial Item & Location</th>
                      <th className="py-3.5 px-3">Category & Supplier</th>
                      <th className="py-3.5 px-3">Base Unit & Pack Size</th>
                      <th className="py-3.5 px-3 text-right">Cost Rate</th>
                      <th className="py-3.5 px-4 text-center">Physical Stock Count</th>
                      <th className="py-3.5 px-3 text-center">Min Par (pc)</th>
                      <th className="py-3.5 px-3 text-right">Asset Value</th>
                      {!isReadOnly && (
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredProducts.map((item) => {
                      const id = item.id || "";
                      const pcsRatio = Number(
                        item.pcsPerPack || item.pcsPerPound || 0
                      );
                      const pkgUnit =
                        item.packagingUnit ||
                        (item.unit && item.unit.toLowerCase() !== "pc"
                          ? item.unit
                          : "Case");
                      const currentStockPcs =
                        id && draftStockPcs[id] !== undefined
                          ? draftStockPcs[id]
                          : Number(item.inStock ?? 0);
                      const currentParPcs =
                        id && draftMinPar[id] !== undefined
                          ? draftMinPar[id]
                          : Number(item.minStock ?? (pcsRatio > 0 ? pcsRatio : 5));
                      const currentLoc =
                        (id && draftLocation[id]) ||
                        item.location ||
                        "Dry Storage";
                      const mode = (id && countInputMode[id]) || "pc";
                      const isLow = currentStockPcs <= currentParPcs;
                      const ratePerPc = getIndustrialRatePerPc(item);
                      const assetValue = currentStockPcs * ratePerPc;
                      const isRowDirty =
                        (id && draftStockPcs[id] !== undefined) ||
                        (id && draftMinPar[id] !== undefined) ||
                        (id && draftLocation[id] !== undefined);
                      const packSizeLabel =
                        item.registeredPackSize ||
                        (pcsRatio > 0
                          ? `${pcsRatio}pc per ${pkgUnit.toLowerCase()}`
                          : null);
                      const extraConvs = Array.isArray(item.conversions)
                        ? item.conversions
                        : [];

                      return (
                        <tr
                          key={id || item.name}
                          className={`transition-colors ${
                            isRowDirty
                              ? "bg-amber-50/40"
                              : "hover:bg-neutral-50/70"
                          }`}
                        >
                          {/* Name & Storage Location */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-neutral-900 text-xs">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                              <select
                                disabled={isReadOnly}
                                value={currentLoc}
                                onChange={(e) =>
                                  id &&
                                  setDraftLocation((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                }
                                className="text-[11px] bg-neutral-100 hover:bg-neutral-200/70 border border-neutral-200 rounded-md px-1.5 py-0.5 text-neutral-700 font-medium focus:outline-none cursor-pointer"
                              >
                                {INDUSTRIAL_LOCATIONS.map((loc) => (
                                  <option key={loc} value={loc}>
                                    {loc}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Category & Vendor */}
                          <td className="py-3.5 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-semibold">
                              {item.category || "Other Industrial"}
                            </span>
                            <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
                              <Store className="w-3 h-3 text-neutral-400" />
                              <span>{item.vendor || "General Supplier"}</span>
                            </div>
                          </td>

                          {/* Base Unit (pc) & Pack Size */}
                          <td className="py-3.5 px-3">
                            <div className="flex flex-col items-start gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[10px]">
                                  Base: pc
                                </span>
                                {packSizeLabel ? (
                                  <button
                                    type="button"
                                    onClick={() => !isReadOnly && handleOpenEditModal(item)}
                                    className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-mono font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                    title="Click to edit pack size"
                                  >
                                    <span>📦 {packSizeLabel}</span>
                                  </button>
                                ) : (
                                  !isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(item)}
                                      className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                      <span>Add Pack Size</span>
                                    </button>
                                  )
                                )}
                              </div>
                              {extraConvs.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {extraConvs.map((c, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200 font-mono text-[10px]"
                                    >
                                      +{c.ratio}pc/{c.targetUnit}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Cost Rate */}
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="font-bold text-emerald-700">
                              ${ratePerPc < 0.1 ? ratePerPc.toFixed(4) : ratePerPc.toFixed(2)}
                              <span className="text-[10px] font-normal text-neutral-400">
                                /pc
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              ${(Number(item.price) || 0).toFixed(2)}/{pkgUnit}
                            </div>
                          </td>

                          {/* Interactive Physical Stock Count */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="inline-flex items-center gap-1">
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!id) return;
                                      const step =
                                        mode === "pack" && pcsRatio > 0 ? pcsRatio : 1;
                                      setDraftStockPcs((prev) => ({
                                        ...prev,
                                        [id]: Math.max(
                                          0,
                                          Number((currentStockPcs - step).toFixed(2))
                                        ),
                                      }));
                                    }}
                                    className="w-6 h-6 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                                    title={
                                      mode === "pack" && pcsRatio > 0
                                        ? `Decrease by 1 ${pkgUnit} (${pcsRatio} pc)`
                                        : "Decrease by 1 pc"
                                    }
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                )}

                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  disabled={isReadOnly}
                                  value={
                                    mode === "pack" && pcsRatio > 0
                                      ? Number((currentStockPcs / pcsRatio).toFixed(2))
                                      : currentStockPcs
                                  }
                                  onChange={(e) => {
                                    if (!id) return;
                                    const raw = Math.max(0, parseFloat(e.target.value) || 0);
                                    const nextPcs =
                                      mode === "pack" && pcsRatio > 0
                                        ? Number((raw * pcsRatio).toFixed(2))
                                        : raw;
                                    setDraftStockPcs((prev) => ({
                                      ...prev,
                                      [id]: nextPcs,
                                    }));
                                  }}
                                  className={`w-20 px-2 py-1 text-center font-mono tabular-nums font-bold text-xs rounded-lg border focus:outline-none ${
                                    isLow
                                      ? "bg-amber-50 border-amber-300 text-amber-900"
                                      : "bg-white border-neutral-300 text-neutral-900 focus:border-blue-500"
                                  }`}
                                />

                                {/* Unit Switcher for Counting (pc vs Pack) */}
                                {pcsRatio > 1 ? (
                                  <select
                                    value={mode}
                                    onChange={(e) =>
                                      id &&
                                      setCountInputMode((prev) => ({
                                        ...prev,
                                        [id]: e.target.value as "pc" | "pack",
                                      }))
                                    }
                                    className="bg-neutral-100 border border-neutral-200 rounded-lg px-1.5 py-1 text-[10px] font-bold font-mono text-neutral-700 cursor-pointer"
                                    title="Switch count entry between pieces (pc) and packages"
                                  >
                                    <option value="pc">pc</option>
                                    <option value="pack">{pkgUnit}</option>
                                  </select>
                                ) : (
                                  <span className="text-[11px] font-mono font-bold text-neutral-600 px-1">
                                    pc
                                  </span>
                                )}

                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!id) return;
                                      const step =
                                        mode === "pack" && pcsRatio > 0 ? pcsRatio : 1;
                                      setDraftStockPcs((prev) => ({
                                        ...prev,
                                        [id]: Number((currentStockPcs + step).toFixed(2)),
                                      }));
                                    }}
                                    className="w-6 h-6 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                                    title={
                                      mode === "pack" && pcsRatio > 0
                                        ? `Increase by 1 ${pkgUnit} (${pcsRatio} pc)`
                                        : "Increase by 1 pc"
                                    }
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Secondary readout showing both pc and pack equivalent */}
                              {pcsRatio > 1 && (
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {currentStockPcs.toLocaleString()} pc (≈{" "}
                                  {(currentStockPcs / pcsRatio).toFixed(1)} {pkgUnit})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Min Stock Par (pc) */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                disabled={isReadOnly}
                                value={currentParPcs}
                                onChange={(e) =>
                                  id &&
                                  setDraftMinPar((prev) => ({
                                    ...prev,
                                    [id]: Math.max(0, parseFloat(e.target.value) || 0),
                                  }))
                                }
                                className="w-16 px-2 py-1 text-center font-mono tabular-nums text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-500"
                              />
                              <span className="text-[10px] font-mono text-neutral-400">
                                pc
                              </span>
                            </div>
                            {isLow && (
                              <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                                Low Stock
                              </div>
                            )}
                          </td>

                          {/* Asset Value */}
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-neutral-900">
                            ${assetValue.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          {/* Row Actions */}
                          {!isReadOnly && (
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                {isRowDirty && (
                                  <button
                                    type="button"
                                    disabled={savingRowId === id}
                                    onClick={() => handleSaveSingleRow(item)}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Save row changes"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Save</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(item)}
                                  className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                                  title="Edit item & pack size"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    id &&
                                    onDeleteIndustrialProduct &&
                                    onDeleteIndustrialProduct(id)
                                  }
                                  className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: SUPPLY USAGE & DEDUCTION */}
      {subTab === "usage" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Log Usage Form */}
          {!isReadOnly && (
            <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4 self-start">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Record Industrial Supply Usage
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Deduct used packaging, gloves, or chemicals from pc stock
                  </p>
                </div>
              </div>

              <form onSubmit={handleLogUsage} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Industrial Product *
                  </label>
                  <select
                    required
                    value={usageProductId}
                    onChange={(e) => setUsageProductId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select Industrial Product --</option>
                    {industrialProducts.map((p) => {
                      const ratio = Number(p.pcsPerPack || p.pcsPerPound || 0);
                      const pkg = p.packagingUnit || "Case";
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {(p.inStock ?? 0).toLocaleString()} pc
                          {ratio > 0 ? ` | ${ratio}pc/${pkg}` : ""})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Quantity Used *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={usageQty}
                      onChange={(e) => setUsageQty(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Count Unit
                    </label>
                    {(() => {
                      const sel = industrialProducts.find(
                        (p) => p.id === usageProductId
                      );
                      const pkg = sel?.packagingUnit || "Case";
                      const ratio = Number(
                        sel?.pcsPerPack || sel?.pcsPerPound || 1
                      );
                      return (
                        <select
                          value={usageUnitMode}
                          onChange={(e) =>
                            setUsageUnitMode(e.target.value as "pack" | "pc")
                          }
                          className="w-full px-3 py-2 text-xs font-bold bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                        >
                          <option value="pack">
                            {pkg} ({ratio} pc/{pkg.toLowerCase()})
                          </option>
                          <option value="pc">pc (Individual Pieces)</option>
                        </select>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Department / Station
                    </label>
                    <input
                      type="text"
                      list="ind-dept-list"
                      value={usageDept}
                      onChange={(e) => setUsageDept(e.target.value)}
                      placeholder="e.g. Kitchen, To-Go Station..."
                      className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                    <datalist id="ind-dept-list">
                      {departments.map((d) => (
                        <option key={d.id} value={d.name} />
                      ))}
                      <option value="To-Go / Packaging Station" />
                      <option value="Kitchen Line" />
                      <option value="Dish Pit & Sanitation" />
                      <option value="Front of House" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={usageDate}
                      onChange={(e) => setUsageDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Recorded By
                    </label>
                    <input
                      type="text"
                      list="ind-emp-list"
                      value={usageRecordedBy}
                      onChange={(e) => setUsageRecordedBy(e.target.value)}
                      placeholder="Staff name"
                      className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                    <datalist id="ind-emp-list">
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={usageNotes}
                      onChange={(e) => setUsageNotes(e.target.value)}
                      placeholder="Optional memo"
                      className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingUsage || !usageProductId}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmittingUsage
                    ? "Recording Usage..."
                    : "Record Usage & Deduct from Stock"}
                </button>
              </form>
            </div>
          )}

          {/* Usage Ledger Table */}
          <div
            className={`${
              isReadOnly ? "lg:col-span-12" : "lg:col-span-7"
            } bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden`}
          >
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">
                Recent Industrial Supply Usage Ledger
              </h3>
              <span className="text-xs text-neutral-500 font-mono">
                {usageLogs.length} records
              </span>
            </div>

            {usageLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-400">
                No industrial supply usage recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px] font-bold">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-3">Product</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3 text-right">Deducted (pc)</th>
                      <th className="py-3 px-3 text-right">Cost</th>
                      {!isReadOnly && <th className="py-3 px-3 text-right"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {usageLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-4 font-mono text-neutral-600">
                          {log.date}
                        </td>
                        <td className="py-3 px-3 font-bold text-neutral-900">
                          <div>{log.productName}</div>
                          {log.recordedBy && (
                            <span className="text-[10px] font-normal text-neutral-400">
                              By: {log.recordedBy}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-neutral-700">
                          {log.department}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-rose-600">
                          -{log.totalPiecesDeducted.toLocaleString()} pc
                          {log.unitInput !== "pc" && (
                            <span className="block text-[10px] font-normal text-neutral-400">
                              ({log.quantityInput} {log.unitInput})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-neutral-900">
                          ${(log.totalCost || 0).toFixed(2)}
                        </td>
                        {!isReadOnly && (
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                log.id &&
                                safeDeleteDoc("industrialConsumptions", log.id)
                              }
                              className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                              title="Delete usage log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STOCKTAKE HISTORY */}
      {subTab === "history" && (
        <div className="space-y-3">
          {stocktakeHistory.length === 0 ? (
            <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center space-y-2">
              <History className="w-8 h-8 text-neutral-400 mx-auto" />
              <h3 className="text-sm font-bold text-neutral-800">
                No Industrial Stocktake Snapshots Yet
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Click "Log Stocktake Snapshot" in the Physical Stock Count tab to record a timestamped valuation of your industrial inventory.
              </p>
            </div>
          ) : (
            stocktakeHistory.map((snap) => {
              const isExpanded = expandedHistoryId === snap.id;
              return (
                <div
                  key={snap.id}
                  className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-mono font-bold text-xs">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-900 font-mono">
                            {snap.date}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
                            {snap.totalItemsCount} SKUs
                          </span>
                          {snap.lowStockCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              {snap.lowStockCount} Low Stock
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 font-mono mt-0.5">
                          Total Pieces:{" "}
                          <strong>
                            {(snap.totalPieces || 0).toLocaleString()} pc
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-base font-bold font-mono tabular-nums text-emerald-700">
                          $
                          {(snap.totalValue || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="block text-[10px] text-neutral-400 uppercase font-bold">
                          Snapshot Value
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHistoryId(isExpanded ? null : snap.id)
                          }
                          className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() =>
                              safeDeleteDoc("industrialStocktakes", snap.id)
                            }
                            className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                            title="Delete snapshot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-200 text-neutral-500 uppercase text-[10px] font-bold">
                            <th className="pb-2">Product</th>
                            <th className="pb-2">Category</th>
                            <th className="pb-2">Pack Size</th>
                            <th className="pb-2 text-right">Stock (pc)</th>
                            <th className="pb-2 text-right">Rate/pc</th>
                            <th className="pb-2 text-right">Asset Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {snap.items?.map((it, idx) => (
                            <tr key={idx}>
                              <td className="py-2 font-bold text-neutral-800">
                                {it.name}
                              </td>
                              <td className="py-2 text-neutral-600">
                                {it.category}
                              </td>
                              <td className="py-2 font-mono text-neutral-600">
                                {it.registeredPackSize || "Base: pc"}
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-bold">
                                {(it.inStock || 0).toLocaleString()} pc
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums text-neutral-600">
                                ${(it.unitRatePerPc || 0).toFixed(4)}/pc
                              </td>
                              <td className="py-2 text-right font-mono tabular-nums font-bold text-neutral-900">
                                ${(it.value || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT INDUSTRIAL PRODUCT & PACK SIZES */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-neutral-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {editingProduct
                      ? "Edit Industrial Inventory Item & Pack Size"
                      : "Add Industrial Inventory Item"}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Base unit is <strong>pc (Piece)</strong> — configure package sizes & par levels
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitProductModal}
              className="p-5 space-y-4 overflow-y-auto flex-1"
            >
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Nitrile Gloves Large, 32oz Takeout Containers..."
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Category
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    {INDUSTRIAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    value={prodVendor}
                    onChange={(e) => setProdVendor(e.target.value)}
                    placeholder="e.g. Uline, Sysco..."
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Storage Location
                  </label>
                  <select
                    value={prodLocation}
                    onChange={(e) => setProdLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500"
                  >
                    {INDUSTRIAL_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Base Unit (pc) & Pack Size Configuration */}
              <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800">
                    Base Unit & Pack Size Configuration
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-mono font-bold">
                    🔢 Base Unit: pc (Piece)
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1.5">
                    Primary Pack Size (how many pc per package) *
                  </label>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={prodPcsPerPack}
                      onChange={(e) => {
                        const nextRatio = e.target.value;
                        setProdPcsPerPack(nextRatio);
                        if (!editingProduct) {
                          const r = parseFloat(nextRatio) || 1;
                          const q = parseFloat(prodPackQty) || 1;
                          setProdInStock(String(r * q));
                        }
                      }}
                      placeholder="e.g. 1000"
                      className="w-28 bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-none focus:border-blue-500"
                    />
                    <span className="bg-amber-100 text-amber-900 px-2.5 py-2 rounded-xl text-xs font-bold font-mono shrink-0">
                      pc per
                    </span>
                    <select
                      value={
                        INDUSTRIAL_PACKAGE_UNITS.some(
                          (u) => u.toLowerCase() === prodPackUnit.toLowerCase()
                        )
                          ? INDUSTRIAL_PACKAGE_UNITS.find(
                              (u) =>
                                u.toLowerCase() === prodPackUnit.toLowerCase()
                            )
                          : "Custom"
                      }
                      onChange={(e) => {
                        if (e.target.value !== "Custom") {
                          setProdPackUnit(e.target.value);
                        }
                      }}
                      className="bg-white border border-neutral-300 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {INDUSTRIAL_PACKAGE_UNITS.map((pkgOpt) => (
                        <option key={pkgOpt} value={pkgOpt}>
                          {pkgOpt}
                        </option>
                      ))}
                      <option value="Custom">Custom...</option>
                    </select>
                    <input
                      type="text"
                      value={prodPackUnit}
                      onChange={(e) => setProdPackUnit(e.target.value)}
                      placeholder="Case, Box..."
                      className="w-24 bg-white border border-neutral-300 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {prodExtraPacks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-neutral-200">
                    <span className="block text-[11px] font-bold text-neutral-600">
                      Additional Pack Sizes:
                    </span>
                    {prodExtraPacks.map((ep, epIdx) => (
                      <div key={epIdx} className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          placeholder="Qty (pc)"
                          value={ep.ratio}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProdExtraPacks((prev) => {
                              const next = [...prev];
                              next[epIdx] = { ...next[epIdx], ratio: val };
                              return next;
                            });
                          }}
                          className="w-24 bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-none"
                        />
                        <span className="bg-neutral-200 text-neutral-800 px-2 py-1.5 rounded-lg text-xs font-bold font-mono shrink-0">
                          pc per
                        </span>
                        <select
                          value={
                            INDUSTRIAL_PACKAGE_UNITS.some(
                              (opt) =>
                                opt.toLowerCase() ===
                                (ep.targetUnit || "").toLowerCase()
                            )
                              ? INDUSTRIAL_PACKAGE_UNITS.find(
                                  (opt) =>
                                    opt.toLowerCase() ===
                                    (ep.targetUnit || "").toLowerCase()
                                )
                              : "Box"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            setProdExtraPacks((prev) => {
                              const next = [...prev];
                              next[epIdx] = { ...next[epIdx], targetUnit: val };
                              return next;
                            });
                          }}
                          className="bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none cursor-pointer flex-1"
                        >
                          {INDUSTRIAL_PACKAGE_UNITS.map((pkgOpt) => (
                            <option key={pkgOpt} value={pkgOpt}>
                              {pkgOpt}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setProdExtraPacks((prev) =>
                              prev.filter((_, i) => i !== epIdx)
                            )
                          }
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
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
                    setProdExtraPacks((prev) => [
                      ...prev,
                      { ratio: "", targetUnit: "Box" },
                    ])
                  }
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 pt-0.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another pack size</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Price per {prodPackUnit || "Pack"} ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Number of {prodPackUnit || "Pack"}s
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={prodPackQty}
                    onChange={(e) => setProdPackQty(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    On-Hand Stock (in pc)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={prodInStock}
                    onChange={(e) => setProdInStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Min Stock Par (in pc)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingModal}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingModal
                    ? "Saving..."
                    : editingProduct
                    ? "Save Changes"
                    : "Add to Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
