import React, { useState, useMemo } from "react";
import { 
  DollarSign, 
  Upload, 
  FileText, 
  Check, 
  AlertCircle, 
  X, 
  RefreshCw, 
  Search, 
  Sparkles, 
  CheckSquare,
  Square,
  Package,
  HelpCircle,
  Link,
  ChevronDown,
  Filter
} from "lucide-react";
import { Ingredient } from "../types";

interface BulkPriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  onEditIngredient: (id: string, edits: Partial<Ingredient>) => Promise<void>;
  isReadOnly?: boolean;
}

interface ParsedMatch {
  rawLine: string;
  rawName: string;
  rawPriceStr: string;
  parsedPrice: number;
  matchedIngredient: Ingredient | null;
  selected: boolean;
  matchScore: "exact" | "partial" | "none";
  confidence: number;
  customPriceInput: string;
}

// Noise words to ignore during tokenized matching
const NOISE_WORDS = new Set([
  "and", "or", "the", "with", "style", "well", "eat", "pre", "sliced",
  "fresh", "frozen", "raw", "cooked", "grade", "choice", "pack", "case",
  "ct", "lbs", "lb", "oz", "g", "kg", "ml", "l", "pcs", "piece", "pieces",
  "single", "double", "regular", "extra", "unassigned", "default", "manual",
  "inventory", "ledger", "invoice", "source"
]);

// Normalizes name string by stripping parenthetical info, units, numbers, and extra symbols
function normalizeText(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")       // Remove (breakfast), (smoked), etc.
    .replace(/\[[^\]]*\]/g, " ")     // Remove [bracketed] text
    .replace(/[,\/\\\-\_\:\#\*\+]/g, " ") // Replace punctuation
    .replace(/\b\d+(?:\.\d+)?\s*(?:lbs?|oz|g|kg|ml|l|pcs|pack|case|ct)?\b/gi, " ") // Remove quantities like 5lb, 4-5lb, 100g
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(str: string): string[] {
  const norm = normalizeText(str);
  return norm
    .split(" ")
    .map(t => t.trim())
    .filter(t => t.length > 1 && !NOISE_WORDS.has(t));
}

// Scores similarity between raw name and registered ingredient name
function matchIngredient(rawName: string, catalog: Ingredient[]): { matched: Ingredient | null; score: "exact" | "partial" | "none"; confidence: number } {
  if (!rawName || catalog.length === 0) {
    return { matched: null, score: "none", confidence: 0 };
  }

  const rawLower = rawName.toLowerCase().trim();
  const rawNorm = normalizeText(rawName);

  // 1. Exact Name Match (case insensitive)
  const exact = catalog.find(ing => ing.name.toLowerCase().trim() === rawLower);
  if (exact) {
    return { matched: exact, score: "exact", confidence: 100 };
  }

  // 2. Normalized Exact Match
  const normExact = catalog.find(ing => normalizeText(ing.name) === rawNorm && rawNorm.length > 0);
  if (normExact) {
    return { matched: normExact, score: "exact", confidence: 95 };
  }

  // 3. Token Overlap & Substring Match
  const rawTokens = getTokens(rawName);
  let bestCandidate: Ingredient | null = null;
  let maxScore = 0;

  for (const ing of catalog) {
    const ingLower = ing.name.toLowerCase().trim();
    const ingNorm = normalizeText(ing.name);
    const ingTokens = getTokens(ing.name);

    // Substring checks
    if (ingNorm && rawNorm) {
      if (rawNorm.includes(ingNorm) || ingNorm.includes(rawNorm)) {
        const minL = Math.min(rawNorm.length, ingNorm.length);
        const maxL = Math.max(rawNorm.length, ingNorm.length);
        const subScore = 70 + (minL / (maxL || 1)) * 20;
        if (subScore > maxScore) {
          maxScore = subScore;
          bestCandidate = ing;
        }
      }
    }

    // Token Overlap
    if (rawTokens.length > 0 && ingTokens.length > 0) {
      let matches = 0;
      for (const rt of rawTokens) {
        if (ingTokens.some(it => it.includes(rt) || rt.includes(it))) {
          matches++;
        }
      }

      if (matches > 0) {
        const overlap = (matches / Math.max(rawTokens.length, ingTokens.length)) * 75;
        if (overlap > maxScore) {
          maxScore = overlap;
          bestCandidate = ing;
        }
      }
    }
  }

  if (bestCandidate && maxScore >= 30) {
    return {
      matched: bestCandidate,
      score: maxScore >= 75 ? "exact" : "partial",
      confidence: Math.round(maxScore)
    };
  }

  return { matched: null, score: "none", confidence: 0 };
}

// Parses string into float price ($12.50 -> 12.5)
function parsePrice(str: string): number {
  if (!str) return NaN;
  // Strip currency symbols and extraneous non-numeric characters except decimal
  const clean = str.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  if (!clean) return NaN;
  const match = clean.match(/\d+(?:\.\d+)?/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) ? NaN : num;
  }
  return NaN;
}

export function BulkPriceUpdateModal({
  isOpen,
  onClose,
  ingredients,
  onEditIngredient,
  isReadOnly = false
}: BulkPriceUpdateModalProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "grid">("paste");
  
  // Paste / File state
  const [pastedText, setPastedText] = useState("");
  const [parsedMatches, setParsedMatches] = useState<ParsedMatch[]>([]);
  const [hasParsed, setHasParsed] = useState(false);

  // Column mapping options
  const [nameColOverride, setNameColOverride] = useState<number | "auto">("auto");
  const [priceColOverride, setPriceColOverride] = useState<number | "auto">("auto");
  const [matchFilter, setMatchFilter] = useState<"all" | "matched" | "unmatched">("all");
  
  // Direct Grid state
  const [gridSearch, setGridSearch] = useState("");
  const [gridPrices, setGridPrices] = useState<Record<string, string>>({});
  
  // Processing state
  const [isUpdating, setIsUpdating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [totalToUpdate, setTotalToUpdate] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Split lines using tabs, pipes, commas, or multiple spaces
  const splitLine = (line: string): string[] => {
    let parts: string[] = [];
    if (line.includes("\t")) {
      parts = line.split("\t");
    } else if (line.includes("|")) {
      parts = line.split("|");
    } else if (line.includes(",") && (line.match(/,/g) || []).length >= 1) {
      // Basic CSV split
      parts = line.split(",");
    } else if (/\s{2,}/.test(line)) {
      parts = line.split(/\s{2,}/);
    } else {
      parts = [line];
    }
    return parts.map(p => p.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  };

  // Parse pasted CSV / Tab-separated / Pipe-separated text
  const handleParseText = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!pastedText.trim()) {
      setErrorMessage("Please paste or upload price data before parsing.");
      return;
    }

    const rawLines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      setErrorMessage("No non-empty lines found to parse.");
      return;
    }

    // Inspect first line for header auto-detection
    const firstLineParts = splitLine(rawLines[0]);
    let detectedNameCol = -1;
    let detectedPriceCol = -1;
    let startIndex = 0;

    const lower0 = rawLines[0].toLowerCase();
    const isHeaderLine = 
      lower0.includes("ingredient") || lower0.includes("item") ||
      lower0.includes("source") || lower0.includes("invoice") ||
      lower0.includes("price") || lower0.includes("cost") || lower0.includes("amount") ||
      lower0.includes("unit");

    if (isHeaderLine) {
      startIndex = 1; // skip header line
      firstLineParts.forEach((part, idx) => {
        const pLower = part.toLowerCase();
        if ((pLower.includes("ingredient") || pLower.includes("item") || pLower.includes("name") || pLower.includes("product")) && detectedNameCol === -1) {
          detectedNameCol = idx;
        }
        if ((pLower.includes("price") || pLower.includes("cost") || pLower.includes("amount") || pLower.includes("rate") || pLower.includes("($)")) && detectedPriceCol === -1) {
          detectedPriceCol = idx;
        }
      });
    }

    // Apply manual overrides if set
    const finalNameCol = nameColOverride !== "auto" ? nameColOverride : detectedNameCol;
    const finalPriceCol = priceColOverride !== "auto" ? priceColOverride : detectedPriceCol;

    const results: ParsedMatch[] = [];

    for (let i = startIndex; i < rawLines.length; i++) {
      const line = rawLines[i];
      const parts = splitLine(line);
      if (parts.length === 0) continue;

      let extractedName = "";
      let extractedPriceStr = "";

      if (parts.length === 1) {
        // Single column: maybe "Nova Salmon $14.50"
        const lastSpaceIdx = line.lastIndexOf(" ");
        if (lastSpaceIdx > 0) {
          const possiblePriceStr = line.substring(lastSpaceIdx + 1).trim();
          if (!isNaN(parsePrice(possiblePriceStr))) {
            extractedName = line.substring(0, lastSpaceIdx).trim();
            extractedPriceStr = possiblePriceStr;
          } else {
            extractedName = line;
          }
        } else {
          extractedName = line;
        }
      } else {
        // Multi-column
        if (finalNameCol >= 0 && finalNameCol < parts.length) {
          extractedName = parts[finalNameCol];
        }
        if (finalPriceCol >= 0 && finalPriceCol < parts.length) {
          extractedPriceStr = parts[finalPriceCol];
        }

        // Fallbacks if not detected/overridden
        if (!extractedName) {
          // Look for longest non-numeric part
          extractedName = parts.reduce((longest, current) => {
            if (isNaN(parsePrice(current)) && current.length > longest.length) {
              return current;
            }
            return longest;
          }, parts[0]);
        }

        if (!extractedPriceStr) {
          // Search backwards for the first part containing a valid price number
          for (let pIdx = parts.length - 1; pIdx >= 0; pIdx--) {
            const pVal = parsePrice(parts[pIdx]);
            if (!isNaN(pVal)) {
              extractedPriceStr = parts[pIdx];
              break;
            }
          }
        }
      }

      const numPrice = parsePrice(extractedPriceStr);
      const cleanName = extractedName.trim();

      if (!cleanName) continue;

      // Match against registered ingredients catalog
      const { matched, score, confidence } = matchIngredient(cleanName, ingredients);

      const parsedP = isNaN(numPrice) ? 0 : numPrice;
      results.push({
        rawLine: line,
        rawName: cleanName,
        rawPriceStr: extractedPriceStr,
        parsedPrice: parsedP,
        matchedIngredient: matched,
        selected: matched !== null && parsedP > 0,
        matchScore: score,
        confidence,
        customPriceInput: parsedP > 0 ? parsedP.toString() : ""
      });
    }

    setParsedMatches(results);
    setHasParsed(true);

    if (results.length === 0) {
      setErrorMessage("Could not parse any ingredient rows. Ensure text contains ingredient names and prices.");
    }
  };

  // Re-match a single parsed row with a manually chosen registered ingredient
  const handleAssignIngredient = (matchIndex: number, ingredientId: string) => {
    const selectedIng = ingredients.find(i => i.id === ingredientId) || null;
    setParsedMatches(prev => prev.map((item, idx) => {
      if (idx === matchIndex) {
        return {
          ...item,
          matchedIngredient: selectedIng,
          selected: selectedIng !== null && item.parsedPrice >= 0,
          matchScore: selectedIng ? "exact" : "none",
          confidence: selectedIng ? 100 : 0
        };
      }
      return item;
    }));
  };

  // Sample data loader for easy testing
  const handleLoadSampleData = () => {
    const sample = `Source / Invoice #\tIngredient Name\tBase Unit\tUnit Price
Sysco Invoice #1023\tNOVA SALMON PRE SLICED (smoked)\t1 lbs\t$14.50
Sysco Invoice #1023\tSALMON SIDES 4-5lb\t1 lbs\t$18.90
US Foods Invoice #902\tPEPPERONI (samwich style)\t1 lbs\t$8.25
US Foods Invoice #902\tBEEF PATTY 80/20\t1 lbs\t$6.75
Local Market\tBUTTER (unsalted)\t1 lbs\t$3.50`;
    setPastedText(sample);
  };

  // File upload handler (.csv or .txt or .tsv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPastedText(text);
      }
    };
    reader.readAsText(file);
  };

  // Selection Toggles
  const toggleSelectMatch = (idx: number) => {
    setParsedMatches(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  };

  const toggleSelectAll = (select: boolean) => {
    setParsedMatches(prev => prev.map(item => item.matchedIngredient ? { ...item, selected: select } : item));
  };

  // Custom price input edit for parsed row
  const updateCustomPrice = (idx: number, val: string) => {
    setParsedMatches(prev => prev.map((item, i) => {
      if (i === idx) {
        const p = parseFloat(val);
        const validP = isNaN(p) ? 0 : p;
        return {
          ...item,
          customPriceInput: val,
          parsedPrice: validP,
          selected: item.matchedIngredient !== null && validP >= 0
        };
      }
      return item;
    }));
  };

  // Save parsed match bulk price updates to database
  const handleApplyParsedUpdates = async () => {
    const itemsToApply = parsedMatches.filter(m => m.selected && m.matchedIngredient && m.parsedPrice >= 0);
    if (itemsToApply.length === 0) {
      setErrorMessage("No valid matched ingredients selected for update.");
      return;
    }

    setIsUpdating(true);
    setProgressCount(0);
    setTotalToUpdate(itemsToApply.length);
    setErrorMessage(null);
    setSuccessMessage(null);

    let updatedCount = 0;
    try {
      for (let i = 0; i < itemsToApply.length; i++) {
        const match = itemsToApply[i];
        if (match.matchedIngredient?.id) {
          await onEditIngredient(match.matchedIngredient.id, {
            price: match.parsedPrice
          });
          updatedCount++;
          setProgressCount(updatedCount);
        }
      }

      setSuccessMessage(`Successfully updated package & unit prices for ${updatedCount} registered ingredient(s)!`);
      setTimeout(() => {
        setHasParsed(false);
        setPastedText("");
        setParsedMatches([]);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed during bulk price update.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Direct Grid handlers
  const filteredIngredients = useMemo(() => {
    if (!gridSearch.trim()) return ingredients;
    const q = gridSearch.toLowerCase();
    return ingredients.filter(ing => 
      ing.name.toLowerCase().includes(q) || 
      (ing.category && ing.category.toLowerCase().includes(q)) ||
      (ing.vendor && ing.vendor.toLowerCase().includes(q))
    );
  }, [ingredients, gridSearch]);

  const handleGridPriceChange = (id: string, val: string) => {
    setGridPrices(prev => ({ ...prev, [id]: val }));
  };

  const handleSaveGridUpdates = async () => {
    const changedEntries = (Object.entries(gridPrices) as [string, string][]).filter(([id, val]) => {
      const p = parseFloat(val);
      const orig = ingredients.find(i => i.id === id);
      return !isNaN(p) && p >= 0 && orig && orig.price !== p;
    });

    if (changedEntries.length === 0) {
      setErrorMessage("No price changes detected in the grid.");
      return;
    }

    setIsUpdating(true);
    setProgressCount(0);
    setTotalToUpdate(changedEntries.length);
    setErrorMessage(null);
    setSuccessMessage(null);

    let updatedCount = 0;
    try {
      for (let i = 0; i < changedEntries.length; i++) {
        const [id, val] = changedEntries[i];
        const newP = parseFloat(val);
        await onEditIngredient(id, { price: newP });
        updatedCount++;
        setProgressCount(updatedCount);
      }

      setSuccessMessage(`Successfully updated ${updatedCount} ingredient prices!`);
      setGridPrices({});
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save grid price updates.");
    } finally {
      setIsUpdating(false);
    }
  };

  const displayedMatches = useMemo(() => {
    if (matchFilter === "matched") return parsedMatches.filter(m => m.matchedIngredient !== null);
    if (matchFilter === "unmatched") return parsedMatches.filter(m => m.matchedIngredient === null);
    return parsedMatches;
  }, [parsedMatches, matchFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Bulk Price Updater</h2>
              <p className="text-xs text-neutral-400">
                Update purchase package & base prices for registered ingredients
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="bg-neutral-100 border-b border-neutral-200 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("paste")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "paste"
                  ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                  : "text-neutral-600 hover:bg-neutral-200/60"
              }`}
            >
              <Upload className="h-3.5 w-3.5 text-emerald-600" />
              <span>Paste / Upload CSV or Text List</span>
            </button>
            <button
              onClick={() => setActiveTab("grid")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "grid"
                  ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                  : "text-neutral-600 hover:bg-neutral-200/60"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>Direct Quick Grid ({ingredients.length})</span>
            </button>
          </div>

          {!hasParsed && activeTab === "paste" && (
            <button
              onClick={handleLoadSampleData}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              Load Sample Text
            </button>
          )}
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 p-3 px-6 text-xs text-red-700 font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 px-6 text-xs text-emerald-800 font-medium flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Progress Bar during Bulk Save */}
        {isUpdating && (
          <div className="bg-emerald-950 text-emerald-100 p-3 px-6 text-xs font-mono font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
              <span>Updating ingredients in database... ({progressCount} / {totalToUpdate})</span>
            </div>
            <span>{Math.round((progressCount / (totalToUpdate || 1)) * 100)}%</span>
          </div>
        )}

        {/* Main Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* TAB 1: PASTE / UPLOAD PRICE LIST */}
          {activeTab === "paste" && (
            <div className="space-y-4">
              
              {!hasParsed ? (
                <>
                  <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4 text-xs text-neutral-700 space-y-2">
                    <p className="font-bold text-neutral-900 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      Smart Parsing & Ingredient Matching Engine:
                    </p>
                    <p className="text-neutral-600 leading-relaxed">
                      Copy and paste tabular data directly from spreadsheets, PDFs, or vendor invoices. The engine cleans parenthetical brand descriptors like <code className="bg-white px-1 py-0.5 rounded border border-neutral-200 text-emerald-800 font-mono">(breakfast)</code> or <code className="bg-white px-1 py-0.5 rounded border border-neutral-200 text-emerald-800 font-mono">(4-5lb)</code> and pairs items with your registered catalog.
                    </p>
                  </div>

                  {/* Column Mapper Bar */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-neutral-800 flex items-center gap-1.5">
                      <Filter className="h-4 w-4 text-neutral-500" />
                      Column Parsing Overrides:
                    </span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-neutral-600 font-medium">Name Column:</label>
                        <select
                          value={nameColOverride}
                          onChange={(e) => setNameColOverride(e.target.value === "auto" ? "auto" : parseInt(e.target.value, 10))}
                          className="bg-white border border-neutral-300 rounded-lg px-2 py-1 font-bold text-neutral-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        >
                          <option value="auto">Auto Detect</option>
                          <option value="0">Column 1</option>
                          <option value="1">Column 2</option>
                          <option value="2">Column 3</option>
                          <option value="3">Column 4</option>
                          <option value="4">Column 5</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-neutral-600 font-medium">Price Column:</label>
                        <select
                          value={priceColOverride}
                          onChange={(e) => setPriceColOverride(e.target.value === "auto" ? "auto" : parseInt(e.target.value, 10))}
                          className="bg-white border border-neutral-300 rounded-lg px-2 py-1 font-bold text-neutral-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        >
                          <option value="auto">Auto Detect</option>
                          <option value="0">Column 1</option>
                          <option value="1">Column 2</option>
                          <option value="2">Column 3</option>
                          <option value="3">Column 4</option>
                          <option value="4">Column 5</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-neutral-800">Paste Price List / Invoice Text:</label>
                      <label className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer flex items-center gap-1">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Upload .csv / .txt file</span>
                        <input
                          type="file"
                          accept=".csv,.txt,.tsv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <textarea
                      rows={10}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste text with columns like: Ingredient Name, Unit, Price..."
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 font-mono text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleParseText}
                      disabled={!pastedText.trim()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      Parse & Match Ingredients
                    </button>
                  </div>
                </>
              ) : (
                /* VERIFICATION & MATCH RESULTS TABLE */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900">
                        Parsed {parsedMatches.length} Row(s)
                      </h3>
                      <p className="text-[11px] text-neutral-500">
                        Matched <span className="font-bold text-emerald-600">{parsedMatches.filter(m => m.matchedIngredient).length}</span> ingredients. Re-assign or edit prices directly below if needed.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg px-2 py-1 text-[11px]">
                        <span className="text-neutral-500 font-medium">Filter:</span>
                        <button
                          type="button"
                          onClick={() => setMatchFilter("all")}
                          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${matchFilter === "all" ? "bg-neutral-800 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
                        >
                          All ({parsedMatches.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatchFilter("matched")}
                          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${matchFilter === "matched" ? "bg-emerald-700 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
                        >
                          Matched ({parsedMatches.filter(m => m.matchedIngredient).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatchFilter("unmatched")}
                          className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${matchFilter === "unmatched" ? "bg-amber-700 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
                        >
                          Unmatched ({parsedMatches.filter(m => !m.matchedIngredient).length})
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleSelectAll(true)}
                        className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(false)}
                        className="px-2.5 py-1 text-[11px] font-bold text-neutral-600 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer"
                      >
                        Deselect All
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasParsed(false)}
                        className="px-2.5 py-1 text-[11px] font-bold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer"
                      >
                        Re-paste Text
                      </button>
                    </div>
                  </div>

                  {/* Matches List Table */}
                  <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-100 font-bold text-neutral-700 border-b border-neutral-200 sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5 w-10 text-center"></th>
                          <th className="p-2.5">Input Raw Name</th>
                          <th className="p-2.5">Pair with Registered Ingredient</th>
                          <th className="p-2.5 text-right w-24">Current ($)</th>
                          <th className="p-2.5 text-right w-32">New Price ($)</th>
                          <th className="p-2.5 text-center w-24">Match</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-[11px]">
                        {displayedMatches.map((m) => {
                          const originalIdx = parsedMatches.findIndex(item => item === m);
                          const isMatched = !!m.matchedIngredient;

                          return (
                            <tr
                              key={originalIdx}
                              className={`hover:bg-neutral-50 ${
                                m.selected ? "bg-emerald-50/20" : "opacity-60"
                              }`}
                            >
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  disabled={!isMatched}
                                  onClick={() => toggleSelectMatch(originalIdx)}
                                  className="text-neutral-500 hover:text-neutral-900 cursor-pointer disabled:opacity-30"
                                >
                                  {m.selected ? (
                                    <CheckSquare className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-neutral-300" />
                                  )}
                                </button>
                              </td>

                              <td className="p-2.5 font-bold text-neutral-900 max-w-[200px] truncate" title={m.rawName}>
                                {m.rawName}
                              </td>

                              {/* Interactive Re-assignment Dropdown */}
                              <td className="p-2.5">
                                <div className="relative">
                                  <select
                                    value={m.matchedIngredient?.id || ""}
                                    onChange={(e) => handleAssignIngredient(originalIdx, e.target.value)}
                                    className={`w-full py-1 px-2 pr-6 bg-white border rounded-lg text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                                      isMatched ? "border-emerald-300 text-neutral-900 font-bold" : "border-amber-300 text-amber-800 bg-amber-50/50"
                                    }`}
                                  >
                                    <option value="">-- Select Registered Ingredient --</option>
                                    {ingredients.map(ing => (
                                      <option key={ing.id} value={ing.id}>
                                        {ing.name} ({ing.unit || "unit"}) - Current: ${ing.price.toFixed(2)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>

                              <td className="p-2.5 text-right font-bold font-mono text-neutral-500">
                                {isMatched ? `$${m.matchedIngredient?.price.toFixed(2)}` : "-"}
                              </td>

                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={m.customPriceInput}
                                  onChange={(e) => updateCustomPrice(originalIdx, e.target.value)}
                                  className="w-24 px-2 py-1 bg-white border border-neutral-300 rounded-lg text-right font-bold font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                />
                              </td>

                              <td className="p-2.5 text-center">
                                {m.matchScore === "exact" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Exact
                                  </span>
                                )}
                                {m.matchScore === "partial" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                    Fuzzy ({m.confidence}%)
                                  </span>
                                )}
                                {m.matchScore === "none" && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Unmatched
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-neutral-500 font-medium">
                      Selected <strong className="text-neutral-900">{parsedMatches.filter(m => m.selected).length}</strong> items to update.
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyParsedUpdates}
                        disabled={isUpdating || parsedMatches.filter(m => m.selected).length === 0}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Apply Bulk Price Updates ({parsedMatches.filter(m => m.selected).length})
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: DIRECT PRICE QUICK GRID */}
          {activeTab === "grid" && (
            <div className="space-y-4">
              
              {/* Search Bar */}
              <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={gridSearch}
                    onChange={(e) => setGridSearch(e.target.value)}
                    placeholder="Search registered ingredients by name, category, or vendor..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-xs text-neutral-500 font-mono">
                  Showing {filteredIngredients.length} of {ingredients.length}
                </span>
              </div>

              {/* Direct Table */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 font-bold text-neutral-700 border-b border-neutral-200 sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">Ingredient Name</th>
                      <th className="p-2.5">Supplier / Vendor</th>
                      <th className="p-2.5 text-center">Base Unit</th>
                      <th className="p-2.5 text-right w-32">Current Price ($)</th>
                      <th className="p-2.5 text-right w-36">New Price ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-[11px]">
                    {filteredIngredients.map((ing) => {
                      const currentP = ing.price;
                      const editedP = gridPrices[ing.id!];
                      const isChanged = editedP !== undefined && editedP !== "" && parseFloat(editedP) !== currentP;

                      return (
                        <tr
                          key={ing.id}
                          className={`hover:bg-neutral-50 ${isChanged ? "bg-amber-50/40" : ""}`}
                        >
                          <td className="p-2.5 font-bold text-neutral-900">
                            {ing.name}
                          </td>
                          <td className="p-2.5 text-neutral-600">
                            {ing.vendor || "Default / Unassigned"}
                          </td>
                          <td className="p-2.5 text-center text-neutral-600 font-mono">
                            {ing.unit || "lbs"}
                          </td>
                          <td className="p-2.5 text-right font-bold font-mono text-neutral-600">
                            ${currentP.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={currentP.toFixed(2)}
                              value={editedP !== undefined ? editedP : ""}
                              onChange={(e) => handleGridPriceChange(ing.id!, e.target.value)}
                              className={`w-28 px-2 py-1 bg-white border rounded-lg text-right font-bold font-mono text-xs focus:outline-none ${
                                isChanged 
                                  ? "border-amber-500 bg-amber-50 text-amber-900" 
                                  : "border-neutral-300 text-neutral-900"
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grid Actions Footer */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-neutral-500">
                  {Object.keys(gridPrices).filter(k => gridPrices[k] !== "").length} pending price change(s) in grid.
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGridUpdates}
                    disabled={isUpdating || Object.keys(gridPrices).length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save Grid Price Updates
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
