import React, { useState, useEffect, useRef, useMemo } from "react";
import { Ingredient, Recipe, RecipeIngredientRef } from "../../src/types";
import { Plus, Trash2, X, ChefHat, Info, Search, Sparkles, FileText, Loader2, Check, Download, Lock, ChevronDown, ChevronUp, FileJson, GripVertical, Tag, RotateCcw, Eye, EyeOff, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { getGramsOrMlEquivalent, convertFromGrams, isPcsUnit, calculateIngredientUnitPrice, getFormattedBaseUnitInfo , getBaseUnitLabel } from "../lib/unitConverter";

import AIAssistantModal from "./AIAssistantModal";
import AIRecipeModal from "./AIRecipeModal";

interface SearchableMatchSelectProps {
  value: string;
  onChange: (value: string) => void;
  ingredients: Ingredient[];
  subRecipes?: Recipe[];
  placeholder?: string;
}

function SearchableMatchSelect({
  value,
  onChange,
  ingredients,
  subRecipes = [],
  placeholder = "-- Skip / Omit ingredient --"
}: SearchableMatchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedIng = ingredients.find((ing) => ing.id === value);
  const selectedSub = subRecipes.find((r) => r.id === value);

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
  
  const filteredSubRecipes = subRecipes.filter((r) => {
    if (terms.length === 0) return true;
    return terms.some(
      (t) =>
        (r.name || "").toLowerCase().includes(t) ||
        (r.department || "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setQuery("");
        }}
        className={`w-full text-xs font-bold py-1.5 px-2 rounded-xl border text-left flex items-center justify-between gap-1 transition-all cursor-pointer ${
          value
            ? "text-emerald-950 bg-emerald-50 border-emerald-300 hover:bg-emerald-100/70"
            : "text-amber-950 bg-amber-50 border-amber-300 hover:bg-amber-100/70"
        }`}
      >
        <span className="truncate">
          {selectedIng ? (
            <span>
              {selectedIng.name}{" "}
              <span className="text-[10px] font-mono opacity-60">
                ({selectedIng.quantity} {selectedIng.unit})
              </span>
            </span>
          ) : selectedSub ? (
            <span>
              🍳 {selectedSub.name}{" "}
              <span className="text-[10px] font-mono opacity-60 text-amber-700">
                (Sub-Recipe)
              </span>
            </span>
          ) : (
            <span className="text-amber-900/60 italic text-[11px]">{placeholder}</span>
          )}
        </span>
        <span className="text-[9px] opacity-60 shrink-0">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 left-0 sm:right-auto w-full sm:w-[320px] md:w-[360px] mt-1 bg-white border border-neutral-200 shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[380px]">
            <div className="p-1.5 border-b border-neutral-200/20 bg-[#f0efeb] flex items-center gap-1.5 shrink-0">
              <Search className="h-3.5 w-3.5 text-neutral-500 shrink-0 ml-1" />
              <input
                type="text"
                placeholder="Search items or sub-recipes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-bold font-mono focus:outline-hidden"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              {query && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery("");
                  }}
                  className="text-neutral-500 hover:text-black font-bold text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 max-h-[320px] divide-y divide-neutral-100">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 text-xs font-bold transition-colors hover:bg-amber-100/50 ${
                  !value ? "bg-amber-50 text-amber-900 font-extrabold" : "text-neutral-500 italic"
                }`}
              >
                {placeholder}
              </button>

              {filteredSubRecipes.length > 0 && (
                <div className="bg-[#fcf8f2] px-2 py-1 text-[10px] font-bold text-amber-900 sticky top-0 border-b border-amber-200">
                  Sub-Recipes
                </div>
              )}
              {filteredSubRecipes.map((subR) => {
                const isSelected = subR.id === value;
                return (
                  <button
                    key={subR.id}
                    type="button"
                    onClick={() => {
                      onChange(subR.id!);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs font-bold transition-colors flex items-center justify-between ${
                      isSelected ? "bg-emerald-50 text-emerald-900" : "text-neutral-900 hover:bg-[#f0efeb]"
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">🍳 {subR.name}</span>
                      <span className="text-[9px] font-mono text-neutral-500 truncate">
                        {subR.department}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filtered.length > 0 && (
                <div className="bg-[#f0efeb] px-2 py-1 text-[10px] font-bold text-neutral-600 sticky top-0 border-b border-neutral-200">
                  Master Inventory Items
                </div>
              )}
              {filtered.map((ing) => {
                const isSelected = ing.id === value;
                return (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() => {
                      onChange(ing.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs font-bold flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-emerald-700 text-white font-extrabold"
                        : "hover:bg-[#f0efeb] text-neutral-800"
                    }`}
                  >
                    <span className="truncate mr-2">
                      {ing.name}{" "}
                      <span
                        className={`text-[10px] font-mono ${
                          isSelected ? "text-emerald-100" : "text-neutral-500"
                        }`}
                      >
                        ({ing.quantity} {ing.unit})
                      </span>
                    </span>
                    {ing.source && (
                      <span
                        className={`text-[9px] font-mono border px-1 rounded-xs shrink-0 ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-800 text-emerald-100"
                            : "border-neutral-200 bg-[#f0efeb] text-neutral-600"
                        }`}
                      >
                        {ing.source}
                      </span>
                    )}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-3 text-center text-[10px] font-mono text-neutral-500 italic">
                  No matching item for &quot;{query}&quot;
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface RecipesViewProps {
  recipes: Recipe[];
  ingredients: Ingredient[];
  onAddRecipe: (rec: Omit<Recipe, "id" | "ownerId" | "updatedAt">) => Promise<void>;
  onEditRecipe: (id: string, rec: Partial<Recipe>) => Promise<void>;
  onDeleteRecipe: (id: string) => Promise<void>;
  onReorderRecipes?: (reorderedRecipes: Recipe[]) => Promise<void>;
  customDepts: string[];
  onAddDept: (name: string) => Promise<void>;
  onDeleteDept: (name: string) => Promise<void>;
  isReadOnly?: boolean;
}

export default function RecipesView({
  recipes,
  ingredients,
  onAddRecipe,
  onEditRecipe,
  onDeleteRecipe,
  onReorderRecipes,
  customDepts,
  onAddDept,
  onDeleteDept,
  isReadOnly = false,
}: RecipesViewProps) {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAIRecipeModal, setShowAIRecipeModal] = useState(false);
  const [showBulkCsvModal, setShowBulkCsvModal] = useState(false);

  // Recipe Builder Form State
  const [name, setName] = useState("");
  const [sellingPrice, setSellingPrice] = useState("15.00");
  const [expectedYield, setExpectedYield] = useState("1");
  const [recipeIngs, setRecipeIngs] = useState<RecipeIngredientRef[]>([]);

  // Selected ingredient to add to recipe state
  const [itemType, setItemType] = useState<"ingredient" | "recipe">("ingredient");
  const [selectedIngId, setSelectedIngId] = useState("");
  const [ingGrams, setIngGrams] = useState("");
  const [ingUnit, setIngUnit] = useState("g");
  const [ingSearchQuery, setIngSearchQuery] = useState("");
  const [ingDropdownOpen, setIngDropdownOpen] = useState(false);

  // Custom & Existing Unit Management State
  const [hideUnitSelector, setHideUnitSelector] = useState(false);
  const [hiddenRecipeUnits, setHiddenRecipeUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("culinary_recipe_hidden_units");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [customUnits, setCustomUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("culinary_custom_units");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showUnitPickerModal, setShowUnitPickerModal] = useState(false);
  const [unitPickerTab, setUnitPickerTab] = useState<"add" | "hide">("add");
  const [newCustomUnitInput, setNewCustomUnitInput] = useState("");
  const [unitSearchQuery, setUnitSearchQuery] = useState("");

  const toggleHideRecipeUnit = (unitName: string) => {
    const isHidden = hiddenRecipeUnits.some(hu => hu.toLowerCase() === unitName.toLowerCase());
    let next: string[];
    if (isHidden) {
      next = hiddenRecipeUnits.filter(hu => hu.toLowerCase() !== unitName.toLowerCase());
    } else {
      next = [...hiddenRecipeUnits, unitName];
    }
    setHiddenRecipeUnits(next);
    try {
      localStorage.setItem("culinary_recipe_hidden_units", JSON.stringify(next));
    } catch {}
  };

  const unhideAllRecipeUnits = () => {
    setHiddenRecipeUnits([]);
    try {
      localStorage.removeItem("culinary_recipe_hidden_units");
    } catch {}
  };

  const handleAddCustomUnit = (unitName: string) => {
    const trimmed = unitName.trim();
    if (!trimmed) return;
    if (!customUnits.some(u => u.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...customUnits, trimmed];
      setCustomUnits(updated);
      try {
        localStorage.setItem("culinary_custom_units", JSON.stringify(updated));
      } catch {}
    }
    setIngUnit(trimmed);
    setShowUnitPickerModal(false);
    setNewCustomUnitInput("");
  };

  const handleRemoveCustomUnit = (unitToRemove: string) => {
    const updated = customUnits.filter(u => u.toLowerCase() !== unitToRemove.toLowerCase());
    setCustomUnits(updated);
    try {
      localStorage.setItem("culinary_custom_units", JSON.stringify(updated));
    } catch {}
    if (ingUnit.toLowerCase() === unitToRemove.toLowerCase()) {
      const selected = getIngredientById(selectedIngId);
      setIngUnit(selected ? getBaseUnitLabel(selected) : "g");
    }
  };

  const handleRemoveActiveUnit = () => {
    if (customUnits.some(u => u.toLowerCase() === ingUnit.toLowerCase())) {
      handleRemoveCustomUnit(ingUnit);
    } else {
      const selected = getIngredientById(selectedIngId);
      const base = selected ? getBaseUnitLabel(selected) : "g";
      setIngUnit(base);
    }
  };

  // Selected sub-recipe to add state
  const [selectedSubRecipeId, setSelectedSubRecipeId] = useState("");
  const [subRecipePortions, setSubRecipePortions] = useState("1");
  const [subRecipeSearchQuery, setSubRecipeSearchQuery] = useState("");
  const [subRecipeDropdownOpen, setSubRecipeDropdownOpen] = useState(false);

  // Drag and drop state for table row reordering
  const [draggedBuilderIdx, setDraggedBuilderIdx] = useState<number | null>(null);
  const [dragOverBuilderIdx, setDragOverBuilderIdx] = useState<number | null>(null);
  const [draggedAiIdx, setDraggedAiIdx] = useState<number | null>(null);
  const [dragOverAiIdx, setDragOverAiIdx] = useState<number | null>(null);

  // Drag and drop state for Catalog Recipe Cards reordering
  const [draggedCatalogKey, setDraggedCatalogKey] = useState<string | null>(null);
  const [dragOverCatalogKey, setDragOverCatalogKey] = useState<string | null>(null);

  // Detailed view active state
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  // Recipe export dropdown state
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recipe Builder Department State
  const [department, setDepartment] = useState("Kitchen");
  const [newDeptInput, setNewDeptInput] = useState("");
  const [showAddDeptForm, setShowAddDeptForm] = useState(false);

  // Sync default department to the first registered department when available
  useEffect(() => {
    if (!editingId && customDepts.length > 0 && (!department || !customDepts.includes(department))) {
      setDepartment(customDepts[0]);
    }
  }, [customDepts, editingId, department]);

  // Catalog search and filter states
  const [recipeSearch, setRecipeSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("All");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<"all" | "sale" | "subrecipe">("all");
  const [sortBy, setSortBy] = useState<string>("custom");


  // AI Matcher Department Selection states
  const [aiTargetDept, setAiTargetDept] = useState<string>("AUTO");
  const [showAiDeptForm, setShowAiDeptForm] = useState(false);
  const [newAiDeptInput, setNewAiDeptInput] = useState("");

  // Audit Console Department Form state
  const [showAuditDeptForm, setShowAuditDeptForm] = useState(false);
  const [newAuditDeptInput, setNewAuditDeptInput] = useState("");

  const [aiRecipes, setAiRecipes] = useState<Array<{
    recipeName: string;
    expectedYield: number;
    sellingPrice: number;
    department: string;
    items: Array<{
      rawText: string;
      name: string;
      quantity: number;
      unit: string;
      grams: number;
      matchedIngredientId: string;
    }>;
  }>>([]);
  const [activeRecipeIndex, setActiveRecipeIndex] = useState<number>(0);

  // Helper: Find ingredient by ID (bringing latest information from consolidated ingredient tab)
  const getIngredientById = (id: string, name?: string) => {
    let baseIng = ingredients.find(ing => ing.id === id);
    if (!baseIng && name) {
      baseIng = ingredients.find(ing => (ing.name || "").trim().toLowerCase() === name.trim().toLowerCase());
    }
    if (!baseIng) return null;

    const nameKey = (baseIng.name || "").trim().toLowerCase();
    const sameNamedIngs = ingredients.filter(ing => (ing.name || "").trim().toLowerCase() === nameKey);
    if (sameNamedIngs.length === 0) return baseIng;

    return sameNamedIngs.reduce((latest, current) => {
      const tLatest = latest.updatedAt ? new Date(latest.updatedAt).getTime() : 0;
      const tCurrent = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
      return tCurrent > tLatest ? current : latest;
    }, sameNamedIngs[0]);
  };

  // Helper: Get unique ingredients based on latest updated entry (matching the Ingredient information tab)
  const getUniqueIngredients = () => {
    const groups: { [name: string]: Ingredient[] } = {};
    ingredients.forEach(ing => {
      const nameKey = (ing.name || "").trim().toLowerCase();
      if (!groups[nameKey]) {
        groups[nameKey] = [];
      }
      groups[nameKey].push(ing);
    });

    const list: Ingredient[] = [];
    Object.values(groups).forEach(items => {
      const sortedByDate = [...items].sort((a, b) => {
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tB - tA; // newest-first
      });
      if (sortedByDate.length > 0) {
        list.push(sortedByDate[0]);
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Helper: Trigger cost recalculation for an existing recipe on display based on latest master ingredient rates
  const getRecalculatedRecipeSummary = (rec: Recipe, visitedIds: string[] = []): {
    updatedIngredients: (RecipeIngredientRef & { currentRate: number; currentCost: number; isSubRecipe?: boolean })[];
    actualTotalCost: number;
    costPerServing: number;
    updatedMargin: number;
  } => {
    if (rec.id && visitedIds.includes(rec.id)) {
      return {
        updatedIngredients: [],
        actualTotalCost: 0,
        costPerServing: 0,
        updatedMargin: 0,
      };
    }
    const currentVisited = rec.id ? [...visitedIds, rec.id] : visitedIds;
    let actualTotalCost = 0;

    const updatedIngredients = rec.ingredients.map((item) => {
      if (item.isSubRecipe || item.subRecipeId) {
        const subRec = recipes.find((r) => r.id === (item.subRecipeId || item.ingredientId));
        if (subRec) {
          const subSummary = getRecalculatedRecipeSummary(subRec, currentVisited);
          const subCostPerPortion = subSummary.costPerServing;
          const portionQty = item.grams || 1;
          const itemCost = portionQty * subCostPerPortion;
          actualTotalCost += itemCost;
          return {
            ...item,
            isSubRecipe: true,
            currentRate: subCostPerPortion,
            currentCost: itemCost,
            name: subRec.name,
          };
        } else {
          return {
            ...item,
            isSubRecipe: true,
            currentRate: 0,
            currentCost: 0,
            name: item.name,
          };
        }
      } else {
        const ing = getIngredientById(item.ingredientId, item.name);
        const currentRate = ing ? calculateIngredientUnitPrice(ing) : 0;
        const yieldPercent = ing ? (ing.usabilityPercentage !== undefined ? ing.usabilityPercentage : 100) : 100;
        const effectiveRate = ing ? (yieldPercent > 0 ? (currentRate / (yieldPercent / 100)) : currentRate) : 0;
        const ingCost = item.grams * effectiveRate;
        actualTotalCost += ingCost;
        return {
          ...item,
          isSubRecipe: false,
          currentRate,
          currentCost: ingCost,
        };
      }
    });

    const costPerServing = actualTotalCost / (rec.expectedYield || 1);
    const updatedMargin = rec.sellingPrice > 0 ? ((rec.sellingPrice - costPerServing) / rec.sellingPrice) * 100 : 0;

    return {
      updatedIngredients,
      actualTotalCost,
      costPerServing,
      updatedMargin
    };
  };

  // Helper: Dynamic calculations for a draft recipe
  const calculateDraftTotals = () => {
    let totalCost = 0;
    recipeIngs.forEach((item) => {
      if (item.isSubRecipe || item.subRecipeId) {
        const subRec = recipes.find((r) => r.id === (item.subRecipeId || item.ingredientId));
        if (subRec) {
          const subRecSummary = getRecalculatedRecipeSummary(subRec);
          totalCost += item.grams * subRecSummary.costPerServing;
        }
      } else {
        const ing = getIngredientById(item.ingredientId, item.name);
        if (ing) {
          const yieldPercent = ing.usabilityPercentage !== undefined ? ing.usabilityPercentage : 100;
          const baseRate = calculateIngredientUnitPrice(ing);
          const effectiveRate = yieldPercent > 0 ? (baseRate / (yieldPercent / 100)) : baseRate;
          totalCost += item.grams * effectiveRate;
        }
      }
    });

    const yieldNum = parseFloat(expectedYield) || 1;
    const costPerPortion = totalCost / yieldNum;
    const menuPrice = parseFloat(sellingPrice) || 0;
    const profitMargin = menuPrice > 0 ? ((menuPrice - costPerPortion) / menuPrice) * 100 : 0;

    return {
      totalCost,
      costPerPortion,
      profitMargin,
    };
  };

  // Helper: Get color theme based on profit margin
  const getMarginBadgeClass = (margin: number) => {
    if (margin >= 70) return "bg-emerald-100 text-emerald-900 border-emerald-450";
    if (margin >= 50) return "bg-orange-50 text-orange-905 border-orange-400";
    return "bg-red-50 text-red-955 border-red-400";
  };

  const getMarginTextClass = (margin: number) => {
    if (margin >= 70) return "text-emerald-700";
    if (margin >= 50) return "text-orange-700";
    return "text-red-700 font-bold";
  };

  // Compute all existing units across the workspace catalog
  const allExistingUnits = useMemo(() => {
    const unitMap = new Map<string, { unit: string; count: number; origin: string }>();
    
    ingredients.forEach(ing => {
      const addUnit = (u?: string, orig?: string) => {
        if (!u || !u.trim()) return;
        const key = u.trim();
        const existing = unitMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          unitMap.set(key, { unit: key, count: 1, origin: orig || ing.name });
        }
      };
      addUnit(ing.unit, `Ingredient: ${ing.name}`);
      if (ing.packagingUnit) addUnit(ing.packagingUnit, `Packaging: ${ing.name}`);
      if (ing.weightPerCaseUnit) addUnit(ing.weightPerCaseUnit, `Weight: ${ing.name}`);
      if (ing.conversions && Array.isArray(ing.conversions)) {
        ing.conversions.forEach(c => {
          if (c.targetUnit) addUnit(c.targetUnit, `Conversion: ${ing.name}`);
        });
      }
    });

    // Add standard units
    const standardUnits = ["g", "oz", "lb", "lbs", "kg", "ml", "fl oz", "L", "gal", "pcs", "pack", "box", "case", "bag", "can", "bottle", "jar", "bunch", "head", "cup", "tbsp", "tsp", "pt", "qt"];
    standardUnits.forEach(u => {
      if (!unitMap.has(u)) {
        unitMap.set(u, { unit: u, count: 0, origin: "Standard Culinary Unit" });
      }
    });

    // Add custom units
    customUnits.forEach(u => {
      if (!unitMap.has(u)) {
        unitMap.set(u, { unit: u, count: 0, origin: "Custom Added Unit" });
      }
    });

    return Array.from(unitMap.values());
  }, [ingredients, customUnits]);

  // Compute existing units for the currently selected ingredient
  const currentSelectedIng = getIngredientById(selectedIngId);
  const ingredientExistingUnits = useMemo(() => {
    if (!currentSelectedIng) return [];
    const list: { label: string; value: string; type: string }[] = [];
    const baseUnit = getBaseUnitLabel(currentSelectedIng);
    list.push({ label: `Base (${baseUnit})`, value: baseUnit, type: "Base Unit" });

    if (currentSelectedIng.unit && currentSelectedIng.unit.toLowerCase() !== baseUnit.toLowerCase()) {
      list.push({ label: `Purchase (${currentSelectedIng.unit})`, value: currentSelectedIng.unit, type: "Purchase Unit" });
    }
    if (currentSelectedIng.packagingUnit && currentSelectedIng.packagingUnit.toLowerCase() !== currentSelectedIng.unit?.toLowerCase() && currentSelectedIng.packagingUnit.toLowerCase() !== baseUnit.toLowerCase()) {
      list.push({ label: `Pkg (${currentSelectedIng.packagingUnit})`, value: currentSelectedIng.packagingUnit, type: "Packaging Unit" });
    }
    if (currentSelectedIng.conversions && Array.isArray(currentSelectedIng.conversions)) {
      currentSelectedIng.conversions.forEach(c => {
        if (c.targetUnit && !list.some(item => item.value.toLowerCase() === c.targetUnit.toLowerCase())) {
          list.push({ label: `Conv (${c.targetUnit})`, value: c.targetUnit, type: "Secondary Packaging" });
        }
      });
    }
    return list;
  }, [currentSelectedIng]);

  // Trigger: Add raw item usage to list
  const handleAddIngredientUsage = () => {
    if (!selectedIngId || !ingGrams) return;
    const qty = parseFloat(ingGrams);
    if (isNaN(qty) || qty <= 0) return;

    const ing = getIngredientById(selectedIngId);
    if (!ing) return;

    const isPcs = isPcsUnit(ing.unit);
    const chosenUnit = isPcs ? "pcs" : ingUnit;

    // Convert the entered amount in selected unit to base grams/ml equivalent for accurate normalized math
    let baseGrams = getGramsOrMlEquivalent(qty, chosenUnit);
    
    // Check if chosenUnit matches packaging unit or conversions
    if (ing.packagingUnit && chosenUnit.toLowerCase() === ing.packagingUnit.toLowerCase()) {
      if (ing.weightPerCase && ing.weightPerCase > 0) {
        const caseGrams = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
        baseGrams = qty * caseGrams;
      } else if (ing.pcsPerPound && ing.pcsPerPound > 0) {
        baseGrams = qty * ing.pcsPerPound;
      }
    } else if (ing.conversions && ing.conversions.length > 0) {
      const conv = ing.conversions.find(c => c.targetUnit && c.targetUnit.toLowerCase() === chosenUnit.toLowerCase());
      if (conv && conv.ratio > 0) {
        const singleUnitGrams = getGramsOrMlEquivalent(1, ing.unit || "g");
        baseGrams = qty * conv.ratio * singleUnitGrams;
      }
    }

    // Check if ingredient already in list
    const existingIdx = recipeIngs.findIndex(item => item.ingredientId === selectedIngId);
    if (existingIdx !== -1) {
      // Append weight
      setRecipeIngs(prev => {
        const updated = [...prev];
        updated[existingIdx].grams += baseGrams;
        return updated;
      });
    } else {
      setRecipeIngs(prev => [
        ...prev,
        {
          ingredientId: selectedIngId,
          name: ing.name,
          grams: baseGrams,
        }
      ]);
    }

    setIngGrams("");
  };

  // Trigger: Add sub-recipe usage to list
  const handleAddSubRecipeUsage = () => {
    if (!selectedSubRecipeId || !subRecipePortions) return;
    const qty = parseFloat(subRecipePortions);
    if (isNaN(qty) || qty <= 0) return;

    const subRec = recipes.find(r => r.id === selectedSubRecipeId);
    if (!subRec) return;

    const existingIdx = recipeIngs.findIndex(
      item => item.isSubRecipe && (item.subRecipeId === selectedSubRecipeId || item.ingredientId === selectedSubRecipeId)
    );

    if (existingIdx !== -1) {
      setRecipeIngs(prev => {
        const updated = [...prev];
        updated[existingIdx].grams += qty;
        return updated;
      });
    } else {
      setRecipeIngs(prev => [
        ...prev,
        {
          ingredientId: selectedSubRecipeId,
          subRecipeId: selectedSubRecipeId,
          isSubRecipe: true,
          name: subRec.name,
          grams: qty,
        }
      ]);
    }

    setSubRecipePortions("1");
  };

  // Trigger: Remove ingredient reference from builder by index
  const handleRemoveIngredientUsage = (indexToRemove: number) => {
    setRecipeIngs(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Drag & drop reordering for Recipe Builder table
  const handleBuilderDragStart = (e: React.DragEvent, index: number) => {
    setDraggedBuilderIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleBuilderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverBuilderIdx !== index) {
      setDragOverBuilderIdx(index);
    }
  };

  const handleBuilderDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedBuilderIdx === null || draggedBuilderIdx === dropIndex) {
      setDraggedBuilderIdx(null);
      setDragOverBuilderIdx(null);
      return;
    }
    setRecipeIngs(prev => {
      const updated = [...prev];
      const [draggedItem] = updated.splice(draggedBuilderIdx, 1);
      updated.splice(dropIndex, 0, draggedItem);
      return updated;
    });
    setDraggedBuilderIdx(null);
    setDragOverBuilderIdx(null);
  };

  // Drag & drop reordering for AI Reviewer table
  const handleAiDragStart = (e: React.DragEvent, index: number) => {
    setDraggedAiIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleAiDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverAiIdx !== index) {
      setDragOverAiIdx(index);
    }
  };

  const handleAiDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedAiIdx === null || draggedAiIdx === dropIndex) {
      setDraggedAiIdx(null);
      setDragOverAiIdx(null);
      return;
    }
    setAiRecipes(prev => {
      if (!prev[activeRecipeIndex]) return prev;
      const copy = [...prev];
      const items = [...copy[activeRecipeIndex].items];
      const [draggedItem] = items.splice(draggedAiIdx, 1);
      items.splice(dropIndex, 0, draggedItem);
      copy[activeRecipeIndex] = { ...copy[activeRecipeIndex], items };
      return copy;
    });
    setDraggedAiIdx(null);
    setDragOverAiIdx(null);
  };

  // Drag & drop reordering for Catalog Recipe Cards
  const handleCatalogDragStart = (e: React.DragEvent, key: string) => {
    setDraggedCatalogKey(key);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCatalogDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCatalogKey !== key) {
      setDragOverCatalogKey(key);
    }
  };

  const handleCatalogDrop = (e: React.DragEvent, dropKey: string) => {
    e.preventDefault();
    if (!draggedCatalogKey || draggedCatalogKey === dropKey) {
      setDraggedCatalogKey(null);
      setDragOverCatalogKey(null);
      return;
    }

    const dragIdx = recipes.findIndex((r, i) => (r.id ? r.id === draggedCatalogKey : `${i}` === draggedCatalogKey));
    const dropIdx = recipes.findIndex((r, i) => (r.id ? r.id === dropKey : `${i}` === dropKey));

    if (dragIdx !== -1 && dropIdx !== -1) {
      const updated = [...recipes];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(dropIdx, 0, moved);
      if (onReorderRecipes) {
        onReorderRecipes(updated);
      }
      setSortBy("custom");
    }

    setDraggedCatalogKey(null);
    setDragOverCatalogKey(null);
  };

  // Trigger: Submit complete recipe save
  const handleRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || recipeIngs.length === 0) return;

    const { totalCost, costPerPortion, profitMargin } = calculateDraftTotals();
    const yieldNum = parseFloat(expectedYield) || 1;
    const menuPrice = parseFloat(sellingPrice) || 0;

    const itemPayload = {
      name,
      ingredients: recipeIngs,
      sellingPrice: menuPrice,
      expectedYield: yieldNum,
      costPerPortion,
      totalCost,
      profitMargin,
      department,
    };

    if (editingId) {
      await onEditRecipe(editingId, itemPayload);
    } else {
      await onAddRecipe(itemPayload);
    }

    // Reset Form
    setName("");
    setSellingPrice("15.00");
    setExpectedYield("1");
    setRecipeIngs([]);
    setDepartment("Kitchen");
    setEditingId(null);
    setShowBuilder(false);
    setIngSearchQuery("");
    setIngDropdownOpen(false);
  };

  const startEditMode = (recipe: Recipe) => {
    if (!recipe.id) return;
    setEditingId(recipe.id);
    setName(recipe.name);
    setSellingPrice(recipe.sellingPrice != null ? recipe.sellingPrice.toString() : "0");
    setExpectedYield(recipe.expectedYield != null ? recipe.expectedYield.toString() : "1");
    setRecipeIngs(recipe.ingredients);
    setDepartment(recipe.department || "Kitchen");
    setShowBuilder(true);
    
    // Smooth scroll up considering iframe/overflow-y container structures
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector('main')?.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      document.getElementById("recipe-builder-area")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    setTimeout(() => {
      const inputEl = document.getElementById("recipe-name-input");
      if (inputEl) {
        inputEl.focus();
        (inputEl as HTMLInputElement).select();
      }
    }, 200);
  };

  const exportRecipesToCSV = (filteredRecs: Recipe[]) => {
    const headers = [
      "Recipe Name",
      "Department",
      "Expected Yield (Portions)",
      "Selling Price ($)",
      "Total Recipe Cost ($)",
      "Cost Per Portion ($)",
      "Profit Margin (%)",
      "Ingredient/Item Name",
      "Required Qty",
      "Unit",
      "Yield/Usability (%)",
      "Raw Unit Cost ($/Unit)",
      "Effective Unit Cost ($/Unit)",
      "Ingredient Cost Contribution ($)"
    ];

    const rows: any[][] = [];

    filteredRecs.forEach(rec => {
      const { updatedIngredients, actualTotalCost, costPerServing, updatedMargin } = getRecalculatedRecipeSummary(rec);
      
      if (updatedIngredients.length === 0) {
        rows.push([
          rec.name,
          rec.department || "Kitchen",
          rec.expectedYield,
          rec.sellingPrice.toFixed(2),
          actualTotalCost.toFixed(2),
          costPerServing.toFixed(2),
          updatedMargin.toFixed(1) + "%",
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ]);
      } else {
        updatedIngredients.forEach(item => {
          let itemName = item.name;
          let unitLabel = "g";
          let rawCostRate = 0;
          let effectiveCostRate = 0;
          let yieldPercent = 100;

          if (item.isSubRecipe || item.subRecipeId) {
            itemName = item.name || `Sub-Recipe`;
            unitLabel = "portions";
            rawCostRate = item.currentRate || 0;
            effectiveCostRate = item.currentRate || 0;
            yieldPercent = 100;
          } else {
            const ing = getIngredientById(item.ingredientId, item.name);
            itemName = ing ? ing.name : item.name;
            unitLabel = getBaseUnitLabel(ing);
            rawCostRate = ing ? calculateIngredientUnitPrice(ing) : 0;
            yieldPercent = ing ? (ing.usabilityPercentage !== undefined ? ing.usabilityPercentage : 100) : 100;
            effectiveCostRate = yieldPercent > 0 ? (rawCostRate / (yieldPercent / 100)) : rawCostRate;
          }
          
          rows.push([
            rec.name,
            rec.department || "Kitchen",
            rec.expectedYield,
            rec.sellingPrice.toFixed(2),
            actualTotalCost.toFixed(2),
            costPerServing.toFixed(2),
            updatedMargin.toFixed(1) + "%",
            itemName,
            item.grams.toFixed(2),
            unitLabel,
            yieldPercent.toFixed(1) + "%",
            rawCostRate.toFixed(5),
            effectiveCostRate.toFixed(5),
            item.currentCost.toFixed(2)
          ]);
        });
      }
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `recipe_cost_sheets_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRecipesToJSON = (filteredRecs: Recipe[]) => {
    const dataToExport = filteredRecs.map(rec => {
      const { updatedIngredients, actualTotalCost, costPerServing, updatedMargin } = getRecalculatedRecipeSummary(rec);
      return {
        id: rec.id,
        name: rec.name,
        department: rec.department || "Kitchen",
        expectedYieldPortions: rec.expectedYield,
        sellingPrice: rec.sellingPrice,
        totalRecipeCost: Number(actualTotalCost.toFixed(2)),
        costPerPortion: Number(costPerServing.toFixed(2)),
        profitMarginPercent: Number(updatedMargin.toFixed(1)),
        ingredients: updatedIngredients.map(item => {
          let itemName = item.name;
          let unitLabel = "g";
          let rawCostRate = 0;
          let effectiveCostRate = 0;
          let yieldPercent = 100;

          if (item.isSubRecipe || item.subRecipeId) {
            itemName = item.name || `Sub-Recipe`;
            unitLabel = "portions";
            rawCostRate = item.currentRate || 0;
            effectiveCostRate = item.currentRate || 0;
            yieldPercent = 100;
          } else {
            const ing = getIngredientById(item.ingredientId, item.name);
            itemName = ing ? ing.name : item.name;
            unitLabel = getBaseUnitLabel(ing);
            rawCostRate = ing ? calculateIngredientUnitPrice(ing) : 0;
            yieldPercent = ing ? (ing.usabilityPercentage !== undefined ? ing.usabilityPercentage : 100) : 100;
            effectiveCostRate = yieldPercent > 0 ? (rawCostRate / (yieldPercent / 100)) : rawCostRate;
          }

          return {
            ingredientId: item.ingredientId,
            name: itemName,
            isSubRecipe: !!(item.isSubRecipe || item.subRecipeId),
            requiredQty: Number(item.grams.toFixed(2)),
            unit: unitLabel,
            yieldPercentage: Number(yieldPercent.toFixed(1)),
            rawUnitCostRate: Number(rawCostRate.toFixed(5)),
            effectiveUnitCostRate: Number(effectiveCostRate.toFixed(5)),
            costContribution: Number(item.currentCost.toFixed(2))
          };
        })
      };
    });

    const jsonContent = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `recipe_cost_sheets_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // BULK CSV IMPORT STATE & HELPERS
  // ============================================================================
  interface BulkCsvRecipeItem {
    rawIngredientName: string;
    quantity: number;
    unit: string;
    matchedId: string; // Ingredient ID or Sub-Recipe ID
    isSubRecipe: boolean;
  }

  interface BulkCsvRecipeDraft {
    id: string;
    name: string;
    department: string;
    expectedYield: number;
    sellingPrice: number;
    items: BulkCsvRecipeItem[];
  }

  const [csvRawText, setCsvRawText] = useState("");
  const [bulkDrafts, setBulkDrafts] = useState<BulkCsvRecipeDraft[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<"update" | "create">("update");
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  const [bulkImportMessage, setBulkImportMessage] = useState<string | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);

  const matchIngredientOrSubRecipe = (rawName: string): { matchedId: string; isSubRecipe: boolean } => {
    const clean = (rawName || "").trim().toLowerCase();
    if (!clean) return { matchedId: "", isSubRecipe: false };

    // 1. Exact Sub-Recipe match
    const exactSub = recipes.find((r) => (r.name || "").trim().toLowerCase() === clean);
    if (exactSub && exactSub.id) {
      return { matchedId: exactSub.id, isSubRecipe: true };
    }

    // 2. Exact Master Ingredient match (newest first)
    const uniqueIngs = getUniqueIngredients();
    const exactIng = uniqueIngs.find(
      (ing) =>
        (ing.name || "").trim().toLowerCase() === clean ||
        (Array.isArray(ing.invoiceAliases) &&
          ing.invoiceAliases.some((a) => (a || "").trim().toLowerCase() === clean))
    );
    if (exactIng) {
      return { matchedId: exactIng.id, isSubRecipe: false };
    }

    // 3. Partial / Substring match on Master Ingredients
    const partialIng = uniqueIngs.find(
      (ing) =>
        (ing.name || "").trim().toLowerCase().includes(clean) ||
        clean.includes((ing.name || "").trim().toLowerCase())
    );
    if (partialIng) {
      return { matchedId: partialIng.id, isSubRecipe: false };
    }

    // 4. Partial Sub-Recipe match
    const partialSub = recipes.find(
      (r) =>
        (r.name || "").trim().toLowerCase().includes(clean) ||
        clean.includes((r.name || "").trim().toLowerCase())
    );
    if (partialSub && partialSub.id) {
      return { matchedId: partialSub.id, isSubRecipe: true };
    }

    return { matchedId: "", isSubRecipe: false };
  };

  const computeBaseGramsForIngredient = (
    qty: number,
    unitStr: string,
    matchedId: string,
    isSubRecipe: boolean
  ): number => {
    if (!qty || isNaN(qty) || qty <= 0) return 0;
    if (isSubRecipe) {
      return qty; // Sub-recipes are measured in portions
    }
    const ing = getIngredientById(matchedId);
    const cleanUnit = (unitStr || "g").trim();
    if (ing && isPcsUnit(ing.unit) && (isPcsUnit(cleanUnit) || cleanUnit.toLowerCase() === (ing.unit || "").toLowerCase())) {
      return qty;
    }
    let baseGrams = getGramsOrMlEquivalent(qty, cleanUnit);
    if (ing) {
      if (ing.packagingUnit && cleanUnit.toLowerCase() === ing.packagingUnit.toLowerCase()) {
        if (ing.weightPerCase && ing.weightPerCase > 0) {
          const caseGrams = getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb");
          baseGrams = qty * caseGrams;
        } else if (ing.pcsPerPound && ing.pcsPerPound > 0) {
          baseGrams = qty * ing.pcsPerPound;
        }
      } else if (ing.conversions && ing.conversions.length > 0) {
        const conv = ing.conversions.find(
          (c) => c.targetUnit && c.targetUnit.toLowerCase() === cleanUnit.toLowerCase()
        );
        if (conv && conv.ratio > 0) {
          const singleUnitGrams = getGramsOrMlEquivalent(1, ing.unit || "g");
          baseGrams = qty * conv.ratio * singleUnitGrams;
        }
      }
    }
    return baseGrams;
  };

  const generateSampleCsvString = (): string => {
    const uniqueIngs = getUniqueIngredients();
    const ing1 = uniqueIngs[0]?.name || "Chicken Breast";
    const ing2 = uniqueIngs[1]?.name || "Olive Oil";
    const ing3 = uniqueIngs[2]?.name || "Garlic";
    const ing4 = uniqueIngs[3]?.name || "Brioche Bun";
    const dept1 = customDepts[0] || "Kitchen";
    const dept2 = customDepts[1] || customDepts[0] || "Prep";

    const headers = [
      "Recipe Name",
      "Department",
      "Expected Yield (Portions)",
      "Selling Price ($)",
      "Ingredient Name",
      "Quantity",
      "Unit",
    ];

    const sampleRows = [
      ["Signature Chicken Sandwich", dept1, "1", "16.50", ing1, "180", "g"],
      ["Signature Chicken Sandwich", dept1, "1", "16.50", ing2, "15", "ml"],
      ["Signature Chicken Sandwich", dept1, "1", "16.50", ing4, "1", "pcs"],
      ["House Garlic Herb Sauce (Sub-Recipe)", dept2, "10", "0", ing2, "250", "ml"],
      ["House Garlic Herb Sauce (Sub-Recipe)", dept2, "10", "0", ing3, "60", "g"],
    ];

    return [
      headers.join(","),
      ...sampleRows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
  };

  const downloadSampleRecipeCSV = () => {
    const csvContent = generateSampleCsvString();
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "culinary_recipe_cost_sample_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCsvRow = (line: string, delimiter: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseBulkRecipeCSV = (rawText: string) => {
    setBulkImportMessage(null);
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setBulkDrafts([]);
      return;
    }

    // Detect delimiter (tab vs comma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
    const firstCols = parseCsvRow(firstLine, delimiter).map((c) => c.toLowerCase().trim());

    // Identify if first row is header
    const isHeader = firstCols.some((c) =>
      [
        "recipe",
        "recipe name",
        "dish",
        "menu",
        "레시피",
        "레시피명",
        "메뉴명",
        "ingredient",
        "ingredient name",
        "ingredient/item name",
        "재료",
        "재료명",
      ].some((kw) => c.includes(kw))
    );

    // Map column indices
    let colRecipe = 0;
    let colDept = 1;
    let colYield = 2;
    let colPrice = 3;
    let colIngName = 4;
    let colQty = 5;
    let colUnit = 6;

    if (isHeader) {
      firstCols.forEach((col, idx) => {
        if (col.includes("recipe") || col.includes("메뉴") || col.includes("레시피") || col === "dish" || col === "name") {
          if (!col.includes("ingredient") && !col.includes("cost")) colRecipe = idx;
        } else if (col.includes("dept") || col.includes("department") || col.includes("station") || col.includes("부서")) {
          colDept = idx;
        } else if ((col.includes("yield") || col.includes("portion") || col.includes("인분")) && !col.includes("cost") && !col.includes("usability") && !col.includes("%")) {
          colYield = idx;
        } else if (col.includes("selling") || col.includes("menu price") || col === "price" || col === "price ($)" || col.includes("판매가")) {
          colPrice = idx;
        } else if (col.includes("ingredient/item") || col.includes("ingredient name") || col === "ingredient" || col === "item name" || col.includes("재료")) {
          colIngName = idx;
        } else if (col.includes("required qty") || col === "qty" || col === "quantity" || col.includes("수량") || col.includes("amount")) {
          colQty = idx;
        } else if (col === "unit" || col.includes("단위")) {
          colUnit = idx;
        }
      });
    }

    const dataLines = isHeader ? lines.slice(1) : lines;
    const recipeMap = new Map<string, BulkCsvRecipeDraft>();

    let lastRecipeName = "";
    let lastDept = customDepts[0] || "Kitchen";
    let lastYield = 1;
    let lastPrice = 0;

    dataLines.forEach((line, idx) => {
      const cols = parseCsvRow(line, delimiter);
      if (cols.every((c) => !c)) return;

      const rawRecName = (cols[colRecipe] || "").trim() || lastRecipeName;
      if (!rawRecName) return;

      const rawDept = (cols[colDept] || "").trim() || (rawRecName === lastRecipeName ? lastDept : customDepts[0] || "Kitchen");
      const rawYieldStr = (cols[colYield] || "").replace(/[^0-9.]/g, "");
      const parsedYield = rawYieldStr ? parseFloat(rawYieldStr) : rawRecName === lastRecipeName ? lastYield : 1;
      const rawPriceStr = (cols[colPrice] || "").replace(/[^0-9.]/g, "");
      const parsedPrice = rawPriceStr !== "" ? parseFloat(rawPriceStr) : rawRecName === lastRecipeName ? lastPrice : 0;

      lastRecipeName = rawRecName;
      lastDept = rawDept;
      lastYield = parsedYield > 0 ? parsedYield : 1;
      lastPrice = !isNaN(parsedPrice) ? parsedPrice : 0;

      const key = rawRecName.toLowerCase();
      if (!recipeMap.has(key)) {
        recipeMap.set(key, {
          id: `bulk-${idx}-${Date.now()}`,
          name: rawRecName,
          department: lastDept,
          expectedYield: lastYield,
          sellingPrice: lastPrice,
          items: [],
        });
      }

      const rawIng = (cols[colIngName] || "").trim();
      const rawQtyStr = (cols[colQty] || "").replace(/[^0-9.]/g, "");
      const parsedQty = rawQtyStr ? parseFloat(rawQtyStr) : 0;
      const rawUnit = (cols[colUnit] || "g").trim() || "g";

      if (rawIng && parsedQty > 0) {
        const match = matchIngredientOrSubRecipe(rawIng);
        recipeMap.get(key)!.items.push({
          rawIngredientName: rawIng,
          quantity: parsedQty,
          unit: rawUnit,
          matchedId: match.matchedId,
          isSubRecipe: match.isSubRecipe,
        });
      }
    });

    setBulkDrafts(Array.from(recipeMap.values()));
  };

  const handleBulkCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = String(evt.target?.result || "");
      setCsvRawText(content);
      parseBulkRecipeCSV(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const calculateBulkDraftSummary = (draftRec: BulkCsvRecipeDraft) => {
    let totalCost = 0;
    draftRec.items.forEach((it) => {
      if (!it.matchedId) return;
      const baseGrams = computeBaseGramsForIngredient(it.quantity, it.unit, it.matchedId, it.isSubRecipe);
      if (it.isSubRecipe) {
        const subRec = recipes.find((r) => r.id === it.matchedId);
        if (subRec) {
          const subSummary = getRecalculatedRecipeSummary(subRec);
          totalCost += baseGrams * subSummary.costPerServing;
        }
      } else {
        const ing = getIngredientById(it.matchedId, it.rawIngredientName);
        if (ing) {
          const yieldPercent = ing.usabilityPercentage !== undefined ? ing.usabilityPercentage : 100;
          const baseRate = calculateIngredientUnitPrice(ing);
          const effectiveRate = yieldPercent > 0 ? baseRate / (yieldPercent / 100) : baseRate;
          totalCost += baseGrams * effectiveRate;
        }
      }
    });
    const yieldNum = draftRec.expectedYield > 0 ? draftRec.expectedYield : 1;
    const costPerPortion = totalCost / yieldNum;
    const profitMargin =
      draftRec.sellingPrice > 0
        ? ((draftRec.sellingPrice - costPerPortion) / draftRec.sellingPrice) * 100
        : 0;
    return { totalCost, costPerPortion, profitMargin };
  };

  const handleConfirmBulkRecipeImport = async () => {
    if (bulkDrafts.length === 0) return;
    setIsImportingBulk(true);
    setBulkImportMessage(null);
    let importedCount = 0;

    try {
      // Ensure any new departments are registered
      const existingDeptsLower = new Set(customDepts.map((d) => d.toLowerCase()));
      for (const draftRec of bulkDrafts) {
        const cleanDept = (draftRec.department || "Kitchen").trim();
        if (cleanDept && !existingDeptsLower.has(cleanDept.toLowerCase())) {
          existingDeptsLower.add(cleanDept.toLowerCase());
          await onAddDept(cleanDept);
        }
      }

      for (const draftRec of bulkDrafts) {
        if (!draftRec.name.trim()) continue;

        const recipeIngRefs: RecipeIngredientRef[] = [];
        draftRec.items.forEach((it) => {
          const baseGrams = computeBaseGramsForIngredient(
            it.quantity,
            it.unit,
            it.matchedId,
            it.isSubRecipe
          );
          if (it.isSubRecipe && it.matchedId) {
            const subRec = recipes.find((r) => r.id === it.matchedId);
            recipeIngRefs.push({
              ingredientId: it.matchedId,
              subRecipeId: it.matchedId,
              isSubRecipe: true,
              name: subRec?.name || it.rawIngredientName,
              grams: baseGrams,
            });
          } else {
            const ing = it.matchedId ? getIngredientById(it.matchedId, it.rawIngredientName) : null;
            recipeIngRefs.push({
              ingredientId: it.matchedId || `unmatched-${it.rawIngredientName.toLowerCase().replace(/\s+/g, "-")}`,
              name: ing?.name || it.rawIngredientName,
              grams: baseGrams,
            });
          }
        });

        const { totalCost, costPerPortion, profitMargin } = calculateBulkDraftSummary(draftRec);
        const payload = {
          name: draftRec.name.trim(),
          department: (draftRec.department || "Kitchen").trim(),
          expectedYield: draftRec.expectedYield > 0 ? draftRec.expectedYield : 1,
          sellingPrice: draftRec.sellingPrice >= 0 ? draftRec.sellingPrice : 0,
          ingredients: recipeIngRefs,
          totalCost,
          costPerPortion,
          profitMargin,
        };

        const existingRec = recipes.find(
          (r) => (r.name || "").trim().toLowerCase() === draftRec.name.trim().toLowerCase()
        );

        if (existingRec && existingRec.id && duplicateAction === "update") {
          await onEditRecipe(existingRec.id, payload);
        } else {
          await onAddRecipe(payload);
        }
        importedCount++;
      }

      setBulkImportMessage(`Successfully imported ${importedCount} culinary recipe cost sheet(s)!`);
      setTimeout(() => {
        setShowBulkCsvModal(false);
        setBulkDrafts([]);
        setCsvRawText("");
        setBulkImportMessage(null);
      }, 1200);
    } catch (err) {
      console.error("Failed to bulk import recipes:", err);
      setBulkImportMessage("An error occurred while importing recipes. Please check the format.");
    } finally {
      setIsImportingBulk(false);
    }
  };

  const draft = calculateDraftTotals();

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm font-sans" id="recipes-section">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3 border-b border-neutral-200 pb-4">
        <div className="text-left">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-1.5 ">
            Culinary Recipe Cost Sheets
            <span className="bg-[#f0efeb] text-neutral-900 text-[10px] px-2 py-0.5 border border-neutral-200 rounded-xl font-mono font-bold">
              {recipes.length} Sheets
            </span>
          </h2>
          <p className="text-neutral-900/60 font-serif italic text-xs mt-0.5">
            Construct recipes, track ingredient contributions, and analyze real-time portion margins.
          </p>
        </div>

        {!isReadOnly && !showBuilder && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowBulkCsvModal(true)}
              className="bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-emerald-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              id="open-bulk-csv-recipe-modal-btn"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Bulk Import CSV</span>
            </button>
            <button
              onClick={() => setShowAIRecipeModal(true)}
              className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-neutral-900 transition-all flex items-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs"
              id="open-ai-recipe-modal-btn"
            >
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span>AI Create Cost Sheet</span>
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setName("");
                setSellingPrice("12.50");
                setExpectedYield("1");
                setRecipeIngs([]);
                setDepartment(customDepts[0] || "Kitchen");
                setShowBuilder(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              id="open-recipe-builder-btn"
            >
              <Plus className="h-4 w-4" />
              <span>Create Cost Sheet</span>
            </button>
          </div>
        )}
      </div>

      {/* Recipe Builder Area */}
      {showBuilder && (
        <div className="bg-[#f0efeb] border border-neutral-200 rounded-xl p-6 mb-8 text-left" id="recipe-builder-area">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-neutral-900 flex items-center gap-2 text-xs font-sans">
                <ChefHat className="h-4.5 w-4.5 text-neutral-900" />
                {editingId ? "Modify Culinary Cost Sheet" : "Interactive Recipe Cost Sheet"}
              </h3>
              {!editingId && (
                <button
                  type="button"
                  onClick={() => setShowAIRecipeModal(true)}
                  className="bg-white hover:bg-emerald-50 text-emerald-800 hover:text-emerald-950 border border-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  <span>Auto-Fill with AI from Text</span>
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setShowBuilder(false);
                setIngSearchQuery("");
                setIngDropdownOpen(false);
              }}
              className="text-neutral-900/65 hover:text-black transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <form onSubmit={handleRecipeSubmit}>
            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Recipe Name *</label>
                <input
                  id="recipe-name-input"
                  type="text"
                  required
                  placeholder="e.g. Handmade Margherita Pizza, Chocolate Souffle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Portions / Expected Yield *</label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.1"
                  placeholder="e.g. 10 portions"
                  value={expectedYield}
                  onChange={(e) => setExpectedYield(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 gap-2">
                  <label className="block text-[10px] font-bold text-neutral-900/70 tracking-wide uppercase">
                    Selling Price &amp; Classification *
                  </label>
                </div>

                <div className="bg-[#f8f7f4] p-2.5 rounded-xl border border-neutral-200 space-y-2">
                  {/* Classification Switch */}
                  <div className="grid grid-cols-2 gap-1 bg-[#eae8e3] p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        if (parseFloat(sellingPrice || "-1") === 0) {
                          setSellingPrice("");
                        }
                      }}
                      className={`py-1.5 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        parseFloat(sellingPrice || "-1") !== 0
                          ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                          : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      <span>🍽️ Menu Item (For Sale)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSellingPrice("0")}
                      className={`py-1.5 px-2.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        parseFloat(sellingPrice || "-1") === 0
                          ? "bg-amber-600 text-white shadow-xs border border-amber-700 font-extrabold"
                          : "text-amber-900 hover:bg-amber-100/60"
                      }`}
                    >
                      <span>🥫 Sub-Recipe / Prep ($0)</span>
                    </button>
                  </div>

                  {parseFloat(sellingPrice || "-1") === 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-950 font-medium flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ChefHat className="h-4 w-4 text-amber-700 shrink-0" />
                        <span>Classified as <strong>Non-Sale Sub-Recipe Batch ($0.00)</strong>. Its cost per portion is calculated for parent dishes.</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md shrink-0">
                        Sub-Recipe
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-mono font-bold text-neutral-400">
                        $
                      </span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        placeholder="e.g. 24.00"
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-lg pl-7 pr-3 py-1.5 text-xs font-bold font-mono text-neutral-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Department / Station *</label>
                
                {showAddDeptForm ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="New department..."
                      value={newDeptInput}
                      onChange={(e) => setNewDeptInput(e.target.value)}
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-hidden"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const trimmed = newDeptInput.trim();
                        if (trimmed) {
                          await onAddDept(trimmed);
                          setDepartment(trimmed);
                          setNewDeptInput("");
                          setShowAddDeptForm(false);
                        }
                      }}
                      className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 border border-neutral-200 hover:bg-neutral-800 rounded-xl cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <select
                    value={department}
                    onChange={(e) => {
                      if (e.target.value === "ADD_NEW_DEPT") {
                        setShowAddDeptForm(true);
                      } else {
                        setDepartment(e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden cursor-pointer"
                  >
                    {customDepts.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                    <option value="ADD_NEW_DEPT">+ Add New Department...</option>
                  </select>
                )}
              </div>
            </div>

            {/* Ingredient & Sub-Recipe Component Adder Segment */}
            <div className="bg-white border border-neutral-200 rounded-xl p-5 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-neutral-200 mb-4 gap-2">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">Add Recipe Components</h4>
                  <p className="text-[10px] text-neutral-500 font-serif italic">Include raw ingredients or nested sub-recipes (e.g., sauces, doughs, sides).</p>
                </div>

                {/* Type Toggle Tabs */}
                <div className="flex bg-[#f0efeb] p-0.5 rounded-xl border border-neutral-200 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setItemType("ingredient")}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      itemType === "ingredient" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-600 hover:text-black"
                    }`}
                  >
                    <span>🥦 Raw Ingredient</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemType("recipe")}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      itemType === "recipe" ? "bg-amber-600 text-white shadow-xs" : "text-neutral-600 hover:text-black"
                    }`}
                  >
                    <ChefHat className="h-3 w-3" />
                    <span>🍳 Sub-Recipe / Nested Menu</span>
                  </button>
                </div>
              </div>

              {itemType === "ingredient" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2 text-left space-y-2 relative">
                    <label className="block text-[10px] font-bold text-neutral-900/60">Select Ingredient *</label>

                    {/* Custom Searchable combobox select dropdown */}
                    <div className="relative">
                      <button
                        id="custom-ingredient-select-trigger"
                        type="button"
                        onClick={() => setIngDropdownOpen(!ingDropdownOpen)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-bold text-left flex items-center justify-between focus:outline-hidden cursor-pointer min-h-[34px]"
                      >
                        <span className="truncate">
                          {selectedIngId ? (
                            <>
                              {ingredients.find(i => i.id === selectedIngId)?.name || ""}
                              <span className="text-neutral-900/50 font-normal font-mono text-[10px] ml-1.5">
                                (per {ingredients.find(i => i.id === selectedIngId)?.quantity} {ingredients.find(i => i.id === selectedIngId)?.unit})
                              </span>
                              {ingredients.find(i => i.id === selectedIngId)?.source && (
                                <span className="text-neutral-900/60 text-[9px] font-mono border border-neutral-200/20 px-1 ml-1.5 bg-[#f0efeb]">
                                  {ingredients.find(i => i.id === selectedIngId)?.source}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-neutral-900/50">-- Choose Master Inventory Item --</span>
                          )}
                        </span>
                        <span className="text-[10px] text-neutral-900/50 ml-2">
                          {ingDropdownOpen ? "▲" : "▼"}
                        </span>
                      </button>

                      {/* Outside click dismiss overlay */}
                      {ingDropdownOpen && (
                        <div 
                          className="fixed inset-0 z-40 cursor-default" 
                          onClick={() => setIngDropdownOpen(false)} 
                        />
                      )}

                      {/* Integrated Search Options Dropdown Box */}
                      {ingDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 min-w-full sm:min-w-[360px] bg-white border border-neutral-200 shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[420px]">
                          {/* Interactive Search Box Inside Dropdown */}
                          <div className="p-2 border-b border-neutral-200/15 bg-[#f0efeb] flex items-center gap-1.5 shrink-0">
                            <Search className="h-3.5 w-3.5 text-neutral-900/55 shrink-0" />
                            <input
                              type="text"
                              placeholder="Type keyword to filter ingredients..."
                              value={ingSearchQuery}
                              onChange={(e) => setIngSearchQuery(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold font-mono focus:outline-hidden"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            {ingSearchQuery && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIngSearchQuery("");
                                }}
                                className="text-neutral-900/50 hover:text-black cursor-pointer font-bold text-xs px-1"
                              >
                                ✕
                              </button>
                            )}
                            <AIAssistantModal 
                              context="Recipe Ingredient Search"
                              itemNames={Array.from(new Set(ingredients.map(i => i.name)))}
                              onSearchTerms={(terms) => setIngSearchQuery(terms.join(", "))}
                            />
                          </div>

                          {/* List Options */}
                          <div className="overflow-y-auto flex-1 max-h-[350px]">
                            {getUniqueIngredients()
                              .filter(ing => {
                                const terms = ingSearchQuery.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
                                if (terms.length === 0) return true;
                                return terms.some(t => (ing.name || "").toLowerCase().includes(t) || (ing.source || "").toLowerCase().includes(t));
                              })
                              .map((ing, idx) => (
                                <button
                                  key={`${ing.id}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedIngId(ing.id);
                                    const isPcs = isPcsUnit(ing.unit);
                                    setIngUnit(getBaseUnitLabel(ing));
                                    setIngDropdownOpen(false);
                                    setIngSearchQuery("");
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-neutral-200/5 last:border-0 hover:bg-[#f0efeb] flex items-center justify-between cursor-pointer ${
                                    selectedIngId === ing.id ? "bg-emerald-600 text-white hover:bg-black/90" : "text-neutral-900"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="truncate">{ing.name}</span>
                                    <span className={`text-[10px] font-mono ${selectedIngId === ing.id ? "text-white/70" : "text-neutral-900/50"}`}>
                                      ({ing.quantity} {ing.unit})
                                    </span>
                                  </div>
                                  {ing.source && (
                                    <span className={`text-[9px] font-mono border px-1 ${
                                      selectedIngId === ing.id 
                                        ? "border-white/30 bg-white/10 text-white" 
                                        : "border-neutral-200/15 bg-[#f0efeb] text-neutral-900/70"
                                    }`}>
                                      {ing.source}
                                    </span>
                                  )}
                                </button>
                              ))}
                            {getUniqueIngredients().filter(ing => {
                              const terms = ingSearchQuery.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
                              if (terms.length === 0) return true;
                              return terms.some(t => (ing.name || "").toLowerCase().includes(t) || (ing.source || "").toLowerCase().includes(t));
                            }).length === 0 && (
                              <div className="p-4 text-center text-[10px] font-mono text-red-650 bg-[#f0efeb]/40 italic">
                                No matching item for "{ingSearchQuery}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="block text-[10px] font-bold text-neutral-900/60">Weight / Qty Used *</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Quick existing units for current ingredient */}
                        {ingredientExistingUnits.filter(u => !hiddenRecipeUnits.some(hu => hu.toLowerCase() === u.value.toLowerCase())).length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-neutral-400">Available:</span>
                            {ingredientExistingUnits
                              .filter(u => !hiddenRecipeUnits.some(hu => hu.toLowerCase() === u.value.toLowerCase()))
                              .map((u) => (
                              <button
                                key={u.value}
                                type="button"
                                onClick={() => setIngUnit(u.value)}
                                className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                                  ingUnit.toLowerCase() === u.value.toLowerCase()
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100"
                                }`}
                                title={`${u.type}: ${u.value}`}
                              >
                                {u.value}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Add existing unit button */}
                        <button
                          type="button"
                          onClick={() => {
                            setUnitPickerTab("add");
                            setUnitSearchQuery("");
                            setShowUnitPickerModal(true);
                          }}
                          className="text-[9px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                          title="Add or pick from existing units in catalog"
                          id="add-existing-unit-btn"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          <span>Add existing unit</span>
                        </button>

                        {/* Hide / Show unit toggle button */}
                        <button
                          type="button"
                          onClick={() => {
                            setUnitPickerTab("hide");
                            setUnitSearchQuery("");
                            setShowUnitPickerModal(true);
                          }}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer border ${
                            hiddenRecipeUnits.length > 0
                              ? "text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300"
                              : "text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border-neutral-300"
                          }`}
                          title="Select which units to hide or show"
                          id="hide-unit-btn"
                        >
                          {hiddenRecipeUnits.length > 0 ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                          <span>
                            {hiddenRecipeUnits.length > 0
                              ? `Hide unit (${hiddenRecipeUnits.length} hidden)`
                              : "Hide unit"}
                          </span>
                        </button>

                        {/* Remove unit button */}
                        <button
                          type="button"
                          onClick={handleRemoveActiveUnit}
                          className="text-[9px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                          title="Remove active unit or reset to base unit"
                          id="remove-unit-btn"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                          <span>Remove unit</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 text-left">
                        <div className="flex border border-neutral-200 overflow-hidden bg-white rounded-xl shadow-xs">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            placeholder="e.g. 250"
                            value={ingGrams}
                            onChange={(e) => setIngGrams(e.target.value)}
                            className="w-full border-0 px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-hidden"
                          />
                          {!hideUnitSelector && (() => {
                            const selectedIng = getIngredientById(selectedIngId);
                            const isPcs = selectedIng ? isPcsUnit(selectedIng.unit) : false;
                            const currentUnitValue = isPcs ? "pcs" : ingUnit;
                            return (
                              <select
                                value={currentUnitValue}
                                disabled={isPcs}
                                onChange={(e) => setIngUnit(e.target.value)}
                                className={`bg-[#f0efeb] text-xs font-mono font-bold border-l border-neutral-200 px-2 focus:outline-hidden cursor-pointer ${
                                  isPcs ? "opacity-75 cursor-not-allowed" : ""
                                }`}
                              >
                                {isPcs ? (
                                  <option value="pcs">pcs</option>
                                ) : (
                                  <>
                                    {ingredientExistingUnits.length > 0 && (
                                      <optgroup label="Ingredient Specific">
                                        {ingredientExistingUnits.map((u) => (
                                          <option key={u.value} value={u.value}>
                                            {u.value} ({u.type})
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    <optgroup label="Standard Weight">
                                      <option value="g">g (Grams)</option>
                                      <option value="oz">oz (Ounces)</option>
                                      <option value="lb">lb (Pounds)</option>
                                      <option value="lbs">lbs (Pounds)</option>
                                      <option value="kg">kg (Kilograms)</option>
                                    </optgroup>
                                    <optgroup label="Standard Volume">
                                      <option value="ml">ml (Milliliters)</option>
                                      <option value="fl oz">fl oz (Fluid Ounces)</option>
                                      <option value="cup">cup (Cups)</option>
                                      <option value="tbsp">tbsp (Tablespoons)</option>
                                      <option value="tsp">tsp (Teaspoons)</option>
                                      <option value="pt">pt (Pints)</option>
                                      <option value="qt">qt (Quarts)</option>
                                      <option value="L">L (Liters)</option>
                                      <option value="gal">gal (Gallons)</option>
                                    </optgroup>
                                    <optgroup label="Packaging / Counts">
                                      <option value="pcs">pcs (Pieces)</option>
                                      <option value="pack">pack</option>
                                      <option value="box">box</option>
                                      <option value="case">case</option>
                                      <option value="bag">bag</option>
                                      <option value="can">can</option>
                                      <option value="bottle">bottle</option>
                                      <option value="jar">jar</option>
                                      <option value="bunch">bunch</option>
                                      <option value="head">head</option>
                                      <option value="unit">unit</option>
                                    </optgroup>
                                    {customUnits.length > 0 && (
                                      <optgroup label="Custom / Added Units">
                                        {customUnits.map((u) => (
                                          <option key={u} value={u}>
                                            {u}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                )}
                              </select>
                            );
                          })()}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!selectedIngId || !ingGrams}
                        onClick={handleAddIngredientUsage}
                        className="bg-emerald-600 hover:bg-neutral-800 text-white font-bold text-[10px] px-4 py-2.5 rounded-xl border border-neutral-200 h-9 transition-colors flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
                        id="add-usage-row-btn"
                      >
                        Add Row
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2 text-left space-y-2 relative">
                    <label className="block text-[10px] font-bold text-neutral-900/60">Select Sub-Recipe / Base Menu *</label>
                    <div className="relative">
                      <button
                        id="custom-subrecipe-select-trigger"
                        type="button"
                        onClick={() => setSubRecipeDropdownOpen(!subRecipeDropdownOpen)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs font-bold text-left flex items-center justify-between focus:outline-hidden cursor-pointer min-h-[34px]"
                      >
                        <span className="truncate">
                          {selectedSubRecipeId ? (
                            (() => {
                              const selectedSubR = recipes.find(r => r.id === selectedSubRecipeId);
                              if (!selectedSubR) return <span className="text-neutral-900/50">-- Choose Existing Recipe / Sub-Recipe --</span>;
                              const summary = getRecalculatedRecipeSummary(selectedSubR);
                              return (
                                <>
                                  🍳 {selectedSubR.name}
                                  <span className="text-amber-700 font-normal font-mono text-[10px] ml-1.5">
                                    (${summary.costPerServing.toFixed(2)} / portion)
                                  </span>
                                  {selectedSubR.department && (
                                    <span className="text-neutral-600 text-[9px] font-mono border border-neutral-200 px-1 ml-1.5 bg-[#f0efeb]">
                                      {selectedSubR.department}
                                    </span>
                                  )}
                                </>
                              );
                            })()
                          ) : (
                            <span className="text-neutral-900/50">-- Choose Existing Recipe / Sub-Recipe --</span>
                          )}
                        </span>
                        <span className="text-[10px] text-neutral-900/50 ml-2">
                          {subRecipeDropdownOpen ? "▲" : "▼"}
                        </span>
                      </button>

                      {/* Outside click dismiss overlay */}
                      {subRecipeDropdownOpen && (
                        <div 
                          className="fixed inset-0 z-40 cursor-default" 
                          onClick={() => setSubRecipeDropdownOpen(false)} 
                        />
                      )}

                      {/* Integrated Search Options Dropdown Box */}
                      {subRecipeDropdownOpen && (
                        <div className="absolute z-50 left-0 right-0 mt-1 min-w-full sm:min-w-[360px] bg-white border border-neutral-200 shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[420px]">
                          {/* Interactive Search Box Inside Dropdown */}
                          <div className="p-2 border-b border-neutral-200 bg-[#f0efeb] flex items-center gap-1.5 shrink-0">
                            <Search className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                            <input
                              type="text"
                              placeholder="Type keyword to filter recipes..."
                              value={subRecipeSearchQuery}
                              onChange={(e) => setSubRecipeSearchQuery(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold font-mono focus:outline-hidden"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                            {subRecipeSearchQuery && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubRecipeSearchQuery("");
                                }}
                                className="text-neutral-500 hover:text-black cursor-pointer font-bold text-xs px-1"
                              >
                                ✕
                              </button>
                            )}
                            <AIAssistantModal 
                              context="Sub-Recipe Search"
                              itemNames={recipes.filter(r => !editingId || r.id !== editingId).map(r => r.name)}
                              onSearchTerms={(terms) => setSubRecipeSearchQuery(terms.join(", "))}
                            />
                          </div>

                          {/* List Options */}
                          <div className="overflow-y-auto flex-1 max-h-[350px]">
                            {(() => {
                              const filteredSubRecipes = recipes
                                .filter(r => !editingId || r.id !== editingId)
                                .filter(subR => {
                                  const terms = subRecipeSearchQuery.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
                                  if (terms.length === 0) return true;
                                  return terms.some(t => 
                                    (subR.name || "").toLowerCase().includes(t) || 
                                    (subR.department || "").toLowerCase().includes(t)
                                  );
                                });

                              if (filteredSubRecipes.length === 0) {
                                return (
                                  <div className="p-4 text-center text-[10px] font-mono text-red-600 bg-[#f0efeb]/40 italic">
                                    No matching sub-recipes found for "{subRecipeSearchQuery}"
                                  </div>
                                );
                              }

                              return filteredSubRecipes.map((subR) => {
                                const summary = getRecalculatedRecipeSummary(subR);
                                const isSelected = selectedSubRecipeId === subR.id;
                                return (
                                  <button
                                    key={subR.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSubRecipeId(subR.id);
                                      setSubRecipeDropdownOpen(false);
                                      setSubRecipeSearchQuery("");
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs font-bold border-b border-neutral-100 last:border-0 hover:bg-amber-50 flex items-center justify-between cursor-pointer ${
                                      isSelected ? "bg-amber-600 text-white hover:bg-amber-700" : "text-neutral-900"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span>🍳</span>
                                      <span className="truncate">{subR.name}</span>
                                      <span className={`text-[10px] font-mono ${isSelected ? "text-amber-100" : "text-amber-700 font-semibold"}`}>
                                        (${summary.costPerServing.toFixed(2)}/portion)
                                      </span>
                                    </div>
                                    {subR.department && (
                                      <span className={`text-[9px] font-mono border px-1 ${
                                        isSelected 
                                          ? "border-amber-300 bg-amber-700 text-white" 
                                          : "border-neutral-200 bg-[#f0efeb] text-neutral-700"
                                      }`}>
                                        {subR.department}
                                      </span>
                                    )}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 text-left">
                      <label className="block text-[10px] font-bold text-neutral-900/60 mb-1">Portions Used *</label>
                      <div className="flex border border-neutral-200 rounded-xl overflow-hidden bg-white">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="e.g. 1"
                          value={subRecipePortions}
                          onChange={(e) => setSubRecipePortions(e.target.value)}
                          className="w-full border-0 px-2.5 py-1.5 text-xs font-bold font-mono focus:outline-hidden"
                        />
                        <span className="bg-[#f0efeb] text-xs font-mono font-bold border-l border-neutral-200 px-2 flex items-center text-neutral-700">
                          portion(s)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!selectedSubRecipeId || !subRecipePortions}
                      onClick={handleAddSubRecipeUsage}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-4 py-2.5 rounded-xl border border-neutral-200 h-9 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                      id="add-subrecipe-usage-btn"
                    >
                      Add Recipe
                    </button>
                  </div>
                </div>
              )}

              {/* Added items list in draft */}
              <div className="mt-5">
                {recipeIngs.length === 0 ? (
                  <p className="text-xs text-neutral-900/60 italic py-5 text-center bg-[#f0efeb] rounded-xl border border-dashed border-neutral-200 font-serif">
                    No ingredients or sub-recipes added to this sheet yet. Use the selector above to build the recipe.
                  </p>
                ) : (
                  <div className="border border-neutral-200 rounded-xl overflow-x-auto overflow-y-visible">
                    <table className="min-w-full divide-y divide-[#141414] text-xs text-neutral-900 bg-white text-left">
                      <thead className="bg-[#f0efeb] text-neutral-900/75 font-bold text-[9px]">
                        <tr>
                          <th className="px-2 py-2 text-center border-r border-neutral-200 w-16">Order</th>
                          <th className="px-3 py-2 border-r border-neutral-200">Component / Ingredient</th>
                          <th className="px-3 py-2 text-right border-r border-neutral-200">Standard Master Cost Rate</th>
                          <th className="px-3 py-2 text-right border-r border-neutral-200">Amount Required</th>
                          <th className="px-3 py-2 text-right border-r border-neutral-200">Calculated Cost Subtotal</th>
                          <th className="px-3 py-2 text-center">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#141414]">
                        {recipeIngs.map((item, idx) => {
                          if (item.isSubRecipe || item.subRecipeId) {
                            const subRec = recipes.find(r => r.id === (item.subRecipeId || item.ingredientId));
                            const subSummary = subRec ? getRecalculatedRecipeSummary(subRec) : null;
                            const portionRate = subSummary ? subSummary.costPerServing : 0;
                            const subtotal = item.grams * portionRate;

                            return (
                              <tr
                                key={`subrecipe-${item.subRecipeId || item.ingredientId}-${idx}`}
                                draggable
                                onDragStart={(e) => handleBuilderDragStart(e, idx)}
                                onDragOver={(e) => handleBuilderDragOver(e, idx)}
                                onDrop={(e) => handleBuilderDrop(e, idx)}
                                onDragEnd={() => {
                                  setDraggedBuilderIdx(null);
                                  setDragOverBuilderIdx(null);
                                }}
                                className={`transition-colors bg-amber-50/40 ${
                                  draggedBuilderIdx === idx
                                    ? "opacity-40 bg-amber-100/50"
                                    : dragOverBuilderIdx === idx
                                    ? "bg-amber-100/80 border-t-2 border-b-2 border-amber-500"
                                    : "hover:bg-amber-50/80"
                                }`}
                              >
                                <td className="px-2 py-2 text-center border-r border-neutral-200 shrink-0 select-none">
                                  <div
                                    className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-amber-600 hover:text-amber-800"
                                    title="Drag to reorder"
                                  >
                                    <GripVertical className="h-4 w-4 shrink-0" />
                                    <span className="text-[10px] font-mono font-bold text-amber-700 min-w-[14px] text-center">
                                      {idx + 1}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-r border-neutral-200 min-w-[200px]">
                                  <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 border border-amber-300 rounded-md font-mono text-[9px] font-bold shrink-0 flex items-center gap-1">
                                      <ChefHat className="h-3 w-3 text-amber-800" />
                                      Sub-Recipe
                                    </span>
                                    <span className="font-bold text-xs text-neutral-900">
                                      {subRec ? subRec.name : item.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-neutral-900/70 border-r border-neutral-200">
                                  {subRec ? `$${portionRate.toFixed(2)} / portion` : "N/A"}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold text-neutral-900 border-r border-neutral-200">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={item.grams === 0 ? "" : item.grams}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setRecipeIngs((prev) =>
                                          prev.map((r, i) => (i === idx ? { ...r, grams: val } : r))
                                        );
                                      }}
                                      className="w-24 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right focus:outline-hidden focus:border-amber-500 shadow-xs"
                                    />
                                    <span className="text-xs font-mono text-amber-800">portion(s)</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold text-neutral-900 border-r border-neutral-200">
                                  ${subtotal.toFixed(2)}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIngredientUsage(idx)}
                                    className="text-red-600 hover:text-red-700 p-1 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          }

                          const ing = getIngredientById(item.ingredientId, item.name);
                          const unitRate = ing ? calculateIngredientUnitPrice(ing) : 0;
                          const subtotal = ing ? item.grams * unitRate : 0;

                          const isCountUnit = ing ? isPcsUnit(ing.unit) : false;
                          const hasEquivWeight = ing ? !!(ing.weightPerCase && ing.weightPerCase > 0) : false;
                          const hasCustomUnit = ing && ing.unit !== "g" && !isCountUnit;

                          return (
                            <tr
                              key={`${item.ingredientId}-${idx}`}
                              draggable
                              onDragStart={(e) => handleBuilderDragStart(e, idx)}
                              onDragOver={(e) => handleBuilderDragOver(e, idx)}
                              onDrop={(e) => handleBuilderDrop(e, idx)}
                              onDragEnd={() => {
                                setDraggedBuilderIdx(null);
                                setDragOverBuilderIdx(null);
                              }}
                              className={`transition-colors ${
                                draggedBuilderIdx === idx
                                  ? "opacity-40 bg-emerald-100/50"
                                  : dragOverBuilderIdx === idx
                                  ? "bg-emerald-100/80 border-t-2 border-b-2 border-emerald-500"
                                  : "hover:bg-[#f0efeb]/40"
                              }`}
                            >
                              <td className="px-2 py-2 text-center border-r border-neutral-200 shrink-0 select-none">
                                <div
                                  className="flex items-center justify-center gap-1 cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-800"
                                  title="Drag to reorder"
                                >
                                  <GripVertical className="h-4 w-4 shrink-0" />
                                  <span className="text-[10px] font-mono font-bold text-neutral-500 min-w-[14px] text-center">
                                    {idx + 1}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-2 border-r border-neutral-200 min-w-[200px]">
                                <SearchableMatchSelect
                                  value={item.ingredientId}
                                  onChange={(newId) => {
                                    const selectedMaster = getUniqueIngredients().find((i) => i.id === newId);
                                    setRecipeIngs((prev) =>
                                      prev.map((r, i) =>
                                        i === idx
                                          ? {
                                              ...r,
                                              ingredientId: newId,
                                              name: selectedMaster?.name || r.name,
                                            }
                                          : r
                                      )
                                    );
                                  }}
                                  ingredients={getUniqueIngredients()}
                                  placeholder="-- Select Ingredient --"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-neutral-900/60 border-r border-neutral-200">
                                {ing ? `${unitRate.toFixed(5)} / ${getBaseUnitLabel(ing)}` : "N/A"}
                                {hasCustomUnit && ing && (
                                  <span className="block text-[10px] text-neutral-500 font-normal italic">
                                    {hasEquivWeight ? (
                                      <>(${ (unitRate * getGramsOrMlEquivalent(ing.weightPerCase!, ing.weightPerCaseUnit || "lb")).toFixed(4) } / {ing.unit})</>
                                    ) : (
                                      <>(${ (unitRate * (getGramsOrMlEquivalent(1, ing.unit) || 1)).toFixed(4) } / {ing.unit})</>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-neutral-900 border-r border-neutral-200">
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={item.grams === 0 ? "" : item.grams}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setRecipeIngs((prev) =>
                                        prev.map((r, i) => (i === idx ? { ...r, grams: val } : r))
                                      );
                                    }}
                                    className="w-24 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right focus:outline-hidden focus:border-emerald-500 shadow-xs"
                                  />
                                  <span className="text-xs font-mono text-neutral-600">{getBaseUnitLabel(ing)}</span>
                                </div>
                                {ing && (hasCustomUnit || ing.weightPerCase) && (
                                  <span className="block text-[10px] text-neutral-600 font-semibold italic mt-1 text-right">
                                    ≈ {hasEquivWeight ? (
                                        `${((item.grams) / (getGramsOrMlEquivalent(ing.weightPerCase!, ing.weightPerCaseUnit || "lb"))).toFixed(3)} ${ing.unit}`
                                      ) : (
                                        `${convertFromGrams(item.grams, ing.unit).toFixed(3)} ${ing.unit}`
                                      )}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-neutral-900 border-r border-neutral-200">
                                ${subtotal.toFixed(2)}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIngredientUsage(idx)}
                                  className="text-red-600 hover:text-red-700 p-1 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
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

            {/* Live Audit Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 text-left border border-neutral-200">
                <span className="text-[10px] font-bold text-neutral-900/60 font-mono">Total Raw Batch Cost</span>
                <p className="text-xl font-bold font-mono text-neutral-900 mt-1">${draft.totalCost.toFixed(2)}</p>
                <span className="text-[9px] text-neutral-900/50 block mt-0.5 font-serif italic">Sum of all ingredient weights</span>
              </div>

              <div className="bg-white rounded-xl p-4 text-left border border-neutral-200">
                <span className="text-[10px] font-bold text-neutral-900/60 font-mono">Cost per Portion</span>
                <p className="text-xl font-bold font-mono text-neutral-900 mt-1">${draft.costPerPortion.toFixed(2)}</p>
                <span className="text-[9px] text-neutral-900/50 block mt-0.5 font-serif italic">Yield of {expectedYield} portions</span>
              </div>

              <div className="bg-white rounded-xl p-4 text-left border border-neutral-200">
                <span className="text-[10px] font-bold text-neutral-900/60 font-mono">Projected Gross Margin</span>
                <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                  <p className={`text-xl font-bold ${getMarginTextClass(draft.profitMargin)}`}>
                    {draft.profitMargin.toFixed(1)}%
                  </p>
                  <span className={`text-[9px] px-2 py-0.5 border rounded-xl font-bold ${getMarginBadgeClass(draft.profitMargin)}`}>
                    {draft.profitMargin >= 70 ? "Healthy" : draft.profitMargin >= 50 ? "Target" : "Risk"}
                  </span>
                </div>
                <span className="text-[9px] text-neutral-900/50 block mt-0.5 font-serif italic">Menu target at ${parseFloat(sellingPrice || "0").toFixed(2)}</span>
              </div>
            </div>

            {/* Submit / Cancel Buttons */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-neutral-200/20">
              <button
                type="button"
                onClick={() => {
                  setShowBuilder(false);
                  setIngSearchQuery("");
                  setIngDropdownOpen(false);
                }}
                className="px-5 py-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 hover:bg-[#f0efeb] text-[10px] font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recipeIngs.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-neutral-800 text-white font-bold text-[10px] border border-neutral-200 disabled:opacity-40 cursor-pointer"
              >
                {editingId ? "Save cost alterations" : "Commit Recipe Sheet"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recipes Display Catalog */}
      {(() => {
        const uniqueDepartments = Array.from(new Set([...customDepts, ...recipes.map(r => r.department || "Kitchen")]));
        const filteredRecipes = recipes
          .filter(rec => {
            const terms = recipeSearch.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
            const matchesSearch = terms.length === 0 || terms.some(t => rec.name.toLowerCase().includes(t));
            
            const recDept = rec.department || "Kitchen";
            const matchesDept = selectedDeptFilter === "All" || recDept.toLowerCase() === selectedDeptFilter.toLowerCase();

            const isSub = rec.sellingPrice === 0;
            const matchesType = 
              selectedTypeFilter === "all" ? true :
              selectedTypeFilter === "subrecipe" ? isSub :
              !isSub;

            return matchesSearch && matchesDept && matchesType;
          })
          .sort((a, b) => {
            if (sortBy === "alpha-asc") {
              return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            }
            if (sortBy === "alpha-desc") {
              return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
            }
            if (sortBy === "margin-desc" || sortBy === "margin-asc" || sortBy === "cost-desc" || sortBy === "cost-asc") {
              const summaryA = getRecalculatedRecipeSummary(a);
              const summaryB = getRecalculatedRecipeSummary(b);
              if (sortBy === "margin-desc") return summaryB.updatedMargin - summaryA.updatedMargin;
              if (sortBy === "margin-asc") return summaryA.updatedMargin - summaryB.updatedMargin;
              if (sortBy === "cost-desc") return summaryB.actualTotalCost - summaryA.actualTotalCost;
              if (sortBy === "cost-asc") return summaryA.actualTotalCost - summaryB.actualTotalCost;
            }
            if (sortBy === "price-desc") {
              return (b.sellingPrice || 0) - (a.sellingPrice || 0);
            }
            if (sortBy === "price-asc") {
              return (a.sellingPrice || 0) - (b.sellingPrice || 0);
            }
            return 0;
          });

        if (recipes.length === 0) {
          return (
            <div className="py-12 text-center rounded-xl border border-dashed border-neutral-200" id="empty-recipes">
              <ChefHat className="h-8 w-8 text-neutral-900/40 mx-auto mb-2 font-mono" />
              <p className="text-xs font-bold text-neutral-900 ">No culinary recipes compiled</p>
              <p className="text-xs text-neutral-900/60 mt-1 max-w-[360px] mx-auto font-serif italic mb-4">
                Paste recipe text or notes to auto-generate a cost sheet with Gemini, or build one manually ingredient by ingredient.
              </p>
              {!isReadOnly && (
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    onClick={() => setShowBulkCsvModal(true)}
                    className="bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs px-4 py-2 rounded-xl border border-emerald-300 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Bulk Import CSV</span>
                  </button>
                  <button
                    onClick={() => setShowAIRecipeModal(true)}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    <span>AI Create from Text</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setName("");
                      setSellingPrice("12.50");
                      setExpectedYield("1");
                      setRecipeIngs([]);
                      setDepartment(customDepts[0] || "Kitchen");
                      setShowBuilder(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Manually</span>
                  </button>
                </div>
              )}
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {/* Search and Filter panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 border border-neutral-200 rounded-xl">
              <div className="text-left">
                <label className="block text-[10px] font-bold text-neutral-900/65 mb-1">Search Recipe Name</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center">
                      <Search className="h-3.5 w-3.5 text-neutral-900/40" />
                    </span>
                    <input
                      type="text"
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                      placeholder="Search by name..."
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-8 pr-2 py-1.5 text-xs font-bold focus:outline-hidden"
                    />
                  </div>
                  <AIAssistantModal 
                    context="Recipes Catalog"
                    itemNames={Array.from(new Set(recipes.map(r => r.name)))}
                    onSearchTerms={(terms) => setRecipeSearch(terms.join(", "))}
                  />
                </div>
              </div>

              <div className="text-left">
                <label className="block text-[10px] font-bold text-neutral-900/65 mb-1">Filter by Classification</label>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value as "all" | "sale" | "subrecipe")}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Recipe Types</option>
                  <option value="sale">🍽️ Menu Items (For Sale)</option>
                  <option value="subrecipe">🥫 Sub-Recipes &amp; Prep ($0)</option>
                </select>
              </div>

              <div className="text-left">
                <label className="block text-[10px] font-bold text-neutral-900/65 mb-1">Filter by Department</label>
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-hidden cursor-pointer"
                >
                  <option value="All">All Departments</option>
                  {uniqueDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="text-left">
                <label className="block text-[10px] font-bold text-neutral-900/65 mb-1">Sort Recipes</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-hidden cursor-pointer font-sans"
                >
                  <option value="custom">Custom Order (Drag &amp; Drop)</option>
                  <option value="alpha-asc">Alphabetical (A → Z)</option>
                  <option value="alpha-desc">Alphabetical (Z → A)</option>
                  <option value="margin-desc">Profit Margin (High → Low)</option>
                  <option value="margin-asc">Profit Margin (Low → High)</option>
                  <option value="cost-desc">Batch Cost (High → Low)</option>
                  <option value="cost-asc">Batch Cost (Low → High)</option>
                  <option value="price-desc">Selling Price (High → Low)</option>
                  <option value="price-asc">Selling Price (Low → High)</option>
                </select>
              </div>

              <div className="text-left flex flex-col justify-end">
                <div className="relative w-full" ref={exportDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowExportDropdown(prev => !prev)}
                    disabled={filteredRecipes.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer rounded-xl border border-neutral-200 disabled:opacity-50 min-h-[32px]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Cost Sheets</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showExportDropdown && filteredRecipes.length > 0 && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl z-30 py-1 divide-y divide-neutral-100 font-sans">
                      <div className="px-3 py-1.5 text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                        Export Format
                      </div>
                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            exportRecipesToCSV(filteredRecipes);
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
                            exportRecipesToJSON(filteredRecipes);
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

            {filteredRecipes.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-neutral-200">
                <p className="text-xs font-bold text-neutral-900/60 ">No recipe matching filters</p>
                <p className="text-[11px] text-neutral-900/50 mt-1 font-serif italic">Try relaxing your search terms or clearing filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="recipes-catalog">
                {filteredRecipes.map((rec, idx) => {
                  const cardKey = rec.id || `${idx}`;
                  const { updatedIngredients, actualTotalCost, costPerServing, updatedMargin } = getRecalculatedRecipeSummary(rec);
                  const isExpanded = expandedRecipeId === rec.id;
                  const isDragged = draggedCatalogKey === cardKey;
                  const isDragOver = dragOverCatalogKey === cardKey;
                  const isSubRecipe = rec.sellingPrice === 0;

                  return (
                    <div
                      key={rec.id ? `${rec.id}-${idx}` : idx}
                      draggable={!isReadOnly}
                      onDragStart={(e) => handleCatalogDragStart(e, cardKey)}
                      onDragOver={(e) => handleCatalogDragOver(e, cardKey)}
                      onDrop={(e) => handleCatalogDrop(e, cardKey)}
                      onDragEnd={() => {
                        setDraggedCatalogKey(null);
                        setDragOverCatalogKey(null);
                      }}
                      className={`bg-white border rounded-xl shadow-xs transition-all overflow-hidden text-left flex flex-col justify-between ${
                        isDragged
                          ? "opacity-30 border-dashed border-emerald-500 bg-emerald-50/50"
                          : isDragOver
                          ? "border-2 border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-300 scale-[1.01]"
                          : isSubRecipe
                          ? "border-amber-200 hover:border-amber-400 hover:shadow-md bg-linear-to-b from-amber-50/30 to-white"
                          : "border-neutral-200 hover:border-neutral-300 hover:shadow-md"
                      }`}
                      id={`recipe-card-${rec.id || idx}`}
                    >
                      {/* Card Header segment */}
                      <div className="p-5 border-b border-neutral-200">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-start gap-2.5">
                            {!isReadOnly && (
                              <div
                                className="mt-0.5 p-1 text-neutral-400 hover:text-neutral-800 cursor-grab active:cursor-grabbing rounded-lg hover:bg-neutral-100 transition-colors shrink-0"
                                title="Drag card to reorder recipes"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                            )}
                            <div className="text-left">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-neutral-900">{rec.name}</h3>
                                <span className="text-[9px] font-mono font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-md border border-neutral-200">
                                  #{idx + 1}
                                </span>
                                {isSubRecipe && (
                                  <span className="text-[9px] font-mono font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300/80 flex items-center gap-1 shadow-2xs">
                                    <ChefHat className="h-3 w-3 text-amber-700" />
                                    Sub-Recipe / Prep
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-neutral-900/60 font-mono mt-0.5">
                                Expected Yield: <span className="font-bold text-neutral-900">{rec.expectedYield} Portions</span>
                              </p>
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-bold font-mono px-2 py-0.5 bg-neutral-900 text-white rounded-xl">
                                  Department: {rec.department || "Kitchen"}
                                </span>
                              </div>
                            </div>
                          </div>
                          {isSubRecipe ? (
                            <span className="text-[9px] font-mono font-bold px-2.5 py-0.5 border rounded-xl bg-amber-100 text-amber-900 border-amber-300 shrink-0">
                              🥫 Sub-Recipe Batch
                            </span>
                          ) : (
                            <span className={`text-[9px] font-mono font-bold px-2.5 py-0.5 border rounded-xl shrink-0 ${getMarginBadgeClass(updatedMargin)}`}>
                              {updatedMargin.toFixed(1)}% Margin
                            </span>
                          )}
                        </div>

                  {/* Financial Quick KPIs */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center font-mono">
                    <div className="bg-[#f0efeb] p-2 rounded-xl border border-neutral-200/20 text-left">
                      <span className="text-[8px] block font-bold text-neutral-900/60">Menu Price</span>
                      {isSubRecipe ? (
                        <span className="font-bold text-xs text-amber-900 flex items-center gap-1">
                          Non-Sale <span className="text-[9px] font-mono bg-amber-200/80 text-amber-900 px-1 py-0.2 rounded">$0</span>
                        </span>
                      ) : (
                        <span className="font-bold text-xs text-neutral-900">${rec.sellingPrice.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="bg-[#f0efeb] p-2 rounded-xl border border-neutral-200/20 text-left">
                      <span className="text-[8px] block font-bold text-neutral-900/60">Total Cost</span>
                      <span className="font-bold text-xs text-neutral-900">${actualTotalCost.toFixed(2)}</span>
                    </div>
                    <div className="bg-[#f0efeb] p-2 rounded-xl border border-neutral-200/20 text-left">
                      <span className="text-[8px] block font-bold text-neutral-900/60">Portion cost</span>
                      <span className="font-bold text-xs text-neutral-900">${costPerServing.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Sub Ingredients Breakdown Drawer */}
                {isExpanded && (
                  <div className="bg-[#f0efeb] p-4 border-b border-neutral-200 text-xs">
                    <h4 className="text-[9px] font-bold text-neutral-900/70 mb-2">Cost Contribution Analysis</h4>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {updatedIngredients.map((ingItem, i) => {
                        if (ingItem.isSubRecipe) {
                          return (
                            <div key={i} className="flex justify-between items-center bg-amber-50/80 p-2 border border-amber-200 rounded-xl">
                              <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                                <ChefHat className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                <span>{ingItem.name}</span>
                                <span className="text-[9px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md font-mono font-bold">Sub-Recipe</span>
                              </span>
                              <span className="text-amber-900/80 font-mono text-[10px] text-right">
                                <div>{ingItem.grams} portion(s)</div>
                                <span className="block text-[8px] text-amber-800/70 mt-0.5">
                                  @ ${ingItem.currentRate.toFixed(2)}/portion
                                </span>
                              </span>
                              <span className="font-mono font-bold text-amber-950">${ingItem.currentCost.toFixed(2)}</span>
                            </div>
                          );
                        }
                        const ing = getIngredientById(ingItem.ingredientId, ingItem.name);
                        const isCountUnit = ing ? isPcsUnit(ing.unit) : false;
                        const showConverted = ing && (ing.unit !== "g" || ing.weightPerCase) && !isCountUnit;
                        return (
                          <div key={i} className="flex justify-between items-center bg-white p-2 border border-neutral-200 rounded-xl">
                            <span className="font-bold text-neutral-900">{ing ? ing.name : ingItem.name}</span>
                            <span className="text-neutral-900/65 font-mono text-[10px] text-right">
                              <div className="font-bold text-neutral-900">{ingItem.grams} {getBaseUnitLabel(ing)}</div>
                              {showConverted && ing && (
                                <span className="block text-[9px] text-neutral-900/60 font-semibold italic">
                                  ≈ {ing.weightPerCase && ing.weightPerCase > 0 ? (
                                      `${((ingItem.grams) / (getGramsOrMlEquivalent(ing.weightPerCase, ing.weightPerCaseUnit || "lb"))).toFixed(3)} ${ing.unit}`
                                    ) : (
                                      `${convertFromGrams(ingItem.grams, ing.unit).toFixed(3)} ${ing.unit}`
                                    )}
                                </span>
                              )}
                              <span className="block text-[8px] text-neutral-900/40 mt-0.5">
                                @ ${ingItem.currentRate.toFixed(4)}/{getBaseUnitLabel(ing)}
                              </span>
                            </span>
                            <span className="font-mono font-bold text-neutral-900">${ingItem.currentCost.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Card Action Rails */}
                <div className="bg-white px-5 py-3 flex justify-between items-center border-t border-neutral-200">
                  <button
                    onClick={() => setExpandedRecipeId(isExpanded ? null : rec.id || null)}
                    className="text-neutral-900 hover:text-black font-bold text-[9px] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Info className="h-3.5 w-3.5 text-neutral-900" />
                    <span>{isExpanded ? "Hide specs" : "Breakdown costs"}</span>
                  </button>

                  {!isReadOnly ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => startEditMode(rec)}
                        className="text-neutral-900 hover:bg-[#f0efeb] text-[10px] font-bold bg-white p-1 px-3 border border-neutral-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => rec.id && onDeleteRecipe(rec.id)}
                        className="p-1 px-2.5 text-red-600 hover:bg-red-50 hover:text-red-800 border border-transparent hover:border-red-400 rounded-xl transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      <span>Read-only spec sheet</span>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  })()}

      {/* Unit Manager / Existing Unit Picker Modal */}
      {showUnitPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 flex flex-col max-h-[85vh] text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${unitPickerTab === "hide" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {unitPickerTab === "hide" ? <EyeOff className="h-5 w-5" /> : <Tag className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    {unitPickerTab === "hide" ? "Select Units to Hide or Show" : "Add or Select Existing Unit"}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {unitPickerTab === "hide"
                      ? "Choose which units appear or stay hidden in recipe calculations"
                      : "Pick from existing units in your inventory or create a new unit"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnitPickerModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-neutral-200 mt-2 mb-3">
              <button
                type="button"
                onClick={() => setUnitPickerTab("add")}
                className={`pb-2 px-3 text-xs font-bold transition-all cursor-pointer border-b-2 ${
                  unitPickerTab === "add"
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                ➕ Add / Select Units
              </button>
              <button
                type="button"
                onClick={() => setUnitPickerTab("hide")}
                className={`pb-2 px-3 text-xs font-bold transition-all cursor-pointer border-b-2 flex items-center gap-1.5 ${
                  unitPickerTab === "hide"
                    ? "border-amber-600 text-amber-700 font-bold"
                    : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <EyeOff className="h-3.5 w-3.5" />
                <span>Select Units to Hide</span>
                {hiddenRecipeUnits.length > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {hiddenRecipeUnits.length}
                  </span>
                )}
              </button>
            </div>

            {unitPickerTab === "add" ? (
              <>
                {/* Quick Add Custom Unit */}
                <div className="py-2 border-b border-neutral-100 space-y-2">
                  <label className="block text-xs font-bold text-neutral-800">Create & Add New Custom Unit</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. pinch, dash, scoop, sleeve, carton..."
                      value={newCustomUnitInput}
                      onChange={(e) => setNewCustomUnitInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomUnit(newCustomUnitInput);
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={!newCustomUnitInput.trim()}
                      onClick={() => handleAddCustomUnit(newCustomUnitInput)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Unit</span>
                    </button>
                  </div>
                </div>

                {/* Search Filter */}
                <div className="pt-3 pb-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search existing units..."
                      value={unitSearchQuery}
                      onChange={(e) => setUnitSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-neutral-400 font-mono"
                    />
                  </div>
                </div>

                {/* Units Lists Scrollable */}
                <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                  {/* Units from Current Ingredient */}
                  {ingredientExistingUnits.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                        Units from Selected Ingredient ({currentSelectedIng?.name || ""})
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {ingredientExistingUnits.map((u) => (
                          <button
                            key={u.value}
                            type="button"
                            onClick={() => {
                              setIngUnit(u.value);
                              setShowUnitPickerModal(false);
                            }}
                            className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              ingUnit.toLowerCase() === u.value.toLowerCase()
                                ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs font-bold"
                                : "bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300"
                            }`}
                          >
                            <div>
                              <div className="font-mono text-xs font-bold">{u.value}</div>
                              <div className="text-[10px] text-neutral-500">{u.type}</div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                              Select
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Added Units with deletion ability */}
                  {customUnits.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                        Your Custom Added Units
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {customUnits
                          .filter(u => !unitSearchQuery || u.toLowerCase().includes(unitSearchQuery.toLowerCase()))
                          .map((u) => (
                            <div
                              key={u}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all ${
                                ingUnit.toLowerCase() === u.toLowerCase()
                                  ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold"
                                  : "bg-white border-neutral-200 text-neutral-800"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setIngUnit(u);
                                  setShowUnitPickerModal(false);
                                }}
                                className="text-xs font-mono font-bold hover:underline cursor-pointer"
                              >
                                {u}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomUnit(u)}
                                className="p-0.5 text-neutral-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                                title={`Delete custom unit "${u}"`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Existing Workspace Catalog Units */}
                  <div>
                    <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                      All Catalog & Standard Units
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {allExistingUnits
                        .filter(item => !unitSearchQuery || item.unit.toLowerCase().includes(unitSearchQuery.toLowerCase()))
                        .map((item) => (
                          <button
                            key={item.unit}
                            type="button"
                            onClick={() => {
                              setIngUnit(item.unit);
                              setShowUnitPickerModal(false);
                            }}
                            className={`p-2 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                              ingUnit.toLowerCase() === item.unit.toLowerCase()
                                ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs font-bold"
                                : "bg-white border-neutral-200 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300"
                            }`}
                          >
                            <div className="truncate">
                              <span className="font-mono text-xs font-bold block truncate">{item.unit}</span>
                              <span className="text-[9px] text-neutral-400 block truncate">{item.origin}</span>
                            </div>
                            {item.count > 0 && (
                              <span className="text-[9px] font-mono font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-md shrink-0 ml-1">
                                {item.count}
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Hide Units Selector Tab */
              <div className="overflow-y-auto flex-1 space-y-4 pr-1 pt-2">
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-xs text-amber-900">
                    <p className="font-bold">Select units to hide</p>
                    <p className="text-[11px] text-amber-700">Click any unit below to toggle between visible and hidden.</p>
                  </div>
                  {hiddenRecipeUnits.length > 0 && (
                    <button
                      type="button"
                      onClick={unhideAllRecipeUnits}
                      className="px-3 py-1 bg-white border border-amber-300 text-amber-900 text-xs font-bold rounded-lg hover:bg-amber-100 cursor-pointer"
                    >
                      Show All Units
                    </button>
                  )}
                </div>

                {/* Search in hide tab */}
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Filter units to hide..."
                    value={unitSearchQuery}
                    onChange={(e) => setUnitSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-neutral-400 font-mono"
                  />
                </div>

                {/* All available units checklist */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                    Available Units
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allExistingUnits
                      .filter(item => !unitSearchQuery || item.unit.toLowerCase().includes(unitSearchQuery.toLowerCase()))
                      .map((item) => {
                        const isHidden = hiddenRecipeUnits.some(hu => hu.toLowerCase() === item.unit.toLowerCase());
                        return (
                          <div
                            key={item.unit}
                            className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                              isHidden
                                ? "bg-neutral-100 border-neutral-300 opacity-60 text-neutral-500"
                                : "bg-white border-neutral-200 text-neutral-800 shadow-2xs"
                            }`}
                          >
                            <div className="truncate mr-2">
                              <span className="font-mono text-xs font-bold block truncate capitalize">{item.unit}</span>
                              <span className="text-[9px] text-neutral-400 block truncate">{item.origin}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleHideRecipeUnit(item.unit)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                                isHidden
                                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              }`}
                              title={isHidden ? `Unhide ${item.unit}` : `Hide ${item.unit}`}
                            >
                              {isHidden ? (
                                <>
                                  <EyeOff className="h-3 w-3 text-red-600" />
                                  <span>Hidden</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 text-emerald-600" />
                                  <span>Visible</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-4 mt-2 border-t border-neutral-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleRemoveActiveUnit();
                  setShowUnitPickerModal(false);
                }}
                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset to Base Unit</span>
              </button>
              <button
                type="button"
                onClick={() => setShowUnitPickerModal(false)}
                className="px-4 py-1.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal for Culinary Recipe Cost Sheets */}
      {showBulkCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh] text-left">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-neutral-200 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                    Bulk Import Culinary Recipe Cost Sheets (CSV / Excel)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Download the sample CSV template, upload your edited CSV file or paste rows from Excel/Google Sheets, and map ingredients automatically.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkCsvModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 py-4 space-y-5 pr-1">
              {/* Step 1: Sample Template & File Upload Bar */}
              <div className="bg-[#f8f7f4] border border-neutral-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                      CSV Format Guide
                    </span>
                    <span className="text-xs font-bold text-neutral-900">
                      1 Row per Recipe Ingredient (Grouped automatically by Recipe Name)
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 font-mono">
                    Columns: <strong className="text-neutral-900">Recipe Name, Department, Expected Yield (Portions), Selling Price ($), Ingredient Name, Quantity, Unit</strong>
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Tip: Put $0 for Selling Price to classify a recipe as a <strong>Sub-Recipe / Prep batch</strong>. Multiple rows with the same Recipe Name are grouped into one Cost Sheet.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <input
                    ref={bulkFileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={handleBulkCsvFileUpload}
                  />
                  <button
                    type="button"
                    onClick={downloadSampleRecipeCSV}
                    className="px-3.5 py-2 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Download Sample CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sample = generateSampleCsvString();
                      setCsvRawText(sample);
                      parseBulkRecipeCSV(sample);
                    }}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Load Sample Data</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => bulkFileInputRef.current?.click()}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Upload className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Upload CSV File</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Direct Paste CSV / Spreadsheet Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <span>Paste CSV or Excel / Google Sheets Rows Here</span>
                    <span className="text-[10px] font-normal text-neutral-500">
                      (Supports both comma-separated CSV and tab-separated Excel copy-paste)
                    </span>
                  </label>
                  {csvRawText && (
                    <button
                      type="button"
                      onClick={() => {
                        setCsvRawText("");
                        setBulkDrafts([]);
                      }}
                      className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <textarea
                  rows={5}
                  value={csvRawText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCsvRawText(val);
                    parseBulkRecipeCSV(val);
                  }}
                  placeholder={`Recipe Name,Department,Expected Yield (Portions),Selling Price ($),Ingredient Name,Quantity,Unit\nSignature Chicken Sandwich,Kitchen,1,16.50,Chicken Breast,180,g\nSignature Chicken Sandwich,Kitchen,1,16.50,Brioche Bun,1,pcs`}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs font-mono text-neutral-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Step 3: Live Parsed Preview & Ingredient Mapping */}
              {bulkDrafts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Parsed Cost Sheets Preview ({bulkDrafts.length} Recipes)
                      </h4>
                      <span className="text-[11px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                        {bulkDrafts.reduce((acc, r) => acc + r.items.length, 0)} Total Ingredient Lines
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-neutral-500 font-semibold">If recipe name already exists:</span>
                      <select
                        value={duplicateAction}
                        onChange={(e) => setDuplicateAction(e.target.value as "update" | "create")}
                        className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-xs font-bold text-neutral-800 cursor-pointer"
                      >
                        <option value="update">Overwrite / Update Existing Recipe</option>
                        <option value="create">Create as New Duplicate Recipe</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {bulkDrafts.map((draftRec, rIdx) => {
                      const summary = calculateBulkDraftSummary(draftRec);
                      const isSub = draftRec.sellingPrice === 0;
                      return (
                        <div
                          key={draftRec.id}
                          className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-2xs"
                        >
                          {/* Recipe Header Bar */}
                          <div className="bg-[#f0efeb] p-3.5 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 flex-1">
                              <div>
                                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-0.5">
                                  Recipe Name
                                </label>
                                <input
                                  type="text"
                                  value={draftRec.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBulkDrafts((prev) =>
                                      prev.map((r, i) => (i === rIdx ? { ...r, name: val } : r))
                                    );
                                  }}
                                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs font-bold text-neutral-900"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-0.5">
                                  Department
                                </label>
                                <input
                                  type="text"
                                  value={draftRec.department}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBulkDrafts((prev) =>
                                      prev.map((r, i) => (i === rIdx ? { ...r, department: val } : r))
                                    );
                                  }}
                                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs font-bold text-neutral-900"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-0.5">
                                  Yield (Portions)
                                </label>
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={draftRec.expectedYield}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 1;
                                    setBulkDrafts((prev) =>
                                      prev.map((r, i) => (i === rIdx ? { ...r, expectedYield: val } : r))
                                    );
                                  }}
                                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-neutral-900"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-0.5">
                                  Selling Price ($) {isSub && "(Sub-Recipe)"}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={draftRec.sellingPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setBulkDrafts((prev) =>
                                      prev.map((r, i) => (i === rIdx ? { ...r, sellingPrice: val } : r))
                                    );
                                  }}
                                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-neutral-900"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                              <div className="bg-white px-2.5 py-1 rounded-lg border border-neutral-200">
                                <span className="text-[9px] text-neutral-500 block">Batch Cost</span>
                                <span className="font-bold text-neutral-900">${summary.totalCost.toFixed(2)}</span>
                              </div>
                              <div className="bg-white px-2.5 py-1 rounded-lg border border-neutral-200">
                                <span className="text-[9px] text-neutral-500 block">Portion Cost</span>
                                <span className="font-bold text-emerald-700">${summary.costPerPortion.toFixed(2)}</span>
                              </div>
                              {!isSub && (
                                <div className="bg-white px-2.5 py-1 rounded-lg border border-neutral-200">
                                  <span className="text-[9px] text-neutral-500 block">Margin</span>
                                  <span className={`font-bold ${getMarginTextClass(summary.profitMargin)}`}>
                                    {summary.profitMargin.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setBulkDrafts((prev) => prev.filter((_, i) => i !== rIdx))
                                }
                                className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                title="Remove recipe from import batch"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Recipe Ingredients Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-neutral-50 text-[10px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
                                <tr>
                                  <th className="py-2 px-3">CSV Ingredient Name</th>
                                  <th className="py-2 px-3 w-28">Quantity</th>
                                  <th className="py-2 px-3 w-24">Unit</th>
                                  <th className="py-2 px-3 min-w-[260px]">Matched Inventory Item / Sub-Recipe</th>
                                  <th className="py-2 px-3 text-right">Normalized Base</th>
                                  <th className="py-2 px-3 text-center w-12"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100">
                                {draftRec.items.map((item, iIdx) => {
                                  const baseGrams = computeBaseGramsForIngredient(
                                    item.quantity,
                                    item.unit,
                                    item.matchedId,
                                    item.isSubRecipe
                                  );
                                  const matchedIng = !item.isSubRecipe
                                    ? getIngredientById(item.matchedId, item.rawIngredientName)
                                    : null;
                                  const baseLabel = item.isSubRecipe
                                    ? "portions"
                                    : getBaseUnitLabel(matchedIng);

                                  return (
                                    <tr key={iIdx} className="hover:bg-neutral-50/70">
                                      <td className="py-2 px-3 font-bold text-neutral-800">
                                        {item.rawIngredientName}
                                      </td>
                                      <td className="py-2 px-3">
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={item.quantity}
                                          onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setBulkDrafts((prev) =>
                                              prev.map((r, ri) =>
                                                ri === rIdx
                                                  ? {
                                                      ...r,
                                                      items: r.items.map((it, ii) =>
                                                        ii === iIdx ? { ...it, quantity: val } : it
                                                      ),
                                                    }
                                                  : r
                                              )
                                            );
                                          }}
                                          className="w-24 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                                        />
                                      </td>
                                      <td className="py-2 px-3">
                                        <input
                                          type="text"
                                          value={item.unit}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setBulkDrafts((prev) =>
                                              prev.map((r, ri) =>
                                                ri === rIdx
                                                  ? {
                                                      ...r,
                                                      items: r.items.map((it, ii) =>
                                                        ii === iIdx ? { ...it, unit: val } : it
                                                      ),
                                                    }
                                                  : r
                                              )
                                            );
                                          }}
                                          className="w-20 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                                        />
                                      </td>
                                      <td className="py-2 px-3">
                                        <SearchableMatchSelect
                                          value={item.matchedId}
                                          ingredients={getUniqueIngredients()}
                                          subRecipes={recipes}
                                          placeholder="-- Unmatched (Keep raw name) --"
                                          onChange={(newId) => {
                                            const isSub = recipes.some((sr) => sr.id === newId);
                                            setBulkDrafts((prev) =>
                                              prev.map((r, ri) =>
                                                ri === rIdx
                                                  ? {
                                                      ...r,
                                                      items: r.items.map((it, ii) =>
                                                        ii === iIdx
                                                          ? { ...it, matchedId: newId, isSubRecipe: isSub }
                                                          : it
                                                      ),
                                                    }
                                                  : r
                                              )
                                            );
                                          }}
                                        />
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-neutral-600">
                                        {baseGrams.toFixed(1)} {baseLabel}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setBulkDrafts((prev) =>
                                              prev.map((r, ri) =>
                                                ri === rIdx
                                                  ? {
                                                      ...r,
                                                      items: r.items.filter((_, ii) => ii !== iIdx),
                                                    }
                                                  : r
                                              )
                                            )
                                          }
                                          className="p-1 text-neutral-400 hover:text-red-600 rounded cursor-pointer"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {bulkImportMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{bulkImportMessage}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-500">
                {bulkDrafts.length > 0 ? (
                  <span>
                    Ready to import <strong>{bulkDrafts.length}</strong> recipe cost sheet(s).
                  </span>
                ) : (
                  <span>Upload a CSV file, click &ldquo;Load Sample Data&rdquo;, or paste rows above to preview.</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkCsvModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkDrafts.length === 0 || isImportingBulk}
                  onClick={handleConfirmBulkRecipeImport}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isImportingBulk ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Import {bulkDrafts.length} Recipe Cost Sheet(s)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Recipe Cost Sheet Creator Modal */}
      <AIRecipeModal
        isOpen={showAIRecipeModal}
        onClose={() => setShowAIRecipeModal(false)}
        ingredients={ingredients}
        recipes={recipes}
        customDepts={customDepts}
        customUnits={customUnits}
        onAddCustomUnit={handleAddCustomUnit}
        onAddDept={onAddDept}
        onSaveRecipe={onAddRecipe}
        onLoadIntoBuilder={(data) => {
          setName(data.name);
          setSellingPrice(data.sellingPrice);
          setExpectedYield(data.expectedYield);
          setDepartment(data.department);
          setRecipeIngs(data.recipeIngs);
          setEditingId(null);
          setShowBuilder(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
          document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
