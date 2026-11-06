import React, { useState, useMemo } from "react";
import { Ingredient, Invoice, ParsedInvoiceItem } from "../types";
import {
  ArrowRightLeft,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Sparkles,
  X,
  Link2,
  AlertTriangle,
} from "lucide-react";
import {
  getSavedNamingMatches,
  saveLocalNamingMatch,
  removeLocalNamingMatch,
  normalizeBaseUnit,
  getRegisteredPackSize,
} from "../lib/unitConverter";
import { safeUpdateDoc } from "../lib/firebase";

interface IngredientNameMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  invoices?: Invoice[];
  queuedItems?: ParsedInvoiceItem[];
  onEditIngredient?: (id: string, updates: Partial<Ingredient>) => Promise<void>;
  onMappingsChanged?: () => void;
  isReadOnly?: boolean;
}

export interface FlattenedNamingRule {
  invoiceName: string;
  ingredient: Ingredient;
}

export function IngredientNameMatchModal({
  isOpen,
  onClose,
  ingredients,
  invoices = [],
  queuedItems = [],
  onEditIngredient,
  onMappingsChanged,
  isReadOnly = false,
}: IngredientNameMatchModalProps) {
  const [newInvoiceName, setNewInvoiceName] = useState("");
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [ingFilterQuery, setIngFilterQuery] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localVersion, setLocalVersion] = useState(0);
  const [editingUnitIngId, setEditingUnitIngId] = useState<string | null>(null);
  const [draftBaseUnit, setDraftBaseUnit] = useState<string>("lb");
  const [draftPackRatio, setDraftPackRatio] = useState<string>("");
  const [draftPackUnit, setDraftPackUnit] = useState<string>("Box");

  // Quick-map state for unmatched invoice items
  const [quickMapTargets, setQuickMapTargets] = useState<Record<string, string>>({});

  const handleSaveUnitAndPackForIngredient = async (ing: Ingredient) => {
    if (!ing.id) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const cleanBase = draftBaseUnit === "oz" ? "oz" : draftBaseUnit === "pc" ? "pc" : "lb";
      const ratioNum = parseFloat(draftPackRatio);
      const hasRatio = !isNaN(ratioNum) && ratioNum > 0;
      const cleanPkg = (draftPackUnit || "Box").trim();

      const updates: Partial<Ingredient> = {
        unit: cleanBase,
        baseUnit: cleanBase,
        packagingUnit: hasRatio ? cleanPkg : undefined,
        weightPerCase: (cleanBase === "lb" || cleanBase === "oz") && hasRatio ? ratioNum : (null as any),
        weightPerCaseUnit: cleanBase === "oz" ? "oz" : "lb",
        pcsPerPound: cleanBase === "pc" && hasRatio ? ratioNum : (null as any),
        updatedAt: new Date().toISOString(),
      };

      if (onEditIngredient) {
        await onEditIngredient(ing.id, updates);
      } else {
        await safeUpdateDoc("ingredients", ing.id, updates);
      }
      setEditingUnitIngId(null);
      setLocalVersion((v) => v + 1);
      setStatusMsg(
        `Updated "${ing.name}" → Base Unit: ${cleanBase}${hasRatio ? `, Package: ${ratioNum} ${cleanBase} per ${cleanPkg}` : ""}`
      );
      onMappingsChanged?.();
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update ingredient units.");
    } finally {
      setIsSaving(false);
    }
  };

  // Build unified list of all active naming match rules from Ingredient.invoiceAliases + localStorage
  const namingRules = useMemo(() => {
    const map = new Map<string, FlattenedNamingRule>();
    const ingById = new Map<string, Ingredient>();
    const ingByName = new Map<string, Ingredient>();

    ingredients.forEach((ing) => {
      if (ing.id) ingById.set(ing.id, ing);
      if (ing.name) ingByName.set(ing.name.toLowerCase().trim(), ing);
    });

    // 1. From Ingredient.invoiceAliases in database
    ingredients.forEach((ing) => {
      if (Array.isArray(ing.invoiceAliases)) {
        ing.invoiceAliases.forEach((alias) => {
          const clean = (alias || "").trim();
          if (clean) {
            map.set(clean.toLowerCase(), {
              invoiceName: clean,
              ingredient: ing,
            });
          }
        });
      }
    });

    // 2. From localStorage fallback
    const localEntries = getSavedNamingMatches();
    localEntries.forEach((entry) => {
      const clean = (entry.invoiceName || "").trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!map.has(key)) {
        const target =
          ingById.get(entry.ingredientId) ||
          ingByName.get((entry.ingredientName || "").toLowerCase().trim());
        if (target) {
          map.set(key, {
            invoiceName: clean,
            ingredient: target,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.invoiceName.localeCompare(b.invoiceName)
    );
  }, [ingredients, localVersion]);

  // Discover invoice item names from active queue and past invoices that don't match a catalog name or rule yet
  const unmatchedInvoiceNames = useMemo(() => {
    const existingCatalogNames = new Set(
      ingredients.map((i) => (i.name || "").toLowerCase().replace(/\s+/g, " ").trim())
    );
    const existingAliasKeys = new Set(
      namingRules.map((r) => r.invoiceName.toLowerCase().replace(/\s+/g, " ").trim())
    );

    const candidates = new Set<string>();

    queuedItems.forEach((it) => {
      const n = (it.name || "").trim();
      if (!n) return;
      const norm = n.toLowerCase().replace(/\s+/g, " ").trim();
      if (!existingCatalogNames.has(norm) && !existingAliasKeys.has(norm)) {
        candidates.add(n);
      }
    });

    invoices.slice(0, 30).forEach((inv) => {
      (inv.items || []).forEach((it) => {
        const n = (it.name || "").trim();
        if (!n) return;
        const norm = n.toLowerCase().replace(/\s+/g, " ").trim();
        if (!existingCatalogNames.has(norm) && !existingAliasKeys.has(norm)) {
          candidates.add(n);
        }
      });
    });

    return Array.from(candidates).slice(0, 20);
  }, [ingredients, namingRules, queuedItems, invoices]);

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return namingRules;
    const q = searchQuery.toLowerCase().trim();
    return namingRules.filter(
      (r) =>
        r.invoiceName.toLowerCase().includes(q) ||
        (r.ingredient.name || "").toLowerCase().includes(q) ||
        (r.ingredient.vendor || "").toLowerCase().includes(q)
    );
  }, [namingRules, searchQuery]);

  const filteredIngredientsForDropdown = useMemo(() => {
    const sorted = [...ingredients].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
    if (!ingFilterQuery.trim()) return sorted;
    const q = ingFilterQuery.toLowerCase().trim();
    return sorted.filter(
      (i) =>
        (i.name || "").toLowerCase().includes(q) ||
        (i.vendor || "").toLowerCase().includes(q)
    );
  }, [ingredients, ingFilterQuery]);

  if (!isOpen) return null;

  const handleSaveRule = async (invoiceNameRaw: string, targetIngId: string) => {
    const cleanInvoiceName = invoiceNameRaw.trim();
    if (!cleanInvoiceName) {
      setErrorMsg("Please enter an Invoice Item Name.");
      return;
    }
    const targetIng = ingredients.find((i) => i.id === targetIngId);
    if (!targetIng || !targetIng.id) {
      setErrorMsg("Please select a Master Catalog Ingredient to match with.");
      return;
    }

    setErrorMsg(null);
    setStatusMsg(null);
    setIsSaving(true);

    try {
      // 1. Save to localStorage immediately
      saveLocalNamingMatch(cleanInvoiceName, targetIng.id, targetIng.name);

      // 2. Remove this alias from any other ingredient that previously held it
      for (const other of ingredients) {
        if (
          other.id &&
          other.id !== targetIng.id &&
          Array.isArray(other.invoiceAliases) &&
          other.invoiceAliases.some(
            (a) => a.toLowerCase().trim() === cleanInvoiceName.toLowerCase()
          )
        ) {
          const cleanedAliases = other.invoiceAliases.filter(
            (a) => a.toLowerCase().trim() !== cleanInvoiceName.toLowerCase()
          );
          if (onEditIngredient) {
            await onEditIngredient(other.id, { invoiceAliases: cleanedAliases });
          } else {
            await safeUpdateDoc("ingredients", other.id, {
              invoiceAliases: cleanedAliases,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      // 3. Add alias to target ingredient's invoiceAliases array
      const existingAliases = Array.isArray(targetIng.invoiceAliases)
        ? targetIng.invoiceAliases
        : [];
      const alreadyExists = existingAliases.some(
        (a) => a.toLowerCase().trim() === cleanInvoiceName.toLowerCase()
      );
      const updatedAliases = alreadyExists
        ? existingAliases
        : [...existingAliases, cleanInvoiceName];

      if (onEditIngredient) {
        await onEditIngredient(targetIng.id, {
          invoiceAliases: updatedAliases,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await safeUpdateDoc("ingredients", targetIng.id, {
          invoiceAliases: updatedAliases,
          updatedAt: new Date().toISOString(),
        });
      }

      setLocalVersion((v) => v + 1);
      setNewInvoiceName("");
      setStatusMsg(
        `Matched invoice name "${cleanInvoiceName}" → "${targetIng.name}" (${normalizeBaseUnit(
          targetIng.unit,
          targetIng
        )})!`
      );
      onMappingsChanged?.();
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save naming match rule.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveRule = async (rule: FlattenedNamingRule) => {
    setErrorMsg(null);
    setStatusMsg(null);
    setIsSaving(true);
    try {
      removeLocalNamingMatch(rule.invoiceName);
      if (rule.ingredient.id) {
        const updatedAliases = (rule.ingredient.invoiceAliases || []).filter(
          (a) => a.toLowerCase().trim() !== rule.invoiceName.toLowerCase().trim()
        );
        if (onEditIngredient) {
          await onEditIngredient(rule.ingredient.id, {
            invoiceAliases: updatedAliases,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await safeUpdateDoc("ingredients", rule.ingredient.id, {
            invoiceAliases: updatedAliases,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      setLocalVersion((v) => v + 1);
      setStatusMsg(`Removed naming rule for "${rule.invoiceName}".`);
      onMappingsChanged?.();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to remove naming rule.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-neutral-200 text-left flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 bg-[#f0efeb] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">
                  Invoice ↔ Ingredient Naming Match Table
                </h2>
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg">
                  {namingRules.length} Match Rules
                </span>
              </div>
              <p className="text-xs text-neutral-600 mt-0.5">
                Map abbreviated or vendor-specific invoice item names directly to your Master Catalog Ingredients (Base Unit: <strong>lb</strong> or <strong>pc</strong>).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 p-1.5 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                {errorMsg}
              </span>
              <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {statusMsg}
              </span>
              <button onClick={() => setStatusMsg(null)} className="text-emerald-700 hover:text-emerald-950">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Add New Match Rule Form */}
          {!isReadOnly && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  Add New Invoice Name → Ingredient Match
                </h3>
                <span className="text-[11px] text-neutral-500 font-mono">
                  Base units are strictly <strong>lb</strong> or <strong>pc</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Name on Invoice (Vendor Item Name)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., SYS UNSLTD BTR 36/1LB or CHX BRST 40#"
                    value={newInvoiceName}
                    onChange={(e) => setNewInvoiceName(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="md:col-span-1 flex items-center justify-center pb-2 text-neutral-400 font-bold">
                  →
                </div>

                <div className="md:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-neutral-700">
                      Master Catalog Ingredient
                    </label>
                    <input
                      type="text"
                      placeholder="Filter catalog..."
                      value={ingFilterQuery}
                      onChange={(e) => setIngFilterQuery(e.target.value)}
                      className="text-[10px] bg-white border border-neutral-200 rounded px-1.5 py-0.5 w-28 focus:outline-hidden"
                    />
                  </div>
                  <select
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">-- Select Catalog Ingredient --</option>
                    {filteredIngredientsForDropdown.map((ing) => {
                      const baseU = normalizeBaseUnit(ing.unit, ing);
                      const packInfo = getRegisteredPackSize(ing);
                      return (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} [Base: {baseU}
                          {packInfo.hasRegisteredPackSize
                            ? ` | Pkg: ${packInfo.description}`
                            : ""}
                          ]
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    disabled={isSaving || !newInvoiceName.trim() || !selectedIngredientId}
                    onClick={() => handleSaveRule(newInvoiceName, selectedIngredientId)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Save Match</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick-Match Unmatched Invoice Names (from Active Queue / Recent Invoices) */}
          {!isReadOnly && unmatchedInvoiceNames.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-amber-950">
                    Unmatched Invoice Item Names Detected ({unmatchedInvoiceNames.length})
                  </h4>
                </div>
                <span className="text-[11px] text-amber-800">
                  Map these invoice names to your catalog so future invoices match automatically
                </span>
              </div>

              <div className="divide-y divide-amber-200/60 max-h-48 overflow-y-auto bg-white rounded-xl border border-amber-200">
                {unmatchedInvoiceNames.map((invName) => {
                  const chosenId = quickMapTargets[invName] || "";
                  return (
                    <div
                      key={invName}
                      className="p-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="bg-amber-100 text-amber-900 font-mono text-[10px] font-bold px-2 py-0.5 rounded shrink-0">
                          Invoice Name
                        </span>
                        <span className="font-bold text-neutral-900 truncate" title={invName}>
                          {invName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-neutral-400 font-bold">→</span>
                        <select
                          value={chosenId}
                          onChange={(e) =>
                            setQuickMapTargets((prev) => ({
                              ...prev,
                              [invName]: e.target.value,
                            }))
                          }
                          className="bg-neutral-50 border border-neutral-300 rounded-lg px-2.5 py-1 text-xs font-bold text-neutral-900 cursor-pointer max-w-[240px]"
                        >
                          <option value="">-- Match to Ingredient --</option>
                          {ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({normalizeBaseUnit(ing.unit, ing)})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!chosenId || isSaving}
                          onClick={() => handleSaveRule(invName, chosenId)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1 rounded-lg cursor-pointer disabled:opacity-40"
                        >
                          Match
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Naming Match Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                Registered Naming Match Table ({filteredRules.length})
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search invoice name or ingredient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold focus:outline-hidden focus:bg-white focus:border-neutral-400"
                />
              </div>
            </div>

            {filteredRules.length === 0 ? (
              <div className="border border-dashed border-neutral-200 rounded-2xl p-10 text-center">
                <p className="text-xs font-bold text-neutral-700">
                  No invoice naming match rules found
                </p>
                <p className="text-[11px] text-neutral-500 mt-1 max-w-md mx-auto">
                  Add a mapping above or link an invoice line item to a Master Ingredient in the AI Document Parser to automatically build your naming match table.
                </p>
              </div>
            ) : (
              <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="min-w-full divide-y divide-neutral-200 text-xs text-left bg-white">
                  <thead className="bg-[#f0efeb] text-neutral-800 font-bold text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Name on Invoice</th>
                      <th className="px-2 py-3 text-center w-10">→</th>
                      <th className="px-4 py-3">Matched Catalog Ingredient</th>
                      <th className="px-4 py-3 text-center">Base Unit</th>
                      <th className="px-4 py-3">Package Unit</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredRules.map((rule, idx) => {
                      const baseU = normalizeBaseUnit(rule.ingredient.unit, rule.ingredient);
                      const packInfo = getRegisteredPackSize(rule.ingredient);
                      const isEditingUnits = editingUnitIngId === rule.ingredient.id;
                      return (
                        <tr key={`${rule.invoiceName}-${idx}`} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 font-mono font-bold text-neutral-900">
                            {rule.invoiceName}
                          </td>
                          <td className="px-2 py-3 text-center text-emerald-600 font-bold">
                            →
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-neutral-900">
                              {rule.ingredient.name}
                            </div>
                            {rule.ingredient.vendor && (
                              <span className="text-[10px] text-neutral-500 font-mono">
                                Supplier: {rule.ingredient.vendor}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isEditingUnits ? (
                              <select
                                value={draftBaseUnit}
                                onChange={(e) => setDraftBaseUnit(e.target.value)}
                                className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs font-bold font-mono text-neutral-900"
                              >
                                <option value="lb">lb</option>
                                <option value="oz">oz</option>
                                <option value="pc">pc</option>
                              </select>
                            ) : (
                              <span
                                className={`inline-block font-mono font-bold text-[11px] px-2 py-0.5 rounded border ${
                                  baseU === "lb"
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : baseU === "oz"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-purple-50 text-purple-800 border-purple-200"
                                }`}
                              >
                                {baseU}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-neutral-700">
                            {isEditingUnits ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Qty"
                                  value={draftPackRatio}
                                  onChange={(e) => setDraftPackRatio(e.target.value)}
                                  className="w-16 bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs font-bold text-center"
                                />
                                <span className="text-[10px] font-bold text-neutral-600">{draftBaseUnit} per</span>
                                <select
                                  value={draftPackUnit}
                                  onChange={(e) => setDraftPackUnit(e.target.value)}
                                  className="bg-white border border-neutral-300 rounded px-1.5 py-1 text-xs font-bold"
                                >
                                  <option value="Box">Box</option>
                                  <option value="Case">Case</option>
                                  <option value="Bag">Bag</option>
                                  <option value="Pack">Pack</option>
                                  <option value="Can">Can</option>
                                  <option value="Bottle">Bottle</option>
                                  <option value="Jar">Jar</option>
                                  <option value="Tub">Tub</option>
                                  <option value="Bucket">Bucket</option>
                                </select>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => handleSaveUnitAndPackForIngredient(rule.ingredient)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingUnitIngId(null)}
                                  className="px-1.5 py-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {packInfo.hasRegisteredPackSize ? (
                                  <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                                    📦 {packInfo.description}
                                  </span>
                                ) : (
                                  <span className="text-neutral-400 italic">Not registered</span>
                                )}
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUnitIngId(rule.ingredient.id!);
                                      setDraftBaseUnit(baseU);
                                      const ratio =
                                        baseU === "pc"
                                          ? rule.ingredient.pcsPerPound || rule.ingredient.weightPerCase || ""
                                          : rule.ingredient.weightPerCase || rule.ingredient.pcsPerPound || "";
                                      setDraftPackRatio(ratio ? String(ratio) : "");
                                      setDraftPackUnit(rule.ingredient.packagingUnit || packInfo.displayPackUnit || "Box");
                                    }}
                                    className="text-[10px] font-sans font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                  >
                                    Edit Units
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRule(rule)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove naming match rule"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            All invoice items matching a rule above will automatically map to their target ingredient during OCR parsing.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
