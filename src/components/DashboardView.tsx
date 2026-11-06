import React, { useState, useMemo } from "react";
import { Recipe, DailySale, Ingredient, Invoice, RecipeIngredientRef } from "../types";
import { getGramsOrMlEquivalent } from "../lib/unitConverter";
import { 
  TrendingUp, 
  Coins, 
  Percent, 
  DollarSign, 
  Calendar, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  ClipboardCheck, 
  PieChart, 
  ArrowUpRight, 
  FileSpreadsheet, 
  Info,
  Clock,
  Layers,
  Database
} from "lucide-react";

interface DashboardViewProps {
  recipes: Recipe[];
  dailySales: DailySale[];
  ingredients: Ingredient[];
  invoices: Invoice[];
  userRole: string;
  onSwitchSection: (section: string) => void;
}

export default function DashboardView({
  recipes,
  dailySales,
  ingredients,
  invoices,
  userRole,
  onSwitchSection
}: DashboardViewProps) {
  // Preset date filters
  type DatePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "allTime" | "custom";
  const [datePreset, setDatePreset] = useState<DatePreset>("last7");
  
  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Active hover date for chart tooltips
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Copy status for developer database prompt
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  // Resolve current Date Range
  const dateRange = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    
    let start = "";
    let end = todayStr;

    if (datePreset === "today") {
      start = todayStr;
      end = todayStr;
    } else if (datePreset === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yestStr = d.toISOString().split("T")[0];
      start = yestStr;
      end = yestStr;
    } else if (datePreset === "last7") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split("T")[0];
    } else if (datePreset === "last30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split("T")[0];
    } else if (datePreset === "thisMonth") {
      const d = new Date();
      d.setDate(1); // First of current month
      start = d.toISOString().split("T")[0];
    } else if (datePreset === "allTime") {
      start = "1970-01-01";
    } else {
      start = customStartDate;
      end = customEndDate;
    }

    return { start, end };
  }, [datePreset, customStartDate, customEndDate]);

  // Filter Sales based on active Date Range
  const filteredSales = useMemo(() => {
    return dailySales.filter(sale => {
      const sDate = sale.date;
      return sDate >= dateRange.start && sDate <= dateRange.end;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailySales, dateRange]);

  // Compute Core Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalPortions = 0;

    filteredSales.forEach(sale => {
      totalRevenue += sale.totalRevenue || 0;
      totalCost += sale.totalCost || 0;
      totalPortions += sale.quantitySold || 0;
    });

    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const foodCostPercent = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      profitMargin,
      foodCostPercent,
      totalPortions
    };
  }, [filteredSales]);

  // Group Sales by Day for visual trends chart
  const dailyChartData = useMemo(() => {
    const groups: { [date: string]: { date: string; revenue: number; cost: number; profit: number } } = {};
    
    // Fill all days in range with zero if range length <= 31 to prevent gappy chart
    const startMs = new Date(dateRange.start).getTime();
    const endMs = new Date(dateRange.end).getTime();
    
    if (endMs >= startMs && (endMs - startMs) / (1000 * 60 * 60 * 24) <= 31) {
      const current = new Date(dateRange.start);
      const endLimit = new Date(dateRange.end);
      while (current <= endLimit) {
        const dateStr = current.toISOString().split("T")[0];
        groups[dateStr] = { date: dateStr, revenue: 0, cost: 0, profit: 0 };
        current.setDate(current.getDate() + 1);
      }
    }

    // Populate actual sales
    filteredSales.forEach(sale => {
      const d = sale.date;
      if (!groups[d]) {
        groups[d] = { date: d, revenue: 0, cost: 0, profit: 0 };
      }
      groups[d].revenue += sale.totalRevenue || 0;
      groups[d].cost += sale.totalCost || 0;
      groups[d].profit += (sale.totalRevenue - sale.totalCost) || 0;
    });

    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSales, dateRange]);

  // Department Sales Categorization (Linking sales to corresponding recipe departments)
  const departmentBreakdown = useMemo(() => {
    const depts: { [dept: string]: { name: string; revenue: number; cost: number; portions: number } } = {};

    filteredSales.forEach(sale => {
      // Find the corresponding recipe to discover its department
      const recipe = recipes.find(r => r.id === sale.recipeId);
      const deptName = recipe?.department || "Kitchen"; // default to Kitchen if uncategorized

      if (!depts[deptName]) {
        depts[deptName] = { name: deptName, revenue: 0, cost: 0, portions: 0 };
      }
      
      depts[deptName].revenue += sale.totalRevenue || 0;
      depts[deptName].cost += sale.totalCost || 0;
      depts[deptName].portions += sale.quantitySold || 0;
    });

    return Object.values(depts).map(d => {
      const profit = d.revenue - d.cost;
      const margin = d.revenue > 0 ? (profit / d.revenue) * 100 : 0;
      return { ...d, profit, margin };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, recipes]);

  // Theoretical Purchase vs Sales Consumption Variance
  // Translates POS recipe sales into theoretical ingredient usage (grams/ml),
  // then aggregates applied invoice purchases of those exact ingredients to calculate Variance!
  const varianceReport = useMemo(() => {
    // 1. Calculate Theoretical Consumption for each ingredient ID
    const theoreticalConsumption: { [ingId: string]: { name: string; gramsNeeded: number; cost: number } } = {};

    filteredSales.forEach(sale => {
      // Get the recipe formulation
      const recipe = recipes.find(r => r.id === sale.recipeId);
      if (!recipe) return;

      const scaleMultiplier = sale.quantitySold / (recipe.expectedYield || 1);

      const addRefConsumption = (ref: RecipeIngredientRef, currentMultiplier: number, visited: string[] = []) => {
        if (!ref.ingredientId) return;

        if (ref.isSubRecipe || ref.subRecipeId) {
          const subId = ref.subRecipeId || ref.ingredientId;
          if (visited.includes(subId)) return;
          const subRecipe = recipes.find(r => r.id === subId);
          if (!subRecipe) return;
          const subMultiplier = currentMultiplier * (ref.grams / (subRecipe.expectedYield || 1));
          subRecipe.ingredients.forEach(subRef => {
            addRefConsumption(subRef, subMultiplier, [...visited, subId]);
          });
        } else {
          if (!theoreticalConsumption[ref.ingredientId]) {
            theoreticalConsumption[ref.ingredientId] = { name: ref.name, gramsNeeded: 0, cost: 0 };
          }
          const gramsUsed = ref.grams * currentMultiplier;
          theoreticalConsumption[ref.ingredientId].gramsNeeded += gramsUsed;
        }
      };

      recipe.ingredients.forEach(ref => {
        addRefConsumption(ref, scaleMultiplier);
      });
    });

    // 2. Aggregate Actual Purchases from APPLIED Invoices in the active date range
    const actualPurchases: { [ingId: string]: { gramsPurchased: number; spend: number } } = {};

    const appliedInvoicesInRange = invoices.filter(inv => {
      const dateStr = inv.issueDate || inv.createdAt?.split("T")[0] || "";
      return inv.status === "applied" && dateStr >= dateRange.start && dateStr <= dateRange.end;
    });

    appliedInvoicesInRange.forEach(inv => {
      inv.items.forEach(item => {
        // Find if this invoice item was mapped to an ingredient
        const ingId = item.targetIngredientId;
        if (!ingId) return;

        if (!actualPurchases[ingId]) {
          actualPurchases[ingId] = { gramsPurchased: 0, spend: 0 };
        }

        // Determine package weight in grams/ml
        let totalWeightForThisItem = 0;
        
        if (item.weightPerCase && item.weightPerCaseUnit) {
          // Calculate standard grams/ml per single case
          const singleUnitGrams = getGramsOrMlEquivalent(item.weightPerCase, item.weightPerCaseUnit);
          totalWeightForThisItem = singleUnitGrams * (item.quantity || 1);
        } else {
          // Fallback to searching the master ingredient specs
          const masterIng = ingredients.find(i => i.id === ingId);
          if (masterIng) {
            const singleUnitGrams = getGramsOrMlEquivalent(masterIng.quantity, masterIng.unit);
            totalWeightForThisItem = singleUnitGrams * (item.quantity || 1);
          }
        }

        actualPurchases[ingId].gramsPurchased += totalWeightForThisItem;
        actualPurchases[ingId].spend += item.totalPrice || 0;
      });
    });

    // 3. Compile report for ingredients that have active sales consumption or invoice purchases
    const reportList: Array<{
      id: string;
      name: string;
      unit: string;
      theoreticalGrams: number;
      purchasedGrams: number;
      varianceGrams: number;
      theoreticalDisplay: string;
      purchasedDisplay: string;
      varianceDisplay: string;
      status: "optimal" | "overstocked" | "shortage" | "balanced";
    }> = [];

    // Union of all ingredient IDs from both theoretical usage and actual purchases
    const uniqueIngIds = new Set([
      ...Object.keys(theoreticalConsumption),
      ...Object.keys(actualPurchases)
    ]);

    uniqueIngIds.forEach(id => {
      const masterIng = ingredients.find(i => i.id === id);
      if (!masterIng) return; // skip if ingredient no longer exists in DB

      const theory = theoreticalConsumption[id] || { gramsNeeded: 0, cost: 0 };
      const purchase = actualPurchases[id] || { gramsPurchased: 0, spend: 0 };

      const varianceGrams = purchase.gramsPurchased - theory.gramsNeeded;
      
      // Select appropriate unit for display (default to Master ingredient unit, convert from grams/ml if needed)
      const displayUnit = masterIng.unit || "g";
      const cleanUnit = displayUnit.toLowerCase().trim();

      const formatValue = (grams: number) => {
        if (grams === 0) return "0 " + displayUnit;
        
        // Convert base grams back into display unit
        let value = grams;
        if (["kg", "kilogram", "kilograms"].includes(cleanUnit)) value = grams / 1000;
        else if (["l", "liter", "liters"].includes(cleanUnit)) value = grams / 1000;
        else if (["lb", "lbs", "pound", "pounds"].includes(cleanUnit)) value = grams / 453.59237;
        else if (["oz", "ounce", "ounces"].includes(cleanUnit)) value = grams / 28.3495231;

        return `${value.toFixed(1)} ${displayUnit}`;
      };

      // Determine alert status
      let status: "optimal" | "overstocked" | "shortage" | "balanced" = "optimal";
      const percentDiff = theory.gramsNeeded > 0 ? (varianceGrams / theory.gramsNeeded) * 100 : 100;

      if (theory.gramsNeeded === 0 && purchase.gramsPurchased > 0) {
        status = "overstocked"; // Purchased but none sold theoretically
      } else if (varianceGrams < -100 && theory.gramsNeeded > 0) {
        status = "shortage"; // Sold much more than purchased in this window (used inventory)
      } else if (percentDiff > 40) {
        status = "overstocked"; // Purchased > 40% more than theoretically used
      } else if (Math.abs(percentDiff) <= 15) {
        status = "balanced"; // Usage and purchases closely aligned
      }

      reportList.push({
        id,
        name: masterIng.name,
        unit: displayUnit,
        theoreticalGrams: theory.gramsNeeded,
        purchasedGrams: purchase.gramsPurchased,
        varianceGrams,
        theoreticalDisplay: formatValue(theory.gramsNeeded),
        purchasedDisplay: formatValue(purchase.gramsPurchased),
        varianceDisplay: (varianceGrams > 0 ? "+" : "") + formatValue(varianceGrams),
        status
      });
    });

    // Sort report showing biggest overstocks or waste profiles first
    return reportList.sort((a, b) => b.varianceGrams - a.varianceGrams);
  }, [filteredSales, recipes, invoices, ingredients, dateRange]);

  // Menu Item Profit Matrix (Top & Bottom Dish Margins)
  const menuProfitability = useMemo(() => {
    return recipes.map(recipe => {
      const cost = recipe.costPerPortion || 0;
      const price = recipe.sellingPrice || 0;
      const profit = price - cost;
      const margin = price > 0 ? (profit / price) * 100 : 0;
      return {
        ...recipe,
        profit,
        margin
      };
    }).sort((a, b) => b.margin - a.margin);
  }, [recipes]);

  const topDishes = useMemo(() => menuProfitability.slice(0, 5), [menuProfitability]);
  const bottomDishes = useMemo(() => [...menuProfitability].reverse().slice(0, 5), [menuProfitability]);

  // Copy full system blueprint to clipboard helper
  const handleCopyPrompt = async () => {
    try {
      const response = await fetch("/DATABASE_PROMPT.md");
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  return (
    <div className="space-y-8 text-left" id="executive-dashboard-view">
      
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight flex items-center gap-2">
            <PieChart className="h-5 w-5 text-emerald-600" />
            Executive Financial Dashboard
          </h2>
          <p className="text-xs text-neutral-500 font-sans">
            Real-time culinary analytics: Linking Point-of-Sale recipe sales, cost sheets, and vendor invoices.
          </p>
        </div>

        {/* Date Range Selection Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-neutral-50 p-1.5 border border-neutral-200 rounded-xl w-full md:w-auto" id="dashboard-date-filter-bar">
          {(["today", "yesterday", "last7", "last30", "thisMonth", "allTime", "custom"] as DatePreset[]).map(preset => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                datePreset === preset 
                  ? "bg-neutral-900 text-white" 
                  : "text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100"
              }`}
            >
              {preset === "thisMonth" ? "This Month" : preset === "allTime" ? "All Time" : preset}
            </button>
          ))}
        </div>
      </div>

      {/* Re-Design Architecture Blueprint Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white border border-indigo-800/60 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
            <Database className="h-4 w-4" />
            <span>Commercial Multi-Tenant System Blueprint</span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            Re-architecting for Outside Clients: PostgreSQL Ledger & Offline POS
          </h3>
          <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed">
            Explore the complete production-grade blueprint: double-entry inventory ledger, Row-Level Security tenant isolation, offline kitchen sync, and distributor EDI pipelines.
          </p>
        </div>
        <button
          onClick={() => onSwitchSection("system-architecture")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-center"
        >
          <span>Open System Blueprint</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Custom Date Inputs (only shown if custom selected) */}
      {datePreset === "custom" && (
        <div className="bg-white border border-neutral-200 p-4 rounded-2xl flex flex-wrap items-center gap-4 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-600">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span>Start Date:</span>
            <input 
              type="date" 
              value={customStartDate} 
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-neutral-50 border border-neutral-300 rounded-lg px-2 py-1 text-xs outline-none text-neutral-900 focus:ring-1 focus:ring-black focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-600">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span>End Date:</span>
            <input 
              type="date" 
              value={customEndDate} 
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-neutral-50 border border-neutral-300 rounded-lg px-2 py-1 text-xs outline-none text-neutral-900 focus:ring-1 focus:ring-black focus:bg-white"
            />
          </div>
          <div className="text-[10px] text-neutral-400 font-sans italic ml-auto">
            Resolves standard comparison index
          </div>
        </div>
      )}

      {/* Date display verification line */}
      <div className="text-[11px] font-mono font-bold text-neutral-500 flex items-center gap-1.5 px-1">
        <Clock className="w-3.5 h-3.5 text-neutral-400" />
        <span>Audit Interval:</span>
        <span className="text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
          {dateRange.start === "1970-01-01" ? "First logged entry" : dateRange.start}
        </span>
        <span className="text-neutral-400 font-sans font-medium">to</span>
        <span className="text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
          {dateRange.end}
        </span>
        <span className="text-neutral-400 font-sans font-normal ml-1">
          ({filteredSales.length} daily transactions matched)
        </span>
      </div>

      {/* 2. KPI Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="dashboard-kpi-grid">
        
        {/* KPI Card: Sales Revenue */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex justify-between items-center text-neutral-500">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Gross Sales Revenue</span>
              <Coins className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-extrabold text-neutral-900 font-mono mt-2 tracking-tight">
              ${metrics.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <p className="text-[10px] text-neutral-400 font-sans mt-2 flex items-center gap-1">
            <ArrowUpRight className="h-3 w-3 text-emerald-500 shrink-0" />
            <span>Sold <strong>{metrics.totalPortions}</strong> total recipe portions</span>
          </p>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-emerald-100 rounded-full blur-3xl opacity-30 pointer-events-none -mr-8 -mb-8"></div>
        </div>

        {/* KPI Card: Food Cost (COGS) */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex justify-between items-center text-neutral-500">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Cost of Goods (COGS)</span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-3xl font-extrabold text-neutral-900 font-mono mt-2 tracking-tight">
              ${metrics.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <p className="text-[10px] text-rose-700 font-mono font-bold mt-2">
            Theoretical Food Cost Rate: {metrics.foodCostPercent.toFixed(1)}%
          </p>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-rose-100 rounded-full blur-3xl opacity-30 pointer-events-none -mr-8 -mb-8"></div>
        </div>

        {/* KPI Card: Gross Profit */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex justify-between items-center text-neutral-500">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Gross Profit ($)</span>
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-3xl font-extrabold text-neutral-900 font-mono mt-2 tracking-tight">
              ${metrics.grossProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <p className="text-[10px] text-neutral-400 font-sans mt-2">
            Net spread after raw ingredient deducts
          </p>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-amber-100 rounded-full blur-3xl opacity-20 pointer-events-none -mr-8 -mb-8"></div>
        </div>

        {/* KPI Card: Margin Efficiency */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between h-32">
          <div>
            <div className="flex justify-between items-center text-neutral-500">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Gross Profit Margin %</span>
              <Percent className="h-4 w-4 text-blue-500" />
            </div>
            <p className={`text-3xl font-extrabold font-mono mt-2 tracking-tight ${metrics.profitMargin >= 65 ? "text-emerald-700" : metrics.profitMargin > 0 ? "text-amber-600" : "text-neutral-500"}`}>
              {metrics.profitMargin.toFixed(1)}%
            </p>
          </div>
          <div className="mt-2 text-[10px] font-mono flex items-center gap-1">
            {metrics.profitMargin >= 65 ? (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Target Achieved (&ge; 65%)</span>
            ) : metrics.profitMargin > 0 ? (
              <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">Action Required (Target &ge; 65%)</span>
            ) : (
              <span className="text-neutral-400">No active performance index</span>
            )}
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 bg-blue-100 rounded-full blur-3xl opacity-20 pointer-events-none -mr-8 -mb-8"></div>
        </div>
      </div>

      {/* 3. Splits: Interactive SVGs and Department breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="dashboard-visuals-grid">
        
        {/* LEFT COLUMN: Revenue vs Cost Daily SVG Chart (span 7) */}
        <div className="lg:col-span-7 bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between min-h-[400px]">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-neutral-900 tracking-tight">
                Daily Revenue vs. Cost of Goods Sold (COGS)
              </h3>
              <p className="text-[11px] text-neutral-500">
                Visualizing portions profitability day-by-day. Hover over columns to inspect details.
              </p>
            </div>

            {/* Legend indicators */}
            <div className="flex items-center gap-3 text-[10px] font-mono font-bold shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded"></div>
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-rose-400 rounded"></div>
                <span>COGS (Food Cost)</span>
              </div>
            </div>
          </div>

          {dailyChartData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-50 border border-dashed border-neutral-200 rounded-xl">
              <TrendingUp className="h-10 w-10 text-neutral-300 mb-2" />
              <p className="text-xs font-bold text-neutral-500">No Sales Logged in this Period</p>
              <p className="text-[10px] text-neutral-400 mt-1 max-w-xs leading-relaxed">
                Record sales manually or upload POS summaries in the <strong>Food Cost Intel</strong> tab to initialize daily metric columns.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-end pt-4">
              {/* Responsive SVG Grid Layout */}
              <div className="h-64 w-full relative">
                <svg className="w-full h-full" viewBox="0 0 1000 300" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  {[0, 25, 50, 75, 100].map((percent, idx) => (
                    <line
                      key={idx}
                      x1="0"
                      y1={(300 - (percent * 300) / 100).toFixed(0)}
                      x2="1000"
                      y2={(300 - (percent * 300) / 100).toFixed(0)}
                      stroke="#f1f5f9"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  ))}

                  {/* Columns Render */}
                  {(() => {
                    const maxVal = Math.max(...dailyChartData.map(d => Math.max(d.revenue, d.cost)), 100);
                    const count = dailyChartData.length;
                    const blockWidth = 1000 / count;
                    const barWidth = Math.min(blockWidth * 0.3, 20);

                    return dailyChartData.map((d, index) => {
                      const xBase = index * blockWidth + blockWidth / 2;
                      const revHeight = (d.revenue / maxVal) * 250; // leave padding on top
                      const costHeight = (d.cost / maxVal) * 250;

                      return (
                        <g 
                          key={index} 
                          className="cursor-pointer group"
                          onMouseEnter={() => setHoveredBarIndex(index)}
                          onMouseLeave={() => setHoveredBarIndex(null)}
                        >
                          {/* Transparent hover background helper */}
                          <rect
                            x={index * blockWidth}
                            y="0"
                            width={blockWidth}
                            height="300"
                            fill="transparent"
                            className="hover:fill-neutral-50/50"
                          />

                          {/* Revenue Bar (Green) */}
                          <rect
                            x={xBase - barWidth - 1}
                            y={300 - revHeight}
                            width={barWidth}
                            height={revHeight}
                            fill="#10b981"
                            className="transition-all duration-300 group-hover:opacity-90"
                            rx="1.5"
                          />

                          {/* Cost Bar (Rose/Red) */}
                          <rect
                            x={xBase + 1}
                            y={300 - costHeight}
                            width={barWidth}
                            height={costHeight}
                            fill="#fb7185"
                            className="transition-all duration-300 group-hover:opacity-90"
                            rx="1.5"
                          />
                        </g>
                      );
                    });
                  })()}
                </svg>

                {/* Date Labels below SVG */}
                <div className="flex justify-between text-[8px] font-mono font-bold text-neutral-400 pt-2 border-t border-neutral-100">
                  <span>{dailyChartData[0]?.date}</span>
                  {dailyChartData.length > 2 && (
                    <span>{dailyChartData[Math.floor(dailyChartData.length / 2)]?.date}</span>
                  )}
                  <span>{dailyChartData[dailyChartData.length - 1]?.date}</span>
                </div>

                {/* Tooltip Popup */}
                {hoveredBarIndex !== null && dailyChartData[hoveredBarIndex] && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 bg-neutral-900 text-white p-3 shadow-xl rounded-xl border border-neutral-800 text-[10px] font-mono z-20 space-y-1 w-48 text-left animate-none">
                    <div className="font-bold border-b border-neutral-700 pb-1 mb-1 text-neutral-400">
                      Date: {dailyChartData[hoveredBarIndex].date}
                    </div>
                    <div className="flex justify-between">
                      <span>Sales Revenue:</span>
                      <strong className="text-emerald-400">${dailyChartData[hoveredBarIndex].revenue.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Food Cost (COGS):</span>
                      <strong className="text-rose-400">${dailyChartData[hoveredBarIndex].cost.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-neutral-700 pt-1 mt-1 font-bold text-neutral-200">
                      <span>Net Profit:</span>
                      <span>${(dailyChartData[hoveredBarIndex].revenue - dailyChartData[hoveredBarIndex].cost).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-neutral-400">
                      <span>Margin:</span>
                      <span>
                        {dailyChartData[hoveredBarIndex].revenue > 0 
                          ? ((dailyChartData[hoveredBarIndex].revenue - dailyChartData[hoveredBarIndex].cost) / dailyChartData[hoveredBarIndex].revenue * 100).toFixed(1)
                          : "0.0"
                        }%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sales by Department (span 5) */}
        <div className="lg:col-span-5 bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between min-h-[400px]">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-neutral-900 tracking-tight">
              Categorized Sales & Profitability by Department
            </h3>
            <p className="text-[11px] text-neutral-500">
              Department margins derived dynamically from Cost Sheets and Daily Sales logs.
            </p>
          </div>

          {departmentBreakdown.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-50 border border-dashed border-neutral-200 rounded-xl">
              <Layers className="h-10 w-10 text-neutral-300 mb-2" />
              <p className="text-xs font-bold text-neutral-500">No Categorized Data available</p>
              <p className="text-[10px] text-neutral-400 mt-1 max-w-xs leading-relaxed">
                Departments are linked to Recipes (Cost Sheets). Add departments to recipes in the Cost Sheets tab to group sales.
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-4 pt-4 overflow-y-auto max-h-72 pr-1" id="department-breakdown-list">
              {departmentBreakdown.map((dept, idx) => {
                const maxRevenue = Math.max(...departmentBreakdown.map(d => d.revenue), 10);
                const barPercent = Math.max((dept.revenue / maxRevenue) * 100, 3);

                return (
                  <div key={idx} className="space-y-1.5 border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between text-[11px] font-bold text-neutral-850">
                      <span className="flex items-center gap-1.5 font-sans text-neutral-900">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        {dept.name}
                      </span>
                      <span className="font-mono text-neutral-850">
                        ${dept.revenue.toFixed(2)}
                      </span>
                    </div>

                    {/* Progress Bar visual represent */}
                    <div className="h-2.5 w-full bg-neutral-100 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${barPercent}%` }}
                      ></div>
                    </div>

                    {/* Metrics detail row */}
                    <div className="flex justify-between text-[9px] font-mono text-neutral-400">
                      <span>COGS: ${dept.cost.toFixed(2)}</span>
                      <span>Profit: ${dept.profit.toFixed(2)}</span>
                      <span className={`font-bold ${dept.margin >= 65 ? "text-emerald-700" : "text-amber-600"}`}>
                        Margin: {dept.margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-[10px] font-sans text-neutral-400">
            <span>Core departments matched</span>
            <button
              onClick={() => onSwitchSection("recipes")}
              className="text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              Configure Cost Sheets Departments <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Invoice Purchases vs Theoretical Consumption (VARIANCE REPORT) */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4" id="dashboard-variance-panel">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-neutral-900 tracking-tight flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-neutral-800" />
              Supplier Invoices vs. POS Sales Variance Analysis
            </h3>
            <p className="text-[11px] text-neutral-500">
              Comparing actual purchased ingredients (Applied Invoices) with theoretical consumption (POS daily portions sold).
            </p>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-[9px] font-mono text-neutral-600 leading-relaxed max-w-sm">
            <strong>Theoretical Consumption</strong> is calculated automatically by expanding the ingredient requirements of all portions sold during the period.
          </div>
        </div>

        {varianceReport.length === 0 ? (
          <div className="p-8 text-center bg-neutral-50 border border-dashed border-neutral-200 rounded-xl text-neutral-400">
            <Info className="h-8 w-8 mx-auto text-neutral-300 mb-2" />
            <p className="text-xs font-bold text-neutral-500">No Variance Data in this period</p>
            <p className="text-[10px] text-neutral-400 mt-1">
              Apply a vendor purchase invoice and log daily recipe sales in the same date interval to inspect ingredient shrinkage.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f0efeb] text-neutral-700 font-mono text-[10px] font-bold uppercase tracking-wider border-b border-neutral-200">
                  <th className="p-3">Ingredient Name</th>
                  <th className="p-3 text-right">Theoretical Usage (POS Sales)</th>
                  <th className="p-3 text-right">Actual Purchased (Invoices)</th>
                  <th className="p-3 text-right">Variance Balance</th>
                  <th className="p-3 text-center">Status Insight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {varianceReport.slice(0, 8).map((item, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-3 font-semibold text-neutral-850 font-sans">{item.name}</td>
                    <td className="p-3 text-right font-mono text-neutral-900">{item.theoreticalDisplay}</td>
                    <td className="p-3 text-right font-mono text-neutral-900">{item.purchasedDisplay}</td>
                    <td className={`p-3 text-right font-mono font-bold ${
                      item.varianceGrams > 0 ? "text-amber-600" : item.varianceGrams < -100 ? "text-rose-600" : "text-emerald-700"
                    }`}>
                      {item.varianceDisplay}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        {item.status === "overstocked" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Overstocked / Excess Purchase
                          </span>
                        )}
                        {item.status === "shortage" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            Sourced from prior Stock
                          </span>
                        )}
                        {item.status === "balanced" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Optimal Balance
                          </span>
                        )}
                        {item.status === "optimal" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            Usage Aligned
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between text-xs text-neutral-500">
          <span>Need deeper ingredient price trends, vendor volume, or category allocation reports?</span>
          <button
            onClick={() => onSwitchSection("reports")}
            className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer hover:underline"
          >
            Launch Report Center <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 5. Menu Matrix: Best vs Warning Dishes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8" id="menu-profitability-matrix">
        
        {/* Top Performers (high margin) */}
        <div className="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-emerald-850 uppercase tracking-wider font-mono flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Highest Margin Dishes (Target &ge; 65%)
            </h4>
            <p className="text-[10px] text-neutral-500">
              The culinary team's gold standards. High profit yield per serving.
            </p>
          </div>

          {recipes.length === 0 ? (
            <p className="text-[11px] text-neutral-400 italic">No recipes configured yet.</p>
          ) : (
            <div className="space-y-2.5">
              {topDishes.map((dish, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-neutral-50 border border-neutral-150 rounded-xl hover:bg-neutral-100/50 transition-colors">
                  <div className="text-left leading-tight">
                    <p className="text-xs font-bold text-neutral-900">{dish.name}</p>
                    <p className="text-[10px] text-neutral-400 font-sans mt-0.5">{dish.department || "Kitchen"} • Yield: {dish.expectedYield} servings</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold font-mono text-emerald-700">{dish.profitMargin.toFixed(0)}% Margin</p>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Price: ${dish.sellingPrice.toFixed(2)} • Cost: ${dish.costPerPortion.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attention Items (low margin) */}
        <div className="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-rose-850 uppercase tracking-wider font-mono flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Critical Attention Items (&lt; 50% Margin)
            </h4>
            <p className="text-[10px] text-neutral-500">
              Dishes being eroded by rising invoice prices. Consider adjusting selling price or substituting suppliers.
            </p>
          </div>

          {recipes.length === 0 ? (
            <p className="text-[11px] text-neutral-400 italic">No recipes configured yet.</p>
          ) : (
            <div className="space-y-2.5">
              {bottomDishes.map((dish, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-neutral-50 border border-neutral-150 rounded-xl hover:bg-neutral-100/50 transition-colors">
                  <div className="text-left leading-tight">
                    <p className="text-xs font-bold text-neutral-900">{dish.name}</p>
                    <p className="text-[10px] text-neutral-400 font-sans mt-0.5">{dish.department || "Kitchen"} • Yield: {dish.expectedYield} servings</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold font-mono ${dish.profitMargin < 50 ? "text-red-650" : "text-amber-600"}`}>{dish.profitMargin.toFixed(0)}% Margin</p>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Price: ${dish.sellingPrice.toFixed(2)} • Cost: ${dish.costPerPortion.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Deep Collaboration Tool: Database Spec Export Prompt Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-md border border-slate-800" id="dev-blueprint-export-section">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 text-left max-w-2xl">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold uppercase tracking-wider">
              Cross-Platform Integration
            </span>
            <h3 className="text-[15px] font-bold tracking-tight">
              Share Database Schema & Logic Blueprint with Other AI Systems
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Your colleague is building an app on the same database. Click below to copy a highly thorough, formal system specification prompt. You can paste this directly into any AI system to let it know exactly how the Firestore collections, cost rollup formulas, and Variance analyses are established.
            </p>
          </div>

          <button
            onClick={handleCopyPrompt}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold tracking-wide rounded-xl border border-emerald-500 transition-all flex items-center gap-2 cursor-pointer shadow-sm shrink-0 font-sans"
          >
            {copiedPrompt ? (
              <>
                <ClipboardCheck className="h-4 w-4 text-white" />
                <span>SPECIFICATION COPIED!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-white" />
                <span>COPY SPECIFICATION PROMPT</span>
              </>
            )}
          </button>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-10 pointer-events-none -mr-20 -mt-20"></div>
      </div>

    </div>
  );
}
