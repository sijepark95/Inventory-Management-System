import React, { useState, useEffect, useMemo, useRef } from "react";
import { Ingredient, Recipe, RecipeIngredientRef } from "../types";
import {
  Sparkles,
  X,
  ChefHat,
  Loader2,
  Check,
  Plus,
  Trash2,
  Info,
  DollarSign,
  Layers,
  ArrowRight,
  RotateCcw,
  Sliders,
  Utensils,
  BookOpen,
  Clipboard,
  FileText,
  AlertCircle,
  Tag,
  Search,
  ChevronDown,
  Scale
} from "lucide-react";
import {
  getGramsOrMlEquivalent,
  calculateIngredientUnitPrice,
  getBaseUnitLabel,
  isWeightUnit,
  convertWeightToLbs,
} from "../lib/unitConverter";

export interface ParsedRecipeItem {
  id?: string;
  name: string;
  rawText?: string;
  quantity: number;
  unit: string;
  grams: number;
  matchedIngredientId?: string;
  matchedIngredientName?: string;
  isSubRecipe?: boolean;
  matchedSubRecipeId?: string;
}

export interface ParsedRecipe {
  recipeName: string;
  department: string;
  expectedYield: number;
  sellingPrice: number;
  isSubRecipe?: boolean;
  instructions?: string;
  notes?: string;
  items: ParsedRecipeItem[];
}

export interface AIRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  recipes: Recipe[];
  customDepts: string[];
  customUnits?: string[];
  onAddCustomUnit?: (unit: string) => void;
  onAddDept: (name: string) => Promise<void>;
  onSaveRecipe: (recipe: Omit<Recipe, "id" | "ownerId" | "updatedAt">) => Promise<void>;
  onLoadIntoBuilder: (recipeData: {
    name: string;
    sellingPrice: string;
    expectedYield: string;
    department: string;
    recipeIngs: RecipeIngredientRef[];
  }) => void;
}

const SAMPLE_RECIPES = [
  {
    title: "🍕 Margherita Pizza",
    category: "Dish",
    dept: "Kitchen",
    text: `Artisan Margherita Pizza
Department: Kitchen
Yield: 4 personal pizzas
Target Selling Price: $16.50 each

Ingredients:
- 500g All-Purpose Flour (or 00 Pizza Flour)
- 325ml Warm Water
- 7g Active Dry Yeast
- 10g Kosher Salt
- 15ml Extra Virgin Olive Oil
- 250g San Marzano Canned Tomatoes (crushed)
- 300g Fresh Mozzarella (sliced)
- 15g Fresh Basil Leaves
- 20g Grated Parmesan Cheese

Instructions:
1. Combine flour, yeast, salt, water, and olive oil to form a supple dough. Ferment for 24 hours.
2. Divide into 4 balls. Stretch dough into 10-inch rounds.
3. Spread crushed tomatoes, top with fresh mozzarella slices and basil.
4. Bake at 500°F (or wood-fired oven) until crust is blistered and cheese is melted.`
  },
  {
    title: "🥫 Tomato Sauce Base (Sub-Recipe)",
    category: "Sub-Recipe",
    dept: "Kitchen",
    text: `San Marzano Tomato Sauce Base (Sub-Recipe Prep)
Department: Kitchen
Yield: 10 portions (batch prep base)
Type: Sub-Recipe (Non-Sale Component)

Ingredients:
- 800g Canned San Marzano Whole Tomatoes (crushed)
- 45ml Extra Virgin Olive Oil
- 6 cloves Fresh Garlic (minced)
- 10g Fresh Basil Leaves (chiffonade)
- 5g Dried Oregano
- 8g Kosher Salt
- 2g Crushed Red Pepper Flakes

Instructions:
1. Sauté minced garlic in olive oil over low heat until fragrant (do not brown).
2. Add crushed San Marzano tomatoes, oregano, and salt.
3. Simmer on low heat for 35 minutes until reduced and rich.
4. Stir in fresh basil, cool, and portion into 10 containers for pizza & pasta stations.`
  },
  {
    title: "🧈 Herb Finishing Butter (Sub-Recipe)",
    category: "Sub-Recipe",
    dept: "Kitchen",
    text: `Garlic Herb Compound Butter (Sub-Recipe)
Department: Kitchen
Yield: 12 portions (1 portion per steak/protein)
Type: Sub-Recipe (Prep Batch)

Ingredients:
- 454g (1 lb) Unsalted Butter (softened to room temp)
- 8 cloves Fresh Garlic (finely minced)
- 15g Fresh Rosemary (chopped)
- 15g Fresh Thyme (chopped)
- 10g Fresh Flat-Leaf Parsley (chopped)
- 6g Flaky Sea Salt
- 3g Coarse Ground Black Pepper

Instructions:
1. Whip softened butter until light and creamy.
2. Fold in minced garlic, rosemary, thyme, parsley, sea salt, and black pepper.
3. Roll into parchment paper log, chill, and slice into 12 portion medallions.`
  },
  {
    title: "🥣 Caesar Dressing (Sub-Recipe)",
    category: "Sub-Recipe",
    dept: "Kitchen",
    text: `House Creamy Caesar Dressing Base (Sub-Recipe)
Department: Kitchen
Yield: 16 portions (2 oz per portion)
Type: Sub-Recipe

Ingredients:
- 4 Large Egg Yolks
- 30g Anchovy Fillets (drained and finely mashed)
- 4 cloves Fresh Garlic (paste)
- 25ml Fresh Lemon Juice
- 15g Dijon Mustard
- 250ml Extra Virgin Olive Oil
- 50g Grated Parmigiano-Reggiano
- 2g Black Pepper

Instructions:
1. Whisk egg yolks, garlic paste, anchovies, lemon juice, and Dijon mustard.
2. Slowly drizzle olive oil in a steady stream to form a thick, silky emulsion.
3. Fold in grated Parmigiano-Reggiano and cracked black pepper. Portion into 16 servings.`
  },
  {
    title: "🥩 Herb Butter Ribeye",
    category: "Dish",
    dept: "Kitchen",
    text: `Pan-Seared Prime Ribeye with Garlic Herb Butter
Department: Kitchen
Yield: 2 portions
Target Selling Price: $38.00 per portion

Ingredients:
- 24 oz Prime Ribeye Steak (2 steaks, 12 oz each)
- 4 tbsp Unsalted Butter (softened)
- 4 cloves Fresh Garlic (minced)
- 2 sprigs Fresh Rosemary (chopped)
- 2 sprigs Fresh Thyme (chopped)
- 1 tbsp Olive Oil
- 1.5 tsp Kosher Salt
- 1 tsp Coarse Ground Black Pepper
- 0.75 lb Fresh Asparagus (trimmed)

Notes: Prime cut beef, high margin centerpiece dish. Serve medium-rare.`
  },
  {
    title: "🍫 Valrhona Lava Cake",
    category: "Dish",
    dept: "Pastry",
    text: `Molten Chocolate Lava Cake
Department: Pastry
Yield: 6 servings
Target Selling Price: $11.50 each

Ingredients:
- 200g Dark Semisweet Chocolate (Valrhona 70%)
- 100g Unsalted Butter
- 3 Large Eggs
- 3 Egg Yolks
- 50g Granulated White Sugar
- 30g All-Purpose Flour
- 1 tsp Pure Vanilla Extract
- 1 pinch Fine Sea Salt
- 100g Fresh Raspberries (for garnish)
- 50g Powdered Confectioners Sugar

Instructions:
1. Melt chocolate and butter over a double boiler.
2. Whisk whole eggs, yolks, and sugar until pale and frothy. Fold into chocolate.
3. Fold in flour and salt. Pour into 6 greased ramekins.
4. Bake at 425°F for 12 minutes until edges are firm and center is molten.`
  },
  {
    title: "🍸 Passionfruit Mojito",
    category: "Dish",
    dept: "Bar",
    text: `Craft Passionfruit Mojito
Department: Bar
Yield: 1 cocktail portion
Target Selling Price: $14.00

Ingredients:
- 2 oz White Rum
- 1.5 oz Passionfruit Puree
- 1 oz Fresh Lime Juice
- 0.75 oz Simple Syrup
- 10 Fresh Mint Leaves
- 4 oz Club Soda
- 1 cup Crushed Ice`
  }
];

const STANDARD_CULINARY_UNITS = [
  "lbs", "lb", "oz", "g", "kg", "ml", "L", "fl oz", "cup", "tbsp", "tsp",
  "pcs", "portion", "slice", "bunch", "clove", "scoop", "drizzle", "sprig",
  "pinch", "can", "bottle", "bag", "box", "case", "pt", "qt", "gal", "head", "unit"
];

// Searchable & Custom Unit Selector Dropdown Component
interface UnitSelectorProps {
  value: string;
  onChange: (newUnit: string) => void;
  availableUnits: string[];
  catalogUnits: string[];
  customUnits: string[];
  onAddNewCustomUnit: (unit: string) => void;
}

function UnitSelector({
  value,
  onChange,
  availableUnits,
  catalogUnits,
  customUnits,
  onAddNewCustomUnit
}: UnitSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredCatalog = catalogUnits.filter((u) =>
    u.toLowerCase().includes(query.toLowerCase().trim())
  );
  const filteredCustom = customUnits.filter((u) =>
    u.toLowerCase().includes(query.toLowerCase().trim())
  );
  const filteredStandard = STANDARD_CULINARY_UNITS.filter(
    (u) =>
      u.toLowerCase().includes(query.toLowerCase().trim()) &&
      !catalogUnits.includes(u) &&
      !customUnits.includes(u)
  );

  const trimmedQuery = query.trim();
  const canCreateNew =
    trimmedQuery.length > 0 &&
    !availableUnits.some((u) => u.toLowerCase() === trimmedQuery.toLowerCase());

  const handleSelect = (unit: string) => {
    onChange(unit);
    setIsOpen(false);
    setQuery("");
  };

  const handleCreateAndSelect = () => {
    if (!trimmedQuery) return;
    onAddNewCustomUnit(trimmedQuery);
    onChange(trimmedQuery);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded-lg px-2 py-1 text-xs font-bold font-mono text-neutral-900 flex items-center justify-between gap-1 focus:outline-hidden focus:border-emerald-500 transition-colors cursor-pointer"
      >
        <span className="truncate">{value || "unit"}</span>
        <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 max-h-64 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input */}
          <div className="p-2 border-b border-neutral-100 bg-neutral-50/70">
            <div className="relative">
              <Search className="w-3 h-3 text-neutral-400 absolute left-2 top-2" />
              <input
                type="text"
                autoFocus
                placeholder="Search or type unit..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (canCreateNew) {
                      handleCreateAndSelect();
                    } else if (filteredCatalog.length > 0) {
                      handleSelect(filteredCatalog[0]);
                    } else if (filteredCustom.length > 0) {
                      handleSelect(filteredCustom[0]);
                    } else if (filteredStandard.length > 0) {
                      handleSelect(filteredStandard[0]);
                    }
                  }
                }}
                className="w-full pl-6 pr-2 py-1 text-xs font-bold bg-white border border-neutral-200 rounded-md focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Unit List Options */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-1 text-xs">
            {/* Create Custom Unit Prompt */}
            {canCreateNew && (
              <div className="p-1">
                <button
                  type="button"
                  onClick={handleCreateAndSelect}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    + Create Custom Unit: &quot;<strong>{trimmedQuery}</strong>&quot;
                  </span>
                </button>
              </div>
            )}

            {/* Custom User Units */}
            {filteredCustom.length > 0 && (
              <div className="py-1">
                <div className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 font-mono">
                  Custom Created Units
                </div>
                {filteredCustom.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleSelect(u)}
                    className={`w-full text-left px-2.5 py-1 rounded-md flex items-center justify-between cursor-pointer ${
                      value.toLowerCase() === u.toLowerCase()
                        ? "bg-amber-50 text-amber-950 font-bold"
                        : "hover:bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    <span>{u}</span>
                    <span className="text-[9px] text-amber-600 font-mono">custom</span>
                  </button>
                ))}
              </div>
            )}

            {/* Kitchen Catalog Units */}
            {filteredCatalog.length > 0 && (
              <div className="py-1">
                <div className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 font-mono">
                  Used in Master Catalog
                </div>
                {filteredCatalog.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleSelect(u)}
                    className={`w-full text-left px-2.5 py-1 rounded-md flex items-center justify-between cursor-pointer ${
                      value.toLowerCase() === u.toLowerCase()
                        ? "bg-emerald-50 text-emerald-950 font-bold"
                        : "hover:bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    <span>{u}</span>
                    <span className="text-[9px] text-emerald-600 font-mono">catalog</span>
                  </button>
                ))}
              </div>
            )}

            {/* Standard Culinary Units */}
            {filteredStandard.length > 0 && (
              <div className="py-1">
                <div className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                  Standard Units
                </div>
                {filteredStandard.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleSelect(u)}
                    className={`w-full text-left px-2.5 py-1 rounded-md flex items-center justify-between cursor-pointer ${
                      value.toLowerCase() === u.toLowerCase()
                        ? "bg-neutral-100 text-neutral-900 font-bold"
                        : "hover:bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    <span>{u}</span>
                    {value.toLowerCase() === u.toLowerCase() && (
                      <Check className="w-3 h-3 text-emerald-600" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {filteredCatalog.length === 0 &&
              filteredCustom.length === 0 &&
              filteredStandard.length === 0 &&
              !canCreateNew && (
                <div className="p-3 text-center text-xs text-neutral-400 italic">
                  No matching units found
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIRecipeModal({
  isOpen,
  onClose,
  ingredients,
  recipes,
  customDepts,
  customUnits: propCustomUnits,
  onAddCustomUnit,
  onAddDept,
  onSaveRecipe,
  onLoadIntoBuilder,
}: AIRecipeModalProps) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [recipeText, setRecipeText] = useState("");
  const [targetDept, setTargetDept] = useState("AUTO");
  const [targetFoodCostMargin, setTargetFoodCostMargin] = useState(30);
  const [isSubRecipeMode, setIsSubRecipeMode] = useState(false);
  const [autoConvertToLbs, setAutoConvertToLbs] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Extracted recipes state
  const [parsedRecipes, setParsedRecipes] = useState<ParsedRecipe[]>([]);
  const [activeRecipeIdx, setActiveRecipeIdx] = useState(0);

  // Custom Units State with Local Persistence
  const [localCustomUnits, setLocalCustomUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("culinary_custom_units");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showCustomUnitModal, setShowCustomUnitModal] = useState(false);
  const [newCustomUnitInput, setNewCustomUnitInput] = useState("");

  // New Department Form state
  const [showDeptInput, setShowDeptInput] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Combine custom units
  const effectiveCustomUnits = useMemo(() => {
    const combined = new Set<string>();
    (propCustomUnits || []).forEach((u) => combined.add(u));
    localCustomUnits.forEach((u) => combined.add(u));
    return Array.from(combined);
  }, [propCustomUnits, localCustomUnits]);

  // Extract all catalog units used across the master ingredients
  const catalogUnits = useMemo(() => {
    const set = new Set<string>();
    ingredients.forEach((ing) => {
      if (ing.unit) set.add(ing.unit.trim());
      if (ing.packagingUnit) set.add(ing.packagingUnit.trim());
      if (ing.weightPerCaseUnit) set.add(ing.weightPerCaseUnit.trim());
    });
    return Array.from(set).filter(Boolean);
  }, [ingredients]);

  // Combined master available units
  const allAvailableUnits = useMemo(() => {
    const combined = new Set<string>();
    catalogUnits.forEach((u) => combined.add(u));
    effectiveCustomUnits.forEach((u) => combined.add(u));
    STANDARD_CULINARY_UNITS.forEach((u) => combined.add(u));
    return Array.from(combined);
  }, [catalogUnits, effectiveCustomUnits]);

  // Handler to register a new custom unit
  const handleAddNewCustomUnit = (unitName: string) => {
    const trimmed = unitName.trim();
    if (!trimmed) return;
    if (!effectiveCustomUnits.some((u) => u.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...effectiveCustomUnits, trimmed];
      setLocalCustomUnits(updated);
      try {
        localStorage.setItem("culinary_custom_units", JSON.stringify(updated));
      } catch {}
      if (onAddCustomUnit) {
        onAddCustomUnit(trimmed);
      }
    }
    setNewCustomUnitInput("");
    setShowCustomUnitModal(false);
  };

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setStep("input");
      setErrorMessage("");
      setSaveSuccessMsg("");
      setIsLoading(false);
      setIsSubRecipeMode(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper to match ingredient against catalog
  const findBestIngredientMatch = (
    itemName: string,
    suggestedId?: string,
    suggestedName?: string
  ): Ingredient | undefined => {
    if (suggestedId) {
      const byId = ingredients.find((ing) => ing.id === suggestedId);
      if (byId) return byId;
    }
    if (suggestedName) {
      const byName = ingredients.find(
        (ing) => ing.name.toLowerCase() === suggestedName.toLowerCase()
      );
      if (byName) return byName;
    }
    const clean = itemName.toLowerCase().trim();
    // Exact name match
    const exact = ingredients.find((ing) => ing.name.toLowerCase() === clean);
    if (exact) return exact;

    // Substring / fuzzy match
    return ingredients.find((ing) => {
      const ingClean = ing.name.toLowerCase();
      return ingClean.includes(clean) || clean.includes(ingClean);
    });
  };

  // Helper to match sub-recipe
  const findBestSubRecipeMatch = (
    itemName: string,
    suggestedId?: string
  ): Recipe | undefined => {
    if (suggestedId) {
      const byId = recipes.find((r) => r.id === suggestedId);
      if (byId) return byId;
    }
    const clean = itemName.toLowerCase().trim();
    return recipes.find(
      (r) => r.name.toLowerCase().includes(clean) || clean.includes(r.name.toLowerCase())
    );
  };

  // Parse Text via Backend Gemini Endpoint
  const handleGenerateRecipe = async () => {
    if (!recipeText.trim()) {
      setErrorMessage("Please enter or paste recipe text or culinary notes to parse.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setLoadingPhase("Analyzing culinary text with Gemini...");

    const phases = [
      "Analyzing ingredients, units & measurements...",
      "Converting units based on your kitchen's standard roster...",
      "Auto-matching ingredients with master catalog & sub-recipes...",
      "Computing portions, batch costs, and target margins...",
    ];
    let phaseIdx = 0;
    const interval = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % phases.length;
      setLoadingPhase(phases[phaseIdx]);
    }, 1200);

    try {
      const response = await fetch("/api/parse-recipe-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: recipeText,
          department: targetDept,
          targetFoodCostMargin: targetFoodCostMargin,
          masterIngredients: ingredients,
          existingRecipes: recipes.map((r) => ({
            id: r.id,
            name: r.name,
            department: r.department,
            sellingPrice: r.sellingPrice,
            costPerPortion: r.costPerPortion,
            totalCost: r.totalCost,
            expectedYield: r.expectedYield,
          })),
        }),
      });

      clearInterval(interval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      if (!data.recipes || !Array.isArray(data.recipes) || data.recipes.length === 0) {
        throw new Error(
          "No structured recipes could be extracted from the provided text. Please check your text and try again."
        );
      }

      // Enhance parsed recipes with direct catalog references and sub-recipe logic
      const enhancedRecipes: ParsedRecipe[] = data.recipes.map((rec: any) => {
        const isThisSubRecipe =
          isSubRecipeMode ||
          rec.isSubRecipe === true ||
          rec.sellingPrice === 0 ||
          (rec.recipeName || "").toLowerCase().includes("sub-recipe") ||
          (rec.recipeName || "").toLowerCase().includes("base") ||
          (rec.recipeName || "").toLowerCase().includes("sauce prep");

        const items: ParsedRecipeItem[] = (rec.items || []).map((item: any) => {
          let matchedIng: Ingredient | undefined;
          let matchedSub: Recipe | undefined;

          if (item.isSubRecipe) {
            matchedSub = findBestSubRecipeMatch(item.name, item.matchedSubRecipeId);
          } else {
            matchedIng = findBestIngredientMatch(
              item.name,
              item.matchedIngredientId,
              item.matchedIngredientName
            );
            if (!matchedIng) {
              matchedSub = findBestSubRecipeMatch(item.name);
            }
          }

          let qty = Number(item.quantity) || 1;
          let unit = item.unit || "g";
          let grams = item.grams ? Number(item.grams) : getGramsOrMlEquivalent(qty, unit);

          // Auto-convert weight units to lbs if option is active and not a sub-recipe portion
          if (autoConvertToLbs && !item.isSubRecipe && !matchedSub && isWeightUnit(unit)) {
            const converted = convertWeightToLbs(qty, unit);
            qty = converted.quantity;
            unit = "lbs";
            grams = converted.grams;
          }

          return {
            name: item.name || "Unnamed Ingredient",
            rawText: item.rawText || `${qty} ${unit} ${item.name}`,
            quantity: qty,
            unit: unit,
            grams: grams > 0 ? grams : qty,
            matchedIngredientId: matchedIng?.id || (!matchedSub ? item.matchedIngredientId : undefined),
            matchedIngredientName: matchedIng?.name || item.matchedIngredientName,
            isSubRecipe: !!matchedSub || !!item.isSubRecipe,
            matchedSubRecipeId: matchedSub?.id || item.matchedSubRecipeId,
          };
        });

        const dept =
          targetDept !== "AUTO"
            ? targetDept
            : rec.department || (customDepts[0] || "Kitchen");

        return {
          recipeName: rec.recipeName || "Untitled Recipe",
          department: dept,
          expectedYield: Math.max(1, Number(rec.expectedYield) || 1),
          sellingPrice: isThisSubRecipe ? 0 : Math.max(0, Number(rec.sellingPrice) || 0),
          isSubRecipe: isThisSubRecipe,
          instructions: rec.instructions || "",
          notes: rec.notes || "",
          items,
        };
      });

      setParsedRecipes(enhancedRecipes);
      setActiveRecipeIdx(0);
      setStep("review");
    } catch (err: any) {
      console.error("AI Recipe Parse error:", err);
      setErrorMessage(err.message || "Failed to generate recipe from text.");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate live financial figures for the active recipe
  const activeRecipe = parsedRecipes[activeRecipeIdx] || null;

  const calculateActiveRecipeFinancials = () => {
    if (!activeRecipe) {
      return {
        totalCost: 0,
        costPerPortion: 0,
        sellingPrice: 0,
        profitMargin: 0,
        foodCostPercent: 0,
        matchedCount: 0,
        totalItems: 0,
      };
    }

    let totalCost = 0;
    let matchedCount = 0;

    activeRecipe.items.forEach((item) => {
      if (item.isSubRecipe && item.matchedSubRecipeId) {
        const sub = recipes.find((r) => r.id === item.matchedSubRecipeId);
        if (sub) {
          matchedCount++;
          const subCost =
            sub.costPerPortion || (sub.totalCost / (sub.expectedYield || 1)) || 0;
          totalCost += item.quantity * subCost;
        }
      } else {
        const ing = ingredients.find(
          (i) =>
            i.id === item.matchedIngredientId ||
            i.name.toLowerCase() === item.matchedIngredientName?.toLowerCase()
        );
        if (ing) {
          matchedCount++;
          const unitRate = calculateIngredientUnitPrice(ing);
          const yieldPercent =
            ing.usabilityPercentage !== undefined ? ing.usabilityPercentage : 100;
          const effectiveRate =
            yieldPercent > 0 ? unitRate / (yieldPercent / 100) : unitRate;
          totalCost += item.grams * effectiveRate;
        }
      }
    });

    const yieldCount = Math.max(1, activeRecipe.expectedYield || 1);
    const costPerPortion = totalCost / yieldCount;
    const price = activeRecipe.sellingPrice || 0;
    const profitMargin = price > 0 ? ((price - costPerPortion) / price) * 100 : 0;
    const foodCostPercent = price > 0 ? (costPerPortion / price) * 100 : 0;

    return {
      totalCost,
      costPerPortion,
      sellingPrice: price,
      profitMargin,
      foodCostPercent,
      matchedCount,
      totalItems: activeRecipe.items.length,
    };
  };

  const financials = calculateActiveRecipeFinancials();

  // Updates to active recipe fields
  const updateActiveRecipe = (patch: Partial<ParsedRecipe>) => {
    setParsedRecipes((prev) => {
      const copy = [...prev];
      if (!copy[activeRecipeIdx]) return prev;
      copy[activeRecipeIdx] = { ...copy[activeRecipeIdx], ...patch };
      return copy;
    });
  };

  const updateActiveRecipeItem = (itemIdx: number, patch: Partial<ParsedRecipeItem>) => {
    setParsedRecipes((prev) => {
      const copy = [...prev];
      if (!copy[activeRecipeIdx]) return prev;
      const itemsCopy = [...copy[activeRecipeIdx].items];
      if (!itemsCopy[itemIdx]) return prev;

      const oldItem = itemsCopy[itemIdx];
      const updatedItem = { ...oldItem, ...patch };

      // If unit changed to lbs/lb from another weight unit, automatically convert quantity
      if (patch.unit !== undefined && patch.unit !== oldItem.unit) {
        const oldUnit = oldItem.unit;
        const newUnit = patch.unit;
        const currentQty = patch.quantity !== undefined ? patch.quantity : oldItem.quantity;
        
        if (
          !oldItem.isSubRecipe &&
          isWeightUnit(oldUnit) &&
          (newUnit === "lbs" || newUnit === "lb" || newUnit === "pound" || newUnit === "pounds")
        ) {
          const converted = convertWeightToLbs(currentQty, oldUnit);
          updatedItem.quantity = converted.quantity;
          updatedItem.unit = "lbs";
          updatedItem.grams = converted.grams;
        } else {
          const qty = patch.quantity !== undefined ? patch.quantity : oldItem.quantity;
          updatedItem.grams = getGramsOrMlEquivalent(qty, newUnit) || qty;
        }
      } else if (patch.quantity !== undefined) {
        const qty = patch.quantity;
        const unit = patch.unit !== undefined ? patch.unit : oldItem.unit;
        updatedItem.grams = getGramsOrMlEquivalent(qty, unit) || qty;
      }

      itemsCopy[itemIdx] = updatedItem;
      copy[activeRecipeIdx] = { ...copy[activeRecipeIdx], items: itemsCopy };
      return copy;
    });
  };

  // Convert all weight items in active recipe to lbs
  const convertAllActiveRecipeWeightsToLbs = () => {
    setParsedRecipes((prev) => {
      const copy = [...prev];
      if (!copy[activeRecipeIdx]) return prev;
      const itemsCopy = copy[activeRecipeIdx].items.map((item) => {
        if (item.isSubRecipe || !isWeightUnit(item.unit)) return item;
        const converted = convertWeightToLbs(item.quantity, item.unit);
        return {
          ...item,
          quantity: converted.quantity,
          unit: "lbs",
          grams: converted.grams,
        };
      });
      copy[activeRecipeIdx] = { ...copy[activeRecipeIdx], items: itemsCopy };
      return copy;
    });
  };

  const removeActiveRecipeItem = (itemIdx: number) => {
    setParsedRecipes((prev) => {
      const copy = [...prev];
      if (!copy[activeRecipeIdx]) return prev;
      const itemsCopy = copy[activeRecipeIdx].items.filter((_, i) => i !== itemIdx);
      copy[activeRecipeIdx] = { ...copy[activeRecipeIdx], items: itemsCopy };
      return copy;
    });
  };

  const addActiveRecipeItem = () => {
    setParsedRecipes((prev) => {
      const copy = [...prev];
      if (!copy[activeRecipeIdx]) return prev;
      const newItem: ParsedRecipeItem = {
        name: "New Ingredient",
        quantity: autoConvertToLbs ? 1 : 100,
        unit: autoConvertToLbs ? "lbs" : "g",
        grams: autoConvertToLbs ? 453.592 : 100,
        isSubRecipe: false,
      };
      copy[activeRecipeIdx] = {
        ...copy[activeRecipeIdx],
        items: [...copy[activeRecipeIdx].items, newItem],
      };
      return copy;
    });
  };

  // Convert parsed recipe item to database RecipeIngredientRef format
  const buildRecipeIngredientRefs = (items: ParsedRecipeItem[]): RecipeIngredientRef[] => {
    return items.map((item) => {
      if (item.isSubRecipe && item.matchedSubRecipeId) {
        return {
          ingredientId: item.matchedSubRecipeId,
          subRecipeId: item.matchedSubRecipeId,
          isSubRecipe: true,
          name: item.name,
          grams: item.quantity, // for sub-recipes, grams field represents portions count
        };
      }
      return {
        ingredientId: item.matchedIngredientId || "",
        name: item.matchedIngredientName || item.name,
        grams: item.grams > 0 ? item.grams : item.quantity,
        isSubRecipe: false,
      };
    });
  };

  // Save current active recipe to database
  const handleSaveActiveToCatalog = async () => {
    if (!activeRecipe) return;
    try {
      setIsLoading(true);
      const ingredientRefs = buildRecipeIngredientRefs(activeRecipe.items);

      const payload: Omit<Recipe, "id" | "ownerId" | "updatedAt"> = {
        name: activeRecipe.recipeName,
        ingredients: ingredientRefs,
        sellingPrice: activeRecipe.isSubRecipe ? 0 : activeRecipe.sellingPrice || 0,
        expectedYield: activeRecipe.expectedYield || 1,
        costPerPortion: financials.costPerPortion,
        totalCost: financials.totalCost,
        profitMargin: activeRecipe.isSubRecipe ? 0 : financials.profitMargin,
        department: activeRecipe.department || "Kitchen",
      };

      await onSaveRecipe(payload);
      setSaveSuccessMsg(
        `✓ Successfully created ${
          activeRecipe.isSubRecipe ? "sub-recipe" : "recipe cost sheet"
        } for "${activeRecipe.recipeName}"!`
      );
      setTimeout(() => {
        setSaveSuccessMsg("");
      }, 4000);
    } catch (err: any) {
      console.error("Save recipe error:", err);
      setErrorMessage(err.message || "Failed to save recipe to catalog.");
    } finally {
      setIsLoading(false);
    }
  };

  // Save all parsed recipes to database
  const handleSaveAllToCatalog = async () => {
    if (parsedRecipes.length === 0) return;
    try {
      setIsLoading(true);
      for (const rec of parsedRecipes) {
        let totalCost = 0;
        const ingredientRefs = buildRecipeIngredientRefs(rec.items);

        rec.items.forEach((item) => {
          if (item.isSubRecipe && item.matchedSubRecipeId) {
            const sub = recipes.find((r) => r.id === item.matchedSubRecipeId);
            if (sub) {
              const subCost =
                sub.costPerPortion || (sub.totalCost / (sub.expectedYield || 1)) || 0;
              totalCost += item.quantity * subCost;
            }
          } else {
            const ing = ingredients.find(
              (i) =>
                i.id === item.matchedIngredientId ||
                i.name.toLowerCase() === item.matchedIngredientName?.toLowerCase()
            );
            if (ing) {
              const unitRate = calculateIngredientUnitPrice(ing);
              const yieldPercent =
                ing.usabilityPercentage !== undefined ? ing.usabilityPercentage : 100;
              const effectiveRate =
                yieldPercent > 0 ? unitRate / (yieldPercent / 100) : unitRate;
              totalCost += item.grams * effectiveRate;
            }
          }
        });

        const yieldCount = Math.max(1, rec.expectedYield || 1);
        const costPerPortion = totalCost / yieldCount;
        const price = rec.isSubRecipe ? 0 : rec.sellingPrice || 0;
        const profitMargin = price > 0 ? ((price - costPerPortion) / price) * 100 : 0;

        await onSaveRecipe({
          name: rec.recipeName,
          ingredients: ingredientRefs,
          sellingPrice: price,
          expectedYield: yieldCount,
          costPerPortion,
          totalCost,
          profitMargin,
          department: rec.department || "Kitchen",
        });
      }

      setSaveSuccessMsg(`✓ All ${parsedRecipes.length} recipes saved to catalog successfully!`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Batch save error:", err);
      setErrorMessage(err.message || "Failed to batch save recipes.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load into manual Recipe Builder
  const handleLoadIntoBuilder = () => {
    if (!activeRecipe) return;
    const ingredientRefs = buildRecipeIngredientRefs(activeRecipe.items);

    onLoadIntoBuilder({
      name: activeRecipe.recipeName,
      sellingPrice: (activeRecipe.isSubRecipe ? 0 : activeRecipe.sellingPrice || 0).toString(),
      expectedYield: (activeRecipe.expectedYield || 1).toString(),
      department: activeRecipe.department || "Kitchen",
      recipeIngs: ingredientRefs,
    });
    onClose();
  };

  // Create new department inline
  const handleCreateNewDept = async () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) return;
    try {
      await onAddDept(trimmed);
      setTargetDept(trimmed);
      if (activeRecipe) {
        updateActiveRecipe({ department: trimmed });
      }
      setNewDeptName("");
      setShowDeptInput(false);
    } catch (err) {
      console.error("Error creating department:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-900/60 backdrop-blur-xs font-sans overflow-y-auto animate-in fade-in duration-200"
      id="ai-recipe-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white border border-neutral-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-neutral-900"
        id="ai-recipe-modal-container"
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-neutral-900 text-white flex items-center justify-between shrink-0 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  AI Recipe Cost Sheet & Sub-Recipe Creator
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Generate portion-costed finished recipes & prep sub-recipes from raw text, with custom unit support.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCustomUnitModal(true)}
              className="text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Tag className="w-3 h-3 text-emerald-400" />
              <span>+ Custom Unit</span>
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
              id="close-ai-recipe-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success / Notification Bar */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-emerald-900 text-xs font-bold animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </div>
            <button
              onClick={() => setSaveSuccessMsg("")}
              className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Notification Bar */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-red-900 text-xs font-bold animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage("")}
              className="text-red-700 hover:text-red-900 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#fbfbf9]">
          {step === "input" ? (
            /* ========================================================================= */
            /* STEP 1: TEXT INPUT & CONFIGURATION                                       */
            /* ========================================================================= */
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Quick Sample Prompts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
                    Load Sample Recipe or Sub-Recipe Template
                  </label>
                  <span className="text-[11px] text-neutral-500">1-click to test AI cost engine</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_RECIPES.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setRecipeText(sample.text);
                        setIsSubRecipeMode(sample.category === "Sub-Recipe");
                        if (sample.dept && customDepts.includes(sample.dept)) {
                          setTargetDept(sample.dept);
                        }
                      }}
                      className={`text-xs font-medium px-3 py-1.5 rounded-xl transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer border ${
                        sample.category === "Sub-Recipe"
                          ? "bg-amber-50/80 hover:bg-amber-100/90 border-amber-200 text-amber-900 font-bold"
                          : "bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700"
                      }`}
                    >
                      <span>{sample.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Text Input Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    Paste Recipe Text, Ingredients, or Kitchen Notes *
                  </label>
                  {recipeText && (
                    <button
                      type="button"
                      onClick={() => setRecipeText("")}
                      className="text-[11px] text-neutral-500 hover:text-red-600 font-medium transition-colors cursor-pointer"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    id="ai-recipe-text-input"
                    rows={9}
                    placeholder={`e.g.
Artisan Margherita Pizza (or Tomato Sauce Sub-Recipe)
Yield: 4 servings
Target Price: $16.50

Ingredients:
- 500g All-Purpose Flour
- 325ml Warm Water
- 7g Active Dry Yeast
- 10g Kosher Salt
- 250g San Marzano Tomatoes
- 300g Fresh Mozzarella
- 15g Fresh Basil

Method:
Knead dough, ferment for 24h, stretch, top, and bake at 500°F until blistered.`}
                    value={recipeText}
                    onChange={(e) => setRecipeText(e.target.value)}
                    className="w-full bg-white border border-neutral-200 focus:border-emerald-500 rounded-xl p-4 text-xs font-mono leading-relaxed focus:outline-hidden shadow-2xs resize-y"
                  />
                  {!recipeText && (
                    <div className="absolute bottom-3 right-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) setRecipeText(text);
                          } catch {}
                        }}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-neutral-200 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Clipboard className="w-3 h-3" />
                        <span>Paste from Clipboard</span>
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 mt-1.5 italic">
                  Tip: Supports full menus, single recipes, or batch sub-recipes (sauce bases, dressings, doughs, compound butters). Custom units like scoops, cloves, and slices are fully supported.
                </p>
              </div>

              {/* Sub-Recipe Mode & Target Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-neutral-200">
                {/* Sub-Recipe Checkbox */}
                <div className="sm:col-span-3 flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="sub-recipe-toggle"
                      checked={isSubRecipeMode}
                      onChange={(e) => setIsSubRecipeMode(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300 cursor-pointer"
                    />
                    <label htmlFor="sub-recipe-toggle" className="cursor-pointer text-left">
                      <span className="text-xs font-bold text-amber-950 block">
                        🥫 Create as Sub-Recipe / Prep Batch
                      </span>
                      <span className="text-[11px] text-amber-800/80 block">
                        For sauce bases, doughs, stocks, dressings, and prep batches used in finished dishes.
                      </span>
                    </label>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 shrink-0">
                    {isSubRecipeMode ? "Sub-Recipe (Non-Sale)" : "Menu Dish (For Sale)"}
                  </span>
                </div>

                {/* Auto Convert to LBS toggle */}
                <div className="sm:col-span-3 flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="auto-lbs-toggle"
                      checked={autoConvertToLbs}
                      onChange={(e) => setAutoConvertToLbs(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300 cursor-pointer"
                    />
                    <label htmlFor="auto-lbs-toggle" className="cursor-pointer text-left">
                      <span className="text-xs font-bold text-emerald-950 block flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-emerald-700 inline" />
                        Auto-Convert Weight Units to Pounds (lbs)
                      </span>
                      <span className="text-[11px] text-emerald-800/80 block">
                        Automatically standardizes grams (g), kilograms (kg), and ounces (oz) to decimal lbs. Volume & discrete units (ml, cup, clove, pcs) are preserved.
                      </span>
                    </label>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 shrink-0">
                    {autoConvertToLbs ? "Auto lbs: ON" : "Original Units"}
                  </span>
                </div>

                {/* Department */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-neutral-500" />
                      Department
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDeptInput((prev) => !prev)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{showDeptInput ? "Cancel" : "New"}</span>
                    </button>
                  </div>

                  {showDeptInput ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. Pastry, Bar"
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                        className="flex-1 bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs font-bold focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleCreateNewDept}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <select
                      value={targetDept}
                      onChange={(e) => setTargetDept(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden"
                    >
                      <option value="AUTO">✨ Auto-Detect</option>
                      {customDepts.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Target Food Cost Margin */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-neutral-800 flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-neutral-500" />
                      Target Food Cost %
                    </span>
                    <span className="text-emerald-700 font-mono font-bold text-xs">
                      {targetFoodCostMargin}% ({100 - targetFoodCostMargin}% Margin)
                    </span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={15}
                      max={50}
                      step={1}
                      value={targetFoodCostMargin}
                      onChange={(e) => setTargetFoodCostMargin(Number(e.target.value))}
                      className="flex-1 accent-emerald-600 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
                    />
                    <input
                      type="number"
                      min={10}
                      max={60}
                      value={targetFoodCostMargin}
                      onChange={(e) => setTargetFoodCostMargin(Number(e.target.value))}
                      className="w-16 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-bold font-mono text-center focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* STEP 2: INTERACTIVE REVIEW & COSTING WORKSPACE                           */
            /* ========================================================================= */
            <div className="space-y-6">
              {/* Multi-Recipe Tab Switcher (if batch parsed) */}
              {parsedRecipes.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-neutral-200">
                  <span className="text-xs font-bold text-neutral-500 whitespace-nowrap">
                    Extracted Cost Sheets ({parsedRecipes.length}):
                  </span>
                  {parsedRecipes.map((rec, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveRecipeIdx(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                        activeRecipeIdx === idx
                          ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                          : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100"
                      }`}
                    >
                      {rec.isSubRecipe ? (
                        <span className="text-amber-400 text-xs">🥫</span>
                      ) : (
                        <ChefHat className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{rec.recipeName || `Recipe #${idx + 1}`}</span>
                      <span className="text-[10px] opacity-75 font-mono">
                        ({rec.items.length} items)
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {activeRecipe && (
                <>
                  {/* Top Recipe Settings Card */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs">
                    {/* Recipe Classification & Sub-Recipe Switch */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-700">Cost Sheet Type:</span>
                        <div className="inline-flex bg-neutral-100 p-0.5 rounded-xl border border-neutral-200">
                          <button
                            type="button"
                            onClick={() => updateActiveRecipe({ isSubRecipe: false })}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                              !activeRecipe.isSubRecipe
                                ? "bg-white text-neutral-900 shadow-2xs"
                                : "text-neutral-500 hover:text-neutral-900"
                            }`}
                          >
                            🍽️ Finished Menu Dish
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveRecipe({ isSubRecipe: true, sellingPrice: 0 })
                            }
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                              activeRecipe.isSubRecipe
                                ? "bg-amber-100 text-amber-900 shadow-2xs font-bold"
                                : "text-neutral-500 hover:text-neutral-900"
                            }`}
                          >
                            <span>🥫 Sub-Recipe / Prep Batch</span>
                          </button>
                        </div>
                      </div>

                      {activeRecipe.isSubRecipe ? (
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                          Sub-Recipe (Can be used as ingredient in other dishes)
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                          Customer Menu Item (For Direct Sale)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Recipe Name */}
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Recipe / Sub-Recipe Name *
                        </label>
                        <input
                          type="text"
                          value={activeRecipe.recipeName}
                          onChange={(e) => updateActiveRecipe({ recipeName: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>

                      {/* Department */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Department
                        </label>
                        <select
                          value={activeRecipe.department}
                          onChange={(e) => updateActiveRecipe({ department: e.target.value })}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                        >
                          {customDepts.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Expected Yield / Portions */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                          Batch Yield (Portions / Servings)
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={activeRecipe.expectedYield}
                          onChange={(e) =>
                            updateActiveRecipe({
                              expectedYield: Math.max(1, parseFloat(e.target.value) || 1),
                            })
                          }
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-neutral-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Financial KPI Banner */}
                    <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Selling Price / Non-Sale status */}
                      <div className="bg-[#f7f6f2] p-3 rounded-xl border border-neutral-200/80">
                        <span className="text-[10px] font-bold text-neutral-500 block mb-0.5">
                          {activeRecipe.isSubRecipe ? "Sale Status" : "Menu Selling Price"}
                        </span>
                        {activeRecipe.isSubRecipe ? (
                          <span className="text-xs font-bold text-amber-900 font-mono flex items-center gap-1">
                            Non-Sale ($0.00)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-neutral-500">$</span>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={activeRecipe.sellingPrice || ""}
                              onChange={(e) =>
                                updateActiveRecipe({
                                  sellingPrice: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-bold font-mono text-neutral-900 focus:outline-hidden"
                            />
                          </div>
                        )}
                      </div>

                      {/* Total Cost */}
                      <div className="bg-[#f7f6f2] p-3 rounded-xl border border-neutral-200/80">
                        <span className="text-[10px] font-bold text-neutral-500 block mb-0.5">
                          Total Batch Cost
                        </span>
                        <span className="text-xs font-bold font-mono text-neutral-900">
                          ${financials.totalCost.toFixed(2)}
                        </span>
                      </div>

                      {/* Cost Per Portion */}
                      <div className="bg-[#f7f6f2] p-3 rounded-xl border border-neutral-200/80">
                        <span className="text-[10px] font-bold text-neutral-500 block mb-0.5">
                          Cost Per Portion
                        </span>
                        <span className="text-xs font-bold font-mono text-emerald-800">
                          ${financials.costPerPortion.toFixed(2)} / serving
                        </span>
                      </div>

                      {/* Profit Margin % or Sub-Recipe indicator */}
                      {activeRecipe.isSubRecipe ? (
                        <div className="p-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-950">
                          <span className="text-[10px] font-bold opacity-75 block mb-0.5">
                            Sub-Recipe Rate
                          </span>
                          <span className="text-xs font-bold font-mono text-amber-900">
                            ${financials.costPerPortion.toFixed(2)}/portion
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`p-3 rounded-xl border ${
                            financials.profitMargin >= 70
                              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                              : financials.profitMargin >= 50
                              ? "bg-amber-50 border-amber-200 text-amber-950"
                              : "bg-red-50 border-red-200 text-red-950"
                          }`}
                        >
                          <span className="text-[10px] font-bold opacity-75 block mb-0.5">
                            Profit Margin (Food Cost)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold font-mono">
                              {financials.profitMargin.toFixed(1)}%
                            </span>
                            <span className="text-[10px] opacity-75 font-mono">
                              ({financials.foodCostPercent.toFixed(1)}% FC)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ingredients Table */}
                  <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="px-4 py-3 bg-[#f7f6f2] border-b border-neutral-200 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-neutral-900">
                          Ingredients & Components Breakdown ({activeRecipe.items.length})
                        </h4>
                        <span className="bg-white text-neutral-600 text-[10px] px-2 py-0.5 rounded-full border border-neutral-200 font-mono">
                          {financials.matchedCount}/{financials.totalItems} Matched
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={convertAllActiveRecipeWeightsToLbs}
                          className="bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="Convert all weight ingredients (g, kg, oz) in this recipe to lbs"
                        >
                          <Scale className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Convert Weights to lbs</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCustomUnitModal(true)}
                          className="bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-neutral-200 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Tag className="w-3 h-3 text-amber-600" />
                          <span>+ Custom Unit</span>
                        </button>
                        <button
                          type="button"
                          onClick={addActiveRecipeItem}
                          className="bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-neutral-200 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Add Item</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-200 text-[10px] font-bold text-neutral-500 uppercase bg-neutral-50/50 tracking-wider">
                            <th className="py-2.5 px-3">Item Type</th>
                            <th className="py-2.5 px-3">Ingredient / Sub-Recipe Name</th>
                            <th className="py-2.5 px-3 w-28">Quantity</th>
                            <th className="py-2.5 px-3 w-32">Unit</th>
                            <th className="py-2.5 px-3">Catalog Match & Unit Rate</th>
                            <th className="py-2.5 px-3 text-right w-24">Line Cost</th>
                            <th className="py-2.5 px-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 font-sans">
                          {activeRecipe.items.map((item, itemIdx) => {
                            const matchedIng = ingredients.find(
                              (i) =>
                                i.id === item.matchedIngredientId ||
                                i.name.toLowerCase() ===
                                  item.matchedIngredientName?.toLowerCase()
                            );
                            const matchedSub = recipes.find(
                              (r) => r.id === item.matchedSubRecipeId
                            );

                            let lineCost = 0;
                            if (item.isSubRecipe && matchedSub) {
                              const subCost =
                                matchedSub.costPerPortion ||
                                (matchedSub.totalCost / (matchedSub.expectedYield || 1)) ||
                                0;
                              lineCost = item.quantity * subCost;
                            } else if (matchedIng) {
                              const unitRate = calculateIngredientUnitPrice(matchedIng);
                              const yieldPercent =
                                matchedIng.usabilityPercentage !== undefined
                                  ? matchedIng.usabilityPercentage
                                  : 100;
                              const effectiveRate =
                                yieldPercent > 0 ? unitRate / (yieldPercent / 100) : unitRate;
                              lineCost = item.grams * effectiveRate;
                            }

                            return (
                              <tr
                                key={itemIdx}
                                className={`transition-colors ${
                                  item.isSubRecipe
                                    ? "bg-amber-50/30 hover:bg-amber-50/60"
                                    : "hover:bg-neutral-50/80"
                                }`}
                              >
                                {/* Item Type Selector */}
                                <td className="py-2.5 px-3 w-28">
                                  <select
                                    value={item.isSubRecipe ? "sub" : "ing"}
                                    onChange={(e) => {
                                      const isSub = e.target.value === "sub";
                                      updateActiveRecipeItem(itemIdx, {
                                        isSubRecipe: isSub,
                                        matchedIngredientId: isSub ? undefined : item.matchedIngredientId,
                                        matchedSubRecipeId: !isSub ? undefined : item.matchedSubRecipeId,
                                        unit: isSub ? "portion" : item.unit,
                                      });
                                    }}
                                    className={`text-[11px] font-bold px-2 py-1 rounded-md border focus:outline-hidden cursor-pointer ${
                                      item.isSubRecipe
                                        ? "bg-amber-100 text-amber-900 border-amber-300 font-mono"
                                        : "bg-neutral-100 text-neutral-800 border-neutral-200 font-mono"
                                    }`}
                                  >
                                    <option value="ing">Ingredient</option>
                                    <option value="sub">🥫 Sub-Recipe</option>
                                  </select>
                                </td>

                                {/* Item Name */}
                                <td className="py-2.5 px-3">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) =>
                                      updateActiveRecipeItem(itemIdx, { name: e.target.value })
                                    }
                                    className="w-full bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-emerald-500 focus:bg-white px-1.5 py-1 rounded text-xs font-bold text-neutral-900 focus:outline-hidden"
                                  />
                                  {item.rawText && item.rawText !== item.name && (
                                    <span className="block text-[10px] text-neutral-400 font-mono px-1.5 truncate max-w-[200px]">
                                      &quot;{item.rawText}&quot;
                                    </span>
                                  )}
                                </td>

                                {/* Quantity */}
                                <td className="py-2.5 px-3">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.001"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateActiveRecipeItem(itemIdx, {
                                        quantity: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full bg-white border border-neutral-200 rounded-lg px-2 py-1 text-xs font-bold font-mono text-neutral-900 focus:outline-hidden focus:border-emerald-500"
                                  />
                                </td>

                                {/* Custom Unit Selector */}
                                <td className="py-2.5 px-3">
                                  <UnitSelector
                                    value={item.unit}
                                    onChange={(newUnit) =>
                                      updateActiveRecipeItem(itemIdx, { unit: newUnit })
                                    }
                                    availableUnits={allAvailableUnits}
                                    catalogUnits={catalogUnits}
                                    customUnits={effectiveCustomUnits}
                                    onAddNewCustomUnit={handleAddNewCustomUnit}
                                  />
                                </td>

                                {/* Master Catalog / Sub-Recipe Match Dropdown */}
                                <td className="py-2.5 px-3">
                                  {item.isSubRecipe ? (
                                    <select
                                      value={item.matchedSubRecipeId || ""}
                                      onChange={(e) => {
                                        const subId = e.target.value;
                                        const sub = recipes.find((r) => r.id === subId);
                                        updateActiveRecipeItem(itemIdx, {
                                          matchedSubRecipeId: subId,
                                          matchedIngredientId: undefined,
                                          matchedIngredientName: sub?.name,
                                        });
                                      }}
                                      className={`w-full text-xs font-bold py-1.5 px-2 rounded-lg border focus:outline-hidden cursor-pointer ${
                                        matchedSub
                                          ? "bg-amber-50 border-amber-300 text-amber-950 font-bold"
                                          : "bg-red-50 border-red-300 text-red-900"
                                      }`}
                                    >
                                      <option value="">-- Select Sub-Recipe --</option>
                                      {recipes.map((r) => (
                                        <option key={r.id} value={r.id}>
                                          🥫 {r.name} (${(r.costPerPortion || 0).toFixed(2)}/portion)
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <select
                                      value={item.matchedIngredientId || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const ing = ingredients.find((i) => i.id === val);
                                        updateActiveRecipeItem(itemIdx, {
                                          isSubRecipe: false,
                                          matchedSubRecipeId: undefined,
                                          matchedIngredientId: val,
                                          matchedIngredientName: ing?.name,
                                        });
                                      }}
                                      className={`w-full text-xs font-bold py-1.5 px-2 rounded-lg border focus:outline-hidden cursor-pointer ${
                                        matchedIng
                                          ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                                          : "bg-amber-50 border-amber-300 text-amber-900"
                                      }`}
                                    >
                                      <option value="">-- Match Catalog Ingredient --</option>
                                      {ingredients.map((ing) => (
                                        <option key={ing.id} value={ing.id}>
                                          {ing.name} (${calculateIngredientUnitPrice(ing).toFixed(4)} / {getBaseUnitLabel(ing)})
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>

                                {/* Line Cost */}
                                <td className="py-2.5 px-3 text-right">
                                  <span className="font-mono font-bold text-neutral-900">
                                    ${lineCost.toFixed(2)}
                                  </span>
                                </td>

                                {/* Remove Row */}
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeActiveRecipeItem(itemIdx)}
                                    className="text-neutral-400 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
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

                  {/* Chef Notes / Instructions Card */}
                  {(activeRecipe.instructions || activeRecipe.notes) && (
                    <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs space-y-3">
                      {activeRecipe.instructions && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                            Preparation Instructions
                          </span>
                          <p className="text-xs text-neutral-700 whitespace-pre-line leading-relaxed font-serif">
                            {activeRecipe.instructions}
                          </p>
                        </div>
                      )}
                      {activeRecipe.notes && (
                        <div className="pt-2 border-t border-neutral-100">
                          <span className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                            Chef Notes & Allergens
                          </span>
                          <p className="text-xs text-neutral-700 italic">
                            {activeRecipe.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-white border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {step === "input" ? (
            <>
              <div className="text-neutral-500 text-xs flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Text parsed with Gemini; measurements mapped to your kitchen catalog and custom units.</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="w-full sm:w-auto px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="submit-ai-recipe-btn"
                  onClick={handleGenerateRecipe}
                  disabled={isLoading || !recipeText.trim()}
                  className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>{loadingPhase || "Generating Recipe..."}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>
                        {isSubRecipeMode ? "Create Sub-Recipe Cost Sheet" : "Analyze & Generate Cost Sheet"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("input")}
                disabled={isLoading}
                className="text-xs font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Back to Text Input</span>
              </button>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Load into Manual Builder button */}
                <button
                  type="button"
                  onClick={handleLoadIntoBuilder}
                  disabled={isLoading}
                  className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold border border-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChefHat className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Open in Recipe Builder</span>
                </button>

                {/* Batch Save All if multiple recipes */}
                {parsedRecipes.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSaveAllToCatalog}
                    disabled={isLoading}
                    className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Save All ({parsedRecipes.length})</span>
                  </button>
                )}

                {/* Save Active Recipe button */}
                <button
                  type="button"
                  id="save-ai-recipe-to-catalog-btn"
                  onClick={handleSaveActiveToCatalog}
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    {activeRecipe?.isSubRecipe
                      ? "Save Sub-Recipe to Catalog"
                      : "Save Cost Sheet to Catalog"}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Standalone Custom Unit Creator Modal */}
      {showCustomUnitModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-emerald-600" />
                Create Custom Culinary Unit
              </h4>
              <button
                type="button"
                onClick={() => setShowCustomUnitModal(false)}
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              Define custom kitchen units (e.g. scoop, clove, slice, drizzle, sprig, pinch, sheet, bottle, pack).
            </p>
            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Unit name (e.g. scoop, clove, slice)"
                value={newCustomUnitInput}
                onChange={(e) => setNewCustomUnitInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewCustomUnit(newCustomUnitInput);
                  }
                }}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:bg-white focus:outline-hidden focus:border-emerald-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomUnitModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newCustomUnitInput.trim()}
                  onClick={() => handleAddNewCustomUnit(newCustomUnitInput)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg cursor-pointer shadow-2xs"
                >
                  Add Custom Unit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
