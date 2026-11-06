import React, { useMemo } from "react";
import { X, Calendar, DollarSign, Package } from "lucide-react";
import { Ingredient, Invoice, GroceryPurchase } from "../../src/types";

interface PurchaseHistoryModalProps {
  ingredient: Ingredient;
  invoices: Invoice[];
  groceryPurchases: GroceryPurchase[];
  onClose: () => void;
}

export function PurchaseHistoryModal({ ingredient, invoices, groceryPurchases, onClose }: PurchaseHistoryModalProps) {
  // Aggregate purchases that match this ingredient.
  // Grocery Purchases
  const groceryMatches = useMemo(() => {
    return groceryPurchases.flatMap(gp => 
      gp.items
        .filter(item => item.linkedIngredientId === ingredient.id || item.name.toLowerCase() === ingredient.name.toLowerCase())
        .map(item => ({
          date: gp.date,
          source: gp.storeName,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          type: "Grocery"
        }))
    );
  }, [groceryPurchases, ingredient]);

  // Invoices
  const invoiceMatches = useMemo(() => {
    return invoices.flatMap(inv => 
      inv.items
        .filter(item => item.targetIngredientId === ingredient.id || item.name.toLowerCase() === ingredient.name.toLowerCase())
        .map(item => ({
          date: inv.issueDate,
          source: inv.vendor,
          quantity: item.quantity,
          unit: item.unit,
          price: item.totalPrice,
          type: "Invoice"
        }))
    );
  }, [invoices, ingredient]);

  const allPurchases = useMemo(() => {
    return [...groceryMatches, ...invoiceMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [groceryMatches, invoiceMatches]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
      <div className="bg-[#fcfaf7] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-[#e5e0d8] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#e5e0d8] flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 font-serif">Purchase History</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Tracking <span className="font-semibold text-neutral-700">{ingredient.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-500 hover:text-neutral-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#faf9f7]">
          {allPurchases.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white border-2 border-dashed border-neutral-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">No Purchase History</h3>
              <p className="text-sm text-neutral-500 max-w-sm mx-auto">
                We couldn't find any recorded invoices or grocery purchases matching this ingredient.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {allPurchases.map((purchase, index) => (
                <div key={index} className="bg-white rounded-2xl p-4 border border-[#e5e0d8] shadow-sm flex items-center justify-between hover:border-[#d5d0c8] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      purchase.type === 'Invoice' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900">{purchase.source}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(purchase.date).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span className="px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-600">
                          {purchase.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-neutral-900 text-lg">${purchase.price.toFixed(2)}</div>
                    <div className="text-sm text-neutral-500 font-medium mt-0.5">
                      {purchase.quantity} {purchase.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
