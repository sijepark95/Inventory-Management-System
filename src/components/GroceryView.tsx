import React, { useState, useMemo } from "react";
import {
  GroceryPurchase,
  GroceryPurchaseItem,
  GroceryShoppingItem,
  IndustrialProduct,
  Ingredient,
  Vendor,
} from "../types";
import {
  Package,
  Plus,
  Receipt,
  Store,
  Search,
  Calendar,
  Trash2,
  Edit3,
  Check,
  DollarSign,
  TrendingUp,
  Copy,
  Printer,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ListChecks,
  Tag,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Minus,
  ClipboardList,
} from "lucide-react";
import IndustrialInventoryView from "./IndustrialInventoryView";

export const INDUSTRIAL_CATEGORIES = [
  "Packaging & Containers",
  "Paper & Disposables",
  "Cleaning & Chemicals",
  "Gloves & Safety",
  "Kitchen Smallwares",
  "Equipment & Maintenance",
  "Other Industrial",
] as const;

const COMMON_SUPPLIERS = [
  "Uline",
  "Sysco",
  "US Foods",
  "Restaurant Depot",
  "WebstaurantStore",
  "Costco Business",
  "Ecolab",
  "imperial Dade",
  "Sam's Club",
  "Local Supplier",
];

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

interface GroceryViewProps {
  ingredients: Ingredient[];
  industrialProducts?: IndustrialProduct[];
  vendors: Vendor[];
  groceryPurchases: GroceryPurchase[];
  shoppingList: GroceryShoppingItem[];
  onAddIndustrialProduct?: (
    product: Omit<IndustrialProduct, "id" | "ownerId" | "updatedAt">
  ) => Promise<void>;
  onUpdateIndustrialProduct?: (
    id: string,
    edits: Partial<IndustrialProduct>
  ) => Promise<void>;
  onDeleteIndustrialProduct?: (id: string) => Promise<void>;
  onAddGroceryPurchase: (
    purchase: Omit<GroceryPurchase, "id" | "ownerId" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  onUpdateGroceryPurchase: (
    id: string,
    edits: Partial<GroceryPurchase>
  ) => Promise<void>;
  onDeleteGroceryPurchase: (id: string) => Promise<void>;
  onAddShoppingItem: (
    item: Omit<GroceryShoppingItem, "id" | "ownerId" | "createdAt">
  ) => Promise<void>;
  onToggleShoppingItem: (id: string, isChecked: boolean) => Promise<void>;
  onDeleteShoppingItem: (id: string) => Promise<void>;
  onClearCheckedShoppingItems: () => Promise<void>;
  onSyncIngredientPrice?: (
    ingredientId: string,
    newUnitPrice: number,
    unit: string
  ) => Promise<void>;
  isReadOnly?: boolean;
}

export default function GroceryView({
  ingredients,
  industrialProducts = [],
  vendors,
  groceryPurchases,
  shoppingList,
  onAddIndustrialProduct,
  onUpdateIndustrialProduct,
  onDeleteIndustrialProduct,
  onAddGroceryPurchase,
  onUpdateGroceryPurchase,
  onDeleteGroceryPurchase,
  onAddShoppingItem,
  onToggleShoppingItem,
  onDeleteShoppingItem,
  onClearCheckedShoppingItems,
  onSyncIngredientPrice,
  isReadOnly = false,
}: GroceryViewProps) {
  // Navigation sub-tab inside Industrial Products
  const [activeTab, setActiveTab] = useState<
    "catalog" | "inventory" | "purchases" | "shopping" | "insights"
  >("catalog");

  // Catalog filter & search states
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("all");
  const [catalogVendorFilter, setCatalogVendorFilter] = useState("all");

  // Purchase History filter & search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState("all");
  const [selectedMonthFilter, setSelectedMonthFilter] = useState("all");
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(
    null
  );

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<IndustrialProduct | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] =
    useState<GroceryPurchase | null>(null);
  const [showShoppingItemModal, setShowShoppingItemModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Form states for Add / Edit Industrial Product (Base Unit: pc + Pack Sizes)
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState<string>(
    INDUSTRIAL_CATEGORIES[0]
  );
  const [prodVendor, setProdVendor] = useState("");
  const [prodPrice, setProdPrice] = useState<string>("");
  const [prodQuantity, setProdQuantity] = useState<string>("1");
  const [prodUnit, setProdUnit] = useState("Case");
  const [prodPcsPerPack, setProdPcsPerPack] = useState<string>("100");
  const [prodExtraPacks, setProdExtraPacks] = useState<
    Array<{ ratio: string; targetUnit: string }>
  >([]);
  const [prodInStock, setProdInStock] = useState<string>("0");
  const [prodMinStock, setProdMinStock] = useState<string>("100");
  const [prodNotes, setProdNotes] = useState("");
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Form states for New / Edit Purchase
  const [formStoreName, setFormStoreName] = useState("");
  const [formDate, setFormDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [formPaymentMethod, setFormPaymentMethod] =
    useState<GroceryPurchase["paymentMethod"]>("Company Card");
  const [formPurchaserName, setFormPurchaserName] = useState("");
  const [formReceiptNumber, setFormReceiptNumber] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<GroceryPurchaseItem[]>([
    {
      id: "item-1",
      name: "",
      quantity: 1,
      unit: "case",
      price: 0,
      unitPrice: 0,
      category: INDUSTRIAL_CATEGORIES[0],
      linkedIngredientId: "",
      notes: "",
    },
  ]);
  const [formAutoSyncCatalog, setFormAutoSyncCatalog] = useState(true);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  // Form states for Restock Checklist Item Modal
  const [shopName, setShopName] = useState("");
  const [shopQuantity, setShopQuantity] = useState<number>(1);
  const [shopUnit, setShopUnit] = useState("case");
  const [shopCategory, setShopCategory] = useState<string>(
    INDUSTRIAL_CATEGORIES[0]
  );
  const [shopStore, setShopStore] = useState("");
  const [shopEstCost, setShopEstCost] = useState<string>("");
  const [shopNotes, setShopNotes] = useState("");
  const [shopLinkedId, setShopLinkedId] = useState("");
  const [isSubmittingShopping, setIsSubmittingShopping] = useState(false);

  // Combined supplier options
  const supplierOptions = useMemo(() => {
    const set = new Set<string>(COMMON_SUPPLIERS);
    vendors.forEach((v) => {
      if (v.name?.trim()) set.add(v.name.trim());
    });
    industrialProducts.forEach((p) => {
      if (p.vendor?.trim()) set.add(p.vendor.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vendors, industrialProducts]);

  // Filtered Industrial Products Catalog
  const filteredCatalog = useMemo(() => {
    return industrialProducts
      .filter((item) => {
        const q = catalogSearch.trim().toLowerCase();
        const matchSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.vendor && item.vendor.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          (item.source && item.source.toLowerCase().includes(q));
        const matchCat =
          catalogCategoryFilter === "all" ||
          (item.category || "Other Industrial") === catalogCategoryFilter;
        const matchVendor =
          catalogVendorFilter === "all" ||
          (item.vendor || "").toLowerCase() ===
            catalogVendorFilter.toLowerCase();
        return matchSearch && matchCat && matchVendor;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [
    industrialProducts,
    catalogSearch,
    catalogCategoryFilter,
    catalogVendorFilter,
  ]);

  // Low-stock industrial products
  const lowStockIndustrial = useMemo(() => {
    return industrialProducts.filter((item) => {
      const current = item.inStock ?? 0;
      const min = item.minStock ?? 5;
      return current <= min;
    });
  }, [industrialProducts]);

  // Available months in purchases
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    groceryPurchases.forEach((p) => {
      if (p.date) {
        months.add(p.date.substring(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [groceryPurchases]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return groceryPurchases
      .filter((p) => {
        const matchSearch =
          !searchQuery.trim() ||
          p.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.purchaserName &&
            p.purchaserName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.notes &&
            p.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          p.items.some((it) =>
            it.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

        const matchStore =
          selectedStoreFilter === "all" ||
          p.storeName.toLowerCase() === selectedStoreFilter.toLowerCase();

        const matchMonth =
          selectedMonthFilter === "all" ||
          (p.date && p.date.startsWith(selectedMonthFilter));

        return matchSearch && matchStore && matchMonth;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [
    groceryPurchases,
    searchQuery,
    selectedStoreFilter,
    selectedMonthFilter,
  ]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const nowMonth = new Date().toISOString().substring(0, 7);
    const currentMonthPurchases = groceryPurchases.filter(
      (p) => p.date && p.date.startsWith(nowMonth)
    );
    const currentMonthSpend = currentMonthPurchases.reduce(
      (acc, p) => acc + (p.totalAmount || 0),
      0
    );
    const totalAllTimeSpend = groceryPurchases.reduce(
      (acc, p) => acc + (p.totalAmount || 0),
      0
    );
    const totalRuns = groceryPurchases.length;
    const avgRunCost = totalRuns > 0 ? totalAllTimeSpend / totalRuns : 0;

    const catalogStockValuation = industrialProducts.reduce(
      (acc, p) => acc + (Number(p.inStock) || 0) * (Number(p.price) || 0),
      0
    );

    const pendingShoppingItems = shoppingList.filter((s) => !s.isChecked);
    const estimatedCartTotal = pendingShoppingItems.reduce(
      (acc, s) => acc + (s.estimatedCost || 0),
      0
    );

    const storeCounts: Record<string, { count: number; spend: number }> = {};
    groceryPurchases.forEach((p) => {
      const s = p.storeName || "Unknown Supplier";
      if (!storeCounts[s]) storeCounts[s] = { count: 0, spend: 0 };
      storeCounts[s].count += 1;
      storeCounts[s].spend += p.totalAmount || 0;
    });

    const categorySpend: Record<string, number> = {};
    groceryPurchases.forEach((p) => {
      p.items.forEach((it) => {
        const cat = it.category || "Other Industrial";
        categorySpend[cat] = (categorySpend[cat] || 0) + (it.price || 0);
      });
    });

    return {
      currentMonthSpend,
      totalAllTimeSpend,
      totalRuns,
      avgRunCost,
      catalogStockValuation,
      pendingCount: pendingShoppingItems.length,
      estimatedCartTotal,
      storeCounts,
      categorySpend,
    };
  }, [groceryPurchases, shoppingList, industrialProducts]);

  // Open modal for new Industrial Product (Base Unit: pc)
  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setProdName("");
    setProdCategory(INDUSTRIAL_CATEGORIES[0]);
    setProdVendor("");
    setProdPrice("");
    setProdQuantity("1");
    setProdUnit("Case");
    setProdPcsPerPack("100");
    setProdExtraPacks([]);
    setProdInStock("100");
    setProdMinStock("100");
    setProdNotes("");
    setShowProductModal(true);
  };

  // Open modal for editing Industrial Product
  const handleOpenEditProduct = (item: IndustrialProduct) => {
    setEditingProduct(item);
    setProdName(item.name || "");
    setProdCategory(item.category || INDUSTRIAL_CATEGORIES[0]);
    setProdVendor(item.vendor || "");
    setProdPrice(String(item.price ?? 0));
    const ratio = Number(item.pcsPerPack || item.pcsPerPound || 0);
    const totalQty = Number(item.quantity ?? 1);
    const pkgQty = ratio > 0 && totalQty >= ratio ? Number((totalQty / ratio).toFixed(2)) : 1;
    setProdQuantity(String(pkgQty));
    const pkgUnitRaw = item.packagingUnit || (item.unit && item.unit.toLowerCase() !== "pc" ? item.unit : "Case");
    setProdUnit(pkgUnitRaw.charAt(0).toUpperCase() + pkgUnitRaw.slice(1));
    setProdPcsPerPack(ratio > 0 ? String(ratio) : totalQty > 1 ? String(totalQty) : "100");
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

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    setIsSubmittingProduct(true);
    try {
      const numPrice = Math.max(0, parseFloat(prodPrice) || 0);
      const numPackCount = Math.max(0.01, parseFloat(prodQuantity) || 1);
      const numPcsPerPack = Math.max(1, parseFloat(prodPcsPerPack) || 1);
      const cleanPackUnitRaw = prodUnit.trim() || "Case";
      const cleanPackUnit =
        cleanPackUnitRaw.toLowerCase() === "pc" || cleanPackUnitRaw.toLowerCase() === "pcs"
          ? "Case"
          : cleanPackUnitRaw;
      const totalPcs = Number((numPackCount * numPcsPerPack).toFixed(2));
      const pricePerPc = totalPcs > 0 ? Number((numPrice / totalPcs).toFixed(6)) : 0;
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
        source: editingProduct?.source || "Manual Catalog Entry",
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
      setIsSubmittingProduct(false);
    }
  };

  const handleAdjustStock = async (item: IndustrialProduct, delta: number) => {
    if (!item.id || !onUpdateIndustrialProduct || isReadOnly) return;
    const nextStock = Math.max(0, Number(((item.inStock ?? 0) + delta).toFixed(2)));
    await onUpdateIndustrialProduct(item.id, { inStock: nextStock });
  };

  // Auto-fill from catalog selection in shopping modal
  const handleSelectShopProduct = (prodId: string) => {
    setShopLinkedId(prodId);
    const prod = industrialProducts.find((i) => i.id === prodId);
    if (prod) {
      setShopName(prod.name);
      setShopUnit(prod.unit || "case");
      setShopCategory(prod.category || INDUSTRIAL_CATEGORIES[0]);
      if (prod.vendor) setShopStore(prod.vendor);
      if (prod.price) setShopEstCost(prod.price.toFixed(2));
    }
  };

  // Open modal for new purchase
  const handleOpenNewPurchase = () => {
    setEditingPurchase(null);
    setFormStoreName("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormPaymentMethod("Company Card");
    setFormPurchaserName("");
    setFormReceiptNumber("");
    setFormNotes("");
    setFormItems([
      {
        id: `item-${Date.now()}-1`,
        name: "",
        quantity: 1,
        unit: "case",
        price: 0,
        unitPrice: 0,
        category: INDUSTRIAL_CATEGORIES[0],
        linkedIngredientId: "",
        notes: "",
      },
    ]);
    setShowPurchaseModal(true);
  };

  // Open modal for editing purchase
  const handleOpenEditPurchase = (p: GroceryPurchase) => {
    setEditingPurchase(p);
    setFormStoreName(p.storeName);
    setFormDate(p.date);
    setFormPaymentMethod(p.paymentMethod || "Company Card");
    setFormPurchaserName(p.purchaserName || "");
    setFormReceiptNumber(p.receiptNumber || "");
    setFormNotes(p.notes || "");
    setFormItems(
      p.items && p.items.length > 0
        ? p.items.map((it) => ({ ...it }))
        : [
            {
              id: `item-${Date.now()}-1`,
              name: "",
              quantity: 1,
              unit: "case",
              price: 0,
              unitPrice: 0,
              category: INDUSTRIAL_CATEGORIES[0],
              linkedIngredientId: "",
              notes: "",
            },
          ]
    );
    setShowPurchaseModal(true);
  };

  // Handle item row changes in purchase form
  const handleItemChange = (
    index: number,
    field: keyof GroceryPurchaseItem,
    val: any
  ) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: val };

    if (field === "name" && typeof val === "string") {
      const matchInd = industrialProducts.find(
        (p) => p.name.toLowerCase().trim() === val.toLowerCase().trim()
      );
      if (matchInd) {
        updated[index].linkedIngredientId = matchInd.id || "";
        if (matchInd.category) updated[index].category = matchInd.category;
        if (matchInd.unit) updated[index].unit = matchInd.unit;
      }
    }

    if (field === "price" || field === "quantity") {
      const qty =
        field === "quantity" ? Number(val) : Number(updated[index].quantity);
      const prc =
        field === "price" ? Number(val) : Number(updated[index].price);
      if (qty > 0 && prc >= 0) {
        updated[index].unitPrice = Number((prc / qty).toFixed(3));
      }
    }

    setFormItems(updated);
  };

  const handleAddItemRow = () => {
    setFormItems([
      ...formItems,
      {
        id: `item-${Date.now()}-${formItems.length + 1}`,
        name: "",
        quantity: 1,
        unit: "case",
        price: 0,
        unitPrice: 0,
        category: INDUSTRIAL_CATEGORIES[0],
        linkedIngredientId: "",
        notes: "",
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Save Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStoreName.trim()) return;
    setIsSubmittingPurchase(true);

    try {
      const cleanedItems: GroceryPurchaseItem[] = formItems
        .filter((it) => it.name.trim().length > 0)
        .map((it) => ({
          ...it,
          quantity: Number(it.quantity) || 1,
          price: Number(it.price) || 0,
          unitPrice:
            Number(it.quantity) > 0
              ? Number((Number(it.price) / Number(it.quantity)).toFixed(3))
              : Number(it.price),
        }));

      const calculatedTotal = cleanedItems.reduce(
        (acc, it) => acc + it.price,
        0
      );

      const purchaseData = {
        storeName: formStoreName.trim(),
        date: formDate,
        paymentMethod: formPaymentMethod,
        purchaserName: formPurchaserName.trim() || undefined,
        receiptNumber: formReceiptNumber.trim() || undefined,
        notes: formNotes.trim() || undefined,
        items: cleanedItems,
        totalAmount: calculatedTotal,
      };

      if (editingPurchase && editingPurchase.id) {
        await onUpdateGroceryPurchase(editingPurchase.id, purchaseData);
      } else {
        await onAddGroceryPurchase(purchaseData);
      }

      // Sync to Industrial Products Catalog if enabled
      if (formAutoSyncCatalog && !editingPurchase) {
        for (const it of cleanedItems) {
          const existingProd = industrialProducts.find(
            (p) =>
              (it.linkedIngredientId && p.id === it.linkedIngredientId) ||
              p.name.toLowerCase().trim() === it.name.toLowerCase().trim()
          );
          if (existingProd && existingProd.id && onUpdateIndustrialProduct) {
            await onUpdateIndustrialProduct(existingProd.id, {
              price: it.price,
              quantity: it.quantity,
              unit: it.unit || existingProd.unit,
              unitPrice: it.unitPrice || it.price / (it.quantity || 1),
              vendor: formStoreName.trim(),
              inStock: (existingProd.inStock ?? 0) + (it.quantity || 1),
              source: formReceiptNumber
                ? `Receipt #${formReceiptNumber}`
                : `Purchase (${formDate})`,
            });
          } else if (onAddIndustrialProduct) {
            await onAddIndustrialProduct({
              name: it.name.trim(),
              category: it.category || INDUSTRIAL_CATEGORIES[0],
              vendor: formStoreName.trim(),
              price: it.price,
              quantity: it.quantity || 1,
              unit: it.unit || "case",
              unitPrice: it.unitPrice || it.price / (it.quantity || 1),
              inStock: it.quantity || 1,
              minStock: 5,
              source: formReceiptNumber
                ? `Receipt #${formReceiptNumber}`
                : `Purchase (${formDate})`,
            });
          }
        }
      }

      setShowPurchaseModal(false);
    } catch (err) {
      console.error("Failed to save purchase:", err);
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // Save Shopping item
  const handleSubmitShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return;
    setIsSubmittingShopping(true);

    try {
      await onAddShoppingItem({
        name: shopName.trim(),
        quantity: Number(shopQuantity) || 1,
        unit: shopUnit.trim() || "case",
        category: shopCategory,
        storePreferred: shopStore.trim() || undefined,
        estimatedCost: shopEstCost ? Number(shopEstCost) : undefined,
        notes: shopNotes.trim() || undefined,
        linkedIngredientId: shopLinkedId || undefined,
        isChecked: false,
      });

      setShopName("");
      setShopQuantity(1);
      setShopUnit("case");
      setShopCategory(INDUSTRIAL_CATEGORIES[0]);
      setShopStore("");
      setShopEstCost("");
      setShopNotes("");
      setShopLinkedId("");
      setShowShoppingItemModal(false);
    } catch (err) {
      console.error("Failed to add restock item:", err);
    } finally {
      setIsSubmittingShopping(false);
    }
  };

  // Add low-stock industrial item directly to restock list
  const handleQuickAddLowStock = async (prod: IndustrialProduct) => {
    try {
      const restockQty = Math.max(
        1,
        (prod.minStock || 5) * 2 - (prod.inStock || 0)
      );
      await onAddShoppingItem({
        name: prod.name,
        quantity: restockQty,
        unit: prod.unit || "case",
        category: prod.category || INDUSTRIAL_CATEGORIES[0],
        storePreferred: prod.vendor,
        estimatedCost: prod.price ? prod.price * restockQty : undefined,
        linkedIngredientId: prod.id,
        notes: `Low stock restock (On hand: ${prod.inStock ?? 0} ${prod.unit || ""})`,
        isChecked: false,
      });
    } catch (err) {
      console.error("Error adding restock item:", err);
    }
  };

  // Copy plain text shopping list to clipboard
  const handleCopyShoppingList = () => {
    const pending = shoppingList.filter((s) => !s.isChecked);
    if (pending.length === 0) return;

    let text = `INDUSTRIAL PRODUCTS RESTOCK LIST - ${new Date().toLocaleDateString()}\n`;
    text += `=====================================\n`;
    pending.forEach((item, idx) => {
      text += `${idx + 1}. [ ] ${item.name} - ${item.quantity} ${item.unit}`;
      if (item.storePreferred) text += ` (@ ${item.storePreferred})`;
      if (item.notes) text += ` (${item.notes})`;
      text += `\n`;
    });
    text += `=====================================\n`;
    text += `Total items: ${pending.length}\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    });
  };

  return (
    <div className="space-y-6" id="industrial-products-view-root">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                Industrial Products & Operational Supplies
              </h2>
              <p className="text-xs text-neutral-500">
                Track non-food operational inventory, packaging, disposables, cleaning chemicals, unit pricing, stock counts, and supplier purchase history.
              </p>
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowShoppingItemModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Add Restock Item</span>
            </button>
            <button
              onClick={handleOpenNewPurchase}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              id="btn-log-industrial-purchase"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
              <span>Log Purchase Receipt</span>
            </button>
            <button
              onClick={handleOpenNewProduct}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              id="btn-add-industrial-product"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Industrial Product</span>
            </button>
          </div>
        )}
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncStatus}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Catalog Items & Stock Value */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Industrial Catalog Items
            </p>
            <p className="text-2xl font-bold text-neutral-900 font-mono tabular-nums tracking-tight">
              {industrialProducts.length}
            </p>
            <p className="text-[11px] text-neutral-500 font-mono tabular-nums">
              Stock Value: $
              {kpis.catalogStockValuation.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Month Spend */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Monthly Industrial Spend
            </p>
            <p className="text-2xl font-bold text-neutral-900 font-mono tabular-nums tracking-tight">
              $
              {kpis.currentMonthSpend.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="text-[11px] text-neutral-500 font-mono tabular-nums">
              All-time: $
              {kpis.totalAllTimeSpend.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Restock Queue */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Pending Restock List
            </p>
            <p className="text-2xl font-bold text-neutral-900 font-mono tabular-nums tracking-tight">
              {kpis.pendingCount} items
            </p>
            <p className="text-[11px] text-neutral-500 font-mono tabular-nums">
              Est. Order: ${kpis.estimatedCartTotal.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <ListChecks className="w-5 h-5" />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Low Stock Alerts
            </p>
            <p className="text-2xl font-bold text-neutral-900 font-mono tabular-nums tracking-tight">
              {lowStockIndustrial.length} items
            </p>
            <p className="text-[11px] text-neutral-500">
              At or below minimum stock par
            </p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-neutral-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "catalog"
              ? "text-emerald-700 border-b-2 border-emerald-600"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          id="tab-industrial-catalog"
        >
          <Layers className="w-4 h-4" />
          <span>Product Catalog & Stock ({industrialProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("inventory")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "inventory"
              ? "text-emerald-700 border-b-2 border-emerald-600"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          id="tab-industrial-inventory"
        >
          <ClipboardList className="w-4 h-4" />
          <span>Inventory & Stocktake ({industrialProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("purchases")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "purchases"
              ? "text-emerald-700 border-b-2 border-emerald-600"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          id="tab-industrial-purchases"
        >
          <Receipt className="w-4 h-4" />
          <span>Purchase History & Invoices ({groceryPurchases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("shopping")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "shopping"
              ? "text-emerald-700 border-b-2 border-emerald-600"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          id="tab-industrial-shopping"
        >
          <ListChecks className="w-4 h-4" />
          <span>
            Restock Checklist ({shoppingList.filter((s) => !s.isChecked).length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab("insights")}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "insights"
              ? "text-emerald-700 border-b-2 border-emerald-600"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          id="tab-industrial-insights"
        >
          <TrendingUp className="w-4 h-4" />
          <span>Supplier & Category Insights</span>
        </button>
      </div>

      {/* TAB 1: INDUSTRIAL PRODUCT CATALOG & STOCK LEDGER */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 border border-neutral-200/80 rounded-2xl">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search product name, supplier, category..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={catalogCategoryFilter}
                onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-neutral-700 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Categories</option>
                {INDUSTRIAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={catalogVendorFilter}
                onChange={(e) => setCatalogVendorFilter(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-neutral-700 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Suppliers</option>
                {supplierOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Table */}
          {filteredCatalog.length === 0 ? (
            <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <Package className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-800">
                  No Industrial Products Recorded Yet
                </h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  {catalogSearch ||
                  catalogCategoryFilter !== "all" ||
                  catalogVendorFilter !== "all"
                    ? "No industrial products match your active filters."
                    : "Add packaging, paper goods, cleaning chemicals, or parse an invoice tagged as Industrial Products in AI Document Parser."}
                </p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={handleOpenNewProduct}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Industrial Product</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50/90 border-b border-neutral-200 text-neutral-500 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-3.5 px-4">Product Name</th>
                      <th className="py-3.5 px-3">Category</th>
                      <th className="py-3.5 px-3">Supplier / Vendor</th>
                      <th className="py-3.5 px-3">Base Unit & Pack Size</th>
                      <th className="py-3.5 px-3 text-right">Pack Price</th>
                      <th className="py-3.5 px-3 text-right">Rate per pc</th>
                      <th className="py-3.5 px-4 text-center">On-Hand Stock (pc)</th>
                      <th className="py-3.5 px-3">Source / Updated</th>
                      {!isReadOnly && (
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredCatalog.map((item) => {
                      const pcsRatio = Number(item.pcsPerPack || item.pcsPerPound || 0);
                      const rawQty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
                      const totalPcs = pcsRatio > 0 && rawQty < pcsRatio ? rawQty * pcsRatio : rawQty;
                      const packUnitLabel =
                        item.packagingUnit ||
                        (item.unit && item.unit.toLowerCase() !== "pc" ? item.unit : "Case");
                      const price = Number(item.price) || 0;
                      const ratePerPc =
                        totalPcs > 0
                          ? price / totalPcs
                          : pcsRatio > 0
                          ? price / pcsRatio
                          : Number(item.unitPrice) || price;
                      const stock = item.inStock ?? 0;
                      const minPar = item.minStock ?? (pcsRatio > 0 ? pcsRatio : 5);
                      const isLow = stock <= minPar;
                      const packSizeText =
                        item.registeredPackSize ||
                        (pcsRatio > 0 ? `${pcsRatio}pc per ${packUnitLabel.toLowerCase()}` : null);
                      const extraConvs = Array.isArray(item.conversions) ? item.conversions : [];

                      return (
                        <tr
                          key={item.id || item.name}
                          className="hover:bg-neutral-50/70 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-neutral-900">
                            <div className="flex flex-col">
                              <span>{item.name}</span>
                              {item.notes && (
                                <span className="text-[10px] font-normal text-neutral-400">
                                  {item.notes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px] font-semibold">
                              {item.category || "Other Industrial"}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium text-neutral-700">
                            {item.vendor || "—"}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col items-start gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[10px]">
                                  Base: pc
                                </span>
                                {packSizeText ? (
                                  <button
                                    type="button"
                                    onClick={() => !isReadOnly && handleOpenEditProduct(item)}
                                    className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Click to edit pack size"
                                  >
                                    <span>📦 {packSizeText}</span>
                                  </button>
                                ) : (
                                  !isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditProduct(item)}
                                      className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
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
                                      className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[10px]"
                                    >
                                      +{c.ratio}pc/{c.targetUnit}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-neutral-900">
                            <div>${price.toFixed(2)}</div>
                            <div className="text-[10px] font-normal text-neutral-400">
                              per {packUnitLabel} ({totalPcs} pc)
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            <span className="font-bold text-emerald-700">
                              ${ratePerPc < 0.1 ? ratePerPc.toFixed(4) : ratePerPc.toFixed(2)}
                            </span>
                            <span className="text-neutral-400 text-[10px]">/pc</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleAdjustStock(item, pcsRatio > 0 ? -pcsRatio : -1)}
                                  className="w-6 h-6 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                                  title={pcsRatio > 0 ? `Decrease stock by 1 ${packUnitLabel} (${pcsRatio} pc)` : "Decrease stock by 1 pc"}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              )}
                              <span
                                className={`px-2.5 py-1 rounded-lg font-mono tabular-nums font-bold text-xs ${
                                  isLow
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                {stock.toLocaleString()} pc
                              </span>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleAdjustStock(item, pcsRatio > 0 ? pcsRatio : 1)}
                                  className="w-6 h-6 rounded-lg border border-neutral-200 hover:bg-neutral-100 flex items-center justify-center text-neutral-600 cursor-pointer"
                                  title={pcsRatio > 0 ? `Increase stock by 1 ${packUnitLabel} (${pcsRatio} pc)` : "Increase stock by 1 pc"}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {pcsRatio > 1 && stock > 0 && (
                              <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                                ≈ {(stock / pcsRatio).toFixed(1)} {packUnitLabel}
                              </div>
                            )}
                            {isLow && (
                              <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                                Min par: {minPar.toLocaleString()} pc
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-neutral-500">
                            <div className="text-[11px] font-medium text-neutral-700 truncate max-w-[160px]">
                              {item.source || "Catalog"}
                            </div>
                            {item.updatedAt && (
                              <div className="text-[10px] font-mono text-neutral-400">
                                {item.updatedAt.slice(0, 10)}
                              </div>
                            )}
                          </td>
                          {!isReadOnly && (
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditProduct(item)}
                                  className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                                  title="Edit product & pack size"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    item.id &&
                                    onDeleteIndustrialProduct &&
                                    onDeleteIndustrialProduct(item.id)
                                  }
                                  className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete product"
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

      {/* TAB 1.5: INDUSTRIAL INVENTORY & STOCKTAKE */}
      {activeTab === "inventory" && (
        <IndustrialInventoryView
          industrialProducts={industrialProducts}
          vendors={vendors}
          onAddIndustrialProduct={onAddIndustrialProduct}
          onUpdateIndustrialProduct={onUpdateIndustrialProduct}
          onDeleteIndustrialProduct={onDeleteIndustrialProduct}
          isReadOnly={isReadOnly}
        />
      )}

      {/* TAB 2: PURCHASE HISTORY & INVOICES */}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          {/* Controls: Search, Supplier Filter, Month Filter */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 border border-neutral-200/80 rounded-2xl">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search supplier, item, invoice #, or notes..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={selectedStoreFilter}
                onChange={(e) => setSelectedStoreFilter(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-neutral-700 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Suppliers</option>
                {supplierOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="text-xs bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-neutral-700 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Months</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Purchases List */}
          {filteredPurchases.length === 0 ? (
            <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-800">
                  No Industrial Purchases Found
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {searchQuery ||
                  selectedStoreFilter !== "all" ||
                  selectedMonthFilter !== "all"
                    ? "Try adjusting your filters or search terms."
                    : "Invoices parsed as Industrial Products in AI Document Parser or manual receipts will appear here."}
                </p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={handleOpenNewPurchase}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Industrial Purchase</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPurchases.map((purchase) => {
                const isExpanded = expandedPurchaseId === purchase.id;
                const itemsCount = purchase.items?.length || 0;

                return (
                  <div
                    key={purchase.id}
                    className="bg-white border border-neutral-200/80 rounded-2xl shadow-xs overflow-hidden transition-all"
                  >
                    {/* Purchase Header Row */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors">
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-neutral-900">
                              {purchase.storeName}
                            </h4>
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-700 rounded-md">
                              {purchase.paymentMethod}
                            </span>
                            {purchase.receiptNumber && (
                              <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                                Ref #{purchase.receiptNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                              {purchase.date}
                            </span>
                            {purchase.purchaserName && (
                              <span>
                                • Recorded by:{" "}
                                <strong className="text-neutral-700">
                                  {purchase.purchaserName}
                                </strong>
                              </span>
                            )}
                            <span>
                              • {itemsCount}{" "}
                              {itemsCount === 1 ? "item" : "items"} logged
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold font-mono tabular-nums text-neutral-900">
                            $
                            {purchase.totalAmount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                          <p className="text-[10px] text-neutral-400 uppercase font-semibold">
                            Total Spent
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setExpandedPurchaseId(
                                isExpanded ? null : purchase.id || null
                              )
                            }
                            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                            title={
                              isExpanded
                                ? "Collapse item details"
                                : "Expand item details"
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>

                          {!isReadOnly && (
                            <>
                              <button
                                onClick={() => handleOpenEditPurchase(purchase)}
                                className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                                title="Edit purchase"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  purchase.id &&
                                  onDeleteGroceryPurchase(purchase.id)
                                }
                                className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Delete purchase"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Itemized Section */}
                    {isExpanded && (
                      <div className="border-t border-neutral-100 bg-neutral-50/50 p-4 sm:p-5 space-y-3">
                        {purchase.notes && (
                          <div className="text-xs text-neutral-600 bg-white p-3 rounded-xl border border-neutral-200">
                            <strong>Notes / Memo:</strong> {purchase.notes}
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-neutral-200 text-neutral-500 uppercase text-[10px] font-bold">
                                <th className="pb-2 font-semibold">
                                  Item Name
                                </th>
                                <th className="pb-2 font-semibold">Category</th>
                                <th className="pb-2 font-semibold">Quantity</th>
                                <th className="pb-2 font-semibold">
                                  Unit Price
                                </th>
                                <th className="pb-2 font-semibold">
                                  Total Price
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                              {purchase.items?.map((it) => (
                                <tr
                                  key={it.id}
                                  className="hover:bg-white/80 transition-colors"
                                >
                                  <td className="py-2.5 font-medium text-neutral-800">
                                    <span>{it.name}</span>
                                    {it.notes && (
                                      <p className="text-[10px] text-neutral-400">
                                        {it.notes}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-2.5 text-neutral-600">
                                    <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 text-[10px]">
                                      {it.category || "Industrial"}
                                    </span>
                                  </td>
                                  <td className="py-2.5 font-mono tabular-nums text-neutral-700">
                                    {it.quantity} {it.unit}
                                  </td>
                                  <td className="py-2.5 font-mono tabular-nums text-neutral-700">
                                    ${(it.unitPrice || 0).toFixed(2)} /{" "}
                                    {it.unit}
                                  </td>
                                  <td className="py-2.5 font-mono tabular-nums font-bold text-neutral-900">
                                    ${it.price.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESTOCK CHECKLIST */}
      {activeTab === "shopping" && (
        <div className="space-y-6">
          {/* Low Stock Auto-Suggestions Banner */}
          {lowStockIndustrial.length > 0 && (
            <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-purple-900">
                  <AlertCircle className="w-4 h-4 text-purple-600 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Recommended Restock from Industrial Catalog (
                    {lowStockIndustrial.length} Low-Stock Items)
                  </h4>
                </div>
                <span className="text-[11px] text-purple-700">
                  Items at or below minimum par level
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {lowStockIndustrial.slice(0, 6).map((prod) => {
                  const alreadyInList = shoppingList.some(
                    (s) =>
                      s.linkedIngredientId === prod.id ||
                      s.name.toLowerCase() === prod.name.toLowerCase()
                  );

                  return (
                    <div
                      key={prod.id}
                      className="bg-white border border-purple-100 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-neutral-800 truncate">
                          {prod.name}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono">
                          Stock: {prod.inStock ?? 0} / Par: {prod.minStock ?? 5}{" "}
                          {prod.unit}
                        </p>
                      </div>

                      {!isReadOnly && (
                        <button
                          onClick={() => handleQuickAddLowStock(prod)}
                          disabled={alreadyInList}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1 ${
                            alreadyInList
                              ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                              : "bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs"
                          }`}
                        >
                          {alreadyInList ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>+ Add</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Restock Checklist Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 border border-neutral-200/80 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-800">
                {shoppingList.filter((s) => s.isChecked).length} of{" "}
                {shoppingList.length} items checked
              </span>
              {shoppingList.some((s) => s.isChecked) && !isReadOnly && (
                <button
                  onClick={onClearCheckedShoppingItems}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium underline ml-2 cursor-pointer"
                >
                  Clear checked items
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCopyShoppingList}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                {copyFeedback ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>
                  {copyFeedback ? "Copied to Clipboard!" : "Copy List"}
                </span>
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print List</span>
              </button>

              {!isReadOnly && (
                <button
                  onClick={() => setShowShoppingItemModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              )}
            </div>
          </div>

          {/* Checklist Items */}
          {shoppingList.length === 0 ? (
            <div className="bg-white border border-dashed border-neutral-300 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400">
                <ListChecks className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-800">
                  Your Industrial Restock List is Empty
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Add operational supplies or low-stock industrial items to prepare your next supplier order.
                </p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => setShowShoppingItemModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Restock Item</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {shoppingList.map((item) => {
                const isChecked = !!item.isChecked;

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-all ${
                      isChecked
                        ? "border-neutral-200 bg-neutral-50/70 opacity-60"
                        : "border-neutral-200/90 shadow-2xs hover:border-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() =>
                          item.id && onToggleShoppingItem(item.id, !isChecked)
                        }
                        disabled={isReadOnly}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-neutral-300 hover:border-emerald-500 text-transparent"
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={`text-sm font-bold truncate ${
                              isChecked
                                ? "line-through text-neutral-400"
                                : "text-neutral-900"
                            }`}
                          >
                            {item.name}
                          </p>
                          {item.category && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-neutral-100 text-neutral-600 font-medium">
                              {item.category}
                            </span>
                          )}
                          {item.storePreferred && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                              {item.storePreferred}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap mt-0.5">
                          <span>
                            Qty:{" "}
                            <strong className="font-mono">
                              {item.quantity} {item.unit}
                            </strong>
                          </span>
                          {item.estimatedCost && (
                            <span>
                              • Est:{" "}
                              <strong className="font-mono">
                                ${item.estimatedCost.toFixed(2)}
                              </strong>
                            </span>
                          )}
                          {item.notes && <span>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={() =>
                          item.id && onDeleteShoppingItem(item.id)
                        }
                        className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SUPPLIER & CATEGORY INSIGHTS */}
      {activeTab === "insights" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Supplier */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-neutral-900">
                <Store className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold">
                  Industrial Spend by Supplier
                </h3>
              </div>

              {Object.keys(kpis.storeCounts).length === 0 ? (
                <p className="text-xs text-neutral-400 py-6 text-center">
                  No purchases recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {(
                    Object.entries(kpis.storeCounts) as [
                      string,
                      { count: number; spend: number }
                    ][]
                  )
                    .sort(([, a], [, b]) => b.spend - a.spend)
                    .map(([store, data]) => {
                      const pct =
                        kpis.totalAllTimeSpend > 0
                          ? (data.spend / kpis.totalAllTimeSpend) * 100
                          : 0;
                      return (
                        <div key={store} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-800">
                              {store}
                            </span>
                            <span className="font-bold font-mono tabular-nums text-neutral-900">
                              ${data.spend.toFixed(2)}{" "}
                              <span className="text-neutral-400 font-sans font-normal">
                                ({data.count} orders)
                              </span>
                            </span>
                          </div>
                          <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* By Category */}
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-neutral-900">
                <Tag className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold">
                  Spend by Industrial Category
                </h3>
              </div>

              {Object.keys(kpis.categorySpend).length === 0 ? (
                <p className="text-xs text-neutral-400 py-6 text-center">
                  No category data recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {(Object.entries(kpis.categorySpend) as [string, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, spend]) => {
                      const pct =
                        kpis.totalAllTimeSpend > 0
                          ? (spend / kpis.totalAllTimeSpend) * 100
                          : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-800">
                              {cat}
                            </span>
                            <span className="font-bold font-mono tabular-nums text-neutral-900">
                              ${spend.toFixed(2)}{" "}
                              <span className="text-neutral-400 font-sans font-normal">
                                ({pct.toFixed(1)}%)
                              </span>
                            </span>
                          </div>
                          <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT INDUSTRIAL PRODUCT (Base Unit: pc + Pack Sizes) */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-neutral-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {editingProduct
                      ? "Edit Industrial Product & Pack Sizes"
                      : "Add Industrial Product"}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Base unit is <strong>pc (Piece)</strong> — configure package sizes (e.g., 1000 pc per Case)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Nitrile Gloves Large, 32oz Takeout Containers..."
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Category
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    {INDUSTRIAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    value={prodVendor}
                    onChange={(e) => setProdVendor(e.target.value)}
                    placeholder="e.g. Uline, Sysco, Ecolab..."
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Base Unit (pc) & Pack Size Registration Section */}
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
                          const q = parseFloat(prodQuantity) || 1;
                          setProdInStock(String(r * q));
                        }
                      }}
                      placeholder="e.g. 1000"
                      className="w-28 bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <span className="bg-amber-100 text-amber-900 px-2.5 py-2 rounded-xl text-xs font-bold font-mono shrink-0">
                      pc per
                    </span>
                    <select
                      value={
                        INDUSTRIAL_PACKAGE_UNITS.some(
                          (u) => u.toLowerCase() === prodUnit.toLowerCase()
                        )
                          ? INDUSTRIAL_PACKAGE_UNITS.find(
                              (u) => u.toLowerCase() === prodUnit.toLowerCase()
                            )
                          : "Custom"
                      }
                      onChange={(e) => {
                        if (e.target.value !== "Custom") {
                          setProdUnit(e.target.value);
                        }
                      }}
                      className="bg-white border border-neutral-300 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                      value={prodUnit}
                      onChange={(e) => setProdUnit(e.target.value)}
                      placeholder="Case, Box..."
                      className="w-24 bg-white border border-neutral-300 rounded-xl px-2.5 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Additional Pack Sizes */}
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
                              (opt) => opt.toLowerCase() === (ep.targetUnit || "").toLowerCase()
                            )
                              ? INDUSTRIAL_PACKAGE_UNITS.find(
                                  (opt) => opt.toLowerCase() === (ep.targetUnit || "").toLowerCase()
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
                            setProdExtraPacks((prev) => prev.filter((_, i) => i !== epIdx))
                          }
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
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
                    setProdExtraPacks((prev) => [
                      ...prev,
                      { ratio: "", targetUnit: "Box" },
                    ])
                  }
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 pt-0.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another pack size</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Price per {prodUnit || "Pack"} ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Number of {prodUnit || "Pack"}s Purchased
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={prodQuantity}
                    onChange={(e) => {
                      const nextQ = e.target.value;
                      setProdQuantity(nextQ);
                      if (!editingProduct) {
                        const r = parseFloat(prodPcsPerPack) || 1;
                        const q = parseFloat(nextQ) || 1;
                        setProdInStock(String(r * q));
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Live Cost per Piece Preview */}
              {(() => {
                const p = parseFloat(prodPrice) || 0;
                const q = parseFloat(prodQuantity) || 1;
                const r = parseFloat(prodPcsPerPack) || 1;
                const totPcs = q * r;
                const perPc = totPcs > 0 ? p / totPcs : 0;
                return (
                  <div className="px-3.5 py-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-emerald-800 font-medium">
                      Total Base Quantity: <strong className="font-mono">{totPcs.toLocaleString()} pc</strong> ({q} × {r}pc/{(prodUnit || "case").toLowerCase()})
                    </span>
                    <span className="font-mono font-bold text-emerald-900">
                      ${perPc < 0.1 ? perPc.toFixed(4) : perPc.toFixed(2)} / pc
                    </span>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    On-Hand Stock (in pc)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={prodInStock}
                    onChange={(e) => setProdInStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Min Stock Alert Par (in pc)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={prodMinStock}
                    onChange={(e) => setProdMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700">
                  Notes / SKU (Optional)
                </label>
                <input
                  type="text"
                  value={prodNotes}
                  onChange={(e) => setProdNotes(e.target.value)}
                  placeholder="e.g. SKU #UL-4910, 1000 pcs per case"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingProduct
                    ? "Saving..."
                    : editingProduct
                    ? "Update Product & Pack Size"
                    : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT INDUSTRIAL PURCHASE */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-neutral-200 shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {editingPurchase
                      ? "Edit Industrial Purchase"
                      : "Log Industrial Purchase Receipt"}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Record supplier receipt, operational supplies, and cost details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitPurchase}
              className="p-5 sm:p-6 space-y-5"
            >
              {/* Supplier Quick Chips & Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700">
                  Supplier / Store Name *
                </label>
                <input
                  type="text"
                  required
                  value={formStoreName}
                  onChange={(e) => setFormStoreName(e.target.value)}
                  placeholder="e.g. Uline, Restaurant Depot, Ecolab, Costco..."
                  className="w-full px-3.5 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {COMMON_SUPPLIERS.slice(0, 6).map((store) => (
                    <button
                      type="button"
                      key={store}
                      onClick={() => setFormStoreName(store)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        formStoreName === store
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      {store}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date, Payment Method & Purchaser */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) =>
                      setFormPaymentMethod(e.target.value as any)
                    }
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Company Card">Company Card</option>
                    <option value="Petty Cash">Petty Cash</option>
                    <option value="Personal Reimbursement">
                      Personal Reimbursement
                    </option>
                    <option value="Debit / Cash">Debit / Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">
                    Recorded By / Staff
                  </label>
                  <input
                    type="text"
                    value={formPurchaserName}
                    onChange={(e) => setFormPurchaserName(e.target.value)}
                    placeholder="Staff or manager name"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Receipt Number & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">
                    Invoice / Receipt # (Optional)
                  </label>
                  <input
                    type="text"
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    placeholder="e.g. INV-20491"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">
                    Notes / Memo
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Monthly takeout packaging order"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Itemized Goods List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800">
                    Itemized Industrial Goods ({formItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Line Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {formItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          Item #{idx + 1}
                        </span>
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-neutral-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={(e) =>
                              handleItemChange(idx, "name", e.target.value)
                            }
                            placeholder="Product name (e.g. Nitrile Gloves, Sanitizer...)"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <select
                            value={item.category || INDUSTRIAL_CATEGORIES[0]}
                            onChange={(e) =>
                              handleItemChange(idx, "category", e.target.value)
                            }
                            className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                          >
                            {INDUSTRIAL_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-neutral-500 block mb-0.5">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(idx, "quantity", e.target.value)
                            }
                            className="w-full px-3 py-1 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-neutral-500 block mb-0.5">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) =>
                              handleItemChange(idx, "unit", e.target.value)
                            }
                            placeholder="case, box, pack..."
                            className="w-full px-3 py-1 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-neutral-500 block mb-0.5">
                            Total Line Price ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) =>
                              handleItemChange(idx, "price", e.target.value)
                            }
                            className="w-full px-3 py-1 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold font-mono text-neutral-800"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary & Auto-Sync Option */}
              <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoSyncCatalog}
                    onChange={(e) => setFormAutoSyncCatalog(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Sync items & quantities to Industrial Products Catalog
                  </span>
                </label>

                <div className="text-right">
                  <span className="text-xs text-neutral-400 uppercase font-semibold mr-2">
                    Calculated Total:
                  </span>
                  <span className="text-lg font-bold font-mono tabular-nums text-neutral-900">
                    $
                    {formItems
                      .reduce((acc, it) => acc + (Number(it.price) || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPurchase}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingPurchase
                    ? "Saving..."
                    : editingPurchase
                    ? "Update Purchase"
                    : "Save Purchase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD RESTOCK LIST ITEM */}
      {showShoppingItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full border border-neutral-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <ListChecks className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    Add to Industrial Restock List
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Queue operational supply item for your next order
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowShoppingItemModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitShoppingItem} className="p-5 space-y-4">
              {/* Quick Pick from Industrial Catalog */}
              {industrialProducts.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Quick Select from Industrial Catalog (Optional)
                  </label>
                  <select
                    value={shopLinkedId}
                    onChange={(e) => handleSelectShopProduct(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">
                      -- Choose existing product or type below --
                    </option>
                    {industrialProducts.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} ({prod.unit || "case"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Item Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Heavy Duty Foil Roll, Trash Liners..."
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={shopQuantity}
                    onChange={(e) => setShopQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={shopUnit}
                    onChange={(e) => setShopUnit(e.target.value)}
                    placeholder="case, box, pack..."
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Category & Preferred Supplier */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Category
                  </label>
                  <select
                    value={shopCategory}
                    onChange={(e) => setShopCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    {INDUSTRIAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Preferred Supplier
                  </label>
                  <input
                    type="text"
                    value={shopStore}
                    onChange={(e) => setShopStore(e.target.value)}
                    placeholder="e.g. Uline, Sysco..."
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Estimated Cost & Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Est. Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shopEstCost}
                    onChange={(e) => setShopEstCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">
                    Notes / Brand
                  </label>
                  <input
                    type="text"
                    value={shopNotes}
                    onChange={(e) => setShopNotes(e.target.value)}
                    placeholder="e.g. Powder-free"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowShoppingItemModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingShopping}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingShopping ? "Adding..." : "Add to Restock List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
