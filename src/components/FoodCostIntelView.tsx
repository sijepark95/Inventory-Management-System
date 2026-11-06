import React, { useState } from "react";
import { Recipe, DailySale } from "../types";
import { 
  TrendingUp, 
  Coins, 
  Percent, 
  Cpu, 
  Trash2, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2,
  FileBarChart,
  Info,
  ChefHat,
  Lock
} from "lucide-react";

interface FoodCostIntelViewProps {
  recipes: Recipe[];
  dailySales: DailySale[];
  onAddDailySale: (item: Omit<DailySale, "id" | "ownerId" | "createdAt">) => Promise<void>;
  onDeleteDailySale: (id: string) => Promise<void>;
  isSubmitting?: boolean;
  isReadOnly?: boolean;
}

export default function FoodCostIntelView({
  recipes,
  dailySales,
  onAddDailySale,
  onDeleteDailySale,
  isSubmitting = false,
  isReadOnly = false
}: FoodCostIntelViewProps) {
  // Date state defaulting to "today" as of local time or standard format
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  });

  // Form states
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [quantitySold, setQuantitySold] = useState<string>("");
  const [formError, setFormError] = useState<string>("");
  const [formSuccess, setFormSuccess] = useState<string>("");

  // AI Reader state hooks
  const [entryTab, setEntryTab] = useState<"manual" | "ai">("manual");
  const [aiText, setAiText] = useState<string>("");
  const [aiFileName, setAiFileName] = useState<string>("");
  const [aiFileBase64, setAiFileBase64] = useState<string>("");
  const [aiFileType, setAiFileType] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiSuccess, setAiSuccess] = useState<string>("");

  interface SuggestedEntry {
    recipeName: string;
    quantitySold: number;
    matchedRecipeId: string;
    sellingPrice: number;
    costPerPortion: number;
    selected: boolean;
  }
  const [suggestedEntries, setSuggestedEntries] = useState<SuggestedEntry[]>([]);
  const [parsedDate, setParsedDate] = useState<string>("");

  // Clean and map parsed strings to active master recipe IDs
  const getInitialMatch = (parsedName: string): string => {
    if (!parsedName || recipes.length === 0) return "";
    const nameLower = parsedName.toLowerCase().trim();
    
    // Clean minor noise characters or quantifiers
    const cleaned = nameLower
      .replace(/[\d\(\)\.\#\-]/g, "")
      .replace(/\b(portion|portions|pcs|pc|order|orders|servings|serving|sold|qty|x)\b/g, "")
      .trim();

    if (!cleaned) return "";

    // 1. Exact match
    const exactMatch = recipes.find(r => r.name.toLowerCase().trim() === cleaned);
    if (exactMatch) return exactMatch.id || "";
    
    // 2. Substring match
    const subMatch = recipes.find(r => 
      cleaned.includes(r.name.toLowerCase().trim()) || 
      r.name.toLowerCase().trim().includes(cleaned)
    );
    if (subMatch) return subMatch.id || "";
    
    // 3. Match singular words
    const cleanWords = cleaned.split(/\s+/).filter(w => w.length > 3);
    if (cleanWords.length > 0) {
      const wordMatch = recipes.find(r => {
        const rName = r.name.toLowerCase();
        return cleanWords.some(word => rName.includes(word));
      });
      if (wordMatch) return wordMatch.id || "";
    }

    return "";
  };

  // Convert uploaded image or till-tape to base64 payload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiError("");
    setAiSuccess("");
    
    if (file.size > 10 * 1024 * 1024) {
      setAiError("File is too large. Maximum size is 10MB.");
      return;
    }

    const fileType = file.type || "";
    const fileNameLower = file.name.toLowerCase();

    // Catch Excel sheets
    const isExcel = 
      fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      fileType === "application/vnd.ms-excel" || 
      fileNameLower.endsWith(".xlsx") || 
      fileNameLower.endsWith(".xls");

    if (isExcel) {
      setAiError("Excel spreadsheets (.xlsx / .xls) are not directly supported by the AI visual reader. Please take a screenshot of your spreadsheet and upload the image, save it as a PDF and upload the PDF version, or copy-paste the data rows directly into the textarea above.");
      e.target.value = "";
      setAiFileName("");
      setAiFileBase64("");
      setAiFileType("");
      return;
    }

    const isCsv = fileType === "text/csv" || fileNameLower.endsWith(".csv");
    const isTxt = fileType === "text/plain" || fileNameLower.endsWith(".txt");

    if (isCsv || isTxt) {
      const textReader = new FileReader();
      textReader.onload = () => {
        const text = textReader.result as string;
        setAiText(text);
        setAiSuccess(`Spreadsheet data loaded from "${file.name}". Click "Analyze Sales with AI" below to proceed.`);
        setAiFileName(file.name);
        setAiFileBase64("");
        setAiFileType("");
      };
      textReader.onerror = () => {
        setAiError("Failed to read text or CSV file.");
      };
      textReader.readAsText(file);
      return;
    }

    // Supported formats for Gemini multimodal API
    const isImage = fileType.startsWith("image/");
    const isPdf = fileType === "application/pdf" || fileNameLower.endsWith(".pdf");

    if (!isImage && !isPdf) {
      setAiError("Unsupported file type. Please upload a PDF, an Image (PNG, JPG, WEBP), a text/CSV, or copy-paste your sales data directly into the text box above.");
      e.target.value = "";
      setAiFileName("");
      setAiFileBase64("");
      setAiFileType("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const commaIdx = resultStr.indexOf(",");
      if (commaIdx !== -1) {
        const base64 = resultStr.substring(commaIdx + 1);
        setAiFileBase64(base64);
        setAiFileType(file.type || (isPdf ? "application/pdf" : "image/png"));
        setAiFileName(file.name);
      }
    };
    reader.onerror = () => {
      setAiError("Failed to convert file to digital layout.");
    };
    reader.readAsDataURL(file);
  };

  // Run the parsed sales endpoint
  const handleAnalyzeSales = async () => {
    setAiError("");
    setAiSuccess("");
    setSuggestedEntries([]);
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/parse-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: aiFileBase64,
          mimeType: aiFileType,
          fileName: aiFileName,
          textInput: aiText
        })
      });

      if (!response.ok) {
        let errBody: any = {};
        try {
          errBody = await response.json();
        } catch (_) {}
        throw new Error(errBody.message || errBody.error || `HTTP ${response.status} Server Parse Failure`);
      }

      const parsed = await response.json();
      if (!parsed || !parsed.items || !Array.isArray(parsed.items)) {
        throw new Error("Gemini returned invalid sales list formatting. Please check your text or try simple copy-paste.");
      }

      const mapped: SuggestedEntry[] = parsed.items.map((item: any) => {
        const matchedId = getInitialMatch(item.recipeName);
        const resolvedRecipe = recipes.find(r => r.id === matchedId);
        
        return {
          recipeName: item.recipeName,
          quantitySold: Math.max(1, parseInt(item.quantitySold, 10) || 1),
          matchedRecipeId: matchedId,
          sellingPrice: item.sellingPrice || resolvedRecipe?.sellingPrice || 0,
          costPerPortion: item.costPerPortion || resolvedRecipe?.costPerPortion || 0,
          selected: true
        };
      });

      if (parsed.date) {
        setParsedDate(parsed.date);
      } else {
        setParsedDate(selectedDate);
      }

      setSuggestedEntries(mapped);
      if (mapped.length > 0) {
        setAiSuccess(`Parsed ${mapped.length} sales entries from document. Please review mapped recipes below.`);
      } else {
        setAiError("Zero food sales logs detected. Try refining the text content.");
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "An unexpected error occurred while parsing material.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Safe save list logic
  const handleSaveSuggested = async () => {
    setAiError("");
    setAiSuccess("");
    const selectedEntries = suggestedEntries.filter(e => e.selected);
    if (selectedEntries.length === 0) {
      setAiError("Please select at least one item to save.");
      return;
    }

    const unassigned = selectedEntries.some(e => !e.matchedRecipeId);
    if (unassigned) {
      setAiError("Please select matching Database Recipes for all checked items.");
      return;
    }

    setIsAnalyzing(true);
    let count = 0;
    try {
      const targetDate = parsedDate || selectedDate;
      for (const entry of selectedEntries) {
        const recipe = recipes.find(r => r.id === entry.matchedRecipeId);
        if (recipe) {
          const revenue = entry.quantitySold * entry.sellingPrice;
          const costRaw = entry.quantitySold * entry.costPerPortion;
          const calculatedMargin = revenue > 0 ? ((revenue - costRaw) / revenue) * 100 : 0;

          await onAddDailySale({
            date: targetDate,
            recipeId: recipe.id || "",
            recipeName: recipe.name,
            quantitySold: entry.quantitySold,
            sellingPrice: entry.sellingPrice,
            costPerPortion: entry.costPerPortion,
            totalRevenue: revenue,
            totalCost: costRaw,
            margin: calculatedMargin
          });
          count++;
        }
      }
      setAiSuccess(`Successfully recorded ${count} portion sales into active ledger for ${targetDate}`);
      setSuggestedEntries([]);
      setParsedDate("");
      setAiText("");
      setAiFileBase64("");
      setAiFileName("");
      setEntryTab("manual");
    } catch (err: any) {
      setAiError(err.message || "Failed saving suggested entries.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter sales list for current date selection
  const filteredSales = dailySales.filter(s => s.date === selectedDate);

  // Financial calculations for the selected date
  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.totalRevenue, 0);
  const totalCOGS = filteredSales.reduce((acc, s) => acc + s.totalCost, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const overallFoodCostPercent = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
  const overallMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalQtySold = filteredSales.reduce((acc, s) => acc + s.quantitySold, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!selectedRecipeId) {
      setFormError("Please select a target recipe.");
      return;
    }
    const qty = parseInt(quantitySold, 10);
    if (isNaN(qty) || qty <= 0) {
      setFormError("Quantity sold must be a dynamic integer above zero.");
      return;
    }

    const recipe = recipes.find(r => r.id === selectedRecipeId);
    if (!recipe) {
      setFormError("Selected recipe could not be verified in registry.");
      return;
    }

    try {
      const revenue = qty * recipe.sellingPrice;
      const costRaw = qty * recipe.costPerPortion;
      const calculatedMargin = revenue > 0 ? ((revenue - costRaw) / revenue) * 100 : 0;

      await onAddDailySale({
        date: selectedDate,
        recipeId: recipe.id || "",
        recipeName: recipe.name,
        quantitySold: qty,
        sellingPrice: recipe.sellingPrice,
        costPerPortion: recipe.costPerPortion,
        totalRevenue: revenue,
        totalCost: costRaw,
        margin: calculatedMargin
      });

      setFormSuccess(`Choreographed sales entry for ${qty} portions of "${recipe.name}".`);
      setQuantitySold("");
    } catch (err: any) {
      setFormError(err.message || "Failed saving selected sales entry.");
    }
  };

  // Automated design testing helper
  const handlePrefillDemoSales = async () => {
    setFormError("");
    setFormSuccess("");
    
    if (recipes.length === 0) {
      setFormError("Please configure active Recipes/Culinary Sheets first to enable intelligent prefill simulation.");
      return;
    }

    let prefilledCount = 0;
    try {
      // Pick up to three recipes
      const demoPatterns = [
        { recipeIndex: 0, qty: 18 },
        { recipeIndex: 1, qty: 25 },
        { recipeIndex: 2, qty: 12 }
      ];

      for (const pattern of demoPatterns) {
        if (pattern.recipeIndex < recipes.length) {
          const recipe = recipes[pattern.recipeIndex];
          // Check if this recipe is already recorded for today to prevent duplicates
          const alreadyLogged = filteredSales.some(s => s.recipeId === recipe.id);
          if (!alreadyLogged) {
            const revenue = pattern.qty * recipe.sellingPrice;
            const costRaw = pattern.qty * recipe.costPerPortion;
            const calculatedMargin = revenue > 0 ? ((revenue - costRaw) / revenue) * 100 : 0;

            await onAddDailySale({
              date: selectedDate,
              recipeId: recipe.id || "",
              recipeName: recipe.name,
              quantitySold: pattern.qty,
              sellingPrice: recipe.sellingPrice,
              costPerPortion: recipe.costPerPortion,
              totalRevenue: revenue,
              totalCost: costRaw,
              margin: calculatedMargin
            });
            prefilledCount++;
          }
        }
      }

      if (prefilledCount > 0) {
        setFormSuccess(`Prefilled ${prefilledCount} realistic recipe sales logs for date ${selectedDate}.`);
      } else {
        setFormError("Simulated logs already prefilled for current selected recipes today.");
      }
    } catch (err: any) {
      setFormError("Prefill error: " + err.message);
    }
  };

  return (
    <div className="space-y-8" id="food-cost-intel-root">
      
      {/* Upper Status Controls & Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-neutral-200 p-4">
        <div className="text-left space-y-1">
          <h2 className="text-sm font-mono font-bold text-neutral-900 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-neutral-900" />
            Food Cost & Margin Intelligence
          </h2>
          <p className="text-[11px] text-neutral-900/70">
            Log daily recipe transactions to perform automated portion ingredient cost rollups, track revenue and monitor pure margin efficiency.
          </p>
        </div>

        {/* Date Selector Filter */}
        <div className="flex items-center gap-2 border border-neutral-200 p-1.5 bg-[#f0efeb] w-full md:w-auto" id="date-selector-wrapper">
          <Calendar className="h-4 w-4 text-neutral-900" />
          <span className="text-[10px] font-mono font-bold text-neutral-600">Audit Date:</span>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setFormError("");
              setFormSuccess("");
            }}
            className="bg-white border border-neutral-200 text-xs font-mono font-bold px-2 py-0.5 rounded-xl outline-none text-neutral-900 focus:ring-1 focus:ring-black h-[26px]"
          />
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="intel-kpi-grid">
        {/* KPI: Portions Sold */}
        <div className="bg-white border border-neutral-200 p-4 flex flex-col justify-between text-left h-28 relative overflow-hidden">
          <div>
            <span className="text-[10px] text-neutral-900/50 font-mono font-bold block">Portions Sold Today</span>
            <p className="text-2xl font-bold font-mono text-neutral-900 mt-2 leading-none">
              {totalQtySold} <span className="text-xs font-sans font-medium text-neutral-400">servings</span>
            </p>
          </div>
          <div className="text-[10px] text-neutral-900/60 font-mono ">
            Total active sales across {filteredSales.length} items
          </div>
          <div className="absolute right-3 top-3 opacity-10">
            <TrendingUp className="h-10 w-10 text-black" />
          </div>
        </div>

        {/* KPI: Gross Sales Revenue */}
        <div className="bg-white border border-neutral-200 p-4 flex flex-col justify-between text-left h-28 relative overflow-hidden">
          <div>
            <span className="text-[10px] text-neutral-900/50 font-mono font-bold block">Today's Revenue</span>
            <p className="text-2xl font-bold font-mono text-neutral-900 mt-2 leading-none">
              ${totalRevenue.toFixed(2)}
            </p>
          </div>
          <div className="text-[10px] text-neutral-500 font-sans flex items-center gap-1">
            <Coins className="h-3 w-3 text-emerald-500" /> Average ${totalQtySold > 0 ? (totalRevenue / totalQtySold).toFixed(2) : "0.00"} per dish
          </div>
          <div className="absolute right-3 top-3 opacity-10">
            <Coins className="h-10 w-10 text-black" />
          </div>
        </div>

        {/* KPI: Cost of Goods Sold (Food Cost Dollars) */}
        <div className="bg-white border border-neutral-200 p-4 flex flex-col justify-between text-left h-28 relative overflow-hidden">
          <div>
            <span className="text-[10px] text-neutral-900/50 font-mono font-bold block">Cost of Goods (COGS)</span>
            <p className="text-2xl font-bold font-mono text-rose-700 mt-2 leading-none">
              ${totalCOGS.toFixed(2)}
            </p>
          </div>
          <div className="text-[10px] font-mono text-rose-800 font-bold">
            Food Cost %: {overallFoodCostPercent.toFixed(1)}%
          </div>
          <div className="absolute right-3 top-3 opacity-15">
            <Percent className="h-10 w-10 text-rose-800" />
          </div>
        </div>

        {/* KPI: Cumulative Gross Margin */}
        <div className="bg-white border border-neutral-200 p-4 flex flex-col justify-between text-left h-28 relative overflow-hidden">
          <div>
            <span className="text-[10px] text-neutral-900/50 font-mono font-bold block">Gross Profit Profit Margin</span>
            <p className={`text-2xl font-bold font-mono mt-2 leading-none ${overallMarginPercent >= 65 ? "text-emerald-700" : overallMarginPercent > 0 ? "text-amber-600" : "text-neutral-500"}`}>
              {overallMarginPercent.toFixed(1)}%
            </p>
          </div>
          <div className="text-[10px] font-sans text-neutral-500">
            {overallMarginPercent >= 65 ? (
              <span className="text-emerald-700 font-bold">Healthy Culinary Yield (Target &ge; 65%)</span>
            ) : overallMarginPercent > 0 ? (
              <span className="text-amber-600 font-semibold">Cautionary Low margin</span>
            ) : (
              <span>No recorded profitability</span>
            )}
          </div>
          <div className="absolute right-3 top-3 opacity-10">
            <Cpu className="h-10 w-10 text-black" />
          </div>
        </div>
      </div>

      {/* Main Split Interface Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="intel-details-grid">
        
        {/* Left Column: Log Daily Recipe Quantities (span 4/12) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-neutral-200 p-5 text-left flex flex-col h-full" id="daily-sales-record-card">
            
            {/* Split layout toggle headers */}
            <div className="flex border border-neutral-200 mb-4 bg-neutral-50" id="sales-entry-tabs">
              <button
                type="button"
                onClick={() => {
                  setEntryTab("manual");
                  setFormError("");
                  setFormSuccess("");
                }}
                className={`flex-1 py-2 text-[10px] font-mono font-bold text-center transition-all cursor-pointer ${
                  entryTab === "manual" 
                    ? "bg-emerald-600 text-white" 
                    : "text-neutral-900 hover:bg-neutral-200"
                }`}
              >
                Manual Log
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryTab("ai");
                  setAiError("");
                  setAiSuccess("");
                }}
                className={`flex-1 py-2 text-[10px] font-mono font-bold text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  entryTab === "ai" 
                    ? "bg-emerald-600 text-white" 
                    : "text-neutral-900 hover:bg-neutral-200"
                }`}
              >
                <Cpu className="h-3 w-3" />
                AI POS Reader
              </button>
            </div>

            {isReadOnly ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-neutral-50 border border-dashed border-neutral-300 space-y-3 my-4">
                <Lock className="h-8 w-8 text-neutral-400" />
                <div>
                  <p className="text-xs font-bold text-neutral-850">Logging Restricted</p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Staff mode allows you to audit existing performance metrics, but logging new daily culinary transactions is restricted.
                  </p>
                </div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#f0efeb]/40 border border-dashed border-neutral-200/20 space-y-3">
                <ChefHat className="h-8 w-8 text-neutral-900/30" />
                <div>
                  <p className="text-xs font-bold text-neutral-900">No Recipes Configured yet</p>
                  <p className="text-[10px] text-neutral-900/60 mt-1">
                    Configure your cost sheets in the "Culinary Cost Sheets" tab first to initialize your items.
                  </p>
                </div>
              </div>
            ) : entryTab === "manual" ? (
              <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  
                  {/* Select Recipe */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-500 block">Select Recipe</label>
                    <select
                      value={selectedRecipeId}
                      onChange={(e) => {
                        setSelectedRecipeId(e.target.value);
                        setFormError("");
                        setFormSuccess("");
                      }}
                      className="w-full bg-white border border-neutral-200 text-xs font-sans px-3 py-2.5 rounded-xl outline-none focus:ring-1 focus:ring-black focus:border-black"
                    >
                      <option value="">-- Choose active sheet --</option>
                      {recipes.map(recipe => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.name} (Sell: ${recipe.sellingPrice.toFixed(2)} • Cost: ${recipe.costPerPortion.toFixed(2)} • Margin: {recipe.profitMargin.toFixed(0)}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold text-neutral-500 block">Quantity Sold Today</label>
                    <div className="relative">
                      <input 
                        type="number"
                        placeholder="e.g. 15"
                        min="1"
                        step="1"
                        value={quantitySold}
                        onChange={(e) => {
                          setQuantitySold(e.target.value);
                          setFormError("");
                          setFormSuccess("");
                        }}
                        className="w-full bg-white border border-neutral-200 text-xs font-mono px-3 py-2.5 rounded-xl outline-none focus:ring-1 focus:ring-black focus:border-black pr-16"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-mono text-neutral-400 font-bold ">servings</span>
                    </div>
                  </div>

                  {/* Feedback line */}
                  {formError && (
                    <div className="p-2 border border-rose-500 bg-rose-50 text-rose-800 text-[10px] font-mono font-bold flex items-center gap-1.5 animate-none">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {formSuccess && (
                    <div className="p-2 border border-emerald-500 bg-emerald-50 text-emerald-950 text-[10px] font-mono font-bold flex items-center gap-1.5 animate-none">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                </div>

                <div className="pt-4 border-t border-dashed border-neutral-200/15 mt-6 space-y-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-bold py-3 rounded-xl transition-colors border border-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Archive Portion Sales</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrefillDemoSales}
                    disabled={isSubmitting}
                    className="w-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/30 text-neutral-800 text-[9px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Simulate some sales for today using recipes list to quick test the metrics"
                  >
                    <PlusCircleIcon className="h-3.5 w-3.5" />
                    <span>Prefill Simulated Lunch Sales</span>
                  </button>
                </div>
              </form>
            ) : (
              /* AI Reading Interface */
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  
                  {suggestedEntries.length === 0 ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-bold text-neutral-500 block">
                          Paste Daily POS summary / sales counts
                        </label>
                        <textarea
                          placeholder="Example:&#10;Date: 2026-06-12&#10;14 Spicy Ramen sold @ $18&#10;8 Truffle Fries sold&#10;Spitfire Burgers count: 21 ($15 each) with portion food cost $4.50"
                          value={aiText}
                          onChange={(e) => setAiText(e.target.value)}
                          className="w-full p-2.5 border border-neutral-200 text-xs font-mono h-24 bg-neutral-55 focus:outline-none focus:bg-white focus:ring-1 focus:ring-black min-h-[90px]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-bold text-neutral-500 block">
                          Or upload POS screenshot / register tape
                        </label>
                        <div className="border border-dashed border-neutral-200/40 p-3 bg-neutral-50 text-center relative flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100/50 transition-colors">
                          <input 
                            type="file" 
                            accept="image/*,application/pdf"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <span className="text-[10px] font-mono font-bold text-neutral-700 block ">
                            {aiFileName ? `Selected: ${aiFileName}` : "Browse files / Drag here"}
                          </span>
                          <span className="text-[8px] text-neutral-400 font-sans block mt-1">
                            PNG, JPG or PDF up to 10MB
                          </span>
                        </div>
                      </div>

                      {aiFileName && (
                        <div className="flex justify-start">
                          <button
                            type="button"
                            onClick={() => {
                              setAiFileName("");
                              setAiFileBase64("");
                              setAiFileType("");
                            }}
                            className="text-[9px] font-mono font-bold text-rose-700 hover:underline"
                          >
                            [ Clear Uploaded File ]
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* AI Checklist output */
                    <div className="space-y-3">
                      <div className="border border-neutral-200 p-3 bg-[#f0efeb]/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono font-bold text-neutral-600 ">Extract Date:</span>
                          <input 
                            type="date"
                            value={parsedDate}
                            onChange={(e) => setParsedDate(e.target.value)}
                            className="bg-white border border-neutral-200 text-[10px] font-mono px-1 py-0.5"
                          />
                        </div>
                        <p className="text-[9px] font-sans text-neutral-500 italic">
                          Please associate each parsed item to an active culinary recipe to record margins properly.
                        </p>
                      </div>

                      <div className="space-y-3 max-h-[190px] overflow-y-auto border border-neutral-300 p-2.5 bg-neutral-50 divide-y divide-neutral-200" id="ai-sales-entries-list">
                        {suggestedEntries.map((entry, index) => {
                          const isUnlinked = !entry.matchedRecipeId;
                          return (
                            <div key={index} className="pt-2.5 pb-2.5 first:pt-0 last:pb-0 space-y-2">
                              {/* Option title & Checkbox */}
                              <div className="flex items-start justify-between gap-1">
                                <label className="flex items-start gap-1.5 cursor-pointer max-w-[70%] select-none">
                                  <input 
                                    type="checkbox"
                                    checked={entry.selected}
                                    onChange={(e) => {
                                      const updated = [...suggestedEntries];
                                      updated[index].selected = e.target.checked;
                                      setSuggestedEntries(updated);
                                    }}
                                    className="mt-0.5 h-3.5 w-3.5 border border-neutral-200 accent-[#141414]"
                                  />
                                  <span className="text-[11px] font-sans font-bold text-neutral-900 leading-tight block break-words" title={entry.recipeName}>
                                    {entry.recipeName}
                                  </span>
                                </label>
                                <span className="text-[10px] font-mono font-bold bg-emerald-600/10 text-neutral-800 px-1.5 py-0.5 whitespace-nowrap">
                                  Qty: {entry.quantitySold}
                                </span>
                              </div>

                              {/* Dropdown mapping selector to link recipe */}
                              <div className="space-y-1">
                                <span className="text-[8px] font-mono font-bold text-neutral-400 block">DB Recipe Link:</span>
                                <select
                                  value={entry.matchedRecipeId}
                                  onChange={(e) => {
                                    const rId = e.target.value;
                                    const matchingR = recipes.find(r => r.id === rId);
                                    const updated = [...suggestedEntries];
                                    updated[index].matchedRecipeId = rId;
                                    if (matchingR) {
                                      updated[index].sellingPrice = matchingR.sellingPrice;
                                      updated[index].costPerPortion = matchingR.costPerPortion;
                                    }
                                    setSuggestedEntries(updated);
                                  }}
                                  className={`w-full bg-white border text-[10px] p-1.5 outline-none font-mono ${
                                    isUnlinked ? "border-amber-500 bg-amber-50/20" : "border-neutral-200"
                                  }`}
                                >
                                  <option value="">-- Match Culinary Sheet --</option>
                                  {recipes.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Price check row */}
                              <div className="grid grid-cols-2 gap-2 text-left">
                                <div>
                                  <span className="text-[8px] font-mono font-bold text-neutral-400 block">Unit Sell Price ($):</span>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    value={entry.sellingPrice}
                                    onChange={(e) => {
                                      const updated = [...suggestedEntries];
                                      updated[index].sellingPrice = parseFloat(e.target.value) || 0;
                                      setSuggestedEntries(updated);
                                    }}
                                    className="w-full p-1 border border-neutral-300 text-[10px] font-mono focus:border-black rounded-xl"
                                  />
                                </div>
                                <div>
                                  <span className="text-[8px] font-mono font-bold text-neutral-400 block">Portion Cost ($):</span>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    value={entry.costPerPortion}
                                    onChange={(e) => {
                                      const updated = [...suggestedEntries];
                                      updated[index].costPerPortion = parseFloat(e.target.value) || 0;
                                      setSuggestedEntries(updated);
                                    }}
                                    className="w-full p-1 border border-neutral-300 text-[10px] font-mono focus:border-black rounded-xl"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-between items-center bg-neutral-100 p-2 border border-neutral-300">
                        <span className="text-[10px] font-mono font-bold text-neutral-700">Checked:</span>
                        <span className="text-xs font-mono font-bold text-neutral-900">
                          {suggestedEntries.filter(e => e.selected).length} / {suggestedEntries.length} items
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Feedback line */}
                  {aiError && (
                    <div className="p-2 border border-rose-500 bg-rose-50 text-rose-800 text-[10px] font-mono font-bold flex items-center gap-1.5 animate-none">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {aiSuccess && (
                    <div className="p-2 border border-emerald-500 bg-emerald-50 text-emerald-900 text-[10px] font-mono font-bold flex items-center gap-1.5 animate-none">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      <span>{aiSuccess}</span>
                    </div>
                  )}

                </div>

                {/* AI control CTA buttons */}
                <div className="pt-4 border-t border-dashed border-neutral-200/15 mt-4 space-y-2">
                  {suggestedEntries.length === 0 ? (
                    <button
                      type="button"
                      onClick={handleAnalyzeSales}
                      disabled={isAnalyzing || (!aiText.trim() && !aiFileBase64)}
                      className="w-full bg-emerald-600 hover:bg-neutral-800 disabled:bg-neutral-200 text-white text-xs font-bold py-3 rounded-xl transition-colors border border-neutral-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                          <span>AI Scanning Till...</span>
                        </>
                      ) : (
                        <>
                          <Cpu className="h-4 w-4" />
                          <span>Analyze Sales with AI</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestedEntries([]);
                          setAiText("");
                          setAiFileBase64("");
                          setAiFileName("");
                          setAiSuccess("");
                          setAiError("");
                        }}
                        className="flex-1 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-900 text-[10px] font-bold py-2.5 rounded-xl transition-colors"
                      >
                        Reset Reader
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSuggested}
                        disabled={isAnalyzing}
                        className="flex-1 bg-emerald-800 hover:bg-emerald-700 disabled:bg-neutral-200 text-white text-[10px] font-bold py-2.5 rounded-xl transition-colors border border-emerald-900 flex items-center justify-center gap-1"
                      >
                        {isAnalyzing ? "Saving..." : "Save to Ledger"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ledger table (span 8/12) */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="bg-white border border-neutral-200 p-5 rounded-xl text-left flex-1 flex flex-col justify-between" id="daily-sales-ledger-card">
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-neutral-200 pb-3">
                <span className="text-[10px] text-neutral-900/60 font-bold block font-mono">
                  II. Daily Margin Performance Ledger for {selectedDate}
                </span>

                <div className="text-[10px] text-neutral-400 font-mono font-bold ">
                  {filteredSales.length} {filteredSales.length === 1 ? "entry" : "entries"} documented
                </div>
              </div>

              {filteredSales.length === 0 ? (
                <div className="py-16 text-center select-none flex flex-col items-center justify-center space-y-4">
                  <div className="p-3 bg-[#f0efeb] rounded-xl border border-neutral-200 text-neutral-600">
                    <FileBarChart className="h-7 w-7 text-neutral-800 mr-0.1" />
                  </div>
                  <div className="max-w-md">
                    <p className="text-xs font-bold text-neutral-900 ">No active sales logged for {selectedDate}</p>
                    <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
                      Select an active recipe from your culinary catalog, input the portions consumed or sold today in our count logger, and submit to see real-time food cost and profit updates contextually.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[9px] font-mono font-bold text-neutral-900/70 bg-neutral-50">
                        <th className="py-2.5 px-3">Recipe Name</th>
                        <th className="py-2.5 px-3 text-center">Qty Sold</th>
                        <th className="py-2.5 px-3 text-right">Sell Unit ($)</th>
                        <th className="py-2.5 px-3 text-right">Cost Unit ($)</th>
                        <th className="py-2.5 px-3 text-right">Total Revenue ($)</th>
                        <th className="py-2.5 px-3 text-right">Total Food Cost ($)</th>
                        <th className="py-2.5 px-3 text-right">Profit ($)</th>
                        <th className="py-2.5 px-3 text-center">Margin %</th>
                        <th className="py-2.5 px-3 text-center">Kill</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                      {filteredSales.map((sale, idx) => {
                        const rowProfit = sale.totalRevenue - sale.totalCost;
                        return (
                          <tr key={sale.id ? `${sale.id}-${idx}` : idx} className="hover:bg-neutral-50/50">
                            <td className="py-2.5 px-3 font-sans font-bold text-neutral-900 leading-tight">
                              {sale.recipeName}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              {sale.quantitySold}
                            </td>
                            <td className="py-2.5 px-3 text-right text-neutral-600">
                              ${sale.sellingPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-800">
                              ${sale.costPerPortion.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-neutral-900 font-bold">
                              ${sale.totalRevenue.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-800">
                              ${sale.totalCost.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">
                              ${rowProfit.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold ${sale.margin >= 65 ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                                {sale.margin.toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isReadOnly ? (
                                <Lock className="h-3.5 w-3.5 text-neutral-400 mx-auto" title="Read Only" />
                              ) : (
                                <button
                                  onClick={async () => {
                                    if (sale.id) {
                                      try {
                                        await onDeleteDailySale(sale.id);
                                      } catch (err) {
                                        console.error("Failed to delete daily sale item:", err);
                                      }
                                    }
                                  }}
                                  className="text-neutral-400 hover:text-red-600 p-1 rounded-xl transition-colors cursor-pointer"
                                  title="Delete this sales log row"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-neutral-200 font-bold text-[11px] bg-[#f0efeb]/40">
                        <td className="py-3 px-3 font-sans">Totals</td>
                        <td className="py-3 px-3 text-center">{totalQtySold}</td>
                        <td className="py-3 px-3"></td>
                        <td className="py-3 px-3"></td>
                        <td className="py-3 px-3 text-right text-neutral-950">${totalRevenue.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-rose-800">${totalCOGS.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-emerald-700">${grossProfit.toFixed(2)}</td>
                        <td className="py-3 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 text-[10px] ${overallMarginPercent >= 65 ? "bg-emerald-700 text-white" : overallMarginPercent > 0 ? "bg-amber-600 text-white" : "bg-neutral-500 text-white"}`}>
                            {overallMarginPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Regulatory and Intel Note */}
            <div className="mt-6 flex items-start gap-2 p-3 bg-neutral-50 border border-neutral-200 text-[10px] text-neutral-500 font-sans lines-leading-relaxed">
              <Info className="h-4 w-4 text-neutral-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold block text-neutral-800 mb-0.5 ">Culinary Intelligence Rollup Method</span>
                This ledger compiles raw ingredient costs dynamically from your current Master Catalog list inputs. Any price updates that propagate from Gemini-scanned invoices instantly re-calibrate the portion cost and margin parameters, reflecting immediately in your margins on historical or current sales logs.
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

// Inline fallback icon for PlusCircle
function PlusCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
