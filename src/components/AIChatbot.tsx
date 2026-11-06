import React, { useState, useRef, useEffect, useMemo } from "react";
import { MessageSquare, X, Send, Bot, User as UserIcon, Loader2 } from "lucide-react";
import {
  Invoice,
  GroceryPurchase,
  Ingredient,
  Recipe,
  DailySale,
  InventoryCountSheet,
  InventoryConsumptionLog,
} from "../types";
import { subscribeWorkspaceCollection } from "../lib/firebase";
import { calculateIngredientUnitPrice, getRegisteredPackSize, calculatePoundData } from "../lib/unitConverter";

interface AIChatbotProps {
  workspaceOwnerId?: string;
  invoices: Invoice[];
  groceryPurchases: GroceryPurchase[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  dailySales: DailySale[];
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({
  workspaceOwnerId,
  invoices,
  groceryPurchases,
  ingredients,
  recipes,
  dailySales,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([
    {
      id: "0",
      role: "model",
      text: "Hi! I'm your AI Restaurant Assistant. I have full access to your Consumption Ledger, Stock Inventory & Count Sheets, Recipe Food Cost Sheets, Invoices, Grocery Purchases, and Daily Sales. Ask me anything about your food cost, consumption transactions, or stock levels!",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCountSheet[]>([]);
  const [consumptionLogs, setConsumptionLogs] = useState<InventoryConsumptionLog[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to Stocktake Count Sheets & Consumption Ledger transactions from Cloud SQL
  useEffect(() => {
    if (!workspaceOwnerId) {
      setInventoryCounts([]);
      setConsumptionLogs([]);
      return;
    }

    const unsubCounts = subscribeWorkspaceCollection<InventoryCountSheet>(
      "inventory_counts",
      { ownerId: workspaceOwnerId },
      (docs) => {
        const list = (docs as InventoryCountSheet[]).sort((a, b) =>
          (b.date || "").localeCompare(a.date || "")
        );
        setInventoryCounts(list);
      }
    );

    const unsubConsumptions = subscribeWorkspaceCollection<InventoryConsumptionLog>(
      "inventory_consumptions",
      { ownerId: workspaceOwnerId },
      (docs) => {
        const list = (docs as InventoryConsumptionLog[]).sort((a, b) => {
          const cmp = (b.date || "").localeCompare(a.date || "");
          if (cmp !== 0) return cmp;
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        });
        setConsumptionLogs(list);
      }
    );

    return () => {
      unsubCounts();
      unsubConsumptions();
    };
  }, [workspaceOwnerId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isOpen]);

  // Compute detailed recipe food cost summaries
  const recipeFoodCostSummaries = useMemo(() => {
    const getIng = (id?: string, name?: string) => {
      if (id) {
        const byId = ingredients.find((i) => i.id === id);
        if (byId) return byId;
      }
      if (name) {
        const clean = name.toLowerCase().trim();
        return ingredients.find((i) => (i.name || "").toLowerCase().trim() === clean);
      }
      return undefined;
    };

    const computeRecipe = (rec: Recipe, visited = new Set<string>()): {
      totalBatchCost: number;
      costPerServing: number;
      foodCostPercent: number;
      profitMarginPercent: number;
      lineItems: Array<{
        name: string;
        qty: number;
        unit: string;
        yieldPercent: number;
        lineCost: number;
      }>;
    } => {
      if (rec.id && visited.has(rec.id)) {
        return {
          totalBatchCost: Number(rec.totalCost) || 0,
          costPerServing: Number(rec.costPerServing) || 0,
          foodCostPercent:
            rec.sellingPrice > 0 ? ((Number(rec.costPerServing) || 0) / rec.sellingPrice) * 100 : 0,
          profitMarginPercent: Number(rec.profitMargin) || 0,
          lineItems: [],
        };
      }
      if (rec.id) visited.add(rec.id);

      let totalBatchCost = 0;
      const lineItems = (rec.ingredients || []).map((item) => {
        if (item.isSubRecipe || item.subRecipeId) {
          const sub = recipes.find((r) => r.id === (item.subRecipeId || item.ingredientId));
          const subSummary = sub ? computeRecipe(sub, new Set(visited)) : null;
          const unitRate = subSummary ? subSummary.costPerServing : item.currentRate || 0;
          const lineCost = (Number(item.grams) || 0) * unitRate;
          totalBatchCost += lineCost;
          return {
            name: sub?.name || item.name || "Sub-Recipe",
            qty: Number(item.grams) || 0,
            unit: "portions",
            yieldPercent: 100,
            lineCost: Number(lineCost.toFixed(4)),
          };
        } else {
          const ing = getIng(item.ingredientId, item.name);
          const rawRate = ing ? calculateIngredientUnitPrice(ing) : item.currentRate || 0;
          const yieldPercent =
            ing && ing.usabilityPercentage !== undefined ? Number(ing.usabilityPercentage) : 100;
          const effectiveRate = yieldPercent > 0 ? rawRate / (yieldPercent / 100) : rawRate;
          const lineCost = (Number(item.grams) || 0) * effectiveRate;
          totalBatchCost += lineCost;
          return {
            name: ing?.name || item.name,
            qty: Number(item.grams) || 0,
            unit: "g/ml",
            yieldPercent,
            lineCost: Number(lineCost.toFixed(4)),
          };
        }
      });

      const yieldPortions = Number(rec.expectedYield) > 0 ? Number(rec.expectedYield) : 1;
      const costPerServing = totalBatchCost / yieldPortions;
      const sellingPrice = Number(rec.sellingPrice) || 0;
      const foodCostPercent = sellingPrice > 0 ? (costPerServing / sellingPrice) * 100 : 0;
      const profitMarginPercent =
        sellingPrice > 0 ? ((sellingPrice - costPerServing) / sellingPrice) * 100 : 0;

      return {
        totalBatchCost: Number(totalBatchCost.toFixed(2)),
        costPerServing: Number(costPerServing.toFixed(2)),
        foodCostPercent: Number(foodCostPercent.toFixed(1)),
        profitMarginPercent: Number(profitMarginPercent.toFixed(1)),
        lineItems,
      };
    };

    return recipes.map((rec) => {
      const calc = computeRecipe(rec);
      return {
        id: rec.id,
        name: rec.name,
        department: rec.department || "Kitchen",
        expectedYieldPortions: rec.expectedYield || 1,
        sellingPrice: Number(rec.sellingPrice) || 0,
        totalBatchCost: calc.totalBatchCost,
        foodCostPerServing: calc.costPerServing,
        foodCostPercentage: calc.foodCostPercent,
        profitMarginPercentage: calc.profitMarginPercent,
        ingredients: calc.lineItems,
      };
    });
  }, [recipes, ingredients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMsg = message.trim();
    setMessage("");

    const newHistory = [
      ...history,
      { id: Date.now().toString(), role: "user" as const, text: userMsg },
    ];
    setHistory(newHistory);
    setIsLoading(true);

    try {
      // Calculate high-level Food Cost & Inventory KPIs
      const totalConsumptionFoodCost = consumptionLogs.reduce(
        (sum, log) => sum + (Number(log.totalCost) || 0),
        0
      );
      const totalInvoiceSpend = invoices.reduce((sum, inv) => {
        const invTotal =
          Number(inv.totalAmount) ||
          (inv.items || []).reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
        return sum + invTotal;
      }, 0);
      const totalGrocerySpend = groceryPurchases.reduce((sum, gp) => {
        const gpTotal =
          Number(gp.totalAmount) ||
          (gp.items || []).reduce((s, it) => s + (Number(it.price) || 0), 0);
        return sum + gpTotal;
      }, 0);
      const totalSalesRevenue = dailySales.reduce(
        (sum, s) => sum + (Number(s.totalSales) || 0),
        0
      );

      // Build comprehensive stock inventory list with on-hand stock & valuation
      const stockInventory = ingredients.map((i) => {
        const packInfo = getRegisteredPackSize(i);
        const inStockNum = Number(i.inStock) || 0;
        const unitPrice = Number(i.price) || 0;
        const qtyBase = Number(i.quantity) > 0 ? Number(i.quantity) : 1;
        const ratePerUnit = unitPrice / qtyBase;
        const poundInfo = calculatePoundData(
          inStockNum,
          i.unit || "lb",
          i.weightPerCase,
          i.weightPerCaseUnit,
          i.pcsPerPound,
          i.quantity,
          i.name
        );
        const estimatedStockValue = Number((inStockNum * ratePerUnit).toFixed(2));

        return {
          id: i.id,
          name: i.name,
          vendor: i.vendor || "Unspecified",
          inStock: inStockNum,
          unit: i.unit,
          packagingUnit: i.packagingUnit || null,
          registeredPackSize: packInfo.hasRegisteredPackSize ? packInfo.description : "Unregistered",
          inStockLbsEquivalent: poundInfo.hasWeightSpec ? Number(poundInfo.lbs.toFixed(2)) : null,
          pricePerPurchaseUnit: unitPrice,
          pricePerGram: i.pricePerGram,
          weightPerCase: i.weightPerCase || null,
          weightPerCaseUnit: i.weightPerCaseUnit || null,
          usabilityYieldPercent: i.usabilityPercentage ?? 100,
          estimatedOnHandValue: estimatedStockValue,
        };
      });

      const totalOnHandInventoryValue = stockInventory.reduce(
        (sum, item) => sum + (item.estimatedOnHandValue || 0),
        0
      );

      const dataContext = {
        foodCostSummaryMetrics: {
          totalConsumptionFoodCost: Number(totalConsumptionFoodCost.toFixed(2)),
          totalConsumptionTransactionsCount: consumptionLogs.length,
          totalOnHandInventoryValue: Number(totalOnHandInventoryValue.toFixed(2)),
          latestStocktakeSheetValue:
            inventoryCounts.length > 0 ? Number(inventoryCounts[0].totalValue || 0) : null,
          latestStocktakeDate: inventoryCounts.length > 0 ? inventoryCounts[0].date : null,
          totalInvoicePurchasesSpend: Number(totalInvoiceSpend.toFixed(2)),
          totalGroceryPurchasesSpend: Number(totalGrocerySpend.toFixed(2)),
          totalCombinedPurchasesSpend: Number((totalInvoiceSpend + totalGrocerySpend).toFixed(2)),
          totalRecordedSalesRevenue: Number(totalSalesRevenue.toFixed(2)),
          consumptionFoodCostPercentageOfSales:
            totalSalesRevenue > 0
              ? Number(((totalConsumptionFoodCost / totalSalesRevenue) * 100).toFixed(2))
              : null,
          purchasesFoodCostPercentageOfSales:
            totalSalesRevenue > 0
              ? Number(
                  (((totalInvoiceSpend + totalGrocerySpend) / totalSalesRevenue) * 100).toFixed(2)
                )
              : null,
        },
        consumptionTransactions: consumptionLogs.map((log) => ({
          id: log.id,
          date: log.date,
          createdAt: log.createdAt,
          itemType: log.itemType,
          itemName: log.itemName,
          quantity: log.quantity,
          unit: log.unit || (log.itemType === "recipe" ? "servings" : "unit"),
          foodCostTotal: Number((Number(log.totalCost) || 0).toFixed(2)),
          costPerUnit: log.costPerUnit ? Number(Number(log.costPerUnit).toFixed(2)) : null,
          staffName: log.staffName || null,
          notes: log.notes || null,
          ingredientDeductions: (log.deductions || []).map((d) => ({
            ingredientName: d.ingredientName,
            deductedQuantity: d.deductedQuantity,
            unit: d.unit,
          })),
        })),
        stockInventory,
        stocktakeCountSheets: inventoryCounts.map((sheet) => ({
          id: sheet.id,
          date: sheet.date,
          notes: sheet.notes || null,
          totalSheetValue: Number((Number(sheet.totalValue) || 0).toFixed(2)),
          itemsCounted: (sheet.items || []).map((it) => ({
            ingredientName: it.ingredientName,
            vendor: it.vendor || null,
            countedQty: it.countedQty,
            unit: it.unit,
            pricePerUnit: it.pricePerUnit,
            totalValue: it.totalValue,
          })),
        })),
        recipeFoodCostSheets: recipeFoodCostSummaries,
        dailySales: dailySales.map((s) => ({
          date: s.date,
          totalSales: s.totalSales,
          notes: s.notes || null,
        })),
        invoices: invoices.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          vendor: i.vendor,
          date: i.issueDate,
          type: i.type || "invoice",
          totalAmount: i.totalAmount,
          items: (i.items || []).map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.totalPrice,
          })),
        })),
        groceryPurchases: groceryPurchases.map((p) => ({
          date: p.date,
          store: p.storeName,
          totalAmount: p.totalAmount,
          items: (p.items || []).map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            price: i.price,
          })),
        })),
      };

      const geminiHistory = newHistory.slice(1).map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      }));
      geminiHistory.pop();

      const response = await fetch("/api/chatbot-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: geminiHistory,
          workspaceOwnerId,
          dataContext,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setHistory((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "model", text: data.reply },
      ]);
    } catch (err) {
      console.error(err);
      setHistory((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "model",
          text: "Sorry, I ran into an error processing your request.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg transition-transform hover:scale-105 z-50 flex items-center justify-center ${
          isOpen ? "scale-0" : "scale-100"
        }`}
        title="Open AI Assistant"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[360px] sm:w-[420px] h-[560px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-neutral-200 z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-200">
          {/* Header */}
          <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="font-bold text-sm leading-tight">Restaurant AI Assistant</h3>
                <p className="text-[10px] text-emerald-100">
                  Live Food Cost, Consumption & Stock Inventory
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-emerald-100 hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/50"
          >
            {history.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "user"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {msg.role === "user" ? (
                    <UserIcon className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`px-3 py-2 rounded-xl max-w-[82%] text-sm ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-tr-none"
                      : "bg-white border border-neutral-200 text-neutral-800 rounded-tl-none shadow-sm"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-500 rounded-tl-none shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span className="text-xs font-medium">Analyzing transactions & food cost...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white border-t border-neutral-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about food cost, consumption, stock..."
              className="flex-1 bg-neutral-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-4 py-2.5 text-sm transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
